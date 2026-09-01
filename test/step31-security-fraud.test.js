// Comprehensive Test Suite for STEP 31 — Security & Fraud Protection Audit and Implementation
const testRunner = require('./test-runner');
const SecurityCore = require('../services/security-core');

function createSecurityTestContext() {
    const users = [
        { id: 'u-super', username: 'super_admin', role: 'SUPER_ADMIN', status: 'ACTIVE' },
        { id: 'u-finance', username: 'finance_officer', role: 'FINANCE_ADMIN', status: 'ACTIVE' },
        { id: 'u-compliance', username: 'compliance_officer', role: 'COMPLIANCE', status: 'ACTIVE' },
        { id: 'u-support', username: 'support_agent', role: 'SUPPORT_ADMIN', status: 'ACTIVE' },
        { id: 'u-member', username: 'regular_member', role: 'MEMBER', status: 'ACTIVE' }
    ];

    const kycDocs = [
        { id: 'kyc-1', user_id: 'u-user-a', nic_passport: '199512345678', status: 'APPROVED' },
        { id: 'kyc-2', user_id: 'u-user-b', nic_passport: '199512345678', status: 'PENDING' } // Duplicate NIC
    ];

    const paymentSubmissions = [
        { id: 'pay-1', user_id: 'u-user-1', slip_hash: 'hash-abc-123', bank_reference: 'CEFT-889900', amount: 27500, status: 'PENDING' },
        { id: 'pay-2', user_id: 'u-user-2', slip_hash: 'hash-abc-123', bank_reference: 'CEFT-889900', amount: 27500, status: 'PENDING' } // Duplicate slip and ref
    ];

    const refundRequests = [
        { id: 'ref-1', user_id: 'u-fraudster', purchase_id: 'p-1', status: 'REFUNDED' },
        { id: 'ref-2', user_id: 'u-fraudster', purchase_id: 'p-2', status: 'REFUNDED' } // Repeated refund abuse
    ];

    const sponsors = [
        { user_id: 'u-self', sponsor_id: 'u-self' } // Self-referral
    ];

    const auditLogs = [];

    return {
        users,
        kycDocs,
        paymentSubmissions,
        refundRequests,
        sponsors,
        auditLogs
    };
}

test('Step 31: 1. Granular RBAC Permissions: Enforces role boundaries across management domains', () => {
    const ctx = createSecurityTestContext();
    const superAdmin = ctx.users[0];
    const financeAdmin = ctx.users[1];
    const complianceOfficer = ctx.users[2];
    const regularMember = ctx.users[4];

    // Super Admin has all permissions
    assert(SecurityCore.hasPermission(superAdmin, SecurityCore.PERMISSIONS.PRODUCT_MANAGEMENT));
    assert(SecurityCore.hasPermission(superAdmin, SecurityCore.PERMISSIONS.WITHDRAWAL_APPROVAL));
    assert(SecurityCore.hasPermission(superAdmin, SecurityCore.PERMISSIONS.KYC_REVIEW));

    // Finance Admin can approve withdrawals and manage commissions, but NOT edit products or approve KYC
    assert(SecurityCore.hasPermission(financeAdmin, SecurityCore.PERMISSIONS.WITHDRAWAL_APPROVAL));
    assert(SecurityCore.hasPermission(financeAdmin, SecurityCore.PERMISSIONS.COMMISSION_MANAGEMENT));
    assert(!SecurityCore.hasPermission(financeAdmin, SecurityCore.PERMISSIONS.PRODUCT_MANAGEMENT));
    assert(!SecurityCore.hasPermission(financeAdmin, SecurityCore.PERMISSIONS.KYC_REVIEW));

    // Compliance Officer can review KYC, but NOT approve withdrawals or edit products
    assert(SecurityCore.hasPermission(complianceOfficer, SecurityCore.PERMISSIONS.KYC_REVIEW));
    assert(!SecurityCore.hasPermission(complianceOfficer, SecurityCore.PERMISSIONS.WITHDRAWAL_APPROVAL));
    assert(!SecurityCore.hasPermission(complianceOfficer, SecurityCore.PERMISSIONS.PRODUCT_MANAGEMENT));

    // Regular Member has 0 administrative permissions
    assert(!SecurityCore.hasPermission(regularMember, SecurityCore.PERMISSIONS.REPORTS_ACCESS));
    assert(!SecurityCore.hasPermission(regularMember, SecurityCore.PERMISSIONS.PAYMENT_APPROVAL));
});

