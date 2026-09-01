// Comprehensive Test Suite for STEP 27 — Admin MLM Operations Dashboard
const testRunner = require('./test-runner');
const AdminDashboardService = require('../services/admin-dashboard-service');
const ProductSnapshotService = require('../services/product-snapshot-service');

function createAdminDashboardTestContext() {
    const product = {
        id: 'prod-social-media',
        name: 'Social Media Income Masterclass',
        selling_price: 27500,
        product_cost: 10500,
        binary_volume: 27500,
        binary_commission_rate: 6.00,
        direct_commission_rate: 8.00,
        status: 'ACTIVE'
    };

    const snapshot = ProductSnapshotService.createSnapshot(product, 'purch-admin-1');

    const users = [
        { id: 'u-root', username: 'founder', full_name: 'Founder Admin', role: 'SUPER_ADMIN', status: 'ACTIVE', created_at: new Date().toISOString() },
        { id: 'u-sponsor-1', username: 'top_recruiter', full_name: 'Kamal Silva', role: 'MEMBER', status: 'ACTIVE', created_at: new Date().toISOString() },
        { id: 'u-buyer-1', username: 'buyer_one', full_name: 'Sunil Perera', role: 'MEMBER', status: 'ACTIVE', created_at: new Date().toISOString() },
        { id: 'u-buyer-2', username: 'buyer_two', full_name: 'Nimal Fernando', role: 'MEMBER', status: 'ACTIVE', created_at: new Date().toISOString() }
    ];

    const kycDocs = [
        { id: 'kyc-1', user_id: 'u-root', status: 'APPROVED' },
        { id: 'kyc-2', user_id: 'u-sponsor-1', status: 'APPROVED' },
        { id: 'kyc-3', user_id: 'u-buyer-1', status: 'PENDING' }
    ];

    const binaryNodes = [
        { user_id: 'u-root', placement_parent_id: null, position: null },
        { user_id: 'u-sponsor-1', placement_parent_id: 'u-root', position: 'LEFT' },
        { user_id: 'u-buyer-1', placement_parent_id: 'u-sponsor-1', position: 'LEFT' },
        { user_id: 'u-buyer-2', placement_parent_id: 'u-sponsor-1', position: 'RIGHT' }
    ];

    const sponsors = [
        { user_id: 'u-sponsor-1', sponsor_id: 'u-root' },
        { user_id: 'u-buyer-1', sponsor_id: 'u-sponsor-1' },
        { user_id: 'u-buyer-2', sponsor_id: 'u-sponsor-1' }
    ];

    const purchases = [
        { id: 'p-1', user_id: 'u-root', product_id: 'prod-social-media', selling_price: 27500, economics_snapshot: snapshot, status: 'ACTIVE', created_at: new Date().toISOString() },
        { id: 'p-2', user_id: 'u-sponsor-1', product_id: 'prod-social-media', selling_price: 27500, economics_snapshot: snapshot, status: 'ACTIVE', created_at: new Date().toISOString() },
        { id: 'p-3', user_id: 'u-buyer-1', product_id: 'prod-social-media', selling_price: 27500, economics_snapshot: snapshot, status: 'ACTIVE', created_at: new Date().toISOString() }
    ];

    const walletLedger = [
        { id: 'tx-1', user_id: 'u-sponsor-1', type: 'DIRECT_COMMISSION', amount: 2200.00, status: 'COMPLETED', created_at: new Date().toISOString() },
        { id: 'tx-2', user_id: 'u-root', type: 'BINARY_COMMISSION', amount: 1925.00, status: 'COMPLETED', created_at: new Date().toISOString() }
    ];

    const volumeLedger = [
        { user_id: 'u-root', leg: 'LEFT', amount: 27500, type: 'SALE_VOLUME' },
        { user_id: 'u-root', leg: 'RIGHT', amount: 27500, type: 'SALE_VOLUME' },
        { user_id: 'u-sponsor-1', leg: 'LEFT', amount: 27500, type: 'SALE_VOLUME' },
        { user_id: 'u-root', leg: 'LEFT', amount: -27500, type: 'MATCHED_VOLUME' }
    ];

    const withdrawals = [
        { id: 'wd-1', user_id: 'u-sponsor-1', amount: 2000.00, status: 'PENDING' }
    ];

    const paymentSubmissions = [
        { id: 'pay-1', user_id: 'u-buyer-2', amount: 27500, status: 'PENDING', flagged_for_review: true }
    ];

    return {
        adminUser: users[0],
        regularMember: users[1],
        users,
        kycDocs,
        binaryNodes,
        sponsors,
        purchases,
        walletLedger,
        volumeLedger,
        withdrawals,
        paymentSubmissions,
        refundRequests: []
    };
}

