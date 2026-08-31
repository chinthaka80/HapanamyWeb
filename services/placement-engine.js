// Hapanamy.lk MLM Placement Engine
// Service to handle network placement rules, loops prevention, sponsor validation, and leg routing

const PlacementEngine = {
    /**
     * Verifies that the sponsor exists and is active.
     */
    validateSponsor(sponsorId, users) {
        const sponsor = users.find(u => u.id === sponsorId);
        return !!sponsor && sponsor.status === 'ACTIVE';
    },

    /**
     * Checks if sponsorId is descended from userId (circular referral check).
     */
    isCircularReferral(userId, sponsorId, sponsorsList) {
        let currentSponsorId = sponsorId;
        const visited = new Set();

        while (currentSponsorId) {
            if (currentSponsorId === userId) {
                return true;
            }
            if (visited.has(currentSponsorId)) {
                break;
            }
            visited.add(currentSponsorId);

            const record = sponsorsList.find(s => s.user_id === currentSponsorId);
            currentSponsorId = record ? record.sponsor_id : null;
        }

        return false;
    },

    /**
     * Verifies if the requested binary position is already occupied under a parent.
     */
    isPositionOccupied(placementParentId, position, binaryNodes) {
        return binaryNodes.some(node => 
            node.placement_parent_id === placementParentId && 
            node.position === position
        );
    },

    /**
     * Determines whether a descendant node is located in the LEFT or RIGHT branch/leg of an ancestor.
     */
    getLegUnderAncestor(descendantId, ancestorId, binaryNodes) {
        let currentId = descendantId;
        const visited = new Set();

        while (currentId) {
            if (visited.has(currentId)) break;
            visited.add(currentId);

            const node = binaryNodes.find(n => n.user_id === currentId);
            if (!node) break;

            if (node.placement_parent_id === ancestorId) {
                return node.position; // Returns 'LEFT' or 'RIGHT'
            }
            currentId = node.placement_parent_id;
        }
        return null;
    }
};

if (typeof module !== 'undefined') {
    module.exports = PlacementEngine;
}
