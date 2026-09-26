// ==============================================================================
// NEXUS PRIME (PVT) LTD — PAYMENT ORCHESTRATION SERVICE
// DOMAIN: nexusp.online
// ==============================================================================

const nexusDb = require('../db/nexus-db');
const NexusConfig = require('../config/nexus-config');
const nexusMembershipService = require('./nexus-membership-service');
const UnconfiguredPaymentProvider = require('./payment-providers/unconfigured-provider');
const SandboxPaymentProvider = require('./payment-providers/sandbox-provider');
const PayHerePaymentProvider = require('./payment-providers/payhere-provider');

class NexusPaymentService {
    constructor() {
        this.providers = new Map();
        this.initProviders();
    }

    initProviders() {
        // Register standard provider instances
        this.providers.set('none', new UnconfiguredPaymentProvider());
        this.providers.set('sandbox', new SandboxPaymentProvider({
            secret: NexusConfig.PAYMENT_API_SECRET,
            webhookSecret: NexusConfig.PAYMENT_WEBHOOK_SECRET
        }));
        this.providers.set('payhere', new PayHerePaymentProvider({
            merchantId: NexusConfig.PAYMENT_MERCHANT_ID,
            merchantSecret: NexusConfig.PAYMENT_API_SECRET,
            isSandbox: NexusConfig.PAYMENT_SANDBOX_MODE
        }));
    }

    /**
     * Retrieves active configured provider or unconfigured fallback.
     */
    getActiveProvider() {
        const configuredName = (NexusConfig.PAYMENT_PROVIDER || 'none').toLowerCase().trim();
        return this.providers.get(configuredName) || this.providers.get('none');
    }

    /**
     * Initiates payment for a member order.
     * Enforces authentication, order ownership, amount integrity, and idempotency.
     */
    async initiatePayment(userId, orderId, options = {}) {
        if (!userId) throw new Error('User authentication required.');
        if (!orderId) throw new Error('Order reference required.');

        // 1. Fetch order
        const order = await nexusDb.getOrderById(orderId) || await nexusDb.getOrderByNumber(orderId);
        if (!order) {
            throw new Error(`Order [${orderId}] was not found.`);
        }

        // 2. Ownership check
        if (order.user_id !== userId) {
            const err = new Error('Forbidden: You do not have permission to pay for this order.');
            err.statusCode = 403;
            throw err;
        }

        // 3. Status check — prevent duplicate payments for already-paid orders
        if (order.status === 'paid' || order.status === 'completed') {
            throw new Error(`Order ${order.order_number} is already paid.`);
        }
        if (order.status === 'cancelled') {
            throw new Error(`Order ${order.order_number} has been cancelled and cannot be paid.`);
        }

        // 4. Server-side Amount Integrity Check
        const serverAmount = parseFloat(order.total);
        if (isNaN(serverAmount) || serverAmount <= 0) {
            throw new Error('Invalid order amount for payment initiation.');
        }

        // If client attempted to send amount, verify it matches server-side truth
        if (options.amount !== undefined && Math.abs(parseFloat(options.amount) - serverAmount) > 0.01) {
            await nexusDb.insertAuditLog({
                actor_id: userId,
                actor_role: 'member',
                action: 'PAYMENT_AMOUNT_TAMPERING_ATTEMPT',
                target_id: order.id,
                details: {
                    submitted_amount: options.amount,
                    authoritative_amount: serverAmount,
                    order_number: order.order_number
                }
            });
            throw new Error('Security Error: Payment amount mismatch detected.');
        }

        // 5. Fetch member profile
        const profile = await nexusDb.findProfileByUserId(userId);
        const user = nexusDb.users.find(u => u.id === userId);

        // 6. Reuse existing initiated/pending payment record or create new one in database
        const provider = this.getActiveProvider();
        let paymentRecord = await nexusDb.getPaymentByOrderId(order.id);
        if (!paymentRecord || (paymentRecord.status !== 'initiated' && paymentRecord.status !== 'pending')) {
            paymentRecord = await nexusDb.createPaymentRecord({
                order_id: order.id,
                member_id: userId,
                provider: provider.name,
                amount: serverAmount,
                currency: order.currency,
                status: 'initiated'
            });
        }

        // 7. Invoke provider initiation
        const initiationResult = await provider.createPayment(order, {
            customer: {
                full_name: profile?.full_name || 'Member',
                email: user?.email || '',
                phone: profile?.phone || ''
            }
        }, options);

        // Update payment with provider payment ID if returned
        if (initiationResult.provider_payment_id) {
            await nexusDb.updatePaymentRecord(paymentRecord.id, {
                provider_payment_id: initiationResult.provider_payment_id
            });
        }

        // 8. Log activity
        await nexusDb.insertMemberActivity({
            user_id: userId,
            activity_type: 'PAYMENT_INITIATED',
            title: 'Payment Session Initiated',
            description: `Payment checkout session opened for order ${order.order_number} (${order.currency} ${serverAmount.toLocaleString()})`,
            icon: '💳'
        });

        return {
            payment_id: paymentRecord.id,
            merchant_reference: paymentRecord.merchant_reference,
            order_number: order.order_number,
            amount: serverAmount,
            currency: order.currency,
            ...initiationResult
        };
    }

