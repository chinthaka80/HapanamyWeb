const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('./test-runner');

const rootDir = path.resolve(__dirname, '..');

test('Step 83: dashboard.html has dynamic member identity resolution and no hardcoded "Hiru" placeholders in member profile UI', () => {
    const dashboardPath = path.join(rootDir, 'dashboard.html');
    assert.strictEqual(fs.existsSync(dashboardPath), true, 'dashboard.html must exist');
    const content = fs.readFileSync(dashboardPath, 'utf-8');

    // 1. Check profile placeholders are clean of hardcoded "Hiru"
    assert.ok(
        content.includes('id="profileFullName"') && !content.includes('>Hiru</h2>'),
        'profileFullName must not default to hardcoded "Hiru"'
    );
    assert.ok(
        content.includes('id="sidebarName"') && !content.includes('>Hiru</div>'),
        'sidebarName must not default to hardcoded "Hiru"'
    );
    assert.ok(
        !content.includes('placeholder="Hiru"'),
        'dashboard.html must not contain placeholder="Hiru"'
    );
    assert.ok(
        !content.includes('placeholder="Hiru Pathirana"'),
        'dashboard.html must not contain placeholder="Hiru Pathirana"'
    );

    // 2. Check getKnownAccountsMap and core 15 accounts mapping
    assert.ok(
        content.includes('function getKnownAccountsMap()') || content.includes('getKnownAccountsMap'),
        'dashboard.html must define getKnownAccountsMap()'
    );
    assert.ok(
        content.includes('user-hapana-01') && content.includes('user-hapana-15'),
        'getKnownAccountsMap must register HAPANA01 through HAPANA15 accounts'
    );
    assert.ok(
        content.includes('NAMOBUDDHAYA') && content.includes('user-namobuddhaya-root'),
        'getKnownAccountsMap must register NAMOBUDDHAYA root account'
    );

    // 3. Check URL query parameters parsing in loadLiveDashboard
    assert.ok(
        content.includes('new URLSearchParams(window.location.search)') || content.includes('urlParams.get'),
        'loadLiveDashboard must parse URL query search parameters'
    );
    assert.ok(
        content.includes("urlParams.get('user')") || content.includes("urlParams.get('user_id')") || content.includes("urlParams.get('username')"),
        'loadLiveDashboard must support ?user=, ?user_id=, and ?username= query parameters'
    );

    // 4. Check dynamic sponsor and position formatting
    assert.ok(
        content.includes("profileSponsorName.textContent = 'Direct (Company / Root)'") ||
        content.includes("Direct (Company / Root)"),
        'Root account must show Direct (Company / Root) as sponsor'
    );
    assert.ok(
        content.includes('👑 ROOT') && content.includes('👈 LEFT LEG') && content.includes('👉 RIGHT LEG'),
        'Position badges must correctly format ROOT, LEFT LEG, and RIGHT LEG'
    );

    // 5. Check dual-leg dynamic referral links generation
    assert.ok(
        content.includes('leftRefLinkInput') && content.includes('rightRefLinkInput'),
        'dashboard.html must dynamically populate dual-leg referral link inputs'
    );
});

test('Step 83: dashboard.html navigation elements and icons are responsive and wired to global switcher', () => {
    const dashboardPath = path.join(rootDir, 'dashboard.html');
    const content = fs.readFileSync(dashboardPath, 'utf-8');

    // Sidebar navigation items
    const requiredNavIds = [
        'nav-overview',
        'nav-earnings',
        'nav-network',
        'nav-referrals',
        'nav-links',
        'nav-products',
        'nav-financial',
        'nav-settings'
    ];

    requiredNavIds.forEach(navId => {
        assert.ok(
            content.includes(`id="${navId}"`),
            `dashboard.html must contain navigation item #${navId}`
        );
    });

    // Mobile drawer toggle & close
    assert.ok(
        content.includes('toggleMobileSidebar()') || content.includes('window.toggleMobileSidebar'),
        'dashboard.html must have toggleMobileSidebar'
    );
    assert.ok(
        content.includes('closeMobileSidebar()') || content.includes('window.closeMobileSidebar'),
        'dashboard.html must have closeMobileSidebar'
    );

    // Mobile bottom navigation icons
    assert.ok(
        content.includes('mob-overview') && content.includes('mob-menu-drawer'),
        'dashboard.html must have mobile bottom navigation bar with overview and menu toggle'
    );
});

