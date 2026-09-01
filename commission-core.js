// Hapanamy.lk Commission Calculation Engine (Phase 7 & Step 9 Integration)
// Calculates direct/referral commissions, handles uplines tree traversal, daily caps, reversals,
// and enforces immutable economics snapshot rules with full idempotency protection.

const ProductSnapshotService = require('./product-snapshot-service');
const VolumeLedger = require('./volume-ledger');

const CommissionCore = {
    /**
     * Calculates direct commission (8% default).
     * All monetary math uses safe minor units (cents) to avoid floating-point issues.
     */
    calculateDirectCommission(sellingPrice, ratePercent = 8) {
        const priceCents = Math.round(sellingPrice * 100);
        const commissionCents = Math.round(priceCents * (ratePercent / 100));
        return commissionCents / 100;
    },

    /**
     * Calculates binary commission (7% default).
     */
    calculateBinaryCommission(matchedVolume, ratePercent = 7) {
        const volumeCents = Math.round(matchedVolume * 100);
        const commissionCents = Math.round(volumeCents * (ratePercent / 100));
        return commissionCents / 100;
    },

    /**
     * Checks if a member is qualified to receive binary matching commissions.
     * Rule: User must have an active purchase AND must have sponsored at least one direct referral.
     */
    isQualified(userId, purchases, sponsors) {
        const hasActivePurchase = purchases.some(p => p.user_id === userId && p.status === 'ACTIVE');
        const hasDirectReferral = sponsors.some(s => s.sponsor_id === userId);
        return hasActivePurchase && hasDirectReferral;
    },

    /**
     * Enforces the daily cap limit on earnings.
     * Logs calculated, eligible, and capped (adjusted) amounts.
     */
    applyDailyCap(amount, currentEarningToday, dailyCapLimit = 30000.00) {
        const amountCents = Math.round(amount * 100);
        const currentCents = Math.round(currentEarningToday * 100);
        const capCents = Math.round(dailyCapLimit * 100);

        const remainingCapCents = Math.max(0, capCents - currentCents);
        const eligibleCents = Math.min(amountCents, remainingCapCents);
        const cappedCents = amountCents - eligibleCents;

        return {
            calculatedAmount: amount,
            eligibleAmount: eligibleCents / 100,
            cappedAmount: cappedCents / 100
        };
    },

    /**
     * Traces upward through the binary tree to pay binary commissions.
     * Supports configurable maximum qualified levels (default 7) and binary rate (default 7.00%).
     */
    processBinaryUplineCommission(
        originatingUserId, 
        matchedVolume, 
        binaryNodes, 
        purchases, 
        sponsors, 
        commissionLedger, 
        dailyEarningsMap, 
        dailyCapLimit = 30000.00,
        maxQualifiedLevels = 7,
        ratePercent = 7.00
    ) {
        // Idempotency check: Ensure match is not processed twice
        const matchId = `match-evt-${originatingUserId}-${matchedVolume}`;
        const alreadyProcessed = commissionLedger.some(c => c.source_match_id === matchId);
        if (alreadyProcessed) {
            console.log(`⚠️ Idempotency block: Match event ${matchId} already processed.`);
            return;
        }

        const node = binaryNodes.find(n => n.user_id === originatingUserId);
        if (!node) return;

        let currentParentId = node.placement_parent_id;
        let qualifiedCount = 0;
        const levelsLimit = maxQualifiedLevels !== undefined ? maxQualifiedLevels : 7;
        const binaryRate = ratePercent !== undefined ? ratePercent : 7.00;

        while (currentParentId && qualifiedCount < levelsLimit) {
            const parentNode = binaryNodes.find(n => n.user_id === currentParentId);
            
            // Check qualification
            if (this.isQualified(currentParentId, purchases, sponsors)) {
                // Matched Volume * rate
                const baseCommission = this.calculateBinaryCommission(matchedVolume, binaryRate);
                
                // Fetch daily earnings to check cap
                const todayKey = `${currentParentId}-${new Date().toISOString().split('T')[0]}`;
                const currentEarnings = dailyEarningsMap.get(todayKey) || 0.00;

                const capResult = this.applyDailyCap(baseCommission, currentEarnings, dailyCapLimit);
                
                // Log commission entry
                commissionLedger.push({
                    id: 'comm-uuid-' + Math.random().toString(36).substr(2, 9),
                    user_id: currentParentId,
                    source_match_id: matchId,
                    type: 'BINARY',
                    rate: binaryRate,
                    base_volume: matchedVolume,
                    calculated_amount: capResult.calculatedAmount,
                    eligible_amount: capResult.eligibleAmount,
                    capped_amount: capResult.cappedAmount,
                    status: 'APPROVED',
                    created_at: new Date().toISOString()
                });

                // Update daily earnings accumulator
                dailyEarningsMap.set(todayKey, currentEarnings + capResult.eligibleAmount);
                qualifiedCount++;
            }

            // Climb up
            currentParentId = parentNode ? parentNode.placement_parent_id : null;
        }
    },

    /**
     * Executes end-to-end commission calculation and volume propagation for an approved purchase
     * using the immutable snapshot data (Step 9 Integration).
     */
    processPurchaseCommissions(purchase, snapshot, context = {}) {
        const {
            binaryNodes = [],
            sponsors = [],
            commissionLedger = [],
            volumeLedger = [],
            walletLedger = [],
            dailyEarningsMap = new Map(),
            dailyCapLimit = 30000.00
        } = context;

        // 1. Verify Purchase status
        if (!purchase || purchase.status !== 'ACTIVE') {
            return {
                success: false,
                reason: 'Purchase is not active or missing.'
            };
        }

        // 2. Verify Snapshot existence & cryptographic integrity
        if (!snapshot) {
            return {
                success: false,
                reason: 'Immutable economics snapshot is missing for purchase.'
            };
        }

        const integrity = ProductSnapshotService.verifySnapshotIntegrity(snapshot);
        if (!integrity.valid) {
            return {
                success: false,
                reason: `Snapshot integrity check failed: ${integrity.reason}`
            };
        }

        // 3. Verify MLM was valid at purchase time (Economics status must not be BLOCKED)
        if (snapshot.economics_status === 'BLOCKED') {
            return {
                success: false,
                reason: 'Product economics status was BLOCKED at purchase time. Commission distribution prohibited.'
            };
        }

        // 4. Idempotency check for Direct Commission
        const directCommIdempotencyKey = `direct-comm-${purchase.id}`;
        const alreadyDirectPaid = commissionLedger.some(c => 
            c.idempotency_key === directCommIdempotencyKey || 
            (c.source_purchase_id === purchase.id && c.type === 'DIRECT')
        );

        let directCommissionEntry = null;

        if (!alreadyDirectPaid) {
            // Find direct sponsor of the purchasing user
            const sponsorLink = sponsors.find(s => s.user_id === purchase.user_id);
            if (sponsorLink && sponsorLink.sponsor_id) {
                // Calculate direct commission from snapshot selling_price and direct_commission_rate
                const directAmount = this.calculateDirectCommission(snapshot.selling_price, snapshot.direct_commission_rate);
                
                if (directAmount > 0) {
                    const todayKey = `${sponsorLink.sponsor_id}-${new Date().toISOString().split('T')[0]}`;
                    const currentEarnings = dailyEarningsMap.get(todayKey) || 0.00;
                    const capResult = this.applyDailyCap(directAmount, currentEarnings, dailyCapLimit);

                    directCommissionEntry = {
                        id: 'comm-uuid-' + Math.random().toString(36).substr(2, 9),
                        idempotency_key: directCommIdempotencyKey,
                        user_id: sponsorLink.sponsor_id,
                        source_purchase_id: purchase.id,
                        type: 'DIRECT',
                        rate: snapshot.direct_commission_rate,
                        base_volume: snapshot.selling_price,
                        calculated_amount: capResult.calculatedAmount,
                        eligible_amount: capResult.eligibleAmount,
                        capped_amount: capResult.cappedAmount,
                        status: 'APPROVED',
                        created_at: new Date().toISOString()
                    };

                    commissionLedger.push(directCommissionEntry);

                    if (walletLedger) {
                        walletLedger.push({
                            id: 'tx-' + Math.random().toString(36).substr(2, 9),
                            user_id: sponsorLink.sponsor_id,
                            source_purchase_id: purchase.id,
                            type: 'DIRECT_COMMISSION',
                            amount: capResult.eligibleAmount,
                            created_at: new Date().toISOString()
                        });
                    }

                    dailyEarningsMap.set(todayKey, currentEarnings + capResult.eligibleAmount);
                }
            }
        }

        // 5. Propagate Binary Volume using snapshot.binary_volume
        if (volumeLedger && snapshot.binary_volume > 0) {
            VolumeLedger.propagateVolume(
                purchase.user_id,
                snapshot.binary_volume,
                purchase.id,
                binaryNodes,
                volumeLedger
            );
        }

        return {
            success: true,
            purchase_id: purchase.id,
            snapshot_version: snapshot.snapshot_version,
            direct_commission: directCommissionEntry ? directCommissionEntry.eligible_amount : 0.00,
            binary_volume_propagated: snapshot.binary_volume,
            max_binary_qualified_levels: snapshot.max_binary_qualified_levels,
            binary_commission_rate: snapshot.binary_commission_rate
        };
    },

    /**
     * Reverses commission transaction due to refund/cancellation.
     */
    reverseCommission(sourcePurchaseId, commissionLedger) {
        const entries = commissionLedger.filter(c => c.source_purchase_id === sourcePurchaseId && c.status === 'APPROVED');
        
        entries.forEach(entry => {
            commissionLedger.push({
                id: 'comm-uuid-' + Math.random().toString(36).substr(2, 9),
                user_id: entry.user_id,
                source_purchase_id: sourcePurchaseId,
                type: entry.type,
                rate: entry.rate,
                base_volume: entry.base_volume,
                calculated_amount: -entry.calculated_amount,
                eligible_amount: -entry.eligible_amount,
                status: 'REVERSED',
                created_at: new Date().toISOString()
            });
        });
    }
};

if (typeof module !== 'undefined') {
    module.exports = CommissionCore;
}
