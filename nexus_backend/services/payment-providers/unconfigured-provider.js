// ==============================================================================
// NEXUS PRIME (PVT) LTD — UNCONFIGURED PAYMENT PROVIDER (SAFE FALLBACK)
// DOMAIN: nexusp.online
// ==============================================================================

const PaymentProvider = require('./payment-provider-base');

class UnconfiguredPaymentProvider extends PaymentProvider {
    constructor(config = {}) {
        super('none', config);
    }

    async createPayment(order, member, options = {}) {
        return {
            success: false,
            code: 'PAYMENT_NOT_CONFIGURED',
            message: 'Online payment is currently being configured. Orders remain saved in awaiting payment status.',
            configured: false,
            order_id: order.id,
            order_number: order.order_number
        };
    }

    async verifyPayment(paymentRecord, payload = {}) {
        return {
            verified: false,
            code: 'PAYMENT_NOT_CONFIGURED',
            status: 'pending',
            message: 'Payment provider is not active.'
        };
    }

    async handleWebhook(payload, headers = {}) {
        return {
            valid: false,
            code: 'PAYMENT_NOT_CONFIGURED',
            message: 'No active payment gateway configured to receive webhooks.'
        };
    }

    async refundPayment(paymentRecord, amount, reason = '') {
        return {
            success: false,
            code: 'PAYMENT_NOT_CONFIGURED',
            message: 'Refund engine not configured.'
        };
    }

    async getPaymentStatus(providerPaymentId) {
        return {
            success: false,
            status: 'unknown',
            code: 'PAYMENT_NOT_CONFIGURED'
        };
    }
}

module.exports = UnconfiguredPaymentProvider;
