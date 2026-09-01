// Hapanamy Product Commission Validator Service
// Enforces hard profit protections and calculates safe maximum binary rates

const ProductCommissionValidator = {
    /**
     * Validates product economics calculations against company margin limits.
     * @param {Object} calcResult - Result from ProductEconomicsCalculator.calculate()
     * @param {number} warningThresholdLkr - Configurable warning margin boundary in LKR (default: 500.00)
     */
    validate(calcResult, warningThresholdLkr = 500.00) {
        const { source, calculated } = calcResult;
        
        const sellingPrice = calculated.selling_price;
        const productCost = source.product_cost || 0;
        const grossProfit = calculated.gross_profit;
        const effectiveBudget = calculated.effective_commission_budget;
        const directComm = calculated.direct_commission_amount;
        const maxTotalExposure = calculated.max_total_commission_exposure;
        const remainingMargin = calculated.remaining_company_margin;
        const maxLevels = parseInt(source.max_binary_qualified_levels || 7);
        const binaryVolume = source.binary_volume || 0;

        let status = 'SAFE';
        let allowed = true;
        let blockedReason = null;
        const warnings = [];
        const riskReasons = [];
        const recommendedActions = [];

        // 1. Calculate Maximum Safe Binary Rate (Auto Safe Formula)
        let maxSafeBinaryRate = 0.00;
        const remainingBinaryBudget = effectiveBudget - directComm;
        if (remainingBinaryBudget > 0 && binaryVolume > 0 && maxLevels > 0) {
            const maxBinaryPerLevel = remainingBinaryBudget / maxLevels;
            const rateFraction = maxBinaryPerLevel / binaryVolume;
            // Floor down to exactly 2 decimal places (Never round up!)
            maxSafeBinaryRate = Math.floor(rateFraction * 100 * 100) / 100;
            if (maxSafeBinaryRate < 0) maxSafeBinaryRate = 0.00;
        }

        // 2. Enforce Hard Block Conditions
        if (productCost > sellingPrice) {
            status = 'BLOCKED';
            allowed = false;
            blockedReason = 'Product cost exceeds selling price.';
            riskReasons.push('Negative profit margins');
            recommendedActions.push('Increase market/selling price or reduce manufacturing cost.');
        } else if (grossProfit <= 0) {
            status = 'BLOCKED';
            allowed = false;
            blockedReason = 'Gross profit is zero or negative.';
            riskReasons.push('No gross profit generated');
            recommendedActions.push('Ensure selling price is higher than product cost.');
        } else if (effectiveBudget <= 0) {
            status = 'BLOCKED';
            allowed = false;
            blockedReason = 'Effective commission budget is zero or negative after accounting for reserves.';
            riskReasons.push('Exceeded reserves budget limits');
            recommendedActions.push('Reduce operating/refund reserves or increase product selling price.');
        } else if (directComm > effectiveBudget) {
            status = 'BLOCKED';
            allowed = false;
            blockedReason = 'Direct referral commission exceeds effective commission budget.';
            riskReasons.push('Excessive direct referral payout');
            recommendedActions.push('Decrease direct commission percent.');
        } else if (maxTotalExposure > effectiveBudget) {
            status = 'BLOCKED';
            allowed = false;
            blockedReason = 'Maximum total commission exposure exceeds effective commission budget.';
            riskReasons.push('Excessive binary multilevel payout exposure');
            recommendedActions.push(`Decrease binary commission rate. Recommended safe rate: <= ${maxSafeBinaryRate}%`);
        }

        // 3. Enforce Warning Thresholds (Only if not already BLOCKED)
        if (status !== 'BLOCKED') {
            if (remainingMargin < warningThresholdLkr) {
                status = 'WARNING';
                warnings.push(`Low remaining company margin (LKR ${remainingMargin.toFixed(2)}).`);
                riskReasons.push('Slim operating profit buffer');
                recommendedActions.push(`Set binary commission rate to ${maxSafeBinaryRate}% or lower.`);
            }
        }

        const excessAmount = (maxTotalExposure > effectiveBudget) 
            ? Math.round((maxTotalExposure - effectiveBudget) * 100) / 100 
            : 0.00;

        return {
            status,
            allowed,
            blocked_reason: blockedReason,
            excess_amount: excessAmount,
            warnings,
            risk_reasons: riskReasons,
            economics: calculated,
            recommended_actions: recommendedActions,
            maximum_safe_binary_rate: maxSafeBinaryRate
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = ProductCommissionValidator;
}
