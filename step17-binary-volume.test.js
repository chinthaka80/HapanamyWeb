// Comprehensive Test Suite for STEP 17 — Binary Volume Processing Engine
const testRunner = require('./test-runner');
const VolumeLedger = require('../services/volume-ledger');
const ProductSnapshotService = require('../services/product-snapshot-service');

function createBinaryTreeContext() {
    return [
        { user_id: 'u-root', placement_parent_id: null, position: null, depth: 1, path: '', left_child_id: 'u-left', right_child_id: 'u-right' },
        { user_id: 'u-left', placement_parent_id: 'u-root', position: 'LEFT', depth: 2, path: 'u-root', left_child_id: 'u-l2', right_child_id: null },
        { user_id: 'u-l2', placement_parent_id: 'u-left', position: 'LEFT', depth: 3, path: 'u-root/u-left', left_child_id: null, right_child_id: null },
        { user_id: 'u-right', placement_parent_id: 'u-root', position: 'RIGHT', depth: 2, path: 'u-root', left_child_id: null, right_child_id: null }
    ];
}

test('Step 17: 1. LEFT sale creates LEFT volume on all upline ancestors', () => {
    const tree = createBinaryTreeContext();
    const ledger = [];

    const snapshot = {
        id: 'snap-1',
        selling_price: 27500,
        binary_volume: 27500
    };

    const purchase = {
        id: 'purch-1',
        user_id: 'u-l2',
        status: 'ACTIVE',
        economics_snapshot: snapshot
    };

    const result = VolumeLedger.processSaleVolume({
        purchase,
        snapshot,
        binaryNodes: tree,
        ledger
    });

    assert(result.success);
    assert.equal(result.propagated_volume, 27500);
    assert.equal(result.upline_count, 2, 'Must propagate to u-left and u-root');

    // Check u-left: u-l2 is on LEFT
    const leftNodeBalance = VolumeLedger.getLegBalance('u-left', 'LEFT', ledger);
    assert.equal(leftNodeBalance, 27500);

    // Check u-root: u-l2 is in the LEFT subtree
    const rootLeftBalance = VolumeLedger.getLegBalance('u-root', 'LEFT', ledger);
    assert.equal(rootLeftBalance, 27500);

    const rootRightBalance = VolumeLedger.getLegBalance('u-root', 'RIGHT', ledger);
    assert.equal(rootRightBalance, 0);
});

test('Step 17: 2. RIGHT sale creates RIGHT volume on root upline', () => {
    const tree = createBinaryTreeContext();
    const ledger = [];

    const snapshot = {
        id: 'snap-2',
        binary_volume: 15000
    };

    const purchase = {
        id: 'purch-2',
        user_id: 'u-right',
        status: 'ACTIVE',
        economics_snapshot: snapshot
    };

    const result = VolumeLedger.processSaleVolume({
        purchase,
        snapshot,
        binaryNodes: tree,
        ledger
    });

    assert(result.success);
    const rootRightBalance = VolumeLedger.getLegBalance('u-root', 'RIGHT', ledger);
    assert.equal(rootRightBalance, 15000);
    const rootLeftBalance = VolumeLedger.getLegBalance('u-root', 'LEFT', ledger);
    assert.equal(rootLeftBalance, 0);
});

test('Step 17: 3. Immutable Snapshot Volume Enforcement: Uses snapshot and ignores current product table edits', () => {
    const tree = createBinaryTreeContext();
    const ledger = [];

    // Historical snapshot has binary_volume = 20,000
    const snapshot = {
        id: 'snap-historical-3',
        product_id: 'prod-fb-mon',
        binary_volume: 20000
    };

    const purchase = {
        id: 'purch-hist-3',
        user_id: 'u-left',
        status: 'ACTIVE',
        economics_snapshot: snapshot
    };

    VolumeLedger.processSaleVolume({
        purchase,
        snapshot,
        binaryNodes: tree,
        ledger
    });

    const rootBalance = VolumeLedger.getLegBalance('u-root', 'LEFT', ledger);
    assert.equal(rootBalance, 20000, 'Volume must strictly match snapshot 20,000');
});

