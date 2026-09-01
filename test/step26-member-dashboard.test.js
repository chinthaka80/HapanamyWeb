// Comprehensive Test Suite for STEP 26 — Member Dashboard Engine
const testRunner = require('./test-runner');
const MemberDashboardService = require('../services/member-dashboard-service');
const WalletService = require('../services/wallet-service');
const ProductSnapshotService = require('../services/product-snapshot-service');

function createDashboardTestContext() {
    const product = {
        id: 'prod-social-media',
        name: 'Social Media Income Masterclass',
        selling_price: 27500,
        binary_volume: 27500,
        binary_commission_rate: 7.00,
        direct_commission_rate: 8.00,
        max_binary_qualified_levels: 7,
        status: 'ACTIVE'
    };

    const snapshot = ProductSnapshotService.createSnapshot(product, 'purch-dash-1');

    const users = [
        { id: 'u-member-main', username: 'kasun_p', full_name: 'Kasun Perera', email: 'kasun@test.lk', status: 'ACTIVE', created_at: '2026-08-01T10:00:00Z' },
        { id: 'u-direct-left', username: 'nimal_s', full_name: 'Nimal Silva', email: 'nimal@test.lk', status: 'ACTIVE', created_at: '2026-08-05T10:00:00Z' },
        { id: 'u-direct-right', username: 'sunil_k', full_name: 'Sunil Kumar', email: 'sunil@test.lk', status: 'ACTIVE', created_at: '2026-08-10T10:00:00Z' },
        { id: 'u-downline-leaf', username: 'amara_j', full_name: 'Amara Jay', email: 'amara@test.lk', status: 'ACTIVE', created_at: '2026-08-15T10:00:00Z' }
    ];

    const kycDocs = [
        { user_id: 'u-member-main', status: 'APPROVED' },
        { user_id: 'u-direct-left', status: 'APPROVED' },
        { user_id: 'u-direct-right', status: 'APPROVED' }
    ];

    const binaryNodes = [
        { user_id: 'u-member-main', placement_parent_id: null, position: null },
        { user_id: 'u-direct-left', placement_parent_id: 'u-member-main', position: 'LEFT' },
        { user_id: 'u-direct-right', placement_parent_id: 'u-member-main', position: 'RIGHT' },
        { user_id: 'u-downline-leaf', placement_parent_id: 'u-direct-left', position: 'LEFT' }
    ];

    const sponsors = [
        { user_id: 'u-direct-left', sponsor_id: 'u-member-main' },
        { user_id: 'u-direct-right', sponsor_id: 'u-member-main' }
    ];

    const purchases = [
        { id: 'p-main', user_id: 'u-member-main', product_id: 'prod-social-media', selling_price: 27500, economics_snapshot: snapshot, status: 'ACTIVE' },
        { id: 'p-left', user_id: 'u-direct-left', product_id: 'prod-social-media', selling_price: 27500, economics_snapshot: snapshot, status: 'ACTIVE' },
        { id: 'p-right', user_id: 'u-direct-right', product_id: 'prod-social-media', selling_price: 27500, economics_snapshot: snapshot, status: 'ACTIVE' }
    ];

    const walletLedger = [];
    // Seed Direct Commissions (2 x Rs. 2,200 = Rs. 4,400)
    WalletService.creditCommission({
        userId: 'u-member-main',
        amount: 2200.00,
        commissionType: 'DIRECT_COMMISSION',
        sourcePurchaseId: 'p-left',
        ledger: walletLedger
    });
    WalletService.creditCommission({
        userId: 'u-member-main',
        amount: 2200.00,
        commissionType: 'DIRECT_COMMISSION',
        sourcePurchaseId: 'p-right',
        ledger: walletLedger
    });

    const volumeLedger = [
        { user_id: 'u-member-main', leg: 'LEFT', amount: 27500.00, type: 'SALE_VOLUME' },
        { user_id: 'u-member-main', leg: 'LEFT', amount: 27500.00, type: 'SALE_VOLUME' },
        { user_id: 'u-member-main', leg: 'RIGHT', amount: 27500.00, type: 'SALE_VOLUME' }
    ];

    const withdrawals = [
        { id: 'wd-1', user_id: 'u-member-main', amount: 1000.00, status: 'PAID', bank_transfer_reference: 'CEFT-102938' }
    ];

    const paymentSubmissions = [
        { id: 'pay-1', user_id: 'u-member-main', product_id: 'prod-social-media', amount: 27500, status: 'APPROVED' }
    ];

    return {
        userId: 'u-member-main',
        users,
        kycDocs,
        binaryNodes,
        sponsors,
        purchases,
        walletLedger,
        volumeLedger,
        withdrawals,
        paymentSubmissions
    };
}

