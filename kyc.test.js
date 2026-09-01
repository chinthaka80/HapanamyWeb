// Hapanamy KYC & Bank Account Unit Tests
const testRunner = require('./test-runner');
const KycService = require('../services/kyc-service');

let kycDocs = [];
let bankAccounts = [];
let auditLogs = [];

before(() => {
    kycDocs = [];
    bankAccounts = [];
    auditLogs = [];
});

test('Valid KYC submission data verification', () => {
    const payload = {
        fullName: 'Chinthaka Rajapaksha',
        nicPassport: '951234567V',
        dob: '1995-05-12',
        address: 'No 45, Kandy Rd, Colombo',
        bankName: 'BOC',
        branchName: 'Kollupitiya',
        accountHolderName: 'Chinthaka Rajapaksha',
        accountNumber: '88123456'
    };

    const isValid = KycService.isValidSubmission(payload);
    assert(isValid, 'Proper payload must pass validation');

    const invalidPayload = { ...payload, nicPassport: '' };
    const isInvalid = KycService.isValidSubmission(invalidPayload);
    assert(!isInvalid, 'Payload with missing fields must fail validation');
});

test('KYC submission logs a submit event in audit logs', () => {
    const userId = 'user-uuid-abc';
    const kycId = 'kyc-uuid-123';
    
    // Log submission action
    KycService.logAction(auditLogs, userId, 'KYC_SUBMITTED', 'kyc_documents', kycId, null, { status: 'PENDING' });
    
    const log = auditLogs.find(l => l.action === 'KYC_SUBMITTED' && l.user_id === userId);
    assert(log, 'Audit log must record the KYC submission event');
    assert.equal(log.entity_type, 'kyc_documents');
});

test('KYC approval logs approved event with reviewer id', () => {
    const userId = 'user-uuid-abc';
    const reviewerId = 'admin-uuid-999';
    const kycId = 'kyc-uuid-123';

    // Log approval
    KycService.logAction(auditLogs, reviewerId, 'KYC_APPROVED', 'kyc_documents', kycId, { status: 'PENDING' }, { status: 'VERIFIED' });
    
    const log = auditLogs.find(l => l.action === 'KYC_APPROVED' && l.user_id === reviewerId);
    assert(log, 'Audit log must record the KYC approval event by admin');
    assert.equal(log.old_values.status, 'PENDING');
    assert.equal(log.new_values.status, 'VERIFIED');
});

test('KYC rejection logs rejected event with notes/reason', () => {
    const userId = 'user-uuid-abc';
    const reviewerId = 'admin-uuid-999';
    const kycId = 'kyc-uuid-123';

    // Log rejection
    KycService.logAction(auditLogs, reviewerId, 'KYC_REJECTED', 'kyc_documents', kycId, { status: 'PENDING' }, { status: 'REJECTED', notes: 'Blurred image' });
    
    const log = auditLogs.find(l => l.action === 'KYC_REJECTED' && l.user_id === reviewerId);
    assert(log, 'Audit log must record the KYC rejection event by admin');
    assert.equal(log.new_values.notes, 'Blurred image');
});

test('Bank account changes record audit entries with old and new account numbers', () => {
    const userId = 'user-uuid-abc';
    const bankAccountId = 'bank-uuid-456';
    
    // Bank account added
    KycService.logAction(auditLogs, userId, 'BANK_ADDED', 'bank_accounts', bankAccountId, null, { accountNumber: '88123456' });
    
    // Bank account changed
    KycService.logAction(auditLogs, userId, 'BANK_CHANGED', 'bank_accounts', bankAccountId, { accountNumber: '88123456' }, { accountNumber: '99887766' });

    const logAdd = auditLogs.find(l => l.action === 'BANK_ADDED');
    const logChange = auditLogs.find(l => l.action === 'BANK_CHANGED');

    assert(logAdd, 'Audit log must record BANK_ADDED');
    assert(logChange, 'Audit log must record BANK_CHANGED');
    assert.equal(logChange.old_values.accountNumber, '88123456');
    assert.equal(logChange.new_values.accountNumber, '99887766');
});

if (require.main === module) {
    runTests();
}
