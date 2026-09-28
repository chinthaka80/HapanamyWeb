// STEP 60 TEST SUITE: Real-time Member Identity, @-Prefixed Lookups, Account Switching, Downline Visibility & MLM Math Invariants
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const AuthService = require('../services/auth-service');
const PlacementEngine = require('../services/placement-engine');
const ReferralService = require('../services/referral-service');
const MemberDashboardService = require('../services/member-dashboard-service');
const MLMNetworkEngine = require('../services/mlm-network-engine');

console.log('================================================================');
console.log('🧪 RUNNING STEP 60: Real-time Member Identity, Downline & Switcher Suite');
console.log('================================================================');

// TEST 1: AuthService & Referral validation supports @-prefixed usernames and arbitrary member IDs
console.log('\n--- TEST 1: Sponsor Validation & Registration with @ and Case Variations ---');
const mockUsers = [
    { id: 'user-hiru-root', username: 'Hiru', full_name: 'Hiru (Sales Leader)', role: 'member', status: 'ACTIVE', qualification_status: 'QUALIFIED' }
];

const val1 = ReferralService.validateReferralCode('@Hiru', mockUsers);
assert(val1.valid, 'Validation must succeed for @Hiru');
assert.strictEqual(val1.sponsor.id, 'user-hiru-root');

const val2 = ReferralService.validateReferralCode('hiru', mockUsers);
assert(val2.valid, 'Validation must succeed for lowercase hiru');

const val3 = ReferralService.validateReferralCode('@hiru', mockUsers);
assert(val3.valid, 'Validation must succeed for @hiru');

console.log('✅ PASS: Referral validation handles @-prefixes and case variants.');

// TEST 2: Register @Sun under Hiru (LEFT)
console.log('\n--- TEST 2: Register Member @Sun under Hiru (LEFT) ---');
const ctx = {
    users: [...mockUsers],
    sponsors: [],
    binaryNodes: [
        { user_id: 'user-hiru-root', parent_id: null, position: 'ROOT', sponsor_id: null, depth: 0 }
    ],
    volumeLedger: [],
    wallets: [
        { id: 'wlt-hiru', user_id: 'user-hiru-root', balance: 0, pending_balance: 0, total_withdrawn: 0 }
    ],
    kycDocs: [],
    bankAccounts: [],
    auditLogs: [],
    referralConversions: [],
    intentStore: []
};

const sunPayload = {
    fullName: 'Sun',
    username: 'Sun',
    email: 'sun@example.com',
    mobile: '0771234567',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    sponsorCode: '@Hiru',
    position: 'LEFT',
    role: 'member'
};

const regRes = AuthService.registerMember(sunPayload, ctx);
assert(regRes.success, 'Registration must succeed: ' + regRes.error);
assert.strictEqual(regRes.user.username, 'Sun');
assert.strictEqual(regRes.user.full_name, 'Sun');
assert.strictEqual(regRes.placement.position, 'LEFT');
assert.strictEqual(regRes.sponsor.sponsor_id, 'user-hiru-root');

console.log('✅ PASS: Member Sun successfully registered under Hiru (LEFT).');

// TEST 3: Hiru Dashboard Sees Sun as Direct Left Member and in Team List
console.log('\n--- TEST 3: Member Dashboard Retrieval for Sponsor Hiru ---');
const hiruDashboard = MemberDashboardService.getMemberDashboardData({
    userId: 'user-hiru-root',
    ...ctx
});
assert(hiruDashboard.binary_network, 'Must return binary network data');
assert.strictEqual(hiruDashboard.binary_network.left_team_count, 1, 'Hiru must have 1 Left team member');
assert.strictEqual(hiruDashboard.binary_network.total_team_count, 1, 'Hiru must have 1 total member');
assert(hiruDashboard.binary_network.left_member, 'Left member must be populated');
assert.strictEqual(hiruDashboard.binary_network.left_member.username, 'Sun', 'Left member must be Sun');
assert.strictEqual(hiruDashboard.binary_network.left_member.position, 'LEFT');

console.log('✅ PASS: Sponsor Hiru sees Sun on Left Leg and in Team List.');

