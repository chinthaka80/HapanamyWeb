// Hapanamy.lk Refund & Reversal System Domain Service
// Enforces 14-day refund validity and eligibility rules

const RefundService = {
    /**
     * Checks if a purchase is eligible for a refund.
     * Enforces the default 14-day window.
     */
    checkEligibility(purchase, refundPeriodDays = 14) {
        if (!purchase) {
            return { eligible: false, error: 'Purchase record not found.' };
        }
        if (purchase.status !== 'ACTIVE') {
            return { eligible: false, error: 'Only active purchases can be refunded.' };
        }

        const purchaseTime = new Date(purchase.activated_at || purchase.created_at).getTime();
        const currentTime = Date.now();
        const diffMs = currentTime - purchaseTime;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays > refundPeriodDays) {
            return { eligible: false, error: `Refund period of ${refundPeriodDays} days has expired.` };
        }

        return { eligible: true };
    }
};

if (typeof module !== 'undefined') {
    module.exports = RefundService;
}
