// Comprehensive Test Suite for STEP 24 — Member Withdrawal Management Engine
const testRunner = require('./test-runner');
const WithdrawalService = require('../services/withdrawal-service');
const WalletService = require('../services/wallet-service');

function createWithdrawalTestContext(initialBalance = 15000.00) {
    const walletLedger = [];
    if (initialBalance > 0) {
        WalletService.creditCommission({
            userId: 'u-withdrawer',
            amount: initialBalance,
            commissionType: 'DIRECT_COMMISSION',
            sourcePurchaseId: 'purch-seed',
            ledger: walletLedger
        });
    }

    const bankDetails = {
        account_holder_name: 'K. T. Kasun Perera',
        bank_name: 'Commercial Bank of Ceylon',
        branch: 'Kollupitiya',
        account_number: '8001928374'
    };

    return {
        userId: 'u-withdrawer',
        walletLedger,
        bankDetails,
        withdrawalsList: []
    };
}

test('Step 24: 1. Valid Withdrawal Request: Locks funds into WITHDRAWAL_HOLD and creates PENDING request', () => {
    const ctx = createWithdrawalTestContext(15000.00);

    const res = WithdrawalService.requestWithdrawal({
        userId: ctx.userId,
        amount: 5000.00,
        bankDetails: ctx.bankDetails,
        kycStatus: 'APPROVED',
        walletLedger: ctx.walletLedger,
        withdrawalsList: ctx.withdrawalsList
    });

    assert(res.success);
    assert.equal(res.status, 'PENDING');
    assert.equal(ctx.withdrawalsList.length, 1);

    const balances = WalletService.getWalletBalances(ctx.userId, ctx.walletLedger);
    assert.equal(balances.available_balance, 10000.00, 'Available balance reduced by Rs. 5,000');
    assert.equal(balances.withdrawal_hold_balance, 5000.00, 'Locked in hold balance');
});

test('Step 24: 2. Insufficient Balance: Blocks request when amount exceeds available balance', () => {
    const ctx = createWithdrawalTestContext(2000.00);

    assert.throws(() => {
        WithdrawalService.requestWithdrawal({
            userId: ctx.userId,
            amount: 5000.00, // Exceeds Rs. 2,000 available
            bankDetails: ctx.bankDetails,
            kycStatus: 'APPROVED',
            walletLedger: ctx.walletLedger,
            withdrawalsList: ctx.withdrawalsList
        });
    }, /Insufficient wallet balance/);
});

test('Step 24: 3. Unverified KYC: Blocks withdrawal request', () => {
    const ctx = createWithdrawalTestContext(10000.00);

    assert.throws(() => {
        WithdrawalService.requestWithdrawal({
            userId: ctx.userId,
            amount: 3000.00,
            bankDetails: ctx.bankDetails,
            kycStatus: 'PENDING', // Unverified!
            walletLedger: ctx.walletLedger,
            withdrawalsList: ctx.withdrawalsList
        });
    }, /Approved KYC verification is required/);
});

test('Step 24: 4. Minimum Amount Enforcement: Blocks requests below threshold (e.g. < Rs. 1,000)', () => {
    const ctx = createWithdrawalTestContext(10000.00);

    assert.throws(() => {
        WithdrawalService.requestWithdrawal({
            userId: ctx.userId,
            amount: 500.00, // Below Rs. 1,000 limit
            bankDetails: ctx.bankDetails,
            kycStatus: 'APPROVED',
            walletLedger: ctx.walletLedger,
            withdrawalsList: ctx.withdrawalsList
        });
    }, /Minimum withdrawal limit is LKR 1000.00/);
});

test('Step 24: 5. Admin Approval & Mark Paid: Finalizes hold deduction and updates total_withdrawn', () => {
    const ctx = createWithdrawalTestContext(20000.00);

    const reqRes = WithdrawalService.requestWithdrawal({
        userId: ctx.userId,
        amount: 8000.00,
        bankDetails: ctx.bankDetails,
        kycStatus: 'APPROVED',
        walletLedger: ctx.walletLedger,
        withdrawalsList: ctx.withdrawalsList
    });

    const withdrawalId = reqRes.withdrawal_id;

    // Admin Approves
    WithdrawalService.approveWithdrawal({
        withdrawalId,
        adminUserId: 'admin-1',
        withdrawalsList: ctx.withdrawalsList
    });
    assert.equal(ctx.withdrawalsList[0].status, 'APPROVED');

    // Admin Marks Paid
    const paidRes = WithdrawalService.markPaid({
        withdrawalId,
        bankTransferReference: 'CEFT-TXN-998822',
        adminUserId: 'admin-1',
        walletLedger: ctx.walletLedger,
        withdrawalsList: ctx.withdrawalsList
    });

    assert(paidRes.success);
    assert.equal(ctx.withdrawalsList[0].status, 'PAID');
    assert.equal(ctx.withdrawalsList[0].bank_transfer_reference, 'CEFT-TXN-998822');

    const balances = WalletService.getWalletBalances(ctx.userId, ctx.walletLedger);
    assert.equal(balances.available_balance, 12000.00);
    assert.equal(balances.withdrawal_hold_balance, 0.00, 'Hold cleared');
    assert.equal(balances.total_withdrawn, 8000.00, 'Recorded in total_withdrawn');
});

