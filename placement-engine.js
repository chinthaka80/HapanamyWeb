// Hapanamy.lk Binary Network & Placement Engine (STEP 13)
// Production-grade binary tree management, automatic & manual collision-proof placement,
// cycle detection, ancestor traversal, descendant lookup, and visual tree hierarchy.

const PlacementEngine = {
    // In-memory slot reservation mutex locks to prevent race conditions during concurrent placements
    _slotLocks: new Set(),

    /**
     * Verifies that the sponsor exists and is active.
     */
    validateSponsor(sponsorId, users) {
        if (!sponsorId || !users) return false;
        const sponsor = users.find(u => u.id === sponsorId || u.username === sponsorId);
        return !!sponsor && (sponsor.status === 'ACTIVE' || sponsor.status === 'Active');
    },

    /**
     * Checks if sponsorId is descended from userId in the sponsorship genealogy (circular referral check).
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
     * Checks if proposedParentId is already a descendant of memberId (circular placement loop prevention).
     */
    isCircularPlacement(memberId, proposedParentId, binaryNodes) {
        if (!memberId || !proposedParentId) return false;
        if (memberId === proposedParentId) return true;

        let currentId = proposedParentId;
        const visited = new Set();

        while (currentId) {
            if (currentId === memberId) {
                return true; // Found memberId as an ancestor of proposedParentId! Cycle detected.
            }
            if (visited.has(currentId)) break;
            visited.add(currentId);

            const parentNode = binaryNodes.find(n => n.user_id === currentId);
            currentId = parentNode ? parentNode.placement_parent_id : null;
        }

        return false;
    },

    /**
     * Verifies if the requested binary position is already occupied under a parent.
     */
    isPositionOccupied(placementParentId, position, binaryNodes) {
        if (!placementParentId || !position) return false;
        const targetPos = position.toUpperCase();
        return binaryNodes.some(node => 
            node.placement_parent_id === placementParentId && 
            node.position === targetPos
        );
    },

    /**
     * Validates a proposed placement for a member under a parent node.
     */
    validatePlacement(memberId, sponsorId, targetParentId, position, binaryNodes) {
        if (!memberId) {
            return { valid: false, error: 'Member ID is required.' };
        }

        // If tree is empty and this is root member
        if (binaryNodes.length === 0) {
            if (targetParentId || position) {
                return { valid: false, error: 'First member (Root) must have null parent and position.' };
            }
            return { valid: true };
        }

        // Prevent placing a member who is already in the tree
        const alreadyInTree = binaryNodes.some(n => n.user_id === memberId);
        if (alreadyInTree) {
            return { valid: false, error: `Member ${memberId} is already placed in the binary tree.` };
        }

        if (!targetParentId) {
            return { valid: false, error: 'Placement Parent ID is required for non-root members.' };
        }

        if (!position || !['LEFT', 'RIGHT'].includes(position.toUpperCase())) {
            return { valid: false, error: 'Position must be strictly LEFT or RIGHT.' };
        }

        const normalizedPos = position.toUpperCase();

        // Prevent self-placement
        if (memberId === targetParentId) {
            return { valid: false, error: 'Self-placement is strictly prohibited.' };
        }

        // Verify target parent exists in tree
        const parentNode = binaryNodes.find(n => n.user_id === targetParentId);
        if (!parentNode) {
            return { valid: false, error: `Target placement parent ${targetParentId} does not exist in the binary tree.` };
        }

        // Check if slot is occupied
        if (this.isPositionOccupied(targetParentId, normalizedPos, binaryNodes)) {
            return { valid: false, error: `Position ${normalizedPos} under parent ${targetParentId} is already occupied.` };
        }

        // Check circular placement
        if (this.isCircularPlacement(memberId, targetParentId, binaryNodes)) {
            return { valid: false, error: `Circular placement detected: Parent ${targetParentId} is a descendant of ${memberId}.` };
        }

        return { valid: true };
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
     * Traverses up from a member and returns all ancestor uplines in order [Parent, Grandparent, ...].
     */
    getAncestors(memberId, binaryNodes, maxDepth = 100) {
        const ancestors = [];
        let currentId = memberId;
        let hop = 1;
        const visited = new Set();

        while (currentId && hop <= maxDepth) {
            if (visited.has(currentId)) break;
            visited.add(currentId);

            const node = binaryNodes.find(n => n.user_id === currentId);
            if (!node || !node.placement_parent_id) break;

            const parentNode = binaryNodes.find(n => n.user_id === node.placement_parent_id);
            if (!parentNode) break;

            ancestors.push({
                hop,
                user_id: parentNode.user_id,
                position: node.position, // Leg this child was attached to on parent
                depth: parentNode.depth,
                path: parentNode.path
            });

            currentId = parentNode.user_id;
            hop++;
        }

        return ancestors;
    },

    /**
     * Returns all descendant nodes residing in the subtree of a member.
     */
    getDescendants(memberId, binaryNodes, maxDepth = 100) {
        const descendants = [];
        const queue = [{ userId: memberId, relativeDepth: 0 }];
        const visited = new Set();

        while (queue.length > 0) {
            const { userId, relativeDepth } = queue.shift();
            if (visited.has(userId)) continue;
            visited.add(userId);

            if (relativeDepth > 0) {
                const node = binaryNodes.find(n => n.user_id === userId);
                if (node) {
                    descendants.push({
                        user_id: node.user_id,
                        placement_parent_id: node.placement_parent_id,
                        position: node.position,
                        relative_depth: relativeDepth,
                        branch_leg: this.getLegUnderAncestor(node.user_id, memberId, binaryNodes),
                        depth: node.depth,
                        path: node.path
                    });
                }
            }

            if (relativeDepth < maxDepth) {
                const children = binaryNodes.filter(n => n.placement_parent_id === userId);
                for (const child of children) {
                    queue.push({ userId: child.user_id, relativeDepth: relativeDepth + 1 });
                }
            }
        }

        return descendants;
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

        // 1. If tree is completely empty, user is root
        if (binaryNodes.length === 0) {
            return {
                placementParentId: null,
                position: null,
                depth: 1,
                path: ''
            };
        }

        // 2. Direct sponsor exists check
        const sponsorNode = binaryNodes.find(n => n.user_id === sponsorId);
        if (!sponsorNode) {
            // Default to root node if sponsor not in tree
            const root = binaryNodes.find(n => !n.placement_parent_id) || binaryNodes[0];
            return this.resolvePlacement(root.user_id, requestedPosition, binaryNodes, volumeLedger);
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
     * Atomic, concurrency-safe assignment of a member into the binary tree.
     */
    assignPlacement(memberId, sponsorId, targetParentId, position, binaryNodes, options = {}) {
        const normalizedPos = position ? position.toUpperCase() : null;
        const slotKey = targetParentId && normalizedPos ? `${targetParentId}:${normalizedPos}` : null;

        // Concurrency mutex check
        if (slotKey) {
            if (this._slotLocks.has(slotKey)) {
                throw new Error(`Slot lock conflict: Position ${normalizedPos} under parent ${targetParentId} is currently being locked by another concurrent process.`);
            }
            this._slotLocks.add(slotKey);
        }

        try {
            // 1. Validate placement integrity
            const validation = this.validatePlacement(memberId, sponsorId, targetParentId, normalizedPos, binaryNodes);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // 2. Calculate depth and tree path
            const parentNode = binaryNodes.find(n => n.user_id === targetParentId);
            const depth = parentNode ? (parentNode.depth || 1) + 1 : 1;
            const parentPath = parentNode ? (parentNode.path || '') : '';
            const path = parentPath ? `${parentPath}/${targetParentId}` : (targetParentId || '');

            const newNode = {
                id: 'node-' + Math.random().toString(36).substr(2, 9),
                user_id: memberId,
                placement_parent_id: targetParentId || null,
                position: normalizedPos,
                depth,
                path,
                left_child_id: null,
                right_child_id: null,
                created_at: new Date().toISOString()
            };

            // Link parent child reference
            if (parentNode) {
                if (normalizedPos === 'LEFT') parentNode.left_child_id = memberId;
                if (normalizedPos === 'RIGHT') parentNode.right_child_id = memberId;
            }

            binaryNodes.push(newNode);

            // Audit logging if list provided
            if (options.auditLogs) {
                options.auditLogs.push({
                    id: 'audit-pl-' + Math.random().toString(36).substr(2, 9),
                    user_id: options.adminUserId || memberId,
                    action: options.isManual ? 'MANUAL_PLACEMENT_ASSIGNED' : 'AUTO_PLACEMENT_ASSIGNED',
                    entity_type: 'binary_nodes',
                    entity_id: memberId,
                    new_values: { placement_parent_id: targetParentId, position: normalizedPos, depth },
                    created_at: new Date().toISOString()
                });
            }

            return newNode;
        } finally {
            if (slotKey) {
                this._slotLocks.delete(slotKey);
            }
        }
    },

    /**
     * Backward-compatible helper to add node directly.
     */
    addNode(binaryNodes, { userId, placementParentId, position, depth, path }) {
        return this.assignPlacement(userId, null, placementParentId, position, binaryNodes);
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
            placement_parent_id: node.placement_parent_id,
            left_child_id: node.left_child_id,
            right_child_id: node.right_child_id
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
