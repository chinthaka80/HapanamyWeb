// Comprehensive Test Suite for STEP 29 — Refund & Cancellation Engine
const testRunner = require('./test-runner');
const RefundService = require('../services/refund-service');
const ProductSnapshotService = require('../services/product-snapshot-service');
const WalletService = require('../services/wallet-service');

function createRefundTestContext() {
    const product = {
        id: 'prod-social-media',
        name: 'Social Media Income Masterclass',
        selling_price: 27500.00,
        product_cost: 2500.00,
        binary_volume: 27500.00,
        binary_commission_rate: 7.00,
        direct_commission_rate: 8.00,
        status: 'ACTIVE'
    };

    const snapshot = ProductSnapshotService.createSnapshot(product, 'purch-ref-test-1');

    const users = [
        { id: 'u-buyer', username: 'student_buyer', full_name: 'Amila Perera', role: 'MEMBER', status: 'ACTIVE', created_at: '2026-08-01T10:00:00Z' },
        { id: 'u-sponsor', username: 'top_sponsor', full_name: 'Kasun Leader', role: 'MEMBER', status: 'ACTIVE', created_at: '2026-08-01T08:00:00Z' },
        { id: 'u-root', username: 'admin_root', full_name: 'Administrator', role: 'ADMIN', status: 'ACTIVE', created_at: '2026-07-01T08:00:00Z' }
    ];

    const binaryNodes = [
        { user_id: 'u-root', placement_parent_id: null, position: null },
        { user_id: 'u-sponsor', placement_parent_id: 'u-root', position: 'LEFT' },
        { user_id: 'u-buyer', placement_parent_id: 'u-sponsor', position: 'LEFT' }
    ];

    const purchases = [
        {
            id: 'purch-ref-101',
            user_id: 'u-buyer',
            product_id: 'prod-social-media',
            selling_price: 27500.00,
            economics_snapshot: snapshot,
            status: 'ACTIVE',
            access_status: 'GRANTED',
            activated_at: new Date().toISOString()
        }
    ];

    const walletLedger = [
        // Direct commission to sponsor
        { id: 'tx-comm-dir', user_id: 'u-sponsor', type: 'DIRECT_COMMISSION', amount: 2200.00, reference_id: 'purch-ref-101', status: 'COMPLETED', created_at: new Date().toISOString() },
        // Binary commission to root
        { id: 'tx-comm-bin', user_id: 'u-root', type: 'BINARY_COMMISSION', amount: 1925.00, reference_id: 'purch-ref-101', status: 'COMPLETED', created_at: new Date().toISOString() }
    ];

    const volumeLedger = [
        { id: 'vol-1', user_id: 'u-sponsor', leg: 'LEFT', amount: 27500.00, type: 'SALE_VOLUME', purchase_id: 'purch-ref-101', created_at: new Date().toISOString() },
        { id: 'vol-2', user_id: 'u-root', leg: 'LEFT', amount: 27500.00, type: 'SALE_VOLUME', purchase_id: 'purch-ref-101', created_at: new Date().toISOString() }
    ];

    const refundRequests = [];
    const auditLogs = [];

    return {
        users,
        binaryNodes,
        purchases,
        walletLedger,
        volumeLedger,
        refundRequests,
        auditLogs
    };
}

test('Step 29: 1. Inside 14 Days: Purchase requested within window is fully eligible', () => {
    const ctx = createRefundTestContext();
    const purchase = ctx.purchases[0];

    const check = RefundService.checkEligibility(purchase);
    assert(check.eligible, 'Should be eligible within default 14-day window');
    assert.equal(check.allowed_window_days, 14);
});

test('Step 29: 2. Outside 14 Days: Expired purchase request is rejected', () => {
    const ctx = createRefundTestContext();
    const expiredPurchase = {
        ...ctx.purchases[0],
        activated_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() // 20 days ago
    };

    const check = RefundService.checkEligibility(expiredPurchase);
    assert(!check.eligible);
    assert.equal(check.reason, 'WINDOW_EXPIRED');
});

test('Step 29: 3. Eligible Product: Allows refund with normal low course telemetry', () => {
    const ctx = createRefundTestContext();
    const purchase = ctx.purchases[0];

    const check = RefundService.checkEligibility(purchase, {
        usage: {
            watch_percentage: 12.5,
            completed_lessons_count: 1,
            has_downloaded_resources: false,
            exam_attempted: false
        }
    });

    assert(check.eligible);
});