test('Step 17: 4. Idempotency Protection: Duplicate purchase event is blocked and creates no duplicate volume', () => {
    const tree = createBinaryTreeContext();
    const ledger = [];

    const purchase = {
        id: 'purch-idempotent-4',
        user_id: 'u-left',
        status: 'ACTIVE',
        amount: 10000
    };

    // First call -> creates volume
    const res1 = VolumeLedger.processSaleVolume({
        purchase,
        binaryNodes: tree,
        ledger
    });
    assert.equal(res1.upline_count, 1);
    assert.equal(ledger.length, 1);

    // Second call -> blocked by idempotency
    const res2 = VolumeLedger.processSaleVolume({
        purchase,
        binaryNodes: tree,
        ledger
    });
    assert(res2.idempotent);
    assert.equal(ledger.length, 1, 'Ledger length must remain 1 after duplicate call');
});

test('Step 17: 5. Deep Tree Volume Propagation (10 tiers)', () => {
    const tree = [];
    const depth = 10;

    for (let i = 1; i <= depth; i++) {
        const userId = `node-${i}`;
        const parentId = i === 1 ? null : `node-${i - 1}`;
        tree.push({
            user_id: userId,
            placement_parent_id: parentId,
            position: parentId ? 'LEFT' : null,
            depth: i,
            path: parentId ? `node-1` : ''
        });
    }

    const ledger = [];
    const purchase = {
        id: 'purch-deep-10',
        user_id: 'node-10',
        amount: 5000,
        status: 'ACTIVE'
    };

    const result = VolumeLedger.processSaleVolume({
        purchase,
        binaryNodes: tree,
        ledger
    });

    assert.equal(result.upline_count, 9, 'All 9 ancestors from node-9 up to node-1 must receive volume');
    for (let i = 1; i <= 9; i++) {
        const bal = VolumeLedger.getLegBalance(`node-${i}`, 'LEFT', ledger);
        assert.equal(bal, 5000);
    }
});

test('Step 17: 6. Refund Reversals: Compensating negative entries reverse volume without deleting history', () => {
    const tree = createBinaryTreeContext();
    const ledger = [];

    const purchase = {
        id: 'purch-refund-6',
        user_id: 'u-l2',
        amount: 12000,
        status: 'ACTIVE'
    };

    // 1. Process sale
    VolumeLedger.processSaleVolume({ purchase, binaryNodes: tree, ledger });
    assert.equal(VolumeLedger.getLegBalance('u-root', 'LEFT', ledger), 12000);
    assert.equal(ledger.length, 2);

    // 2. Process refund
    const reversals = VolumeLedger.reverseVolume('purch-refund-6', tree, ledger);
    assert.equal(reversals.length, 2);
    assert.equal(ledger.length, 4, 'Ledger must retain both 2 sales + 2 compensating reversals');

    // 3. Balance should now be 0.00
    assert.equal(VolumeLedger.getLegBalance('u-root', 'LEFT', ledger), 0.00);
    assert.equal(VolumeLedger.getLegBalance('u-left', 'LEFT', ledger), 0.00);
});

test('Step 17: 7. Volume Accumulators: Lifetime, Current, Matched, and Reversed metrics', () => {
    const ledger = [
        { user_id: 'm1', leg: 'LEFT', amount: 50000, type: 'SALE_VOLUME' },
        { user_id: 'm1', leg: 'RIGHT', amount: 30000, type: 'SALE_VOLUME' },
        { user_id: 'm1', leg: 'LEFT', amount: -20000, type: 'MATCHED_VOLUME' },
        { user_id: 'm1', leg: 'RIGHT', amount: -20000, type: 'MATCHED_VOLUME' },
        { user_id: 'm1', leg: 'RIGHT', amount: -5000, type: 'REFUND_REVERSAL' }
    ];

    const summary = VolumeLedger.getVolumeSummary('m1', ledger);

    assert.equal(summary.lifetime_left_volume, 50000);
    assert.equal(summary.lifetime_right_volume, 30000);
    assert.equal(summary.current_left_volume, 30000); // 50k - 20k
    assert.equal(summary.current_right_volume, 5000);  // 30k - 20k - 5k
    assert.equal(summary.matched_left_volume, 20000);
    assert.equal(summary.matched_right_volume, 20000);
    assert.equal(summary.reversed_right_volume, 5000);
    assert.equal(summary.weaker_leg, 'RIGHT');
});

if (require.main === module) {
    runTests();
}
