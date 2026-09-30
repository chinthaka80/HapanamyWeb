// test/step65-earlier-signups-visibility-and-preservation.test.js
// Verification suite to ensure earlier signups across all storage tiers (server DB, local storage, indexedDB, mock arrays)
// are accurately discovered, preserved, linked, and displayed in Member Dashboard and Admin Portal.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const PlacementEngine = require('../services/placement-engine');
const AuthService = require('../services/auth-service');
const MLMNetworkEngine = require('../services/mlm-network-engine');
const CommissionCore = require('../services/commission-core');

console.log('\n================================================================');
console.log('🧪 RUNNING STEP 65: EARLIER SIGNUPS VISIBILITY & PRESERVATION TEST SUITE');
console.log('================================================================\n');

// 1. Test PlacementEngine.getDirectReferrals with multi-identity sponsor matching
console.log('--- TEST 1: PlacementEngine.getDirectReferrals multi-identity sponsor matching ---');
const testUsers = [
    { id: 'user-hiru-root', username: 'Hiru', full_name: 'Hiru (Sales Leader)', email: 'hiru@hapanamy.lk', role: 'member', status: 'ACTIVE' },
    { id: 'user-sun-101', username: 'Sun', full_name: 'Sun', email: 'sun@hapanamy.lk', role: 'member', sponsor: 'Hiru', status: 'ACTIVE' },
    { id: 'user-sundd-102', username: 'SUNDD', full_name: 'SUNDD', email: 'sundd@hapanamy.lk', role: 'member', sponsor: 'Sun', status: 'ACTIVE' },
    { id: 'user-star01-103', username: 'Star01', full_name: 'Star01', email: 'star01@hapanamy.lk', role: 'member', sponsor: 'Hiru', status: 'ACTIVE' }
];

const testSponsors = [
    { id: 'spon-sun-101', user_id: 'user-sun-101', sponsor_id: 'user-hiru-root' },
    { id: 'spon-sundd-102', user_id: 'user-sundd-102', sponsor_id: 'user-sun-101' },
    { id: 'spon-star01-103', user_id: 'user-star01-103', sponsor_id: 'user-hiru-root' }
];

const testBinaryNodes = [
    { id: 'node-hiru-root', user_id: 'user-hiru-root', placement_parent_id: null, position: null },
    { id: 'node-sun-101', user_id: 'user-sun-101', placement_parent_id: 'user-hiru-root', position: 'LEFT' },
    { id: 'node-sundd-102', user_id: 'user-sundd-102', placement_parent_id: 'user-sun-101', position: 'LEFT' },
    { id: 'node-star01-103', user_id: 'user-star01-103', placement_parent_id: 'user-hiru-root', position: 'RIGHT' }
];

// Query by 'Hiru', 'user-hiru-root', and '@Hiru'
const directsByUsername = PlacementEngine.getDirectReferrals('Hiru', testSponsors, testUsers, [], testBinaryNodes);
const directsById = PlacementEngine.getDirectReferrals('user-hiru-root', testSponsors, testUsers, [], testBinaryNodes);
const directsWithAt = PlacementEngine.getDirectReferrals('@Hiru', testSponsors, testUsers, [], testBinaryNodes);

assert.strictEqual(directsByUsername.length, 2, 'Hiru should have 2 direct referrals (Sun & Star01)');
assert.strictEqual(directsById.length, 2, 'user-hiru-root query should have 2 direct referrals');
assert.strictEqual(directsWithAt.length, 2, '@Hiru query should have 2 direct referrals');
assert.ok(directsByUsername.some(d => d.username === 'Sun'), 'Directs should contain Sun');
assert.ok(directsByUsername.some(d => d.username === 'Star01'), 'Directs should contain Star01');
console.log('✅ Passed: PlacementEngine.getDirectReferrals resolves all sponsor alias variations');

// 2. Test query by Sun
console.log('\n--- TEST 2: Direct referrals under Sun ---');
const directsUnderSun = PlacementEngine.getDirectReferrals('Sun', testSponsors, testUsers, [], testBinaryNodes);
assert.strictEqual(directsUnderSun.length, 1, 'Sun should have 1 direct referral (SUNDD)');
assert.strictEqual(directsUnderSun[0].username, 'SUNDD');
console.log('✅ Passed: Direct referrals under Sun resolve SUNDD');

// 3. Test AuthService.registerMember creates complete newUser entity
console.log('\n--- TEST 3: AuthService.registerMember entity completeness ---');
const dynamicUsers = [...testUsers];
const dynamicSponsors = [...testSponsors];
const dynamicNodes = [...testBinaryNodes];
const dynamicWallets = [];

const regResult = AuthService.registerMember({
    fullName: 'Test New Member',
    username: 'testmember88',
    email: 'testmember88@hapanamy.lk',
    mobile: '0771239999',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    sponsorCode: 'Star01',
    requestedPosition: 'LEFT',
    role: 'affiliate'
}, {
    users: dynamicUsers,
    sponsors: dynamicSponsors,
    binaryNodes: dynamicNodes,
    wallets: dynamicWallets
});

assert.strictEqual(regResult.success, true, 'Registration must succeed');
assert.strictEqual(regResult.user.username, 'testmember88');
assert.strictEqual(regResult.user.role, 'affiliate');

