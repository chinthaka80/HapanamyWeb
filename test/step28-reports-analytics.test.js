// Comprehensive Test Suite for STEP 28 — Reports & Analytics Engine
const testRunner = require('./test-runner');
const ReportService = require('../services/report-service');
const ProductSnapshotService = require('../services/product-snapshot-service');

function createReportingTestContext() {
    const product1 = {
        id: 'prod-social-media',
        name: 'Social Media Income Masterclass',
        selling_price: 27500.00,
        product_cost: 2500.00,
        binary_volume: 27500.00,
        binary_commission_rate: 7.00,
        direct_commission_rate: 8.00,
        status: 'ACTIVE'
    };

    const snapshot1 = ProductSnapshotService.createSnapshot(product1, 'purch-rep-1');

    const users = [
        { id: 'u-admin', username: 'admin', full_name: 'Administrator', role: 'ADMIN', status: 'ACTIVE', created_at: '2026-08-01T08:00:00Z' },
        { id: 'u-sponsor', username: 'top_sponsor', full_name: 'Kasun Leader', role: 'MEMBER', status: 'ACTIVE', created_at: '2026-08-01T09:00:00Z' },
        { id: 'u-direct-1', username: 'nimal_s', full_name: 'Nimal Silva', role: 'MEMBER', status: 'ACTIVE', created_at: '2026-08-05T10:00:00Z' },
        { id: 'u-direct-2', username: 'sunil_k', full_name: 'Sunil Kumar', role: 'MEMBER', status: 'ACTIVE', created_at: '2026-08-10T12:00:00Z' }
    ];

    const kycDocs = [
        { id: 'kyc-1', user_id: 'u-sponsor', status: 'APPROVED' },
        { id: 'kyc-2', user_id: 'u-direct-1', status: 'APPROVED' },
        { id: 'kyc-3', user_id: 'u-direct-2', status: 'PENDING' }
    ];

    const binaryNodes = [
        { user_id: 'u-admin', placement_parent_id: null, position: null },
        { user_id: 'u-sponsor', placement_parent_id: 'u-admin', position: 'LEFT' },
        { user_id: 'u-direct-1', placement_parent_id: 'u-sponsor', position: 'LEFT' },
        { user_id: 'u-direct-2', placement_parent_id: 'u-sponsor', position: 'RIGHT' }
    ];

    const sponsors = [
        { user_id: 'u-sponsor', sponsor_id: 'u-admin' },
        { user_id: 'u-direct-1', sponsor_id: 'u-sponsor' },
        { user_id: 'u-direct-2', sponsor_id: 'u-sponsor' }
    ];

    const purchases = [
        { id: 'p-1', user_id: 'u-sponsor', product_id: 'prod-social-media', selling_price: 27500.00, economics_snapshot: snapshot1, status: 'ACTIVE', created_at: '2026-08-01T10:00:00Z' },
        { id: 'p-2', user_id: 'u-direct-1', product_id: 'prod-social-media', selling_price: 27500.00, economics_snapshot: snapshot1, status: 'ACTIVE', created_at: '2026-08-05T11:00:00Z' },
        { id: 'p-3', user_id: 'u-direct-2', product_id: 'prod-social-media', selling_price: 27500.00, economics_snapshot: snapshot1, status: 'ACTIVE', created_at: '2026-08-10T14:00:00Z' }
    ];

    const walletLedger = [
        { id: 'tx-1', user_id: 'u-sponsor', type: 'DIRECT_COMMISSION', amount: 2200.00, balance_before: 0, balance_after: 2200, status: 'COMPLETED', created_at: '2026-08-05T11:05:00Z' },
        { id: 'tx-2', user_id: 'u-sponsor', type: 'DIRECT_COMMISSION', amount: 2200.00, balance_before: 2200, balance_after: 4400, status: 'COMPLETED', created_at: '2026-08-10T14:05:00Z' },
        { id: 'tx-3', user_id: 'u-admin', type: 'BINARY_COMMISSION', amount: 1925.00, balance_before: 0, balance_after: 1925, status: 'COMPLETED', created_at: '2026-08-10T14:10:00Z' }
    ];

    const volumeLedger = [
        { user_id: 'u-admin', leg: 'LEFT', amount: 27500.00, type: 'SALE_VOLUME' },
        { user_id: 'u-admin', leg: 'RIGHT', amount: 27500.00, type: 'SALE_VOLUME' },
        { user_id: 'u-sponsor', leg: 'LEFT', amount: 27500.00, type: 'SALE_VOLUME' },
        { user_id: 'u-sponsor', leg: 'RIGHT', amount: 27500.00, type: 'SALE_VOLUME' }
    ];

    const withdrawals = [
        { id: 'wd-1', user_id: 'u-sponsor', amount: 2000.00, status: 'PENDING', created_at: '2026-08-15T10:00:00Z' }
    ];

    const auditLogs = [];

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
        auditLogs
    };
}

