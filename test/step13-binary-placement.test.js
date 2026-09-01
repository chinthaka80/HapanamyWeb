// Comprehensive Test Suite for STEP 13 — Binary Tree & Placement Engine
const testRunner = require('./test-runner');
const PlacementEngine = require('../services/placement-engine');

test('Step 13: 1. First Member (Root) placement initializes tree root with null parent and position', () => {
    const tree = [];
    const rootNode = PlacementEngine.assignPlacement('user-root', null, null, null, tree);

    assert.equal(rootNode.user_id, 'user-root');
    assert.equal(rootNode.placement_parent_id, null);
    assert.equal(rootNode.position, null);
    assert.equal(rootNode.depth, 1);
    assert.equal(rootNode.path, '');
    assert.equal(tree.length, 1);
});

test('Step 13: 2. LEFT and RIGHT direct placement under root node', () => {
    const tree = [
        { user_id: 'user-root', placement_parent_id: null, position: null, depth: 1, path: '', left_child_id: null, right_child_id: null }
    ];

    // Place B on LEFT
    const nodeB = PlacementEngine.assignPlacement('user-b', 'user-root', 'user-root', 'LEFT', tree);
    assert.equal(nodeB.placement_parent_id, 'user-root');
    assert.equal(nodeB.position, 'LEFT');
    assert.equal(nodeB.depth, 2);
    assert.equal(nodeB.path, 'user-root');
    assert.equal(tree[0].left_child_id, 'user-b');

    // Place C on RIGHT
    const nodeC = PlacementEngine.assignPlacement('user-c', 'user-root', 'user-root', 'RIGHT', tree);
    assert.equal(nodeC.placement_parent_id, 'user-root');
    assert.equal(nodeC.position, 'RIGHT');
    assert.equal(nodeC.depth, 2);
    assert.equal(nodeC.path, 'user-root');
    assert.equal(tree[0].right_child_id, 'user-c');
    assert.equal(tree.length, 3);
});

test('Step 13: 3. Full Parent: Automatic placement bypasses full parent and finds next available leaf', () => {
    // A has B (LEFT) and C (RIGHT)
    const tree = [
        { user_id: 'A', placement_parent_id: null, position: null, depth: 1, path: '', left_child_id: 'B', right_child_id: 'C' },
        { user_id: 'B', placement_parent_id: 'A', position: 'LEFT', depth: 2, path: 'A', left_child_id: null, right_child_id: null },
        { user_id: 'C', placement_parent_id: 'A', position: 'RIGHT', depth: 2, path: 'A', left_child_id: null, right_child_id: null }
    ];

    // Auto-resolve placement for new member D with preferred leg LEFT sponsored by A
    const resolvedLeft = PlacementEngine.resolvePlacement('A', 'LEFT', tree);
    assert.equal(resolvedLeft.placementParentId, 'B', 'Next left leaf under full root A must be B');
    assert.equal(resolvedLeft.position, 'LEFT');

    // Auto-resolve placement for new member E with preferred leg RIGHT sponsored by A
    const resolvedRight = PlacementEngine.resolvePlacement('A', 'RIGHT', tree);
    assert.equal(resolvedRight.placementParentId, 'C', 'Next right leaf under full root A must be C');
    assert.equal(resolvedRight.position, 'RIGHT');
});

