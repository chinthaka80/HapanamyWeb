// Hapanamy.lk Product Commission Validator Service
// Enforces hard profit protections, commission safety checks, and auto-safe binary rate calculations

const ProductCommissionValidator = {
    /**
     * Validates product economics calculations against company margin limits and commission caps.
     * @param {Object} calcResult - Result from ProductEconomicsCalculator.calculate()
     * @param {number} warningThresholdLkr - Configurable warning margin boundary in LKR (default: 500.00)
     */
    validate(calcResult, warningThresholdLkr = 500.00) {
        const { source = {}, calculated = {} } = calcResult || {};
        
        const sellingPrice = calculated.selling_price || 0;
        const productCost = calculated.product_cost !== undefined ? calculated.product_cost : (source.product_cost || 0);
        const grossContribution = calculated.gross_contribution !== undefined ? calculated.gross_contribution : calculated.gross_profit;
        const totalOperatingCost = calculated.total_operating_cost || 0;
        const availableContribution = calculated.available_contribution !== undefined ? calculated.available_contribution : (grossContribution - totalOperatingCost);
        const companyProfitReserve = calculated.company_profit_reserve || 0;
        const commissionPool = calculated.commission_pool !== undefined ? calculated.commission_pool : calculated.effective_commission_budget;
        
        const directComm = calculated.direct_commission_amount || 0;
        const binaryPerLevel = calculated.binary_commission_per_recipient || 0;
        const maxLevels = parseInt(calculated.max_binary_qualified_levels || source.max_binary_qualified_levels || 7);
        const maxBinaryLiability = calculated.max_binary_liability !== undefined ? calculated.max_binary_liability : (binaryPerLevel * maxLevels);
        const maxTotalExposure = calculated.max_total_commission_liability !== undefined ? calculated.max_total_commission_liability : (directComm + maxBinaryLiability);
        const remainingContribution = calculated.remaining_contribution !== undefined ? calculated.remaining_contribution : (commissionPool - maxTotalExposure);
        
        const binaryVolume = calculated.binary_volume !== undefined ? calculated.binary_volume : (source.binary_volume || sellingPrice);

        let status = 'SAFE';
        let allowed = true;
        let blockedReason = null;
        const warnings = [];
        const riskReasons = [];
        const recommendedActions = [];

        // 1. Calculate Maximum Safe Binary Rate (Auto-Safe Formula)
        let maxSafeBinaryRate = 0.00;
        const remainingBinaryBudget = commissionPool - directComm;
        if (remainingBinaryBudget > 0 && binaryVolume > 0 && maxLevels > 0) {
            const maxBinaryPerLevel = remainingBinaryBudget / maxLevels;
            const rateFraction = maxBinaryPerLevel / binaryVolume;
            // Floor down to exactly 2 decimal places (Never round up!)
            maxSafeBinaryRate = Math.floor(rateFraction * 100 * 100) / 100;
            if (maxSafeBinaryRate < 0) maxSafeBinaryRate = 0.00;
        }

        // 2. Comprehensive Hard Block / Unsafe Validations
        if (!sellingPrice || sellingPrice <= 0 || isNaN(sellingPrice)) {
            status = 'BLOCKED';
            allowed = false;
            blockedReason = 'Selling price must be greater than zero.';
            riskReasons.push('Invalid or zero selling price');
            recommendedActions.push('Enter a positive selling price.');
        } else if (productCost < 0 || isNaN(productCost)) {
            status = 'BLOCKED';
            allowed = false;
            blockedReason = 'Product cost cannot be negative.';
            riskReasons.push('Negative product cost');
        } else if (productCost > sellingPrice) {
            status = 'BLOCKED';
            allowed = false;
            blockedReason = `Product cost exceeds selling price (${productCost.toFixed(2)} > ${sellingPrice.toFixed(2)}).`;
            riskReasons.push('Negative gross profit margin');
            recommendedActions.push('Increase market/selling price or reduce manufacturing/fulfillment cost.');
        } else if (grossContribution <= 0) {
            status = 'BLOCKED';
            allowed = false;
            blockedReason = 'Gross profit is zero or negative.';
            riskReasons.push('No gross contribution generated');
            recommendedActions.push('Ensure selling price is strictly higher than product cost.');
        } else if (availableContribution <= 0) {
            status = 'BLOCKED';
            allowed = false;
            blockedReason = 'Available contribution is zero or negative after deducting operating costs.';
            riskReasons.push('Operating costs and reserves exceed gross margin');
            recommendedActions.push('Reduce cost allocations (marketing, staff, hosting, refund reserve) or increase selling price.');
        } else if (commissionPool <= 0) {
            status = 'BLOCKED';
            allowed = false;
            blockedReason = 'Safe commission pool is zero or exhausted after company profit reserve.';
            riskReasons.push('Zero commission capacity remaining');
            recommendedActions.push('Reduce company profit reserve or increase available contribution.');
        } else if (directComm > commissionPool) {
            status = 'BLOCKED';
            allowed = false;
            blockedReason = `Direct referral commission exceeds safe commission pool / effective budget (${directComm.toFixed(2)} > ${commissionPool.toFixed(2)}).`;
            riskReasons.push('Excessive direct referral payout');
            recommendedActions.push('Decrease direct commission percentage.');
        } else if (maxTotalExposure > commissionPool) {
            status = 'BLOCKED';
            allowed = false;
            const shortfallAmt = Math.round((maxTotalExposure - commissionPool) * 100) / 100;
            blockedReason = `Maximum total commission exposure exceeds effective commission budget (${maxTotalExposure.toFixed(2)} > ${commissionPool.toFixed(2)}) by LKR ${shortfallAmt.toFixed(2)}.`;
            riskReasons.push('Maximum multilevel commission liability exceeds safe allocation');
            recommendedActions.push(`Decrease binary commission rate to <= ${maxSafeBinaryRate}% or adjust direct commission rate.`);
        }

        // 3. Enforce Warning Thresholds (Commission Capacity Near Limit)
        if (allowed && status !== 'BLOCKED') {
            const utilization = commissionPool > 0 ? (maxTotalExposure / commissionPool) * 100 : 0;
            if (remainingContribution > 0 && remainingContribution <= warningThresholdLkr) {
                status = 'WARNING';
                warnings.push(`Commission capacity is near limit (${utilization.toFixed(1)}% utilization, LKR ${remainingContribution.toFixed(2)} remaining margin).`);
                riskReasons.push('Slim operational buffer');
                recommendedActions.push(`Consider setting binary commission rate to ${maxSafeBinaryRate}% or lower for safety.`);
            }
        }

        const shortfall = (maxTotalExposure > commissionPool) 
            ? Math.round((maxTotalExposure - commissionPool) * 100) / 100 
            : 0.00;

        const safetyStatus = status === 'BLOCKED' ? 'UNSAFE' : status;
        const financialStatus = status === 'BLOCKED' ? 'NOT_VIABLE' : status;
        const statusLabel = status === 'BLOCKED' ? 'NOT COMMISSION VIABLE' : (status === 'WARNING' ? 'WARNING' : 'SAFE');

        return {
            status, // 'SAFE' | 'WARNING' | 'BLOCKED'
            financial_status: financialStatus, // 'SAFE' | 'WARNING' | 'NOT_VIABLE'
            status_label: statusLabel,
            safety_status: safetyStatus, // 'SAFE' | 'WARNING' | 'UNSAFE'
            economics_status: safetyStatus,
            is_safe: allowed,
            is_viable: allowed,
            is_unsafe: !allowed,
            allowed,
            blocked_reason: blockedReason,
            shortfall,
            excess_amount: shortfall, // Backward compatibility alias
            warnings,
            risk_reasons: riskReasons,
            reasons: riskReasons, // Backward compatibility alias
            economics: calculated,
            stress_test_result: calculated.stress_test_result || {
                company_profit_reserve_protected: (availableContribution >= companyProfitReserve) ? 'YES' : 'NO',
                commission_fully_covered: (maxTotalExposure <= commissionPool) ? 'YES' : 'NO',
                potential_shortfall: shortfall
            },
            recommended_actions: recommendedActions,
            maximum_safe_binary_rate: maxSafeBinaryRate
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = ProductCommissionValidator;
}
