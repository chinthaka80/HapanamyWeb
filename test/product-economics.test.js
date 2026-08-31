// Hapanamy Product Economics Calculation Engine Unit Tests
const testRunner = require('./test-runner');
const ProductEconomicsCalculator = require('../services/product-economics-calculator');

test('Fixed pricing mode returns configured selling price', () => {
    const input = {
        pricing_mode: 'FIXED',
        selling_price: 7450.00,
        market_price: 10000.00,
        discount_value: 2000.00
    };

    const res = ProductEconomicsCalculator.calculate(input);
    assert.equal(res.calculated.selling_price, 7450.00, 'Fixed selling price should remain unchanged');
});

test('Discounted fixed amount pricing mode deducts fixed discount', () => {
    const input = {
        pricing_mode: 'DISCOUNTED',
        discount_type: 'FIXED',
        market_price: 10000.00,
        discount_value: 1500.00
    };

    const res = ProductEconomicsCalculator.calculate(input);
    assert.equal(res.calculated.selling_price, 8500.00, 'Discounted fixed price should be market_price - discount_value');
});

test('Discounted percentage pricing mode deducts percentage discount', () => {
    const input = {
        pricing_mode: 'DISCOUNTED',
        discount_type: 'PERCENTAGE',
        market_price: 10000.00,
        discount_value: 10.00 // 10%
    };

    const res = ProductEconomicsCalculator.calculate(input);
    assert.equal(res.calculated.selling_price, 9000.00, 'Discounted percentage price should be 9000 LKR');
});

test('Protected company amounts and net/effective commission budgets calculate correctly', () => {
    const input = {
        pricing_mode: 'FIXED',
        selling_price: 7450.00,
        product_cost: 2000.00,
        minimum_company_profit: 1000.00,
        operating_cost_reserve: 500.00,
        payment_processing_reserve: 150.00,
        refund_risk_reserve: 200.00,
        tax_reserve: 300.00,
        other_reserve: 100.00,
        commission_safety_buffer: 500.00
    };

    const res = ProductEconomicsCalculator.calculate(input);
    
    // Gross Profit: 7450 - 2000 = 5450
    assert.equal(res.calculated.gross_profit, 5450.00);
    
    // Protected Amount: 1000 + 500 + 150 + 200 + 300 + 100 = 2250
    assert.equal(res.calculated.protected_company_amount, 2250.00);

    // Net Budget: 5450 - 2250 = 3200
    assert.equal(res.calculated.net_commission_budget, 3200.00);

    // Effective Budget: 3200 - 500 = 2700
    assert.equal(res.calculated.effective_commission_budget, 2700.00);
});

test('Commission exposures and remaining company margins calculate correctly', () => {
    const input = {
        pricing_mode: 'FIXED',
        selling_price: 7450.00,
        binary_volume: 7450.00,
        direct_commission_rate: 8.00, // 8%
        binary_commission_rate: 7.00, // 7%
        max_binary_qualified_levels: 7,
        effective_commission_budget: 2700.00 // Override/Pre-calculated for test input convenience
    };

    // Let's run full mock calculations setup
    const fullInput = {
        ...input,
        product_cost: 2000.00,
        minimum_company_profit: 1000.00,
        operating_cost_reserve: 500.00,
        payment_processing_reserve: 150.00,
        refund_risk_reserve: 200.00,
        tax_reserve: 300.00,
        other_reserve: 100.00,
        commission_safety_buffer: 500.00
    };

    const res = ProductEconomicsCalculator.calculate(fullInput);

    // Direct: 7450 * 0.08 = 596
    assert.equal(res.calculated.direct_commission_amount, 596.00);

    // Binary per recipient: 7450 * 0.07 = 521.50
    assert.equal(res.calculated.binary_commission_per_recipient, 521.50);

    // Max Binary Exposure: 521.50 * 7 = 3650.50
    assert.equal(res.calculated.max_binary_commission_exposure, 3650.50);

    // Max Total Exposure: 596 + 3650.50 = 4246.50
    assert.equal(res.calculated.max_total_commission_exposure, 4246.50);

    // Remaining Company Margin: 2700 - 4246.50 = -1546.50 (Exceeds budget, will warning/block!)
    assert.equal(res.calculated.remaining_company_margin, -1546.50);
});

if (require.main === module) {
    runTests();
}
