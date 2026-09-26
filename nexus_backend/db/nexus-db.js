// ==============================================================================
// NEXUS PRIME (PVT) LTD — ISOLATED DATABASE ADAPTER & REPOSITORY
// DOMAIN: nexusp.online
// ==============================================================================

const crypto = require('crypto');
const NexusConfig = require('../config/nexus-config');

class NexusDatabase {
    constructor() {
        this.memberIdCounter = 1;
        this.orderCounter = 1;
        this.paymentCounter = 1;
        this.activeSessions = new Map(); // token -> { userId, role, expiresAt }
        this.passwordResetTokens = new Map(); // token -> { userId, expiresAt }
        this.initStore();
    }

    initStore() {
        this.users = [];
        this.roles = [
            { id: 1, name: 'member', description: 'Standard MLM Member' },
            { id: 2, name: 'admin', description: 'Operations Administrator' },
            { id: 3, name: 'super_admin', description: 'Super Administrator' }
        ];
        this.userRoles = [];
        this.memberProfiles = [];
        this.memberSettings = [];
        this.sponsors = [];
        this.networkNodes = [];
        this.networkClosure = [];
        this.commissionsFoundation = [];
        this.walletFoundation = [];
        this.walletTransactionsFoundation = [];
        this.memberNotifications = [];
        this.memberActivities = [];
        this.auditLogs = [];
        this.settings = new Map();

        // Catalog: Packages & Products
        this.packages = [];
        this.packageFeatures = [];
        this.productCategories = [];
        this.products = [];
        this.packageProducts = [];

        // Orders, Purchases, Payments & Refunds Ledger
        this.orders = [];
        this.orderItems = [];
        this.payments = [];
        this.refunds = [];

        // Commission Plans & Audited Commissions Ledger
        this.commissionPlans = [];
        this.commissions = [];
        this.commissionCounter = 1;

        // Wallets & Financial Ledger (Double-Entry Journal)
        this.wallets = [];
        this.ledgerEntries = [];
        this.ledgerCounter = 1;

        // Bank Accounts & Withdrawals System
        this.bankAccounts = [];
        this.withdrawals = [];
        this.withdrawalCounter = 1;

        // MLM Rank & Qualification Engine (Prompt 14)
        this.ranks = [];
        this.rankRuleVersions = [];
        this.rankRequirements = [];
        this.memberRankHistory = [];
        this.memberMetricSnapshots = [];
        this.rankHistoryCounter = 1;

        // Financial Reporting & Reconciliation (Prompt 15)
        this.reconciliationIssues = [];
        this.reconciliationCounter = 1;

        // Notifications & Communications Engine (Prompt 16)
        this.notifications = this.memberNotifications;
        this.notificationTemplates = [];
        this.notificationPreferences = new Map();
        this.announcements = [];
        this.notificationDeliveryLogs = [];

        // Support & Help Desk System (Prompt 17)
        this.supportTickets = [];
        this.supportTicketMessages = [];
        this.supportCategories = [];
        this.ticketCounter = 1;

        // KYC / Member Verification & Compliance System (Prompt 18)
        this.kycRequirements = [];
        this.kycSubmissions = [];
        this.kycDocuments = [];
        this.kycReviewEvents = [];
        this.kycDocumentAccessLogs = [];
        this.kycSubmissionCounter = 1;

        // Membership & Central Eligibility System (Prompt 19)
        this.memberships = [];
        this.membershipHistory = [];
        this.activationRules = [];
        this.eligibilityRules = [];

        // Initialize Default Settings
        this.settings.set('company_name', NexusConfig.COMPANY_NAME);
        this.settings.set('domain', NexusConfig.DOMAIN);
        this.settings.set('allow_orphan_registration', String(NexusConfig.ALLOW_ORPHAN_REGISTRATION));
        this.settings.set('default_root_referral_code', NexusConfig.DEFAULT_ROOT_REFERRAL_CODE);
        this.settings.set('direct_commission_percent', String(NexusConfig.DIRECT_COMMISSION_PERCENT));
        this.settings.set('binary_commission_percent', String(NexusConfig.BINARY_COMMISSION_PERCENT));
        this.settings.set('daily_earning_limit', String(NexusConfig.DAILY_EARNINGS_CAP_LKR));
        this.settings.set('min_withdrawal_amount', String(NexusConfig.MIN_WITHDRAWAL_AMOUNT_LKR));
        this.settings.set('rank_demotion_enabled', 'false');
        this.settings.set('rank_grace_period_enabled', 'false');
        this.settings.set('rank_grace_period_days', '30');
        this.settings.set('reporting_timezone', 'Asia/Colombo');

        // Seed Corporate Root Administrator
        this.seedRootAdmin();

        // Seed Corporate Packages and Products Catalog
        this.seedPackagesAndProducts();

        // Seed Versioned Corporate Commission Plans
        this.seedCommissionPlans();

        // Seed Configurable Ranks & Baseline Rule Version
        this.seedRanks();

        // Seed Standard Support Categories (Prompt 17)
        this.seedSupportCategories();

        // Seed Baseline KYC Requirements (Prompt 18)
        this.seedKycRequirements();

        // Seed Membership & Central Eligibility Rules (Prompt 19)
        this.seedMembershipRules();
    }

    seedRootAdmin() {
        const rootUserId = '00000000-0000-4000-8000-000000000001';
        const now = new Date().toISOString();

        // 1. Root User
        this.users.push({
            id: rootUserId,
            email: 'admin@nexusp.online',
            password_hash: '425d117b922c0bfae75a3761d8cef28e:fb963d9bfa61a5c0ce99e0303448fe00e8201fe30f632fa251fb579c56bb483fcbffdb2849467fd5d9b00e865db1c37f587b84b12f8f927973897950b0fb090b', // Password: Admin123!
            email_verified: true,
            email_verified_at: now,
            last_login_at: null,
            last_login_ip: null,
            created_at: now,
            updated_at: now
        });

        // 2. Roles
        this.userRoles.push(
            { user_id: rootUserId, role_id: 2, assigned_at: now },
            { user_id: rootUserId, role_id: 3, assigned_at: now }
        );

        // 3. Profile
        this.memberProfiles.push({
            id: 'prof-root-00000001',
            user_id: rootUserId,
            member_id: NexusConfig.DEFAULT_ROOT_MEMBER_ID,
            referral_code: NexusConfig.DEFAULT_ROOT_REFERRAL_CODE,
            full_name: 'Nexus Prime Corporate Administrator',
            display_name: 'Nexus Prime HQ',
            phone: '+94112000000',
            address: 'Nexus Prime HQ, Level 18, World Trade Center, Colombo 01',
            country: 'Sri Lanka',
            profile_image_url: null,
            rank: 'FOUNDER',
            package_status: 'STANDARD',
            status: 'active',
            sponsor_id: null, // Root has no sponsor
            registration_date: now,
            created_at: now,
            updated_at: now
        });

        // 4. Network Node
        this.networkNodes.push({
            user_id: rootUserId,
            parent_id: null,
            depth: 1,
            path: `/${rootUserId}/`,
            direct_team_count: 0,
            total_team_count: 0,
            created_at: now,
            updated_at: now
        });

        // 5. Network Closure
        this.networkClosure.push({
            ancestor_id: rootUserId,
            descendant_id: rootUserId,
            depth_distance: 0,
            created_at: now
        });

        // 6. Wallet
        this.walletFoundation.push({
            user_id: rootUserId,
            available_balance: 0.00,
            pending_balance: 0.00,
            total_withdrawn: 0.00,
            total_earned: 0.00,
            updated_at: now
        });

        this.wallets.push({
            id: 'wal-root-00001',
            member_id: rootUserId,
            currency: 'LKR',
            status: 'active',
            created_at: now,
            updated_at: now
        });

        // 7. Settings
        this.memberSettings.push({
            user_id: rootUserId,
            two_factor_enabled: false,
            two_factor_secret: null,
            email_notifications: true,
            sms_notifications: false,
            dark_mode: true,
            locale: 'en',
            updated_at: now
        });

        // 8. Notifications
        this.memberNotifications.push({
            id: 'notif-root-00000001',
            user_id: rootUserId,
            title: 'Welcome to Nexus Prime (PVT) Ltd',
            message: 'Your Founder Corporate Administrator command center is active. Begin building your network today.',
            type: 'system',
            read: false,
            link: '/dashboard',
            created_at: now
        });

        // 9. Activities
        this.memberActivities.push({
            id: 'act-root-00000001',
            user_id: rootUserId,
            action: 'ACCOUNT_ACTIVATED',
            description: 'Nexus Prime Founder Corporate Administrator account initialized.',
            icon: '🏢',
            created_at: now
        });
    }

    seedPackagesAndProducts() {
        const now = new Date().toISOString();

        // 1. Product Categories
        this.productCategories.push({
            id: 'cat-digital-masterclasses',
            name: 'Digital Masterclasses',
            slug: 'digital-masterclasses',
            description: 'Practical, certified digital mastery curriculums and technical masterclasses.',
            status: 'active',
            display_order: 1,
            created_at: now,
            updated_at: now
        });

        // 2. Products
        this.products.push(
            {
                id: 'prod-ai-01',
                name: 'AI Workflow Automation',
                sku: 'NP-SKU-AI01',
                slug: 'ai-workflow-automation',
                category_id: 'cat-digital-masterclasses',
                short_description: 'Harness generative AI, prompt engineering, and intelligent workplace automation.',
                full_description: 'A comprehensive enterprise masterclass covering prompt design, autonomous agent workflows, API integrations, and practical productivity multipliers for modern business leaders.',
                price: 5000.00,
                currency: 'LKR',
                stock_quantity: 9999,
                status: 'active',
                featured: true,
                image_url: 'assets/nexus/images/product-ai.png',
                display_order: 1,
                created_at: now,
                updated_at: now
            },
            {
                id: 'prod-dc-01',
                name: 'Digital Commerce Fundamentals',
                sku: 'NP-SKU-DC01',
                slug: 'digital-commerce-fundamentals',
                category_id: 'cat-digital-masterclasses',
                short_description: 'End-to-end masterclass on building and scaling high-conversion e-commerce operations.',
                full_description: 'Learn product sourcing, omni-channel customer acquisition, funnel optimization, payment flows, and customer lifetime value scaling in the Sri Lankan and global markets.',
                price: 5000.00,
                currency: 'LKR',
                stock_quantity: 9999,
                status: 'active',
                featured: false,
                image_url: 'assets/nexus/images/product-dc.png',
                display_order: 2,
                created_at: now,
                updated_at: now
            },
            {
                id: 'prod-tl-01',
                name: 'Team Leadership & Ethics',
                sku: 'NP-SKU-TL01',
                slug: 'team-leadership-ethics',
                category_id: 'cat-digital-masterclasses',
                short_description: 'Ethical team empowerment, compliant network scaling, and executive leadership.',
                full_description: 'Master high-performance team leadership, transparent mentorship frameworks, compliance standards, and collaborative organizational growth strategies.',
                price: 5000.00,
                currency: 'LKR',
                stock_quantity: 9999,
                status: 'active',
                featured: false,
                image_url: 'assets/nexus/images/product-tl.png',
                display_order: 3,
                created_at: now,
                updated_at: now
            }
        );

        // 3. Membership Packages
        this.packages.push(
            {
                id: 'pkg-starter-01',
                name: 'Starter Package',
                package_code: 'NP-PKG-01',
                slug: 'starter-package',
                short_description: 'Entry-level digital entrepreneurship foundation with essential masterclasses.',
                full_description: 'The ideal entry point for emerging entrepreneurs. Includes foundational digital commerce access, community mastermind webinars, and direct referral affiliate rights.',
                price: 7500.00,
                currency: 'LKR',
                status: 'active',
                display_order: 1,
                featured: false,
                image_icon: 'fas fa-seedling',
                created_at: now,
                updated_at: now
            },
            {
                id: 'pkg-pro-02',
                name: 'Professional Package',
                package_code: 'NP-PKG-02',
                slug: 'professional-package',
                short_description: 'Advanced business suite with priority digital skills modules and executive perks.',
                full_description: 'Our most popular package designed for ambitious team leaders. Full access to AI workflow automation, digital commerce masterclasses, and priority support.',
                price: 15000.00,
                currency: 'LKR',
                status: 'active',
                display_order: 2,
                featured: true,
                image_icon: 'fas fa-briefcase',
                created_at: now,
                updated_at: now
            },
            {
                id: 'pkg-exec-03',
                name: 'Executive Package',
                package_code: 'NP-PKG-03',
                slug: 'executive-package',
                short_description: 'Elite enterprise curriculum, master mentorship access, and global network privileges.',
                full_description: 'The definitive executive membership package. Unlocks all digital masterclass curriculums, one-on-one founder mentorship cohorts, and VIP conference invitations.',
                price: 30000.00,
                currency: 'LKR',
                status: 'active',
                display_order: 3,
                featured: false,
                image_icon: 'fas fa-crown',
                created_at: now,
                updated_at: now
            }
        );

        // 4. Package Features
        const starterFeatures = [
            'Entry-level digital commerce access',
            'Direct referral affiliate privileges',
            'Standard support channel',
            'Community forum & monthly webinars'
        ];
        starterFeatures.forEach((feat, idx) => {
            this.packageFeatures.push({
                id: `feat-st-${idx + 1}`,
                package_id: 'pkg-starter-01',
                feature_text: feat,
                display_order: idx + 1,
                is_highlighted: false
            });
        });

        const proFeatures = [
            'Full AI workflow automation curriculum',
            'Digital commerce fundamentals masterclass',
            'Expanded network depth access',
            'Priority 24/7 corporate helpdesk',
            'Weekly mastermind sessions'
        ];
        proFeatures.forEach((feat, idx) => {
            this.packageFeatures.push({
                id: `feat-pr-${idx + 1}`,
                package_id: 'pkg-pro-02',
                feature_text: feat,
                display_order: idx + 1,
                is_highlighted: idx < 2
            });
        });

        const execFeatures = [
            'All current & future digital curriculums',
            'Executive leadership & compliance suite',
            'Founder advisory group mastermind',
            'Exclusive annual summit VIP invitation',
            'Dedicated corporate account manager'
        ];
        execFeatures.forEach((feat, idx) => {
            this.packageFeatures.push({
                id: `feat-ex-${idx + 1}`,
                package_id: 'pkg-exec-03',
                feature_text: feat,
                display_order: idx + 1,
                is_highlighted: true
            });
        });

        // 5. Package Products Junction
        this.packageProducts.push(
            { id: 'pp-1', package_id: 'pkg-starter-01', product_id: 'prod-dc-01' },
            { id: 'pp-2', package_id: 'pkg-pro-02', product_id: 'prod-ai-01' },
            { id: 'pp-3', package_id: 'pkg-pro-02', product_id: 'prod-dc-01' },
            { id: 'pp-4', package_id: 'pkg-exec-03', product_id: 'prod-ai-01' },
            { id: 'pp-5', package_id: 'pkg-exec-03', product_id: 'prod-dc-01' },
            { id: 'pp-6', package_id: 'pkg-exec-03', product_id: 'prod-tl-01' }
        );
    }

    // Sequence Generator for Member ID (e.g. NP000002, NP000003...)
    generateNextMemberId() {
        this.memberIdCounter++;
        const padded = String(this.memberIdCounter).padStart(6, '0');
        return `${NexusConfig.MEMBER_ID_PREFIX}${padded}`;
    }

    // Unique Referral Code Generator
    generateReferralCode(memberId) {
        const cleanNum = memberId.replace(/[^0-9]/g, '');
        return `${NexusConfig.REFERRAL_CODE_PREFIX}${cleanNum}`;
    }

    // User Operations
    async findUserByEmail(email) {
        if (!email) return null;
        const normalized = email.trim().toLowerCase();
        return this.users.find(u => u.email.toLowerCase() === normalized) || null;
    }

    async findUserById(id) {
        if (!id) return null;
        return this.users.find(u => u.id === id) || null;
    }

    async insertUser(user) {
        this.users.push(user);
        return user;
    }

    // Role Operations
    async getUserRoles(userId) {
        const roles = this.userRoles
            .filter(ur => ur.user_id === userId)
            .map(ur => {
                const r = this.roles.find(role => role.id === ur.role_id);
                return r ? r.name : null;
            })
            .filter(Boolean);
        return roles.length > 0 ? roles : ['member'];
    }

    async assignRole(userId, roleName, assignedBy = null) {
        const role = this.roles.find(r => r.name === roleName);
        if (!role) return false;
        const exists = this.userRoles.some(ur => ur.user_id === userId && ur.role_id === role.id);
        if (!exists) {
            this.userRoles.push({
                user_id: userId,
                role_id: role.id,
                assigned_at: new Date().toISOString(),
                assigned_by: assignedBy
            });
        }
        return true;
    }

    // Profile Operations
    async findProfileByUserId(userId) {
        if (!userId) return null;
        return this.memberProfiles.find(p => p.user_id === userId) || null;
    }

    async findProfileByMemberId(memberId) {
        if (!memberId) return null;
        const normalized = memberId.trim().toUpperCase();
        return this.memberProfiles.find(p => p.member_id.toUpperCase() === normalized) || null;
    }

    async findProfileByReferralCode(referralCode) {
        if (!referralCode) return null;
        const normalized = referralCode.trim().toUpperCase();
        return this.memberProfiles.find(p => p.referral_code.toUpperCase() === normalized) || null;
    }

    async insertProfile(profile) {
        this.memberProfiles.push(profile);
        return profile;
    }

    async updateProfile(userId, updates) {
        const idx = this.memberProfiles.findIndex(p => p.user_id === userId);
        if (idx === -1) return null;

        // Disallow arbitrary mutation of critical invariant fields
        const safeUpdates = { ...updates };
        delete safeUpdates.user_id;
        delete safeUpdates.userId;
        delete safeUpdates.member_id;
        delete safeUpdates.memberId;
        delete safeUpdates.referral_code;
        delete safeUpdates.referralCode;
        delete safeUpdates.sponsor_id;
        delete safeUpdates.sponsorId;
        delete safeUpdates.status;
        delete safeUpdates.rank;
        delete safeUpdates.package_status;
        delete safeUpdates.packageStatus;
        delete safeUpdates.registration_date;
        delete safeUpdates.registrationDate;
        delete safeUpdates.role;
        delete safeUpdates.roles;

        this.memberProfiles[idx] = {
            ...this.memberProfiles[idx],
            ...safeUpdates,
            updated_at: new Date().toISOString()
        };
        return this.memberProfiles[idx];
    }

    async updateAccountStatus(userId, status) {
        const allowed = ['active', 'pending', 'suspended', 'blocked', 'inactive'];
        if (!allowed.includes(status)) return false;
        const profile = await this.findProfileByUserId(userId);
        if (!profile) return false;
        profile.status = status;
        profile.updated_at = new Date().toISOString();
        return true;
    }

    async updateMemberProfile(userId, updates) {
        const uid = this.resolveMemberUserId(userId);
        const profile = await this.findProfileByUserId(uid);
        if (!profile) return null;
        Object.assign(profile, updates);
        profile.updated_at = new Date().toISOString();
        return profile;
    }

    // Sponsor & Network Operations
    async insertSponsor(userId, sponsorId) {
        const record = {
            user_id: userId,
            sponsor_id: sponsorId,
            created_at: new Date().toISOString()
        };
        this.sponsors.push(record);
        return record;
    }

    async getSponsor(userId) {
        const record = this.sponsors.find(s => s.user_id === userId);
        if (!record) return null;
        return this.findProfileByUserId(record.sponsor_id);
    }

    /**
     * Mathematical Sponsor Validation:
     * 1. Self-referral prevention (userId !== sponsorId)
     * 2. Existence and Active Status check
     * 3. Transitive Circular Cycle Prevention (userId must NOT be an ancestor of sponsorId)
     */
    async validateSponsorRelationship(userId, sponsorId) {
        if (!sponsorId) {
            return { valid: false, error: 'Sponsor ID is required.' };
        }

        // 1. Self-Referral Prevention
        if (userId && userId === sponsorId) {
            return {
                valid: false,
                error: 'Self-referral is strictly prohibited. A member cannot sponsor themselves.'
            };
        }

        // 2. Sponsor Existence & Active Standing
        const sponsorProfile = await this.findProfileByUserId(sponsorId);
        if (!sponsorProfile) {
            return {
                valid: false,
                error: 'This referral link is no longer valid (sponsor account not found).'
            };
        }

        if (sponsorProfile.status !== 'active') {
            return {
                valid: false,
                error: 'This referral link is no longer valid (sponsor account is suspended or inactive).'
            };
        }

        // 3. Circular Network Prevention (A -> B -> C -> A cycle)
        if (userId) {
            const isCycle = this.networkClosure.some(c => 
                c.ancestor_id === userId && 
                c.descendant_id === sponsorId && 
                c.depth_distance > 0
            );
            if (isCycle) {
                return {
                    valid: false,
                    error: 'Circular sponsor relationship detected. Cannot assign a downline member as a sponsor.'
                };
            }
        }

        return {
            valid: true,
            sponsor: sponsorProfile
        };
    }

