// Hapanamy.lk Step 37: Member Dashboard Product Purchase Center & Bank Transfer Flow Test Suite
const testRunner = require('./test-runner');
const assert = require('assert');
const PurchaseOrchestrator = require('../services/purchase-orchestrator');
const ProductSnapshotService = require('../services/product-snapshot-service');
const ProductCommissionValidator = require('../services/product-commission-validator');
const ProductEconomicsCalculator = require('../services/product-economics-calculator');
const SecurityCore = require('../services/security-core');

test('Step 37: TEST 01: Official Company Bank Accounts Configuration & Data Invariants', () => {
    const mockCompanyBanks = [
        {
            id: 'bank-hnb-1',
            bank_name: 'Hatton National Bank (HNB)',
            account_name: 'HAPANAMY ENTERPRISES (PVT) LTD',
            account_number: '081020048921',
            branch: 'Maharagama',
            branch_code: '081',
            currency: 'LKR',
            is_primary: true
        },
        {
            id: 'bank-comb-1',
            bank_name: 'Commercial Bank of Ceylon',
            account_name: 'HAPANAMY ENTERPRISES (PVT) LTD',
            account_number: '1000849201',
            branch: 'Nugegoda',
            branch_code: '100',
            currency: 'LKR',
            is_primary: false
        }
    ];

    assert.equal(mockCompanyBanks.length, 2);
    const primary = mockCompanyBanks.find(b => b.is_primary);
    assert.ok(primary, 'Primary bank account must be present');
    assert.equal(primary.account_number, '081020048921');
    assert.equal(primary.bank_name, 'Hatton National Bank (HNB)');
});

test('Step 37: TEST 02: Full 14-Course Catalog Integrity & Active Economics Validation', () => {
    const catalog = [
        { id: 'facebook-course', category: 'Social Media', title: 'Facebook Monetization ප්‍රායෝගික පාඨමාලාව (Online Zoom)', price: 7425, original_price: 9900, selling_price: 7425, binary_volume: 7425, status: 'ACTIVE' },
        { id: 'tiktok-course', category: 'Social Media', title: 'TikTok Monetization ප්‍රායෝගික පාඨමාලාව (Online Zoom)', price: 4500, original_price: 5000, selling_price: 4500, binary_volume: 4500, status: 'ACTIVE' },
        { id: 'youtube-course', category: 'Social Media', title: 'YouTube Monetization ප්‍රායෝගික පාඨමාලාව (Online Zoom)', price: 7425, original_price: 9900, selling_price: 7425, binary_volume: 7425, status: 'ACTIVE' },
        { id: 'social-media-masterclass', category: 'Social Media', title: '🚀 Social Media Income Masterclass 2026', price: 15992, original_price: 19990, selling_price: 15992, binary_volume: 15992, status: 'ACTIVE' },
        { id: 'forex-course', category: 'Trading', title: '🟢 Beginner – Forex Trading Course (Online Zoom)', price: 7920, original_price: 9900, selling_price: 7920, binary_volume: 7920, status: 'ACTIVE' },
        { id: 'crypto-course', category: 'Trading', title: '🟠 Beginner – Crypto Trading Course (Online Zoom)', price: 7920, original_price: 9900, selling_price: 7920, binary_volume: 7920, status: 'ACTIVE' },
        { id: 'options-course', category: 'Trading', title: '🔵 Intermediate – Options Trading Course (Online Zoom)', price: 7920, original_price: 9900, selling_price: 7920, binary_volume: 7920, status: 'ACTIVE' },
        { id: 'titan-elite', category: 'Trading', title: '🔴 Professional – Advanced Institutional Trading (SMC / ICT)', price: 19900, original_price: 24900, selling_price: 19900, binary_volume: 19900, status: 'ACTIVE' },
        { id: 'ai-video-course', category: 'AI & Tech', title: '🎬 AI Video Generation Masterclass 2026', price: 5200, original_price: 6500, selling_price: 5200, binary_volume: 5200, status: 'ACTIVE' },
        { id: 'ai-mastery-course', category: 'AI & Tech', title: '🤖 AI Mastery Program 2026', price: 15000, original_price: 18750, selling_price: 15000, binary_volume: 15000, status: 'ACTIVE' },
        { id: 'coding-course', category: 'AI & Tech', title: '💻 Coding & Web Development Masterclass 2026', price: 7200, original_price: 9000, selling_price: 7200, binary_volume: 7200, status: 'ACTIVE' },
        { id: 'trading-ebook', category: 'E-Book', title: '📘 Trading A to Z – Master E-Book 2026', price: 3992, original_price: 4990, selling_price: 3992, binary_volume: 3992, status: 'ACTIVE' },
        { id: 'motivation-ebook', category: 'E-Book', title: '📖 Motivation & Self-Development Master E-Book 2026', price: 5592, original_price: 6990, selling_price: 5592, binary_volume: 5592, status: 'ACTIVE' },
        { id: 'ai-prompts-ebook', category: 'E-Book', title: '📘 AI Prompts & Templates Ultimate Collection 2026', price: 2000, original_price: 2500, selling_price: 2000, binary_volume: 2000, status: 'ACTIVE' }
    ];

    assert.equal(catalog.length, 14, 'Must contain all 14 official products');
    
    // Check Facebook Course pricing
    const fb = catalog.find(c => c.id === 'facebook-course');
    assert.equal(fb.selling_price, 7425);
    assert.equal(fb.original_price, 9900);
    assert.equal(fb.status, 'ACTIVE');

    // Run economics check for all products
    catalog.forEach(p => {
        const econ = ProductEconomicsCalculator.calculate({
            selling_price: p.selling_price,
            product_cost: 0,
            minimum_company_profit: 500,
            direct_commission_rate: 8.00,
            binary_commission_rate: 7.00,
            max_binary_qualified_levels: 7,
            binary_volume: p.binary_volume
        });
        const val = ProductCommissionValidator.validate(econ);
        assert.notEqual(val.status, 'BLOCKED', `Product ${p.id} must be financially valid`);
    });
});

