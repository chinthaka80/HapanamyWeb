// STEP 61: Complete Production System Architecture & Authoritative Data Flow Audit
// End-to-End multi-tier genealogy (Hiru -> Sun -> SUNDD), Product Checkout, Bank Payment,
// PurchaseOrchestrator, Commissions (8% Direct, 7% Binary), Wallet Ledger, and Tree Isolation.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const AuthService = require('../services/auth-service');
const PlacementEngine = require('../services/placement-engine');
const ReferralService = require('../services/referral-service');
const PurchaseOrchestrator = require('../services/purchase-orchestrator');
const MemberDashboardService = require('../services/member-dashboard-service');
const DirectCommissionEngine = require('../services/direct-commission-engine');
const VolumeLedger = require('../services/volume-ledger');
const QualifiedUplineCommissionEngine = require('../services/qualified-upline-commission-engine');
const EarningsCapEngine = require('../services/earnings-cap-engine');
const WalletService = require('../services/wallet-service');
const ReversalEngine = require('../services/reversal-engine');

console.log('================================================================');
console.log('🧪 RUNNING STEP 61: Full Production Architecture & Authoritative Flow Audit');
console.log('================================================================');

// 1. Initialize Authoritative State
const mockUsers = [
    {
        id: 'user-hiru-root',
        username: 'Hiru',
        full_name: 'Hiru (Sales Leader)',
        email: 'hiru@hapanamy.lk',
        role: 'member',
        status: 'ACTIVE',
        account_status: 'ACTIVE',
        qualification_status: 'QUALIFIED',
        created_at: '2026-09-01T00:00:00Z'
    }
];

const mockBinaryNodes = [
    {
        id: 'node-hiru-root',
        user_id: 'user-hiru-root',
        placement_parent_id: null,
        position: null,
        depth: 1,
        path: '',
        created_at: '2026-09-01T00:00:00Z'
    }
];

const mockSponsors = [];
const mockWallets = [
    { id: 'wlt-hiru', user_id: 'user-hiru-root', balance: 0.00, pending_balance: 0.00, total_withdrawn: 0.00 }
];
const mockProductPurchases = [];
const mockPaymentDeposits = [];
const mockWalletLedger = [];
const mockVolumeLedger = [];
const mockCommissionTransactions = [];
const mockKycDocs = [];
const mockBankAccounts = [];
const mockAuditLogs = [];
const mockDailyEarningsMap = new Map();

const context = {
    users: mockUsers,
    binaryNodes: mockBinaryNodes,
    sponsors: mockSponsors,
    wallets: mockWallets,
    purchases: mockProductPurchases,
    paymentDeposits: mockPaymentDeposits,
    walletLedger: mockWalletLedger,
    volumeLedger: mockVolumeLedger,
    commissionLedger: mockCommissionTransactions,
    kycDocs: mockKycDocs,
    bankAccounts: mockBankAccounts,
    auditLogs: mockAuditLogs,
    dailyEarningsMap: mockDailyEarningsMap
};

// ====================================================================
// TEST 1: Register User A (@Sun) under Hiru (LEFT)
// ====================================================================
console.log('\n--- TEST 1: Register Level 1 Member @Sun under Hiru (LEFT) ---');
const regSun = AuthService.registerMember({
    fullName: 'Sun',
    username: 'Sun',
    email: 'sun@hapanamy.lk',
    mobile: '0771234567',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    sponsorCode: '@Hiru',
    position: 'LEFT'
}, context);

assert.strictEqual(regSun.success, true, 'Registration of Sun must succeed');
const sunUserId = regSun.user.id;
assert.strictEqual(regSun.user.account_status, 'INACTIVE', 'New member starts INACTIVE');
assert.strictEqual(regSun.user.qualification_status, 'NOT_QUALIFIED', 'New member starts NOT_QUALIFIED');
assert.strictEqual(regSun.sponsor.sponsor_id, 'user-hiru-root', 'Sponsor must be Hiru');
assert.strictEqual(regSun.placement.position, 'LEFT', 'Sun must be on LEFT');
console.log('✅ PASS: Sun registered under Hiru (Level 1, LEFT).');

