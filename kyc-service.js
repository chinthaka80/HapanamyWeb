// Hapanamy.lk KYC, Member Registration & Qualification Domain Service (Phase 3)
// Handles complete registration validation, KYC & Bank account lifecycles (PENDING -> APPROVED / REJECTED),
// and binary member commission qualification evaluation.

const KycService = {
    /**
     * Helper to write an audit log entry.
     */
    logAction(auditLogsList, userId, action, entityType, entityId, oldValues = null, newValues = null) {
        const logEntry = {
            id: 'audit-uuid-' + Math.random().toString(36).substr(2, 9),
            user_id: userId,
            action,
            entity_type: entityType,
            entity_id: entityId,
            old_values: oldValues,
            new_values: newValues,
            created_at: new Date().toISOString()
        };
        auditLogsList.push(logEntry);
        return logEntry;
    },

    /**
     * Determines if a user profile is fully complete and eligible for KYC verification.
     */
    isValidSubmission(payload) {
        const { fullName, nicPassport, dob, address, bankName, branchName, accountHolderName, accountNumber } = payload;
        return !!(fullName && nicPassport && dob && address && bankName && branchName && accountHolderName && accountNumber);
    },

    /**
     * Determines if a complete registration payload is valid.
     */
    validateRegistrationPayload(payload) {
        const {
            fullName, username, email, mobile, password,
            sponsorCode, position, nicPassport, address,
            accountHolderName, bankName, branchName, accountNumber
        } = payload;

        if (!fullName || !username || !email || !mobile || !password) {
            return { valid: false, error: 'Basic personal and login credentials are required.' };
        }

        if (!sponsorCode || !position) {
            return { valid: false, error: 'Sponsor referral code and binary placement position are required.' };
        }

        if (!['LEFT', 'RIGHT', 'left', 'right', 'AUTO', 'auto'].includes(position)) {
            return { valid: false, error: 'Placement position must be LEFT, RIGHT, or AUTO.' };
        }

        if (!nicPassport || !address) {
            return { valid: false, error: 'NIC / Passport number and residential address are required for KYC.' };
        }

        if (!accountHolderName || !bankName || !branchName || !accountNumber) {
            return { valid: false, error: 'Complete bank account details are required for commission payouts.' };
        }

        return { valid: true };
    },

    /**
     * Evaluates whether a member meets all qualification requirements for MLM/Binary commission earnings.
     */
    evaluateQualification(userId, kycDocs = [], purchases = [], sponsors = [], binaryNodes = []) {
        const kycDoc = kycDocs.find(d => d.user_id === userId);
        const kycStatus = kycDoc ? kycDoc.status : 'NOT_SUBMITTED';

        // 1. KYC Approval Check
        const isKycApproved = kycStatus === 'APPROVED' || kycStatus === 'VERIFIED';

        // 2. Active Product Purchase Check
        const activePurchases = purchases.filter(p => p.user_id === userId && p.status === 'ACTIVE');
        const hasActivePurchase = activePurchases.length > 0;

        // 3. Direct Sponsorship Check (1 on Left, 1 on Right with active purchases)
        const sponsoredRecords = sponsors.filter(s => s.sponsor_id === userId);
        let leftDirectActive = false;
        let rightDirectActive = false;

        for (const record of sponsoredRecords) {
            const downlinePurchases = purchases.filter(p => p.user_id === record.user_id && p.status === 'ACTIVE');
            if (downlinePurchases.length > 0) {
                // Determine which leg they belong to
                const node = binaryNodes.find(n => n.user_id === record.user_id);
                if (node) {
                    if (node.position === 'LEFT') leftDirectActive = true;
                    if (node.position === 'RIGHT') rightDirectActive = true;
                }
            }
        }

        const isFullyQualified = isKycApproved && hasActivePurchase && (leftDirectActive && rightDirectActive);

        const reasons = [];
        if (!isKycApproved) reasons.push(`KYC status is ${kycStatus} (Requires APPROVED)`);
        if (!hasActivePurchase) reasons.push('No active product course purchase');
        if (!leftDirectActive) reasons.push('Missing active sponsored direct on LEFT leg');
        if (!rightDirectActive) reasons.push('Missing active sponsored direct on RIGHT leg');

        return {
            user_id: userId,
            is_qualified: isFullyQualified,
            kyc_status: kycStatus,
            has_active_purchase: hasActivePurchase,
            left_direct_active: leftDirectActive,
            right_direct_active: rightDirectActive,
            unqualified_reasons: reasons
        };
    },

    /**
     * Handles lifecycle status transitions for KYC documents (PENDING -> APPROVED / REJECTED).
     */
    transitionKycStatus(kycDoc, targetStatus, adminUserId, notes = '', auditLogsList = []) {
        const validStatuses = ['PENDING', 'APPROVED', 'VERIFIED', 'REJECTED'];
        if (!validStatuses.includes(targetStatus)) {
            throw new Error(`Invalid status transition to ${targetStatus}`);
        }

        const oldStatus = kycDoc.status;
        kycDoc.status = targetStatus;
        kycDoc.reviewer_id = adminUserId;
        kycDoc.review_notes = notes || '';
        kycDoc.reviewed_at = new Date().toISOString();

        if (auditLogsList) {
            const action = targetStatus === 'APPROVED' || targetStatus === 'VERIFIED' ? 'KYC_APPROVED' : 'KYC_REJECTED';
            this.logAction(auditLogsList, adminUserId, action, 'kyc_documents', kycDoc.id, { status: oldStatus }, { status: targetStatus, notes });
        }

        return kycDoc;
    }
};

if (typeof module !== 'undefined') {
    module.exports = KycService;
}
