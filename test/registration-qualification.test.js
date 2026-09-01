// Unit Tests for Phase 3: Member Registration & Qualification Engine
const testRunner = require('./test-runner');
const KycService = require('../services/kyc-service');

test('Phase 3: Registration payload validator enforces all required personal, KYC and Bank fields', () => {
    const completePayload = {
        fullName: 'Nimal Bandara',
        username: 'nimal_b',
        email: 'nimal@hapanamy.lk',
        mobile: '0712345678',
        password: 'Password123#',
        sponsorCode: 'kasun_t',
        position: 'LEFT',
        nicPassport: '199512345678',
        address: 'No. 45, Temple Road, Kandy',
        accountHolderName: 'Nimal Bandara',
        bankName: 'Commercial Bank',
        branchName: 'Kandy City',
        accountNumber: '8010482910'
    };

    const validResult = KycService.validateRegistrationPayload(completePayload);
    assert(validResult.valid, 'Complete registration payload should be valid');

    // Test missing bank details
    const invalidBank = { ...completePayload, bankName: '' };
    const invalidBankResult = KycService.validateRegistrationPayload(invalidBank);
    assert(!invalidBankResult.valid, 'Missing bank details must fail validation');

    // Test missing KYC details
    const invalidKyc = { ...completePayload, nicPassport: '' };
    const invalidKycResult = KycService.validateRegistrationPayload(invalidKyc);
    assert(!invalidKycResult.valid, 'Missing NIC/Passport must fail validation');
});

test('Phase 3: KYC Lifecycle transitions (PENDING -> APPROVED / REJECTED) with audit logging', () => {
    const kycDoc = {
        id: 'kyc-doc-101',
        user_id: 'user-201',
        nic_passport: '199812345678',
        status: 'PENDING',
        created_at: new Date().toISOString()
    };
    const auditLogs = [];

    // Admin approves KYC
    KycService.transitionKycStatus(kycDoc, 'APPROVED', 'admin-1', 'NIC and Bank verified', auditLogs);
    assert.equal(kycDoc.status, 'APPROVED', 'Status should transition to APPROVED');
    assert.equal(kycDoc.reviewer_id, 'admin-1');
    assert.equal(auditLogs.length, 1, 'Audit log should record approved event');
    assert.equal(auditLogs[0].action, 'KYC_APPROVED');

    // Admin rejects KYC with reasons
    KycService.transitionKycStatus(kycDoc, 'REJECTED', 'admin-1', 'Blurry NIC photo. Please re-upload.', auditLogs);
    assert.equal(kycDoc.status, 'REJECTED', 'Status should transition to REJECTED');
    assert.equal(kycDoc.review_notes, 'Blurry NIC photo. Please re-upload.');
    assert.equal(auditLogs.length, 2, 'Audit log should record rejected event');
    assert.equal(auditLogs[1].action, 'KYC_REJECTED');
});

test('Phase 3: Member qualification evaluator enforces KYC approval, purchase, and active 1-Left + 1-Right directs', () => {
    const userId = 'user-qual-1';

    const kycApproved = [{ user_id: userId, status: 'APPROVED' }];
    const kycPending = [{ user_id: userId, status: 'PENDING' }];

    const userPurchases = [{ user_id: userId, status: 'ACTIVE' }];
    const downlinePurchases = [
        { user_id: 'downline-l', status: 'ACTIVE' },
        { user_id: 'downline-r', status: 'ACTIVE' }
    ];
    const allPurchases = [...userPurchases, ...downlinePurchases];

    const sponsors = [
        { user_id: 'downline-l', sponsor_id: userId },
        { user_id: 'downline-r', sponsor_id: userId }
    ];

    const binaryNodes = [
        { user_id: userId, placement_parent_id: null, position: null },
        { user_id: 'downline-l', placement_parent_id: userId, position: 'LEFT' },
        { user_id: 'downline-r', placement_parent_id: userId, position: 'RIGHT' }
    ];

    // 1. Fully qualified member
    const fullyQualified = KycService.evaluateQualification(userId, kycApproved, allPurchases, sponsors, binaryNodes);
    assert(fullyQualified.is_qualified, 'Member with approved KYC, active purchase and active L+R directs must be qualified');
    assert(fullyQualified.left_direct_active, 'Left direct must be active');
    assert(fullyQualified.right_direct_active, 'Right direct must be active');
    assert.equal(fullyQualified.unqualified_reasons.length, 0, 'Qualified member should have zero unqualified reasons');

    // 2. Member with PENDING KYC should NOT be qualified
    const pendingKycResult = KycService.evaluateQualification(userId, kycPending, allPurchases, sponsors, binaryNodes);
    assert(!pendingKycResult.is_qualified, 'Pending KYC member cannot be qualified');
    assert(pendingKycResult.unqualified_reasons.some(r => r.includes('Requires APPROVED')));

    // 3. Member with missing RIGHT direct purchase should NOT be qualified
    const purchasesWithoutRight = [userPurchases[0], { user_id: 'downline-l', status: 'ACTIVE' }];
    const missingRightResult = KycService.evaluateQualification(userId, kycApproved, purchasesWithoutRight, sponsors, binaryNodes);
    assert(!missingRightResult.is_qualified, 'Missing right active direct member cannot be qualified');
    assert(missingRightResult.unqualified_reasons.some(r => r.includes('RIGHT')));
});

if (require.main === module) {
    runTests();
}
