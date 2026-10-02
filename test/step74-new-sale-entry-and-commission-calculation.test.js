// test/step74-new-sale-entry-and-commission-calculation.test.js
// Automated Verification for Real-Time MLM Commission Calculations & BV Points on New Sale Entry

const assert = require('assert');
const PurchaseOrchestrator = require('../services/purchase-orchestrator');
const VolumeLedger = require('../services/volume-ledger');
const DirectCommissionEngine = require('../services/direct-commission-engine');
const QualifiedUplineCommissionEngine = require('../services/qualified-upline-commission-engine');
const QualificationEngine = require('../services/qualification-engine');
const MLMNetworkEngine = require('../services/mlm-network-engine');
const WalletService = require('../services/wallet-service');

console.log('🧪 Starting Step 74 Test Suite: Real-Time New Sale Commission & BV Calculation Pipeline...');

// 1. Setup Mock Network Data mirroring production Hapanamy tree
const mockUsers = [
    { id: 'user-namobuddhaya-root', username: 'NAMOBUDDHAYA', full_name: 'Main Admin', role: 'admin', status: 'ACTIVE', account_status: 'ACTIVE', qualification_status: 'QUALIFIED' },
    { id: 'user-hapana-01', username: 'HAPANA01', full_name: 'Hapana 01', sponsor_id: 'user-namobuddhaya-root', role: 'member', status: 'ACTIVE', account_status: 'ACTIVE', qualification_status: 'QUALIFIED', personal_bv: 4500 },
    { id: 'user-hapana-02', username: 'HAPANA02', full_name: 'Hapana 02', sponsor_id: 'user-hapana-01', role: 'member', status: 'ACTIVE', account_status: 'ACTIVE', qualification_status: 'QUALIFIED', personal_bv: 4500 },
    { id: 'user-hapana-03', username: 'HAPANA03', full_name: 'Hapana 03', sponsor_id: 'user-hapana-01', role: 'member', status: 'ACTIVE', account_status: 'ACTIVE', qualification_status: 'QUALIFIED', personal_bv: 4500 },
    { id: 'user-hapana-04', username: 'HAPANA04', full_name: 'Hapana 04', sponsor_id: 'user-hapana-02', role: 'member', status: 'ACTIVE', account_status: 'ACTIVE', qualification_status: 'QUALIFIED', personal_bv: 4500 },
    { id: 'user-hapana-08', username: 'HAPANA08', full_name: 'Hapana 08', sponsor_id: 'user-hapana-04', role: 'member', status: 'ACTIVE', account_status: 'ACTIVE', qualification_status: 'NOT_QUALIFIED', personal_bv: 4500 }
];

const mockBinaryNodes = [
    { id: 'node-namobuddhaya-root', user_id: 'user-namobuddhaya-root', placement_parent_id: null, position: 'ROOT', left_child_id: 'user-hapana-01', right_child_id: null },
    { id: 'node-hapana-01', user_id: 'user-hapana-01', placement_parent_id: 'user-namobuddhaya-root', position: 'LEFT', left_child_id: 'user-hapana-02', right_child_id: 'user-hapana-03' },
    { id: 'node-hapana-02', user_id: 'user-hapana-02', placement_parent_id: 'user-hapana-01', position: 'LEFT', left_child_id: 'user-hapana-04', right_child_id: null },
    { id: 'node-hapana-03', user_id: 'user-hapana-03', placement_parent_id: 'user-hapana-01', position: 'RIGHT', left_child_id: null, right_child_id: null },
    { id: 'node-hapana-04', user_id: 'user-hapana-04', placement_parent_id: 'user-hapana-02', position: 'LEFT', left_child_id: 'user-hapana-08', right_child_id: null },
    { id: 'node-hapana-08', user_id: 'user-hapana-08', placement_parent_id: 'user-hapana-04', position: 'LEFT', left_child_id: null, right_child_id: null }
];

const mockSponsors = [
    { id: 'sp-01', user_id: 'user-hapana-01', sponsor_id: 'user-namobuddhaya-root' },
    { id: 'sp-02', user_id: 'user-hapana-02', sponsor_id: 'user-hapana-01' },
    { id: 'sp-03', user_id: 'user-hapana-03', sponsor_id: 'user-hapana-01' },
    { id: 'sp-04', user_id: 'user-hapana-04', sponsor_id: 'user-hapana-02' },
    { id: 'sp-08', user_id: 'user-hapana-08', sponsor_id: 'user-hapana-04' }
];

const mockPurchases = [];
const mockCommissionLedger = [];
const mockVolumeLedger = [];
const mockWalletLedger = [];
const mockDailyEarningsMap = new Map();

const tiktokProduct = {
    id: 'tiktok-course',
    name: 'TikTok Monetization ප්‍රායෝගික පාඨමාලාව (Online Zoom)',
    selling_price: 4500.00,
    price: 4500.00,
    binary_volume: 4500.00,
    direct_commission_percent: 8.00,
    binary_commission_percent: 7.00,
    max_binary_qualified_levels: 7
};

