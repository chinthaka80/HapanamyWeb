// ==============================================================================
// NEXUS PRIME (PVT) LTD — PAYHERE SRI LANKA PAYMENT PROVIDER ADAPTER
// DOMAIN: nexusp.online
// ==============================================================================

const crypto = require('crypto');
const PaymentProvider = require('./payment-provider-base');

class PayHerePaymentProvider extends PaymentProvider {
    constructor(config = {}) {
        super('payhere', config);
        this.merchantId = config.merchantId || process.env.NEXUS_PAYMENT_MERCHANT_ID || '';
        this.merchantSecret = config.merchantSecret || process.env.NEXUS_PAYMENT_MERCHANT_SECRET || '';
        this.isSandbox = config.isSandbox !== undefined ? config.isSandbox : (process.env.NEXUS_PAYMENT_SANDBOX !== 'false');

        this.checkoutUrl = this.isSandbox
            ? 'https://sandbox.payhere.lk/pay/checkout'
            : 'https://www.payhere.lk/pay/checkout';
    }

    /**
     * Hashes a string with MD5 in uppercase.
     */
    md5(string) {
        return crypto.createHash('md5').update(string).digest('hex').toUpperCase();
    }

    /**
     * Generates PayHere form initiation hash:
     * md5(merchant_id + order_id + amountFormatted + currency + md5(merchant_secret)).toUpperCase()
     */
    generateInitiationHash(orderNumber, amount, currency) {
        const amountFormatted = parseFloat(amount).toFixed(2);
        const secretHash = this.md5(this.merchantSecret);
        return this.md5(`${this.merchantId}${orderNumber}${amountFormatted}${currency}${secretHash}`);
    }

    /**
     * Verifies PayHere IPN / Webhook checksum:
     * md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + md5(merchant_secret)).toUpperCase()
     */
    verifyIpnHash(payload) {
        const merchantId = payload.merchant_id;
        const orderId = payload.order_id;
        const amount = payload.payhere_amount;
        const currency = payload.payhere_currency;
        const statusCode = payload.status_code;
        const receivedMd5Sig = payload.md5sig;

        if (!merchantId || !orderId || !amount || !currency || statusCode === undefined || !receivedMd5Sig) {
            return false;
        }

        const secretHash = this.md5(this.merchantSecret);
        const localHash = this.md5(`${merchantId}${orderId}${amount}${currency}${statusCode}${secretHash}`);
        return localHash.toUpperCase() === receivedMd5Sig.toUpperCase();
    }

    async createPayment(order, member, options = {}) {
        if (!this.merchantId || !this.merchantSecret) {
            return {
                success: false,
                code: 'GATEWAY_CREDENTIALS_MISSING',
                message: 'PayHere merchant credentials are not configured in environment.'
            };
        }

        const amountFormatted = parseFloat(order.total).toFixed(2);
        const hash = this.generateInitiationHash(order.order_number, order.total, order.currency);
        const returnUrl = options.returnUrl || `${process.env.NEXUS_APP_URL || 'https://nexusp.online'}/dashboard/payments/process`;
        const cancelUrl = options.cancelUrl || `${process.env.NEXUS_APP_URL || 'https://nexusp.online'}/dashboard/orders`;
        const notifyUrl = options.notifyUrl || `${process.env.NEXUS_APP_URL || 'https://nexusp.online'}/api/v1/nexus/payments/webhook`;

        const formFields = {
            merchant_id: this.merchantId,
            return_url: returnUrl,
            cancel_url: cancelUrl,
            notify_url: notifyUrl,
            order_id: order.order_number,
            items: order.package_name_snapshot || `Nexus Prime Order ${order.order_number}`,
            currency: order.currency,
            amount: amountFormatted,
            first_name: member?.customer?.full_name?.split(' ')[0] || 'Member',
            last_name: member?.customer?.full_name?.split(' ').slice(1).join(' ') || 'Distributor',
            email: member?.customer?.email || 'member@nexusp.online',
            phone: member?.customer?.phone || '+94112000000',
            address: 'Nexus Prime Member',
            city: 'Colombo',
            country: 'Sri Lanka',
            hash: hash
        };

        return {
            success: true,
            provider: 'payhere',
            checkout_url: this.checkoutUrl,
            form_fields: formFields,
            is_sandbox: this.isSandbox,
            instructions: 'Submit form POST to checkout_url or render PayHere inline checkout modal.'
        };
    }

    async verifyPayment(paymentRecord, payload = {}) {
        const isHashValid = this.verifyIpnHash(payload);
        const statusCode = parseInt(payload.status_code, 10);
        const isPaid = isHashValid && statusCode === 2;

        return {
            verified: isHashValid,
            status: isPaid ? 'paid' : (statusCode === 0 ? 'pending' : 'failed'),
            provider_payment_id: payload.payment_id || null,
            amount: parseFloat(payload.payhere_amount) || paymentRecord.amount,
            currency: payload.payhere_currency || paymentRecord.currency,
            message: isPaid ? 'PayHere payment verified successfully' : 'PayHere verification unsuccessful'
        };
    }

    async handleWebhook(payload, headers = {}) {
        // 1. Verify Merchant ID matches
        if (payload.merchant_id && payload.merchant_id !== this.merchantId) {
            return {
                valid: false,
                code: 'MERCHANT_MISMATCH',
                message: 'Webhook merchant_id does not match configured Nexus Prime Merchant ID'
            };
        }

        // 2. Verify Cryptographic MD5 Signature
        const isValid = this.verifyIpnHash(payload);
        if (!isValid) {
            return {
                valid: false,
                code: 'INVALID_SIGNATURE',
                message: 'PayHere MD5 signature checksum verification failed'
            };
        }

        const statusCode = parseInt(payload.status_code, 10);
        let status = 'failed';
        if (statusCode === 2) status = 'paid';
        else if (statusCode === 0) status = 'pending';
        else if (statusCode === -1) status = 'cancelled';

        return {
            valid: true,
            order_number: payload.order_id,
            provider_payment_id: payload.payment_id,
            status,
            amount: parseFloat(payload.payhere_amount),
            currency: payload.payhere_currency,
            payment_method: payload.method || 'payhere',
            message: `PayHere IPN status: ${statusCode} -> ${status}`
        };
    }

    async refundPayment(paymentRecord, amount, reason = '') {
        return {
            success: false,
            code: 'NOT_SUPPORTED',
            message: 'PayHere API automated refund requires merchant dashboard authorization.'
        };
    }

    async getPaymentStatus(providerPaymentId) {
        return {
            success: true,
            status: 'unknown',
            provider_payment_id: providerPaymentId
        };
    }
}

module.exports = PayHerePaymentProvider;
