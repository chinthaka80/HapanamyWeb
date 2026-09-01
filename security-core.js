// Hapanamy.lk Security & Anti-Fraud Core Engine
// Implements API rate limiting, XSS input filters, path traversal protections, and fraud detection sensors

const SecurityCore = {
    // Simple in-memory storage for rate limiting
    rateLimitMap: new Map(),

    /**
     * In-memory Rate Limiter to protect endpoints from Brute Force and API abuse.
     * Limit: Default 100 requests per 15 minutes per IP.
     */
    isRateLimited(ip, limit = 100, windowMs = 15 * 60 * 1000) {
        const now = Date.now();
        if (!this.rateLimitMap.has(ip)) {
            this.rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
            return false;
        }

        const data = this.rateLimitMap.get(ip);
        if (now > data.resetTime) {
            // Window expired, reset
            this.rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
            return false;
        }

        data.count++;
        return data.count > limit;
    },

    /**
     * Sanitizes inputs to prevent Cross-Site Scripting (XSS) attacks.
     */
    sanitizeInput(str) {
        if (typeof str !== 'string') return str;
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    },

    /**
     * Prevents path traversal vulnerabilities by verifying safe filenames.
     */
    isSafeFilename(filename) {
        // Blocks paths containing parent directory relative dots e.g. ../ or absolute paths
        if (!filename || typeof filename !== 'string') return false;
        return !filename.includes('..') && !filename.includes('/') && !filename.includes('\\');
    },

    /**
     * Detects suspicious registration patterns (e.g., multiple accounts sharing same bank or NIC details).
     */
    detectFraudAlerts(user, kycDocs, bankAccounts) {
        const alerts = [];

        // Check for duplicate NIC numbers across verified/pending documents
        const duplicateNicCount = kycDocs.filter(doc => doc.nic_passport === user.nicPassport).length;
        if (duplicateNicCount > 1) {
            alerts.push({
                type: 'SUSPICIOUS_DUPLICATE_NIC',
                severity: 'CRITICAL',
                message: `NIC/Passport ${user.nicPassport} is associated with multiple accounts.`
            });
        }

        // Check for duplicate bank account numbers
        const duplicateBankCount = bankAccounts.filter(bank => bank.account_number === user.accountNumber).length;
        if (duplicateBankCount > 1) {
            alerts.push({
                type: 'SUSPICIOUS_DUPLICATE_BANK',
                severity: 'HIGH',
                message: `Bank account number ${user.accountNumber} is shared across multiple profiles.`
            });
        }

        return alerts;
    }
};

if (typeof module !== 'undefined') {
    module.exports = SecurityCore;
}
