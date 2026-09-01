// Hapanamy Product Commission Validator Unit Tests
const testRunner = require('./test-runner');
const ProductEconomicsCalculator = require('../services/product-economics-calculator');
const ProductCommissionValidator = require('../services/product-commission-validator');

test('Validator reports SAFE when exposure is within budget limits', () => {
    const input = {
        pricing_mode: 'FIXED',
        selling_price: 10000.00,
        product_cost: 2000.00,
        minimum_company_profit: 1000.00,
        operating_cost_reserve: 500.00,
        binary_volume: 10000.00,
        direct_commission_rate: 8.00,
        binary_commission_rate: 1.00, // Very low rate
        max_binary_qualified_levels: 7
    };

    const calc = ProductEconomicsCalculator.calculate(input);
    const validation = ProductCommissionValidator.validate(calc, 500.00);

    assert.equal(validation.status, 'SAFE');
    assert(validation.allowed);
    assert.equal(validation.blocked_reason, null);
});

test('Validator reports WARNING when remaining margin is slim but safe', () => {
    const input = {
        pricing_mode: 'FIXED',
        selling_price: 10000.00,
        product_cost: 2000.00,
        minimum_company_profit: 1000.00,
        operating_cost_reserve: 500.00,
        binary_volume: 10000.00,
        direct_commission_rate: 8.00,
        binary_commission_rate: 8.00, // High rate, will leave small remaining margin
        max_binary_qualified_levels: 1
    };

    const calc = ProductEconomicsCalculator.calculate(input);
    // Warning threshold set to 5000.00 (remaining margin is 4900.00)
    const validation = ProductCommissionValidator.validate(calc, 5000.00);

    assert.equal(validation.status, 'WARNING');
    assert(validation.allowed);
    assert(validation.warnings.length > 0);
});

test('Validator reports BLOCKED if product cost exceeds selling price', () => {
    const input = {
        pricing_mode: 'FIXED',
        selling_price: 5000.00,
        product_cost: 6000.00 // Cost exceeds price
    };

    const calc = ProductEconomicsCalculator.calculate(input);
    const validation = ProductCommissionValidator.validate(calc);

    assert.equal(validation.status, 'BLOCKED');
    assert(!validation.allowed);
    assert(validation.blocked_reason.includes('cost exceeds selling price'));
});

test('Validator reports BLOCKED if gross profit is zero', () => {
    const input = {
        pricing_mode: 'FIXED',
        selling_price: 5000.00,
        product_cost: 5000.00 // Gross profit is 0
    };

    const calc = ProductEconomicsCalculator.calculate(input);
    const validation = ProductCommissionValidator.validate(calc);

    assert.equal(validation.status, 'BLOCKED');
    assert(!validation.allowed);
    assert(validation.blocked_reason.includes('profit is zero or negative'));
});

test('Validator reports BLOCKED if direct commission exceeds effective budget', () => {
    const input = {
        pricing_mode: 'FIXED',
        selling_price: 10000.00,
        product_cost: 2000.00,
        minimum_company_profit: 6000.00, // Leaving only 2000 budget
        direct_commission_rate: 30.00 // Direct commission is 3000 (exceeds 2000 budget)
    };

    const calc = ProductEconomicsCalculator.calculate(input);
    const validation = ProductCommissionValidator.validate(calc);

    assert.equal(validation.status, 'BLOCKED');
    assert(!validation.allowed);
    assert(validation.blocked_reason.includes('Direct referral commission exceeds'));
});

test('Validator reports BLOCKED if maximum total commission exposure exceeds effective budget', () => {
    const input = {
        pricing_mode: 'FIXED',
        selling_price: 7450.00,
        product_cost: 2000.00,
        minimum_company_profit: 1000.00,
        operating_cost_reserve: 500.00,
        binary_volume: 7450.00,
        direct_commission_rate: 8.00,
        binary_commission_rate: 7.00, // Total exposure 4246.50 exceeds budget 3950.00
        max_binary_qualified_levels: 7
    };

    const calc = ProductEconomicsCalculator.calculate(input);
    const validation = ProductCommissionValidator.validate(calc);

    assert.equal(validation.status, 'BLOCKED');
    assert(!validation.allowed);
    assert(validation.blocked_reason.includes('exposure exceeds effective commission budget'));
});

if (require.main === module) {
    runTests();
}
