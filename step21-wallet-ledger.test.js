// Comprehensive Test Suite for STEP 21 — Wallet & Financial Ledger Engine
const testRunner = require('./test-runner');
const WalletService = require('../services/wallet-service');

test('Step 21: 1. Credit: Commission credit increases available and commission balances with before/after audit', () => {
    const ledger = [];
    const res = WalletService.creditCommission({
        userId: 'u-1',
        amount: 2200.00,
        commissionType: 'DIRECT_COMMISSION',
        sourcePurchaseId: 'purch-1',
        ledger
    });

    assert(!res.idempotent);
    assert.equal(res.transaction.balance_before, 0.00);
    assert.equal(res.transaction.balance_after, 2200.00);
    assert.equal(res.transaction.direction, 'CREDIT');

    const balances = WalletService.getWalletBalances('u-1', ledger);
    assert.equal(balances.available_balance, 2200.00);
    assert.equal(balances.commission_balance, 2200.00);
    assert.equal(balances.total_earned, 2200.00);
});

test('Step 21: 2. Withdrawal Request: Locks funds from available balance into WITHDRAWAL_HOLD', () => {
    const ledger = [];
    WalletService.creditCommission({ userId: 'u-2', amount: 10000.00, ledger });

    // Request Rs. 4,000 withdrawal
    const reqRes = WalletService.requestWithdrawal({
        userId: 'u-2',
        amount: 4000.00,
        withdrawalId: 'wd-1',
        ledger,
        kycStatus: 'APPROVED'
    });

    assert(!reqRes.idempotent);
    const balances = WalletService.getWalletBalances('u-2', ledger);
    assert.equal(balances.available_balance, 6000.00, 'Available balance reduced by Rs. 4,000');
    assert.equal(balances.withdrawal_hold_balance, 4000.00, 'Hold balance contains locked Rs. 4,000');
    assert.equal(balances.net_balance, 10000.00);
});

test('Step 21: 3. Withdrawal Paid: Completes deduction from hold and updates total_withdrawn', () => {
    const ledger = [];
    WalletService.creditCommission({ userId: 'u-3', amount: 10000.00, ledger });
    WalletService.requestWithdrawal({ userId: 'u-3', amount: 4000.00, withdrawalId: 'wd-3', ledger });

    // Admin marks paid
    WalletService.payoutWithdrawal({ userId: 'u-3', amount: 4000.00, withdrawalId: 'wd-3', ledger });

    const balances = WalletService.getWalletBalances('u-3', ledger);
    assert.equal(balances.available_balance, 6000.00);
    assert.equal(balances.withdrawal_hold_balance, 0.00, 'Hold balance cleared after payout');
    assert.equal(balances.total_withdrawn, 4000.00, 'Total withdrawn records Rs. 4,000');
});

test('Step 21: 4. Withdrawal Rejected: Unlocks funds from hold back to available balance', () => {
    const ledger = [];
    WalletService.creditCommission({ userId: 'u-4', amount: 10000.00, ledger });
    WalletService.requestWithdrawal({ userId: 'u-4', amount: 4000.00, withdrawalId: 'wd-4', ledger });

    // Admin rejects withdrawal
    WalletService.rejectWithdrawal({ userId: 'u-4', amount: 4000.00, withdrawalId: 'wd-4', reason: 'Invalid Bank Details', ledger });

    const balances = WalletService.getWalletBalances('u-4', ledger);
    assert.equal(balances.available_balance, 10000.00, 'Funds restored to available balance');
    assert.equal(balances.withdrawal_hold_balance, 0.00);
});

test('Step 21: 5. Negative Balance Prevention: Blocks debit when funds are insufficient', () => {
    const ledger = [];
    WalletService.creditCommission({ userId: 'u-5', amount: 2000.00, ledger });

    // Attempting to withdraw Rs. 5,000 when only Rs. 2,000 is available
    assert.throws(() => {
        WalletService.requestWithdrawal({ userId: 'u-5', amount: 5000.00, withdrawalId: 'wd-5', ledger });
    }, /Insufficient wallet balance/);
});

test('Step 21: 6. Commission Reversal: Compensating entry offsets available balance', () => {
    const ledger = [];
    WalletService.creditCommission({ userId: 'u-6', amount: 5000.00, sourcePurchaseId: 'p-6', ledger });
    assert.equal(WalletService.getWalletBalances('u-6', ledger).available_balance, 5000.00);

    // Reversal of Rs. 2,000
    WalletService.reverseCommission({ userId: 'u-6', amount: 2000.00, sourcePurchaseId: 'p-6', ledger });

    const balances = WalletService.getWalletBalances('u-6', ledger);
    assert.equal(balances.available_balance, 3000.00);
    assert.equal(balances.reversed_balance, 2000.00);
});

test('Step 21: 7. Idempotency Protection: Duplicate transaction is rejected without double credit', () => {
    const ledger = [];
    const key = 'tx-idempotent-test-key-1';

    const res1 = WalletService.creditCommission({ userId: 'u-7', amount: 1500.00, ledger, idempotencyKey: key });
    assert(!res1.idempotent);
    assert.equal(ledger.length, 1);

    const res2 = WalletService.creditCommission({ userId: 'u-7', amount: 1500.00, ledger, idempotencyKey: key });
    assert(res2.idempotent);
    assert.equal(ledger.length, 1, 'Ledger length must remain 1');
    assert.equal(WalletService.getWalletBalances('u-7', ledger).available_balance, 1500.00);
});

test('Step 21: 8. Balance Integrity: Deriving balances from multiple transactions matches expected sums', () => {
    const ledger = [];
    // Credits: +10,000, +5,000, +3,000 (Total Earned = 18,000)
    WalletService.creditCommission({ userId: 'u-8', amount: 10000.00, ledger, idempotencyKey: 'k1' });
    WalletService.creditCommission({ userId: 'u-8', amount: 5000.00, ledger, idempotencyKey: 'k2' });
    WalletService.creditCommission({ userId: 'u-8', amount: 3000.00, ledger, idempotencyKey: 'k3' });

    // Request & Paid Withdrawal: -6,000
    WalletService.requestWithdrawal({ userId: 'u-8', amount: 6000.00, withdrawalId: 'w-1', ledger });
    WalletService.payoutWithdrawal({ userId: 'u-8', amount: 6000.00, withdrawalId: 'w-1', ledger });

    // Request Pending Withdrawal: -4,000
    WalletService.requestWithdrawal({ userId: 'u-8', amount: 4000.00, withdrawalId: 'w-2', ledger });

    // Reversal: -1,000
    WalletService.reverseCommission({ userId: 'u-8', amount: 1000.00, sourcePurchaseId: 'p-x', ledger });

    const balances = WalletService.getWalletBalances('u-8', ledger);
    // Available = 18,000 - 6,000 (paid) - 4,000 (hold) - 1,000 (reversal) = 7,000
    assert.equal(balances.available_balance, 7000.00);
    assert.equal(balances.withdrawal_hold_balance, 4000.00);
    assert.equal(balances.total_withdrawn, 6000.00);
    assert.equal(balances.reversed_balance, 1000.00);
    assert.equal(balances.total_earned, 18000.00);
});

if (require.main === module) {
    runTests();
}
