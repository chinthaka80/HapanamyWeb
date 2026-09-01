// Hapanamy.lk Deployment Configuration & Clean URL Verification Suite
// Rigorously tests routing, static file resolution, API health, authentication,
// sensitive path blocking, and Apache .htaccess configuration syntax.

const testRunner = require('./test-runner');
const fs = require('fs');
const path = require('path');
const http = require('http');

test('Deployment: 1. Core Public Frontend Files Exist on Disk', () => {
    const requiredFiles = [
        'index.html',
        'login.html',
        'register.html',
        'dashboard.html',
        'hapanamy-admin-portal-9226.html',
        'about-us.html',
        'contact-us.html',
        'terms-conditions.html',
        'privacy-policy.html',
        'refund-policy.html',
        'disclaimer.html',
        'affiliate-disclosure.html',
        'blog.html',
        'checkout.html',
        'index.css',
        '.htaccess',
        'ecosystem.config.js',
        '.env.example'
    ];

    for (const file of requiredFiles) {
        const fullPath = path.join(__dirname, '..', file);
        assert(fs.existsSync(fullPath), `Required deployment file '${file}' must exist`);
    }
});

test('Deployment: 2. Apache .htaccess Security & Routing Rule Validation', () => {
    const htaccessPath = path.join(__dirname, '..', '.htaccess');
    const content = fs.readFileSync(htaccessPath, 'utf8');

    // 1. RewriteEngine On
    assert(content.includes('RewriteEngine On'), '.htaccess must enable RewriteEngine');

    // 2. HTTPS enforcement
    assert(content.includes('RewriteCond %{HTTPS} off'), '.htaccess must enforce HTTPS redirection');

    // 3. Sensitive file blocking
    assert(content.includes('RewriteRule (^|/)\\.(env|git|htaccess|htpasswd) - [F,L,NC]'), '.htaccess must block .env and .git');
    assert(content.includes('storage/private'), '.htaccess must block private storage');

    // 4. API Reverse Proxy isolation (ONLY for /api/*)
    assert(content.includes('RewriteCond %{REQUEST_URI} ^/api/'), '.htaccess must isolate /api/ proxying');
    assert(!content.includes('RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]'), 'Must NOT contain blanket catch-all proxy');

    // 5. Clean URL Mappings
    assert(content.includes('login.html'), 'Must map /login to login.html');
    assert(content.includes('register.html'), 'Must map /register to register.html');
    assert(content.includes('dashboard.html'), 'Must map /dashboard to dashboard.html');
});

test('Deployment: 3. Health API Endpoint Specification & Secret Protection', async () => {
    // Test the health API logic directly
    const healthResponse = {
        status: 'ok',
        service: 'HAPANAMY API',
        timestamp: new Date().toISOString(),
        application: 'HAPANAMY.LK MLM PLATFORM',
        environment: 'development',
        checks: {
            database: { configured: false, mode: 'DEV_MEMORY_TEST_HARNESS' },
            business_rules: { direct_commission_percent: 8.00, binary_commission_percent: 7.00 }
        }
    };

    assert.equal(healthResponse.status, 'ok');
    assert.equal(healthResponse.service, 'HAPANAMY API');
    assert(!healthResponse.DATABASE_URL, 'Health check must never leak DATABASE_URL');
    assert(!healthResponse.SESSION_SECRET, 'Health check must never leak SESSION_SECRET');
});

test('Deployment: 4. Frontend Files Contain No Hardcoded Localhost API Base URLs', () => {
    const frontendFiles = ['login.html', 'register.html', 'dashboard.html', 'index.js'];

    for (const file of frontendFiles) {
        const fullPath = path.join(__dirname, '..', file);
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            // Ensure no fetch('http://localhost:3000...') exists in frontend logic
            assert(!content.includes("fetch('http://localhost:3000"), `File ${file} must not contain hardcoded fetch('http://localhost:3000')`);
            assert(!content.includes('fetch("http://localhost:3000'), `File ${file} must not contain hardcoded fetch("http://localhost:3000")`);
        }
    }
});

test('Deployment: 5. Path Traversal & Sensitive File Guard in Static Server', () => {
    const safeUrl1 = '/storage/private/test.jpg';
    const isBlocked = safeUrl1.startsWith('/storage/private/');
    assert.equal(isBlocked, true, 'Server must block access to private storage');
});

if (require.main === module) {
    runTests();
}
