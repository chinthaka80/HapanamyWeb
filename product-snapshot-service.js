// Hapanamy.lk Immutable Product Economics Snapshot Service (Step 8)
// Creates, verifies, and manages immutable product economics snapshots for approved purchases.

const crypto = require('crypto');
const ProductEconomicsCalculator = require('./product-economics-calculator');

class ProductSnapshotService {
    /**
     * Computes a deterministic SHA-256 integrity hash for snapshot fields.
     */
    static computeIntegrityHash(fields) {
        const payload = [
            fields.product_id,
            fields.product_name,
            fields.market_price.toFixed(2),
            fields.discount_type,
            fields.discount_value.toFixed(2),
            fields.selling_price.toFixed(2),
            fields.product_cost.toFixed(2),
            fields.gross_profit.toFixed(2),
            fields.protected_company_amount.toFixed(2),
            fields.net_commission_budget.toFixed(2),
            fields.effective_commission_budget.toFixed(2),
            fields.commission_safety_buffer.toFixed(2),
            fields.binary_volume.toFixed(2),
            fields.direct_commission_rate.toFixed(2),
            fields.binary_commission_rate.toFixed(2),
            fields.max_binary_qualified_levels,
            fields.commission_mode,
            fields.economics_status,
            fields.snapshot_version,
            fields.purchase_id,
            fields.purchase_timestamp
        ].join('|');

        return crypto.createHash('sha256').update(payload).digest('hex');
    }

    /**
     * Creates an immutable economics snapshot from a product and purchase details.
     * Runs ProductEconomicsCalculator to ensure exact, authoritative calculated figures.
     * Returns a frozen (immutable) snapshot object.
     */
    static createSnapshot(product, purchaseId, purchaseTimestamp = null) {
        if (!product || !purchaseId) {
            throw new Error('Product and purchaseId are required to create an economics snapshot.');
        }

        // Normalize product inputs for economics calculator
        const pricingMode = product.pricing_mode || 'FIXED';
        const marketPrice = parseFloat(product.market_price !== undefined ? product.market_price : (product.price || 0.00));
        const discountType = product.discount_type || 'NONE';
        const discountValue = parseFloat(product.discount_value || 0.00);
        const configuredSellingPrice = parseFloat(product.selling_price !== undefined ? product.selling_price : (product.price || 0.00));
        const productCost = parseFloat(product.product_cost || 0.00);

        const minProfit = parseFloat(product.minimum_company_profit || 0.00);
        const opReserve = parseFloat(product.operating_cost_reserve || 0.00);
        const procReserve = parseFloat(product.payment_processing_reserve || 0.00);
        const refReserve = parseFloat(product.refund_risk_reserve || 0.00);
        const taxReserve = parseFloat(product.tax_reserve || 0.00);
        const otherReserve = parseFloat(product.other_reserve || 0.00);
        const safetyBuffer = parseFloat(product.commission_safety_buffer || 0.00);

        const directCommissionRate = parseFloat(
            product.direct_commission_rate !== undefined 
                ? product.direct_commission_rate 
                : (product.direct_commission_percent !== undefined ? product.direct_commission_percent : 8.00)
        );
        const binaryCommissionRate = parseFloat(
            product.binary_commission_rate !== undefined 
                ? product.binary_commission_rate 
                : (product.binary_commission_percent !== undefined ? product.binary_commission_percent : 7.00)
        );
        const binaryVolume = parseFloat(product.binary_volume !== undefined ? product.binary_volume : configuredSellingPrice);
        const maxLevels = parseInt(product.max_binary_qualified_levels !== undefined ? product.max_binary_qualified_levels : 7);
        const commissionMode = product.commission_mode || 'MANUAL';
        const economicsStatus = product.economics_status || 'SAFE';

        // Calculate authoritative economics figures
        const calcResult = ProductEconomicsCalculator.calculate({
            pricing_mode: pricingMode,
            market_price: marketPrice,
            discount_type: discountType,
            discount_value: discountValue,
            selling_price: configuredSellingPrice,
            product_cost: productCost,
            minimum_company_profit: minProfit,
            operating_cost_reserve: opReserve,
            payment_processing_reserve: procReserve,
            refund_risk_reserve: refReserve,
            tax_reserve: taxReserve,
            other_reserve: otherReserve,
            commission_safety_buffer: safetyBuffer,
            binary_volume: binaryVolume,
            direct_commission_rate: directCommissionRate,
            binary_commission_rate: binaryCommissionRate,
            max_binary_qualified_levels: maxLevels
        });

        const calculated = calcResult.calculated;
        const timestamp = purchaseTimestamp || new Date().toISOString();
        const snapshotVersion = 1;

        const snapshotData = {
            id: 'snap-' + Math.random().toString(36).substr(2, 9),
            purchase_id: purchaseId,
            product_id: product.id || 'prod-unknown',
            product_name: product.name || product.title || 'Unknown Product',
            market_price: marketPrice,
            discount_type: discountType,
            discount_value: discountValue,
            selling_price: calculated.selling_price,
            product_cost: productCost,
            gross_profit: calculated.gross_profit,
            protected_company_amount: calculated.protected_company_amount,
            net_commission_budget: calculated.net_commission_budget,
            effective_commission_budget: calculated.effective_commission_budget,
            commission_safety_buffer: safetyBuffer,
            binary_volume: binaryVolume,
            direct_commission_rate: directCommissionRate,
            binary_commission_rate: binaryCommissionRate,
            max_binary_qualified_levels: maxLevels,
            commission_mode: commissionMode,
            economics_status: economicsStatus,
            snapshot_version: snapshotVersion,
            purchase_timestamp: timestamp,
            created_at: new Date().toISOString()
        };

        // Compute cryptographic integrity hash
        snapshotData.integrity_hash = this.computeIntegrityHash(snapshotData);

        // Freeze object to enforce in-memory immutability
        return Object.freeze(snapshotData);
    }

    /**
     * Verifies the cryptographic integrity of a snapshot to ensure it has not been tampered with.
     */
    static verifySnapshotIntegrity(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') {
            return { valid: false, reason: 'Snapshot is missing or invalid object.' };
        }

        if (!snapshot.integrity_hash) {
            return { valid: false, reason: 'Snapshot integrity hash is missing.' };
        }

        const expectedHash = this.computeIntegrityHash(snapshot);
        if (snapshot.integrity_hash !== expectedHash) {
            return { 
                valid: false, 
                reason: 'Cryptographic integrity violation: snapshot data does not match integrity hash.' 
            };
        }

        return { valid: true };
    }

    /**
     * Rejects any attempt to edit or update an existing snapshot (Admin Protection).
     */
    static updateSnapshot() {
        throw new Error('Snapshots are immutable and cannot be updated or altered by any user or administrator.');
    }
}

if (typeof module !== 'undefined') {
    module.exports = ProductSnapshotService;
}
