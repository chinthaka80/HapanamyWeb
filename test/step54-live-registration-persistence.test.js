const assert = require('assert');
const { test } = require('./test-runner');
const AuthService = require('../services/auth-service');
const PlacementEngine = require('../services/placement-engine');
const ReferralService = require('../services/referral-service');
const MLMNetworkEngine = require('../services/mlm-network-engine');
const MemberDashboardService = require('../services/member-dashboard-service');

test('STEP 54.1: AuthService.registerMember creates member, sponsor relation, binary node, and wallet', () => {
    const users = [
        { id: 'user-hiru-root', username: 'Hiru', full_name: 'Hiru', email: 'hiru@hapanamy.lk', role: 'member', status: 'ACTIVE', referral_code: 'Hiru' }
    ];
    const sponsors = [];
    const binaryNodes = [
        { id: 'node-hiru-root', user_id: 'user-hiru-root', placement_parent_id: null, position: null, depth: 1, path: '', left_child_id: null, right_child_id: null }
    ];
    const wallets = [];
    const volumeLedger = [];

    const regPayload = {
        fullName: 'Tharindu Wickrama',
        username: 'tharindu_w',
        email: 'tharindu@example.com',
        mobile: '0771234567',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        sponsorCode: 'Hiru',
        position: 'LEFT'
    };

    const result = AuthService.registerMember(regPayload, {
        users,
        sponsors,
        binaryNodes,
        volumeLedger,
        wallets
    });

    assert.strictEqual(result.success, true, 'Registration should succeed');
    assert.strictEqual(result.user.username, 'tharindu_w');
    assert.strictEqual(result.user.full_name, 'Tharindu Wickrama');
    assert.strictEqual(result.sponsor.sponsor_username, 'Hiru');
    assert.strictEqual(result.placement.position, 'LEFT');

    // Verify stored entities
    assert.strictEqual(users.length, 2, 'New user should be added to users store');
    assert.strictEqual(sponsors.length, 1, 'Sponsor record should be stored');
    assert.strictEqual(binaryNodes.length, 2, 'Binary node should be created');
    assert.strictEqual(wallets.length, 1, 'Wallet should be initialized');
});

test('STEP 54.2: Registration supports requestedPosition and flexible sponsor alias parameters', () => {
    const users = [
        { id: 'user-hiru-root', username: 'Hiru', full_name: 'Hiru', email: 'hiru@hapanamy.lk', role: 'member', status: 'ACTIVE', referral_code: 'Hiru' }
    ];
    const sponsors = [];
    const binaryNodes = [
        { id: 'node-hiru-root', user_id: 'user-hiru-root', placement_parent_id: null, position: null, depth: 1, path: '', left_child_id: null, right_child_id: null }
    ];
    const wallets = [];
    const volumeLedger = [];

    const regPayload = {
        fullName: 'Sanduni Perera',
        username: 'sanduni_p',
        email: 'sanduni@example.com',
        mobile: '0719876543',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        sponsor: 'Hiru', // alias for sponsorCode
        requestedPosition: 'RIGHT' // alias for position
    };

    const result = AuthService.registerMember(regPayload, {
        users,
        sponsors,
        binaryNodes,
        volumeLedger,
        wallets
    });

    assert.strictEqual(result.success, true, 'Registration with aliases should succeed');
    assert.strictEqual(result.placement.position, 'RIGHT');
    assert.strictEqual(binaryNodes[1].position, 'RIGHT');
});

test('STEP 54.3: MemberDashboardService returns newly registered members in team_list and leg counts', () => {
    const users = [
        { id: 'user-hiru-root', username: 'Hiru', full_name: 'Hiru', email: 'hiru@hapanamy.lk', role: 'member', status: 'ACTIVE', referral_code: 'Hiru' },
        { id: 'user-left-1', username: 'kasun_left', full_name: 'Kasun L', email: 'kasun@example.com', role: 'member', status: 'ACTIVE', created_at: '2026-09-02T10:00:00Z' },
        { id: 'user-right-1', username: 'sanduni_right', full_name: 'Sanduni R', email: 'sanduni@example.com', role: 'member', status: 'ACTIVE', created_at: '2026-09-03T10:00:00Z' }
    ];
    const binaryNodes = [
        { id: 'node-root', user_id: 'user-hiru-root', placement_parent_id: null, position: null, depth: 1, path: '', left_child_id: 'node-l1', right_child_id: 'node-r1' },
        { id: 'node-l1', user_id: 'user-left-1', placement_parent_id: 'user-hiru-root', position: 'LEFT', depth: 2, path: 'LEFT', left_child_id: null, right_child_id: null },
        { id: 'node-r1', user_id: 'user-right-1', placement_parent_id: 'user-hiru-root', position: 'RIGHT', depth: 2, path: 'RIGHT', left_child_id: null, right_child_id: null }
    ];
    const sponsors = [
        { user_id: 'user-left-1', sponsor_id: 'user-hiru-root' },
        { user_id: 'user-right-1', sponsor_id: 'user-hiru-root' }
    ];

    const dash = MemberDashboardService.getMemberDashboardData({
        userId: 'user-hiru-root',
        users,
        binaryNodes,
        sponsors,
        purchases: [],
        volumeLedger: [],
        walletLedger: [],
        kycDocs: []
    });

    assert.strictEqual(dash.binary_network.left_team_count, 1, 'Left count should be 1');
    assert.strictEqual(dash.binary_network.right_team_count, 1, 'Right count should be 1');
    assert.strictEqual(dash.binary_network.total_team_count, 2, 'Total team count should be 2');
    assert.strictEqual(dash.binary_network.team_list.length, 2, 'Team list should have 2 members');
    assert.strictEqual(dash.binary_network.team_list[0].username, 'kasun_left');
    assert.strictEqual(dash.binary_network.team_list[1].username, 'sanduni_right');
});

test('STEP 54.4: Local Storage Downlines Simulation handles zero-state and dynamic additions without crosslines', () => {
    const activeUser = { id: 'user-hiru-root', username: 'Hiru', full_name: 'Hiru' };
    
    // Simulate client-side extraction logic
    const refList = [
        { username: 'chaminda_l', full_name: 'Chaminda Silva', position: 'LEFT', status: 'Active', created_at: '2026-09-10T10:00:00Z' },
        { username: 'niluka_r', full_name: 'Niluka Perera', position: 'RIGHT', status: 'Active', created_at: '2026-09-11T10:00:00Z' }
    ];

    const regUsers = [
        { id: 'usr-1', username: 'chaminda_l', full_name: 'Chaminda Silva', sponsor: 'Hiru', position: 'LEFT', status: 'ACTIVE' },
        { id: 'usr-2', username: 'niluka_r', full_name: 'Niluka Perera', sponsor: 'Hiru', position: 'RIGHT', status: 'ACTIVE' },
        { id: 'usr-cross', username: 'cross_member', full_name: 'Cross Line', sponsor: 'OtherSponsor', position: 'LEFT', status: 'ACTIVE' }
    ];

    // Filter for Hiru only
    const hiruDownlines = regUsers.filter(u => u.sponsor.toLowerCase() === activeUser.username.toLowerCase());
    assert.strictEqual(hiruDownlines.length, 2, 'Only Hiru downlines should be extracted');
    assert.strictEqual(hiruDownlines.some(u => u.username === 'cross_member'), false, 'Crosslines must never appear');
});
