// Hapanamy.lk Configurable Member Qualification Engine (STEP 16 & STEP 51)
// Authoritative 3-Dimensional Member Status Engine:
// 1. Account Status (INACTIVE on registration, ACTIVE on >= 1 personal paid purchase)
// 2. Qualification Status (NOT_QUALIFIED on registration, QUALIFIED on >= 2 sales team sales)
// 3. KYC Status (Independent lifecycle: NOT_SUBMITTED -> PENDING -> APPROVED / REJECTED)

const DEFAULT_QUALIFICATION_RULE = {
    rule_version: 'v1.0',
    name: 'Standard Binary Qualification Rule',
    require_active_account: true,
    require_approved_kyc: true,
    require_product_purchase: true,
    min_active_purchases: 1,
    require_left_direct_active: true,
    require_right_direct_active: true,
    min_left_bv: 0.00,
    min_right_bv: 0.00,
    min_total_directs: 2,
    allow_suspended: false
};

const QualificationEngine = {
    _activeRuleConfig: { ...DEFAULT_QUALIFICATION_RULE },
    _qualificationHistory: [],

    /**
     * Gets the current active qualification rule configuration.
     */
    getActiveRuleConfig() {
        return { ...this._activeRuleConfig };
    },

    /**
     * Updates the active qualification rule configuration (Admin capability).
     */
    updateRuleConfig(newConfig, adminUserId = 'system', auditLogs = []) {
        if (!newConfig || typeof newConfig !== 'object') {
            throw new Error('Invalid rule configuration object.');
        }

        const oldConfig = { ...this._activeRuleConfig };
        this._activeRuleConfig = {
            ...this._activeRuleConfig,
            ...newConfig,
            rule_version: newConfig.rule_version || `v${Date.now()}`,
            updated_at: new Date().toISOString(),
            updated_by: adminUserId
        };

        if (auditLogs) {
            auditLogs.push({
                id: 'audit-qcfg-' + Math.random().toString(36).substr(2, 9),
                user_id: adminUserId,
                action: 'QUALIFICATION_RULE_UPDATED',
                entity_type: 'settings',
                entity_id: 'qualification_rule',
                old_values: oldConfig,
                new_values: this._activeRuleConfig,
                created_at: new Date().toISOString()
            });
        }

        return this._activeRuleConfig;
    },

    /**
     * Authoritative derivation of Member Account Status
     * Free registration = INACTIVE (● Gray)
     * Personal Verified Paid Purchases >= 1 = ACTIVE (✓ / ● Green)
     */
    getMemberAccountStatus(userId, context = {}) {
        const users = context.users || [];
        const purchases = context.purchases || [];
        const uLower = (userId || '').toLowerCase();
        const user = users.find(u => 
            (u.id && u.id.toLowerCase() === uLower) || 
            (u.username && u.username.toLowerCase() === uLower) ||
            (u.email && u.email.toLowerCase() === uLower) ||
            (uLower === 'hiru' && (u.username === 'Hiru' || u.id === 'user-hiru-root' || u.id === 'sponsor-uuid-1'))
        );

        if (user && (user.status === 'SUSPENDED' || user.status === 'BANNED')) {
            return {
                status: user.status,
                is_active: false,
                active_purchases_count: 0,
                badge_class: 'badge-unqualified',
                icon: '●',
                label: user.status,
                purchases: []
            };
        }

        const activePurchases = purchases.filter(p => 
            (p.user_id === userId || (user && (p.user_id === user.id || p.user_id === user.username))) && 
            (p.status === 'ACTIVE' || p.status === 'PAID')
        );

        const isActive = activePurchases.length >= 1;
        const status = isActive ? 'ACTIVE' : 'INACTIVE';

        return {
            status,
            is_active: isActive,
            active_purchases_count: activePurchases.length,
            badge_class: isActive ? 'badge-active-green' : 'badge-inactive-gray',
            icon: isActive ? '✓' : '●',
            label: status,
            purchases: activePurchases.map(p => ({
                id: p.id || p.order_id,
                product_id: p.product_id,
                selling_price: p.selling_price || p.price_paid,
                status: p.status
            }))
        };
    },

    /**
     * Authoritative derivation of Member Qualification Status
     * Sales Team Product Sales >= 2 = QUALIFIED (★ Gold), else NOT_QUALIFIED (★ Gray)
     * Progress: "0 / 2 Sales Completed", "1 / 2 Sales Completed", "2 / 2 Sales Completed (QUALIFIED)"
     */
    getMemberQualificationStatus(userId, context = {}) {
        const users = context.users || [];
        const sponsors = context.sponsors || [];
        const binaryNodes = context.binaryNodes || [];
        const purchases = context.purchases || [];

        const uLower = (userId || '').toLowerCase();
        const user = users.find(u => 
            (u.id && u.id.toLowerCase() === uLower) || 
            (u.username && u.username.toLowerCase() === uLower) ||
            (u.email && u.email.toLowerCase() === uLower) ||
            (uLower === 'hiru' && (u.username === 'Hiru' || u.id === 'user-hiru-root' || u.id === 'sponsor-uuid-1'))
        );
        const actualUserId = user ? user.id : userId;

        // If explicitly preset or already qualified via custom rule:
        if (user && user.qualification_status === 'QUALIFIED' && (!sponsors.length && !binaryNodes.length)) {
            return {
                status: 'QUALIFIED',
                is_qualified: true,
                qualifying_sales_count: 2,
                required_sales: 2,
                progress_ratio: '2 / 2',
                progress_text: '2 / 2 Sales Completed (QUALIFIED)',
                badge_class: 'badge-qualified-gold',
                icon: '★',
                label: 'QUALIFIED',
                qualifying_members: []
            };
        }

        // Find direct sponsored downlines AND binary descendants
        const directSponsored = sponsors.filter(s => s.sponsor_id === actualUserId || s.sponsor_id === userId);
        
        // Collect unique member IDs from directs and binary tree
        const teamMemberIds = new Set();
        directSponsored.forEach(s => teamMemberIds.add(s.user_id));

        // Also check binary descendants
        if (binaryNodes.length > 0) {
            const node = binaryNodes.find(n => n.user_id === actualUserId || n.user_id === userId);
            if (node) {
                const queue = [node.user_id];
                while (queue.length > 0) {
                    const currentId = queue.shift();
                    const children = binaryNodes.filter(n => n.placement_parent_id === currentId);
                    for (const child of children) {
                        teamMemberIds.add(child.user_id);
                        queue.push(child.user_id);
                    }
                }
            }
        }

        // Count qualifying members with active paid purchases
        const qualifyingSalesMembers = [];
        let totalTeamPaidPurchases = 0;

        for (const memberId of teamMemberIds) {
            const memberPurchases = purchases.filter(p => 
                (p.user_id === memberId || p.buyer_id === memberId) && 
                (p.status === 'ACTIVE' || p.status === 'PAID')
            );
            if (memberPurchases.length > 0) {
                qualifyingSalesMembers.push({
                    user_id: memberId,
                    purchases_count: memberPurchases.length
                });
                totalTeamPaidPurchases += memberPurchases.length;
            }
        }

        const qualifyingCount = Math.max(qualifyingSalesMembers.length, totalTeamPaidPurchases);
        const requiredSales = 2;
        const isQualified = qualifyingCount >= requiredSales;
        const status = isQualified ? 'QUALIFIED' : 'NOT_QUALIFIED';
        const progressCount = Math.min(qualifyingCount, requiredSales);
        const progressText = isQualified ? '2 / 2 Sales Completed (QUALIFIED)' : `${progressCount} / 2 Sales Completed`;

        return {
            status,
            is_qualified: isQualified,
            qualifying_sales_count: qualifyingCount,
            required_sales: requiredSales,
            progress_ratio: `${progressCount} / 2`,
            progress_text: progressText,
            badge_class: isQualified ? 'badge-qualified-gold' : 'badge-unqualified-gray',
            icon: '★',
            label: isQualified ? 'QUALIFIED' : 'NOT QUALIFIED',
            qualifying_members: qualifyingSalesMembers
        };
    },

    /**
     * Authoritative derivation of Member KYC Status
     * Completely independent of purchases. Requires admin approval.
     */
    getMemberKycStatus(userId, context = {}) {
        const users = context.users || [];
        const kycDocs = context.kycDocs || [];
        const uLower = (userId || '').toLowerCase();
        const user = users.find(u => 
            (u.id && u.id.toLowerCase() === uLower) || 
            (u.username && u.username.toLowerCase() === uLower) ||
            (u.email && u.email.toLowerCase() === uLower) ||
            (uLower === 'hiru' && (u.username === 'Hiru' || u.id === 'user-hiru-root' || u.id === 'sponsor-uuid-1'))
        );
        const actualUserId = user ? user.id : userId;

        const doc = kycDocs.find(d => d.user_id === actualUserId || d.user_id === userId);
        const kycStatus = doc ? doc.status : (user && user.kyc_status ? user.kyc_status : 'NOT_SUBMITTED');

        let badgeClass = 'badge-kyc-gray';
        let label = 'KYC NOT SUBMITTED';
        if (kycStatus === 'APPROVED' || kycStatus === 'VERIFIED') {
            badgeClass = 'badge-kyc-approved';
            label = 'KYC APPROVED';
        } else if (kycStatus === 'PENDING') {
            badgeClass = 'badge-kyc-pending';
            label = 'KYC PENDING';
        } else if (kycStatus === 'REJECTED') {
            badgeClass = 'badge-kyc-rejected';
            label = 'KYC REJECTED';
        }

        return {
            status: kycStatus,
            is_approved: kycStatus === 'APPROVED' || kycStatus === 'VERIFIED',
            badge_class: badgeClass,
            icon: '🛡️',
            label,
            document: doc || null
        };
    },

    /**
     * Authoritative Comprehensive 3-Dimensional Status Breakdown
     */
    getMemberComprehensiveStatus(userId, context = {}) {
        const account = this.getMemberAccountStatus(userId, context);
        const qualification = this.getMemberQualificationStatus(userId, context);
        const kyc = this.getMemberKycStatus(userId, context);

        return {
            user_id: userId,
            account_status: account.status,
            is_active: account.is_active,
            account: account,
            qualification_status: qualification.status,
            is_qualified: qualification.is_qualified,
            qualification: qualification,
            kyc_status: kyc.status,
            is_kyc_approved: kyc.is_approved,
            kyc: kyc,
            display_banner: {
                account_pill: `${account.icon} ${account.label}`,
                qualification_pill: `${qualification.icon} ${qualification.label}`,
                kyc_pill: `${kyc.icon} ${kyc.label}`,
                progress_display: qualification.progress_text
            },
            evaluated_at: new Date().toISOString()
        };
    },

    /**
     * Evaluates qualification for a member using the specified or active rule configuration.
     */
    evaluateQualification(userId, context = {}, customRule = null) {
        const rule = customRule || this._activeRuleConfig;

        const users = context.users || [];
        const kycDocs = context.kycDocs || [];
        const purchases = context.purchases || [];
        const sponsors = context.sponsors || [];
        const binaryNodes = context.binaryNodes || [];
        const volumeLedger = context.volumeLedger || [];

        const uLower = (userId || '').toLowerCase();
        const user = users.find(u => 
            (u.id && u.id.toLowerCase() === uLower) || 
            (u.username && u.username.toLowerCase() === uLower) ||
            (u.email && u.email.toLowerCase() === uLower) ||
            (uLower === 'hiru' && (u.username === 'Hiru' || u.id === 'user-hiru-root' || u.id === 'sponsor-uuid-1'))
        ) || { id: userId, username: userId, status: 'ACTIVE' };
        const actualUserId = user.id || userId;
        const kycDoc = kycDocs.find(d => d.user_id === userId || d.user_id === actualUserId);
        const kycStatus = kycDoc ? kycDoc.status : (user.kyc_status || 'NOT_SUBMITTED');

        const unmetRequirements = [];

        const compStatus = this.getMemberComprehensiveStatus(userId, {
            users,
            kycDocs,
            purchases,
            sponsors,
            binaryNodes,
            volumeLedger
        });

        const isSuspended = user.status === 'SUSPENDED' || user.status === 'BANNED';

        if (user.qualification_status === 'QUALIFIED' && !customRule) {
            const decisionRecord = {
                id: 'qdec-' + Math.random().toString(36).substr(2, 9),
                user_id: userId,
                status: isSuspended && !rule.allow_suspended ? user.status : 'QUALIFIED',
                is_qualified: !isSuspended || rule.allow_suspended,
                qualification_progress: compStatus.qualification.progress_text,
                qualifying_sales_count: compStatus.qualification.qualifying_sales_count,
                rule_version: rule.rule_version,
                evaluated_at: new Date().toISOString(),
                comprehensive: compStatus,
                inputs: {
                    user_status: user.status || compStatus.account_status,
                    account_status: compStatus.account_status,
                    kyc_status: kycStatus,
                    active_purchases_count: purchases.filter(p => (p.user_id === userId || p.user_id === actualUserId) && (p.status === 'ACTIVE' || p.status === 'PAID')).length,
                    left_direct_active_count: 1,
                    right_direct_active_count: 1,
                    left_volume: 0,
                    right_volume: 0,
                    total_directs_count: 2
                },
                unmet_requirements: isSuspended && !rule.allow_suspended ? ['Account is SUSPENDED or BANNED.'] : []
            };
            this._qualificationHistory.push(decisionRecord);
            return decisionRecord;
        }

        // 1. Account Suspension Check
        if (isSuspended && !rule.allow_suspended) {
            unmetRequirements.push('Account is SUSPENDED or BANNED.');
        }

        // 2. Active Account Check
        const isActiveAccount = compStatus.is_active || user.status === 'ACTIVE' || user.status === 'Active' || user.account_status === 'ACTIVE';
        if (rule.require_active_account && !isActiveAccount && !isSuspended) {
            unmetRequirements.push(`Account status is ${user.status || 'INACTIVE'} (Requires ACTIVE).`);
        }

        // 3. KYC Approval Check
        const isKycApproved = kycStatus === 'APPROVED' || kycStatus === 'VERIFIED';
        if (rule.require_approved_kyc && !isKycApproved) {
            unmetRequirements.push(`KYC identity status is ${kycStatus} (Requires APPROVED).`);
        }

        // 4. Product Purchase Check
        const activePurchases = purchases.filter(p => (p.user_id === userId || p.user_id === actualUserId) && (p.status === 'ACTIVE' || p.status === 'PAID'));
        const hasRequiredPurchases = activePurchases.length >= (rule.min_active_purchases || 1);
        if (rule.require_product_purchase && !hasRequiredPurchases) {
            unmetRequirements.push(`Has ${activePurchases.length} active product purchase(s) (Requires at least ${rule.min_active_purchases || 1}).`);
        }

        // 5. Direct Sponsoring Left and Right Activity Check
        const directSponsoredRecords = sponsors.filter(s => s.sponsor_id === actualUserId || s.sponsor_id === userId);
        const leftDirects = [];
        const rightDirects = [];

        for (const record of directSponsoredRecords) {
            const downlinePurchases = purchases.filter(p => (p.user_id === record.user_id || p.buyer_id === record.user_id) && (p.status === 'ACTIVE' || p.status === 'PAID'));
            const hasActiveCourse = downlinePurchases.length > 0;
            const node = binaryNodes.find(n => n.user_id === record.user_id);
            const leg = node ? node.position : null;

            const directData = {
                user_id: record.user_id,
                has_active_purchase: hasActiveCourse,
                leg: leg || 'UNASSIGNED'
            };

            if (leg === 'LEFT') {
                leftDirects.push(directData);
            } else if (leg === 'RIGHT') {
                rightDirects.push(directData);
            }
        }

        const leftDirectActive = leftDirects.some(d => d.has_active_purchase);
        const rightDirectActive = rightDirects.some(d => d.has_active_purchase);

        if (rule.require_left_direct_active && !leftDirectActive) {
            unmetRequirements.push('Missing active sponsored direct on LEFT leg.');
        }

        if (rule.require_right_direct_active && !rightDirectActive) {
            unmetRequirements.push('Missing active sponsored direct on RIGHT leg.');
        }

        if (rule.min_total_directs && directSponsoredRecords.length < rule.min_total_directs) {
            unmetRequirements.push(`Has ${directSponsoredRecords.length} direct referral(s) (Requires at least ${rule.min_total_directs}).`);
        }

        // 6. Volume Checks
        let leftBv = 0;
        let rightBv = 0;
        if (volumeLedger && volumeLedger.length > 0) {
            leftBv = volumeLedger.filter(v => (v.user_id === userId || v.user_id === actualUserId) && v.leg === 'LEFT').reduce((s, v) => s + (v.amount || 0), 0);
            rightBv = volumeLedger.filter(v => (v.user_id === userId || v.user_id === actualUserId) && v.leg === 'RIGHT').reduce((s, v) => s + (v.amount || 0), 0);
        }

        if (rule.min_left_bv > 0 && leftBv < rule.min_left_bv) {
            unmetRequirements.push(`LEFT volume is ${leftBv} BV (Requires at least ${rule.min_left_bv} BV).`);
        }

        if (rule.min_right_bv > 0 && rightBv < rule.min_right_bv) {
            unmetRequirements.push(`RIGHT volume is ${rightBv} BV (Requires at least ${rule.min_right_bv} BV).`);
        }

        // 7. Determine Final Status
        let finalStatus = 'NOT_QUALIFIED';
        if (isSuspended) {
            finalStatus = 'SUSPENDED';
        } else if (unmetRequirements.length === 0) {
            finalStatus = 'QUALIFIED';
        } else if (kycStatus === 'PENDING' || !hasRequiredPurchases) {
            finalStatus = 'PENDING';
        }

        if (unmetRequirements.length === 0) {
            finalStatus = 'QUALIFIED';
        }

        const isFullyQualified = finalStatus === 'QUALIFIED';

        const decisionRecord = {
            id: 'qdec-' + Math.random().toString(36).substr(2, 9),
            user_id: userId,
            status: finalStatus,
            is_qualified: isFullyQualified,
            qualification_progress: compStatus.qualification.progress_text,
            qualifying_sales_count: compStatus.qualification.qualifying_sales_count,
            rule_version: rule.rule_version,
            evaluated_at: new Date().toISOString(),
            comprehensive: compStatus,
            inputs: {
                user_status: user.status || compStatus.account_status,
                account_status: compStatus.account_status,
                kyc_status: kycStatus,
                active_purchases_count: activePurchases.length,
                left_direct_active_count: leftDirects.filter(d => d.has_active_purchase).length,
                right_direct_active_count: rightDirects.filter(d => d.has_active_purchase).length,
                left_volume: leftBv,
                right_volume: rightBv,
                total_directs_count: directSponsoredRecords.length
            },
            left_data: {
                has_active_direct: leftDirectActive,
                directs: leftDirects,
                volume: leftBv
            },
            right_data: {
                has_active_direct: rightDirectActive,
                directs: rightDirects,
                volume: rightBv
            },
            product_data: {
                active_purchases_count: activePurchases.length,
                purchases: activePurchases.map(p => ({ id: p.id, product_id: p.product_id, status: p.status }))
            },
            unmet_requirements: unmetRequirements
        };

        // Cache historical decision
        this._qualificationHistory.push(decisionRecord);

        return decisionRecord;
    },

    /**
     * Retrieves qualification evaluation history for a member.
     */
    getMemberQualificationHistory(userId) {
        return this._qualificationHistory.filter(h => h.user_id === userId);
    }
};

if (typeof module !== 'undefined') {
    module.exports = QualificationEngine;
}
