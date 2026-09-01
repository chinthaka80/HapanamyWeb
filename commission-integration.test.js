// Hapanamy Commission Engine & Product Economics Integration Tests (Step 9)
const testRunner = require('./test-runner');
const CommissionCore = require('../services/commission-core');
const ProductSnapshotService = require('../services/product-snapshot-service');
const VolumeLedger = require('../services/volume-ledger');

let binaryNodes = [];
let purchases = [];
let sponsors = [];
let commissionLedger = [];
let volumeLedger = [];
let walletLedger = [];
let dailyEarningsMap = new Map();

const safeProduct = {
    id: 'prod-safe-100',
    name: 'Mastery Course',
    pricing_mode: 'FIXED',
    market_price: 10000.00,
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

before(() => {
    // Binary Tree: Root -> Sponsor1 (Left) -> Buyer1 (Left)
    binaryNodes = [
        { user_id: 'root-user', placement_parent_id: null },
        { user_id: 'sponsor-1', placement_parent_id: 'root-user', position: 'LEFT' },
        { user_id: 'buyer-1', placement_parent_id: 'sponsor-1', position: 'LEFT' }
    ];

    sponsors = [
        { user_id: 'sponsor-1', sponsor_id: 'root-user' },
        { user_id: 'buyer-1', sponsor_id: 'sponsor-1' }
    ];

    purchases = [
        { id: 'purch-root', user_id: 'root-user', product_id: 'prod-safe-100', status: 'ACTIVE' },
        { id: 'purch-s1', user_id: 'sponsor-1', product_id: 'prod-safe-100', status: 'ACTIVE' }
    ];

    commissionLedger = [];
    volumeLedger = [];
    walletLedger = [];
    dailyEarningsMap = new Map();
});

test('Approved purchase with immutable snapshot distributes exact direct commission and volume', () => {
    const purchase = {
        id: 'purch-integ-1',
        user_id: 'buyer-1',
        product_id: safeProduct.id,
        price_paid: 7450.00,
        status: 'ACTIVE',
        activated_at: new Date().toISOString()
    };

    const snapshot = ProductSnapshotService.createSnapshot(safeProduct, purchase.id, purchase.activated_at);

    const result = CommissionCore.processPurchaseCommissions(purchase, snapshot, {
        binaryNodes,
        purchases,
        sponsors,
        commissionLedger,
        volumeLedger,
        walletLedger,
        dailyEarningsMap
    });

    assert(result.success, 'Commission processing must succeed');
    assert.equal(result.direct_commission, 596.00, 'Direct commission should be 8% of 7450 (596 LKR)');
    assert.equal(result.binary_volume_propagated, 7450.00, 'Binary volume propagated should be 7450 BV');

    // Verify Direct commission entry in ledger
    const directEntry = commissionLedger.find(c => c.source_purchase_id === purchase.id && c.type === 'DIRECT');
    assert(directEntry, 'Direct commission entry must exist in commission ledger');
    assert.equal(directEntry.user_id, 'sponsor-1', 'Commission must be credited to direct sponsor');
    assert.equal(directEntry.eligible_amount, 596.00);

    // Verify volume ledger entry for sponsor-1
    const volEntry = volumeLedger.find(v => v.source_purchase_id === purchase.id && v.user_id === 'sponsor-1');
    assert(volEntry, 'Volume entry must exist in volume ledger for sponsor-1');
    assert.equal(volEntry.amount, 7450.00);
    assert.equal(volEntry.leg, 'LEFT');
});

test('Idempotency protection prevents duplicate commission and volume processing', () => {
    const purchase = {
        id: 'purch-integ-1', // Same purchase ID
        user_id: 'buyer-1',
        product_id: safeProduct.id,
        price_paid: 7450.00,
        status: 'ACTIVE',
        activated_at: new Date().toISOString()
    };

    const snapshot = ProductSnapshotService.createSnapshot(safeProduct, purchase.id, purchase.activated_at);

    const initialCommCount = commissionLedger.length;
    const initialVolCount = volumeLedger.length;

    // Run commission processing a second time
    const result = CommissionCore.processPurchaseCommissions(purchase, snapshot, {
        binaryNodes,
        purchases,
        sponsors,
        commissionLedger,
        volumeLedger,
        walletLedger,
        dailyEarningsMap
    });

    assert(result.success);
    assert.equal(result.direct_commission, 0.00, 'Duplicate call must not distribute direct commission again');
    assert.equal(commissionLedger.length, initialCommCount, 'Commission ledger must not have duplicate entries');
    assert.equal(volumeLedger.length, initialVolCount, 'Volume ledger must not have duplicate entries');
});

test('Commission distribution is rejected if purchase is not active', () => {
    const pendingPurchase = {
        id: 'purch-pending-2',
        user_id: 'buyer-1',
        product_id: safeProduct.id,
        price_paid: 7450.00,
        status: 'PENDING'
    };

    const snapshot = ProductSnapshotService.createSnapshot(safeProduct, pendingPurchase.id);

    const result = CommissionCore.processPurchaseCommissions(pendingPurchase, snapshot, {
        binaryNodes, purchases, sponsors, commissionLedger, volumeLedger, walletLedger, dailyEarningsMap
    });

    assert(!result.success, 'Commission processing must be rejected for pending purchase');
    assert(result.reason.includes('not active'));
});

test('Commission distribution is prohibited if snapshot economics status is BLOCKED', () => {
    const blockedProduct = {
        ...safeProduct,
        id: 'prod-blocked-1',
        economics_status: 'BLOCKED'
    };

    const purchase = {
        id: 'purch-blocked-3',
        user_id: 'buyer-1',
        product_id: blockedProduct.id,
        price_paid: 7450.00,
        status: 'ACTIVE'
    };

    const snapshot = ProductSnapshotService.createSnapshot(blockedProduct, purchase.id);

    const result = CommissionCore.processPurchaseCommissions(purchase, snapshot, {
        binaryNodes, purchases, sponsors, commissionLedger, volumeLedger, walletLedger, dailyEarningsMap
    });

    assert(!result.success, 'Commission processing must be prohibited for BLOCKED economics snapshot');
    assert(result.reason.includes('BLOCKED'));
});

test('Commission distribution fails if snapshot integrity has been tampered with', () => {
    const purchase = {
        id: 'purch-tamper-4',
        user_id: 'buyer-1',
        product_id: safeProduct.id,
        price_paid: 7450.00,
        status: 'ACTIVE'
    };

    const validSnapshot = ProductSnapshotService.createSnapshot(safeProduct, purchase.id);
    const tamperedSnapshot = { ...validSnapshot, direct_commission_rate: 50.00 }; // Altered rate

    const result = CommissionCore.processPurchaseCommissions(purchase, tamperedSnapshot, {
        binaryNodes, purchases, sponsors, commissionLedger, volumeLedger, walletLedger, dailyEarningsMap
    });

    assert(!result.success, 'Commission processing must fail on tampered snapshot');
    assert(result.reason.includes('integrity check failed'));
});

test('Historical commission calculation strictly uses snapshot and ignores subsequent product changes', () => {
    const productV1 = { ...safeProduct, id: 'prod-hist-1', direct_commission_percent: 8.00 };
    const purchase = {
        id: 'purch-hist-5',
        user_id: 'buyer-1',
        product_id: 'prod-hist-1',
        price_paid: 7450.00,
        status: 'ACTIVE'
    };

    // Snapshot created under V1 (8% direct rate)
    const snapshotV1 = ProductSnapshotService.createSnapshot(productV1, purchase.id);

    // Product later modified by Admin to 20%
    productV1.direct_commission_percent = 20.00;
    productV1.price = 15000.00;

    // Process commissions using original snapshot
    const result = CommissionCore.processPurchaseCommissions(purchase, snapshotV1, {
        binaryNodes, purchases, sponsors, commissionLedger, volumeLedger, walletLedger, dailyEarningsMap
    });

    assert(result.success);
    assert.equal(result.direct_commission, 596.00, 'Must use 8% from snapshot (596 LKR), not current 20% (3000 LKR)');
});

if (require.main === module) {
    runTests();
}
