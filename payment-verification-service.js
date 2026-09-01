// Hapanamy.lk Bank Deposit & Payment Verification Engine (STEP 22)
// Handles manual bank transfer verification, slip uploads, fraud anomaly detection (duplicate references/slips),
// secure file validation, and transactional purchase activation with immutable snapshot creation.

const crypto = require('crypto');
const ProductSnapshotService = require('./product-snapshot-service');
const DirectCommissionEngine = require('./direct-commission-engine');
const QualifiedUplineCommissionEngine = require('./qualified-upline-commission-engine');
const QualificationEngine = require('./qualification-engine');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const PaymentVerificationService = {
    _paymentSubmissions: [],
    _auditLogs: [],
    _approvalLocks: new Set(),

    /**
     * Validates payment slip file type and size.
     */
    validateSlipFile({ mimeType, fileSizeBytes, fileBuffer = null }) {
        if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
            return {
                valid: false,
                reason: `Invalid file type: ${mimeType}. Allowed formats are JPEG, PNG, WEBP, and PDF.`
            };
        }

        if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
            return {
                valid: false,
                reason: `File size exceeds the 5 MB limit (Provided: ${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB).`
            };
        }

        let fileHash = null;
        if (fileBuffer) {
            fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        }

        return { valid: true, fileHash };
    },

    /**
     * Scans for fraud anomalies (duplicate reference, duplicate slip hash, amount mismatch).
     */
    detectFraudAnomalies({
        userId,
        productId,
        amount,
        productSellingPrice,
        transferReference,
        slipHash,
        existingPayments = []
    }) {
        const flags = [];

        // 1. Check Duplicate Reference Number
        if (transferReference) {
            const cleanRef = transferReference.trim().toUpperCase();
            const dupRef = existingPayments.find(p => 
                p.transfer_reference && 
                p.transfer_reference.trim().toUpperCase() === cleanRef && 
                p.status !== 'CANCELLED' && 
                p.status !== 'REJECTED'
            );
            if (dupRef) {
                flags.push({
                    type: 'DUPLICATE_REFERENCE',
                    severity: 'HIGH',
                    message: `Transfer reference '${transferReference}' matches existing payment submission ${dupRef.id}.`
                });
            }
        }

        // 2. Check Duplicate Slip Hash
        if (slipHash) {
            const dupSlip = existingPayments.find(p => 
                p.slip_hash === slipHash && 
                p.status !== 'CANCELLED' && 
                p.status !== 'REJECTED'
            );
            if (dupSlip) {
                flags.push({
                    type: 'DUPLICATE_SLIP_HASH',
                    severity: 'CRITICAL',
                    message: `Payment slip file is identical to slip on payment ${dupSlip.id} (Member: ${dupSlip.user_id}).`
                });
            }
        }

        // 3. Amount Mismatch check
        if (productSellingPrice !== undefined && Number(amount) !== Number(productSellingPrice)) {
            flags.push({
                type: 'AMOUNT_MISMATCH',
                severity: 'MEDIUM',
                message: `Submitted amount (Rs. ${amount}) does not match product price (Rs. ${productSellingPrice}).`
            });
        }

        // 4. Velocity Check (More than 3 pending payments for same user)
        const userPending = existingPayments.filter(p => p.user_id === userId && p.status === 'PENDING');
        if (userPending.length >= 3) {
            flags.push({
                type: 'VELOCITY_ALERT',
                severity: 'LOW',
                message: `User has ${userPending.length} other pending payment submissions.`
            });
        }

        return {
            is_suspicious: flags.length > 0,
            flags,
            recommended_action: flags.length > 0 ? 'FLAG_FOR_MANUAL_REVIEW' : 'STANDARD_PROCESSING'
        };
    },

    /**
     * Submits a bank transfer payment verification request.
     */
    submitPayment({
        userId,
        productId,
        product,
        amount,
        transferReference,
        transferDate,
        transferTime = null,
        bankName,
        slipFile, // { mimeType, fileSizeBytes, fileBuffer, fileName }
        existingPayments = null
    }) {
        if (!userId || !productId) {
            throw new Error('User ID and Product ID are required.');
        }

        if (!transferReference || !bankName || !transferDate) {
            throw new Error('Transfer reference, bank name, and transfer date are mandatory.');
        }

        const paymentsList = existingPayments || this._paymentSubmissions;

        // 1. Validate File
        const fileValidation = this.validateSlipFile(slipFile || {});
        if (!fileValidation.valid) {
            return {
                success: false,
                reason: fileValidation.reason
            };
        }

        const slipHash = fileValidation.fileHash || (slipFile.fileHash || null);

        // 2. Fraud & Anomaly Scan
        const productPrice = product ? product.selling_price : amount;
        const fraudCheck = this.detectFraudAnomalies({
            userId,
            productId,
            amount: Number(amount),
            productSellingPrice: productPrice,
            transferReference,
            slipHash,
            existingPayments: paymentsList
        });

        // 3. Create Payment Submission Record
        const paymentId = 'pay-req-' + crypto.randomBytes(8).toString('hex');
        const paymentRecord = {
            id: paymentId,
            user_id: userId,
            product_id: productId,
            amount: Number(amount),
            transfer_reference: transferReference.trim(),
            transfer_date: transferDate,
            transfer_time: transferTime,
            bank_name: bankName.trim(),
            slip_mime_type: slipFile.mimeType,
            slip_file_size: slipFile.fileSizeBytes,
            slip_hash: slipHash,
            slip_storage_key: `private/slips/${paymentId}/${slipFile.fileName || 'slip.jpg'}`,
            status: 'PENDING',
            flagged_for_review: fraudCheck.is_suspicious,
            fraud_flags: fraudCheck.flags,
            admin_notes: null,
            reviewed_by: null,
            reviewed_at: null,
            created_at: new Date().toISOString()
        };

        paymentsList.push(paymentRecord);

        return {
            success: true,
            payment_id: paymentId,
            status: paymentRecord.status,
            flagged_for_review: paymentRecord.flagged_for_review,
            fraud_flags: paymentRecord.fraud_flags,
            payment: paymentRecord
        };
    },

    /**
     * Admin approves bank transfer payment, creates immutable snapshot, and activates product purchase.
     */
    approvePayment({
        paymentId,
        adminUserId = 'admin',
        adminNotes = null,
        product,
        payments = null,
        purchases = [],
        sponsors = [],
        binaryNodes = [],
        users = [],
        kycDocs = [],
        commissionLedger = [],
        walletLedger = [],
        dailyEarningsMap = new Map()
    }) {
        const paymentsList = payments || this._paymentSubmissions;
        const payment = paymentsList.find(p => p.id === paymentId);

        if (!payment) {
            throw new Error(`Payment verification request ${paymentId} not found.`);
        }

        if (payment.status === 'APPROVED') {
            throw new Error(`Payment ${paymentId} has already been approved. Duplicate approval blocked.`);
        }

        if (payment.status === 'REJECTED' || payment.status === 'CANCELLED') {
            throw new Error(`Cannot approve payment in '${payment.status}' status.`);
        }

        const lockKey = `lock-payment-approve-${paymentId}`;
        if (this._approvalLocks.has(lockKey)) {
            throw new Error(`Approval processing already in progress for payment ${paymentId}`);
        }

        this._approvalLocks.add(lockKey);

        try {
            // 1. Transition Payment Status
            payment.status = 'APPROVED';
            payment.reviewed_by = adminUserId;
            payment.reviewed_at = new Date().toISOString();
            payment.admin_notes = adminNotes;

            // 2. Create Active Product Purchase with Immutable Snapshot
            const purchaseId = 'purch-' + crypto.randomBytes(8).toString('hex');
            const targetProduct = product || {
                id: payment.product_id,
                name: 'Hapanamy MLM Masterclass',
                selling_price: payment.amount,
                product_cost: 10500,
                min_company_profit: 2000,
                direct_commission_rate: 8.00,
                binary_commission_rate: 6.00,
                binary_volume: payment.amount,
                max_binary_qualified_levels: 7,
                status: 'ACTIVE'
            };

            const snapshot = ProductSnapshotService.createSnapshot(targetProduct, purchaseId);

            const purchaseRecord = {
                id: purchaseId,
                user_id: payment.user_id,
                product_id: payment.product_id,
                payment_id: paymentId,
                selling_price: payment.amount,
                economics_snapshot: snapshot,
                status: 'ACTIVE',
                created_at: new Date().toISOString()
            };

            purchases.push(purchaseRecord);

            // 3. Process Direct Commission
            let directResult = null;
            if (sponsors && sponsors.length > 0) {
                directResult = DirectCommissionEngine.processDirectCommission({
                    purchase: purchaseRecord,
                    snapshot,
                    sponsors,
                    users,
                    commissionLedger,
                    walletLedger,
                    dailyEarningsMap
                });
            }

            // 4. Process 7 Qualified Upline Binary Commissions
            let uplineResult = null;
            if (binaryNodes && binaryNodes.length > 0) {
                const qualificationContext = { users, kycDocs, purchases, sponsors, binaryNodes };
                uplineResult = QualifiedUplineCommissionEngine.processQualifiedUplineCommissions({
                    purchase: purchaseRecord,
                    snapshot,
                    binaryNodes,
                    qualificationContext,
                    commissionLedger,
                    walletLedger,
                    dailyEarningsMap
                });
            }

            // 5. Record Admin Audit Log
            const auditEntry = {
                id: 'audit-pay-' + crypto.randomBytes(8).toString('hex'),
                user_id: adminUserId,
                action: 'PAYMENT_VERIFICATION_APPROVED',
                entity_type: 'payment_verification',
                entity_id: paymentId,
                purchase_id: purchaseId,
                notes: adminNotes,
                created_at: new Date().toISOString()
            };
            this._auditLogs.push(auditEntry);

            return {
                success: true,
                payment_id: paymentId,
                status: 'APPROVED',
                purchase_id: purchaseId,
                snapshot_id: snapshot.id,
                direct_commission: directResult,
                upline_commissions: uplineResult,
                audit: auditEntry
            };

        } finally {
            this._approvalLocks.delete(lockKey);
        }
    },

    /**
     * Admin rejects bank transfer payment verification.
     */
    rejectPayment({
        paymentId,
        adminUserId = 'admin',
        rejectionReason,
        payments = null
    }) {
        if (!rejectionReason) {
            throw new Error('Rejection reason is mandatory when rejecting a payment.');
        }

        const paymentsList = payments || this._paymentSubmissions;
        const payment = paymentsList.find(p => p.id === paymentId);

        if (!payment) {
            throw new Error(`Payment verification request ${paymentId} not found.`);
        }

        if (payment.status === 'APPROVED') {
            throw new Error(`Cannot reject an already APPROVED payment ${paymentId}.`);
        }

        if (payment.status === 'REJECTED') {
            throw new Error(`Payment ${paymentId} is already REJECTED.`);
        }

        payment.status = 'REJECTED';
        payment.reviewed_by = adminUserId;
        payment.reviewed_at = new Date().toISOString();
        payment.rejection_reason = rejectionReason;

        const auditEntry = {
            id: 'audit-pay-rej-' + crypto.randomBytes(8).toString('hex'),
            user_id: adminUserId,
            action: 'PAYMENT_VERIFICATION_REJECTED',
            entity_type: 'payment_verification',
            entity_id: paymentId,
            reason: rejectionReason,
            created_at: new Date().toISOString()
        };
        this._auditLogs.push(auditEntry);

        return {
            success: true,
            payment_id: paymentId,
            status: 'REJECTED',
            rejection_reason: rejectionReason,
            audit: auditEntry
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = PaymentVerificationService;
}
