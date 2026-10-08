// test/step90-auth-redirect-and-subportal-session-guard.test.js
// Verification for Auth Redirect Parameter Preservation and Sub-Portal Cross-Tab Session Guard

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test } = require('./test-runner');

const rootDir = path.resolve(__dirname, '..');

const subportalPages = [
    'dashboard-wallet.html',
    'dashboard-bank.html',
    'dashboard-kyc.html',
    'admin-kyc.html',
    'admin-withdrawals.html',
    'HapanamyWeb/admin-kyc.html',
    'HapanamyWeb/admin-withdrawals.html'
];

test('Step 90: 1. Sub-portals and Admin review panels contain Head-Level Auth Session Guard and Storage Sync', () => {
    for (const page of subportalPages) {
        const filePath = path.join(rootDir, page);
        assert.ok(fs.existsSync(filePath), `${page} must exist`);
        const content = fs.readFileSync(filePath, 'utf8');

        // Verify head guard
        const headMatch = content.match(/<head[\s\S]*?<\/head>/i);
        assert.ok(headMatch, `${page} must have a valid <head> section`);
        const headContent = headMatch[0];

        assert.ok(headContent.includes('enforceAuthSession'), `${page} <head> must define enforceAuthSession()`);
        assert.ok(headContent.includes("window.addEventListener('storage'"), `${page} <head> must subscribe to window storage event`);
        assert.ok(headContent.includes("document.addEventListener('visibilitychange'"), `${page} <head> must subscribe to visibilitychange`);
        assert.ok(headContent.includes("window.location.href = 'login.html'"), `${page} <head> must redirect to login.html`);

        // Verify multi-token lookup support (auth_token || active_token)
        assert.ok(
            content.includes("localStorage.getItem('auth_token') || localStorage.getItem('active_token')"),
            `${page} must support active_token fallback alongside auth_token`
        );
    }
});

test('Step 90: 2. login.html and HapanamyWeb/login.html preserve valid query redirect parameters and block open redirects', () => {
    const loginFiles = ['login.html', 'HapanamyWeb/login.html'];

    for (const file of loginFiles) {
        const filePath = path.join(rootDir, file);
        assert.ok(fs.existsSync(filePath), `${file} must exist`);
        const content = fs.readFileSync(filePath, 'utf8');

        // Extract getRedirectTarget definition
        assert.ok(content.includes('function getRedirectTarget'), `${file} must define getRedirectTarget function`);
        assert.ok(content.includes("urlParams.get('redirect')"), `${file} must check redirect param`);
        assert.ok(content.includes("urlParams.get('returnUrl')"), `${file} must check returnUrl param`);
        assert.ok(content.includes("urlParams.get('next')"), `${file} must check next param`);

        // Test logic inside VM context
        const helperMatch = content.match(/function getRedirectTarget[\s\S]*?^ {8}\}/m);
        assert.ok(helperMatch, `${file} must match getRedirectTarget code block`);
        const helperCode = helperMatch[0];

        const executeRedirectTest = (search, role, serverRedirect) => {
            const context = {
                window: {
                    location: {
                        search: search
                    }
                },
                URLSearchParams: require('url').URLSearchParams
            };
            const wrappedScript = `(${helperCode})('${role}', ${serverRedirect ? `'${serverRedirect}'` : 'null'})`;
            return vm.runInNewContext(wrappedScript, context);
        };

        // Case A: Safe relative destination
        assert.strictEqual(executeRedirectTest('?redirect=checkout.html', 'member'), 'checkout.html');
        assert.strictEqual(executeRedirectTest('?returnUrl=my-account.html', 'member'), 'my-account.html');
        assert.strictEqual(executeRedirectTest('?next=student-dashboard.html', 'student'), 'student-dashboard.html');
        assert.strictEqual(executeRedirectTest('?redirect=/courses.html?cat=trading', 'member'), '/courses.html?cat=trading');

        // Case B: Open Redirect Attack vectors must be blocked and fallback to role default
        assert.strictEqual(executeRedirectTest('?redirect=http://evil.com', 'member'), 'dashboard.html');
        assert.strictEqual(executeRedirectTest('?redirect=https://phishing.lk', 'admin'), 'hapanamy-admin-portal-9226.html');
        assert.strictEqual(executeRedirectTest('?redirect=//attacker.com/steal', 'student'), 'student-dashboard.html');
        assert.strictEqual(executeRedirectTest('?redirect=javascript:alert(1)', 'member'), 'dashboard.html');

        // Case C: Role defaults when no redirect parameter is present
        assert.strictEqual(executeRedirectTest('', 'member'), 'dashboard.html');
        assert.strictEqual(executeRedirectTest('', 'student'), 'student-dashboard.html');
        assert.strictEqual(executeRedirectTest('', 'admin'), 'hapanamy-admin-portal-9226.html');
        assert.strictEqual(executeRedirectTest('', 'subadmin'), 'hapanamy-admin-portal-9226.html');
    }
});

test('Step 90: 3. Sub-portal Head Guard triggers immediate redirection upon unauthenticated access or session purge', () => {
    for (const page of ['dashboard-wallet.html', 'dashboard-bank.html', 'dashboard-kyc.html', 'admin-kyc.html', 'admin-withdrawals.html']) {
        const filePath = path.join(rootDir, page);
        const content = fs.readFileSync(filePath, 'utf8');

        // Extract the head guard script
        const scriptMatch = content.match(/<!-- Immediate Authentication[\s\S]*?<script>([\s\S]*?)<\/script>/i);
        assert.ok(scriptMatch, `${page} must contain head guard script block`);
        const guardScript = scriptMatch[1];

        // Scenario 1: No auth tokens -> Immediate redirection to login.html
        let redirectedTo = null;
        let storageListeners = [];

        const mockLocalStorageEmpty = {
            getItem: () => null
        };

        const contextEmpty = {
            localStorage: mockLocalStorageEmpty,
            window: {
                location: {
                    set href(val) { redirectedTo = val; },
                    get href() { return redirectedTo; }
                },
                addEventListener: (evt, fn) => {
                    if (evt === 'storage') storageListeners.push(fn);
                }
            },
            document: {
                addEventListener: () => {}
            }
        };

        vm.runInNewContext(guardScript, contextEmpty);
        assert.strictEqual(redirectedTo, 'login.html', `${page} must immediately redirect to login.html when no session exists`);

        // Scenario 2: Active session -> No redirection, but storage event triggers revocation
        redirectedTo = null;
        storageListeners = [];

        const store = {
            auth_token: 'token-member-valid',
            active_user: JSON.stringify({ id: 'usr-1', username: 'testuser' })
        };

        const mockLocalStorageValid = {
            getItem: (k) => (store[k] !== undefined ? store[k] : null)
        };

        const contextValid = {
            localStorage: mockLocalStorageValid,
            window: {
                location: {
                    set href(val) { redirectedTo = val; },
                    get href() { return redirectedTo; }
                },
                addEventListener: (evt, fn) => {
                    if (evt === 'storage') storageListeners.push(fn);
                }
            },
            document: {
                addEventListener: () => {}
            }
        };

        vm.runInNewContext(guardScript, contextValid);
        assert.strictEqual(redirectedTo, null, `${page} must NOT redirect when valid session exists`);
        assert.ok(storageListeners.length > 0, `${page} must register storage event listener`);

        // Trigger storage purge in another tab
        delete store.auth_token;
        delete store.active_user;
        storageListeners[0]({ key: 'auth_token' });

        assert.strictEqual(redirectedTo, 'login.html', `${page} must redirect to login.html when storage purge event fires`);
    }
});
