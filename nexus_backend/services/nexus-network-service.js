// ==============================================================================
// NEXUS PRIME (PVT) LTD — MLM NETWORK TREE & TOPOLOGY SERVICE
// DOMAIN: nexusp.online
// ==============================================================================

const nexusDb = require('../db/nexus-db');

const NexusNetworkService = {
    /**
     * Retrieves full or depth-limited downline network for a member with optional status filtering
     */
    async getDownline(userId, maxDepth = null, statusFilter = 'all') {
        return nexusDb.getDownline(userId, maxDepth, statusFilter);
    },

    /**
     * Retrieves upward sponsorship ancestry chain
     */
    async getUpline(userId, maxLevels = null) {
        return nexusDb.getUpline(userId, maxLevels);
    },

    /**
     * Returns team counts (direct team size and total network size)
     */
    async getTeamCounts(userId) {
        return nexusDb.getTeamCounts(userId);
    },

    /**
     * Dynamic Level Distance Calculation between any ancestor and descendant
     */
    async getRelativeLevel(ancestorId, descendantId) {
        return nexusDb.getRelativeLevel(ancestorId, descendantId);
    },

    /**
     * Progressive Loading: Returns direct children of any node with hasChildren flag
     */
    async getNodeChildren(parentId) {
        return nexusDb.getNodeChildren(parentId);
    },

    /**
     * Detailed Node Information for Interactive Inspection Modal
     */
    async getNodeDetails(userId) {
        return nexusDb.getNodeDetails(userId);
    },

    /**
     * Search Downline Network
     */
    async searchDownline(rootUserId, query) {
        return nexusDb.searchNetworkMember(rootUserId, query);
    },

    /**
     * Formats network hierarchy into a nested tree structure for visualization
     */
    async getTreeHierarchy(userId, maxDepth = 4) {
        const rootProfile = await nexusDb.findProfileByUserId(userId);
        if (!rootProfile) return null;

        const counts = await nexusDb.getTeamCounts(userId);
        const downline = await nexusDb.getDownline(userId, maxDepth);

        // Build Nested Tree Representation
        const rootNode = {
            userId: rootProfile.user_id,
            memberId: rootProfile.member_id,
            referralCode: rootProfile.referral_code,
            name: rootProfile.full_name,
            rank: rootProfile.rank,
            status: rootProfile.status,
            level: 0,
            directTeamCount: counts.directTeamCount,
            totalTeamCount: counts.totalTeamCount,
            hasChildren: counts.directTeamCount > 0,
            children: []
        };

        const nodeMap = new Map();
        nodeMap.set(userId, rootNode);

        for (const item of downline) {
            const node = {
                userId: item.user_id,
                memberId: item.member_id,
                referralCode: item.referral_code,
                name: item.full_name,
                rank: item.rank || 'MEMBER',
                status: item.status,
                level: item.level,
                sponsorId: item.sponsor_id,
                children: []
            };
            nodeMap.set(item.user_id, node);

            const parentNode = nodeMap.get(item.sponsor_id);
            if (parentNode) {
                parentNode.children.push(node);
            }
        }

        return rootNode;
    }
};

module.exports = NexusNetworkService;
