// Hapanamy.lk Product Economics & Commission Calculation Engine
// Authoritative deterministic financial engine using exact integer cents calculations

const ProductEconomicsCalculator = {
    /**
     * Calculates complete product economics and commission liabilities.
     * All internal arithmetic is performed in integer cents to eliminate floating-point errors.
     * 
     * @param {Object} input - Product economics configuration payload
     * @returns {Object} Complete calculated breakdown with source and metadata
     */
    calculate(input = {}) {
        // 1. Base Prices (normalized to cents)
        const marketPriceCents = Math.round((parseFloat(input.market_price !== undefined ? input.market_price : (input.price || 0.00))) * 100);
        const discountValueCents = Math.round((parseFloat(input.discount_value || 0.00)) * 100);
        const configuredSellingPriceCents = Math.round((parseFloat(input.selling_price !== undefined ? input.selling_price : (input.price || 0.00))) * 100);
        const productCostCents = Math.round((parseFloat(input.product_cost || 0.00)) * 100);

        // Calculate Final Effective Selling Price (Revenue)
        let sellingPriceCents = configuredSellingPriceCents;
        if (input.pricing_mode === 'FIXED') {
            sellingPriceCents = configuredSellingPriceCents;
        } else if (input.pricing_mode === 'DISCOUNTED') {
            if (input.discount_type === 'FIXED') {
                sellingPriceCents = Math.max(0, marketPriceCents - discountValueCents);
            } else if (input.discount_type === 'PERCENTAGE') {
                const discountCents = Math.round(marketPriceCents * (discountValueCents / 10000));
                sellingPriceCents = Math.max(0, marketPriceCents - discountCents);
            } else {
                sellingPriceCents = marketPriceCents;
            }
        }

        // Binary volume (BV) defaults to Selling Price if not specified
        const binaryVolumeCents = input.binary_volume !== undefined 
            ? Math.round((parseFloat(input.binary_volume || 0.00)) * 100) 
            : sellingPriceCents;

        // 2. Gross Contribution Before Other Costs
        const grossContributionCents = sellingPriceCents - productCostCents;

        // Helper to resolve cost allocation (Percent of Selling Price or Fixed Amount)
        const resolveCostCents = (percentVal, fixedVal, legacyReserveVal) => {
            if (percentVal !== undefined && percentVal !== null && percentVal > 0) {
                return Math.round(sellingPriceCents * (parseFloat(percentVal) / 100));
            }
            if (fixedVal !== undefined && fixedVal !== null && fixedVal > 0) {
                return Math.round(parseFloat(fixedVal) * 100);
            }
            if (legacyReserveVal !== undefined && legacyReserveVal !== null && legacyReserveVal > 0) {
                return Math.round(parseFloat(legacyReserveVal) * 100);
            }
            return 0;
        };

        // 3. The 7 Business Cost Allocations & Reserves
        // A. Taxes
        const taxCostCents = resolveCostCents(
            input.tax_rate !== undefined ? input.tax_rate : input.tax_percent,
            input.tax_amount !== undefined ? input.tax_amount : (input.tax_fixed_amount || input.tax_fixed),
            input.tax_reserve
        );
        
        // B. Hosting Cost
        const hostingCostCents = resolveCostCents(
            input.hosting_cost_rate !== undefined ? input.hosting_cost_rate : input.hosting_cost_percent,
            input.hosting_cost_amount !== undefined ? input.hosting_cost_amount : (input.hosting_cost_fixed || input.hosting_cost_per_sale),
            null
        );
        
        // C. Staff Cost
        const staffCostCents = resolveCostCents(
            input.staff_cost_rate !== undefined ? input.staff_cost_rate : input.staff_cost_percent,
            input.staff_cost_amount !== undefined ? input.staff_cost_amount : (input.staff_cost_fixed || input.staff_cost_per_sale),
            null
        );
        
        // D. Marketing Cost
        const marketingCostCents = resolveCostCents(
            input.marketing_cost_rate !== undefined ? input.marketing_cost_rate : input.marketing_cost_percent,
            input.marketing_cost_amount !== undefined ? input.marketing_cost_amount : (input.marketing_cost_fixed || input.marketing_cost_per_sale),
            input.other_reserve
        );
        
        // E. Refund Reserve (e.g. 5% = Rs. 1,375 on Rs. 27,500)
        const refundReserveCents = resolveCostCents(
            input.refund_reserve_rate !== undefined ? input.refund_reserve_rate : input.refund_reserve_percent,
            input.refund_reserve_amount !== undefined ? input.refund_reserve_amount : (input.refund_reserve_fixed || input.refund_reserve_per_sale),
            input.refund_risk_reserve
        );
        
        // F. Customer Support Cost
        const supportCostCents = resolveCostCents(
            input.support_cost_rate !== undefined ? input.support_cost_rate : input.support_cost_percent,
            input.support_cost_amount !== undefined ? input.support_cost_amount : (input.support_cost_fixed || input.support_cost_per_sale),
            null
        );
        
        // G. Operational Cost (software, compliance, administration, etc.)
        const operationalCostCents = resolveCostCents(
            input.operational_cost_rate !== undefined ? input.operational_cost_rate : input.operational_cost_percent,
            input.operational_cost_amount !== undefined ? input.operational_cost_amount : (input.operational_cost_fixed || input.operational_cost_per_sale),
            input.operating_cost_reserve
        );

        // H. Payment Processing Cost (gateway fees, CEFT/bank charges)
        const paymentProcessingCostCents = resolveCostCents(
            input.payment_processing_rate !== undefined ? input.payment_processing_rate : input.payment_processing_percent,
            input.payment_processing_amount !== undefined ? input.payment_processing_amount : (input.payment_processing_fixed || input.payment_processing_per_sale),
            input.payment_processing_reserve
        );

        // Optional Safety Buffer
        const safetyBufferCents = Math.round((parseFloat(input.commission_safety_buffer || 0.00)) * 100);

        // Total Operating & Reserve Cost (All Company Cost Allocations)
        const totalOperatingCostCents = taxCostCents +
            hostingCostCents +
            staffCostCents +
            marketingCostCents +
            refundReserveCents +
            supportCostCents +
            operationalCostCents +
            paymentProcessingCostCents;

        // 4. Available Contribution
        const availableContributionCents = grossContributionCents - totalOperatingCostCents;

        // 5. Company Profit Reserve
        let companyProfitReserveCents = 0;
        if (input.profit_reserve_type === 'PERCENTAGE' || input.company_profit_reserve_percent > 0 || (input.profit_reserve_rate !== undefined && input.profit_reserve_rate > 0 && input.profit_reserve_type !== 'FIXED')) {
            const pct = parseFloat(input.company_profit_reserve_percent || input.profit_reserve_percent || input.profit_reserve_rate || 0);
            const baseForProfit = (input.profit_reserve_base === 'SELLING_PRICE') ? sellingPriceCents : Math.max(0, availableContributionCents);
            companyProfitReserveCents = Math.round(baseForProfit * (pct / 100));
        } else if (input.profit_reserve_fixed !== undefined || input.minimum_company_profit !== undefined || input.company_profit_reserve_amount !== undefined || input.profit_reserve_amount !== undefined) {
            const fixedAmt = parseFloat(input.profit_reserve_fixed !== undefined ? input.profit_reserve_fixed : (input.minimum_company_profit !== undefined ? input.minimum_company_profit : (input.company_profit_reserve_amount !== undefined ? input.company_profit_reserve_amount : input.profit_reserve_amount)));
            companyProfitReserveCents = Math.round((fixedAmt || 0) * 100);
        }

        // 6. Protected Company Amount & Commission Budgets (Legacy and Modern Parity)
        const protectedCompanyAmountCents = totalOperatingCostCents + companyProfitReserveCents;
        const netCommissionBudgetCents = grossContributionCents - protectedCompanyAmountCents;
        
        // Safe Commission Pool / Effective Budget
        let commissionPoolCents = Math.max(0, netCommissionBudgetCents - safetyBufferCents);
        if (input.effective_commission_budget !== undefined) {
            commissionPoolCents = Math.round(parseFloat(input.effective_commission_budget) * 100);
        }

        // 7. Direct Commission (Selling Price * Direct Commission Rate %)
        const directCommissionRate = parseFloat(input.direct_commission_rate !== undefined ? input.direct_commission_rate : (input.direct_commission_percent !== undefined ? input.direct_commission_percent : 8.00));
        const directCommissionAmountCents = Math.round(sellingPriceCents * (directCommissionRate / 100));

        // 8. Binary Commission Per Qualified Recipient (Binary Volume * Binary Commission Rate %)
        const binaryCommissionRate = parseFloat(input.binary_commission_rate !== undefined ? input.binary_commission_rate : (input.binary_commission_percent !== undefined ? input.binary_commission_percent : 7.00));
        const binaryCommissionPerRecipientCents = Math.round(binaryVolumeCents * (binaryCommissionRate / 100));

        // 9. Maximum 7 Qualified Levels Binary Liability
        const maxBinaryQualifiedLevels = parseInt(input.max_binary_qualified_levels !== undefined ? input.max_binary_qualified_levels : (input.maximum_qualified_uplines !== undefined ? input.maximum_qualified_uplines : 7));
        const maxBinaryLiabilityCents = binaryCommissionPerRecipientCents * maxBinaryQualifiedLevels;

        // 10. Total Maximum Commission Liability
        const maxTotalCommissionLiabilityCents = directCommissionAmountCents + maxBinaryLiabilityCents;

        // 11. Remaining Company Contribution & Shortfall
        const remainingContributionCents = commissionPoolCents - maxTotalCommissionLiabilityCents;
        const shortfallCents = maxTotalCommissionLiabilityCents > commissionPoolCents 
            ? maxTotalCommissionLiabilityCents - commissionPoolCents 
            : 0;

        // 12. Commission Utilization & Safety Status
        let commissionUtilizationPercent = 0.00;
        if (commissionPoolCents > 0) {
            commissionUtilizationPercent = Math.round((maxTotalCommissionLiabilityCents / commissionPoolCents) * 10000) / 100;
        } else if (maxTotalCommissionLiabilityCents > 0) {
            commissionUtilizationPercent = 999.99;
        }

        let financialStatus = 'SAFE';
        let safetyStatus = 'SAFE';
        let safetyMessage = 'Product commission structure is economically safe.';
        if (sellingPriceCents <= 0 || productCostCents > sellingPriceCents || availableContributionCents <= 0 || commissionPoolCents <= 0 || maxTotalCommissionLiabilityCents > commissionPoolCents) {
            financialStatus = 'NOT_VIABLE';
            safetyStatus = 'UNSAFE';
            safetyMessage = shortfallCents > 0 
                ? `Maximum commission liability exceeds safe commission pool by LKR ${(shortfallCents / 100).toFixed(2)}.` 
                : 'Insufficient contribution margin to support operations and commissions.';
        } else if (commissionUtilizationPercent > 80.00 || remainingContributionCents < 50000) {
            financialStatus = 'WARNING';
            safetyStatus = 'WARNING';
            safetyMessage = `Commission capacity is near limit (${commissionUtilizationPercent}% utilization).`;
        }

        // 13. Profit Margins & Profitability Percentages (Section 18)
        const grossMarginPercentage = sellingPriceCents > 0 
            ? Math.round((availableContributionCents / sellingPriceCents) * 10000) / 100 
            : 0.00;

        const netProtectedProfitPercentage = sellingPriceCents > 0 
            ? Math.round((companyProfitReserveCents / sellingPriceCents) * 10000) / 100 
            : 0.00;

        const commissionLiabilityPercentage = sellingPriceCents > 0 
            ? Math.round((maxTotalCommissionLiabilityCents / sellingPriceCents) * 10000) / 100 
            : 0.00;

        const calcPercentOfRevenue = (amtCents) => sellingPriceCents > 0 ? Math.round((amtCents / sellingPriceCents) * 10000) / 100 : 0.00;

        // 14. Stress-Test Result Diagnostics (Section 17)
        const companyProfitReserveProtected = (availableContributionCents >= companyProfitReserveCents);
        const commissionFullyCovered = (maxTotalCommissionLiabilityCents <= commissionPoolCents);

        // 15. Versioning
        const economicsVersion = input.economics_version || 'v1.0';

        return {
            source: { ...input },
            calculated: {
                selling_price: sellingPriceCents / 100,
                product_cost: productCostCents / 100,
                gross_contribution: grossContributionCents / 100,
                
                // Cost Breakdown
                tax_cost: taxCostCents / 100,
                hosting_cost: hostingCostCents / 100,
                staff_cost: staffCostCents / 100,
                marketing_cost: marketingCostCents / 100,
                refund_reserve: refundReserveCents / 100,
                support_cost: supportCostCents / 100,
                operational_cost: operationalCostCents / 100,
                payment_processing_cost: paymentProcessingCostCents / 100,
                total_operating_cost: totalOperatingCostCents / 100,

                // Contribution & Pool
                available_contribution: availableContributionCents / 100,
                company_profit_reserve: companyProfitReserveCents / 100,
                commission_safety_buffer: safetyBufferCents / 100,
                commission_pool: commissionPoolCents / 100,

                // Commissions
                direct_commission_rate: directCommissionRate,
                direct_commission_amount: directCommissionAmountCents / 100,
                binary_volume: binaryVolumeCents / 100,
                binary_commission_rate: binaryCommissionRate,
                binary_commission_per_recipient: binaryCommissionPerRecipientCents / 100,
                max_binary_qualified_levels: maxBinaryQualifiedLevels,
                maximum_qualified_uplines: maxBinaryQualifiedLevels,
                max_binary_liability: maxBinaryLiabilityCents / 100,
                maximum_binary_exposure: maxBinaryLiabilityCents / 100,
                max_total_commission_liability: maxTotalCommissionLiabilityCents / 100,
                maximum_total_commission_exposure: maxTotalCommissionLiabilityCents / 100,

                // Safety & Margin
                remaining_contribution: remainingContributionCents / 100,
                commission_safety_margin: remainingContributionCents / 100,
                shortfall: shortfallCents / 100,
                potential_shortfall: shortfallCents / 100,
                commission_utilization_percentage: commissionUtilizationPercent,
                commission_pool_utilization: commissionUtilizationPercent,
                financial_status: financialStatus,
                safety_status: safetyStatus,
                safety_message: safetyMessage,
                is_viable: (financialStatus !== 'NOT_VIABLE'),
                is_safe: (financialStatus === 'SAFE'),

                // Profitability Percentages (Section 18)
                product_cost_percent: calcPercentOfRevenue(productCostCents),
                tax_percent: calcPercentOfRevenue(taxCostCents),
                hosting_cost_percent: calcPercentOfRevenue(hostingCostCents),
                staff_cost_percent: calcPercentOfRevenue(staffCostCents),
                marketing_cost_percent: calcPercentOfRevenue(marketingCostCents),
                refund_reserve_percent: calcPercentOfRevenue(refundReserveCents),
                support_cost_percent: calcPercentOfRevenue(supportCostCents),
                operational_cost_percent: calcPercentOfRevenue(operationalCostCents),
                payment_processing_percent: calcPercentOfRevenue(paymentProcessingCostCents),
                profit_reserve_percent: calcPercentOfRevenue(companyProfitReserveCents),
                commission_exposure_percent: commissionLiabilityPercentage,
                safety_margin_percent: calcPercentOfRevenue(remainingContributionCents),

                // Stress-Test Result Diagnostics (Section 17)
                stress_test_result: {
                    company_profit_reserve_protected: companyProfitReserveProtected ? 'YES' : 'NO',
                    commission_fully_covered: commissionFullyCovered ? 'YES' : 'NO',
                    potential_shortfall: shortfallCents / 100
                },

                // Percentage Indicators
                gross_margin_percentage: grossMarginPercentage,
                net_protected_profit_percentage: netProtectedProfitPercentage,
                commission_liability_percentage: commissionLiabilityPercentage,
                
                // Compatibility aliases for legacy modules
                gross_profit: grossContributionCents / 100,
                protected_company_amount: protectedCompanyAmountCents / 100,
                net_commission_budget: netCommissionBudgetCents / 100,
                effective_commission_budget: commissionPoolCents / 100,
                max_binary_commission_exposure: maxBinaryLiabilityCents / 100,
                max_total_commission_exposure: maxTotalCommissionLiabilityCents / 100,
                remaining_company_margin: remainingContributionCents / 100,

                economics_version: economicsVersion
            },
            calculated_at: new Date().toISOString()
        };
    },

    /**
     * Simulates commission matching under custom volume and qualified tier conditions.
     */
    simulateScenario(productEconomics, leftVolume = 0, rightVolume = 0, qualifiedLevels = 7) {
        const calc = this.calculate(productEconomics);
        const sellingPrice = calc.calculated.selling_price;
        const matchedVolume = Math.min(parseFloat(leftVolume || 0), parseFloat(rightVolume || 0));
        const binaryRate = calc.calculated.binary_commission_rate;
        const binaryPerLevel = Math.round(matchedVolume * (binaryRate / 100) * 100) / 100;
        const actualLevelsPaid = Math.min(parseInt(qualifiedLevels || 0), calc.calculated.max_binary_qualified_levels);
        const totalBinaryPaid = Math.round(binaryPerLevel * actualLevelsPaid * 100) / 100;
        const directPaid = calc.calculated.direct_commission_amount;
        const totalActualCommission = Math.round((directPaid + totalBinaryPaid) * 100) / 100;
        const pool = calc.calculated.commission_pool;
        const remaining = Math.round((pool - totalActualCommission) * 100) / 100;
        const isSafe = totalActualCommission <= pool;

        return {
            selling_price: sellingPrice,
            left_volume: parseFloat(leftVolume || 0),
            right_volume: parseFloat(rightVolume || 0),
            matched_volume: matchedVolume,
            binary_commission_rate: binaryRate,
            binary_commission_per_level: binaryPerLevel,
            qualified_levels_requested: parseInt(qualifiedLevels || 0),
            qualified_levels_paid: actualLevelsPaid,
            total_binary_commission: totalBinaryPaid,
            direct_commission: directPaid,
            total_commission_paid: totalActualCommission,
            commission_pool: pool,
            remaining_contribution: remaining,
            company_profit_reserve: calc.calculated.company_profit_reserve,
            is_scenario_safe: isSafe,
            scenario_safety_status: isSafe ? (remaining >= 0 ? 'SAFE' : 'WARNING') : 'UNSAFE'
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = ProductEconomicsCalculator;
}
