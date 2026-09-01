// Unit Tests for Phase 1: Binary Network & Placement Engine
const testRunner = require('./test-runner');
const PlacementEngine = require('../services/placement-engine');

test('PlacementEngine: Sponsor validation correctly identifies active vs invalid sponsors', () => {
    const users = [
        { id: 'u1', username: 'alice', status: 'ACTIVE' },
        { id: 'u2', username: 'bob', status: 'INACTIVE' }
    ];

    assert(PlacementEngine.validateSponsor('u1', users), 'Active sponsor by ID should pass');
    assert(PlacementEngine.validateSponsor('alice', users), 'Active sponsor by username should pass');
    assert(!PlacementEngine.validateSponsor('u2', users), 'Inactive sponsor should fail');
    assert(!PlacementEngine.validateSponsor('u999', users), 'Non-existent sponsor should fail');
});

test('PlacementEngine: Circular referral and self-referral detection', () => {
    const sponsorsList = [
        { user_id: 'u2', sponsor_id: 'u1' },
        { user_id: 'u3', sponsor_id: 'u2' }
    ];

    assert(PlacementEngine.isCircularReferral('u1', 'u1', sponsorsList), 'Self-referral must be detected');
    assert(PlacementEngine.isCircularReferral('u1', 'u3', sponsorsList), 'Indirect circular loop must be detected');
    assert(!PlacementEngine.isCircularReferral('u4', 'u3', sponsorsList), 'Non-circular referral should pass');
});

test('PlacementEngine: Extreme Left and Extreme Right traversal finds leaf slot', () => {
    // Tree topology:
    //         root (u1)
    //        /         \
    //      u2 (LEFT)   u3 (RIGHT)
    //     /
    //   u4 (LEFT)
    const binaryNodes = [
        { user_id: 'u1', placement_parent_id: null, position: null, depth: 1, path: '' },
        { user_id: 'u2', placement_parent_id: 'u1', position: 'LEFT', depth: 2, path: 'u1' },
        { user_id: 'u3', placement_parent_id: 'u1', position: 'RIGHT', depth: 2, path: 'u1' },
        { user_id: 'u4', placement_parent_id: 'u2', position: 'LEFT', depth: 3, path: 'u1/u2' }
    ];

    // Extreme Left under u1 should walk u1 -> u2 -> u4 -> and return u4 with LEFT
    const extremeLeft = PlacementEngine.findExtremeLegPosition('u1', 'LEFT', binaryNodes);
    assert.equal(extremeLeft.placementParentId, 'u4', 'Extreme Left parent should be u4');
    assert.equal(extremeLeft.position, 'LEFT', 'Extreme Left position must be LEFT');

    // Extreme Right under u1 should walk u1 -> u3 -> and return u3 with RIGHT
    const extremeRight = PlacementEngine.findExtremeLegPosition('u1', 'RIGHT', binaryNodes);
    assert.equal(extremeRight.placementParentId, 'u3', 'Extreme Right parent should be u3');
    assert.equal(extremeRight.position, 'RIGHT', 'Extreme Right position must be RIGHT');
});

test('PlacementEngine: Balanced placement places under weaker volume leg', () => {
    const binaryNodes = [
        { user_id: 'u1', placement_parent_id: null, position: null, depth: 1, path: '' },
        { user_id: 'u2', placement_parent_id: 'u1', position: 'LEFT', depth: 2, path: 'u1' },
        { user_id: 'u3', placement_parent_id: 'u1', position: 'RIGHT', depth: 2, path: 'u1' }
    ];

    // Volume ledger: Left leg has 50k BV, Right leg has 10k BV
    const volumeLedger = [
        { user_id: 'u1', leg: 'LEFT', amount: 50000 },
        { user_id: 'u1', leg: 'RIGHT', amount: 10000 }
    ];

    const balanced = PlacementEngine.findBalancedPosition('u1', binaryNodes, volumeLedger);
    assert.equal(balanced.placementParentId, 'u3', 'Balanced placement should choose weaker right leg parent u3');
    assert.equal(balanced.position, 'LEFT', 'First open slot under u3 is LEFT');
});

test('PlacementEngine: Adding nodes prevents position collision and updates parent references', () => {
    const binaryNodes = [
        { user_id: 'u1', placement_parent_id: null, position: null, depth: 1, path: '', left_child_id: null, right_child_id: null }
    ];

    const node1 = PlacementEngine.addNode(binaryNodes, {
        userId: 'u2',
        placementParentId: 'u1',
        position: 'LEFT'
    });

    assert.equal(node1.depth, 2, 'Child depth should be 2');
    assert.equal(node1.path, 'u1', 'Child path should be parent id');
    assert.equal(binaryNodes[0].left_child_id, 'u2', 'Parent left_child_id should point to u2');

    // Attempting duplicate placement in same slot should throw
    let errorThrown = false;
    try {
        PlacementEngine.addNode(binaryNodes, {
            userId: 'u3',
            placementParentId: 'u1',
            position: 'LEFT'
        });
    } catch (e) {
        errorThrown = true;
    }
    assert(errorThrown, 'Duplicate placement in same slot must throw error');
});

test('PlacementEngine: Building visual tree hierarchy with user details and volume summaries', () => {
    const binaryNodes = [
        { user_id: 'u1', placement_parent_id: null, position: null, depth: 1, path: '', left_child_id: 'u2', right_child_id: 'u3' },
        { user_id: 'u2', placement_parent_id: 'u1', position: 'LEFT', depth: 2, path: 'u1', left_child_id: null, right_child_id: null },
        { user_id: 'u3', placement_parent_id: 'u1', position: 'RIGHT', depth: 2, path: 'u1', left_child_id: null, right_child_id: null }
    ];
    const users = [
        { id: 'u1', username: 'root_user', full_name: 'Root Leader', status: 'ACTIVE' },
        { id: 'u2', username: 'left_user', full_name: 'Left Leader', status: 'ACTIVE' },
        { id: 'u3', username: 'right_user', full_name: 'Right Leader', status: 'ACTIVE' }
    ];
    const purchases = [
        { user_id: 'u1', status: 'ACTIVE' },
        { user_id: 'u2', status: 'ACTIVE' }
    ];

    const hierarchy = PlacementEngine.buildTreeHierarchy('u1', binaryNodes, users, purchases, [], 3);
    assert(hierarchy !== null, 'Hierarchy should not be null');
    assert.equal(hierarchy.username, 'root_user', 'Root username must match');
    assert(hierarchy.left !== null, 'Left child should exist');
    assert.equal(hierarchy.left.username, 'left_user', 'Left child username must match');
    assert(hierarchy.right !== null, 'Right child should exist');
    assert.equal(hierarchy.right.username, 'right_user', 'Right child username must match');
});

test('PlacementEngine: Searching tree node by username and returning path', () => {
    const binaryNodes = [
        { user_id: 'u1', placement_parent_id: null, position: null, depth: 1, path: '' },
        { user_id: 'u2', placement_parent_id: 'u1', position: 'LEFT', depth: 2, path: 'u1' }
    ];
    const users = [
        { id: 'u1', username: 'alice', full_name: 'Alice W' },
        { id: 'u2', username: 'bob', full_name: 'Bob K' }
    ];

    const found = PlacementEngine.searchTreeNode('bob', binaryNodes, users);
    assert(found !== null, 'Should find node for username bob');
    assert.equal(found.user_id, 'u2');
    assert.equal(found.path, 'u1');
});

if (require.main === module) {
    runTests();
}
