// Hapanamy Critical Product Economics Test Suite (Step 11)
// Rigorous verification of exact financial calculations, rounding down boundaries, and auto safe protections.

const testRunner = require('./test-runner');
const ProductEconomicsCalculator = require('../services/product-economics-calculator');
const ProductCommissionValidator = require('../services/product-commission-validator');
const SafeBinaryCommissionRateCalculator = require('../services/safe-binary-commission-calculator');

const baseMasterclassInput = {
    pricing_mode: 'DISCOUNTED',
    market_price: 35000.00,
    discount_type: 'FIXED',
    discount_value: 7500.00,
    product_cost: 10500.00,
    minimum_company_profit: 2000.00,
    operating_cost_reserve: 0.00,
    payment_processing_reserve: 0.00,
    refund_risk_reserve: 0.00,
    tax_reserve: 0.00,
    other_reserve: 0.00,
    commission_safety_buffer: 0.00,
    direct_commission_rate: 8.00,
    binary_volume: 27500.00,
    max_binary_qualified_levels: 7
};

test('Step 11 Baseline: Product pricing, gross profit, and effective budget verification', () => {
    const result = ProductEconomicsCalculator.calculate({
        ...baseMasterclassInput,
        binary_commission_rate: 0.00
    });

    const { calculated } = result;

    assert.equal(calculated.selling_price, 27500.00, 'Selling Price must be Rs. 27,500');
    assert.equal(calculated.gross_profit, 17000.00, 'Gross Profit must be Rs. 17,000 (27,500 - 10,500)');
    assert.equal(calculated.protected_company_amount, 2000.00, 'Protected company profit must be Rs. 2,000');
    assert.equal(calculated.net_commission_budget, 15000.00, 'Net Commission Budget must be Rs. 15,000');
    assert.equal(calculated.effective_commission_budget, 15000.00, 'Effective Commission Budget must be Rs. 15,000');
    assert.equal(calculated.direct_commission_amount, 2200.00, 'Direct Commission at 8% must be Rs. 2,200');
});

test('Step 11 Unsafe Test: Binary Rate = 7% causes over-budget exposure and BLOCKED status', () => {
    const input = {
        ...baseMasterclassInput,
        binary_commission_rate: 7.00
    };

    const calcResult = ProductEconomicsCalculator.calculate(input);
    const { calculated } = calcResult;

    // Verify exact expected numbers
    assert.equal(calculated.binary_commission_per_recipient, 1925.00, 'Binary per level at 7% must be Rs. 1,925');
    assert.equal(calculated.max_binary_commission_exposure, 13475.00, 'Maximum binary exposure for 7 levels must be Rs. 13,475');
    assert.equal(calculated.max_total_commission_exposure, 15675.00, 'Total commission exposure must be Rs. 15,675');

    const overBudget = calculated.max_total_commission_exposure - calculated.effective_commission_budget;
    assert.equal(overBudget, 675.00, 'Expected Over Budget must be exactly Rs. 675');

    // Run validator
    const validation = ProductCommissionValidator.validate(calcResult);
    assert.equal(validation.status, 'BLOCKED', 'Validation status must be BLOCKED');
    assert(validation.blocked_reason.includes('exceeds effective commission budget'), 'Blocked reason must state budget exceeded');
    assert.equal(validation.excess_amount, 675.00, 'Validation excess amount must be Rs. 675');
});

test('Step 11 Auto Safe Test: Calculates exact Maximum Safe Binary Rate with round DOWN', () => {
    // Remaining Binary Budget: 15,000 - 2,200 = 12,800
    // Max Binary Per Level: 12,800 / 7 = 1,828.57142857...
    // Max Safe Binary Rate: (12,800 / 7) / 27,500 * 100 = 6.64935...% -> Rounds DOWN to 6.64%
    const maxSafeRate = SafeBinaryCommissionRateCalculator.calculateMaxSafeRate(baseMasterclassInput);

    assert.equal(maxSafeRate, 6.64, 'Maximum Safe Binary Rate must be rounded DOWN to exactly 6.64%');

    // Verify economics with the calculated safe rate
    const safeCalcResult = ProductEconomicsCalculator.calculate({
        ...baseMasterclassInput,
        binary_commission_rate: maxSafeRate
    });
    const { calculated } = safeCalcResult;

    assert.equal(calculated.direct_commission_amount, 2200.00);
    assert.equal(calculated.binary_commission_per_recipient, 1826.00, 'Binary per level at 6.64% must be Rs. 1,826');
    assert.equal(calculated.max_binary_commission_exposure, 12782.00, '7 levels binary exposure must be Rs. 12,782');
    assert.equal(calculated.max_total_commission_exposure, 14982.00, 'Total exposure must be Rs. 14,982');
    assert(calculated.max_total_commission_exposure <= calculated.effective_commission_budget, 'Total exposure must NEVER exceed Rs. 15,000');

    // Validation check: ensure it is not BLOCKED
    const validation = ProductCommissionValidator.validate(safeCalcResult);
    assert(validation.status !== 'BLOCKED', 'Auto Safe rate must never be BLOCKED');
});

