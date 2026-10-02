// test/step73-points-calculation-and-team-list-rendering.test.js
// Verification suite for Points Calculation, Real-Time Team List Rendering,
// Multi-Tier BFS Downline Extraction, and 15-HAPANA Member Data Model Consistency across UI & Engine.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const MLMNetworkEngine = require('../services/mlm-network-engine');
const VolumeLedger = require('../services/volume-ledger');
const QualificationEngine = require('../services/qualification-engine');
const DirectCommissionEngine = require('../services/direct-commission-engine');
const QualifiedUplineCommissionEngine = require('../services/qualified-upline-commission-engine');
const EarningsCapEngine = require('../services/earnings-cap-engine');

console.log('\n================================================================');
console.log('🧪 RUNNING STEP 73: POINTS CALCULATION & TEAM LIST RENDERING TEST SUITE');
console.log('================================================================\n');

const dbFilePath = path.join(__dirname, '..', 'data', 'mlm-db-store.json');
assert.ok(fs.existsSync(dbFilePath), 'data/mlm-db-store.json must exist');
const db = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));

const dashboardHtml = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const portalHtml = fs.readFileSync(path.join(__dirname, '..', 'hapanamy-admin-portal-9226.html'), 'utf8');

// --- TEST 1: Backend MLM Engine Authoritative Volume and Team Hierarchy ---
console.log('--- TEST 1: Authoritative Volume and Team Hierarchy for 15-Node Tree ---');

// NAMOBUDDHAYA (Root)
const netRoot = MLMNetworkEngine.getMemberNetwork('user-namobuddhaya-root', db);
const volRoot = VolumeLedger.getVolumeSummary('user-namobuddhaya-root', db.volumeLedger, db.productPurchases);
assert.strictEqual(netRoot.team_list.length, 15, 'Root NAMOBUDDHAYA must have 15 team members');
assert.strictEqual(volRoot.current_left_volume, 67500, 'Root Left BV must be 67,500');
assert.strictEqual(volRoot.current_right_volume, 0, 'Root Right BV must be 0');

// HAPANA01 (Level 1 Root of 14 members)
const net01 = MLMNetworkEngine.getMemberNetwork('user-hapana-01', db);
const vol01 = VolumeLedger.getVolumeSummary('user-hapana-01', db.volumeLedger, db.productPurchases);
assert.strictEqual(net01.team_list.length, 14, 'HAPANA01 must have 14 team members');
assert.strictEqual(vol01.current_left_volume, 31500, 'HAPANA01 Left BV must be 31,500');
assert.strictEqual(vol01.current_right_volume, 31500, 'HAPANA01 Right BV must be 31,500');
assert.strictEqual(net01.center_member.left_points, 31500);
assert.strictEqual(net01.center_member.right_points, 31500);

// HAPANA02 & HAPANA03 (Level 2 Roots of 6 members each)
const net02 = MLMNetworkEngine.getMemberNetwork('user-hapana-02', db);
const vol02 = VolumeLedger.getVolumeSummary('user-hapana-02', db.volumeLedger, db.productPurchases);
assert.strictEqual(net02.team_list.length, 6, 'HAPANA02 must have 6 team members');
assert.strictEqual(vol02.current_left_volume, 13500, 'HAPANA02 Left BV must be 13,500');
assert.strictEqual(vol02.current_right_volume, 13500, 'HAPANA02 Right BV must be 13,500');

const net03 = MLMNetworkEngine.getMemberNetwork('user-hapana-03', db);
const vol03 = VolumeLedger.getVolumeSummary('user-hapana-03', db.volumeLedger, db.productPurchases);
assert.strictEqual(net03.team_list.length, 6, 'HAPANA03 must have 6 team members');
assert.strictEqual(vol03.current_left_volume, 13500, 'HAPANA03 Left BV must be 13,500');
assert.strictEqual(vol03.current_right_volume, 13500, 'HAPANA03 Right BV must be 13,500');