    async insertNetworkNode(userId, parentId) {
        let depth = 1;
        let path = `/${userId}/`;

        if (parentId) {
            const parentNode = this.networkNodes.find(n => n.user_id === parentId);
            if (parentNode) {
                depth = parentNode.depth + 1;
                path = `${parentNode.path}${userId}/`;
            }
        }

        const node = {
            user_id: userId,
            parent_id: parentId,
            depth: depth,
            path: path,
            direct_team_count: 0,
            total_team_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        this.networkNodes.push(node);

        // Update closure matrix
        this.updateClosureMatrix(userId, parentId);

        return node;
    }

    updateClosureMatrix(userId, parentId) {
        const now = new Date().toISOString();

        // 1. Self-link (depth 0)
        this.networkClosure.push({
            ancestor_id: userId,
            descendant_id: userId,
            depth_distance: 0,
            created_at: now
        });

        if (parentId) {
            // 2. Inherit ancestor relations
            const parentAncestors = this.networkClosure.filter(c => c.descendant_id === parentId);
            for (const pa of parentAncestors) {
                this.networkClosure.push({
                    ancestor_id: pa.ancestor_id,
                    descendant_id: userId,
                    depth_distance: pa.depth_distance + 1,
                    created_at: now
                });
            }

            // 3. Update direct count on immediate parent
            const parentNode = this.networkNodes.find(n => n.user_id === parentId);
            if (parentNode) {
                parentNode.direct_team_count += 1;
                parentNode.updated_at = now;
            }

            // 4. Update total team count on all ancestors
            for (const pa of parentAncestors) {
                const ancNode = this.networkNodes.find(n => n.user_id === pa.ancestor_id);
                if (ancNode) {
                    ancNode.total_team_count += 1;
                    ancNode.updated_at = now;
                }
            }
        }
    }

    async getDirectReferrals(userId) {
        const directSponsorRecords = this.sponsors.filter(s => s.sponsor_id === userId);
        const result = [];
        for (const s of directSponsorRecords) {
            const prof = await this.findProfileByUserId(s.user_id);
            if (prof) {
                result.push({
                    user_id: prof.user_id,
                    member_id: prof.member_id,
                    referral_code: prof.referral_code,
                    full_name: prof.full_name,
                    display_name: prof.display_name || prof.full_name,
                    status: prof.status,
                    rank: prof.rank,
                    registration_date: prof.registration_date
                });
            }
        }
        return result;
    }

    async getDownline(userId, maxDepth = null, statusFilter = 'all') {
        const records = this.networkClosure.filter(c => 
            c.ancestor_id === userId && 
            c.depth_distance > 0 &&
            (maxDepth === null || c.depth_distance <= maxDepth)
        );

        records.sort((a, b) => a.depth_distance - b.depth_distance);

        const downline = [];
        for (const r of records) {
            const prof = await this.findProfileByUserId(r.descendant_id);
            if (prof) {
                if (statusFilter && statusFilter !== 'all' && prof.status !== statusFilter) {
                    continue;
                }
                downline.push({
                    user_id: prof.user_id,
                    member_id: prof.member_id,
                    referral_code: prof.referral_code,
                    full_name: prof.full_name,
                    sponsor_id: prof.sponsor_id,
                    level: r.depth_distance,
                    status: prof.status,
                    registration_date: prof.registration_date
                });
            }
        }
        return downline;
    }

    /**
     * Dynamic Level Distance Calculation
     */
    async getRelativeLevel(ancestorId, descendantId) {
        if (ancestorId === descendantId) return 0;
        const record = this.networkClosure.find(c => 
            c.ancestor_id === ancestorId && 
            c.descendant_id === descendantId
        );
        return record ? record.depth_distance : null;
    }

    /**
     * Progressive Loading: Fetch direct children of a specific node
     */
    async getNodeChildren(parentId) {
        const childNodes = this.networkNodes.filter(n => n.parent_id === parentId);
        const result = [];
        for (const node of childNodes) {
            const prof = await this.findProfileByUserId(node.user_id);
            if (prof) {
                result.push({
                    userId: prof.user_id,
                    memberId: prof.member_id,
                    referralCode: prof.referral_code,
                    fullName: prof.full_name,
                    displayName: prof.display_name || prof.full_name,
                    rank: prof.rank || 'MEMBER',
                    status: prof.status,
                    depth: node.depth,
                    directTeamCount: node.direct_team_count,
                    totalTeamCount: node.total_team_count,
                    hasChildren: node.direct_team_count > 0,
                    sponsorId: node.parent_id,
                    registrationDate: prof.registration_date
                });
            }
        }
        return result;
    }

    /**
     * Detailed Node Information for Interactive Modal
     */
    async getNodeDetails(userId) {
        const prof = await this.findProfileByUserId(userId);
        if (!prof) return null;
        const node = this.networkNodes.find(n => n.user_id === userId);
        const sponsorRecord = this.sponsors.find(s => s.user_id === userId);
        let sponsorProf = null;
        if (sponsorRecord) {
            sponsorProf = await this.findProfileByUserId(sponsorRecord.sponsor_id);
        }
        const user = await this.findUserById(userId);
        const wallet = await this.getWallet(userId);
        return {
            userId: prof.user_id,
            memberId: prof.member_id,
            referralCode: prof.referral_code,
            fullName: prof.full_name,
            displayName: prof.display_name || prof.full_name,
            rank: prof.rank || 'MEMBER',
            status: prof.status,
            packageStatus: prof.package_status || 'STANDARD',
            email: user ? user.email : '',
            phone: prof.phone || '',
            depth: node ? node.depth : 1,
            directTeamCount: node ? node.direct_team_count : 0,
            totalTeamCount: node ? node.total_team_count : 0,
            hasChildren: node ? node.direct_team_count > 0 : false,
            sponsor: sponsorProf ? {
                userId: sponsorProf.user_id,
                memberId: sponsorProf.member_id,
                referralCode: sponsorProf.referral_code,
                fullName: sponsorProf.full_name
            } : {
                userId: null,
                memberId: 'NP000001',
                referralCode: 'NEXUS001',
                fullName: 'Nexus Prime HQ'
            },
            wallet: {
                availableBalance: wallet ? wallet.available_balance : 0,
                totalEarned: wallet ? wallet.total_earned : 0
            },
            registrationDate: prof.registration_date
        };
    }

    /**
     * Search Downline Network by Name, Member ID, or Referral Code
     */
    async searchNetworkMember(rootUserId, query) {
        if (!query || !query.trim()) return [];
        const q = query.trim().toLowerCase();

        const rootProf = await this.findProfileByUserId(rootUserId);
        const downline = await this.getDownline(rootUserId);

        const candidates = [];
        if (rootProf) {
            candidates.push({
                user_id: rootProf.user_id,
                member_id: rootProf.member_id,
                referral_code: rootProf.referral_code,
                full_name: rootProf.full_name,
                level: 0,
                status: rootProf.status
            });
        }
        candidates.push(...downline);

        return candidates.filter(item => {
            return (
                (item.member_id && item.member_id.toLowerCase().includes(q)) ||
                (item.referral_code && item.referral_code.toLowerCase().includes(q)) ||
                (item.full_name && item.full_name.toLowerCase().includes(q))
            );
        });
    }

    async getUpline(userId, maxLevels = null) {
        const records = this.networkClosure.filter(c => 
            c.descendant_id === userId && 
            c.depth_distance > 0 &&
            (maxLevels === null || c.depth_distance <= maxLevels)
        );

        records.sort((a, b) => a.depth_distance - b.depth_distance);

        const upline = [];
        for (const r of records) {
            const prof = await this.findProfileByUserId(r.ancestor_id);
            if (prof) {
                upline.push({
                    user_id: prof.user_id,
                    member_id: prof.member_id,
                    referral_code: prof.referral_code,
                    full_name: prof.full_name,
                    level: r.depth_distance,
                    status: prof.status
                });
            }
        }
        return upline;
    }

    async getTeamCounts(userId) {
        const node = this.networkNodes.find(n => n.user_id === userId);
        if (node) {
            return {
                directTeamCount: node.direct_team_count,
                totalTeamCount: node.total_team_count
            };
        }
        const direct = this.sponsors.filter(s => s.sponsor_id === userId).length;
        const total = this.networkClosure.filter(c => c.ancestor_id === userId && c.depth_distance > 0).length;
        return { directTeamCount: direct, totalTeamCount: total };
    }

    async getMemberTeamStats(userId) {
        const directRecords = this.sponsors.filter(s => s.sponsor_id === userId);
        const directCount = directRecords.length;

        const downlineRecords = this.networkClosure.filter(c => c.ancestor_id === userId && c.depth_distance > 0);
        const totalCount = downlineRecords.length;

        let activeCount = 0;
        let pendingCount = 0;
        let inactiveCount = 0;

        for (const record of downlineRecords) {
            const prof = await this.findProfileByUserId(record.descendant_id);
            if (prof) {
                if (prof.status === 'active') activeCount++;
                else if (prof.status === 'pending') pendingCount++;
                else inactiveCount++;
            }
        }

        return {
            directTeamCount: directCount,
            totalTeamCount: totalCount,
            activeTeamCount: activeCount,
            pendingTeamCount: pendingCount,
            inactiveTeamCount: inactiveCount
        };
    }

    async getMemberReferrals(userId, { page = 1, limit = 10, status = 'all', search = '' } = {}) {
        const directs = await this.getDirectReferrals(userId);
        let filtered = directs;
        if (status && status !== 'all') {
            filtered = filtered.filter(d => d.status && d.status.toLowerCase() === status.toLowerCase());
        }
        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter(d => 
                (d.full_name && d.full_name.toLowerCase().includes(q)) ||
                (d.display_name && d.display_name.toLowerCase().includes(q)) ||
                (d.member_id && d.member_id.toLowerCase().includes(q)) ||
                (d.referral_code && d.referral_code.toLowerCase().includes(q))
            );
        }
        const total = filtered.length;
        const p = Math.max(1, parseInt(page, 10) || 1);
        const l = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
        const totalPages = Math.ceil(total / l) || 1;
        const offset = (p - 1) * l;
        const pageData = filtered.slice(offset, offset + l);

        return {
            total,
            page: p,
            limit: l,
            totalPages,
            referrals: pageData
        };
    }

    async getMemberTeam(userId, { page = 1, limit = 10, status = 'all', search = '', maxDepth = null } = {}) {
        const downline = await this.getDownline(userId, maxDepth, 'all');
        let filtered = downline;
        if (status && status !== 'all') {
            filtered = filtered.filter(d => d.status && d.status.toLowerCase() === status.toLowerCase());
        }
        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter(d => 
                (d.full_name && d.full_name.toLowerCase().includes(q)) ||
                (d.member_id && d.member_id.toLowerCase().includes(q)) ||
                (d.referral_code && d.referral_code.toLowerCase().includes(q))
            );
        }
        const total = filtered.length;
        const p = Math.max(1, parseInt(page, 10) || 1);
        const l = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
        const totalPages = Math.ceil(total / l) || 1;
        const offset = (p - 1) * l;
        const pageData = filtered.slice(offset, offset + l);

