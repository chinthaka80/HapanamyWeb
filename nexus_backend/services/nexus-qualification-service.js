// ==============================================================================
// NEXUS PRIME (PVT) LTD — QUALIFICATION ENGINE SERVICE
// DOMAIN: nexusp.online
// ==============================================================================

/**
 * Qualification engine for evaluating member eligibility for direct referrals
 * and multi-level team overrides under versioned commission plan rules.
 */
class NexusQualificationService {
    /**
     * Determines whether a beneficiary member qualifies to receive commission for a transaction.
     * 
     * @param {Object} beneficiaryProfile - The profile of the member eligible to receive commission.
     * @param {Object} qualificationRules - Rules configured in the active commission plan.
     * @param {Object} context - Transaction context { purchaserId, orderId, orderTotal, level, commissionType }.
     * @returns {Object} { eligible: boolean, reason?: string }
     */
    static isMemberEligibleForCommission(beneficiaryProfile, qualificationRules = {}, context = {}) {
        if (!beneficiaryProfile) {
            return { eligible: false, reason: 'Beneficiary profile not found.' };
        }

        // 1. Anti-Abuse: Self-Referral Prevention
        if (context.purchaserId && beneficiaryProfile.user_id === context.purchaserId) {
            return {
                eligible: false,
                reason: 'Anti-Abuse Safeguard: Self-referral commission is strictly prohibited.'
            };
        }

        // 2. Account Status Check (Default: required active)
        const requiresActiveAccount = qualificationRules.requires_active_account !== false;
        if (requiresActiveAccount) {
            if (beneficiaryProfile.status !== 'active') {
                return {
                    eligible: false,
                    reason: `Beneficiary account status is '${beneficiaryProfile.status || 'inactive'}'. Active account status required.`
                };
            }
        }

        // 2b. Membership Status Check (Prompt 19 Engine Integration)
        const nexusDb = require('../db/nexus-db');
        if (nexusDb.memberships) {
            const membership = nexusDb.memberships.find(m => m.member_id === beneficiaryProfile.user_id);
            if (membership && membership.status !== 'active') {
                return {
                    eligible: false,
                    reason: `Beneficiary membership status is '${membership.status}'. Active membership required.`
                };
            }
        }

        // 3. Active Package Standing Check
        const requiresActivePackage = qualificationRules.requires_active_package !== false;
        if (requiresActivePackage) {
            const pkgStatus = beneficiaryProfile.package_status || '';
            const hasPackage = pkgStatus && pkgStatus !== 'NONE' && pkgStatus !== 'INACTIVE';
            if (!hasPackage) {
                return {
                    eligible: false,
                    reason: 'Beneficiary does not hold an active membership package standing.'
                };
            }
        }

        // 4. Minimum Rank Requirement Check (Optional)
        if (qualificationRules.minimum_rank) {
            const ranks = ['MEMBER', 'BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'FOUNDER'];
            const requiredIndex = ranks.indexOf(qualificationRules.minimum_rank.toUpperCase());
            const memberIndex = ranks.indexOf((beneficiaryProfile.rank || 'MEMBER').toUpperCase());

            if (memberIndex === -1 || memberIndex < requiredIndex) {
                return {
                    eligible: false,
                    reason: `Beneficiary rank '${beneficiaryProfile.rank || 'MEMBER'}' does not meet required rank '${qualificationRules.minimum_rank}'.`
                };
            }
        }

        return { eligible: true };
    }
}

module.exports = NexusQualificationService;
