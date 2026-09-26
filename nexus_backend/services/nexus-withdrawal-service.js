/**
 * NEXUS PRIME (PVT) LTD — SECURE BANK WITHDRAWAL + ADMIN MANUAL PAYOUT SERVICE
 * System Architecture: Double-Entry Ledger Integration + Reservation Locks
 * Domain: nexusp.online
 *
 * Core Financial Principles:
 * 1. Available Balance = Ledger Balance - Active Reservations.
 * 2. Withdrawal Request reserves/locks funds; does NOT prematurely debit ledger.
 * 3. Status Pipeline: Pending -> Under Review -> Approved -> Processing -> Paid.
 * 4. Admin Manual Bank Payout: Bank transfer executed externally, confirmed with payout_reference.
 * 5. Atomic Double-Entry Debit created strictly upon "Mark as Paid".
 * 6. Rejection/Cancellation releases reservation with 0 ledger debit.
 * 7. Bank account numbers are strictly masked for privacy and security.
 */

const nexusDb = require('../db/nexus-db');
const NexusConfig = require('../config/nexus-config');
const nexusWalletService = require('./nexus-wallet-service');
const nexusEligibilityEngine = require('./nexus-eligibility-engine');

class NexusWithdrawalService {
    constructor() {
        this.defaultCurrency = 'LKR';
    }

    /**
     * Mask account number for security: ******7890
     */
    maskAccountNumber(accountNumber) {
        return nexusDb.maskAccountNumber(accountNumber);
    }

    // ============================================================
    // BANK ACCOUNT MANAGEMENT
    // ============================================================

    async createBankAccount({ memberId, bankName, branchName, branchCode, accountName, accountNumber, accountType, currency = 'LKR', isPrimary = false }) {
        if (!memberId) throw new Error('Bank Account Error: Member ID is required.');
        if (!bankName || !bankName.trim()) throw new Error('Bank Account Error: Bank name is required.');
        if (!branchName || !branchName.trim()) throw new Error('Bank Account Error: Branch name is required.');
        if (!accountName || !accountName.trim()) throw new Error('Bank Account Error: Account name is required.');
        if (!accountNumber || !accountNumber.trim()) throw new Error('Bank Account Error: Account number is required.');

        const cleanedNum = String(accountNumber).trim();
        if (cleanedNum.length < 5) {
            throw new Error('Bank Account Error: Account number must be at least 5 digits/characters.');
        }

        const validTypes = ['savings', 'current', 'other'];
        const type = validTypes.includes(accountType) ? accountType : 'savings';

        const created = await nexusDb.createBankAccount({
            member_id: memberId,
            bank_name: bankName.trim(),
            branch_name: branchName.trim(),
            branch_code: branchCode ? branchCode.trim() : '',
            account_name: accountName.trim(),
            account_number: cleanedNum,
            account_type: type,
            currency: currency || 'LKR',
            is_primary: Boolean(isPrimary)
        });

        const safe = { ...created };
        delete safe.account_number;
        return safe;
    }

    async getMemberBankAccounts(memberId, options = {}) {
        const accounts = await nexusDb.getMemberBankAccounts(memberId, options);
        return accounts.map(a => {
            const copy = { ...a };
            delete copy.account_number;
            return copy;
        });
    }

    async setPrimaryBankAccount(memberId, bankAccountId) {
        if (!memberId || !bankAccountId) throw new Error('Member ID and Bank Account ID are required.');
        const account = await nexusDb.setPrimaryBankAccount(memberId, bankAccountId);
        if (!account) return null;
        const copy = { ...account };
        delete copy.account_number;
        return copy;
    }

    async deactivateBankAccount(memberId, bankAccountId) {
        if (!memberId || !bankAccountId) throw new Error('Member ID and Bank Account ID are required.');
        const account = await nexusDb.deactivateBankAccount(bankAccountId, memberId);
        if (!account) return null;
        const copy = { ...account };
        delete copy.account_number;
        return copy;
    }

    // ============================================================
    // WITHDRAWAL OVERVIEW & RESERVATION CALCULATIONS
    // ============================================================

