// ==============================================================================
// NEXUS PRIME (PVT) LTD — AUTHENTICATION & REGISTRATION SERVICE
// DOMAIN: nexusp.online
// ==============================================================================

const crypto = require('crypto');
const nexusDb = require('../db/nexus-db');
const NexusConfig = require('../config/nexus-config');

const NexusAuthService = {
    /**
     * PBKDF2 Password Hashing (SHA-512, 10,000 iterations, 16-byte random salt)
     */
    hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        return `${salt}:${hash}`;
    },

    /**
     * Constant-time password verification
     */
    verifyPassword(password, storedPassword) {
        if (!storedPassword || !storedPassword.includes(':')) return false;
        try {
            const [salt, originalHash] = storedPassword.split(':');
            const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
            return crypto.timingSafeEqual(Buffer.from(originalHash), Buffer.from(verifyHash));
        } catch (e) {
            return false;
        }
    },

    /**
     * Generates a 256-bit cryptographic bearer token and optionally registers active session
     */
    generateToken(sessionData = null) {
        const token = crypto.randomBytes(32).toString('hex');
        if (sessionData && typeof sessionData === 'object') {
            nexusDb.activeSessions.set(token, {
                userId: sessionData.id || sessionData.userId,
                email: sessionData.email || '',
                roles: sessionData.roles || (sessionData.role ? [sessionData.role] : ['member']),
                primaryRole: sessionData.role || 'member',
                expiresAt: sessionData.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            });
        }
        return token;
    },

    /**
     * Email validation
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    /**
     * Phone validation
     */
    isValidPhone(phone) {
        return /^[0-9+-\s()]{7,20}$/.test(phone);
    },

    /**
     * COMPLETE 13-STEP REGISTRATION PIPELINE
     * Supports:
     * - Live referral code verification
     * - Automatic Member ID generation (NP000001 format)
     * - Safe Referral Code generation (NEXUS001 format)
     * - Sponsor relationship assignment
     * - Network tree insertion & closure updates
     * - Double-entry wallet initialization
     * - Security audit logging
     */
    async registerMember(payload, meta = {}) {
        const {
            fullName,
            email,
            phone,
            password,
            confirmPassword,
            referralCode,
            address,
            country
        } = payload;

        const ip = meta.ip || '127.0.0.1';
        const userAgent = meta.userAgent || 'Unknown';

        // 1. Validate Input Fields
        if (!fullName || !fullName.trim()) {
            return { success: false, error: 'Full name is required.' };
        }
        if (!email || !email.trim()) {
            return { success: false, error: 'Email address is required.' };
        }
        if (!password) {
            return { success: false, error: 'Password is required.' };
        }
        if (password.length < 6) {
            return { success: false, error: 'Password must be at least 6 characters long.' };
        }
        if (confirmPassword && password !== confirmPassword) {
            return { success: false, error: 'Passwords do not match.' };
        }

        const cleanEmail = email.trim().toLowerCase();
        if (!this.isValidEmail(cleanEmail)) {
            return { success: false, error: 'Invalid email address format.' };
        }

        const cleanPhone = phone ? phone.trim() : '';
        if (cleanPhone && !this.isValidPhone(cleanPhone)) {
            return { success: false, error: 'Invalid phone number format.' };
        }

        // 2. Check for Duplicate Email
        const existingUser = await nexusDb.findUserByEmail(cleanEmail);
        if (existingUser) {
            return { success: false, error: 'An account with this email already exists.' };
        }

        // 3. Validate Sponsor Referral Code
        let sponsorProfile = null;
        let effectiveReferralCode = referralCode ? referralCode.trim().toUpperCase() : '';

        if (effectiveReferralCode) {
            sponsorProfile = await nexusDb.findProfileByReferralCode(effectiveReferralCode);
            if (!sponsorProfile) {
                // Check if sponsor passed Member ID instead
                sponsorProfile = await nexusDb.findProfileByMemberId(effectiveReferralCode);
            }
            if (!sponsorProfile) {
                return { success: false, error: 'This referral link is no longer valid.' };
            }
            if (sponsorProfile.status !== 'active') {
                return { success: false, error: 'This referral link is no longer valid (sponsor account is suspended or inactive).' };
            }
        } else {
            // Missing referral code handling (configurable)
            if (!NexusConfig.ALLOW_ORPHAN_REGISTRATION) {
                return { success: false, error: 'A valid sponsor referral code is required to register.' };
            }
            // Attach to corporate root account
            sponsorProfile = await nexusDb.findProfileByReferralCode(NexusConfig.DEFAULT_ROOT_REFERRAL_CODE);
            if (!sponsorProfile) {
                return { success: false, error: 'Default corporate sponsor not found. Please contact support.' };
            }
        }

        const sponsorUserId = sponsorProfile.user_id;

        // Perform rigorous sponsor relationship check
        const sponsorCheck = await nexusDb.validateSponsorRelationship(null, sponsorUserId);
        if (!sponsorCheck.valid) {
            return { success: false, error: sponsorCheck.error };
        }

        // 4. Generate Unique Sequential Member ID and Referral Code
        const memberId = nexusDb.generateNextMemberId();
        const newReferralCode = nexusDb.generateReferralCode(memberId);

        // 5. Generate User ID and Password Hash
        const userId = crypto.randomUUID ? crypto.randomUUID() : 'user-' + crypto.randomBytes(8).toString('hex');
        const passwordHash = this.hashPassword(password);
        const now = new Date().toISOString();

        // 6. Insert User Auth Record
        const newUser = await nexusDb.insertUser({
            id: userId,
            email: cleanEmail,
            password_hash: passwordHash,
            email_verified: false,
            email_verified_at: null,
            last_login_at: now,
            last_login_ip: ip,
            created_at: now,
            updated_at: now
        });

        // 7. Assign Default 'member' Role
        await nexusDb.assignRole(userId, 'member', sponsorUserId);

        // 8. Insert Member Profile Record
        const newProfile = await nexusDb.insertProfile({
            id: 'prof-' + crypto.randomBytes(8).toString('hex'),
            user_id: userId,
            member_id: memberId,
            referral_code: newReferralCode,
            full_name: fullName.trim(),
            display_name: fullName.trim().split(' ')[0],
            phone: cleanPhone,
            address: address ? address.trim() : null,
            country: country ? country.trim() : 'Sri Lanka',
            profile_image_url: null,
            rank: 'MEMBER',
            package_status: 'STANDARD',
            status: 'active',
            sponsor_id: sponsorUserId,
            registration_date: now,
            created_at: now,
            updated_at: now
        });

        // 9. Assign Sponsor Relationship
        await nexusDb.insertSponsor(userId, sponsorUserId);

        // 10. Update Network Tree & Closure Matrix
        await nexusDb.insertNetworkNode(userId, sponsorUserId);

        // 11. Initialize Member Wallet Foundation
        await nexusDb.getWallet(userId);

        // 12. Create Security Audit Log Entry
        await nexusDb.insertAuditLog({
            user_id: userId,
            action: 'AUTH_REGISTER',
            entity_type: 'nexus_member_profiles',
            entity_id: memberId,
            new_values: {
                member_id: memberId,
                email: cleanEmail,
                sponsor_id: sponsorUserId,
                referral_code: newReferralCode
            },
            ip_address: ip,
            user_agent: userAgent
        });

        // 13. Create Initial Welcome Notification & Member Activity
        await nexusDb.insertNotification({
            userId: userId,
            title: 'Welcome to Nexus Prime (PVT) Ltd',
            message: 'Your member account is active. Share your referral link to build your direct team.',
            type: 'system',
            link: '/dashboard'
        });

        await nexusDb.insertMemberActivity({
            userId: userId,
            action: 'ACCOUNT_ACTIVATED',
            description: `Account registered successfully with Member ID ${memberId}.`,
            icon: '🎉'
        });

        // Notify Sponsor of New Team Member
        if (sponsorUserId) {
            await nexusDb.insertNotification({
                userId: sponsorUserId,
                title: 'New Direct Referral Registered',
                message: `${fullName.trim()} (${memberId}) has joined your direct team.`,
                type: 'referral',
                link: '/referrals'
            });

            await nexusDb.insertMemberActivity({
                userId: sponsorUserId,
                action: 'REFERRAL_JOINED',
                description: `${fullName.trim()} (${memberId}) enrolled as your direct referral.`,
                icon: '👥'
            });
        }

        // 14. Generate Active Session Token
        const sessionToken = this.generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        nexusDb.activeSessions.set(sessionToken, {
            userId: userId,
            email: cleanEmail,
            role: 'member',
            expiresAt: expiresAt
        });

        return {
            success: true,
            message: 'Registration completed successfully.',
            token: sessionToken,
            member: {
                userId: userId,
                memberId: memberId,
                fullName: newProfile.full_name,
                email: cleanEmail,
                referralCode: newReferralCode,
                sponsor: {
                    name: sponsorProfile.full_name,
                    referralCode: sponsorProfile.referral_code
                },
                status: 'active',
                registrationDate: now
            },
            redirectUrl: '/dashboard'
        };
    },

    /**
     * SECURE LOGIN PIPELINE
     * Supports:
     * - Email / Password verification
     * - Account status verification (blocks suspended/blocked accounts)
     * - Multi-role resolution
     * - Session issuance
     * - Role-based route redirection
     */
    async login(email, password, meta = {}) {
        const ip = meta.ip || '127.0.0.1';
        const userAgent = meta.userAgent || 'Unknown';

        if (!email || !password) {
            return { success: false, error: 'Email and password are required.' };
        }

        const user = await nexusDb.findUserByEmail(email.trim());
        if (!user) {
            return { success: false, error: 'Invalid email or password credentials.' };
        }

        const isValidPass = this.verifyPassword(password, user.password_hash);
        if (!isValidPass) {
            return { success: false, error: 'Invalid email or password credentials.' };
        }

        const profile = await nexusDb.findProfileByUserId(user.id);
        if (!profile) {
            return { success: false, error: 'Associated member profile not found.' };
        }

        // Enforce Account Status Restrictions
        if (profile.status === 'blocked') {
            return { success: false, error: 'This account has been blocked. Please contact compliance.' };
        }
        if (profile.status === 'suspended') {
            return { success: false, error: 'This account is currently suspended.' };
        }

        // Resolve Roles
        const roles = await nexusDb.getUserRoles(user.id);
        const isAdmin = roles.includes('admin') || roles.includes('super_admin');
        const primaryRole = isAdmin ? 'admin' : 'member';

        // Issue Secure Session Token
        const sessionToken = this.generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        nexusDb.activeSessions.set(sessionToken, {
            userId: user.id,
            email: user.email,
            roles: roles,
            primaryRole: primaryRole,
            expiresAt: expiresAt
        });

        // Update Last Login
        user.last_login_at = new Date().toISOString();
        user.last_login_ip = ip;

        // Audit Log
        await nexusDb.insertAuditLog({
            user_id: user.id,
            action: 'AUTH_LOGIN',
            entity_type: 'nexus_users',
            entity_id: user.id,
            ip_address: ip,
            user_agent: userAgent
        });

        return {
            success: true,
            token: sessionToken,
            roles: roles,
            member: {
                userId: user.id,
                memberId: profile.member_id,
                fullName: profile.full_name,
                email: user.email,
                referralCode: profile.referral_code,
                rank: profile.rank,
                status: profile.status
            },
            redirectUrl: isAdmin ? '/admin' : '/dashboard'
        };
    },

    /**
     * Verifies active session token from header or cookie
     */
    verifySession(token) {
        if (!token) return { valid: false, error: 'No token provided' };
        const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
        const session = nexusDb.activeSessions.get(cleanToken);
        if (!session) {
            return { valid: false, error: 'Invalid or expired session' };
        }
        if (new Date(session.expiresAt) < new Date()) {
            nexusDb.activeSessions.delete(cleanToken);
            return { valid: false, error: 'Session has expired' };
        }
        return { valid: true, session: session };
    },

    /**
     * Terminate active session
     */
    logout(token) {
        if (!token) return true;
        const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
        nexusDb.activeSessions.delete(cleanToken);
        return true;
    }
};

module.exports = NexusAuthService;
