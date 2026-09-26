/**
 * NEXUS PRIME (PVT) LTD — PROMPT 19
 * Centralized Account & Member Eligibility Engine
 * 
 * Safety & Architecture:
 * - Single source of truth for business eligibility.
 * - Prevents fragmented/inconsistent eligibility logic across modules.
 * - Machine-readable reason codes (ACCOUNT_SUSPENDED, MEMBERSHIP_NOT_ACTIVE, KYC_REQUIRED, etc.)
 * - Consumed by Commission Engine, Withdrawal Engine, and Member/Admin Dashboards.
 */

'use strict';

const nexusDb = require('../db/nexus-db');
const NexusConfig = require('../config/nexus-config');

class NexusEligibilityEngine {
    /**
     * Centralized Full Member Eligibility Evaluation (All Pillars)
     */
    async evaluateMemberEligibility(memberId) {
        const userId = nexusDb.resolveMemberUserId(memberId);
        const user = await nexusDb.findUserById(userId);
        const profile = await nexusDb.findProfileByUserId(userId);
        const membership = await nexusDb.getMembershipByMemberId(userId);
        const now = new Date().toISOString();

        if (!user || !profile) {
            return {
                memberId: userId,
                accountEligible: { eligible: false, reason_code: 'ACCOUNT_NOT_FOUND', message: 'Member account record not found.' },
                membershipEligible: { eligible: false, reason_code: 'ACCOUNT_NOT_FOUND', message: 'Member profile record not found.' },
                mlmEligible: { eligible: false, reason_code: 'ACCOUNT_NOT_FOUND', message: 'Member record not found.' },
                commissionEligible: { eligible: false, reason_code: 'ACCOUNT_NOT_FOUND', message: 'Member record not found.' },
                withdrawalEligible: { eligible: false, reason_code: 'ACCOUNT_NOT_FOUND', message: 'Member record not found.' },
                rankEligible: { eligible: false, reason_code: 'ACCOUNT_NOT_FOUND', message: 'Member record not found.' },
                reasons: ['Member record not found in system.'],
                warnings: [],
                checkedAt: now,
                ruleVersion: '1.0.0'
            };
        }

        const reasons = [];
        const warnings = [];

        // 1. Account Standing Check
        const accountStatus = profile.status || 'pending';
        const isAccountActive = accountStatus === 'active';
        let accountReasonCode = null;
        let accountMessage = 'Account is in good standing.';

        if (!isAccountActive) {
            accountReasonCode = accountStatus === 'suspended' ? 'ACCOUNT_SUSPENDED'
                : (accountStatus === 'deactivated' ? 'ACCOUNT_DEACTIVATED'
                : (accountStatus === 'closed' ? 'ACCOUNT_CLOSED' : 'ACCOUNT_PENDING'));
            accountMessage = `Account status is '${accountStatus}'. Active standing required.`;
            reasons.push(accountMessage);
        }

        const accountEligible = {
            eligible: isAccountActive,
            status: accountStatus,
            reason_code: accountReasonCode,
            message: accountMessage
        };

        // 2. Membership Standing Check
        const membershipStatus = membership ? membership.status : 'not_activated';
        const isMembershipActive = membershipStatus === 'active';
        let membershipReasonCode = null;
        let membershipMessage = 'Membership is active.';

        if (!isMembershipActive) {
            membershipReasonCode = membershipStatus === 'suspended' ? 'MEMBERSHIP_SUSPENDED'
                : (membershipStatus === 'expired' ? 'MEMBERSHIP_EXPIRED'
                : (membershipStatus === 'cancelled' ? 'MEMBERSHIP_CANCELLED' : 'MEMBERSHIP_NOT_ACTIVE'));
            membershipMessage = `Membership status is '${membershipStatus}'. Active package membership required.`;
            reasons.push(membershipMessage);
        }

        const membershipEligible = {
            eligible: isMembershipActive,
            status: membershipStatus,
            packageCode: membership ? membership.package_code : (profile.package_status || 'NONE'),
            reason_code: membershipReasonCode,
            message: membershipMessage
        };

        // 3. MLM Network Eligibility
        const mlmCheck = await this.checkMlmEligibility(userId);
        if (!mlmCheck.eligible && mlmCheck.reason_code && !reasons.includes(mlmCheck.message)) {
            reasons.push(mlmCheck.message);
        }

        // 4. Commission Earning Eligibility
        const commissionCheck = await this.checkCommissionEligibility(userId);
        if (!commissionCheck.eligible && commissionCheck.reason_code && !reasons.includes(commissionCheck.message)) {
            reasons.push(commissionCheck.message);
        }

        // 5. Withdrawal Eligibility
        const withdrawalCheck = await this.checkWithdrawalEligibility(userId);
        if (!withdrawalCheck.eligible && withdrawalCheck.reason_code && !reasons.includes(withdrawalCheck.message)) {
            reasons.push(withdrawalCheck.message);
        }

        // 6. Rank Recognition Eligibility
        const rankEligible = {
            eligible: isAccountActive && isMembershipActive,
            reason_code: (!isAccountActive || !isMembershipActive) ? 'RANK_INELIGIBLE' : null,
            message: (isAccountActive && isMembershipActive) ? 'Eligible for rank recognition and progression.' : 'Active membership required for rank recognition.'
        };

        // Check for helpful warnings (e.g. pending KYC review)
        if (profile.verification_status === 'pending' || profile.verification_status === 'under_review') {
            warnings.push('Identity verification documents are currently under compliance review.');
        }

        const pillars = {
            mlm: mlmCheck,
            commissions: commissionCheck,
            withdrawals: withdrawalCheck,
            rank: rankEligible
        };
        const standing = {
            account_status: profile.status,
            membership_status: membership ? membership.status : 'not_activated',
            kyc_status: profile.verification_status || 'not_started',
            package_tier: (membership && membership.status === 'active') ? (membership.package_code || 'STANDARD') : 'NONE'
        };
        const actionRequired = reasons.length > 0;

        return {
            memberId: userId,
            standing,
            pillars,
            action_required: actionRequired,
            blockers: reasons,
            accountEligible,
            membershipEligible,
            mlmEligible: mlmCheck,
            commissionEligible: commissionCheck,
            withdrawalEligible: withdrawalCheck,
            rankEligible,
            kycStatus: profile.verification_status || 'not_started',
            reasons,
            warnings,
            checkedAt: now,
            ruleVersion: '1.0.0'
        };
    }