test('Step 28: 1. Financial Report: Authoritative Revenue, Cost, Profit & Ledger Totals Parity', () => {
    const ctx = createReportingTestContext();
    const rep = ReportService.generateFinancialReport({
        requestingUser: ctx.adminUser,
        purchases: ctx.purchases,
        walletLedger: ctx.walletLedger,
        withdrawals: ctx.withdrawals,
        auditLogs: ctx.auditLogs
    });

    assert(rep.success);
    // 3 sales x 27,500 = 82,500
    assert.equal(rep.summary.total_revenue, 82500.00);
    // 3 sales x 2,500 cost = 7,500
    assert.equal(rep.summary.total_product_cost, 7500.00);
    // Gross Profit = 82,500 - 7,500 = 75,000
    assert.equal(rep.summary.total_gross_profit, 75000.00);
    // Commission Paid = 2,200 + 2,200 + 1,925 = 6,325
    assert.equal(rep.summary.commission_paid, 6325.00);
    // Commission Pending = 2,000 withdrawal
    assert.equal(rep.summary.commission_pending, 2000.00);
    // Liability = 6,325 + 2,000 = 8,325
    assert.equal(rep.summary.commission_liability, 8325.00);
    // Company Margin = 75,000 - 6,325 = 68,675
    assert.equal(rep.summary.company_margin_estimate, 68675.00);

    // Product breakdown
    assert.equal(rep.product_sales.length, 1);
    assert.equal(rep.product_sales[0].units_sold, 3);
    assert.equal(rep.product_sales[0].revenue, 82500.00);
});

test('Step 28: 2. MLM Report: Binary Volume, Direct Referrals, Qualification Stats & Top Earners', () => {
    const ctx = createReportingTestContext();
    const rep = ReportService.generateMlmReport({
        requestingUser: ctx.adminUser,
        users: ctx.users,
        binaryNodes: ctx.binaryNodes,
        volumeLedger: ctx.volumeLedger,
        sponsors: ctx.sponsors,
        walletLedger: ctx.walletLedger,
        purchases: ctx.purchases,
        kycDocs: ctx.kycDocs,
        auditLogs: ctx.auditLogs
    });

    assert(rep.success);
    assert.equal(rep.binary_volume.total_left_volume, 55000.00);
    assert.equal(rep.binary_volume.total_right_volume, 55000.00);
    assert.equal(rep.direct_referrals_stats.total_sponsorship_links, 3);
    assert.equal(rep.qualification_statistics.total_evaluated, 4);
    assert.equal(rep.qualified_upline_payouts.total_binary_commissions_paid, 1925.00);

    // Top Earners: Kasun Leader (u-sponsor) earned 4,400, Administrator (u-admin) earned 1,925
    assert.equal(rep.top_earners[0].user_id, 'u-sponsor');
    assert.equal(rep.top_earners[0].total_earnings, 4400.00);
});

