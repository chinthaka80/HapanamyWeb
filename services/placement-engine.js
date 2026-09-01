// Hapanamy.lk Binary Network & Placement Engine (Phase 1)
// Comprehensive service managing binary topology, extreme/balanced placement, visual tree hierarchies, and genealogy.

const PlacementEngine = {
    /**
     * Verifies that the sponsor exists and is active.
     */
    validateSponsor(sponsorId, users) {
        if (!sponsorId || !users) return false;
        const sponsor = users.find(u => u.id === sponsorId || u.username === sponsorId);
        return !!sponsor && (sponsor.status === 'ACTIVE' || sponsor.status === 'Active');
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
    },

    /**
     * Finds the extreme outer position (Extreme Left or Extreme Right) along a leg path.
     */
    findExtremeLegPosition(startParentId, leg, binaryNodes) {
        let currentParentId = startParentId;
        const targetLeg = leg.toUpperCase(); // 'LEFT' or 'RIGHT'

        while (true) {
            const childNode = binaryNodes.find(n => 
                n.placement_parent_id === currentParentId && 
                n.position === targetLeg
            );

            if (!childNode) {
                return {
                    placementParentId: currentParentId,
                    position: targetLeg
                };
            }

            currentParentId = childNode.user_id;
        }
    },

    /**
     * Finds the first available open leaf position using Breadth-First Search (BFS).
     */
    findFirstAvailableLeaf(startParentId, preferredLeg, binaryNodes) {
        const queue = [startParentId];
        const visited = new Set();
        const legOrder = ['LEFT', 'RIGHT'];

        while (queue.length > 0) {
            const currentId = queue.shift();
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            for (const pos of legOrder) {
                const childNode = binaryNodes.find(n => 
                    n.placement_parent_id === currentId && 
                    n.position === pos
                );

                if (!childNode) {
                    return {
                        placementParentId: currentId,
                        position: pos
                    };
                }
                queue.push(childNode.user_id);
            }
        }

        return {
            placementParentId: startParentId,
            position: 'LEFT'
        };
    },

    /**
     * Computes the balanced placement by placing under the weaker leg (by BV or members count).
     */
    findBalancedPosition(sponsorId, binaryNodes, volumeLedger = []) {
        const leftNode = binaryNodes.find(n => n.placement_parent_id === sponsorId && n.position === 'LEFT');
        const rightNode = binaryNodes.find(n => n.placement_parent_id === sponsorId && n.position === 'RIGHT');

        // If direct left or right is vacant, fill left first, then right
        if (!leftNode) {
            return { placementParentId: sponsorId, position: 'LEFT' };
        }
        if (!rightNode) {
            return { placementParentId: sponsorId, position: 'RIGHT' };
        }

        // Check sponsor's volume ledger directly for LEFT vs RIGHT leg
        let sponsorLeftVol = 0;
        let sponsorRightVol = 0;
        if (volumeLedger && volumeLedger.length > 0) {
            sponsorLeftVol = volumeLedger
                .filter(v => v.user_id === sponsorId && v.leg === 'LEFT')
                .reduce((sum, v) => sum + v.amount, 0.00);
            sponsorRightVol = volumeLedger
                .filter(v => v.user_id === sponsorId && v.leg === 'RIGHT')
                .reduce((sum, v) => sum + v.amount, 0.00);
        }

        // Compute team size for both legs
        const leftSummary = this.getTeamSummary(leftNode.user_id, binaryNodes, volumeLedger);
        const rightSummary = this.getTeamSummary(rightNode.user_id, binaryNodes, volumeLedger);

        const totalLeftVol = sponsorLeftVol || leftSummary.totalVolume;
        const totalRightVol = sponsorRightVol || rightSummary.totalVolume;

        // Weaker leg gets the new member
        if (totalLeftVol < totalRightVol) {
            return this.findFirstAvailableLeaf(leftNode.user_id, 'LEFT', binaryNodes);
        } else if (totalRightVol < totalLeftVol) {
            return this.findFirstAvailableLeaf(rightNode.user_id, 'RIGHT', binaryNodes);
        } else {
            // Volume is equal, compare team member counts
            if (leftSummary.teamCount <= rightSummary.teamCount) {
                return this.findFirstAvailableLeaf(leftNode.user_id, 'LEFT', binaryNodes);
            } else {
                return this.findFirstAvailableLeaf(rightNode.user_id, 'RIGHT', binaryNodes);
            }
        }
    },

    /**
     * Resolves the placement parent and position based on sponsor preference or explicit request.
     */
    resolvePlacement(sponsorId, requestedPosition = 'AUTO', binaryNodes = [], volumeLedger = []) {
        const posKey = (requestedPosition || 'AUTO').toUpperCase();

        // 1. Direct sponsor exists check
        const sponsorNode = binaryNodes.find(n => n.user_id === sponsorId);
        if (!sponsorNode && binaryNodes.length > 0) {
            // Default to root node if sponsor not in tree
            const root = binaryNodes.find(n => !n.placement_parent_id) || binaryNodes[0];
            return this.resolvePlacement(root.user_id, requestedPosition, binaryNodes, volumeLedger);
        }

        // If tree is completely empty, user is root
        if (binaryNodes.length === 0) {
            return {
                placementParentId: null,
                position: null,
                depth: 1,
                path: ''
            };
        }

        let resolved = null;

        if (posKey === 'EXTREME_LEFT' || posKey === 'LEFT') {
            resolved = this.findExtremeLegPosition(sponsorId, 'LEFT', binaryNodes);
        } else if (posKey === 'EXTREME_RIGHT' || posKey === 'RIGHT') {
            resolved = this.findExtremeLegPosition(sponsorId, 'RIGHT', binaryNodes);
        } else if (posKey === 'BALANCED' || posKey === 'AUTO') {
            resolved = this.findBalancedPosition(sponsorId, binaryNodes, volumeLedger);
        } else {
            resolved = this.findFirstAvailableLeaf(sponsorId, 'LEFT', binaryNodes);
        }

        // Calculate depth and path
        const parentNode = binaryNodes.find(n => n.user_id === resolved.placementParentId);
        const depth = parentNode ? (parentNode.depth || 1) + 1 : 1;
        const parentPath = parentNode ? (parentNode.path || '') : '';
        const path = parentPath ? `${parentPath}/${resolved.placementParentId}` : (resolved.placementParentId || '');

        return {
            placementParentId: resolved.placementParentId,
            position: resolved.position,
            depth,
            path
        };
    },

    /**
     * Adds a new member node into the binary tree ledger.
     */
    addNode(binaryNodes, { userId, placementParentId, position, depth, path }) {
        if (!userId) throw new Error('UserId is required for binary node.');

        // Prevent duplicate position under parent
        if (placementParentId && position) {
            const occupied = this.isPositionOccupied(placementParentId, position, binaryNodes);
            if (occupied) {
                throw new Error(`Position ${position} under parent ${placementParentId} is already occupied.`);
            }
        }

        const parentNode = binaryNodes.find(n => n.user_id === placementParentId);
        const nodeDepth = depth || (parentNode ? (parentNode.depth || 1) + 1 : 1);
        const nodePath = path || (parentNode ? (parentNode.path ? `${parentNode.path}/${placementParentId}` : placementParentId) : '');

        const newNode = {
            id: 'node-' + Math.random().toString(36).substr(2, 9),
            user_id: userId,
            placement_parent_id: placementParentId || null,
            position: position || null,
            depth: nodeDepth,
            path: nodePath,
            left_child_id: null,
            right_child_id: null,
            created_at: new Date().toISOString()
        };

        // Link child ID on parent
        if (parentNode) {
            if (position === 'LEFT') parentNode.left_child_id = userId;
            if (position === 'RIGHT') parentNode.right_child_id = userId;
        }

        binaryNodes.push(newNode);
        return newNode;
    },

    /**
     * Computes the cumulative team size and active volume under a specific user subtree.
     */
    getTeamSummary(userId, binaryNodes, volumeLedger = []) {
        let teamCount = 0;
        let leftCount = 0;
        let rightCount = 0;
        let leftVolume = 0;
        let rightVolume = 0;

        const queue = [userId];
        const visited = new Set();

        while (queue.length > 0) {
            const currentId = queue.shift();
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const children = binaryNodes.filter(n => n.placement_parent_id === currentId);
            for (const child of children) {
                teamCount++;
                const side = this.getLegUnderAncestor(child.user_id, userId, binaryNodes);
                if (side === 'LEFT') leftCount++;
                if (side === 'RIGHT') rightCount++;
                queue.push(child.user_id);
            }
        }

        // Sum volume from volume ledger
        if (volumeLedger && volumeLedger.length > 0) {
            leftVolume = volumeLedger
                .filter(v => v.user_id === userId && v.leg === 'LEFT')
                .reduce((sum, v) => sum + v.amount, 0.00);

            rightVolume = volumeLedger
                .filter(v => v.user_id === userId && v.leg === 'RIGHT')
                .reduce((sum, v) => sum + v.amount, 0.00);
        }

        return {
            teamCount,
            leftCount,
            rightCount,
            leftVolume: Math.max(0, leftVolume),
            rightVolume: Math.max(0, rightVolume),
            totalVolume: Math.max(0, leftVolume) + Math.max(0, rightVolume)
        };
    },

    /**
     * Builds a structured nested tree hierarchy for interactive frontend tree visualizer.
     */
    buildTreeHierarchy(rootUserId, binaryNodes = [], users = [], purchases = [], volumeLedger = [], maxDepth = 4) {
        const rootNode = binaryNodes.find(n => n.user_id === rootUserId) || binaryNodes[0];
        if (!rootNode) return null;

        const buildSubtree = (node, currentDepth) => {
            if (!node || currentDepth > maxDepth) return null;

            const user = users.find(u => u.id === node.user_id || u.username === node.user_id) || {
                id: node.user_id,
                username: node.user_id,
                full_name: 'Member ' + node.user_id,
                status: 'ACTIVE'
            };

            const hasActivePurchase = purchases.some(p => p.user_id === node.user_id && p.status === 'ACTIVE');
            const summary = this.getTeamSummary(node.user_id, binaryNodes, volumeLedger);

            const leftChildNode = binaryNodes.find(n => n.placement_parent_id === node.user_id && n.position === 'LEFT');
            const rightChildNode = binaryNodes.find(n => n.placement_parent_id === node.user_id && n.position === 'RIGHT');

            return {
                id: node.id || node.user_id,
                user_id: node.user_id,
                username: user.username || user.name || node.user_id,
                full_name: user.full_name || user.name || 'Member',
                position: node.position,
                depth: node.depth,
                path: node.path,
                is_active: hasActivePurchase || user.status === 'ACTIVE',
                status: (hasActivePurchase || user.status === 'ACTIVE') ? 'ACTIVE' : 'INACTIVE',
                left_count: summary.leftCount,
                right_count: summary.rightCount,
                left_volume: summary.leftVolume,
                right_volume: summary.rightVolume,
                team_count: summary.teamCount,
                left: leftChildNode ? buildSubtree(leftChildNode, currentDepth + 1) : null,
                right: rightChildNode ? buildSubtree(rightChildNode, currentDepth + 1) : null
            };
        };

        return buildSubtree(rootNode, 1);
    },

    /**
     * Searches for a node matching a username, email, or user_id.
     */
    searchTreeNode(query, binaryNodes = [], users = []) {
        if (!query) return null;
        const q = query.toLowerCase().trim();

        const user = users.find(u => 
            (u.username && u.username.toLowerCase() === q) ||
            (u.email && u.email.toLowerCase() === q) ||
            (u.id && u.id.toLowerCase() === q) ||
            (u.full_name && u.full_name.toLowerCase().includes(q))
        );

        const targetUserId = user ? user.id : query;
        const node = binaryNodes.find(n => n.user_id === targetUserId);
        if (!node) return null;

        return {
            user_id: node.user_id,
            username: user ? user.username : node.user_id,
            full_name: user ? user.full_name : 'Member',
            depth: node.depth,
            path: node.path,
            position: node.position,
            placement_parent_id: node.placement_parent_id
        };
    },

    /**
     * Returns direct referrals genealogy sponsored by a user.
     */
    getDirectReferrals(sponsorId, sponsors = [], users = [], purchases = [], binaryNodes = []) {
        const directSponsorRecords = sponsors.filter(s => s.sponsor_id === sponsorId);

        return directSponsorRecords.map(record => {
            const user = users.find(u => u.id === record.user_id || u.username === record.user_id) || {
                id: record.user_id,
                username: record.user_id,
                full_name: 'Member ' + record.user_id,
                created_at: record.created_at || new Date().toISOString()
            };

            const node = binaryNodes.find(n => n.user_id === record.user_id);
            const side = node && node.placement_parent_id 
                ? this.getLegUnderAncestor(record.user_id, sponsorId, binaryNodes) 
                : (node ? node.position : 'UNKNOWN');

            const hasActivePurchase = purchases.some(p => p.user_id === record.user_id && p.status === 'ACTIVE');

            return {
                user_id: record.user_id,
                username: user.username,
                full_name: user.full_name,
                email: user.email || 'N/A',
                mobile: user.mobile || 'N/A',
                placement_leg: side || 'LEFT',
                status: hasActivePurchase ? 'ACTIVE' : 'PENDING',
                joined_at: record.created_at || user.created_at || new Date().toISOString()
            };
        });
    }
};

if (typeof module !== 'undefined') {
    module.exports = PlacementEngine;
}