// HAPANA04 to HAPANA07 (Level 3 Roots of 2 members each)
for (let i = 4; i <= 7; i++) {
    const uid = `user-hapana-0${i}`;
    const net = MLMNetworkEngine.getMemberNetwork(uid, db);
    const vol = VolumeLedger.getVolumeSummary(uid, db.volumeLedger, db.productPurchases);
    assert.strictEqual(net.team_list.length, 2, `HAPANA0${i} must have 2 team members`);
    assert.strictEqual(vol.current_left_volume, 4500, `HAPANA0${i} Left BV must be 4,500`);
    assert.strictEqual(vol.current_right_volume, 4500, `HAPANA0${i} Right BV must be 4,500`);
}

// HAPANA08 to HAPANA15 (Level 4 Leaf nodes)
for (let i = 8; i <= 15; i++) {
    const numStr = String(i).padStart(2, '0');
    const uid = `user-hapana-${numStr}`;
    const net = MLMNetworkEngine.getMemberNetwork(uid, db);
    const vol = VolumeLedger.getVolumeSummary(uid, db.volumeLedger, db.productPurchases);
    assert.strictEqual(net.team_list.length, 0, `HAPANA${numStr} leaf node must have 0 team members`);
    assert.strictEqual(vol.current_left_volume, 0, `HAPANA${numStr} Left BV must be 0`);
    assert.strictEqual(vol.current_right_volume, 0, `HAPANA${numStr} Right BV must be 0`);
}
console.log('✅ Passed: Authoritative Volume and Team Hierarchy verified for all 15 nodes');

// --- TEST 2: Client-Side dashboard.html BFS Genealogy & Points Extraction ---
console.log('\n--- TEST 2: Client-Side dashboard.html getLocalDownlinesForUser BFS & Points ---');
const fnMatch = dashboardHtml.match(/function getLocalDownlinesForUser\([\s\S]*?\n        \}/);
assert.ok(fnMatch, 'getLocalDownlinesForUser must be defined in dashboard.html');

const sandbox = {
    localStorage: { length: 0, key: () => null, getItem: () => null }
};
const runFn = new Function('sandbox', `
    const localStorage = sandbox.localStorage;
    ${fnMatch[0]}
    return getLocalDownlinesForUser;
`)(sandbox);

// Test NAMOBUDDHAYA
const rootDownlines = runFn({ id: 'user-namobuddhaya-root', username: 'NAMOBUDDHAYA' });
assert.strictEqual(rootDownlines.length, 15, 'NAMOBUDDHAYA downlines count must be 15');
const rootLeft = rootDownlines.filter(d => (d.position || d.branch_leg || 'LEFT').toUpperCase() === 'LEFT');
assert.strictEqual(rootLeft.length, 15, 'Root Left downlines must be 15');
const rootLeftPts = rootLeft.reduce((sum, m) => sum + Number(m.personal_bv || 4500), 0);
assert.strictEqual(rootLeftPts, 67500, 'Root Left points must be 67,500 BV');

// Test HAPANA01
const h01Downlines = runFn({ id: 'user-hapana-01', username: 'HAPANA01' });
assert.strictEqual(h01Downlines.length, 14, 'HAPANA01 downlines count must be 14');
const h01Left = h01Downlines.filter(d => (d.position || d.branch_leg || 'LEFT').toUpperCase() === 'LEFT');
const h01Right = h01Downlines.filter(d => (d.position || d.branch_leg || 'LEFT').toUpperCase() === 'RIGHT');
assert.strictEqual(h01Left.length, 7, 'HAPANA01 Left team count must be 7');
assert.strictEqual(h01Right.length, 7, 'HAPANA01 Right team count must be 7');
const h01LeftPts = h01Left.reduce((sum, m) => sum + Number(m.personal_bv || 4500), 0);
const h01RightPts = h01Right.reduce((sum, m) => sum + Number(m.personal_bv || 4500), 0);
assert.strictEqual(h01LeftPts, 31500, 'HAPANA01 Left points must be 31,500 BV');
assert.strictEqual(h01RightPts, 31500, 'HAPANA01 Right points must be 31,500 BV');

