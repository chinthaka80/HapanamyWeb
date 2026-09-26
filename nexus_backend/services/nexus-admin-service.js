// ==============================================================================
// NEXUS PRIME (PVT) LTD — CENTRAL ADMINISTRATIVE SERVICE
// DOMAIN: nexusp.online
// ==============================================================================

const nexusDb = require('../db/nexus-db');
const NexusConfig = require('../config/nexus-config');
const NexusNetworkService = require('./nexus-network-service');

const NexusAdminService = {
    /**
     * Verifies if session has administrative privileges
     */
    isAdmin(session) {
        if (!session || !session.roles) return false;
        return session.roles.includes('admin') || session.roles.includes('super_admin');
    },

    /**
     * Admin Dashboard Statistics
     */
    async getDashboardStats() {
        return await nexusDb.getAdminStats();
    },

    /**
     * Paginated Member Directory
     */
    async getMembers(options = {}) {
        return await nexusDb.getMembersDirectory(options);
    },

    /**
     * 360-Degree Member Inspection Dossier
     */
    async getMemberDetails(identifier) {
        if (!identifier) return null;
        return await nexusDb.getMemberFullDetails(identifier);
    },

    /**
     * Update Member Account Status with Audit Logging
     */
    async updateMemberStatus(targetUserId, newStatus, reason, adminContext = {}) {
        return await nexusDb.updateMemberStatus(targetUserId, newStatus, reason, adminContext);
    },

    /**
     * Retrieve Paginated Tamper-Proof Audit Trail
     */
    async getAuditLogs(options = {}) {
        return await nexusDb.getAuditLogs(options);
    },

    /**
     * Retrieve Paginated Sponsor-Referral Ledger
     */
    async getReferralsList(options = {}) {
        return await nexusDb.getAllReferralPairs(options);
    },

    /**
     * Read Current Platform System Settings
     */
    async getSettings() {
        return await nexusDb.getPlatformSettings();
    },

    /**
     * Update Platform System Settings with Audit Log
     */
    async updateSettings(newSettings, adminContext = {}) {
        return await nexusDb.updatePlatformSettings(newSettings, adminContext);
    },

    /**
     * Admin Network Tree Hierarchy starting from arbitrary member
     */
    async getNetworkTree(rootIdentifier, depth = 4) {
        let targetProfile = await nexusDb.findProfileByMemberId(rootIdentifier);
        if (!targetProfile) {
            targetProfile = await nexusDb.findProfileByReferralCode(rootIdentifier);
        }
        if (!targetProfile) {
            targetProfile = await nexusDb.findProfileByUserId(rootIdentifier);
        }

        if (!targetProfile) {
            return { success: false, error: `Member '${rootIdentifier}' not found.` };
        }

        const tree = await NexusNetworkService.getTreeHierarchy(targetProfile.user_id, depth);
        return {
            success: true,
            rootIdentifier,
            memberId: targetProfile.member_id,
            tree
        };
    },

    /**
     * Admin Network Children Node Query
     */
    async getNodeChildren(parentId) {
        if (!parentId) return [];
        return await NexusNetworkService.getNodeChildren(parentId);
    }
};

module.exports = NexusAdminService;
