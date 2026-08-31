// Hapanamy.lk Commission Calculation Engine (Phase 7)
// Calculates direct/referral commissions, handles uplines tree traversal, daily caps, and reversals.

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
     * Up to 7 qualified recipients can earn 7% each of the matched volume.
     */
    processBinaryUplineCommission(originatingUserId, matchedVolume, binaryNodes, purchases, sponsors, commissionLedger, dailyEarningsMap, dailyCapLimit = 30000.00) {
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

        while (currentParentId && qualifiedCount < 7) {
            const parentNode = binaryNodes.find(n => n.user_id === currentParentId);
            
            // Check qualification
            if (this.isQualified(currentParentId, purchases, sponsors)) {
                // Matched Volume * 7%
                const baseCommission = this.calculateBinaryCommission(matchedVolume, 7.00);
                
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
                    rate: 7.00,
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
