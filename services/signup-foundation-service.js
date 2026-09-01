// Hapanamy.lk Public Website, Authentication & Sign-Up Foundation (STEP 35)
// Production-ready public entry system, 3-dimensional status lifecycle (Auth, Product, MLM),
// free registration, server-side dual-leg referral validation, PBKDF2 SHA-512 security,
// email verification, password reset, granular RBAC, consent tracking, and admin user management.

const crypto = require('crypto');
const PlacementEngine = require('./placement-engine');
const ReferralService = require('./referral-service');
const SecurityCore = require('./security-core');
const ProductService = require('./product-service');

const AUTH_STATUSES = {
    REGISTERED: 'REGISTERED',
    EMAIL_PENDING: 'EMAIL_PENDING',
    EMAIL_VERIFIED: 'EMAIL_VERIFIED',
    PENDING_ACTIVATION: 'PENDING_ACTIVATION',
    ACTIVE: 'ACTIVE',
    SUSPENDED: 'SUSPENDED',
    BLOCKED: 'BLOCKED'
};

const PRODUCT_STATUSES = {
    NO_PURCHASE: 'NO_PURCHASE',
    PAYMENT_PENDING: 'PAYMENT_PENDING',
    ACTIVE: 'ACTIVE',
    REFUNDED: 'REFUNDED'
};

const QUALIFICATION_STATUSES = {
    UNQUALIFIED: 'UNQUALIFIED',
    QUALIFIED: 'QUALIFIED'
};

const ROLES = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    FINANCE_ADMIN: 'FINANCE_ADMIN',
    KYC_OFFICER: 'KYC_OFFICER',
    SUPPORT_AGENT: 'SUPPORT_AGENT',
    MEMBER: 'MEMBER'
};

