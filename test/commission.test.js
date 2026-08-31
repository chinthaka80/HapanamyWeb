// Hapanamy Commission Engine Core Unit Tests
const testRunner = require('./test-runner');
const CommissionCore = require('../services/commission-core');

let binaryNodes = [];
let purchases = [];
let sponsors = [];
let commissionLedger = [];
let dailyEarningsMap = new Map();

before(() => {
    // Tree setup: Root -> Upline1 -> Upline2 -> ... -> Upline9 -> Buyer
    // Total 10 levels deep
    binaryNodes = [
        { user_id: 'root', placement_parent_id: null },
        { user_id: 'up1', placement_parent_id: 'root' },
        { user_id: 'up2', placement_parent_id: 'up1' },
        { user_id: 'up3', placement_parent_id: 'up2' },
        { user_id: 'up4', placement_parent_id: 'up3' },
        { user_id: 'up5', placement_parent_id: 'up4' },
        { user_id: 'up6', placement_parent_id: 'up5' },
        { user_id: 'up7', placement_parent_id: 'up6' },
        { user_id: 'up8', placement_parent_id: 'up7' },
        { user_id: 'up9', placement_parent_id: 'up8' },
        { user_id: 'buyer', placement_parent_id: 'up9' }
    ];

    purchases = [
        { user_id: 'root', status: 'ACTIVE' },
        { user_id: 'up1', status: 'ACTIVE' },
        { user_id: 'up2', status: 'ACTIVE' },
        { user_id: 'up3', status: 'ACTIVE' },
        { user_id: 'up4', status: 'ACTIVE' },
        { user_id: 'up5', status: 'ACTIVE' },
        { user_id: 'up6', status: 'ACTIVE' },
        { user_id: 'up7', status: 'ACTIVE' },
        { user_id: 'up8', status: 'ACTIVE' },
        { user_id: 'up9', status: 'ACTIVE' }
    ];

    sponsors = [
        { sponsor_id: 'root', user_id: 'up1' },
        { sponsor_id: 'up1', user_id: 'up2' },
        { sponsor_id: 'up2', user_id: 'up3' },
        { sponsor_id: 'up3', user_id: 'up4' },
        { sponsor_id: 'up4', user_id: 'up5' },
        { sponsor_id: 'up5', user_id: 'up6' },
        { sponsor_id: 'up6', user_id: 'up7' },
        { sponsor_id: 'up7', user_id: 'up8' },
        { sponsor_id: 'up8', user_id: 'up9' },
        { sponsor_id: 'up9', user_id: 'buyer' }
    ];

    commissionLedger = [];
    dailyEarningsMap = new Map();
});

test('Direct referral commission calculation at 8% (LKR 7,450 price)', () => {
    const commission = CommissionCore.calculateDirectCommission(7450.00, 8.00);
    assert.equal(commission, 596.00, 'Direct commission should be exactly 596 LKR');
});

test('Binary matching commission calculation at 7% (LKR 7,450 volume)', () => {
    const commission = CommissionCore.calculateBinaryCommission(7450.00, 7.00);
    assert.equal(commission, 521.50, 'Binary commission should be exactly 521.50 LKR');
});

test('Upline qualifications verification checks', () => {
    // up1 has active purchase and sponsored up2 -> qualified
    assert(CommissionCore.isQualified('up1', purchases, sponsors), 'up1 must be qualified');

    // Make up3 inactive
    const origPurchases = [...purchases];
    purchases = purchases.filter(p => p.user_id !== 'up3');
    assert(!CommissionCore.isQualified('up3', purchases, sponsors), 'up3 must not be qualified because of lack of active purchase');

    purchases = origPurchases; // restore
});

test('Binary matching propagation limits to first 7 qualified uplines', () => {
    // Process binary commission for buyer of 7,450 volume
    // Upline chain from buyer: up9 -> up8 -> up7 -> up6 -> up5 -> up4 -> up3 -> up2 -> up1 -> root
    // All 10 uplines are qualified initially. First 7 are: up9, up8, up7, up6, up5, up4, up3.
    // up2, up1 and root should be skipped due to the 7-level limit.

    CommissionCore.processBinaryUplineCommission('buyer', 7450.00, binaryNodes, purchases, sponsors, commissionLedger, dailyEarningsMap);

    const paidUplines = commissionLedger.filter(c => c.type === 'BINARY').map(c => c.user_id);
    
    assert.equal(paidUplines.length, 7, 'Only 7 uplines should receive matching commission');
    assert(paidUplines.includes('up9'), 'up9 should be paid');
    assert(paidUplines.includes('up3'), 'up3 should be paid');
    assert(!paidUplines.includes('up2'), 'up2 must be skipped (exceeds 7 levels limit)');
    assert(!paidUplines.includes('up1'), 'up1 must be skipped (exceeds 7 levels limit)');
});

test('Skipped non-qualified upline traversal', () => {
    // Reset test state
    commissionLedger = [];
    dailyEarningsMap = new Map();

    // Make up8 non-qualified (remove purchase)
    const activePurchases = purchases.filter(p => p.user_id !== 'up8');

    // Run matching
    CommissionCore.processBinaryUplineCommission('buyer', 7450.00, binaryNodes, activePurchases, sponsors, commissionLedger, dailyEarningsMap);

    const paidUplines = commissionLedger.filter(c => c.type === 'BINARY').map(c => c.user_id);

    assert(!paidUplines.includes('up8'), 'up8 must be skipped as she is non-qualified');
    assert(paidUplines.includes('up2'), 'up2 should now receive commission as up8 was skipped');
});

test('Daily cap commission limit checks (LKR 30,000 cap)', () => {
    // If user already earned LKR 29,800 today
    const capTest = CommissionCore.applyDailyCap(521.50, 29800.00, 30000.00);

    assert.equal(capTest.calculatedAmount, 521.50);
    assert.equal(capTest.eligibleAmount, 200.00, 'Eligible amount should be capped to remaining 200 LKR');
    assert.equal(capTest.cappedAmount, 321.50, 'Capped amount should be exactly 321.50 LKR');
});

test('Commission reversal appends negative entries', () => {
    // Seed a commission
    const tempLedger = [
        { id: 'comm-1', user_id: 'up1', source_purchase_id: 'purch-refund', type: 'DIRECT', rate: 8.00, base_volume: 7450.00, calculated_amount: 596.00, eligible_amount: 596.00, status: 'APPROVED' }
    ];

    CommissionCore.reverseCommission('purch-refund', tempLedger);

    const reversal = tempLedger.find(c => c.status === 'REVERSED');
    assert(reversal, 'Reversal transaction must be created');
    assert.equal(reversal.eligible_amount, -596.00, 'Reversal amount must be negative counterpart of commission');
});

if (require.main === module) {
    runTests();
}
