// Hapanamy.lk Multi-Wallet Financial Ledger Engine (STEP 21)
// Immutable double-entry financial ledger, multi-bucket wallet calculations,
// withdrawal hold lifecycle, negative balance prevention, idempotency, and auditability.

const crypto = require('crypto');

const WalletService = {
    _walletLocks: new Set(),

    /**
     * Re-calculates all multi-wallet balances for a member derived strictly from the immutable ledger.
     */
    calculateBalances(ledger = [], targetUserId = null) {
        let availableCents = 0;
        let commissionCents = 0;
        let pendingCents = 0;
        let holdCents = 0;
        let reversedCents = 0;
        let totalWithdrawnCents = 0;

        const entries = targetUserId 
            ? ledger.filter(tx => tx.user_id === targetUserId)
            : ledger;

        entries.forEach(tx => {
            const rawAmount = Number(tx.amount) || 0;
            const amountCents = Math.round(Math.abs(rawAmount) * 100);
            const isCredit = tx.direction === 'CREDIT' || (!tx.direction && rawAmount > 0);
            const isDebit = tx.direction === 'DEBIT' || (!tx.direction && rawAmount < 0);

            const txType = (tx.type || '').toUpperCase();

            // 1. Commission Credits
            if (txType === 'DIRECT_COMMISSION' || txType === 'BINARY_COMMISSION' || txType === 'MATCHING_COMMISSION' || txType === 'COMMISSION_CREDIT') {
                availableCents += amountCents;
                commissionCents += amountCents;
            }
            // 2. Withdrawal Requests (Locks funds into WITHDRAWAL_HOLD)
            else if (txType === 'WITHDRAWAL_REQUEST' || txType === 'WITHDRAWAL_LOCK') {
                availableCents -= amountCents;
                holdCents += amountCents;
            }
            // 3. Withdrawal Paid / Completed (Deducts from WITHDRAWAL_HOLD to Total Withdrawn)
            else if (txType === 'WITHDRAWAL_PAID' || txType === 'WITHDRAWAL_COMPLETED') {
                holdCents -= amountCents;
                totalWithdrawnCents += amountCents;
            }
            // 4. Withdrawal Rejected / Cancelled (Unlocks from WITHDRAWAL_HOLD back to AVAILABLE)
            else if (txType === 'WITHDRAWAL_REJECTED' || txType === 'WITHDRAWAL_CANCELLED' || txType === 'WITHDRAWAL_UNLOCK') {
                holdCents -= amountCents;
                availableCents += amountCents;
            }
            // 5. Commission Reversal / Clawback
            else if (txType === 'COMMISSION_REVERSAL' || txType === 'REFUND_REVERSAL' || txType === 'DIRECT_REVERSAL' || txType === 'BINARY_REVERSAL') {
                availableCents -= amountCents;
                reversedCents += amountCents;
            }
            // 6. Admin Adjustments
            else if (txType === 'ADMIN_ADJUSTMENT' || txType === 'ADJUSTMENT') {
                if (isCredit) {
                    availableCents += amountCents;
                    commissionCents += amountCents;
                } else if (isDebit) {
                    availableCents -= amountCents;
                }
            }
            // 7. Pending Deposits / KYC Wallet
            else if (txType === 'PENDING_DEPOSIT' || txType === 'PENDING_COMMISSION') {
                pendingCents += amountCents;
            }
        });

        return {
            availableBalance: availableCents / 100,
            commissionBalance: commissionCents / 100,
            pendingBalance: Math.max(0, holdCents + pendingCents) / 100,
            withdrawalHoldBalance: Math.max(0, holdCents) / 100,
            reversedBalance: reversedCents / 100,
            totalEarned: commissionCents / 100,
            totalWithdrawn: totalWithdrawnCents / 100
        };
    },

    /**
     * Gets a detailed multi-wallet status summary for a user.
     */
    getWalletBalances(userId, ledger = []) {
        const balances = this.calculateBalances(ledger, userId);
        return {
            user_id: userId,
            available_balance: balances.availableBalance,
            commission_balance: balances.commissionBalance,
            pending_balance: balances.pendingBalance,
            withdrawal_hold_balance: balances.withdrawalHoldBalance,
            reversed_balance: balances.reversedBalance,
            total_earned: balances.totalEarned,
            total_withdrawn: balances.totalWithdrawn,
            net_balance: Math.round((balances.availableBalance + balances.withdrawalHoldBalance) * 100) / 100
        };
    },

    /**
     * Appends an immutable financial transaction into the wallet ledger.
     */
    recordTransaction(ledger, {
        userId,
        walletType = 'AVAILABLE',
        type,
        amount,
        direction = 'CREDIT',
        referenceType = null,
        referenceId = null,
        idempotencyKey = null,
        status = 'COMPLETED',
        description = null,
        allowNegative = false
    }) {
        if (!userId) throw new Error('User ID is required for wallet transactions.');
        if (!type) throw new Error('Transaction type is required.');

        const numAmount = Math.abs(Number(amount) || 0);
        if (numAmount === 0) {
            return null; // Ignore zero transactions
        }

        const key = idempotencyKey || `tx-${type}-${referenceId || 'manual'}-${userId}-${direction}`;

        // Idempotency check
        const existingTx = ledger.find(e => e.idempotency_key === key);
        if (existingTx) {
            console.log(`⚠️ Idempotency block: Wallet transaction ${key} already exists.`);
            return { idempotent: true, transaction: existingTx };
        }

        const currentBalances = this.calculateBalances(ledger, userId);
        const beforeBalance = currentBalances.availableBalance;

        // Prevent Negative Balance Check on Debits
        if (direction === 'DEBIT' && !allowNegative) {
            if (numAmount > beforeBalance) {
                throw new Error(`Insufficient wallet balance. Available: LKR ${beforeBalance.toFixed(2)}, Requested: LKR ${numAmount.toFixed(2)}.`);
            }
        }

        const afterBalance = direction === 'CREDIT'
            ? Math.round((beforeBalance + numAmount) * 100) / 100
            : Math.round((beforeBalance - numAmount) * 100) / 100;

        const transaction = {
            id: 'tx-' + crypto.randomBytes(8).toString('hex'),
            user_id: userId,
            wallet_type: walletType,
            type: type.toUpperCase(),
            amount: direction === 'DEBIT' ? -numAmount : numAmount,
            raw_amount: numAmount,
            direction: direction.toUpperCase(),
            reference_type: referenceType,
            reference_id: referenceId,
            balance_before: beforeBalance,
            balance_after: afterBalance,
            status: status.toUpperCase(),
            description,
            idempotency_key: key,
            created_at: new Date().toISOString()
        };

        ledger.push(transaction);
        return { idempotent: false, transaction };
    },

    /**
     * Credits commission to member available wallet.
     */
    creditCommission({
        userId,
        amount,
        commissionType = 'DIRECT_COMMISSION',
        sourcePurchaseId = null,
        ledger = [],
        idempotencyKey = null
    }) {
        return this.recordTransaction(ledger, {
            userId,
            walletType: 'COMMISSION',
            type: commissionType,
            amount,
            direction: 'CREDIT',
            referenceType: 'PURCHASE',
            referenceId: sourcePurchaseId,
            idempotencyKey: idempotencyKey || `tx-comm-${commissionType}-${sourcePurchaseId}-${userId}`,
            status: 'COMPLETED'
        });
    },

    /**
     * Validates if a user is eligible to request a withdrawal.
     */
    validateWithdrawal(amount, availableBalance, kycStatus, minAmount = 1000.00) {
        if (kycStatus !== 'VERIFIED' && kycStatus !== 'APPROVED') {
            return { valid: false, error: 'KYC Verification is required before requesting withdrawals.' };
        }
        if (amount < minAmount) {
            return { valid: false, error: `Minimum withdrawal limit is LKR ${minAmount.toFixed(2)}.` };
        }
        if (amount > availableBalance) {
            return { valid: false, error: 'Insufficient wallet balance.' };
        }
        return { valid: true };
    },

    /**
     * Requests a withdrawal: Locks funds from available balance into withdrawal hold.
     */
    requestWithdrawal({
        userId,
        amount,
        withdrawalId,
        ledger = [],
        kycStatus = 'APPROVED',
        minAmount = 1000.00
    }) {
        const balances = this.calculateBalances(ledger, userId);
        const validation = this.validateWithdrawal(amount, balances.availableBalance, kycStatus, minAmount);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        return this.recordTransaction(ledger, {
            userId,
            walletType: 'WITHDRAWAL_HOLD',
            type: 'WITHDRAWAL_REQUEST',
            amount,
            direction: 'DEBIT',
            referenceType: 'WITHDRAWAL',
            referenceId: withdrawalId,
            idempotencyKey: `tx-wd-req-${withdrawalId}`,
            status: 'PENDING'
        });
    },

    /**
     * Marks a withdrawal as paid: Completes transfer from hold.
     */
    payoutWithdrawal({
        userId,
        amount,
        withdrawalId,
        ledger = []
    }) {
        return this.recordTransaction(ledger, {
            userId,
            walletType: 'WITHDRAWAL_HOLD',
            type: 'WITHDRAWAL_PAID',
            amount,
            direction: 'DEBIT',
            referenceType: 'WITHDRAWAL',
            referenceId: withdrawalId,
            idempotencyKey: `tx-wd-paid-${withdrawalId}`,
            status: 'COMPLETED'
        });
    },

    /**
     * Rejects / cancels a withdrawal: Unlocks funds back to available balance.
     */
    rejectWithdrawal({
        userId,
        amount,
        withdrawalId,
        reason = null,
        ledger = []
    }) {
        return this.recordTransaction(ledger, {
            userId,
            walletType: 'AVAILABLE',
            type: 'WITHDRAWAL_REJECTED',
            amount,
            direction: 'CREDIT',
            referenceType: 'WITHDRAWAL',
            referenceId: withdrawalId,
            description: reason,
            idempotencyKey: `tx-wd-rej-${withdrawalId}`,
            status: 'REVERSED'
        });
    },

    /**
     * Reverses a commission with compensating negative ledger entry.
     */
    reverseCommission({
        userId,
        amount,
        commissionType = 'DIRECT_COMMISSION',
        sourcePurchaseId = null,
        ledger = []
    }) {
        return this.recordTransaction(ledger, {
            userId,
            walletType: 'REVERSED',
            type: 'COMMISSION_REVERSAL',
            amount,
            direction: 'DEBIT',
            referenceType: 'REFUND',
            referenceId: sourcePurchaseId,
            idempotencyKey: `tx-comm-rev-${sourcePurchaseId}-${userId}`,
            status: 'REVERSED',
            allowNegative: true // Clawback can offset balances
        });
    }
};

if (typeof module !== 'undefined') {
    module.exports = WalletService;
}