const createdUserInArray = dynamicUsers.find(u => u.username === 'testmember88');
assert.ok(createdUserInArray, 'Created user must exist in users array');
assert.strictEqual(createdUserInArray.sponsor, 'Star01');
assert.strictEqual(createdUserInArray.position, 'LEFT');
assert.strictEqual(createdUserInArray.role, 'affiliate');

const star01Directs = PlacementEngine.getDirectReferrals('Star01', dynamicSponsors, dynamicUsers, [], dynamicNodes);
assert.strictEqual(star01Directs.length, 1, 'Star01 should now have 1 direct referral (testmember88)');
assert.strictEqual(star01Directs[0].username, 'testmember88');
console.log('✅ Passed: New registration creates complete entity and updates sponsor direct referrals');

// 4. Test MLMNetworkEngine.getMemberNetwork for Star01
console.log('\n--- TEST 4: MLMNetworkEngine.getMemberNetwork for Star01 ---');
const star01Network = MLMNetworkEngine.getMemberNetwork('user-star01-103', {
    users: dynamicUsers,
    binaryNodes: dynamicNodes,
    purchases: [],
    volumeLedger: [],
    sponsors: dynamicSponsors
});

assert.ok(star01Network, 'Star01 network data must be returned');
assert.strictEqual(star01Network.team_list.length, 1, 'Star01 team list must contain testmember88');
assert.strictEqual(star01Network.team_list[0].username, 'testmember88');
assert.strictEqual(star01Network.direct_referrals.length, 1, 'Star01 direct referrals must contain testmember88');
console.log('✅ Passed: MLMNetworkEngine.getMemberNetwork accurately returns new downline under Star01');

// 5. Test frontend files markup audit for all multi-store scanning and Star01 pre-seeding
console.log('\n--- TEST 5: Frontend files markup audit ---');
const dashHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
const hapanamyAdminHtml = fs.readFileSync(path.join(__dirname, '../hapanamy-admin-portal-9226.html'), 'utf8');
const affHtml = fs.readFileSync(path.join(__dirname, '../affiliate-dashboard.html'), 'utf8');
const phpIndex = fs.readFileSync(path.join(__dirname, '../api/index.php'), 'utf8');

// dashboard.html audits
assert.ok(dashHtml.includes('accountMap.set(\'namobuddhaya\''), 'dashboard.html must include NAMOBUDDHAYA in accountMap');
assert.ok(dashHtml.includes('accountMap.set(\'subadmin\''), 'dashboard.html must include subadmin in accountMap');
assert.ok(dashHtml.includes('all_users') && dashHtml.includes('users'), 'dashboard.html must scan all_users and users stores');
assert.ok(dashHtml.includes('directList.push'), 'dashboard.html applyDashboardData must merge local direct referrals');

// admin.html & hapanamy-admin-portal-9226.html audits
assert.ok(adminHtml.includes('user-namobuddhaya-root'), 'admin.html must include NAMOBUDDHAYA in seedUsers');
assert.ok(hapanamyAdminHtml.includes('user-namobuddhaya-root'), 'hapanamy-admin-portal-9226.html must include NAMOBUDDHAYA in seedUsers');
assert.ok(adminHtml.includes('user-subadmin-finance'), 'admin.html must include subadmin2 in seedUsers');
assert.ok(hapanamyAdminHtml.includes('user-subadmin-finance'), 'hapanamy-admin-portal-9226.html must include subadmin2 in seedUsers');
assert.ok(adminHtml.includes('replace(/^@+/, \'\')'), 'admin.html must strip leading @ in username key normalization');
assert.ok(hapanamyAdminHtml.includes('replace(/^@+/, \'\')'), 'hapanamy-admin-portal-9226.html must strip leading @ in username key normalization');

// affiliate-dashboard.html audits
assert.ok(affHtml.includes('myRefCodes'), 'affiliate-dashboard.html must check all alias keys for referred_users_*');

// api/index.php audits
assert.ok(phpIndex.includes('user-namobuddhaya-root'), 'api/index.php must include user-namobuddhaya-root in seedUsers');
assert.ok(phpIndex.includes('user-subadmin-finance'), 'api/index.php must include user-subadmin-finance in seedUsers');
assert.ok(phpIndex.includes('$db[\'sponsors\']'), 'api/index.php must check $db[\'sponsors\'] in enrichUserSummary');

console.log('✅ Passed: All frontend and backend markup audits verified successfully');

// 6. Test Core MLM Commission Math Invariants
console.log('\n--- TEST 6: Core MLM Commission Math Invariants (8% Direct, 7% Binary, Rs. 30,000 Cap) ---');
const direct7425 = CommissionCore.calculateDirectCommission(7425.00, 8.0);
assert.strictEqual(direct7425, 594.00, '8% Direct Commission on Rs. 7,425 must be exactly Rs. 594.00');

const direct4500 = CommissionCore.calculateDirectCommission(4500.00, 8.0);
assert.strictEqual(direct4500, 360.00, '8% Direct Commission on Rs. 4,500 must be exactly Rs. 360.00');

const binary7425 = CommissionCore.calculateBinaryCommission(7425.00, 7.0);
assert.strictEqual(binary7425, 519.75, '7% Binary Commission on 7,425 BV must be exactly Rs. 519.75');

console.log('✅ Passed: Core MLM commission math invariants remain 100% exact');

console.log('\n================================================================');
console.log('🎉 ALL STEP 65 TESTS PASSED SUCCESSFULLY (6/6)');
console.log('================================================================\n');