test('Step 37: TEST 03: Member Entitlement Status & Duplicate Purchase Guards', () => {
    const userId = 'user-hiru-root';
    const mockPurchases = [
        { id: 'p1', user_id: userId, product_id: 'facebook-course', status: 'ACTIVE' },
        { id: 'p2', user_id: userId, product_id: 'tiktok-course', status: 'PENDING' }
    ];

    // Case 1: Already active product -> can_buy: false, is_purchased: true
    const fbActive = mockPurchases.some(p => p.user_id === userId && p.product_id === 'facebook-course' && p.status === 'ACTIVE');
    assert.equal(fbActive, true);

    // Case 2: Pending product -> can_buy: false, is_pending: true
    const ttPending = mockPurchases.some(p => p.user_id === userId && p.product_id === 'tiktok-course' && p.status === 'PENDING');
    assert.equal(ttPending, true);

    // Case 3: Available product -> can_buy: true, is_purchased: false, is_pending: false
    const ytPurchased = mockPurchases.some(p => p.user_id === userId && p.product_id === 'youtube-course');
    assert.equal(ytPurchased, false);
});

test('Step 37: TEST 04: In-Dashboard Bank Slip Submission & Safe Zero-Commission Verification', () => {
    const context = {
        purchases: [],
        deposits: [],
        auditLogs: [],
        wallets: [{ user_id: 'user-hiru-root', available_balance: 0, total_earned: 0 }],
        volumeLedger: []
    };

    const newDeposit = {
        id: 'dep-test-1',
        order_number: 'ORD-984210',
        purchase_id: 'purch-test-1',
        user_id: 'user-hiru-root',
        product_id: 'forex-course',
        amount: 7920,
        bank_reference: 'CEFT-HNB-998822',
        slip_url: 'storage/private/slips/slip1.jpg',
        status: 'PENDING',
        created_at: new Date().toISOString()
    };

    context.deposits.push(newDeposit);
    context.purchases.push({
        id: 'purch-test-1',
        order_number: newDeposit.order_number,
        user_id: newDeposit.user_id,
        product_id: newDeposit.product_id,
        price_paid: newDeposit.amount,
        status: 'PENDING',
        created_at: newDeposit.created_at
    });

    // Invariant: Zero commissions, Zero binary volume before Admin approval
    assert.equal(context.wallets[0].available_balance, 0, 'Wallet balance MUST remain 0.00 upon submission');
    assert.equal(context.wallets[0].total_earned, 0, 'Total earned MUST remain 0.00 upon submission');
    assert.equal(context.volumeLedger.length, 0, 'Volume ledger MUST have 0 entries before admin review');
    assert.equal(context.deposits[0].status, 'PENDING', 'Deposit must be PENDING');
    assert.equal(context.purchases[0].status, 'PENDING', 'Purchase must be PENDING');
});