    async getMemberWithdrawalOverview(memberId) {
        const userId = nexusDb.resolveMemberUserId(memberId);
        const wallet = await nexusWalletService.getOrCreateWallet(userId, this.defaultCurrency);
        const ledgerBalance = await nexusWalletService.calculateAvailableBalance(wallet.id);
        const reservedAmount = await nexusDb.getMemberReservedWithdrawalAmount(userId);
        const availableForWithdrawal = Math.max(0, Math.round((ledgerBalance - reservedAmount) * 100) / 100);

        const memberWithdrawals = await nexusDb.getMemberWithdrawals(userId, { limit: 100 });
        let totalPaidAmount = 0;
        for (const w of memberWithdrawals.withdrawals) {
            if (w.status === 'paid') {
                totalPaidAmount += Math.round(parseFloat(w.requested_amount) * 100);
            }
        }

        const minThreshold = parseFloat(nexusDb.settings.get('min_withdrawal_amount')) || NexusConfig.MIN_WITHDRAWAL_AMOUNT_LKR;
        const maxThreshold = NexusConfig.MAX_WITHDRAWAL_AMOUNT_LKR;

        return {
            wallet_id: wallet.id,
            currency: wallet.currency,
            ledger_balance: ledgerBalance,
            reserved_amount: reservedAmount,
            available_balance: availableForWithdrawal,
            total_paid: totalPaidAmount / 100,
            min_threshold: minThreshold,
            max_threshold: maxThreshold,
            fee_type: NexusConfig.WITHDRAWAL_FEE_TYPE,
            fee_value: NexusConfig.WITHDRAWAL_FEE_VALUE,
            withdrawal_enabled: NexusConfig.WITHDRAWAL_ENABLED
        };
    }

    // ============================================================
    // WITHDRAWAL LIFECYCLE ACTIONS
    // ============================================================

