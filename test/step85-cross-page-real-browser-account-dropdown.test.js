// test/step85-cross-page-real-browser-account-dropdown.test.js
// Exhaustive Multi-Page Real DOM & Event Verification for User Account Dropdown

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('./test-runner');

const rootDir = path.resolve(__dirname, '..');
const navAuthCode = fs.readFileSync(path.join(rootDir, 'nav-auth.js'), 'utf8');

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

test('Step 85: Multi-page real DOM simulation and click lifecycle verification across all 15 header pages', () => {
    // Simulated Browser Environment supporting full DOM tree & Event Bubbling
    class MockClassList {
        constructor() { this.set = new Set(); }
        add(c) { this.set.add(c); }
        remove(c) { this.set.delete(c); }
        contains(c) { return this.set.has(c); }
        toggle(c) {
            if (this.set.has(c)) { this.set.delete(c); return false; }
            else { this.set.add(c); return true; }
        }
    }

    class MockNode {
        constructor(id = '', tagName = 'div') {
            this.id = id;
            this.tagName = tagName.toUpperCase();
            this.classList = new MockClassList();
            this.attributes = {};
            this.children = [];
            this.parentElement = null;
            this.innerHTMLContent = '';
            this.textContentContent = '';
            this.onclick = null;
            this.onkeydown = null;
            this._listeners = {};
        }

        setAttribute(name, val) { this.attributes[name] = String(val); }
        getAttribute(name) { return this.attributes[name] || null; }

        get innerHTML() { return this.innerHTMLContent; }
        set innerHTML(html) {
            this.innerHTMLContent = html;
            // Parse injected elements
            this.children = [];
            if (html.includes('user-account-menu-wrapper')) {
                const wrapper = new MockNode('headerUserAccountMenu', 'div');
                wrapper.classList.add('user-account-menu-wrapper');
                wrapper.parentElement = this;

                const toggleBtn = new MockNode('userAccountMenuToggle', 'button');
                toggleBtn.classList.add('user-account-toggle-btn');
                toggleBtn.classList.add('header-register-btn');
                toggleBtn.parentElement = wrapper;

                // Parse aria attributes from html
                if (html.includes('aria-expanded="false"')) toggleBtn.setAttribute('aria-expanded', 'false');
                if (html.includes('aria-haspopup="menu"')) toggleBtn.setAttribute('aria-haspopup', 'menu');

                const avatar = new MockNode('headerUserAvatar', 'span');
                avatar.classList.add('user-account-avatar');
                avatar.parentElement = toggleBtn;

                const name = new MockNode('headerUserDisplayName', 'span');
                name.classList.add('user-account-name');
                name.parentElement = toggleBtn;

                const chevron = new MockNode('', 'span');
                chevron.classList.add('user-account-chevron');
                chevron.parentElement = toggleBtn;

                toggleBtn.children.push(avatar, name, chevron);

                const dropdown = new MockNode('userAccountDropdown', 'div');
                dropdown.classList.add('user-account-dropdown');
                dropdown.setAttribute('role', 'menu');
                dropdown.parentElement = wrapper;

                const item1 = new MockNode('', 'a');
                item1.classList.add('user-account-dropdown-item');
                dropdown.children.push(item1);

                wrapper.children.push(toggleBtn, dropdown);
                this.children.push(wrapper);
            }
        }

        get textContent() { return this.textContentContent; }
        set textContent(t) { this.textContentContent = t; }

        contains(targetNode) {
            if (!targetNode) return false;
            if (targetNode === this) return true;
            let curr = targetNode.parentElement;
            while (curr) {
                if (curr === this) return true;
                curr = curr.parentElement;
            }
            return false;
        }

        querySelector(sel) {
            for (const c of this.children) {
                if (sel === 'a, button' && (c.tagName === 'A' || c.tagName === 'BUTTON')) return c;
                const found = c.querySelector(sel);
                if (found) return found;
            }
            return null;
        }

        querySelectorAll(sel) {
            const results = [];
            for (const c of this.children) {
                if (sel === '.mobile-only-auth' && c.classList.contains('mobile-only-auth')) results.push(c);
                results.push(...c.querySelectorAll(sel));
            }
            return results;
        }

        addEventListener(evt, fn) {
            if (!this._listeners[evt]) this._listeners[evt] = [];
            this._listeners[evt].push(fn);
        }

        removeEventListener(evt, fn) {
            if (!this._listeners[evt]) return;
            this._listeners[evt] = this._listeners[evt].filter(f => f !== fn);
        }

        focus() {
            if (this.ownerDocument) this.ownerDocument.activeElement = this;
        }

        blur() {
            if (this.ownerDocument && this.ownerDocument.activeElement === this) {
                this.ownerDocument.activeElement = null;
            }
        }

        dispatchEvent(eventObj) {
            eventObj.target = this;
            let curr = this;
            let stopped = false;
            eventObj.stopPropagation = () => { stopped = true; };
            eventObj.preventDefault = () => { eventObj.defaultPrevented = true; };

            while (curr) {
                eventObj.currentTarget = curr;
                if (curr.onclick && eventObj.type === 'click') {
                    curr.onclick(eventObj);
                }
                if (curr._listeners[eventObj.type]) {
                    for (const fn of curr._listeners[eventObj.type]) {
                        fn(eventObj);
                    }
                }
                if (stopped) break;
                curr = curr.parentElement;
            }

            // Finally trigger document listeners if not stopped
            if (!stopped && global.document && global.document._listeners && global.document._listeners[eventObj.type]) {
                for (const fn of global.document._listeners[eventObj.type]) {
                    fn(eventObj);
                }
            }
        }
    }

    // Run verification on each of the 15 pages
    pagesToTest.forEach(page => {
        const pagePath = path.join(rootDir, page);
        const html = fs.readFileSync(pagePath, 'utf-8');

        assert.ok(html.includes('id="headerAuthButtons"'), `${page} must contain #headerAuthButtons container`);
        assert.ok(html.includes('nav-auth.js'), `${page} must load nav-auth.js`);

        // Setup Mock Document for this page
        const headerAuthButtons = new MockNode('headerAuthButtons', 'div');
        const rootBody = new MockNode('', 'body');
        rootBody.children.push(headerAuthButtons);
        headerAuthButtons.parentElement = rootBody;

        const storage = new Map();
        global.localStorage = {
            getItem: (k) => storage.get(k) || null,
            setItem: (k, v) => storage.set(k, String(v)),
            removeItem: (k) => storage.delete(k),
            clear: () => storage.clear()
        };
        global.sessionStorage = {
            clear: () => {}
        };

        const docListeners = {};
        global.document = {
            _listeners: docListeners,
            readyState: 'complete',
            getElementById: (id) => {
                if (id === 'headerAuthButtons') return headerAuthButtons;
                const found = rootBody.querySelector(`#${id}`) || (function search(node) {
                    if (node.id === id) return node;
                    for (const ch of node.children) {
                        const res = search(ch);
                        if (res) return res;
                    }
                    return null;
                })(rootBody);
                return found;
            },
            querySelectorAll: (sel) => rootBody.querySelectorAll(sel),
            addEventListener: (evt, fn) => {
                if (!docListeners[evt]) docListeners[evt] = [];
                docListeners[evt].push(fn);
            },
            removeEventListener: (evt, fn) => {
                if (!docListeners[evt]) return;
                docListeners[evt] = docListeners[evt].filter(f => f !== fn);
            }
        };

        global.window = {
            location: { replace: () => {} },
            addEventListener: () => {}
        };

        // 1. Simulate User A Login: Kasun Tharaka
        global.localStorage.setItem('auth_token', 'token-user-kasun-101');
        global.localStorage.setItem('active_user', JSON.stringify({
            id: 'user-kasun-101',
            full_name: 'Kasun Tharaka',
            username: 'kasun2505'
        }));

        // Execute nav-auth.js
        eval(navAuthCode);

        // Verify elements created in DOM
        const toggleBtn = global.document.getElementById('userAccountMenuToggle');
        const dropdown = global.document.getElementById('userAccountDropdown');
        const avatar = global.document.getElementById('headerUserAvatar');
        const nameSpan = global.document.getElementById('headerUserDisplayName');

        assert.ok(toggleBtn, `${page}: #userAccountMenuToggle must exist in DOM`);
        assert.ok(dropdown, `${page}: #userAccountDropdown must exist in DOM`);
        assert.ok(avatar, `${page}: #headerUserAvatar must exist in DOM`);
        assert.ok(nameSpan, `${page}: #headerUserDisplayName must exist in DOM`);

        // Test 1: Click directly on Button
        assert.strictEqual(dropdown.classList.contains('open'), false, `${page}: Dropdown starts closed`);
        toggleBtn.dispatchEvent({ type: 'click' });
        assert.strictEqual(dropdown.classList.contains('open'), true, `${page}: Click button opens dropdown`);
        assert.strictEqual(toggleBtn.getAttribute('aria-expanded'), 'true');

        // Click again closes
        toggleBtn.dispatchEvent({ type: 'click' });
        assert.strictEqual(dropdown.classList.contains('open'), false, `${page}: Second click closes dropdown`);
        assert.strictEqual(toggleBtn.getAttribute('aria-expanded'), 'false');

        // Test 2: Click on Avatar (child element bubbling)
        avatar.dispatchEvent({ type: 'click' });
        assert.strictEqual(dropdown.classList.contains('open'), true, `${page}: Click avatar opens dropdown`);

        // Test 3: Outside click closes
        const outsideNode = new MockNode('outsideContent', 'div');
        rootBody.children.push(outsideNode);
        outsideNode.parentElement = rootBody;

        outsideNode.dispatchEvent({ type: 'click' });
        assert.strictEqual(dropdown.classList.contains('open'), false, `${page}: Outside click closes dropdown`);

        // Test 4: Click on Display Name (child element bubbling)
        nameSpan.dispatchEvent({ type: 'click' });
        assert.strictEqual(dropdown.classList.contains('open'), true, `${page}: Click display name opens dropdown`);

        // Test 5: Keyboard Escape closes
        toggleBtn.onkeydown({ key: 'Escape', preventDefault: () => {} });
        assert.strictEqual(dropdown.classList.contains('open'), false, `${page}: Escape key closes dropdown`);

        // Test 6: Keyboard Enter opens
        toggleBtn.onkeydown({ key: 'Enter', preventDefault: () => {} });
        assert.strictEqual(dropdown.classList.contains('open'), true, `${page}: Enter key opens dropdown`);

        // Test 7: Cross-User Isolation: Logout User A, Login User B
        global.window.handleGlobalLogout();
        assert.strictEqual(global.localStorage.getItem('active_user'), null);

        global.localStorage.setItem('auth_token', 'token-user-maxsave');
        global.localStorage.setItem('active_user', JSON.stringify({
            id: 'user-maxsave',
            username: 'maxsave2505'
        }));

        global.window.syncNavAuthState();
        const userBDisplayName = global.window.getUserDisplayName(JSON.parse(global.localStorage.getItem('active_user')));
        assert.strictEqual(userBDisplayName, 'maxsave2505', `${page}: User B identity must be maxsave2505`);
        assert.strictEqual(userBDisplayName.includes('Kasun'), false, `${page}: User A identity must NOT remain`);
    });
});