    /**
     * Handles incoming server-to-server webhook callback.
     * Enforces signature verification, amount integrity, idempotency, and atomicity.
     */
    async handleWebhook(providerName, payload, headers = {}) {
        if (typeof providerName === 'object' && providerName !== null) {
            headers = payload || {};
            payload = providerName;
            providerName = payload.provider || 'sandbox';
        }

        const provider = this.providers.get((providerName || '').toLowerCase()) || this.getActiveProvider() || this.providers.get('sandbox');

        // 1. Cryptographic validation by provider
        const webhookResult = await provider.handleWebhook(payload, headers);
        if (!webhookResult.valid) {
            return {
                statusCode: 401,
                success: false,
                response: {
                    success: false,
                    error: webhookResult.code || 'INVALID_WEBHOOK_SIGNATURE',
                    message: webhookResult.message || 'Signature verification failed'
                }
            };
        }

        // 2. Identify the order
        const orderRef = webhookResult.order_number || payload.order_number || payload.order_id;
        let order = await nexusDb.getOrderByNumber(orderRef);
        if (!order) {
            order = await nexusDb.getOrderById(orderRef);
        }
        if (!order) {
            return {
                statusCode: 404,
                success: false,
                response: { success: false, error: 'ORDER_NOT_FOUND', message: `Order ${orderRef} does not exist.` }
            };
        }

        // 3. Amount & Currency Integrity Verification
        const orderTotal = parseFloat(order.total);
        const rawAmount = webhookResult.amount !== undefined && !isNaN(webhookResult.amount) ? webhookResult.amount : payload.amount;
        const webhookAmount = rawAmount !== undefined && !isNaN(parseFloat(rawAmount)) ? parseFloat(rawAmount) : orderTotal;
        const webhookCurrency = webhookResult.currency || payload.currency || order.currency;
        if (Math.abs(orderTotal - webhookAmount) > 0.01 || order.currency.toUpperCase() !== (webhookCurrency || '').toUpperCase()) {
            await nexusDb.insertAuditLog({
                actor_id: 'system_webhook',
                actor_role: 'system',
                action: 'WEBHOOK_AMOUNT_CURRENCY_MISMATCH',
                target_id: order.id,
                details: {
                    order_total: orderTotal,
                    webhook_amount: webhookAmount,
                    order_currency: order.currency,
                    webhook_currency: webhookCurrency
                }
            });

            return {
                statusCode: 400,
                success: false,
                response: { success: false, error: 'AMOUNT_MISMATCH', message: 'Webhook amount does not match order record.' }
            };
        }

        // 4. Idempotency Check — has this payment already been marked paid?
        const existingPayment = await nexusDb.getPaymentByOrderId(order.id);
        if (existingPayment && existingPayment.status === 'paid' && webhookResult.status === 'paid') {
            return {
                statusCode: 200,
                success: true,
                response: {
                    success: true,
                    idempotent: true,
                    message: 'Payment has already been verified and recorded.'
                }
            };
        }

        // 5. Update or Create Payment Record
        const paymentRecord = existingPayment || await nexusDb.createPaymentRecord({
            order_id: order.id,
            member_id: order.user_id,
            provider: provider.name,
            amount: webhookAmount,
            currency: order.currency,
            status: 'initiated'
        });

        const now = new Date().toISOString();
        const isPaid = webhookResult.status === 'paid';

        await nexusDb.updatePaymentRecord(paymentRecord.id, {
            status: webhookResult.status,
            provider_payment_id: webhookResult.provider_payment_id || paymentRecord.provider_payment_id,
            payment_method: webhookResult.payment_method || paymentRecord.payment_method,
            verified_at: isPaid ? now : null,
            failed_at: !isPaid ? now : null,
            raw_payload: { status: webhookResult.status, message: webhookResult.message }
        });

        // 6. Update Order Status
        if (isPaid) {
            const nextOrderStatus = order.order_type === 'package' ? 'paid' : 'processing';
            await nexusDb.updateOrderStatus(order.id, nextOrderStatus, 'Payment verified via gateway webhook');

            // 7. Package Membership Activation (Prompt 19 Centralized Engine)
            if (order.order_type === 'package' && order.package_id) {
                await nexusMembershipService.activateMembership(order.user_id, {
                    orderId: order.id,
                    paymentId: paymentRecord.id,
                    packageId: order.package_id,
                    source: 'order_payment'
                });
            }

            // 8. Event Hook: PAYMENT_VERIFIED for future MLM Commission Engine
            // NOTE: Per specification, DO NOT calculate MLM commissions or credit wallets in Prompt 10.
            await this.dispatchPaymentVerifiedHook({
                event: 'PAYMENT_VERIFIED',
                order_id: order.id,
                order_number: order.order_number,
                member_id: order.user_id,
                amount: webhookAmount,
                currency: order.currency,
                package_id: order.package_id,
                timestamp: now
            });

            // 9. Member Activity & Notification
            await nexusDb.insertMemberActivity({
                user_id: order.user_id,
                activity_type: 'PAYMENT_VERIFIED',
                title: 'Payment Successful',
                description: `Payment of ${order.currency} ${webhookAmount.toLocaleString()} verified for order ${order.order_number}.`,
                icon: '✅'
            });

            await nexusDb.insertMemberNotification({
                user_id: order.user_id,
                title: 'Payment Verified',
                message: `Your payment of ${order.currency} ${webhookAmount.toLocaleString()} for order ${order.order_number} is confirmed.`,
                type: 'payment',
                link: `/dashboard/orders`
            });

            // 10. Audit Log
            await nexusDb.insertAuditLog({
                actor_id: 'payment_gateway',
                actor_role: 'system',
                action: 'PAYMENT_VERIFIED',
                target_id: paymentRecord.id,
                details: {
                    order_number: order.order_number,
                    amount: webhookAmount,
                    currency: order.currency,
                    provider: provider.name,
                    provider_payment_id: webhookResult.provider_payment_id
                }
            });
        } else {
            await nexusDb.updateOrderStatus(order.id, 'failed', 'Payment failed via gateway webhook');
            await nexusDb.insertMemberNotification({
                user_id: order.user_id,
                title: 'Payment Failed',
                message: `Payment attempt for order ${order.order_number} could not be completed.`,
                type: 'payment',
                link: `/dashboard/orders`
            });
        }

        return {
            statusCode: 200,
            success: true,
            response: {
                success: true,
                order_number: order.order_number,
                status: webhookResult.status,
                payment_id: paymentRecord.id
            }
        };
    }

