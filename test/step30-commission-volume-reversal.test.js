// Comprehensive Test Suite for STEP 30 — Commission & Volume Reversal Engine
const testRunner = require('./test-runner');
const ReversalEngine = require('../services/reversal-engine');
const WalletService = require('../services/wallet-service');
const VolumeLedger = require('../services/volume-ledger');

function createReversalTestContext() {
    const users = [
        { id: 'u-buyer', username: 'buyer_one', full_name: 'Buyer User', role: 'MEMBER', status: 'ACTIVE' },
        { id: 'u-sponsor', username: 'sponsor_one', full_name: 'Direct Sponsor', role: 'MEMBER', status: 'ACTIVE' },
        { id: 'u-upline-1', username: 'upline_one', full_name: 'Binary Upline 1', role: 'MEMBER', status: 'ACTIVE' },
        { id: 'u-upline-2', username: 'upline_two', full_name: 'Binary Upline 2', role: 'MEMBER', status: 'ACTIVE' },
        { id: 'u-upline-3', username: 'upline_three', full_name: 'Binary Upline 3', role: 'MEMBER', status: 'ACTIVE' }
    ];

    const binaryNodes = [
        { user_id: 'u-upline-3', placement_parent_id: null, position: null },
        { user_id: 'u-upline-2', placement_parent_id: 'u-upline-3', position: 'LEFT' },
        { user_id: 'u-upline-1', placement_parent_id: 'u-upline-2', position: 'LEFT' },
        { user_id: 'u-sponsor', placement_parent_id: 'u-upline-1', position: 'LEFT' },
        { user_id: 'u-buyer', placement_parent_id: 'u-sponsor', position: 'LEFT' }
    ];

    // Commissions paid for purchase 'purch-30-main'
    const walletLedger = [
        // Direct commission to sponsor (Rs. 2,200)
        { id: 'tx-dir-1', user_id: 'u-sponsor', type: 'DIRECT_COMMISSION', amount: 2200.00, reference_id: 'purch-30-main', status: 'COMPLETED', created_at: '2026-08-01T10:00:00Z' },
        // Binary commissions to 3 uplines (Rs. 1,925 each)
        { id: 'tx-bin-1', user_id: 'u-upline-1', type: 'BINARY_COMMISSION', amount: 1925.00, reference_id: 'purch-30-main', status: 'COMPLETED', created_at: '2026-08-01T10:01:00Z' },
        { id: 'tx-bin-2', user_id: 'u-upline-2', type: 'BINARY_COMMISSION', amount: 1925.00, reference_id: 'purch-30-main', status: 'COMPLETED', created_at: '2026-08-01T10:02:00Z' },
        { id: 'tx-bin-3', user_id: 'u-upline-3', type: 'BINARY_COMMISSION', amount: 1925.00, reference_id: 'purch-30-main', status: 'COMPLETED', created_at: '2026-08-01T10:03:00Z' }
    ];

    // Binary volume entries for purchase 'purch-30-main'
    const volumeLedger = [
        { id: 'vol-1', user_id: 'u-sponsor', leg: 'LEFT', amount: 27500.00, type: 'SALE_VOLUME', source_purchase_id: 'purch-30-main', created_at: '2026-08-01T10:00:00Z' },
        { id: 'vol-2', user_id: 'u-upline-1', leg: 'LEFT', amount: 27500.00, type: 'SALE_VOLUME', source_purchase_id: 'purch-30-main', created_at: '2026-08-01T10:00:00Z' },
        { id: 'vol-3', user_id: 'u-upline-2', leg: 'LEFT', amount: 27500.00, type: 'SALE_VOLUME', source_purchase_id: 'purch-30-main', created_at: '2026-08-01T10:00:00Z' },
        { id: 'vol-4', user_id: 'u-upline-3', leg: 'LEFT', amount: 27500.00, type: 'SALE_VOLUME', source_purchase_id: 'purch-30-main', created_at: '2026-08-01T10:00:00Z' }
    ];

    const recoveryLedger = [];
    const auditLogs = [];

    return {
        users,
        binaryNodes,
        walletLedger,
        volumeLedger,
        recoveryLedger,
        auditLogs
    };
}

test('Step 30: 1. Unwithdrawn Commission: Clean reversal directly from available balance', () => {
    const ctx = createReversalTestContext();

    // Initial sponsor balance is 2,200
    const beforeBalance = WalletService.getWalletBalances('u-sponsor', ctx.walletLedger).available_balance;
    assert.equal(beforeBalance, 2200.00);

    const result = ReversalEngine.processPurchaseReversal({
        purchaseId: 'purch-30-main',
        actorId: 'admin-1',
        walletLedger: ctx.walletLedger,
        volumeLedger: ctx.volumeLedger,
        binaryNodes: ctx.binaryNodes,
        recoveryLedger: ctx.recoveryLedger,
        auditLogs: ctx.auditLogs
    });

    assert(result.success);
    assert.equal(result.reversed_direct_commissions.length, 1);
    assert.equal(result.reversed_binary_commissions.length, 3);
    assert.equal(result.recovery_obligations.length, 0, 'No debt obligations when funds were unwithdrawn');

    // After reversal, sponsor balance returns to 0
    const afterBalance = WalletService.getWalletBalances('u-sponsor', ctx.walletLedger).available_balance;
    assert.equal(afterBalance, 0.00);
});

