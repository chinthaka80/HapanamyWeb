// Hapanamy.lk Authentication & Registration Service (STEP 15)
// Secure registration pipeline, validation, password hashing, sponsor assignment,
// server-side placement determination, wallet initialization, and transactional rollbacks.

const crypto = require('crypto');
const PlacementEngine = require('./placement-engine');
const ReferralService = require('./referral-service');

const AuthService = {
    /**
     * Hashing a password using Node.js pbkdf2Sync (Secure PBKDF2 with SHA-512)
     */
    hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        return `${salt}:${hash}`;
    },

    /**
     * Verifies a password against a stored hash
     */
    verifyPassword(password, storedPassword) {
        if (!storedPassword || !storedPassword.includes(':')) return false;
        const [salt, originalHash] = storedPassword.split(':');
        const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        return originalHash === verifyHash;
    },

    /**
     * Generate a secure random session token
     */
    generateToken() {
        return crypto.randomBytes(32).toString('hex');
    },

    /**
     * Validates email format.
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    /**
     * Validates mobile format.
     */
    isValidMobile(mobile) {
        return /^[0-9+-\s()]{7,20}$/.test(mobile);
    },

    /**
     * Complete Member Registration Pipeline (STEP 15)
     * Executes atomic validation, sponsor linking, server-side binary placement, and wallet initialization.
     */
    registerMember(payload, context = {}) {
        const {
            fullName, username, email, mobile, password, confirmPassword,
            sponsorCode, position, intentId,
            nicPassport, dob, address,
            accountHolderName, bankName, branchName, accountNumber
        } = payload;

        const users = context.users || [];
        const sponsors = context.sponsors || [];
        const binaryNodes = context.binaryNodes || [];
        const volumeLedger = context.volumeLedger || [];
        const wallets = context.wallets || [];
        const kycDocs = context.kycDocs || [];
        const bankAccounts = context.bankAccounts || [];
        const auditLogs = context.auditLogs || [];
        const referralConversions = context.referralConversions || [];
        const intentStore = context.intentStore || [];

        // 1. Validate Input Fields
        if (!fullName || !fullName.trim()) {
            return { success: false, error: 'Full name is required.' };
        }
        if (!username || !username.trim()) {
            return { success: false, error: 'Username is required.' };
        }
        if (!email || !email.trim()) {
            return { success: false, error: 'Email address is required.' };
        }
        if (!mobile || !mobile.trim()) {
            return { success: false, error: 'Mobile number is required.' };
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

        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanMobile = mobile.trim();

        if (!this.isValidEmail(cleanEmail)) {
            return { success: false, error: 'Invalid email address format.' };
        }
        if (!this.isValidMobile(cleanMobile)) {
            return { success: false, error: 'Invalid mobile phone number format.' };
        }

        // 2. Validate Uniqueness
        const duplicateUser = users.find(u => u.username && u.username.toLowerCase() === cleanUsername.toLowerCase());
        if (duplicateUser) {
            return { success: false, error: `Username '${cleanUsername}' is already taken.` };
        }

        const duplicateEmail = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
        if (duplicateEmail) {
            return { success: false, error: `Email address '${cleanEmail}' is already registered.` };
        }

        // 3. Validate Sponsor and Position
        let effectiveSponsorCode = sponsorCode;
        let effectivePosition = position;

        // Check if referral intent token provided from Step 14
        if (intentId) {
            const intent = ReferralService.verifyAndConsumeIntent(intentId, intentStore);
            if (intent) {
                effectiveSponsorCode = intent.referral_code;
                if (!effectivePosition) {
                    effectivePosition = intent.position;
                }
            }
        }

        if (!effectiveSponsorCode) {
            return { success: false, error: 'Sponsor referral code is required.' };
        }

        if (cleanUsername.toLowerCase() === effectiveSponsorCode.toLowerCase()) {
            return { success: false, error: 'Self-referral is strictly prohibited.' };
        }

        const sponsorValidation = ReferralService.validateReferralCode(effectiveSponsorCode, users);
        if (!sponsorValidation.valid) {
            return { success: false, error: sponsorValidation.error };
        }

        const sponsor = sponsorValidation.sponsor || users.find(u => u.username === effectiveSponsorCode || u.id === effectiveSponsorCode);
        const sponsorId = sponsor ? sponsor.id : effectiveSponsorCode;

        const posValidation = ReferralService.validatePosition(effectivePosition || 'LEFT');
        if (!posValidation.valid) {
            return { success: false, error: posValidation.error };
        }
        const normalizedPos = posValidation.position;

        // 4. Server-Side Placement Determination
        const resolvedPlacement = PlacementEngine.resolvePlacement(
            sponsorId,
            normalizedPos,
            binaryNodes,
            volumeLedger
        );

        if (!resolvedPlacement || !resolvedPlacement.placementParentId) {
            // If tree is empty, allowed only if root
            if (binaryNodes.length > 0) {
                return { success: false, error: 'Failed to resolve valid binary placement slot under sponsor.' };
            }
        }

        // 5. Atomic Transaction Pipeline Simulation
        const userId = 'user-' + crypto.randomBytes(8).toString('hex');
        const passwordHash = this.hashPassword(password);
        const now = new Date().toISOString();

        // Stash backup snapshot for rollback
        const usersSnapshotLength = users.length;
        const sponsorsSnapshotLength = sponsors.length;
        const nodesSnapshotLength = binaryNodes.length;
        const walletsSnapshotLength = wallets.length;

        try {
            // A. Create User Entity
            const newUser = {
                id: userId,
                username: cleanUsername,
                full_name: fullName.trim(),
                email: cleanEmail,
                mobile: cleanMobile,
                password_hash: passwordHash,
                role: 'member',
                status: 'ACTIVE',
                created_at: now
            };
            users.push(newUser);

            // B. Assign Sponsor Relationship
            const sponsorRecord = {
                user_id: userId,
                sponsor_id: sponsorId,
                created_at: now
            };
            sponsors.push(sponsorRecord);

            // C. Assign Binary Tree Placement
            const binaryNode = PlacementEngine.assignPlacement(
                userId,
                sponsorId,
                resolvedPlacement.placementParentId,
                resolvedPlacement.position,
                binaryNodes
            );

            // D. Create Financial Wallet Record
            const walletRecord = {
                id: 'wlt-' + crypto.randomBytes(8).toString('hex'),
                user_id: userId,
                balance: 0.00,
                pending_balance: 0.00,
                total_withdrawn: 0.00,
                updated_at: now
            };
            wallets.push(walletRecord);

            // E. Create KYC Document Entity (PENDING)
            if (nicPassport || address) {
                kycDocs.push({
                    id: 'kyc-' + crypto.randomBytes(8).toString('hex'),
                    user_id: userId,
                    nic_passport: nicPassport || 'PENDING',
                    dob: dob || null,
                    address: address || null,
                    status: 'PENDING',
                    created_at: now
                });
            }

            // F. Create Bank Account Entity
            if (bankName || accountNumber) {
                bankAccounts.push({
                    id: 'bnk-' + crypto.randomBytes(8).toString('hex'),
                    user_id: userId,
                    bank_name: bankName || 'Commercial Bank',
                    branch_name: branchName || 'Main',
                    account_holder_name: accountHolderName || fullName.trim(),
                    account_number: accountNumber || '0000000000',
                    is_active: true,
                    created_at: now
                });
            }

            // G. Record Referral Conversion
            ReferralService.recordConversion(effectiveSponsorCode, userId, normalizedPos, referralConversions);

            // H. Append Audit Log
            auditLogs.push({
                id: 'audit-' + crypto.randomBytes(8).toString('hex'),
                user_id: userId,
                action: 'MEMBER_REGISTERED',
                entity_type: 'users',
                entity_id: userId,
                new_values: {
                    username: cleanUsername,
                    email: cleanEmail,
                    sponsor: effectiveSponsorCode,
                    placement_parent: resolvedPlacement.placementParentId,
                    position: resolvedPlacement.position
                },
                created_at: now
            });

            return {
                success: true,
                message: 'Registration successful! Verification notification sent.',
                user: {
                    id: newUser.id,
                    username: newUser.username,
                    full_name: newUser.full_name,
                    email: newUser.email,
                    role: newUser.role
                },
                sponsor: {
                    sponsor_id: sponsorId,
                    sponsor_username: sponsor ? sponsor.username : effectiveSponsorCode
                },
                placement: {
                    placement_parent_id: binaryNode.placement_parent_id,
                    position: binaryNode.position,
                    depth: binaryNode.depth,
                    path: binaryNode.path
                },
                wallet: walletRecord
            };

        } catch (err) {
            // Transaction Rollback on Error
            users.length = usersSnapshotLength;
            sponsors.length = sponsorsSnapshotLength;
            binaryNodes.length = nodesSnapshotLength;
            wallets.length = walletsSnapshotLength;

            return {
                success: false,
                error: `Registration transaction rolled back: ${err.message}`
            };
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = AuthService;
}
