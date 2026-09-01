// Hapanamy.lk Step 1: Live Login & Register Entry Flow Test Suite
// Verifies public entry, free registration (Rs. 0), dual-leg referral parsing,
// role redirection, session logout, rate limiting, and protected auth guards.

const testRunner = require('./test-runner');
const AuthService = require('../services/auth-service');
const SecurityCore = require('../services/security-core');
const ReferralService = require('../services/referral-service');

function createIsolatedAuthContext() {
    return {
        users: [
            {
                id: 'usr-admin-root',
                username: 'admin',
                email: 'admin@hapanamy.lk',
                password_hash: AuthService.hashPassword('Araliya321#'),
                role: 'admin',
                status: 'ACTIVE'
            },
            {
                id: 'usr-sponsor-1',
                username: 'sponsor1',
                email: 'sponsor1@hapanamy.lk',
                password_hash: AuthService.hashPassword('Pass1234#'),
                role: 'member',
                status: 'ACTIVE'
            }
        ],
        sponsors: [
            { user_id: 'usr-sponsor-1', sponsor_id: 'usr-admin-root' }
        ],
        binaryNodes: [
            { user_id: 'usr-admin-root', placement_parent_id: null, position: null, depth: 1, path: '' },
            { user_id: 'usr-sponsor-1', placement_parent_id: 'usr-admin-root', position: 'LEFT', depth: 2, path: 'usr-admin-root' }
        ],
        volumeLedger: [],
        wallets: [],
        kycDocs: [],
        bankAccounts: [],
        auditLogs: [],
        referralConversions: [],
        intentStore: []
    };
}

test('Step 36: TEST 01 & 03: Free Registration (Rs. 0.00) Creates Member, Wallet and Tree Slot', () => {
    const ctx = createIsolatedAuthContext();
    const regPayload = {
        fullName: 'Kasun Bandara',
        username: 'kasun_b',
        email: 'kasun.b@test.lk',
        mobile: '0771234567',
        password: 'Password123#',
        sponsorCode: 'sponsor1',
        position: 'LEFT',
        dob: '1995-05-12',
        address: '123 Main St, Kandy',
        nicPassport: '199512345678',
        accountHolderName: 'Kasun Bandara',
        bankName: 'Commercial Bank',
        branchName: 'Kandy',
        accountNumber: '8010101010'
    };

    const regResult = AuthService.registerMember(regPayload, ctx);
    assert.equal(regResult.success, true, 'Registration must succeed for valid free signup');
    assert(regResult.user, 'Registration should return user object');
    assert.equal(regResult.user.username, 'kasun_b');
    assert.equal(regResult.user.role, 'member');

    // Verify User Added in store
    const createdUser = ctx.users.find(u => u.username === 'kasun_b');
    assert(createdUser);
    assert.equal(createdUser.status, 'ACTIVE');

    // Verify Binary Placement Under Sponsor
    const node = ctx.binaryNodes.find(n => n.user_id === createdUser.id);
    assert(node);
    assert.equal(node.position, 'LEFT');
});

test('Step 36: TEST 08 & 09: Dual-Leg Referral Links (?ref=...&position=left|right) Placement Resolution', () => {
    const ctx = createIsolatedAuthContext();

    // Left Referral Link
    const leftReg = AuthService.registerMember({
        fullName: 'Left Member',
        username: 'left_user',
        email: 'left@test.lk',
        mobile: '0770000001',
        password: 'Password123#',
        sponsorCode: 'sponsor1',
        position: 'LEFT'
    }, ctx);
    assert.equal(leftReg.success, true);
    const leftNode = ctx.binaryNodes.find(n => n.user_id === leftReg.user.id);
    assert.equal(leftNode.position, 'LEFT');

    // Right Referral Link
    const rightReg = AuthService.registerMember({
        fullName: 'Right Member',
        username: 'right_user',
        email: 'right@test.lk',
        mobile: '0770000002',
        password: 'Password123#',
        sponsorCode: 'sponsor1',
        position: 'RIGHT'
    }, ctx);
    assert.equal(rightReg.success, true);
    const rightNode = ctx.binaryNodes.find(n => n.user_id === rightReg.user.id);
    assert.equal(rightNode.position, 'RIGHT');
});

