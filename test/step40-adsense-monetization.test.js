// Hapanamy.lk Step 40: Google AdSense Integration & Monetization Safety Test Suite
// Verifies: ads.txt Reachability & Google Format, Centralized AdSense Config,
// Strict Exclusion of Dashboard/Admin/Checkout/Auth, CSP AdSense Whitelist,
// Privacy Policy Ad Disclosures, and Cookie Consent Engine.

const testRunner = require('./test-runner');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const SecurityCore = require('../services/security-core');
const { HAPANAMY_ADSENSE_CONFIG, isEligiblePage } = require('../adsense-config');

test('Step 40: 1. ads.txt Root File & Standard Google Format Verification', () => {
    const adsTxtPath = path.join(__dirname, '..', 'ads.txt');
    assert.ok(fs.existsSync(adsTxtPath), 'ads.txt must physically exist in website root');

    const content = fs.readFileSync(adsTxtPath, 'utf8').trim();
    assert.ok(content.startsWith('google.com, pub-'), 'ads.txt must contain standard Google format');
    assert.ok(content.includes('DIRECT, f08c47fec0942fa0'), 'ads.txt must include direct publisher tag and Google certification authority ID');
});

test('Step 40: 2. Centralized AdSense Configuration & Safe Placeholder Handling', () => {
    assert.ok(HAPANAMY_ADSENSE_CONFIG, 'HAPANAMY_ADSENSE_CONFIG must be defined');
    assert.ok(HAPANAMY_ADSENSE_CONFIG.publisherId.includes('YOUR_ADSENSE_PUBLISHER_ID'), 'Must use configurable placeholder ca-pub-YOUR_ADSENSE_PUBLISHER_ID');
    assert.equal(HAPANAMY_ADSENSE_CONFIG.enabled, true, 'AdSense integration enabled state');
    assert.ok(HAPANAMY_ADSENSE_CONFIG.units.TOP_CONTENT_AD, 'Must configure TOP_CONTENT_AD unit');
    assert.ok(HAPANAMY_ADSENSE_CONFIG.units.CONTENT_BOTTOM_AD, 'Must configure CONTENT_BOTTOM_AD unit');
});

test('Step 40: 3. Strict Isolation: Blocked Financial, Auth & Admin Routes', () => {
    const blockedRoutes = [
        '/login',
        '/login.html',
        '/register',
        '/register.html',
        '/dashboard',
        '/dashboard.html',
        '/hapanamy-admin-portal-9226.html',
        '/admin',
        '/checkout',
        '/checkout.html',
        '/student-dashboard',
        '/my-account'
    ];

    blockedRoutes.forEach(route => {
        global.window = { location: { pathname: route } };
        const eligible = isEligiblePage(route);
        assert.equal(eligible, false, 'Route ' + route + ' must be strictly EXCLUDED from advertising');
    });
});

test('Step 40: 4. Approved Public Content Pages Eligibility', () => {
    const approvedRoutes = [
        '/',
        '/index.html',
        '/blog.html',
        '/about-us.html',
        '/contact-us.html',
        '/privacy-policy.html',
        '/terms-conditions.html',
        '/refund-policy.html',
        '/disclaimer.html',
        '/affiliate-disclosure.html'
    ];

    approvedRoutes.forEach(route => {
        global.window = { location: { pathname: route } };
        const eligible = isEligiblePage(route);
        assert.equal(eligible, true, 'Public route ' + route + ' must be ELIGIBLE for advertising');
    });
});

test('Step 40: 5. Content Security Policy (CSP) AdSense Domains Compatibility', () => {
    const headers = SecurityCore.getSecurityHeaders(true);
    const csp = headers['Content-Security-Policy'];

    assert.ok(csp.includes('pagead2.googlesyndication.com'), 'CSP script-src must allow pagead2.googlesyndication.com');
    assert.ok(csp.includes('googleads.g.doubleclick.net'), 'CSP frame-src must allow googleads.g.doubleclick.net');
});

test('Step 40: 6. Privacy Policy Google Advertising & DoubleClick Cookie Disclosures', () => {
    const privacyPath = path.join(__dirname, '..', 'privacy-policy.html');
    const privacyContent = fs.readFileSync(privacyPath, 'utf8');

    assert.ok(privacyContent.includes('Google AdSense'), 'Privacy Policy must disclose Google AdSense');
    assert.ok(privacyContent.includes('DoubleClick'), 'Privacy Policy must disclose DoubleClick/advertising cookies');
    assert.ok(privacyContent.includes('adssettings.google.com'), 'Privacy Policy must provide Google Ads Settings opt-out link');
});

test('Step 40: 7. Privacy & Cookie Consent Engine Exists', () => {
    const cookieConsentPath = path.join(__dirname, '..', 'cookie-consent.js');
    assert.ok(fs.existsSync(cookieConsentPath), 'cookie-consent.js must exist in website root');

    const content = fs.readFileSync(cookieConsentPath, 'utf8');
    assert.ok(content.includes('hapanamy_cookie_consent_status'), 'Must manage consent status in localStorage');
});

if (require.main === module) {
    runTests();
}