test('Step 30: 2. Withdrawn Commission: Immediate Negative Balance Policy', () => {
    const ctx = createReversalTestContext();

    // Simulate sponsor withdrew their 2,200 commission
    ctx.walletLedger.push({
        id: 'tx-wd-req-1',
        user_id: 'u-sponsor',
        type: 'WITHDRAWAL_REQUEST',
        amount: 2200.00,
        status: 'COMPLETED',
        created_at: '2026-08-02T09:00:00Z'
    });
    ctx.walletLedger.push({
        id: 'tx-wd-1',
        user_id: 'u-sponsor',
        type: 'WITHDRAWAL_PAID',
        amount: 2200.00,
        status: 'COMPLETED',
        created_at: '2026-08-02T10:00:00Z'
    });

    // Available balance is now 0
    assert.equal(WalletService.getWalletBalances('u-sponsor', ctx.walletLedger).available_balance, 0.00);

    const result = ReversalEngine.processPurchaseReversal({
        purchaseId: 'purch-30-main',
        actorId: 'admin-1',
        recoveryPolicy: ReversalEngine.RECOVERY_POLICIES.IMMEDIATE_NEGATIVE_BALANCE,
        walletLedger: ctx.walletLedger,
        volumeLedger: ctx.volumeLedger,
        binaryNodes: ctx.binaryNodes,
        recoveryLedger: ctx.recoveryLedger
    });

    assert(result.success);
    assert.equal(result.recovery_obligations.length, 1);
    assert.equal(result.recovery_obligations[0].outstanding_amount, 2200.00);

    // Available balance is now negative -2,200.00
    const finalBalance = WalletService.getWalletBalances('u-sponsor', ctx.walletLedger).available_balance;
    assert.equal(finalBalance, -2200.00);
});

test('Step 30: 3. Withdrawn Commission: Future Commission Offset Policy', () => {
    const ctx = createReversalTestContext();

    // Sponsor withdrew funds
    ctx.walletLedger.push({
        id: 'tx-wd-req-1',
        user_id: 'u-sponsor',
        type: 'WITHDRAWAL_REQUEST',
        amount: 2200.00,
        status: 'COMPLETED'
    });
    ctx.walletLedger.push({
        id: 'tx-wd-1',
        user_id: 'u-sponsor',
        type: 'WITHDRAWAL_PAID',
        amount: 2200.00,
        status: 'COMPLETED'
    });

    // Reversal under FUTURE_COMMISSION_OFFSET
    const result = ReversalEngine.processPurchaseReversal({
        purchaseId: 'purch-30-main',
        actorId: 'admin-1',
        recoveryPolicy: ReversalEngine.RECOVERY_POLICIES.FUTURE_COMMISSION_OFFSET,
        walletLedger: ctx.walletLedger,
        volumeLedger: ctx.volumeLedger,
        binaryNodes: ctx.binaryNodes,
        recoveryLedger: ctx.recoveryLedger
    });

    assert.equal(result.recovery_obligations.length, 1);
    assert.equal(ctx.recoveryLedger[0].status, 'OUTSTANDING');

    // Sponsor earns a new commission of Rs. 3,000
    const offsetRes = ReversalEngine.applyFutureCommissionOffset({
        userId: 'u-sponsor',
        newCommissionAmount: 3000.00,
        recoveryLedger: ctx.recoveryLedger,
        walletLedger: ctx.walletLedger
    });

    assert.equal(offsetRes.offset_applied, 2200.00, 'Exact debt of 2,200 offset');
    assert.equal(offsetRes.remaining_commission, 800.00, 'Remaining net credit is 800');
    assert(offsetRes.fully_settled, 'Debt obligation is fully settled');
    assert.equal(ctx.recoveryLedger[0].status, 'SETTLED');
});

test('Step 30: 4. Withdrawn Commission: Hold Account Policy freezes member status', () => {
    const ctx = createReversalTestContext();

    // Sponsor withdrew funds
    ctx.walletLedger.push({
        id: 'tx-wd-req-1',
        user_id: 'u-sponsor',
        type: 'WITHDRAWAL_REQUEST',
        amount: 2200.00,
        status: 'COMPLETED'
    });
    ctx.walletLedger.push({
        id: 'tx-wd-1',
        user_id: 'u-sponsor',
        type: 'WITHDRAWAL_PAID',
        amount: 2200.00,
        status: 'COMPLETED'
    });

    ReversalEngine.processPurchaseReversal({
        purchaseId: 'purch-30-main',
        actorId: 'admin-1',
        recoveryPolicy: ReversalEngine.RECOVERY_POLICIES.HOLD_ACCOUNT,
        walletLedger: ctx.walletLedger,
        volumeLedger: ctx.volumeLedger,
        binaryNodes: ctx.binaryNodes,
        users: ctx.users,
        recoveryLedger: ctx.recoveryLedger
    });

    const sponsorUser = ctx.users.find(u => u.id === 'u-sponsor');
    assert.equal(sponsorUser.status, 'RECOVERY_HOLD');
    assert(sponsorUser.recovery_hold_reason.includes('Outstanding commission clawback'));
});

