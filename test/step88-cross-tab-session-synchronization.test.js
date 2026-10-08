// test/step88-cross-tab-session-synchronization.test.js
// Cross-Tab Session Synchronization & Member Portal Auth Guard Verification

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('./test-runner');

const rootDir = path.resolve(__dirname, '..');

const portalPages = [
    'dashboard.html',
    'my-account.html',
    'student-dashboard.html',
    'hapanamy-admin-portal-9226.html',
    'admin.html'
];

test('Step 88: 1. Member and Admin Portals contain Head-Level Cross-Tab Session Guard & Storage Listener', () => {
    for (const page of portalPages) {
        const filePath = path.join(rootDir, page);
        assert.ok(fs.existsSync(filePath), `${page} must exist`);
        const content = fs.readFileSync(filePath, 'utf8');

        // Verify script exists in <head>
        const headMatch = content.match(/<head[\s\S]*?<\/head>/i);
        assert.ok(headMatch, `${page} must have a valid <head> section`);
        const headContent = headMatch[0];

        assert.ok(headContent.includes('enforceAuthSession'), `${page} <head> must define enforceAuthSession()`);
        assert.ok(headContent.includes("window.addEventListener('storage'"), `${page} <head> must subscribe to window storage event`);
        assert.ok(headContent.includes("document.addEventListener('visibilitychange'"), `${page} <head> must subscribe to visibilitychange`);
        assert.ok(headContent.includes("window.location.href = 'login.html'") || headContent.includes("window.location.replace('login.html"), `${page} <head> must redirect to login.html when credentials are missing`);
    }
});

test('Step 88: 2. nav-auth.js and index.js implement storage and visibilitychange listeners with complete logout cleanup', () => {
    const navAuthPath = path.join(rootDir, 'nav-auth.js');
    const indexPath = path.join(rootDir, 'index.js');

    const navAuthContent = fs.readFileSync(navAuthPath, 'utf8');
    const indexContent = fs.readFileSync(indexPath, 'utf8');

    // Verify storage & visibilitychange
    assert.ok(navAuthContent.includes("window.addEventListener('storage', syncNavAuthState)"), 'nav-auth.js must listen to storage events');
    assert.ok(navAuthContent.includes("document.addEventListener('visibilitychange'"), 'nav-auth.js must listen to visibilitychange events');

    // Verify complete session purge in handleGlobalLogout
    assert.ok(navAuthContent.includes("localStorage.removeItem('active_user')"), 'nav-auth.js must remove active_user');
    assert.ok(navAuthContent.includes("localStorage.removeItem('auth_token')"), 'nav-auth.js must remove auth_token');
    assert.ok(navAuthContent.includes("localStorage.removeItem('active_token')"), 'nav-auth.js must remove active_token');
    assert.ok(navAuthContent.includes("localStorage.removeItem('is_admin_session')"), 'nav-auth.js must remove is_admin_session');

    assert.ok(indexContent.includes("localStorage.removeItem('is_admin_session')"), 'index.js must remove is_admin_session');
});

test('Step 88: 3. Simulated Cross-Tab Storage Event triggers immediate session enforcement and redirection', () => {
    for (const page of portalPages) {
        const filePath = path.join(rootDir, page);
        const content = fs.readFileSync(filePath, 'utf8');

        // Extract script content from head
        const scriptMatch = content.match(/<!-- Client-Side Auth Guard & Cross-Tab Session Synchronizer -->\s*<script>([\s\S]*?)<\/script>/);
        assert.ok(scriptMatch, `${page} must contain guard script block`);
        const scriptCode = scriptMatch[1];

        const storage = new Map();
        let replacedUrl = null;

        const fakeLocation = {
            replace: (url) => { replacedUrl = url; }
        };
        Object.defineProperty(fakeLocation, 'href', {
            get: () => replacedUrl,
            set: (val) => { replacedUrl = val; }
        });

        const fakeWindow = {
            location: fakeLocation,
            addEventListener: (event, handler) => {
                if (event === 'storage') fakeWindow._storageHandler = handler;
            }
        };

        const fakeDocument = {
            addEventListener: (event, handler) => {}
        };

        const fakeLocalStorage = {
            getItem: (k) => storage.get(k) || null,
            setItem: (k, v) => storage.set(k, v),
            removeItem: (k) => storage.delete(k)
        };

        // 1. Valid authenticated session: must NOT redirect
        storage.set('auth_token', 'token-valid-123');
        storage.set('active_user', JSON.stringify({ id: 'user-1', name: 'Kasun' }));

        const runScript = new Function('localStorage', 'window', 'document', scriptCode);
        runScript(fakeLocalStorage, fakeWindow, fakeDocument);
        assert.strictEqual(replacedUrl, null, `${page}: valid session must not redirect on load`);

        // 2. Simulate Tab A logout event across tabs
        storage.clear();
        if (fakeWindow._storageHandler) {
            fakeWindow._storageHandler({ key: 'auth_token' });
        }
        assert.ok(replacedUrl && replacedUrl.includes('login.html'), `${page}: storage event with missing credentials must redirect to login.html`);
    }
});

test('Step 88: 4. Core MLM Invariants and Database Persistence remain completely protected', () => {
    const dbPath = path.join(rootDir, 'data', 'mlm-db-store.json');
    assert.ok(fs.existsSync(dbPath), 'data/mlm-db-store.json must exist');
    const raw = fs.readFileSync(dbPath, 'utf8');
    const db = JSON.parse(raw);

    assert.ok(Array.isArray(db.users), 'db.users must be an array');
    assert.ok(Array.isArray(db.binaryNodes), 'db.binaryNodes must be an array');
    assert.ok(Array.isArray(db.wallets), 'db.wallets must be an array');

    // Confirm 15 core HAPANA nodes intact
    for (let i = 1; i <= 15; i++) {
        const numStr = String(i).padStart(2, '0');
        const node = db.binaryNodes.find(n => n.id === `node-hapana-${numStr}` || n.user_id === `user-hapana-${numStr}`);
        assert.ok(node, `node-hapana-${numStr} must remain intact in db store`);
    }
});
