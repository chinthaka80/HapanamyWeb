// test/step87-real-chromium-verification.js
// Standalone Real Chromium (Microsoft Edge Engine) E2E Automation Runner
// Directly interfaces with headless Chromium via Chrome DevTools Protocol (CDP)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const assert = require('assert');

const rootDir = path.resolve(__dirname, '..');
const PORT = 3199;
const CDP_PORT = 9333;

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const pagesToTest = [
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

// 1. Static File Server for the 15 pages and all assets
function startStaticServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const urlPath = req.url.split('?')[0];
            let filePath = path.join(rootDir, urlPath === '/' ? 'index.html' : urlPath);
            
            if (!fs.existsSync(filePath)) {
                filePath = path.join(rootDir, '404.html');
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentTypes = {
                '.html': 'text/html; charset=utf-8',
                '.css': 'text/css; charset=utf-8',
                '.js': 'application/javascript; charset=utf-8',
                '.json': 'application/json; charset=utf-8',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.svg': 'image/svg+xml'
            };

            const contentType = contentTypes[ext] || 'application/octet-stream';
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Server Error: ' + err.message);
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(data);
                }
            });
        });

        server.listen(PORT, '127.0.0.1', () => {
            resolve(server);
        });
    });
}

// 2. CDP Client over WebSocket
class CdpClient {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.ws = null;
        this.msgId = 1;
        this.pendingCallbacks = new Map();
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);
            this.ws.onopen = () => resolve();
            this.ws.onerror = (err) => reject(err);
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.id && this.pendingCallbacks.has(data.id)) {
                        const cb = this.pendingCallbacks.get(data.id);
                        this.pendingCallbacks.delete(data.id);
                        if (data.error) cb.reject(new Error(data.error.message || JSON.stringify(data.error)));
                        else cb.resolve(data.result);
                    }
                } catch (e) {
                    console.error('CDP message parse error:', e);
                }
            };
        });
    }

    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = this.msgId++;
            this.pendingCallbacks.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async eval(expression) {
        const res = await this.send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
        });
        if (res.exceptionDetails) {
            console.error('CDP Eval Exception details:', JSON.stringify(res.exceptionDetails, null, 2));
            throw new Error(`Eval Exception: ${res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`);
        }
        return res.result ? res.result.value : undefined;
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// 3. Helper to poll for CDP Page Endpoint
async function getWsUrl(port, retries = 20) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json/list`);
            if (res.ok) {
                const list = await res.json();
                const page = list.find(t => t.type === 'page');
                if (page && page.webSocketDebuggerUrl) {
                    return page.webSocketDebuggerUrl;
                }
            }
        } catch (e) {
            // Wait and retry
        }
        await new Promise(r => setTimeout(r, 250));
    }
    throw new Error(`Failed to find page target on Chromium CDP port ${port}`);
}

async function runRealChromiumTests() {
    console.log('🚀 Starting Real Chromium Engine E2E Verification across all 15 pages...');
    console.log(`Using Browser Binary: ${EDGE_PATH}`);

    assert.ok(fs.existsSync(EDGE_PATH), `Browser binary must exist at ${EDGE_PATH}`);

    const staticServer = await startStaticServer();
    console.log(`✅ Static Web Server active at http://127.0.0.1:${PORT}`);

    // Create a temporary user data dir to ensure a completely clean browser profile
    const userDataDir = path.join(rootDir, 'scratch', 'cdp_profile_' + Date.now());
    if (!fs.existsSync(path.dirname(userDataDir))) {
        fs.mkdirSync(path.dirname(userDataDir), { recursive: true });
    }

    const chromeProcess = spawn(EDGE_PATH, [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-extensions',
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${userDataDir}`,
        'about:blank'
    ]);

    chromeProcess.on('error', (err) => {
        console.error('Chromium Process Error:', err);
    });

    let passedTestsCount = 0;

    try {
        const wsUrl = await getWsUrl(CDP_PORT);
        console.log(`✅ Connected to Chromium CDP via WebSocket: ${wsUrl}`);

        const client = new CdpClient(wsUrl);
        await client.connect();

        // Enable domains
        await client.send('Page.enable');
        await client.send('Runtime.enable');
        await client.send('DOM.enable');

        async function navigateAndWait(url) {
            await client.send('Page.navigate', { url });
            for (let i = 0; i < 50; i++) {
                try {
                    const ready = await client.eval(`(() => {
                        return document.readyState === 'complete' && !!document.getElementById('headerAuthButtons');
                    })()`);
                    if (ready === true) return;
                } catch (e) {}
                await new Promise(r => setTimeout(r, 100));
            }
        }

        for (const page of pagesToTest) {
            console.log(`\n======================================================`);
            console.log(`🔍 Testing Page in Real Chromium: ${page}`);
            console.log(`======================================================`);

            const pageUrl = `http://127.0.0.1:${PORT}/${page}`;

            // -----------------------------------------------------------------
            // TEST 1: Unauthenticated State in Real Chromium Desktop Viewport
            // -----------------------------------------------------------------
            console.log(`👉 [${page}] 1. Unauthenticated Desktop Viewport Check (1280x800)...`);
            await client.send('Emulation.setDeviceMetricsOverride', {
                width: 1280,
                height: 800,
                deviceScaleFactor: 1,
                mobile: false
            });

            await navigateAndWait(pageUrl);

            // Clear localStorage and resync
            await client.eval(`
                localStorage.clear();
                sessionStorage.clear();
                if (typeof window.syncNavAuthState === 'function') {
                    window.syncNavAuthState();
                }
            `);
            await new Promise(r => setTimeout(r, 100));

            const unauthCheck = await client.eval(`(() => {
                const headerAuth = document.getElementById('headerAuthButtons');
                if (!headerAuth) return { error: 'Missing #headerAuthButtons' };
                const loginBtn = headerAuth.querySelector('a[href*="login.html"]');
                const registerBtn = headerAuth.querySelector('a[href*="register.html"]');
                const accountToggle = document.getElementById('userAccountMenuToggle');
                return {
                    hasHeaderAuth: !!headerAuth,
                    hasLogin: !!loginBtn,
                    hasRegister: !!registerBtn,
                    hasAccountToggle: !!accountToggle,
                    loginText: loginBtn ? loginBtn.textContent.trim() : null,
                    registerText: registerBtn ? registerBtn.textContent.trim() : null
                };
            })()`);

            assert.strictEqual(unauthCheck.hasHeaderAuth, true, `${page}: Must have #headerAuthButtons in DOM`);
            assert.strictEqual(unauthCheck.hasLogin, true, `${page}: Must have login button when unauthenticated`);
            assert.strictEqual(unauthCheck.hasRegister, true, `${page}: Must have register button when unauthenticated`);
            assert.strictEqual(unauthCheck.hasAccountToggle, false, `${page}: Must NOT have user dropdown toggle when unauthenticated`);
            console.log(`   ✅ Unauthenticated Desktop UI Verified: Login="${unauthCheck.loginText}", Register="${unauthCheck.registerText}"`);
            passedTestsCount++;

            // -----------------------------------------------------------------
            // TEST 2: Authenticated State & Dropdown Lifecycle in Real Chromium Desktop
            // -----------------------------------------------------------------
            console.log(`👉 [${page}] 2. Authenticated State Dropdown Lifecycle in Real Chromium...`);
            await client.eval(`
                localStorage.setItem('auth_token', 'token-kasun-101');
                localStorage.setItem('active_user', JSON.stringify({
                    id: 'user-kasun-101',
                    full_name: 'Kasun Tharaka',
                    username: 'kasun2505',
                    email: 'kasun@test.com'
                }));
                if (typeof window.syncNavAuthState === 'function') {
                    window.syncNavAuthState();
                } else {
                    window.location.reload();
                }
            `);
            await new Promise(r => setTimeout(r, 400));

            const authInitialCheck = await client.eval(`(() => {
                const toggleBtn = document.getElementById('userAccountMenuToggle');
                const dropdown = document.getElementById('userAccountDropdown');
                const avatar = document.getElementById('headerUserAvatar');
                const nameSpan = document.getElementById('headerUserDisplayName');
                if (!toggleBtn || !dropdown || !avatar || !nameSpan) {
                    return { error: 'Missing auth dropdown elements' };
                }
                const dropdownComputedStyle = window.getComputedStyle(dropdown);
                return {
                    avatarText: avatar.textContent.trim(),
                    nameText: nameSpan.textContent.trim(),
                    ariaExpanded: toggleBtn.getAttribute('aria-expanded'),
                    isOpen: dropdown.classList.contains('open'),
                    display: dropdownComputedStyle.display,
                    visibility: dropdownComputedStyle.visibility,
                    opacity: dropdownComputedStyle.opacity
                };
            })()`);

            assert.strictEqual(authInitialCheck.avatarText, 'K', `${page}: User Avatar must show initial 'K'`);
            assert.strictEqual(authInitialCheck.nameText, 'Kasun Tharaka', `${page}: Display name must show 'Kasun Tharaka'`);
            assert.strictEqual(authInitialCheck.ariaExpanded, 'false', `${page}: Initial aria-expanded must be false`);
            assert.strictEqual(authInitialCheck.isOpen, false, `${page}: Initial dropdown must not have .open`);
            console.log(`   ✅ Authenticated Dropdown Initial State Verified: Avatar="K", Name="Kasun Tharaka", Closed`);
            passedTestsCount++;

            // Interaction Step 2.1: Real Mouse Click on Toggle Button
            console.log(`   👉 Clicking #userAccountMenuToggle to open dropdown...`);
            const toggleOpenResult = await client.eval(`(() => {
                const toggleBtn = document.getElementById('userAccountMenuToggle');
                toggleBtn.click();
                const dropdown = document.getElementById('userAccountDropdown');
                const style = window.getComputedStyle(dropdown);
                return {
                    isOpen: dropdown.classList.contains('open'),
                    ariaExpanded: toggleBtn.getAttribute('aria-expanded'),
                    display: style.display,
                    opacity: style.opacity
                };
            })()`);

            assert.strictEqual(toggleOpenResult.isOpen, true, `${page}: Click button must add .open class`);
            assert.strictEqual(toggleOpenResult.ariaExpanded, 'true', `${page}: Click button must set aria-expanded="true"`);
            assert.strictEqual(toggleOpenResult.display, 'flex', `${page}: Dropdown display must be flex when open`);
            console.log(`   ✅ Toggle Click Open Verified: open=true, aria-expanded=true, display=flex`);
            passedTestsCount++;

            // Interaction Step 2.2: Second Mouse Click to close
            console.log(`   👉 Clicking #userAccountMenuToggle again to close dropdown...`);
            const toggleCloseResult = await client.eval(`(() => {
                const toggleBtn = document.getElementById('userAccountMenuToggle');
                toggleBtn.click();
                const dropdown = document.getElementById('userAccountDropdown');
                return {
                    isOpen: dropdown.classList.contains('open'),
                    ariaExpanded: toggleBtn.getAttribute('aria-expanded')
                };
            })()`);

            assert.strictEqual(toggleCloseResult.isOpen, false, `${page}: Second click must close dropdown`);
            assert.strictEqual(toggleCloseResult.ariaExpanded, 'false', `${page}: Second click must set aria-expanded="false"`);
            console.log(`   ✅ Toggle Click Close Verified: open=false, aria-expanded=false`);
            passedTestsCount++;

            // Interaction Step 2.3: Child Element Click Bubbling (Click on Avatar)
            console.log(`   👉 Clicking child #headerUserAvatar element (pointer event bubbling)...`);
            const avatarClickResult = await client.eval(`(() => {
                const avatar = document.getElementById('headerUserAvatar');
                avatar.click();
                const dropdown = document.getElementById('userAccountDropdown');
                const toggleBtn = document.getElementById('userAccountMenuToggle');
                return {
                    isOpen: dropdown.classList.contains('open'),
                    ariaExpanded: toggleBtn.getAttribute('aria-expanded')
                };
            })()`);

            assert.strictEqual(avatarClickResult.isOpen, true, `${page}: Child avatar click must open dropdown via bubbling`);
            assert.strictEqual(avatarClickResult.ariaExpanded, 'true');
            console.log(`   ✅ Child Avatar Click Bubbling Verified: open=true`);
            passedTestsCount++;

            // Interaction Step 2.4: Outside Click Dismiss
            console.log(`   👉 Clicking outside the dropdown container to dismiss...`);
            const outsideClickResult = await client.eval(`(() => {
                document.body.click();
                const dropdown = document.getElementById('userAccountDropdown');
                const toggleBtn = document.getElementById('userAccountMenuToggle');
                return {
                    isOpen: dropdown.classList.contains('open'),
                    ariaExpanded: toggleBtn.getAttribute('aria-expanded')
                };
            })()`);

            assert.strictEqual(outsideClickResult.isOpen, false, `${page}: Outside click must close dropdown`);
            assert.strictEqual(outsideClickResult.ariaExpanded, 'false');
            console.log(`   ✅ Outside Click Dismiss Verified: open=false`);
            passedTestsCount++;

            // Interaction Step 2.5: Keyboard Accessibility (Enter to open, Escape to close)
            console.log(`   👉 Testing Keyboard Accessibility (Enter opens, Escape closes)...`);
            const keyboardResult = await client.eval(`(() => {
                const toggleBtn = document.getElementById('userAccountMenuToggle');
                const dropdown = document.getElementById('userAccountDropdown');
                
                // Dispatch Enter keydown on toggle button
                const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
                toggleBtn.dispatchEvent(enterEvent);
                const afterEnterOpen = dropdown.classList.contains('open');

                // Dispatch Escape keydown
                const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
                toggleBtn.dispatchEvent(escEvent);
                const afterEscOpen = dropdown.classList.contains('open');

                return { afterEnterOpen, afterEscOpen };
            })()`);

            assert.strictEqual(keyboardResult.afterEnterOpen, true, `${page}: Enter key must open dropdown`);
            assert.strictEqual(keyboardResult.afterEscOpen, false, `${page}: Escape key must close dropdown`);
            console.log(`   ✅ Keyboard Accessibility Verified: Enter=opened, Escape=closed`);
            passedTestsCount++;

            // -----------------------------------------------------------------
            // TEST 3: Mobile Viewport & Hamburger Drawer Lifecycle (375x667)
            // -----------------------------------------------------------------
            console.log(`👉 [${page}] 3. Mobile Viewport (375x667) Hamburger Drawer Lifecycle...`);
            await client.send('Emulation.setDeviceMetricsOverride', {
                width: 375,
                height: 667,
                deviceScaleFactor: 2,
                mobile: true
            });
            await new Promise(r => setTimeout(r, 200));

            const mobileInitialCheck = await client.eval(`(() => {
                const btn = document.getElementById('mobileMenuBtn') || document.querySelector('.mobile-menu-btn');
                const navMenu = document.getElementById('navMenu') || document.querySelector('.nav-menu');
                const btnStyle = btn ? window.getComputedStyle(btn) : null;
                return {
                    hasBtn: !!btn,
                    hasNavMenu: !!navMenu,
                    btnDisplay: btnStyle ? btnStyle.display : null,
                    btnIsActive: btn ? btn.classList.contains('active') : false,
                    navIsActive: navMenu ? navMenu.classList.contains('active') : false,
                    bodyMenuOpen: document.body.classList.contains('menu-open')
                };
            })()`);

            assert.strictEqual(mobileInitialCheck.hasBtn, true, `${page}: Mobile menu button must exist`);
            assert.strictEqual(mobileInitialCheck.hasNavMenu, true, `${page}: Nav menu drawer must exist`);
            assert.strictEqual(mobileInitialCheck.btnIsActive, false, `${page}: Mobile button starts inactive`);
            assert.strictEqual(mobileInitialCheck.navIsActive, false, `${page}: Nav menu starts inactive`);
            assert.strictEqual(mobileInitialCheck.bodyMenuOpen, false, `${page}: Body starts without menu-open`);

            // Mobile Interaction Step 3.1: Click Mobile Hamburger
            console.log(`   👉 Clicking #mobileMenuBtn to open mobile drawer...`);
            const mobileOpenResult = await client.eval(`(() => {
                const btn = document.getElementById('mobileMenuBtn') || document.querySelector('.mobile-menu-btn');
                const navMenu = document.getElementById('navMenu') || document.querySelector('.nav-menu');
                btn.click();
                const mobileAuth = navMenu.querySelector('.mobile-only-auth');
                return {
                    btnActive: btn.classList.contains('active'),
                    navActive: navMenu.classList.contains('active'),
                    bodyMenuOpen: document.body.classList.contains('menu-open'),
                    hasMobileAuth: !!mobileAuth,
                    mobileAuthText: mobileAuth ? mobileAuth.textContent.trim() : null
                };
            })()`);

            assert.strictEqual(mobileOpenResult.btnActive, true, `${page}: Hamburger click must activate button`);
            assert.strictEqual(mobileOpenResult.navActive, true, `${page}: Hamburger click must activate navMenu drawer`);
            assert.strictEqual(mobileOpenResult.bodyMenuOpen, true, `${page}: Hamburger click must add menu-open to body`);
            assert.strictEqual(mobileOpenResult.hasMobileAuth, true, `${page}: Mobile drawer must contain .mobile-only-auth`);
            assert.ok(mobileOpenResult.mobileAuthText.includes('Kasun Tharaka'), `${page}: Mobile auth must display active user name`);
            console.log(`   ✅ Mobile Drawer Open Verified: drawer=active, body=menu-open, authName="Kasun Tharaka"`);
            passedTestsCount++;

            // Mobile Interaction Step 3.2: Click Nav Link inside drawer auto-closes
            console.log(`   👉 Clicking a nav-link inside drawer to verify auto-close...`);
            const navLinkCloseResult = await client.eval(`(() => {
                const navMenu = document.getElementById('navMenu') || document.querySelector('.nav-menu');
                const btn = document.getElementById('mobileMenuBtn') || document.querySelector('.mobile-menu-btn');
                const firstLink = navMenu.querySelector('.nav-link, a');
                const cancelNav = (e) => { e.preventDefault(); };
                firstLink.addEventListener('click', cancelNav, { capture: true, once: true });
                firstLink.click();
                return {
                    btnActive: btn.classList.contains('active'),
                    navActive: navMenu.classList.contains('active'),
                    bodyMenuOpen: document.body.classList.contains('menu-open')
                };
            })()`);

            assert.strictEqual(navLinkCloseResult.btnActive, false, `${page}: Nav link click must close hamburger button`);
            assert.strictEqual(navLinkCloseResult.navActive, false, `${page}: Nav link click must close navMenu`);
            assert.strictEqual(navLinkCloseResult.bodyMenuOpen, false, `${page}: Nav link click must remove menu-open`);
            console.log(`   ✅ Nav-Link Auto-Close Verified: drawer closed, menu-open removed`);
            passedTestsCount++;

            // Mobile Interaction Step 3.3: Re-open and Outside Click dismiss
            console.log(`   👉 Re-opening mobile drawer and testing outside click dismiss...`);
            const mobileOutsideResult = await client.eval(`(() => {
                const btn = document.getElementById('mobileMenuBtn') || document.querySelector('.mobile-menu-btn');
                const navMenu = document.getElementById('navMenu') || document.querySelector('.nav-menu');
                btn.click(); // Re-open
                document.body.click(); // Click outside
                return {
                    btnActive: btn.classList.contains('active'),
                    navActive: navMenu.classList.contains('active'),
                    bodyMenuOpen: document.body.classList.contains('menu-open')
                };
            })()`);

            assert.strictEqual(mobileOutsideResult.btnActive, false, `${page}: Outside click must close mobile drawer`);
            assert.strictEqual(mobileOutsideResult.navActive, false, `${page}: Outside click must remove active from navMenu`);
            assert.strictEqual(mobileOutsideResult.bodyMenuOpen, false, `${page}: Outside click must remove menu-open`);
            console.log(`   ✅ Mobile Outside Click Dismiss Verified: drawer closed`);
            passedTestsCount++;

            // -----------------------------------------------------------------
            // TEST 4: Global Logout Flow in Real Chromium
            // -----------------------------------------------------------------
            console.log(`👉 [${page}] 4. Global Logout Flow in Real Chromium...`);
            const logoutResult = await client.eval(`(() => {
                window.handleGlobalLogout();
                return {
                    hasToken: !!localStorage.getItem('auth_token'),
                    hasActiveUser: !!localStorage.getItem('active_user')
                };
            })()`);

            assert.strictEqual(logoutResult.hasToken, false, `${page}: Logout must clear auth_token`);
            assert.strictEqual(logoutResult.hasActiveUser, false, `${page}: Logout must clear active_user`);
            console.log(`   ✅ Real Chromium Logout Verified: Storage Cleared`);
            passedTestsCount++;
        }

        client.close();
        console.log(`\n======================================================`);
        console.log(`🎉 ALL ${passedTestsCount} REAL CHROMIUM (EDGE CDP) TESTS PASSED 100%!`);
        console.log(`======================================================`);

    } finally {
        if (chromeProcess) {
            chromeProcess.kill('SIGKILL');
        }
        staticServer.close();
        // Clean up scratch user data dir
        try {
            fs.rmSync(userDataDir, { recursive: true, force: true });
        } catch (e) {}
    }
}

// Run when executed directly
if (require.main === module) {
    runRealChromiumTests().then(() => {
        process.exit(0);
    }).catch(err => {
        console.error('\n❌ REAL CHROMIUM TEST FAILURE:', err);
        process.exit(1);
    });
}

module.exports = { runRealChromiumTests };