test('Step 29: 4. Ineligible due to Configured Usage Rules (Watch %, Lessons, Downloads, Exams)', () => {
    const ctx = createRefundTestContext();
    const purchase = ctx.purchases[0];

    // (a) Watch percentage > 25%
    const checkWatch = RefundService.checkEligibility(purchase, {
        usage: { watch_percentage: 45.0 }
    });
    assert(!checkWatch.eligible);
    assert.equal(checkWatch.reason, 'USAGE_WATCH_LIMIT_EXCEEDED');

    // (b) Completed lessons > 2
    const checkLessons = RefundService.checkEligibility(purchase, {
        usage: { completed_lessons_count: 5 }
    });
    assert(!checkLessons.eligible);
    assert.equal(checkLessons.reason, 'USAGE_LESSONS_LIMIT_EXCEEDED');

    // (c) Downloaded resources
    const checkDownload = RefundService.checkEligibility(purchase, {
        usage: { has_downloaded_resources: true, downloaded_at: new Date().toISOString() }
    });
    assert(!checkDownload.eligible);
    assert.equal(checkDownload.reason, 'RESOURCES_DOWNLOADED');

    // (d) Exam attempted
    const checkExam = RefundService.checkEligibility(purchase, {
        usage: { exam_attempted: true }
    });
    assert(!checkExam.eligible);
    assert.equal(checkExam.reason, 'EXAM_ATTEMPTED');
});

test('Step 29: 5. Duplicate Request Protection: Blocks duplicate active refund requests', () => {
    const ctx = createRefundTestContext();

    // 1st Request succeeds
    const res1 = RefundService.requestRefund({
        userId: 'u-buyer',
        purchaseId: 'purch-ref-101',
        reason: 'Course is too advanced',
        purchases: ctx.purchases,
        refundRequests: ctx.refundRequests,
        auditLogs: ctx.auditLogs
    });
    assert(res1.success);
    assert.equal(ctx.refundRequests.length, 1);

    // 2nd Duplicate Request fails
    assert.throws(() => {
        RefundService.requestRefund({
            userId: 'u-buyer',
            purchaseId: 'purch-ref-101',
            reason: 'Second duplicate try',
            purchases: ctx.purchases,
            refundRequests: ctx.refundRequests
        });
    }, /already exists/);
});

test('Step 29: 6. Complete Refund Lifecycle: REQUESTED -> UNDER_REVIEW -> APPROVED -> Execution with Compensating Reversals', () => {
    const ctx = createRefundTestContext();

    // 1. Submit Request
    const reqRes = RefundService.requestRefund({
        userId: 'u-buyer',
        purchaseId: 'purch-ref-101',
        reason: 'Schedule conflict',
        purchases: ctx.purchases,
        refundRequests: ctx.refundRequests,
        auditLogs: ctx.auditLogs
    });
    const refundId = reqRes.refund_request.id;

    // 2. Admin Starts Review
    RefundService.reviewRefundRequest({
        refundId,
        action: 'START_REVIEW',
        reviewerId: 'u-root',
        refundRequests: ctx.refundRequests,
        auditLogs: ctx.auditLogs
    });
    assert.equal(ctx.refundRequests[0].status, 'UNDER_REVIEW');

    // 3. Admin Approves Request
    RefundService.reviewRefundRequest({
        refundId,
        action: 'APPROVE',
        reviewerId: 'u-root',
        refundRequests: ctx.refundRequests,
        auditLogs: ctx.auditLogs
    });
    assert.equal(ctx.refundRequests[0].status, 'APPROVED');

    // 4. Execute Refund Workflow
    const execRes = RefundService.executeRefundWorkflow({
        refundId,
        actorId: 'u-root',
        refundRequests: ctx.refundRequests,
        purchases: ctx.purchases,
        walletLedger: ctx.walletLedger,
        volumeLedger: ctx.volumeLedger,
        binaryNodes: ctx.binaryNodes,
        auditLogs: ctx.auditLogs,
        bankPayoutReference: 'CEFT-REF-89210'
    });

    assert(execRes.success);
    assert.equal(execRes.status, 'REFUNDED');
    assert.equal(ctx.purchases[0].status, 'REFUNDED');
    assert.equal(ctx.purchases[0].access_status, 'REVOKED');

    // Verify Compensating Commission Reversals created
    const sponsorReversal = ctx.walletLedger.find(tx => tx.user_id === 'u-sponsor' && tx.type === 'COMMISSION_REVERSAL');
    const adminReversal = ctx.walletLedger.find(tx => tx.user_id === 'u-root' && tx.type === 'COMMISSION_REVERSAL');
    assert(sponsorReversal, 'Compensating reversal for sponsor must exist');
    assert.equal(sponsorReversal.amount, -2200.00);
    assert(adminReversal, 'Compensating reversal for binary commission must exist');
    assert.equal(adminReversal.amount, -1925.00);

    // Verify Compensating Volume Reversals created
    const volumeReversal = ctx.volumeLedger.find(v => v.type === 'REVERSAL');
    assert(volumeReversal, 'Compensating negative volume entry must exist');
    assert.equal(volumeReversal.amount, -27500.00);

    // Verify Refund Payout Ledger entry
    const payoutTx = ctx.walletLedger.find(tx => tx.type === 'REFUND_PAYOUT');
    assert(payoutTx, 'Refund payout ledger entry must exist');
    assert.equal(payoutTx.amount, 27500.00);
    assert.equal(payoutTx.bank_payout_reference, 'CEFT-REF-89210');

    // Verify Audit Trail
    const execAudit = ctx.auditLogs.find(l => l.action === 'REFUND_EXECUTED');
    assert(execAudit, 'Audit log must record REFUND_EXECUTED');
});