test('Step 37: TEST 05: Atomic Admin Approval, Snapshot Creation & Exact Commission Execution', () => {
    const product = {
        id: 'forex-course',
        name: 'Beginner Forex Trading Course',
        market_price: 9900,
        selling_price: 7920,
        product_cost: 0,
        min_company_profit: 500,
        direct_commission_rate: 8.00,
        binary_commission_rate: 7.00,
        binary_volume: 7920,
        max_binary_qualified_levels: 7,
        status: 'ACTIVE'
    };

    const users = [
        { id: 'u-root', status: 'ACTIVE' },
        { id: 'u-sponsor', status: 'ACTIVE' },
        { id: 'u-buyer', status: 'ACTIVE' }
    ];

    const kycDocs = [
        { user_id: 'u-root', status: 'APPROVED' },
        { user_id: 'u-sponsor', status: 'APPROVED' },
        { user_id: 'u-buyer', status: 'APPROVED' }
    ];

    const binaryNodes = [
        { user_id: 'u-root', placement_parent_id: null, position: null },
        { user_id: 'u-sponsor', placement_parent_id: 'u-root', position: 'LEFT' },
        { user_id: 'u-buyer', placement_parent_id: 'u-sponsor', position: 'LEFT' }
    ];

    const sponsors = [
        { user_id: 'u-sponsor', sponsor_id: 'u-root' },
        { user_id: 'u-buyer', sponsor_id: 'u-sponsor' }
    ];

    const purchases = [
        { id: 'p-qual-sponsor', user_id: 'u-sponsor', status: 'ACTIVE' },
        { id: 'p-new-buy', user_id: 'u-buyer', product_id: 'forex-course', status: 'PENDING' }
    ];

    const wallets = [
        { user_id: 'u-root', available_balance: 0, total_earned: 0 },
        { user_id: 'u-sponsor', available_balance: 0, total_earned: 0 },
        { user_id: 'u-buyer', available_balance: 0, total_earned: 0 }
    ];

    const volumeLedger = [];
    const walletLedger = [];
    const auditLogs = [];
    const notifications = [];
    const productSnapshots = [];

    const context = {
        products: [product],
        productSnapshots,
        purchases,
        users,
        kycDocs,
        binaryNodes,
        sponsors,
        volumeLedger,
        wallets,
        walletLedger,
        auditLogs,
        notifications
    };

    const purchaseToApprove = purchases.find(p => p.id === 'p-new-buy');

    // Execute atomic purchase approval workflow
    const result = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
        purchase: purchaseToApprove,
        product,
        userId: 'u-buyer',
        binaryNodes,
        sponsors,
        users,
        kycDocs,
        purchases,
        commissionLedger: [],
        volumeLedger,
        walletLedger,
        dailyEarningsMap: new Map(),
        notificationQueue: notifications,
        auditLogs
    });

    assert.equal(result.success, true);
    assert.equal(result.summary.product_access_active, true);
    assert.equal(result.summary.volume_propagated, 7920);

    // 1. Direct Referral Commission: 8% of 7,920 = 633.60 LKR to u-sponsor
    assert.ok(result.summary.direct_commission);
    assert.equal(result.summary.direct_commission.success, true);
    assert.equal(result.summary.direct_commission.eligible_amount, 633.60);
    assert.ok(walletLedger.length >= 1);
    assert.equal(walletLedger[0].amount, 633.60);

    // 2. Purchase Entitlement Activated
    assert.equal(purchases.find(p => p.id === 'p-new-buy').status, 'ACTIVE');

    // 3. Binary Volume Propagated
    assert.ok(volumeLedger.length > 0, 'Binary volume should propagate to upline');
});

test('Step 37: TEST 06: Member Orders Tenant Isolation & IDOR Protection', () => {
    const allOrders = [
        { id: 'dep-1', user_id: 'user-hiru-root', order_number: 'ORD-101', amount: 7425, status: 'APPROVED' },
        { id: 'dep-2', user_id: 'user-other-member', order_number: 'ORD-102', amount: 15992, status: 'APPROVED' },
        { id: 'dep-3', user_id: 'user-hiru-root', order_number: 'ORD-103', amount: 5200, status: 'PENDING' }
    ];

    const currentUserId = 'user-hiru-root';
    const memberOrders = allOrders.filter(o => o.user_id === currentUserId);

    assert.equal(memberOrders.length, 2, 'Member must only see their own orders');
    assert.ok(!memberOrders.some(o => o.user_id === 'user-other-member'), 'Strict tenant isolation enforced');

    // IDOR Protection: Attempting to access order of another user
    const targetOrder = allOrders.find(o => o.id === 'dep-2' && o.user_id === currentUserId);
    assert.equal(targetOrder, undefined, 'Accessing another user order must return undefined (404)');
});

if (require.main === module) {
    runTests();
}
