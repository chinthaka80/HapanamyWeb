// Hapanamy.lk Product Purchase & Commission Trigger Orchestrator (STEP 23)
// Centralized single-entry workflow for approved product purchases, orchestrating snapshot creation,
// binary volume propagation, direct commissions, 7-level qualified upline payouts, wallet credits,
// fault-tolerant notifications, and master audit logging with end-to-end idempotency protection.

const crypto = require('crypto');
const ProductSnapshotService = require('./product-snapshot-service');
const VolumeLedger = require('./volume-ledger');
const DirectCommissionEngine = require('./direct-commission-engine');
const QualifiedUplineCommissionEngine = require('./qualified-upline-commission-engine');
const EarningsCapEngine = require('./earnings-cap-engine');
const WalletService = require('./wallet-service');

const PurchaseOrchestrator = {
    _orchestrationLocks: new Set(),
    _orchestratedPurchases: new Map(),
    _notificationQueue: [],
    _masterAuditLogs: [],

    /**
     * Executes the complete Approved Purchase Workflow (STEP 23)
     */
    executeApprovedPurchaseWorkflow({
        purchase,
        product,
        userId,
        binaryNodes = [],
        sponsors = [],
        users = [],
        kycDocs = [],
        purchases = [],
        commissionLedger = [],
        volumeLedger = [],
        walletLedger = [],
        dailyEarningsMap = new Map(),
        notificationQueue = null,
        auditLogs = null,
        options = {}
    }) {
        if (!purchase || !purchase.id) {
            throw new Error('Valid purchase object with ID is required for orchestration.');
        }

        const purchaseId = purchase.id;
        const targetUserId = userId || purchase.user_id;

        // 1. Concurrency Mutex Lock
        const lockKey = `orch-lock-${purchaseId}`;
        if (this._orchestrationLocks.has(lockKey)) {
            throw new Error(`Orchestration workflow already in progress for purchase ${purchaseId}`);
        }

        this._orchestrationLocks.add(lockKey);

        try {
            // 2. Master Idempotency Guard
            const masterIdempotencyKey = `orch-purch-${purchaseId}`;
            if (this._orchestratedPurchases.has(masterIdempotencyKey)) {
                console.log(`⚠️ Idempotency block: Purchase ${purchaseId} has already completed orchestration.`);
                return {
                    success: true,
                    idempotent: true,
                    purchase_id: purchaseId,
                    message: 'Purchase already orchestrated. No duplicate processing performed.',
                    details: this._orchestratedPurchases.get(masterIdempotencyKey)
                };
            }

            // 3. Create or Validate Immutable Product Economics Snapshot
            let snapshot = purchase.economics_snapshot;
            if (!snapshot) {
                if (!product) {
                    throw new Error(`Product definition is required to create snapshot for purchase ${purchaseId}.`);
                }
                snapshot = ProductSnapshotService.createSnapshot(product, purchaseId);
                purchase.economics_snapshot = snapshot;
            }

            const snapshotIntegrity = ProductSnapshotService.verifySnapshotIntegrity(snapshot);
            if (!snapshotIntegrity.valid) {
                throw new Error(`Snapshot cryptographic verification failed: ${snapshotIntegrity.reason}`);
            }

            // 4. Activate Product Access
            purchase.status = 'ACTIVE';
            purchase.activated_at = new Date().toISOString();
            if (!purchases.some(p => p.id === purchaseId)) {
                purchases.push(purchase);
            }

            // 5. Check if Commission Distribution is Permitted (Economics Status != BLOCKED)
            const commissionAllowed = snapshot.economics_status !== 'BLOCKED';
            let directCommResult = null;
            let uplineCommResult = null;
            let volumeResult = null;

            if (commissionAllowed) {
                // 6. Propagate Binary Volume to Ancestors
                if (volumeLedger && snapshot.binary_volume > 0) {
                    volumeResult = VolumeLedger.processSaleVolume({
                        purchase,
                        snapshot,
                        binaryNodes,
                        ledger: volumeLedger
                    });
                }

                // 7. Direct Commission Event
                if (sponsors && sponsors.length > 0) {
                    directCommResult = DirectCommissionEngine.processDirectCommission({
                        purchase,
                        snapshot,
                        sponsors,
                        users,
                        commissionLedger,
                        walletLedger,
                        dailyEarningsMap
                    });
                }

                // 8. 7 Qualified Upline Binary Commission Event
                if (binaryNodes && binaryNodes.length > 0) {
                    const qualificationContext = { users, kycDocs, purchases, sponsors, binaryNodes };
                    uplineCommResult = QualifiedUplineCommissionEngine.processQualifiedUplineCommissions({
                        purchase,
                        snapshot,
                        binaryNodes,
                        qualificationContext,
                        commissionLedger,
                        walletLedger,
                        dailyEarningsMap
                    });
                }
            } else {
                console.log(`⚠️ Commission blocked by snapshot economics firewall for purchase ${purchaseId}.`);
            }

            // 9. Fault-Tolerant Notification Queueing (Isolated from Financial Failures)
            const nQueue = notificationQueue || this._notificationQueue;
            try {
                if (options.simulateNotificationFailure) {
                    throw new Error('Simulated notification network timeout');
                }

                nQueue.push({
                    id: 'notif-' + crypto.randomBytes(8).toString('hex'),
                    user_id: targetUserId,
                    type: 'PURCHASE_CONFIRMATION',
                    purchase_id: purchaseId,
                    product_id: purchase.product_id,
                    amount: snapshot.selling_price,
                    created_at: new Date().toISOString()
                });

                if (directCommResult && directCommResult.success && directCommResult.eligible_amount > 0) {
                    nQueue.push({
                        id: 'notif-' + crypto.randomBytes(8).toString('hex'),
                        user_id: directCommResult.sponsor_id,
                        type: 'DIRECT_COMMISSION_RECEIVED',
                        purchase_id: purchaseId,
                        amount: directCommResult.eligible_amount,
                        created_at: new Date().toISOString()
                    });
                }
            } catch (notifErr) {
                console.warn(`⚠️ Non-fatal notification error: ${notifErr.message}. Financial workflow remains intact.`);
            }

            // 10. Record Master Audit Event
            const aLogs = auditLogs || this._masterAuditLogs;
            const auditEntry = {
                id: 'audit-orch-' + crypto.randomBytes(8).toString('hex'),
                user_id: targetUserId,
                action: 'PURCHASE_ORCHESTRATION_COMPLETED',
                entity_type: 'purchase',
                entity_id: purchaseId,
                snapshot_id: snapshot.id,
                commission_allowed: commissionAllowed,
                direct_commission_paid: directCommResult ? directCommResult.eligible_amount : 0.00,
                upline_commissions_paid: uplineCommResult ? uplineCommResult.total_commission_paid : 0.00,
                binary_volume_propagated: snapshot.binary_volume,
                timestamp: new Date().toISOString()
            };
            aLogs.push(auditEntry);

            // 11. Mark Orchestration State
            const executionSummary = {
                purchase_id: purchaseId,
                user_id: targetUserId,
                product_access_active: true,
                snapshot_version: snapshot.snapshot_version,
                volume_propagated: snapshot.binary_volume,
                direct_commission: directCommResult,
                upline_commissions: uplineCommResult,
                audit: auditEntry
            };

            this._orchestratedPurchases.set(masterIdempotencyKey, executionSummary);

            return {
                success: true,
                idempotent: false,
                purchase_id: purchaseId,
                summary: executionSummary
            };

        } finally {
            this._orchestrationLocks.delete(lockKey);
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = PurchaseOrchestrator;
}
