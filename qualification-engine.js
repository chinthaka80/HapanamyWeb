// Hapanamy.lk Configurable Member Qualification Engine (STEP 16)
// Production-grade rule-driven qualification evaluation, real-time lifecycle tracking,
// historical decision snapshots, and admin configuration.

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

        const user = users.find(u => u.id === userId || u.username === userId) || { id: userId, username: userId, status: 'ACTIVE' };
        const kycDoc = kycDocs.find(d => d.user_id === userId);
        const kycStatus = kycDoc ? kycDoc.status : 'NOT_SUBMITTED';

        const unmetRequirements = [];

        // 1. Account Suspension Check
        const isSuspended = user.status === 'SUSPENDED' || user.status === 'BANNED';
        if (isSuspended && !rule.allow_suspended) {
            unmetRequirements.push('Account is SUSPENDED or BANNED.');
        }

        // 2. Active Account Check
        const isActiveAccount = user.status === 'ACTIVE' || user.status === 'Active';
        if (rule.require_active_account && !isActiveAccount && !isSuspended) {
            unmetRequirements.push(`Account status is ${user.status} (Requires ACTIVE).`);
        }

        // 3. KYC Approval Check
        const isKycApproved = kycStatus === 'APPROVED' || kycStatus === 'VERIFIED';
        if (rule.require_approved_kyc && !isKycApproved) {
            unmetRequirements.push(`KYC identity status is ${kycStatus} (Requires APPROVED).`);
        }

        // 4. Product Purchase Check
        const activePurchases = purchases.filter(p => p.user_id === userId && p.status === 'ACTIVE');
        const hasRequiredPurchases = activePurchases.length >= (rule.min_active_purchases || 1);
        if (rule.require_product_purchase && !hasRequiredPurchases) {
            unmetRequirements.push(`Has ${activePurchases.length} active product purchase(s) (Requires at least ${rule.min_active_purchases || 1}).`);
        }

        // 5. Direct Sponsoring Left and Right Activity Check
        const directSponsoredRecords = sponsors.filter(s => s.sponsor_id === userId);
        const leftDirects = [];
        const rightDirects = [];

        for (const record of directSponsoredRecords) {
            const downlinePurchases = purchases.filter(p => p.user_id === record.user_id && p.status === 'ACTIVE');
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
            leftBv = volumeLedger.filter(v => v.user_id === userId && v.leg === 'LEFT').reduce((s, v) => s + (v.amount || 0), 0);
            rightBv = volumeLedger.filter(v => v.user_id === userId && v.leg === 'RIGHT').reduce((s, v) => s + (v.amount || 0), 0);
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
        } else if (kycStatus === 'PENDING' || !hasRequiredPurchases) {
            finalStatus = 'PENDING';
        } else if (unmetRequirements.length === 0) {
            finalStatus = 'QUALIFIED';
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
            rule_version: rule.rule_version,
            evaluated_at: new Date().toISOString(),
            inputs: {
                user_status: user.status,
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
