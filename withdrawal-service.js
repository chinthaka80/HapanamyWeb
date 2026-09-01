// Hapanamy.lk Member Withdrawal Management Engine (STEP 24)
// End-to-end bank withdrawal lifecycle, KYC/Bank validation, fund locking (WITHDRAWAL_HOLD),
// payout settlement, rejection refunds, audit trail logging, and concurrency race-condition guards.

const crypto = require('crypto');
const WalletService = require('./wallet-service');

const DEFAULT_WITHDRAWAL_CONFIG = {
    min_withdrawal_amount: 1000.00,
    max_withdrawal_amount: 100000.00,
    require_approved_kyc: true,
    daily_withdrawal_limit: 200000.00
};

const WithdrawalService = {
    _withdrawals: [],
    _auditLogs: [],
    _userLocks: new Set(),

    /**
     * Submits a member bank withdrawal request.
     */
    requestWithdrawal({
        userId,
        amount,
        bankDetails, // { account_holder_name, bank_name, branch, account_number }
        userStatus = 'ACTIVE',
        kycStatus = 'APPROVED',
        walletLedger = [],
        withdrawalsList = null,
        config = DEFAULT_WITHDRAWAL_CONFIG
    }) {
        if (!userId) throw new Error('User ID is required.');
        if (!bankDetails || !bankDetails.account_number || !bankDetails.bank_name) {
            throw new Error('Valid bank details (Bank Name and Account Number) are required.');
        }

        if (userStatus === 'SUSPENDED' || userStatus === 'BANNED') {
            throw new Error(`Cannot request withdrawal for ${userStatus} member.`);
        }

        if (config.require_approved_kyc && kycStatus !== 'APPROVED' && kycStatus !== 'VERIFIED') {
            throw new Error('Approved KYC verification is required before requesting bank withdrawals.');
        }

        const numAmount = Number(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            throw new Error('Invalid withdrawal amount.');
        }

        if (numAmount < config.min_withdrawal_amount) {
            throw new Error(`Minimum withdrawal limit is LKR ${config.min_withdrawal_amount.toFixed(2)}.`);
        }

        if (numAmount > config.max_withdrawal_amount) {
            throw new Error(`Maximum single withdrawal limit is LKR ${config.max_withdrawal_amount.toFixed(2)}.`);
        }

        const lockKey = `lock-wd-user-${userId}`;
        if (this._userLocks.has(lockKey)) {
            throw new Error(`Concurrent withdrawal request in progress for user ${userId}`);
        }

        this._userLocks.add(lockKey);

        try {
            const currentBalances = WalletService.calculateBalances(walletLedger, userId);
            if (numAmount > currentBalances.availableBalance) {
                throw new Error(`Insufficient wallet balance. Available: LKR ${currentBalances.availableBalance.toFixed(2)}, Requested: LKR ${numAmount.toFixed(2)}.`);
            }

            const withdrawalId = 'wd-req-' + crypto.randomBytes(8).toString('hex');
            const targetList = withdrawalsList || this._withdrawals;

            // 1. Lock funds into WITHDRAWAL_HOLD via WalletService
            WalletService.requestWithdrawal({
                userId,
                amount: numAmount,
                withdrawalId,
                ledger: walletLedger,
                kycStatus,
                minAmount: config.min_withdrawal_amount
            });

            // 2. Create Withdrawal Record
            const withdrawalRecord = {
                id: withdrawalId,
                user_id: userId,
                amount: numAmount,
                bank_details: { ...bankDetails },
                status: 'PENDING',
                bank_transfer_reference: null,
                payment_proof_storage_key: null,
                rejection_reason: null,
                admin_notes: null,
                reviewed_by: null,
                reviewed_at: null,
                paid_at: null,
                created_at: new Date().toISOString()
            };

            targetList.push(withdrawalRecord);

            // 3. Record Audit Log
            const auditEntry = {
                id: 'audit-wd-' + crypto.randomBytes(8).toString('hex'),
                user_id: userId,
                action: 'WITHDRAWAL_REQUESTED',
                entity_type: 'withdrawal',
                entity_id: withdrawalId,
                amount: numAmount,
                status: 'PENDING',
                created_at: new Date().toISOString()
            };
            this._auditLogs.push(auditEntry);

            return {
                success: true,
                withdrawal_id: withdrawalId,
                amount: numAmount,
                status: 'PENDING',
                withdrawal: withdrawalRecord
            };

        } finally {
            this._userLocks.delete(lockKey);
        }
    },

    /**
     * Admin approves withdrawal request for batch processing.
     */
    approveWithdrawal({
        withdrawalId,
        adminUserId = 'admin',
        adminNotes = null,
        withdrawalsList = null
    }) {
        const list = withdrawalsList || this._withdrawals;
        const record = list.find(w => w.id === withdrawalId);

        if (!record) throw new Error(`Withdrawal request ${withdrawalId} not found.`);
        if (record.status !== 'PENDING' && record.status !== 'UNDER_REVIEW') {
            throw new Error(`Cannot approve withdrawal in '${record.status}' status.`);
        }

        record.status = 'APPROVED';
        record.reviewed_by = adminUserId;
        record.reviewed_at = new Date().toISOString();
        record.admin_notes = adminNotes;

        const auditEntry = {
            id: 'audit-wd-' + crypto.randomBytes(8).toString('hex'),
            user_id: adminUserId,
            action: 'WITHDRAWAL_APPROVED',
            entity_type: 'withdrawal',
            entity_id: withdrawalId,
            notes: adminNotes,
            created_at: new Date().toISOString()
        };
        this._auditLogs.push(auditEntry);

        return { success: true, withdrawal_id: withdrawalId, status: 'APPROVED' };
    },

    /**
     * Admin marks withdrawal as PAID after bank transfer execution.
     */
    markPaid({
        withdrawalId,
        bankTransferReference,
        paymentProofStorageKey = null,
        adminUserId = 'admin',
        adminNotes = null,
        walletLedger = [],
        withdrawalsList = null
    }) {
        if (!bankTransferReference) {
            throw new Error('Bank transfer reference is mandatory when marking a withdrawal as paid.');
        }

        const list = withdrawalsList || this._withdrawals;
        const record = list.find(w => w.id === withdrawalId);

        if (!record) throw new Error(`Withdrawal request ${withdrawalId} not found.`);
        if (record.status === 'PAID') {
            throw new Error(`Withdrawal ${withdrawalId} is already marked as PAID.`);
        }
        if (record.status === 'REJECTED' || record.status === 'CANCELLED') {
            throw new Error(`Cannot pay a ${record.status} withdrawal.`);
        }

        // 1. Finalize deduction from hold via WalletService
        WalletService.payoutWithdrawal({
            userId: record.user_id,
            amount: record.amount,
            withdrawalId,
            ledger: walletLedger
        });

        // 2. Update Record
        record.status = 'PAID';
        record.bank_transfer_reference = bankTransferReference.trim();
        record.payment_proof_storage_key = paymentProofStorageKey;
        record.paid_at = new Date().toISOString();
        record.reviewed_by = adminUserId;
        record.admin_notes = adminNotes;

        // 3. Record Audit Log
        const auditEntry = {
            id: 'audit-wd-' + crypto.randomBytes(8).toString('hex'),
            user_id: adminUserId,
            action: 'WITHDRAWAL_PAID',
            entity_type: 'withdrawal',
            entity_id: withdrawalId,
            reference: bankTransferReference,
            created_at: new Date().toISOString()
        };
        this._auditLogs.push(auditEntry);

        return {
            success: true,
            withdrawal_id: withdrawalId,
            status: 'PAID',
            bank_transfer_reference: bankTransferReference
        };
    },

    /**
     * Admin rejects withdrawal and releases funds back to available wallet.
     */
    rejectWithdrawal({
        withdrawalId,
        rejectionReason,
        adminUserId = 'admin',
        walletLedger = [],
        withdrawalsList = null
    }) {
        if (!rejectionReason) {
            throw new Error('Rejection reason is required.');
        }

        const list = withdrawalsList || this._withdrawals;
        const record = list.find(w => w.id === withdrawalId);

        if (!record) throw new Error(`Withdrawal request ${withdrawalId} not found.`);
        if (record.status === 'PAID') {
            throw new Error('Cannot reject an already PAID withdrawal.');
        }
        if (record.status === 'REJECTED') {
            throw new Error('Withdrawal is already REJECTED.');
        }

        // 1. Release funds back to Available Wallet
        WalletService.rejectWithdrawal({
            userId: record.user_id,
            amount: record.amount,
            withdrawalId,
            reason: rejectionReason,
            ledger: walletLedger
        });

        // 2. Update Record
        record.status = 'REJECTED';
        record.rejection_reason = rejectionReason;
        record.reviewed_by = adminUserId;
        record.reviewed_at = new Date().toISOString();

        // 3. Record Audit Log
        const auditEntry = {
            id: 'audit-wd-' + crypto.randomBytes(8).toString('hex'),
            user_id: adminUserId,
            action: 'WITHDRAWAL_REJECTED',
            entity_type: 'withdrawal',
            entity_id: withdrawalId,
            reason: rejectionReason,
            created_at: new Date().toISOString()
        };
        this._auditLogs.push(auditEntry);

        return {
            success: true,
            withdrawal_id: withdrawalId,
            status: 'REJECTED',
            rejection_reason: rejectionReason
        };
    },

    /**
     * Member cancels pending withdrawal request.
     */
    cancelWithdrawal({
        withdrawalId,
        userId,
        walletLedger = [],
        withdrawalsList = null
    }) {
        const list = withdrawalsList || this._withdrawals;
        const record = list.find(w => w.id === withdrawalId && w.user_id === userId);

        if (!record) throw new Error(`Pending withdrawal ${withdrawalId} not found for user ${userId}.`);
        if (record.status !== 'PENDING') {
            throw new Error(`Only PENDING withdrawals can be cancelled (Current Status: ${record.status}).`);
        }

        // 1. Release funds back to Available Wallet
        WalletService.rejectWithdrawal({
            userId,
            amount: record.amount,
            withdrawalId,
            reason: 'Cancelled by member',
            ledger: walletLedger
        });

        // 2. Update Record
        record.status = 'CANCELLED';
        record.reviewed_at = new Date().toISOString();

        return {
            success: true,
            withdrawal_id: withdrawalId,
            status: 'CANCELLED'
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = WithdrawalService;
}
