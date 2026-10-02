// test/step77-product-catalog-manual-purchase-correction-and-reversal.test.js
// Automated Verification for Complete Product Catalog, Manual Purchase Precision, Order Reversal & Kavishka Accounts Integrity

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

console.log('🧪 Starting Step 77 Test Suite: Product Catalog, Manual Purchase Precision, Order Reversal & Kavishka Accounts Integrity...');

const DB_STORE_FILE = path.join(__dirname, '..', 'data', 'mlm-db-store.json');
const SERVER_PATH = path.join(__dirname, '..', 'server.js');
const TEST_PORT = 3098;

function makeRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = data;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {}
                resolve({ statusCode: res.statusCode, headers: res.headers, data: parsed });
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        }
        req.end();
    });
}

function startServer(port) {
    return new Promise((resolve, reject) => {
        const proc = spawn('node', [SERVER_PATH], {
            env: { ...process.env, PORT: port },
            cwd: path.join(__dirname, '..')
        });

        proc.stdout.on('data', (d) => {
            const str = d.toString();
            if (str.includes('Server running at')) {
                resolve(proc);
            }
        });

        proc.stderr.on('data', (d) => {
            console.error('Server stderr:', d.toString());
        });

        proc.on('error', reject);
        setTimeout(() => resolve(proc), 2000);
    });
}

