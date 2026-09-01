// Hapanamy Refund & Reversal System Unit Tests
const testRunner = require('./test-runner');
const RefundService = require('../services/refund-service');
const CommissionCore = require('../services/commission-core');
const VolumeLedger = require('../services/volume-ledger');

let samplePurchase = null;
let sampleLedger = [];
let sampleVolumeLedger = [];

before(() => {
    samplePurchase = {
        id: 'purch-ref-1',
        user_id: 'user-1',
        product_id: 'prod-fb-mon',
        status: 'ACTIVE',
        activated_at: new Date().toISOString() // Dynamic current date (within 14 days)
    };

    sampleLedger = [
        { id: 'comm-1', user_id: 'sponsor-1', source_purchase_id: 'purch-ref-1', type: 'DIRECT', calculated_amount: 596.00, eligible_amount: 596.00, status: 'APPROVED' }
    ];

    sampleVolumeLedger = [
        { id: 'vol-1', user_id: 'parent-1', leg: 'LEFT', amount: 7450.00, source_user_id: 'user-1', source_purchase_id: 'purch-ref-1', type: 'SALE_VOLUME' }
    ];
});

test('Refund eligible if requested within 14-day window', () => {
    const result = RefundService.checkEligibility(samplePurchase);
    assert(result.eligible, 'Purchase should be eligible for refund');
});

test('Refund blocked if 14-day period has expired', () => {
    const expiredPurchase = {
        ...samplePurchase,
        activated_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() // 15 days ago
    };
    const result = RefundService.checkEligibility(expiredPurchase);
    assert(!result.eligible, 'Should fail refund eligibility after 14 days');
    assert.equal(result.error, 'Refund period of 14 days has expired.');
});

test('Refund blocks non-active purchases', () => {
    const inactivePurchase = { ...samplePurchase, status: 'PENDING' };
    const result = RefundService.checkEligibility(inactivePurchase);
    assert(!result.eligible);
});

test('Commission reversal appends negative entries referencing original transaction', () => {
    CommissionCore.reverseCommission('purch-ref-1', sampleLedger);

    const reversed = sampleLedger.find(entry => entry.status === 'REVERSED');
    assert(reversed, 'Should find reversed commission transaction');
    assert.equal(reversed.eligible_amount, -596.00, 'Reversal amount should be negative LKR 596.00');
    assert.equal(reversed.source_purchase_id, 'purch-ref-1');
});

test('Volume reversal appends negative volume entries referencing original transaction', () => {
    const mockNodes = [
        { user_id: 'user-1', placement_parent_id: 'parent-1' },
        { user_id: 'parent-1', placement_parent_id: null }
    ];

    VolumeLedger.reverseVolume('purch-ref-1', mockNodes, sampleVolumeLedger);

    const reversedVol = sampleVolumeLedger.find(entry => entry.type === 'REVERSAL');
    assert(reversedVol, 'Should find reversed volume ledger entry');
    assert.equal(reversedVol.amount, -7450.00, 'Reversal volume should be negative LKR 7,450.00');
});

if (require.main === module) {
    runTests();
}