test('Step 13: 4. Deep Tree: Extreme Left and Extreme Right multi-level traversal', () => {
    const tree = [
        { user_id: 'R', placement_parent_id: null, position: null, depth: 1, path: '', left_child_id: 'L1', right_child_id: 'R1' },
        { user_id: 'L1', placement_parent_id: 'R', position: 'LEFT', depth: 2, path: 'R', left_child_id: 'L2', right_child_id: null },
        { user_id: 'L2', placement_parent_id: 'L1', position: 'LEFT', depth: 3, path: 'R/L1', left_child_id: 'L3', right_child_id: null },
        { user_id: 'L3', placement_parent_id: 'L2', position: 'LEFT', depth: 4, path: 'R/L1/L2', left_child_id: null, right_child_id: null },
        { user_id: 'R1', placement_parent_id: 'R', position: 'RIGHT', depth: 2, path: 'R', left_child_id: null, right_child_id: 'R2' },
        { user_id: 'R2', placement_parent_id: 'R1', position: 'RIGHT', depth: 3, path: 'R/R1', left_child_id: null, right_child_id: null }
    ];

    const extremeLeft = PlacementEngine.findExtremeLegPosition('R', 'LEFT', tree);
    assert.equal(extremeLeft.placementParentId, 'L3', 'Extreme left must traverse to leaf L3');
    assert.equal(extremeLeft.position, 'LEFT');

    const extremeRight = PlacementEngine.findExtremeLegPosition('R', 'RIGHT', tree);
    assert.equal(extremeRight.placementParentId, 'R2', 'Extreme right must traverse to leaf R2');
    assert.equal(extremeRight.position, 'RIGHT');
});

test('Step 13: 5. Invalid Placement: Rejects duplicate member, occupied slots, self-placement, and non-existent parent', () => {
    const tree = [
        { user_id: 'A', placement_parent_id: null, position: null, depth: 1, path: '', left_child_id: 'B', right_child_id: null },
        { user_id: 'B', placement_parent_id: 'A', position: 'LEFT', depth: 2, path: 'A', left_child_id: null, right_child_id: null }
    ];

    // 1. Rejects member already in tree
    assert.throws(() => {
        PlacementEngine.assignPlacement('B', 'A', 'A', 'RIGHT', tree);
    }, /already placed/);

    // 2. Rejects occupied position (LEFT of A is already B)
    assert.throws(() => {
        PlacementEngine.assignPlacement('C', 'A', 'A', 'LEFT', tree);
    }, /already occupied/);

    // 3. Rejects self-placement
    assert.throws(() => {
        PlacementEngine.assignPlacement('D', 'A', 'D', 'RIGHT', tree);
    }, /Self-placement is strictly prohibited/);

    // 4. Rejects non-existent placement parent
    assert.throws(() => {
        PlacementEngine.assignPlacement('E', 'A', 'NON_EXISTENT_PARENT', 'LEFT', tree);
    }, /does not exist/);
});

test('Step 13: 6. Circular Placement Prevention: Cannot place an ancestor under its own descendant', () => {
    // A -> B -> C -> D
    const tree = [
        { user_id: 'A', placement_parent_id: null, position: null, depth: 1, path: '', left_child_id: 'B', right_child_id: null },
        { user_id: 'B', placement_parent_id: 'A', position: 'LEFT', depth: 2, path: 'A', left_child_id: 'C', right_child_id: null },
        { user_id: 'C', placement_parent_id: 'B', position: 'LEFT', depth: 3, path: 'A/B', left_child_id: 'D', right_child_id: null },
        { user_id: 'D', placement_parent_id: 'C', position: 'LEFT', depth: 4, path: 'A/B/C', left_child_id: null, right_child_id: null }
    ];

    // Attempting to move or place A under D must be blocked
    const circularCheck = PlacementEngine.isCircularPlacement('A', 'D', tree);
    assert(circularCheck, 'Circular placement of ancestor A under descendant D must be detected as true');

    const nonCircular = PlacementEngine.isCircularPlacement('E', 'D', tree);
    assert(!nonCircular, 'New member E under D is not circular');
});

test('Step 13: 7. Sponsor vs Placement Parent Divergence (Spillover)', () => {
    const tree = [
        { user_id: 'SPONSOR_A', placement_parent_id: null, position: null, depth: 1, path: '', left_child_id: 'LEAF_B', right_child_id: null },
        { user_id: 'LEAF_B', placement_parent_id: 'SPONSOR_A', position: 'LEFT', depth: 2, path: 'SPONSOR_A', left_child_id: null, right_child_id: null }
    ];
    const auditLogs = [];

    // Sponsor is SPONSOR_A, but placement parent is LEAF_B (spillover under downline)
    const newNode = PlacementEngine.assignPlacement('NEW_MEMBER_C', 'SPONSOR_A', 'LEAF_B', 'LEFT', tree, {
        isManual: true,
        adminUserId: 'admin-1',
        auditLogs
    });

    assert.equal(newNode.user_id, 'NEW_MEMBER_C');
    assert.equal(newNode.placement_parent_id, 'LEAF_B', 'Placement parent is LEAF_B');
    assert.equal(newNode.depth, 3);
    assert.equal(newNode.path, 'SPONSOR_A/LEAF_B');
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, 'MANUAL_PLACEMENT_ASSIGNED');
});