    async requestWithdrawal(arg1, arg2) {
        let memberId, amount, bankAccountId, memberNote;
        if (typeof arg1 === 'object') {
            memberId = arg1.memberId || arg1.member_id;
            amount = arg1.amount;
            bankAccountId = arg1.bankAccountId || arg1.bank_account_id;
            memberNote = arg1.memberNote || arg1.member_note || '';
        } else {
            memberId = arg1;
            amount = typeof arg2 === 'object' ? arg2.amount : arg2;
            bankAccountId = typeof arg2 === 'object' ? (arg2.bankAccountId || arg2.bank_account_id) : arguments[2];
            memberNote = typeof arg2 === 'object' ? (arg2.memberNote || arg2.member_note || '') : arguments[3];
        }

        if (!NexusConfig.WITHDRAWAL_ENABLED) {
            throw new Error('Withdrawal Error: System withdrawals are currently disabled for maintenance.');
        }

        const userId = nexusDb.resolveMemberUserId(memberId);
        const profile = await nexusDb.findProfileByUserId(userId);
        if (!profile) throw new Error('Withdrawal Error: Member profile not found.');

        if (profile.status !== 'active') {
            throw new Error(`Account Standing Error: Cannot request withdrawal while account status is '${profile.status}'.`);
        }

        // KYC / Member Compliance Verification Gate (Prompt 18)
        if (nexusDb.settings.get('kyc_required_for_withdrawal') === 'true') {
            if (profile.verification_status !== 'verified') {
                throw new Error('Compliance Verification Error: Identity verification (KYC) is required before requesting a withdrawal. Please complete verification in your dashboard.');
            }
        }

        const numAmount = Math.round(parseFloat(amount) * 100) / 100;
        if (isNaN(numAmount) || numAmount <= 0) {
            throw new Error(`Financial Validation Error: Withdrawal amount must be strictly greater than 0.00 (received ${amount})`);
        }

        const minThreshold = parseFloat(nexusDb.settings.get('min_withdrawal_amount')) || NexusConfig.MIN_WITHDRAWAL_AMOUNT_LKR;
        if (numAmount < minThreshold) {
            throw new Error(`Financial Validation Error: Minimum withdrawal threshold is LKR ${minThreshold.toFixed(2)}. Requested amount LKR ${numAmount.toFixed(2)} is below minimum withdrawal limit.`);
        }

        if (NexusConfig.MAX_WITHDRAWAL_AMOUNT_LKR && numAmount > NexusConfig.MAX_WITHDRAWAL_AMOUNT_LKR) {
            throw new Error(`Financial Validation Error: Maximum withdrawal ceiling of LKR ${NexusConfig.MAX_WITHDRAWAL_AMOUNT_LKR.toFixed(2)} exceeded.`);
        }

        // Auto-select primary active bank account if not specified
        if (!bankAccountId) {
            const memberBanks = await nexusDb.getMemberBankAccounts(userId, { activeOnly: true });
            if (memberBanks.length > 0) {
                bankAccountId = memberBanks[0].id;
            }
        }

        // Validate bank account
        if (!bankAccountId) throw new Error('Bank Account Error: Please select or add an active bank account.');
        const bankAccount = await nexusDb.getBankAccountById(bankAccountId);
        if (!bankAccount || bankAccount.member_id !== userId) {
            throw new Error('Bank Account Error: Selected bank account does not belong to your profile.');
        }
        if (bankAccount.status !== 'active') {
            throw new Error('Bank Account Error: Selected bank account is inactive.');
        }

        // Wallet and Balance Verification with Reservation Locks
        const wallet = await nexusWalletService.getOrCreateWallet(userId, bankAccount.currency || 'LKR');
        const ledgerBalance = await nexusWalletService.calculateAvailableBalance(wallet.id);
        const currentReserved = await nexusDb.getMemberReservedWithdrawalAmount(userId);
        const availableBalance = Math.round((ledgerBalance - currentReserved) * 100) / 100;

        if (numAmount > availableBalance) {
            throw new Error(`INSUFFICIENT_FUNDS: Insufficient available balance. Available payout balance LKR ${availableBalance.toFixed(2)} is insufficient for requested withdrawal of LKR ${numAmount.toFixed(2)} (Ledger: LKR ${ledgerBalance.toFixed(2)}, Already Reserved: LKR ${currentReserved.toFixed(2)}).`);
        }

        // Calculate Fee
        let feeAmount = 0.00;
        if (NexusConfig.WITHDRAWAL_FEE_TYPE === 'fixed') {
            feeAmount = Math.round(parseFloat(NexusConfig.WITHDRAWAL_FEE_VALUE) * 100) / 100;
        } else if (NexusConfig.WITHDRAWAL_FEE_TYPE === 'percentage') {
            feeAmount = Math.round((numAmount * parseFloat(NexusConfig.WITHDRAWAL_FEE_VALUE) / 100) * 100) / 100;
        }
        const netAmount = Math.max(0, Math.round((numAmount - feeAmount) * 100) / 100);

        // Point-in-time immutable bank snapshot
        const bankSnapshot = {
            id: bankAccount.id,
            bank_name: bankAccount.bank_name,
            branch_name: bankAccount.branch_name,
            branch_code: bankAccount.branch_code,
            account_name: bankAccount.account_name,
            account_number_masked: bankAccount.account_number_masked,
            account_type: bankAccount.account_type,
            currency: bankAccount.currency
        };

        const withdrawal = await nexusDb.createWithdrawal({
            member_id: userId,
            wallet_id: wallet.id,
            bank_account_id: bankAccount.id,
            requested_amount: numAmount,
            fee_amount: feeAmount,
            net_amount: netAmount,
            currency: wallet.currency,
            status: 'pending',
            bank_snapshot: bankSnapshot,
            member_note: memberNote ? String(memberNote).trim() : null
        });

        // Dispatch in-app notification
        await nexusDb.insertNotification({
            user_id: userId,
            title: 'Withdrawal Request Submitted',
            message: `Your withdrawal request ${withdrawal.withdrawal_number} for LKR ${numAmount.toFixed(2)} to ${bankAccount.bank_name} has been received and is pending administrative review.`,
            type: 'WITHDRAWAL_CREATED',
            data: {
                withdrawal_id: withdrawal.id,
                withdrawal_number: withdrawal.withdrawal_number,
                amount: numAmount
            }
        });

        return {
            success: true,
            withdrawal,
            balance_summary: {
                ledger_balance: ledgerBalance,
                new_reserved_amount: Math.round((currentReserved + numAmount) * 100) / 100,
                new_available_balance: Math.round((availableBalance - numAmount) * 100) / 100
            }
        };
    }

