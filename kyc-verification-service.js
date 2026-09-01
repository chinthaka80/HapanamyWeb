// Hapanamy.lk KYC & Member Identity Verification Engine (STEP 25)
// Secure KYC submissions (NIC/Passport/Bank details), private document storage, time-limited signed tokens,
// role-based access control, access audit logging, and immutable verification decision history.

const crypto = require('crypto');

const ALLOWED_ID_TYPES = ['NIC', 'PASSPORT', 'DRIVING_LICENSE'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_DOC_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const KycVerificationService = {
    _kycSubmissions: [],
    _kycHistory: [],
    _documentAccessLogs: [],
    _adminAuditLogs: [],

    /**
     * Masks sensitive identity and banking data for safe display.
     */
    maskSensitiveData(val, visibleChars = 4) {
        if (!val || typeof val !== 'string') return val;
        const str = val.trim();
        if (str.length <= visibleChars) return '***';
        const maskedLength = Math.max(3, str.length - visibleChars);
        return '*'.repeat(maskedLength) + str.slice(-visibleChars);
    },

    /**
     * Validates KYC document file parameters.
     */
    validateDocumentFile({ fileName, mimeType, fileSizeBytes, fileBuffer = null }) {
        if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
            return {
                valid: false,
                reason: `Invalid document type: ${mimeType}. Allowed formats are JPEG, PNG, WEBP, and PDF.`
            };
        }

        if (fileSizeBytes > MAX_DOC_SIZE_BYTES) {
            return {
                valid: false,
                reason: `Document exceeds 5 MB size limit (Size: ${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB).`
            };
        }

        let fileHash = null;
        if (fileBuffer) {
            fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        }

        return { valid: true, fileHash };
    },

    /**
     * Submits or re-submits a member KYC application.
     */
    submitKyc({
        userId,
        identityDocumentType = 'NIC',
        identityNumber,
        fullName,
        address,
        bankDetails, // { account_holder_name, bank_name, branch, account_number }
        documents = {}, // { front: { ... }, back: { ... } }
        kycList = null,
        historyList = null
    }) {
        if (!userId) throw new Error('User ID is required.');
        if (!identityNumber || !fullName) {
            throw new Error('Identity number and full legal name are required.');
        }

        const idType = identityDocumentType.toUpperCase();
        if (!ALLOWED_ID_TYPES.includes(idType)) {
            throw new Error(`Invalid identity document type: ${identityDocumentType}. Allowed: ${ALLOWED_ID_TYPES.join(', ')}.`);
        }

        if (!bankDetails || !bankDetails.account_number || !bankDetails.bank_name) {
            throw new Error('Complete bank account details are required for KYC.');
        }

        // Validate document files
        if (documents.front) {
            const frontVal = this.validateDocumentFile(documents.front);
            if (!frontVal.valid) throw new Error(`Front document error: ${frontVal.reason}`);
        }

        const list = kycList || this._kycSubmissions;
        const hist = historyList || this._kycHistory;

        // Check existing KYC submission
        const existingIdx = list.findIndex(k => k.user_id === userId);
        if (existingIdx !== -1) {
            const existing = list[existingIdx];
            // Archive current record to history
            hist.push({
                ...existing,
                archived_at: new Date().toISOString(),
                archive_reason: 'MEMBER_RESUBMISSION'
            });
            list.splice(existingIdx, 1);
        }

        const kycId = 'kyc-' + crypto.randomBytes(8).toString('hex');
        const kycRecord = {
            id: kycId,
            user_id: userId,
            identity_document_type: idType,
            identity_number: identityNumber.trim(),
            identity_number_masked: this.maskSensitiveData(identityNumber),
            full_name: fullName.trim(),
            address: address ? { ...address } : null,
            bank_details: {
                account_holder_name: bankDetails.account_holder_name || fullName.trim(),
                bank_name: bankDetails.bank_name.trim(),
                branch: bankDetails.branch ? bankDetails.branch.trim() : '',
                account_number: bankDetails.account_number.trim(),
                account_number_masked: this.maskSensitiveData(bankDetails.account_number)
            },
            documents: {
                front_storage_key: documents.front ? `private/kyc/${userId}/${kycId}/front.jpg` : null,
                front_hash: documents.front ? documents.front.fileHash : null,
                back_storage_key: documents.back ? `private/kyc/${userId}/${kycId}/back.jpg` : null,
                back_hash: documents.back ? documents.back.fileHash : null
            },
            status: 'PENDING',
            rejection_reason: null,
            admin_notes: null,
            reviewed_by: null,
            reviewed_at: null,
            created_at: new Date().toISOString()
        };

        list.push(kycRecord);

        return {
            success: true,
            kyc_id: kycId,
            status: 'PENDING',
            kyc: kycRecord
        };
    },

    /**
     * Admin moves KYC status to UNDER_REVIEW.
     */
    startReview({ kycId, adminUserId = 'admin', kycList = null }) {
        const list = kycList || this._kycSubmissions;
        const record = list.find(k => k.id === kycId);
        if (!record) throw new Error(`KYC record ${kycId} not found.`);

        record.status = 'UNDER_REVIEW';
        record.reviewed_by = adminUserId;
        return { success: true, kyc_id: kycId, status: 'UNDER_REVIEW' };
    },

    /**
     * Admin approves KYC application.
     */
    approveKyc({ kycId, adminUserId = 'admin', adminNotes = null, kycList = null, users = [] }) {
        const list = kycList || this._kycSubmissions;
        const record = list.find(k => k.id === kycId);
        if (!record) throw new Error(`KYC record ${kycId} not found.`);

        record.status = 'APPROVED';
        record.reviewed_by = adminUserId;
        record.reviewed_at = new Date().toISOString();
        record.admin_notes = adminNotes;

        // Update user record if provided
        if (users && users.length > 0) {
            const user = users.find(u => u.id === record.user_id);
            if (user) {
                user.kyc_status = 'APPROVED';
                user.kyc_verified_at = record.reviewed_at;
            }
        }

        const auditEntry = {
            id: 'audit-kyc-' + crypto.randomBytes(8).toString('hex'),
            user_id: adminUserId,
            action: 'KYC_APPROVED',
            entity_type: 'kyc',
            entity_id: kycId,
            target_user_id: record.user_id,
            notes: adminNotes,
            created_at: new Date().toISOString()
        };
        this._adminAuditLogs.push(auditEntry);

        return { success: true, kyc_id: kycId, status: 'APPROVED', audit: auditEntry };
    },

    /**
     * Admin rejects KYC application with reason.
     */
    rejectKyc({ kycId, rejectionReason, adminUserId = 'admin', kycList = null, users = [] }) {
        if (!rejectionReason) throw new Error('Rejection reason is mandatory when rejecting KYC.');

        const list = kycList || this._kycSubmissions;
        const record = list.find(k => k.id === kycId);
        if (!record) throw new Error(`KYC record ${kycId} not found.`);

        record.status = 'REJECTED';
        record.rejection_reason = rejectionReason;
        record.reviewed_by = adminUserId;
        record.reviewed_at = new Date().toISOString();

        if (users && users.length > 0) {
            const user = users.find(u => u.id === record.user_id);
            if (user) {
                user.kyc_status = 'REJECTED';
            }
        }

        const auditEntry = {
            id: 'audit-kyc-' + crypto.randomBytes(8).toString('hex'),
            user_id: adminUserId,
            action: 'KYC_REJECTED',
            entity_type: 'kyc',
            entity_id: kycId,
            target_user_id: record.user_id,
            reason: rejectionReason,
            created_at: new Date().toISOString()
        };
        this._adminAuditLogs.push(auditEntry);

        return { success: true, kyc_id: kycId, status: 'REJECTED', rejection_reason: rejectionReason };
    },

    /**
     * Admin requests correction on submitted KYC.
     */
    requestCorrection({ kycId, correctionNotes, adminUserId = 'admin', kycList = null }) {
        if (!correctionNotes) throw new Error('Correction notes are mandatory.');

        const list = kycList || this._kycSubmissions;
        const record = list.find(k => k.id === kycId);
        if (!record) throw new Error(`KYC record ${kycId} not found.`);

        record.status = 'CORRECTION_REQUESTED';
        record.admin_notes = correctionNotes;
        record.reviewed_by = adminUserId;
        record.reviewed_at = new Date().toISOString();

        return { success: true, kyc_id: kycId, status: 'CORRECTION_REQUESTED', notes: correctionNotes };
    },

    /**
     * Generates a secure, signed time-limited access URL/token for private KYC documents.
     * Enforces role-based access control and access audit logging.
     */
    generateDocumentAccessToken({
        kycId,
        documentType = 'front',
        requestingUserId,
        requestingRole = 'MEMBER',
        ipAddress = '127.0.0.1',
        kycList = null
    }) {
        const list = kycList || this._kycSubmissions;
        const record = list.find(k => k.id === kycId);
        if (!record) throw new Error(`KYC record ${kycId} not found.`);

        // Role-Based Authorization Check
        const isOwner = record.user_id === requestingUserId;
        const isAdmin = requestingRole === 'ADMIN' || requestingRole === 'SUPER_ADMIN' || requestingRole === 'COMPLIANCE';

        if (!isOwner && !isAdmin) {
            throw new Error('403 Forbidden: You do not have authorization to view this private KYC document.');
        }

        const storageKey = documentType === 'front' 
            ? record.documents.front_storage_key 
            : record.documents.back_storage_key;

        if (!storageKey) {
            throw new Error(`Requested document (${documentType}) does not exist on KYC ${kycId}.`);
        }

        // Generate signed token with 15-minute expiry
        const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins
        const tokenPayload = `${kycId}|${storageKey}|${requestingUserId}|${expiresAt}`;
        const signature = crypto.createHmac('sha256', 'hapanamy-kyc-secret-salt-2026').update(tokenPayload).digest('hex');

        const signedAccessToken = `${Buffer.from(tokenPayload).toString('base64')}.${signature}`;

        // Record Access Audit Log
        const accessLog = {
            id: 'doc-acc-' + crypto.randomBytes(8).toString('hex'),
            kyc_id: kycId,
            target_user_id: record.user_id,
            requested_document: documentType,
            storage_key: storageKey,
            accessed_by: requestingUserId,
            accessor_role: requestingRole,
            ip_address: ipAddress,
            expires_at: new Date(expiresAt).toISOString(),
            accessed_at: new Date().toISOString()
        };
        this._documentAccessLogs.push(accessLog);

        return {
            success: true,
            storage_key: storageKey,
            signed_token: signedAccessToken,
            expires_at: accessLog.expires_at,
            access_log_id: accessLog.id
        };
    },

    /**
     * Retrieves member KYC verification history.
     */
    getMemberKycHistory(userId, kycList = null, historyList = null) {
        const list = kycList || this._kycSubmissions;
        const hist = historyList || this._kycHistory;

        const current = list.find(k => k.user_id === userId);
        const past = hist.filter(k => k.user_id === userId);

        return {
            user_id: userId,
            current_status: current ? current.status : 'NOT_SUBMITTED',
            current_submission: current || null,
            past_submissions: past
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = KycVerificationService;
}
