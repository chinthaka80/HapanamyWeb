// Hapanamy.lk Commission & Volume Reversal Engine (STEP 30)
// Authoritative compensating reversal system for refunded/cancelled purchases.
// Enforces immutable ledger preservation, double-entry wallet adjustments,
// multi-policy recovery mechanisms (Negative Balance, Future Offset, Manual Recovery, Hold Account),
// and strict idempotency.

const crypto = require('crypto');
const VolumeLedger = require('./volume-ledger');
const WalletService = require('./wallet-service');
const KycService = require('./kyc-service');

const RECOVERY_POLICIES = {
    IMMEDIATE_NEGATIVE_BALANCE: 'IMMEDIATE_NEGATIVE_BALANCE',
    FUTURE_COMMISSION_OFFSET: 'FUTURE_COMMISSION_OFFSET',
    MANUAL_RECOVERY: 'MANUAL_RECOVERY',
    HOLD_ACCOUNT: 'HOLD_ACCOUNT'
};

const ReversalEngine = {
    RECOVERY_POLICIES,
    _reversalLocks: new Set(),

    /**
     * Identifies all original commission transactions and binary volume entries for a purchase.
     */
    identifyReversibles(purchaseId, walletLedger = [], volumeLedger = []) {
        if (!purchaseId) return { directCommissions: [], binaryCommissions: [], volumeEntries: [] };

        const directCommissions = walletLedger.filter(tx => 
            (tx.reference_id === purchaseId || tx.source_purchase_id === purchaseId) &&
            ((tx.type || '').toUpperCase() === 'DIRECT_COMMISSION' || (tx.type || '').toUpperCase() === 'DIRECT') &&
            tx.status === 'COMPLETED'
        );

        const binaryCommissions = walletLedger.filter(tx => 
            (tx.reference_id === purchaseId || tx.source_purchase_id === purchaseId) &&
            ((tx.type || '').toUpperCase() === 'BINARY_COMMISSION' || (tx.type || '').toUpperCase() === 'BINARY') &&
            tx.status === 'COMPLETED'
        );

        const volumeEntries = volumeLedger.filter(v => 
            (v.source_purchase_id === purchaseId || v.purchase_id === purchaseId) &&
            (v.type === 'SALE_VOLUME' || v.type === 'DIRECT_VOLUME')
        );

        return {
            directCommissions,
            binaryCommissions,
            volumeEntries,
            totalCommissionsCount: directCommissions.length + binaryCommissions.length,
            totalVolumeEntriesCount: volumeEntries.length
        };
    },

    /**
     * Executes the comprehensive Commission & Volume Reversal Workflow.
     */
    processPurchaseReversal({
        purchaseId,
        actorId = 'system',
        reason = 'Customer Refund Reversal',
        recoveryPolicy = RECOVERY_POLICIES.IMMEDIATE_NEGATIVE_BALANCE,
        walletLedger = [],
        volumeLedger = [],
        binaryNodes = [],
        users = [],
        recoveryLedger = [],
        auditLogs = [],
        partialAmount = null // Optional partial reversal limit
    }) {
        if (!purchaseId) {
            throw new Error('Valid purchaseId is required to process reversals.');
        }

        const lockKey = `lock-reversal-${purchaseId}`;
        if (this._reversalLocks.has(lockKey)) {
            throw new Error(`Concurrent reversal in progress for purchase ${purchaseId}`);
        }
        this._reversalLocks.add(lockKey);

        try {
            const reversibles = this.identifyReversibles(purchaseId, walletLedger, volumeLedger);
            const allCommissions = [...reversibles.directCommissions, ...reversibles.binaryCommissions];

            const timestamp = new Date().toISOString();
            const reversalResults = {
                purchase_id: purchaseId,
                policy_applied: recoveryPolicy,
                reversed_direct_commissions: [],
                reversed_binary_commissions: [],
                reversed_volume_entries: [],
                recovery_obligations: [],
                skipped_duplicates: 0,
                timestamp
            };

            // 1. Process Commission Reversals with Configured Recovery Policies
            allCommissions.forEach(origTx => {
                const reversalIdempotencyKey = `rev-tx-${origTx.id}-${purchaseId}`;
                
                // Idempotency check: has this specific original transaction already been reversed?
                const alreadyReversed = walletLedger.some(tx => 
                    tx.idempotency_key === reversalIdempotencyKey || 
                    (tx.original_transaction_id === origTx.id && tx.type === 'COMMISSION_REVERSAL')
                );

                if (alreadyReversed) {
                    reversalResults.skipped_duplicates++;
                    return;
                }

                const origAmount = Math.abs(Number(origTx.amount));
                const reversalAmount = partialAmount !== null ? Math.min(origAmount, Number(partialAmount)) : origAmount;
                const recipientId = origTx.user_id;

                // Check recipient's current wallet balance
                const currentWallet = WalletService.getWalletBalances(recipientId, walletLedger);
                const availableBalance = currentWallet.available_balance;
                const isWithdrawn = availableBalance < reversalAmount;
                const outstandingClawback = isWithdrawn ? Math.round((reversalAmount - availableBalance) * 100) / 100 : 0;

                // Create compensating double-entry wallet ledger entry
                const reversalTx = {
                    id: 'rev-' + crypto.randomBytes(8).toString('hex'),
                    idempotency_key: reversalIdempotencyKey,
                    user_id: recipientId,
                    type: 'COMMISSION_REVERSAL',
                    commission_type: origTx.type,
                    amount: -reversalAmount,
                    direction: 'DEBIT',
                    original_transaction_id: origTx.id,
                    reference_id: purchaseId,
                    reference_type: 'product_purchases',
                    status: 'COMPLETED',
                    recovery_policy: recoveryPolicy,
                    has_withdrawn_funds: isWithdrawn,
                    outstanding_clawback: outstandingClawback,
                    notes: reason,
                    created_at: timestamp
                };

                walletLedger.push(reversalTx);

                if ((origTx.type || '').toUpperCase().includes('DIRECT')) {
                    reversalResults.reversed_direct_commissions.push(reversalTx);
                } else {
                    reversalResults.reversed_binary_commissions.push(reversalTx);
                }

                // Apply Configured Recovery Policy if funds were already withdrawn
                if (isWithdrawn && outstandingClawback > 0) {
                    const recoveryRecord = {
                        id: 'rec-' + crypto.randomBytes(8).toString('hex'),
                        user_id: recipientId,
                        purchase_id: purchaseId,
                        original_transaction_id: origTx.id,
                        reversal_transaction_id: reversalTx.id,
                        outstanding_amount: outstandingClawback,
                        recovery_policy: recoveryPolicy,
                        status: 'OUTSTANDING',
                        created_at: timestamp
                    };

                    if (recoveryPolicy === RECOVERY_POLICIES.HOLD_ACCOUNT) {
                        const targetUser = users.find(u => u.id === recipientId);
                        if (targetUser) {
                            targetUser.status = 'RECOVERY_HOLD';
                            targetUser.recovery_hold_reason = `Outstanding commission clawback of LKR ${outstandingClawback.toFixed(2)} on refunded purchase ${purchaseId}`;
                        }
                    } else if (recoveryPolicy === RECOVERY_POLICIES.FUTURE_COMMISSION_OFFSET) {
                        recoveryRecord.offset_applied = 0.00;
                    }

                    if (recoveryLedger) {
                        recoveryLedger.push(recoveryRecord);
                    }
                    reversalResults.recovery_obligations.push(recoveryRecord);
                }
            });

            // 2. Process Binary Volume Reversals (Compensating Volume Entries)
            if (binaryNodes && volumeLedger) {
                const reversedVolumes = VolumeLedger.reverseVolume(purchaseId, binaryNodes, volumeLedger);
                reversalResults.reversed_volume_entries = reversedVolumes;
            }

            // 3. Audit Logging
            if (auditLogs) {
                KycService.logAction(
                    auditLogs,
                    actorId,
                    'COMMISSION_AND_VOLUME_REVERSED',
                    'product_purchases',
                    purchaseId,
                    null,
                    {
                        reversed_direct_count: reversalResults.reversed_direct_commissions.length,
                        reversed_binary_count: reversalResults.reversed_binary_commissions.length,
                        reversed_volume_count: reversalResults.reversed_volume_entries.length,
                        recovery_obligations_count: reversalResults.recovery_obligations.length,
                        recovery_policy: recoveryPolicy
                    }
                );
            }

            reversalResults.total_amount_reversed = Math.round((
                reversalResults.reversed_direct_commissions.reduce((s, r) => s + (Math.abs(Number(r.amount)) || 0), 0) +
                reversalResults.reversed_binary_commissions.reduce((s, r) => s + (Math.abs(Number(r.amount)) || 0), 0)
            ) * 100) / 100;

            return {
                success: true,
                ...reversalResults
            };
        } finally {
            this._reversalLocks.delete(lockKey);
        }
    },

    /**
     * Future Commission Offset Handler:
     * When a member with an outstanding clawback earns new commissions,
     * automatically intercepts and offsets the debt before crediting available balance.
     */
    applyFutureCommissionOffset({
        userId,
        newCommissionAmount,
        recoveryLedger = [],
        walletLedger = [],
        auditLogs = []
    }) {
        const outstandingRecords = recoveryLedger.filter(r => 
            r.user_id === userId && 
            r.status === 'OUTSTANDING' && 
            r.recovery_policy === RECOVERY_POLICIES.FUTURE_COMMISSION_OFFSET
        );

        if (outstandingRecords.length === 0) {
            return {
                offset_applied: 0.00,
                remaining_commission: newCommissionAmount,
                fully_settled: true
            };
        }

        let remainingCommission = Number(newCommissionAmount);
        let totalOffsetApplied = 0;

        for (const record of outstandingRecords) {
            if (remainingCommission <= 0) break;

            const remainingDebt = record.outstanding_amount - (record.offset_applied || 0);
            const deduction = Math.min(remainingCommission, remainingDebt);

            record.offset_applied = (record.offset_applied || 0) + deduction;
            remainingCommission -= deduction;
            totalOffsetApplied += deduction;

            if (record.offset_applied >= record.outstanding_amount) {
                record.status = 'SETTLED';
                record.settled_at = new Date().toISOString();
            }

            // Log offsetting transaction in wallet ledger
            walletLedger.push({
                id: 'offset-' + crypto.randomBytes(8).toString('hex'),
                user_id: userId,
                type: 'DEBT_OFFSET_DEDUCTION',
                amount: -deduction,
                reference_id: record.id,
                reference_type: 'recovery_ledger',
                status: 'COMPLETED',
                created_at: new Date().toISOString()
            });
        }

        return {
            offset_applied: totalOffsetApplied,
            remaining_commission: remainingCommission,
            fully_settled: outstandingRecords.every(r => r.status === 'SETTLED')
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = ReversalEngine;
}
