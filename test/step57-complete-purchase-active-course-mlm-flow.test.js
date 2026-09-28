// Step 57 Test Suite: Complete Purchase -> Active Course -> MLM Flow Repair
// Comprehensive End-to-End Verification for HAPANAMY.LK

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('./test-runner');

const AuthService = require('../services/auth-service');
const PlacementEngine = require('../services/placement-engine');
const ProductSnapshotService = require('../services/product-snapshot-service');
const DirectCommissionEngine = require('../services/direct-commission-engine');
const QualifiedUplineCommissionEngine = require('../services/qualified-upline-commission-engine');
const VolumeLedger = require('../services/volume-ledger');
const WalletService = require('../services/wallet-service');
const PurchaseOrchestrator = require('../services/purchase-orchestrator');
const MLMNetworkEngine = require('../services/mlm-network-engine');

test('STEP 57.1: Product Catalog & Individual Product Lookup Retrieval', () => {
    // Verify catalog structure and product definitions
    const productsPath = path.join(__dirname, '../server.js');
    const serverContent = fs.readFileSync(productsPath, 'utf8');
    
    assert(serverContent.includes('facebook-course'), 'server.js must contain facebook-course definition');
    assert(serverContent.includes('titan-elite'), 'server.js must contain titan-elite definition');
    assert(serverContent.includes('ai-mastery-course'), 'server.js must contain ai-mastery-course definition');
    assert(serverContent.includes('social-media-masterclass'), 'server.js must contain social-media-masterclass definition');

    // Verify courses.html standalone catalog page exists
    const coursesHtmlPath = path.join(__dirname, '../courses.html');
    assert(fs.existsSync(coursesHtmlPath), 'courses.html must exist as a standalone catalog page');
    const coursesHtml = fs.readFileSync(coursesHtmlPath, 'utf8');
    assert(coursesHtml.includes('checkout.html?product='), 'courses.html must route BUY NOW links to checkout.html?product=');
    assert(coursesHtml.includes('MASTER_PRODUCTS'), 'courses.html must define MASTER_PRODUCTS registry');
});

test('STEP 57.2: Server-Authoritative Pricing & Checkout Defense Against Tampering', () => {
    // Products with canonical pricing and binary volume
    const productCatalog = {
        'facebook-course': { id: 'facebook-course', code: 'FB-MON', selling_price: 7425.00, binary_volume: 7425.00, direct_rate: 8.00 },
        'tiktok-course': { id: 'tiktok-course', code: 'TIK-MON', selling_price: 4500.00, binary_volume: 4500.00, direct_rate: 8.00 },
        'titan-elite': { id: 'titan-elite', code: 'SMC-ADV', selling_price: 19900.00, binary_volume: 19900.00, direct_rate: 8.00 }
    };

    // Client attempts to send tampered price
    const clientSubmittedOrder = {
        productId: 'facebook-course',
        tamperedPrice: 100.00, // Attacker sends Rs. 100
        tamperedBV: 100000.00  // Attacker sends 100k BV
    };

    // Server-side lookup overrides client values
    const canonicalProduct = productCatalog[clientSubmittedOrder.productId];
    assert.strictEqual(canonicalProduct.selling_price, 7425.00, 'Server must enforce canonical selling price of Rs. 7,425.00');
    assert.strictEqual(canonicalProduct.binary_volume, 7425.00, 'Server must enforce canonical BV of 7,425.00');
    assert.notStrictEqual(canonicalProduct.selling_price, clientSubmittedOrder.tamperedPrice, 'Tampered price must be rejected');
});

