// Comprehensive Test Suite for STEP 15 — Member Registration & Sponsor Assignment
const testRunner = require('./test-runner');
const AuthService = require('../services/auth-service');
const PlacementEngine = require('../services/placement-engine');
const ReferralService = require('../services/referral-service');

function createMockContext() {
    return {
        users: [
            { id: 'admin-1', username: 'admin', email: 'admin@hapanamy.lk', role: 'admin', status: 'ACTIVE' },
            { id: 'sponsor-1', username: 'kasun_t', email: 'kasun@hapanamy.lk', role: 'member', status: 'ACTIVE' },
            { id: 'inactive-1', username: 'banned_user', email: 'banned@hapanamy.lk', role: 'member', status: 'INACTIVE' }
        ],
        sponsors: [
            { user_id: 'sponsor-1', sponsor_id: 'admin-1', created_at: new Date().toISOString() }
        ],
        binaryNodes: [
            { user_id: 'admin-1', placement_parent_id: null, position: null, depth: 1, path: '', left_child_id: 'sponsor-1', right_child_id: null },
            { user_id: 'sponsor-1', placement_parent_id: 'admin-1', position: 'LEFT', depth: 2, path: 'admin-1', left_child_id: null, right_child_id: null }
        ],
        volumeLedger: [],
        wallets: [
            { id: 'wlt-1', user_id: 'sponsor-1', balance: 0.00, pending_balance: 0.00, total_withdrawn: 0.00 }
        ],
        kycDocs: [],
        bankAccounts: [],
        auditLogs: [],
        referralConversions: [],
        intentStore: []
    };
}

test('Step 15: 1. Normal registration creates user, sponsor link, binary placement, and wallet', () => {
    const ctx = createMockContext();
    const payload = {
        fullName: 'Nimal Silva',
        username: 'nimal_s',
        email: 'nimal@hapanamy.lk',
        mobile: '0712345678',
        password: 'Password123#',
        confirmPassword: 'Password123#',
        sponsorCode: 'kasun_t',
        position: 'LEFT',
        nicPassport: '199512345678',
        address: 'No 10, Galle Rd, Colombo',
        accountHolderName: 'Nimal Silva',
        bankName: 'Commercial Bank',
        branchName: 'Maharagama',
        accountNumber: '8010294851'
    };

    const res = AuthService.registerMember(payload, ctx);

    assert(res.success, 'Registration should succeed');
    assert.equal(res.user.username, 'nimal_s');
    assert.equal(res.sponsor.sponsor_id, 'sponsor-1');
    assert.equal(res.placement.placement_parent_id, 'sponsor-1');
    assert.equal(res.placement.position, 'LEFT');
    assert.equal(res.wallet.balance, 0.00);

    // Verify context records created
    assert.equal(ctx.users.length, 4);
    assert.equal(ctx.sponsors.length, 2);
    assert.equal(ctx.binaryNodes.length, 3);
    assert.equal(ctx.wallets.length, 2);
    assert.equal(ctx.auditLogs.length, 1);
    assert.equal(ctx.referralConversions.length, 1);
});

test('Step 15: 2. LEFT and RIGHT registration placement under sponsor', () => {
    const ctx = createMockContext();

    // 1. Register Member on LEFT
    const leftRes = AuthService.registerMember({
        fullName: 'Left Member',
        username: 'member_left',
        email: 'left@hapanamy.lk',
        mobile: '0711111111',
        password: 'Password123#',
        sponsorCode: 'kasun_t',
        position: 'LEFT'
    }, ctx);

    assert(leftRes.success);
    assert.equal(leftRes.placement.placement_parent_id, 'sponsor-1');
    assert.equal(leftRes.placement.position, 'LEFT');

    // 2. Register Member on RIGHT
    const rightRes = AuthService.registerMember({
        fullName: 'Right Member',
        username: 'member_right',
        email: 'right@hapanamy.lk',
        mobile: '0722222222',
        password: 'Password123#',
        sponsorCode: 'kasun_t',
        position: 'RIGHT'
    }, ctx);

    assert(rightRes.success);
    assert.equal(rightRes.placement.placement_parent_id, 'sponsor-1');
    assert.equal(rightRes.placement.position, 'RIGHT');
});

