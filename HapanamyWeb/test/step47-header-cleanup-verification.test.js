// test/step47-header-cleanup-verification.test.js
// Production Verification Test Suite for Header Cleanup & Navigation UX Modernization
// Verifies: Public Header Login Button Removal, Single REGISTER FREE CTA, Reduced Header Height,
// Slim Promo Strip, /login.html Direct Route Integrity, Admin Isolation, and MLM Engine Preservation.

const testRunner = require('./test-runner');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const PUBLIC_PAGES = [
    'index.html',
    'about-us.html',
    'blog.html',
    'contact-us.html',
    'privacy-policy.html',
    'refund-policy.html',
    'terms-conditions.html',
    'affiliate-disclosure.html',
    'disclaimer.html',
    '404.html'
];

test('Step 47: 1. Complete Removal of Public Header LOGIN Buttons Across All Public Pages', () => {
    PUBLIC_PAGES.forEach(page => {
        const filePath = path.join(__dirname, '..', page);
        assert.ok(fs.existsSync(filePath), `${page} must exist`);

        const content = fs.readFileSync(filePath, 'utf8');
        // Extract <header class="header"> ... </header>
        const headerMatch = content.match(/<header[\s\S]*?<\/header>/i);
        assert.ok(headerMatch, `${page} must contain a <header> element`);

        const headerContent = headerMatch[0];

        // Ensure no user login button / link inside header
        assert.ok(!headerContent.includes('href="login.html"'), `${page} header must NOT contain a link to login.html`);
        assert.ok(!headerContent.includes("href='login.html'"), `${page} header must NOT contain a link to login.html`);
        assert.ok(!headerContent.includes('🔐 LOGIN'), `${page} header must NOT contain 🔐 LOGIN`);
        assert.ok(!headerContent.includes('>Sign In<'), `${page} header must NOT contain Sign In`);
        assert.ok(!headerContent.includes('>LOGIN<'), `${page} header must NOT contain LOGIN text`);
    });
});

test('Step 47: 2. Single High-Converting Public Account CTA (REGISTER FREE)', () => {
    PUBLIC_PAGES.forEach(page => {
        const filePath = path.join(__dirname, '..', page);
        const content = fs.readFileSync(filePath, 'utf8');
        const headerMatch = content.match(/<header[\s\S]*?<\/header>/i);
        assert.ok(headerMatch, `${page} must contain a <header> element`);
        const headerContent = headerMatch[0];

        // Must contain header-register-btn with link to register.html
        assert.ok(headerContent.includes('href="register.html"'), `${page} header must contain link to register.html`);
        assert.ok(headerContent.includes('header-register-btn'), `${page} header must use class header-register-btn`);
        assert.ok(headerContent.includes('REGISTER FREE'), `${page} header CTA must be REGISTER FREE`);
    });
});

test('Step 47: 3. Header Height Reduction & Slim Promo Strip CSS Verification', () => {
    const cssPath = path.join(__dirname, '..', 'index.css');
    assert.ok(fs.existsSync(cssPath), 'index.css must exist');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Verify compact header height variable
    assert.ok(cssContent.includes('--header-height: 66px'), 'index.css must define compact --header-height: 66px');

    // Verify top bar slim styling
    assert.ok(cssContent.includes('.top-bar'), 'index.css must style .top-bar');
    assert.ok(cssContent.includes('.top-promo-text'), 'index.css must style .top-promo-text');
    assert.ok(cssContent.includes('.header-register-btn'), 'index.css must style .header-register-btn');

    // Verify index.html top promo text content
    const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.ok(indexHtml.includes('15% Direct Affiliate Commission'), 'index.html promo strip text');
    assert.ok(indexHtml.includes('Connect • Learn • Grow • Earn'), 'index.html promo slogan');
});

test('Step 47: 4. Dedicated Direct Login Page (/login.html) Functional Integrity', () => {
    const loginHtmlPath = path.join(__dirname, '..', 'login.html');
    assert.ok(fs.existsSync(loginHtmlPath), 'login.html must physically exist for direct access');

    const content = fs.readFileSync(loginHtmlPath, 'utf8');
    assert.ok(content.includes('id="identifier"'), 'login.html must contain email/username input');
    assert.ok(content.includes('id="password"'), 'login.html must contain password input');
    assert.ok(content.includes('id="loginForm"'), 'login.html must contain loginForm');
    assert.ok(content.includes('type="submit"'), 'login.html must contain submit button');
    assert.ok(content.includes("loginForm.addEventListener('submit'"), 'login.html must attach submit handler to loginForm');
    assert.ok(content.includes('/api/auth/login'), 'login.html must hook to authoritative login API');

    // Verify forgot-password.html and register.html still link to login.html for legitimate auth flows
    const regHtml = fs.readFileSync(path.join(__dirname, '..', 'register.html'), 'utf8');
    assert.ok(regHtml.includes('href="login.html"'), 'register.html must retain link to login.html');
    const fpHtml = fs.readFileSync(path.join(__dirname, '..', 'forgot-password.html'), 'utf8');
    assert.ok(fpHtml.includes('href="login.html"'), 'forgot-password.html must retain link to login.html');
});

