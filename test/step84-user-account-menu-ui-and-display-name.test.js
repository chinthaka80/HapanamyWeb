const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('./test-runner');

const rootDir = path.resolve(__dirname, '..');

test('Step 84: index.js defines getUserDisplayName with authoritative priority (full_name > display_name > name > username > email)', () => {
    const jsPath = path.join(rootDir, 'index.js');
    assert.strictEqual(fs.existsSync(jsPath), true, 'index.js must exist');
    const content = fs.readFileSync(jsPath, 'utf-8');

    assert.ok(
        content.includes('function getUserDisplayName(user)'),
        'index.js must define getUserDisplayName function'
    );

    // Test priority logic in Node environment
    const fnMatch = content.match(/function getUserDisplayName\(user\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(fnMatch, 'getUserDisplayName must be extractable');

    const getUserDisplayName = new Function('user', fnMatch[1]);

    // Priority 1: full_name
    assert.strictEqual(
        getUserDisplayName({ full_name: 'Kasun Tharaka', display_name: 'Kasun D', name: 'Kasun', username: 'kasun2505' }),
        'Kasun Tharaka',
        'full_name must have highest priority'
    );

    // Priority 2: display_name
    assert.strictEqual(
        getUserDisplayName({ display_name: 'Kasun Display', name: 'Kasun', username: 'kasun2505' }),
        'Kasun Display',
        'display_name must be used if full_name is missing'
    );

    // Priority 3: name
    assert.strictEqual(
        getUserDisplayName({ name: 'Kasun Short', username: 'kasun2505' }),
        'Kasun Short',
        'name must be used if full_name and display_name are missing'
    );

    // Priority 4: username
    assert.strictEqual(
        getUserDisplayName({ username: 'maxsave2505', email: 'max@gmail.com' }),
        'maxsave2505',
        'username must be used if no formal names are present'
    );

    // Priority 5: email prefix
    assert.strictEqual(
        getUserDisplayName({ email: 'student123@hapanamy.lk' }),
        'student123',
        'email prefix must be used if username is also missing'
    );

    // Fallback when null or empty
    assert.strictEqual(
        getUserDisplayName(null),
        'Member Profile',
        'Fallback must be Member Profile only when no user object is present'
    );
});

test('Step 84: index.js syncNavAuthState creates interactive account dropdown with accessibility and complete menu items', () => {
    const jsPath = path.join(rootDir, 'index.js');
    const content = fs.readFileSync(jsPath, 'utf-8');

    // 1. Check toggle button structure and accessibility attributes
    assert.ok(
        content.includes('user-account-toggle-btn') &&
        content.includes('aria-haspopup="menu"') &&
        content.includes('aria-expanded'),
        'syncNavAuthState must render semantic toggle button with aria-haspopup and aria-expanded'
    );

    // 2. Check avatar, display name, and chevron
    assert.ok(
        content.includes('user-account-avatar') &&
        content.includes('user-account-name') &&
        content.includes('user-account-chevron'),
        'Toggle button must contain avatar, display name, and dropdown chevron'
    );

    // 3. Check dropdown menu options
    const requiredMenuItems = [
        '👤 My Dashboard',
        'Profile',
        'My Learning',
        'My Team',
        'Wallet',
        'Settings',
        '🚪 Logout'
    ];

    requiredMenuItems.forEach(item => {
        assert.ok(
            content.includes(item),
            `Dropdown menu must contain "${item}" option`
        );
    });

    // 4. Check setupUserAccountDropdown interactivity handler
    assert.ok(
        content.includes('function setupUserAccountDropdown()') || content.includes('setupUserAccountDropdown'),
        'index.js must define setupUserAccountDropdown handler'
    );
    assert.ok(
        content.includes('toggleBtn.onclick') && content.includes('wrapper.contains(e.target)'),
        'setupUserAccountDropdown must handle click toggle and outside click dismiss'
    );
    assert.ok(
        content.includes("e.key === 'Escape'") && (content.includes("e.key === 'Enter'") || content.includes("e.key === ' '")),
        'setupUserAccountDropdown must support keyboard navigation (Enter, Space, Escape)'
    );
});

test('Step 84: index.css contains responsive styles for user account toggle button and dropdown menu', () => {
    const cssPath = path.join(rootDir, 'index.css');
    assert.strictEqual(fs.existsSync(cssPath), true, 'index.css must exist');
    const content = fs.readFileSync(cssPath, 'utf-8');

    // Check CSS classes
    assert.ok(content.includes('.user-account-menu-wrapper'), 'index.css must contain .user-account-menu-wrapper');
    assert.ok(content.includes('.user-account-toggle-btn'), 'index.css must contain .user-account-toggle-btn');
    assert.ok(content.includes('.user-account-name'), 'index.css must contain .user-account-name with truncation');
    assert.ok(content.includes('.user-account-dropdown'), 'index.css must contain .user-account-dropdown');
    assert.ok(content.includes('.user-account-dropdown.open'), 'index.css must contain .user-account-dropdown.open');
    assert.ok(content.includes('.user-account-dropdown-item'), 'index.css must contain .user-account-dropdown-item');
    assert.ok(content.includes('text-overflow: ellipsis'), 'index.css must prevent header overflow with text truncation');
});

test('Step 84: Cross-user identity isolation & synchronous local session restore', () => {
    const jsPath = path.join(rootDir, 'index.js');
    const content = fs.readFileSync(jsPath, 'utf-8');

    // Verify handleGlobalLogout thoroughly clears all session keys
    assert.ok(
        content.includes("localStorage.removeItem('active_user')") &&
        content.includes("localStorage.removeItem('auth_token')") &&
        content.includes("localStorage.removeItem('active_token')") &&
        content.includes("localStorage.removeItem('hapanamy_user_profile')"),
        'handleGlobalLogout must completely purge all user session keys to ensure strict cross-user isolation'
    );
});

test('Step 84: Core MLM business invariants and persistence integrity preserved', () => {
    const DirectCommissionEngine = require('../services/direct-commission-engine');
    const QualifiedUplineCommissionEngine = require('../services/qualified-upline-commission-engine');

    // 8% Direct Commission invariant
    const directComm = DirectCommissionEngine.calculateDirectCommission(4500, 8.00);
    assert.strictEqual(directComm, 360.00, 'Direct commission on Rs. 4,500 must remain exactly Rs. 360.00 (8%)');

    // 7% Binary Volume matching invariant
    const binaryComm = QualifiedUplineCommissionEngine.calculateBinaryCommission(4500, 7.00);
    assert.strictEqual(binaryComm, 315.00, 'Binary commission on 4,500 BV must remain exactly Rs. 315.00 (7%)');
});

test('Step 84: User Account Menu Toggle Click Handler & Pointer Event Invariants', () => {
    const jsPath = path.join(rootDir, 'index.js');
    const cssPath = path.join(rootDir, 'index.css');
    const jsContent = fs.readFileSync(jsPath, 'utf-8');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // 1. toggleUserAccountDropdown defined and exported
    assert.ok(
        jsContent.includes('function toggleUserAccountDropdown'),
        'index.js must define toggleUserAccountDropdown function'
    );
    assert.ok(
        jsContent.includes('window.toggleUserAccountDropdown = toggleUserAccountDropdown'),
        'toggleUserAccountDropdown must be exposed on window'
    );

    // 2. Inline onclick binding on toggle button
    assert.ok(
        jsContent.includes('onclick="window.toggleUserAccountDropdown && window.toggleUserAccountDropdown(event)"'),
        'userAccountMenuToggle button must have inline onclick handler for immediate click responsiveness'
    );

    // 3. Pointer events safety on child elements in CSS
    assert.ok(
        cssContent.includes('.user-account-avatar') && cssContent.includes('pointer-events: none'),
        'user-account-avatar must have pointer-events: none to avoid child element click interception'
    );
    assert.ok(
        cssContent.includes('.user-account-name') && cssContent.includes('pointer-events: none'),
        'user-account-name must have pointer-events: none to avoid child element click interception'
    );
    assert.ok(
        cssContent.includes('.user-account-chevron') && cssContent.includes('pointer-events: none'),
        'user-account-chevron must have pointer-events: none to avoid child element click interception'
    );
});

test('Step 84: Universal Cross-Page Navbar Auth Synchronization (nav-auth.js included across all consumer pages)', () => {
    const navAuthPath = path.join(rootDir, 'nav-auth.js');
    assert.strictEqual(fs.existsSync(navAuthPath), true, 'nav-auth.js must exist');
    const navAuthContent = fs.readFileSync(navAuthPath, 'utf-8');

    assert.ok(navAuthContent.includes('function getUserDisplayName'), 'nav-auth.js must define getUserDisplayName');
    assert.ok(navAuthContent.includes('function toggleUserAccountDropdown'), 'nav-auth.js must define toggleUserAccountDropdown');
    assert.ok(navAuthContent.includes('function setupUserAccountDropdown'), 'nav-auth.js must define setupUserAccountDropdown');
    assert.ok(navAuthContent.includes('function syncNavAuthState'), 'nav-auth.js must define syncNavAuthState');
    assert.ok(navAuthContent.includes('function handleGlobalLogout'), 'nav-auth.js must define handleGlobalLogout');

    const pagesWithHeader = [
        'index.html',
        'courses.html',
        'about-us.html',
        'affiliate.html',
        'affiliate-disclosure.html',
        'blog.html',
        'contact-us.html',
        'contact.html',
        'disclaimer.html',
        'earnings-calculator.html',
        'privacy-policy.html',
        'refund-policy.html',
        'terms-conditions.html',
        'testimonials.html',
        '404.html'
    ];

    pagesWithHeader.forEach(page => {
        const pagePath = path.join(rootDir, page);
        assert.strictEqual(fs.existsSync(pagePath), true, `${page} must exist`);
        const content = fs.readFileSync(pagePath, 'utf-8');
        assert.ok(
            content.includes('id="headerAuthButtons"'),
            `${page} must contain #headerAuthButtons container`
        );
        assert.ok(
            content.includes('nav-auth.js'),
            `${page} must include nav-auth.js to enable cross-page dropdown and auth state synchronization`
        );
    });
});


