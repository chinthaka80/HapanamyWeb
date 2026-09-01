// Hapanamy Wallet & Withdrawal System Unit Tests
const testRunner = require('./test-runner');
const WalletService = require('../services/wallet-service');

let ledger = [];
let withdrawals = [];

before(() => {
    ledger = [];
    withdrawals = [];
});

test('Wallet balances sum correctly from ledger credits', () => {
    // Add direct and binary commissions
    ledger.push({ id: 'tx-1', type: 'DIRECT_COMMISSION', amount: 596.00 });
    ledger.push({ id: 'tx-2', type: 'BINARY_COMMISSION', amount: 521.50 });

    const balances = WalletService.calculateBalances(ledger);
    
    assert.equal(balances.availableBalance, 1117.50, 'Available balance should be 1117.50 LKR');
    assert.equal(balances.totalEarned, 1117.50);
});

test('Withdrawal validation blocks unverified KYC members', () => {
    // KYC status: PENDING
    const result = WalletService.validateWithdrawal(1000.00, 1117.50, 'PENDING');
    assert(!result.valid, 'Withdrawal must fail if KYC is not verified');
    assert.equal(result.error, 'KYC Verification is required before requesting withdrawals.');
});

test('Withdrawal validation blocks amounts below minimum threshold', () => {
    const result = WalletService.validateWithdrawal(500.00, 1117.50, 'VERIFIED');
    assert(!result.valid, 'Withdrawal below LKR 1,000 minimum limit must fail');
});

test('Withdrawal validation blocks overdraft requests', () => {
    const result = WalletService.validateWithdrawal(2000.00, 1117.50, 'VERIFIED');
    assert(!result.valid, 'Withdrawal exceeding available balance must fail');
});

test('Successful withdrawal request locks funds in ledger', () => {
    // Verify payload
    const result = WalletService.validateWithdrawal(1000.00, 1117.50, 'VERIFIED');
    assert(result.valid);

    // Request withdrawal
    ledger.push({ id: 'tx-w-1', type: 'WITHDRAWAL_REQUEST', amount: -1000.00 });
    
    const balances = WalletService.calculateBalances(ledger);
    assert.equal(balances.availableBalance, 117.50, 'Available balance should drop by 1000 LKR');
    assert.equal(balances.pendingBalance, 1000.00, 'Pending balance should hold 1000 LKR');
});

test('Admin marking paid updates total withdrawn state', () => {
    // Simulate payment payout
    ledger.push({ id: 'tx-w-paid', type: 'WITHDRAWAL_PAID', amount: -1000.00 }); // Negative entry for matching the request

    const balances = WalletService.calculateBalances(ledger);
    assert.equal(balances.pendingBalance, 0.00, 'Pending balance should be cleared');
    assert.equal(balances.totalWithdrawn, 1000.00, 'Total withdrawn should increase by 1000 LKR');
});

if (require.main === module) {
    runTests();
}