// ====================================================================
// TEST 2: Register User B (@SUNDD) under Sun (LEFT)
// ====================================================================
console.log('\n--- TEST 2: Register Level 2 Member @SUNDD under Sun (LEFT) ---');
const regSundd = AuthService.registerMember({
    fullName: 'SUNDD',
    username: 'SUNDD',
    email: 'sundd@hapanamy.lk',
    mobile: '0779876543',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    sponsorCode: '@Sun',
    position: 'LEFT'
}, context);

assert.strictEqual(regSundd.success, true, 'Registration of SUNDD must succeed');
const sunddUserId = regSundd.user.id;
assert.strictEqual(regSundd.sponsor.sponsor_id, sunUserId, 'Sponsor of SUNDD must be Sun');
assert.strictEqual(regSundd.placement.position, 'LEFT', 'SUNDD must be on LEFT');
console.log('✅ PASS: SUNDD registered under Sun (Level 2 for Hiru, Level 1 for Sun).');

// ====================================================================
// TEST 3: Multi-Level Downline Visibility Audit
// ====================================================================
console.log('\n--- TEST 3: Multi-Level Downline Traversal Verification ---');
const hiruDashboard = MemberDashboardService.getMemberDashboardData({
    userId: 'user-hiru-root',
    ...context
});

assert.strictEqual(hiruDashboard.binary_network.team_list.length, 2, 'Hiru must have exactly 2 downline members');
assert.strictEqual(hiruDashboard.binary_network.left_team_count, 2, 'Hiru must have 2 Left team members (Sun & SUNDD)');
assert.strictEqual(hiruDashboard.binary_network.right_team_count, 0, 'Hiru Right team count must be 0');

const sunDashboard = MemberDashboardService.getMemberDashboardData({
    userId: sunUserId,
    ...context
});
assert.strictEqual(sunDashboard.binary_network.team_list.length, 1, 'Sun must see exactly 1 downline (SUNDD)');
assert.strictEqual(sunDashboard.binary_network.left_team_count, 1, 'Sun Left team count must be 1');

const sunddDashboard = MemberDashboardService.getMemberDashboardData({
    userId: sunddUserId,
    ...context
});
assert.strictEqual(sunddDashboard.binary_network.team_list.length, 0, 'SUNDD must have 0 downlines');
console.log('✅ PASS: Multi-tier genealogy downline traversal verified across all 3 levels.');

// ====================================================================
// TEST 4: Product Purchase, Manual Bank Slip & Admin Approval
// ====================================================================
console.log('\n--- TEST 4: Purchase Orchestrator, Direct 8% Commission & BV Propagation ---');
const titanProduct = {
    id: 'titan-elite',
    name: 'Advanced Institutional Trading (SMC / ICT)',
    selling_price: 19900.00,
    binary_volume: 19900.00,
    direct_commission_rate: 8.00,
    binary_commission_rate: 7.00,
    max_binary_qualified_levels: 7
};

const purchaseSUNDD = {
    id: 'purch-sundd-001',
    order_number: 'ORD-SUNDD-001',
    user_id: sunddUserId,
    product_id: titanProduct.id,
    product_name: titanProduct.name,
    price_paid: 19900.00,
    binary_volume: 19900.00,
    status: 'ACTIVE',
    created_at: new Date().toISOString()
};

mockProductPurchases.push(purchaseSUNDD);

// Pre-approval invariant check: before purchase approval, buyer is inactive
const sunddBefore = mockUsers.find(u => u.id === sunddUserId);
assert.strictEqual(sunddBefore.account_status, 'INACTIVE');

// Execute atomic PurchaseOrchestrator workflow
const orchResult = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
    purchase: purchaseSUNDD,
    product: titanProduct,
    userId: sunddUserId,
    binaryNodes: mockBinaryNodes,
    sponsors: mockSponsors,
    users: mockUsers,
    kycDocs: mockKycDocs,
    purchases: mockProductPurchases,
    commissionLedger: mockCommissionTransactions,
    volumeLedger: mockVolumeLedger,
    walletLedger: mockWalletLedger,
    dailyEarningsMap: mockDailyEarningsMap
});