    async cancelWithdrawal(arg1, arg2, arg3) {
        let withdrawalId, memberId, reason;
        if (typeof arg1 === 'object') {
            withdrawalId = arg1.withdrawalId || arg1.withdrawal_id;
            memberId = arg1.memberId || arg1.member_id;
            reason = arg1.reason || arg1.member_note || 'Member requested cancellation';
        } else {
            withdrawalId = arg1;
            memberId = arg2;
            reason = arg3 || 'Member requested cancellation';
        }

        const userId = nexusDb.resolveMemberUserId(memberId);
        const withdrawal = await nexusDb.getWithdrawalById(withdrawalId);
        if (!withdrawal) throw new Error(`Withdrawal ${withdrawalId} not found.`);

        if (withdrawal.member_id !== userId) {
            throw new Error('Access Denied: You cannot cancel another member\'s withdrawal.');
        }

        if (withdrawal.status !== 'pending') {
            throw new Error(`Invalid Operation: Cannot cancel withdrawal in '${withdrawal.status}' status. Only 'pending' requests can be cancelled.`);
        }

        const updated = await nexusDb.updateWithdrawalStatus(withdrawalId, 'cancelled', {
            member_note: reason
        });

        await nexusDb.insertAuditLog({
            actor_id: userId,
            actor_role: 'member',
            action: 'WITHDRAWAL_CANCELLED',
            target_id: withdrawalId,
            details: {
                withdrawal_number: withdrawal.withdrawal_number,
                released_amount: withdrawal.requested_amount,
                reason
            }
        });

        await nexusDb.insertNotification({
            user_id: userId,
            title: 'Withdrawal Cancelled',
            message: `Your withdrawal request ${withdrawal.withdrawal_number} has been cancelled. Reserved amount LKR ${withdrawal.requested_amount.toFixed(2)} has been released back to your available balance.`,
            type: 'WITHDRAWAL_CANCELLED',
            data: { withdrawal_id: withdrawal.id }
        });

        return { success: true, withdrawal: updated };
    }

    async reviewWithdrawal(arg1, arg2, arg3) {
        let withdrawalId, adminUser, adminNote;
        if (typeof arg1 === 'object') {
            withdrawalId = arg1.withdrawalId || arg1.withdrawal_id;
            adminUser = arg1.adminUser || arg1.admin_user || { id: 'admin' };
            adminNote = arg1.adminNote || arg1.admin_note || arg1.notes || '';
        } else {
            withdrawalId = arg1;
            adminUser = typeof arg2 === 'object' ? arg2 : { id: arg2 || 'admin' };
            adminNote = arg3 || '';
        }

        const withdrawal = await nexusDb.getWithdrawalById(withdrawalId);
        if (!withdrawal) throw new Error(`Withdrawal ${withdrawalId} not found.`);

        if (withdrawal.status !== 'pending') {
            throw new Error(`Invalid State Transition: Cannot move withdrawal to 'under_review' from status '${withdrawal.status}'.`);
        }

        const updated = await nexusDb.updateWithdrawalStatus(withdrawalId, 'under_review', {
            admin_note: adminNote ? adminNote.trim() : withdrawal.admin_note
        });

        await nexusDb.insertAuditLog({
            actor_id: adminUser.id || 'admin',
            actor_role: 'admin',
            action: 'WITHDRAWAL_REVIEW_STARTED',
            target_id: withdrawalId,
            details: {
                withdrawal_number: withdrawal.withdrawal_number,
                previous_status: 'pending',
                admin_note: adminNote
            }
        });

        return { success: true, withdrawal: updated };
    }

    async approveWithdrawal(arg1, arg2, arg3) {
        let withdrawalId, adminUser, adminNote;
        if (typeof arg1 === 'object') {
            withdrawalId = arg1.withdrawalId || arg1.withdrawal_id;
            adminUser = arg1.adminUser || arg1.admin_user || { id: 'admin' };
            adminNote = arg1.adminNote || arg1.admin_note || arg1.notes || '';
        } else {
            withdrawalId = arg1;
            adminUser = typeof arg2 === 'object' ? arg2 : { id: arg2 || 'admin' };
            adminNote = arg3 || '';
        }

        const withdrawal = await nexusDb.getWithdrawalById(withdrawalId);
        if (!withdrawal) throw new Error(`Withdrawal ${withdrawalId} not found.`);

        if (withdrawal.status !== 'pending' && withdrawal.status !== 'under_review') {
            throw new Error(`Invalid State Transition: Cannot approve withdrawal from status '${withdrawal.status}'. Must be in 'pending' or 'under_review'.`);
        }

        const now = new Date().toISOString();
        const updated = await nexusDb.updateWithdrawalStatus(withdrawalId, 'approved', {
            approved_by: adminUser.id || 'admin',
            approved_at: now,
            admin_note: adminNote ? adminNote.trim() : withdrawal.admin_note
        });

        await nexusDb.insertAuditLog({
            actor_id: adminUser.id || 'admin',
            actor_role: 'admin',
            action: 'WITHDRAWAL_APPROVED',
            target_id: withdrawalId,
            details: {
                withdrawal_number: withdrawal.withdrawal_number,
                approved_amount: withdrawal.requested_amount,
                previous_status: withdrawal.status
            }
        });

        await nexusDb.insertNotification({
            user_id: withdrawal.member_id,
            title: 'Withdrawal Approved',
            message: `Your withdrawal request ${withdrawal.withdrawal_number} for LKR ${withdrawal.requested_amount.toFixed(2)} has been approved and queued for manual bank transfer.`,
            type: 'WITHDRAWAL_APPROVED',
            data: { withdrawal_id: withdrawal.id }
        });

        return { success: true, withdrawal: updated };
    }

