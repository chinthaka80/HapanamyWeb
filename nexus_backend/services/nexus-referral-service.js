// ==============================================================================
// NEXUS PRIME (PVT) LTD — REFERRAL & SPONSOR SERVICE
// DOMAIN: nexusp.online
// ==============================================================================

const nexusDb = require('../db/nexus-db');
const NexusConfig = require('../config/nexus-config');

const NexusReferralService = {
    /**
     * Validates a referral code or Member ID for registration
     */
    async validateReferralCode(code) {
        if (!code || !code.trim()) {
            return {
                valid: false,
                error: 'Referral code is required.'
            };
        }

        const cleanCode = code.trim().toUpperCase();

        // 1. Check by Referral Code
        let profile = await nexusDb.findProfileByReferralCode(cleanCode);

        // 2. Check by Member ID (e.g. NP000001)
        if (!profile) {
            profile = await nexusDb.findProfileByMemberId(cleanCode);
        }

        if (!profile) {
            return {
                valid: false,
                error: 'This referral link is no longer valid.'
            };
        }

        if (profile.status !== 'active') {
            return {
                valid: false,
                error: 'This referral link is no longer valid (sponsor account is suspended or inactive).'
            };
        }

        return {
            valid: true,
            sponsor: {
                userId: profile.user_id,
                memberId: profile.member_id,
                referralCode: profile.referral_code,
                name: profile.full_name,
                displayName: profile.display_name || profile.full_name
            }
        };
    },

    /**
     * Retrieves referral information and list of direct referrals for a member
     */
    async getMemberReferralData(userId) {
        const profile = await nexusDb.findProfileByUserId(userId);
        if (!profile) return null;

        const directs = await nexusDb.getDirectReferrals(userId);
        const referralUrl = `${NexusConfig.APPLICATION_URL}/nexus_register.html?ref=${encodeURIComponent(profile.referral_code)}`;

        return {
            memberId: profile.member_id,
            referralCode: profile.referral_code,
            referralUrl: referralUrl,
            directCount: directs.length,
            directs: directs
        };
    }
};

module.exports = NexusReferralService;