async function runStep77Tests() {
    const initialRaw = fs.readFileSync(DB_STORE_FILE, 'utf-8');
    const initialDb = JSON.parse(initialRaw);
    let server = null;

    try {
        // TEST 1: Product Catalog Integrity Check
        console.log('👉 Test 1: Verifying all 14 official catalog products in database...');
        assert.strictEqual(initialDb.products.length, 14, 'Must have exactly 14 official products');
        const aiPrompts = initialDb.products.find(p => p.id === 'ai-prompts-ebook');
        assert.ok(aiPrompts, 'ai-prompts-ebook must exist in products');
        assert.strictEqual(aiPrompts.selling_price || aiPrompts.price, 2000, 'AI prompts ebook price must be 2000');
        assert.strictEqual(aiPrompts.binary_volume, 2000, 'AI prompts ebook BV must be 2000');
        console.log('✅ Test 1 Passed: Complete 14-product catalog verified.');

        // TEST 2: Kavishka Dineth Accounts & AI Prompts Order Verification
        console.log('👉 Test 2: Verifying kavishkadineth4418 and kavishkadineth4420 accounts...');
        const user4418 = initialDb.users.find(u => u.username === 'kavishkadineth4418');
        const user4420 = initialDb.users.find(u => u.username === 'kavishkadineth4420');
        assert.ok(user4418, 'kavishkadineth4418 must exist in database');
        assert.ok(user4420, 'kavishkadineth4420 must exist in database');

        const spon4420 = initialDb.sponsors.find(s => s.user_id === user4420.id);
        assert.strictEqual(spon4420.sponsor_id, user4418.id, 'kavishkadineth4418 must be direct sponsor of kavishkadineth4420');

        // Verify 4420 active purchase is AI Prompts (2000) and NOT Facebook (7425)
        const purch4420 = initialDb.productPurchases.filter(p => p.user_id === user4420.id);
        assert.strictEqual(purch4420.length, 1, '4420 must have exactly 1 active purchase');
        assert.strictEqual(purch4420[0].product_id, 'ai-prompts-ebook', 'Purchased product must be ai-prompts-ebook');
        assert.strictEqual(purch4420[0].price_paid, 2000, 'Price paid must be Rs. 2000.00');

        // Verify Direct commission to 4418 is 8% of 2000 = 160.00
        const dirComm = initialDb.commissionTransactions.find(c => c.user_id === user4418.id && c.source_user_id === user4420.id);
        assert.ok(dirComm, 'Direct commission transaction to 4418 must exist');
        assert.strictEqual(dirComm.amount, 160.00, 'Direct commission must be exact Rs. 160.00 (8%)');
        console.log('✅ Test 2 Passed: Kavishka accounts and corrected AI Prompts purchase verified.');

        // TEST 3: Server Instance Startup & Manual Purchase Precision
        console.log('👉 Test 3: Starting server on port ' + TEST_PORT + ' and verifying manual purchase precision...');
        server = await startServer(TEST_PORT);

        const suffix = Date.now().toString().slice(-4);
        // Register a test member to test manual activation
        const testMemberRes = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            fullName: `Step 77 Test Member ${suffix}`,
            username: `step77_test_mem_${suffix}`,
            email: `step77_test_${suffix}@example.test`,
            mobile: `077000${suffix}`,
            password: 'Password123!',
            confirmPassword: 'Password123!',
            sponsorCode: 'NAMOBUDDHAYA',
            position: 'LEFT',
            role: 'member'
        });
        assert.strictEqual(testMemberRes.statusCode, 201);
        const newMemberId = testMemberRes.data.user.id;

        // Execute Manual Purchase for 1000+ AI Prompts Master Library (2000)
        const manualBuyRes = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/admin/members/manual-purchase',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token-namobuddhaya-root'
            }
        }, {
            member_id: newMemberId,
            product_id: 'ai-prompts-ebook',
            payment_method: 'ADMIN_MANUAL',
            notes: 'Step 77 test AI prompts purchase'
        });

        assert.strictEqual(manualBuyRes.statusCode, 200);
        assert.strictEqual(manualBuyRes.data.success, true);
        const purchObj = manualBuyRes.data.purchase || manualBuyRes.data.order;
        assert.ok(purchObj, 'Purchase object must be returned');
        assert.strictEqual(purchObj.product_id, 'ai-prompts-ebook');
        assert.strictEqual(purchObj.price_paid, 2000.00);
        assert.strictEqual(manualBuyRes.data.direct_commission.amount, 160.00);
        assert.strictEqual(manualBuyRes.data.binary_volume.volume, 2000.00);
        const createdOrderId = purchObj.id;
        console.log('✅ Test 3 Passed: Manual activation of AI Prompts correctly calculated 2000 BV and Rs. 160 direct comm.');

        // TEST 4: Invalid Product ID Defense
        console.log('👉 Test 4: Verifying invalid product ID returns 400 Bad Request instead of defaulting to Facebook...');
        const invalidProdRes = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/admin/members/manual-purchase',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token-namobuddhaya-root'
            }
        }, {
            member_id: newMemberId,
            product_id: 'non-existent-product-xyz',
            payment_method: 'ADMIN_MANUAL'
        });
        assert.strictEqual(invalidProdRes.statusCode, 400, 'Invalid product must return 400');
        assert.ok(invalidProdRes.data.error.includes('not found in product catalog'));
        console.log('✅ Test 4 Passed: Invalid product request properly rejected.');

        // TEST 5: Order Deletion & Commission / Volume Reversal
        console.log('👉 Test 5: Testing Admin Order Deletion & Reversal API...');
        const deleteOrderRes = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: `/api/admin/orders/${createdOrderId}/delete`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token-namobuddhaya-root'
            },
            body: JSON.stringify({ reason: 'Admin test reversal' })
        });
        assert.strictEqual(deleteOrderRes.statusCode, 200);
        assert.strictEqual(deleteOrderRes.data.success, true);

        // Verify order was removed from database and buyer reverted
        const diskDbAfterDelete = JSON.parse(fs.readFileSync(DB_STORE_FILE, 'utf-8'));
        const deletedOrderInDb = diskDbAfterDelete.productPurchases.find(p => p.id === createdOrderId);
        assert.strictEqual(deletedOrderInDb, undefined, 'Deleted order must not exist in productPurchases');

        const testBuyerInDb = diskDbAfterDelete.users.find(u => u.id === newMemberId);
        assert.strictEqual(testBuyerInDb.status, 'INACTIVE', 'Buyer with 0 remaining active purchases must be reverted to INACTIVE');
        console.log('✅ Test 5 Passed: Order successfully deleted and state safely reverted.');

    } finally {
        if (server) {
            server.kill();
        }
        // Always restore pristine state with kavishka accounts intact
        fs.writeFileSync(DB_STORE_FILE, initialRaw, 'utf-8');
    }

    console.log('\n🎉 ALL 5 STEP 77 TESTS PASSED 100%!\n');
}

if (require.main === module) {
    runStep77Tests().catch(err => {
        console.error('Fatal Step 77 test failure:', err);
        process.exit(1);
    });
} else if (typeof global.test === 'function') {
    global.test('Step 77: Product Catalog, Manual Purchase Precision, Order Reversal & Kavishka Accounts Integrity', async () => {
        await runStep77Tests();
    });
}

module.exports = { runStep77Tests };