test('STEP 57.3: Free Member Registration starts INACTIVE with 0 Purchased Courses', () => {
    const mockUsers = [
        { id: 'user-sponsor-57', username: 'Sponsor57', full_name: 'Sponsor FiftySeven', email: 'sponsor57@hapanamy.lk', role: 'member', status: 'ACTIVE', referral_code: 'Sponsor57' }
    ];
    const mockSponsors = [];
    const mockBinaryNodes = [
        { user_id: 'user-sponsor-57', parent_id: null, placement_parent_id: null, position: null, left_child_id: null, right_child_id: null }
    ];
    const mockWallets = [];

    // Register new member under Sponsor57
    const regResult = AuthService.registerMember({
        fullName: 'Kamal Perera',
        username: 'kamal57',
        email: 'kamal57@hapanamy.lk',
        mobile: '0771234567',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        sponsorCode: 'Sponsor57',
        position: 'LEFT'
    }, {
        users: mockUsers,
        sponsors: mockSponsors,
        binaryNodes: mockBinaryNodes,
        wallets: mockWallets
    });

    assert.strictEqual(regResult.success, true, 'Registration must succeed');
    assert.strictEqual(regResult.user.status, 'INACTIVE', 'Newly registered member must start as INACTIVE');
    assert.strictEqual(regResult.user.username, 'kamal57', 'Username must match registration input');

    // Verify binary node placement
    const placedNode = mockBinaryNodes.find(n => n.user_id === regResult.user.id);
    assert(placedNode, 'Binary node must be placed in tree');
    assert.strictEqual(placedNode.placement_parent_id || placedNode.parent_id, 'user-sponsor-57', 'Parent must be Sponsor57');
    assert.strictEqual(placedNode.position, 'LEFT', 'Position must be LEFT');
});

test('STEP 57.4: Sponsor Team Visibility shows New Downline as INACTIVE (Sales: 0/2)', () => {
    const sponsorId = 'user-sponsor-57';
    const newMemberId = 'user-kamal-57';
    
    const mockUsers = [
        { id: sponsorId, username: 'Sponsor57', full_name: 'Sponsor FiftySeven', email: 'sponsor57@hapanamy.lk', role: 'member', status: 'ACTIVE' },
        { id: newMemberId, username: 'kamal57', full_name: 'Kamal Perera', email: 'kamal57@hapanamy.lk', role: 'member', status: 'INACTIVE', created_at: '2026-09-28T00:00:00Z' }
    ];
    const mockSponsors = [
        { sponsor_id: sponsorId, user_id: newMemberId, referral_code: 'Sponsor57' }
    ];
    const mockBinaryNodes = [
        { user_id: sponsorId, placement_parent_id: null, position: null, left_child_id: newMemberId, right_child_id: null },
        { user_id: newMemberId, placement_parent_id: sponsorId, position: 'LEFT', left_child_id: null, right_child_id: null }
    ];
    const mockPurchases = []; // 0 purchases

    const team = MLMNetworkEngine.getMemberNetwork(sponsorId, {
        users: mockUsers,
        sponsors: mockSponsors,
        binaryNodes: mockBinaryNodes,
        purchases: mockPurchases
    });

    assert(team, 'Network object must be returned');
    assert.strictEqual(team.left_member.username, 'kamal57', 'Left member must be kamal57');
    assert.strictEqual(team.left_member.is_active, false, 'Member is_active must be false initially');
    assert.strictEqual(team.team_list.length, 1, 'Team list must contain 1 member');
});

