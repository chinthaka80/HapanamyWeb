// Hapanamy.lk KYC & Bank Account Domain Service
// Handles status transitions, secure private storage mappings, and logging events

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
    }
};

if (typeof module !== 'undefined') {
    module.exports = KycService;
}
