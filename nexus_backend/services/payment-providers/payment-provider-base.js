// ==============================================================================
// NEXUS PRIME (PVT) LTD — PAYMENT PROVIDER BASE INTERFACE
// DOMAIN: nexusp.online
// ==============================================================================

class PaymentProvider {
    constructor(name, config = {}) {
        this.name = name;
        this.config = config;
    }

    /**
     * Initiates a payment session with the gateway.
     * @param {Object} order - The trusted order record from the database.
     * @param {Object} member - The member profile and user details.
     * @param {Object} options - Additional checkout options.
     * @returns {Promise<Object>} { success, payment_url, provider_payment_id, form_fields, instructions }
     */
    async createPayment(order, member, options = {}) {
        throw new Error(`createPayment() must be implemented by provider [${this.name}]`);
    }

    /**
     * Verifies payment status server-side after return redirect or inquiry.
     * @param {Object} paymentRecord - The internal payment record.
     * @param {Object} payload - Data returned from gateway query or redirect.
     * @returns {Promise<Object>} { verified: boolean, status: string, provider_payment_id, amount, currency, raw }
     */
    async verifyPayment(paymentRecord, payload = {}) {
        throw new Error(`verifyPayment() must be implemented by provider [${this.name}]`);
    }

    /**
     * Handles incoming server-to-server webhook / IPN callback.
     * @param {Object} payload - Raw or parsed body sent by the gateway.
     * @param {Object} headers - Request headers for signature verification.
     * @returns {Promise<Object>} { valid: boolean, order_id, provider_payment_id, status, amount, currency, message }
     */
    async handleWebhook(payload, headers = {}) {
        throw new Error(`handleWebhook() must be implemented by provider [${this.name}]`);
    }

    /**
     * Requests a refund through the provider.
     * @param {Object} paymentRecord - The original verified payment record.
     * @param {number} amount - Amount to refund.
     * @param {string} reason - Justification.
     * @returns {Promise<Object>}
     */
    async refundPayment(paymentRecord, amount, reason = '') {
        throw new Error(`refundPayment() must be implemented by provider [${this.name}]`);
    }

    /**
     * Polls or queries real-time status from gateway API.
     * @param {string} providerPaymentId - External transaction ID.
     * @returns {Promise<Object>}
     */
    async getPaymentStatus(providerPaymentId) {
        throw new Error(`getPaymentStatus() must be implemented by provider [${this.name}]`);
    }
}

module.exports = PaymentProvider;
