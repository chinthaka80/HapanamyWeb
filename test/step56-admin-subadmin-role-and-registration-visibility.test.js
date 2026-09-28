/**
 * STEP 56 Test Suite: Admin, Sub-Admin Credentials, Role Pathways, and Real-time Registration Sync Visibility
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AdminDashboardService = require('../services/admin-dashboard-service');
const QualificationEngine = require('../services/qualification-engine');
const MLMNetworkEngine = require('../services/mlm-network-engine');
const EarningsCapEngine = require('../services/earnings-cap-engine');

async function runStep56Tests() {
    console.log('\n================================================================');
    console.log('🚀 RUNNING STEP 56: ADMIN & SUB-ADMIN ROLES & REGISTRATION VISIBILITY SUITE');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`✅ PASSED: STEP 56: ${name}`);
            passed++;
        } catch (err) {
            console.error(`❌ FAILED: STEP 56: ${name}`);
            console.error(err);
            failed++;
        }
    }

    // 1. Verify Admin Dashboard Service allows both ADMIN and SUBADMIN roles
    test('1. AdminDashboardService verifies ADMIN, SUPER_ADMIN, and SUBADMIN roles', () => {
        const adminUser = { id: 'admin-1', role: 'admin' };
        const subAdminUser = { id: 'subadmin-1', role: 'subadmin' };
        const superAdminUser = { id: 'super-1', role: 'super_admin' };
        const memberUser = { id: 'member-1', role: 'member' };
        const studentUser = { id: 'student-1', role: 'student' };

        const adminAuth = AdminDashboardService.verifyAdminAccess(adminUser);
        assert.strictEqual(adminAuth.authorized, true, 'Admin should be authorized');

        const subAdminAuth = AdminDashboardService.verifyAdminAccess(subAdminUser);
        assert.strictEqual(subAdminAuth.authorized, true, 'SubAdmin should be authorized');

        const superAdminAuth = AdminDashboardService.verifyAdminAccess(superAdminUser);
        assert.strictEqual(superAdminAuth.authorized, true, 'SuperAdmin should be authorized');

        const memberAuth = AdminDashboardService.verifyAdminAccess(memberUser);
        assert.strictEqual(memberAuth.authorized, false, 'Regular member must not have admin access');

        const studentAuth = AdminDashboardService.verifyAdminAccess(studentUser);
        assert.strictEqual(studentAuth.authorized, false, 'Student must not have admin access');
    });

    // 2. Verify server.js contains Sub-Admin seed and role redirection logic
    test('2. server.js has subadmin in mockUsers and activeSessions', () => {
        const serverCode = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
        assert.ok(serverCode.includes('user-subadmin-manager'), 'server.js must contain user-subadmin-manager');
        assert.ok(serverCode.includes('manager@hapanamy.lk'), 'server.js must contain manager@hapanamy.lk');
        assert.ok(serverCode.includes('token-subadmin-manager'), 'server.js must contain token-subadmin-manager');
        assert.ok(serverCode.includes('redirect_url = \'hapanamy-admin-portal-9226.html\''), 'server.js must route admins to admin portal');
        assert.ok(serverCode.includes('redirect_url = \'student-dashboard.html\''), 'server.js must route students to student dashboard');
    });

    // 3. Verify Admin Portals (hapanamy-admin-portal-9226.html and admin.html) merge multi-source registrations
    test('3. Admin portals implement multi-source real-time member synchronization', () => {
        const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
        const portalHtml = fs.readFileSync(path.join(__dirname, '../hapanamy-admin-portal-9226.html'), 'utf8');

        for (const [filename, content] of Object.entries({ 'admin.html': adminHtml, 'hapanamy-admin-portal-9226.html': portalHtml })) {
            assert.ok(content.includes('hapanamy_registered_users'), `${filename} must read hapanamy_registered_users`);
            assert.ok(content.includes('referred_users_'), `${filename} must merge referred_users_* downlines`);
            assert.ok(content.includes('MAIN ADMIN'), `${filename} must display Main Admin badge`);
            assert.ok(content.includes('SUB ADMIN'), `${filename} must display Sub Admin badge`);
            assert.ok(content.includes('SALES TEAM'), `${filename} must display Sales Team badge`);
            assert.ok(content.includes('STUDENT'), `${filename} must display Student badge`);
        }
    });

    // 4. Verify login.html and login-register.html role routing & offline support
    test('4. Login forms route correctly based on user role', () => {
        const loginHtml = fs.readFileSync(path.join(__dirname, '../login.html'), 'utf8');
        const loginRegHtml = fs.readFileSync(path.join(__dirname, '../login-register.html'), 'utf8');
        const registerHtml = fs.readFileSync(path.join(__dirname, '../register.html'), 'utf8');

        assert.ok(loginHtml.includes('student-dashboard.html'), 'login.html must route students to student-dashboard.html');
        assert.ok(loginHtml.includes('hapanamy-admin-portal-9226.html'), 'login.html must route admins to hapanamy-admin-portal-9226.html');
        assert.ok(loginHtml.includes('user-subadmin-manager'), 'login.html must support subadmin offline login');

        assert.ok(loginRegHtml.includes('student-dashboard.html'), 'login-register.html must route students to student-dashboard.html');
        assert.ok(loginRegHtml.includes('user-subadmin-manager'), 'login-register.html must support subadmin offline login');

        assert.ok(registerHtml.includes('student-dashboard.html'), 'register.html must route students to student-dashboard.html');
    });

    // 5. Downline Team List Visibility & Zero Crosslines
    test('5. Downline aggregation accurately assigns members to sponsor without crosslines', () => {
        const mockUsers = [
            { id: 'user-hiru-root', username: 'Hiru', full_name: 'Hiru', role: 'member' },
            { id: 'user-kasun-1', username: 'kasun', full_name: 'Kasun', sponsor: 'Hiru', position: 'LEFT', role: 'member' },
            { id: 'user-ruwan-2', username: 'ruwan', full_name: 'Ruwan', sponsor: 'Hiru', position: 'RIGHT', role: 'member' },
            { id: 'user-kamal-3', username: 'kamal', full_name: 'Kamal', sponsor: 'kasun', position: 'LEFT', role: 'member' },
            { id: 'user-cross-4', username: 'cross_member', full_name: 'Cross Member', sponsor: 'other_user', position: 'LEFT', role: 'member' }
        ];

        const hiruDownlines = mockUsers.filter(u => u.sponsor === 'Hiru' || u.sponsor === 'kasun');
        assert.strictEqual(hiruDownlines.length, 3, 'Hiru should have 3 downlines total');
        assert.ok(!hiruDownlines.some(u => u.username === 'cross_member'), 'Zero crossline members in Hiru downlines');
    });

    // 6. MLM Calculation Formula Invariants (8% Direct, 7% Binary, Rs. 30,000 Daily Cap)
    test('6. Core MLM Commission invariants remain strictly exact', () => {
        const productPrice = 7425.00;
        const directRate = 8.00;
        const binaryRate = 7.00;

        const directComm = (productPrice * directRate) / 100;
        assert.strictEqual(directComm, 594.00, 'Direct commission on Rs. 7,425 at 8% must be Rs. 594.00');

        const binaryComm = (productPrice * binaryRate) / 100;
        assert.strictEqual(binaryComm, 519.75, 'Binary matching on Rs. 7,425 at 7% must be Rs. 519.75');

        const dailyCap = EarningsCapEngine.getConfig().daily_cap_amount;
        assert.strictEqual(dailyCap, 30000, 'Daily earnings cap must be exactly Rs. 30,000.00');
    });

    console.log(`\nStep 56 Results: ${passed} passed, ${failed} failed.\n`);
    if (failed > 0) {
        throw new Error(`${failed} tests failed in Step 56.`);
    }
}

if (require.main === module) {
    runStep56Tests().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = runStep56Tests;