test('Step 24: 6. Admin Rejection: Unlocks hold funds and restores available balance', () => {
    const ctx = createWithdrawalTestContext(10000.00);

    const reqRes = WithdrawalService.requestWithdrawal({
        userId: ctx.userId,
        amount: 4000.00,
        bankDetails: ctx.bankDetails,
        kycStatus: 'APPROVED',
        walletLedger: ctx.walletLedger,
        withdrawalsList: ctx.withdrawalsList
    });

    const withdrawalId = reqRes.withdrawal_id;

    // Admin Rejects
    const rejRes = WithdrawalService.rejectWithdrawal({
        withdrawalId,
        rejectionReason: 'Account number does not match NIC holder name.',
        adminUserId: 'admin-2',
        walletLedger: ctx.walletLedger,
        withdrawalsList: ctx.withdrawalsList
    });

    assert(rejRes.success);
    assert.equal(ctx.withdrawalsList[0].status, 'REJECTED');

    const balances = WalletService.getWalletBalances(ctx.userId, ctx.walletLedger);
    assert.equal(balances.available_balance, 10000.00, 'Funds restored to available balance');
    assert.equal(balances.withdrawal_hold_balance, 0.00);
});

test('Step 24: 7. Member Cancellation: Allows member to cancel PENDING request and restores funds', () => {
    const ctx = createWithdrawalTestContext(10000.00);

    const reqRes = WithdrawalService.requestWithdrawal({
        userId: ctx.userId,
        amount: 3000.00,
        bankDetails: ctx.bankDetails,
        kycStatus: 'APPROVED',
        walletLedger: ctx.walletLedger,
        withdrawalsList: ctx.withdrawalsList
    });

    const cancelRes = WithdrawalService.cancelWithdrawal({
        withdrawalId: reqRes.withdrawal_id,
        userId: ctx.userId,
        walletLedger: ctx.walletLedger,
        withdrawalsList: ctx.withdrawalsList
    });

    assert(cancelRes.success);
    assert.equal(ctx.withdrawalsList[0].status, 'CANCELLED');

    const balances = WalletService.getWalletBalances(ctx.userId, ctx.walletLedger);
    assert.equal(balances.available_balance, 10000.00);
    assert.equal(balances.withdrawal_hold_balance, 0.00);
});

test('Step 24: 8. Double Payout Guard: Prevents paying or rejecting a finalized withdrawal', () => {
    const ctx = createWithdrawalTestContext(10000.00);

    const reqRes = WithdrawalService.requestWithdrawal({
        userId: ctx.userId,
        amount: 2000.00,
        bankDetails: ctx.bankDetails,
        kycStatus: 'APPROVED',
        walletLedger: ctx.walletLedger,
        withdrawalsList: ctx.withdrawalsList
    });

    WithdrawalService.markPaid({
        withdrawalId: reqRes.withdrawal_id,
        bankTransferReference: 'REF-PAID-1',
        walletLedger: ctx.walletLedger,
        withdrawalsList: ctx.withdrawalsList
    });

    // Attempting to pay again
    assert.throws(() => {
        WithdrawalService.markPaid({
            withdrawalId: reqRes.withdrawal_id,
            bankTransferReference: 'REF-PAID-2',
            walletLedger: ctx.walletLedger,
            withdrawalsList: ctx.withdrawalsList
        });
    }, /already marked as PAID/);

    // Attempting to reject paid withdrawal
    assert.throws(() => {
        WithdrawalService.rejectWithdrawal({
            withdrawalId: reqRes.withdrawal_id,
            rejectionReason: 'Mistake',
            walletLedger: ctx.walletLedger,
            withdrawalsList: ctx.withdrawalsList
        });
    }, /Cannot reject an already PAID withdrawal/);
});

if (require.main === module) {
    runTests();
}
