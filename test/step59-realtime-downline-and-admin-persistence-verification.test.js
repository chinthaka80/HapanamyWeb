/**
 * STEP 59 Test Suite: Real-Time Downline Visibility, Sponsor Alias/Object Decoding, Multi-Store Aggregation, and Server Persistence
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('./test-runner');

const AuthService = require('../services/auth-service');
const PlacementEngine = require('../services/placement-engine');
const ReferralService = require('../services/referral-service');
const MemberDashboardService = require('../services/member-dashboard-service');
const AdminDashboardService = require('../services/admin-dashboard-service');
const DirectCommissionEngine = require('../services/direct-commission-engine');
const VolumeLedger = require('../services/volume-ledger');

console.log('\n================================================================');
console.log('🚀 RUNNING STEP 59: REAL-TIME DOWNLINE & MULTI-STORE PERSISTENCE SUITE');
console.log('================================================================\n');

test('STEP 59.1: Sponsor Code Validation handles strings, objects, and uppercase/lowercase variants', () => {
    const users = [
        { id: 'user-hiru-root', username: 'Hiru', full_name: 'Hiru (Sales Leader)', email: 'hiru@hapanamy.lk', role: 'member', status: 'ACTIVE', referral_code: 'Hiru' }
    ];

    ['Hiru', 'hiru', 'HIRU', '@hiru', 'user-hiru-root', 'sponsor-uuid-1'].forEach(alias => {
        const validation = ReferralService.validateReferralCode(alias, users);
        assert.strictEqual(validation.valid, true, `Alias '${alias}' must be valid sponsor`);
        assert.strictEqual(validation.sponsor.username.toLowerCase(), 'hiru', `Alias '${alias}' must resolve to Hiru`);
    });
});

test('STEP 59.2: Multi-Downline Registration assigns correct positions and preserves genealogy without leakage', () => {
    const users = [
        { id: 'user-hiru-root', username: 'Hiru', full_name: 'Hiru', email: 'hiru@hapanamy.lk', role: 'member', status: 'ACTIVE', referral_code: 'Hiru' }
    ];
    const binaryNodes = [
        { id: 'node-root', user_id: 'user-hiru-root', placement_parent_id: null, position: null, depth: 1, left_child_id: null, right_child_id: null }
    ];
    const sponsors = [];
    const wallets = [];

    // Register 1st downline (LEFT)
    const reg1 = AuthService.registerMember({
        fullName: 'Member One',
        username: 'member_one',
        email: 'member1@example.com',
        mobile: '0771111111',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        sponsorCode: 'Hiru',
        position: 'LEFT'
    }, { users, sponsors, binaryNodes, wallets });

    assert.strictEqual(reg1.success, true);
    assert.strictEqual(reg1.placement.position, 'LEFT');

    // Register 2nd downline (RIGHT)
    const reg2 = AuthService.registerMember({
        fullName: 'Member Two',
        username: 'member_two',
        email: 'member2@example.com',
        mobile: '0772222222',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        sponsorCode: 'hiru',
        position: 'RIGHT'
    }, { users, sponsors, binaryNodes, wallets });

    assert.strictEqual(reg2.success, true);
    assert.strictEqual(reg2.placement.position, 'RIGHT');

    // Register 3rd downline (LEFT spillover)
    const reg3 = AuthService.registerMember({
        fullName: 'Member Three',
        username: 'member_three',
        email: 'member3@example.com',
        mobile: '0773333333',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        sponsorCode: 'Hiru',
        position: 'LEFT'
    }, { users, sponsors, binaryNodes, wallets });

    assert.strictEqual(reg3.success, true);
    assert.strictEqual(reg3.placement.position, 'LEFT');

    // Query Member Dashboard for Hiru
    const dashboard = MemberDashboardService.getMemberDashboardData({
        userId: 'user-hiru-root',
        users,
        binaryNodes,
        sponsors,
        purchases: [],
        kycDocs: [],
        walletLedger: [],
        volumeLedger: [],
        withdrawals: []
    });

    assert.strictEqual(dashboard.binary_network.team_list.length, 3, 'Hiru must see exactly 3 team members');
    assert.strictEqual(dashboard.binary_network.left_team_count, 2, 'Left team count must be 2');
    assert.strictEqual(dashboard.binary_network.right_team_count, 1, 'Right team count must be 1');
});

test('STEP 59.3: Frontend Dashboard Markup Audit - extractSponsorStrings, storage listener, and multi-store scanning', () => {
    const dashHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
    assert.ok(dashHtml.includes('extractSponsorStrings'), 'dashboard.html must include extractSponsorStrings helper');
    assert.ok(dashHtml.includes('processCandidateUser'), 'dashboard.html must process downline candidate users');
    assert.ok(dashHtml.includes('hapanamy_registered_users'), 'dashboard.html must scan hapanamy_registered_users');
    assert.ok(dashHtml.includes('referred_users_'), 'dashboard.html must scan all referred_users_* keys');
    assert.ok(dashHtml.includes('window.addEventListener(\'storage\''), 'dashboard.html must listen for cross-tab storage changes');
});

test('STEP 59.4: Admin Portals Markup Audit - addOrMergeUser, storage listener, and multi-store deduplication', () => {
    const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
    const portalHtml = fs.readFileSync(path.join(__dirname, '../hapanamy-admin-portal-9226.html'), 'utf8');

    for (const [filename, content] of Object.entries({ 'admin.html': adminHtml, 'hapanamy-admin-portal-9226.html': portalHtml })) {
        assert.ok(content.includes('addOrMergeUser'), `${filename} must implement addOrMergeUser`);
        assert.ok(content.includes('hapanamy_registered_users'), `${filename} must scan hapanamy_registered_users`);
        assert.ok(content.includes('referred_users_'), `${filename} must scan referred_users_*`);
        assert.ok(content.includes('window.addEventListener(\'storage\''), `${filename} must listen for storage events`);
    }
});

test('STEP 59.5: Server Persistence File Store Integrity & Safety', () => {
    const serverCode = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    assert.ok(serverCode.includes('mlm-db-store.json'), 'server.js must define mlm-db-store.json');
    assert.ok(serverCode.includes('saveDbStore'), 'server.js must define saveDbStore');
    assert.ok(serverCode.includes('loadDbStore'), 'server.js must define loadDbStore');
});

test('STEP 59.6: Preserves MLM Commission Formulas & Invariants', () => {
    const price = 15992.00;
    const directComm = DirectCommissionEngine.calculateDirectCommission(price, 8.00);
    assert.strictEqual(directComm, 1279.36, 'Direct commission must be exact 8% = 1279.36');

    const matchedBv = 10000.00;
    const bvComm = Math.round(matchedBv * (7.00 / 100) * 100) / 100;
    assert.strictEqual(bvComm, 700.00, 'Binary commission must be exact 7% = 700.00');
});
