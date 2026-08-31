// Hapanamy.lk Wallet & Withdrawal System Domain Service
// Handles ledger calculations, withdrawal limit validations, and balance updates

const WalletService = {
    /**
     * Re-calculates available and pending balances for a user based entirely on their ledger transactions.
     * Enforces auditability and prevents tampering of wallet balances.
     */
    calculateBalances(ledger) {
        let availableBalance = 0.00;
        let pendingBalance = 0.00;
        let totalEarned = 0.00;
        let totalWithdrawn = 0.00;

        ledger.forEach(tx => {
            const amountCents = Math.round(tx.amount * 100);

            if (tx.type === 'DIRECT_COMMISSION' || tx.type === 'BINARY_COMMISSION') {
                availableBalance += amountCents;
                totalEarned += amountCents;
            } else if (tx.type === 'WITHDRAWAL_REQUEST') {
                // Negative entry to lock funds
                availableBalance += amountCents; // Cents are negative in withdrawal request
                pendingBalance += Math.abs(amountCents);
            } else if (tx.type === 'WITHDRAWAL_PAID') {
                pendingBalance -= Math.abs(amountCents);
                totalWithdrawn += Math.abs(amountCents);
            } else if (tx.type === 'REFUND_REVERSAL') {
                availableBalance += amountCents; // Negative counter entry
            } else if (tx.type === 'ADMIN_ADJUSTMENT') {
                availableBalance += amountCents;
                if (amountCents > 0) totalEarned += amountCents;
            }
        });

        return {
            availableBalance: availableBalance / 100,
            pendingBalance: pendingBalance / 100,
            totalEarned: totalEarned / 100,
            totalWithdrawn: totalWithdrawn / 100
        };
    },

    /**
     * Validates if a user is eligible to make a withdrawal request.
     */
    validateWithdrawal(amount, availableBalance, kycStatus, minAmount = 1000.00) {
        if (kycStatus !== 'VERIFIED') {
            return { valid: false, error: 'KYC Verification is required before requesting withdrawals.' };
        }
        if (amount < minAmount) {
            return { valid: false, error: `Minimum withdrawal limit is LKR ${minAmount.toFixed(2)}.` };
        }
        if (amount > availableBalance) {
            return { valid: false, error: 'Insufficient wallet balance.' };
        }
        return { valid: true };
    }
};

if (typeof module !== 'undefined') {
    module.exports = WalletService;
}
