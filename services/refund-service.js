// Hapanamy.lk Refund & Cancellation Engine (STEP 29)
// Implements configurable refund eligibility policies (14-day window, course usage thresholds,
// download restrictions, exam attempts), full refund lifecycle state machine (REQUESTED -> UNDER_REVIEW -> APPROVED -> REFUNDED / REJECTED / CANCELLED),
// and immutable compensating reversals (Commissions, Binary Volume, Product Access revocation, and Audit Trails).

const VolumeLedger = require('./volume-ledger');
const KycService = require('./kyc-service');

const DEFAULT_REFUND_POLICY = {
    refund_window_days: 14,
    max_allowed_watch_percentage: 25.0,
    max_allowed_completed_lessons: 2,
    disallow_if_resources_downloaded: true,
    disallow_if_exam_attempted: true
};

const REFUND_STATUSES = {
    REQUESTED: 'REQUESTED',
    UNDER_REVIEW: 'UNDER_REVIEW',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    REFUNDED: 'REFUNDED',
    CANCELLED: 'CANCELLED'
};

const RefundService = {
    REFUND_STATUSES,
    DEFAULT_REFUND_POLICY,

    /**
     * Evaluates comprehensive refund eligibility against configurable policy and usage telemetry.
     */
    checkEligibility(purchase, options = {}) {
        if (!purchase) {
            return { eligible: false, reason: 'PURCHASE_NOT_FOUND', error: 'Purchase record not found.' };
        }

        const policy = { ...DEFAULT_REFUND_POLICY, ...(purchase.refund_policy || {}), ...(options.policy || {}) };
        const usage = options.usage || purchase.usage_telemetry || {};
        const previousRefunds = options.previousRefunds || [];

        // 1. Payment & Purchase Status Check
        if (purchase.status !== 'ACTIVE' && purchase.status !== 'COMPLETED') {
            if (purchase.status === 'REFUNDED') {
                return { eligible: false, reason: 'ALREADY_REFUNDED', error: 'This purchase has already been refunded.' };
            }
            return { eligible: false, reason: 'INVALID_STATUS', error: `Only active purchases can be refunded. Current status: ${purchase.status}.` };
        }

        // 2. Duplicate or Active Refund Request Check
        const existingActiveReq = previousRefunds.find(r => 
            r.purchase_id === purchase.id && 
            (r.status === REFUND_STATUSES.REQUESTED || r.status === REFUND_STATUSES.UNDER_REVIEW || r.status === REFUND_STATUSES.APPROVED || r.status === REFUND_STATUSES.REFUNDED)
        );
        if (existingActiveReq) {
            return { eligible: false, reason: 'DUPLICATE_REQUEST', error: `A refund request (${existingActiveReq.id}) already exists with status ${existingActiveReq.status}.` };
        }

        // 3. Refund Window Evaluation (Default 14 Days)
        const purchaseDateStr = purchase.activated_at || purchase.created_at || new Date().toISOString();
        const purchaseTime = new Date(purchaseDateStr).getTime();
        const requestTime = options.requestDate ? new Date(options.requestDate).getTime() : Date.now();
        const diffDays = (requestTime - purchaseTime) / (1000 * 60 * 60 * 24);

        if (diffDays > policy.refund_window_days) {
            return {
                eligible: false,
                reason: 'WINDOW_EXPIRED',
                error: `Refund period of ${policy.refund_window_days} days has expired.`,
                days_elapsed: Math.round(diffDays * 10) / 10,
                allowed_window_days: policy.refund_window_days
            };
        }

        // 4. Configurable Product Usage Telemetry Evaluation
        // (a) Watch percentage limit
        const watchPct = Number(usage.watch_percentage || 0);
        if (policy.max_allowed_watch_percentage !== undefined && watchPct > policy.max_allowed_watch_percentage) {
            return {
                eligible: false,
                reason: 'USAGE_WATCH_LIMIT_EXCEEDED',
                error: `Course watch percentage (${watchPct}%) exceeds non-refundable threshold of ${policy.max_allowed_watch_percentage}%.`,
                watch_percentage: watchPct,
                max_allowed: policy.max_allowed_watch_percentage
            };
        }

        // (b) Completed lessons limit
        const lessonsCompleted = Number(usage.completed_lessons_count || 0);
        if (policy.max_allowed_completed_lessons !== undefined && lessonsCompleted > policy.max_allowed_completed_lessons) {
            return {
                eligible: false,
                reason: 'USAGE_LESSONS_LIMIT_EXCEEDED',
                error: `Completed lessons (${lessonsCompleted}) exceed non-refundable threshold of ${policy.max_allowed_completed_lessons}.`,
                completed_lessons: lessonsCompleted,
                max_allowed: policy.max_allowed_completed_lessons
            };
        }

        // (c) Digital resources / Source file download check
        if (policy.disallow_if_resources_downloaded && usage.has_downloaded_resources) {
            return {
                eligible: false,
                reason: 'RESOURCES_DOWNLOADED',
                error: 'Course source files/templates have already been downloaded, making this purchase non-refundable.',
                download_timestamp: usage.downloaded_at
            };
        }

        // (d) Exam / Certification attempt check
        if (policy.disallow_if_exam_attempted && (usage.exam_attempted || usage.has_certificate)) {
            return {
                eligible: false,
                reason: 'EXAM_ATTEMPTED',
                error: 'Course examination or certification has already been attempted.',
                exam_attempt_date: usage.exam_attempt_date
            };
        }

        return {
            eligible: true,
            days_elapsed: Math.round(diffDays * 10) / 10,
            allowed_window_days: policy.refund_window_days,
            policy
        };
    },

    /**
     * Submits a new refund request transitioning into REQUESTED status.
     */
    requestRefund({
        userId,
        purchaseId,
        reason,
        purchases = [],
        refundRequests = [],
        requestDate = new Date().toISOString(),
        usageTelemetry = {},
        auditLogs = []
    }) {
        if (!userId || !purchaseId) {
            throw new Error('User ID and Purchase ID are required to submit a refund request.');
        }

        const purchase = purchases.find(p => p.id === purchaseId && p.user_id === userId);
        if (!purchase) {
            throw new Error(`Active purchase ${purchaseId} not found for member ${userId}.`);
        }

        const check = this.checkEligibility(purchase, {
            requestDate,
            usage: usageTelemetry,
            previousRefunds: refundRequests
        });

        if (!check.eligible) {
            throw new Error(check.error);
        }

        const refundId = 'ref-req-' + Math.random().toString(36).substr(2, 9);
        const refundRecord = {
            id: refundId,
            purchase_id: purchaseId,
            user_id: userId,
            amount: Number(purchase.selling_price) || (purchase.economics_snapshot ? Number(purchase.economics_snapshot.selling_price) : 0),
            reason: reason || 'Customer Satisfaction Guarantee',
            status: REFUND_STATUSES.REQUESTED,
            created_at: requestDate,
            updated_at: requestDate,
            eligibility_snapshot: check
        };

        refundRequests.push(refundRecord);

        if (auditLogs) {
            KycService.logAction(auditLogs, userId, 'REFUND_REQUESTED', 'refund_requests', refundId, null, { purchase_id: purchaseId, amount: refundRecord.amount });
        }

        return {
            success: true,
            refund_request: refundRecord
        };
    },

    /**
     * Admin review status transitions (REQUESTED -> UNDER_REVIEW -> REJECTED / APPROVED)
     */
    reviewRefundRequest({
        refundId,
        action, // 'START_REVIEW', 'APPROVE', 'REJECT'
        reviewerId,
        rejectionReason,
        refundRequests = [],
        auditLogs = []
    }) {
        const req = refundRequests.find(r => r.id === refundId);
        if (!req) {
            throw new Error(`Refund request ${refundId} not found.`);
        }

        if (req.status === REFUND_STATUSES.REFUNDED || req.status === REFUND_STATUSES.CANCELLED) {
            throw new Error(`Cannot review finalized refund request with status ${req.status}.`);
        }

        const oldStatus = req.status;

        if (action === 'START_REVIEW') {
            req.status = REFUND_STATUSES.UNDER_REVIEW;
            req.reviewer_id = reviewerId;
            req.updated_at = new Date().toISOString();
        } else if (action === 'APPROVE') {
            req.status = REFUND_STATUSES.APPROVED;
            req.reviewer_id = reviewerId;
            req.approved_at = new Date().toISOString();
            req.updated_at = new Date().toISOString();
        } else if (action === 'REJECT') {
            if (!rejectionReason) {
                throw new Error('Rejection reason is mandatory when rejecting a refund.');
            }
            req.status = REFUND_STATUSES.REJECTED;
            req.reviewer_id = reviewerId;
            req.rejection_reason = rejectionReason;
            req.rejected_at = new Date().toISOString();
            req.updated_at = new Date().toISOString();
        } else {
            throw new Error(`Invalid review action ${action}. Expected START_REVIEW, APPROVE, or REJECT.`);
        }

        if (auditLogs) {
            KycService.logAction(auditLogs, reviewerId, `REFUND_${action}`, 'refund_requests', refundId, { status: oldStatus }, { status: req.status, rejectionReason });
        }

        return {
            success: true,
            refund_request: req
        };
    },

    /**
     * Allows member to cancel their pending refund request before it is finalized.
     */
    cancelRefundRequest({
        refundId,
        userId,
        refundRequests = [],
        auditLogs = []
    }) {
        const req = refundRequests.find(r => r.id === refundId && r.user_id === userId);
        if (!req) {
            throw new Error(`Refund request ${refundId} not found for member ${userId}.`);
        }

        if (req.status !== REFUND_STATUSES.REQUESTED && req.status !== REFUND_STATUSES.UNDER_REVIEW) {
            throw new Error(`Cannot cancel refund request with status ${req.status}.`);
        }

        const oldStatus = req.status;
        req.status = REFUND_STATUSES.CANCELLED;
        req.cancelled_at = new Date().toISOString();
        req.updated_at = new Date().toISOString();

        if (auditLogs) {
            KycService.logAction(auditLogs, userId, 'REFUND_CANCELLED_BY_MEMBER', 'refund_requests', refundId, { status: oldStatus }, { status: req.status });
        }

        return {
            success: true,
            refund_request: req
        };
    },

    /**
     * Executes the authoritative refund workflow:
     * 1. Product Access Revocation
     * 2. Double-Entry Commission Reversals (Compensating transactions)
     * 3. Binary Volume Reversals (Compensating negative volume entries)
     * 4. Refund Payout Ledger Entry
     * 5. Audit Trail
     * Protected by master idempotency (never executes reversals twice).
     */
    executeRefundWorkflow({
        refundId,
        actorId,
        refundRequests = [],
        purchases = [],
        walletLedger = [],
        volumeLedger = [],
        binaryNodes = [],
        auditLogs = [],
        bankPayoutReference = 'REF-CEFT-AUTO'
    }) {
        const req = refundRequests.find(r => r.id === refundId);
        if (!req) {
            throw new Error(`Refund request ${refundId} not found.`);
        }

        // Idempotency Guard
        if (req.status === REFUND_STATUSES.REFUNDED) {
            return {
                success: true,
                idempotent: true,
                message: `Refund ${refundId} has already been executed.`,
                refund_request: req
            };
        }

        if (req.status !== REFUND_STATUSES.APPROVED && req.status !== REFUND_STATUSES.UNDER_REVIEW && req.status !== REFUND_STATUSES.REQUESTED) {
            throw new Error(`Cannot execute refund with status ${req.status}. Request must be approved.`);
        }

        const purchase = purchases.find(p => p.id === req.purchase_id);
        if (!purchase) {
            throw new Error(`Purchase ${req.purchase_id} not found.`);
        }

        const timestamp = new Date().toISOString();
        const reversalAuditEntries = [];

        // 1. Revoke Product Access
        purchase.status = 'REFUNDED';
        purchase.access_status = 'REVOKED';
        purchase.refunded_at = timestamp;

        // 2. Double-Entry Commission Reversals for all recipients
        const originalCommissionTxs = walletLedger.filter(tx => 
            (tx.reference_id === purchase.id || tx.source_purchase_id === purchase.id) &&
            (tx.type || '').includes('COMMISSION') &&
            !(tx.type || '').includes('REVERSAL') &&
            tx.status === 'COMPLETED'
        );

        originalCommissionTxs.forEach(origTx => {
            const reversalKey = `rev-comm-${origTx.id}-${purchase.id}`;
            const existingReversal = walletLedger.find(tx => tx.id === reversalKey || tx.idempotency_key === reversalKey);
            
            if (!existingReversal) {
                const reversalTx = {
                    id: reversalKey,
                    idempotency_key: reversalKey,
                    user_id: origTx.user_id,
                    type: 'COMMISSION_REVERSAL',
                    amount: -Math.abs(Number(origTx.amount)),
                    original_transaction_id: origTx.id,
                    reference_id: purchase.id,
                    reference_type: 'product_purchases',
                    status: 'COMPLETED',
                    notes: `Compensating reversal for refunded purchase ${purchase.id}`,
                    created_at: timestamp
                };
                walletLedger.push(reversalTx);
                reversalAuditEntries.push({ user_id: origTx.user_id, amount: reversalTx.amount, original_tx: origTx.id });
            }
        });

        // 3. Binary Volume Reversals (Compensating negative volume entries)
        if (binaryNodes && volumeLedger) {
            VolumeLedger.reverseVolume(purchase.id, binaryNodes, volumeLedger);
        }

        // 4. Refund Payout Ledger Entry
        const refundLedgerKey = `tx-refund-payout-${req.id}`;
        const existingRefundPayout = walletLedger.find(tx => tx.id === refundLedgerKey);
        if (!existingRefundPayout) {
            walletLedger.push({
                id: refundLedgerKey,
                idempotency_key: refundLedgerKey,
                user_id: purchase.user_id,
                type: 'REFUND_PAYOUT',
                amount: Number(req.amount),
                bank_payout_reference: bankPayoutReference,
                reference_id: purchase.id,
                reference_type: 'product_purchases',
                status: 'COMPLETED',
                created_at: timestamp
            });
        }

        // 5. Finalize Refund Request Status
        req.status = REFUND_STATUSES.REFUNDED;
        req.refunded_at = timestamp;
        req.bank_payout_reference = bankPayoutReference;
        req.updated_at = timestamp;

        // 6. Audit Trail Logging
        if (auditLogs) {
            KycService.logAction(auditLogs, actorId, 'REFUND_EXECUTED', 'refund_requests', req.id, { status: 'APPROVED' }, {
                status: REFUND_STATUSES.REFUNDED,
                purchase_id: purchase.id,
                refund_amount: req.amount,
                reversed_commissions_count: reversalAuditEntries.length,
                bank_payout_reference: bankPayoutReference
            });
        }

        return {
            success: true,
            refund_id: req.id,
            purchase_id: purchase.id,
            status: REFUND_STATUSES.REFUNDED,
            product_access: 'REVOKED',
            reversed_commissions: reversalAuditEntries,
            refunded_at: timestamp
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = RefundService;
}
