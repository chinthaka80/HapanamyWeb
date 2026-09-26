/**
 * NEXUS PRIME (PVT) LTD — WALLET & FINANCIAL LEDGER SERVICE
 * System Architecture: Double-Entry Immutable Ledger
 * Domain: nexusp.online
 *
 * Core Financial Principle:
 * The financial source of truth is the immutable ledger.
 * Available Balance = Sum(Posted Credits) - Sum(Posted Debits).
 * Balances are never modified directly on member profile records.
 */

const nexusDb = require('../db/nexus-db');

class NexusWalletService {
    constructor() {
        this.defaultCurrency = 'LKR';
    }

    /**
     * Get or provision a member's authoritative wallet
     */
    async getOrCreateWallet(memberId, currency = 'LKR') {
        if (!memberId) {
            throw new Error('Wallet Service Error: Member ID is required.');
        }
        return nexusDb.getOrCreateWallet(memberId, currency);
    }

    /**
     * Calculate authoritative available balance from ledger entries
     */
    async calculateAvailableBalance(walletId) {
        if (!walletId) {
            throw new Error('Wallet Service Error: Wallet ID is required.');
        }
        const stats = await nexusDb.getWalletLedgerBalance(walletId);
        return stats.availableBalance;
    }

    /**
     * Get complete balance breakdown
     */
    async getWalletBalanceStats(walletId) {
        if (!walletId) {
            throw new Error('Wallet Service Error: Wallet ID is required.');
        }
        return nexusDb.getWalletLedgerBalance(walletId);
    }

    /**
     * Post an authoritative CREDIT to a member's wallet ledger
     */
    async postCredit(params = {}) {
        const walletId = params.walletId || params.wallet_id;
        const memberId = params.memberId || params.member_id;
        const entryType = params.entryType || params.entry_type || 'adjustment';
        const amount = params.amount;
        const currency = params.currency || 'LKR';
        const referenceType = params.referenceType || params.reference_type || 'manual';
        const referenceId = params.referenceId || params.reference_id || `ref-${Date.now()}`;
        const description = params.description || 'Ledger credit posted';
        const metadata = params.metadata || {};
        const actor = params.actor || null;

        let targetWalletId = walletId;
        if (!targetWalletId && memberId) {
            const wallet = await this.getOrCreateWallet(memberId, currency);
            targetWalletId = wallet.id;
        }

        const numAmount = Math.round(parseFloat(amount) * 100) / 100;
        if (isNaN(numAmount) || numAmount <= 0) {
            throw new Error(`Financial Validation Error: Credit amount must be strictly greater than 0.00 (received ${amount})`);
        }

        const result = await nexusDb.createLedgerEntry({
            wallet_id: targetWalletId,
            member_id: memberId,
            entry_type: entryType || 'adjustment',
            direction: 'CREDIT',
            amount: numAmount,
            currency,
            reference_type: referenceType || 'manual',
            reference_id: referenceId || `ref-${Date.now()}`,
            description: description || 'Ledger credit posted',
            metadata
        });

        if (!result.idempotent && actor) {
            await nexusDb.insertAuditLog({
                actor_id: actor.id || actor.user_id || 'system',
                actor_role: actor.role || 'admin',
                action: 'WALLET_CREDIT_POSTED',
                target_id: result.entry.id,
                details: {
                    wallet_id: targetWalletId,
                    entry_reference: result.entry.entry_reference,
                    amount: numAmount,
                    currency,
                    reference_type: referenceType,
                    reference_id: referenceId
                }
            });
        }

        return {
            ...result.entry,
            entry: result.entry,
            idempotent: result.idempotent
        };
    }

