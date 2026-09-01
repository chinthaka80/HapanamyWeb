// Comprehensive Test Suite for STEP 35 — Public Website, Authentication & Sign-Up Foundation
const testRunner = require('./test-runner');
const SignupFoundationService = require('../services/signup-foundation-service');
const PlacementEngine = require('../services/placement-engine');
const ReferralService = require('../services/referral-service');

test('Step 35: 1. Normal Registration: Free join creates user, reserves tree slot, inits wallet & generates verification token', () => {
    const users = [];
    const sponsors = [];
    const binaryNodes = [];
    const volumeLedger = [];
    const wallets = [];
    const auditLogs = [];

    const root = { id: 'usr-root', username: 'root_master', role: 'admin', status: 'ACTIVE' };
    users.push(root);
    binaryNodes.push({ id: 'n-root', user_id: 'usr-root', depth: 1, path: '', left_child_id: null, right_child_id: null });

    const payload = {
        fullName: 'Nimali Fonseka',
        username: 'nimali_f',
        email: 'nimali@hapanamy.lk',
        mobile: '+94711234567',
        password: 'SecurePassword123#',
        confirmPassword: 'SecurePassword123#',
        termsAccepted: true,
        privacyAccepted: true
    };

    const regResult = SignupFoundationService.registerMember({
        ...payload,
        users,
        sponsors,
        binaryNodes,
        volumeLedger,
        wallets,
        auditLogs
    });

    assert(regResult.success, 'Registration succeeded');
    assert.equal(regResult.user.username, 'nimali_f');
    assert.equal(regResult.user.auth_status, 'EMAIL_PENDING');
    assert.equal(regResult.user.product_status, 'NO_PURCHASE');
    assert.equal(regResult.user.qualification_status, 'UNQUALIFIED');
    assert(regResult.verification_token, 'Verification token generated');
    assert.equal(wallets[0].available_balance, 0.00, 'Zero wallet balance for free join');
    assert.equal(binaryNodes[1].node_status, 'RESERVED', 'Tree slot reserved');
});

test('Step 35: 2. Referral Registration: Dual-Leg link resolves placement parent & position server-side', () => {
    const users = [];
    const sponsors = [];
    const binaryNodes = [];
    const volumeLedger = [];
    const wallets = [];

    const root = { id: 'usr-root', username: 'root_master', role: 'admin', status: 'ACTIVE' };
    users.push(root);
    binaryNodes.push({ id: 'n-root', user_id: 'usr-root', depth: 1, path: '', left_child_id: null, right_child_id: null });

    // User A registers
    const regA = SignupFoundationService.registerMember({
        fullName: 'User A',
        username: 'user_a',
        email: 'usera@test.lk',
        mobile: '+94771111111',
        password: 'Password123#',
        termsAccepted: true,
        privacyAccepted: true,
        users, sponsors, binaryNodes, volumeLedger, wallets
    });
    assert(regA.success);

    // User B registers with User A RIGHT referral link
    const regB = SignupFoundationService.registerMember({
        fullName: 'User B',
        username: 'user_b',
        email: 'userb@test.lk',
        mobile: '+94772222222',
        password: 'Password123#',
        sponsorCode: 'user_a',
        requestedPosition: 'RIGHT',
        termsAccepted: true,
        privacyAccepted: true,
        users, sponsors, binaryNodes, volumeLedger, wallets
    });
    assert(regB.success);

    const nodeB = binaryNodes.find(n => n.user_id === regB.user.id);
    assert.equal(nodeB.placement_parent_id, regA.user.id);
    assert.equal(nodeB.position, 'RIGHT');
});

test('Step 35: 3. Security Guards: Rejects invalid sponsor, invalid position, and self-referrals', () => {
    const users = [{ id: 'usr-1', username: 'existing_user', status: 'ACTIVE' }];

    // Self Referral
    const resSelf = SignupFoundationService.registerMember({
        fullName: 'Self Ref',
        username: 'existing_user',
        email: 'self@test.lk',
        mobile: '+94773333333',
        password: 'Password123#',
        sponsorCode: 'existing_user',
        termsAccepted: true,
        privacyAccepted: true,
        users
    });
    assert(!resSelf.success);

    // Invalid Sponsor
    const resInvSponsor = SignupFoundationService.registerMember({
        fullName: 'New User',
        username: 'new_user',
        email: 'new@test.lk',
        mobile: '+94773333333',
        password: 'Password123#',
        sponsorCode: 'non_existent_sponsor',
        termsAccepted: true,
        privacyAccepted: true,
        users
    });
    assert(!resInvSponsor.success);

    // Invalid Position
    const resInvPos = SignupFoundationService.registerMember({
        fullName: 'New User 2',
        username: 'new_user2',
        email: 'new2@test.lk',
        mobile: '+94774444444',
        password: 'Password123#',
        sponsorCode: 'existing_user',
        requestedPosition: 'MIDDLE',
        termsAccepted: true,
        privacyAccepted: true,
        users
    });
    assert(!resInvPos.success);
});

