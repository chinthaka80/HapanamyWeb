// Hapanamy.lk Product Economics Calculator Service
// Pure deterministic service that performs cents-based product margin and commission validations

const ProductEconomicsCalculator = {
    /**
     * Calculates all product economics and commissions.
     * All inputs and calculations are normalized to cents (integers) to prevent floating point errors.
     */
    calculate(input) {
        // Convert input numbers to cents
        const marketPriceCents = Math.round((input.market_price || 0) * 100);
        const discountValueCents = Math.round((input.discount_value || 0) * 100);
        const configuredSellingPriceCents = Math.round((input.selling_price || 0) * 100);
        const productCostCents = Math.round((input.product_cost || 0) * 100);
        const binaryVolumeCents = Math.round((input.binary_volume || 0) * 100);

        const minCompanyProfitCents = Math.round((input.minimum_company_profit || 0) * 100);
        const operatingCostReserveCents = Math.round((input.operating_cost_reserve || 0) * 100);
        const paymentProcessingReserveCents = Math.round((input.payment_processing_reserve || 0) * 100);
        const refundRiskReserveCents = Math.round((input.refund_risk_reserve || 0) * 100);
        const taxReserveCents = Math.round((input.tax_reserve || 0) * 100);
        const otherReserveCents = Math.round((input.other_reserve || 0) * 100);
        const commissionSafetyBufferCents = Math.round((input.commission_safety_buffer || 0) * 100);

        const directCommissionRate = input.direct_commission_rate || 0.00; // e.g., 8.00%
        const binaryCommissionRate = input.binary_commission_rate || 0.00; // e.g., 7.00%
        const maxBinaryQualifiedLevels = parseInt(input.max_binary_qualified_levels || 7);

        // 1. Calculate Final Selling Price
        let sellingPriceCents = 0;
        if (input.pricing_mode === 'FIXED') {
            sellingPriceCents = configuredSellingPriceCents;
        } else if (input.pricing_mode === 'DISCOUNTED') {
            if (input.discount_type === 'FIXED') {
                sellingPriceCents = Math.max(0, marketPriceCents - discountValueCents);
            } else if (input.discount_type === 'PERCENTAGE') {
                // discountValue is rate percent e.g., 10 for 10%
                const discountCents = Math.round(marketPriceCents * (discountValueCents / 10000));
                sellingPriceCents = Math.max(0, marketPriceCents - discountCents);
            } else {
                sellingPriceCents = marketPriceCents;
            }
        } else {
            sellingPriceCents = configuredSellingPriceCents;
        }

        // 2. Gross Profit
        const grossProfitCents = sellingPriceCents - productCostCents;

        // 3. Gross Margin Percentage
        let grossMarginPercentage = 0.00;
        if (sellingPriceCents > 0) {
            grossMarginPercentage = Math.round((grossProfitCents / sellingPriceCents) * 10000) / 100;
        }

        // 4. Protected Company Amount
        const protectedCompanyAmountCents = minCompanyProfitCents +
            operatingCostReserveCents +
            paymentProcessingReserveCents +
            refundRiskReserveCents +
            taxReserveCents +
            otherReserveCents;

        // 5. Net Commission Budget
        const netCommissionBudgetCents = grossProfitCents - protectedCompanyAmountCents;

        // 6. Effective Commission Budget
        const effectiveCommissionBudgetCents = netCommissionBudgetCents - commissionSafetyBufferCents;

        // 7. Direct Commission Amount (Selling Price * Direct Commission Rate)
        // Note: rate config is represented as percent (e.g. 8.00 meaning 8%)
        const directCommissionAmountCents = Math.round(sellingPriceCents * (directCommissionRate / 100));

        // 8. Binary Commission Per Qualified Recipient (Binary Volume * Binary Commission Rate)
        const binaryCommissionPerRecipientCents = Math.round(binaryVolumeCents * (binaryCommissionRate / 100));

        // 9. Maximum Binary Commission Exposure
        const maxBinaryCommissionExposureCents = binaryCommissionPerRecipientCents * maxBinaryQualifiedLevels;

        // 10. Maximum Total Commission Exposure
        const maxTotalCommissionExposureCents = directCommissionAmountCents + maxBinaryCommissionExposureCents;

        // 11. Remaining Company Margin
        const remainingCompanyMarginCents = effectiveCommissionBudgetCents - maxTotalCommissionExposureCents;

        return {
            source: { ...input },
            calculated: {
                selling_price: sellingPriceCents / 100,
                gross_profit: grossProfitCents / 100,
                gross_margin_percentage: grossMarginPercentage,
                protected_company_amount: protectedCompanyAmountCents / 100,
                net_commission_budget: netCommissionBudgetCents / 100,
                effective_commission_budget: effectiveCommissionBudgetCents / 100,
                direct_commission_amount: directCommissionAmountCents / 100,
                binary_commission_per_recipient: binaryCommissionPerRecipientCents / 100,
                max_binary_commission_exposure: maxBinaryCommissionExposureCents / 100,
                max_total_commission_exposure: maxTotalCommissionExposureCents / 100,
                remaining_company_margin: remainingCompanyMarginCents / 100
            }
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = ProductEconomicsCalculator;
}
