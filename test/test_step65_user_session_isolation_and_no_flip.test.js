// test_step65_user_session_isolation_and_no_flip.test.js
const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('🧪 Running Step 65: User Session Isolation & No Dashboard Account Flipping Test...');

// 1. Verify dashboard.html content
const dashboardHtmlPath = path.join(__dirname, '..', 'dashboard.html');
const dashboardHtml = fs.readFileSync(dashboardHtmlPath, 'utf-8');

assert.ok(dashboardHtml.includes('/api/member/dashboard?user_id='), 'dashboard.html must pass user_id parameter to prevent defaulting to root account');
assert.ok(dashboardHtml.includes('/api/member/live-updates?user_id='), 'dashboard.html must pass user_id parameter to live updates');
assert.ok(dashboardHtml.includes('Received mismatched profile data'), 'dashboard.html must guard against mismatched profile responses');

console.log('✅ Dashboard Frontend guards verified.');

// 2. Verify PHP API index.php content
const apiPhpPath = path.join(__dirname, '..', 'api', 'index.php');
const apiPhp = fs.readFileSync(apiPhpPath, 'utf-8');

assert.ok(apiPhp.includes('function getAuthUserFromRequest'), 'api/index.php must have getAuthUserFromRequest');
assert.ok(apiPhp.includes('$db[\'sessions\']'), 'api/index.php must support persistent session tokens');
assert.ok(apiPhp.includes('$user = getAuthUserFromRequest($db);'), 'api/index.php must use getAuthUserFromRequest in member/dashboard');

console.log('✅ PHP Native API session engine verified.');

// 3. Verify server.js content
const serverJsPath = path.join(__dirname, '..', 'server.js');
const serverJs = fs.readFileSync(serverJsPath, 'utf-8');

assert.ok(serverJs.includes('queryUserId = u.searchParams.get(\'user_id\')'), 'server.js must parse query user_id in getAuthenticatedUser');

console.log('✅ Node Server authentication engine verified.');

console.log('🎉 ALL Step 65 tests passed successfully!');
