// Comprehensive Test Suite for STEP 23 — Product Purchase & Commission Trigger Orchestrator
const testRunner = require('./test-runner');
const PurchaseOrchestrator = require('../services/purchase-orchestrator');
const ProductSnapshotService = require('../services/product-snapshot-service');

function createOrchestratorTestContext() {
    const product = {
        id: 'prod-social-media',
        name: 'Social Media Income Masterclass',
        market_price: 35000,
        selling_price: 27500,
        product_cost: 10500,
        min_company_profit: 2000,
        direct_commission_rate: 8.00,
        binary_commission_rate: 7.00,
        binary_volume: 27500,
        max_binary_qualified_levels: 7,
        status: 'ACTIVE'
    };

    const users = [
        { id: 'u-root', status: 'ACTIVE' },
        { id: 'u-sponsor', status: 'ACTIVE' },
        { id: 'u-buyer', status: 'ACTIVE' },
        { id: 'u-dl-root', status: 'ACTIVE' },
        { id: 'u-dr-root', status: 'ACTIVE' },
        { id: 'u-dl-sponsor', status: 'ACTIVE' },
        { id: 'u-dr-sponsor', status: 'ACTIVE' }
    ];

    const kycDocs = [
        { user_id: 'u-root', status: 'APPROVED' },
        { user_id: 'u-sponsor', status: 'APPROVED' },
        { user_id: 'u-buyer', status: 'APPROVED' },
        { user_id: 'u-dl-root', status: 'APPROVED' },
        { user_id: 'u-dr-root', status: 'APPROVED' },
        { user_id: 'u-dl-sponsor', status: 'APPROVED' },
        { user_id: 'u-dr-sponsor', status: 'APPROVED' }
    ];

    const binaryNodes = [
        { user_id: 'u-root', placement_parent_id: null, position: null },
        { user_id: 'u-sponsor', placement_parent_id: 'u-root', position: 'LEFT' },
        { user_id: 'u-buyer', placement_parent_id: 'u-sponsor', position: 'LEFT' },
        { user_id: 'u-dl-root', placement_parent_id: 'u-root', position: 'LEFT' },
        { user_id: 'u-dr-root', placement_parent_id: 'u-root', position: 'RIGHT' },
        { user_id: 'u-dl-sponsor', placement_parent_id: 'u-sponsor', position: 'LEFT' },
        { user_id: 'u-dr-sponsor', placement_parent_id: 'u-sponsor', position: 'RIGHT' }
    ];

    const sponsors = [
        { user_id: 'u-sponsor', sponsor_id: 'u-root' },
        { user_id: 'u-buyer', sponsor_id: 'u-sponsor' },
        { user_id: 'u-dl-root', sponsor_id: 'u-root' },
        { user_id: 'u-dr-root', sponsor_id: 'u-root' },
        { user_id: 'u-dl-sponsor', sponsor_id: 'u-sponsor' },
        { user_id: 'u-dr-sponsor', sponsor_id: 'u-sponsor' }
    ];

    const purchases = [
        { id: 'p-root', user_id: 'u-root', status: 'ACTIVE' },
        { id: 'p-sponsor', user_id: 'u-sponsor', status: 'ACTIVE' },
        { id: 'p-dl-r', user_id: 'u-dl-root', status: 'ACTIVE' },
        { id: 'p-dr-r', user_id: 'u-dr-root', status: 'ACTIVE' },
        { id: 'p-dl-s', user_id: 'u-dl-sponsor', status: 'ACTIVE' },
        { id: 'p-dr-s', user_id: 'u-dr-sponsor', status: 'ACTIVE' }
    ];

    return {
        product,
        users,
        kycDocs,
        binaryNodes,
        sponsors,
        purchases,
        commissionLedger: [],
        volumeLedger: [],
        walletLedger: [],
        notificationQueue: [],
        auditLogs: [],
        dailyEarningsMap: new Map()
    };
}

test('Step 23: 1. Normal Purchase Orchestration: Snapshot, Volume, Direct Commission, Upline Commission, Wallet, Notifications & Audit', () => {
    const ctx = createOrchestratorTestContext();
    const purchase = {
        id: 'purch-orch-1',
        user_id: 'u-buyer',
        product_id: 'prod-social-media',
        status: 'PENDING'
    };

    const res = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
        purchase,
        product: ctx.product,
        userId: 'u-buyer',
        binaryNodes: ctx.binaryNodes,
        sponsors: ctx.sponsors,
        users: ctx.users,
        kycDocs: ctx.kycDocs,
        purchases: ctx.purchases,
        commissionLedger: ctx.commissionLedger,
        volumeLedger: ctx.volumeLedger,
        walletLedger: ctx.walletLedger,
        dailyEarningsMap: ctx.dailyEarningsMap,
        notificationQueue: ctx.notificationQueue,
        auditLogs: ctx.auditLogs
    });

    assert(res.success);
    assert(!res.idempotent);
    assert.equal(purchase.status, 'ACTIVE');
    assert(purchase.economics_snapshot, 'Snapshot must be attached');
    assert.equal(purchase.economics_snapshot.selling_price, 27500.00);

    // Verify Direct Commission (8% of Rs. 27,500 = Rs. 2,200.00 to u-sponsor)
    const directEntry = ctx.commissionLedger.find(c => c.type === 'DIRECT');
    assert(directEntry);
    assert.equal(directEntry.user_id, 'u-sponsor');
    assert.equal(directEntry.eligible_amount, 2200.00);

    // Verify Binary Commission (7% of Rs. 27,500 = Rs. 1,925.00 to u-sponsor and u-root)
    const binaryEntries = ctx.commissionLedger.filter(c => c.type === 'BINARY');
    assert(binaryEntries.length >= 1);
    assert.equal(binaryEntries[0].eligible_amount, 1925.00);

    // Verify Volume Ledger
    assert(ctx.volumeLedger.length > 0);

    // Verify Wallet Ledger Credits
    assert(ctx.walletLedger.length > 0);

    // Verify Notifications Queued
    assert(ctx.notificationQueue.length >= 2, 'Must queue purchase and commission notifications');

    // Verify Audit Logs
    assert(ctx.auditLogs.some(a => a.action === 'PURCHASE_ORCHESTRATION_COMPLETED'));
});

