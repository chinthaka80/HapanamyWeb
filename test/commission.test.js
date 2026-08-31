// Unit tests for Hapanamy Commission Core Calculations
const testRunner = require('./test-runner');
const CommissionCore = require('../services/commission-core');

test('Direct referral commission calculation at 8%', () => {
    const commission = CommissionCore.calculateDirectCommission(7450); // Selling price 7450
    assert.equal(commission, 596, 'Direct commission for 7450 selling price should be 596');
});

test('Binary matching commission and carry-forward volume calculation', () => {
    // LEFT = 100,000; RIGHT = 60,000
    const result = CommissionCore.calculateBinaryMatching(100000, 60000);
    assert.equal(result.matchedVolume, 60000, 'Matched volume should be MIN(100000, 60000)');
    assert.equal(result.commission, 4200, 'Binary commission at 7% on matched 60000 should be 4200');
    assert.equal(result.leftCarryForward, 40000, 'Carry forward left should be 40000');
    assert.equal(result.rightCarryForward, 0, 'Carry forward right should be 0');
});

if (require.main === module) {
    runTests();
}
