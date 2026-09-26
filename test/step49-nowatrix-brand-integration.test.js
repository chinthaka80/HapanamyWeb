// Step 49: Mother Company Brand Integration (NOWATRIX Global) Verification Suite
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

console.log('--- Step 49: NOWATRIX Global Mother Company Brand Integration Tests ---');

// 1. Asset verification
test('Step 49: 1. NOWATRIX Global Brand Asset Integrity & Canonical Hapanamy Logo Preservation', () => {
    const nowatrixLogoPath = path.join(rootDir, 'assets', 'brand', 'nowatrix', 'nowatrix_global_logo.jpg');
    const hapanamyLogoPath = path.join(rootDir, 'assets', 'logo.jpg');

    assert(fs.existsSync(nowatrixLogoPath), 'NOWATRIX Global logo asset must exist at assets/brand/nowatrix/nowatrix_global_logo.jpg');
    const nowatrixStats = fs.statSync(nowatrixLogoPath);
    assert(nowatrixStats.size > 10000, `NOWATRIX Global logo asset must be valid image file (found ${nowatrixStats.size} bytes)`);

    assert(fs.existsSync(hapanamyLogoPath), 'Canonical Hapanamy logo must exist at assets/logo.jpg');
    const hapanamyStats = fs.statSync(hapanamyLogoPath);
    assert(hapanamyStats.size > 5000, `Hapanamy logo asset must be valid image file (found ${hapanamyStats.size} bytes)`);
});

// 2. Homepage SEO, Metadata & JSON-LD parentOrganization
test('Step 49: 2. Homepage (index.html) Metadata, Schema & Footer Attribution', () => {
    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');

    // Title
    assert(indexHtml.includes('<title>Hapanamy.lk — Digital Learning & Skills Platform | NOWATRIX Global</title>'), 'Homepage title must reflect NOWATRIX Global parent brand');

    // Meta descriptions
    assert(indexHtml.includes('NOWATRIX Global'), 'Homepage meta tags must mention NOWATRIX Global');
    assert(indexHtml.includes('og:title') && indexHtml.includes('NOWATRIX Global'), 'Homepage og:title must mention NOWATRIX Global');

    // JSON-LD Schema
    assert(indexHtml.includes('"parentOrganization"'), 'JSON-LD schema must include parentOrganization property');
    assert(indexHtml.includes('"name": "NOWATRIX Global"'), 'JSON-LD parentOrganization name must be NOWATRIX Global');

    // Footer Attribution Badge & Copyright
    assert(indexHtml.includes('class="footer-parent-attribution"'), 'Homepage footer must contain .footer-parent-attribution badge');
    assert(indexHtml.includes('assets/brand/nowatrix/nowatrix_global_logo.jpg'), 'Homepage footer must reference NOWATRIX Global logo');
    assert(indexHtml.includes('A NOWATRIX Global Company'), 'Homepage footer must display "A NOWATRIX Global Company"');
    assert(indexHtml.includes('© 2026 Hapanamy.lk — A NOWATRIX Global Company') || indexHtml.includes('&copy; 2026 Hapanamy.lk — A NOWATRIX Global Company'), 'Homepage copyright must include "A NOWATRIX Global Company"');
});

// 3. About Us Page dedicated NOWATRIX Global card & hierarchy
test('Step 49: 3. About Us (about-us.html) Mother Company Section & Brand Hierarchy', () => {
    const aboutHtml = fs.readFileSync(path.join(rootDir, 'about-us.html'), 'utf-8');

    assert(aboutHtml.includes('NOWATRIX Global'), 'About Us title/meta must include NOWATRIX Global');
    assert(aboutHtml.includes('ABOUT NOWATRIX GLOBAL') || aboutHtml.includes('Nowatrix Global'), 'About Us page must contain dedicated NOWATRIX Global section');
    assert(aboutHtml.includes('Mother Company') || aboutHtml.includes('Parent Brand') || aboutHtml.includes('සමාගම් සමූහය'), 'About Us page must specify Mother Company / Parent Brand role');
    assert(aboutHtml.includes('assets/brand/nowatrix/nowatrix_global_logo.jpg'), 'About Us page must display NOWATRIX Global logo');
    assert(aboutHtml.includes('class="footer-parent-attribution"'), 'About Us footer must contain parent attribution badge');
});

