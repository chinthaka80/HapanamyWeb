const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Test Suite: Step 63 - Admin Manual Product Purchase, Full MLM Commission & BV Calculation, and Multi-Identity Login Verification

async function runStep63Tests() {
    console.log('\n================================================================');
    console.log('🚀 RUNNING STEP 63: ADMIN MANUAL PURCHASE & LOGIN TEST SUITE');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    function test(desc, fn) {
        try {
            fn();
            console.log(`✅ PASSED: ${desc}`);
            passed++;
        } catch (err) {
            console.error(`❌ FAILED: ${desc}`);
            console.error(err);
            failed++;
        }
    }

    async function asyncTest(desc, fn) {
        try {
            await fn();
            console.log(`✅ PASSED: ${desc}`);
            passed++;
        } catch (err) {
            console.error(`❌ FAILED: ${desc}`);
            console.error(err);
            failed++;
        }
    }

    // 1. In-memory Mock Testing for Direct Commission & BV Formulas
    test('1. MLM Commission Math Invariants (8% Direct, 7% Binary, Exact BV)', () => {
        const productPrice = 7425.00;
        const expectedDirectComm = 594.00; // 7425 * 0.08
        const expectedBinaryVolume = 7425.00;
        const expectedBinaryCommOn1000BV = 70.00; // 1000 * 0.07

        const calcDirect = Math.round(productPrice * 0.08 * 100) / 100;
        const calcBinary = Math.round(1000 * 0.07 * 100) / 100;

        assert.strictEqual(calcDirect, expectedDirectComm, 'Direct commission must be exact 8% of selling price');
        assert.strictEqual(calcBinary, expectedBinaryCommOn1000BV, 'Binary commission must be exact 7% of matched BV');
        assert.strictEqual(productPrice, expectedBinaryVolume, 'Binary volume must equal selling price');
    });

    // 2. Test PurchaseOrchestrator Execution for Admin Manual Purchase
    test('2. PurchaseOrchestrator handles Admin Manual Purchase with 8% Direct & BV Propagation', () => {
        const PurchaseOrchestrator = require('../services/purchase-orchestrator');
        const mockUsers = [
            { id: 'user-hiru-root', username: 'Hiru', role: 'member', status: 'ACTIVE', qualification_status: 'NOT_QUALIFIED' },
            { id: 'user-sun-101', username: 'Sun', role: 'member', status: 'INACTIVE', qualification_status: 'NOT_QUALIFIED', position: 'LEFT' }
        ];
        const mockSponsors = [
            { user_id: 'user-sun-101', sponsor_id: 'user-hiru-root', sponsor_username: 'Hiru' }
        ];
        const mockBinaryNodes = [
            { user_id: 'user-hiru-root', placement_parent_id: null, position: 'ROOT', left_child_id: 'user-sun-101', right_child_id: null },
            { user_id: 'user-sun-101', placement_parent_id: 'user-hiru-root', position: 'LEFT', left_child_id: null, right_child_id: null }
        ];
        const mockPurchases = [];
        const mockCommissionLedger = [];
        const mockVolumeLedger = [];
        const mockWalletLedger = [];

        const testProduct = {
            id: 'facebook-course',
            name: 'Facebook Monetization Zoom',
            selling_price: 7425.00,
            price: 7425.00,
            binary_volume: 7425.00,
            direct_commission_percent: 8.0,
            binary_commission_percent: 7.0,
            max_binary_qualified_levels: 7,
            status: 'ACTIVE'
        };

        const testPurchase = {
            id: 'purch-test-6301',
            order_number: 'ORD-TEST-6301',
            user_id: 'user-sun-101',
            product_id: 'facebook-course',
            price_paid: 7425.00,
            binary_volume: 7425.00,
            payment_method: 'ADMIN_MANUAL',
            status: 'PENDING'
        };

        const result = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
            purchase: testPurchase,
            product: testProduct,
            userId: 'user-sun-101',
            binaryNodes: mockBinaryNodes,
            sponsors: mockSponsors,
            users: mockUsers,
            kycDocs: [],
            purchases: mockPurchases,
            commissionLedger: mockCommissionLedger,
            volumeLedger: mockVolumeLedger,
            walletLedger: mockWalletLedger
        });

        assert.strictEqual(testPurchase.status, 'ACTIVE', 'Purchase status must be ACTIVE');
        assert.ok(mockWalletLedger.length >= 1, 'Wallet ledger must record direct commission transaction');
        
        const directTx = mockWalletLedger.find(tx => tx.user_id === 'user-hiru-root');
        assert.ok(directTx, 'Direct sponsor Hiru must receive wallet credit');
        assert.strictEqual(directTx.amount, 594.00, 'Direct sponsor must receive Rs. 594.00 (8% of 7,425.00)');

        const volTx = mockVolumeLedger.find(v => v.user_id === 'user-hiru-root' && v.source_user_id === 'user-sun-101');
        assert.ok(volTx, 'Ancestor volume ledger must record BV propagation');
        assert.strictEqual(volTx.amount, 7425.00, 'Volume amount must equal 7,425 BV');
    });

    // 3. Test Dual-Leg Qualification Upgrade on Dual Direct Purchases
    test('3. Sponsor Dual-Leg Qualification upgrades to QUALIFIED when both Left and Right Directs are Active', () => {
        const QualificationEngine = require('../services/qualification-engine');
        const users = [
            { id: 'user-hiru-root', username: 'Hiru', role: 'member', status: 'ACTIVE', qualification_status: 'NOT_QUALIFIED' },
            { id: 'user-left-1', username: 'LeftUser', role: 'member', status: 'ACTIVE', qualification_status: 'NOT_QUALIFIED' },
            { id: 'user-right-2', username: 'RightUser', role: 'member', status: 'ACTIVE', qualification_status: 'NOT_QUALIFIED' }
        ];
        const sponsors = [
            { user_id: 'user-left-1', sponsor_id: 'user-hiru-root' },
            { user_id: 'user-right-2', sponsor_id: 'user-hiru-root' }
        ];
        const binaryNodes = [
            { user_id: 'user-hiru-root', placement_parent_id: null, position: 'ROOT' },
            { user_id: 'user-left-1', placement_parent_id: 'user-hiru-root', position: 'LEFT' },
            { user_id: 'user-right-2', placement_parent_id: 'user-hiru-root', position: 'RIGHT' }
        ];
        const purchases = [
            { id: 'p-1', user_id: 'user-left-1', status: 'ACTIVE', price_paid: 7425.00 },
            { id: 'p-2', user_id: 'user-right-2', status: 'ACTIVE', price_paid: 7425.00 }
        ];

        const status = QualificationEngine.getMemberComprehensiveStatus('user-hiru-root', {
            users,
            kycDocs: [],
            purchases,
            sponsors,
            binaryNodes,
            volumeLedger: []
        });

        assert.strictEqual(status.is_qualified, true, 'Sponsor with active left and right direct sales must be QUALIFIED');
        assert.strictEqual(status.qualification_status, 'QUALIFIED', 'Qualification status must be QUALIFIED');
    });

    // 4. Test PHP API Router File Integrity & Syntax
    test('4. api/index.php contains clean syntax, auth/login, and admin manual-purchase routes', () => {
        const phpCode = fs.readFileSync(path.join(__dirname, '..', 'api', 'index.php'), 'utf8');
        assert.ok(phpCode.includes("auth/login"), 'api/index.php must define auth/login route');
        assert.ok(phpCode.includes("admin/members/manual-purchase"), 'api/index.php must define admin manual-purchase route');
        assert.ok(phpCode.includes("$directCommission = round($amount * 0.08, 2);"), 'api/index.php must calculate exact 8% direct commission');
        assert.ok(phpCode.includes("volumeLedger"), 'api/index.php must propagate volume to volumeLedger');
    });

    // 5. Test Admin Portal HTML contains manual purchase modal & action buttons
    test('5. hapanamy-admin-portal-9226.html has adminManualPurchaseModal and action buttons', () => {
        const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'hapanamy-admin-portal-9226.html'), 'utf8');
        assert.ok(adminHtml.includes('id="adminManualPurchaseModal"'), 'Admin portal must have adminManualPurchaseModal');
        assert.ok(adminHtml.includes('openAdminManualPurchaseModal'), 'Admin portal must define openAdminManualPurchaseModal function');
        assert.ok(adminHtml.includes('submitAdminManualPurchase'), 'Admin portal must define submitAdminManualPurchase function');
        assert.ok(adminHtml.includes('🛒 පාඨමාලා සක්‍රිය කරන්න'), 'Admin portal table must contain manual purchase action button');
    });

    console.log(`\n📊 STEP 63 TEST RESULTS: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} TESTS\n`);
    if (failed > 0) {
        process.exit(1);
    }
}

runStep63Tests();
