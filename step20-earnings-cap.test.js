// Comprehensive Test Suite for STEP 20 — Daily & Monthly Earnings Cap Engine
const testRunner = require('./test-runner');
const EarningsCapEngine = require('../services/earnings-cap-engine');

test('Step 20: 1. Below Cap: Full requested amount is eligible', () => {
    const commissionLedger = [];
    const res = EarningsCapEngine.evaluateEarningCap({
        userId: 'u1',
        amount: 5000.00,
        commissionLedger
    });

    assert.equal(res.calculated_amount, 5000.00);
    assert.equal(res.eligible_amount, 5000.00);
    assert.equal(res.capped_amount, 0.00);
    assert.equal(res.status, 'APPROVED');
});

test('Step 20: 2. Exact Cap Boundary: Payout allowed and daily remaining drops to 0.00', () => {
    const commissionLedger = [];
    const res = EarningsCapEngine.evaluateEarningCap({
        userId: 'u2',
        amount: 30000.00,
        commissionLedger
    });

    assert.equal(res.calculated_amount, 30000.00);
    assert.equal(res.eligible_amount, 30000.00);
    assert.equal(res.capped_amount, 0.00);
    assert.equal(res.status, 'APPROVED');
});

test('Step 20: 3. Above Cap with PARTIAL_PAYMENT: Pays remaining quota and caps excess', () => {
    const today = new Date();
    const commissionLedger = [
        { user_id: 'u3', type: 'BINARY', eligible_amount: 20000.00, status: 'APPROVED', created_at: today.toISOString() }
    ];

    // Daily Cap is Rs. 30,000. Current is Rs. 20,000. Remaining is Rs. 10,000.
    // Requested amount is Rs. 15,000 -> Eligible: Rs. 10,000, Capped: Rs. 5,000
    const res = EarningsCapEngine.evaluateEarningCap({
        userId: 'u3',
        amount: 15000.00,
        commissionLedger
    });

    assert.equal(res.calculated_amount, 15000.00);
    assert.equal(res.eligible_amount, 10000.00);
    assert.equal(res.capped_amount, 5000.00);
    assert.equal(res.status, 'PARTIAL_CAPPED');
});

test('Step 20: 4. HOLD_EXCESS Policy: Places excess amount into held bucket', () => {
    const today = new Date();
    const commissionLedger = [
        { user_id: 'u4', type: 'BINARY', eligible_amount: 25000.00, status: 'APPROVED', created_at: today.toISOString() }
    ];

    const holdConfig = {
        ...EarningsCapEngine.getConfig(),
        cap_policy: 'HOLD_EXCESS'
    };

    // Remaining cap is Rs. 5,000. Requested: Rs. 8,000 -> Eligible: Rs. 5,000, Held: Rs. 3,000
    const res = EarningsCapEngine.evaluateEarningCap({
        userId: 'u4',
        amount: 8000.00,
        commissionLedger,
        customConfig: holdConfig
    });

    assert.equal(res.eligible_amount, 5000.00);
    assert.equal(res.held_amount, 3000.00);
    assert.equal(res.status, 'HELD_EXCESS');
});

test('Step 20: 5. Multiple Commission Types (DIRECT + BINARY) combined against daily cap', () => {
    const today = new Date();
    const commissionLedger = [
        { user_id: 'u5', type: 'DIRECT', eligible_amount: 10000.00, status: 'APPROVED', created_at: today.toISOString() },
        { user_id: 'u5', type: 'BINARY', eligible_amount: 15000.00, status: 'APPROVED', created_at: today.toISOString() }
    ];

    // Total earned today = 10k + 15k = 25k. Remaining cap = 5k.
    const res = EarningsCapEngine.evaluateEarningCap({
        userId: 'u5',
        amount: 8000.00,
        commissionType: 'BINARY',
        commissionLedger
    });

    assert.equal(res.eligible_amount, 5000.00);
    assert.equal(res.capped_amount, 3000.00);
});

test('Step 20: 6. Monthly Cap Restriction overrides daily cap when monthly quota is exhausted', () => {
    const targetDate = new Date('2026-09-15T10:00:00Z');
    const earlierThisMonth = new Date('2026-09-10T10:00:00Z');
    const monthlyRestrictedConfig = {
        daily_cap_amount: 30000.00,
        monthly_cap_amount: 50000.00, // Low monthly cap for testing
        timezone: 'Asia/Colombo',
        included_commission_types: ['DIRECT', 'BINARY'],
        cap_policy: 'PARTIAL_PAYMENT'
    };

    // User earned 48,000 earlier this month (Sep 10), but 0 on Sep 15.
    const commissionLedger = [
        { user_id: 'u6', type: 'BINARY', eligible_amount: 48000.00, status: 'APPROVED', created_at: earlierThisMonth.toISOString() }
    ];

    // Daily cap has 30k available, but Monthly cap only has 2k (50k - 48k) available!
    const res = EarningsCapEngine.evaluateEarningCap({
        userId: 'u6',
        amount: 10000.00,
        commissionLedger,
        customConfig: monthlyRestrictedConfig,
        targetDate
    });

    assert.equal(res.eligible_amount, 2000.00, 'Eligible amount must be constrained by the remaining monthly cap (Rs. 2,000)');
    assert.equal(res.capped_amount, 8000.00);
});

test('Step 20: 7. Timezone determinism: Asia/Colombo date keys format correctly', () => {
    const keys = EarningsCapEngine.getDateKeys(new Date(), 'Asia/Colombo');
    assert.equal(keys.timezone, 'Asia/Colombo');
    assert(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(keys.dayKey));
    assert(/^[0-9]{4}-[0-9]{2}$/.test(keys.monthKey));
});

test('Step 20: 8. Member Earnings Summary calculates accurate usage percentages', () => {
    const today = new Date();
    const commissionLedger = [
        { user_id: 'u8', type: 'BINARY', eligible_amount: 15000.00, status: 'APPROVED', created_at: today.toISOString() }
    ];

    const summary = EarningsCapEngine.getMemberEarningsSummary('u8', commissionLedger);

    assert.equal(summary.daily_cap, 30000.00);
    assert.equal(summary.daily_earned, 15000.00);
    assert.equal(summary.daily_remaining, 15000.00);
    assert.equal(summary.daily_usage_percent, 50.00);
});

if (require.main === module) {
    runTests();
}