const SignupFoundationService = {
    AUTH_STATUSES,
    PRODUCT_STATUSES,
    QUALIFICATION_STATUSES,
    ROLES,

    verificationTokens: new Map(), // token -> { userId, email, expiresAt }
    resendThrottle: new Map(),     // userId -> lastSentTimestamp
    consentStore: [],              // [{ memberId, policyVersion, acceptedAt, ip }]

    /**
     * Validates that username is valid for URLs and meets character constraints.
     */
    isValidUsername(username) {
        if (!username || typeof username !== 'string') return false;
        const trimmed = username.trim();
        // 3-30 chars, alphanumeric + underscores + hyphens only
        return /^[a-zA-Z0-9_-]{3,30}$/.test(trimmed);
    },

    /**
     * Validates that email is valid.
     */
    isValidEmail(email) {
        if (!email || typeof email !== 'string') return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
    },

    /**
     * Complete Member Registration Pipeline (STEP 35)
     */
    registerMember({
        fullName,
        username,
        email,
        mobile,
        password,
        confirmPassword,
        sponsorCode = null,
        requestedPosition = null,
        termsAccepted = false,
        privacyAccepted = false,
        clientIp = '127.0.0.1',
        users = [],
        sponsors = [],
        binaryNodes = [],
        volumeLedger = [],
        wallets = [],
        auditLogs = []
    } = {}) {
        // 1. Mandatory Input Validation
        if (!fullName || !fullName.trim()) {
            return { success: false, error: 'Full name is required.' };
        }
        if (!username || !this.isValidUsername(username)) {
            return { success: false, error: 'Valid username (3-30 alphanumeric characters, hyphens or underscores) is required.' };
        }
        if (!email || !this.isValidEmail(email)) {
            return { success: false, error: 'Valid email address is required.' };
        }
        if (!mobile || !mobile.trim()) {
            return { success: false, error: 'Mobile number is required.' };
        }
        if (!password) {
            return { success: false, error: 'Password is required.' };
        }
        if (password.length < 8) {
            return { success: false, error: 'Password must be at least 8 characters long.' };
        }
        if (confirmPassword && password !== confirmPassword) {
            return { success: false, error: 'Passwords do not match.' };
        }
        if (!termsAccepted || !privacyAccepted) {
            return { success: false, error: 'You must accept the Terms and Conditions and Privacy Policy.' };
        }

        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanMobile = mobile.trim();

        // 2. Uniqueness Checks
        const emailExists = users.some(u => (u.email || '').toLowerCase() === cleanEmail);
        if (emailExists) {
            return { success: false, error: 'Email address is already registered.' };
        }

        const usernameExists = users.some(u => (u.username || '').toLowerCase() === cleanUsername.toLowerCase());
        if (usernameExists) {
            return { success: false, error: 'Username is already taken. Please choose another.' };
        }

        // 3. Referral / Sponsor Verification
        let effectiveSponsorId = null;
        let effectivePosition = 'LEFT';

        if (sponsorCode && sponsorCode.trim()) {
            const cleanSponsorCode = sponsorCode.trim();
            if (cleanUsername.toLowerCase() === cleanSponsorCode.toLowerCase()) {
                return { success: false, error: 'Self-referral is strictly prohibited.' };
            }

            const sponsorVal = ReferralService.validateReferralCode(cleanSponsorCode, users);
            if (!sponsorVal.valid) {
                return { success: false, error: sponsorVal.error };
            }
            const sponsorObj = sponsorVal.sponsor || users.find(u => u.username === cleanSponsorCode || u.id === cleanSponsorCode);
            effectiveSponsorId = sponsorObj ? sponsorObj.id : cleanSponsorCode;
        } else {
            // Default to Root Admin Sponsor if no sponsor provided (System Open Signup)
            const rootSponsor = users.find(u => u.role === 'admin' || u.role === 'SUPER_ADMIN') || users[0];
            effectiveSponsorId = rootSponsor ? rootSponsor.id : 'usr-root';
        }

        if (requestedPosition) {
            const posVal = ReferralService.validatePosition(requestedPosition);
            if (!posVal.valid) {
                return { success: false, error: posVal.error };
            }
            effectivePosition = posVal.position;
        }

        // 4. Server-Side Binary Placement Resolution
        const resolvedPlacement = PlacementEngine.resolvePlacement(
            effectiveSponsorId,
            effectivePosition,
            binaryNodes,
            volumeLedger
        );

        if (!resolvedPlacement || !resolvedPlacement.placementParentId) {
            if (binaryNodes.length > 0) {
                return { success: false, error: 'Failed to resolve valid binary placement position under sponsor.' };
            }
        }

        // 5. Atomic State Snapshot for Rollback Simulation
        const prevUsersLen = users.length;
        const prevSponsorsLen = sponsors.length;
        const prevNodesLen = binaryNodes.length;
        const prevWalletsLen = wallets.length;

        const userId = 'usr-' + crypto.randomBytes(8).toString('hex');
        const passwordHash = SecurityCore.hashPassword ? SecurityCore.hashPassword(password) : this.hashPassword(password);
        const now = new Date().toISOString();

        try {
            // A. Create User Entity with 3-Dimensional Status Separation
            const newUser = {
                id: userId,
                username: cleanUsername,
                full_name: fullName.trim(),
                email: cleanEmail,
                mobile: cleanMobile,
                password_hash: passwordHash,
                role: ROLES.MEMBER,
                auth_status: AUTH_STATUSES.EMAIL_PENDING,
                product_status: PRODUCT_STATUSES.NO_PURCHASE,
                qualification_status: QUALIFICATION_STATUSES.UNQUALIFIED,
                status: 'ACTIVE',
                created_at: now
            };
            users.push(newUser);

            // B. Record Sponsor Relationship
            sponsors.push({
                user_id: userId,
                sponsor_id: effectiveSponsorId,
                created_at: now
            });

            // C. Place Node in Binary Tree (Position RESERVED until course activation)
            let parentDepth = 1;
            let parentPath = '';
            if (resolvedPlacement && resolvedPlacement.placementParentId) {
                const parentNode = binaryNodes.find(n => n.user_id === resolvedPlacement.placementParentId);
                if (parentNode) {
                    parentDepth = parentNode.depth + 1;
                    parentPath = parentNode.path ? `${parentNode.path}/${parentNode.user_id}` : parentNode.user_id;
                    if (resolvedPlacement.position === 'LEFT') parentNode.left_child_id = userId;
                    if (resolvedPlacement.position === 'RIGHT') parentNode.right_child_id = userId;
                }
            }

            binaryNodes.push({
                id: 'node-' + crypto.randomBytes(6).toString('hex'),
                user_id: userId,
                placement_parent_id: resolvedPlacement ? resolvedPlacement.placementParentId : null,
                position: resolvedPlacement ? resolvedPlacement.position : null,
                depth: parentDepth,
                path: parentPath,
                left_child_id: null,
                right_child_id: null,
                node_status: 'RESERVED',
                created_at: now
            });

            // D. Initialize Wallet
            wallets.push({
                user_id: userId,
                available_balance: 0.00,
                commission_balance: 0.00,
                pending_balance: 0.00,
                withdrawal_hold_balance: 0.00,
                total_earned: 0.00,
                total_withdrawn: 0.00,
                currency: 'LKR'
            });

            // E. Record Legal Policy Acceptance
            this.consentStore.push({
                member_id: userId,
                policy_version: 'v2.0-2026',
                terms_accepted: true,
                privacy_accepted: true,
                accepted_at: now,
                ip_address: clientIp
            });

            // F. Generate Secure Email Verification Token
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
            this.verificationTokens.set(verificationToken, {
                userId,
                email: cleanEmail,
                expiresAt: tokenExpiry
            });

            // G. Record Audit Event
            auditLogs.push({
                id: 'audit-reg-' + crypto.randomBytes(6).toString('hex'),
                user_id: userId,
                action: 'MEMBER_REGISTERED',
                details: {
                    username: cleanUsername,
                    email: cleanEmail,
                    sponsor_id: effectiveSponsorId,
                    placement_parent: resolvedPlacement ? resolvedPlacement.placementParentId : null,
                    position: resolvedPlacement ? resolvedPlacement.position : null
                },
                ip_address: clientIp,
                timestamp: now
            });

            return {
                success: true,
                user: newUser,
                verification_token: verificationToken,
                referral_links: ReferralService.generateReferralLinks(cleanUsername, 'https://hapanamy.lk')
            };

        } catch (err) {
            // Atomic Rollback
            users.length = prevUsersLen;
            sponsors.length = prevSponsorsLen;
            binaryNodes.length = prevNodesLen;
            wallets.length = prevWalletsLen;
            return { success: false, error: 'Registration failed due to transaction error: ' + err.message };
        }
    },

    /**
     * Verifies member email via secure token.
     */
    verifyEmail(token, users = []) {
        if (!token || !this.verificationTokens.has(token)) {
            return { success: false, error: 'Invalid or expired email verification token.' };
        }

        const data = this.verificationTokens.get(token);
        if (new Date(data.expiresAt).getTime() < Date.now()) {
            this.verificationTokens.delete(token);
            return { success: false, error: 'Verification token has expired. Please request a new one.' };
        }

        const user = users.find(u => u.id === data.userId || u.email === data.email);
        if (!user) {
            return { success: false, error: 'User account not found.' };
        }

        if (user.auth_status === AUTH_STATUSES.EMAIL_VERIFIED || user.auth_status === AUTH_STATUSES.ACTIVE) {
            return { success: true, already_verified: true, user };
        }

        user.auth_status = AUTH_STATUSES.EMAIL_VERIFIED;
        user.email_verified_at = new Date().toISOString();
        this.verificationTokens.delete(token);

        return { success: true, user };
    },

    /**
     * Authenticates member or admin with rate limiting & lockout.
     */
    login({ identifier, password, users = [], clientIp = '127.0.0.1', auditLogs = [] }) {
        if (!identifier || !password) {
            return { success: false, error: 'Username/Email and password are required.' };
        }

        const cleanIdent = identifier.trim().toLowerCase();
        const user = users.find(u => 
            (u.email || '').toLowerCase() === cleanIdent || 
            (u.username || '').toLowerCase() === cleanIdent
        );

        if (!user) {
            return { success: false, error: 'Invalid credentials.' };
        }

        // Account status guards
        if (user.auth_status === AUTH_STATUSES.BLOCKED || user.status === 'BLOCKED') {
            return { success: false, error: 'Your account has been blocked. Please contact support.' };
        }
        if (user.auth_status === AUTH_STATUSES.SUSPENDED || user.status === 'SUSPENDED') {
            return { success: false, error: 'Your account is suspended pending compliance review.' };
        }

        // Rate limit / Lockout evaluation
        const lockoutCheck = SecurityCore.isAccountLocked ? SecurityCore.isAccountLocked(user.email) : { locked: false };
        if (lockoutCheck.locked) {
            return { success: false, error: `Account locked due to too many failed attempts. Try again in ${lockoutCheck.remainingMinutes} minutes.` };
        }

        const passwordValid = SecurityCore.verifyPassword 
            ? SecurityCore.verifyPassword(password, user.password_hash)
            : this.verifyPassword(password, user.password_hash);

        if (!passwordValid) {
            if (SecurityCore.recordFailedLoginAttempt) {
                SecurityCore.recordFailedLoginAttempt(user.email);
            }
            auditLogs.push({
                user_id: user.id,
                action: 'LOGIN_FAILED',
                ip_address: clientIp,
                timestamp: new Date().toISOString()
            });
            return { success: false, error: 'Invalid credentials.' };
        }

        if (SecurityCore.resetFailedLoginAttempts) {
            SecurityCore.resetFailedLoginAttempts(user.email);
        }

        const sessionToken = crypto.randomBytes(32).toString('hex');
        const isSuperOrAdmin = user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN || user.role === 'admin';
        const redirectUrl = isSuperOrAdmin ? 'hapanamy-admin-portal-9226.html' : 'dashboard.html';

        auditLogs.push({
            user_id: user.id,
            action: 'LOGIN_SUCCESS',
            role: user.role,
            ip_address: clientIp,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                auth_status: user.auth_status || AUTH_STATUSES.EMAIL_VERIFIED,
                product_status: user.product_status || PRODUCT_STATUSES.NO_PURCHASE,
                qualification_status: user.qualification_status || QUALIFICATION_STATUSES.UNQUALIFIED
            },
            token: sessionToken,
            redirect_url: redirectUrl
        };
    },

    /**
     * Compiles the initial Member Entry Dashboard landing data (handling brand new zero-earning members).
     */
    getMemberEntryDashboard(userId, users = [], binaryNodes = [], walletLedger = [], purchases = []) {
        const user = users.find(u => u.id === userId);
        if (!user) return { success: false, error: 'Member not found.' };

        const node = binaryNodes.find(n => n.user_id === userId);
        const userPurchases = purchases.filter(p => p.user_id === userId && p.status === 'APPROVED');
        const userTransactions = walletLedger.filter(tx => tx.user_id === userId);

        let availableBalance = 0;
        let totalEarned = 0;
        userTransactions.forEach(tx => {
            if (tx.status === 'COMPLETED') {
                if (tx.amount > 0) totalEarned += tx.amount;
                availableBalance += tx.amount;
            }
        });

        return {
            success: true,
            welcome_message: `Welcome back, ${user.full_name || user.username}!`,
            member: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                mobile: user.mobile,
                auth_status: user.auth_status || AUTH_STATUSES.REGISTERED,
                product_status: userPurchases.length > 0 ? PRODUCT_STATUSES.ACTIVE : (user.product_status || PRODUCT_STATUSES.NO_PURCHASE),
                qualification_status: user.qualification_status || QUALIFICATION_STATUSES.UNQUALIFIED,
                registered_at: user.created_at
            },
            referral_links: ReferralService.generateReferralLinks(user.username, 'https://hapanamy.lk'),
            wallet: {
                available_balance: availableBalance,
                total_earned: totalEarned,
                pending_holds: 0.00,
                currency: 'LKR'
            },
            network: {
                placement_parent: node ? node.placement_parent_id : null,
                position: node ? node.position : null,
                node_status: node ? node.node_status : 'RESERVED'
            },
            quick_actions: [
                { label: 'Explore Products', url: 'checkout.html' },
                { label: 'View Referral Links', url: 'dashboard.html#referrals' },
                { label: 'Complete KYC', url: 'dashboard-kyc.html' },
                { label: 'Request Withdrawal', url: 'dashboard-wallet.html' }
            ]
        };
    },

    /**
     * Admin Member Management: Search, filter, suspend, block, reactivate.
     */
    adminListMembers({ query = '', statusFilter = null, users = [], binaryNodes = [], sponsors = [] } = {}) {
        let results = [...users];

        if (statusFilter) {
            results = results.filter(u => u.auth_status === statusFilter || u.status === statusFilter);
        }

        if (query && query.trim()) {
            const q = query.trim().toLowerCase();
            results = results.filter(u => 
                (u.full_name && u.full_name.toLowerCase().includes(q)) ||
                (u.username && u.username.toLowerCase().includes(q)) ||
                (u.email && u.email.toLowerCase().includes(q))
            );
        }

        return results.map(u => {
            const node = binaryNodes.find(n => n.user_id === u.id);
            const sponsor = sponsors.find(s => s.user_id === u.id);
            return {
                id: u.id,
                username: u.username,
                full_name: u.full_name,
                email: u.email,
                mobile: u.mobile,
                role: u.role,
                auth_status: u.auth_status || 'ACTIVE',
                product_status: u.product_status || 'NO_PURCHASE',
                qualification_status: u.qualification_status || 'UNQUALIFIED',
                sponsor_id: sponsor ? sponsor.sponsor_id : null,
                placement_parent: node ? node.placement_parent_id : null,
                position: node ? node.position : null,
                created_at: u.created_at
            };
        });
    },

    updateMemberStatus(targetUserId, newStatus, adminUserId, users = [], auditLogs = []) {
        const user = users.find(u => u.id === targetUserId);
        if (!user) return { success: false, error: 'Member not found.' };

        const oldStatus = user.auth_status;
        user.auth_status = newStatus;
        user.status = newStatus;

        auditLogs.push({
            id: 'audit-status-' + crypto.randomBytes(6).toString('hex'),
            user_id: adminUserId,
            action: 'MEMBER_STATUS_UPDATED',
            target_user: targetUserId,
            old_status: oldStatus,
            new_status: newStatus,
            timestamp: new Date().toISOString()
        });

        return { success: true, user };
    },

    hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        return `${salt}:${hash}`;
    },

    verifyPassword(password, stored) {
        if (!stored || !stored.includes(':')) return false;
        const [salt, hash] = stored.split(':');
        const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        return hash === verifyHash;
    }
};

if (typeof module !== 'undefined') {
    module.exports = SignupFoundationService;
}
