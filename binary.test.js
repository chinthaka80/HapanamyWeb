// Hapanamy Binary Tree & Volume Engine Tests
const testRunner = require('./test-runner');
const VolumeLedger = require('../services/volume-ledger');

// Mock Tree Structure
// Root: rootUser
// Left Child: leftChild (Depth 2)
// Right Child: rightChild (Depth 2)
// leftChild Left: deepLeftChild (Depth 3)
const binaryNodes = [
    { user_id: 'rootUser', placement_parent_id: null, position: null, depth: 1 },
    { user_id: 'leftChild', placement_parent_id: 'rootUser', position: 'LEFT', depth: 2 },
    { user_id: 'rightChild', placement_parent_id: 'rootUser', position: 'RIGHT', depth: 2 },
    { user_id: 'deepLeftChild', placement_parent_id: 'leftChild', position: 'LEFT', depth: 3 }
];

let ledger = [];

before(() => {
    ledger = [];
});

test('Volume propagation to LEFT side only', () => {
    // deepLeftChild purchases. Volume should go LEFT of leftChild and LEFT of rootUser.
    VolumeLedger.propagateVolume('deepLeftChild', 7450.00, 'purch-1', binaryNodes, ledger);

    const leftChildLeftBal = VolumeLedger.getLegBalance('leftChild', 'LEFT', ledger);
    const rootUserLeftBal = VolumeLedger.getLegBalance('rootUser', 'LEFT', ledger);
    const rootUserRightBal = VolumeLedger.getLegBalance('rootUser', 'RIGHT', ledger);

    assert.equal(leftChildLeftBal, 7450.00, 'leftChild LEFT leg should receive 7450');
    assert.equal(rootUserLeftBal, 7450.00, 'rootUser LEFT leg should receive 7450');
    assert.equal(rootUserRightBal, 0.00, 'rootUser RIGHT leg should be empty');
});

test('Volume propagation to RIGHT side only', () => {
    // rightChild purchases. Volume should go RIGHT of rootUser.
    VolumeLedger.propagateVolume('rightChild', 5200.00, 'purch-2', binaryNodes, ledger);

    const rootUserRightBal = VolumeLedger.getLegBalance('rootUser', 'RIGHT', ledger);
    assert.equal(rootUserRightBal, 5200.00, 'rootUser RIGHT leg should receive 5200');
});

test('Idempotency block prevents duplicate volume processing', () => {
    const initialLedgerCount = ledger.length;
    
    // Attempt duplicate propagation
    VolumeLedger.propagateVolume('rightChild', 5200.00, 'purch-2', binaryNodes, ledger);
    
    assert.equal(ledger.length, initialLedgerCount, 'No new entries should be added for duplicate purchase ID');
});

test('Binary matching and carry-forward calculation (Unequal volume)', () => {
    // rootUser Left = 7450, Right = 5200
    const match = VolumeLedger.matchVolume('rootUser', ledger);

    assert(match, 'Matching result must be generated');
    assert.equal(match.matchedAmount, 5200.00, 'Matched volume should be MIN(7450, 5200)');
    assert.equal(match.leftCarryForward, 2250.00, 'Left carry-forward should be 2250');
    assert.equal(match.rightCarryForward, 0.00, 'Right carry-forward should be 0');

    // Confirm ledger balances are updated
    const rootUserLeftBal = VolumeLedger.getLegBalance('rootUser', 'LEFT', ledger);
    const rootUserRightBal = VolumeLedger.getLegBalance('rootUser', 'RIGHT', ledger);
    assert.equal(rootUserLeftBal, 2250.00);
    assert.equal(rootUserRightBal, 0.00);
});

test('Volume reversal subtracts correct amounts from uplines', () => {
    // Reversing purchase 1 (deepLeftChild purchase of 7450)
    VolumeLedger.reverseVolume('purch-1', binaryNodes, ledger);

    // rootUser LEFT was 2250 after match. Reversing 7450 should result in 2250 - 7450 = -5200.
    const rootUserLeftBal = VolumeLedger.getLegBalance('rootUser', 'LEFT', ledger);
    assert.equal(rootUserLeftBal, -5200.00, 'Reversal entry must counteract the original volume correctly');
});

if (require.main === module) {
    runTests();
}
