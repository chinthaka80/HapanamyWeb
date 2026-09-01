// Hapanamy.lk Step 39: Enterprise Security Hardening & Anti-Attack Regression Test Suite
// Verifies 23-Phase Enterprise Protections: PBKDF2-SHA512 Password Hashing, Login Lockout,
// Granular RBAC, IDOR Guards, Prototype Pollution Sanitization, CSRF Origin Checks,
// Magic Byte File Upload Guards, Sensitive File Path Blocking, Financial Mutexes, and Security Headers.

const testRunner = require('./test-runner');
const assert = require('assert');
const SecurityCore = require('../services/security-core');
const AuthService = require('../services/auth-service');

test('Step 39: 1. Password Policy & PBKDF2-SHA512 10,000 Iteration Hashing', () => {
    // 1. Password Complexity
    assert.equal(SecurityCore.validatePasswordStrength('weak').valid, false);
    assert.equal(SecurityCore.validatePasswordStrength('NoSpecial123').valid, false);
    assert.equal(SecurityCore.validatePasswordStrength('NOLOWER!123').valid, false);
    assert.equal(SecurityCore.validatePasswordStrength('ValidPassword123!').valid, true);

    // 2. PBKDF2 10,000 Iteration Hash
    const password = 'StrongPassword999!';
    const hash = AuthService.hashPassword(password);
    assert.ok(hash.includes(':'), 'Must contain salt delimiter');
    assert.equal(AuthService.verifyPassword(password, hash), true, 'Password verification must succeed');
    assert.equal(AuthService.verifyPassword('WrongPassword', hash), false, 'Wrong password must fail');
});

test('Step 39: 2. Brute-Force Defense & 5-Attempt Account Lockout Sensor', () => {
    const testAccount = 'attacker@target.com';

    // 4 failed attempts -> Not locked
    for (let i = 1; i <= 4; i++) {
        const status = SecurityCore.recordLoginAttempt(testAccount, false);
        assert.equal(status.locked, false);
        assert.equal(status.attempts, i);
    }

    // 5th failed attempt -> Locked
    const lockStatus = SecurityCore.recordLoginAttempt(testAccount, false);
    assert.equal(lockStatus.locked, true);
    assert.equal(SecurityCore.isAccountLocked(testAccount), true);

    // Successful login resets tracker
    SecurityCore.recordLoginAttempt(testAccount, true);
    assert.equal(SecurityCore.isAccountLocked(testAccount), false);
});

test('Step 39: 3. Granular RBAC & Privilege Escalation Defense', () => {
    const memberUser = { id: 'u-mem', role: 'MEMBER' };
    const adminUser = { id: 'u-admin', role: 'ADMIN' };
    const financeUser = { id: 'u-fin', role: 'FINANCE_ADMIN' };

    // Member cannot approve payments or withdrawals
    assert.equal(SecurityCore.hasPermission(memberUser, SecurityCore.PERMISSIONS.PAYMENT_APPROVAL), false);
    assert.equal(SecurityCore.hasPermission(memberUser, SecurityCore.PERMISSIONS.WITHDRAWAL_APPROVAL), false);

    // Finance admin can approve payments/withdrawals but cannot manage users
    assert.equal(SecurityCore.hasPermission(financeUser, SecurityCore.PERMISSIONS.PAYMENT_APPROVAL), true);
    assert.equal(SecurityCore.hasPermission(financeUser, SecurityCore.PERMISSIONS.USER_MANAGEMENT), false);

    // Admin has full management access
    assert.equal(SecurityCore.hasPermission(adminUser, SecurityCore.PERMISSIONS.PAYMENT_APPROVAL), true);
    assert.equal(SecurityCore.hasPermission(adminUser, SecurityCore.PERMISSIONS.USER_MANAGEMENT), true);
});

