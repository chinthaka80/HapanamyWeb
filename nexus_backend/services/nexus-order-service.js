// ==============================================================================
// NEXUS PRIME (PVT) LTD — ORDER & PURCHASE MANAGEMENT SERVICE
// DOMAIN: nexusp.online
// ==============================================================================

const nexusDb = require('../db/nexus-db');

class NexusOrderService {
    /**
     * Creates an authoritative package order (supports object payload or positional args).
     */
    static async createOrder(arg1, arg2, arg3) {
        if (typeof arg1 === 'object' && arg1 !== null) {
            return this.createPackageOrder(arg1.user_id, arg1.package_id, arg1);
        }
        return this.createPackageOrder(arg1, arg2, arg3);
    }

    /**
     * Creates an authoritative package order with server-side pricing and snapshots.
     */
    static async createPackageOrder(userId, packageId, options = {}) {
        if (!userId) throw new Error('User ID is required');
        if (!packageId) throw new Error('Package ID or Code is required');

        // 1. Fetch package from database — NEVER trust client price
        let pkg = await nexusDb.getPackageById(packageId);
        if (!pkg) pkg = await nexusDb.getPackageByCode(packageId);
        if (!pkg) {
            throw new Error(`Package [${packageId}] not found in corporate catalog.`);
        }

        if (pkg.status !== 'active') {
            throw new Error(`Package [${pkg.name}] is currently inactive and cannot be ordered.`);
        }

        // 2. Duplicate order check / Idempotency protection
        if (options.idempotencyKey) {
            const existing = nexusDb.orders.find(o => 
                o.user_id === userId && 
                o.idempotency_key === options.idempotencyKey
            );
            if (existing) {
                return nexusDb.getOrderById(existing.id);
            }
        }

        // 3. Server-side price authority & snapshot formulation
        const officialPrice = parseFloat(pkg.price) || 0;
        const subtotal = officialPrice;
        const discount = 0.00;
        const total = subtotal - discount;
        const currency = pkg.currency || 'LKR';

        const orderData = {
            user_id: userId,
            order_type: 'package',
            package_id: pkg.id,
            status: 'awaiting_payment',
            subtotal,
            discount,
            total,
            currency,
            package_name_snapshot: pkg.name,
            package_price_snapshot: officialPrice,
            idempotency_key: options.idempotencyKey || null,
            customer_notes: options.notes || '',
            payment_provider: options.paymentProvider || 'none'
        };

        const itemSnapshot = {
            item_type: 'package',
            item_id: pkg.id,
            item_name_snapshot: pkg.name,
            sku_or_code_snapshot: pkg.package_code,
            quantity: 1,
            unit_price_snapshot: officialPrice,
            discount_snapshot: 0.00,
            line_total_snapshot: officialPrice,
            currency
        };

        // 4. Save order to database
        const savedOrder = await nexusDb.createOrder(orderData, [itemSnapshot]);

        // 5. Emit Member Activity & Notification
        await nexusDb.insertMemberActivity({
            user_id: userId,
            activity_type: 'ORDER_CREATED',
            title: 'Package Order Created',
            description: `Order ${savedOrder.order_number} for package "${pkg.name}" initiated. Total: ${currency} ${total.toLocaleString()}`,
            icon: '📦',
            ip_address: options.ip || null
        });

        await nexusDb.insertMemberNotification({
            user_id: userId,
            title: 'Order Created',
            message: `Your order ${savedOrder.order_number} has been created. Complete your payment to activate membership benefits.`,
            type: 'order',
            link: `/dashboard/orders`
        });

        return {
            ...savedOrder,
            paymentNotice: 'Order saved in awaiting_payment status. Complete payment to activate package membership.'
        };
    }

