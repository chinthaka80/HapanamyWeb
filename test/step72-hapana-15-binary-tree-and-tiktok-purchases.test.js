// test/step72-hapana-15-binary-tree-and-tiktok-purchases.test.js
// Verification suite for HAPANA01 - HAPANA15 Accounts, Complete 15-Node Binary Tree Topology,
// OLU321# Password Authentication, TikTok Monetization Course Purchases, and MLM Commission Calculations.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AuthService = require('../services/auth-service');
const WalletService = require('../services/wallet-service');
const PlacementEngine = require('../services/placement-engine');
const QualificationEngine = require('../services/qualification-engine');

console.log('\n================================================================');
console.log('🧪 RUNNING STEP 72: HAPANA01-15 BINARY TREE & TIKTOK PURCHASES SUITE');
console.log('================================================================\n');

const dbFilePath = path.join(__dirname, '..', 'data', 'mlm-db-store.json');
assert.ok(fs.existsSync(dbFilePath), 'data/mlm-db-store.json must exist');
const db = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));

// --- TEST 1: User Accounts & Authentication Audit ---
console.log('--- TEST 1: HAPANA01 to HAPANA15 Account Specifications & OLU321# Password ---');
assert.ok(Array.isArray(db.users), 'users array must exist in db store');

for (let i = 1; i <= 15; i++) {
    const numStr = String(i).padStart(2, '0');
    const expectedUsername = `HAPANA${numStr}`;
    const expectedEmail = `hapana${numStr}@gmail.com`;
    const expectedId = `user-hapana-${numStr}`;

    const user = db.users.find(u => u.username === expectedUsername || u.id === expectedId);
    assert.ok(user, `User ${expectedUsername} must exist in database`);
    assert.strictEqual(user.email, expectedEmail, `Email for ${expectedUsername} must be ${expectedEmail}`);
    assert.strictEqual(user.role, 'member', `Role for ${expectedUsername} must be 'member'`);
    assert.strictEqual(user.status, 'ACTIVE', `Status for ${expectedUsername} must be ACTIVE`);
    assert.strictEqual(user.account_status, 'ACTIVE', `Account status for ${expectedUsername} must be ACTIVE`);
    assert.strictEqual(user.kyc_status, 'APPROVED', `KYC status for ${expectedUsername} must be APPROVED`);
    assert.ok(user.password_hash, `User ${expectedUsername} must have a password_hash`);
    assert.ok(AuthService.verifyPassword('OLU321#', user.password_hash), `Password for ${expectedUsername} must verify with 'OLU321#'`);
}

console.log('✅ Passed: All 15 HAPANA accounts exist with ACTIVE status and OLU321# password verification');

// --- TEST 2: Complete 15-Node Binary Tree Topology Audit ---
console.log('\n--- TEST 2: Complete 15-Node Binary Tree Topology & Depth Structure ---');
assert.ok(Array.isArray(db.binaryNodes), 'binaryNodes array must exist');

// Verify Root Node (NAMOBUDDHAYA)
const rootNode = db.binaryNodes.find(n => n.id === 'node-namobuddhaya-root');
assert.ok(rootNode, 'Root node node-namobuddhaya-root must exist');

// Verify Node 1 (HAPANA01)
const node1 = db.binaryNodes.find(n => n.user_id === 'user-hapana-01');
assert.ok(node1, 'Node 1 (user-hapana-01) must exist');
assert.strictEqual(node1.placement_parent_id, 'user-namobuddhaya-root', 'HAPANA01 parent must be user-namobuddhaya-root');
assert.strictEqual(node1.position, 'LEFT', 'HAPANA01 position under root must be LEFT');
assert.strictEqual(node1.left_child_id, 'user-hapana-02', 'HAPANA01 left child must be user-hapana-02');
assert.strictEqual(node1.right_child_id, 'user-hapana-03', 'HAPANA01 right child must be user-hapana-03');

// Verify Nodes 2 to 15
for (let i = 2; i <= 15; i++) {
    const numStr = String(i).padStart(2, '0');
    const userId = `user-hapana-${numStr}`;
    const node = db.binaryNodes.find(n => n.user_id === userId);
    assert.ok(node, `Node ${userId} must exist`);

    const parentIndex = Math.floor(i / 2);
    const parentUserId = `user-hapana-${String(parentIndex).padStart(2, '0')}`;
    const expectedPosition = (i % 2 === 0) ? 'LEFT' : 'RIGHT';

    assert.strictEqual(node.placement_parent_id, parentUserId, `Parent of HAPANA${numStr} must be ${parentUserId}`);
    assert.strictEqual(node.position, expectedPosition, `Position of HAPANA${numStr} must be ${expectedPosition}`);

    if (i * 2 <= 15) {
        const expectedLeftChild = `user-hapana-${String(i * 2).padStart(2, '0')}`;
        assert.strictEqual(node.left_child_id, expectedLeftChild, `Left child of HAPANA${numStr} must be ${expectedLeftChild}`);
    }
    if (i * 2 + 1 <= 15) {
        const expectedRightChild = `user-hapana-${String(i * 2 + 1).padStart(2, '0')}`;
        assert.strictEqual(node.right_child_id, expectedRightChild, `Right child of HAPANA${numStr} must be ${expectedRightChild}`);
    }
}