// Test HAPANA02 & HAPANA03
const h02Downlines = runFn({ id: 'user-hapana-02', username: 'HAPANA02' });
assert.strictEqual(h02Downlines.length, 6, 'HAPANA02 downlines count must be 6');
const h02LeftPts = h02Downlines.filter(d => (d.position || 'LEFT').toUpperCase() === 'LEFT').reduce((s, m) => s + Number(m.personal_bv || 4500), 0);
const h02RightPts = h02Downlines.filter(d => (d.position || 'LEFT').toUpperCase() === 'RIGHT').reduce((s, m) => s + Number(m.personal_bv || 4500), 0);
assert.strictEqual(h02LeftPts, 13500, 'HAPANA02 Left points must be 13,500 BV');
assert.strictEqual(h02RightPts, 13500, 'HAPANA02 Right points must be 13,500 BV');

// Test HAPANA04
const h04Downlines = runFn({ id: 'user-hapana-04', username: 'HAPANA04' });
assert.strictEqual(h04Downlines.length, 2, 'HAPANA04 downlines count must be 2');
const h04LeftPts = h04Downlines.filter(d => (d.position || 'LEFT').toUpperCase() === 'LEFT').reduce((s, m) => s + Number(m.personal_bv || 4500), 0);
const h04RightPts = h04Downlines.filter(d => (d.position || 'LEFT').toUpperCase() === 'RIGHT').reduce((s, m) => s + Number(m.personal_bv || 4500), 0);
assert.strictEqual(h04LeftPts, 4500, 'HAPANA04 Left points must be 4,500 BV');
assert.strictEqual(h04RightPts, 4500, 'HAPANA04 Right points must be 4,500 BV');

// Test HAPANA08 (Leaf)
const h08Downlines = runFn({ id: 'user-hapana-08', username: 'HAPANA08' });
assert.strictEqual(h08Downlines.length, 0, 'HAPANA08 downlines count must be 0');
console.log('✅ Passed: Client-Side BFS genealogy and points calculation match 100%');

// --- TEST 3: Admin Directories Seed Data Audit ---
console.log('\n--- TEST 3: Admin Directories Seed Data Audit ---');
for (let i = 1; i <= 15; i++) {
    const numStr = String(i).padStart(2, '0');
    assert.ok(adminHtml.includes(`HAPANA${numStr}`), `admin.html must contain HAPANA${numStr}`);
    assert.ok(adminHtml.includes(`user-hapana-${numStr}`), `admin.html must contain user-hapana-${numStr}`);
    assert.ok(portalHtml.includes(`HAPANA${numStr}`), `portal must contain HAPANA${numStr}`);
    assert.ok(portalHtml.includes(`user-hapana-${numStr}`), `portal must contain user-hapana-${numStr}`);
}
console.log('✅ Passed: admin.html and hapanamy-admin-portal-9226.html seed data contain all 15 HAPANA users');

// --- TEST 4: Account Switch Modal in dashboard.html ---
console.log('\n--- TEST 4: Account Switch Modal in dashboard.html ---');
for (let i = 1; i <= 15; i++) {
    const numStr = String(i).padStart(2, '0');
    assert.ok(dashboardHtml.includes(`accountMap.set('hapana${numStr.toLowerCase()}'`), `dashboard.html account switch must include hapana${numStr.toLowerCase()}`);
}
console.log('✅ Passed: Account Switch Modal in dashboard.html includes all 15 HAPANA accounts');

// --- TEST 5: Core Mathematical Invariants Preservation ---
console.log('\n--- TEST 5: Core Mathematical Invariants Preservation ---');
const directComm = DirectCommissionEngine.calculateDirectCommission(4500, 8.00);
assert.strictEqual(directComm, 360.00, 'Direct commission on Rs. 4,500 must be Rs. 360.00 (8%)');

const binaryComm = QualifiedUplineCommissionEngine.calculateBinaryCommission(4500, 7.00);
assert.strictEqual(binaryComm, 315.00, 'Binary matching on 4,500 BV must be Rs. 315.00 (7%)');

assert.strictEqual(EarningsCapEngine._activeConfig.daily_cap_amount, 30000, 'Daily cap must be Rs. 30,000.00');
console.log('✅ Passed: Core MLM mathematical invariants strictly preserved');

console.log('\n================================================================');
console.log('🎉 ALL STEP 73 TESTS PASSED SUCCESSFULLY (5/5)');
console.log('================================================================\n');
