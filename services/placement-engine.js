// Hapanamy.lk MLM Placement Engine
// Service to handle network placement rules, loops prevention, and sponsor validation

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
                // Prevent infinite loop in case of bad database states
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
    }
};

if (typeof module !== 'undefined') {
    module.exports = PlacementEngine;
}