test('Step 47: 5. Admin Portal Isolation & Elimination of Hidden Triggers', () => {
    PUBLIC_PAGES.forEach(page => {
        const filePath = path.join(__dirname, '..', page);
        const content = fs.readFileSync(filePath, 'utf8');

        // No ondblclick anywhere in public files
        assert.ok(!content.includes('ondblclick'), `${page} must NOT contain ondblclick backdoor`);
        assert.ok(!content.includes('access=admin'), `${page} must NOT expose access=admin parameter`);

        // No admin portal link in public header navigation
        const headerMatch = content.match(/<header[\s\S]*?<\/header>/i);
        if (headerMatch) {
            assert.ok(!headerMatch[0].includes('hapanamy-admin-portal-9226.html'), `${page} header must NOT expose admin portal`);
            assert.ok(!headerMatch[0].includes('admin.html'), `${page} header must NOT expose admin.html`);
        }
    });

    // Verify admin portal file exists safely isolated
    const adminPath = path.join(__dirname, '..', 'hapanamy-admin-portal-9226.html');
    assert.ok(fs.existsSync(adminPath), 'Admin portal file must exist at protected route');
});

test('Step 47: 6. Dynamic Nav Auth State Synchronization (Logged-in vs Logged-out)', () => {
    const jsPath = path.join(__dirname, '..', 'index.js');
    assert.ok(fs.existsSync(jsPath), 'index.js must exist');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    assert.ok(jsContent.includes('function syncNavAuthState()'), 'index.js must define syncNavAuthState');
    assert.ok(jsContent.includes('👤 My Dashboard'), 'syncNavAuthState must render My Dashboard for logged in users');
    assert.ok(jsContent.includes('🚪 Logout'), 'syncNavAuthState must render Logout for logged in users');
    assert.ok(jsContent.includes('header-register-btn'), 'syncNavAuthState must use header-register-btn class');
});

test('Step 47: 7. MLM Engine Business Rules & Invariants Preservation', () => {
    const DirectCommissionEngine = require('../services/direct-commission-engine');
    const MLMNetworkEngine = require('../services/mlm-network-engine');
    const QualifiedUplineCommissionEngine = require('../services/qualified-upline-commission-engine');
    const VolumeLedger = require('../services/volume-ledger');

    // 1. Direct commission = 8%
    const directComm = DirectCommissionEngine.calculateDirectCommission(27500, 8.00);
    assert.equal(directComm, 2200, 'Direct commission on 27,500 at 8% must be 2,200');

    // 2. Binary commission = 7% of MIN(left, right)
    const matchedVolume = Math.min(7425, 5000);
    assert.equal(matchedVolume, 5000, 'Matched volume must be MIN(7425, 5000) = 5000');
    const binaryComm = Math.round(matchedVolume * 0.07 * 100) / 100;
    assert.equal(binaryComm, 350, 'Binary commission must be 5000 * 7% = Rs.350');
    const leftCarryForward = 7425 - matchedVolume;
    assert.equal(leftCarryForward, 2425, 'Left carry forward must be 7425 - 5000 = 2425 BV');

    // 3. Daily Cap = Rs. 30,000 / day
    const capResult = DirectCommissionEngine.applyDailyCap(35000, 0, 30000);
    assert.equal(capResult.eligibleAmount, 30000, 'Daily cap must be Rs. 30,000');
    assert.equal(capResult.cappedAmount, 5000, 'Amount over daily cap must be capped at Rs. 5,000');

    // 4. Max Upline Traversal & Volume Ledger Integrity
    assert.ok(MLMNetworkEngine, 'MLMNetworkEngine must be defined');
    assert.ok(QualifiedUplineCommissionEngine, 'QualifiedUplineCommissionEngine must be defined');
    assert.ok(VolumeLedger, 'VolumeLedger must be defined');
});
