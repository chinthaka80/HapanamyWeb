// Hapanamy.lk Reusable Product Economics Service
// Authoritative backend service conforming to Section 27 of the Product Economics Specification

const ProductEconomicsCalculator = require('./product-economics-calculator');
const ProductCommissionValidator = require('./product-commission-validator');
const ProductSnapshotService = require('./product-snapshot-service');

const ProductEconomicsService = {
    /**
     * 1. Calculate complete product economics.
     * @param {Object} input - Product economics input fields
     * @returns {Object} Complete calculation breakdown
     */
    calculateProductEconomics(input = {}) {
        return ProductEconomicsCalculator.calculate(input);
    },

    /**
     * 2. Calculate discrete company cost allocations.
     * @param {Object} input - Cost parameters
     * @param {number} sellingPriceCents - Selling price in integer cents
     * @returns {Object} Cost allocations breakdown in both cents and LKR
     */
    calculateCompanyCostAllocation(input = {}, sellingPriceCents = 0) {
        const spCents = sellingPriceCents || Math.round((parseFloat(input.selling_price || input.price || 0)) * 100);

        const resolveCostCents = (percentVal, fixedVal, legacyVal) => {
            if (percentVal !== undefined && percentVal !== null && percentVal > 0) {
                return Math.round(spCents * (parseFloat(percentVal) / 100));
            }
            if (fixedVal !== undefined && fixedVal !== null && fixedVal > 0) {
                return Math.round(parseFloat(fixedVal) * 100);
            }
            if (legacyVal !== undefined && legacyVal !== null && legacyVal > 0) {
                return Math.round(parseFloat(legacyVal) * 100);
            }
            return 0;
        };

        const taxCostCents = resolveCostCents(input.tax_rate !== undefined ? input.tax_rate : input.tax_percent, input.tax_amount !== undefined ? input.tax_amount : input.tax_fixed_amount, input.tax_reserve);
        const hostingCostCents = resolveCostCents(input.hosting_cost_rate !== undefined ? input.hosting_cost_rate : input.hosting_cost_percent, input.hosting_cost_amount !== undefined ? input.hosting_cost_amount : input.hosting_cost_fixed, null);
        const staffCostCents = resolveCostCents(input.staff_cost_rate !== undefined ? input.staff_cost_rate : input.staff_cost_percent, input.staff_cost_amount !== undefined ? input.staff_cost_amount : input.staff_cost_fixed, null);
        const marketingCostCents = resolveCostCents(input.marketing_cost_rate !== undefined ? input.marketing_cost_rate : input.marketing_cost_percent, input.marketing_cost_amount !== undefined ? input.marketing_cost_amount : input.marketing_cost_fixed, input.other_reserve);
        const refundReserveCents = resolveCostCents(input.refund_reserve_rate !== undefined ? input.refund_reserve_rate : input.refund_reserve_percent, input.refund_reserve_amount !== undefined ? input.refund_reserve_amount : input.refund_reserve_fixed, input.refund_risk_reserve);
        const supportCostCents = resolveCostCents(input.support_cost_rate !== undefined ? input.support_cost_rate : input.support_cost_percent, input.support_cost_amount !== undefined ? input.support_cost_amount : input.support_cost_fixed, null);
        const operationalCostCents = resolveCostCents(input.operational_cost_rate !== undefined ? input.operational_cost_rate : input.operational_cost_percent, input.operational_cost_amount !== undefined ? input.operational_cost_amount : input.operational_cost_fixed, input.operating_cost_reserve);
        const paymentProcessingCostCents = resolveCostCents(input.payment_processing_rate !== undefined ? input.payment_processing_rate : input.payment_processing_percent, input.payment_processing_amount !== undefined ? input.payment_processing_amount : input.payment_processing_fixed, input.payment_processing_reserve);

        const totalCompanyCostsCents = taxCostCents +
            hostingCostCents +
            staffCostCents +
            marketingCostCents +
            refundReserveCents +
            supportCostCents +
            operationalCostCents +
            paymentProcessingCostCents;

        return {
            tax_amount: taxCostCents / 100,
            hosting_cost_amount: hostingCostCents / 100,
            staff_cost_amount: staffCostCents / 100,
            marketing_cost_amount: marketingCostCents / 100,
            refund_reserve_amount: refundReserveCents / 100,
            support_cost_amount: supportCostCents / 100,
            operational_cost_amount: operationalCostCents / 100,
            payment_processing_amount: paymentProcessingCostCents / 100,
            total_company_costs: totalCompanyCostsCents / 100,
            cents: {
                tax: taxCostCents,
                hosting: hostingCostCents,
                staff: staffCostCents,
                marketing: marketingCostCents,
                refund: refundReserveCents,
                support: supportCostCents,
                operational: operationalCostCents,
                payment_processing: paymentProcessingCostCents,
                total: totalCompanyCostsCents
            }
        };
    },

    /**
     * 3. Calculate Maximum Available Commission Pool.
     * @param {Object} input - Product economics configuration
     * @returns {number} Commission pool in LKR
     */
    calculateCommissionPool(input = {}) {
        const result = ProductEconomicsCalculator.calculate(input);
        return result.calculated.commission_pool;
    },

    /**
     * 4. Calculate Direct Referral Commission.
     * @param {number} sellingPrice - Selling price in LKR
     * @param {number} rate - Direct commission rate % (default 8%)
     * @returns {number} Direct commission in LKR
     */
    calculateDirectCommission(sellingPrice = 0, rate = 8.00) {
        const spCents = Math.round((parseFloat(sellingPrice || 0)) * 100);
        const commCents = Math.round(spCents * (parseFloat(rate || 8.00) / 100));
        return commCents / 100;
    },

    /**
     * 5. Calculate Maximum Binary Exposure across qualified levels.
     * @param {number} sellingPriceOrBv - Selling price or Binary Volume in LKR
     * @param {number} binaryRate - Binary commission rate % (default 7%)
     * @param {number} maxLevels - Maximum qualified uplines (default 7)
     * @returns {number} Maximum binary exposure in LKR
     */
    calculateMaximumBinaryExposure(sellingPriceOrBv = 0, binaryRate = 7.00, maxLevels = 7) {
        const bvCents = Math.round((parseFloat(sellingPriceOrBv || 0)) * 100);
        const perLevelCents = Math.round(bvCents * (parseFloat(binaryRate || 7.00) / 100));
        const totalBinaryCents = perLevelCents * parseInt(maxLevels || 7);
        return totalBinaryCents / 100;
    },

    /**
     * 6. Calculate Maximum Total Commission Exposure (Direct + Binary).
     * @param {number} directCommission - Direct commission in LKR
     * @param {number} maxBinaryExposure - Max binary exposure in LKR
     * @returns {number} Total maximum exposure in LKR
     */
    calculateMaximumCommissionExposure(directCommission = 0, maxBinaryExposure = 0) {
        const directCents = Math.round((parseFloat(directCommission || 0)) * 100);
        const binaryCents = Math.round((parseFloat(maxBinaryExposure || 0)) * 100);
        return (directCents + binaryCents) / 100;
    },

    /**
     * 7. Calculate Profit Margins and Stress-Test Diagnostics.
     * @param {number} sellingPrice - Revenue in LKR
     * @param {number} productCost - Product cost in LKR
     * @param {number} totalCompanyCosts - Total company allocations in LKR
     * @param {number} companyProfitReserve - Profit reserve in LKR
     * @param {number} maxTotalExposure - Total theoretical commission in LKR
     * @returns {Object} Margins and stress-test results
     */
    calculateProfitMargin(sellingPrice = 0, productCost = 0, totalCompanyCosts = 0, companyProfitReserve = 0, maxTotalExposure = 0) {
        const spCents = Math.round((parseFloat(sellingPrice || 0)) * 100);
        const pcCents = Math.round((parseFloat(productCost || 0)) * 100);
        const ccCents = Math.round((parseFloat(totalCompanyCosts || 0)) * 100);
        const prCents = Math.round((parseFloat(companyProfitReserve || 0)) * 100);
        const expCents = Math.round((parseFloat(maxTotalExposure || 0)) * 100);

        const grossMarginCents = spCents - pcCents;
        const availableContribCents = grossMarginCents - ccCents;
        const netPreCommissionMarginCents = availableContribCents - prCents;
        const commissionPoolCents = Math.max(0, netPreCommissionMarginCents);
        const stressTestRemainingCents = commissionPoolCents - expCents;
        const shortfallCents = expCents > commissionPoolCents ? expCents - commissionPoolCents : 0;

        return {
            gross_margin: grossMarginCents / 100,
            available_contribution: availableContribCents / 100,
            net_pre_commission_margin: netPreCommissionMarginCents / 100,
            commission_pool: commissionPoolCents / 100,
            stress_test_remaining: stressTestRemainingCents / 100,
            potential_shortfall: shortfallCents / 100,
            company_profit_reserve_protected: availableContribCents >= prCents ? 'YES' : 'NO',
            commission_fully_covered: expCents <= commissionPoolCents ? 'YES' : 'NO'
        };
    },

    /**
     * 8. Validate Commission Safety and Auto-Safe binary rate.
     * @param {Object} calcResult - Output from calculateProductEconomics()
     * @param {number} warningThresholdLkr - Warning boundary in LKR (default 500.00)
     * @returns {Object} Validation report with SAFE / WARNING / NOT_VIABLE status
     */
    validateCommissionSafety(calcResult, warningThresholdLkr = 500.00) {
        return ProductCommissionValidator.validate(calcResult, warningThresholdLkr);
    },

    /**
     * 9. Generate 25-field cryptographically sealed snapshot at purchase.
     * @param {Object} product - Product record
     * @param {string} version - Economics version
     * @returns {Object} Immutable snapshot with SHA-256 hash
     */
    getProductFinancialSnapshot(product = {}, version = 'v1.0') {
        const purchaseId = product.purchase_id || 'pur-snap-' + Math.random().toString(36).substr(2, 9);
        return ProductSnapshotService.createSnapshot(
            { ...product, economics_version: version },
            purchaseId
        );
    },

    /**
     * 10. Migrate existing product into full economics structure.
     * @param {Object} legacyProduct - Existing product object
     * @param {Object} safeDefaults - Configurable global safe defaults
     * @returns {Object} Migrated product with full economics fields
     */
    migrateExistingProduct(legacyProduct = {}, safeDefaults = {}) {
        const price = parseFloat(legacyProduct.price || legacyProduct.selling_price || 0);
        const hasCustomEconomics = legacyProduct.tax_amount !== undefined || legacyProduct.tax_percent !== undefined || legacyProduct.product_cost !== undefined;

        const isUnconfigured = !hasCustomEconomics && (!legacyProduct.minimum_company_profit && !legacyProduct.operating_cost_reserve);

        const migrated = {
            ...legacyProduct,
            selling_price: price,
            product_cost: legacyProduct.product_cost !== undefined ? parseFloat(legacyProduct.product_cost) : (isUnconfigured ? null : Math.round(price * 0.3)),
            
            // 7 Company Cost Allocations
            tax_type: legacyProduct.tax_type || (safeDefaults.tax_percent ? 'PERCENTAGE' : 'FIXED'),
            tax_rate: legacyProduct.tax_rate !== undefined ? legacyProduct.tax_rate : (safeDefaults.tax_percent || 0),
            tax_amount: legacyProduct.tax_amount !== undefined ? legacyProduct.tax_amount : (isUnconfigured ? null : Math.round(price * 0.05)),

            hosting_cost_type: legacyProduct.hosting_cost_type || 'FIXED',
            hosting_cost_rate: legacyProduct.hosting_cost_rate || 0,
            hosting_cost_amount: legacyProduct.hosting_cost_amount !== undefined ? legacyProduct.hosting_cost_amount : (isUnconfigured ? null : 100),

            staff_cost_type: legacyProduct.staff_cost_type || 'FIXED',
            staff_cost_rate: legacyProduct.staff_cost_rate || 0,
            staff_cost_amount: legacyProduct.staff_cost_amount !== undefined ? legacyProduct.staff_cost_amount : (isUnconfigured ? null : 300),

            marketing_cost_type: legacyProduct.marketing_cost_type || 'FIXED',
            marketing_cost_rate: legacyProduct.marketing_cost_rate || 0,
            marketing_cost_amount: legacyProduct.marketing_cost_amount !== undefined ? legacyProduct.marketing_cost_amount : (isUnconfigured ? null : 400),

            refund_reserve_type: legacyProduct.refund_reserve_type || (safeDefaults.refund_reserve_percent ? 'PERCENTAGE' : 'FIXED'),
            refund_reserve_rate: legacyProduct.refund_reserve_rate !== undefined ? legacyProduct.refund_reserve_rate : (safeDefaults.refund_reserve_percent || 0),
            refund_reserve_amount: legacyProduct.refund_reserve_amount !== undefined ? legacyProduct.refund_reserve_amount : (isUnconfigured ? null : Math.round(price * 0.03)),

            support_cost_type: legacyProduct.support_cost_type || 'FIXED',
            support_cost_rate: legacyProduct.support_cost_rate || 0,
            support_cost_amount: legacyProduct.support_cost_amount !== undefined ? legacyProduct.support_cost_amount : (isUnconfigured ? null : 100),

            operational_cost_type: legacyProduct.operational_cost_type || 'FIXED',
            operational_cost_rate: legacyProduct.operational_cost_rate || 0,
            operational_cost_amount: legacyProduct.operational_cost_amount !== undefined ? legacyProduct.operational_cost_amount : (isUnconfigured ? null : 150),

            payment_processing_type: legacyProduct.payment_processing_type || 'FIXED',
            payment_processing_rate: legacyProduct.payment_processing_rate || 0,
            payment_processing_amount: legacyProduct.payment_processing_amount !== undefined ? legacyProduct.payment_processing_amount : 0,

            // Profit Reserve
            profit_reserve_type: legacyProduct.profit_reserve_type || 'FIXED',
            profit_reserve_rate: legacyProduct.profit_reserve_rate || 0,
            profit_reserve_amount: legacyProduct.profit_reserve_amount !== undefined ? legacyProduct.profit_reserve_amount : (isUnconfigured ? null : Math.round(price * 0.15)),

            // Commission Settings
            direct_commission_rate: legacyProduct.direct_commission_rate !== undefined ? legacyProduct.direct_commission_rate : 8.00,
            binary_commission_rate: legacyProduct.binary_commission_rate !== undefined ? legacyProduct.binary_commission_rate : 7.00,
            maximum_qualified_uplines: legacyProduct.maximum_qualified_uplines || 7,

            economics_version: legacyProduct.economics_version || 'v1.0',
            economics_review_required: isUnconfigured
        };

        // Calculate and validate
        if (!isUnconfigured) {
            const calc = ProductEconomicsCalculator.calculate(migrated);
            const val = ProductCommissionValidator.validate(calc);
            migrated.financial_status = val.financial_status;
            migrated.commission_pool = calc.calculated.commission_pool;
            migrated.maximum_total_commission_exposure = calc.calculated.maximum_total_commission_exposure;
            migrated.commission_safety_margin = calc.calculated.commission_safety_margin;
            migrated.commission_pool_utilization = calc.calculated.commission_pool_utilization;
        } else {
            migrated.financial_status = 'NOT_CONFIGURED';
        }

        return migrated;
    }
};

if (typeof module !== 'undefined') {
    module.exports = ProductEconomicsService;
}