    /**
     * Post an authoritative DEBIT from a member's wallet ledger
     * Enforces Negative Balance Protection: Available Balance >= requested debit.
     */
    async postDebit(params = {}) {
        const walletId = params.walletId || params.wallet_id;
        const memberId = params.memberId || params.member_id;
        const entryType = params.entryType || params.entry_type || 'withdrawal';
        const amount = params.amount;
        const currency = params.currency || 'LKR';
        const referenceType = params.referenceType || params.reference_type || 'manual';
        const referenceId = params.referenceId || params.reference_id || `ref-${Date.now()}`;
        const description = params.description || 'Ledger debit posted';
        const metadata = params.metadata || {};
        const actor = params.actor || null;

        let targetWalletId = walletId;
        if (!targetWalletId && memberId) {
            const wallet = await this.getOrCreateWallet(memberId, currency);
            targetWalletId = wallet.id;
        }

        const numAmount = Math.round(parseFloat(amount) * 100) / 100;
        if (isNaN(numAmount) || numAmount <= 0) {
            throw new Error(`Financial Validation Error: Debit amount must be strictly greater than 0.00 (received ${amount})`);
        }

        // Available balance validation
        const currentBalance = await this.calculateAvailableBalance(targetWalletId);
        if (currentBalance < numAmount) {
            throw new Error(`INSUFFICIENT_FUNDS: Available balance LKR ${currentBalance.toFixed(2)} is insufficient for requested debit of LKR ${numAmount.toFixed(2)}.`);
        }

        const result = await nexusDb.createLedgerEntry({
            wallet_id: targetWalletId,
            member_id: memberId,
            entry_type: entryType || 'withdrawal',
            direction: 'DEBIT',
            amount: numAmount,
            currency,
            reference_type: referenceType || 'manual',
            reference_id: referenceId || `ref-${Date.now()}`,
            description: description || 'Ledger debit posted',
            metadata
        });

        if (!result.idempotent && actor) {
            await nexusDb.insertAuditLog({
                actor_id: actor.id || actor.user_id || 'system',
                actor_role: actor.role || 'admin',
                action: 'WALLET_DEBIT_POSTED',
                target_id: result.entry.id,
                details: {
                    wallet_id: targetWalletId,
                    entry_reference: result.entry.entry_reference,
                    amount: numAmount,
                    currency,
                    reference_type: referenceType,
                    reference_id: referenceId
                }
            });
        }

        return {
            ...result.entry,
            entry: result.entry,
            idempotent: result.idempotent
        };
    }

    /**
     * Credit an approved commission to member's wallet ledger (Prompt 11 -> Prompt 12 integration)
     * Atomic transition: Approved -> Ledger Credit -> Credited.
     * Guaranteed Idempotency: commission cannot create duplicate credits.
     */
    async creditApprovedCommission(commissionId, actor = null) {
        const comm = await nexusDb.getCommissionById(commissionId);
        if (!comm) {
            throw new Error(`Wallet Service Error: Commission record ${commissionId} not found.`);
        }

        // Security check: must be in approved status
        if (comm.status !== 'approved') {
            if (comm.status === 'credited') {
                // Find existing ledger entry for idempotent return
                const existing = await nexusDb.getLedgerEntryByReference('commission', comm.id, 'commission');
                return { success: true, idempotent: true, ledgerEntry: existing, commission: comm };
            }
            throw new Error(`Security Safeguard: Cannot credit commission with status '${comm.status}'. Must be in 'approved' standing.`);
        }

        // Provision/get beneficiary wallet
        const wallet = await this.getOrCreateWallet(comm.beneficiary_id, comm.currency || 'LKR');

        // Post Credit with strict idempotency key
        const creditResult = await this.postCredit({
            walletId: wallet.id,
            memberId: comm.beneficiary_id,
            entryType: 'commission',
            amount: comm.amount,
            currency: comm.currency || 'LKR',
            referenceType: 'commission',
            referenceId: comm.id,
            description: `Commission ${comm.commission_reference} (${comm.commission_type} L${comm.commission_level}) from order ${comm.order_summary?.order_number || comm.order_id}`,
            metadata: {
                commission_id: comm.id,
                commission_reference: comm.commission_reference,
                commission_level: comm.commission_level,
                commission_type: comm.commission_type,
                order_id: comm.order_id
            },
            actor
        });

        // Mark commission as credited
        const updatedComm = await nexusDb.updateCommissionStatus(
            comm.id,
            'credited',
            'Credited to member wallet ledger',
            actor,
            { ledger_entry_id: creditResult.entry.id }
        );

        // Send In-App Notification to Beneficiary
        await nexusDb.insertMemberNotification({
            user_id: comm.beneficiary_id,
            title: 'Commission Credited to Wallet',
            message: `LKR ${comm.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} has been credited to your available balance (${creditResult.entry.entry_reference}).`,
            type: 'wallet',
            link: '/dashboard/wallet'
        });

        return {
            success: true,
            idempotent: creditResult.idempotent,
            ledgerEntry: creditResult.entry,
            commission: updatedComm
        };
    }