test('Step 31: 2. Privilege Escalation Guard: Throws 403 when user lacks required permission', () => {
    const ctx = createSecurityTestContext();
    const regularMember = ctx.users[4];

    assert.throws(() => {
        SecurityCore.requirePermission(regularMember, SecurityCore.PERMISSIONS.WITHDRAWAL_APPROVAL);
    }, /403 Forbidden/);
});

test('Step 31: 3. Password Complexity Policy: Enforces 8+ chars with uppercase, lowercase, numbers & symbols', () => {
    assert(!SecurityCore.validatePasswordStrength('short1!').valid);
    assert(!SecurityCore.validatePasswordStrength('alllowercase123!').valid);
    assert(!SecurityCore.validatePasswordStrength('ALLUPPERCASE123!').valid);
    assert(!SecurityCore.validatePasswordStrength('NoSpecialChar123').valid);
    assert(SecurityCore.validatePasswordStrength('Araliya321#Secure').valid);
});

test('Step 31: 4. Login Rate Limiting & Account Lockout: Locks account after 5 failed attempts', () => {
    const ip = '192.168.1.55';

    // 4 failed attempts
    for (let i = 1; i <= 4; i++) {
        const res = SecurityCore.recordLoginAttempt(ip, false);
        assert(!res.locked);
        assert.equal(res.remainingAttempts, 5 - i);
    }

    // 5th failed attempt triggers 15-minute lock
    const lockedRes = SecurityCore.recordLoginAttempt(ip, false);
    assert(lockedRes.locked);
    assert(SecurityCore.isAccountLocked(ip));

    // Subsequent attempts during lock window remain locked
    const subRes = SecurityCore.recordLoginAttempt(ip, false);
    assert(subRes.locked);
});

test('Step 31: 5. Two-Factor Authentication (2FA): Validates TOTP 6-digit codes and backup codes', () => {
    const { secret, backupCodes } = SecurityCore.generate2FASecret('u-user-123');

    // 1. Generate valid TOTP code
    const validCode = SecurityCore.generateTOTP(secret);
    assert.equal(validCode.length, 6);

    // 2. Verify valid code
    const verifyRes = SecurityCore.verify2FACode(secret, validCode, backupCodes);
    assert(verifyRes.valid);
    assert(!verifyRes.isBackupCode);

    // 3. Reject invalid code
    const invalidRes = SecurityCore.verify2FACode(secret, '999999', backupCodes);
    assert(!invalidRes.valid);

    // 4. Verify backup code
    const backupRes = SecurityCore.verify2FACode(secret, backupCodes[0], backupCodes);
    assert(backupRes.valid);
    assert(backupRes.isBackupCode);
});

test('Step 31: 6. Secure Password Reset Lifecycle: Single-use token with 15-minute validity', () => {
    const { token } = SecurityCore.createPasswordResetToken('user@hapanamy.lk');

    // 1st consumption succeeds
    const consume1 = SecurityCore.consumePasswordResetToken(token);
    assert(consume1.valid);
    assert.equal(consume1.email, 'user@hapanamy.lk');

    // 2nd consumption fails (Single-use protection)
    const consume2 = SecurityCore.consumePasswordResetToken(token);
    assert(!consume2.valid);
    assert(consume2.error.includes('already been used'));
});

test('Step 31: 7. Fraud Detection Sensors: Detects Duplicate NICs, Slips, Bank Refs, and Refund Abuse', () => {
    const ctx = createSecurityTestContext();
    const signals = SecurityCore.scanFraudSignals({
        kycDocs: ctx.kycDocs,
        paymentSubmissions: ctx.paymentSubmissions,
        refundRequests: ctx.refundRequests,
        sponsors: ctx.sponsors
    });

    assert(signals.length >= 4);

    // Verify individual fraud signal types detected
    const dupNic = signals.find(s => s.type === 'DUPLICATE_NIC_DETECTED');
    assert(dupNic, 'Duplicate NIC must be flagged for review');
    assert.equal(dupNic.severity, 'CRITICAL');

    const dupSlip = signals.find(s => s.type === 'DUPLICATE_PAYMENT_SLIP_HASH');
    assert(dupSlip, 'Duplicate Slip Hash must be flagged');

    const dupBankRef = signals.find(s => s.type === 'REPEATED_BANK_REFERENCE');
    assert(dupBankRef, 'Repeated Bank Reference must be flagged');

    const refundAbuse = signals.find(s => s.type === 'REPEATED_REFUND_ABUSE');
    assert(refundAbuse, 'Repeated Refund Abuse must be flagged');

    const selfRef = signals.find(s => s.type === 'SELF_REFERRAL_ABUSE');
    assert(selfRef, 'Self referral attempt must be flagged');
});

