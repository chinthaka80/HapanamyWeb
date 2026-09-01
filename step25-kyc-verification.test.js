// Comprehensive Test Suite for STEP 25 — KYC & Member Verification Engine
const testRunner = require('./test-runner');
const crypto = require('crypto');
const KycVerificationService = require('../services/kyc-verification-service');

function createSampleDoc(content = 'nic-front-image-content', fileName = 'nic_front.jpg') {
    const buffer = Buffer.from(content);
    return {
        fileName,
        mimeType: 'image/jpeg',
        fileSizeBytes: buffer.length,
        fileBuffer: buffer,
        fileHash: crypto.createHash('sha256').update(buffer).digest('hex')
    };
}

test('Step 25: 1. KYC Submission creates PENDING record with masked previews and private storage keys', () => {
    const kycList = [];
    const docFront = createSampleDoc('nic-front-bytes');
    const docBack = createSampleDoc('nic-back-bytes', 'nic_back.jpg');

    const res = KycVerificationService.submitKyc({
        userId: 'u-kyc-1',
        identityDocumentType: 'NIC',
        identityNumber: '199283746581',
        fullName: 'Nimal Silva',
        address: { street: '123 Main St', city: 'Colombo', postal_code: '00100' },
        bankDetails: {
            account_holder_name: 'Nimal Silva',
            bank_name: 'Commercial Bank',
            branch: 'Colombo 03',
            account_number: '8009876543'
        },
        documents: { front: docFront, back: docBack },
        kycList
    });

    assert(res.success);
    assert.equal(res.status, 'PENDING');
    assert.equal(kycList.length, 1);
    assert.equal(kycList[0].identity_number_masked, '********6581');
    assert.equal(kycList[0].bank_details.account_number_masked, '******6543');
    assert(kycList[0].documents.front_storage_key.startsWith('private/kyc/u-kyc-1/'));
});

test('Step 25: 2. Admin Review Workflow: startReview transitions status to UNDER_REVIEW', () => {
    const kycList = [{ id: 'kyc-rev-1', user_id: 'u-1', status: 'PENDING' }];

    const res = KycVerificationService.startReview({
        kycId: 'kyc-rev-1',
        adminUserId: 'admin-officer',
        kycList
    });

    assert(res.success);
    assert.equal(kycList[0].status, 'UNDER_REVIEW');
    assert.equal(kycList[0].reviewed_by, 'admin-officer');
});

test('Step 25: 3. Admin Approval: Transitions status to APPROVED and updates member status', () => {
    const kycList = [{ id: 'kyc-appr-1', user_id: 'u-appr', status: 'PENDING' }];
    const users = [{ id: 'u-appr', kyc_status: 'PENDING' }];

    const res = KycVerificationService.approveKyc({
        kycId: 'kyc-appr-1',
        adminUserId: 'admin-lead',
        adminNotes: 'NIC and Bank Passbook verified against electoral register.',
        kycList,
        users
    });

    assert(res.success);
    assert.equal(kycList[0].status, 'APPROVED');
    assert.equal(users[0].kyc_status, 'APPROVED');
    assert(users[0].kyc_verified_at);
});

test('Step 25: 4. Admin Rejection: Requires mandatory reason and records audit trail', () => {
    const kycList = [{ id: 'kyc-rej-1', user_id: 'u-rej', status: 'PENDING' }];
    const users = [{ id: 'u-rej', kyc_status: 'PENDING' }];

    // Rejection without reason fails
    assert.throws(() => {
        KycVerificationService.rejectKyc({
            kycId: 'kyc-rej-1',
            adminUserId: 'admin-lead',
            kycList,
            users
        });
    }, /Rejection reason is mandatory/);

    // Rejection with valid reason
    const res = KycVerificationService.rejectKyc({
        kycId: 'kyc-rej-1',
        rejectionReason: 'NIC photo is blurred and expired.',
        adminUserId: 'admin-lead',
        kycList,
        users
    });

    assert(res.success);
    assert.equal(kycList[0].status, 'REJECTED');
    assert.equal(kycList[0].rejection_reason, 'NIC photo is blurred and expired.');
    assert.equal(users[0].kyc_status, 'REJECTED');
});

