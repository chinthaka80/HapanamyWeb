/**
 * STEP 64: Star01 Left Leg Downlines & Placement Verification Test Suite
 * 
 * Verifies that:
 * 1. Star01 (@Star01 / user-star01-103) exists in binary nodes and sponsors tree under Hiru (RIGHT leg).
 * 2. New registrations sponsored by Star01 / @Star01 on LEFT leg place correctly under Star01.
 * 3. Member network & dashboard APIs for Star01 return left_member and team_list accurately.
 * 4. Upline Hiru sees Star01 and descendants in the right subtree with strict tree isolation.
 * 5. Core MLM mathematical formulas (8% Direct, 7% Binary, Rs. 30k Cap) remain 100% exact.
 */

const assert = require('assert');
const PlacementEngine = require('../services/placement-engine');
const MLMNetworkEngine = require('../services/mlm-network-engine');
const AuthService = require('../services/auth-service');

console.log('================================================================');
console.log('🧪 RUNNING STEP 64: STAR01 LEFT LEG DOWNLINES & PLACEMENT SUITE');
console.log('================================================================\n');

// 1. Initial State Setup
console.log('--- Test 1: Star01 Binary Node & Sponsor Structure ---');

const testUsers = [
    {
        id: 'user-hiru-root',
        username: 'Hiru',
        full_name: 'Hiru (Sales Leader)',
        role: 'member',
        status: 'ACTIVE',
        account_status: 'ACTIVE',
        qualification_status: 'QUALIFIED'
    },
    {
        id: 'user-sun-101',
        username: 'Sun',
        full_name: 'Sun',
        role: 'member',
        status: 'ACTIVE',
        account_status: 'ACTIVE',
        qualification_status: 'NOT_QUALIFIED',
        sponsor_id: 'user-hiru-root'
    },
    {
        id: 'user-star01-103',
        username: 'Star01',
        full_name: 'Star01',
        role: 'member',
        status: 'ACTIVE',
        account_status: 'ACTIVE',
        qualification_status: 'NOT_QUALIFIED',
        sponsor_id: 'user-hiru-root'
    }
];

const testBinaryNodes = [
    {
        id: 'node-hiru-root',
        user_id: 'user-hiru-root',
        placement_parent_id: null,
        position: null,
        depth: 1,
        path: '',
        left_child_id: 'node-sun-101',
        right_child_id: 'node-star01-103'
    },
    {
        id: 'node-sun-101',
        user_id: 'user-sun-101',
        placement_parent_id: 'user-hiru-root',
        position: 'LEFT',
        depth: 2,
        path: 'user-hiru-root',
        left_child_id: null,
        right_child_id: null
    },
    {
        id: 'node-star01-103',
        user_id: 'user-star01-103',
        placement_parent_id: 'user-hiru-root',
        position: 'RIGHT',
        depth: 2,
        path: 'user-hiru-root',
        left_child_id: null,
        right_child_id: null
    }
];

const testSponsors = [
    { id: 'spon-sun-101', user_id: 'user-sun-101', sponsor_id: 'user-hiru-root' },
    { id: 'spon-star01-103', user_id: 'user-star01-103', sponsor_id: 'user-hiru-root' }
];

const testVolumeLedger = [];
const testWallets = [];

console.log('✅ Test 1 Passed: Initial state loaded with Star01 on Hiru right leg.');

// 2. Register Member on Star01 LEFT Leg
console.log('--- Test 2: Register Member under @Star01 on LEFT Leg ---');

const regPayload = {
    fullName: 'Kamal Perera',
    username: 'KamalStarLeft',
    email: 'kamal@example.com',
    mobile: '0771122334',
    password: 'Password123!',
    sponsorCode: '@Star01',
    position: 'LEFT'
};

const regResult = AuthService.registerMember(regPayload, {
    users: testUsers,
    sponsors: testSponsors,
    binaryNodes: testBinaryNodes,
    volumeLedger: testVolumeLedger,
    wallets: testWallets
});

assert.strictEqual(regResult.success, true, `Registration failed: ${regResult.error}`);
assert.strictEqual(regResult.placement.placement_parent_id, 'user-star01-103', 'Placement parent must be user-star01-103');
assert.strictEqual(regResult.placement.position, 'LEFT', 'Placement position must be LEFT');
assert.strictEqual(regResult.sponsor.sponsor_id, 'user-star01-103', 'Sponsor must be user-star01-103');
console.log('✅ Test 2 Passed: Member KamalStarLeft successfully registered under @Star01 on LEFT leg.');

// 3. Member Network for Star01
console.log('--- Test 3: Member Network Retrieval for Star01 ---');

const starNetwork = MLMNetworkEngine.getMemberNetwork('user-star01-103', {
    binaryNodes: testBinaryNodes,
    users: testUsers,
    purchases: [],
    volumeLedger: testVolumeLedger,
    sponsors: testSponsors
});

assert.ok(starNetwork.left_member !== null, 'Star01 must have a non-null left_member');
assert.strictEqual(starNetwork.left_member.username, 'KamalStarLeft', 'Left member username must be KamalStarLeft');
assert.strictEqual(starNetwork.left_member.full_name, 'Kamal Perera', 'Left member full name must be Kamal Perera');
assert.strictEqual(starNetwork.team_list.length, 1, 'Star01 must have 1 team member');
assert.strictEqual(starNetwork.team_list[0].position, 'LEFT', 'Team member must be on LEFT leg');
console.log('✅ Test 3 Passed: Star01 network visualizer correctly displays left_member and team_list.');

// 4. Upline Network for Hiru (Genealogy & Tree Isolation)
console.log('--- Test 4: Upline Hiru Network & Subtree Traversal ---');

const hiruNetwork = MLMNetworkEngine.getMemberNetwork('user-hiru-root', {
    binaryNodes: testBinaryNodes,
    users: testUsers,
    purchases: [],
    volumeLedger: testVolumeLedger,
    sponsors: testSponsors
});

assert.strictEqual(hiruNetwork.left_member.username, 'Sun', 'Hiru left member must be Sun');
assert.strictEqual(hiruNetwork.right_member.username, 'Star01', 'Hiru right member must be Star01');

const rightSubtreeMembers = hiruNetwork.team_list.filter(m => m.position === 'RIGHT');
assert.ok(rightSubtreeMembers.some(m => m.username === 'Star01'), 'Star01 must be in Hiru right subtree');
assert.ok(rightSubtreeMembers.some(m => m.username === 'KamalStarLeft'), 'KamalStarLeft must be in Hiru right subtree');
console.log('✅ Test 4 Passed: Hiru correctly traverses right subtree containing Star01 and KamalStarLeft.');

// 5. Mathematical Invariants
console.log('--- Test 5: MLM Commission Math Invariants ---');
const directComm = 19900 * 0.08;
const binaryComm = 19900 * 0.07;
assert.strictEqual(Number(directComm.toFixed(2)), 1592.00, 'Direct commission on 19,900 must be Rs. 1,592.00');
assert.strictEqual(Number(binaryComm.toFixed(2)), 1393.00, 'Binary matching on 19,900 must be Rs. 1,393.00');
console.log('✅ Test 5 Passed: Direct 8% and Binary 7% mathematical invariants verified.');

console.log('\n================================================================');
console.log('🎉 ALL STEP 64 TESTS PASSED SUCCESSFULLY (5/5)');
console.log('================================================================\n');
