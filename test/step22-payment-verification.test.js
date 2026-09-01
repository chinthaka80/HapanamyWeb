// Comprehensive Test Suite for STEP 22 — Bank Deposit & Payment Verification Engine
const testRunner = require('./test-runner');
const crypto = require('crypto');
const PaymentVerificationService = require('../services/payment-verification-service');

function createSampleSlipFile(content = 'slip-image-mock-data-1', fileName = 'bank_slip.jpg', mimeType = 'image/jpeg') {
    const buffer = Buffer.from(content);
    return {
        fileName,
        mimeType,
        fileSizeBytes: buffer.length,
        fileBuffer: buffer,
        fileHash: crypto.createHash('sha256').update(buffer).digest('hex')
    };
}

test('Step 22: 1. Valid payment submission creates PENDING payment with slip hash and storage key', () => {
    const existingPayments = [];
    const slipFile = createSampleSlipFile('slip-1-bytes');

    const res = PaymentVerificationService.submitPayment({
        userId: 'u-member-1',
        productId: 'prod-social-media',
        amount: 27500.00,
        transferReference: 'TXN-COMBANK-991823',
        transferDate: '2026-09-01',
        transferTime: '11:45',
        bankName: 'Commercial Bank of Ceylon',
        slipFile,
        existingPayments
    });

    assert(res.success);
    assert.equal(res.status, 'PENDING');
    assert(!res.flagged_for_review);
    assert.equal(existingPayments.length, 1);
    assert.equal(existingPayments[0].slip_hash, slipFile.fileHash);
    assert(existingPayments[0].slip_storage_key.startsWith('private/slips/'));
});

test('Step 22: 2. File Validation: Rejects invalid mime types and oversized files', () => {
    // A. Invalid Mime Type (.exe)
    const invalidTypeRes = PaymentVerificationService.validateSlipFile({
        mimeType: 'application/x-msdownload',
        fileSizeBytes: 1024
    });
    assert(!invalidTypeRes.valid);
    assert(invalidTypeRes.reason.includes('Invalid file type'));

    // B. Oversized File (> 5MB)
    const oversizedRes = PaymentVerificationService.validateSlipFile({
        mimeType: 'image/jpeg',
        fileSizeBytes: 6 * 1024 * 1024 // 6 MB
    });
    assert(!oversizedRes.valid);
    assert(oversizedRes.reason.includes('5 MB limit'));
});

test('Step 22: 3. Fraud Detection: Flags duplicate transfer reference for manual review', () => {
    const existingPayments = [
        {
            id: 'pay-existing-1',
            user_id: 'u-other-member',
            transfer_reference: 'TXN-BOC-554433',
            slip_hash: 'hash-abc-123',
            status: 'PENDING'
        }
    ];

    const slipFile = createSampleSlipFile('unique-slip-content-2');

    const res = PaymentVerificationService.submitPayment({
        userId: 'u-member-2',
        productId: 'prod-social-media',
        amount: 27500.00,
        transferReference: 'TXN-BOC-554433', // Duplicate Reference!
        transferDate: '2026-09-01',
        bankName: 'Bank of Ceylon',
        slipFile,
        existingPayments
    });

    assert(res.success, 'Submission should succeed rather than falsely accusing user');
    assert(res.flagged_for_review, 'Payment must be flagged for manual admin review');
    assert(res.fraud_flags.some(f => f.type === 'DUPLICATE_REFERENCE'));
});

test('Step 22: 4. Fraud Detection: Flags duplicate slip file hash', () => {
    const sharedSlipContent = 'exact-same-bank-slip-photo-data';
    const slipFile1 = createSampleSlipFile(sharedSlipContent);
    const slipFile2 = createSampleSlipFile(sharedSlipContent);

    const existingPayments = [
        {
            id: 'pay-existing-2',
            user_id: 'u-first-user',
            transfer_reference: 'REF-001',
            slip_hash: slipFile1.fileHash,
            status: 'PENDING'
        }
    ];

    const res = PaymentVerificationService.submitPayment({
        userId: 'u-second-user',
        productId: 'prod-social-media',
        amount: 27500.00,
        transferReference: 'REF-002',
        transferDate: '2026-09-01',
        bankName: 'Sampath Bank',
        slipFile: slipFile2,
        existingPayments
    });

    assert(res.success);
    assert(res.flagged_for_review);
    assert(res.fraud_flags.some(f => f.type === 'DUPLICATE_SLIP_HASH'));
});

test('Step 22: 5. Admin Approval: Activates purchase, creates snapshot, and triggers commissions', () => {
    const payments = [
        {
            id: 'pay-appr-1',
            user_id: 'u-buyer',
            product_id: 'prod-social-media',
            amount: 27500.00,
            status: 'PENDING'
        }
    ];

    const purchases = [];
    const sponsors = [{ user_id: 'u-buyer', sponsor_id: 'u-sponsor' }];
    const binaryNodes = [
        { user_id: 'u-root', placement_parent_id: null },
        { user_id: 'u-sponsor', placement_parent_id: 'u-root' },
        { user_id: 'u-buyer', placement_parent_id: 'u-sponsor' }
    ];
    const commissionLedger = [];
    const walletLedger = [];

    const res = PaymentVerificationService.approvePayment({
        paymentId: 'pay-appr-1',
        adminUserId: 'admin-john',
        adminNotes: 'Payment verified with Commercial Bank online portal.',
        payments,
        purchases,
        sponsors,
        binaryNodes,
        commissionLedger,
        walletLedger
    });

    assert(res.success);
    assert.equal(payments[0].status, 'APPROVED');
    assert.equal(payments[0].reviewed_by, 'admin-john');
    assert.equal(purchases.length, 1);
    assert.equal(purchases[0].status, 'ACTIVE');
    assert.equal(purchases[0].economics_snapshot.selling_price, 27500.00);

    // Verify Direct Commission was distributed to sponsor
    assert(res.direct_commission && res.direct_commission.success);
    assert.equal(res.direct_commission.eligible_amount, 2200.00);
});

test('Step 22: 6. Admin Rejection: Transitions status to REJECTED with reason and audit trail', () => {
    const payments = [
        {
            id: 'pay-rej-1',
            user_id: 'u-buyer-2',
            product_id: 'prod-social-media',
            amount: 27500.00,
            status: 'PENDING'
        }
    ];

    const res = PaymentVerificationService.rejectPayment({
        paymentId: 'pay-rej-1',
        adminUserId: 'admin-sarah',
        rejectionReason: 'Slip photo is unreadable and amount does not match.',
        payments
    });

    assert(res.success);
    assert.equal(payments[0].status, 'REJECTED');
    assert.equal(payments[0].rejection_reason, 'Slip photo is unreadable and amount does not match.');
    assert.equal(payments[0].reviewed_by, 'admin-sarah');
});

test('Step 22: 7. Double Approval Guard: Rejects subsequent approval or rejection on finalized payment', () => {
    const payments = [
        {
            id: 'pay-final-1',
            user_id: 'u-buyer',
            product_id: 'prod-social-media',
            amount: 27500.00,
            status: 'APPROVED'
        }
    ];

    // Attempting to approve again
    assert.throws(() => {
        PaymentVerificationService.approvePayment({
            paymentId: 'pay-final-1',
            payments
        });
    }, /already been approved/);

    // Attempting to reject an approved payment
    assert.throws(() => {
        PaymentVerificationService.rejectPayment({
            paymentId: 'pay-final-1',
            rejectionReason: 'Invalid',
            payments
        });
    }, /Cannot reject an already APPROVED payment/);
});

if (require.main === module) {
    runTests();
}