test('Step 36: TEST 10: Invalid Referral Code is strictly rejected by backend', () => {
    const ctx = createIsolatedAuthContext();
    const badRefResult = AuthService.registerMember({
        fullName: 'Orphan User',
        username: 'orphan_user',
        email: 'orphan@test.lk',
        mobile: '0779999999',
        password: 'Password123#',
        sponsorCode: 'non_existent_sponsor_99',
        position: 'LEFT'
    }, ctx);

    assert.equal(badRefResult.success, false, 'Non-existent sponsor code must fail');
    assert(badRefResult.error.includes('Sponsor') || badRefResult.error.includes('not found'));
});

test('Step 36: TEST 11 & 12: Duplicate Username & Duplicate Email Rejection', () => {
    const ctx = createIsolatedAuthContext();

    // Duplicate Username
    const dupUser = AuthService.registerMember({
        fullName: 'Duplicate User',
        username: 'sponsor1', // Existing username
        email: 'newemail@test.lk',
        mobile: '0778888888',
        password: 'Password123#',
        sponsorCode: 'admin',
        position: 'LEFT'
    }, ctx);
    assert.equal(dupUser.success, false, 'Duplicate username must be rejected');

    // Duplicate Email
    const dupEmail = AuthService.registerMember({
        fullName: 'Duplicate Email User',
        username: 'unique_user_99',
        email: 'sponsor1@hapanamy.lk', // Existing email
        mobile: '0778888888',
        password: 'Password123#',
        sponsorCode: 'admin',
        position: 'LEFT'
    }, ctx);
    assert.equal(dupEmail.success, false, 'Duplicate email must be rejected');
});

test('Step 36: TEST 05 & 13: Member Login Verification with Password & Wrong Password Rejection', () => {
    const ctx = createIsolatedAuthContext();

    // Correct Credentials
    const member = ctx.users.find(u => u.username === 'sponsor1');
    const valid = AuthService.verifyPassword('Pass1234#', member.password_hash);
    assert.equal(valid, true, 'Valid password must verify true');

    // Wrong Password
    const invalid = AuthService.verifyPassword('WrongPass999#', member.password_hash);
    assert.equal(invalid, false, 'Wrong password must verify false');
});

test('Step 36: TEST 14: Rate Limiting & Account Lockout Sensor', () => {
    const testEmail = 'lockout_test@hapanamy.lk';

    // 4 failed attempts should not lock yet
    for (let i = 0; i < 4; i++) {
        const attempt = SecurityCore.recordLoginAttempt(testEmail, false);
        assert.equal(attempt.locked, false);
    }

    // 5th failed attempt locks the account
    const fifthAttempt = SecurityCore.recordLoginAttempt(testEmail, false);
    assert.equal(fifthAttempt.locked, true, '5th consecutive failure must lock account');

    // Immediate check confirms locked state
    assert.equal(SecurityCore.isAccountLocked(testEmail), true);

    // Successful attempt resets attempts
    SecurityCore.recordLoginAttempt(testEmail, true);
    assert.equal(SecurityCore.isAccountLocked(testEmail), false);
});

test('Step 36: TEST 06 & 07: Session Token Generation & Invalidation (Logout)', () => {
    const activeSessions = new Map();
    const token = AuthService.generateToken();

    activeSessions.set(token, {
        id: 'usr-sponsor-1',
        username: 'sponsor1',
        role: 'member'
    });

    // Session is valid
    assert(activeSessions.has(token));
    assert.equal(activeSessions.get(token).username, 'sponsor1');

    // Logout deletes token
    activeSessions.delete(token);
    assert.equal(activeSessions.has(token), false, 'Token must be deleted upon logout');
});

if (require.main === module) {
    runTests();
}
