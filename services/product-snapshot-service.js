// Hapanamy.lk Immutable Product Economics Snapshot Service
// Creates, verifies, and manages immutable 25-field product economics snapshots for approved purchases.

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
            Number(fields.selling_price || 0).toFixed(2),
            Number(fields.product_cost || 0).toFixed(2),
            Number(fields.tax_amount || fields.tax_cost || 0).toFixed(2),
            Number(fields.hosting_cost || 0).toFixed(2),
            Number(fields.staff_cost || 0).toFixed(2),
            Number(fields.marketing_cost || 0).toFixed(2),
            Number(fields.refund_reserve || 0).toFixed(2),
            Number(fields.support_cost || 0).toFixed(2),
            Number(fields.operational_cost || 0).toFixed(2),
            Number(fields.available_contribution || 0).toFixed(2),
            Number(fields.company_profit_reserve || 0).toFixed(2),
            Number(fields.commission_pool || 0).toFixed(2),
            Number(fields.direct_commission_rate || 0).toFixed(2),
            Number(fields.direct_commission_amount || 0).toFixed(2),
            Number(fields.binary_commission_rate || 0).toFixed(2),
            Number(fields.binary_matched_volume || fields.binary_volume || 0).toFixed(2),
            Number(fields.binary_commission_per_level || 0).toFixed(2),
            parseInt(fields.qualified_levels_paid || 7),
            Number(fields.maximum_binary_liability || 0).toFixed(2),
            Number(fields.actual_binary_commission_paid || 0).toFixed(2),
            Number(fields.remaining_contribution || 0).toFixed(2),
            fields.economics_version || 'v1.0',
            fields.purchase_id,
            fields.calculation_timestamp || fields.purchase_timestamp
        ].join('|');

        return crypto.createHash('sha256').update(payload).digest('hex');
    }

    /**
     * Creates an immutable 25-field economics snapshot from a product and purchase details.
     * Runs ProductEconomicsCalculator to ensure exact, authoritative calculated figures.
     * Returns a frozen (immutable) snapshot object.
     */
    static createSnapshot(product, purchaseId, purchaseTimestamp = null, overrides = {}) {
        if (!product || !purchaseId) {
            throw new Error('Product and purchaseId are required to create an economics snapshot.');
        }

        // Calculate authoritative economics figures
        const calcResult = ProductEconomicsCalculator.calculate(product);
        const calculated = calcResult.calculated;
        const timestamp = purchaseTimestamp || new Date().toISOString();
        const economicsVersion = product.economics_version || calculated.economics_version || 'v1.0';

        const qualifiedLevelsPaid = overrides.qualified_levels_paid !== undefined 
            ? parseInt(overrides.qualified_levels_paid) 
            : calculated.max_binary_qualified_levels;

        const actualBinaryPaid = overrides.actual_binary_commission_paid !== undefined 
            ? parseFloat(overrides.actual_binary_commission_paid) 
            : (calculated.binary_commission_per_recipient * qualifiedLevelsPaid);

        const matchedVolume = overrides.binary_matched_volume !== undefined 
            ? parseFloat(overrides.binary_matched_volume) 
            : calculated.binary_volume;

        const snapshotData = {
            id: 'snap-' + Math.random().toString(36).substr(2, 9),
            purchase_id: purchaseId,
            
            // 25 Core Audit Fields
            product_id: product.id || 'prod-unknown',
            product_name: product.name || product.title || 'Unknown Product',
            selling_price: calculated.selling_price,
            product_cost: calculated.product_cost,
            tax_amount: calculated.tax_cost,
            hosting_cost: calculated.hosting_cost,
            staff_cost: calculated.staff_cost,
            marketing_cost: calculated.marketing_cost,
            refund_reserve: calculated.refund_reserve,
            support_cost: calculated.support_cost,
            operational_cost: calculated.operational_cost,
            available_contribution: calculated.available_contribution,
            company_profit_reserve: calculated.company_profit_reserve,
            commission_pool: calculated.commission_pool,
            direct_commission_rate: calculated.direct_commission_rate,
            direct_commission_amount: calculated.direct_commission_amount,
            binary_commission_rate: calculated.binary_commission_rate,
            binary_matched_volume: matchedVolume,
            binary_commission_per_level: calculated.binary_commission_per_recipient,
            qualified_levels_paid: qualifiedLevelsPaid,
            maximum_binary_liability: calculated.max_binary_liability,
            actual_binary_commission_paid: actualBinaryPaid,
            remaining_contribution: calculated.remaining_contribution,
            economics_version: economicsVersion,
            calculation_timestamp: timestamp,

            // Legacy backward-compatibility aliases
            market_price: product.market_price !== undefined ? parseFloat(product.market_price) : calculated.selling_price,
            discount_type: product.discount_type || 'NONE',
            discount_value: parseFloat(product.discount_value || 0),
            gross_profit: calculated.gross_contribution,
            protected_company_amount: calculated.protected_company_amount,
            net_commission_budget: calculated.net_commission_budget !== undefined ? calculated.net_commission_budget : calculated.commission_pool,
            effective_commission_budget: calculated.effective_commission_budget !== undefined ? calculated.effective_commission_budget : calculated.commission_pool,
            commission_safety_buffer: calculated.commission_safety_buffer,
            binary_volume: calculated.binary_volume,
            max_binary_qualified_levels: calculated.max_binary_qualified_levels,
            commission_mode: product.commission_mode || 'MANUAL',
            economics_status: product.economics_status || calculated.safety_status,
            snapshot_version: 1,
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
