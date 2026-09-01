// Hapanamy Immutable Product Economics Snapshot Unit Tests (Step 8)
const testRunner = require('./test-runner');
const ProductSnapshotService = require('../services/product-snapshot-service');

const sampleProduct = {
    id: 'prod-trading-101',
    name: 'Advanced Trading Academy',
    pricing_mode: 'DISCOUNTED',
    market_price: 10000.00,
    discount_type: 'FIXED',
    discount_value: 2550.00,
    selling_price: 7450.00,
    product_cost: 2000.00,
    minimum_company_profit: 1000.00,
    operating_cost_reserve: 500.00,
    payment_processing_reserve: 150.00,
    refund_risk_reserve: 200.00,
    tax_reserve: 300.00,
    other_reserve: 100.00,
    commission_safety_buffer: 500.00,
    binary_volume: 7450.00,
    direct_commission_percent: 8.00,
    binary_commission_percent: 7.00,
    max_binary_qualified_levels: 7,
    commission_mode: 'MANUAL',
    economics_status: 'SAFE'
};

test('Snapshot creation captures all required economics fields with exact calculations', () => {
    const purchaseId = 'purch-test-001';
    const purchaseTime = '2026-08-31T12:00:00.000Z';

    const snapshot = ProductSnapshotService.createSnapshot(sampleProduct, purchaseId, purchaseTime);

    assert.equal(snapshot.purchase_id, purchaseId);
    assert.equal(snapshot.product_id, sampleProduct.id);
    assert.equal(snapshot.product_name, sampleProduct.name);
    assert.equal(snapshot.market_price, 10000.00);
    assert.equal(snapshot.discount_type, 'FIXED');
    assert.equal(snapshot.discount_value, 2550.00);
    assert.equal(snapshot.selling_price, 7450.00);
    assert.equal(snapshot.product_cost, 2000.00);
    assert.equal(snapshot.gross_profit, 5450.00);
    assert.equal(snapshot.protected_company_amount, 2250.00);
    assert.equal(snapshot.net_commission_budget, 3200.00);
    assert.equal(snapshot.effective_commission_budget, 2700.00);
    assert.equal(snapshot.commission_safety_buffer, 500.00);
    assert.equal(snapshot.binary_volume, 7450.00);
    assert.equal(snapshot.direct_commission_rate, 8.00);
    assert.equal(snapshot.binary_commission_rate, 7.00);
    assert.equal(snapshot.max_binary_qualified_levels, 7);
    assert.equal(snapshot.commission_mode, 'MANUAL');
    assert.equal(snapshot.economics_status, 'SAFE');
    assert.equal(snapshot.snapshot_version, 1);
    assert.equal(snapshot.purchase_timestamp, purchaseTime);
    assert(snapshot.integrity_hash && snapshot.integrity_hash.length === 64, 'SHA-256 integrity hash must be 64 characters hex');
});

test('Snapshot object is frozen and completely immutable', () => {
    const snapshot = ProductSnapshotService.createSnapshot(sampleProduct, 'purch-freeze-002');
    
    assert(Object.isFrozen(snapshot), 'Snapshot must be Object.freeze frozen');

    let errorThrown = false;
    try {
        'use strict';
        snapshot.selling_price = 100.00;
    } catch (e) {
        errorThrown = true;
    }

    assert(errorThrown || snapshot.selling_price === 7450.00, 'Snapshot property cannot be modified');
});

test('Snapshot cryptographic integrity verification passes for authentic snapshot', () => {
    const snapshot = ProductSnapshotService.createSnapshot(sampleProduct, 'purch-integ-003');
    const result = ProductSnapshotService.verifySnapshotIntegrity(snapshot);

    assert.equal(result.valid, true, 'Authentic snapshot must pass integrity check');
});

test('Snapshot tampering detection fails verification if values are altered', () => {
    const snapshot = ProductSnapshotService.createSnapshot(sampleProduct, 'purch-tamper-004');
    
    // Create an altered clone attempting to fake rates
    const tampered = {
        ...snapshot,
        binary_commission_rate: 50.00 // Tampered rate
    };

    const result = ProductSnapshotService.verifySnapshotIntegrity(tampered);
    assert.equal(result.valid, false, 'Tampered snapshot must fail integrity verification');
    assert(result.reason.includes('integrity violation'), 'Must report cryptographic integrity violation');
});

test('Snapshot update method rejects all attempts to modify historical snapshots', () => {
    let rejected = false;
    try {
        ProductSnapshotService.updateSnapshot();
    } catch (e) {
        rejected = true;
    }
    assert(rejected, 'updateSnapshot must throw an error preventing modifications');
});

test('Subsequent changes to product definition do NOT alter existing snapshots', () => {
    const dynamicProduct = { ...sampleProduct, id: 'prod-dyn-1' };
    const snapshot1 = ProductSnapshotService.createSnapshot(dynamicProduct, 'purch-dyn-1');

    // Admin updates product pricing and cost afterwards
    dynamicProduct.selling_price = 15000.00;
    dynamicProduct.product_cost = 8000.00;
    dynamicProduct.direct_commission_percent = 12.00;
    dynamicProduct.binary_commission_percent = 10.00;

    // Verify snapshot1 retains original values
    assert.equal(snapshot1.selling_price, 7450.00, 'Original snapshot selling price must remain 7450.00');
    assert.equal(snapshot1.direct_commission_rate, 8.00, 'Original snapshot direct rate must remain 8.00');
    assert.equal(snapshot1.binary_commission_rate, 7.00, 'Original snapshot binary rate must remain 7.00');
});

if (require.main === module) {
    runTests();
}
