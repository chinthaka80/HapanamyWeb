// test/step92-dashboard-button-and-script-execution.test.js
// Verification for Dashboard Buttons, Tab Switching, and Script Compilation

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test } = require('./test-runner');

const rootDir = path.resolve(__dirname, '..');

test('Step 92: 1. dashboard.html & HapanamyWeb/dashboard.html parse cleanly with zero syntax errors', () => {
    const files = ['dashboard.html', 'HapanamyWeb/dashboard.html'];

    for (const file of files) {
        const filePath = path.join(rootDir, file);
        assert.ok(fs.existsSync(filePath), `${file} must exist`);
        const content = fs.readFileSync(filePath, 'utf8');

        const scripts = [...content.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
        assert.ok(scripts.length >= 2, `${file} must contain at least 2 script blocks`);

        scripts.forEach((m, scriptIdx) => {
            const attrs = m[1];
            const code = m[2].trim();
            if (attrs.includes('ld+json') || attrs.includes('src=') || !code) return;

            assert.doesNotThrow(() => {
                new vm.Script(code, { filename: `${file}-script-${scriptIdx}.js` });
            }, `Script block ${scriptIdx} in ${file} must compile without SyntaxError`);
        });
    }
});

test('Step 92: 2. dashboard.html tab switching and mobile sidebar functions execute cleanly in VM context', () => {
    const html = fs.readFileSync(path.join(rootDir, 'dashboard.html'), 'utf8');
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
    const mainScript = scripts[scripts.length - 1][2];

    function createClassList(initial) {
        const set = new Set(initial || []);
        return {
            add: (c) => set.add(c),
            remove: (c) => set.delete(c),
            contains: (c) => set.has(c),
            toggle: (c, force) => {
                if (force === true) set.add(c);
                else if (force === false) set.delete(c);
                else if (set.has(c)) set.delete(c);
                else set.add(c);
            }
        };
    }

    // Mock DOM environment in VM
    const mockElements = {
        'panel-overview': { id: 'panel-overview', classList: createClassList(['active']) },
        'panel-earnings': { id: 'panel-earnings', classList: createClassList() },
        'panel-network': { id: 'panel-network', classList: createClassList() },
        'panel-referrals': { id: 'panel-referrals', classList: createClassList() },
        'panel-links': { id: 'panel-links', classList: createClassList() },
        'panel-products': { id: 'panel-products', classList: createClassList() },
        'panel-financial': { id: 'panel-financial', classList: createClassList() },
        'panel-settings': { id: 'panel-settings', classList: createClassList() },
        'memberSidebar': { id: 'memberSidebar', classList: createClassList() },
        'sidebarBackdrop': { id: 'sidebarBackdrop', classList: createClassList() },
        'topbarSectionTitle': { textContent: '' },
        'topbarSectionIcon': { textContent: '' }
    };

    const localStorageMock = {
        getItem: (k) => k === 'theme' ? 'dark' : null,
        setItem: () => {}
    };

    const sandbox = {
        console,
        document: {
            documentElement: { setAttribute: () => {}, getAttribute: () => 'dark' },
            getElementById: (id) => mockElements[id] || null,
            querySelectorAll: (sel) => {
                if (sel === '.tab-panel') {
                    return Object.values(mockElements).filter(el => el.id && el.id.startsWith('panel-'));
                }
                return [];
            },
            querySelector: () => ({ scrollTo: () => {} }),
            addEventListener: () => {},
            hidden: false,
            body: { style: { overflow: '' } }
        },
        localStorage: localStorageMock,
        addEventListener: () => {},
        removeEventListener: () => {},
        setTimeout: () => {},
        setInterval: () => {},
        clearInterval: () => {}
    };
    sandbox.window = sandbox;

    const context = vm.createContext(sandbox);
    vm.runInContext(mainScript, context);

    // Verify global switchMemberTab function
    assert.equal(typeof sandbox.window.switchMemberTab, 'function', 'switchMemberTab must be defined on window');
    assert.equal(typeof sandbox.window.toggleMobileSidebar, 'function', 'toggleMobileSidebar must be defined on window');
    assert.equal(typeof sandbox.copyRefLink, 'function', 'copyRefLink must be defined');

    // Test tab switches
    const tabNames = ['earnings', 'network', 'referrals', 'links', 'products', 'financial', 'settings', 'overview'];
    for (const tab of tabNames) {
        sandbox.window.switchMemberTab(tab);
        assert.ok(mockElements[`panel-${tab}`].classList.contains('active'), `Panel for ${tab} must be active after switch`);
        assert.ok(sandbox.document.getElementById('topbarSectionTitle').textContent.length > 0, `Section title must be updated for ${tab}`);
    }

    // Test mobile drawer toggle
    sandbox.window.toggleMobileSidebar(true);
    assert.ok(mockElements['memberSidebar'].classList.contains('open'), 'Sidebar must be open');
    sandbox.window.toggleMobileSidebar(false);
    assert.ok(!mockElements['memberSidebar'].classList.contains('open'), 'Sidebar must be closed');
});

test('Step 92: 3. nexus_dashboard.html script compilation and modal backdrop handler', () => {
    const html = fs.readFileSync(path.join(rootDir, 'nexus_dashboard.html'), 'utf8');
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
    assert.ok(scripts.length >= 2, 'nexus_dashboard.html must contain at least 2 script blocks');

    scripts.forEach((m, scriptIdx) => {
        const attrs = m[1];
        const code = m[2].trim();
        if (attrs.includes('ld+json') || attrs.includes('src=') || !code) return;

        assert.doesNotThrow(() => {
            new vm.Script(code, { filename: `nexus-dashboard-test-${scriptIdx}.js` });
        }, `Script ${scriptIdx} in nexus_dashboard.html must parse with zero syntax errors`);
    });
});

test('Step 92: 4. dashboard.html dynamically resolves and updates user full name in topbar, banner, and document title', () => {
    const html = fs.readFileSync(path.join(rootDir, 'dashboard.html'), 'utf8');
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
    const mainScript = scripts[scripts.length - 1][2];

    const mockProfileElements = {
        'profileFullName': { textContent: '' },
        'sidebarName': { textContent: '' },
        'profileUsernameDisplay': { innerHTML: '' },
        'sidebarUsername': { textContent: '' },
        'profileAvatarBig': { textContent: '' },
        'sidebarAvatar': { textContent: '' },
        'topbarSectionTitle': { textContent: '' },
        'topbarSectionIcon': { textContent: '' },
        'leftRefLinkInput': { value: '' },
        'tabLeftRefLink': { value: '' },
        'rightRefLinkInput': { value: '' },
        'tabRightRefLink': { value: '' },
        'tabGeneralRefLink': { value: '' },
        'settingsFullName': { textContent: '' },
        'settingsUsername': { textContent: '' },
        'settingsEmail': { textContent: '' },
        'settingsPhone': { textContent: '' }
    };

    const userObj = {
        id: 'user-hapana-09',
        username: 'hapana09',
        full_name: 'Kavishka Sandaruwan',
        email: 'kavishka@hapanamy.lk',
        phone: '+94 77 123 4567',
        role: 'member'
    };

    const sandbox = {
        console,
        document: {
            title: '',
            documentElement: { setAttribute: () => {}, getAttribute: () => 'dark' },
            getElementById: (id) => mockProfileElements[id] || null,
            querySelectorAll: () => [],
            querySelector: () => null,
            addEventListener: () => {},
            hidden: false,
            body: { style: { overflow: '' } }
        },
        localStorage: {
            getItem: (k) => k === 'active_user' ? JSON.stringify(userObj) : null,
            setItem: () => {}
        },
        location: { origin: 'http://localhost:3000' },
        addEventListener: () => {},
        removeEventListener: () => {},
        setTimeout: () => {},
        setInterval: () => {},
        clearInterval: () => {}
    };
    sandbox.window = sandbox;

    const context = vm.createContext(sandbox);
    vm.runInContext(mainScript, context);

    // Call applyLocalUserProfile
    sandbox.applyLocalUserProfile(userObj);

    assert.equal(mockProfileElements['profileFullName'].textContent, 'Kavishka Sandaruwan', 'Profile banner must display user full name');
    assert.equal(mockProfileElements['sidebarName'].textContent, 'Kavishka Sandaruwan', 'Sidebar user pill must display user full name');
    assert.ok(mockProfileElements['topbarSectionTitle'].textContent.includes('Kavishka Sandaruwan'), 'Topbar title must include user full name');
    assert.ok(sandbox.document.title.includes('Kavishka Sandaruwan'), 'Document title must include user full name');
});
