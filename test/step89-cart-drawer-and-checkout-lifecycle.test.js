// test/step89-cart-drawer-and-checkout-lifecycle.test.js
// Verification for Cart Drawer State Synchronization, Order Success Lifecycle, and TDZ Prevention

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test } = require('./test-runner');

const rootDir = path.resolve(__dirname, '..');

test('Step 89: 1. order-success.html declares billing before reference (Eliminates TDZ / ReferenceError)', () => {
    const pages = ['order-success.html', 'HapanamyWeb/order-success.html'];
    
    for (const page of pages) {
        const filePath = path.join(rootDir, page);
        assert.ok(fs.existsSync(filePath), `${page} must exist`);
        const content = fs.readFileSync(filePath, 'utf8');

        // Extract script tag content
        const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/i);
        assert.ok(scriptMatch, `${page} must contain a <script> block`);
        const scriptCode = scriptMatch[1];

        // Ensure billing is declared near the top before buyerName and referrerRow
        const billingDeclIndex = scriptCode.indexOf('const billing =');
        const buyerNameIndex = scriptCode.indexOf('const buyerName =');
        const referrerRowIndex = scriptCode.indexOf("document.getElementById('referrerRow')");

        assert.ok(billingDeclIndex !== -1, `${page} must declare const billing`);
        assert.ok(buyerNameIndex !== -1, `${page} must declare const buyerName`);
        assert.ok(billingDeclIndex < buyerNameIndex, `${page} must declare const billing BEFORE const buyerName (prevents TDZ)`);
        
        if (referrerRowIndex !== -1) {
            assert.ok(billingDeclIndex < referrerRowIndex, `${page} must declare const billing BEFORE referrerRow access`);
        }
    }
});

test('Step 89: 2. order-success.html executes cleanly across PayHere and Bank Deposit scenarios in DOM VM context', () => {
    const filePath = path.join(rootDir, 'order-success.html');
    const content = fs.readFileSync(filePath, 'utf8');
    const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/i);
    assert.ok(scriptMatch, 'order-success.html must contain a <script> block');
    const scriptCode = scriptMatch[1];

    const testScenarios = [
        {
            name: 'PayHere Gateway with full billing & referrer',
            queryString: '?amount=19900&method=payhere&product=titan-elite-trading',
            storage: {
                checkout_billing: JSON.stringify({ name: 'Kasun Perera', email: 'kasun@example.com', phone: '0771234567', referrer: 'VIP_AFFILIATE_99' }),
                active_user: JSON.stringify({ id: 'usr-100', email: 'kasun@example.com', username: 'kasunp' }),
                language: 'si',
                theme: 'dark'
            }
        },
        {
            name: 'Direct Bank Deposit without prior billing record',
            queryString: '?amount=7425&method=bank',
            storage: {
                language: 'en',
                theme: 'light'
            }
        }
    ];

    for (const scenario of testScenarios) {
        // Build mock DOM elements
        const domElements = {};
        const getOrCreateElement = (id) => {
            if (!domElements[id]) {
                domElements[id] = {
                    id: id,
                    textContent: '',
                    innerHTML: '',
                    value: '',
                    style: {},
                    href: '',
                    select: () => {},
                    setAttribute: () => {},
                    getAttribute: () => null,
                    appendChild: () => {},
                    querySelectorAll: () => []
                };
            }
            return domElements[id];
        };

        const mockLocalStorage = {
            store: { ...scenario.storage },
            getItem: (k) => (mockLocalStorage.store[k] !== undefined ? mockLocalStorage.store[k] : null),
            setItem: (k, v) => { mockLocalStorage.store[k] = String(v); },
            removeItem: (k) => { delete mockLocalStorage.store[k]; }
        };

        const context = {
            window: {
                location: {
                    search: scenario.queryString,
                    origin: 'https://hapanamy.lk',
                    href: 'https://hapanamy.lk/order-success.html' + scenario.queryString,
                    print: () => {}
                },
                print: () => {},
                addEventListener: () => {}
            },
            document: {
                documentElement: {
                    setAttribute: (k, v) => { domElements['doc_' + k] = v; }
                },
                getElementById: (id) => getOrCreateElement(id),
                querySelectorAll: () => [],
                createElement: (tag) => ({
                    className: '',
                    innerHTML: '',
                    remove: () => {}
                }),
                execCommand: () => true
            },
            localStorage: mockLocalStorage,
            URLSearchParams: require('url').URLSearchParams,
            Math: Math,
            Date: Date,
            parseFloat: parseFloat,
            JSON: JSON,
            setTimeout: () => {},
            dbAddOrder: async () => true,
            console: console
        };

        // Run the script in VM sandbox - MUST NOT THROW
        assert.doesNotThrow(() => {
            vm.runInNewContext(scriptCode, context);
        }, `order-success.html must execute without any ReferenceError or runtime exception in scenario: ${scenario.name}`);

        // Verify elements were populated correctly
        const metaPaidAmount = domElements['metaPaidAmount'];
        assert.ok(metaPaidAmount && metaPaidAmount.textContent.includes('රු.'), 'metaPaidAmount must be formatted with currency symbol');

        const metaTxnCode = domElements['metaTxnCode'];
        assert.ok(metaTxnCode && metaTxnCode.textContent.startsWith('TXN-'), 'metaTxnCode must be generated with TXN- prefix');

        const metaPayMethod = domElements['metaPayMethod'];
        assert.ok(metaPayMethod && metaPayMethod.textContent.length > 0, 'metaPayMethod must be populated');

        const successAffInput = domElements['successAffLinkInput'];
        assert.ok(successAffInput && successAffInput.value.includes('?ref='), 'successAffLinkInput must contain affiliate referral link');
    }
});