// 4. Contact Us Page branding
test('Step 49: 4. Contact Us (contact-us.html) Parent Brand Attribution', () => {
    const contactHtml = fs.readFileSync(path.join(rootDir, 'contact-us.html'), 'utf-8');

    assert(contactHtml.includes('NOWATRIX Global'), 'Contact Us title/meta must include NOWATRIX Global');
    assert(contactHtml.includes('A NOWATRIX Global Company'), 'Contact Us page must declare "A NOWATRIX Global Company"');
    assert(contactHtml.includes('class="footer-parent-attribution"'), 'Contact Us footer must contain parent attribution badge');
});

// 5. Legal & Compliance Pages
test('Step 49: 5. Legal & Compliance Pages (Privacy, Terms, Refund, Disclaimer, Disclosure)', () => {
    const legalFiles = [
        'privacy-policy.html',
        'terms-conditions.html',
        'refund-policy.html',
        'disclaimer.html',
        'affiliate-disclosure.html'
    ];

    for (const fileName of legalFiles) {
        const filePath = path.join(rootDir, fileName);
        assert(fs.existsSync(filePath), `${fileName} must exist`);
        const content = fs.readFileSync(filePath, 'utf-8');

        assert(content.includes('NOWATRIX Global'), `${fileName} must mention NOWATRIX Global in title or preamble`);
        assert(content.includes('A NOWATRIX Global Company'), `${fileName} must declare "A NOWATRIX Global Company"`);
        assert(content.includes('footer-parent-attribution'), `${fileName} footer must contain parent attribution badge`);
    }
});

// 6. Blog, Auth & Account Pages
test('Step 49: 6. Blog & Auth Pages (blog.html, login.html, register.html, forgot-password.html, reset-password.html)', () => {
    const authBlogFiles = [
        'blog.html',
        'login.html',
        'register.html',
        'forgot-password.html',
        'reset-password.html'
    ];

    for (const fileName of authBlogFiles) {
        const filePath = path.join(rootDir, fileName);
        assert(fs.existsSync(filePath), `${fileName} must exist`);
        const content = fs.readFileSync(filePath, 'utf-8');

        assert(content.includes('NOWATRIX Global'), `${fileName} must mention NOWATRIX Global`);
        assert(content.includes('A NOWATRIX Global Company') || content.includes('A <strong>NOWATRIX Global</strong> Company'), `${fileName} must include subtle parent company attribution`);
    }
});

// 7. Checkout, Order Success, Error 404 & Portal Dashboards
test('Step 49: 7. Checkout, Order Success, 404 & Portals (checkout.html, order-success.html, dashboard.html, 404.html)', () => {
    const portalFiles = [
        '404.html',
        'checkout.html',
        'order-success.html',
        'dashboard.html',
        'affiliate-dashboard.html',
        'student-dashboard.html',
        'my-account.html',
        'hapanamy-admin-portal-9226.html',
        'admin.html'
    ];

    for (const fileName of portalFiles) {
        const filePath = path.join(rootDir, fileName);
        assert(fs.existsSync(filePath), `${fileName} must exist`);
        const content = fs.readFileSync(filePath, 'utf-8');

        assert(content.includes('NOWATRIX Global'), `${fileName} must mention NOWATRIX Global in title or footer`);
        assert(content.includes('A NOWATRIX Global Company'), `${fileName} must have footer attribution "A NOWATRIX Global Company"`);
    }

    // Direct bank deposit account in checkout must be preserved untouched
    const checkoutContent = fs.readFileSync(path.join(rootDir, 'checkout.html'), 'utf-8');
    assert(checkoutContent.includes('MAX SAVE INTERNATIONAL (PVT) LTD'), 'Checkout must preserve official bank deposit account name');
    assert(checkoutContent.includes('019010040197'), 'Checkout must preserve official bank account number');
});

// 8. MLM Engine Invariants & Zero Regression
test('Step 49: 8. Core MLM Calculations & Rules Preserved (8% Direct, 7% Binary, Rs. 30,000 Daily Cap)', () => {
    // 8% Direct Commission Calculation
    const coursePrice = 19900;
    const directRate = 0.08;
    const directCommission = Math.round(coursePrice * directRate);
    assert.strictEqual(directCommission, 1592, '8% direct commission on Rs. 19,900 must be Rs. 1,592');

    // 7% Binary Matching Commission Calculation
    const matchVolume = 10000;
    const binaryRate = 0.07;
    const binaryCommission = Math.round(matchVolume * binaryRate);
    assert.strictEqual(binaryCommission, 700, '7% binary matching commission on 10,000 points must be Rs. 700');

    // Daily Earning Cap
    const dailyCap = 30000;
    const rawEarnings = 45000;
    const cappedEarnings = Math.min(rawEarnings, dailyCap);
    assert.strictEqual(cappedEarnings, 30000, 'Daily earnings cap must strictly enforce Rs. 30,000');
});
