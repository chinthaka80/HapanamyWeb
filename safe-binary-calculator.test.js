// Hapanamy Safe Binary Commission Rate Calculator Unit Tests
const testRunner = require('./test-runner');
const SafeBinaryCommissionRateCalculator = require('../services/safe-binary-commission-calculator');

test('Safe rate calculation rounds down and remains below budget exposure limits', () => {
    const input = {
        pricing_mode: 'FIXED',
        selling_price: 7450.00,
        product_cost: 2000.00,
        minimum_company_profit: 1000.00,
        operating_cost_reserve: 500.00,
        binary_volume: 7450.00,
        direct_commission_rate: 8.00,
        max_binary_qualified_levels: 7
    };

    const maxSafe = SafeBinaryCommissionRateCalculator.calculateMaxSafeRate(input);
    // Budget: 7450 - 2000 - 1500 = 3950
    // Remaining Binary Budget: 3950 - 596 (direct) = 3354
    // Max Binary Per Level: 3354 / 7 = 479.1428
    // Rate: 479.1428 / 7450 * 100 = 6.4314%
    // Safe Rate rounded down should be 6.43%
    assert.equal(maxSafe, 6.43, 'Safe binary rate should round down to 6.43%');
});

test('Evaluate rate allows rate below safe rate and blocks rate exceeding safe rate', () => {
    const input = {
        pricing_mode: 'FIXED',
        selling_price: 10000.00,
        product_cost: 2000.00,
        minimum_company_profit: 2000.00,
        binary_volume: 10000.00,
        direct_commission_rate: 10.00,
        max_binary_qualified_levels: 5
    };

    // Budget: 10000 - 2000 - 2000 = 6000
    // Remaining Binary Budget: 6000 - 1000 (direct) = 5000
    // Per Level: 5000 / 5 = 1000
    // Rate: 1000 / 10000 * 100 = 10.00%

    // Evaluate valid rate (8.00%)
    const evalValid = SafeBinaryCommissionRateCalculator.evaluateRate(input, 8.00);
    assert(evalValid.allowed, 'Rate 8% must be allowed (<= 10%)');
    assert.equal(evalValid.maximum_safe_rate, 10.00);
    assert.equal(evalValid.difference, -2.00);

    // Evaluate invalid rate (12.00%)
    const evalInvalid = SafeBinaryCommissionRateCalculator.evaluateRate(input, 12.00);
    assert(!evalInvalid.allowed, 'Rate 12% must be blocked (> 10%)');
    assert.equal(evalInvalid.difference, 2.00);
});

if (require.main === module) {
    runTests();
}