    /**
     * Evaluate MLM Network Participation Eligibility
     */
    async checkMlmEligibility(memberId) {
        const userId = nexusDb.resolveMemberUserId(memberId);
        const profile = await nexusDb.findProfileByUserId(userId);
        if (!profile) {
            return { eligible: false, reason_code: 'ACCOUNT_NOT_FOUND', message: 'Member profile not found.' };
        }

        if (profile.status !== 'active') {
            return {
                eligible: false,
                reason_code: profile.status === 'suspended' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_NOT_ACTIVE',
                message: `Account is '${profile.status}'. Active account status required for MLM network placement.`
            };
        }

        const membership = await nexusDb.getMembershipByMemberId(userId);
        if (!membership || membership.status !== 'active') {
            return {
                eligible: false,
                reason_code: 'MEMBERSHIP_NOT_ACTIVE',
                message: 'An active package membership is required to participate in the MLM distributor network.'
            };
        }

        return {
            eligible: true,
            reason_code: null,
            message: 'Qualified for MLM network placement and direct referrals.',
            ruleVersion: '1.0.0'
        };
    }

    /**
     * Evaluate Commission Earning Eligibility (Consumed by Commission Engine)
     */
    async checkCommissionEligibility(memberId, context = {}) {
        const userId = nexusDb.resolveMemberUserId(memberId);
        const profile = await nexusDb.findProfileByUserId(userId);
        if (!profile) {
            return { eligible: false, reason_code: 'ACCOUNT_NOT_FOUND', message: 'Beneficiary profile not found.' };
        }

        // 1. Anti-Abuse: Self-Referral Prevention
        if (context.purchaserId && userId === context.purchaserId) {
            return {
                eligible: false,
                reason_code: 'SELF_REFERRAL_PROHIBITED',
                message: 'Anti-Abuse Safeguard: Self-referral commission is strictly prohibited.'
            };
        }

        // 2. Account Status Check
        if (profile.status !== 'active') {
            return {
                eligible: false,
                reason_code: profile.status === 'suspended' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_NOT_ACTIVE',
                message: `Beneficiary account status is '${profile.status || 'inactive'}'. Active account status required.`
            };
        }

        // 3. Active Membership Standing Check
        const membership = await nexusDb.getMembershipByMemberId(userId);
        if (membership && membership.status !== 'active') {
            return {
                eligible: false,
                reason_code: 'MEMBERSHIP_NOT_ACTIVE',
                message: `Beneficiary membership status is '${membership.status}'. Active membership required.`
            };
        }
        if (!membership) {
            // Fallback for profiles without formal membership record yet
            const pkgStatus = profile.package_status || '';
            const hasPackage = pkgStatus && pkgStatus !== 'NONE' && pkgStatus !== 'INACTIVE';
            if (!hasPackage) {
                return {
                    eligible: false,
                    reason_code: 'MEMBERSHIP_NOT_ACTIVE',
                    message: 'Beneficiary does not hold an active membership standing.'
                };
            }
        }

        // 4. Active Package Standing Check
        const pkgStatus = (membership && membership.package_code && membership.package_code !== 'NONE') 
            ? membership.package_code 
            : (profile.package_status || (membership && membership.package_id ? 'ACTIVE' : ''));
        const hasPackage = pkgStatus && pkgStatus !== 'NONE' && pkgStatus !== 'INACTIVE';
        if (!hasPackage) {
            return {
                eligible: false,
                reason_code: 'PACKAGE_NOT_ACTIVE',
                message: 'Beneficiary does not hold an active membership package tier.'
            };
        }

        // 5. Optional Minimum Rank Qualification Check
        if (context.minimumRank) {
            const ranks = ['MEMBER', 'BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'FOUNDER'];
            const requiredIndex = ranks.indexOf(context.minimumRank.toUpperCase());
            const memberIndex = ranks.indexOf((profile.rank || 'MEMBER').toUpperCase());

            if (memberIndex === -1 || memberIndex < requiredIndex) {
                return {
                    eligible: false,
                    reason_code: 'INSUFFICIENT_RANK',
                    message: `Beneficiary rank '${profile.rank || 'MEMBER'}' does not meet required rank '${context.minimumRank}'.`
                };
            }
        }

        return {
            eligible: true,
            reason_code: null,
            message: 'Qualified to receive commissions.',
            ruleVersion: '1.0.0'
        };
    }

    /**
     * Evaluate Bank Withdrawal Eligibility (Consumed by Withdrawal Engine)
     */
    async checkWithdrawalEligibility(memberId, amount = null, currency = 'LKR') {
        const userId = nexusDb.resolveMemberUserId(memberId);
        const profile = await nexusDb.findProfileByUserId(userId);
        if (!profile) {
            return { eligible: false, reason_code: 'ACCOUNT_NOT_FOUND', message: 'Member profile not found.' };
        }

        // 1. Account Status
        if (profile.status !== 'active') {
            return {
                eligible: false,
                reason_code: profile.status === 'suspended' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_NOT_ACTIVE',
                message: `Account is '${profile.status}'. Active account standing is required for payouts.`
            };
        }

        // 2. KYC Compliance Verification Gate (Prompt 18)
        const kycRequiredSetting = nexusDb.settings.get('kyc_required_for_withdrawal') === 'true' || nexusDb.settings.get('kyc_required_for_withdrawal') === true;
        if (kycRequiredSetting && profile.verification_status !== 'verified') {
            return {
                eligible: false,
                reason_code: 'KYC_REQUIRED',
                kycStatus: profile.verification_status || 'not_started',
                verificationLevel: profile.verification_level || 'basic',
                has_active_bank_account: false,
                hasActiveBank: false,
                reason: 'Identity verification (KYC) required before requesting a withdrawal.',
                message: 'Identity verification (KYC) required before requesting a withdrawal. Please complete verification in your dashboard.',
                actionRequired: true,
                verificationUrl: '/dashboard#verification'
            };
        }

        // 3. Bank Account on File Check
        const bankAccounts = await nexusDb.getMemberBankAccounts(userId, { activeOnly: true });
        const hasActiveBank = bankAccounts.length > 0;

        // 4. Threshold & Amount validation if amount specified
        if (amount !== null) {
            const numAmount = parseFloat(amount);
            const minThreshold = parseFloat(nexusDb.settings.get('min_withdrawal_amount')) || NexusConfig.MIN_WITHDRAWAL_AMOUNT_LKR;
            if (numAmount < minThreshold) {
                return {
                    eligible: false,
                    reason_code: 'BELOW_MINIMUM_THRESHOLD',
                    kycStatus: profile.verification_status || 'not_started',
                    verificationLevel: profile.verification_level || 'basic',
                    has_active_bank_account: hasActiveBank,
                    hasActiveBank,
                    reason: `Requested amount LKR ${numAmount.toFixed(2)} is below the minimum withdrawal threshold of LKR ${minThreshold.toFixed(2)}.`,
                    message: `Requested amount LKR ${numAmount.toFixed(2)} is below the minimum withdrawal threshold of LKR ${minThreshold.toFixed(2)}.`
                };
            }

            if (NexusConfig.MAX_WITHDRAWAL_AMOUNT_LKR && numAmount > NexusConfig.MAX_WITHDRAWAL_AMOUNT_LKR) {
                return {
                    eligible: false,
                    reason_code: 'ABOVE_MAXIMUM_THRESHOLD',
                    kycStatus: profile.verification_status || 'not_started',
                    verificationLevel: profile.verification_level || 'basic',
                    has_active_bank_account: hasActiveBank,
                    hasActiveBank,
                    reason: `Requested amount LKR ${numAmount.toFixed(2)} exceeds the maximum single payout limit of LKR ${NexusConfig.MAX_WITHDRAWAL_AMOUNT_LKR.toFixed(2)}.`,
                    message: `Requested amount LKR ${numAmount.toFixed(2)} exceeds the maximum single payout limit of LKR ${NexusConfig.MAX_WITHDRAWAL_AMOUNT_LKR.toFixed(2)}.`
                };
            }
        }

        return {
            eligible: true,
            reason_code: null,
            kycStatus: profile.verification_status || 'not_started',
            verificationLevel: profile.verification_level || 'basic',
            has_active_bank_account: hasActiveBank,
            hasActiveBank,
            reason: null,
            message: 'Eligible for withdrawal requests.',
            ruleVersion: '1.0.0'
        };
    }

    /**
     * Check if a member is authorized to perform a specific business action
     */
    async canMemberPerformAction(memberId, action) {
        const act = (action || '').toUpperCase();

        if (act === 'JOIN_MLM') {
            const check = await this.checkMlmEligibility(memberId);
            return check;
        }

        if (act === 'EARN_COMMISSION') {
            const check = await this.checkCommissionEligibility(memberId);
            return check;
        }

        if (act === 'REQUEST_WITHDRAWAL') {
            const check = await this.checkWithdrawalEligibility(memberId);
            return check;
        }

        const userId = nexusDb.resolveMemberUserId(memberId);
        const profile = await nexusDb.findProfileByUserId(userId);
        if (!profile || profile.status === 'closed' || profile.status === 'deactivated') {
            return { eligible: false, reason_code: 'ACCOUNT_DEACTIVATED', message: 'Account is closed or deactivated.' };
        }

        if (act === 'PURCHASE_PACKAGE' || act === 'PLACE_ORDER') {
            return { eligible: true, reason_code: null, message: 'Permitted to place catalog orders.' };
        }

        if (act === 'ACCESS_MEMBER_FEATURE') {
            const isSuspended = profile.status === 'suspended';
            return {
                eligible: !isSuspended,
                reason_code: isSuspended ? 'ACCOUNT_SUSPENDED' : null,
                message: isSuspended ? 'Account is suspended.' : 'Feature access permitted.'
            };
        }

        return { eligible: true, reason_code: null };
    }
}

module.exports = new NexusEligibilityEngine();