    async markProcessing(arg1, arg2, arg3) {
        let withdrawalId, adminUser, adminNote;
        if (typeof arg1 === 'object') {
            withdrawalId = arg1.withdrawalId || arg1.withdrawal_id;
            adminUser = arg1.adminUser || arg1.admin_user || { id: 'admin' };
            adminNote = arg1.adminNote || arg1.admin_note || arg1.notes || '';
        } else {
            withdrawalId = arg1;
            adminUser = typeof arg2 === 'object' ? arg2 : { id: arg2 || 'admin' };
            adminNote = arg3 || '';
        }

        const withdrawal = await nexusDb.getWithdrawalById(withdrawalId);
        if (!withdrawal) throw new Error(`Withdrawal ${withdrawalId} not found.`);

        if (withdrawal.status !== 'approved') {
            throw new Error(`Invalid State Transition: Cannot mark processing from status '${withdrawal.status}'. Must be 'approved'.`);
        }

        const updated = await nexusDb.updateWithdrawalStatus(withdrawalId, 'processing', {
            admin_note: adminNote ? adminNote.trim() : withdrawal.admin_note
        });

        await nexusDb.insertAuditLog({
            actor_id: adminUser.id || 'admin',
            actor_role: 'admin',
            action: 'WITHDRAWAL_PROCESSING',
            target_id: withdrawalId,
            details: {
                withdrawal_number: withdrawal.withdrawal_number,
                previous_status: 'approved'
            }
        });

        await nexusDb.insertNotification({
            user_id: withdrawal.member_id,
            title: 'Withdrawal Processing',
            message: `Bank disbursement for ${withdrawal.withdrawal_number} is actively being transferred.`,
            type: 'WITHDRAWAL_PROCESSING',
            data: { withdrawal_id: withdrawal.id }
        });

        return { success: true, withdrawal: updated };
    }