    /**
     * Admin controlled financial adjustment
     * NEVER modifies balance directly; always posts an audited ledger entry.
     */
    async postAdjustment({ memberId, amount, direction, reason, notes = '', actor }) {
        if (!actor || (!actor.roles?.includes('admin') && !actor.roles?.includes('super_admin') && actor.role !== 'admin')) {
            throw new Error('Security Authorization Guard: Only authorized administrators can perform wallet adjustments.');
        }

        if (!memberId) {
            throw new Error('Financial Validation Error: Target member is required.');
        }

        const numAmount = Math.round(parseFloat(amount) * 100) / 100;
        if (isNaN(numAmount) || numAmount <= 0) {
            throw new Error('Financial Validation Error: Adjustment amount must be strictly greater than 0.00.');
        }

        const dir = String(direction).toUpperCase();
        if (dir !== 'CREDIT' && dir !== 'DEBIT') {
            throw new Error("Financial Validation Error: Adjustment direction must be 'CREDIT' or 'DEBIT'.");
        }

        if (!reason || !reason.trim()) {
            throw new Error('Audit Compliance Guard: A mandatory administrative reason is required for adjustments.');
        }

        const wallet = await this.getOrCreateWallet(memberId, 'LKR');
        const adjId = `adj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const description = `Admin Adjustment: ${reason.trim()}${notes ? ' — ' + notes.trim() : ''}`;

        let result;
        if (dir === 'CREDIT') {
            result = await this.postCredit({
                walletId: wallet.id,
                memberId,
                entryType: 'adjustment',
                amount: numAmount,
                currency: 'LKR',
                referenceType: 'admin_adjustment',
                referenceId: adjId,
                description,
                metadata: { reason, notes, authorized_by: actor.id || actor.user_id },
                actor
            });
        } else {
            result = await this.postDebit({
                walletId: wallet.id,
                memberId,
                entryType: 'adjustment',
                amount: numAmount,
                currency: 'LKR',
                referenceType: 'admin_adjustment',
                referenceId: adjId,
                description,
                metadata: { reason, notes, authorized_by: actor.id || actor.user_id },
                actor
            });
        }

        await nexusDb.insertAuditLog({
            actor_id: actor.id || actor.user_id || 'system',
            actor_role: actor.role || 'admin',
            action: 'ADMIN_WALLET_ADJUSTMENT',
            target_id: result.entry.id,
            details: {
                member_id: memberId,
                wallet_id: wallet.id,
                entry_reference: result.entry.entry_reference,
                direction: dir,
                amount: numAmount,
                reason,
                notes
            }
        });

        return {
            success: true,
            entry: result.entry,
            ledgerEntry: result.entry,
            walletBalance: await this.calculateAvailableBalance(wallet.id)
        };
    }

    /**
     * Financial Transaction Reversal
     * NEVER alters or deletes the original record. Posts a compensating entry.
     */
    async reverseTransaction(ledgerEntryId, reason, actor) {
        if (!actor || (!actor.roles?.includes('admin') && !actor.roles?.includes('super_admin') && actor.role !== 'admin')) {
            throw new Error('Security Authorization Guard: Only authorized administrators can reverse transactions.');
        }

        const original = await nexusDb.getLedgerEntryById(ledgerEntryId);
        if (!original) {
            throw new Error(`Financial Validation Error: Ledger transaction ${ledgerEntryId} not found.`);
        }

        if (original.status === 'reversed') {
            throw new Error(`Security Safeguard: Transaction ${original.entry_reference} has already been reversed.`);
        }

        if (!reason || !reason.trim()) {
            throw new Error('Audit Compliance Guard: A mandatory administrative reason is required for reversals.');
        }

        const compensatingDirection = original.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT';
        const reversalRefId = `rev-${original.id}`;
        const description = `Compensating reversal of ${original.entry_reference}: ${reason.trim()}`;

        let result;
        if (compensatingDirection === 'CREDIT') {
            result = await this.postCredit({
                walletId: original.wallet_id,
                memberId: original.member_id,
                entryType: 'reversal',
                amount: original.amount,
                currency: original.currency,
                referenceType: 'reversal',
                referenceId: reversalRefId,
                description,
                metadata: { original_entry_id: original.id, original_reference: original.entry_reference, reason },
                actor
            });
        } else {
            result = await this.postDebit({
                walletId: original.wallet_id,
                memberId: original.member_id,
                entryType: 'reversal',
                amount: original.amount,
                currency: original.currency,
                referenceType: 'reversal',
                referenceId: reversalRefId,
                description,
                metadata: { original_entry_id: original.id, original_reference: original.entry_reference, reason },
                actor
            });
        }

        // Mark original entry status as reversed in database
        await nexusDb.updateLedgerEntryStatus(original.id, 'reversed');
        original.status = 'reversed';

        await nexusDb.insertAuditLog({
            actor_id: actor.id || actor.user_id || 'system',
            actor_role: actor.role || 'admin',
            action: 'LEDGER_ENTRY_REVERSED',
            target_id: original.id,
            details: {
                original_id: original.id,
                original_reference: original.entry_reference,
                reversal_entry_id: result.entry.id,
                reversal_reference: result.entry.entry_reference,
                amount: original.amount,
                reason
            }
        });

        return {
            success: true,
            original_entry: original,
            originalEntry: original,
            reversal_entry: result.entry,
            reversalEntry: result.entry,
            walletBalance: await this.calculateAvailableBalance(original.wallet_id)
        };
    }

    /**
     * Comprehensive Financial Diagnostic & Reconciliation Engine
     * Detects discrepancies without silently altering records.
     */
    async runReconciliationDiagnostics() {
        const anomalies = {
            negativeBalances: [],
            duplicateReferences: [],
            commissionDiscrepancies: [],
            orphanEntries: []
        };

        const wallets = nexusDb.wallets;
        const entries = nexusDb.ledgerEntries;
        const commissions = nexusDb.commissions;

        // 1. Check for Negative Balances & Verify Ledger Balance Math
        for (const w of wallets) {
            const balance = await this.calculateAvailableBalance(w.id);
            if (balance < 0) {
                anomalies.negativeBalances.push({
                    wallet_id: w.id,
                    member_id: w.member_id,
                    calculated_balance: balance
                });
            }
        }

        // 2. Check for Duplicate Reference Tuples
        const refMap = new Map();
        for (const e of entries) {
            const key = `${e.reference_type}::${e.reference_id}::${e.entry_type}`;
            if (refMap.has(key)) {
                anomalies.duplicateReferences.push({
                    key,
                    original_id: refMap.get(key),
                    duplicate_id: e.id,
                    reference: e.entry_reference
                });
            } else {
                refMap.set(key, e.id);
            }
        }

        // 3. Check Commission Status Consistency
        for (const c of commissions) {
            const ledgerEntry = entries.find(e => 
                e.reference_type === 'commission' && e.reference_id === c.id && e.entry_type === 'commission'
            );

            if (c.status === 'credited' && !ledgerEntry) {
                anomalies.commissionDiscrepancies.push({
                    commission_id: c.id,
                    reference: c.commission_reference,
                    issue: 'Commission marked CREDITED but no corresponding ledger entry exists.'
                });
            } else if (c.status === 'approved' && ledgerEntry) {
                anomalies.commissionDiscrepancies.push({
                    commission_id: c.id,
                    reference: c.commission_reference,
                    issue: 'Commission marked APPROVED but ledger entry already exists.'
                });
            }
        }

        // 4. Check for Orphan Entries (Wallet or Member missing)
        for (const e of entries) {
            const walletExists = wallets.some(w => w.id === e.wallet_id);
            if (!walletExists) {
                anomalies.orphanEntries.push({
                    entry_id: e.id,
                    reference: e.entry_reference,
                    issue: `Wallet ID ${e.wallet_id} does not exist.`
                });
            }
        }

        const totalAnomalies = 
            anomalies.negativeBalances.length +
            anomalies.duplicateReferences.length +
            anomalies.commissionDiscrepancies.length +
            anomalies.orphanEntries.length;

        const summaryStats = await nexusDb.getFinancialSummaryStats();

        return {
            timestamp: new Date().toISOString(),
            audit_timestamp: new Date().toISOString(),
            status: totalAnomalies === 0 ? 'HEALTHY' : 'ANOMALIES_DETECTED',
            totalAnomalies,
            total_wallets_audited: wallets.length,
            global_metrics: {
                total_system_credits: summaryStats.total_credits,
                total_system_debits: summaryStats.total_debits,
                total_system_net_balance: summaryStats.net_balance
            },
            summary: summaryStats,
            balance_discrepancies: anomalies.negativeBalances,
            duplicate_references: anomalies.duplicateReferences,
            commission_crediting_discrepancies: anomalies.commissionDiscrepancies,
            anomalies
        };
    }
}

// Global Singleton Instance
const nexusWalletService = new NexusWalletService();
module.exports = nexusWalletService;