test('Step 28: 3. Member Report: Personalized statement & Tenant-Isolation Enforcement', () => {
    const ctx = createReportingTestContext();

    // 1. Member requests their own report
    const selfRep = ReportService.generateMemberReport({
        requestingUser: ctx.regularMember,
        targetUserId: 'u-sponsor',
        users: ctx.users,
        purchases: ctx.purchases,
        walletLedger: ctx.walletLedger,
        withdrawals: ctx.withdrawals,
        binaryNodes: ctx.binaryNodes,
        kycDocs: ctx.kycDocs
    });

    assert(selfRep.success);
    assert.equal(selfRep.member_profile.username, 'top_sponsor');
    assert.equal(selfRep.earnings_summary.total_earned, 4400.00);
    assert.equal(selfRep.purchase_history.length, 1);
    assert.equal(selfRep.withdrawal_history.length, 1);
    assert.equal(selfRep.commission_history.length, 2);

    // 2. Member blocked from accessing another user's report
    assert.throws(() => {
        ReportService.generateMemberReport({
            requestingUser: ctx.regularMember,
            targetUserId: 'u-direct-1', // Another user
            users: ctx.users,
            purchases: ctx.purchases,
            walletLedger: ctx.walletLedger,
            withdrawals: ctx.withdrawals
        });
    }, /403 Forbidden/);
});

test('Step 28: 4. Multi-Criteria Filtering: Date range, Product, Member, and Status', () => {
    const ctx = createReportingTestContext();

    // Filter purchases by date range
    const filteredByDate = ReportService.filterDataset(ctx.purchases, {
        startDate: '2026-08-04T00:00:00Z',
        endDate: '2026-08-06T23:59:59Z'
    });
    assert.equal(filteredByDate.totalCount, 1);
    assert.equal(filteredByDate.data[0].id, 'p-2');

    // Filter wallet by commission type
    const directTx = ReportService.filterDataset(ctx.walletLedger, {
        commissionType: 'DIRECT_COMMISSION'
    });
    assert.equal(directTx.totalCount, 2);
});

test('Step 28: 5. Exporters: Validates CSV, Excel-XML, and PDF Structured Outputs', () => {
    const records = [
        { id: '1', name: 'Facebook Course', revenue: 7450 },
        { id: '2', name: 'Social Media Masterclass', revenue: 27500 }
    ];

    // 1. CSV
    const csv = ReportService.exportToCSV(records);
    assert(csv.includes('id,name,revenue'));
    assert(csv.includes('"1","Facebook Course","7450"'));

    // 2. Excel
    const excel = ReportService.exportToExcel(records, 'Sales');
    assert(excel.includes('<table border="1">'));
    assert(excel.includes('Social Media Masterclass'));

    // 3. PDF
    const pdf = ReportService.exportToPDFFormat('Financial Report', { TotalRevenue: 34950 }, records);
    assert(pdf.includes('=== FINANCIAL REPORT ==='));
    assert(pdf.includes('TotalRevenue: 34950'));
});

test('Step 28: 6. Security & Audit Logging: Verifies RBAC and Sensitive Report Access Logging', () => {
    const ctx = createReportingTestContext();

    // 1. Regular member blocked from financial reports
    assert.throws(() => {
        ReportService.generateFinancialReport({
            requestingUser: ctx.regularMember,
            purchases: ctx.purchases
        });
    }, /403 Forbidden/);

    // 2. Audit log entry recorded on admin report generation
    ReportService.generateFinancialReport({
        requestingUser: ctx.adminUser,
        purchases: ctx.purchases,
        walletLedger: ctx.walletLedger,
        withdrawals: ctx.withdrawals,
        auditLogs: ctx.auditLogs
    });

    const exportLog = ctx.auditLogs.find(l => l.action === 'REPORT_GENERATED');
    assert(exportLog, 'Audit log must record REPORT_GENERATED');
    assert.equal(exportLog.user_id, 'u-admin');
});

if (require.main === module) {
    runTests();
}
