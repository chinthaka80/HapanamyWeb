// Hapanamy.lk 7 Qualified Upline Binary Commission Engine (STEP 19)
// Traverses binary tree upwards from purchaser's placement parent, evaluating member qualification,
// strictly counting only QUALIFIED recipients up to the configured limit (default 7), enforcing
// daily earning caps, immutable snapshot economics, idempotency, and refund reversals.

const crypto = require('crypto');
const ProductSnapshotService = require('./product-snapshot-service');
const QualificationEngine = require('./qualification-engine');

const QualifiedUplineCommissionEngine = {
    _processingLocks: new Set(),

    /**
     * Calculates binary commission amount in cents.
     */
    calculateBinaryCommission(binaryVolume, ratePercent = 6.00) {
        const volumeCents = Math.round(Number(binaryVolume) * 100);
        const commissionCents = Math.round(volumeCents * (Number(ratePercent) / 100));
        return commissionCents / 100;
    },

    /**
     * Enforces daily earning cap on binary commission payout.
     */
    applyDailyCap(amount, currentEarningToday = 0.00, dailyCapLimit = 30000.00) {
        const amountCents = Math.round(Number(amount) * 100);
        const currentCents = Math.round(Number(currentEarningToday) * 100);
        const capCents = Math.round(Number(dailyCapLimit) * 100);

        const remainingCapCents = Math.max(0, capCents - currentCents);
        const eligibleCents = Math.min(amountCents, remainingCapCents);
        const cappedCents = amountCents - eligibleCents;

        return {
            calculatedAmount: amountCents / 100,
            eligibleAmount: eligibleCents / 100,
            cappedAmount: cappedCents / 100
        };
    },

    /**
     * Complete 7 Qualified Upline Binary Commission Pipeline (STEP 19)
     */
    processQualifiedUplineCommissions({
        purchase,
        snapshot,
        binaryNodes = [],
        qualificationContext = {},
        commissionLedger = [],
        walletLedger = [],
        traversalLogs = [],
        dailyEarningsMap = new Map(),
        dailyCapLimit = 30000.00,
        options = {}
    }) {
        // 1. Validate Purchase
        if (!purchase || !purchase.id) {
            throw new Error('Valid purchase is required for upline commission distribution.');
        }

        if (purchase.status !== 'ACTIVE' && purchase.status !== 'Active') {
            return {
                success: false,
                reason: `Cannot process upline commissions for non-active purchase (Status: ${purchase.status}).`
            };
        }

        const lockKey = `lock-upline-${purchase.id}`;
        if (this._processingLocks.has(lockKey)) {
            throw new Error(`Concurrent upline commission processing in progress for purchase ${purchase.id}`);
        }

        this._processingLocks.add(lockKey);

        try {
            // 2. Validate and Read Immutable Snapshot
            let effectiveSnapshot = snapshot;
            if (!effectiveSnapshot && purchase.economics_snapshot) {
                effectiveSnapshot = purchase.economics_snapshot;
            }

            if (!effectiveSnapshot) {
                return {
                    success: false,
                    reason: 'Immutable economics snapshot is missing for purchase.'
                };
            }

            const integrity = ProductSnapshotService.verifySnapshotIntegrity(effectiveSnapshot);
            if (!integrity.valid) {
                return {
                    success: false,
                    reason: `Snapshot integrity check failed: ${integrity.reason}`
                };
            }

            if (effectiveSnapshot.economics_status === 'BLOCKED') {
                return {
                    success: false,
                    reason: 'Product economics status was BLOCKED at purchase time. Commission distribution prohibited.'
                };
            }

            const binaryVolume = effectiveSnapshot.binary_volume || effectiveSnapshot.selling_price || 0;
            const binaryRate = effectiveSnapshot.binary_commission_rate !== undefined 
                ? effectiveSnapshot.binary_commission_rate 
                : 6.00;

            const maxQualifiedLevels = effectiveSnapshot.max_binary_qualified_levels !== undefined 
                ? effectiveSnapshot.max_binary_qualified_levels 
                : 7;

            const baseCommissionPerLevel = this.calculateBinaryCommission(binaryVolume, binaryRate);

            if (baseCommissionPerLevel <= 0) {
                return {
                    success: true,
                    qualified_recipients_count: 0,
                    total_commission_paid: 0.00,
                    message: 'Calculated binary commission per level is 0.00.'
                };
            }

            // 3. Locate Purchasing User in Binary Tree
            const purchasingUserId = purchase.user_id;
            const purchaserNode = binaryNodes.find(n => n.user_id === purchasingUserId);
            if (!purchaserNode || !purchaserNode.placement_parent_id) {
                return {
                    success: true,
                    qualified_recipients_count: 0,
                    total_commission_paid: 0.00,
                    message: 'Purchaser is at tree root or not placed. No uplines exist.'
                };
            }

            const paidEntries = [];
            const evaluatedUplines = [];
            let currentParentId = purchaserNode.placement_parent_id;
            let qualifiedCount = 0;
            let hopIndex = 0;
            let totalPaid = 0;

            // 4. Traverse Upward through Binary Tree
            while (currentParentId && qualifiedCount < maxQualifiedLevels) {
                hopIndex++;
                const uplineId = currentParentId;
                const parentNode = binaryNodes.find(n => n.user_id === uplineId);

                // A. Check Qualification Status
                const qDecision = QualificationEngine.evaluateQualification(uplineId, qualificationContext);

                if (!qDecision.is_qualified) {
                    // Unqualified member -> DO NOT PAY & DO NOT CONSUME A SLOT
                    const evalRecord = {
                        purchase_id: purchase.id,
                        upline_id: uplineId,
                        hop_index: hopIndex,
                        is_qualified: false,
                        qualification_status: qDecision.status,
                        paid: false,
                        reason: `Unqualified: ${qDecision.unmet_requirements.join('; ') || qDecision.status}`,
                        commission_amount: 0.00,
                        timestamp: new Date().toISOString()
                    };
                    evaluatedUplines.push(evalRecord);
                    if (traversalLogs) traversalLogs.push(evalRecord);

                    // Climb up without incrementing qualifiedCount
                    currentParentId = parentNode ? parentNode.placement_parent_id : null;
                    continue;
                }

                // B. Qualified Member -> Check Idempotency & Earning Caps
                qualifiedCount++;
                const idempotencyKey = `comm-binary-${purchase.id}-${uplineId}`;
                const alreadyPaid = commissionLedger.some(c => 
                    c.idempotency_key === idempotencyKey || 
                    (c.source_purchase_id === purchase.id && c.type === 'BINARY' && c.user_id === uplineId)
                );

                if (alreadyPaid) {
                    const evalRecord = {
                        purchase_id: purchase.id,
                        upline_id: uplineId,
                        hop_index: hopIndex,
                        qualified_rank: qualifiedCount,
                        is_qualified: true,
                        paid: false,
                        reason: 'Idempotency: already paid for this purchase.',
                        commission_amount: 0.00,
                        timestamp: new Date().toISOString()
                    };
                    evaluatedUplines.push(evalRecord);
                    if (traversalLogs) traversalLogs.push(evalRecord);

                    currentParentId = parentNode ? parentNode.placement_parent_id : null;
                    continue;
                }

                const todayKey = `${uplineId}-${new Date().toISOString().split('T')[0]}`;
                const currentEarnings = dailyEarningsMap.get(todayKey) || 0.00;
                const capResult = this.applyDailyCap(baseCommissionPerLevel, currentEarnings, dailyCapLimit);

                // C. Create Immutable Binary Commission Ledger Entry
                const commissionEntry = {
                    id: 'comm-bin-' + crypto.randomBytes(8).toString('hex'),
                    idempotency_key: idempotencyKey,
                    user_id: uplineId,
                    source_purchase_id: purchase.id,
                    source_user_id: purchasingUserId,
                    snapshot_id: effectiveSnapshot.id,
                    type: 'BINARY',
                    qualified_rank: qualifiedCount,
                    rate: binaryRate,
                    base_volume: binaryVolume,
                    calculated_amount: capResult.calculatedAmount,
                    eligible_amount: capResult.eligibleAmount,
                    capped_amount: capResult.cappedAmount,
                    status: 'APPROVED',
                    created_at: new Date().toISOString()
                };

                commissionLedger.push(commissionEntry);
                paidEntries.push(commissionEntry);
                totalPaid = Math.round((totalPaid + capResult.eligibleAmount) * 100) / 100;

                // D. Credit Financial Wallet
                if (walletLedger && capResult.eligibleAmount > 0) {
                    walletLedger.push({
                        id: 'tx-bin-' + crypto.randomBytes(8).toString('hex'),
                        user_id: uplineId,
                        source_purchase_id: purchase.id,
                        type: 'BINARY_COMMISSION',
                        amount: capResult.eligibleAmount,
                        created_at: new Date().toISOString()
                    });
                }

                dailyEarningsMap.set(todayKey, currentEarnings + capResult.eligibleAmount);

                const evalRecord = {
                    purchase_id: purchase.id,
                    upline_id: uplineId,
                    hop_index: hopIndex,
                    qualified_rank: qualifiedCount,
                    is_qualified: true,
                    paid: true,
                    calculated_amount: capResult.calculatedAmount,
                    eligible_amount: capResult.eligibleAmount,
                    capped_amount: capResult.cappedAmount,
                    timestamp: new Date().toISOString()
                };
                evaluatedUplines.push(evalRecord);
                if (traversalLogs) traversalLogs.push(evalRecord);

                // Climb to next parent
                currentParentId = parentNode ? parentNode.placement_parent_id : null;
            }

            return {
                success: true,
                purchase_id: purchase.id,
                base_commission_per_recipient: baseCommissionPerLevel,
                max_qualified_levels: maxQualifiedLevels,
                qualified_recipients_count: paidEntries.length,
                total_commission_paid: totalPaid,
                paid_entries: paidEntries,
                evaluated_uplines: evaluatedUplines
            };

        } finally {
            this._processingLocks.delete(lockKey);
        }
    },

    /**
     * Reverses qualified upline binary commissions due to purchase refund or cancellation.
     */
    reverseQualifiedUplineCommissions(sourcePurchaseId, commissionLedger = [], walletLedger = []) {
        const binaryEntries = commissionLedger.filter(c => 
            c.source_purchase_id === sourcePurchaseId && 
            c.type === 'BINARY' && 
            c.status === 'APPROVED'
        );

        const reversedEntries = [];

        binaryEntries.forEach(entry => {
            const reversalKey = `rev-comm-binary-${sourcePurchaseId}-${entry.user_id}`;
            const reversalEntry = {
                id: 'comm-bin-rev-' + crypto.randomBytes(8).toString('hex'),
                idempotency_key: reversalKey,
                user_id: entry.user_id,
                source_purchase_id: sourcePurchaseId,
                snapshot_id: entry.snapshot_id,
                type: 'BINARY_REVERSAL',
                qualified_rank: entry.qualified_rank,
                rate: entry.rate,
                base_volume: entry.base_volume,
                calculated_amount: -entry.calculated_amount,
                eligible_amount: -entry.eligible_amount,
                status: 'REVERSED',
                created_at: new Date().toISOString()
            };

            commissionLedger.push(reversalEntry);
            reversedEntries.push(reversalEntry);

            if (walletLedger) {
                walletLedger.push({
                    id: 'tx-wlt-bin-rev-' + crypto.randomBytes(8).toString('hex'),
                    user_id: entry.user_id,
                    source_purchase_id: sourcePurchaseId,
                    type: 'COMMISSION_REVERSAL',
                    amount: -entry.eligible_amount,
                    created_at: new Date().toISOString()
                });
            }
        });

        return reversedEntries;
    }
};

if (typeof module !== 'undefined') {
    module.exports = QualifiedUplineCommissionEngine;
}