test('Step 26: 1. Member Profile & KYC Status: Accurately compiles profile with qualification status', () => {
    const ctx = createDashboardTestContext();
    const data = MemberDashboardService.getMemberDashboardData(ctx);

    assert(data.success);
    assert.equal(data.profile.username, 'kasun_p');
    assert.equal(data.profile.full_name, 'Kasun Perera');
    assert.equal(data.profile.account_status, 'ACTIVE');
    assert.equal(data.profile.kyc_status, 'APPROVED');
    assert.equal(data.profile.qualification_status, 'QUALIFIED');
    assert(data.profile.is_qualified);
});

test('Step 26: 2. Earnings Section: Reports accurate total earned, available balance and quotas', () => {
    const ctx = createDashboardTestContext();
    const data = MemberDashboardService.getMemberDashboardData(ctx);

    assert.equal(data.earnings.total_earned, 4400.00);
    assert.equal(data.earnings.available_balance, 4400.00);
    assert.equal(data.earnings.daily_cap, 30000.00);
    assert.equal(data.earnings.daily_remaining, 25600.00);
});

test('Step 26: 3. Binary Network Metrics: Reports Left and Right counts and volumes', () => {
    const ctx = createDashboardTestContext();
    const data = MemberDashboardService.getMemberDashboardData(ctx);

    // Left subtree has u-direct-left and u-downline-leaf (2 members)
    // Right subtree has u-direct-right (1 member)
    assert.equal(data.binary_network.left_team_count, 2);
    assert.equal(data.binary_network.right_team_count, 1);

    // Volume: Left = 55,000, Right = 27,500
    assert.equal(data.binary_network.left_volume_lifetime, 55000.00);
    assert.equal(data.binary_network.right_volume_lifetime, 27500.00);
});

test('Step 26: 4. Direct Referrals List: Details of all directly sponsored members', () => {
    const ctx = createDashboardTestContext();
    const data = MemberDashboardService.getMemberDashboardData(ctx);

    assert.equal(data.direct_referrals.total_directs, 2);
    const leftDirect = data.direct_referrals.list.find(d => d.username === 'nimal_s');
    assert(leftDirect);
    assert.equal(leftDirect.tree_position, 'LEFT');
    assert(leftDirect.has_active_purchase);
});

test('Step 26: 5. Referral Link Tools: Generates dual-leg URLs and unique code', () => {
    const ctx = createDashboardTestContext();
    const data = MemberDashboardService.getMemberDashboardData(ctx);

    assert.equal(data.referral_tools.referral_code, 'kasun_p');
    assert.equal(data.referral_tools.left_link, 'https://hapanamy.lk/register?ref=kasun_p&position=left');
    assert.equal(data.referral_tools.right_link, 'https://hapanamy.lk/register?ref=kasun_p&position=right');
});

test('Step 26: 6. Products Entitlement Section: Lists active masterclasses', () => {
    const ctx = createDashboardTestContext();
    const data = MemberDashboardService.getMemberDashboardData(ctx);

    assert.equal(data.products.total_purchased, 1);
    assert.equal(data.products.active_count, 1);
    assert.equal(data.products.list[0].product_id, 'prod-social-media');
});

test('Step 26: 7. Financial Activity: Aggregates wallet transactions and withdrawal history', () => {
    const ctx = createDashboardTestContext();
    const data = MemberDashboardService.getMemberDashboardData(ctx);

    assert.equal(data.financial_activity.recent_transactions.length, 2);
    assert.equal(data.financial_activity.withdrawal_history.length, 1);
    assert.equal(data.financial_activity.withdrawal_history[0].bank_transfer_reference, 'CEFT-102938');
});

test('Step 26: 8. Privacy & Tenant Isolation: Unknown member ID throws informative error', () => {
    const ctx = createDashboardTestContext();
    assert.throws(() => {
        MemberDashboardService.getMemberDashboardData({
            ...ctx,
            userId: 'u-nonexistent-member'
        });
    }, /Member u-nonexistent-member not found/);
});

if (require.main === module) {
    runTests();
}
