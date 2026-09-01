// Hapanamy Safe Binary Commission Rate Calculator Service
// Computes and verifies maximum safe rates to protect MLM company margins

const ProductEconomicsCalculator = require('./product-economics-calculator');

const SafeBinaryCommissionRateCalculator = {
    /**
     * Calculates the highest allowed Binary Commission Rate.
     * @param {Object} input - Source product variables
     */
    calculateMaxSafeRate(input) {
        // Run initial economics calculation to get budgets
        const firstCalc = ProductEconomicsCalculator.calculate({ ...input, binary_commission_rate: 0.00 });
        const { calculated } = firstCalc;

        const effectiveBudget = calculated.effective_commission_budget;
        const directCommAmount = calculated.direct_commission_amount;
        const binaryVolume = input.binary_volume || 0;
        const maxLevels = parseInt(input.max_binary_qualified_levels || 7);

        const remainingBinaryBudget = effectiveBudget - directCommAmount;
        if (remainingBinaryBudget <= 0 || binaryVolume <= 0 || maxLevels <= 0) {
            return 0.00;
        }

        const maxBinaryPerLevel = remainingBinaryBudget / maxLevels;
        const rawRate = (maxBinaryPerLevel / binaryVolume) * 100;

        // Round DOWN to exactly 2 decimal places (Never round up!)
        let safeRate = Math.floor(rawRate * 100) / 100;
        if (safeRate < 0) safeRate = 0.00;

        // Verification Loop: Run economics calculator and reduce rate if rounding causes overshoot
        let attempts = 0;
        while (safeRate > 0 && attempts < 100) {
            const verifyCalc = ProductEconomicsCalculator.calculate({
                ...input,
                binary_commission_rate: safeRate
            });

            const totalExposure = verifyCalc.calculated.max_total_commission_exposure;
            if (totalExposure <= effectiveBudget) {
                break; // Safe!
            }
            // Reduce rate by 0.01 and verify again
            safeRate = Math.round((safeRate - 0.01) * 100) / 100;
            attempts++;
        }

        return Math.max(0.00, safeRate);
    },

    /**
     * Evaluates a requested binary rate and returns safe mode suggestions.
     */
    evaluateRate(input, requestedRate) {
        const maxSafeRate = this.calculateMaxSafeRate(input);
        const difference = Math.round((requestedRate - maxSafeRate) * 100) / 100;

        // Calculate expected exposure using requested rate
        const testCalc = ProductEconomicsCalculator.calculate({
            ...input,
            binary_commission_rate: requestedRate
        });
        const expectedExposure = testCalc.calculated.max_total_commission_exposure;

        const isAllowed = requestedRate <= maxSafeRate;

        return {
            allowed: isAllowed,
            requested_rate: requestedRate,
            maximum_safe_rate: maxSafeRate,
            difference: difference,
            expected_commission_exposure: expectedExposure
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = SafeBinaryCommissionRateCalculator;
}