test('Step 23: 2. Master Idempotency Guard: Duplicate trigger call is blocked without duplicate entries', () => {
    const ctx = createOrchestratorTestContext();
    const purchase = {
        id: 'purch-orch-2',
        user_id: 'u-buyer',
        product_id: 'prod-social-media',
        status: 'PENDING'
    };

    // First Call
    const res1 = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
        purchase,
        product: ctx.product,
        userId: 'u-buyer',
        binaryNodes: ctx.binaryNodes,
        sponsors: ctx.sponsors,
        users: ctx.users,
        kycDocs: ctx.kycDocs,
        purchases: ctx.purchases,
        commissionLedger: ctx.commissionLedger,
        volumeLedger: ctx.volumeLedger,
        walletLedger: ctx.walletLedger,
        dailyEarningsMap: ctx.dailyEarningsMap,
        notificationQueue: ctx.notificationQueue,
        auditLogs: ctx.auditLogs
    });
    assert(res1.success);
    const commCount1 = ctx.commissionLedger.length;
    const walletCount1 = ctx.walletLedger.length;

    // Second Call (Idempotent Trigger)
    const res2 = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
        purchase,
        product: ctx.product,
        userId: 'u-buyer',
        binaryNodes: ctx.binaryNodes,
        sponsors: ctx.sponsors,
        users: ctx.users,
        kycDocs: ctx.kycDocs,
        purchases: ctx.purchases,
        commissionLedger: ctx.commissionLedger,
        volumeLedger: ctx.volumeLedger,
        walletLedger: ctx.walletLedger,
        dailyEarningsMap: ctx.dailyEarningsMap,
        notificationQueue: ctx.notificationQueue,
        auditLogs: ctx.auditLogs
    });

    assert(res2.success);
    assert(res2.idempotent);
    assert.equal(ctx.commissionLedger.length, commCount1, 'Commission ledger count must remain unchanged');
    assert.equal(ctx.walletLedger.length, walletCount1, 'Wallet ledger count must remain unchanged');
});

test('Step 23: 3. Economics Firewall Guard: BLOCKED snapshot grants access but prohibits commissions', () => {
    const ctx = createOrchestratorTestContext();
    const blockedProduct = {
        ...ctx.product,
        id: 'prod-blocked-1',
        selling_price: 10000,
        product_cost: 9500,
        minimum_company_profit: 2000,
        direct_commission_rate: 8.00,
        binary_commission_rate: 7.00,
        economics_status: 'BLOCKED'
    };

    const blockedSnapshot = ProductSnapshotService.createSnapshot(blockedProduct, 'purch-orch-3');
    assert.equal(blockedSnapshot.economics_status, 'BLOCKED');

    const purchase = {
        id: 'purch-orch-3',
        user_id: 'u-buyer',
        product_id: 'prod-blocked-1',
        economics_snapshot: blockedSnapshot,
        status: 'PENDING'
    };

    const res = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
        purchase,
        product: blockedProduct,
        userId: 'u-buyer',
        binaryNodes: ctx.binaryNodes,
        sponsors: ctx.sponsors,
        users: ctx.users,
        kycDocs: ctx.kycDocs,
        purchases: ctx.purchases,
        commissionLedger: ctx.commissionLedger,
        volumeLedger: ctx.volumeLedger,
        walletLedger: ctx.walletLedger,
        notificationQueue: ctx.notificationQueue,
        auditLogs: ctx.auditLogs
    });

    assert(res.success);
    assert.equal(purchase.status, 'ACTIVE', 'Product access granted');
    assert.equal(ctx.commissionLedger.length, 0, 'No commissions distributed for BLOCKED snapshot');
});

test('Step 23: 4. Fault-Tolerant Notification Isolation: Notification network error does NOT fail financial workflow', () => {
    const ctx = createOrchestratorTestContext();
    const purchase = {
        id: 'purch-orch-4',
        user_id: 'u-buyer',
        product_id: 'prod-social-media',
        status: 'PENDING'
    };

    const res = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
        purchase,
        product: ctx.product,
        userId: 'u-buyer',
        binaryNodes: ctx.binaryNodes,
        sponsors: ctx.sponsors,
        users: ctx.users,
        kycDocs: ctx.kycDocs,
        purchases: ctx.purchases,
        commissionLedger: ctx.commissionLedger,
        volumeLedger: ctx.volumeLedger,
        walletLedger: ctx.walletLedger,
        notificationQueue: ctx.notificationQueue,
        auditLogs: ctx.auditLogs,
        options: { simulateNotificationFailure: true }
    });

    assert(res.success, 'Workflow must complete successfully even when notification service fails');
    assert.equal(purchase.status, 'ACTIVE');
    assert(ctx.commissionLedger.length > 0, 'Financial transactions succeeded');
});

if (require.main === module) {
    runTests();
}
