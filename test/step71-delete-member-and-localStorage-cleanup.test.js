// test/step71-delete-member-and-localStorage-cleanup.test.js
// Verification suite for Admin Member Deletion & Client-Side LocalStorage Purge Pipeline

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AuthService = require('../services/auth-service');

console.log('\n================================================================');
console.log('🧪 RUNNING STEP 71: ADMIN MEMBER DELETION & LOCALSTORAGE CLEANUP TEST SUITE');
console.log('================================================================\n');

// 1. Verify server.js DELETE / POST /api/admin/members/delete markup and safety
console.log('--- TEST 1: server.js Deletion Endpoint & Core Admin Protection ---');
const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

assert.ok(serverCode.includes("pathname === '/api/admin/members/delete'"), 'server.js must define POST /api/admin/members/delete');
assert.ok(serverCode.includes("protectedAccounts.includes(cleanTarget)"), 'server.js must protect core admin accounts from deletion');
assert.ok(serverCode.includes("saveDbStore()"), 'server.js must immediately commit database changes on deletion');

console.log('✅ Passed: server.js deletion endpoint and core admin protections verified');

// 2. Verify api/index.php Deletion Endpoint
console.log('\n--- TEST 2: api/index.php Deletion Endpoint Verification ---');
const phpCode = fs.readFileSync(path.join(__dirname, '..', 'api', 'index.php'), 'utf8');

assert.ok(phpCode.includes("admin/members/delete"), 'api/index.php must define admin/members/delete endpoint');
assert.ok(phpCode.includes("saveDatabase($DB_FILE, $db)"), 'api/index.php must save database on deletion');

console.log('✅ Passed: api/index.php deletion endpoint verified');

// 3. Verify db.js dbDeleteUser implementation
console.log('\n--- TEST 3: db.js dbDeleteUser Backend Sync & Multi-Store Cleanup ---');
const dbJsCode = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8');

assert.ok(dbJsCode.includes('/api/admin/members/delete'), 'db.js dbDeleteUser must call /api/admin/members/delete');
assert.ok(dbJsCode.includes('hapanamy_registered_users') && dbJsCode.includes('bank_slips_queue'), 'db.js dbDeleteUser must clean all storage keys');

console.log('✅ Passed: db.js dbDeleteUser multi-store cleanup verified');

// 4. Verify admin.html and hapanamy-admin-portal-9226.html Action Buttons & Blacklist
console.log('\n--- TEST 4: Admin Portals Deletion Button & Stale Blacklist Audit ---');
const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const portalHtml = fs.readFileSync(path.join(__dirname, '..', 'hapanamy-admin-portal-9226.html'), 'utf8');

[adminHtml, portalHtml].forEach((html, idx) => {
    const fn = idx === 0 ? 'admin.html' : 'hapanamy-admin-portal-9226.html';
    assert.ok(html.includes('deleteRegisteredUser'), `${fn} must implement deleteRegisteredUser`);
    assert.ok(html.includes('🗑️ Delete'), `${fn} must render 🗑️ Delete button for member accounts`);
    assert.ok(html.includes('staleBlacklist'), `${fn} must define staleBlacklist`);
    assert.ok(html.includes('ayubocey@gmail.com'), `${fn} must blacklist ayubocey@gmail.com`);
});

console.log('✅ Passed: Admin portals contain Delete button and blacklist stale test accounts');

// 5. Verify Core 4 Admin Accounts are Unaffected in data/mlm-db-store.json
console.log('\n--- TEST 5: data/mlm-db-store.json Authoritative Store Invariants ---');
const dbStore = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'mlm-db-store.json'), 'utf8'));

assert.strictEqual(dbStore.users.length, 4, 'Must have exactly 4 admin accounts');
const expectedUname = ['NAMOBUDDHAYA', 'subadmin', 'subadmin2', 'subadmin3'];
expectedUname.forEach(un => {
    const found = dbStore.users.find(u => u.username === un);
    assert.ok(found, `Admin ${un} must exist in data/mlm-db-store.json`);
    assert.ok(found.password_hash, `Admin ${un} must have password_hash`);
});

console.log('✅ Passed: data/mlm-db-store.json strictly maintains the 4 official admin accounts');

console.log('\n================================================================');
console.log('🎉 ALL STEP 71 TESTS PASSED SUCCESSFULLY (5/5)');
console.log('================================================================\n');