test('Step 25: 5. Admin Correction Request: Transitions status to CORRECTION_REQUESTED', () => {
    const kycList = [{ id: 'kyc-corr-1', user_id: 'u-corr', status: 'PENDING' }];

    const res = KycVerificationService.requestCorrection({
        kycId: 'kyc-corr-1',
        correctionNotes: 'Please provide clear scan of back side of NIC.',
        adminUserId: 'admin-lead',
        kycList
    });

    assert(res.success);
    assert.equal(kycList[0].status, 'CORRECTION_REQUESTED');
    assert.equal(kycList[0].admin_notes, 'Please provide clear scan of back side of NIC.');
});

test('Step 25: 6. Private Document Access: Generates signed temporary token and logs access', () => {
    const kycList = [{
        id: 'kyc-sec-1',
        user_id: 'u-target-member',
        documents: {
            front_storage_key: 'private/kyc/u-target-member/kyc-sec-1/front.jpg'
        },
        status: 'PENDING'
    }];

    // 1. Authorized Admin Access
    const adminToken = KycVerificationService.generateDocumentAccessToken({
        kycId: 'kyc-sec-1',
        documentType: 'front',
        requestingUserId: 'admin-compliance',
        requestingRole: 'ADMIN',
        ipAddress: '192.168.1.50',
        kycList
    });

    assert(adminToken.success);
    assert(adminToken.signed_token);
    assert(adminToken.expires_at);

    // 2. Owner Member Access
    const ownerToken = KycVerificationService.generateDocumentAccessToken({
        kycId: 'kyc-sec-1',
        documentType: 'front',
        requestingUserId: 'u-target-member',
        requestingRole: 'MEMBER',
        ipAddress: '124.43.10.1',
        kycList
    });
    assert(ownerToken.success);
});

test('Step 25: 7. Unauthorized Access Guard: Blocks unauthorized members from other users documents', () => {
    const kycList = [{
        id: 'kyc-sec-2',
        user_id: 'u-target-member',
        documents: {
            front_storage_key: 'private/kyc/u-target-member/kyc-sec-2/front.jpg'
        },
        status: 'PENDING'
    }];

    // Unauthorized member u-other attempting to access u-target-member's documents
    assert.throws(() => {
        KycVerificationService.generateDocumentAccessToken({
            kycId: 'kyc-sec-2',
            documentType: 'front',
            requestingUserId: 'u-other-member',
            requestingRole: 'MEMBER',
            kycList
        });
    }, /403 Forbidden/);
});

test('Step 25: 8. Historical KYC Decision Tracking: Preserves past submissions upon re-submission', () => {
    const kycList = [];
    const historyList = [];

    // 1. First Submission (Rejected)
    KycVerificationService.submitKyc({
        userId: 'u-history-user',
        identityNumber: '199011223344',
        fullName: 'Kamal Bandara',
        bankDetails: { bank_name: 'BOC', account_number: '123456789' },
        kycList,
        historyList
    });
    const firstKycId = kycList[0].id;
    KycVerificationService.rejectKyc({ kycId: firstKycId, rejectionReason: 'Old NIC format invalid', kycList });

    // 2. Second Submission (Re-submission)
    KycVerificationService.submitKyc({
        userId: 'u-history-user',
        identityNumber: '199011223344V',
        fullName: 'Kamal Bandara',
        bankDetails: { bank_name: 'BOC', account_number: '123456789' },
        kycList,
        historyList
    });

    const history = KycVerificationService.getMemberKycHistory('u-history-user', kycList, historyList);
    assert.equal(history.current_status, 'PENDING');
    assert.equal(history.past_submissions.length, 1, 'Past rejected submission preserved in history');
    assert.equal(history.past_submissions[0].rejection_reason, 'Old NIC format invalid');
});

if (require.main === module) {
    runTests();
}
