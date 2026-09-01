// Hapanamy.lk Binary Volume Ledger & Processing Engine (STEP 17)
// Immutable append-only volume ledger, Product Economics Snapshot integration,
// multi-tier upline branch propagation, idempotency, refund reversals, and volume accumulators.

const crypto = require('crypto');
const PlacementEngine = require('./placement-engine');
const ProductSnapshotService = require('./product-snapshot-service');

const VolumeLedger = {
    _volumeLocks: new Set(),

    /**
     * Appends an immutable transaction entry into the binary volume ledger.
     * Supports both object and legacy positional argument calling signatures.
     */
    addEntry(ledger, arg2, leg, amount, sourceUserId, sourcePurchaseId, type = 'SALE_VOLUME', beforeBalance = null) {
        let opts = {};
        if (arg2 && typeof arg2 === 'object' && !leg) {
            opts = arg2;
        } else {
            opts = {
                userId: arg2,
                leg,
                amount,
                sourceUserId,
                sourcePurchaseId,
                type: type || 'SALE_VOLUME',
                beforeBalance
            };
        }

        const userId = opts.userId;
        const normalizedLeg = (opts.leg || 'LEFT').toUpperCase();
        const numAmount = Number(opts.amount) || 0;
        const currentBalance = opts.beforeBalance !== null && opts.beforeBalance !== undefined 
            ? opts.beforeBalance 
            : this.getLegBalance(userId, normalizedLeg, ledger);
        const afterBalance = Math.round((currentBalance + numAmount) * 100) / 100;
        const key = opts.idempotencyKey || `vol-${opts.sourcePurchaseId || 'manual'}-${userId}-${normalizedLeg}-${opts.type || 'SALE_VOLUME'}`;

        // Verify idempotency
        if (ledger.some(e => e.idempotency_key === key)) {
            return null; // Already exists
        }

        const entry = {
            id: 'bv-' + crypto.randomBytes(8).toString('hex'),
            user_id: userId,
            leg: normalizedLeg,
            amount: Math.round(numAmount * 100) / 100,
            source_user_id: opts.sourceUserId,
            source_purchase_id: opts.sourcePurchaseId,
            snapshot_id: opts.snapshotId || null,
            type: opts.type || 'SALE_VOLUME',
            idempotency_key: key,
            before_balance: currentBalance,
            after_balance: afterBalance,
            created_at: new Date().toISOString()
        };

        ledger.push(entry);
        return entry;
    },

    /**
     * Calculates the active carry-forward balance/volume for a user on a specific leg.
     */
    getLegBalance(userId, leg, ledger = []) {
        const normalizedLeg = (leg || '').toUpperCase();
        return ledger
            .filter(entry => entry.user_id === userId && entry.leg === normalizedLeg)
            .reduce((sum, entry) => Math.round((sum + entry.amount) * 100) / 100, 0.00);
    },

    /**
     * Computes complete volume accumulators and metrics for a member.
     */
    getVolumeSummary(userId, ledger = []) {
        const userEntries = ledger.filter(e => e.user_id === userId);

        let lifetimeLeft = 0;
        let lifetimeRight = 0;
        let matchedLeft = 0;
        let matchedRight = 0;
        let reversedLeft = 0;
        let reversedRight = 0;

        for (const e of userEntries) {
            if (e.leg === 'LEFT') {
                if (e.type === 'SALE_VOLUME' && e.amount > 0) {
                    lifetimeLeft += e.amount;
                } else if (e.type === 'MATCHED_VOLUME' || e.type === 'PAIR_MATCH_DEDUCTION') {
                    matchedLeft += Math.abs(e.amount);
                } else if (e.type === 'REVERSAL' || e.type === 'REFUND_REVERSAL') {
                    reversedLeft += Math.abs(e.amount);
                }
            } else if (e.leg === 'RIGHT') {
                if (e.type === 'SALE_VOLUME' && e.amount > 0) {
                    lifetimeRight += e.amount;
                } else if (e.type === 'MATCHED_VOLUME' || e.type === 'PAIR_MATCH_DEDUCTION') {
                    matchedRight += Math.abs(e.amount);
                } else if (e.type === 'REVERSAL' || e.type === 'REFUND_REVERSAL') {
                    reversedRight += Math.abs(e.amount);
                }
            }
        }

        const currentLeft = this.getLegBalance(userId, 'LEFT', ledger);
        const currentRight = this.getLegBalance(userId, 'RIGHT', ledger);

        return {
            user_id: userId,
            lifetime_left_volume: Math.round(lifetimeLeft * 100) / 100,
            lifetime_right_volume: Math.round(lifetimeRight * 100) / 100,
            current_left_volume: Math.max(0, currentLeft),
            current_right_volume: Math.max(0, currentRight),
            matched_left_volume: Math.round(matchedLeft * 100) / 100,
            matched_right_volume: Math.round(matchedRight * 100) / 100,
            reversed_left_volume: Math.round(reversedLeft * 100) / 100,
            reversed_right_volume: Math.round(reversedRight * 100) / 100,
            weaker_leg: currentLeft < currentRight ? 'LEFT' : (currentRight < currentLeft ? 'RIGHT' : 'BALANCED'),
            total_lifetime_volume: Math.round((lifetimeLeft + lifetimeRight) * 100) / 100
        };
    },

    /**
     * Complete Binary Volume Processing Pipeline (STEP 17)
     * Propagates volume upwards along the ancestor tree path using the immutable snapshot.
     */
    processSaleVolume({
        purchase,
        snapshot,
        binaryNodes = [],
        ledger = [],
        options = {}
    }) {
        if (!purchase || !purchase.id) {
            throw new Error('Valid purchase is required for volume propagation.');
        }

        if (purchase.status !== 'ACTIVE' && purchase.status !== 'Active') {
            throw new Error(`Cannot propagate volume for non-active purchase (Status: ${purchase.status}).`);
        }

        const lockKey = `lock-vol-${purchase.id}`;
        if (this._volumeLocks.has(lockKey)) {
            throw new Error(`Concurrent volume processing lock in progress for purchase ${purchase.id}`);
        }

        this._volumeLocks.add(lockKey);

        try {
            // 1. Idempotency Check: Verify if this purchase has already propagated volume
            const alreadyPropagated = ledger.some(e => e.source_purchase_id === purchase.id && e.type === 'SALE_VOLUME');
            if (alreadyPropagated) {
                console.log(`⚠️ Idempotency block: Purchase ${purchase.id} volume already propagated.`);
                return { success: true, idempotent: true, entries: [] };
            }

            // 2. Read Immutable Snapshot Volume
            let effectiveVolume = 0;
            let snapshotId = null;

            if (snapshot) {
                effectiveVolume = snapshot.binary_volume || snapshot.selling_price || 0;
                snapshotId = snapshot.id;
            } else if (purchase.economics_snapshot) {
                effectiveVolume = purchase.economics_snapshot.binary_volume || purchase.economics_snapshot.selling_price || 0;
                snapshotId = purchase.economics_snapshot.id;
            } else if (purchase.amount) {
                effectiveVolume = purchase.amount;
            }

            if (effectiveVolume <= 0) {
                return { success: true, message: 'Volume is zero, skipping propagation.', entries: [] };
            }

            const purchasingUserId = purchase.user_id;
            const node = binaryNodes.find(n => n.user_id === purchasingUserId);
            if (!node) {
                return { success: true, message: 'Purchasing user is not placed in binary tree.', entries: [] };
            }

            const createdEntries = [];
            let currentParentId = node.placement_parent_id;
            const maxDepth = options.maxDepth || 100;
            let currentHop = 0;

            // 3. Ancestor Tree Traversal
            while (currentParentId && currentHop < maxDepth) {
                currentHop++;

                // Determine whether the purchaser falls under LEFT or RIGHT subtree leg of this ancestor
                const side = PlacementEngine.getLegUnderAncestor(purchasingUserId, currentParentId, binaryNodes);

                if (side) {
                    const idempotencyKey = `vol-${purchase.id}-${currentParentId}-${side}`;
                    const entry = this.addEntry(ledger, {
                        userId: currentParentId,
                        leg: side,
                        amount: effectiveVolume,
                        sourceUserId: purchasingUserId,
                        sourcePurchaseId: purchase.id,
                        snapshotId,
                        type: 'SALE_VOLUME',
                        idempotencyKey
                    });

                    if (entry) {
                        createdEntries.push(entry);
                    }
                }

                // Climb to next parent
                const parentNode = binaryNodes.find(n => n.user_id === currentParentId);
                currentParentId = parentNode ? parentNode.placement_parent_id : null;
            }

            return {
                success: true,
                purchase_id: purchase.id,
                propagated_volume: effectiveVolume,
                upline_count: createdEntries.length,
                entries: createdEntries
            };

        } finally {
            this._volumeLocks.delete(lockKey);
        }
    },

    /**
     * Backward-compatible propagateVolume wrapper.
     */
    propagateVolume(purchasingUserId, amount, sourcePurchaseId, binaryNodes, ledger) {
        return this.processSaleVolume({
            purchase: { id: sourcePurchaseId, user_id: purchasingUserId, amount, status: 'ACTIVE' },
            snapshot: { id: 'snap-legacy', binary_volume: amount },
            binaryNodes,
            ledger
        });
    },

    /**
     * Performs binary matching logic and logs matched deductions.
     */
    matchVolume(userId, ledger) {
        const leftBalance = this.getLegBalance(userId, 'LEFT', ledger);
        const rightBalance = this.getLegBalance(userId, 'RIGHT', ledger);

        const matchedAmount = Math.min(leftBalance, rightBalance);
        if (matchedAmount <= 0.00) return null;

        // Log matched deductions in the ledger
        this.addEntry(ledger, {
            userId,
            leg: 'LEFT',
            amount: -matchedAmount,
            sourceUserId: userId,
            sourcePurchaseId: 'MATCH-SYSTEM',
            type: 'MATCHED_VOLUME',
            idempotencyKey: `match-${userId}-left-${Date.now()}`
        });

        this.addEntry(ledger, {
            userId,
            leg: 'RIGHT',
            amount: -matchedAmount,
            sourceUserId: userId,
            sourcePurchaseId: 'MATCH-SYSTEM',
            type: 'MATCHED_VOLUME',
            idempotencyKey: `match-${userId}-right-${Date.now()}`
        });

        return {
            userId,
            matchedAmount,
            leftCarryForward: Math.round((leftBalance - matchedAmount) * 100) / 100,
            rightCarryForward: Math.round((rightBalance - matchedAmount) * 100) / 100
        };
    },

    /**
     * Reverses binary volume generated by a refunded/cancelled purchase with compensating ledger entries.
     */
    reverseVolume(sourcePurchaseId, binaryNodes, ledger) {
        const saleEntries = ledger.filter(entry => (entry.source_purchase_id === sourcePurchaseId || entry.purchase_id === sourcePurchaseId) && (entry.type === 'SALE_VOLUME' || entry.type === 'DIRECT_VOLUME'));
        const reversedEntries = [];

        saleEntries.forEach(sale => {
            const reversalKey = `rev-vol-${sourcePurchaseId}-${sale.user_id}-${sale.leg}`;
            const reversalEntry = this.addEntry(ledger, {
                userId: sale.user_id,
                leg: sale.leg,
                amount: -sale.amount,
                sourceUserId: sale.source_user_id,
                sourcePurchaseId,
                snapshotId: sale.snapshot_id,
                type: 'REVERSAL',
                idempotencyKey: reversalKey
            });

            if (reversalEntry) {
                reversedEntries.push(reversalEntry);
            }
        });

        return reversedEntries;
    }
};

if (typeof module !== 'undefined') {
    module.exports = VolumeLedger;
}