        return {
            total,
            page: p,
            limit: l,
            totalPages,
            members: pageData
        };
    }

    // =========================================================================
    // Notifications & Communications Engine (Prompt 16)
    // =========================================================================
    async insertMemberNotification(data) {
        return this.insertNotification(data);
    }

    async insertNotification(data) {
        const id = data.id || 'notif-' + crypto.randomBytes(8).toString('hex');
        const userId = data.userId || data.user_id || data.recipient_member_id || data.recipient_admin_id;
        const now = data.created_at || new Date().toISOString();
        const status = data.status || (data.read ? 'read' : 'unread');

        const notif = {
            id: id,
            recipient_member_id: data.recipient_member_id !== undefined ? data.recipient_member_id : (data.recipient_admin_id ? null : userId),
            recipient_admin_id: data.recipient_admin_id || null,
            user_id: userId, // Backwards compatibility
            notification_type: data.notification_type || data.type || 'system',
            type: data.type || data.notification_type || 'system', // Backwards compatibility
            category: data.category || 'system',
            priority: data.priority || 'normal',
            title: data.title || 'Notification',
            message: data.message || '',
            reference_type: data.reference_type || null,
            reference_id: data.reference_id || null,
            action_url: data.action_url || data.link || null,
            link: data.link || data.action_url || null, // Backwards compatibility
            status: status,
            read: status === 'read', // Backwards compatibility
            idempotency_key: data.idempotency_key || null,
            metadata: data.metadata || {},
            read_at: data.read_at || (status === 'read' ? now : null),
            archived_at: data.archived_at || null,
            created_at: now,
            updated_at: data.updated_at || now
        };

        this.memberNotifications.push(notif);
        return notif;
    }

    async createNotificationRecord(data) {
        return this.insertNotification(data);
    }

    async getNotificationByIdempotencyKey(key) {
        if (!key) return null;
        return this.memberNotifications.find(n => n.idempotency_key === key) || null;
    }

    async getNotificationById(id) {
        if (!id) return null;
        return this.memberNotifications.find(n => n.id === id) || null;
    }

    async getMemberNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
        let list = this.memberNotifications.filter(n => 
            (n.user_id === userId || n.recipient_member_id === userId) && 
            n.status !== 'archived'
        );
        if (unreadOnly) {
            list = list.filter(n => !n.read && n.status === 'unread');
        }
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return list.slice(0, limit);
    }

    async getNotifications({
        recipientId = null,
        isAdmin = false,
        category = null,
        priority = null,
        status = null,
        search = null,
        startDate = null,
        endDate = null,
        limit = 50,
        offset = 0
    } = {}) {
        let list = [...this.memberNotifications];

        if (recipientId) {
            list = list.filter(n => 
                n.recipient_member_id === recipientId || 
                n.recipient_admin_id === recipientId || 
                n.user_id === recipientId
            );
        } else if (isAdmin) {
            list = list.filter(n => n.recipient_admin_id !== null || !n.recipient_member_id);
        }

        if (category && category !== 'all') {
            list = list.filter(n => n.category === category);
        }

        if (priority && priority !== 'all') {
            list = list.filter(n => n.priority === priority);
        }

        if (status === 'unread') {
            list = list.filter(n => !n.read && n.status !== 'archived');
        } else if (status === 'read') {
            list = list.filter(n => n.read && n.status !== 'archived');
        } else if (status === 'archived') {
            list = list.filter(n => n.status === 'archived');
        } else {
            list = list.filter(n => n.status !== 'archived');
        }

        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(n => 
                (n.title && n.title.toLowerCase().includes(q)) ||
                (n.message && n.message.toLowerCase().includes(q)) ||
                (n.reference_id && n.reference_id.toLowerCase().includes(q))
            );
        }

        if (startDate) {
            const startIso = new Date(startDate).toISOString();
            list = list.filter(n => n.created_at >= startIso);
        }

        if (endDate) {
            const endIso = new Date(endDate).toISOString();
            list = list.filter(n => n.created_at < endIso);
        }

        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const total = list.length;
        const unreadCount = list.filter(n => !n.read && n.status === 'unread').length;
        const paginated = list.slice(offset, offset + limit);

        return {
            total,
            unreadCount,
            limit,
            offset,
            notifications: paginated
        };
    }

    async getUnreadNotificationCount(userId) {
        return this.memberNotifications.filter(n => 
            (n.user_id === userId || n.recipient_member_id === userId || n.recipient_admin_id === userId) && 
            !n.read && 
            n.status !== 'archived'
        ).length;
    }

    async markNotificationRead(userId, notificationId) {
        const notif = this.memberNotifications.find(n => 
            n.id === notificationId && 
            (n.user_id === userId || n.recipient_member_id === userId || n.recipient_admin_id === userId)
        );
        if (!notif) return false;
        notif.read = true;
        notif.status = 'read';
        notif.read_at = new Date().toISOString();
        notif.updated_at = new Date().toISOString();
        return true;
    }

    async markAllNotificationsRead(userId, category = null) {
        let count = 0;
        const now = new Date().toISOString();
        for (const notif of this.memberNotifications) {
            const isUser = (notif.user_id === userId || notif.recipient_member_id === userId || notif.recipient_admin_id === userId);
            const matchesCat = !category || notif.category === category;
            if (isUser && matchesCat && (!notif.read || notif.status === 'unread')) {
                notif.read = true;
                notif.status = 'read';
                notif.read_at = now;
                notif.updated_at = now;
                count++;
            }
        }
        return count;
    }

    async archiveNotification(userId, notificationId) {
        const notif = this.memberNotifications.find(n => 
            n.id === notificationId && 
            (n.user_id === userId || n.recipient_member_id === userId || n.recipient_admin_id === userId)
        );
        if (!notif) return false;
        notif.status = 'archived';
        notif.archived_at = new Date().toISOString();
        notif.updated_at = new Date().toISOString();
        return true;
    }

    // Notification Preferences
    async getNotificationPreferences(userId) {
        if (!userId) return null;
        let prefs = this.notificationPreferences.get(userId);
        if (!prefs) {
            prefs = {
                id: 'pref-' + crypto.randomBytes(6).toString('hex'),
                user_id: userId,
                in_app_enabled: true,
                email_enabled: true,
                sms_enabled: false,
                category_preferences: {
                    account: true,
                    order: true,
                    payment: true,
                    commission: true,
                    wallet: true,
                    withdrawal: true,
                    rank: true,
                    support: true,
                    network: true,
                    system: true
                },
                updated_at: new Date().toISOString()
            };
            this.notificationPreferences.set(userId, prefs);
        }
        return prefs;
    }

    async updateNotificationPreferences(userId, updates = {}) {
        const prefs = await this.getNotificationPreferences(userId);
        if (updates.in_app_enabled !== undefined) prefs.in_app_enabled = !!updates.in_app_enabled;
        if (updates.email_enabled !== undefined) prefs.email_enabled = !!updates.email_enabled;
        if (updates.sms_enabled !== undefined) prefs.sms_enabled = !!updates.sms_enabled;
        if (updates.category_preferences && typeof updates.category_preferences === 'object') {
            prefs.category_preferences = {
                ...prefs.category_preferences,
                ...updates.category_preferences
            };
        }
        prefs.updated_at = new Date().toISOString();
        this.notificationPreferences.set(userId, prefs);
        return prefs;
    }

    // Announcements
    async createAnnouncement(data) {
        const ann = {
            id: 'ann-' + crypto.randomBytes(8).toString('hex'),
            title: data.title,
            content: data.content,
            priority: data.priority || 'normal',
            target_audience: data.target_audience || 'all',
            author_id: data.author_id,
            is_active: data.is_active !== undefined ? !!data.is_active : true,
            starts_at: data.starts_at || new Date().toISOString(),
            expires_at: data.expires_at || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        this.announcements.push(ann);
        return ann;
    }

    async getAnnouncements({ audience = null, activeOnly = true, limit = 20, offset = 0 } = {}) {
        let list = [...this.announcements];
        if (activeOnly) {
            const now = new Date().toISOString();
            list = list.filter(a => a.is_active && (!a.expires_at || a.expires_at > now));
        }
        if (audience && audience !== 'all') {
            list = list.filter(a => a.target_audience === 'all' || a.target_audience === audience);
        }
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const total = list.length;
        const sliced = list.slice(offset, offset + limit);
        sliced.total = total;
        sliced.announcements = sliced;
        return sliced;
    }

    // Delivery Logs
    async logNotificationDelivery(log) {
        const entry = {
            id: 'dlog-' + crypto.randomBytes(8).toString('hex'),
            notification_id: log.notification_id,
            channel: log.channel,
            recipient_destination: log.recipient_destination || null,
            delivery_status: log.delivery_status,
            error_message: log.error_message || null,
            dispatched_at: new Date().toISOString()
        };
        this.notificationDeliveryLogs.push(entry);
        return entry;
    }

    async getNotificationDeliveryLogs(notificationId) {
        return this.notificationDeliveryLogs.filter(l => l.notification_id === notificationId);
    }

    // =========================================================================
    // Support Tickets & Help Desk (Prompt 17)
    // =========================================================================
    async generateNextTicketNumber() {
        const seq = String(this.ticketCounter++).padStart(6, '0');
        return `NP-TKT-${seq}`;
    }

    async seedSupportCategories() {
        this.supportCategories = [
            { id: 'cat-account', name: 'Account & Security', code: 'account', description: 'Profile updates, 2FA, password resets, and login issues', is_active: true, display_order: 1 },
            { id: 'cat-kyc', name: 'KYC & Verification', code: 'kyc', description: 'National Identity, Passport, proof of address, and verification status', is_active: true, display_order: 2 },
            { id: 'cat-package', name: 'Packages & Subscriptions', code: 'package', description: 'Package tiers, activations, subscription status, and upgrades', is_active: true, display_order: 3 },
            { id: 'cat-order', name: 'Orders & Purchases', code: 'order', description: 'Order fulfillment, tracking, product delivery, and receipts', is_active: true, display_order: 4 },
            { id: 'cat-payment', name: 'Payments & Gateway', code: 'payment', description: 'Bank slips, PayHere checkout issues, payment confirmations', is_active: true, display_order: 5 },
            { id: 'cat-network', name: 'Network & Genealogies', code: 'network', description: 'Sponsor placements, direct referrals, downline team structures', is_active: true, display_order: 6 },
            { id: 'cat-commission', name: 'Commissions & Points', code: 'commission', description: 'Direct bonuses, team commissions, matching bonuses, BV tracking', is_active: true, display_order: 7 },
            { id: 'cat-withdrawal', name: 'Wallet & Withdrawals', code: 'withdrawal', description: 'Available balance, payout delays, bank account details', is_active: true, display_order: 8 },
            { id: 'cat-technical', name: 'Technical & Platform Bug', code: 'technical', description: 'Errors, rendering issues, mobile responsiveness, system glitches', is_active: true, display_order: 9 },
            { id: 'cat-general', name: 'General Inquiry', code: 'general', description: 'Company policies, business terms, FAQs, and general questions', is_active: true, display_order: 10 }
        ];
    }

    async getSupportCategories() {
        return [...this.supportCategories].sort((a, b) => a.display_order - b.display_order);
    }

    async createSupportCategory(data) {
        const cat = {
            id: 'cat-' + crypto.randomBytes(6).toString('hex'),
            name: data.name,
            code: data.code.toLowerCase().replace(/\s+/g, '_'),
            description: data.description || '',
            is_active: data.is_active !== undefined ? !!data.is_active : true,
            display_order: data.display_order || (this.supportCategories.length + 1),
            created_at: new Date().toISOString()
        };
        this.supportCategories.push(cat);
        return cat;
    }

    async createSupportTicket(data) {
        this.supportTickets.push(data);
        return data;
    }

    async getSupportTicketById(id) {
        if (!id) return null;
        return this.supportTickets.find(t => t.id === id) || null;
    }

    async getSupportTicketByNumber(ticketNumber) {
        if (!ticketNumber) return null;
        const normalized = ticketNumber.trim().toUpperCase();
        return this.supportTickets.find(t => t.ticket_number.toUpperCase() === normalized) || null;
    }

    async getSupportTickets({
        memberId = null,
        status = null,
        priority = null,
        category = null,
        assignedAdminId = null,
        search = null,
        startDate = null,
        endDate = null,
        limit = 50,
        offset = 0
    } = {}) {
        let list = [...this.supportTickets];

        if (memberId) {
            list = list.filter(t => t.member_id === memberId);
        }

        if (status && status !== 'all') {
            list = list.filter(t => t.status === status);
        }

        if (priority && priority !== 'all') {
            list = list.filter(t => t.priority === priority);
        }

        if (category && category !== 'all') {
            list = list.filter(t => t.category === category);
        }

        if (assignedAdminId) {
            if (assignedAdminId === 'unassigned') {
                list = list.filter(t => !t.assigned_admin_id);
            } else {
                list = list.filter(t => t.assigned_admin_id === assignedAdminId);
            }
        }

        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(t => 
                t.ticket_number.toLowerCase().includes(q) ||
                t.subject.toLowerCase().includes(q)
            );
        }

        if (startDate) {
            const startIso = new Date(startDate).toISOString();
            list = list.filter(t => t.created_at >= startIso);
        }

        if (endDate) {
            const endIso = new Date(endDate).toISOString();
            list = list.filter(t => t.created_at < endIso);
        }

        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const total = list.length;
        const paginated = list.slice(offset, offset + limit);

        return {
            total,
            limit,
            offset,
            tickets: paginated
        };
    }

    async addSupportTicketMessage(data) {
        this.supportTicketMessages.push(data);
        const ticket = this.supportTickets.find(t => t.id === data.ticket_id);
        if (ticket) {
            ticket.updated_at = new Date().toISOString();
        }
        return data;
    }

    async getSupportTicketMessages(ticketId, includeInternal = false) {
        let msgs = this.supportTicketMessages.filter(m => m.ticket_id === ticketId);
        if (!includeInternal) {
            msgs = msgs.filter(m => !m.is_internal);
        }
        msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        return msgs;
    }

    async updateSupportTicketStatus(id, newStatus, actorId, extra = {}) {
        const ticket = this.supportTickets.find(t => t.id === id);
        if (!ticket) return null;
        ticket.status = newStatus;
        ticket.updated_at = new Date().toISOString();
        if (extra.resolved_at) ticket.resolved_at = extra.resolved_at;
        if (extra.closed_at) ticket.closed_at = extra.closed_at;

        await this.insertAuditLog({
            user_id: actorId,
            action: 'SUPPORT_TICKET_STATUS_CHANGED',
            entity_type: 'nexus_support_tickets',
            entity_id: ticket.ticket_number,
            actor_id: actorId,
            new_values: { status: newStatus, ...extra }
        });

        return ticket;
    }

    async updateSupportTicketPriority(id, newPriority, actorId) {
        const ticket = this.supportTickets.find(t => t.id === id);
        if (!ticket) return null;
        ticket.priority = newPriority;
        ticket.updated_at = new Date().toISOString();

        await this.insertAuditLog({
            user_id: actorId,
            action: 'SUPPORT_TICKET_PRIORITY_CHANGED',
            entity_type: 'nexus_support_tickets',
            entity_id: ticket.ticket_number,
            actor_id: actorId,
            new_values: { priority: newPriority }
        });

        return ticket;
    }

    async assignSupportTicket(id, assignedAdminId, actorId) {
        const ticket = this.supportTickets.find(t => t.id === id);
        if (!ticket) return null;
        ticket.assigned_admin_id = assignedAdminId || null;
        ticket.assigned_at = assignedAdminId ? new Date().toISOString() : null;
        ticket.updated_at = new Date().toISOString();

        await this.insertAuditLog({
            user_id: actorId,
            action: 'SUPPORT_TICKET_ASSIGNED',
            entity_type: 'nexus_support_tickets',
            entity_id: ticket.ticket_number,
            actor_id: actorId,
            new_values: { assigned_admin_id: assignedAdminId }
        });

        return ticket;
    }

    async reopenSupportTicket(id, actorId, reason) {
        const ticket = this.supportTickets.find(t => t.id === id);
        if (!ticket) return null;
        ticket.status = 'open';
        ticket.reopened_at = new Date().toISOString();
        ticket.reopened_by = actorId;
        ticket.reopen_reason = reason || 'Reopened';
        ticket.resolved_at = null;
        ticket.closed_at = null;
        ticket.updated_at = new Date().toISOString();

        await this.insertAuditLog({
            user_id: actorId,
            action: 'SUPPORT_TICKET_REOPENED',
            entity_type: 'nexus_support_tickets',
            entity_id: ticket.ticket_number,
            actor_id: actorId,
            new_values: { status: 'open', reason }
        });

        return ticket;
    }

    async getSupportStats() {
        const total = this.supportTickets.length;
        const open = this.supportTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
        const waiting = this.supportTickets.filter(t => t.status === 'waiting_for_member' || t.status === 'waiting_for_admin').length;
        const urgent = this.supportTickets.filter(t => t.priority === 'urgent' && !['resolved', 'closed', 'cancelled'].includes(t.status)).length;

        const now = new Date();
        const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
        const resolvedToday = this.supportTickets.filter(t => t.resolved_at && t.resolved_at >= startOfDay).length;

        const responded = this.supportTickets.filter(t => t.first_response_at && t.created_at);
        let avgResponseMin = 0;
        if (responded.length > 0) {
            const sumMs = responded.reduce((acc, t) => acc + (new Date(t.first_response_at) - new Date(t.created_at)), 0);
            avgResponseMin = Math.round((sumMs / responded.length) / 60000);
        }

        return {
            totalTickets: total,
            openTickets: open,
            waitingTickets: waiting,
            urgentTickets: urgent,
            resolvedToday: resolvedToday,
            avgResponseMinutes: avgResponseMin
        };
    }

    // =========================================================================
    // Member Compliance & Verification Operations (KYC Pipeline)
    // =========================================================================
    async updateMemberVerification(userId, { verification_status, kyc_status, verified_by, verification_notes, id_document_url, address_document_url }) {
        const profile = await this.findProfileByUserId(userId);
        if (!profile) return null;
        if (verification_status) {
            profile.verification_status = verification_status;
            profile.kyc_status = kyc_status || (verification_status === 'verified' ? 'approved' : verification_status);
        } else if (kyc_status) {
            profile.kyc_status = kyc_status;
        }
        if (verified_by !== undefined) profile.verified_by = verified_by;
        if (verification_notes !== undefined) profile.verification_notes = verification_notes;
        if (id_document_url !== undefined) profile.id_document_url = id_document_url;
        if (address_document_url !== undefined) profile.address_document_url = address_document_url;
        profile.verification_updated_at = new Date().toISOString();
        if (verification_status === 'verified' || kyc_status === 'approved') {
            profile.verified_at = new Date().toISOString();
        }
        profile.updated_at = new Date().toISOString();

        await this.insertAuditLog({
            user_id: userId,
            action: 'MEMBER_VERIFICATION_STATUS_CHANGED',
            entity_type: 'nexus_member_profiles',
            entity_id: profile.member_id,
            actor_id: verified_by || userId,
            new_values: { verification_status, kyc_status: profile.kyc_status }
        });

        return profile;
    }

    async getMemberProfile(userId) {
        return this.findProfileByUserId(userId);
    }

    async getMemberVerification(userId) {
        const profile = await this.findProfileByUserId(userId);
        if (!profile) return null;
        return {
            userId: profile.user_id,
            memberId: profile.member_id,
            fullName: profile.full_name,
            verificationStatus: profile.verification_status || 'unverified',
            verifiedAt: profile.verified_at || null,
            verifiedBy: profile.verified_by || null,
            verificationNotes: profile.verification_notes || null,
            idDocumentUrl: profile.id_document_url || null,
            addressDocumentUrl: profile.address_document_url || null,
            updatedAt: profile.verification_updated_at || profile.updated_at
        };
    }

    // =========================================================================
    // KYC / Member Verification & Compliance Operations (Prompt 18)
    // =========================================================================
    generateNextKycSubmissionNumber() {
        const seq = String(this.kycSubmissionCounter++).padStart(6, '0');
        return `NP-KYC-${seq}`;
    }

    seedKycRequirements() {
        this.kycRequirements = [
            {
                id: 'req-basic-id',
                version: 1,
                verification_level: 'basic',
                country_code: 'ALL',
                document_type: 'national_id',
                title: 'Government Identity Document',
                description: 'National Identity Card (NIC), Valid Passport, or Driving License',
                is_required: true,
                front_required: true,
                back_required: true,
                expiry_required: false,
                display_order: 1,
                enabled: true
            },
            {
                id: 'req-basic-address',
                version: 1,
                verification_level: 'basic',
                country_code: 'ALL',
                document_type: 'proof_of_address',
                title: 'Proof of Residential Address',
                description: 'Utility bill, bank statement, or tenancy agreement issued within last 3 months',
                is_required: true,
                front_required: true,
                back_required: false,
                expiry_required: false,
                display_order: 2,
                enabled: true
            },
            {
                id: 'req-enhanced-tax',
                version: 1,
                verification_level: 'enhanced',
                country_code: 'ALL',
                document_type: 'other',
                title: 'Tax / Business Registration Identification',
                description: 'TIN certificate or business registration document for high-volume leaders',
                is_required: false,
                front_required: true,
                back_required: false,
                expiry_required: false,
                display_order: 3,
                enabled: true
            }
        ];
    }

    async getKycRequirements(level = 'basic', countryCode = 'ALL') {
        return this.kycRequirements.filter(r => 
            r.enabled && 
            (r.verification_level === level || r.verification_level === 'basic') &&
            (r.country_code === 'ALL' || r.country_code === countryCode)
        ).sort((a, b) => a.display_order - b.display_order);
    }

    async createKycSubmission(data) {
        this.kycSubmissions.unshift(data);
        return data;
    }

    async getKycSubmissionById(id) {
        if (!id) return null;
        return this.kycSubmissions.find(s => s.id === id) || null;
    }

    async getKycSubmissionsByMemberId(memberId) {
        if (!memberId) return [];
        return this.kycSubmissions.filter(s => s.member_id === memberId)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    async getKycSubmissions({ status = null, level = null, search = null, limit = 50, offset = 0 } = {}) {
        let list = [...this.kycSubmissions];
        if (status && status !== 'all') {
            list = list.filter(s => s.status === status);
        }
        if (level && level !== 'all') {
            list = list.filter(s => s.verification_level === level);
        }
        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(s => 
                s.submission_number.toLowerCase().includes(q) ||
                s.legal_name.toLowerCase().includes(q) ||
                s.member_id.toLowerCase().includes(q)
            );
        }
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const total = list.length;
        return {
            total,
            limit,
            offset,
            submissions: list.slice(offset, offset + limit)
        };
    }

    async createKycDocument(data) {
        this.kycDocuments.push(data);
        return data;
    }

    async getKycDocumentById(id) {
        if (!id) return null;
        return this.kycDocuments.find(d => d.id === id) || null;
    }

    async getKycDocumentsBySubmissionId(submissionId) {
        if (!submissionId) return [];
        return this.kycDocuments.filter(d => d.submission_id === submissionId);
    }

    async getKycDocuments(submissionId) {
        return this.getKycDocumentsBySubmissionId(submissionId);
    }

    async addKycReviewEvent(event) {
        this.kycReviewEvents.push(event);
        return event;
    }

    async getKycReviewEvents(submissionId) {
        return this.kycReviewEvents.filter(e => e.submission_id === submissionId)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    async logKycDocumentAccess(log) {
        this.kycDocumentAccessLogs.push(log);
        return log;
    }


    // Member Activity Feed Operations
    async insertMemberActivity({ userId, action, description, icon = '📌' }) {
        const activity = {
            id: 'act-' + crypto.randomBytes(8).toString('hex'),
            user_id: userId,
            action: action,
            description: description,
            icon: icon,
            created_at: new Date().toISOString()
        };
        this.memberActivities.push(activity);
        return activity;
    }

    async getMemberActivities(userId, limit = 20) {
        const list = this.memberActivities.filter(a => a.user_id === userId);
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return list.slice(0, limit);
    }

    // Wallet Foundation Operations
    async getWallet(userId) {
        let wallet = this.walletFoundation.find(w => w.user_id === userId);
        if (!wallet) {
            wallet = {
                user_id: userId,
                available_balance: 0.00,
                pending_balance: 0.00,
                total_withdrawn: 0.00,
                total_earned: 0.00,
                updated_at: new Date().toISOString()
            };
            this.walletFoundation.push(wallet);
        }
        return wallet;
    }

    async createNotification(data) {
        return this.insertNotification(data);
    }

    // Audit Log Operations
    async insertAuditLog(log) {
        const entry = {
            id: 'audit-' + crypto.randomBytes(8).toString('hex'),
            user_id: log.user_id || log.actor_id || null,
            actor_id: log.actor_id || log.user_id || null,
            actor_type: log.actor_type || (log.actor_id === 'admin' ? 'admin' : (log.user_id ? 'member' : 'admin')),
            action: log.action || log.event_type,
            event_type: log.event_type || log.action,
            entity_type: log.entity_type,
            entity_id: log.entity_id || null,
            old_values: log.old_values ? (typeof log.old_values === 'string' ? log.old_values : JSON.stringify(log.old_values)) : null,
            new_values: log.new_values ? (typeof log.new_values === 'string' ? log.new_values : JSON.stringify(log.new_values)) : null,
            payload: log.payload || log.metadata || {},
            metadata: log.metadata || log.payload || {},
            ip_address: log.ip_address || '127.0.0.1',
            user_agent: log.user_agent || null,
            created_at: new Date().toISOString()
        };
        this.auditLogs.push(entry);
        return entry;
    }

    // Admin Operations
    async getAdminStats() {
        const totalMembers = this.memberProfiles.length;
        const activeMembers = this.memberProfiles.filter(p => p.status === 'active').length;
        const pendingMembers = this.memberProfiles.filter(p => p.status === 'pending').length;
        const suspendedMembers = this.memberProfiles.filter(p => p.status === 'suspended').length;
        const inactiveMembers = this.memberProfiles.filter(p => p.status === 'inactive').length;
        const totalDirectReferrals = this.memberProfiles.filter(p => p.sponsor_id !== null).length;
        const totalNetworkEdges = this.networkClosure.filter(c => c.depth_distance > 0).length;

        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

        const newRegistrations24h = this.memberProfiles.filter(p => new Date(p.registration_date).getTime() >= oneDayAgo).length;
        const newRegistrations7d = this.memberProfiles.filter(p => new Date(p.registration_date).getTime() >= sevenDaysAgo).length;

        const recentRegistrations = [...this.memberProfiles]
            .sort((a, b) => new Date(b.registration_date) - new Date(a.registration_date))
            .slice(0, 5)
            .map(p => {
                const sponsor = p.sponsor_id ? this.memberProfiles.find(sp => sp.user_id === p.sponsor_id) : null;
                return {
                    memberId: p.member_id,
                    fullName: p.full_name,
                    email: (() => {
                        const u = this.users.find(usr => usr.id === p.user_id);
                        return u ? u.email : '';
                    })(),
                    sponsorCode: sponsor ? sponsor.referral_code : 'ROOT',
                    sponsorName: sponsor ? sponsor.full_name : 'Nexus Corporate',
                    status: p.status,
                    registrationDate: p.registration_date
                };
            });

        const recentActivities = [...this.auditLogs]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 8)
            .map(log => {
                const actor = this.memberProfiles.find(p => p.user_id === log.user_id);
                return {
                    id: log.id,
                    action: log.action,
                    actorName: actor ? actor.full_name : 'System Administrator',
                    actorMemberId: actor ? actor.member_id : 'NP000001',
                    entityType: log.entity_type,
                    entityId: log.entity_id,
                    createdAt: log.created_at
                };
            });

        return {
            totalMembers,
            activeMembers,
            pendingMembers,
            suspendedMembers,
            inactiveMembers,
            totalDirectReferrals,
            totalNetworkMembers: totalMembers,
            totalNetworkEdges,
            newRegistrations24h,
            newRegistrations7d,
            recentRegistrations,
            recentActivities,
            totalVolume: 45000,
            pendingSlips: 1,
            financials: {
                isAvailable: false,
                badge: 'Coming Soon',
                phase: 'Phase 2',
                notice: 'Financial wallet ledger and commission processing will be activated in Phase 2.'
            },
            systemStatus: {
                environment: 'Isolated Nexus Prime Environment',
                database: 'Healthy (Operational)',
                uptimeSeconds: Math.floor(process.uptime()),
                domain: NexusConfig.DOMAIN
            }
        };
    }

    async getAllMembers() {
        return this.memberProfiles.map(p => {
            const roles = this.userRoles.filter(r => r.user_id === p.user_id).map(r => {
                const roleObj = this.roles.find(ro => ro.id === r.role_id);
                return roleObj ? roleObj.name : 'member';
            });
            const sponsor = p.sponsor_id ? this.memberProfiles.find(sp => sp.user_id === p.sponsor_id) : null;
            return {
                memberId: p.member_id,
                fullName: p.full_name,
                referralCode: p.referral_code,
                sponsorCode: sponsor ? sponsor.referral_code : 'ROOT',
                role: roles.includes('super_admin') ? 'SUPER ADMIN' : (roles.includes('admin') ? 'ADMIN' : 'MEMBER'),
                status: p.status,
                registrationDate: p.registration_date
            };
        });
    }

    async getMembersDirectory(options = {}) {
        const page = Math.max(1, parseInt(options.page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(options.limit, 10) || 10));
        const search = (options.search || '').trim().toLowerCase();
        const statusFilter = (options.status || 'all').toLowerCase();
        const roleFilter = (options.role || 'all').toLowerCase();

        let filtered = this.memberProfiles.map(p => {
            const user = this.users.find(u => u.id === p.user_id);
            const userRoleIds = this.userRoles.filter(ur => ur.user_id === p.user_id).map(ur => ur.role_id);
            const roleNames = this.roles.filter(r => userRoleIds.includes(r.id)).map(r => r.name);
            const sponsor = p.sponsor_id ? this.memberProfiles.find(sp => sp.user_id === p.sponsor_id) : null;
            const directCount = this.memberProfiles.filter(d => d.sponsor_id === p.user_id).length;
            const networkDescendants = this.networkClosure.filter(c => c.ancestor_id === p.user_id && c.depth_distance > 0).length;

            const primaryRole = roleNames.includes('super_admin') 
                ? 'SUPER ADMIN' 
                : (roleNames.includes('admin') ? 'ADMIN' : 'MEMBER');

            return {
                userId: p.user_id,
                memberId: p.member_id,
                fullName: p.full_name,
                displayName: p.display_name || p.full_name,
                email: user ? user.email : '',
                phone: p.phone || '',
                referralCode: p.referral_code,
                sponsorId: p.sponsor_id,
                sponsorCode: sponsor ? sponsor.referral_code : 'ROOT',
                sponsorName: sponsor ? sponsor.full_name : 'Nexus Prime Corporate',
                role: primaryRole,
                roles: roleNames,
                status: p.status,
                rank: p.rank || 'MEMBER',
                packageStatus: p.package_status || 'STANDARD',
                registrationDate: p.registration_date,
                profileImageUrl: p.profile_image_url || null,
                directTeamCount: directCount,
                totalTeamCount: networkDescendants
            };
        });

        // Search Filter (Member ID, Name, Display Name, Email, Phone, Referral Code)
        if (search) {
            filtered = filtered.filter(m =>
                m.memberId.toLowerCase().includes(search) ||
                m.fullName.toLowerCase().includes(search) ||
                m.displayName.toLowerCase().includes(search) ||
                m.email.toLowerCase().includes(search) ||
                m.phone.toLowerCase().includes(search) ||
                m.referralCode.toLowerCase().includes(search)
            );
        }

        // Status Filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(m => m.status.toLowerCase() === statusFilter);
        }

        // Role Filter
        if (roleFilter !== 'all') {
            filtered = filtered.filter(m => m.roles.includes(roleFilter));
        }

        // Sort by registrationDate descending
        filtered.sort((a, b) => new Date(b.registrationDate) - new Date(a.registrationDate));

        const total = filtered.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const paginatedMembers = filtered.slice(startIndex, startIndex + limit);

        return {
            total,
            page,
            limit,
            totalPages,
            members: paginatedMembers
        };
    }

    async getMemberFullDetails(identifier) {
        if (!identifier) return null;
        let profile = this.memberProfiles.find(p => p.user_id === identifier || p.member_id.toUpperCase() === identifier.toUpperCase() || p.referral_code.toUpperCase() === identifier.toUpperCase());
        if (!profile) return null;

        const user = this.users.find(u => u.id === profile.user_id);
        const userRoleIds = this.userRoles.filter(ur => ur.user_id === profile.user_id).map(ur => ur.role_id);
        const roleNames = this.roles.filter(r => userRoleIds.includes(r.id)).map(r => r.name);
        const primaryRole = roleNames.includes('super_admin') ? 'SUPER ADMIN' : (roleNames.includes('admin') ? 'ADMIN' : 'MEMBER');

        // Sponsor details
        const sponsorProfile = profile.sponsor_id ? this.memberProfiles.find(sp => sp.user_id === profile.sponsor_id) : null;
        const sponsorUser = sponsorProfile ? this.users.find(u => u.id === sponsorProfile.user_id) : null;

        // Upline Ancestry Chain
        const uplineEdges = this.networkClosure
            .filter(c => c.descendant_id === profile.user_id && c.depth_distance > 0)
            .sort((a, b) => a.depth_distance - b.depth_distance);

        const uplineChain = uplineEdges.map(edge => {
            const ancestorProfile = this.memberProfiles.find(ap => ap.user_id === edge.ancestor_id);
            return {
                level: edge.depth_distance,
                userId: edge.ancestor_id,
                memberId: ancestorProfile ? ancestorProfile.member_id : 'NP000001',
                name: ancestorProfile ? ancestorProfile.full_name : 'Nexus Corporate',
                referralCode: ancestorProfile ? ancestorProfile.referral_code : 'NEXUS001',
                status: ancestorProfile ? ancestorProfile.status : 'active'
            };
        });

        // Direct Team Recruits
        const directRecruits = this.memberProfiles
            .filter(d => d.sponsor_id === profile.user_id)
            .map(d => {
                const dUser = this.users.find(u => u.id === d.user_id);
                return {
                    userId: d.user_id,
                    memberId: d.member_id,
                    fullName: d.full_name,
                    email: dUser ? dUser.email : '',
                    referralCode: d.referral_code,
                    status: d.status,
                    rank: d.rank || 'MEMBER',
                    registrationDate: d.registration_date
                };
            });

        // Complete Downline Summary
        const downlineEdges = this.networkClosure.filter(c => c.ancestor_id === profile.user_id && c.depth_distance > 0);
        const downlineUserIds = new Set(downlineEdges.map(e => e.descendant_id));
        const downlineProfiles = this.memberProfiles.filter(p => downlineUserIds.has(p.user_id));

        const downlineSummary = {
            total: downlineProfiles.length,
            active: downlineProfiles.filter(p => p.status === 'active').length,
            pending: downlineProfiles.filter(p => p.status === 'pending').length,
            suspended: downlineProfiles.filter(p => p.status === 'suspended').length,
            inactive: downlineProfiles.filter(p => p.status === 'inactive').length
        };

        // Member Activities & Audit Trail
        const memberActs = this.memberActivities
            .filter(a => a.user_id === profile.user_id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 10);

        const auditTrail = this.auditLogs
            .filter(log => log.entity_id === profile.user_id || log.user_id === profile.user_id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 10);

        return {
            account: {
                userId: profile.user_id,
                memberId: profile.member_id,
                fullName: profile.full_name,
                displayName: profile.display_name || profile.full_name,
                email: user ? user.email : '',
                phone: profile.phone || '',
                status: profile.status,
                role: primaryRole,
                roles: roleNames,
                registrationDate: profile.registration_date,
                lastLoginAt: user ? user.last_login_at : null,
                lastLoginIp: user ? user.last_login_ip : null
            },
            referral: {
                referralCode: profile.referral_code,
                referralUrl: `https://${NexusConfig.DOMAIN}/register?ref=${profile.referral_code}`,
                sponsor: sponsorProfile ? {
                    userId: sponsorProfile.user_id,
                    memberId: sponsorProfile.member_id,
                    fullName: sponsorProfile.full_name,
                    referralCode: sponsorProfile.referral_code,
                    phone: sponsorProfile.phone || '',
                    email: sponsorUser ? sponsorUser.email : ''
                } : {
                    isCorporate: true,
                    memberId: 'NP000001',
                    fullName: 'Nexus Prime Corporate Administrator',
                    referralCode: 'NEXUS001'
                },
                directReferralsCount: directRecruits.length,
                totalNetworkCount: downlineSummary.total
            },
            network: {
                uplineChain,
                directTeam: directRecruits,
                downlineSummary
            },
            profile: {
                address: profile.address || '',
                country: profile.country || 'Sri Lanka',
                profileImageUrl: profile.profile_image_url || null,
                rank: profile.rank || 'MEMBER',
                packageStatus: profile.package_status || 'STANDARD'
            },
            activities: memberActs,
            auditTrail
        };
    }

    async updateMemberStatus(targetUserId, newStatus, reason = '', adminContext = {}) {
        const allowedStatuses = ['active', 'pending', 'suspended', 'inactive'];
        const normalizedStatus = String(newStatus).toLowerCase();
        if (!allowedStatuses.includes(normalizedStatus)) {
            return { success: false, error: `Invalid status '${newStatus}'. Allowed: ${allowedStatuses.join(', ')}` };
        }

        const profile = this.memberProfiles.find(p => p.user_id === targetUserId || p.member_id.toUpperCase() === String(targetUserId).toUpperCase());
        if (!profile) {
            return { success: false, error: 'Member not found.' };
        }

        // Safeguard: Corporate Root Account NP000001 cannot be suspended or deactivated
        if (profile.member_id === NexusConfig.DEFAULT_ROOT_MEMBER_ID || profile.user_id === '00000000-0000-4000-8000-000000000001') {
            return { success: false, error: 'Root Corporate Administrator account status cannot be modified.' };
        }

        const prevStatus = profile.status;
        if (prevStatus === normalizedStatus) {
            return { success: true, memberId: profile.member_id, previousStatus: prevStatus, newStatus: normalizedStatus, message: 'Status is already set to target value.' };
        }

        // Apply mutation
        const now = new Date().toISOString();
        profile.status = normalizedStatus;
        if (normalizedStatus === 'active') profile.activated_at = profile.activated_at || now;
        if (normalizedStatus === 'suspended') profile.suspended_at = now;
        if (normalizedStatus === 'inactive') profile.deactivated_at = now;
        profile.updated_at = now;

        const user = this.users.find(u => u.id === profile.user_id);
        if (user) {
            user.status = normalizedStatus;
            user.updated_at = now;
        }

        // Append-Only Audit Log
        await this.insertAuditLog({
            user_id: adminContext.userId || 'admin-root',
            action: 'MEMBER_STATUS_UPDATED',
            entity_type: 'MEMBER',
            entity_id: profile.user_id,
            old_values: { status: prevStatus },
            new_values: { status: normalizedStatus, reason: reason || 'Administrative review' },
            ip_address: adminContext.ip || '127.0.0.1',
            user_agent: adminContext.userAgent || 'Nexus Admin Command Center'
        });

        // User-facing Activity Entry
        await this.insertMemberActivity(
            profile.user_id,
            'STATUS_UPDATED',
            `Account status updated to ${normalizedStatus.toUpperCase()}${reason ? ' (' + reason + ')' : ''}.`,
            normalizedStatus === 'active' ? '✅' : (normalizedStatus === 'suspended' ? '⚠️' : 'ℹ️')
        );

        // In-App Notification to Member
        await this.insertNotification(
            profile.user_id,
            'Account Status Notice',
            `Your account status has been updated to ${normalizedStatus.toUpperCase()}.${reason ? ' Reason: ' + reason : ''}`,
            'system'
        );

        return {
            success: true,
            memberId: profile.member_id,
            previousStatus: prevStatus,
            newStatus: normalizedStatus,
            updatedAt: now
        };
    }

    async getAuditLogs(options = {}) {
        const page = Math.max(1, parseInt(options.page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(options.limit, 10) || 20));
        const actionFilter = (options.action || options.event_type || 'all').toUpperCase();
        const search = (options.search || '').trim().toLowerCase();

        let filtered = [...this.auditLogs];

        if (actionFilter !== 'ALL') {
            filtered = filtered.filter(l => (l.action && l.action.toUpperCase() === actionFilter) || (l.event_type && l.event_type.toUpperCase() === actionFilter));
        }

        if (search) {
            filtered = filtered.filter(l =>
                l.action.toLowerCase().includes(search) ||
                (l.entity_type && l.entity_type.toLowerCase().includes(search)) ||
                (l.entity_id && l.entity_id.toLowerCase().includes(search)) ||
                (l.ip_address && l.ip_address.includes(search))
            );
        }

        // Sort descending
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const total = filtered.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const logs = filtered.slice(startIndex, startIndex + limit).map(entry => {
            const actorProfile = entry.user_id ? this.memberProfiles.find(p => p.user_id === entry.user_id) : null;
            return {
                id: entry.id,
                actorUserId: entry.user_id,
                actorMemberId: actorProfile ? actorProfile.member_id : 'NP000001',
                actorName: actorProfile ? actorProfile.full_name : 'Root Administrator',
                action: entry.action,
                event_type: entry.event_type || entry.action,
                actor_type: entry.actor_type || 'admin',
                entityType: entry.entity_type,
                entityId: entry.entity_id,
                oldValues: entry.old_values ? JSON.parse(entry.old_values) : null,
                newValues: entry.new_values ? JSON.parse(entry.new_values) : null,
                metadata: entry.metadata || entry.payload || {},
                payload: entry.payload || entry.metadata || {},
                ipAddress: entry.ip_address,
                userAgent: entry.user_agent,
                createdAt: entry.created_at
            };
        });

        return {
            total,
            page,
            limit,
            totalPages,
            logs
        };
    }

    async getAllReferralPairs(options = {}) {
        const page = Math.max(1, parseInt(options.page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(options.limit, 10) || 10));
        const search = (options.search || '').trim().toLowerCase();
        const statusFilter = (options.status || 'all').toLowerCase();

        let pairs = this.memberProfiles
            .filter(p => p.sponsor_id !== null)
            .map(member => {
                const sponsor = this.memberProfiles.find(sp => sp.user_id === member.sponsor_id);
                const user = this.users.find(u => u.id === member.user_id);
                return {
                    referrerMemberId: sponsor ? sponsor.member_id : 'NP000001',
                    referrerName: sponsor ? sponsor.full_name : 'Nexus Corporate',
                    referrerReferralCode: sponsor ? sponsor.referral_code : 'NEXUS001',
                    referrerStatus: sponsor ? sponsor.status : 'active',
                    referredMemberId: member.member_id,
                    referredName: member.full_name,
                    referredEmail: user ? user.email : '',
                    referredReferralCode: member.referral_code,
                    referredStatus: member.status,
                    registrationDate: member.registration_date,
                    relationshipStatus: (sponsor && sponsor.status === 'active' && member.status === 'active') ? 'ACTIVE' : 'INACTIVE'
                };
            });

        if (search) {
            pairs = pairs.filter(p =>
                p.referrerMemberId.toLowerCase().includes(search) ||
                p.referrerName.toLowerCase().includes(search) ||
                p.referrerReferralCode.toLowerCase().includes(search) ||
                p.referredMemberId.toLowerCase().includes(search) ||
                p.referredName.toLowerCase().includes(search) ||
                p.referredEmail.toLowerCase().includes(search) ||
                p.referredReferralCode.toLowerCase().includes(search)
            );
        }

        if (statusFilter !== 'all') {
            pairs = pairs.filter(p => p.relationshipStatus.toLowerCase() === statusFilter || p.referredStatus.toLowerCase() === statusFilter);
        }

        pairs.sort((a, b) => new Date(b.registrationDate) - new Date(a.registrationDate));

        const total = pairs.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;

        return {
            total,
            page,
            limit,
            totalPages,
            referrals: pairs.slice(startIndex, startIndex + limit)
        };
    }

    getSetting(key) {
        if (!this.settings) return null;
        return this.settings.get(key) || null;
    }

    setSetting(key, value) {
        if (!this.settings) this.settings = new Map();
        this.settings.set(key, String(value));
    }

    async updateSetting(key, value) {
        return this.setSetting(key, value);
    }

    async getPlatformSettings() {
        const settingsObj = {};
        for (const [key, value] of this.settings.entries()) {
            settingsObj[key] = value;
        }
        return {
            companyName: settingsObj.company_name || NexusConfig.COMPANY_NAME,
            domain: settingsObj.domain || NexusConfig.DOMAIN,
            applicationUrl: NexusConfig.APPLICATION_URL,
            defaultRootReferralCode: settingsObj.default_root_referral_code || NexusConfig.DEFAULT_ROOT_REFERRAL_CODE,
            allowOrphanRegistration: settingsObj.allow_orphan_registration === 'true',
            minWithdrawalAmountLkr: parseFloat(settingsObj.min_withdrawal_amount) || NexusConfig.MIN_WITHDRAWAL_AMOUNT_LKR,
            reportingTimezone: settingsObj.reporting_timezone || 'Asia/Colombo',
            maxNetworkLevels: NexusConfig.MAX_NETWORK_LEVELS,
            supportEmail: 'support@nexusp.online',
            supportPhone: '+94112000000',
            environment: 'Production-Isolated Nexus Prime'
        };
    }

    async updatePlatformSettings(newSettings = {}, adminContext = {}) {
        const allowedKeys = ['companyName', 'supportEmail', 'supportPhone', 'allowOrphanRegistration', 'minWithdrawalAmountLkr', 'reportingTimezone'];
        const oldSettings = await this.getPlatformSettings();
        const mutatedKeys = [];

        if (newSettings.companyName && typeof newSettings.companyName === 'string') {
            this.settings.set('company_name', newSettings.companyName.trim());
            mutatedKeys.push('companyName');
        }
        if (newSettings.allowOrphanRegistration !== undefined) {
            this.settings.set('allow_orphan_registration', String(!!newSettings.allowOrphanRegistration));
            mutatedKeys.push('allowOrphanRegistration');
        }
        if (newSettings.minWithdrawalAmountLkr !== undefined) {
            const amount = parseFloat(newSettings.minWithdrawalAmountLkr);
            if (!isNaN(amount) && amount >= 0) {
                this.settings.set('min_withdrawal_amount', String(amount));
                mutatedKeys.push('minWithdrawalAmountLkr');
            }
        }
        if (newSettings.reportingTimezone && typeof newSettings.reportingTimezone === 'string') {
            this.settings.set('reporting_timezone', newSettings.reportingTimezone.trim());
            mutatedKeys.push('reportingTimezone');
        }

        const updatedSettings = await this.getPlatformSettings();

        // Audit Log
        await this.insertAuditLog({
            user_id: adminContext.userId || 'admin-root',
            action: 'PLATFORM_SETTINGS_UPDATED',
            entity_type: 'SYSTEM_SETTING',
            entity_id: 'GLOBAL',
            old_values: oldSettings,
            new_values: updatedSettings,
            ip_address: adminContext.ip || '127.0.0.1',
            user_agent: adminContext.userAgent || 'Nexus Admin Panel'
        });

        return {
            success: true,
            mutatedKeys,
            settings: updatedSettings
        };
    }

    // =========================================================================
    // PACKAGES REPOSITORY METHODS
    // =========================================================================
    async getAllPackages({ status, featured, search } = {}) {
        let results = [...this.packages];

        if (status && status !== 'all') {
            results = results.filter(p => p.status === status);
        }

        if (featured !== undefined) {
            const isFeatured = featured === true || featured === 'true';
            results = results.filter(p => p.featured === isFeatured);
        }

        if (search && typeof search === 'string' && search.trim()) {
            const q = search.trim().toLowerCase();
            results = results.filter(p =>
                (p.name && p.name.toLowerCase().includes(q)) ||
                (p.package_code && p.package_code.toLowerCase().includes(q)) ||
                (p.short_description && p.short_description.toLowerCase().includes(q))
            );
        }

        results.sort((a, b) => {
            if (a.display_order !== b.display_order) {
                return (a.display_order || 99) - (b.display_order || 99);
            }
            return (a.price || 0) - (b.price || 0);
        });

        // Enrich with features and included products
        return results.map(pkg => ({
            ...pkg,
            features: this.getPackageFeaturesSync(pkg.id),
            included_products: this.getPackageProductsSync(pkg.id)
        }));
    }

    getPackageFeaturesSync(packageId) {
        return this.packageFeatures
            .filter(f => f.package_id === packageId)
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
            .map(f => f.feature_text);
    }

    getPackageProductsSync(packageId) {
        const mappings = this.packageProducts.filter(pp => pp.package_id === packageId);
        return mappings.map(m => {
            const prod = this.products.find(p => p.id === m.product_id);
            return prod ? { id: prod.id, name: prod.name, sku: prod.sku, slug: prod.slug, price: prod.price } : null;
        }).filter(Boolean);
    }

    async getPackageById(id) {
        const pkg = this.packages.find(p => p.id === id);
        if (!pkg) return null;
        return {
            ...pkg,
            features: this.getPackageFeaturesSync(pkg.id),
            included_products: this.getPackageProductsSync(pkg.id)
        };
    }

    async getPackageByCode(code) {
        if (!code) return null;
        const normalized = code.trim().toLowerCase();
        const pkg = this.packages.find(p => p.package_code.toLowerCase() === normalized);
        if (!pkg) return null;
        return {
            ...pkg,
            features: this.getPackageFeaturesSync(pkg.id),
            included_products: this.getPackageProductsSync(pkg.id)
        };
    }

    async getPackageBySlug(slug) {
        if (!slug) return null;
        const normalized = slug.trim().toLowerCase();
        const pkg = this.packages.find(p => p.slug.toLowerCase() === normalized);
        if (!pkg) return null;
        return {
            ...pkg,
            features: this.getPackageFeaturesSync(pkg.id),
            included_products: this.getPackageProductsSync(pkg.id)
        };
    }

    async insertPackage(data) {
        const now = new Date().toISOString();
        const id = data.id || `pkg-${crypto.randomUUID().slice(0, 8)}`;
        const newPkg = {
            id,
            name: data.name.trim(),
            package_code: data.package_code.trim().toUpperCase(),
            slug: data.slug.trim().toLowerCase(),
            short_description: data.short_description ? data.short_description.trim() : '',
            full_description: data.full_description ? data.full_description.trim() : '',
            price: parseFloat(data.price) || 0,
            currency: data.currency || 'LKR',
            status: data.status || 'draft',
            display_order: parseInt(data.display_order, 10) || (this.packages.length + 1),
            featured: !!data.featured,
            image_icon: data.image_icon || 'fas fa-box',
            created_at: now,
            updated_at: now
        };

        this.packages.push(newPkg);

        if (Array.isArray(data.features)) {
            this.replacePackageFeaturesSync(id, data.features);
        }

        if (Array.isArray(data.product_ids)) {
            this.setPackageProductsSync(id, data.product_ids);
        }

        return this.getPackageById(id);
    }

    async updatePackage(id, updates) {
        const index = this.packages.findIndex(p => p.id === id);
        if (index === -1) return null;

        const pkg = this.packages[index];
        const now = new Date().toISOString();

        if (updates.name !== undefined) pkg.name = updates.name.trim();
        if (updates.package_code !== undefined) pkg.package_code = updates.package_code.trim().toUpperCase();
        if (updates.slug !== undefined) pkg.slug = updates.slug.trim().toLowerCase();
        if (updates.short_description !== undefined) pkg.short_description = updates.short_description.trim();
        if (updates.full_description !== undefined) pkg.full_description = updates.full_description.trim();
        if (updates.price !== undefined) pkg.price = parseFloat(updates.price);
        if (updates.currency !== undefined) pkg.currency = updates.currency.trim().toUpperCase();
        if (updates.status !== undefined) pkg.status = updates.status;
        if (updates.display_order !== undefined) pkg.display_order = parseInt(updates.display_order, 10);
        if (updates.featured !== undefined) pkg.featured = !!updates.featured;
        if (updates.image_icon !== undefined) pkg.image_icon = updates.image_icon;
        pkg.updated_at = now;

        if (Array.isArray(updates.features)) {
            this.replacePackageFeaturesSync(id, updates.features);
        }

        if (Array.isArray(updates.product_ids)) {
            this.setPackageProductsSync(id, updates.product_ids);
        }

        return this.getPackageById(id);
    }

    replacePackageFeaturesSync(packageId, featuresArray) {
        this.packageFeatures = this.packageFeatures.filter(f => f.package_id !== packageId);
        featuresArray.forEach((text, idx) => {
            if (typeof text === 'string' && text.trim()) {
                this.packageFeatures.push({
                    id: `feat-${crypto.randomUUID().slice(0, 8)}`,
                    package_id: packageId,
                    feature_text: text.trim(),
                    display_order: idx + 1,
                    is_highlighted: false
                });
            }
        });
    }

    setPackageProductsSync(packageId, productIdsArray) {
        this.packageProducts = this.packageProducts.filter(pp => pp.package_id !== packageId);
        productIdsArray.forEach(prodId => {
            this.packageProducts.push({
                id: `pp-${crypto.randomUUID().slice(0, 8)}`,
                package_id: packageId,
                product_id: prodId
            });
        });
    }

    // =========================================================================
    // PRODUCT CATEGORIES REPOSITORY METHODS
    // =========================================================================
    async getAllCategories({ status, search } = {}) {
        let results = [...this.productCategories];
        if (status && status !== 'all') {
            results = results.filter(c => c.status === status);
        }
        if (search && typeof search === 'string' && search.trim()) {
            const q = search.trim().toLowerCase();
            results = results.filter(c => c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q)));
        }
        results.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

        return results.map(c => ({
            ...c,
            product_count: this.products.filter(p => p.category_id === c.id && p.status !== 'archived').length
        }));
    }

    async getCategoryById(id) {
        return this.productCategories.find(c => c.id === id) || null;
    }

    async getCategoryBySlug(slug) {
        if (!slug) return null;
        const normalized = slug.trim().toLowerCase();
        return this.productCategories.find(c => c.slug.toLowerCase() === normalized) || null;
    }

    async insertCategory(data) {
        const now = new Date().toISOString();
        const id = data.id || `cat-${crypto.randomUUID().slice(0, 8)}`;
        const cat = {
            id,
            name: data.name.trim(),
            slug: data.slug.trim().toLowerCase(),
            description: data.description ? data.description.trim() : '',
            status: data.status || 'active',
            display_order: parseInt(data.display_order, 10) || (this.productCategories.length + 1),
            created_at: now,
            updated_at: now
        };
        this.productCategories.push(cat);
        return cat;
    }

    async updateCategory(id, updates) {
        const cat = this.productCategories.find(c => c.id === id);
        if (!cat) return null;
        if (updates.name !== undefined) cat.name = updates.name.trim();
        if (updates.slug !== undefined) cat.slug = updates.slug.trim().toLowerCase();
        if (updates.description !== undefined) cat.description = updates.description.trim();
        if (updates.status !== undefined) cat.status = updates.status;
        if (updates.display_order !== undefined) cat.display_order = parseInt(updates.display_order, 10);
        cat.updated_at = new Date().toISOString();
        return cat;
    }

    // =========================================================================
    // PRODUCTS REPOSITORY METHODS
    // =========================================================================
    async getAllProducts({ categoryId, categorySlug, status, featured, search, page = 1, limit = 50 } = {}) {
        let results = [...this.products];

        if (categoryId) {
            results = results.filter(p => p.category_id === categoryId);
        }

        if (categorySlug) {
            const cat = this.productCategories.find(c => c.slug.toLowerCase() === categorySlug.toLowerCase());
            results = cat ? results.filter(p => p.category_id === cat.id) : [];
        }

        if (status && status !== 'all') {
            results = results.filter(p => p.status === status);
        }

        if (featured !== undefined) {
            const isFeatured = featured === true || featured === 'true';
            results = results.filter(p => p.featured === isFeatured);
        }

        if (search && typeof search === 'string' && search.trim()) {
            const q = search.trim().toLowerCase();
            results = results.filter(p =>
                (p.name && p.name.toLowerCase().includes(q)) ||
                (p.sku && p.sku.toLowerCase().includes(q)) ||
                (p.short_description && p.short_description.toLowerCase().includes(q))
            );
        }

        results.sort((a, b) => {
            if (a.display_order !== b.display_order) {
                return (a.display_order || 99) - (b.display_order || 99);
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        const total = results.length;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 50);
        const startIndex = (pageNum - 1) * limitNum;
        const paged = results.slice(startIndex, startIndex + limitNum);

        const enriched = paged.map(p => {
            const cat = this.productCategories.find(c => c.id === p.category_id);
            return {
                ...p,
                category_name: cat ? cat.name : 'General',
                category_slug: cat ? cat.slug : 'general'
            };
        });

        return {
            products: enriched,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1
        };
    }

    async getProductById(id) {
        const prod = this.products.find(p => p.id === id);
        if (!prod) return null;
        const cat = this.productCategories.find(c => c.id === prod.category_id);
        return {
            ...prod,
            category_name: cat ? cat.name : 'General',
            category_slug: cat ? cat.slug : 'general'
        };
    }

    async getProductBySku(sku) {
        if (!sku) return null;
        const normalized = sku.trim().toLowerCase();
        const prod = this.products.find(p => p.sku.toLowerCase() === normalized);
        if (!prod) return null;
        const cat = this.productCategories.find(c => c.id === prod.category_id);
        return {
            ...prod,
            category_name: cat ? cat.name : 'General',
            category_slug: cat ? cat.slug : 'general'
        };
    }

    async getProductBySlug(slug) {
        if (!slug) return null;
        const normalized = slug.trim().toLowerCase();
        const prod = this.products.find(p => p.slug.toLowerCase() === normalized);
        if (!prod) return null;
        const cat = this.productCategories.find(c => c.id === prod.category_id);
        return {
            ...prod,
            category_name: cat ? cat.name : 'General',
            category_slug: cat ? cat.slug : 'general'
        };
    }

    async insertProduct(data) {
        const now = new Date().toISOString();
        const id = data.id || `prod-${crypto.randomUUID().slice(0, 8)}`;
        const newProd = {
            id,
            name: data.name.trim(),
            sku: data.sku.trim().toUpperCase(),
            slug: data.slug.trim().toLowerCase(),
            category_id: data.category_id || (this.productCategories[0]?.id || null),
            short_description: data.short_description ? data.short_description.trim() : '',
            full_description: data.full_description ? data.full_description.trim() : '',
            price: parseFloat(data.price) || 0,
            currency: data.currency || 'LKR',
            stock_quantity: parseInt(data.stock_quantity, 10) >= 0 ? parseInt(data.stock_quantity, 10) : 9999,
            status: data.status || 'active',
            featured: !!data.featured,
            image_url: data.image_url || 'assets/nexus/images/product-default.png',
            display_order: parseInt(data.display_order, 10) || (this.products.length + 1),
            created_at: now,
            updated_at: now
        };
        this.products.push(newProd);
        return this.getProductById(id);
    }

    async updateProduct(id, updates) {
        const prod = this.products.find(p => p.id === id);
        if (!prod) return null;
        const now = new Date().toISOString();

        if (updates.name !== undefined) prod.name = updates.name.trim();
        if (updates.sku !== undefined) prod.sku = updates.sku.trim().toUpperCase();
        if (updates.slug !== undefined) prod.slug = updates.slug.trim().toLowerCase();
        if (updates.category_id !== undefined) prod.category_id = updates.category_id;
        if (updates.short_description !== undefined) prod.short_description = updates.short_description.trim();
        if (updates.full_description !== undefined) prod.full_description = updates.full_description.trim();
        if (updates.price !== undefined) prod.price = parseFloat(updates.price);
        if (updates.currency !== undefined) prod.currency = updates.currency.trim().toUpperCase();
        if (updates.stock_quantity !== undefined) prod.stock_quantity = parseInt(updates.stock_quantity, 10);
        if (updates.status !== undefined) prod.status = updates.status;
        if (updates.featured !== undefined) prod.featured = !!updates.featured;
        if (updates.image_url !== undefined) prod.image_url = updates.image_url;
        if (updates.display_order !== undefined) prod.display_order = parseInt(updates.display_order, 10);
        prod.updated_at = now;

        return this.getProductById(id);
    }

    // ==========================================================================
    // ORDERS & PURCHASES REPOSITORY
    // ==========================================================================

    generateNextOrderNumber() {
        const num = String(this.orderCounter++).padStart(6, '0');
        return `NP-ORD-${num}`;
    }

    generatePaymentReference() {
        return `NP-PAY-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    }

    async createOrder(orderData, itemsData = []) {
        const now = new Date().toISOString();
        const id = orderData.id || `ord-${crypto.randomUUID().slice(0, 8)}`;
        const orderNumber = orderData.order_number || this.generateNextOrderNumber();

        const newOrder = {
            id,
            order_number: orderNumber,
            user_id: orderData.user_id,
            order_type: orderData.order_type || 'package', // 'package' | 'product' | 'mixed'
            package_id: orderData.package_id || null,
            status: orderData.status || 'awaiting_payment', // 'pending' | 'awaiting_payment' | 'paid' | 'processing' | 'completed' | 'cancelled' | 'failed'
            payment_status: orderData.payment_status || (orderData.status === 'paid' ? 'paid' : 'pending'),
            subtotal: parseFloat(orderData.subtotal) || parseFloat(orderData.total_amount) || parseFloat(orderData.total) || 0,
            discount: parseFloat(orderData.discount) || 0,
            total: parseFloat(orderData.total !== undefined ? orderData.total : (orderData.total_amount || 0)) || 0,
            currency: orderData.currency || 'LKR',
            package_name_snapshot: orderData.package_name_snapshot || null,
            package_price_snapshot: orderData.package_price_snapshot !== undefined ? parseFloat(orderData.package_price_snapshot) : null,
            idempotency_key: orderData.idempotency_key || null,
            customer_notes: orderData.customer_notes || '',
            metadata: orderData.metadata || {},
            created_at: orderData.created_at || now,
            paid_at: orderData.paid_at || ((orderData.status === 'paid' || orderData.payment_status === 'paid') ? now : null),
            completed_at: orderData.completed_at || (orderData.status === 'completed' ? now : null),
            cancelled_at: orderData.cancelled_at || (orderData.status === 'cancelled' ? now : null),
            refunded_at: orderData.refunded_at || (orderData.status === 'refunded' ? now : null),
            updated_at: now
        };

        this.orders.push(newOrder);

        // Populate Order Items with Immutable Snapshots
        const savedItems = [];
        for (const item of itemsData) {
            const itemId = item.id || `item-${crypto.randomUUID().slice(0, 8)}`;
            const unitPrice = parseFloat(item.unit_price_snapshot !== undefined ? item.unit_price_snapshot : (item.price || item.unit_price || 0));
            const quantity = parseInt(item.quantity, 10) >= 1 ? parseInt(item.quantity, 10) : 1;
            const discount = parseFloat(item.discount_snapshot || item.discount || 0);
            const lineTotal = parseFloat(item.line_total_snapshot !== undefined ? item.line_total_snapshot : (unitPrice * quantity - discount));

            const newItem = {
                id: itemId,
                order_id: id,
                item_type: item.item_type || 'package',
                item_id: String(item.item_id || item.product_id || item.package_id || ''),
                item_name_snapshot: item.item_name_snapshot || item.name || 'Catalog Item',
                sku_or_code_snapshot: item.sku_or_code_snapshot || item.sku || item.package_code || 'N/A',
                quantity,
                unit_price_snapshot: unitPrice,
                discount_snapshot: discount,
                line_total_snapshot: lineTotal,
                currency: item.currency || newOrder.currency,
                created_at: now
            };
            this.orderItems.push(newItem);
            savedItems.push(newItem);
        }

        // Initialize Placeholder Payment Record
        const paymentId = `pay-${crypto.randomUUID().slice(0, 8)}`;
        const placeholderPayment = {
            id: paymentId,
            order_id: id,
            member_id: newOrder.user_id,
            provider: orderData.payment_provider || 'none',
            provider_payment_id: null,
            merchant_reference: this.generatePaymentReference(),
            amount: newOrder.total,
            currency: newOrder.currency,
            status: 'initiated',
            payment_method: null,
            initiated_at: now,
            verified_at: null,
            failed_at: null,
            raw_payload: {},
            created_at: now,
            updated_at: now
        };
        this.payments.push(placeholderPayment);

        return this.getOrderById(id);
    }

    async getOrderById(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return null;

        const items = this.orderItems.filter(i => i.order_id === order.id);
        const payments = this.payments.filter(p => p.order_id === order.id);
        const profile = await this.findProfileByUserId(order.user_id);
        const user = this.users.find(u => u.id === order.user_id);

        return {
            ...order,
            items,
            payments,
            payment: payments[payments.length - 1] || null,
            customer: profile ? {
                member_id: profile.member_id,
                full_name: profile.full_name,
                email: user ? user.email : '',
                phone: profile.phone || '',
                rank: profile.rank,
                package_status: profile.package_status
            } : null
        };
    }

    async getOrderByNumber(orderNumber) {
        if (!orderNumber) return null;
        const normalized = orderNumber.trim().toUpperCase();
        const order = this.orders.find(o => o.order_number.toUpperCase() === normalized);
        if (!order) return null;
        return this.getOrderById(order.id);
    }

    async getMemberOrders(userId, options = {}) {
        let results = this.orders.filter(o => o.user_id === userId);

        if (options.status) {
            results = results.filter(o => o.status === options.status);
        }
        if (options.order_type) {
            results = results.filter(o => o.order_type === options.order_type);
        }
        if (options.search) {
            const q = options.search.trim().toLowerCase();
            results = results.filter(o => 
                o.order_number.toLowerCase().includes(q) ||
                (o.package_name_snapshot && o.package_name_snapshot.toLowerCase().includes(q))
            );
        }

        results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const total = results.length;
        const page = parseInt(options.page, 10) || 1;
        const limit = parseInt(options.limit, 10) || 10;
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const pageOrders = results.slice(startIndex, startIndex + limit);

        const enrichedOrders = await Promise.all(pageOrders.map(o => this.getOrderById(o.id)));

        return {
            orders: enrichedOrders,
            pagination: { total, page, limit, totalPages }
        };
    }

    async getAllOrders(options = {}) {
        // KPI Summary calculation across all orders
        const summary = {
            totalOrders: this.orders.length,
            awaitingPaymentCount: this.orders.filter(o => o.status === 'awaiting_payment' || o.status === 'pending').length,
            processingCount: this.orders.filter(o => o.status === 'processing').length,
            completedCount: this.orders.filter(o => o.status === 'completed' || o.status === 'paid').length,
            cancelledCount: this.orders.filter(o => o.status === 'cancelled').length,
            totalVolumeLKR: this.orders.filter(o => o.status === 'completed' || o.status === 'paid')
                                      .reduce((sum, o) => sum + (o.total || 0), 0)
        };

        let results = [...this.orders];

        if (options.status) {
            results = results.filter(o => o.status === options.status);
        }
        if (options.order_type) {
            results = results.filter(o => o.order_type === options.order_type);
        }
        if (options.search) {
            const q = options.search.trim().toLowerCase();
            results = results.filter(o => {
                if (o.order_number.toLowerCase().includes(q)) return true;
                const prof = this.memberProfiles.find(p => p.user_id === o.user_id);
                if (prof && (prof.member_id.toLowerCase().includes(q) || prof.full_name.toLowerCase().includes(q))) return true;
                const usr = this.users.find(u => u.id === o.user_id);
                if (usr && usr.email.toLowerCase().includes(q)) return true;
                return false;
            });
        }

        results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const total = results.length;
        const page = parseInt(options.page, 10) || 1;
        const limit = parseInt(options.limit, 10) || 10;
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const pageOrders = results.slice(startIndex, startIndex + limit);

        const enrichedOrders = await Promise.all(pageOrders.map(o => this.getOrderById(o.id)));

        return {
            orders: enrichedOrders,
            pagination: { total, page, limit, totalPages },
            summary,
            stats: summary
        };
    }

    async updateOrderStatus(orderId, newStatus, reason = '', actor = null, updates = {}) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return null;

        const previousStatus = order.status;
        const now = new Date().toISOString();
        order.status = newStatus;
        if (newStatus === 'paid' || newStatus === 'completed') {
            order.payment_status = 'paid';
            order.paid_at = updates.paid_at || order.paid_at || now;
            if (newStatus === 'completed') {
                order.completed_at = updates.completed_at || order.completed_at || now;
            }
        } else if (newStatus === 'failed') {
            order.payment_status = 'failed';
        } else if (newStatus === 'cancelled') {
            order.cancelled_at = updates.cancelled_at || order.cancelled_at || now;
        } else if (newStatus === 'refunded') {
            order.refunded_at = updates.refunded_at || order.refunded_at || now;
        }
        if (updates.paid_at) order.paid_at = updates.paid_at;
        if (updates.completed_at) order.completed_at = updates.completed_at;
        if (updates.cancelled_at) order.cancelled_at = updates.cancelled_at;
        if (updates.refunded_at) order.refunded_at = updates.refunded_at;
        order.updated_at = now;

        if (actor) {
            await this.insertAuditLog({
                actor_id: actor.id || actor.user_id || 'system',
                actor_role: actor.role || 'admin',
                action: 'ORDER_STATUS_CHANGED',
                target_id: order.id,
                details: {
                    order_number: order.order_number,
                    previous_status: previousStatus,
                    new_status: newStatus,
                    reason: reason || 'Status updated by admin'
                }
            });
        }

        return this.getOrderById(order.id);
    }

    // ==========================================================================
    // PAYMENTS REPOSITORY
    // ==========================================================================

    async createPaymentRecord(data) {
        const now = new Date().toISOString();
        const id = data.id || `pay-${crypto.randomUUID().slice(0, 8)}`;
        const newPayment = {
            id,
            order_id: data.order_id,
            member_id: data.member_id,
            provider: data.provider || 'none',
            provider_payment_id: data.provider_payment_id || null,
            merchant_reference: data.merchant_reference || this.generatePaymentReference(),
            amount: parseFloat(data.amount) || 0,
            currency: data.currency || 'LKR',
            status: data.status || 'initiated', // 'initiated' | 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled'
            payment_method: data.payment_method || null,
            initiated_at: data.initiated_at || now,
            verified_at: data.verified_at || (data.status === 'paid' ? now : null),
            failed_at: data.failed_at || (data.status === 'failed' ? now : null),
            refunded_at: data.refunded_at || (data.status === 'refunded' ? now : null),
            paid_at: data.paid_at || data.verified_at || (data.status === 'paid' ? now : null),
            raw_payload: data.raw_payload || {},
            created_at: data.created_at || now,
            updated_at: now
        };

        this.payments.push(newPayment);
        return this.getPaymentById(id);
    }

    async getPaymentById(paymentId) {
        const payment = this.payments.find(p => p.id === paymentId);
        if (!payment) return null;

        const order = this.orders.find(o => o.id === payment.order_id);
        const profile = await this.findProfileByUserId(payment.member_id);
        const user = this.users.find(u => u.id === payment.member_id);

        return {
            ...payment,
            order_number: order ? order.order_number : null,
            order_type: order ? order.order_type : null,
            customer: profile ? {
                member_id: profile.member_id,
                full_name: profile.full_name,
                email: user ? user.email : ''
            } : null
        };
    }

    async getPaymentByProviderPaymentId(providerPaymentId) {
        if (!providerPaymentId) return null;
        const payment = this.payments.find(p => p.provider_payment_id === providerPaymentId);
        return payment ? this.getPaymentById(payment.id) : null;
    }

    async getPaymentByOrderId(orderId) {
        const payment = this.payments.find(p => p.order_id === orderId);
        return payment ? this.getPaymentById(payment.id) : null;
    }

    async getMemberPayments(userId, options = {}) {
        let results = this.payments.filter(p => p.member_id === userId);

        if (options.status) {
            results = results.filter(p => p.status === options.status);
        }

        results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const total = results.length;
        const page = parseInt(options.page, 10) || 1;
        const limit = parseInt(options.limit, 10) || 10;
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const pagePayments = results.slice(startIndex, startIndex + limit);

        const enriched = await Promise.all(pagePayments.map(p => this.getPaymentById(p.id)));

        return {
            payments: enriched,
            pagination: { total, page, limit, totalPages }
        };
    }

    async getAllPayments(options = {}) {
        const summary = {
            totalPayments: this.payments.length,
            pendingCount: this.payments.filter(p => p.status === 'pending' || p.status === 'initiated').length,
            verifiedCount: this.payments.filter(p => p.status === 'paid').length,
            failedCount: this.payments.filter(p => p.status === 'failed').length,
            totalVolume: this.payments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
        };

        let results = [...this.payments];
        if (options.status) {
            results = results.filter(p => p.status === options.status);
        }
        if (options.search) {
            const term = options.search.toLowerCase();
            results = results.filter(p => 
                (p.merchant_reference && p.merchant_reference.toLowerCase().includes(term)) ||
                (p.provider_payment_id && p.provider_payment_id.toLowerCase().includes(term))
            );
        }

        results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const total = results.length;
        const page = parseInt(options.page, 10) || 1;
        const limit = parseInt(options.limit, 10) || 10;
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const pagePayments = results.slice(startIndex, startIndex + limit);

        const enriched = await Promise.all(pagePayments.map(p => this.getPaymentById(p.id)));

        return {
            payments: enriched,
            pagination: { total, page, limit, totalPages },
            summary,
            stats: summary
        };
    }

    async updatePaymentRecord(paymentId, updates) {
        const payment = this.payments.find(p => p.id === paymentId);
        if (!payment) return null;

        const now = new Date().toISOString();
        if (updates.status !== undefined) payment.status = updates.status;
        if (updates.provider_payment_id !== undefined) payment.provider_payment_id = updates.provider_payment_id;
        if (updates.provider !== undefined) payment.provider = updates.provider;
        if (updates.payment_method !== undefined) payment.payment_method = updates.payment_method;
        if (updates.verified_at !== undefined) payment.verified_at = updates.verified_at;
        if (updates.failed_at !== undefined) payment.failed_at = updates.failed_at;
        if (updates.refunded_at !== undefined) payment.refunded_at = updates.refunded_at;
        if (updates.raw_payload !== undefined) payment.raw_payload = updates.raw_payload;

        if (payment.status === 'paid' && !payment.verified_at) payment.verified_at = updates.verified_at || now;
        if (payment.status === 'failed' && !payment.failed_at) payment.failed_at = updates.failed_at || now;
        if (payment.status === 'refunded' && !payment.refunded_at) payment.refunded_at = updates.refunded_at || now;
        payment.updated_at = now;

        return this.getPaymentById(paymentId);
    }

    async reconcilePayment(paymentId, resolution, notes, adminActor) {
        const payment = this.payments.find(p => p.id === paymentId);
        if (!payment) return { success: false, message: 'Payment record not found' };

        const now = new Date().toISOString();
        const prevStatus = payment.status;
        payment.status = resolution; // 'paid' | 'failed' | 'cancelled' | 'refunded'
        payment.reconciliation_status = 'reconciled';
        payment.reconciled_at = now;
        payment.reconciled_by = adminActor.id || adminActor.user_id;
        payment.reconciliation_notes = notes || '';
        if (resolution === 'paid') payment.verified_at = now;
        if (resolution === 'failed') payment.failed_at = now;
        if (resolution === 'refunded') payment.refunded_at = now;
        payment.updated_at = now;

        // Atomically update order status
        const order = this.orders.find(o => o.id === payment.order_id);
        if (order) {
            order.status = resolution === 'paid' ? (order.order_type === 'package' ? 'paid' : 'processing') : (resolution === 'refunded' ? 'refunded' : 'failed');
            order.payment_status = resolution === 'paid' ? 'paid' : (resolution === 'refunded' ? 'refunded' : 'failed');
            if (resolution === 'paid') order.paid_at = order.paid_at || now;
            if (resolution === 'refunded') order.refunded_at = order.refunded_at || now;
            order.updated_at = now;

            // Package membership activation if package order verified paid
            if (resolution === 'paid' && order.order_type === 'package') {
                const pkg = this.packages.find(p => p.id === order.package_id);
                const profile = this.memberProfiles.find(p => p.user_id === order.user_id);
                if (pkg && profile) {
                    profile.package_status = pkg.package_code;
                    profile.activated_at = profile.activated_at || now;
                    profile.updated_at = now;
                }
            }
        }

        // Emit audit log
        await this.insertAuditLog({
            actor_id: adminActor.id || adminActor.user_id,
            actor_role: adminActor.role || 'admin',
            action: 'PAYMENT_MANUALLY_RECONCILED',
            target_id: payment.id,
            details: {
                previous_status: prevStatus,
                new_status: resolution,
                order_id: payment.order_id,
                notes: notes || 'Admin payment reconciliation'
            }
        });

        return {
            success: true,
            payment: await this.getPaymentById(payment.id),
            order: order ? await this.getOrderById(order.id) : null
        };
    }

    async createRefund(data) {
        const now = new Date().toISOString();
        const refund = {
            id: data.id || `ref-${crypto.randomUUID().slice(0, 8)}`,
            order_id: data.order_id || null,
            payment_id: data.payment_id || null,
            member_id: data.member_id || null,
            amount: parseFloat(data.amount) || 0,
            currency: data.currency || 'LKR',
            reason: data.reason || 'Requested refund',
            status: data.status || 'completed',
            refunded_at: data.refunded_at || now,
            created_at: data.created_at || now,
            updated_at: now
        };
        this.refunds.push(refund);
        return refund;
    }

    async getRefunds(options = {}) {
        let list = [...this.refunds];
        if (options.currency && options.currency !== 'ALL') {
            list = list.filter(r => r.currency === options.currency);
        }
        return list;
    }

    seedCommissionPlans() {
        const now = new Date().toISOString();
        const levelRules = [
            {
                level: 1,
                type: 'DIRECT_REFERRAL',
                rate: 8.00, // 8.00% Direct Referral
                percentage: 8.00,
                description: 'Direct Sponsor Level 1 Referral Commission'
            },
            {
                level: 2,
                type: 'LEVEL_OVERRIDE',
                rate: 3.00, // 3.00% Level 2 Override
                percentage: 3.00,
                description: 'Tier 2 Team Override Commission'
            },
            {
                level: 3,
                type: 'LEVEL_OVERRIDE',
                rate: 2.00, // 2.00% Level 3 Override
                percentage: 2.00,
                description: 'Tier 3 Team Override Commission'
            },
            {
                level: 4,
                type: 'LEVEL_OVERRIDE',
                rate: 1.00, // 1.00% Level 4 Override
                percentage: 1.00,
                description: 'Tier 4 Team Override Commission'
            },
            {
                level: 5,
                type: 'LEVEL_OVERRIDE',
                rate: 0.50, // 0.50% Level 5 Override
                percentage: 0.50,
                description: 'Tier 5 Team Override Commission'
            }
        ];

        this.commissionPlans = [
            {
                id: 'plan-unilevel-v1',
                plan_code: 'NP-PLAN-UNILEVEL',
                plan_name: 'Nexus Prime Standard Unilevel Compensation Plan',
                version: 1,
                status: 'active', // 'draft' | 'active' | 'deprecated'
                commission_base_type: 'order_total', // 'order_total' | 'eligible_amount' | 'package_price' | 'product_price'
                currency: 'LKR',
                max_levels: 5,
                level_rules: levelRules,
                levels: levelRules,
                qualification_rules: {
                    requires_active_account: true,
                    requires_active_package: true,
                    minimum_rank: 'MEMBER'
                },
                effective_from: '2026-01-01T00:00:00.000Z',
                effective_to: null,
                notes: 'Default configurable corporate unilevel compensation structure. Rates represent configurable reference baselines pending final board ratification.',
                created_at: now,
                updated_at: now
            }
        ];
    }

    generateNextCommissionReference() {
        const num = String(this.commissionCounter++).padStart(6, '0');
        return `NP-COM-${num}`;
    }

    // ==========================================================================
    // COMMISSION PLANS REPOSITORY
    // ==========================================================================

    async createCommissionPlan(planData, actor = null) {
        const now = new Date().toISOString();
        const id = `plan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        
        // Compute version: find existing plans with this plan_code
        const existingWithCode = this.commissionPlans.filter(p => p.plan_code === (planData.plan_code || 'NP-PLAN-CUSTOM'));
        const nextVersion = existingWithCode.length > 0
            ? Math.max(...existingWithCode.map(p => p.version || 1)) + 1
            : (planData.version || 1);

        const rawLevels = planData.level_rules || planData.levels || [];
        const levelRules = rawLevels.map(lvl => ({
            level: parseInt(lvl.level, 10),
            type: lvl.type || (parseInt(lvl.level, 10) === 1 ? 'DIRECT_REFERRAL' : 'LEVEL_OVERRIDE'),
            rate: parseFloat(lvl.rate !== undefined ? lvl.rate : (lvl.percentage || 0)),
            percentage: parseFloat(lvl.percentage !== undefined ? lvl.percentage : (lvl.rate || 0)),
            description: lvl.description || `Tier ${lvl.level} Commission`
        }));

        const newPlan = {
            id,
            plan_code: planData.plan_code || 'NP-PLAN-CUSTOM',
            plan_name: planData.plan_name || 'Custom Commission Plan',
            version: nextVersion,
            status: planData.status || 'draft',
            commission_base_type: planData.commission_base_type || 'order_total',
            currency: planData.currency || 'LKR',
            max_levels: parseInt(planData.max_levels, 10) || levelRules.length || 5,
            level_rules: levelRules,
            levels: levelRules,
            qualification_rules: planData.qualification_rules || {
                requires_active_account: true,
                requires_active_package: true,
                minimum_rank: 'MEMBER'
            },
            effective_from: planData.effective_from || now,
            effective_to: planData.effective_to || null,
            notes: planData.notes || '',
            created_at: now,
            updated_at: now
        };

        this.commissionPlans.push(newPlan);

        if (actor) {
            await this.insertAuditLog({
                actor_id: actor.id || actor.user_id || 'system',
                actor_role: actor.role || 'admin',
                action: 'COMMISSION_PLAN_CREATED',
                target_id: newPlan.id,
                details: {
                    plan_code: newPlan.plan_code,
                    version: newPlan.version,
                    status: newPlan.status
                }
            });
        }

        return newPlan;
    }

    async getCommissionPlanById(id) {
        return this.commissionPlans.find(p => p.id === id) || null;
    }

    async getCommissionPlanByCodeAndVersion(code, version) {
        return this.commissionPlans.find(p => p.plan_code === code && p.version === parseInt(version, 10)) || null;
    }

    async getActiveCommissionPlan(date = new Date()) {
        const targetTime = new Date(date).getTime();
        const activePlans = this.commissionPlans.filter(p => {
            if (p.status !== 'active') return false;
            const fromTime = new Date(p.effective_from).getTime();
            const toTime = p.effective_to ? new Date(p.effective_to).getTime() : Infinity;
            return targetTime >= fromTime && targetTime <= toTime;
        });

        activePlans.sort((a, b) => b.version - a.version);
        return activePlans[0] || this.commissionPlans.find(p => p.status === 'active') || null;
    }

    async getAllCommissionPlans(options = {}) {
        let results = [...this.commissionPlans];
        if (options.status) {
            results = results.filter(p => p.status === options.status);
        }
        if (options.plan_code) {
            results = results.filter(p => p.plan_code === options.plan_code);
        }
        results.sort((a, b) => b.version - a.version);
        return {
            plans: results,
            total: results.length
        };
    }

    async updateCommissionPlan(id, updates, actor = null) {
        const plan = this.commissionPlans.find(p => p.id === id);
        if (!plan) return null;

        const now = new Date().toISOString();
        if (updates.status !== undefined) plan.status = updates.status;
        if (updates.effective_to !== undefined) plan.effective_to = updates.effective_to;
        if (updates.notes !== undefined) plan.notes = updates.notes;
        plan.updated_at = now;

        if (actor) {
            await this.insertAuditLog({
                actor_id: actor.id || actor.user_id || 'system',
                actor_role: actor.role || 'admin',
                action: 'COMMISSION_PLAN_UPDATED',
                target_id: plan.id,
                details: updates
            });
        }

        return plan;
    }

    // ==========================================================================
    // COMMISSIONS JOURNAL REPOSITORY
    // ==========================================================================

    async createCommissionRecord(data) {
        const now = new Date().toISOString();
        const id = data.id || `com-${crypto.randomUUID().slice(0, 8)}`;
        const ref = data.commission_reference || this.generateNextCommissionReference();

        const record = {
            id,
            commission_reference: ref,
            order_id: data.order_id,
            order_number: data.order_number,
            order_item_id: data.order_item_id || null,
            beneficiary_id: data.beneficiary_id,
            source_member_id: data.source_member_id,
            sponsor_id: data.sponsor_id || null,
            commission_type: data.commission_type, // 'DIRECT_REFERRAL' | 'LEVEL_OVERRIDE'
            commission_level: parseInt(data.commission_level, 10) || 1,
            plan_id: data.plan_id,
            plan_code: data.plan_code,
            plan_version: parseInt(data.plan_version, 10) || 1,
            commission_rate: parseFloat(data.commission_rate !== undefined ? data.commission_rate : (data.percentage_rate || 0.00)),
            percentage_rate: parseFloat(data.percentage_rate !== undefined ? data.percentage_rate : (data.commission_rate || 0.00)),
            base_amount: parseFloat(data.base_amount !== undefined ? data.base_amount : (data.calculation_basis_amount || 0.00)),
            calculation_basis_amount: parseFloat(data.calculation_basis_amount !== undefined ? data.calculation_basis_amount : (data.base_amount || 0.00)),
            amount: parseFloat(data.amount) || 0.00,
            currency: data.currency || 'LKR',
            status: data.status || 'approved', // 'pending' | 'approved' | 'credited' | 'reversed' | 'cancelled'
            calculation_notes: data.calculation_notes || '',
            metadata: data.metadata || {},
            created_at: data.created_at || now,
            approved_at: data.approved_at || now,
            credited_at: data.credited_at || null,
            reversed_at: data.reversed_at || null,
            updated_at: now
        };

        this.commissions.push(record);
        return this.getCommissionById(id);
    }

    async getCommissionById(id) {
        const comm = this.commissions.find(c => c.id === id || c.commission_reference === id);
        if (!comm) return null;

        const beneficiaryProfile = await this.findProfileByUserId(comm.beneficiary_id);
        const sourceProfile = await this.findProfileByUserId(comm.source_member_id);
        const order = await this.getOrderById(comm.order_id);

        return {
            ...comm,
            beneficiary_name: beneficiaryProfile ? `${beneficiaryProfile.first_name} ${beneficiaryProfile.last_name}` : 'Unknown Beneficiary',
            beneficiary_member_id: beneficiaryProfile ? beneficiaryProfile.member_id : 'N/A',
            source_member_name: sourceProfile ? `${sourceProfile.first_name} ${sourceProfile.last_name}` : 'Unknown Source',
            source_member_code: sourceProfile ? sourceProfile.member_id : 'N/A',
            order_summary: order ? {
                order_number: order.order_number,
                total: order.total || order.total_amount,
                status: order.status,
                payment_status: order.payment_status
            } : null
        };
    }

    async getCommissionsByOrderId(orderId) {
        const matching = this.commissions.filter(c => c.order_id === orderId);
        return Promise.all(matching.map(c => this.getCommissionById(c.id)));
    }

    async hasCommissionsForOrder(orderId) {
        return this.commissions.some(c => c.order_id === orderId);
    }

    async getMemberCommissions(userId, options = {}) {
        let results = this.commissions.filter(c => c.beneficiary_id === userId);

        if (options.status) {
            results = results.filter(c => c.status === options.status);
        }
        if (options.type || options.commission_type) {
            const t = options.type || options.commission_type;
            results = results.filter(c => c.commission_type === t);
        }

        results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const total = results.length;
        const page = parseInt(options.page, 10) || 1;
        const limit = parseInt(options.limit, 10) || 10;
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const pageRecords = results.slice(startIndex, startIndex + limit);

        const enriched = await Promise.all(pageRecords.map(c => this.getCommissionById(c.id)));

        const allMemberComms = this.commissions.filter(c => c.beneficiary_id === userId);
        const totalApproved = allMemberComms.filter(c => c.status === 'approved')
                                            .reduce((sum, c) => sum + (c.amount || 0), 0);
        const summary = {
            totalApprovedLKR: totalApproved,
            totalEarnedLKR: totalApproved,
            directReferralLKR: allMemberComms.filter(c => c.commission_type === 'DIRECT_REFERRAL' && (c.status === 'approved' || c.status === 'credited'))
                                             .reduce((sum, c) => sum + (c.amount || 0), 0),
            levelOverrideLKR: allMemberComms.filter(c => c.commission_type === 'LEVEL_OVERRIDE' && (c.status === 'approved' || c.status === 'credited'))
                                            .reduce((sum, c) => sum + (c.amount || 0), 0),
            totalRecords: allMemberComms.length,
            approvedCount: allMemberComms.filter(c => c.status === 'approved').length,
            pendingWalletLKR: totalApproved
        };

        const stats = {
            ...summary,
            totalEarnedLKR: summary.totalApprovedLKR,
            directReferralVolumeLKR: summary.directReferralLKR,
            levelOverrideVolumeLKR: summary.levelOverrideLKR,
            approvedCount: allMemberComms.filter(c => c.status === 'approved').length
        };

        return {
            commissions: enriched,
            pagination: { total, page, limit, totalPages },
            summary,
            stats
        };
    }

    async getAllCommissions(options = {}) {
        const summary = {
            totalCommissions: this.commissions.length,
            totalVolumeLKR: this.commissions.reduce((sum, c) => sum + (c.amount || 0), 0),
            directReferralCount: this.commissions.filter(c => c.commission_type === 'DIRECT_REFERRAL').length,
            directReferralVolumeLKR: this.commissions.filter(c => c.commission_type === 'DIRECT_REFERRAL')
                                                     .reduce((sum, c) => sum + (c.amount || 0), 0),
            levelOverrideCount: this.commissions.filter(c => c.commission_type === 'LEVEL_OVERRIDE').length,
            levelOverrideVolumeLKR: this.commissions.filter(c => c.commission_type === 'LEVEL_OVERRIDE')
                                                   .reduce((sum, c) => sum + (c.amount || 0), 0),
            approvedCount: this.commissions.filter(c => c.status === 'approved').length,
            pendingCount: this.commissions.filter(c => c.status === 'pending').length,
            creditedCount: this.commissions.filter(c => c.status === 'credited').length,
            reversedCount: this.commissions.filter(c => c.status === 'reversed').length
        };

        let results = [...this.commissions];

        if (options.status && options.status !== 'all') {
            results = results.filter(c => c.status === options.status);
        }
        if (options.type || options.commission_type) {
            const t = options.type || options.commission_type;
            if (t !== 'all') {
                results = results.filter(c => c.commission_type === t);
            }
        }
        if (options.level) {
            const lvl = parseInt(options.level, 10);
            if (!isNaN(lvl)) {
                results = results.filter(c => c.commission_level === lvl);
            }
        }
        if (options.member || options.member_id || options.beneficiary_id) {
            const targetId = this.resolveMemberUserId(options.member || options.member_id || options.beneficiary_id);
            results = results.filter(c => c.beneficiary_id === targetId);
        }
        if (options.source_member || options.source_member_id) {
            const srcId = this.resolveMemberUserId(options.source_member || options.source_member_id);
            results = results.filter(c => c.source_member_id === srcId);
        }
        if (options.rank || options.rank_id || options.rank_code) {
            const targetRank = (options.rank || options.rank_id || options.rank_code).toUpperCase();
            results = results.filter(c => {
                const benProfile = this.memberProfiles.find(p => p.user_id === c.beneficiary_id);
                return (c.rank_id && c.rank_id.toUpperCase() === targetRank) ||
                       (c.metadata && c.metadata.beneficiary_rank && c.metadata.beneficiary_rank.toUpperCase() === targetRank) ||
                       (benProfile && (benProfile.current_rank === targetRank || benProfile.rank === targetRank));
            });
        }
        if (options.plan || options.plan_id || options.plan_code) {
            const p = (options.plan || options.plan_id || options.plan_code).toLowerCase();
            results = results.filter(c => (c.plan_id && c.plan_id.toLowerCase() === p) || (c.plan_code && c.plan_code.toLowerCase() === p));
        }
        if (options.plan_version) {
            const v = parseInt(options.plan_version, 10);
            if (!isNaN(v)) results = results.filter(c => c.plan_version === v);
        }
        if (options.currency && options.currency !== 'ALL') {
            const curr = options.currency.toUpperCase();
            results = results.filter(c => c.currency && c.currency.toUpperCase() === curr);
        }
        if (options.order || options.order_id || options.order_number) {
            const ord = (options.order || options.order_id || options.order_number).toLowerCase();
            results = results.filter(c => (c.order_id && c.order_id.toLowerCase() === ord) || (c.order_number && c.order_number.toLowerCase() === ord));
        }
        if (options.min_amount !== undefined && options.min_amount !== '') {
            const min = parseFloat(options.min_amount);
            if (!isNaN(min)) results = results.filter(c => c.amount >= min);
        }
        if (options.max_amount !== undefined && options.max_amount !== '') {
            const max = parseFloat(options.max_amount);
            if (!isNaN(max)) results = results.filter(c => c.amount <= max);
        }
        const dateFrom = options.date_from || options.dateFrom || options.period_start;
        if (dateFrom) {
            const fromTs = new Date(dateFrom).getTime();
            if (!isNaN(fromTs)) results = results.filter(c => new Date(c.created_at).getTime() >= fromTs);
        }
        const dateTo = options.date_to || options.dateTo || options.period_end;
        if (dateTo) {
            const toTs = new Date(dateTo).getTime();
            const isExclusive = !!options.period_end;
            if (!isNaN(toTs)) results = results.filter(c => isExclusive ? new Date(c.created_at).getTime() < toTs : new Date(c.created_at).getTime() <= toTs);
        }
        if (options.search) {
            const q = options.search.trim().toLowerCase();
            results = results.filter(c => {
                if (c.commission_reference && c.commission_reference.toLowerCase().includes(q)) return true;
                if (c.order_number && c.order_number.toLowerCase().includes(q)) return true;
                const ben = this.memberProfiles.find(p => p.user_id === c.beneficiary_id);
                if (ben && ((ben.member_id && ben.member_id.toLowerCase().includes(q)) || (ben.full_name && ben.full_name.toLowerCase().includes(q)))) return true;
                const src = this.memberProfiles.find(p => p.user_id === c.source_member_id);
                if (src && ((src.member_id && src.member_id.toLowerCase().includes(q)) || (src.full_name && src.full_name.toLowerCase().includes(q)))) return true;
                return false;
            });
        }

        // Sorting
        const sortBy = options.sort_by || 'created_at';
        const sortDir = (options.sort_dir || 'desc').toLowerCase();
        results.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            if (sortBy === 'created_at') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            }
            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        const total = results.length;
        const page = Math.max(1, parseInt(options.page, 10) || 1);
        const limit = Math.max(1, Math.min(500, parseInt(options.limit, 10) || 10));
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const pageRecords = results.slice(startIndex, startIndex + limit);

        const enriched = await Promise.all(pageRecords.map(c => this.getCommissionById(c.id)));

        return {
            commissions: enriched,
            pagination: { total, page, limit, totalPages, total_records: total, total_pages: totalPages, current_page: page },
            summary,
            stats: summary
        };
    }

    async getAdminCommissions(options = {}) {
        return this.getAllCommissions(options);
    }

    async getMemberCommissionsSummary(userId, options = {}) {
        const resolvedId = this.resolveMemberUserId(userId);
        const memberComms = this.commissions.filter(c => c.beneficiary_id === resolvedId);
        
        let totalVolume = 0;
        let approvedVolume = 0;
        let creditedVolume = 0;
        let pendingVolume = 0;
        let reversedVolume = 0;
        let directVolume = 0;
        let levelOverrideVolume = 0;

        for (const c of memberComms) {
            const amt = c.amount || 0;
            totalVolume += amt;
            if (c.status === 'approved') approvedVolume += amt;
            if (c.status === 'credited') creditedVolume += amt;
            if (c.status === 'pending') pendingVolume += amt;
            if (c.status === 'reversed') reversedVolume += amt;
            if (c.commission_type === 'DIRECT_REFERRAL') directVolume += amt;
            if (c.commission_type === 'LEVEL_OVERRIDE') levelOverrideVolume += amt;
        }

        return {
            total_commissions: memberComms.length,
            total_earned: Math.round((creditedVolume + approvedVolume) * 100) / 100,
            total_volume: Math.round(totalVolume * 100) / 100,
            approved_volume: Math.round(approvedVolume * 100) / 100,
            approved_count: memberComms.filter(c => c.status === 'approved').length,
            credited_volume: Math.round(creditedVolume * 100) / 100,
            credited_count: memberComms.filter(c => c.status === 'credited').length,
            pending_volume: Math.round(pendingVolume * 100) / 100,
            pending_count: memberComms.filter(c => c.status === 'pending').length,
            reversed_volume: Math.round(reversedVolume * 100) / 100,
            reversed_count: memberComms.filter(c => c.status === 'reversed').length,
            direct_volume: Math.round(directVolume * 100) / 100,
            direct_count: memberComms.filter(c => c.commission_type === 'DIRECT_REFERRAL').length,
            level_override_volume: Math.round(levelOverrideVolume * 100) / 100,
            level_override_count: memberComms.filter(c => c.commission_type === 'LEVEL_OVERRIDE').length
        };
    }

    async updateCommissionStatus(id, newStatus, reason = '', actor = null, extra = {}) {
        const comm = this.commissions.find(c => c.id === id || c.commission_reference === id);
        if (!comm) return null;

        const previousStatus = comm.status;
        const now = new Date().toISOString();
        comm.status = newStatus;
        if (newStatus === 'approved') comm.approved_at = extra.approved_at || now;
        if (newStatus === 'credited') {
            comm.credited_at = extra.credited_at || now;
            if (extra.ledger_entry_id) comm.ledger_entry_id = extra.ledger_entry_id;
        }
        if (newStatus === 'reversed') comm.reversed_at = extra.reversed_at || now;
        if (newStatus === 'cancelled') comm.cancelled_at = extra.cancelled_at || now;
        if (extra.ledger_entry_id) comm.ledger_entry_id = extra.ledger_entry_id;
        comm.updated_at = now;

        if (actor) {
            await this.insertAuditLog({
                actor_id: actor.id || actor.user_id || 'system',
                actor_role: actor.role || 'admin',
                action: 'COMMISSION_STATUS_UPDATED',
                target_id: comm.id,
                details: {
                    commission_reference: comm.commission_reference,
                    previous_status: previousStatus,
                    new_status: newStatus,
                    reason: reason || 'Administrative status change'
                }
            });
        }

        return this.getCommissionById(comm.id);
    }

    // ==========================================================================
    // WALLET & FINANCIAL LEDGER REPOSITORY (PROMPT 12)
    // ==========================================================================

    generateNextLedgerReference() {
        const num = String(this.ledgerCounter++).padStart(6, '0');
        return `NP-TX-${num}`;
    }

    resolveMemberUserId(memberId) {
        if (!memberId) return null;
        if (this.memberProfiles) {
            const profile = this.memberProfiles.find(p => p.user_id === memberId || (p.member_id && p.member_id.toUpperCase() === memberId.toUpperCase()));
            if (profile) return profile.user_id;
        }
        if (this.users) {
            const user = this.users.find(u => u.id === memberId || (u.email && u.email.toLowerCase() === memberId.toLowerCase()));
            if (user) return user.id;
        }
        return memberId;
    }

    async getOrCreateWallet(memberId, currency = 'LKR') {
        const resolvedId = this.resolveMemberUserId(memberId);
        let wallet = this.wallets.find(w => w.member_id === resolvedId && w.currency === currency);
        if (!wallet) {
            const now = new Date().toISOString();
            wallet = {
                id: `wal-${crypto.randomUUID().slice(0, 8)}`,
                member_id: resolvedId,
                currency: currency,
                status: 'active',
                created_at: now,
                updated_at: now
            };
            this.wallets.push(wallet);
        }
        return wallet;
    }

    async createWallet(walletData) {
        const memberId = walletData.member_id || walletData.user_id;
        const currency = walletData.currency || 'LKR';
        const existing = this.wallets.find(w => w.member_id === memberId && w.currency === currency);
        if (existing) return existing;

        const now = new Date().toISOString();
        const wallet = {
            id: walletData.id || `wal-${crypto.randomUUID().slice(0, 8)}`,
            member_id: memberId,
            currency,
            status: walletData.status || 'active',
            created_at: now,
            updated_at: now
        };
        this.wallets.push(wallet);
        return wallet;
    }

    async getWalletById(id) {
        return this.wallets.find(w => w.id === id) || null;
    }

    async getWalletByMemberId(memberId, currency = 'LKR') {
        const resolvedId = this.resolveMemberUserId(memberId);
        return this.wallets.find(w => w.member_id === resolvedId && w.currency === currency) || null;
    }

    async getWalletByUserId(userId, currency = 'LKR') {
        return this.getWalletByMemberId(userId, currency);
    }

    async getAllWallets(options = {}) {
        let results = [...this.wallets];
        if (options.status) {
            results = results.filter(w => w.status === options.status);
        }
        if (options.currency) {
            results = results.filter(w => w.currency === options.currency);
        }

        const enriched = await Promise.all(results.map(async w => {
            const profile = await this.findProfileByUserId(w.member_id);
            const balanceSummary = await this.getWalletLedgerBalance(w.id);
            return {
                ...w,
                member_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown Member',
                member_code: profile ? profile.member_id : 'N/A',
                member_email: profile ? profile.email : 'N/A',
                available_balance: balanceSummary.availableBalance,
                total_credits: balanceSummary.totalCredits,
                total_debits: balanceSummary.totalDebits,
                entry_count: balanceSummary.entryCount
            };
        }));

        let filtered = enriched;
        if (options.search) {
            const s = options.search.toLowerCase();
            filtered = filtered.filter(w => 
                (w.member_name && w.member_name.toLowerCase().includes(s)) ||
                (w.member_code && w.member_code.toLowerCase().includes(s)) ||
                (w.member_email && w.member_email.toLowerCase().includes(s)) ||
                (w.id && w.id.toLowerCase().includes(s))
            );
        }

        const total = filtered.length;
        const page = parseInt(options.page, 10) || 1;
        const limit = parseInt(options.limit, 10) || 10;
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const paged = filtered.slice(startIndex, startIndex + limit);

        return {
            wallets: paged,
            pagination: { total, page, limit, totalPages }
        };
    }

    async updateWalletStatus(walletId, status, actor = null) {
        const wallet = this.wallets.find(w => w.id === walletId);
        if (!wallet) return null;

        const previousStatus = wallet.status;
        wallet.status = status;
        wallet.updated_at = new Date().toISOString();

        if (actor) {
            await this.insertAuditLog({
                actor_id: actor.id || actor.user_id || 'system',
                actor_role: actor.role || 'admin',
                action: 'WALLET_STATUS_UPDATED',
                target_id: wallet.id,
                details: {
                    previous_status: previousStatus,
                    new_status: status,
                    member_id: wallet.member_id
                }
            });
        }
        return wallet;
    }

    async getWalletLedgerBalance(walletId) {
        const entries = this.ledgerEntries.filter(e => 
            e.wallet_id === walletId && (e.status === 'posted' || e.status === 'cleared' || e.status === 'reversed')
        );

        let credits = 0;
        let debits = 0;
        for (const e of entries) {
            if (e.direction === 'CREDIT') {
                credits += Math.round((e.amount || 0) * 100);
            } else if (e.direction === 'DEBIT') {
                debits += Math.round((e.amount || 0) * 100);
            }
        }

        const totalCredits = credits / 100;
        const totalDebits = debits / 100;
        const availableBalance = (credits - debits) / 100;

        return {
            availableBalance: Math.round(availableBalance * 100) / 100,
            totalCredits: Math.round(totalCredits * 100) / 100,
            totalDebits: Math.round(totalDebits * 100) / 100,
            entryCount: entries.length
        };
    }

    async createLedgerEntry(entryData) {
        const now = new Date().toISOString();
        const id = entryData.id || `tx-${crypto.randomUUID().slice(0, 8)}`;
        const ref = entryData.entry_reference || this.generateNextLedgerReference();

        // Idempotency check: (reference_type, reference_id, entry_type)
        if (entryData.reference_type && entryData.reference_id && entryData.entry_type) {
            const existing = this.ledgerEntries.find(e => 
                e.reference_type === entryData.reference_type &&
                e.reference_id === entryData.reference_id &&
                e.entry_type === entryData.entry_type
            );
            if (existing) {
                return { entry: existing, idempotent: true };
            }
        }

        const amount = Math.round(parseFloat(entryData.amount) * 100) / 100;
        if (isNaN(amount) || amount <= 0) {
            throw new Error(`Financial Validation Error: Amount must be strictly greater than 0.00 (received ${entryData.amount})`);
        }

        const direction = String(entryData.direction).toUpperCase();
        if (direction !== 'CREDIT' && direction !== 'DEBIT') {
            throw new Error(`Financial Validation Error: Direction must be 'CREDIT' or 'DEBIT' (received ${entryData.direction})`);
        }

        // Check wallet exists and active
        const wallet = await this.getWalletById(entryData.wallet_id);
        if (!wallet) {
            throw new Error(`Financial Validation Error: Wallet ID ${entryData.wallet_id} not found.`);
        }
        if (wallet.status === 'suspended' || wallet.status === 'closed') {
            throw new Error(`Security Safeguard: Cannot post transaction to ${wallet.status} wallet.`);
        }

        // Compute authoritative balance after entry
        const currentBalanceStats = await this.getWalletLedgerBalance(wallet.id);
        const currentBalance = currentBalanceStats.availableBalance;

        let balanceAfter = 0;
        if (direction === 'CREDIT') {
            balanceAfter = Math.round((currentBalance + amount) * 100) / 100;
        } else {
            // Negative balance check
            if (currentBalance < amount) {
                throw new Error(`INSUFFICIENT_FUNDS: Available balance LKR ${currentBalance.toFixed(2)} is insufficient for requested debit of LKR ${amount.toFixed(2)}.`);
            }
            balanceAfter = Math.round((currentBalance - amount) * 100) / 100;
        }

        const record = {
            id,
            entry_reference: ref,
            wallet_id: wallet.id,
            member_id: wallet.member_id,
            entry_type: entryData.entry_type, // 'commission' | 'withdrawal' | 'refund' | 'adjustment' | 'reversal' | 'bonus' | 'correction'
            direction,
            amount,
            currency: entryData.currency || wallet.currency || 'LKR',
            reference_type: entryData.reference_type,
            reference_id: entryData.reference_id,
            balance_before: currentBalance,
            balance_after: balanceAfter,
            description: entryData.description || 'Financial ledger transaction',
            status: entryData.status || 'posted', // 'posted' | 'cleared' | 'reversed' | 'void'
            metadata: entryData.metadata || {},
            created_at: entryData.created_at || now
        };

        this.ledgerEntries.push(record);
        return { entry: record, idempotent: false };
    }

    async updateLedgerEntryStatus(id, newStatus) {
        const entry = this.ledgerEntries.find(e => e.id === id || e.entry_reference === id);
        if (!entry) return null;
        entry.status = newStatus;
        return entry;
    }

    async getLedgerEntryById(id) {
        const entry = this.ledgerEntries.find(e => e.id === id || e.entry_reference === id);
        if (!entry) return null;

        const profile = await this.findProfileByUserId(entry.member_id);
        const wallet = await this.getWalletById(entry.wallet_id);

        return {
            ...entry,
            member_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown Member',
            member_code: profile ? profile.member_id : 'N/A',
            member_email: profile ? profile.email : 'N/A',
            wallet_status: wallet ? wallet.status : 'N/A'
        };
    }

    async getLedgerEntryByReference(refType, refId, entryType = null) {
        return this.ledgerEntries.find(e => 
            e.reference_type === refType &&
            e.reference_id === refId &&
            (!entryType || e.entry_type === entryType)
        ) || null;
    }

    async getMemberLedgerSummary(memberId, currency = 'LKR') {
        const resolvedId = this.resolveMemberUserId(memberId);
        const wallet = await this.getOrCreateWallet(resolvedId, currency);
        const balanceSummary = await this.getWalletLedgerBalance(wallet.id);

        // Pending commissions awaiting wallet disbursement
        const pendingCommissions = this.commissions.filter(c => 
            c.beneficiary_id === resolvedId && c.status === 'approved'
        );
        const pendingAmount = pendingCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);

        return {
            wallet_id: wallet.id,
            member_id: resolvedId,
            currency: wallet.currency,
            status: wallet.status,
            available_balance: balanceSummary.availableBalance,
            pending_balance: Math.round(pendingAmount * 100) / 100,
            total_credits: balanceSummary.totalCredits,
            total_debits: balanceSummary.totalDebits,
            entry_count: balanceSummary.entryCount
        };
    }

    async getMemberLedgerEntries(memberId, options = {}) {
        const resolvedId = this.resolveMemberUserId(memberId);
        let results = this.ledgerEntries.filter(e => e.member_id === resolvedId);

        if (options.direction) {
            results = results.filter(e => e.direction === options.direction.toUpperCase());
        }
        if (options.entry_type) {
            results = results.filter(e => e.entry_type === options.entry_type);
        }
        if (options.status) {
            results = results.filter(e => e.status === options.status);
        }
        if (options.search) {
            const s = options.search.toLowerCase();
            results = results.filter(e => 
                (e.entry_reference && e.entry_reference.toLowerCase().includes(s)) ||
                (e.description && e.description.toLowerCase().includes(s)) ||
                (e.reference_id && e.reference_id.toLowerCase().includes(s))
            );
        }
        if (options.dateFrom) {
            const from = new Date(options.dateFrom).getTime();
            results = results.filter(e => new Date(e.created_at).getTime() >= from);
        }
        if (options.dateTo) {
            const to = new Date(options.dateTo).getTime();
            results = results.filter(e => new Date(e.created_at).getTime() <= to);
        }

        results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const total = results.length;
        const page = parseInt(options.page, 10) || 1;
        const limit = parseInt(options.limit, 10) || 10;
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const paged = results.slice(startIndex, startIndex + limit);

        const enriched = await Promise.all(paged.map(e => this.getLedgerEntryById(e.id)));

        return {
            entries: enriched,
            pagination: { total, page, limit, totalPages, total_pages: totalPages, total_records: total }
        };
    }

    async getAllLedgerEntries(options = {}) {
        let results = [...this.ledgerEntries];

        if (options.direction) {
            results = results.filter(e => e.direction === options.direction.toUpperCase());
        }
        if (options.entry_type) {
            results = results.filter(e => e.entry_type === options.entry_type);
        }
        if (options.status) {
            results = results.filter(e => e.status === options.status);
        }
        if (options.member_id) {
            results = results.filter(e => e.member_id === options.member_id);
        }
        if (options.dateFrom) {
            const from = new Date(options.dateFrom).getTime();
            results = results.filter(e => new Date(e.created_at).getTime() >= from);
        }
        if (options.dateTo) {
            const to = new Date(options.dateTo).getTime();
            results = results.filter(e => new Date(e.created_at).getTime() <= to);
        }

        results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const enriched = await Promise.all(results.map(e => this.getLedgerEntryById(e.id)));

        let filtered = enriched;
        if (options.search) {
            const s = options.search.toLowerCase();
            filtered = filtered.filter(e => 
                (e.entry_reference && e.entry_reference.toLowerCase().includes(s)) ||
                (e.description && e.description.toLowerCase().includes(s)) ||
                (e.member_name && e.member_name.toLowerCase().includes(s)) ||
                (e.member_code && e.member_code.toLowerCase().includes(s)) ||
                (e.reference_id && e.reference_id.toLowerCase().includes(s))
            );
        }

        const total = filtered.length;
        const page = parseInt(options.page, 10) || 1;
        const limit = parseInt(options.limit, 10) || 10;
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const paged = filtered.slice(startIndex, startIndex + limit);

        // Calculate summary volume from all matching entries
        let totalCreditVolume = 0;
        let totalDebitVolume = 0;
        filtered.forEach(e => {
            if (e.direction === 'CREDIT') totalCreditVolume += (e.amount || 0);
            if (e.direction === 'DEBIT') totalDebitVolume += (e.amount || 0);
        });

        return {
            entries: paged,
            pagination: { total, page, limit, totalPages, total_pages: totalPages, total_records: total },
            summary: {
                totalCreditVolume: Math.round(totalCreditVolume * 100) / 100,
                totalDebitVolume: Math.round(totalDebitVolume * 100) / 100,
                netVolume: Math.round((totalCreditVolume - totalDebitVolume) * 100) / 100,
                totalRecords: total
            }
        };
    }

    async getLedgerEntries(options = {}) {
        if (options.user_id || options.member_id) {
            const memberId = options.user_id || options.member_id;
            const res = await this.getMemberLedgerEntries(memberId, options);
            const arr = res.entries || [];
            arr.entries = arr;
            arr.pagination = res.pagination;
            return arr;
        }
        const res = await this.getAllLedgerEntries(options);
        const arr = res.entries || [];
        arr.entries = arr;
        arr.pagination = res.pagination;
        arr.summary = res.summary;
        return arr;
    }

    async getFinancialSummaryStats() {
        let totalCreditVolume = 0;
        let totalDebitVolume = 0;
        let commissionCreditsVolume = 0;
        let adjustmentCreditsVolume = 0;
        let adjustmentDebitsVolume = 0;
        let reversalVolume = 0;

        for (const e of this.ledgerEntries) {
            if (e.status === 'posted' || e.status === 'cleared' || e.status === 'reversed') {
                if (e.direction === 'CREDIT') {
                    totalCreditVolume += e.amount;
                    if (e.entry_type === 'commission') commissionCreditsVolume += e.amount;
                    if (e.entry_type === 'adjustment') adjustmentCreditsVolume += e.amount;
                } else if (e.direction === 'DEBIT') {
                    totalDebitVolume += e.amount;
                    if (e.entry_type === 'adjustment') adjustmentDebitsVolume += e.amount;
                }
                if (e.entry_type === 'reversal') reversalVolume += e.amount;
            }
        }

        const netLedgerBalance = totalCreditVolume - totalDebitVolume;

        return {
            total_credits: Math.round(totalCreditVolume * 100) / 100,
            totalCreditsLKR: Math.round(totalCreditVolume * 100) / 100,
            total_debits: Math.round(totalDebitVolume * 100) / 100,
            totalDebitsLKR: Math.round(totalDebitVolume * 100) / 100,
            net_balance: Math.round(netLedgerBalance * 100) / 100,
            netLedgerBalanceLKR: Math.round(netLedgerBalance * 100) / 100,
            commission_credits: Math.round(commissionCreditsVolume * 100) / 100,
            commissionCreditsLKR: Math.round(commissionCreditsVolume * 100) / 100,
            adjustment_credits: Math.round(adjustmentCreditsVolume * 100) / 100,
            adjustmentCreditsLKR: Math.round(adjustmentCreditsVolume * 100) / 100,
            adjustment_debits: Math.round(adjustmentDebitsVolume * 100) / 100,
            adjustmentDebitsLKR: Math.round(adjustmentDebitsVolume * 100) / 100,
            reversals: Math.round(reversalVolume * 100) / 100,
            reversalsLKR: Math.round(reversalVolume * 100) / 100,
            active_wallets: this.wallets.filter(w => w.status === 'active').length,
            activeWalletsCount: this.wallets.filter(w => w.status === 'active').length,
            total_wallets: this.wallets.length,
            totalWalletsCount: this.wallets.length,
            total_transactions: this.ledgerEntries.length,
            totalTransactionsCount: this.ledgerEntries.length
        };
    }

    // ============================================================
    // BANK ACCOUNTS REPOSITORY
    // ============================================================

    maskAccountNumber(accountNumber) {
        if (!accountNumber) return '';
        const cleaned = String(accountNumber).trim();
        if (cleaned.length <= 4) return '****' + cleaned;
        return '********' + cleaned.slice(-4);
    }

    async createBankAccount(data) {
        const memberId = this.resolveMemberUserId(data.member_id || data.userId);
        if (!memberId) {
            throw new Error('Database Error: Member ID is required for bank account.');
        }

        const now = new Date().toISOString();
        const id = data.id || `bank-${crypto.randomUUID().slice(0, 8)}`;
        const rawAccountNum = String(data.account_number || '').trim();
        const masked = data.account_number_masked || this.maskAccountNumber(rawAccountNum);

        // Check if member already has accounts. If first account, default is_primary = true.
        const existingAccounts = this.bankAccounts.filter(b => b.member_id === memberId && b.status !== 'inactive');
        let isPrimary = Boolean(data.is_primary);
        if (existingAccounts.length === 0) {
            isPrimary = true;
        } else if (isPrimary) {
            // Unset previous primary
            for (const acc of existingAccounts) {
                acc.is_primary = false;
            }
        }

        const bankAccount = {
            id,
            member_id: memberId,
            bank_name: data.bank_name,
            branch_name: data.branch_name,
            branch_code: data.branch_code || '',
            account_name: data.account_name,
            account_number: rawAccountNum,
            account_number_masked: masked,
            account_type: data.account_type || 'savings',
            currency: data.currency || 'LKR',
            is_primary: isPrimary,
            is_verified: Boolean(data.is_verified),
            status: data.status || 'active',
            created_at: now,
            updated_at: now
        };

        this.bankAccounts.push(bankAccount);

        await this.insertAuditLog({
            actor_id: memberId,
            actor_role: 'member',
            action: 'BANK_ACCOUNT_CREATED',
            target_id: id,
            details: {
                bank_name: bankAccount.bank_name,
                account_name: bankAccount.account_name,
                account_number_masked: masked,
                is_primary: isPrimary
            }
        });

        return { ...bankAccount };
    }

    async getBankAccountById(id) {
        const found = this.bankAccounts.find(b => b.id === id);
        return found ? { ...found } : null;
    }

    async getMemberBankAccounts(memberId, options = {}) {
        const userId = this.resolveMemberUserId(memberId);
        let accounts = this.bankAccounts.filter(b => b.member_id === userId);

        if (options.activeOnly !== false) {
            accounts = accounts.filter(b => b.status === 'active');
        }

        // Sort: primary first, then newest
        accounts.sort((a, b) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return accounts.map(a => ({ ...a }));
    }

    async updateBankAccount(id, updates = {}) {
        const account = this.bankAccounts.find(b => b.id === id);
        if (!account) return null;

        const allowed = ['bank_name', 'branch_name', 'branch_code', 'account_name', 'account_type', 'status'];
        for (const key of allowed) {
            if (updates[key] !== undefined) {
                account[key] = updates[key];
            }
        }

        if (updates.account_number) {
            const raw = String(updates.account_number).trim();
            account.account_number = raw;
            account.account_number_masked = this.maskAccountNumber(raw);
        }

        if (updates.is_primary === true) {
            const existing = this.bankAccounts.filter(b => b.member_id === account.member_id);
            for (const acc of existing) {
                acc.is_primary = false;
            }
            account.is_primary = true;
        }

        account.updated_at = new Date().toISOString();
        return { ...account };
    }

    async setPrimaryBankAccount(memberId, bankAccountId) {
        const userId = this.resolveMemberUserId(memberId);
        const account = this.bankAccounts.find(b => b.id === bankAccountId && b.member_id === userId);
        if (!account) {
            throw new Error(`Bank Account ${bankAccountId} not found for this member.`);
        }
        if (account.status !== 'active') {
            throw new Error('Cannot set inactive bank account as primary.');
        }

        const existing = this.bankAccounts.filter(b => b.member_id === userId);
        for (const acc of existing) {
            acc.is_primary = (acc.id === bankAccountId);
            acc.updated_at = new Date().toISOString();
        }

        return { ...account, is_primary: true };
    }

    async deactivateBankAccount(id, memberId) {
        const userId = this.resolveMemberUserId(memberId);
        const account = this.bankAccounts.find(b => b.id === id && b.member_id === userId);
        if (!account) {
            throw new Error(`Bank Account ${id} not found for this member.`);
        }

        account.status = 'inactive';
        account.is_primary = false;
        account.updated_at = new Date().toISOString();

        // If this was primary, set another active account as primary if available
        const remaining = this.bankAccounts.filter(b => b.member_id === userId && b.status === 'active');
        if (remaining.length > 0 && !remaining.some(b => b.is_primary)) {
            remaining[0].is_primary = true;
            remaining[0].updated_at = new Date().toISOString();
        }

        await this.insertAuditLog({
            actor_id: userId,
            actor_role: 'member',
            action: 'BANK_ACCOUNT_DEACTIVATED',
            target_id: id,
            details: {
                bank_name: account.bank_name,
                account_number_masked: account.account_number_masked
            }
        });

        return { ...account };
    }

    // ============================================================
    // WITHDRAWALS REPOSITORY
    // ============================================================

    generateNextWithdrawalNumber() {
        const num = String(this.withdrawalCounter++).padStart(6, '0');
        return `NP-WD-${num}`;
    }

    async createWithdrawal(data) {
        const memberId = this.resolveMemberUserId(data.member_id || data.userId);
        if (!memberId) {
            throw new Error('Database Error: Member ID is required for withdrawal.');
        }

        const now = new Date().toISOString();
        const id = data.id || `wd-${crypto.randomUUID().slice(0, 8)}`;
        const withdrawalNumber = data.withdrawal_number || this.generateNextWithdrawalNumber();

        const requestedAmount = Math.round(parseFloat(data.requested_amount || data.amount) * 100) / 100;
        const feeAmount = Math.round(parseFloat(data.fee_amount || 0) * 100) / 100;
        const netAmount = Math.round((requestedAmount - feeAmount) * 100) / 100;

        const withdrawal = {
            id,
            withdrawal_number: withdrawalNumber,
            member_id: memberId,
            wallet_id: data.wallet_id,
            bank_account_id: data.bank_account_id,
            requested_amount: requestedAmount,
            amount: requestedAmount,
            fee_amount: feeAmount,
            net_amount: netAmount,
            currency: data.currency || 'LKR',
            status: data.status || 'pending',
            payment_method: data.payment_method || 'bank_transfer',
            bank_snapshot: data.bank_snapshot || {},
            member_note: data.member_note || null,
            admin_note: data.admin_note || null,
            rejection_reason: data.rejection_reason || null,
            approved_by: data.approved_by || null,
            approved_at: data.approved_at || null,
            paid_by: data.paid_by || null,
            paid_at: data.paid_at || null,
            payout_reference: data.payout_reference || null,
            payout_note: data.payout_note || null,
            ledger_entry_id: data.ledger_entry_id || null,
            created_at: now,
            updated_at: now
        };

        this.withdrawals.push(withdrawal);

        await this.insertAuditLog({
            actor_id: memberId,
            actor_role: 'member',
            action: 'WITHDRAWAL_CREATED',
            target_id: id,
            details: {
                withdrawal_number: withdrawalNumber,
                requested_amount: requestedAmount,
                net_amount: netAmount,
                currency: withdrawal.currency,
                bank_name: withdrawal.bank_snapshot.bank_name || 'N/A'
            }
        });

        return { ...withdrawal };
    }

    async getWithdrawalById(id) {
        const w = this.withdrawals.find(item => item.id === id);
        if (!w) return null;

        const profile = await this.findProfileByUserId(w.member_id);
        const user = await this.findUserById(w.member_id);

        return {
            ...w,
            member: {
                id: w.member_id,
                member_id: profile ? profile.member_id : 'UNKNOWN',
                full_name: profile ? profile.full_name : 'Unknown Member',
                email: user ? user.email : 'Unknown Email',
                account_status: profile ? profile.status : 'active'
            }
        };
    }

    async getWithdrawalByNumber(withdrawalNumber) {
        const w = this.withdrawals.find(item => item.withdrawal_number === withdrawalNumber);
        if (!w) return null;
        return this.getWithdrawalById(w.id);
    }

    async getMemberWithdrawals(memberId, options = {}) {
        const userId = this.resolveMemberUserId(memberId);
        let results = this.withdrawals.filter(w => w.member_id === userId);

        if (options.status) {
            results = results.filter(w => w.status === options.status);
        }

        // Sort by created_at desc
        results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const totalRecords = results.length;
        const page = Math.max(1, parseInt(options.page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(options.limit, 10) || 10));
        const startIndex = (page - 1) * limit;
        const paginated = results.slice(startIndex, startIndex + limit);

        return {
            withdrawals: paginated.map(w => ({ ...w })),
            pagination: {
                total_records: totalRecords,
                total_pages: Math.ceil(totalRecords / limit) || 1,
                current_page: page,
                limit
            }
        };
    }

    async getAllWithdrawals(options = {}) {
        let results = [...this.withdrawals];

        if (options.status) {
            results = results.filter(w => w.status === options.status);
        }

        if (options.currency) {
            results = results.filter(w => w.currency === options.currency);
        }

        if (options.search) {
            const q = String(options.search).toLowerCase().trim();
            results = results.filter(w => {
                const num = (w.withdrawal_number || '').toLowerCase();
                const ref = (w.payout_reference || '').toLowerCase();
                const bank = (w.bank_snapshot && w.bank_snapshot.bank_name || '').toLowerCase();
                return num.includes(q) || ref.includes(q) || bank.includes(q) || w.member_id.includes(q);
            });
        }

        if (options.minAmount !== undefined && options.minAmount !== '') {
            const min = parseFloat(options.minAmount);
            if (!isNaN(min)) results = results.filter(w => w.requested_amount >= min);
        }

        if (options.maxAmount !== undefined && options.maxAmount !== '') {
            const max = parseFloat(options.maxAmount);
            if (!isNaN(max)) results = results.filter(w => w.requested_amount <= max);
        }

        const dateFrom = options.date_from || options.dateFrom || options.period_start;
        if (dateFrom) {
            const fromTs = new Date(dateFrom).getTime();
            if (!isNaN(fromTs)) results = results.filter(w => new Date(w.created_at).getTime() >= fromTs);
        }
        const dateTo = options.date_to || options.dateTo || options.period_end;
        if (dateTo) {
            const toTs = new Date(dateTo).getTime();
            const isExclusive = !!options.period_end;
            if (!isNaN(toTs)) results = results.filter(w => isExclusive ? new Date(w.created_at).getTime() < toTs : new Date(w.created_at).getTime() <= toTs);
        }

        // Sort
        results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const totalRecords = results.length;
        const page = Math.max(1, parseInt(options.page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(options.limit, 10) || 10));
        const startIndex = (page - 1) * limit;
        const paginated = results.slice(startIndex, startIndex + limit);

        const enriched = await Promise.all(paginated.map(async w => {
            const profile = await this.findProfileByUserId(w.member_id);
            const user = await this.findUserById(w.member_id);
            return {
                ...w,
                member: {
                    id: w.member_id,
                    member_id: profile ? profile.member_id : 'UNKNOWN',
                    full_name: profile ? profile.full_name : 'Unknown Member',
                    email: user ? user.email : 'Unknown Email',
                    account_status: profile ? profile.status : 'active'
                }
            };
        }));

        return {
            withdrawals: enriched,
            pagination: {
                total_records: totalRecords,
                total_pages: Math.ceil(totalRecords / limit) || 1,
                current_page: page,
                limit
            }
        };
    }

    async updateWithdrawalStatus(id, newStatus, updates = {}) {
        const w = this.withdrawals.find(item => item.id === id);
        if (!w) return null;

        const previousStatus = w.status;
        w.status = newStatus;
        w.updated_at = new Date().toISOString();

        const fields = [
            'admin_note', 'rejection_reason', 'approved_by', 'approved_at',
            'paid_by', 'paid_at', 'payout_reference', 'payout_note', 'ledger_entry_id',
            'processing_at', 'rejected_at', 'cancelled_at', 'failed_at'
        ];
        for (const f of fields) {
            if (updates[f] !== undefined) {
                w[f] = updates[f];
            }
        }

        const now = w.updated_at;
        if (newStatus === 'approved' && !w.approved_at) w.approved_at = updates.approved_at || now;
        if (newStatus === 'processing' && !w.processing_at) w.processing_at = updates.processing_at || now;
        if (newStatus === 'paid' && !w.paid_at) w.paid_at = updates.paid_at || now;
        if (newStatus === 'rejected' && !w.rejected_at) w.rejected_at = updates.rejected_at || now;
        if (newStatus === 'cancelled' && !w.cancelled_at) w.cancelled_at = updates.cancelled_at || now;
        if (newStatus === 'failed' && !w.failed_at) w.failed_at = updates.failed_at || now;

        return { ...w, previous_status: previousStatus };
    }

    async getMemberReservedWithdrawalAmount(memberId) {
        const userId = this.resolveMemberUserId(memberId);
        const activeStatuses = ['pending', 'under_review', 'approved', 'processing'];
        const activeRequests = this.withdrawals.filter(w => 
            w.member_id === userId && activeStatuses.includes(w.status)
        );

        let totalCents = 0;
        for (const r of activeRequests) {
            totalCents += Math.round(parseFloat(r.requested_amount) * 100);
        }
        return totalCents / 100;
    }

    async getWithdrawalStats() {
        let totalCount = this.withdrawals.length;
        let pendingCount = 0, pendingAmount = 0;
        let underReviewCount = 0, underReviewAmount = 0;
        let approvedCount = 0, approvedAmount = 0;
        let processingCount = 0, processingAmount = 0;
        let paidCount = 0, paidAmount = 0;
        let rejectedCount = 0, rejectedAmount = 0;
        let cancelledCount = 0, cancelledAmount = 0;
        let failedCount = 0, failedAmount = 0;
        let totalRequestedAmount = 0;

        for (const w of this.withdrawals) {
            const req = Math.round(parseFloat(w.requested_amount) * 100);
            totalRequestedAmount += req;

            switch (w.status) {
                case 'pending':
                    pendingCount++;
                    pendingAmount += req;
                    break;
                case 'under_review':
                    underReviewCount++;
                    underReviewAmount += req;
                    break;
                case 'approved':
                    approvedCount++;
                    approvedAmount += req;
                    break;
                case 'processing':
                    processingCount++;
                    processingAmount += req;
                    break;
                case 'paid':
                    paidCount++;
                    paidAmount += req;
                    break;
                case 'rejected':
                    rejectedCount++;
                    rejectedAmount += req;
                    break;
                case 'cancelled':
                    cancelledCount++;
                    cancelledAmount += req;
                    break;
                case 'failed':
                    failedCount++;
                    failedAmount += req;
                    break;
            }
        }

        return {
            total_count: totalCount,
            total_withdrawals: totalCount,
            paid_count: paidCount,
            pending_count: pendingCount,
            under_review_count: underReviewCount,
            approved_count: approvedCount,
            processing_count: processingCount,
            rejected_count: rejectedCount,
            cancelled_count: cancelledCount,
            failed_count: failedCount,
            total_requested_amount: totalRequestedAmount / 100,
            total_paid_amount: paidAmount / 100,
            pending: { count: pendingCount, amount: pendingAmount / 100 },
            under_review: { count: underReviewCount, amount: underReviewAmount / 100 },
            approved: { count: approvedCount, amount: approvedAmount / 100 },
            processing: { count: processingCount, amount: processingAmount / 100 },
            paid: { count: paidCount, amount: paidAmount / 100 },
            rejected: { count: rejectedCount, amount: rejectedAmount / 100 },
            cancelled: { count: cancelledCount, amount: cancelledAmount / 100 },
            failed: { count: failedCount, amount: failedAmount / 100 }
        };
    }

    async getWithdrawalsReconciliation() {
        const discrepancies = [];
        const duplicateReferences = [];
        const seenPayoutRefs = new Map();

        // 1. Audit all paid withdrawals for matching ledger debit
        for (const w of this.withdrawals) {
            if (w.status === 'paid') {
                if (!w.ledger_entry_id) {
                    discrepancies.push({
                        type: 'MISSING_LEDGER_ENTRY_ID',
                        withdrawal_id: w.id,
                        withdrawal_number: w.withdrawal_number,
                        details: 'Withdrawal marked as paid but lacks ledger_entry_id'
                    });
                } else {
                    const entry = this.ledgerEntries.find(e => e.id === w.ledger_entry_id);
                    if (!entry) {
                        discrepancies.push({
                            type: 'ORPHAN_LEDGER_REFERENCE',
                            withdrawal_id: w.id,
                            ledger_entry_id: w.ledger_entry_id,
                            details: 'Referenced ledger entry not found in financial journal'
                        });
                    } else if (entry.direction !== 'DEBIT' || entry.amount !== w.requested_amount) {
                        discrepancies.push({
                            type: 'LEDGER_AMOUNT_MISMATCH',
                            withdrawal_id: w.id,
                            expected_amount: w.requested_amount,
                            ledger_amount: entry.amount,
                            ledger_direction: entry.direction
                        });
                    }
                }

                if (!w.payout_reference) {
                    discrepancies.push({
                        type: 'MISSING_PAYOUT_REFERENCE',
                        withdrawal_id: w.id,
                        details: 'Paid withdrawal lacks external payout reference'
                    });
                } else {
                    if (seenPayoutRefs.has(w.payout_reference)) {
                        duplicateReferences.push({
                            payout_reference: w.payout_reference,
                            withdrawal_id: w.id,
                            conflicting_id: seenPayoutRefs.get(w.payout_reference)
                        });
                    } else {
                        seenPayoutRefs.set(w.payout_reference, w.id);
                    }
                }
            }
        }

        // 2. Audit all ledger debits with entry_type = 'withdrawal'
        const withdrawalDebits = this.ledgerEntries.filter(e => 
            e.entry_type === 'withdrawal' && e.reference_type === 'withdrawal' && (e.metadata?.payout_reference || e.metadata?.withdrawal_number)
        );
        for (const debit of withdrawalDebits) {
            const w = this.withdrawals.find(item => item.id === debit.reference_id);
            if (!w) {
                discrepancies.push({
                    type: 'ORPHAN_WITHDRAWAL_DEBIT',
                    ledger_entry_id: debit.id,
                    reference_id: debit.reference_id,
                    amount: debit.amount,
                    details: 'Ledger debit for withdrawal has no matching withdrawal record'
                });
            } else if (w.status !== 'paid' && w.status !== 'reversed' && w.status !== 'failed') {
                discrepancies.push({
                    type: 'DEBITED_NON_PAID_WITHDRAWAL',
                    withdrawal_id: w.id,
                    withdrawal_status: w.status,
                    ledger_entry_id: debit.id,
                    details: `Withdrawal has ledger debit but status is '${w.status}' (must be paid)`
                });
            }
        }

        const missingLedgerEntries = discrepancies.filter(d => d.type === 'MISSING_LEDGER_ENTRY_ID');
        const orphanLedgerReferences = discrepancies.filter(d => d.type === 'ORPHAN_WITHDRAWAL_DEBIT');
        const duplicatePayoutReferences = duplicateReferences;
        const negativeAvailableBalanceMembers = [];

        const paidCount = this.withdrawals.filter(w => w.status === 'paid').length;
        const activeReservationsCount = this.withdrawals.filter(w => ['pending', 'under_review', 'approved', 'processing'].includes(w.status)).length;
        const rejectedCount = this.withdrawals.filter(w => w.status === 'rejected').length;
        const failedCount = this.withdrawals.filter(w => w.status === 'failed').length;
        const cancelledCount = this.withdrawals.filter(w => w.status === 'cancelled').length;

        return {
            timestamp: new Date().toISOString(),
            audit_timestamp: new Date().toISOString(),
            total_withdrawals_audited: this.withdrawals.length,
            total_withdrawals_analyzed: this.withdrawals.length,
            total_withdrawal_debits_audited: withdrawalDebits.length,
            missing_ledger_entries: missingLedgerEntries,
            duplicate_payout_references: duplicatePayoutReferences,
            orphan_ledger_references: orphanLedgerReferences,
            negative_available_balance_members: negativeAvailableBalanceMembers,
            discrepancy_count: discrepancies.length,
            duplicate_payout_references_count: duplicateReferences.length,
            discrepancies,
            duplicate_references: duplicateReferences,
            summary: {
                total_paid: paidCount,
                total_active_reservations: activeReservationsCount,
                total_rejected: rejectedCount,
                total_failed: failedCount,
                total_cancelled: cancelledCount
            },
            healthy: discrepancies.length === 0 && duplicateReferences.length === 0
        };
    }

    seedRanks() {
        const now = new Date().toISOString();
        this.ranks = [
            {
                id: 'rank-member',
                code: 'MEMBER',
                name: 'Member',
                slug: 'member',
                description: 'Baseline entry-level member standing upon registration.',
                display_order: 0,
                status: 'active',
                icon: 'user',
                color_token: '#94A3B8',
                badge_style: 'nexus-badge-muted',
                created_at: now,
                updated_at: now
            },
            {
                id: 'rank-01',
                code: 'RANK_01',
                name: 'Rank 1',
                slug: 'rank-1',
                description: 'First tier performance achievement. Configuration required.',
                display_order: 1,
                status: 'active',
                icon: 'star',
                color_token: '#008DDA',
                badge_style: 'nexus-badge-accent',
                created_at: now,
                updated_at: now
            },
            {
                id: 'rank-02',
                code: 'RANK_02',
                name: 'Rank 2',
                slug: 'rank-2',
                description: 'Second tier performance achievement. Configuration required.',
                display_order: 2,
                status: 'active',
                icon: 'award',
                color_token: '#10B981',
                badge_style: 'nexus-badge-success',
                created_at: now,
                updated_at: now
            },
            {
                id: 'rank-03',
                code: 'RANK_03',
                name: 'Rank 3',
                slug: 'rank-3',
                description: 'Third tier performance achievement. Configuration required.',
                display_order: 3,
                status: 'active',
                icon: 'shield',
                color_token: '#F59E0B',
                badge_style: 'nexus-badge-warning',
                created_at: now,
                updated_at: now
            },
            {
                id: 'rank-04',
                code: 'RANK_04',
                name: 'Rank 4',
                slug: 'rank-4',
                description: 'Fourth tier performance achievement. Configuration required.',
                display_order: 4,
                status: 'active',
                icon: 'zap',
                color_token: '#8B5CF6',
                badge_style: 'nexus-badge-purple',
                created_at: now,
                updated_at: now
            },
            {
                id: 'rank-founder',
                code: 'FOUNDER',
                name: 'Corporate Founder',
                slug: 'founder',
                description: 'Reserved corporate founder leadership standing.',
                display_order: 5,
                status: 'active',
                icon: 'crown',
                color_token: '#F1C40F',
                badge_style: 'nexus-badge-gold',
                created_at: now,
                updated_at: now
            }
        ];

        this.rankRuleVersions = [
            {
                id: 'rrv-baseline-v1',
                version: 'v1.0',
                version_code: 'v1.0',
                name: 'Baseline Nexus Prime Qualification Rules',
                description: 'Initial versioned qualification framework. Production criteria: CONFIGURATION REQUIRED.',
                effective_from: '2026-01-01T00:00:00.000Z',
                effective_to: null,
                status: 'active',
                is_active: true,
                created_by: 'system',
                created_at: now,
                updated_at: now
            }
        ];
    }

    // ============================================================
    // RANK & QUALIFICATION REPOSITORY (PROMPT 14)
    // ============================================================

    async createRank(data) {
        const code = String(data.code || '').trim().toUpperCase();
        if (!code) throw new Error('Rank code is required.');
        if (this.ranks.some(r => r.code === code)) {
            throw new Error(`Rank code '${code}' already exists.`);
        }

        const name = String(data.name || '').trim();
        if (!name) throw new Error('Rank name is required.');

        const slug = String(data.slug || code.toLowerCase().replace(/[^a-z0-9]/g, '-'));
        if (this.ranks.some(r => r.slug === slug)) {
            throw new Error(`Rank slug '${slug}' already exists.`);
        }

        const now = new Date().toISOString();
        const id = data.id || `rank-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const displayOrder = parseInt(data.display_order !== undefined ? data.display_order : this.ranks.length, 10);

        const newRank = {
            id,
            code,
            name,
            slug,
            description: data.description || '',
            display_order: isNaN(displayOrder) ? this.ranks.length : displayOrder,
            status: data.status || 'active',
            icon: data.icon || 'star',
            color_token: data.color_token || '#008DDA',
            badge_style: data.badge_style || 'nexus-badge-accent',
            created_at: now,
            updated_at: now
        };

        this.ranks.push(newRank);
        this.ranks.sort((a, b) => a.display_order - b.display_order);
        return newRank;
    }

    async getRankById(id) {
        return this.ranks.find(r => r.id === id) || null;
    }

    async getRankByCode(code) {
        if (!code) return null;
        const normalized = String(code).trim().toUpperCase();
        return this.ranks.find(r => r.code.toUpperCase() === normalized) || null;
    }

    async getAllRanks(options = {}) {
        let list = [...this.ranks];
        if (options.status && options.status !== 'all') {
            list = list.filter(r => r.status === options.status);
        }
        list.sort((a, b) => a.display_order - b.display_order);
        return list;
    }

    async updateRank(id, data) {
        const rank = await this.getRankById(id);
        if (!rank) throw new Error(`Rank '${id}' not found.`);

        if (data.name) rank.name = String(data.name).trim();
        if (data.description !== undefined) rank.description = data.description;
        if (data.display_order !== undefined) {
            rank.display_order = parseInt(data.display_order, 10);
            this.ranks.sort((a, b) => a.display_order - b.display_order);
        }
        if (data.status) rank.status = data.status;
        if (data.icon) rank.icon = data.icon;
        if (data.color_token) rank.color_token = data.color_token;
        if (data.badge_style) rank.badge_style = data.badge_style;
        rank.updated_at = new Date().toISOString();
        return rank;
    }

    async createRankRuleVersion(data) {
        const version = String(data.version || data.version_code || '').trim();
        if (!version) throw new Error('Rule version string is required (e.g. v1.0).');
        if (this.rankRuleVersions.some(v => v.version === version || v.version_code === version)) {
            throw new Error(`Rank rule version '${version}' already exists.`);
        }

        const now = new Date().toISOString();
        const id = data.id || `rrv-${version.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const isActive = data.is_active !== undefined ? Boolean(data.is_active) : ((data.status || 'active') === 'active');
        
        if (isActive) {
            // Archive previous active versions
            for (const v of this.rankRuleVersions) {
                if (v.status === 'active') {
                    v.status = 'archived';
                    v.is_active = false;
                }
            }
        }

        const newVersion = {
            id,
            version,
            version_code: version,
            name: data.name || `Rule Version ${version}`,
            description: data.description || '',
            effective_from: data.effective_from ? new Date(data.effective_from).toISOString() : now,
            effective_to: data.effective_to ? new Date(data.effective_to).toISOString() : null,
            status: isActive ? 'active' : (data.status || 'archived'),
            is_active: isActive,
            created_by: data.created_by || 'admin',
            created_at: now,
            updated_at: now
        };

        this.rankRuleVersions.push(newVersion);
        return newVersion;
    }

    async getRankRuleVersions(options = {}) {
        let list = [...this.rankRuleVersions];
        if (options.status && options.status !== 'all') {
            list = list.filter(v => v.status === options.status);
        }
        list.sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime());
        return list;
    }

    async getActiveRankRuleVersion(atDate = new Date()) {
        const targetTime = new Date(atDate).getTime();
        const active = this.rankRuleVersions.filter(v => {
            if (v.status !== 'active') return false;
            const fromTime = new Date(v.effective_from).getTime();
            if (targetTime < fromTime) return false;
            if (v.effective_to) {
                const toTime = new Date(v.effective_to).getTime();
                if (targetTime > toTime) return false;
            }
            return true;
        });
        active.sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime());
        return active[0] || this.rankRuleVersions[0] || null;
    }

    async createRankRequirement(data) {
        if (!data.rank_id) throw new Error('rank_id is required.');
        if (!data.rule_version_id) throw new Error('rule_version_id is required.');
        const metricType = data.metric_type || data.requirement_type;
        if (!metricType) throw new Error('metric_type / requirement_type is required.');

        const now = new Date().toISOString();
        const id = data.id || `req-${crypto.randomUUID().slice(0, 8)}`;
        const operator = data.comparison_operator || data.operator || '>=';
        const periodType = data.evaluation_period || data.period_type || 'lifetime';

        const req = {
            id,
            rank_id: data.rank_id,
            rule_version_id: data.rule_version_id,
            metric_type: metricType,
            requirement_type: metricType,
            operator: operator,
            comparison_operator: operator,
            target_value: parseFloat(data.target_value !== undefined ? data.target_value : 0),
            target_value_string: data.target_value_string || String(data.target_value || ''),
            period_type: periodType,
            evaluation_period: periodType,
            period_value: parseInt(data.period_value || 0, 10),
            grace_period_days: parseInt(data.grace_period_days || 0, 10),
            description: data.description || '',
            is_required: data.is_required !== false,
            weight: parseFloat(data.weight || 1.00),
            config: data.config || {},
            created_at: now,
            updated_at: now
        };

        this.rankRequirements.push(req);
        return req;
    }

    async getRankRequirements(options = {}) {
        let list = [...this.rankRequirements];
        if (options.rank_id) {
            list = list.filter(r => r.rank_id === options.rank_id);
        }
        if (options.rule_version_id) {
            list = list.filter(r => r.rule_version_id === options.rule_version_id);
        }
        return list;
    }

    async calculateMemberPersonalVolume(userId, options = {}) {
        const resolvedId = this.resolveMemberUserId(userId);
        if (!resolvedId) return 0;

        let qualifyingOrders = this.orders.filter(o => 
            o.user_id === resolvedId &&
            (o.status === 'paid' || o.status === 'completed') &&
            o.payment_status === 'paid'
        );

        if (options.period_type === 'monthly') {
            const now = options.reference_date ? new Date(options.reference_date) : new Date();
            const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();
            const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)).getTime();
            qualifyingOrders = qualifyingOrders.filter(o => {
                const t = new Date(o.created_at).getTime();
                return t >= startOfMonth && t <= endOfMonth;
            });
        } else if (options.period_type === 'rolling_period' && options.period_value > 0) {
            const now = options.reference_date ? new Date(options.reference_date) : new Date();
            const threshold = now.getTime() - (options.period_value * 24 * 60 * 60 * 1000);
            qualifyingOrders = qualifyingOrders.filter(o => new Date(o.created_at).getTime() >= threshold);
        }

        const volumeRatio = parseFloat(options.volume_ratio || 1.00);
        const total = qualifyingOrders.reduce((sum, o) => sum + (parseFloat(o.total !== undefined ? o.total : (o.total_amount || 0)) * volumeRatio), 0);
        return Math.round(total * 100) / 100;
    }

    async calculateMemberTeamVolume(userId, options = {}) {
        const resolvedId = this.resolveMemberUserId(userId);
        if (!resolvedId) return 0;

        // Fetch downline IDs from network closure
        let closure = this.networkClosure.filter(c => c.ancestor_id === resolvedId && c.depth_distance > 0);
        if (options.max_depth) {
            closure = closure.filter(c => c.depth_distance <= options.max_depth);
        }
        const downlineIds = new Set(closure.map(c => c.descendant_id));
        if (downlineIds.size === 0) return 0;

        let qualifyingOrders = this.orders.filter(o => 
            downlineIds.has(o.user_id) &&
            (o.status === 'paid' || o.status === 'completed') &&
            o.payment_status === 'paid'
        );

        if (options.period_type === 'monthly') {
            const now = options.reference_date ? new Date(options.reference_date) : new Date();
            const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();
            const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)).getTime();
            qualifyingOrders = qualifyingOrders.filter(o => {
                const t = new Date(o.created_at).getTime();
                return t >= startOfMonth && t <= endOfMonth;
            });
        } else if (options.period_type === 'rolling_period' && options.period_value > 0) {
            const now = options.reference_date ? new Date(options.reference_date) : new Date();
            const threshold = now.getTime() - (options.period_value * 24 * 60 * 60 * 1000);
            qualifyingOrders = qualifyingOrders.filter(o => new Date(o.created_at).getTime() >= threshold);
        }

        const volumeRatio = parseFloat(options.volume_ratio || 1.00);
        const total = qualifyingOrders.reduce((sum, o) => sum + (parseFloat(o.total !== undefined ? o.total : (o.total_amount || 0)) * volumeRatio), 0);
        return Math.round(total * 100) / 100;
    }

    async calculateMemberDirectReferrals(userId) {
        const resolvedId = this.resolveMemberUserId(userId);
        if (!resolvedId) return { total: 0, active: 0 };

        const directs = this.networkClosure.filter(c => c.ancestor_id === resolvedId && c.depth_distance === 1);
        let total = 0;
        let active = 0;

        for (const d of directs) {
            const prof = this.memberProfiles.find(p => p.user_id === d.descendant_id);
            if (prof) {
                total++;
                const hasPackage = prof.package_status && prof.package_status !== 'NONE' && prof.package_status !== 'INACTIVE';
                if (prof.status === 'active' && hasPackage) {
                    active++;
                }
            }
        }
        return { total, active };
    }

    async calculateMemberNetworkSize(userId) {
        const resolvedId = this.resolveMemberUserId(userId);
        if (!resolvedId) return { total: 0, active: 0 };

        const downlines = this.networkClosure.filter(c => c.ancestor_id === resolvedId && c.depth_distance > 0);
        let total = 0;
        let active = 0;

        for (const d of downlines) {
            const prof = this.memberProfiles.find(p => p.user_id === d.descendant_id);
            if (prof) {
                total++;
                const hasPackage = prof.package_status && prof.package_status !== 'NONE' && prof.package_status !== 'INACTIVE';
                if (prof.status === 'active' && hasPackage) {
                    active++;
                }
            }
        }
        return { total, active };
    }

    async setMemberRank(userId, newRankCode) {
        const resolvedId = this.resolveMemberUserId(userId);
        const profile = this.memberProfiles.find(p => p.user_id === resolvedId);
        if (!profile) throw new Error(`Member profile '${userId}' not found.`);
        const previousRank = profile.rank || profile.current_rank || 'MEMBER';
        profile.rank = String(newRankCode).toUpperCase();
        profile.current_rank = profile.rank;
        profile.updated_at = new Date().toISOString();

        const user = this.users.find(u => u.id === resolvedId);
        if (user) {
            user.rank = profile.rank;
            user.current_rank = profile.rank;
            user.updated_at = profile.updated_at;
        }
        return { previousRank, newRank: profile.rank };
    }

    async insertMemberRankHistory(data) {
        const now = new Date().toISOString();
        const id = data.id || `rh-${String(this.rankHistoryCounter++).padStart(6, '0')}`;
        
        let snapshotId = data.snapshot_id || null;
        if (data.snapshot && !snapshotId) {
            snapshotId = `snap-${id}`;
            this.memberMetricSnapshots.push({
                id: snapshotId,
                member_id: data.member_id,
                rank_id: data.rank_id,
                rule_version_id: data.rule_version_id || null,
                qualification_period: data.qualification_period || 'lifetime',
                metrics: data.snapshot.metrics || data.snapshot,
                captured_at: now
            });
        }

        const record = {
            id,
            member_id: data.member_id,
            rank_id: data.rank_id,
            previous_rank_id: data.previous_rank_id || null,
            rule_version_id: data.rule_version_id || null,
            snapshot_id: snapshotId,
            qualification_period: data.qualification_period || 'lifetime',
            qualified_at: data.qualified_at ? new Date(data.qualified_at).toISOString() : now,
            effective_at: data.effective_at ? new Date(data.effective_at).toISOString() : now,
            reason: data.reason || 'qualification_evaluation',
            snapshot: data.snapshot || {},
            created_by: data.created_by || 'system',
            created_at: now
        };

        this.memberRankHistory.push(record);
        return record;
    }

    async getMemberRankHistory(userId, options = {}) {
        const resolvedId = this.resolveMemberUserId(userId);
        let list = this.memberRankHistory.filter(h => h.member_id === resolvedId);
        list.sort((a, b) => new Date(b.qualified_at).getTime() - new Date(a.qualified_at).getTime());

        const page = parseInt(options.page || 1, 10);
        const limit = parseInt(options.limit || 20, 10);
        const startIndex = (page - 1) * limit;
        const paged = list.slice(startIndex, startIndex + limit);

        const enriched = paged.map(h => {
            const rank = this.ranks.find(r => r.id === h.rank_id || r.code === h.rank_id);
            const prevRank = h.previous_rank_id ? this.ranks.find(r => r.id === h.previous_rank_id || r.code === h.previous_rank_id) : null;
            return {
                ...h,
                rank_name: rank ? rank.name : h.rank_id,
                rank_code: rank ? rank.code : h.rank_id,
                badge_style: rank ? rank.badge_style : 'nexus-badge-muted',
                color_token: rank ? rank.color_token : '#94A3B8',
                icon: rank ? rank.icon : 'medal',
                previous_rank_name: prevRank ? prevRank.name : (h.previous_rank_id || 'None'),
                previous_rank_code: prevRank ? prevRank.code : (h.previous_rank_code || h.previous_rank_id || 'MEMBER')
            };
        });

        const pagination = {
            total: list.length,
            page,
            limit,
            pages: Math.ceil(list.length / limit) || 1
        };

        enriched.history = enriched;
        enriched.pagination = pagination;

        return enriched;
    }

    async getLatestMemberRankHistory(userId) {
        const resolvedId = this.resolveMemberUserId(userId);
        const history = this.memberRankHistory
            .filter(h => h.member_id === resolvedId)
            .sort((a, b) => new Date(b.qualified_at).getTime() - new Date(a.qualified_at).getTime());
        return history[0] || null;
    }

    async getRankPerformanceDirectory(options = {}) {
        let profiles = [...this.memberProfiles];

        if (options.rank) {
            const rankCode = String(options.rank).trim().toUpperCase();
            profiles = profiles.filter(p => (p.rank || 'MEMBER').toUpperCase() === rankCode);
        }
        if (options.status && options.status !== 'all') {
            profiles = profiles.filter(p => p.status === options.status);
        }
        if (options.search) {
            const q = String(options.search).trim().toLowerCase();
            profiles = profiles.filter(p => 
                (p.member_id && p.member_id.toLowerCase().includes(q)) ||
                (p.full_name && p.full_name.toLowerCase().includes(q)) ||
                (p.email && p.email.toLowerCase().includes(q))
            );
        }

        const page = parseInt(options.page || 1, 10);
        const limit = parseInt(options.limit || 15, 10);
        const total = profiles.length;
        const startIndex = (page - 1) * limit;
        const pagedProfiles = profiles.slice(startIndex, startIndex + limit);

        const rows = [];
        for (const p of pagedProfiles) {
            const rankCode = p.rank || 'MEMBER';
            const rankObj = this.ranks.find(r => r.code === rankCode) || {
                name: rankCode,
                code: rankCode,
                color_token: '#94A3B8',
                badge_style: 'nexus-badge-muted'
            };
            const directs = await this.calculateMemberDirectReferrals(p.user_id);
            const pv = await this.calculateMemberPersonalVolume(p.user_id);
            const tv = await this.calculateMemberTeamVolume(p.user_id);
            const latestHistory = await this.getLatestMemberRankHistory(p.user_id);

            rows.push({
                user_id: p.user_id,
                member_id: p.member_id,
                full_name: p.full_name,
                email: p.email,
                status: p.status,
                package_status: p.package_status || 'NONE',
                rank: rankCode,
                current_rank: rankCode,
                rank_name: rankObj.name,
                rank_color: rankObj.color_token,
                rank_badge: rankObj.badge_style,
                rank_since: latestHistory ? latestHistory.qualified_at : p.registration_date,
                direct_referrals: directs.total,
                active_direct_referrals: directs.active,
                personal_volume: pv,
                team_volume: tv,
                last_evaluated_at: latestHistory ? latestHistory.created_at : p.registration_date
            });
        }

        return {
            members: rows,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit) || 1
            }
        };
    }

    // ------------------------------------------------------------
    // Financial Reporting & Reconciliation (Prompt 15)
    // ------------------------------------------------------------
    async insertReconciliationIssue(data) {
        const now = new Date().toISOString();
        const id = data.id || `rec-${String(this.reconciliationCounter++).padStart(6, '0')}`;
        const issue = {
            id,
            issue_code: data.issue_code || data.code || 'REC-GENERAL',
            code: data.code || data.issue_code || 'REC-GENERAL',
            title: data.title || data.issue_code || data.code || 'Reconciliation Issue',
            severity: data.severity || 'MEDIUM', // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
            description: data.description,
            affected_entity_type: data.affected_entity_type || 'general',
            affected_entity_id: data.affected_entity_id || id,
            expected_relationship: data.expected_relationship || data.expected_summary || '',
            actual_relationship: data.actual_relationship || data.actual_summary || '',
            expected_state: data.expected_state || {},
            actual_state: data.actual_state || {},
            detected_at: data.detected_at || now,
            status: data.status || 'open', // 'open', 'investigating', 'resolved', 'ignored'
            resolution_notes: data.resolution_notes || null,
            resolved_by: data.resolved_by || null,
            resolved_at: data.resolved_at || null,
            created_at: now,
            updated_at: now
        };
        this.reconciliationIssues.push(issue);
        return { ...issue };
    }

    async getReconciliationIssues(options = {}) {
        let results = [...this.reconciliationIssues];
        if (options.status && options.status !== 'all') {
            results = results.filter(i => i.status === options.status);
        }
        if (options.severity && options.severity !== 'all') {
            results = results.filter(i => i.severity === options.severity);
        }
        if (options.issue_code) {
            results = results.filter(i => i.issue_code === options.issue_code);
        }
        if (options.search) {
            const q = options.search.toLowerCase().trim();
            results = results.filter(i => 
                (i.id && i.id.toLowerCase().includes(q)) ||
                (i.issue_code && i.issue_code.toLowerCase().includes(q)) ||
                (i.description && i.description.toLowerCase().includes(q)) ||
                (i.affected_entity_id && i.affected_entity_id.toLowerCase().includes(q))
            );
        }

        // Sort descending by detected_at
        results.sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at));

        const total = results.length;
        const page = Math.max(1, parseInt(options.page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(options.limit, 10) || 20));
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const paged = results.slice(startIndex, startIndex + limit);

        const summary = {
            total_issues: this.reconciliationIssues.length,
            open_count: this.reconciliationIssues.filter(i => i.status === 'open').length,
            investigating_count: this.reconciliationIssues.filter(i => i.status === 'investigating').length,
            resolved_count: this.reconciliationIssues.filter(i => i.status === 'resolved').length,
            ignored_count: this.reconciliationIssues.filter(i => i.status === 'ignored').length,
            critical_count: this.reconciliationIssues.filter(i => i.severity === 'CRITICAL').length,
            high_count: this.reconciliationIssues.filter(i => i.severity === 'HIGH').length
        };

        return {
            issues: paged,
            pagination: { total, page, limit, totalPages, total_records: total, total_pages: totalPages, current_page: page },
            summary
        };
    }

    async getReconciliationIssueById(id) {
        return this.reconciliationIssues.find(i => i.id === id) || null;
    }

    async updateReconciliationIssueStatus(id, newStatus, resolutionNotes = '', resolvedBy = 'admin') {
        const issue = this.reconciliationIssues.find(i => i.id === id);
        if (!issue) throw new Error(`Reconciliation issue '${id}' not found.`);

        const validStatuses = ['open', 'investigating', 'resolved', 'ignored'];
        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Invalid status '${newStatus}'. Allowed: ${validStatuses.join(', ')}`);
        }

        issue.status = newStatus;
        if (resolutionNotes) {
            issue.resolution_notes = issue.resolution_notes 
                ? `${issue.resolution_notes}\n[${new Date().toISOString()} by ${resolvedBy}]: ${resolutionNotes}`
                : `[${new Date().toISOString()} by ${resolvedBy}]: ${resolutionNotes}`;
        }
        if (newStatus === 'resolved' || newStatus === 'ignored') {
            issue.resolved_by = resolvedBy;
            issue.resolved_at = new Date().toISOString();
        }
        issue.updated_at = new Date().toISOString();

        // Audit log emission
        await this.insertAuditLog({
            action: 'RECONCILIATION_ISSUE_UPDATED',
            entity_type: 'nexus_financial_reconciliation_issues',
            entity_id: issue.id,
            actor_id: resolvedBy,
            payload: {
                issue_code: issue.issue_code,
                new_status: newStatus,
                resolution_notes: resolutionNotes
            }
        });

        return { ...issue };
    }

    // =========================================================================
    // PROMPT 19: Membership Activation & Central Eligibility Repository Methods
    // =========================================================================

    seedMembershipRules() {
        this.activationRules = [
            {
                id: 'ar-default-01',
                rule_code: 'VERIFIED_PACKAGE_PAYMENT',
                name: 'Verified Package Payment Activation Rule',
                description: 'Requires verified gateway or approved deposit payment for an active catalog package tier.',
                enabled: true,
                priority: 1,
                requires_verified_payment: true,
                requires_package_order: true,
                requires_kyc_approved: false,
                requires_active_account: true,
                rule_version: '1.0.0',
                created_at: new Date().toISOString()
            },
            {
                id: 'ar-admin-01',
                rule_code: 'ADMIN_MANUAL_ACTIVATION',
                name: 'Admin Authorized Manual Activation Rule',
                description: 'Permits authorized compliance administrator to manually activate a membership with audit reason.',
                enabled: true,
                priority: 2,
                requires_verified_payment: false,
                requires_package_order: false,
                requires_kyc_approved: false,
                requires_active_account: true,
                rule_version: '1.0.0',
                created_at: new Date().toISOString()
            }
        ];

        this.eligibilityRules = [
            {
                id: 'er-mlm-01',
                rule_type: 'mlm',
                rule_code: 'MLM_ACTIVE_MEMBERSHIP',
                name: 'MLM Network Placement Qualification',
                conditions_json: { requires_active_account: true, requires_active_membership: true },
                enabled: true,
                rule_version: '1.0.0',
                created_at: new Date().toISOString()
            },
            {
                id: 'er-comm-01',
                rule_type: 'commission',
                rule_code: 'COMMISSION_BENEFICIARY_ACTIVE',
                name: 'Commission Earning Qualification',
                conditions_json: { requires_active_account: true, requires_active_membership: true, requires_active_package: true, prevent_self_referral: true },
                enabled: true,
                rule_version: '1.0.0',
                created_at: new Date().toISOString()
            },
            {
                id: 'er-with-01',
                rule_type: 'withdrawal',
                rule_code: 'WITHDRAWAL_COMPLIANCE_GATE',
                name: 'Bank Payout Compliance Gate',
                conditions_json: { requires_active_account: true, requires_verified_kyc: true, requires_active_bank: true },
                enabled: true,
                rule_version: '1.0.0',
                created_at: new Date().toISOString()
            }
        ];
    }

    async getMembershipByMemberId(memberId) {
        if (!memberId) return null;
        const normalizedMemberId = this.resolveMemberUserId(memberId);
        let m = this.memberships.find(item => item.member_id === normalizedMemberId);
        if (!m) {
            // Check if profile exists; return default not_activated state
            const profile = await this.findProfileByUserId(normalizedMemberId);
            if (!profile) return null;
            m = {
                id: 'mship-' + normalizedMemberId.slice(-8),
                member_id: normalizedMemberId,
                package_id: null,
                package_code: 'NONE',
                status: 'not_activated',
                activation_order_id: null,
                activation_payment_id: null,
                activated_at: null,
                expires_at: null,
                last_re_evaluated_at: null,
                rule_version: '1.0.0',
                metadata: {},
                created_at: profile.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            this.memberships.push(m);
        }
        return m;
    }

    async createOrUpdateMembership(data) {
        const normalizedMemberId = this.resolveMemberUserId(data.member_id);
        const idx = this.memberships.findIndex(m => m.member_id === normalizedMemberId);
        const now = new Date().toISOString();
        if (idx >= 0) {
            const existing = this.memberships[idx];
            let pkgCode = data.package_code || existing.package_code;
            if (!pkgCode || pkgCode === 'NONE') {
                if (data.package_id) {
                    const p = this.packages.find(pkg => pkg.id === data.package_id || pkg.package_code === data.package_id);
                    pkgCode = p ? p.package_code : 'STANDARD';
                }
            }
            const updated = {
                ...existing,
                ...data,
                package_code: pkgCode || existing.package_code || 'NONE',
                member_id: normalizedMemberId,
                updated_at: now
            };
            this.memberships[idx] = updated;
            return updated;
        } else {
            let pkgCode = data.package_code;
            if (!pkgCode && data.package_id) {
                const p = this.packages.find(pkg => pkg.id === data.package_id || pkg.package_code === data.package_id);
                pkgCode = p ? p.package_code : 'STANDARD';
            }
            const newItem = {
                id: data.id || 'mship-' + crypto.randomBytes(8).toString('hex'),
                member_id: normalizedMemberId,
                package_id: data.package_id || null,
                package_code: pkgCode || 'NONE',
                status: data.status || 'not_activated',
                activation_order_id: data.activation_order_id || null,
                activation_payment_id: data.activation_payment_id || null,
                activated_at: data.activated_at || null,
                expires_at: data.expires_at || null,
                last_re_evaluated_at: now,
                rule_version: data.rule_version || '1.0.0',
                metadata: data.metadata || {},
                created_at: now,
                updated_at: now
            };
            this.memberships.push(newItem);
            return newItem;
        }
    }

    async addMembershipHistory(data) {
        const prev = data.previous_status !== undefined ? data.previous_status : (data.from_status !== undefined ? data.from_status : null);
        const next = data.new_status !== undefined ? data.new_status : (data.to_status !== undefined ? data.to_status : 'active');
        const trigger = data.trigger_event || data.source_type || 'STATUS_UPDATE';
        const entry = {
            id: 'mhist-' + crypto.randomBytes(8).toString('hex'),
            member_id: this.resolveMemberUserId(data.member_id),
            membership_id: data.membership_id,
            previous_status: prev,
            from_status: prev,
            new_status: next,
            to_status: next,
            trigger_event: trigger,
            reason_code: data.reason_code || 'STATUS_CHANGE',
            source_type: data.source_type || trigger, // order_payment, admin_action, refund, system_expiry
            source_id: data.source_id || null,
            notes: data.notes || '',
            changed_by: data.changed_by || data.actor_id || 'system',
            rule_version: data.rule_version || '1.0.0',
            created_at: new Date().toISOString()
        };
        this.membershipHistory.unshift(entry);
        return entry;
    }

    async getMembershipHistory(memberId) {
        const normalizedMemberId = this.resolveMemberUserId(memberId);
        return this.membershipHistory
            .filter(h => h.member_id === normalizedMemberId)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    async getActivationRules() {
        return [...this.activationRules];
    }

    async getEligibilityRules(ruleType = null) {
        if (ruleType) {
            return this.eligibilityRules.filter(r => r.rule_type === ruleType && r.enabled);
        }
        return this.eligibilityRules.filter(r => r.enabled);
    }

    async getMembershipStats() {
        const now = new Date().toISOString();
        const totalMembers = this.memberProfiles.length;
        let activeCount = 0;
        let pendingCount = 0;
        let suspendedCount = 0;
        let expiredCount = 0;

        for (const p of this.memberProfiles) {
            const m = this.memberships.find(item => item.member_id === p.user_id);
            const status = m ? m.status : 'not_activated';
            if (status === 'active') activeCount++;
            else if (status === 'pending_activation') pendingCount++;
            else if (status === 'suspended') suspendedCount++;
            else if (status === 'expired') expiredCount++;
        }

        // KYC Blockers: Active memberships with unverified KYC
        const kycBlockers = this.memberProfiles.filter(p => {
            const m = this.memberships.find(item => item.member_id === p.user_id);
            const isActive = m && m.status === 'active';
            const kycUnverified = p.verification_status !== 'verified';
            return isActive && kycUnverified;
        }).length;

        // Payment Blockers: Orders awaiting payment
        const paymentBlockers = this.orders.filter(o => o.status === 'awaiting_payment' || o.payment_status === 'pending').length;

        // Ineligible counts
        const withdrawalIneligibleCount = this.memberProfiles.filter(p => p.verification_status !== 'verified').length;
        const commissionIneligibleCount = this.memberProfiles.filter(p => {
            const m = this.memberships.find(item => item.member_id === p.user_id);
            return !m || m.status !== 'active';
        }).length;

        return {
            total_memberships: this.memberships.length,
            totalMembers,
            activeMembers: activeCount,
            pendingActivation: pendingCount,
            suspendedMembers: suspendedCount,
            expiredMembers: expiredCount,
            by_status: {
                active: activeCount,
                not_activated: totalMembers - (activeCount + pendingCount + suspendedCount + expiredCount),
                pending_activation: pendingCount,
                suspended: suspendedCount,
                expired: expiredCount,
                cancelled: this.memberships.filter(m => m.status === 'cancelled').length
            },
            kycBlockers,
            paymentBlockers,
            withdrawalIneligibleCount,
            commissionIneligibleCount
        };
    }

    async getMembershipReconciliationIssues() {
        const issues = [];
        const now = new Date().toISOString();

        // 1. Paid package order but membership not active
        for (const order of this.orders) {
            if (order.order_type === 'package' && (order.status === 'paid' || order.status === 'completed')) {
                const m = this.memberships.find(item => item.member_id === order.user_id);
                if (!m || m.status !== 'active') {
                    issues.push({
                        code: 'PAID_ORDER_MEMBERSHIP_INACTIVE',
                        issue_code: 'PAID_ORDER_MEMBERSHIP_INACTIVE',
                        severity: 'high',
                        member_id: order.user_id,
                        order_id: order.id,
                        order_number: order.order_number,
                        details: `Order ${order.order_number} is paid but membership status is '${m ? m.status : 'not_activated'}'.`,
                        detected_at: now
                    });
                }
            }
        }

        // 2. Active membership linked to refunded or cancelled order
        for (const m of this.memberships) {
            if (m.status === 'active' && m.activation_order_id) {
                const order = this.orders.find(o => o.id === m.activation_order_id);
                if (order && (order.status === 'refunded' || order.status === 'cancelled')) {
                    issues.push({
                        code: 'ACTIVE_MEMBERSHIP_REFUNDED_ORDER',
                        issue_code: 'ACTIVE_MEMBERSHIP_REFUNDED_ORDER',
                        severity: 'critical',
                        member_id: m.member_id,
                        membership_id: m.id,
                        order_id: order.id,
                        order_number: order.order_number,
                        details: `Membership is active but activation order ${order.order_number} has status '${order.status}'.`,
                        detected_at: now
                    });
                }
            }
        }

        // 3. Withdrawal eligible member with unverified KYC
        const kycRequiredSetting = this.settings.get('kyc_required_for_withdrawal') === 'true';
        if (kycRequiredSetting) {
            for (const p of this.memberProfiles) {
                if (p.verification_status !== 'verified') {
                    const activeWithdrawal = this.withdrawals.find(w => w.user_id === p.user_id && w.status === 'paid');
                    if (activeWithdrawal) {
                        issues.push({
                            code: 'PAYOUT_TO_UNVERIFIED_MEMBER',
                            issue_code: 'PAYOUT_TO_UNVERIFIED_MEMBER',
                            severity: 'medium',
                            member_id: p.user_id,
                            withdrawal_id: activeWithdrawal.id,
                            details: `Member received payout ${activeWithdrawal.payout_number} while verification status is '${p.verification_status || 'unverified'}'.`,
                            detected_at: now
                        });
                    }
                }
            }
        }

        // 4. Suspended account but membership is active
        for (const p of this.memberProfiles) {
            if (p.status === 'suspended' || p.status === 'blocked' || p.status === 'inactive') {
                const m = this.memberships.find(item => item.member_id === p.user_id);
                if (m && m.status === 'active') {
                    issues.push({
                        code: 'SUSPENDED_ACCOUNT_ACTIVE_MEMBERSHIP',
                        issue_code: 'SUSPENDED_ACCOUNT_ACTIVE_MEMBERSHIP',
                        severity: 'high',
                        member_id: p.user_id,
                        membership_id: m.id,
                        details: `Member account status is '${p.status}' but membership status is 'active'.`,
                        detected_at: now
                    });
                }
            }
        }

        issues.total_issues = issues.length;
        issues.issues = issues;
        return issues;
    }

    // Test Reset Utility
    resetForTesting() {
        this.memberIdCounter = 1;
        this.orderCounter = 1;
        this.paymentCounter = 1;
        this.commissionCounter = 1;
        this.ledgerCounter = 1;
        this.withdrawalCounter = 1;
        this.rankHistoryCounter = 1;
        this.reconciliationCounter = 1;
        this.reconciliationIssues = [];
        this.memberships = [];
        this.membershipHistory = [];
        this.activationRules = [];
        this.eligibilityRules = [];
        this.activeSessions.clear();
        this.passwordResetTokens.clear();
        this.initStore();
        this.seedMembershipRules();
    }
}

// Global Singleton Instance
const nexusDb = new NexusDatabase();

module.exports = nexusDb;