    async markAsPaid(arg1, arg2, arg3, arg4) {
        let withdrawalId, adminUser, payoutReference, payoutNote, paidAt;
        if (typeof arg1 === 'object') {
            withdrawalId = arg1.withdrawalId || arg1.withdrawal_id;
            adminUser = arg1.adminUser || arg1.admin_user || { id: 'admin' };
            payoutReference = arg1.payoutReference || arg1.payout_reference;
            payoutNote = arg1.payoutNote || arg1.payout_note || arg1.notes || '';
            paidAt = arg1.paidAt || arg1.paid_at || null;
        } else {
            withdrawalId = arg1;
            if (typeof arg2 === 'object') {
                adminUser = arg2.adminUser || arg2.admin_user || { id: arg2.paid_by || 'admin' };
                payoutReference = arg2.payoutReference || arg2.payout_reference;
                payoutNote = arg2.payoutNote || arg2.payout_note || arg2.notes || '';
                paidAt = arg2.paidAt || arg2.paid_at || null;
            } else {
                payoutReference = arg2;
                adminUser = typeof arg3 === 'object' ? arg3 : { id: arg3 || 'admin' };
                paidAt = arg4 || null;
            }
        }

        const withdrawal = await nexusDb.getWithdrawalById(withdrawalId);
        if (!withdrawal) throw new Error(`Withdrawal ${withdrawalId} not found.`);

        // Idempotency check: If already paid with identical reference, return idempotently
        if (withdrawal.status === 'paid') {
            if (withdrawal.payout_reference === payoutReference) {
                return {
                    success: true,
                    idempotent: true,
                    withdrawal,
                    message: 'Withdrawal already marked as paid with this reference.'
                };
            }
            throw new Error(`Withdrawal ${withdrawal.withdrawal_number} is already paid with reference '${withdrawal.payout_reference}'. Duplicate payment confirmation rejected.`);
        }

        if (withdrawal.status !== 'approved' && withdrawal.status !== 'processing') {
            throw new Error(`Invalid State Transition: Cannot mark withdrawal as paid from status '${withdrawal.status}'. Must be 'approved' or 'processing'.`);
        }

        if (!payoutReference || !payoutReference.trim()) {
            throw new Error('Compliance Error: External Bank Payout Reference (e.g. BANK-TRX-...) is mandatory to confirm payout.');
        }

        const cleanRef = payoutReference.trim();
        const now = paidAt ? new Date(paidAt).toISOString() : new Date().toISOString();

        // 1. Post Atomic Double-Entry Ledger DEBIT via NexusWalletService
        const ledgerEntry = await nexusWalletService.postDebit({
            walletId: withdrawal.wallet_id,
            memberId: withdrawal.member_id,
            entryType: 'withdrawal',
            amount: withdrawal.requested_amount,
            currency: withdrawal.currency,
            referenceType: 'withdrawal',
            referenceId: withdrawal.id,
            description: `Bank Withdrawal Payout - ${withdrawal.withdrawal_number} (Ref: ${cleanRef})`,
            metadata: {
                payout_reference: cleanRef,
                withdrawal_number: withdrawal.withdrawal_number,
                bank_name: withdrawal.bank_snapshot.bank_name,
                account_name: withdrawal.bank_snapshot.account_name,
                account_number_masked: withdrawal.bank_snapshot.account_number_masked
            },
            actor: adminUser
        });

        // 2. Update Withdrawal Record to 'paid'
        const updated = await nexusDb.updateWithdrawalStatus(withdrawalId, 'paid', {
            paid_by: adminUser.id || 'admin',
            paid_at: now,
            payout_reference: cleanRef,
            payout_note: payoutNote ? payoutNote.trim() : null,
            ledger_entry_id: ledgerEntry.id
        });

        // 3. Emit Audit Log
        await nexusDb.insertAuditLog({
            actor_id: adminUser.id || 'admin',
            actor_role: 'admin',
            action: 'WITHDRAWAL_PAID',
            target_id: withdrawalId,
            details: {
                withdrawal_number: withdrawal.withdrawal_number,
                amount: withdrawal.requested_amount,
                currency: withdrawal.currency,
                payout_reference: cleanRef,
                ledger_entry_id: ledgerEntry.id,
                bank_name: withdrawal.bank_snapshot.bank_name,
                account_number_masked: withdrawal.bank_snapshot.account_number_masked
            }
        });

        // 4. Emit Member Notification
        await nexusDb.insertNotification({
            user_id: withdrawal.member_id,
            title: 'Withdrawal Payout Completed',
            message: `Your withdrawal ${withdrawal.withdrawal_number} for LKR ${withdrawal.requested_amount.toFixed(2)} has been successfully transferred to your ${withdrawal.bank_snapshot.bank_name} account. Bank Reference: ${cleanRef}`,
            type: 'WITHDRAWAL_PAID',
            data: {
                withdrawal_id: withdrawal.id,
                withdrawal_number: withdrawal.withdrawal_number,
                amount: withdrawal.requested_amount,
                payout_reference: cleanRef
            }
        });

        return {
            success: true,
            idempotent: false,
            withdrawal: updated,
            ledger_entry: ledgerEntry
        };
    }