    /**
     * Creates a product order with multi-item stock validation and server-side pricing.
     */
    static async createProductOrder(userId, itemsArray = [], options = {}) {
        if (!userId) throw new Error('User ID is required');
        if (!Array.isArray(itemsArray) || itemsArray.length === 0) {
            throw new Error('Order must contain at least one product item.');
        }

        // 1. Idempotency protection
        if (options.idempotencyKey) {
            const existing = nexusDb.orders.find(o => 
                o.user_id === userId && 
                o.idempotency_key === options.idempotencyKey
            );
            if (existing) {
                return nexusDb.getOrderById(existing.id);
            }
        }

        // 2. Validate all products server-side
        const validatedItems = [];
        let calculatedSubtotal = 0;
        const defaultCurrency = 'LKR';

        for (const input of itemsArray) {
            const productId = input.productId || input.id;
            const quantity = parseInt(input.quantity, 10);

            if (!productId || isNaN(quantity) || quantity <= 0) {
                throw new Error('Each item must specify a valid productId and quantity >= 1.');
            }

            let prod = await nexusDb.getProductById(productId);
            if (!prod) prod = await nexusDb.getProductBySku(productId);
            if (!prod) prod = await nexusDb.getProductBySlug(productId);

            if (!prod) {
                throw new Error(`Product [${productId}] was not found in active catalog.`);
            }

            if (prod.status !== 'active') {
                throw new Error(`Product "${prod.name}" (${prod.sku}) is currently inactive and cannot be ordered.`);
            }

            if (prod.stock_quantity < quantity) {
                throw new Error(`Insufficient stock for "${prod.name}". Requested: ${quantity}, Available: ${prod.stock_quantity}.`);
            }

            const unitPrice = parseFloat(prod.price) || 0;
            const lineTotal = unitPrice * quantity;
            calculatedSubtotal += lineTotal;

            validatedItems.push({
                item_type: 'product',
                item_id: prod.id,
                item_name_snapshot: prod.name,
                sku_or_code_snapshot: prod.sku,
                quantity,
                unit_price_snapshot: unitPrice,
                discount_snapshot: 0.00,
                line_total_snapshot: lineTotal,
                currency: prod.currency || defaultCurrency
            });
        }

        const discount = 0.00;
        const total = calculatedSubtotal - discount;

        const orderData = {
            user_id: userId,
            order_type: 'product',
            package_id: null,
            status: 'awaiting_payment',
            subtotal: calculatedSubtotal,
            discount,
            total,
            currency: defaultCurrency,
            idempotency_key: options.idempotencyKey || null,
            customer_notes: options.notes || '',
            payment_provider: options.paymentProvider || 'none'
        };

        // 3. Save order and items
        const savedOrder = await nexusDb.createOrder(orderData, validatedItems);

        // Decrement product stock
        for (const item of validatedItems) {
            const prod = await nexusDb.getProductById(item.item_id);
            if (prod && prod.stock_quantity !== undefined) {
                const newStock = Math.max(0, prod.stock_quantity - item.quantity);
                const updates = { stock_quantity: newStock };
                if (newStock === 0) updates.status = 'out_of_stock';
                await nexusDb.updateProduct(item.item_id, updates);
            }
        }

        // 4. Emit Member Activity & Notification
        await nexusDb.insertMemberActivity({
            user_id: userId,
            activity_type: 'ORDER_CREATED',
            title: 'Product Order Created',
            description: `Order ${savedOrder.order_number} for ${validatedItems.length} item(s) created. Total: ${defaultCurrency} ${total.toLocaleString()}`,
            icon: '🛍️',
            ip_address: options.ip || null
        });

        await nexusDb.insertMemberNotification({
            user_id: userId,
            title: 'Product Order Created',
            message: `Order ${savedOrder.order_number} has been created. Awaiting payment.`,
            type: 'order',
            link: `/dashboard/orders`
        });

        return {
            ...savedOrder,
            paymentNotice: 'Order saved in awaiting_payment status. Complete payment to begin processing.'
        };
    }

    /**
     * Validates and calculates authoritative server-side cart totals for checkout preview.
     */
    static async validateAndCalculateCart(itemsArray = []) {
        if (!Array.isArray(itemsArray)) return { valid: false, message: 'Invalid items array' };

        const items = [];
        let subtotal = 0;
        let errors = [];

        for (const input of itemsArray) {
            const productId = input.productId || input.id;
            const quantity = parseInt(input.quantity, 10) || 1;

            const prod = await nexusDb.getProductById(productId) || await nexusDb.getProductBySku(productId);
            if (!prod) {
                errors.push(`Item ID ${productId} not found.`);
                continue;
            }

            const isAvailable = prod.status === 'active' && prod.stock_quantity >= quantity;
            if (!isAvailable) {
                errors.push(`Product "${prod.name}" is ${prod.status === 'active' ? 'out of stock' : 'unavailable'}.`);
            }

            const unitPrice = parseFloat(prod.price) || 0;
            const lineTotal = unitPrice * quantity;
            subtotal += lineTotal;

            items.push({
                productId: prod.id,
                name: prod.name,
                sku: prod.sku,
                quantity,
                unitPrice,
                lineTotal,
                currency: prod.currency || 'LKR',
                available: isAvailable,
                stockRemaining: prod.stock_quantity
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            items,
            subtotal,
            discount: 0,
            total: subtotal,
            currency: 'LKR'
        };
    }

    /**
     * Member order history with strict user ownership isolation.
     */
    static async getMemberOrders(userId, options = {}) {
        return nexusDb.getMemberOrders(userId, options);
    }

    /**
     * Member order detail with strict authorization check.
     */
    static async getMemberOrderDetail(userId, orderId) {
        const order = await nexusDb.getOrderById(orderId) || await nexusDb.getOrderByNumber(orderId);
        if (!order) return null;

        // Security authorization check: member can only view their own order
        if (order.user_id !== userId) {
            const err = new Error('Forbidden: Access denied to this order.');
            err.statusCode = 403;
            throw err;
        }

        return order;
    }

    /**
     * Admin order management list with filters and search.
     */
    static async getAdminOrders(options = {}) {
        return nexusDb.getAllOrders(options);
    }

    /**
     * Admin order dossier.
     */
    static async getAdminOrderDetail(orderId) {
        return nexusDb.getOrderById(orderId) || nexusDb.getOrderByNumber(orderId);
    }

    /**
     * Controlled order status update by Admin with audit trail.
     */
    static async updateOrderStatus(orderId, newStatus, reason = '', actor = null) {
        const allowedTransitions = ['pending', 'awaiting_payment', 'processing', 'completed', 'cancelled', 'failed'];
        if (!allowedTransitions.includes(newStatus)) {
            throw new Error(`Invalid order status [${newStatus}].`);
        }

        const updated = await nexusDb.updateOrderStatus(orderId, newStatus, reason, actor);
        if (!updated) throw new Error(`Order [${orderId}] not found.`);

        // Notify member about status update
        await nexusDb.insertMemberNotification({
            user_id: updated.user_id,
            title: `Order Status: ${newStatus.toUpperCase()}`,
            message: `Order ${updated.order_number} status changed to ${newStatus}. ${reason ? `Note: ${reason}` : ''}`,
            type: 'order',
            link: '/dashboard/orders'
        });

        return updated;
    }
}

module.exports = NexusOrderService;