test('Step 11 Lower Rate Test: Binary Rate below Maximum Safe Rate is SAFE', () => {
    const input = {
        ...baseMasterclassInput,
        binary_commission_rate: 6.00 // Lower rate (6% < 6.64%)
    };

    const calcResult = ProductEconomicsCalculator.calculate(input);
    const { calculated } = calcResult;

    assert.equal(calculated.binary_commission_per_recipient, 1650.00, 'Binary per level at 6% must be Rs. 1,650');
    assert.equal(calculated.max_binary_commission_exposure, 11550.00, '7 levels binary exposure must be Rs. 11,550');
    assert.equal(calculated.max_total_commission_exposure, 13750.00, 'Total exposure must be Rs. 13,750');
    assert.equal(calculated.remaining_company_margin, 1250.00, 'Remaining company margin must be Rs. 1,250');

    const validation = ProductCommissionValidator.validate(calcResult);
    assert.equal(validation.status, 'SAFE', 'Lower rate must result in SAFE status');
});

test('Step 11 Higher Rate Test: Binary Rate of 7% (and boundary 6.65%) is BLOCKED', () => {
    // Test boundary: 6.65% (which is 0.01% higher than safe 6.64%)
    const boundaryResult = ProductEconomicsCalculator.calculate({
        ...baseMasterclassInput,
        binary_commission_rate: 6.65
    });

    // At 6.65%: binary per member = round(27,500 * 0.0665) = 1,828.75
    // 7 levels = 1,828.75 * 7 = 12,801.25
    // Total exposure = 2,200 + 12,801.25 = 15,001.25 > 15,000.00 (Exceeds budget by Rs. 1.25!)
    assert.equal(boundaryResult.calculated.max_total_commission_exposure, 15001.25);
    const boundaryValidation = ProductCommissionValidator.validate(boundaryResult);
    assert.equal(boundaryValidation.status, 'BLOCKED', 'Boundary rate of 6.65% must be BLOCKED');

    // Test 7.00%
    const rate7Result = ProductEconomicsCalculator.calculate({
        ...baseMasterclassInput,
        binary_commission_rate: 7.00
    });
    const rate7Validation = ProductCommissionValidator.validate(rate7Result);
    assert.equal(rate7Validation.status, 'BLOCKED', '7.00% rate must be BLOCKED');
});

test('Step 11 Cents-based arithmetic integrity: No floating-point rounding errors on odd prices', () => {
    // Odd pricing test
    const oddPriceInput = {
        pricing_mode: 'FIXED',
        selling_price: 3333.33,
        product_cost: 1111.11,
        minimum_company_profit: 333.33,
        operating_cost_reserve: 100.00,
        payment_processing_reserve: 50.00,
        refund_risk_reserve: 50.00,
        tax_reserve: 50.00,
        other_reserve: 50.00,
        commission_safety_buffer: 100.00,
        direct_commission_rate: 7.77,
        binary_volume: 3333.33,
        binary_commission_rate: 5.55,
        max_binary_qualified_levels: 7
    };

    const calc = ProductEconomicsCalculator.calculate(oddPriceInput);
    const { calculated } = calc;

    // Check that all calculated figures are exact 2 decimal places with zero floating-point artifacts
    Object.keys(calculated).forEach(key => {
        const val = calculated[key];
        const strVal = val.toString();
        if (strVal.includes('.')) {
            const decimals = strVal.split('.')[1].length;
            assert(decimals <= 2, `Field ${key} has floating-point precision error: ${val}`);
        }
    });
});

if (require.main === module) {
    runTests();
}