test('Step 30: 5. Multiple Qualified Uplines: Reverses all upline commissions and binary volume entries', () => {
    const ctx = createReversalTestContext();

    const result = ReversalEngine.processPurchaseReversal({
        purchaseId: 'purch-30-main',
        actorId: 'admin-1',
        walletLedger: ctx.walletLedger,
        volumeLedger: ctx.volumeLedger,
        binaryNodes: ctx.binaryNodes
    });

    assert.equal(result.reversed_binary_commissions.length, 3);
    assert.equal(result.reversed_volume_entries.length, 4);

    // Verify all uplines received compensating negative entries
    ['u-upline-1', 'u-upline-2', 'u-upline-3'].forEach(uplineId => {
        const rev = ctx.walletLedger.find(tx => tx.user_id === uplineId && tx.type === 'COMMISSION_REVERSAL');
        assert(rev, `Compensating reversal for ${uplineId} must exist`);
        assert.equal(rev.amount, -1925.00);
    });
});

test('Step 30: 6. Partial Reversal: Reverses configured partial amount cleanly', () => {
    const ctx = createReversalTestContext();

    const result = ReversalEngine.processPurchaseReversal({
        purchaseId: 'purch-30-main',
        actorId: 'admin-1',
        partialAmount: 1000.00, // Partial limit
        walletLedger: ctx.walletLedger,
        volumeLedger: ctx.volumeLedger,
        binaryNodes: ctx.binaryNodes
    });

    assert(result.success);
    assert.equal(result.reversed_direct_commissions[0].amount, -1000.00);
    assert.equal(result.reversed_binary_commissions[0].amount, -1000.00);
});

test('Step 30: 7. Duplicate Refund Protection & Master Idempotency: Never reverses twice', () => {
    const ctx = createReversalTestContext();

    // 1st Reversal
    const res1 = ReversalEngine.processPurchaseReversal({
        purchaseId: 'purch-30-main',
        actorId: 'admin-1',
        walletLedger: ctx.walletLedger,
        volumeLedger: ctx.volumeLedger,
        binaryNodes: ctx.binaryNodes
    });
    assert.equal(res1.reversed_direct_commissions.length, 1);
    assert.equal(res1.reversed_binary_commissions.length, 3);

    const ledgerLengthAfterFirst = ctx.walletLedger.length;
    const volumeLengthAfterFirst = ctx.volumeLedger.length;

    // 2nd Duplicate Reversal
    const res2 = ReversalEngine.processPurchaseReversal({
        purchaseId: 'purch-30-main',
        actorId: 'admin-1',
        walletLedger: ctx.walletLedger,
        volumeLedger: ctx.volumeLedger,
        binaryNodes: ctx.binaryNodes
    });

    assert.equal(res2.reversed_direct_commissions.length, 0, 'No duplicate direct reversals');
    assert.equal(res2.reversed_binary_commissions.length, 0, 'No duplicate binary reversals');
    assert.equal(res2.skipped_duplicates, 4, 'All 4 original transactions skipped as duplicates');
    assert.equal(ctx.walletLedger.length, ledgerLengthAfterFirst);
    assert.equal(ctx.volumeLedger.length, volumeLengthAfterFirst);
});

test('Step 30: 8. Retry After Partial Failure: Resumes and only reverses remaining pending records', () => {
    const ctx = createReversalTestContext();

    // Simulate partial failure: direct commission was reversed, but server crashed before binary commissions
    ctx.walletLedger.push({
        id: 'rev-tx-tx-dir-1-purch-30-main',
        idempotency_key: 'rev-tx-tx-dir-1-purch-30-main',
        original_transaction_id: 'tx-dir-1',
        user_id: 'u-sponsor',
        type: 'COMMISSION_REVERSAL',
        amount: -2200.00,
        status: 'COMPLETED'
    });

    // Re-run reversal
    const result = ReversalEngine.processPurchaseReversal({
        purchaseId: 'purch-30-main',
        actorId: 'admin-1',
        walletLedger: ctx.walletLedger,
        volumeLedger: ctx.volumeLedger,
        binaryNodes: ctx.binaryNodes
    });

    assert.equal(result.reversed_direct_commissions.length, 0, 'Direct commission already reversed, skipped');
    assert.equal(result.reversed_binary_commissions.length, 3, 'Remaining 3 binary commissions reversed successfully');
    assert.equal(result.skipped_duplicates, 1);
});

if (require.main === module) {
    runTests();
}