test('Step 13: 8. Ancestor Traversal: Correctly returns ordered upline chain', () => {
    // Root -> A -> B -> C
    const tree = [
        { user_id: 'Root', placement_parent_id: null, position: null, depth: 1, path: '' },
        { user_id: 'A', placement_parent_id: 'Root', position: 'LEFT', depth: 2, path: 'Root' },
        { user_id: 'B', placement_parent_id: 'A', position: 'RIGHT', depth: 3, path: 'Root/A' },
        { user_id: 'C', placement_parent_id: 'B', position: 'LEFT', depth: 4, path: 'Root/A/B' }
    ];

    const ancestorsOfC = PlacementEngine.getAncestors('C', tree);
    assert.equal(ancestorsOfC.length, 3);
    assert.equal(ancestorsOfC[0].user_id, 'B', 'First ancestor of C is parent B');
    assert.equal(ancestorsOfC[0].position, 'LEFT');
    assert.equal(ancestorsOfC[1].user_id, 'A', 'Second ancestor of C is grandparent A');
    assert.equal(ancestorsOfC[1].position, 'RIGHT');
    assert.equal(ancestorsOfC[2].user_id, 'Root', 'Third ancestor of C is Root');
    assert.equal(ancestorsOfC[2].position, 'LEFT');
});

test('Step 13: 9. Descendant Lookup: Returns all nodes in subtree with branch leg classification', () => {
    // Root -> (L1, R1), L1 -> (L2, R2)
    const tree = [
        { user_id: 'Root', placement_parent_id: null, position: null, depth: 1, path: '' },
        { user_id: 'L1', placement_parent_id: 'Root', position: 'LEFT', depth: 2, path: 'Root' },
        { user_id: 'R1', placement_parent_id: 'Root', position: 'RIGHT', depth: 2, path: 'Root' },
        { user_id: 'L2', placement_parent_id: 'L1', position: 'LEFT', depth: 3, path: 'Root/L1' },
        { user_id: 'R2', placement_parent_id: 'L1', position: 'RIGHT', depth: 3, path: 'Root/L1' }
    ];

    const descendantsOfRoot = PlacementEngine.getDescendants('Root', tree);
    assert.equal(descendantsOfRoot.length, 4);

    const l2Descendant = descendantsOfRoot.find(d => d.user_id === 'L2');
    assert.equal(l2Descendant.branch_leg, 'LEFT', 'L2 must be classified under LEFT leg of Root');

    const r1Descendant = descendantsOfRoot.find(d => d.user_id === 'R1');
    assert.equal(r1Descendant.branch_leg, 'RIGHT', 'R1 must be classified under RIGHT leg of Root');
});

test('Step 13: 10. Concurrency Simulation: Mutex lock prevents simultaneous double-assignment of same slot', () => {
    const tree = [
        { user_id: 'P', placement_parent_id: null, position: null, depth: 1, path: '', left_child_id: null, right_child_id: null }
    ];

    // Simulate concurrent placement
    PlacementEngine._slotLocks.add('P:LEFT'); // Slot is locked by Thread 1

    assert.throws(() => {
        PlacementEngine.assignPlacement('U1', 'P', 'P', 'LEFT', tree);
    }, /Slot lock conflict/);

    PlacementEngine._slotLocks.delete('P:LEFT'); // Thread 1 completes lock release

    // Now placement succeeds
    const node = PlacementEngine.assignPlacement('U1', 'P', 'P', 'LEFT', tree);
    assert.equal(node.user_id, 'U1');
    assert.equal(tree[0].left_child_id, 'U1');
});

if (require.main === module) {
    runTests();
}
