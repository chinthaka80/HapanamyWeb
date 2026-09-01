// Comprehensive Test Suite for STEP 19 — 7 Qualified Upline Commission Engine
const testRunner = require('./test-runner');
const QualifiedUplineCommissionEngine = require('../services/qualified-upline-commission-engine');
const ProductSnapshotService = require('../services/product-snapshot-service');

function createSampleSnapshot() {
    const product = {
        id: 'prod-social-media',
        name: 'Social Media Income Masterclass',
        selling_price: 27500,
        binary_volume: 27500,
        binary_commission_rate: 6.00,
        max_binary_qualified_levels: 7,
        status: 'ACTIVE'
    };
    return ProductSnapshotService.createSnapshot(product, 'purch-sample-19');
}

test('Step 19: 1. Single qualified upline receives exact Binary Commission (6% of Rs. 27,500 = Rs. 1,650.00)', () => {
    const snapshot = createSampleSnapshot();
    const binaryNodes = [
        { user_id: 'u-root', placement_parent_id: null, position: null },
        { user_id: 'u-purchaser', placement_parent_id: 'u-root', position: 'LEFT' }
    ];

    const qualificationContext = {
        users: [{ id: 'u-root', status: 'ACTIVE' }],
        kycDocs: [{ user_id: 'u-root', status: 'APPROVED' }],
        purchases: [
            { id: 'p-root', user_id: 'u-root', status: 'ACTIVE' },
            { id: 'p-dl', user_id: 'dl-1', status: 'ACTIVE' },
            { id: 'p-dr', user_id: 'dr-1', status: 'ACTIVE' }
        ],
        sponsors: [
            { user_id: 'dl-1', sponsor_id: 'u-root' },
            { user_id: 'dr-1', sponsor_id: 'u-root' }
        ],
        binaryNodes: [
            { user_id: 'dl-1', placement_parent_id: 'u-root', position: 'LEFT' },
            { user_id: 'dr-1', placement_parent_id: 'u-root', position: 'RIGHT' }
        ]
    };

    const commissionLedger = [];
    const walletLedger = [];
    const purchase = { id: 'purch-19-1', user_id: 'u-purchaser', status: 'ACTIVE', economics_snapshot: snapshot };

    const result = QualifiedUplineCommissionEngine.processQualifiedUplineCommissions({
        purchase,
        snapshot,
        binaryNodes,
        qualificationContext,
        commissionLedger,
        walletLedger
    });

    assert(result.success);
    assert.equal(result.qualified_recipients_count, 1);
    assert.equal(result.total_commission_paid, 1650.00);
    assert.equal(commissionLedger.length, 1);
    assert.equal(commissionLedger[0].user_id, 'u-root');
    assert.equal(commissionLedger[0].eligible_amount, 1650.00);
});

test('Step 19: 2. Exactly 7 Qualified Uplines: All 7 receive full binary commission in bottom-up order', () => {
    const snapshot = createSampleSnapshot();
    const binaryNodes = [];
    const users = [];
    const kycDocs = [];
    const purchases = [];
    const sponsors = [];

    // Create a 10-node chain: u-10 (purchaser) -> u-9 -> u-8 -> ... -> u-1 (root)
    for (let i = 1; i <= 10; i++) {
        const userId = `u-${i}`;
        const parentId = i === 1 ? null : `u-${i - 1}`;
        binaryNodes.push({ user_id: userId, placement_parent_id: parentId, position: 'LEFT' });
        users.push({ id: userId, status: 'ACTIVE' });
        kycDocs.push({ user_id: userId, status: 'APPROVED' });
        purchases.push({ id: `p-${i}`, user_id: userId, status: 'ACTIVE' });

        // Add 2 directs for qualification
        sponsors.push({ user_id: `dl-${i}`, sponsor_id: userId });
        sponsors.push({ user_id: `dr-${i}`, sponsor_id: userId });
        purchases.push({ id: `p-dl-${i}`, user_id: `dl-${i}`, status: 'ACTIVE' });
        purchases.push({ id: `p-dr-${i}`, user_id: `dr-${i}`, status: 'ACTIVE' });
        binaryNodes.push({ user_id: `dl-${i}`, placement_parent_id: userId, position: 'LEFT' });
        binaryNodes.push({ user_id: `dr-${i}`, placement_parent_id: userId, position: 'RIGHT' });
    }

    const qualificationContext = { users, kycDocs, purchases, sponsors, binaryNodes };
    const commissionLedger = [];
    const purchase = { id: 'purch-19-2', user_id: 'u-10', status: 'ACTIVE', economics_snapshot: snapshot };

    const result = QualifiedUplineCommissionEngine.processQualifiedUplineCommissions({
        purchase,
        snapshot,
        binaryNodes,
        qualificationContext,
        commissionLedger
    });

    assert(result.success);
    // 9 uplines exist (u-9 down to u-1), but maximum 7 qualified levels allowed -> strictly 7 paid!
    assert.equal(result.qualified_recipients_count, 7);
    assert.equal(result.total_commission_paid, 7 * 1650.00); // 11,550.00

    // Closest uplines received priority: u-9, u-8, u-7, u-6, u-5, u-4, u-3
    const paidUserIds = commissionLedger.map(c => c.user_id);
    assert.equal(paidUserIds[0], 'u-9', 'First paid upline is closest parent u-9');
    assert.equal(paidUserIds[6], 'u-3', '7th paid upline is u-3');
    assert(!paidUserIds.includes('u-2'), 'u-2 is beyond 7 qualified levels and must not be paid');
    assert(!paidUserIds.includes('u-1'), 'u-1 is beyond 7 qualified levels and must not be paid');
});

