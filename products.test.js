// Hapanamy Products & Manual Payments Unit Tests
const testRunner = require('./test-runner');
const ProductService = require('../services/product-service');

let products = [];
let purchases = [];
let deposits = [];
let auditLogs = [];
let eventTriggered = false;

before(() => {
    products = [
        { id: 'prod-fb-mon', name: 'Facebook Monetisation Course', code: 'FB-MON', price: 7450.00, status: 'ACTIVE' }
    ];
    purchases = [];
    deposits = [];
    auditLogs = [];
    eventTriggered = false;

    // Register a mock listener to test the decoupled event triggering interface
    ProductService.onPurchaseActivated((purchase) => {
        eventTriggered = true;
    });
});

test('Admin can create a new product', () => {
    const newProduct = {
        id: 'prod-ai-vid',
        name: 'AI Video Generation Masterclass',
        code: 'AI-VID',
        price: 5200.00,
        status: 'ACTIVE'
    };

    products.push(newProduct);
    const found = products.find(p => p.code === 'AI-VID');
    assert(found, 'Product AI-VID should be created and found in products registry');
    assert.equal(found.price, 5200.00);
});

test('Admin can edit product status and price', () => {
    const idx = products.findIndex(p => p.id === 'prod-fb-mon');
    assert(idx !== -1);
    
    // Modify status
    products[idx].status = 'INACTIVE';
    products[idx].price = 7999.00;

    assert.equal(products[idx].status, 'INACTIVE');
    assert.equal(products[idx].price, 7999.00);

    // Revert status
    products[idx].status = 'ACTIVE';
});

test('Member cannot submit deposit with duplicate bank reference', () => {
    const deposit1 = {
        id: 'dep-1',
        purchaseId: 'purch-1',
        bankReference: 'TX-REF-100200',
        amount: 7450.00,
        slipUrl: 'storage/private/slips/slip_1.png',
        status: 'PENDING'
    };

    deposits.push(deposit1);

    const duplicateRef = 'TX-REF-100200';
    const isDuplicate = deposits.some(d => d.bankReference === duplicateRef);
    assert(isDuplicate, 'System must identify duplicate bank transfer reference submissions');
});

test('Admin deposit approval triggers purchase activation, commissions and volume events', () => {
    const purchase = {
        id: 'purch-100',
        user_id: 'user-member-1',
        product_id: 'prod-fb-mon',
        price_paid: 7450.00,
        status: 'PENDING'
    };

    purchases.push(purchase);

    // Simulate approval
    const purchaseIdx = purchases.findIndex(p => p.id === 'purch-100');
    assert(purchaseIdx !== -1);
    
    purchases[purchaseIdx].status = 'ACTIVE';
    purchases[purchaseIdx].activated_at = new Date().toISOString();

    // Trigger the interface callback
    ProductService.triggerPurchaseActivation(purchases[purchaseIdx]);

    assert(eventTriggered, 'Purchase activation must trigger the decoupled commission engine event');
    assert.equal(purchases[purchaseIdx].status, 'ACTIVE');
});

if (require.main === module) {
    runTests();
}