    async rejectWithdrawal(arg1, arg2, arg3) {
        let withdrawalId, adminUser, rejectionReason;
        if (typeof arg1 === 'object') {
            withdrawalId = arg1.withdrawalId || arg1.withdrawal_id;
            adminUser = arg1.adminUser || arg1.admin_user || { id: 'admin' };
            rejectionReason = arg1.rejectionReason || arg1.rejection_reason || arg1.reason || '';
        } else {
            withdrawalId = arg1;
            if (typeof arg2 === 'object') {
                adminUser = arg2.adminUser || arg2.admin_user || { id: 'admin' };
                rejectionReason = arg2.rejectionReason || arg2.rejection_reason || arg2.reason || '';
            } else {
                rejectionReason = arg2;
                adminUser = typeof arg3 === 'object' ? arg3 : { id: arg3 || 'admin' };
            }
        }

        const withdrawal = await nexusDb.getWithdrawalById(withdrawalId);
        if (!withdrawal) throw new Error(`Withdrawal ${withdrawalId} not found.`);

        if (!rejectionReason || !rejectionReason.trim()) {
            throw new Error('Compliance Error: Rejection reason is mandatory when declining a withdrawal request.');
        }

        const validPreStatuses = ['pending', 'under_review', 'approved'];
        if (!validPreStatuses.includes(withdrawal.status)) {
            throw new Error(`Invalid State Transition: Cannot reject withdrawal in status '${withdrawal.status}'.`);
        }

        const reason = rejectionReason.trim();
        const updated = await nexusDb.updateWithdrawalStatus(withdrawalId, 'rejected', {
            rejection_reason: reason,
            admin_note: `Rejected: ${reason}`
        });

        await nexusDb.insertAuditLog({
            actor_id: adminUser.id || 'admin',
            actor_role: 'admin',
            action: 'WITHDRAWAL_REJECTED',
            target_id: withdrawalId,
            details: {
                withdrawal_number: withdrawal.withdrawal_number,
                rejection_reason: reason,
                released_amount: withdrawal.requested_amount
            }
        });

        await nexusDb.insertNotification({
            user_id: withdrawal.member_id,
            title: 'Withdrawal Request Rejected',
            message: `Your withdrawal request ${withdrawal.withdrawal_number} was rejected. Reason: ${reason}. The reserved amount LKR ${withdrawal.requested_amount.toFixed(2)} has been restored to your available balance.`,
            type: 'WITHDRAWAL_REJECTED',
            data: { withdrawal_id: withdrawal.id, reason }
        });

        return { success: true, withdrawal: updated };
    }

    async failPayout(arg1, arg2, arg3) {
        let withdrawalId, adminUser, failureReason;
        if (typeof arg1 === 'object') {
            withdrawalId = arg1.withdrawalId || arg1.withdrawal_id;
            adminUser = arg1.adminUser || arg1.admin_user || { id: 'admin' };
            failureReason = arg1.failureReason || arg1.failure_reason || '';
        } else {
            withdrawalId = arg1;
            if (typeof arg2 === 'object') {
                adminUser = arg2.adminUser || arg2.admin_user || { id: 'admin' };
                failureReason = arg2.failureReason || arg2.failure_reason || '';
            } else {
                failureReason = arg2;
                adminUser = typeof arg3 === 'object' ? arg3 : { id: arg3 || 'admin' };
            }
        }

        const withdrawal = await nexusDb.getWithdrawalById(withdrawalId);
        if (!withdrawal) throw new Error(`Withdrawal ${withdrawalId} not found.`);

        if (withdrawal.status !== 'processing') {
            throw new Error(`Invalid State Transition: Payout failure can only be recorded from 'processing' status (current: '${withdrawal.status}').`);
        }

        const reason = failureReason ? failureReason.trim() : 'Bank transfer rejected or bounced';

        const updated = await nexusDb.updateWithdrawalStatus(withdrawalId, 'failed', {
            rejection_reason: reason,
            admin_note: `Failed: ${reason}`
        });

        await nexusDb.insertAuditLog({
            actor_id: adminUser.id || 'admin',
            actor_role: 'admin',
            action: 'WITHDRAWAL_FAILED',
            target_id: withdrawalId,
            details: {
                withdrawal_number: withdrawal.withdrawal_number,
                failure_reason: reason
            }
        });

        await nexusDb.insertNotification({
            user_id: withdrawal.member_id,
            title: 'Withdrawal Transfer Failed',
            message: `Bank transfer for withdrawal ${withdrawal.withdrawal_number} could not be completed. Reason: ${reason}. Our team is reviewing this item.`,
            type: 'WITHDRAWAL_FAILED',
            data: { withdrawal_id: withdrawal.id, reason }
        });

        return { success: true, withdrawal: updated };
    }

    async reconcileWithdrawals() {
        return nexusDb.getWithdrawalsReconciliation();
    }

    /**
     * Check withdrawal compliance & eligibility standing (Prompt 18 & 19 Centralized Engine)
     */
    async checkWithdrawalEligibility(memberId) {
        return nexusEligibilityEngine.checkWithdrawalEligibility(memberId);
    }
}

// Global Singleton Instance
const nexusWithdrawalService = new NexusWithdrawalService();

module.exports = nexusWithdrawalService;
