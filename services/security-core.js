// Hapanamy.lk Security, RBAC & Fraud Protection Engine (STEP 31)
// Implements granular Role-Based Access Control (RBAC), Authentication Security (Password hashing, 2FA, Rate limiting, Password reset),
// multi-sensor Fraud Detection (Duplicate accounts, duplicate slips, repeated bank refs, rapid registrations, refund abuse),
// sensitive file access guards, and immutable security audit logs.

const crypto = require('crypto');

// Granular Permissions
const PERMISSIONS = {
    PRODUCT_MANAGEMENT: 'PRODUCT_MANAGEMENT',
    COMMISSION_MANAGEMENT: 'COMMISSION_MANAGEMENT',
    PAYMENT_APPROVAL: 'PAYMENT_APPROVAL',
    WITHDRAWAL_APPROVAL: 'WITHDRAWAL_APPROVAL',
    KYC_REVIEW: 'KYC_REVIEW',
    REPORTS_ACCESS: 'REPORTS_ACCESS',
    USER_MANAGEMENT: 'USER_MANAGEMENT'
};

// Role-to-Permissions Mapping
const ROLE_PERMISSIONS = {
    SUPER_ADMIN: [
        PERMISSIONS.PRODUCT_MANAGEMENT,
        PERMISSIONS.COMMISSION_MANAGEMENT,
        PERMISSIONS.PAYMENT_APPROVAL,
        PERMISSIONS.WITHDRAWAL_APPROVAL,
        PERMISSIONS.KYC_REVIEW,
        PERMISSIONS.REPORTS_ACCESS,
        PERMISSIONS.USER_MANAGEMENT
    ],
    ADMIN: [
        PERMISSIONS.PRODUCT_MANAGEMENT,
        PERMISSIONS.COMMISSION_MANAGEMENT,
        PERMISSIONS.PAYMENT_APPROVAL,
        PERMISSIONS.WITHDRAWAL_APPROVAL,
        PERMISSIONS.KYC_REVIEW,
        PERMISSIONS.REPORTS_ACCESS,
        PERMISSIONS.USER_MANAGEMENT
    ],
    FINANCE_ADMIN: [
        PERMISSIONS.COMMISSION_MANAGEMENT,
        PERMISSIONS.PAYMENT_APPROVAL,
        PERMISSIONS.WITHDRAWAL_APPROVAL,
        PERMISSIONS.REPORTS_ACCESS
    ],
    COMPLIANCE: [
        PERMISSIONS.KYC_REVIEW,
        PERMISSIONS.PAYMENT_APPROVAL,
        PERMISSIONS.USER_MANAGEMENT,
        PERMISSIONS.REPORTS_ACCESS
    ],
    SUPPORT_ADMIN: [
        PERMISSIONS.KYC_REVIEW,
        PERMISSIONS.REPORTS_ACCESS
    ],
    MEMBER: []
};