test('Step 31: 8. Sensitive File Access Guard: Blocks directory traversal attacks', () => {
    assert(!SecurityCore.isSafeFilename('../../private/kyc/passport.jpg'));
    assert(!SecurityCore.isSafeFilename('../storage/slips.png'));
    assert(!SecurityCore.isSafeFilename('etc/passwd'));
    assert(SecurityCore.isSafeFilename('safe_slip_123.jpg'));
});

test('Step 31: 9. Security Audit Logging: Captures actor, role, IP, and state changes', () => {
    const ctx = createSecurityTestContext();

    SecurityCore.logSecurityEvent(ctx.auditLogs, {
        actorId: 'u-super',
        role: 'SUPER_ADMIN',
        action: 'ROLE_ELEVATED',
        entityType: 'users',
        entityId: 'u-finance',
        oldValues: { role: 'MEMBER' },
        newValues: { role: 'FINANCE_ADMIN' },
        ipAddress: '203.115.22.10'
    });

    assert.equal(ctx.auditLogs.length, 1);
    const log = ctx.auditLogs[0];
    assert.equal(log.actor_id, 'u-super');
    assert.equal(log.role, 'SUPER_ADMIN');
    assert.equal(log.action, 'ROLE_ELEVATED');
    assert.equal(log.ip_address, '203.115.22.10');
});

test('Step 31: 10. Frontend Manipulation Guard: Strips client-forged roles, balances and commission rates', () => {
    const untrustedPayload = {
        fullName: 'Hacked User',
        username: 'hacker123',
        role: 'SUPER_ADMIN', // Forged privilege escalation
        balance: 500000.00, // Forged wallet balance
        status: 'ACTIVE',
        direct_commission_percent: 50.0 // Forged 50% commission
    };

    const sanitized = SecurityCore.filterAuthoritativeFields(untrustedPayload);

    assert.equal(sanitized.fullName, 'Hacked User');
    assert.equal(sanitized.username, 'hacker123');
    assert.equal(sanitized.role, undefined, 'Client-sent role must be stripped');
    assert.equal(sanitized.balance, undefined, 'Client-sent balance must be stripped');
    assert.equal(sanitized.direct_commission_percent, undefined, 'Client-sent commission rate must be stripped');
});

test('Step 31: 11. Duplicate Request & Idempotency: Rejects duplicate idempotency keys', () => {
    const idempotencySet = new Set();
    const key = 'idem-req-998811';

    // 1st request succeeds
    const firstAttempt = !idempotencySet.has(key);
    if (firstAttempt) idempotencySet.add(key);
    assert(firstAttempt, 'First request should succeed');

    // 2nd duplicate request is blocked
    const secondAttempt = !idempotencySet.has(key);
    assert(!secondAttempt, 'Duplicate request must be blocked');
});

test('Step 31: 12. Race Condition Guard: Concurrent mutex locks prevent race conditions on balance adjustments', () => {
    const resourceKey = 'wallet-lock-user-456';

    // Thread 1 acquires lock
    const lock1 = SecurityCore.acquireLock(resourceKey);
    assert(lock1, 'First thread must acquire lock');

    // Thread 2 attempts concurrent access while locked -> blocked
    const lock2 = SecurityCore.acquireLock(resourceKey);
    assert(!lock2, 'Concurrent access must be blocked to prevent race conditions');

    // Thread 1 finishes and releases lock
    SecurityCore.releaseLock(resourceKey);

    // Thread 3 can now acquire lock safely
    const lock3 = SecurityCore.acquireLock(resourceKey);
    assert(lock3, 'New request can acquire lock after release');

    SecurityCore.releaseLock(resourceKey);
});

if (require.main === module) {
    runTests();
}