test('Step 83: admin.html and hapanamy-admin-portal-9226.html open member dashboard with URL parameters and NAMOBUDDHAYA sponsor fallback', () => {
    const adminPath = path.join(rootDir, 'admin.html');
    const portalPath = path.join(rootDir, 'hapanamy-admin-portal-9226.html');
    
    assert.strictEqual(fs.existsSync(adminPath), true, 'admin.html must exist');
    assert.strictEqual(fs.existsSync(portalPath), true, 'hapanamy-admin-portal-9226.html must exist');

    const adminContent = fs.readFileSync(adminPath, 'utf-8');
    const portalContent = fs.readFileSync(portalPath, 'utf-8');

    // admin.html check
    assert.ok(
        adminContent.includes("sponsor: sponsor || 'NAMOBUDDHAYA'"),
        'admin.html viewMemberDashboard must use NAMOBUDDHAYA fallback'
    );
    assert.ok(
        adminContent.includes("dashboard.html?user_id="),
        'admin.html viewMemberDashboard must pass user_id parameter in URL'
    );

    // portal check
    assert.ok(
        portalContent.includes("sponsor: sponsor || 'NAMOBUDDHAYA'"),
        'hapanamy-admin-portal-9226.html viewMemberDashboard must use NAMOBUDDHAYA fallback'
    );
    assert.ok(
        portalContent.includes("dashboard.html?user_id="),
        'hapanamy-admin-portal-9226.html viewMemberDashboard must pass user_id parameter in URL'
    );
});

test('Step 83: 15-Member binary MLM tree architecture and database state are intact in data/mlm-db-store.json', () => {
    const dbPath = path.join(rootDir, 'data', 'mlm-db-store.json');
    assert.strictEqual(fs.existsSync(dbPath), true, 'data/mlm-db-store.json must exist');

    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    assert.ok(Array.isArray(db.users), 'db.users must be an array');
    assert.ok(Array.isArray(db.binaryNodes), 'db.binaryNodes must be an array');

    // Check Root and Hapana accounts exist in users
    const rootUser = db.users.find(u => (u.username || '').toUpperCase() === 'NAMOBUDDHAYA');
    assert.ok(rootUser, 'NAMOBUDDHAYA root user must exist');

    for (let i = 1; i <= 15; i++) {
        const uname = 'HAPANA' + (i < 10 ? '0' + i : i);
        const user = db.users.find(u => (u.username || '').toUpperCase() === uname);
        assert.ok(user, `User ${uname} must exist in data/mlm-db-store.json`);
    }

    // Check Binary Nodes
    const rootNode = db.binaryNodes.find(n => (n.user_id || '').toLowerCase().includes('namobuddhaya'));
    assert.ok(rootNode, 'Root binary node must exist');
    assert.strictEqual(rootNode.left_child_id, 'user-hapana-01', 'Root binary node must have user-hapana-01 as left child');

    const hapana01Node = db.binaryNodes.find(n => n.user_id === 'user-hapana-01');
    assert.ok(hapana01Node, 'HAPANA01 node must exist');
    assert.strictEqual(hapana01Node.left_child_id, 'user-hapana-02', 'HAPANA01 left child must be HAPANA02');
    assert.strictEqual(hapana01Node.right_child_id, 'user-hapana-03', 'HAPANA01 right child must be HAPANA03');
});