test('Step 19: 3. Unqualified members between qualified members: Skipped members DO NOT consume qualified slots', () => {
    const snapshot = createSampleSnapshot();
    const binaryNodes = [
        { user_id: 'u-1', placement_parent_id: null, position: null },
        { user_id: 'u-2', placement_parent_id: 'u-1', position: 'LEFT' }, // UNQUALIFIED
        { user_id: 'u-3', placement_parent_id: 'u-2', position: 'LEFT' }, // QUALIFIED
        { user_id: 'u-4', placement_parent_id: 'u-3', position: 'LEFT' }, // UNQUALIFIED
        { user_id: 'u-5', placement_parent_id: 'u-4', position: 'LEFT' }, // QUALIFIED
        { user_id: 'u-purchaser', placement_parent_id: 'u-5', position: 'LEFT' }
    ];

    // Only u-1, u-3, and u-5 are QUALIFIED. u-2 and u-4 are UNQUALIFIED
    const users = ['u-1', 'u-2', 'u-3', 'u-4', 'u-5', 'u-purchaser'].map(id => ({ id, status: 'ACTIVE' }));
    const kycDocs = ['u-1', 'u-3', 'u-5'].map(id => ({ user_id: id, status: 'APPROVED' }));
    const purchases = ['u-1', 'u-3', 'u-5'].map(id => ({ id: `p-${id}`, user_id: id, status: 'ACTIVE' }));
    const sponsors = [];

    ['u-1', 'u-3', 'u-5'].forEach(id => {
        sponsors.push({ user_id: `dl-${id}`, sponsor_id: id });
        sponsors.push({ user_id: `dr-${id}`, sponsor_id: id });
        purchases.push({ id: `p-dl-${id}`, user_id: `dl-${id}`, status: 'ACTIVE' });
        purchases.push({ id: `p-dr-${id}`, user_id: `dr-${id}`, status: 'ACTIVE' });
        binaryNodes.push({ user_id: `dl-${id}`, placement_parent_id: id, position: 'LEFT' });
        binaryNodes.push({ user_id: `dr-${id}`, placement_parent_id: id, position: 'RIGHT' });
    });

    const qualificationContext = { users, kycDocs, purchases, sponsors, binaryNodes };
    const commissionLedger = [];
    const purchase = { id: 'purch-19-3', user_id: 'u-purchaser', status: 'ACTIVE', economics_snapshot: snapshot };

    const result = QualifiedUplineCommissionEngine.processQualifiedUplineCommissions({
        purchase,
        snapshot,
        binaryNodes,
        qualificationContext,
        commissionLedger
    });

    assert(result.success);
    assert.equal(result.qualified_recipients_count, 3, 'Exactly 3 qualified uplines (u-5, u-3, u-1) must be paid');

    const paidIds = commissionLedger.map(c => c.user_id);
    assert.equal(paidIds[0], 'u-5');
    assert.equal(paidIds[1], 'u-3');
    assert.equal(paidIds[2], 'u-1');
    assert(!paidIds.includes('u-4'), 'Unqualified u-4 must not be paid');
    assert(!paidIds.includes('u-2'), 'Unqualified u-2 must not be paid');
});