test('Step 27: 1. Overview Metrics: Accurately calculates member vitals and pending counters', () => {
    const ctx = createAdminDashboardTestContext();
    const res = AdminDashboardService.getAdminDashboardData({
        ...ctx,
        requestingUser: ctx.adminUser
    });

    assert(res.success);
    assert.equal(res.overview.total_members, 4);
    assert.equal(res.overview.active_members, 3);
    assert.equal(res.overview.new_registrations_today, 4);
    assert.equal(res.overview.pending_kyc_count, 1);
    assert.equal(res.overview.pending_payments_count, 1);
    assert.equal(res.overview.pending_withdrawals_count, 1);
});

test('Step 27: 2. Financial Metrics: Authoritative snapshot-driven revenue, costs, and profit margin', () => {
    const ctx = createAdminDashboardTestContext();
    const res = AdminDashboardService.getAdminDashboardData({
        ...ctx,
        requestingUser: ctx.adminUser
    });

    // 3 active sales x 27,500 = 82,500 revenue
    assert.equal(res.financial_summary.total_product_revenue, 82500.00);
    // 3 active sales x 10,500 cost = 31,500 cost
    assert.equal(res.financial_summary.total_product_cost, 31500.00);
    // Gross Profit = 82,500 - 31,500 = 51,000
    assert.equal(res.financial_summary.total_gross_profit, 51000.00);
    // Commission Paid = 2,200 + 1,925 = 4,125
    assert.equal(res.financial_summary.total_commission_paid, 4125.00);
    // Commission / Payout Pending = 2,000
    assert.equal(res.financial_summary.total_commission_pending, 2000.00);
    // Net Company Margin = 51,000 - 4,125 = 46,875
    assert.equal(res.financial_summary.company_net_margin_estimate, 46875.00);
});

test('Step 27: 3. Network Metrics: Aggregates network volume and ranks top growing sponsors', () => {
    const ctx = createAdminDashboardTestContext();
    const res = AdminDashboardService.getAdminDashboardData({
        ...ctx,
        requestingUser: ctx.adminUser
    });

    assert.equal(res.network_metrics.total_left_volume, 55000.00);
    assert.equal(res.network_metrics.total_right_volume, 27500.00);
    assert.equal(res.network_metrics.total_matched_volume, 27500.00);

    // Kamal Silva (u-sponsor-1) has 2 directs
    assert.equal(res.network_metrics.top_growing_sponsors[0].sponsor_id, 'u-sponsor-1');
    assert.equal(res.network_metrics.top_growing_sponsors[0].direct_referrals_count, 2);
});

test('Step 27: 4. Operational Queues & Suspicious Fraud Activity', () => {
    const ctx = createAdminDashboardTestContext();
    const res = AdminDashboardService.getAdminDashboardData({
        ...ctx,
        requestingUser: ctx.adminUser
    });

    assert.equal(res.operational_queues.pending_payments.length, 1);
    assert.equal(res.operational_queues.pending_withdrawals.length, 1);
    assert.equal(res.operational_queues.pending_kyc.length, 1);
    assert.equal(res.operational_queues.suspicious_activity.length, 1, 'Flagged fraud payment listed');
});

test('Step 27: 5. RBAC Security: Blocks non-admin and unauthenticated users', () => {
    const ctx = createAdminDashboardTestContext();

    // 1. Regular Member Access (Blocked with 403)
    assert.throws(() => {
        AdminDashboardService.getAdminDashboardData({
            ...ctx,
            requestingUser: ctx.regularMember // role: 'MEMBER'
        });
    }, /403 Forbidden/);

    // 2. Unauthenticated Access (Blocked)
    assert.throws(() => {
        AdminDashboardService.getAdminDashboardData({
            ...ctx,
            requestingUser: null
        });
    }, /Authentication required/);
});

test('Step 27: 6. Large Dataset Stress Handling: Processes thousands of entries seamlessly', () => {
    const ctx = createAdminDashboardTestContext();
    
    // Generate 500 mock users and 500 mock wallet transactions
    const bulkUsers = [];
    const bulkWalletLedger = [];
    for (let i = 0; i < 500; i++) {
        bulkUsers.push({
            id: `u-bulk-${i}`,
            username: `user_${i}`,
            status: 'ACTIVE',
            created_at: new Date().toISOString()
        });
        bulkWalletLedger.push({
            id: `tx-bulk-${i}`,
            user_id: `u-bulk-${i}`,
            type: 'DIRECT_COMMISSION',
            amount: 100.00,
            status: 'COMPLETED'
        });
    }

    const res = AdminDashboardService.getAdminDashboardData({
        ...ctx,
        requestingUser: ctx.adminUser,
        users: [...ctx.users, ...bulkUsers],
        walletLedger: [...ctx.walletLedger, ...bulkWalletLedger]
    });

    assert(res.success);
    assert.equal(res.overview.total_members, 504);
    assert.equal(res.financial_summary.total_commission_paid, 54125.00);
});

if (require.main === module) {
    runTests();
}