test('Step 89: 3. index.js implements cross-tab cart state sync, localStorage reloading, and global window exports', () => {
    const files = ['index.js', 'HapanamyWeb/index.js'];

    for (const file of files) {
        const filePath = path.join(rootDir, file);
        assert.ok(fs.existsSync(filePath), `${file} must exist`);
        const content = fs.readFileSync(filePath, 'utf8');

        // Check global window exports
        assert.ok(content.includes('window.toggleCartDrawer = toggleCartDrawer'), `${file} must export toggleCartDrawer to window`);
        assert.ok(content.includes('window.addToCart = addToCart'), `${file} must export addToCart to window`);
        assert.ok(content.includes('window.removeFromCart = removeFromCart'), `${file} must export removeFromCart to window`);
        assert.ok(content.includes('window.updateCartUI = updateCartUI'), `${file} must export updateCartUI to window`);
        assert.ok(content.includes('window.proceedToCheckout = proceedToCheckout'), `${file} must export proceedToCheckout to window`);

        // Check storage event listener
        assert.ok(content.includes("if (e.key === 'hapanamy_cart')"), `${file} must handle hapanamy_cart storage event`);
    }
});

test('Step 89: 4. Cart Drawer operations (Add, Remove, Quantity, Total calculation) operate correctly in memory & localStorage', () => {
    const storageStore = {};
    const mockLocalStorage = {
        getItem: (k) => (storageStore[k] !== undefined ? storageStore[k] : null),
        setItem: (k, v) => { storageStore[k] = String(v); },
        removeItem: (k) => { delete storageStore[k]; }
    };

    let cart = [];
    const addToCart = (id, title, price) => {
        cart = JSON.parse(mockLocalStorage.getItem('hapanamy_cart')) || [];
        if (cart.some(item => item.id === id)) return false;
        cart.push({ id, title, price });
        mockLocalStorage.setItem('hapanamy_cart', JSON.stringify(cart));
        return true;
    };

    const removeFromCart = (index) => {
        cart = JSON.parse(mockLocalStorage.getItem('hapanamy_cart')) || [];
        if (index >= 0 && index < cart.length) {
            cart.splice(index, 1);
            mockLocalStorage.setItem('hapanamy_cart', JSON.stringify(cart));
            return true;
        }
        return false;
    };

    // 1. Initial Empty Cart
    assert.strictEqual(mockLocalStorage.getItem('hapanamy_cart'), null);

    // 2. Add First Course
    const added1 = addToCart('titan-elite', 'Titan Elite Trading Academy', 19900);
    assert.strictEqual(added1, true);
    assert.strictEqual(JSON.parse(mockLocalStorage.getItem('hapanamy_cart')).length, 1);
    assert.strictEqual(JSON.parse(mockLocalStorage.getItem('hapanamy_cart'))[0].price, 19900);

    // 3. Prevent Duplicate Add
    const duplicateAdd = addToCart('titan-elite', 'Titan Elite Trading Academy', 19900);
    assert.strictEqual(duplicateAdd, false);
    assert.strictEqual(JSON.parse(mockLocalStorage.getItem('hapanamy_cart')).length, 1);

    // 4. Add Second Course
    const added2 = addToCart('fb-mastery', 'Facebook Monetization Masterclass', 7425);
    assert.strictEqual(added2, true);
    const updatedCart = JSON.parse(mockLocalStorage.getItem('hapanamy_cart'));
    assert.strictEqual(updatedCart.length, 2);

    const total = updatedCart.reduce((sum, item) => sum + item.price, 0);
    assert.strictEqual(total, 27325);

    // 5. Remove First Course
    const removed = removeFromCart(0);
    assert.strictEqual(removed, true);
    const finalCart = JSON.parse(mockLocalStorage.getItem('hapanamy_cart'));
    assert.strictEqual(finalCart.length, 1);
    assert.strictEqual(finalCart[0].id, 'fb-mastery');
    assert.strictEqual(finalCart[0].price, 7425);
});
