// Hapanamy.lk Direct Commission Engine (STEP 18)
// Dedicated pipeline for direct referral commissions, immutable economics snapshot integration,
// earning caps, sponsor validation, strict idempotency, and compensating refund reversals.

const crypto = require('crypto');
const ProductSnapshotService = require('./product-snapshot-service');

const DirectCommissionEngine = {
    _processingLocks: new Set(),

    /**
     * Calculates direct commission using cents-based arithmetic to prevent floating-point inaccuracies.
     */
    calculateDirectCommission(sellingPrice, ratePercent = 8.00) {
        const priceCents = Math.round(Number(sellingPrice) * 100);
        const commissionCents = Math.round(priceCents * (Number(ratePercent) / 100));
        return commissionCents / 100;
    },

    /**
     * Enforces the daily cap limit on member earnings.
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
     * Complete Direct Commission Processing Pipeline (STEP 18)
     */
    processDirectCommission({
        purchase,
        snapshot,
        sponsors = [],
        users = [],
        commissionLedger = [],
        walletLedger = [],
        dailyEarningsMap = new Map(),
        dailyCapLimit = 30000.00,
        options = {}
    }) {
        // 1. Validate Purchase
        if (!purchase || !purchase.id) {
            throw new Error('Valid purchase is required for direct commission processing.');
        }

        if (purchase.status !== 'ACTIVE' && purchase.status !== 'Active') {
            return {
                success: false,
                reason: `Cannot process direct commission for non-active purchase (Status: ${purchase.status}).`
            };
        }

        const lockKey = `lock-direct-${purchase.id}`;
        if (this._processingLocks.has(lockKey)) {
            throw new Error(`Concurrent direct commission processing in progress for purchase ${purchase.id}`);
        }

        this._processingLocks.add(lockKey);

        try {
            // 2. Identify Purchaser Direct Sponsor
            const sponsorLink = sponsors.find(s => s.user_id === purchase.user_id);
            if (!sponsorLink || !sponsorLink.sponsor_id) {
                return {
                    success: true,
                    direct_commission_amount: 0.00,
                    message: `Purchaser ${purchase.user_id} has no sponsor. Direct commission skipped.`
                };
            }

            const sponsorId = sponsorLink.sponsor_id;

            // 3. Validate Sponsor Status
            if (users && users.length > 0) {
                const sponsorUser = users.find(u => u.id === sponsorId || u.username === sponsorId);
                if (sponsorUser && (sponsorUser.status === 'SUSPENDED' || sponsorUser.status === 'BANNED' || sponsorUser.status === 'INACTIVE')) {
                    return {
                        success: false,
                        reason: `Sponsor ${sponsorId} is ${sponsorUser.status}. Direct commission skipped.`
                    };
                }
            }

            // 4. Validate and Read Immutable Snapshot
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

            const sellingPrice = effectiveSnapshot.selling_price;
            const directRate = effectiveSnapshot.direct_commission_rate !== undefined 
                ? effectiveSnapshot.direct_commission_rate 
                : 8.00;

            // 5. Calculate Direct Commission
            let directCommissionAmount = 0;
            if (effectiveSnapshot.direct_commission_amount !== undefined && effectiveSnapshot.direct_commission_amount > 0) {
                directCommissionAmount = effectiveSnapshot.direct_commission_amount;
            } else {
                directCommissionAmount = this.calculateDirectCommission(sellingPrice, directRate);
            }

            if (directCommissionAmount <= 0) {
                return {
                    success: true,
                    direct_commission_amount: 0.00,
                    message: 'Calculated direct commission is 0.00.'
                };
            }

            // 6. Enforce Idempotency
            const idempotencyKey = `comm-direct-${purchase.id}-${sponsorId}`;
            const alreadyProcessed = commissionLedger.some(c => 
                c.idempotency_key === idempotencyKey || 
                (c.source_purchase_id === purchase.id && c.type === 'DIRECT' && c.user_id === sponsorId)
            );

            if (alreadyProcessed) {
                console.log(`⚠️ Idempotency block: Direct commission for purchase ${purchase.id} to sponsor ${sponsorId} already processed.`);
                return {
                    success: true,
                    idempotent: true,
                    direct_commission_amount: directCommissionAmount
                };
            }

            // 7. Check Earning Caps
            const todayKey = `${sponsorId}-${new Date().toISOString().split('T')[0]}`;
            const currentEarnings = dailyEarningsMap.get(todayKey) || 0.00;
            const capResult = this.applyDailyCap(directCommissionAmount, currentEarnings, dailyCapLimit);

            // 8. Create Commission Ledger Entry
            const commissionEntry = {
                id: 'comm-dir-' + crypto.randomBytes(8).toString('hex'),
                idempotency_key: idempotencyKey,
                user_id: sponsorId,
                source_purchase_id: purchase.id,
                source_user_id: purchase.user_id,
                snapshot_id: effectiveSnapshot.id,
                type: 'DIRECT',
                rate: directRate,
                base_volume: sellingPrice,
                calculated_amount: capResult.calculatedAmount,
                eligible_amount: capResult.eligibleAmount,
                capped_amount: capResult.cappedAmount,
                status: 'APPROVED',
                created_at: new Date().toISOString()
            };

            commissionLedger.push(commissionEntry);

            // 9. Credit Financial Wallet
            if (walletLedger && capResult.eligibleAmount > 0) {
                walletLedger.push({
                    id: 'tx-wlt-' + crypto.randomBytes(8).toString('hex'),
                    user_id: sponsorId,
                    source_purchase_id: purchase.id,
                    type: 'DIRECT_COMMISSION',
                    amount: capResult.eligibleAmount,
                    created_at: new Date().toISOString()
                });
            }

            dailyEarningsMap.set(todayKey, currentEarnings + capResult.eligibleAmount);

            return {
                success: true,
                purchase_id: purchase.id,
                sponsor_id: sponsorId,
                rate_percent: directRate,
                calculated_amount: capResult.calculatedAmount,
                eligible_amount: capResult.eligibleAmount,
                capped_amount: capResult.cappedAmount,
                entry: commissionEntry
            };

        } finally {
            this._processingLocks.delete(lockKey);
        }
    },

    /**
     * Reverses direct commission due to purchase refund or cancellation.
     */
    reverseDirectCommission(sourcePurchaseId, commissionLedger = [], walletLedger = []) {
        const directEntries = commissionLedger.filter(c => 
            c.source_purchase_id === sourcePurchaseId && 
            c.type === 'DIRECT' && 
            c.status === 'APPROVED'
        );

        const reversedEntries = [];

        directEntries.forEach(entry => {
            const reversalKey = `rev-comm-direct-${sourcePurchaseId}-${entry.user_id}`;
            const reversalEntry = {
                id: 'comm-rev-' + crypto.randomBytes(8).toString('hex'),
                idempotency_key: reversalKey,
                user_id: entry.user_id,
                source_purchase_id: sourcePurchaseId,
                snapshot_id: entry.snapshot_id,
                type: 'DIRECT_REVERSAL',
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
                    id: 'tx-wlt-rev-' + crypto.randomBytes(8).toString('hex'),
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
    module.exports = DirectCommissionEngine;
}