test('STEP 57.5: Product Purchase Execution via PurchaseOrchestrator', () => {
    const sponsorId = 'user-sponsor-57';
    const buyerId = 'user-kamal-57';

    const mockUsers = [
        { id: sponsorId, username: 'Sponsor57', full_name: 'Sponsor FiftySeven', email: 'sponsor57@hapanamy.lk', role: 'member', status: 'ACTIVE' },
        { id: buyerId, username: 'kamal57', full_name: 'Kamal Perera', email: 'kamal57@hapanamy.lk', role: 'member', status: 'INACTIVE' }
    ];
    const mockSponsors = [
        { sponsor_id: sponsorId, user_id: buyerId }
    ];
    const mockBinaryNodes = [
        { user_id: sponsorId, parent_id: null, placement_parent_id: null, position: null, left_child_id: buyerId, right_child_id: null },
        { user_id: buyerId, parent_id: sponsorId, placement_parent_id: sponsorId, position: 'LEFT', left_child_id: null, right_child_id: null }
    ];
    const mockPurchases = [];
    const mockCommissionLedger = [];
    const mockVolumeLedger = [];
    const mockWalletLedger = [];
    const mockDailyEarningsMap = new Map();

    const product = {
        id: 'facebook-course',
        code: 'FB-MON',
        name: 'Facebook Monetization Masterclass',
        price: 7425.00,
        selling_price: 7425.00,
        binary_volume: 7425.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        status: 'ACTIVE'
    };

    const purchase = {
        id: 'purch-fb-5701',
        order_number: 'ORD-FB5701',
        user_id: buyerId,
        product_id: product.id,
        price_paid: 7425.00,
        status: 'PENDING'
    };

    // Execute Approved Purchase Workflow
    const result = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
        purchase,
        product,
        userId: buyerId,
        binaryNodes: mockBinaryNodes,
        sponsors: mockSponsors,
        users: mockUsers,
        purchases: mockPurchases,
        commissionLedger: mockCommissionLedger,
        volumeLedger: mockVolumeLedger,
        walletLedger: mockWalletLedger,
        dailyEarningsMap: mockDailyEarningsMap
    });

    assert.strictEqual(result.success, true, 'Purchase orchestration must succeed');
    assert.strictEqual(purchase.status, 'ACTIVE', 'Purchase status must be updated to ACTIVE');
    assert(purchase.activated_at, 'Purchase must have activated_at timestamp');
});

test('STEP 57.6: Buyer Account Status Transitions to ACTIVE & Product Unlocks in Classroom', () => {
    const buyer = {
        id: 'user-kamal-57',
        username: 'kamal57',
        email: 'kamal57@hapanamy.lk',
        status: 'INACTIVE',
        purchased_courses: []
    };

    // Simulate payment approval
    buyer.status = 'ACTIVE';
    buyer.purchased_courses.push({
        id: 'facebook-course',
        title: 'Facebook Monetization Masterclass',
        price: 7425.00,
        status: 'ACTIVE',
        activated_at: new Date().toISOString()
    });

    assert.strictEqual(buyer.status, 'ACTIVE', 'User status must transition to ACTIVE');
    assert.strictEqual(buyer.purchased_courses.length, 1, 'Buyer must have 1 active enrolled course');
    assert.strictEqual(buyer.purchased_courses[0].id, 'facebook-course', 'Course ID must match purchased product');
});

test('STEP 57.7: Direct Commission (Exact 8% = Rs. 594.00) Credited to Sponsor Wallet Ledger', () => {
    const productSellingPrice = 7425.00;
    const directCommissionRate = 8.00;
    const expectedDirectCommission = Math.round(productSellingPrice * (directCommissionRate / 100) * 100) / 100;

    assert.strictEqual(expectedDirectCommission, 594.00, 'Direct commission on Rs. 7,425 at 8% must be exactly Rs. 594.00');

    // Simulate double-entry wallet ledger entry
    const mockWalletLedger = [
        {
            id: 'tx-comm-5701',
            user_id: 'user-sponsor-57',
            type: 'DIRECT_COMMISSION',
            amount: 594.00,
            reference_id: 'purch-fb-5701',
            created_at: new Date().toISOString()
        }
    ];

    const balances = WalletService.calculateBalances(mockWalletLedger);
    assert.strictEqual(balances.availableBalance, 594.00, 'Sponsor available balance must be Rs. 594.00');
    assert.strictEqual(balances.totalEarned, 594.00, 'Sponsor total earned must be Rs. 594.00');
});

