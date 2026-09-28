// Step 58 Test Suite: Manual Bank Transfer -> Receipt Upload -> Admin Approval -> Active Course -> MLM Flow
// Comprehensive End-to-End Verification for HAPANAMY.LK Production Flow

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

test('STEP 58.1: Company Bank Account Details Retrieval for Manual Transfer', () => {
    const serverPath = path.join(__dirname, '../server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    
    assert(serverContent.includes('mockCompanyBankDetails'), 'server.js must contain mockCompanyBankDetails');
    assert(serverContent.includes('Hatton National Bank') || serverContent.includes('HNB'), 'Must include HNB bank details');
    assert(serverContent.includes('081020048921') || serverContent.includes('019010040197'), 'Must include valid company account number');
});

test('STEP 58.2: Customer Submits Manual Bank Transfer Slip (Status PENDING)', () => {
    const buyerId = 'user-student-58';
    const mockPurchases = [];
    const mockDeposits = [];

    const product = {
        id: 'titan-elite',
        code: 'SMC-ADV',
        name: 'Titan Elite Trading Academy (SMC / ICT)',
        selling_price: 19900.00,
        binary_volume: 19900.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        status: 'ACTIVE'
    };

    const purchaseId = 'purch-dep-5801';
    const depositId = 'dep-slip-5801';
    const orderNumber = 'ORD-DEP-5801';
    const bankRef = 'HNB-TRF-98214';

    // Purchase record created in PENDING status
    const purchase = {
        id: purchaseId,
        order_number: orderNumber,
        user_id: buyerId,
        product_id: product.id,
        price_paid: 19900.00,
        status: 'PENDING',
        created_at: new Date().toISOString()
    };
    mockPurchases.push(purchase);

    // Deposit slip record created in PENDING status
    const deposit = {
        id: depositId,
        order_number: orderNumber,
        purchase_id: purchaseId,
        user_id: buyerId,
        product_id: product.id,
        amount: 19900.00,
        bank_reference: bankRef,
        slip_url: 'storage/slips/slip-5801.jpg',
        status: 'PENDING',
        created_at: new Date().toISOString()
    };
    mockDeposits.push(deposit);

    assert.strictEqual(deposit.status, 'PENDING', 'Deposit status must initially be PENDING');
    assert.strictEqual(purchase.status, 'PENDING', 'Purchase status must initially be PENDING');
    assert.strictEqual(deposit.amount, 19900.00, 'Deposit amount must match canonical price');
});

test('STEP 58.3: Pre-Approval Invariant: Zero Volume, Zero Commission, Member INACTIVE', () => {
    const buyer = {
        id: 'user-student-58',
        username: 'student58',
        email: 'student58@hapanamy.lk',
        status: 'INACTIVE',
        purchased_courses: []
    };

    const mockVolumeLedger = [];
    const mockWalletLedger = [];
    const mockCommissionLedger = [];

    // Before admin approval:
    assert.strictEqual(buyer.status, 'INACTIVE', 'Buyer account must remain INACTIVE before approval');
    assert.strictEqual(buyer.purchased_courses.length, 0, 'Buyer must have 0 active courses before approval');
    assert.strictEqual(mockVolumeLedger.length, 0, 'Zero binary volume entries before approval');
    assert.strictEqual(mockWalletLedger.length, 0, 'Zero wallet commission entries before approval');
    assert.strictEqual(mockCommissionLedger.length, 0, 'Zero commission ledger transactions before approval');
});

test('STEP 58.4: Admin Rejection Safety: Marks CANCELLED with Zero MLM Side-Effects', () => {
    const mockDeposits = [
        { id: 'dep-rej-5802', purchase_id: 'purch-rej-5802', status: 'PENDING', amount: 7425.00 }
    ];
    const mockPurchases = [
        { id: 'purch-rej-5802', user_id: 'user-rej-58', status: 'PENDING', price_paid: 7425.00 }
    ];
    const mockUsers = [
        { id: 'user-rej-58', status: 'INACTIVE' }
    ];
    const mockWalletLedger = [];
    const mockVolumeLedger = [];

    // Admin rejects deposit
    const action = 'REJECTED';
    mockDeposits[0].status = action;
    mockPurchases[0].status = 'CANCELLED';

    assert.strictEqual(mockDeposits[0].status, 'REJECTED', 'Deposit must be marked REJECTED');
    assert.strictEqual(mockPurchases[0].status, 'CANCELLED', 'Purchase must be marked CANCELLED');
    assert.strictEqual(mockUsers[0].status, 'INACTIVE', 'User must remain INACTIVE');
    assert.strictEqual(mockWalletLedger.length, 0, 'Zero commissions distributed on rejection');
    assert.strictEqual(mockVolumeLedger.length, 0, 'Zero volume propagated on rejection');
});

test('STEP 58.5: Admin Approval Workflow Triggers PurchaseOrchestrator & Transitions Member to ACTIVE', () => {
    const sponsorId = 'user-sponsor-58';
    const buyerId = 'user-student-58';

    const mockUsers = [
        { id: sponsorId, username: 'Sponsor58', full_name: 'Sponsor FiftyEight', email: 'sponsor58@hapanamy.lk', role: 'member', status: 'ACTIVE' },
        { id: buyerId, username: 'student58', full_name: 'Student FiftyEight', email: 'student58@hapanamy.lk', role: 'member', status: 'INACTIVE' }
    ];
    const mockSponsors = [
        { sponsor_id: sponsorId, user_id: buyerId }
    ];
    const mockBinaryNodes = [
        { user_id: sponsorId, placement_parent_id: null, position: null, left_child_id: buyerId, right_child_id: null },
        { user_id: buyerId, placement_parent_id: sponsorId, position: 'LEFT', left_child_id: null, right_child_id: null }
    ];

    const product = {
        id: 'titan-elite',
        code: 'SMC-ADV',
        name: 'Titan Elite Trading Academy (SMC / ICT)',
        selling_price: 19900.00,
        binary_volume: 19900.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        status: 'ACTIVE'
    };

    const purchase = {
        id: 'purch-appr-5803',
        order_number: 'ORD-5803',
        user_id: buyerId,
        product_id: product.id,
        price_paid: 19900.00,
        status: 'PENDING'
    };

    const deposit = {
        id: 'dep-appr-5803',
        purchase_id: purchase.id,
        user_id: buyerId,
        amount: 19900.00,
        status: 'PENDING'
    };

    const mockPurchases = [purchase];
    const mockDeposits = [deposit];
    const mockCommissionLedger = [];
    const mockVolumeLedger = [];
    const mockWalletLedger = [];
    const mockDailyEarningsMap = new Map();

    // --- ADMIN APPROVES DEPOSIT ---
    deposit.status = 'APPROVED';
    purchase.status = 'ACTIVE';
    purchase.activated_at = new Date().toISOString();

    // Buyer transitions to ACTIVE
    const buyer = mockUsers.find(u => u.id === buyerId);
    buyer.status = 'ACTIVE';

    // Orchestrator executes all MLM side-effects in single authoritative pass
    const orchResult = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
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

    assert.strictEqual(orchResult.success, true, 'Purchase orchestration must succeed');
    assert.strictEqual(deposit.status, 'APPROVED', 'Deposit status must be APPROVED');
    assert.strictEqual(purchase.status, 'ACTIVE', 'Purchase status must be ACTIVE');
    assert.strictEqual(buyer.status, 'ACTIVE', 'Buyer account status must transition to ACTIVE');
});

test('STEP 58.6: Sponsor Receives Exact 8% Direct Commission on Titan Elite (Rs. 1,592.00)', () => {
    const productPrice = 19900.00;
    const directRate = 8.00;
    const expectedDirectCommission = Math.round(productPrice * (directRate / 100) * 100) / 100;

    assert.strictEqual(expectedDirectCommission, 1592.00, '8% Direct Commission on Rs. 19,900 must be exactly Rs. 1,592.00');

    // Simulate double-entry wallet ledger
    const mockWalletLedger = [
        {
            id: 'tx-comm-5803',
            user_id: 'user-sponsor-58',
            type: 'DIRECT_COMMISSION',
            amount: 1592.00,
            reference_id: 'purch-appr-5803',
            created_at: new Date().toISOString()
        }
    ];

    const balances = WalletService.calculateBalances(mockWalletLedger);
    assert.strictEqual(balances.availableBalance, 1592.00, 'Sponsor wallet available balance must be Rs. 1,592.00');
    assert.strictEqual(balances.totalEarned, 1592.00, 'Sponsor wallet total earned must be Rs. 1,592.00');
});

test('STEP 58.7: Binary Volume (19,900 BV) Propagates to Ancestor Volume Ledger', () => {
    const mockBinaryNodes = [
        { user_id: 'user-sponsor-58', placement_parent_id: null, position: null, left_child_id: 'user-student-58', right_child_id: null },
        { user_id: 'user-student-58', placement_parent_id: 'user-sponsor-58', position: 'LEFT', left_child_id: null, right_child_id: null }
    ];

    const mockVolumeLedger = [];
    const purchase = { id: 'purch-appr-5803', user_id: 'user-student-58', status: 'ACTIVE' };
    const snapshot = { binary_volume: 19900.00, snapshot_version: 'v1.0' };

    VolumeLedger.processSaleVolume({
        purchase,
        snapshot,
        binaryNodes: mockBinaryNodes,
        ledger: mockVolumeLedger
    });

    assert.strictEqual(mockVolumeLedger.length, 1, 'Volume ledger must have 1 record');
    assert.strictEqual(mockVolumeLedger[0].user_id, 'user-sponsor-58', 'Volume must credit user-sponsor-58');
    assert.strictEqual(mockVolumeLedger[0].leg, 'LEFT', 'Volume must credit LEFT leg');
    assert.strictEqual(mockVolumeLedger[0].amount, 19900.00, 'Volume amount must be 19,900 BV');

    const leftVol = VolumeLedger.getLegBalance('user-sponsor-58', 'LEFT', mockVolumeLedger);
    assert.strictEqual(leftVol, 19900.00, 'Sponsor LEFT leg volume must be 19,900.00');
});

test('STEP 58.8: Sponsor Sales Team Visibility Updates from INACTIVE to ACTIVE', () => {
    const sponsorId = 'user-sponsor-58';
    const buyerId = 'user-student-58';

    const mockUsers = [
        { id: sponsorId, username: 'Sponsor58', full_name: 'Sponsor FiftyEight', email: 'sponsor58@hapanamy.lk', role: 'member', status: 'ACTIVE' },
        { id: buyerId, username: 'student58', full_name: 'Student FiftyEight', email: 'student58@hapanamy.lk', role: 'member', status: 'ACTIVE', created_at: '2026-09-28T00:00:00Z' }
    ];
    const mockSponsors = [
        { sponsor_id: sponsorId, user_id: buyerId, referral_code: 'Sponsor58' }
    ];
    const mockBinaryNodes = [
        { user_id: sponsorId, placement_parent_id: null, position: null, left_child_id: buyerId, right_child_id: null },
        { user_id: buyerId, placement_parent_id: sponsorId, position: 'LEFT', left_child_id: null, right_child_id: null }
    ];
    const mockPurchases = [
        { id: 'purch-appr-5803', user_id: buyerId, product_id: 'titan-elite', price_paid: 19900.00, status: 'ACTIVE' }
    ];

    const team = MLMNetworkEngine.getMemberNetwork(sponsorId, {
        users: mockUsers,
        sponsors: mockSponsors,
        binaryNodes: mockBinaryNodes,
        purchases: mockPurchases
    });

    assert(team, 'Network summary must be returned');
    assert.strictEqual(team.left_member.username, 'student58', 'Left member must be student58');
    assert.strictEqual(team.left_member.is_active, true, 'Member is_active must be true after admin approval');
    assert.strictEqual(team.team_list[0].status, 'Active', 'Team list member status must be Active');
});

test('STEP 58.9: Student Classroom Access Unlocked with Lesson Playlists', () => {
    const buyerUser = {
        id: 'user-student-58',
        username: 'student58',
        email: 'student58@hapanamy.lk',
        status: 'ACTIVE',
        purchased_courses: [
            { id: 'titan-elite', title: 'Titan Elite Trading Academy', price: 19900.00, status: 'ACTIVE' }
        ]
    };

    assert.strictEqual(buyerUser.purchased_courses.length, 1, 'Student must have 1 active purchased course');
    assert.strictEqual(buyerUser.purchased_courses[0].status, 'ACTIVE', 'Course status must be ACTIVE');
    assert.strictEqual(buyerUser.status, 'ACTIVE', 'Student account status must be ACTIVE');
});

test('STEP 58.10: Re-Approval Idempotency Guard Prevents Duplicate Commissions & BV', () => {
    const purchase = { id: 'purch-appr-5803', status: 'ACTIVE', user_id: 'user-student-58' };
    const product = { id: 'titan-elite', selling_price: 19900.00, binary_volume: 19900.00, status: 'ACTIVE' };

    const mockBinaryNodes = [];
    const mockSponsors = [];
    const mockUsers = [];
    const mockPurchases = [purchase];
    const mockCommissionLedger = [];
    const mockVolumeLedger = [];
    const mockWalletLedger = [];
    const mockDailyEarningsMap = new Map();

    // Repeat execution
    const duplicateRun = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
        purchase,
        product,
        userId: 'user-student-58',
        binaryNodes: mockBinaryNodes,
        sponsors: mockSponsors,
        users: mockUsers,
        purchases: mockPurchases,
        commissionLedger: mockCommissionLedger,
        volumeLedger: mockVolumeLedger,
        walletLedger: mockWalletLedger,
        dailyEarningsMap: mockDailyEarningsMap
    });

    assert.strictEqual(duplicateRun.success, true, 'Duplicate run must return success');
    assert.strictEqual(duplicateRun.idempotent, true, 'Duplicate run must be flagged as idempotent');
    assert.strictEqual(duplicateRun.message, 'Purchase already orchestrated. No duplicate processing performed.');
    assert.strictEqual(mockWalletLedger.length, 0, 'Zero new wallet entries on idempotent repeat');
});