// TEST 1: Free downline registration under HAPANA08 (LEFT leg)
console.log('👉 Test 1: Registering HAPANA16 as free member under HAPANA08...');
const userHapana16 = {
    id: 'user-hapana-16',
    username: 'HAPANA16',
    full_name: 'Hapana 16',
    sponsor_id: 'user-hapana-08',
    role: 'member',
    status: 'INACTIVE',
    account_status: 'INACTIVE',
    qualification_status: 'NOT_QUALIFIED',
    position: 'LEFT',
    personal_bv: 0
};
mockUsers.push(userHapana16);

mockSponsors.push({
    id: 'sp-16',
    user_id: 'user-hapana-16',
    sponsor_id: 'user-hapana-08'
});

const node16 = {
    id: 'node-hapana-16',
    user_id: 'user-hapana-16',
    placement_parent_id: 'user-hapana-08',
    position: 'LEFT',
    left_child_id: null,
    right_child_id: null
};
mockBinaryNodes.push(node16);
const parentNode08 = mockBinaryNodes.find(n => n.user_id === 'user-hapana-08');
parentNode08.left_child_id = 'user-hapana-16';

const status16Before = QualificationEngine.getMemberAccountStatus('user-hapana-16', { users: mockUsers, purchases: mockPurchases });
assert.strictEqual(status16Before.status, 'INACTIVE', 'New member should start INACTIVE before purchase');
console.log('✅ Test 1 Passed: HAPANA16 registered and correctly initialized as INACTIVE.');

// TEST 2: HAPANA16 purchases TikTok Course (Rs. 4,500.00)
console.log('👉 Test 2: Executing TikTok Course purchase for HAPANA16...');
const purchase16 = {
    id: 'purch-hapana-16',
    order_number: 'ORD-HP16001',
    user_id: 'user-hapana-16',
    product_id: 'tiktok-course',
    product_name: tiktokProduct.name,
    price_paid: 4500.00,
    binary_volume: 4500.00,
    status: 'ACTIVE',
    created_at: new Date().toISOString()
};

const orchResult = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
    purchase: purchase16,
    product: tiktokProduct,
    userId: 'user-hapana-16',
    binaryNodes: mockBinaryNodes,
    sponsors: mockSponsors,
    users: mockUsers,
    kycDocs: [],
    purchases: mockPurchases,
    commissionLedger: mockCommissionLedger,
    volumeLedger: mockVolumeLedger,
    walletLedger: mockWalletLedger,
    dailyEarningsMap: mockDailyEarningsMap
});

assert.strictEqual(orchResult.success, true, 'Purchase orchestration must succeed');
console.log('✅ Test 2 Passed: Purchase orchestration workflow completed successfully.');

// TEST 3: Verify Buyer Account Status Transitions to ACTIVE
console.log('👉 Test 3: Verifying Buyer Account Status...');
const status16After = QualificationEngine.getMemberAccountStatus('user-hapana-16', { users: mockUsers, purchases: mockPurchases });
assert.strictEqual(status16After.status, 'ACTIVE', 'Buyer status must transition to ACTIVE after verified purchase');
console.log('✅ Test 3 Passed: HAPANA16 is ACTIVE.');

// TEST 4: Direct Commission Calculation (Exact 8% of Rs. 4,500 = Rs. 360.00) to sponsor HAPANA08
console.log('👉 Test 4: Verifying 8% Direct Commission to HAPANA08...');
const directTx = mockWalletLedger.find(tx => tx.user_id === 'user-hapana-08' && tx.type === 'DIRECT_COMMISSION');
assert.ok(directTx, 'Direct sponsor HAPANA08 must have received DIRECT_COMMISSION transaction');
assert.strictEqual(directTx.amount, 360.00, 'Direct commission must be exact 8% = Rs. 360.00');
console.log(`✅ Test 4 Passed: Direct sponsor HAPANA08 credited Rs. ${directTx.amount.toFixed(2)}.`);

// TEST 5: Binary Volume Propagation (4,500 BV) up ancestor tree
console.log('👉 Test 5: Verifying 4,500 BV Propagation up ancestors...');
const ancestorsToVerify = ['user-hapana-08', 'user-hapana-04', 'user-hapana-02', 'user-hapana-01', 'user-namobuddhaya-root'];
ancestorsToVerify.forEach(ancId => {
    const volEntry = mockVolumeLedger.find(v => v.user_id === ancId && v.source_user_id === 'user-hapana-16');
    assert.ok(volEntry, `Ancestor ${ancId} must have received BV entry from user-hapana-16`);
    assert.strictEqual(volEntry.amount, 4500.00, 'Propagated BV must be 4,500');
    assert.strictEqual(volEntry.leg, 'LEFT', 'Leg must be LEFT');
});
console.log('✅ Test 5 Passed: 4,500 BV successfully propagated to all 5 ancestors on LEFT leg.');