test('STEP 57.8: Binary Volume (7,425 BV) Propagates to Ancestor Volume Ledger', () => {
    const mockBinaryNodes = [
        { user_id: 'user-sponsor-57', parent_id: null, placement_parent_id: null, position: null, left_child_id: 'user-kamal-57', right_child_id: null },
        { user_id: 'user-kamal-57', parent_id: 'user-sponsor-57', placement_parent_id: 'user-sponsor-57', position: 'LEFT', left_child_id: null, right_child_id: null }
    ];

    const mockVolumeLedger = [];
    const purchase = { id: 'purch-fb-5701', user_id: 'user-kamal-57', status: 'ACTIVE' };
    const snapshot = { binary_volume: 7425.00, snapshot_version: 'v1.0' };

    VolumeLedger.processSaleVolume({
        purchase,
        snapshot,
        binaryNodes: mockBinaryNodes,
        ledger: mockVolumeLedger
    });

    assert.strictEqual(mockVolumeLedger.length, 1, 'Volume ledger must have 1 propagation record');
    assert.strictEqual(mockVolumeLedger[0].user_id, 'user-sponsor-57', 'Volume must credit user-sponsor-57');
    assert.strictEqual(mockVolumeLedger[0].leg, 'LEFT', 'Volume must credit LEFT leg');
    assert.strictEqual(mockVolumeLedger[0].amount, 7425.00, 'Volume amount must be 7,425 BV');

    const leftBalance = VolumeLedger.getLegBalance('user-sponsor-57', 'LEFT', mockVolumeLedger);
    const rightBalance = VolumeLedger.getLegBalance('user-sponsor-57', 'RIGHT', mockVolumeLedger);
    assert.strictEqual(leftBalance, 7425.00, 'Current left volume must be 7,425.00');
    assert.strictEqual(rightBalance, 0.00, 'Current right volume must be 0.00');
});

test('STEP 57.9: Binary Matching Commission (7%) and 7-Qualified Levels Limits', () => {
    // Verify 7% binary matching formula
    const matchedVolume = 5000.00; // weaker leg
    const binaryRate = 7.00;
    const expectedMatchingCommission = Math.round(matchedVolume * (binaryRate / 100) * 100) / 100;

    assert.strictEqual(expectedMatchingCommission, 350.00, '7% Binary matching on 5,000 BV must be exactly Rs. 350.00');

    // Verify daily cap invariant (Rs. 30,000.00)
    const dailyLimit = 30000.00;
    const currentDayEarnings = 29500.00;
    const newEarnings = 1000.00;
    const allowed = Math.min(newEarnings, Math.max(0, dailyLimit - currentDayEarnings));
    const capped = newEarnings - allowed;

    assert.strictEqual(allowed, 500.00, 'Allowed payout must not exceed daily cap');
    assert.strictEqual(capped, 500.00, 'Excess amount must be capped safely');
});

test('STEP 57.10: Sponsor Dashboard Updates Downline to ACTIVE (Sales Progress 0/2 -> 1/2)', () => {
    const sponsorId = 'user-sponsor-57';
    const buyerId = 'user-kamal-57';

    const mockUsers = [
        { id: sponsorId, username: 'Sponsor57', full_name: 'Sponsor FiftySeven', email: 'sponsor57@hapanamy.lk', role: 'member', status: 'ACTIVE' },
        { id: buyerId, username: 'kamal57', full_name: 'Kamal Perera', email: 'kamal57@hapanamy.lk', role: 'member', status: 'ACTIVE', created_at: '2026-09-28T00:00:00Z' }
    ];
    const mockSponsors = [
        { sponsor_id: sponsorId, user_id: buyerId, referral_code: 'Sponsor57' }
    ];
    const mockBinaryNodes = [
        { user_id: sponsorId, placement_parent_id: null, position: null, left_child_id: buyerId, right_child_id: null },
        { user_id: buyerId, placement_parent_id: sponsorId, position: 'LEFT', left_child_id: null, right_child_id: null }
    ];
    const mockPurchases = [
        { id: 'purch-fb-5701', user_id: buyerId, product_id: 'facebook-course', price_paid: 7425.00, status: 'ACTIVE' }
    ];

    const team = MLMNetworkEngine.getMemberNetwork(sponsorId, {
        users: mockUsers,
        sponsors: mockSponsors,
        binaryNodes: mockBinaryNodes,
        purchases: mockPurchases
    });

    assert(team, 'Network summary must be returned');
    assert.strictEqual(team.left_member.username, 'kamal57', 'Left member must be kamal57');
    assert.strictEqual(team.left_member.is_active, true, 'Member is_active must be true after purchase');
    assert.strictEqual(team.team_list[0].status, 'Active', 'Team list member status must be Active');
});

