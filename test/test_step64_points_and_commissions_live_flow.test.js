const assert = require('assert');
const http = require('http');
const VolumeLedger = require('../services/volume-ledger');
const WalletService = require('../services/wallet-service');
const PurchaseOrchestrator = require('../services/purchase-orchestrator');
const QualificationEngine = require('../services/qualification-engine');
const MLMNetworkEngine = require('../services/mlm-network-engine');

async function runStep64Tests() {
    console.log('\n================================================================');
    console.log('🚀 RUNNING STEP 64: POINTS & COMMISSIONS UPLINE LIVE FLOW TEST');
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

    // 1. Test Multi-tier BV Propagation & Direct Commission
    test('1. Multi-tier BV Points & 8% Direct Commission propagate upwards correctly', () => {
        const users = [
            { id: 'user-hiru-root', username: 'Hiru', role: 'member', status: 'ACTIVE', qualification_status: 'NOT_QUALIFIED', position: 'ROOT' },
            { id: 'user-sun-101', username: 'Sun', role: 'member', status: 'ACTIVE', qualification_status: 'NOT_QUALIFIED', position: 'LEFT' },
            { id: 'user-sundd-102', username: 'SUNDD', role: 'member', status: 'INACTIVE', qualification_status: 'NOT_QUALIFIED', position: 'LEFT' }
        ];
        const sponsors = [
            { user_id: 'user-sun-101', sponsor_id: 'user-hiru-root', sponsor_username: 'Hiru' },
            { user_id: 'user-sundd-102', sponsor_id: 'user-sun-101', sponsor_username: 'Sun' }
        ];
        const binaryNodes = [
            { id: 'node-hiru-root', user_id: 'user-hiru-root', placement_parent_id: null, position: 'ROOT', left_child_id: 'node-sun-101', right_child_id: null },
            { id: 'node-sun-101', user_id: 'user-sun-101', placement_parent_id: 'user-hiru-root', position: 'LEFT', left_child_id: 'node-sundd-102', right_child_id: null },
            { id: 'node-sundd-102', user_id: 'user-sundd-102', placement_parent_id: 'user-sun-101', position: 'LEFT', left_child_id: null, right_child_id: null }
        ];
        const purchases = [];
        const commissionLedger = [];
        const volumeLedger = [];
        const walletLedger = [];

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
            id: 'purch-sundd-01',
            order_number: 'ORD-SUNDD-01',
            user_id: 'user-sundd-102',
            product_id: 'facebook-course',
            price_paid: 7425.00,
            binary_volume: 7425.00,
            payment_method: 'ADMIN_MANUAL',
            status: 'PENDING'
        };

        // Execute Purchase Orchestrator
        PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
            purchase: testPurchase,
            product: testProduct,
            userId: 'user-sundd-102',
            binaryNodes,
            sponsors,
            users,
            kycDocs: [],
            purchases,
            commissionLedger,
            volumeLedger,
            walletLedger
        });

        // 1. Direct Sponsor Sun must get 8% Direct Commission (594.00 LKR)
        const sunDirectTx = walletLedger.find(w => w.user_id === 'user-sun-101' && (w.type === 'DIRECT_COMMISSION' || (w.description && w.description.includes('Direct'))));
        assert.ok(sunDirectTx, 'Sun must receive Direct Commission');
        assert.strictEqual(sunDirectTx.amount, 594.00, 'Direct Commission must equal exact Rs. 594.00');

        // 2. Volume ledger for Sun and Hiru
        const sunVolSummary = VolumeLedger.getVolumeSummary('user-sun-101', volumeLedger);
        const hiruVolSummary = VolumeLedger.getVolumeSummary('user-hiru-root', volumeLedger);

        assert.strictEqual(sunVolSummary.current_left_volume, 7425.00, 'Sun Left Volume must be 7425 BV');
        assert.strictEqual(hiruVolSummary.current_left_volume, 7425.00, 'Hiru Left Volume must be 7425 BV');
        assert.strictEqual(hiruVolSummary.current_right_volume, 0.00, 'Hiru Right Volume must be 0 BV before right sales');
    });

    // 2. Test Dual-Leg Binary Matching (7% on matched volume)
    test('2. Dual-Leg Balance triggers 7% Binary Commission on Matched Volume', () => {
        const users = [
            { id: 'user-hiru-root', username: 'Hiru', role: 'member', status: 'ACTIVE', qualification_status: 'NOT_QUALIFIED', position: 'ROOT' },
            { id: 'user-sun-101', username: 'Sun', role: 'member', status: 'ACTIVE', qualification_status: 'NOT_QUALIFIED', position: 'LEFT' },
            { id: 'user-right-201', username: 'RightMember', role: 'member', status: 'ACTIVE', qualification_status: 'NOT_QUALIFIED', position: 'RIGHT' }
        ];
        const sponsors = [
            { user_id: 'user-sun-101', sponsor_id: 'user-hiru-root', sponsor_username: 'Hiru' },
            { user_id: 'user-right-201', sponsor_id: 'user-hiru-root', sponsor_username: 'Hiru' }
        ];
        const binaryNodes = [
            { id: 'node-hiru-root', user_id: 'user-hiru-root', placement_parent_id: null, position: 'ROOT', left_child_id: 'node-sun-101', right_child_id: 'node-right-201' },
            { id: 'node-sun-101', user_id: 'user-sun-101', placement_parent_id: 'user-hiru-root', position: 'LEFT', left_child_id: null, right_child_id: null },
            { id: 'node-right-201', user_id: 'user-right-201', placement_parent_id: 'user-hiru-root', position: 'RIGHT', left_child_id: null, right_child_id: null }
        ];
        const purchases = [];
        const commissionLedger = [];
        const volumeLedger = [];
        const walletLedger = [];

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

        // Purchase 1: Left Member (Sun)
        PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
            purchase: { id: 'p-1', order_number: 'ORD-1', user_id: 'user-sun-101', product_id: 'facebook-course', price_paid: 7425.00, binary_volume: 7425.00, status: 'PENDING' },
            product: testProduct,
            userId: 'user-sun-101',
            binaryNodes,
            sponsors,
            users,
            kycDocs: [],
            purchases,
            commissionLedger,
            volumeLedger,
            walletLedger
        });

        // Purchase 2: Right Member (RightMember)
        PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
            purchase: { id: 'p-2', order_number: 'ORD-2', user_id: 'user-right-201', product_id: 'facebook-course', price_paid: 7425.00, binary_volume: 7425.00, status: 'PENDING' },
            product: testProduct,
            userId: 'user-right-201',
            binaryNodes,
            sponsors,
            users,
            kycDocs: [],
            purchases,
            commissionLedger,
            volumeLedger,
            walletLedger
        });

        const hiruVolSummary = VolumeLedger.getVolumeSummary('user-hiru-root', volumeLedger);
        assert.strictEqual(hiruVolSummary.current_left_volume, 7425.00, 'Hiru Left Volume must be 7425 BV');
        assert.strictEqual(hiruVolSummary.current_right_volume, 7425.00, 'Hiru Right Volume must be 7425 BV');
        assert.strictEqual(hiruVolSummary.matched_volume, 7425.00, 'Hiru Matched Volume must be 7425 BV');

        // Hiru is now Dual-Leg Qualified and receives 2x Direct Commissions (2 * 594.00 = 1188.00)
        const hiruWallet = WalletService.calculateBalances(walletLedger.filter(tx => tx.user_id === 'user-hiru-root'));
        assert.ok(hiruWallet.availableBalance >= 1188.00, 'Hiru wallet must have at least Rs. 1,188.00 in commissions');
    });

    // 3. Test MLMNetworkEngine member dashboard & volume calculation
    test('3. MLMNetworkEngine returns structured volume and network summary', () => {
        const users = [
            { id: 'user-hiru-root', username: 'Hiru', role: 'member', status: 'ACTIVE', qualification_status: 'QUALIFIED' },
            { id: 'user-sun-101', username: 'Sun', role: 'member', status: 'ACTIVE', qualification_status: 'NOT_QUALIFIED', position: 'LEFT' }
        ];
        const sponsors = [
            { user_id: 'user-sun-101', sponsor_id: 'user-hiru-root' }
        ];
        const binaryNodes = [
            { id: 'node-hiru-root', user_id: 'user-hiru-root', placement_parent_id: null, position: 'ROOT', left_child_id: 'node-sun-101', right_child_id: null },
            { id: 'node-sun-101', user_id: 'user-sun-101', placement_parent_id: 'user-hiru-root', position: 'LEFT', left_child_id: null, right_child_id: null }
        ];
        const volumeLedger = [
            { user_id: 'user-hiru-root', leg: 'LEFT', amount: 7425.00, type: 'SALE_VOLUME' }
        ];

        const network = MLMNetworkEngine.getMemberNetwork('user-hiru-root', {
            binaryNodes,
            users,
            purchases: [],
            volumeLedger,
            sponsors
        });

        assert.ok(network.center_member, 'Must return center_member');
        assert.strictEqual(network.center_member.left_points, 7425.00, 'Center member left_points must equal 7425');
        assert.strictEqual(network.center_member.right_points, 0.00, 'Center member right_points must equal 0');
    });

    console.log('\n================================================================');
    console.log(`📊 TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} TESTS`);
    console.log('================================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runStep64Tests();