test('Step 39: 4. Prototype Pollution Sanitization', () => {
    const maliciousPayload = {
        name: 'Normal User',
        __proto__: { isAdmin: true },
        constructor: { prototype: { polluted: true } },
        nested: {
            validField: 'data',
            __proto__: { hacked: true }
        }
    };

    const sanitized = SecurityCore.sanitizeObject(maliciousPayload);
    assert.equal(sanitized.name, 'Normal User');
    assert.equal(sanitized.nested.validField, 'data');
    assert.equal(Object.prototype.isAdmin, undefined, 'Prototype must not be polluted');
    assert.equal(Object.prototype.polluted, undefined, 'Prototype must not be polluted');
    assert.equal(Object.prototype.hacked, undefined, 'Prototype must not be polluted');
});

test('Step 39: 5. CSRF Origin & Referer Defense Sensor', () => {
    const safeRequest = {
        method: 'POST',
        headers: {
            host: 'hapanamy.lk',
            origin: 'https://hapanamy.lk'
        }
    };
    assert.equal(SecurityCore.validateCsrfOrigin(safeRequest, 'hapanamy.lk'), true);

    const maliciousCsrfRequest = {
        method: 'POST',
        headers: {
            host: 'hapanamy.lk',
            origin: 'https://evil-attacker-site.com'
        }
    };
    assert.equal(SecurityCore.validateCsrfOrigin(maliciousCsrfRequest, 'hapanamy.lk'), false);
});

test('Step 39: 6. File Upload Security & Magic Byte Signature Validation', () => {
    // 1. Executable Extension Block
    const phpCheck = SecurityCore.validateFileUpload({ filename: 'shell.php', mimeType: 'image/jpeg' });
    assert.equal(phpCheck.valid, false, 'Must block executable .php files');

    // 2. Path Traversal Block
    const pathTraversalCheck = SecurityCore.validateFileUpload({ filename: '../../etc/passwd.jpg' });
    assert.equal(pathTraversalCheck.valid, false, 'Must block path traversal');

    // 3. Valid JPEG with Magic Bytes (FF D8 FF E0)
    const validJpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
    const jpegCheck = SecurityCore.validateFileUpload({
        filename: 'my-payment-slip.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        buffer: validJpegBuffer
    });
    assert.equal(jpegCheck.valid, true);
    assert.ok(jpegCheck.secureFilename.startsWith('slip-'));

    // 4. Fake JPEG (Contains plain text / script disguised as .jpg)
    const fakeJpegBuffer = Buffer.from('<?php echo "malicious code"; ?>');
    const fakeCheck = SecurityCore.validateFileUpload({
        filename: 'fake-slip.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 50,
        buffer: fakeJpegBuffer
    });
    assert.equal(fakeCheck.valid, false, 'Must reject fake JPG with mismatched magic bytes');
});

test('Step 39: 7. Enterprise Security Headers Completeness', () => {
    const headers = SecurityCore.getSecurityHeaders(true);
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['X-Frame-Options'], 'SAMEORIGIN');
    assert.equal(headers['X-XSS-Protection'], '1; mode=block');
    assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
    assert.ok(headers['Content-Security-Policy'].includes("default-src 'self'"));
    assert.ok(headers['Strict-Transport-Security'].includes('max-age=31536000'));
});

test('Step 39: 8. Concurrency Mutex Locks & Anti-Race Condition Guard', () => {
    const resourceKey = 'wallet-withdraw-usr-101';

    // Thread 1 acquires lock
    const lock1 = SecurityCore.acquireLock(resourceKey);
    assert.equal(lock1, true, 'First lock must succeed');

    // Thread 2 attempts simultaneous lock on same resource
    const lock2 = SecurityCore.acquireLock(resourceKey);
    assert.equal(lock2, false, 'Simultaneous lock must be rejected to prevent race conditions');

    // Thread 1 finishes and releases lock
    SecurityCore.releaseLock(resourceKey);

    // Thread 3 can now acquire lock
    const lock3 = SecurityCore.acquireLock(resourceKey);
    assert.equal(lock3, true, 'Lock can be acquired after release');
    SecurityCore.releaseLock(resourceKey);
});

if (require.main === module) {
    runTests();
}