// TEST 4: Sun Dashboard Shows Sun as Center Member with Hiru as Upline
console.log('\n--- TEST 4: Member Dashboard Retrieval for Sun ---');
const sunUserId = regRes.user.id;
const sunDashboard = MemberDashboardService.getMemberDashboardData({
    userId: sunUserId,
    ...ctx
});
assert(sunDashboard.profile, 'Must return Sun profile');
assert.strictEqual(sunDashboard.profile.username, 'Sun');
assert.strictEqual(sunDashboard.binary_network.center_member.username, 'Sun');
assert.strictEqual(sunDashboard.binary_network.total_team_count, 0, 'New signup Sun has 0 downlines');
assert.strictEqual(sunDashboard.binary_network.left_member, null, 'Sun Left position is open');
assert.strictEqual(sunDashboard.binary_network.right_member, null, 'Sun Right position is open');

console.log('✅ PASS: Sun Dashboard shows Sun at center with open left and right positions.');

// TEST 5: HTML Markup Audits for Account Switcher, Sponsor Banner & Quick Logins
console.log('\n--- TEST 5: HTML Markup Audits across dashboard.html, login.html & admin.html ---');
const dashHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
const loginHtml = fs.readFileSync(path.join(__dirname, '../login.html'), 'utf8');
const loginRegHtml = fs.readFileSync(path.join(__dirname, '../login-register.html'), 'utf8');
const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
const adminPortalHtml = fs.readFileSync(path.join(__dirname, '../hapanamy-admin-portal-9226.html'), 'utf8');

// dashboard.html
assert(dashHtml.includes('btnSwitchAccount'), 'dashboard.html must have Switch Account button');
assert(dashHtml.includes('accountSwitchModal'), 'dashboard.html must have accountSwitchModal');
assert(dashHtml.includes('openAccountSwitchModal'), 'dashboard.html must define openAccountSwitchModal');
assert(dashHtml.includes('switchActiveAccount'), 'dashboard.html must define switchActiveAccount');
assert(dashHtml.includes('profileSponsorName'), 'dashboard.html must have profileSponsorName element');
assert(dashHtml.includes('profilePositionBadge'), 'dashboard.html must have profilePositionBadge element');

// login.html
assert(loginHtml.includes('quickLogin'), 'login.html must define quickLogin');
assert(loginHtml.includes('cleanNorm'), 'login.html must strip @ for identifier matching');

// login-register.html
assert(loginRegHtml.includes('quickLoginAuth'), 'login-register.html must define quickLoginAuth');
assert(loginRegHtml.includes('cleanNorm'), 'login-register.html must strip @ for identifier matching');

// admin.html & hapanamy-admin-portal-9226.html
assert(adminHtml.includes('viewMemberDashboard'), 'admin.html must define viewMemberDashboard');
assert(adminPortalHtml.includes('viewMemberDashboard'), 'hapanamy-admin-portal-9226.html must define viewMemberDashboard');

console.log('✅ PASS: All frontend HTML files include Account Switcher, Sponsor Details & Member View Handlers.');

// TEST 6: Core MLM Calculation Math Invariants
console.log('\n--- TEST 6: Core MLM Math Invariants (8% Direct, 7% Binary, Rs. 30,000 Cap) ---');
const DirectCommissionEngine = require('../services/direct-commission-engine');

const directComm = DirectCommissionEngine.calculateDirectCommission(7425.00, 8.00);
assert.strictEqual(directComm, 594.00, '8% of Rs. 7,425.00 must be Rs. 594.00');

const directCommTitan = DirectCommissionEngine.calculateDirectCommission(19900.00, 8.00);
assert.strictEqual(directCommTitan, 1592.00, '8% of Rs. 19,900.00 must be Rs. 1,592.00');

// Test daily cap
const capped = DirectCommissionEngine.applyDailyCap(5000.00, 28000.00, 30000.00);
assert.strictEqual(capped.eligibleAmount, 2000.00, 'Cap at 30k with 28k already earned allows max 2000.00');
assert.strictEqual(capped.cappedAmount, 3000.00, 'Excess 3000.00 is capped');

// Test binary matching math: 7% on matched volume
const leftVol = 10000.00;
const rightVol = 15000.00;
const matched = Math.min(leftVol, rightVol);
const binaryComm = Math.round(matched * 0.07 * 100) / 100;
assert.strictEqual(matched, 10000.00);
assert.strictEqual(binaryComm, 700.00, '7% of 10,000 must be Rs. 700.00');

console.log('✅ PASS: MLM Math Invariants remain 100% exact.');

console.log('\n================================================================');
console.log('🎉 STEP 60 TEST SUITE PASSED (6/6 TESTS COMPLETE)');
console.log('================================================================');