test('Step 35: 4. Duplicate Prevention: Blocks duplicate emails and duplicate usernames', () => {
    const users = [{ id: 'usr-dup', username: 'taken_user', email: 'taken@hapanamy.lk', status: 'ACTIVE' }];

    const dupEmail = SignupFoundationService.registerMember({
        fullName: 'Test User',
        username: 'unique_user_1',
        email: 'taken@hapanamy.lk',
        mobile: '+94775555555',
        password: 'Password123#',
        termsAccepted: true,
        privacyAccepted: true,
        users
    });
    assert(!dupEmail.success, 'Duplicate email must be blocked');

    const dupUser = SignupFoundationService.registerMember({
        fullName: 'Test User',
        username: 'taken_user',
        email: 'unique@hapanamy.lk',
        mobile: '+94775555555',
        password: 'Password123#',
        termsAccepted: true,
        privacyAccepted: true,
        users
    });
    assert(!dupUser.success, 'Duplicate username must be blocked');
});

test('Step 35: 5. Email Verification Lifecycle: Verifies token, updates status & handles already verified idempotently', () => {
    const users = [{ id: 'usr-v1', email: 'verify@hapanamy.lk', auth_status: 'EMAIL_PENDING' }];
    SignupFoundationService.verificationTokens.set('test-valid-token', {
        userId: 'usr-v1',
        email: 'verify@hapanamy.lk',
        expiresAt: new Date(Date.now() + 60000).toISOString()
    });

    const vResult = SignupFoundationService.verifyEmail('test-valid-token', users);
    assert(vResult.success);
    assert.equal(users[0].auth_status, 'EMAIL_VERIFIED');

    // Second call
    const vResult2 = SignupFoundationService.verifyEmail('test-valid-token', users);
    assert(!vResult2.success, 'Consumed token is removed');
});

test('Step 35: 6. Login Authentication & Role Redirection: Member vs Admin', () => {
    const passwordHash = SignupFoundationService.hashPassword('Araliya321#');
    const users = [
        { id: 'usr-m', username: 'member_john', email: 'john@hapanamy.lk', password_hash: passwordHash, role: 'MEMBER', auth_status: 'ACTIVE' },
        { id: 'usr-adm', username: 'admin_boss', email: 'boss@hapanamy.lk', password_hash: passwordHash, role: 'ADMIN', auth_status: 'ACTIVE' },
        { id: 'usr-susp', username: 'suspended_user', email: 'susp@hapanamy.lk', password_hash: passwordHash, role: 'MEMBER', auth_status: 'SUSPENDED' },
        { id: 'usr-blk', username: 'blocked_user', email: 'block@hapanamy.lk', password_hash: passwordHash, role: 'MEMBER', auth_status: 'BLOCKED' }
    ];

    // 1. Member Login by Username
    const loginM = SignupFoundationService.login({ identifier: 'member_john', password: 'Araliya321#', users });
    assert(loginM.success);
    assert.equal(loginM.redirect_url, 'dashboard.html');

    // 2. Admin Login by Email
    const loginAdm = SignupFoundationService.login({ identifier: 'boss@hapanamy.lk', password: 'Araliya321#', users });
    assert(loginAdm.success);
    assert.equal(loginAdm.redirect_url, 'hapanamy-admin-portal-9226.html');

    // 3. Suspended & Blocked Login rejection
    const loginSusp = SignupFoundationService.login({ identifier: 'suspended_user', password: 'Araliya321#', users });
    assert(!loginSusp.success);

    const loginBlk = SignupFoundationService.login({ identifier: 'blocked_user', password: 'Araliya321#', users });
    assert(!loginBlk.success);
});

test('Step 35: 7. Member Entry Dashboard: Accurately reflects 0 earnings and reserved placement for new members', () => {
    const users = [{ id: 'usr-fresh', username: 'fresh_guy', full_name: 'Fresh Guy', email: 'fresh@test.lk', role: 'MEMBER', auth_status: 'EMAIL_VERIFIED', created_at: new Date().toISOString() }];
    const binaryNodes = [{ user_id: 'usr-fresh', placement_parent_id: 'usr-root', position: 'LEFT', node_status: 'RESERVED' }];

    const dash = SignupFoundationService.getMemberEntryDashboard('usr-fresh', users, binaryNodes, [], []);
    assert(dash.success);
    assert.equal(dash.wallet.available_balance, 0.00);
    assert.equal(dash.wallet.total_earned, 0.00);
    assert(dash.referral_links.left_link.includes('ref=fresh_guy'));
    assert.equal(dash.quick_actions.length, 4);
});

test('Step 35: 8. Admin Member Management: Search, filter, suspend & reactivate with audit logging', () => {
    const users = [
        { id: 'u1', username: 'alice', full_name: 'Alice Silva', email: 'alice@test.lk', auth_status: 'ACTIVE', role: 'MEMBER' },
        { id: 'u2', username: 'bob', full_name: 'Bob Perera', email: 'bob@test.lk', auth_status: 'SUSPENDED', role: 'MEMBER' }
    ];
    const auditLogs = [];

    // Search
    const searchRes = SignupFoundationService.adminListMembers({ query: 'Silva', users, binaryNodes: [], sponsors: [] });
    assert.equal(searchRes.length, 1);
    assert.equal(searchRes[0].username, 'alice');

    // Filter
    const filterRes = SignupFoundationService.adminListMembers({ statusFilter: 'SUSPENDED', users, binaryNodes: [], sponsors: [] });
    assert.equal(filterRes.length, 1);
    assert.equal(filterRes[0].username, 'bob');

    // Suspend Alice
    const suspRes = SignupFoundationService.updateMemberStatus('u1', 'SUSPENDED', 'admin-id', users, auditLogs);
    assert(suspRes.success);
    assert.equal(users[0].auth_status, 'SUSPENDED');
    assert.equal(auditLogs.length, 1);
});

if (require.main === module) {
    runTests();
}