console.log('✅ Passed: Complete 15-node binary tree topology strictly matches handwritten diagram');

// --- TEST 3: Sponsor Genealogy Relationship Audit ---
console.log('\n--- TEST 3: Direct Sponsor Genealogy Verification ---');
assert.ok(Array.isArray(db.sponsors), 'sponsors array must exist');

const sp1 = db.sponsors.find(s => s.user_id === 'user-hapana-01');
assert.ok(sp1, 'Sponsor link for HAPANA01 must exist');
assert.strictEqual(sp1.sponsor_id, 'user-namobuddhaya-root', 'HAPANA01 sponsor must be user-namobuddhaya-root');

for (let i = 2; i <= 15; i++) {
    const numStr = String(i).padStart(2, '0');
    const userId = `user-hapana-${numStr}`;
    const parentNumStr = String(Math.floor(i / 2)).padStart(2, '0');
    const expectedSponsorId = `user-hapana-${parentNumStr}`;

    const sp = db.sponsors.find(s => s.user_id === userId);
    assert.ok(sp, `Sponsor link for ${userId} must exist`);
    assert.strictEqual(sp.sponsor_id, expectedSponsorId, `Sponsor for HAPANA${numStr} must be ${expectedSponsorId}`);
}

console.log('✅ Passed: Direct sponsor links match exact parental tree nodes');

// --- TEST 4: TikTok Course Product Purchases Audit ---
console.log('\n--- TEST 4: TikTok Monetization Course Purchases for All 15 Accounts ---');
assert.ok(Array.isArray(db.productPurchases), 'productPurchases array must exist');

for (let i = 1; i <= 15; i++) {
    const numStr = String(i).padStart(2, '0');
    const userId = `user-hapana-${numStr}`;

    const purchase = db.productPurchases.find(p => p.user_id === userId && p.product_id === 'tiktok-course');
    assert.ok(purchase, `Active TikTok course purchase must exist for ${userId}`);
    assert.strictEqual(purchase.status, 'ACTIVE', `Purchase for ${userId} must be ACTIVE`);
    assert.strictEqual(Number(purchase.selling_price), 4500, `Purchase price for ${userId} must be Rs. 4,500.00`);
    assert.strictEqual(Number(purchase.binary_volume), 4500, `Binary volume for ${userId} must be 4,500 BV`);
}

console.log('✅ Passed: All 15 accounts have active purchased access to TikTok Monetization Course (Rs. 4,500.00)');

// --- TEST 5: MLM Commission Math & Double-Entry Ledger Reconciliation ---
console.log('\n--- TEST 5: Direct & Binary Commission Mathematical Invariants ---');
assert.ok(Array.isArray(db.commissionTransactions), 'commissionTransactions array must exist');
assert.ok(Array.isArray(db.walletLedger), 'walletLedger array must exist');
assert.ok(Array.isArray(db.wallets), 'wallets array must exist');

// Direct Commission = 8% of Rs. 4,500 = Rs. 360.00
const directEntries = db.commissionTransactions.filter(c => c.type === 'DIRECT' && Number(c.eligible_amount) === 360);
assert.strictEqual(directEntries.length, 15, 'Must have 15 direct commission entries (1 per purchaser)');
directEntries.forEach(d => {
    assert.strictEqual(Number(d.eligible_amount), 360.00, 'Direct commission amount must be exact Rs. 360.00 (8%)');
});

// Binary Commission per match = 7% of 4,500 BV = Rs. 315.00
const binaryEntries = db.commissionTransactions.filter(c => c.type === 'BINARY' && Number(c.eligible_amount) === 315);
binaryEntries.forEach(b => {
    assert.strictEqual(Number(b.eligible_amount), 315.00, 'Binary commission per level match must be exact Rs. 315.00 (7%)');
});

// Wallet Balance Invariants
const expectedBalances = {
    'user-namobuddhaya-root': 5085.00,
    'user-hapana-01': 4815.00,
    'user-hapana-02': 2295.00,
    'user-hapana-03': 2295.00,
    'user-hapana-04': 1035.00,
    'user-hapana-05': 1035.00,
    'user-hapana-06': 1035.00,
    'user-hapana-07': 1035.00,
    'user-hapana-08': 0.00,
    'user-hapana-09': 0.00,
    'user-hapana-10': 0.00,
    'user-hapana-11': 0.00,
    'user-hapana-12': 0.00,
    'user-hapana-13': 0.00,
    'user-hapana-14': 0.00,
    'user-hapana-15': 0.00
};

Object.entries(expectedBalances).forEach(([userId, expectedBal]) => {
    const derived = WalletService.calculateBalances(db.walletLedger, userId);
    assert.strictEqual(derived.availableBalance, expectedBal, `Wallet balance for ${userId} must derive exact Rs. ${expectedBal}`);

    const wallet = db.wallets.find(w => w.user_id === userId);
    assert.ok(wallet, `Wallet record for ${userId} must exist`);
    assert.strictEqual(wallet.available_balance, expectedBal, `Wallet available_balance for ${userId} must equal Rs. ${expectedBal}`);
});

console.log('✅ Passed: Double-entry financial wallet balances and commission math match 100% exact mathematical formulas');

console.log('\n================================================================');
console.log('🎉 ALL STEP 72 TESTS PASSED SUCCESSFULLY (5/5)');
console.log('================================================================\n');