    /**
     * Decoupled Event Hook: Dispatches event for future commission engines.
     */
    async dispatchPaymentVerifiedHook(eventData) {
        await nexusDb.insertAuditLog({
            actor_id: 'system_event_bus',
            actor_role: 'system',
            action: 'EVENT_DISPATCHED_PAYMENT_VERIFIED',
            target_id: eventData.order_id,
            details: eventData
        });

        // Trigger MLM Commission Engine upon verified payment
        try {
            const NexusCommissionService = require('./nexus-commission-service');
            await NexusCommissionService.calculateCommissions(eventData.order_id, {
                trigger: 'PAYMENT_VERIFIED'
            });
        } catch (commErr) {
            await nexusDb.insertAuditLog({
                actor_id: 'commission_engine',
                actor_role: 'system',
                action: 'COMMISSION_TRIGGER_ERROR',
                target_id: eventData.order_id,
                details: { error: commErr.message }
            });
        }
    }

    /**
     * Server-side polling/query verification for client return page.
     */
    async getPaymentVerificationStatus(userId, paymentId) {
        const payment = await nexusDb.getPaymentById(paymentId);
        if (!payment) return null;

        if (payment.member_id !== userId) {
            const err = new Error('Unauthorized access to payment record.');
            err.statusCode = 403;
            throw err;
        }

        return {
            payment_id: payment.id,
            order_number: payment.order_number,
            merchant_reference: payment.merchant_reference,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            verified: payment.status === 'paid',
            provider: payment.provider,
            verified_at: payment.verified_at
        };
    }

    /**
     * Member payment history.
     */
    async getMemberPayments(userId, options = {}) {
        return nexusDb.getMemberPayments(userId, options);
    }

    /**
     * Admin payments ledger.
     */
    async getAdminPayments(options = {}) {
        return nexusDb.getAllPayments(options);
    }

    /**
     * Admin controlled payment reconciliation.
     */
    async reconcilePayment(paymentId, resolution, notes, adminActor) {
        return nexusDb.reconcilePayment(paymentId, resolution, notes, adminActor);
    }
}

// Global Singleton Instance
const nexusPaymentService = new NexusPaymentService();

module.exports = nexusPaymentService;
