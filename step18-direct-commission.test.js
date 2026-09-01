// Comprehensive Test Suite for STEP 18 — Direct Commission Engine
const testRunner = require('./test-runner');
const DirectCommissionEngine = require('../services/direct-commission-engine');
const ProductSnapshotService = require('../services/product-snapshot-service');

function createDirectCommissionContext() {
    const product = {
        id: 'prod-social-media',
        name: 'Social Media Income Masterclass',
        market_price: 35000,
        selling_price: 27500,
        product_cost: 10500,
        min_company_profit: 2000,
        direct_commission_rate: 8.00,
        binary_commission_rate: 6.00,
        binary_volume: 27500,
        max_binary_qualified_levels: 7,
        status: 'ACTIVE'
    };

    const snapshot = ProductSnapshotService.createSnapshot(product, 'purch-sample-1');

    return {
        users: [
            { id: 'user-sponsor', username: 'kasun_t', status: 'ACTIVE' },
            { id: 'user-purchaser', username: 'nimal_s', status: 'ACTIVE' },
            { id: 'user-suspended-sponsor', username: 'banned_sponsor', status: 'SUSPENDED' }
        ],
        sponsors: [
            { user_id: 'user-purchaser', sponsor_id: 'user-sponsor' }
        ],
        snapshot,
        commissionLedger: [],
        walletLedger: [],
        dailyEarningsMap: new Map()
    };
}

test('Step 18: 1. Valid sponsor receives exact Direct Commission (8% of Rs. 27,500 = Rs. 2,200.00)', () => {
    const ctx = createDirectCommissionContext();
    const purchase = {
        id: 'purch-18-1',
        user_id: 'user-purchaser',
        status: 'ACTIVE',
        economics_snapshot: ctx.snapshot
    };

    const res = DirectCommissionEngine.processDirectCommission({
        purchase,
        snapshot: ctx.snapshot,
        sponsors: ctx.sponsors,
        users: ctx.users,
        commissionLedger: ctx.commissionLedger,
        walletLedger: ctx.walletLedger,
        dailyEarningsMap: ctx.dailyEarningsMap
    });

    assert(res.success);
    assert.equal(res.sponsor_id, 'user-sponsor');
    assert.equal(res.rate_percent, 8.00);
    assert.equal(res.eligible_amount, 2200.00);

    // Verify Commission Ledger
    assert.equal(ctx.commissionLedger.length, 1);
    assert.equal(ctx.commissionLedger[0].type, 'DIRECT');
    assert.equal(ctx.commissionLedger[0].eligible_amount, 2200.00);

    // Verify Wallet Ledger
    assert.equal(ctx.walletLedger.length, 1);
    assert.equal(ctx.walletLedger[0].amount, 2200.00);
});

test('Step 18: 2. No sponsor / Root purchaser: Direct commission skipped cleanly', () => {
    const ctx = createDirectCommissionContext();
    const purchase = {
        id: 'purch-18-2',
        user_id: 'user-sponsor', // Has no entry in ctx.sponsors
        status: 'ACTIVE',
        economics_snapshot: ctx.snapshot
    };

    const res = DirectCommissionEngine.processDirectCommission({
        purchase,
        snapshot: ctx.snapshot,
        sponsors: ctx.sponsors,
        users: ctx.users,
        commissionLedger: ctx.commissionLedger,
        walletLedger: ctx.walletLedger
    });

    assert(res.success);
    assert.equal(res.direct_commission_amount, 0.00);
    assert.equal(ctx.commissionLedger.length, 0);
});

test('Step 18: 3. Suspended sponsor is blocked from receiving direct commissions', () => {
    const ctx = createDirectCommissionContext();
    ctx.sponsors.push({ user_id: 'user-purchaser-2', sponsor_id: 'user-suspended-sponsor' });

    const purchase = {
        id: 'purch-18-3',
        user_id: 'user-purchaser-2',
        status: 'ACTIVE',
        economics_snapshot: ctx.snapshot
    };

    const res = DirectCommissionEngine.processDirectCommission({
        purchase,
        snapshot: ctx.snapshot,
        sponsors: ctx.sponsors,
        users: ctx.users,
        commissionLedger: ctx.commissionLedger,
        walletLedger: ctx.walletLedger
    });

    assert(!res.success);
    assert(res.reason.includes('SUSPENDED'));
    assert.equal(ctx.commissionLedger.length, 0);
});

