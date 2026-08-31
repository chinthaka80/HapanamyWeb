// Hapanamy Security & Anti-Fraud Core Unit Tests
const testRunner = require('./test-runner');
const SecurityCore = require('../services/security-core');

test('Rate limiter blocks IP exceeding request frequency limits', () => {
    const ipAddress = '192.168.1.50';
    let limited = false;

    // Hit rate limit 5 times max
    for (let i = 0; i < 10; i++) {
        limited = SecurityCore.isRateLimited(ipAddress, 5);
    }

    assert(limited, 'IP hitting over the limit of 5 requests must get blocked');
});

test('XSS input sanitization escapes HTML scripts tags', () => {
    const scriptInput = '<script>alert("hack")</script>';
    const sanitized = SecurityCore.sanitizeInput(scriptInput);
    
    assert(!sanitized.includes('<script>'), 'HTML script elements must be escaped');
    assert(sanitized.includes('&lt;script&gt;'), 'Sanitized text should contain escaped entities');
});

test('Path traversal validation blocks directory traversal payloads', () => {
    const maliciousFilename = '../../etc/passwd';
    const check = SecurityCore.isSafeFilename(maliciousFilename);

    assert(!check, 'Directory traversal path payloads must be blocked');
});

test('Fraud indicator flags duplicate NICs across profiles', () => {
    const userPayload = { nicPassport: '990234123V', accountNumber: '121020491823' };
    
    const kycDocs = [
        { nic_passport: '990234123V' },
        { nic_passport: '990234123V' } // Duplicate
    ];
    const bankAccounts = [];

    const alerts = SecurityCore.detectFraudAlerts(userPayload, kycDocs, bankAccounts);
    assert(alerts.length > 0, 'Should trigger duplicate NIC fraud alert');
    assert.equal(alerts[0].type, 'SUSPICIOUS_DUPLICATE_NIC');
});

if (require.main === module) {
    runTests();
}