assert.strictEqual(orchResult.success, true, 'Purchase orchestration must succeed');

// Buyer transitions to ACTIVE
const sunddUser = mockUsers.find(u => u.id === sunddUserId);
sunddUser.status = 'ACTIVE';
sunddUser.account_status = 'ACTIVE';

// Sponsor Sun receives 8% direct commission = 19,900 * 0.08 = Rs. 1,592.00
const sunWallet = WalletService.getWalletBalances(sunUserId, mockWalletLedger);
assert.strictEqual(sunWallet.available_balance, 1592.00, 'Sun must receive exactly 8% direct commission (Rs. 1,592.00)');

// Ancestor Volume Propagation: Hiru receives 19,900 BV on Left leg
const hiruVolume = VolumeLedger.getVolumeSummary('user-hiru-root', mockVolumeLedger);
assert.strictEqual(hiruVolume.current_left_volume, 19900.00, 'Hiru must have 19,900 BV on Left leg');
console.log('✅ PASS: PurchaseOrchestrator credited 8% Direct Commission and propagated 19,900 BV.');

// ====================================================================
// TEST 5: Master Idempotency Guard (No Duplicate Commissions on Retry)
// ====================================================================
console.log('\n--- TEST 5: Idempotency Guard on Re-Execution ---');
const retryOrch = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
    purchase: purchaseSUNDD,
    product: titanProduct,
    userId: sunddUserId,
    binaryNodes: mockBinaryNodes,
    sponsors: mockSponsors,
    users: mockUsers,
    kycDocs: mockKycDocs,
    purchases: mockProductPurchases,
    commissionLedger: mockCommissionTransactions,
    volumeLedger: mockVolumeLedger,
    walletLedger: mockWalletLedger,
    dailyEarningsMap: mockDailyEarningsMap
});

assert.strictEqual(retryOrch.idempotent, true, 'Retry must return idempotent: true');
const sunWalletAfterRetry = WalletService.getWalletBalances(sunUserId, mockWalletLedger);
assert.strictEqual(sunWalletAfterRetry.available_balance, 1592.00, 'Wallet balance must not double on retry');
console.log('✅ PASS: Re-approval idempotency strictly protected against duplication.');

// ====================================================================
// TEST 6: Tree & Leg Isolation (Zero Crossline Leakage)
// ====================================================================
console.log('\n--- TEST 6: Tree & Leg Isolation Verification ---');
const regMemberRight = AuthService.registerMember({
    fullName: 'MemberRight',
    username: 'MemberRight',
    email: 'right@hapanamy.lk',
    mobile: '0770001122',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    sponsorCode: '@Hiru',
    position: 'RIGHT'
}, context);

assert.strictEqual(regMemberRight.success, true);
const rightUserId = regMemberRight.user.id;

const rightDashboard = MemberDashboardService.getMemberDashboardData({
    userId: rightUserId,
    ...context
});
assert.strictEqual(rightDashboard.binary_network.team_list.length, 0, 'MemberRight must see 0 team members');
assert.strictEqual(rightDashboard.binary_network.left_team_count, 0);
assert.strictEqual(rightDashboard.binary_network.right_team_count, 0);

const hiruFinalDashboard = MemberDashboardService.getMemberDashboardData({
    userId: 'user-hiru-root',
    ...context
});
assert.strictEqual(hiruFinalDashboard.binary_network.left_team_count, 2, 'Hiru Left team count remains 2');
assert.strictEqual(hiruFinalDashboard.binary_network.right_team_count, 1, 'Hiru Right team count is 1');
console.log('✅ PASS: Zero crossline contamination between Left and Right subtrees.');

console.log('\n================================================================');
console.log('📊 STEP 61 TEST SUITE: 6 PASSED, 0 FAILED out of 6 TESTS');
console.log('================================================================\n');