test('Step 29: 7. Member Cancellation: Allows member to cancel pending request and restores status', () => {
    const ctx = createRefundTestContext();

    const reqRes = RefundService.requestRefund({
        userId: 'u-buyer',
        purchaseId: 'purch-ref-101',
        reason: 'Mistake request',
        purchases: ctx.purchases,
        refundRequests: ctx.refundRequests,
        auditLogs: ctx.auditLogs
    });

    const cancelRes = RefundService.cancelRefundRequest({
        refundId: reqRes.refund_request.id,
        userId: 'u-buyer',
        refundRequests: ctx.refundRequests,
        auditLogs: ctx.auditLogs
    });

    assert(cancelRes.success);
    assert.equal(ctx.refundRequests[0].status, 'CANCELLED');
});

test('Step 29: 8. Master Idempotency & Retry: Re-executing finalized refund is idempotent with 0 duplicate ledger entries', () => {
    const ctx = createRefundTestContext();

    const reqRes = RefundService.requestRefund({
        userId: 'u-buyer',
        purchaseId: 'purch-ref-101',
        purchases: ctx.purchases,
        refundRequests: ctx.refundRequests
    });

    RefundService.reviewRefundRequest({
        refundId: reqRes.refund_request.id,
        action: 'APPROVE',
        reviewerId: 'u-root',
        refundRequests: ctx.refundRequests
    });

    // 1st Execution
    RefundService.executeRefundWorkflow({
        refundId: reqRes.refund_request.id,
        actorId: 'u-root',
        refundRequests: ctx.refundRequests,
        purchases: ctx.purchases,
        walletLedger: ctx.walletLedger,
        volumeLedger: ctx.volumeLedger,
        binaryNodes: ctx.binaryNodes
    });

    const initialLedgerLength = ctx.walletLedger.length;
    const initialVolumeLength = ctx.volumeLedger.length;

    // 2nd Execution Retry
    const retryRes = RefundService.executeRefundWorkflow({
        refundId: reqRes.refund_request.id,
        actorId: 'u-root',
        refundRequests: ctx.refundRequests,
        purchases: ctx.purchases,
        walletLedger: ctx.walletLedger,
        volumeLedger: ctx.volumeLedger,
        binaryNodes: ctx.binaryNodes
    });

    assert(retryRes.idempotent);
    assert.equal(ctx.walletLedger.length, initialLedgerLength, 'Wallet ledger length must not increase on retry');
    assert.equal(ctx.volumeLedger.length, initialVolumeLength, 'Volume ledger length must not increase on retry');
});

if (require.main === module) {
    runTests();
}