test('Step 19: 4. No qualified members in upline: 0 commissions paid without crashing', () => {
    const snapshot = createSampleSnapshot();
    const binaryNodes = [
        { user_id: 'u-root', placement_parent_id: null, position: null },
        { user_id: 'u-child', placement_parent_id: 'u-root', position: 'LEFT' }
    ];

    const qualificationContext = {
        users: [{ id: 'u-root', status: 'ACTIVE' }],
        kycDocs: [], // No KYC
        purchases: [], // No purchase
        sponsors: [] // No directs
    };

    const commissionLedger = [];
    const purchase = { id: 'purch-19-4', user_id: 'u-child', status: 'ACTIVE', economics_snapshot: snapshot };

    const result = QualifiedUplineCommissionEngine.processQualifiedUplineCommissions({
        purchase,
        snapshot,
        binaryNodes,
        qualificationContext,
        commissionLedger
    });

    assert(result.success);
    assert.equal(result.qualified_recipients_count, 0);
    assert.equal(result.total_commission_paid, 0.00);
    assert.equal(commissionLedger.length, 0);
});

test('Step 19: 5. Daily Earning Cap partially restricts payout when upline limit is reached', () => {
    const snapshot = createSampleSnapshot();
    const binaryNodes = [
        { user_id: 'u-parent', placement_parent_id: null, position: null },
        { user_id: 'u-child', placement_parent_id: 'u-parent', position: 'LEFT' }
    ];

    const qualificationContext = {
        users: [{ id: 'u-parent', status: 'ACTIVE' }],
        kycDocs: [{ user_id: 'u-parent', status: 'APPROVED' }],
        purchases: [
            { id: 'p-par', user_id: 'u-parent', status: 'ACTIVE' },
            { id: 'p-dl', user_id: 'dl-p', status: 'ACTIVE' },
            { id: 'p-dr', user_id: 'dr-p', status: 'ACTIVE' }
        ],
        sponsors: [
            { user_id: 'dl-p', sponsor_id: 'u-parent' },
            { user_id: 'dr-p', sponsor_id: 'u-parent' }
        ],
        binaryNodes: [
            { user_id: 'dl-p', placement_parent_id: 'u-parent', position: 'LEFT' },
            { user_id: 'dr-p', placement_parent_id: 'u-parent', position: 'RIGHT' }
        ]
    };

    const dailyEarningsMap = new Map();
    const todayKey = `u-parent-${new Date().toISOString().split('T')[0]}`;
    dailyEarningsMap.set(todayKey, 29000.00); // Already earned Rs. 29,000 today (Limit Rs. 30,000)

    const commissionLedger = [];
    const purchase = { id: 'purch-19-5', user_id: 'u-child', status: 'ACTIVE', economics_snapshot: snapshot };

    const result = QualifiedUplineCommissionEngine.processQualifiedUplineCommissions({
        purchase,
        snapshot,
        binaryNodes,
        qualificationContext,
        commissionLedger,
        dailyEarningsMap,
        dailyCapLimit: 30000.00
    });

    assert(result.success);
    assert.equal(commissionLedger[0].calculated_amount, 1650.00);
    assert.equal(commissionLedger[0].eligible_amount, 1000.00, 'Eligible amount capped to remaining Rs. 1,000');
    assert.equal(commissionLedger[0].capped_amount, 650.00);
});

test('Step 19: 6. Refund Reversal: Generates compensating negative binary commission entries for all recipients', () => {
    const commissionLedger = [
        { id: 'c1', user_id: 'u-1', source_purchase_id: 'purch-refund-19', type: 'BINARY', calculated_amount: 1650, eligible_amount: 1650, status: 'APPROVED' },
        { id: 'c2', user_id: 'u-2', source_purchase_id: 'purch-refund-19', type: 'BINARY', calculated_amount: 1650, eligible_amount: 1650, status: 'APPROVED' }
    ];
    const walletLedger = [];

    const reversals = QualifiedUplineCommissionEngine.reverseQualifiedUplineCommissions('purch-refund-19', commissionLedger, walletLedger);

    assert.equal(reversals.length, 2);
    assert.equal(commissionLedger.length, 4);
    assert.equal(commissionLedger[2].type, 'BINARY_REVERSAL');
    assert.equal(commissionLedger[2].eligible_amount, -1650.00);
    assert.equal(walletLedger.length, 2);
    assert.equal(walletLedger[0].amount, -1650.00);
});

if (require.main === module) {
    runTests();
}