test('Step 15: 3. Rejects invalid or inactive referral code', () => {
    const ctx = createMockContext();

    // Non-existent sponsor
    const notFoundRes = AuthService.registerMember({
        fullName: 'Ghost Member',
        username: 'ghost_user',
        email: 'ghost@hapanamy.lk',
        mobile: '0733333333',
        password: 'Password123#',
        sponsorCode: 'non_existent_sponsor',
        position: 'LEFT'
    }, ctx);
    assert(!notFoundRes.success, 'Non-existent sponsor should fail');
    assert(notFoundRes.error.includes('does not exist'));

    // Inactive sponsor
    const inactiveRes = AuthService.registerMember({
        fullName: 'Blocked Member',
        username: 'blocked_user',
        email: 'blocked@hapanamy.lk',
        mobile: '0744444444',
        password: 'Password123#',
        sponsorCode: 'banned_user',
        position: 'LEFT'
    }, ctx);
    assert(!inactiveRes.success, 'Inactive sponsor should fail');
    assert(inactiveRes.error.includes('inactive'));
});

test('Step 15: 4. Rejects duplicate username and duplicate email', () => {
    const ctx = createMockContext();

    // Duplicate username
    const dupUserRes = AuthService.registerMember({
        fullName: 'Copy Cat',
        username: 'kasun_t', // Already in ctx.users
        email: 'unique_email@hapanamy.lk',
        mobile: '0755555555',
        password: 'Password123#',
        sponsorCode: 'admin',
        position: 'LEFT'
    }, ctx);
    assert(!dupUserRes.success, 'Duplicate username must fail');
    assert(dupUserRes.error.includes('already taken'));

    // Duplicate email
    const dupEmailRes = AuthService.registerMember({
        fullName: 'Copy Email',
        username: 'unique_user',
        email: 'kasun@hapanamy.lk', // Already in ctx.users
        mobile: '0766666666',
        password: 'Password123#',
        sponsorCode: 'admin',
        position: 'LEFT'
    }, ctx);
    assert(!dupEmailRes.success, 'Duplicate email must fail');
    assert(dupEmailRes.error.includes('already registered'));
});

test('Step 15: 5. Full tree position: Correctly finds next open leaf under sponsor leg', () => {
    const ctx = createMockContext();

    // Fill LEFT and RIGHT of sponsor-1
    AuthService.registerMember({
        fullName: 'Child L', username: 'child_l', email: 'child_l@hapanamy.lk', mobile: '0771111111',
        password: 'Password123#', sponsorCode: 'kasun_t', position: 'LEFT'
    }, ctx);

    AuthService.registerMember({
        fullName: 'Child R', username: 'child_r', email: 'child_r@hapanamy.lk', mobile: '0772222222',
        password: 'Password123#', sponsorCode: 'kasun_t', position: 'RIGHT'
    }, ctx);

    // Register 3rd member with position LEFT sponsored by kasun_t -> must spill over under child_l (LEFT)
    const spilloverRes = AuthService.registerMember({
        fullName: 'Spillover Member', username: 'spillover_1', email: 'spill@hapanamy.lk', mobile: '0773333333',
        password: 'Password123#', sponsorCode: 'kasun_t', position: 'LEFT'
    }, ctx);

    assert(spilloverRes.success);
    assert.equal(spilloverRes.sponsor.sponsor_username, 'kasun_t');
    const childLNode = ctx.binaryNodes.find(n => n.user_id === ctx.users.find(u => u.username === 'child_l').id);
    assert.equal(spilloverRes.placement.placement_parent_id, childLNode.user_id, 'Placement parent must be child_l');
    assert.equal(spilloverRes.placement.position, 'LEFT');
});

test('Step 15: 6. Transactional Rollback: Restores all tables on unhandled failure without side-effects', () => {
    const ctx = createMockContext();
    const initialUsersCount = ctx.users.length;
    const initialNodesCount = ctx.binaryNodes.length;

    // Simulate placement slot collision during assignment
    const origAssign = PlacementEngine.assignPlacement;
    PlacementEngine.assignPlacement = function() {
        throw new Error('Database transaction lock error simulated');
    };

    try {
        const failedRes = AuthService.registerMember({
            fullName: 'Faulty User',
            username: 'faulty_u',
            email: 'faulty@hapanamy.lk',
            mobile: '0788888888',
            password: 'Password123#',
            sponsorCode: 'kasun_t',
            position: 'LEFT'
        }, ctx);

        assert(!failedRes.success, 'Registration should fail due to simulated error');
        assert(failedRes.error.includes('rolled back'));
        assert.equal(ctx.users.length, initialUsersCount, 'Users list must be rolled back');
        assert.equal(ctx.binaryNodes.length, initialNodesCount, 'Binary nodes must be rolled back');
    } finally {
        PlacementEngine.assignPlacement = origAssign;
    }
});

if (require.main === module) {
    runTests();
}