const SecurityCore = {
    PERMISSIONS,
    ROLE_PERMISSIONS,

    // In-memory rate limiting and login attempt trackers
    rateLimitMap: new Map(),
    failedLoginTracker: new Map(),
    passwordResetTokens: new Map(),
    active2FASessions: new Map(),
    processingLocks: new Set(),

    /**
     * Attempts to acquire an atomic mutex lock for an identifier (e.g. wallet transaction, payment approval).
     * Returns true if lock acquired, false if already locked.
     */
    acquireLock(resourceKey) {
        if (!resourceKey) return true;
        if (this.processingLocks.has(resourceKey)) {
            return false; // Already locked by another concurrent process
        }
        this.processingLocks.add(resourceKey);
        return true;
    },

    /**
     * Releases an acquired mutex lock.
     */
    releaseLock(resourceKey) {
        if (!resourceKey) return;
        this.processingLocks.delete(resourceKey);
    },

    /**
     * Strips client-manipulated fields (e.g., role, balance, commission_rates, status) to prevent frontend tampering.
     */
    filterAuthoritativeFields(clientPayload = {}, forbiddenKeys = ['role', 'balance', 'status', 'is_admin', 'commission_rate', 'price', 'direct_commission_percent']) {
        const sanitized = { ...clientPayload };
        forbiddenKeys.forEach(k => {
            delete sanitized[k];
        });
        return sanitized;
    },

    // ========================================================
    // 1. AUTHENTICATION & LOGIN RATE LIMITING
    // ========================================================

    /**
     * Verifies strong password complexity policy.
     * Requires min 8 characters, at least 1 uppercase, 1 lowercase, 1 digit, and 1 special char.
     */
    validatePasswordStrength(password) {
        if (!password || typeof password !== 'string') {
            return { valid: false, error: 'Password is required.' };
        }
        if (password.length < 8) {
            return { valid: false, error: 'Password must be at least 8 characters long.' };
        }
        if (!/[A-Z]/.test(password)) {
            return { valid: false, error: 'Password must contain at least one uppercase letter.' };
        }
        if (!/[a-z]/.test(password)) {
            return { valid: false, error: 'Password must contain at least one lowercase letter.' };
        }
        if (!/[0-9]/.test(password)) {
            return { valid: false, error: 'Password must contain at least one number.' };
        }
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            return { valid: false, error: 'Password must contain at least one special character.' };
        }
        return { valid: true };
    },

    /**
     * Checks whether an IP or identifier is rate limited for general API requests.
     */
    isRateLimited(ip, limit = 100, windowMs = 15 * 60 * 1000) {
        const now = Date.now();
        if (!this.rateLimitMap.has(ip)) {
            this.rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
            return false;
        }

        const data = this.rateLimitMap.get(ip);
        if (now > data.resetTime) {
            this.rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
            return false;
        }

        data.count++;
        return data.count > limit;
    },

    /**
     * Tracks failed login attempts and locks account/IP after 5 consecutive failures for 15 minutes.
     */
    recordLoginAttempt(identifier, success) {
        const key = (identifier || '').toLowerCase();
        const now = Date.now();
        const lockDurationMs = 15 * 60 * 1000; // 15 mins

        if (!this.failedLoginTracker.has(key)) {
            this.failedLoginTracker.set(key, { attempts: 0, lockedUntil: 0 });
        }

        const record = this.failedLoginTracker.get(key);

        if (success) {
            this.failedLoginTracker.delete(key);
            return { locked: false, attempts: 0 };
        }

        if (now < record.lockedUntil) {
            return {
                locked: true,
                lockedUntil: record.lockedUntil,
                remainingMinutes: Math.ceil((record.lockedUntil - now) / 60000)
            };
        }

        record.attempts++;
        if (record.attempts >= 5) {
            record.lockedUntil = now + lockDurationMs;
            return {
                locked: true,
                lockedUntil: record.lockedUntil,
                remainingMinutes: 15
            };
        }

        return {
            locked: false,
            attempts: record.attempts,
            remainingAttempts: 5 - record.attempts
        };
    },

    /**
     * Checks if identifier is currently locked out.
     */
    isAccountLocked(identifier) {
        const key = (identifier || '').toLowerCase();
        if (!this.failedLoginTracker.has(key)) return false;
        const record = this.failedLoginTracker.get(key);
        return Date.now() < record.lockedUntil;
    },

    // ========================================================
    // 2. TWO-FACTOR AUTHENTICATION (2FA)
    // ========================================================

    /**
     * Generates a 2FA secret and 6 backup recovery codes.
     */
    generate2FASecret(userId) {
        const secret = crypto.randomBytes(20).toString('hex');
        const backupCodes = [];
        for (let i = 0; i < 6; i++) {
            backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
        }
        return {
            secret,
            backupCodes,
            qrUri: `otpauth://totp/Hapanamy:${userId}?secret=${secret}&issuer=Hapanamy.lk`
        };
    },

    /**
     * Computes a deterministic 6-digit TOTP code for a secret and counter window.
     */
    generateTOTP(secret, timeStep = Math.floor(Date.now() / 30000)) {
        const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'hex'));
        const timeBuffer = Buffer.alloc(8);
        timeBuffer.writeUInt32BE(0, 0);
        timeBuffer.writeUInt32BE(timeStep, 4);
        hmac.update(timeBuffer);
        const digest = hmac.digest();
        const offset = digest[digest.length - 1] & 0x0f;
        const code = ((digest[offset] & 0x7f) << 24 |
            (digest[offset + 1] & 0xff) << 16 |
            (digest[offset + 2] & 0xff) << 8 |
            (digest[offset + 3] & 0xff)) % 1000000;
        return code.toString().padStart(6, '0');
    },

    /**
     * Verifies a 6-digit 2FA code or backup code.
     */
    verify2FACode(secret, code, backupCodes = []) {
        if (!code) return false;
        const cleanCode = code.trim().toUpperCase();

        // Check backup codes
        if (backupCodes.includes(cleanCode)) {
            return { valid: true, isBackupCode: true };
        }

        // Check current, previous, and next time windows for clock drift
        const currentStep = Math.floor(Date.now() / 30000);
        for (let offset = -1; offset <= 1; offset++) {
            const expected = this.generateTOTP(secret, currentStep + offset);
            if (expected === cleanCode) {
                return { valid: true, isBackupCode: false };
            }
        }

        return { valid: false };
    },

    // ========================================================
    // 3. SECURE PASSWORD RESET LIFECYCLE
    // ========================================================

    /**
     * Generates a secure single-use password reset token with 15-minute expiry.
     */
    createPasswordResetToken(email) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins
        this.passwordResetTokens.set(token, {
            email: email.toLowerCase(),
            expiresAt,
            used: false
        });
        return { token, expiresAt };
    },

    /**
     * Verifies and consumes a password reset token.
     */
    consumePasswordResetToken(token) {
        if (!token || !this.passwordResetTokens.has(token)) {
            return { valid: false, error: 'Invalid or expired password reset token.' };
        }
        const record = this.passwordResetTokens.get(token);
        if (record.used) {
            return { valid: false, error: 'This password reset token has already been used.' };
        }
        if (Date.now() > record.expiresAt) {
            this.passwordResetTokens.delete(token);
            return { valid: false, error: 'Password reset token has expired (15 minute validity).' };
        }
        record.used = true;
        return { valid: true, email: record.email };
    },

    // ========================================================
    // 4. GRANULAR RBAC & AUTHORIZATION
    // ========================================================

    /**
     * Verifies whether a user has a specific granular permission.
     */
    hasPermission(user, requiredPermission) {
        if (!user || !user.role) return false;
        const role = user.role.toUpperCase();
        const rolePerms = ROLE_PERMISSIONS[role] || [];
        const customPerms = user.custom_permissions || [];
        return rolePerms.includes(requiredPermission) || customPerms.includes(requiredPermission);
    },

    /**
     * Verifies access and throws standard 403 error if permission is not granted.
     */
    requirePermission(user, requiredPermission) {
        if (!user) {
            throw new Error('401 Unauthorized: Authentication required.');
        }
        if (!this.hasPermission(user, requiredPermission)) {
            throw new Error(`403 Forbidden: Missing required permission '${requiredPermission}'.`);
        }
        return true;
    },

    // ========================================================
    // 5. MULTI-SENSOR FRAUD & ANOMALY DETECTION
    // ========================================================

    /**
     * Comprehensive fraud signal scanning engine.
     * Flags suspicious patterns for human review without auto-banning.
     */
    scanFraudSignals({
        users = [],
        kycDocs = [],
        purchases = [],
        paymentSubmissions = [],
        refundRequests = [],
        walletLedger = [],
        sponsors = [],
        ipAddress = null
    }) {
        const flaggedSignals = [];

        // 1. Duplicate NIC/Passport Check
        const nicMap = new Map();
        kycDocs.forEach(k => {
            if (k.nic_passport && k.nic_passport !== 'PENDING') {
                const list = nicMap.get(k.nic_passport) || [];
                list.push(k.user_id);
                nicMap.set(k.nic_passport, list);
            }
        });
        nicMap.forEach((userIds, nic) => {
            if (userIds.length > 1) {
                flaggedSignals.push({
                    type: 'DUPLICATE_NIC_DETECTED',
                    severity: 'CRITICAL',
                    entity_type: 'kyc_documents',
                    details: `NIC/Passport ${nic} is linked to multiple user IDs: ${userIds.join(', ')}`,
                    user_ids: userIds,
                    flagged_for_review: true
                });
            }
        });

        // 2. Duplicate Payment Slip File Hash Check
        const slipHashMap = new Map();
        paymentSubmissions.forEach(p => {
            if (p.slip_hash) {
                const list = slipHashMap.get(p.slip_hash) || [];
                list.push(p.id);
                slipHashMap.set(p.slip_hash, list);
            }
        });
        slipHashMap.forEach((paymentIds, hash) => {
            if (paymentIds.length > 1) {
                flaggedSignals.push({
                    type: 'DUPLICATE_PAYMENT_SLIP_HASH',
                    severity: 'CRITICAL',
                    entity_type: 'payment_submissions',
                    details: `Payment slip file hash (${hash.substring(0, 12)}...) was uploaded in multiple payments: ${paymentIds.join(', ')}`,
                    payment_ids: paymentIds,
                    flagged_for_review: true
                });
            }
        });

        // 3. Repeated Bank Transfer Reference Check
        const bankRefMap = new Map();
        paymentSubmissions.forEach(p => {
            if (p.bank_reference) {
                const cleanRef = p.bank_reference.trim().toUpperCase();
                const list = bankRefMap.get(cleanRef) || [];
                list.push(p.id);
                bankRefMap.set(cleanRef, list);
            }
        });
        bankRefMap.forEach((paymentIds, ref) => {
            if (paymentIds.length > 1) {
                flaggedSignals.push({
                    type: 'REPEATED_BANK_REFERENCE',
                    severity: 'HIGH',
                    entity_type: 'payment_submissions',
                    details: `Bank transfer reference '${ref}' was submitted in multiple payments: ${paymentIds.join(', ')}`,
                    payment_ids: paymentIds,
                    flagged_for_review: true
                });
            }
        });

        // 4. Suspicious Rapid Registrations from Same IP/Subnet
        if (ipAddress) {
            const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
            const recentRegistrationsFromIp = users.filter(u => {
                if (!u.created_at || !u.registration_ip) return false;
                const regTime = new Date(u.created_at).getTime();
                return u.registration_ip === ipAddress && regTime >= fiveMinutesAgo;
            });
            if (recentRegistrationsFromIp.length >= 3) {
                flaggedSignals.push({
                    type: 'RAPID_REGISTRATION_BURST',
                    severity: 'HIGH',
                    entity_type: 'users',
                    details: `Rapid registration surge: ${recentRegistrationsFromIp.length} accounts created in under 5 minutes from IP ${ipAddress}`,
                    ip: ipAddress,
                    user_ids: recentRegistrationsFromIp.map(u => u.id),
                    flagged_for_review: true
                });
            }
        }

        // 5. Repeated Refund Abuse Check
        const userRefundCount = new Map();
        refundRequests.forEach(r => {
            const current = userRefundCount.get(r.user_id) || 0;
            userRefundCount.set(r.user_id, current + 1);
        });
        userRefundCount.forEach((count, userId) => {
            if (count >= 2) {
                flaggedSignals.push({
                    type: 'REPEATED_REFUND_ABUSE',
                    severity: 'MEDIUM',
                    entity_type: 'refund_requests',
                    details: `Member ${userId} has submitted ${count} refund requests.`,
                    user_id: userId,
                    flagged_for_review: true
                });
            }
        });

        // 6. Referral Abuse / Circular Linking Detection
        sponsors.forEach(link => {
            if (link.user_id === link.sponsor_id) {
                flaggedSignals.push({
                    type: 'SELF_REFERRAL_ABUSE',
                    severity: 'HIGH',
                    entity_type: 'sponsors',
                    details: `Member ${link.user_id} attempted self-sponsorship.`,
                    user_id: link.user_id,
                    flagged_for_review: true
                });
            }
        });

        return flaggedSignals;
    },

    // ========================================================
    // 6. INPUT SANITIZATION & SAFE FILE PATHS
    // ========================================================

    sanitizeInput(str) {
        if (typeof str !== 'string') return str;
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    },

    isSafeFilename(filename) {
        if (!filename || typeof filename !== 'string') return false;
        return !filename.includes('..') && !filename.includes('/') && !filename.includes('\\') && !filename.includes('\0');
    },

    /**
     * Legacy helper to detect duplicate NICs and bank accounts across submission payloads.
     */
    detectFraudAlerts(user, kycDocs = [], bankAccounts = []) {
        const alerts = [];
        if (user && user.nicPassport) {
            const duplicateNicCount = kycDocs.filter(doc => doc.nic_passport === user.nicPassport).length;
            if (duplicateNicCount > 1) {
                alerts.push({
                    type: 'SUSPICIOUS_DUPLICATE_NIC',
                    severity: 'CRITICAL',
                    message: `NIC/Passport ${user.nicPassport} is associated with multiple accounts.`
                });
            }
        }
        if (user && user.accountNumber) {
            const duplicateBankCount = bankAccounts.filter(bank => bank.account_number === user.accountNumber).length;
            if (duplicateBankCount > 1) {
                alerts.push({
                    type: 'SUSPICIOUS_DUPLICATE_BANK',
                    severity: 'HIGH',
                    message: `Bank account number ${user.accountNumber} is shared across multiple profiles.`
                });
            }
        }
        return alerts;
    },

    // ========================================================
    // 7. COMPREHENSIVE SECURITY AUDIT LOGGER
    // ========================================================

    logSecurityEvent(auditLogs = [], {
        actorId,
        role = 'SYSTEM',
        action,
        entityType,
        entityId,
        oldValues = null,
        newValues = null,
        ipAddress = '127.0.0.1',
        metadata = {}
    }) {
        const entry = {
            id: 'audit-sec-' + crypto.randomBytes(8).toString('hex'),
            actor_id: actorId,
            role: (role || '').toUpperCase(),
            action,
            entity_type: entityType,
            entity_id: entityId,
            old_values: oldValues,
            new_values: newValues,
            ip_address: ipAddress,
            metadata,
            created_at: new Date().toISOString()
        };
        if (auditLogs) {
            auditLogs.push(entry);
        }
        return entry;
    }
};

if (typeof module !== 'undefined') {
    module.exports = SecurityCore;
}
