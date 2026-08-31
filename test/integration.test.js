// Hapanamy.lk Full System QA Master Integration Tests
// Verifies exact financial equations, unequal binary volumes, and carry-forward balances

const testRunner = require('./test-runner');
const CommissionCore = require('../services/commission-core');
const VolumeLedger = require('../services/volume-ledger');
const WalletService = require('../services/wallet-service');
const RefundService = require('../services/refund-service');

let binaryNodes = [];
let purchases = [];
let sponsors = [];
let commissionLedger = [];
let volumeLedger = [];
let dailyEarnings = new Map();

before(() => {
    // Build a 10-level upline binary tree to verify 7-recipient limit and skipping
    binaryNodes = [
        { user_id: 'root', placement_parent_id: null },
        { user_id: 'level-1', placement_parent_id: 'root' },
        { user_id: 'level-2', placement_parent_id: 'level-1' },
        { user_id: 'level-3', placement_parent_id: 'level-2' },
        { user_id: 'level-4', placement_parent_id: 'level-3' },
        { user_id: 'level-5', placement_parent_id: 'level-4' },
        { user_id: 'level-6', placement_parent_id: 'level-5' },
        { user_id: 'level-7', placement_parent_id: 'level-6' },
        { user_id: 'level-8', placement_parent_id: 'level-7' },
        { user_id: 'level-9', placement_parent_id: 'level-8' },
        { user_id: 'buyer', placement_parent_id: 'level-9' }
    ];

    // Seed active course purchases to qualify uplines (Level-4 will be kept un-purchased to test skipping!)
    purchases = [
        { user_id: 'root', status: 'ACTIVE' },
        { user_id: 'level-1', status: 'ACTIVE' },
        { user_id: 'level-2', status: 'ACTIVE' },
        { user_id: 'level-3', status: 'ACTIVE' },
        // level-4 is NOT qualified (no active purchase)
        { user_id: 'level-5', status: 'ACTIVE' },
        { user_id: 'level-6', status: 'ACTIVE' },
        { user_id: 'level-7', status: 'ACTIVE' },
        { user_id: 'level-8', status: 'ACTIVE' },
        { user_id: 'level-9', status: 'ACTIVE' }
    ];

    // Seed direct referrals to qualify uplines
    sponsors = [
        { sponsor_id: 'root' },
        { sponsor_id: 'level-1' },
        { sponsor_id: 'level-2' },
        { sponsor_id: 'level-3' },
        { sponsor_id: 'level-5' },
        { sponsor_id: 'level-6' },
        { sponsor_id: 'level-7' },
        { sponsor_id: 'level-8' },
        { sponsor_id: 'level-9' }
    ];

    commissionLedger = [];
    volumeLedger = [];
    dailyEarnings.clear();
});

test('Financial equation validation: Rs. 7,450 purchase commissions matches expectations', () => {
    // 1. Calculate Direct Commission (8% of Rs. 7,450)
    const directComm = CommissionCore.calculateDirectCommission(7450.00, 8);
    assert.equal(directComm, 596.00, 'Direct Referral commission must be exactly LKR 596.00');

    // 2. Trigger binary matching commission traversal for matched volume Rs. 7,450
    // Starts from buyer's node, climbs tree to pay qualified uplines.
    // Qualified uplines: level-9, level-8, level-7, level-6, level-5 (level-4 is skipped!), level-3, level-2.
    // That makes exactly 7 recipients. level-1 and root should be skipped due to the 7-recipient limit!
    CommissionCore.processBinaryUplineCommission(
        'buyer',
        7450.00,
        binaryNodes,
        purchases,
        sponsors,
        commissionLedger,
        dailyEarnings
    );

    // Filter approved binary commissions
    const binaryPayouts = commissionLedger.filter(c => c.type === 'BINARY' && c.status === 'APPROVED');
    
    assert.equal(binaryPayouts.length, 7, 'Only the first 7 qualified uplines must receive binary matching commissions');
    
    // Verify each recipient receives Rs. 521.50
    binaryPayouts.forEach(payout => {
        assert.equal(payout.eligible_amount, 521.50, 'Binary commission per qualified upline must be exactly LKR 521.50');
    });

    // Verify skipping of non-qualified level-4
    const level4Payout = binaryPayouts.find(p => p.user_id === 'level-4');
    assert(!level4Payout, 'Non-qualified level-4 must be skipped');

    // Verify 7-recipient cap limit skipped level-1 and root
    const rootPayout = binaryPayouts.find(p => p.user_id === 'root');
    const level1Payout = binaryPayouts.find(p => p.user_id === 'level-1');
    assert(!rootPayout && !level1Payout, 'Uplines beyond 7 qualified tiers must not be paid');

    // 3. Sum total commission generated (Direct Rs. 596 + (Rs. 521.50 * 7))
    const totalBinaryComm = binaryPayouts.reduce((sum, p) => sum + p.eligible_amount, 0);
    const grandTotalComm = directComm + totalBinaryComm;

    assert.equal(totalBinaryComm, 3650.50, 'Total binary commission generated must be LKR 3,650.50');
    assert.equal(grandTotalComm, 4246.50, 'Grand total commission generated must be exactly LKR 4,246.50');
});

test('Binary volume matching: LEFT=100k, RIGHT=60k results in 60k match & 40k carry-forward', () => {
    const userLedger = [];

    // Seed LEFT leg volume: LKR 100,000
    VolumeLedger.addEntry(userLedger, 'test-user', 'LEFT', 100000.00, 'buyer-1', 'purch-1', 'SALE_VOLUME', 0);

    // Seed RIGHT leg volume: LKR 60,000
    VolumeLedger.addEntry(userLedger, 'test-user', 'RIGHT', 60000.00, 'buyer-2', 'purch-2', 'SALE_VOLUME', 0);

    // Perform Match
    const match = VolumeLedger.matchVolume('test-user', userLedger);

    assert(match);
    assert.equal(match.matchedAmount, 60000.00, 'Matched volume should be MIN(LEFT, RIGHT) = LKR 60,000');

    // Calculate binary commission (7% of matched LKR 60,000)
    const binaryComm = CommissionCore.calculateBinaryCommission(match.matchedAmount, 7.00);
    assert.equal(binaryComm, 4200.00, 'Binary commission must be exactly LKR 4,200.00');

    // Verify carry-forward balances on legs
    const leftRemaining = VolumeLedger.getLegBalance('test-user', 'LEFT', userLedger);
    const rightRemaining = VolumeLedger.getLegBalance('test-user', 'RIGHT', userLedger);

    assert.equal(leftRemaining, 40000.00, 'Exactly LKR 40,000 must remain as carry-forward on LEFT leg');
    assert.equal(rightRemaining, 0.00, 'Exactly LKR 0.00 must remain on RIGHT leg');
});

if (require.main === module) {
    runTests();
}
