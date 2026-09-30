// test/step70-admin-subadmin-configuration-and-purge.test.js
// Verification suite to ensure ONLY 4 official administrative accounts exist in the system,
// all test/member user accounts are deleted, and all 4 admin accounts authenticate correctly.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AuthService = require('../services/auth-service');
const SecurityCore = require('../services/security-core');

console.log('\n================================================================');
console.log('🧪 RUNNING STEP 70: 4 OFFICIAL ADMIN/SUBADMIN CONFIGURATION & PURGE TEST SUITE');
console.log('================================================================\n');

// 1. Verify data/mlm-db-store.json integrity
console.log('--- TEST 1: Authoritative data/mlm-db-store.json User Audit ---');
const dbFilePath = path.join(__dirname, '..', 'data', 'mlm-db-store.json');
assert.ok(fs.existsSync(dbFilePath), 'data/mlm-db-store.json must exist');
const dbData = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));

assert.ok(Array.isArray(dbData.users), 'users array must exist');
assert.strictEqual(dbData.users.length, 4, `Database must contain EXACTLY 4 accounts, found ${dbData.users.length}`);

const expectedAccounts = [
    { username: 'NAMOBUDDHAYA', email: 'admin@hapanamy.lk', role: 'admin', id: 'user-namobuddhaya-root' },
    { username: 'subadmin', email: 'manager@hapanamy.lk', role: 'subadmin', id: 'user-subadmin-manager' },
    { username: 'subadmin2', email: 'finance@hapanamy.lk', role: 'subadmin', id: 'user-subadmin-finance' },
    { username: 'subadmin3', email: 'support@hapanamy.lk', role: 'subadmin', id: 'user-subadmin-support' }
];

expectedAccounts.forEach(acc => {
    const found = dbData.users.find(u => u.username.toLowerCase() === acc.username.toLowerCase() && u.email.toLowerCase() === acc.email.toLowerCase());
    assert.ok(found, `Account ${acc.username} (${acc.email}) must exist in db store`);
    assert.strictEqual(found.role, acc.role, `Account ${acc.username} must have role '${acc.role}'`);
    assert.strictEqual(found.id, acc.id, `Account ${acc.username} must have ID '${acc.id}'`);
    assert.strictEqual(found.status, 'ACTIVE', `Account ${acc.username} must be ACTIVE`);
    assert.ok(found.password_hash, `Account ${acc.username} must have a secure password_hash`);
    assert.ok(AuthService.verifyPassword('Hapana123', found.password_hash), `Password for ${acc.username} must verify with 'Hapana123'`);
});

// Verify no member accounts exist
const purgedUsernames = ['hiru', 'sun', 'sundd', 'star01', 'star02', 'star03'];
purgedUsernames.forEach(uname => {
    const exists = dbData.users.some(u => (u.username || '').toLowerCase() === uname);
    assert.strictEqual(exists, false, `Purged user '${uname}' must NOT exist in database`);
});

console.log('✅ Passed: data/mlm-db-store.json contains exactly the 4 required Admin/SubAdmin accounts and 0 test accounts');

// 2. Verify server.js mock dataset
console.log('\n--- TEST 2: server.js Source Markup & Default Data Audit ---');
const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

expectedAccounts.forEach(acc => {
    assert.ok(serverCode.includes(acc.id), `server.js must contain ${acc.id}`);
    assert.ok(serverCode.includes(acc.email), `server.js must contain ${acc.email}`);
});

assert.ok(serverCode.includes('token-subadmin-finance'), 'server.js must pre-seed session for token-subadmin-finance');
assert.ok(serverCode.includes('token-subadmin-support'), 'server.js must pre-seed session for token-subadmin-support');

console.log('✅ Passed: server.js defines all 4 admin/subadmin accounts and active sessions');

// 3. Verify admin.html & hapanamy-admin-portal-9226.html seedUsers
console.log('\n--- TEST 3: Admin HTML Portals Seed Data Audit ---');
const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const portalHtml = fs.readFileSync(path.join(__dirname, '..', 'hapanamy-admin-portal-9226.html'), 'utf8');

[adminHtml, portalHtml].forEach((html, idx) => {
    const filename = idx === 0 ? 'admin.html' : 'hapanamy-admin-portal-9226.html';
    assert.ok(html.includes('user-namobuddhaya-root'), `${filename} must include user-namobuddhaya-root`);
    assert.ok(html.includes('user-subadmin-manager'), `${filename} must include user-subadmin-manager`);
    assert.ok(html.includes('user-subadmin-finance'), `${filename} must include user-subadmin-finance`);
    assert.ok(html.includes('user-subadmin-support'), `${filename} must include user-subadmin-support`);
});

console.log('✅ Passed: admin.html and hapanamy-admin-portal-9226.html contain all 4 admin/subadmin seed accounts');

// 4. Verify Password Verification for All 4 Admin Accounts
console.log('\n--- TEST 4: Password Verification for All 4 Administrative Accounts ---');
expectedAccounts.forEach(acc => {
    const user = dbData.users.find(u => u.id === acc.id);
    const isValid = AuthService.verifyPassword('Hapana123', user.password_hash);
    assert.strictEqual(isValid, true, `Password 'Hapana123' must verify successfully for ${acc.username}`);
});

console.log('✅ Passed: All 4 accounts authenticate with password Hapana123');

// 5. Verify Binary Nodes Root Node is NAMOBUDDHAYA
console.log('\n--- TEST 5: Root Binary Node Verification ---');
assert.strictEqual(dbData.binaryNodes.length, 1, 'Only 1 root binary node must exist');
assert.strictEqual(dbData.binaryNodes[0].id, 'node-namobuddhaya-root', 'Root node must be node-namobuddhaya-root');
assert.strictEqual(dbData.binaryNodes[0].user_id, 'user-namobuddhaya-root', 'Root node user_id must be user-namobuddhaya-root');
assert.strictEqual(dbData.binaryNodes[0].left_child_id, null, 'Root node left_child must be null');
assert.strictEqual(dbData.binaryNodes[0].right_child_id, null, 'Root node right_child must be null');

console.log('✅ Passed: Root binary node is correctly configured for Main Admin (NAMOBUDDHAYA)');

console.log('\n================================================================');
console.log('🎉 ALL STEP 70 TESTS PASSED SUCCESSFULLY (5/5)');
console.log('================================================================\n');