// TEST 6: Dual-Leg Qualification Upgrade (0/2 -> 1/2 -> 2/2 -> QUALIFIED)
console.log('👉 Test 6: Verifying Dual-Leg Sales Qualification Progress for HAPANA08...');
let qStatus08 = QualificationEngine.getMemberQualificationStatus('user-hapana-08', {
    users: mockUsers,
    sponsors: mockSponsors,
    binaryNodes: mockBinaryNodes,
    purchases: mockPurchases
});
assert.strictEqual(qStatus08.status, 'NOT_QUALIFIED', 'HAPANA08 has 1 direct sale, so not qualified yet');
assert.strictEqual(qStatus08.qualifying_sales_count, 1, 'Qualifying sales count should be 1');

// Register 2nd downline HAPANA17 under HAPANA08 on RIGHT leg
const userHapana17 = {
    id: 'user-hapana-17',
    username: 'HAPANA17',
    full_name: 'Hapana 17',
    sponsor_id: 'user-hapana-08',
    role: 'member',
    status: 'INACTIVE',
    account_status: 'INACTIVE',
    qualification_status: 'NOT_QUALIFIED',
    position: 'RIGHT',
    personal_bv: 0
};
mockUsers.push(userHapana17);
mockSponsors.push({ id: 'sp-17', user_id: 'user-hapana-17', sponsor_id: 'user-hapana-08' });
const node17 = {
    id: 'node-hapana-17',
    user_id: 'user-hapana-17',
    placement_parent_id: 'user-hapana-08',
    position: 'RIGHT',
    left_child_id: null,
    right_child_id: null
};
mockBinaryNodes.push(node17);
parentNode08.right_child_id = 'user-hapana-17';

const purchase17 = {
    id: 'purch-hapana-17',
    order_number: 'ORD-HP17001',
    user_id: 'user-hapana-17',
    product_id: 'tiktok-course',
    product_name: tiktokProduct.name,
    price_paid: 4500.00,
    binary_volume: 4500.00,
    status: 'ACTIVE',
    created_at: new Date().toISOString()
};

PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
    purchase: purchase17,
    product: tiktokProduct,
    userId: 'user-hapana-17',
    binaryNodes: mockBinaryNodes,
    sponsors: mockSponsors,
    users: mockUsers,
    kycDocs: [],
    purchases: mockPurchases,
    commissionLedger: mockCommissionLedger,
    volumeLedger: mockVolumeLedger,
    walletLedger: mockWalletLedger,
    dailyEarningsMap: mockDailyEarningsMap
});

qStatus08 = QualificationEngine.getMemberQualificationStatus('user-hapana-08', {
    users: mockUsers,
    sponsors: mockSponsors,
    binaryNodes: mockBinaryNodes,
    purchases: mockPurchases
});
assert.strictEqual(qStatus08.status, 'QUALIFIED', 'HAPANA08 has 2 paid direct sales (Left and Right) and must become QUALIFIED');
assert.strictEqual(qStatus08.is_qualified, true, 'is_qualified must be true');
console.log('✅ Test 6 Passed: HAPANA08 upgraded to QUALIFIED (★ Gold).');

// TEST 7: Volume Summary & Carry Forward Calculations
console.log('👉 Test 7: Verifying Volume Summary & Matched Volume for HAPANA08...');
const volSum08 = VolumeLedger.getVolumeSummary('user-hapana-08', mockVolumeLedger);
assert.strictEqual(volSum08.current_left_volume, 4500, 'Left volume must be 4,500');
assert.strictEqual(volSum08.current_right_volume, 4500, 'Right volume must be 4,500');
assert.strictEqual(volSum08.matched_volume, 4500, 'Matched volume must be 4,500');
assert.strictEqual(volSum08.weaker_leg, 'BALANCED', 'Legs must be BALANCED');
console.log('✅ Test 7 Passed: Volume summary balanced at 4,500 Left / 4,500 Right.');

// TEST 8: Wallet Service Balance Calculation
console.log('👉 Test 8: Verifying Wallet Balances for HAPANA08...');
const ledger08 = mockWalletLedger.filter(tx => tx.user_id === 'user-hapana-08');
const balance08 = WalletService.calculateBalances(ledger08);
const totalEarned08 = balance08.totalEarned !== undefined ? balance08.totalEarned : balance08.total_earned;
const availableBalance08 = balance08.availableBalance !== undefined ? balance08.availableBalance : balance08.available_balance;

// HAPANA08 earned 2 direct commissions (360 + 360 = 720)
assert.ok(totalEarned08 >= 720.00, `Total earned (${totalEarned08}) must be at least Rs. 720.00`);
assert.ok(availableBalance08 >= 720.00, `Available balance (${availableBalance08}) must be at least Rs. 720.00`);
console.log(`✅ Test 8 Passed: HAPANA08 available wallet balance is Rs. ${availableBalance08.toFixed(2)}.`);

console.log('\n🎉 ALL 8 REAL-TIME COMMISSION & VOLUME CALCULATION TESTS PASSED 100%!');