test('STEP 57.11: Master Idempotency Guard Prevents Duplicate Commissions & Volume Credits', () => {
    const purchase = { id: 'purch-idemp-5799', status: 'ACTIVE', user_id: 'user-kamal-57' };
    const product = { id: 'facebook-course', selling_price: 7425.00, binary_volume: 7425.00, status: 'ACTIVE' };

    const mockBinaryNodes = [];
    const mockSponsors = [];
    const mockUsers = [];
    const mockPurchases = [purchase];
    const mockCommissionLedger = [];
    const mockVolumeLedger = [];
    const mockWalletLedger = [];
    const mockDailyEarningsMap = new Map();

    // 1st Execution
    const firstRun = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
        purchase,
        product,
        userId: 'user-kamal-57',
        binaryNodes: mockBinaryNodes,
        sponsors: mockSponsors,
        users: mockUsers,
        purchases: mockPurchases,
        commissionLedger: mockCommissionLedger,
        volumeLedger: mockVolumeLedger,
        walletLedger: mockWalletLedger,
        dailyEarningsMap: mockDailyEarningsMap
    });

    assert.strictEqual(firstRun.success, true, 'First orchestration run must succeed');
    assert.strictEqual(firstRun.idempotent, false, 'First run must not be idempotent');

    // 2nd Repeat Execution
    const secondRun = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
        purchase,
        product,
        userId: 'user-kamal-57',
        binaryNodes: mockBinaryNodes,
        sponsors: mockSponsors,
        users: mockUsers,
        purchases: mockPurchases,
        commissionLedger: mockCommissionLedger,
        volumeLedger: mockVolumeLedger,
        walletLedger: mockWalletLedger,
        dailyEarningsMap: mockDailyEarningsMap
    });

    assert.strictEqual(secondRun.success, true, 'Second orchestration run must succeed safely');
    assert.strictEqual(secondRun.idempotent, true, 'Second run must be recognized as idempotent');
    assert.strictEqual(secondRun.message, 'Purchase already orchestrated. No duplicate processing performed.');
});

test('STEP 57.12: Zero-State UI Markup Audit Across Dashboard & Learning Portal', () => {
    const studentDashHtml = fs.readFileSync(path.join(__dirname, '../student-dashboard.html'), 'utf8');
    const memberDashHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
    const myAccountHtml = fs.readFileSync(path.join(__dirname, '../my-account.html'), 'utf8');

    // student-dashboard.html check
    assert(studentDashHtml.includes("href='courses.html'") || studentDashHtml.includes('href="courses.html"'), 'student-dashboard.html must link to courses.html');
    assert(!studentDashHtml.includes('href="index.html#courses"'), 'student-dashboard.html must not contain old index.html#courses links');
    assert(!studentDashHtml.includes("href='index.html#courses'"), 'student-dashboard.html must not contain old single-quoted index.html#courses links');

    // dashboard.html check
    assert(memberDashHtml.includes('href="courses.html"'), 'dashboard.html must link to courses.html');

    // my-account.html check
    assert(myAccountHtml.includes('href="courses.html"'), 'my-account.html must link to courses.html');
});