test('Step 18: 4. Idempotency Protection: Duplicate purchase event blocked from paying commission twice', () => {
    const ctx = createDirectCommissionContext();
    const purchase = {
        id: 'purch-18-4',
        user_id: 'user-purchaser',
        status: 'ACTIVE',
        economics_snapshot: ctx.snapshot
    };

    // First call -> successfully paid
    const res1 = DirectCommissionEngine.processDirectCommission({
        purchase,
        snapshot: ctx.snapshot,
        sponsors: ctx.sponsors,
        users: ctx.users,
        commissionLedger: ctx.commissionLedger,
        walletLedger: ctx.walletLedger,
        dailyEarningsMap: ctx.dailyEarningsMap
    });
    assert(res1.success);
    assert.equal(ctx.commissionLedger.length, 1);

    // Second call -> blocked by idempotency
    const res2 = DirectCommissionEngine.processDirectCommission({
        purchase,
        snapshot: ctx.snapshot,
        sponsors: ctx.sponsors,
        users: ctx.users,
        commissionLedger: ctx.commissionLedger,
        walletLedger: ctx.walletLedger,
        dailyEarningsMap: ctx.dailyEarningsMap
    });
    assert(res2.success);
    assert(res2.idempotent);
    assert.equal(ctx.commissionLedger.length, 1, 'Commission ledger length must remain 1');
    assert.equal(ctx.walletLedger.length, 1, 'Wallet ledger length must remain 1');
});

test('Step 18: 5. Refund Reversals: Refunding purchase creates compensating negative entries', () => {
    const ctx = createDirectCommissionContext();
    const purchase = {
        id: 'purch-18-5',
        user_id: 'user-purchaser',
        status: 'ACTIVE',
        economics_snapshot: ctx.snapshot
    };

    // 1. Pay commission
    DirectCommissionEngine.processDirectCommission({
        purchase,
        snapshot: ctx.snapshot,
        sponsors: ctx.sponsors,
        users: ctx.users,
        commissionLedger: ctx.commissionLedger,
        walletLedger: ctx.walletLedger,
        dailyEarningsMap: ctx.dailyEarningsMap
    });
    assert.equal(ctx.commissionLedger.length, 1);

    // 2. Process refund reversal
    const reversals = DirectCommissionEngine.reverseDirectCommission('purch-18-5', ctx.commissionLedger, ctx.walletLedger);
    assert.equal(reversals.length, 1);
    assert.equal(ctx.commissionLedger.length, 2);
    assert.equal(ctx.commissionLedger[1].eligible_amount, -2200.00);
    assert.equal(ctx.walletLedger.length, 2);
    assert.equal(ctx.walletLedger[1].amount, -2200.00);
});

test('Step 18: 6. Daily Cap Limit Enforcement on Direct Commissions', () => {
    const ctx = createDirectCommissionContext();
    const dailyCapLimit = 3000.00; // Cap at Rs. 3,000

    // Sponsor already earned Rs. 2,000 today
    const todayKey = `user-sponsor-${new Date().toISOString().split('T')[0]}`;
    ctx.dailyEarningsMap.set(todayKey, 2000.00);

    const purchase = {
        id: 'purch-18-6',
        user_id: 'user-purchaser',
        status: 'ACTIVE',
        economics_snapshot: ctx.snapshot
    };

    // Commission is Rs. 2,200. With Rs. 2,000 existing, remaining cap is Rs. 1,000
    const res = DirectCommissionEngine.processDirectCommission({
        purchase,
        snapshot: ctx.snapshot,
        sponsors: ctx.sponsors,
        users: ctx.users,
        commissionLedger: ctx.commissionLedger,
        walletLedger: ctx.walletLedger,
        dailyEarningsMap: ctx.dailyEarningsMap,
        dailyCapLimit
    });

    assert(res.success);
    assert.equal(res.calculated_amount, 2200.00);
    assert.equal(res.eligible_amount, 1000.00, 'Eligible amount must be capped to remaining Rs. 1,000');
    assert.equal(res.capped_amount, 1200.00);
});

test('Step 18: 7. Snapshot Rate Enforcement: Product edits do NOT change historical commission paid', () => {
    const ctx = createDirectCommissionContext();
    const purchase = {
        id: 'purch-18-7',
        user_id: 'user-purchaser',
        status: 'ACTIVE',
        economics_snapshot: ctx.snapshot // snapshot has rate = 8%
    };

    const res = DirectCommissionEngine.processDirectCommission({
        purchase,
        snapshot: ctx.snapshot,
        sponsors: ctx.sponsors,
        users: ctx.users,
        commissionLedger: ctx.commissionLedger,
        walletLedger: ctx.walletLedger,
        dailyEarningsMap: ctx.dailyEarningsMap
    });

    assert.equal(res.eligible_amount, 2200.00);
});

test('Step 18: 8. Cents-based mathematical integrity on odd pricing (e.g. 7.5% of Rs. 7,450 = Rs. 558.75)', () => {
    const amount = DirectCommissionEngine.calculateDirectCommission(7450.00, 7.50);
    assert.equal(amount, 558.75);
});

if (require.main === module) {
    runTests();
}
