const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('./test-runner');

const rootDir = path.resolve(__dirname, '..');

test('Step 82: dashboard.html has responsive mobile menu drawer, backdrop, hamburger toggle, and global tab switcher', () => {
    const dashboardPath = path.join(rootDir, 'dashboard.html');
    assert.strictEqual(fs.existsSync(dashboardPath), true, 'dashboard.html must exist');
    const content = fs.readFileSync(dashboardPath, 'utf-8');

    // Check Mobile Menu Toggle Button in Topbar
    assert.ok(
        content.includes('mobileMenuToggleBtn') || content.includes('mobile-menu-toggle-btn'),
        'dashboard.html must have mobile menu toggle button'
    );

    // Check Backdrop
    assert.ok(
        content.includes('sidebar-backdrop') && content.includes('sidebarBackdrop'),
        'dashboard.html must have sidebar backdrop'
    );

    // Check Sidebar Close Button
    assert.ok(
        content.includes('closeMobileSidebar()') || content.includes('&times;'),
        'dashboard.html must have sidebar close button'
    );

    // Check Mobile Bottom Nav
    assert.ok(
        content.includes('mobile-bottom-nav') &&
        (content.includes('mob-overview') || content.includes('mob-nav-overview')) &&
        (content.includes('mob-menu-drawer') || content.includes('mob-nav-menu')),
        'dashboard.html must have mobile bottom navigation with quick tabs and menu drawer toggle'
    );

    // Check global window functions
    assert.ok(
        content.includes('window.switchMemberTab = function') || content.includes('window.switchMemberTab = switchMemberTab'),
        'dashboard.html must expose switchMemberTab'
    );
    assert.ok(
        content.includes('window.toggleMobileSidebar = function') || content.includes('window.toggleMobileSidebar = toggleMobileSidebar'),
        'dashboard.html must expose toggleMobileSidebar'
    );
    assert.ok(
        content.includes('window.closeMobileSidebar = function') || content.includes('window.closeMobileSidebar = closeMobileSidebar'),
        'dashboard.html must expose closeMobileSidebar'
    );

    // Check Tab Targets exist
    const tabs = ['overview', 'earnings', 'network', 'products', 'settings'];
    tabs.forEach(tab => {
        assert.ok(
            content.includes(`id="panel-${tab}"`) || content.includes(`panel-${tab}`),
            `dashboard.html must contain panel-${tab}`
        );
    });
});

test('Step 82: student-dashboard.html has responsive mobile drawer, backdrop, hamburger toggle, and global tab switcher', () => {
    const studentDashboardPath = path.join(rootDir, 'student-dashboard.html');
    assert.strictEqual(fs.existsSync(studentDashboardPath), true, 'student-dashboard.html must exist');
    const content = fs.readFileSync(studentDashboardPath, 'utf-8');

    // Check Mobile Menu Toggle Button in Topbar
    assert.ok(
        content.includes('mobileStudentMenuBtn') || content.includes('student-mobile-menu-btn'),
        'student-dashboard.html must have student mobile menu toggle button'
    );

    // Check Backdrop
    assert.ok(
        content.includes('sidebar-backdrop') && content.includes('studentSidebarBackdrop'),
        'student-dashboard.html must have student sidebar backdrop'
    );

    // Check Sidebar Close Button
    assert.ok(
        content.includes('student-sidebar-close-btn') || content.includes('closeMobileStudentSidebar()'),
        'student-dashboard.html must have student sidebar close button'
    );

    // Check Mobile Bottom Nav with Menu item
    assert.ok(
        content.includes('mobile-bottom-nav') && content.includes('mob-nav-dashboard') && content.includes('mob-nav-menu'),
        'student-dashboard.html must have mobile bottom navigation'
    );

    // Check global window functions
    assert.ok(
        content.includes('window.switchStudentTab = switchStudentTab') &&
        content.includes('window.toggleMobileStudentSidebar = toggleMobileStudentSidebar') &&
        content.includes('window.closeMobileStudentSidebar = closeMobileStudentSidebar'),
        'student-dashboard.html must expose switchStudentTab, toggleMobileStudentSidebar, and closeMobileStudentSidebar to global window'
    );

    // Check Tab Targets exist
    const tabs = ['dashboard', 'courses', 'live', 'ebooks', 'settings'];
    tabs.forEach(tab => {
        assert.ok(
            content.includes(`id="panel-${tab}"`) || content.includes(`panel-${tab}`),
            `student-dashboard.html must contain panel-${tab}`
        );
    });
});

test('Step 82: my-account.html has responsive mobile drawer, backdrop, hamburger toggle, and global tab switcher', () => {
    const myAccountPath = path.join(rootDir, 'my-account.html');
    assert.strictEqual(fs.existsSync(myAccountPath), true, 'my-account.html must exist');
    const content = fs.readFileSync(myAccountPath, 'utf-8');

    // Check Mobile Menu Toggle Button in Topbar
    assert.ok(
        content.includes('mobileAccountMenuBtn') || content.includes('mobile-menu-btn'),
        'my-account.html must have mobile menu toggle button'
    );

    // Check Backdrop
    assert.ok(
        content.includes('sidebar-backdrop') && content.includes('accountSidebarBackdrop'),
        'my-account.html must have sidebar backdrop'
    );

    // Check Sidebar Close Button
    assert.ok(
        content.includes('sidebar-close-btn') || content.includes('closeMobileAccountSidebar()'),
        'my-account.html must have sidebar close button'
    );

    // Check Mobile Bottom Nav with Menu item
    assert.ok(
        content.includes('mobile-bottom-nav') && content.includes('mob-nav-dashboard') && content.includes('mob-nav-menu'),
        'my-account.html must have mobile bottom navigation'
    );

    // Check global window functions
    assert.ok(
        content.includes('window.switchTab = switchTab') &&
        content.includes('window.toggleMobileAccountSidebar = toggleMobileAccountSidebar') &&
        content.includes('window.closeMobileAccountSidebar = closeMobileAccountSidebar'),
        'my-account.html must expose switchTab, toggleMobileAccountSidebar, and closeMobileAccountSidebar to global window'
    );

    // Check Tab Targets exist
    const tabs = ['dashboard', 'courses', 'links', 'network', 'payouts', 'settings'];
    tabs.forEach(tab => {
        assert.ok(
            content.includes(`id="panel-${tab}"`) || content.includes(`panel-${tab}`),
            `my-account.html must contain panel-${tab}`
        );
    });
});

test('Step 82: Synchronization between root portals and HapanamyWeb directory is 100% consistent', () => {
    const files = ['dashboard.html', 'student-dashboard.html', 'my-account.html'];
    files.forEach(file => {
        const rootFilePath = path.join(rootDir, file);
        const hapanamyFilePath = path.join(rootDir, 'HapanamyWeb', file);
        assert.strictEqual(fs.existsSync(rootFilePath), true, `${file} must exist in root`);
        assert.strictEqual(fs.existsSync(hapanamyFilePath), true, `${file} must exist in HapanamyWeb`);
        
        const rootContent = fs.readFileSync(rootFilePath, 'utf-8');
        const hapanamyContent = fs.readFileSync(hapanamyFilePath, 'utf-8');
        assert.strictEqual(rootContent, hapanamyContent, `${file} in root and HapanamyWeb must be identical`);
    });
});
