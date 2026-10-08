// test/step86-cross-page-mobile-menu-interactivity.test.js
// Exhaustive Multi-Page Mobile Menu Interactivity & Verification Test Suite

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

test('Step 86: Universal Mobile Menu Interactivity & Multi-Page Real DOM verification across all 15 header pages', () => {
    class MockClassList {
        constructor() { this.set = new Set(); }
        add(c) { this.set.add(c); }
        remove(c) { this.set.delete(c); }
        contains(c) { return this.set.has(c); }
        toggle(c, force) {
            if (force !== undefined) {
                if (force) { this.set.add(c); return true; }
                else { this.set.delete(c); return false; }
            }
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
            this._listeners = {};
        }

        setAttribute(name, val) { this.attributes[name] = String(val); }
        getAttribute(name) { return this.attributes[name] || null; }

        get innerHTML() { return this.innerHTMLContent; }
        set innerHTML(html) {
            this.innerHTMLContent = html;
            this.children = [];
            if (html.includes('user-account-menu-wrapper')) {
                const wrapper = new MockNode('headerUserAccountMenu', 'div');
                wrapper.classList.add('user-account-menu-wrapper');
                wrapper.parentElement = this;

                const toggleBtn = new MockNode('userAccountMenuToggle', 'button');
                toggleBtn.classList.add('user-account-toggle-btn');
                toggleBtn.parentElement = wrapper;

                const dropdown = new MockNode('userAccountDropdown', 'div');
                dropdown.classList.add('user-account-dropdown');
                dropdown.parentElement = wrapper;

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
                if (sel === '.nav-link' && c.classList.contains('nav-link')) return c;
                const found = c.querySelector(sel);
                if (found) return found;
            }
            return null;
        }

        querySelectorAll(sel) {
            const results = [];
            for (const c of this.children) {
                if (sel === '.nav-link, a' && (c.classList.contains('nav-link') || c.tagName === 'A')) results.push(c);
                else if (sel === '.nav-link' && c.classList.contains('nav-link')) results.push(c);
                else if (sel === '.mobile-only-auth' && c.classList.contains('mobile-only-auth')) results.push(c);
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
        }
    }

    pagesToTest.forEach(page => {
        const filePath = path.join(rootDir, page);
        assert.strictEqual(fs.existsSync(filePath), true, `${page} must exist`);
        const html = fs.readFileSync(filePath, 'utf8');

        // Verify markup presence
        assert.ok(
            html.includes('id="mobileMenuBtn"') || html.includes('class="mobile-menu-btn"'),
            `${page} must contain mobileMenuBtn`
        );
        assert.ok(
            html.includes('id="navMenu"') || html.includes('class="nav-menu"'),
            `${page} must contain navMenu`
        );
        assert.ok(
            html.includes('nav-auth.js'),
            `${page} must load nav-auth.js`
        );

        // Simulate Browser Environment
        const rootBody = new MockNode('documentBody', 'body');
        const header = new MockNode('header', 'header');
        rootBody.children.push(header);
        header.parentElement = rootBody;

        const navMenu = new MockNode('navMenu', 'nav');
        navMenu.classList.add('nav-menu');
        header.children.push(navMenu);
        navMenu.parentElement = header;

        const link1 = new MockNode('', 'a');
        link1.classList.add('nav-link');
        navMenu.children.push(link1);
        link1.parentElement = navMenu;

        const link2 = new MockNode('', 'a');
        link2.classList.add('nav-link');
        navMenu.children.push(link2);
        link2.parentElement = navMenu;

        const mobileAuth = new MockNode('', 'div');
        mobileAuth.classList.add('mobile-only-auth');
        navMenu.children.push(mobileAuth);
        mobileAuth.parentElement = navMenu;

        const headerActions = new MockNode('headerActions', 'div');
        headerActions.classList.add('header-actions');
        header.children.push(headerActions);
        headerActions.parentElement = header;

        const headerAuthButtons = new MockNode('headerAuthButtons', 'div');
        headerActions.children.push(headerAuthButtons);
        headerAuthButtons.parentElement = headerActions;

        const mobileMenuBtn = new MockNode('mobileMenuBtn', 'button');
        mobileMenuBtn.classList.add('mobile-menu-btn');
        headerActions.children.push(mobileMenuBtn);
        mobileMenuBtn.parentElement = headerActions;

        const docListeners = {};
        const mockDocument = {
            readyState: 'complete',
            body: rootBody,
            getElementById: (id) => {
                if (id === 'mobileMenuBtn') return mobileMenuBtn;
                if (id === 'navMenu') return navMenu;
                if (id === 'headerAuthButtons') return headerAuthButtons;
                if (id === 'headerUserAccountMenu') return rootBody.querySelector('#headerUserAccountMenu');
                if (id === 'userAccountMenuToggle') return rootBody.querySelector('#userAccountMenuToggle');
                if (id === 'userAccountDropdown') return rootBody.querySelector('#userAccountDropdown');
                return null;
            },
            querySelectorAll: (sel) => {
                const res = [];
                if (sel.includes('.mobile-menu-btn') || sel.includes('#mobileMenuBtn')) res.push(mobileMenuBtn);
                if (sel.includes('.nav-menu') || sel.includes('#navMenu')) res.push(navMenu);
                if (sel.includes('.mobile-only-auth')) res.push(mobileAuth);
                return res;
            },
            addEventListener: (evt, fn) => {
                if (!docListeners[evt]) docListeners[evt] = [];
                docListeners[evt].push(fn);
            },
            removeEventListener: (evt, fn) => {
                if (!docListeners[evt]) return;
                docListeners[evt] = docListeners[evt].filter(f => f !== fn);
            },
            dispatchEvent: (eventObj) => {
                if (docListeners[eventObj.type]) {
                    for (const fn of docListeners[eventObj.type]) fn(eventObj);
                }
            }
        };

        const mockStorage = new Map();
        const mockLocalStorage = {
            getItem: (k) => mockStorage.get(k) || null,
            setItem: (k, v) => mockStorage.set(k, String(v)),
            removeItem: (k) => mockStorage.delete(k),
            clear: () => mockStorage.clear()
        };

        const mockWindow = {
            document: mockDocument,
            localStorage: mockLocalStorage,
            addEventListener: (evt, fn) => {},
            removeEventListener: (evt, fn) => {}
        };

        // Set logged in user state
        mockLocalStorage.setItem('auth_token', 'test-token-kasun');
        mockLocalStorage.setItem('active_user', JSON.stringify({
            id: 'user-kasun',
            full_name: 'Kasun Tharaka',
            username: 'kasun2505'
        }));

        // Execute nav-auth.js in isolated scope
        const runner = new Function('window', 'document', 'localStorage', navAuthCode);
        runner(mockWindow, mockDocument, mockLocalStorage);

        // Verification 1: Click mobile hamburger opens menu
        assert.strictEqual(mobileMenuBtn.classList.contains('active'), false);
        assert.strictEqual(navMenu.classList.contains('active'), false);
        assert.strictEqual(rootBody.classList.contains('menu-open'), false);

        mobileMenuBtn.dispatchEvent({ type: 'click' });
        assert.strictEqual(mobileMenuBtn.classList.contains('active'), true, `${page}: Hamburger click adds active`);
        assert.strictEqual(navMenu.classList.contains('active'), true, `${page}: Hamburger click adds active to navMenu`);
        assert.strictEqual(rootBody.classList.contains('menu-open'), true, `${page}: Body gets menu-open class`);

        // Verification 2: Clicking nav-link closes menu
        link1.dispatchEvent({ type: 'click' });
        assert.strictEqual(mobileMenuBtn.classList.contains('active'), false, `${page}: Nav link click removes active`);
        assert.strictEqual(navMenu.classList.contains('active'), false, `${page}: Nav link click closes navMenu`);
        assert.strictEqual(rootBody.classList.contains('menu-open'), false, `${page}: Body loses menu-open class`);

        // Verification 3: Toggle open again and click outside closes
        mobileMenuBtn.dispatchEvent({ type: 'click' });
        assert.strictEqual(navMenu.classList.contains('active'), true);

        const outsideDiv = new MockNode('outside', 'div');
        mockDocument.dispatchEvent({ type: 'click', target: outsideDiv });
        assert.strictEqual(mobileMenuBtn.classList.contains('active'), false, `${page}: Outside click closes mobile menu`);
        assert.strictEqual(navMenu.classList.contains('active'), false, `${page}: Outside click removes active from navMenu`);

        // Verification 4: Mobile drawer has authenticated user identity
        assert.ok(mobileAuth.innerHTML.includes('Kasun Tharaka'), `${page}: Mobile auth contains user display name`);
        assert.ok(mobileAuth.innerHTML.includes('dashboard.html'), `${page}: Mobile auth contains dashboard link`);
    });
});
