// ==============================================================================
// NEXUS PRIME (PVT) LTD — SANDBOX PAYMENT PROVIDER (DEVELOPMENT & TESTING)
// DOMAIN: nexusp.online
// ==============================================================================

const crypto = require('crypto');
const PaymentProvider = require('./payment-provider-base');

class SandboxPaymentProvider extends PaymentProvider {
    constructor(config = {}) {
        super('sandbox', config);
        this.secret = config.secret || 'nexus_sandbox_secret_key_77382910';
        this.webhookSecret = config.webhookSecret || 'nexus_webhook_sec_88491029';
    }

    /**
     * Generates a deterministic signature token for sandbox simulation.
     */
    generateToken(orderNumber, amount, currency) {
        return crypto.createHmac('sha256', this.secret)
                     .update(`${orderNumber}:${amount.toFixed(2)}:${currency}`)
                     .digest('hex');
    }

    async createPayment(order, member, options = {}) {
        const token = this.generateToken(order.order_number, order.total, order.currency);
        const providerPaymentId = `sbx-tx-${crypto.randomBytes(6).toString('hex')}`;

        return {
            success: true,
            configured: true,
            provider: 'sandbox',
            provider_payment_id: providerPaymentId,
            order_id: order.id,
            order_number: order.order_number,
            amount: order.total,
            currency: order.currency,
            simulation_token: token,
            checkout_url: `/dashboard/payments/process?order=${order.order_number}&token=${token}&tx=${providerPaymentId}`,
            instructions: 'Sandbox payment simulation active. Submit simulated webhook or use test confirmation.'
        };
    }

    async verifyPayment(paymentRecord, payload = {}) {
        const expectedToken = this.generateToken(payload.order_number || '', paymentRecord.amount, paymentRecord.currency);
        const receivedToken = payload.token || payload.simulation_token || '';

        const isValid = (receivedToken && receivedToken === expectedToken) || payload.simulate_success === true;

        return {
            verified: isValid,
            status: isValid ? 'paid' : 'failed',
            provider_payment_id: payload.provider_payment_id || paymentRecord.provider_payment_id || `sbx-ver-${Date.now()}`,
            amount: paymentRecord.amount,
            currency: paymentRecord.currency,
            message: isValid ? 'Sandbox signature verified successfully' : 'Sandbox verification token mismatch'
        };
    }

    async handleWebhook(payload, headers = {}) {
        const signatureHeader = headers['x-nexus-signature'] || headers['x-signature'] || payload.signature;
        
        // Webhook signature verification
        const orderNumber = payload.order_number || payload.order_id;
        const amount = parseFloat(payload.amount);
        const currency = payload.currency || 'LKR';

        if (!orderNumber || isNaN(amount)) {
            return {
                valid: false,
                code: 'INVALID_PAYLOAD',
                message: 'Missing required order reference or amount'
            };
        }

        const expectedSignature = crypto.createHmac('sha256', this.webhookSecret)
                                        .update(`${orderNumber}:${amount.toFixed(2)}:${currency}`)
                                        .digest('hex');

        // Allow matching either webhookSecret HMAC or sandbox token for testing flexibility
        const simulationSig = this.generateToken(orderNumber, amount, currency);
        const isValid = signatureHeader === expectedSignature || 
                        signatureHeader === simulationSig || 
                        payload.simulate_success === true || 
                        payload.event === 'payment.success' ||
                        !signatureHeader;

        if (!isValid) {
            return {
                valid: false,
                code: 'INVALID_SIGNATURE',
                message: 'Cryptographic webhook signature verification failed'
            };
        }

        const statusCode = payload.status || (payload.event === 'payment.success' ? 'success' : 'success');
        const isPaid = statusCode === 'success' || statusCode === 'paid' || payload.event === 'payment.success';

        return {
            valid: true,
            order_number: orderNumber,
            provider_payment_id: payload.provider_payment_id || `sbx-wh-${crypto.randomBytes(4).toString('hex')}`,
            status: isPaid ? 'paid' : 'failed',
            amount,
            currency,
            payment_method: payload.payment_method || 'sandbox_card',
            message: 'Sandbox webhook validated'
        };
    }

    async refundPayment(paymentRecord, amount, reason = '') {
        return {
            success: true,
            provider_refund_id: `sbx-ref-${crypto.randomBytes(6).toString('hex')}`,
            amount,
            currency: paymentRecord.currency,
            status: 'completed',
            refunded_at: new Date().toISOString()
        };
    }

    async getPaymentStatus(providerPaymentId) {
        return {
            success: true,
            status: 'paid',
            provider_payment_id: providerPaymentId
        };
    }
}

module.exports = SandboxPaymentProvider;
