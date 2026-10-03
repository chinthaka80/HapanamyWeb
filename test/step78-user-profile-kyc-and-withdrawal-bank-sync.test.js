// test/step78-user-profile-kyc-and-withdrawal-bank-sync.test.js
// Step 78: User Profile, KYC Activation, and Withdrawal Bank Sync Test Suite

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

console.log('🧪 Starting Step 78 Test Suite: User Profile, KYC Activation, and Withdrawal Bank Sync...');

const TEST_PORT = 3099;
const SERVER_PATH = path.join(__dirname, '..', 'server.js');
const DB_STORE_FILE = path.join(__dirname, '..', 'data', 'mlm-db-store.json');

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
            // Ignore benign stderr logs during test teardown
        });

        proc.on('error', reject);
        setTimeout(() => resolve(proc), 2000);
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runStep78Tests() {
    let server = null;
    let initialRaw = null;

    try {
        if (fs.existsSync(DB_STORE_FILE)) {
            initialRaw = fs.readFileSync(DB_STORE_FILE, 'utf-8');
        }

        console.log(`👉 Step 78.1: Starting Server Instance on port ${TEST_PORT}...`);
        server = await startServer(TEST_PORT);

        const token = 'token-member-hapana01';

        // 1. Test GET /api/auth/me for standard member
        console.log('👉 Step 78.2: Testing GET /api/auth/me with all 14 profile & bank fields...');
        const meRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/auth/me',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        assert.strictEqual(meRes.statusCode, 200, 'GET /api/auth/me should return 200');
        const user = meRes.data.user;
        assert.ok(user.hasOwnProperty('full_name'), 'User must have full_name');
        assert.ok(user.hasOwnProperty('username'), 'User must have username');
        assert.ok(user.hasOwnProperty('email'), 'User must have email');
        assert.ok(user.hasOwnProperty('phone'), 'User must have phone');
        assert.ok(user.hasOwnProperty('whatsapp'), 'User must have whatsapp');
        assert.ok(user.hasOwnProperty('address'), 'User must have address');
        assert.ok(user.hasOwnProperty('nearest_city'), 'User must have nearest_city');
        assert.ok(user.hasOwnProperty('nic'), 'User must have nic');
        assert.ok(user.hasOwnProperty('gender'), 'User must have gender');
        assert.ok(user.hasOwnProperty('dob'), 'User must have dob');
        assert.ok(user.hasOwnProperty('bank_name'), 'User must have bank_name');
        assert.ok(user.hasOwnProperty('bank_account_number'), 'User must have bank_account_number');
        assert.ok(user.hasOwnProperty('bank_branch'), 'User must have bank_branch');
        assert.ok(user.hasOwnProperty('bank_account_name'), 'User must have bank_account_name');
        assert.ok(user.hasOwnProperty('kyc_status'), 'User must have kyc_status');
        console.log('✅ Test 1 Passed: GET /api/auth/me returned all 14 profile & bank fields.');

        // 2. Test POST /api/user/profile to update complete personal and bank details
        console.log('👉 Step 78.3: Testing POST /api/user/profile to update and persist profile details...');
        const updatePayload = {
            full_name: 'Kavishka Dineth Silva',
            email: 'kavishka.silva@example.com',
            phone: '0771234567',
            whatsapp: '0771234567',
            nic: '199812345678',
            gender: 'MALE',
            dob: '1998-05-14',
            address: 'No. 120, Highlevel Road, Maharagama',
            nearest_city: 'Maharagama',
            bank_name: 'Commercial Bank of Ceylon',
            bank_branch: 'Maharagama Branch',
            bank_account_number: '8010998877',
            bank_account_name: 'Kavishka Dineth Silva',
            activate_kyc: true
        };

        const updateRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/user/profile',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }, updatePayload);

        assert.strictEqual(updateRes.statusCode, 200, 'POST /api/user/profile should return 200');
        assert.strictEqual(updateRes.data.success, true, 'Update should succeed');
        assert.strictEqual(updateRes.data.user.full_name, 'Kavishka Dineth Silva', 'Full name should update');
        assert.strictEqual(updateRes.data.user.bank_name, 'Commercial Bank of Ceylon', 'Bank name should update');
        assert.strictEqual(updateRes.data.user.bank_account_number, '8010998877', 'Account number should update');
        assert.strictEqual(updateRes.data.user.bank_branch, 'Maharagama Branch', 'Branch should update');
        assert.strictEqual(updateRes.data.user.nic, '199812345678', 'NIC should update');
        assert.strictEqual(updateRes.data.user.kyc_status, 'PENDING', 'KYC status should be PENDING on activation');
        console.log('✅ Test 2 Passed: POST /api/user/profile successfully updated profile & bank details.');

        // 3. Test GET /api/member/dashboard reflects the updated profile & bank account
        console.log('👉 Step 78.4: Testing GET /api/member/dashboard reflects updated profile & bank details...');
        const dashRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/member/dashboard?user_id=user-hapana-01',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        assert.strictEqual(dashRes.statusCode, 200, 'Dashboard should return 200');
        assert.strictEqual(dashRes.data.profile.full_name, 'Kavishka Dineth Silva', 'Dashboard profile full_name should match');
        assert.strictEqual(dashRes.data.profile.bank_name, 'Commercial Bank of Ceylon', 'Dashboard bank_name should match');
        assert.strictEqual(dashRes.data.profile.bank_account_number, '8010998877', 'Dashboard bank_account_number should match');
        assert.strictEqual(dashRes.data.profile.bank_branch, 'Maharagama Branch', 'Dashboard bank_branch should match');
        assert.strictEqual(dashRes.data.profile.nic, '199812345678', 'Dashboard NIC should match');
        console.log('✅ Test 3 Passed: Member dashboard payload includes updated profile & bank details.');

        // 4. Test Disk Persistence across server restart
        console.log('👉 Step 78.5: Testing server cold restart persistence for profile & bank changes...');
        if (server) {
            server.kill();
            await delay(1000);
        }

        server = await startServer(TEST_PORT);
        await delay(500);

        const restartMeRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/auth/me',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        assert.strictEqual(restartMeRes.statusCode, 200, 'GET /api/auth/me after restart should return 200');
        assert.strictEqual(restartMeRes.data.user.full_name, 'Kavishka Dineth Silva', 'Full name should persist across restart');
        assert.strictEqual(restartMeRes.data.user.bank_account_number, '8010998877', 'Bank account number should persist across restart');
        assert.strictEqual(restartMeRes.data.user.bank_name, 'Commercial Bank of Ceylon', 'Bank name should persist across restart');
        assert.strictEqual(restartMeRes.data.user.nic, '199812345678', 'NIC should persist across restart');
        console.log('✅ Test 4 Passed: Profile and bank details survived cold server restart.');

        // 5. Verify Frontend UI Markup in dashboard.html and my-account.html
        console.log('👉 Step 78.6: Verifying frontend HTML markup for Profile, Bank Details, and Withdrawal auto-fill...');
        const dashHtml = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
        const accHtml = fs.readFileSync(path.join(__dirname, '..', 'my-account.html'), 'utf8');

        assert.ok(dashHtml.includes('settingsEditFullName'), 'dashboard.html must have settingsEditFullName');
        assert.ok(dashHtml.includes('settingsEditBankName'), 'dashboard.html must have settingsEditBankName');
        assert.ok(dashHtml.includes('settingsEditBankBranch'), 'dashboard.html must have settingsEditBankBranch');
        assert.ok(dashHtml.includes('settingsEditBankAcc'), 'dashboard.html must have settingsEditBankAcc');
        assert.ok(dashHtml.includes('settingsEditBankHolder'), 'dashboard.html must have settingsEditBankHolder');
        assert.ok(dashHtml.includes('settingsEditNic'), 'dashboard.html must have settingsEditNic');
        assert.ok(dashHtml.includes('settingsEditWhatsapp'), 'dashboard.html must have settingsEditWhatsapp');
        assert.ok(dashHtml.includes('settingsEditGender'), 'dashboard.html must have settingsEditGender');
        assert.ok(dashHtml.includes('settingsEditDob'), 'dashboard.html must have settingsEditDob');
        assert.ok(dashHtml.includes('settingsEditCity'), 'dashboard.html must have settingsEditCity');
        assert.ok(dashHtml.includes('withdrawBankDetailsCard'), 'dashboard.html must have withdrawBankDetailsCard');
        assert.ok(dashHtml.includes('populateProfileSettingsUI'), 'dashboard.html must define populateProfileSettingsUI');
        assert.ok(dashHtml.includes('updateWithdrawModalBankInfo'), 'dashboard.html must define updateWithdrawModalBankInfo');

        assert.ok(accHtml.includes('setUserBankName'), 'my-account.html must have setUserBankName');
        assert.ok(accHtml.includes('setUserBankBranch'), 'my-account.html must have setUserBankBranch');
        assert.ok(accHtml.includes('setUserBankAcc'), 'my-account.html must have setUserBankAcc');
        assert.ok(accHtml.includes('setUserBankHolder'), 'my-account.html must have setUserBankHolder');
        assert.ok(accHtml.includes('setUserNic'), 'my-account.html must have setUserNic');
        assert.ok(accHtml.includes('setUserWhatsapp'), 'my-account.html must have setUserWhatsapp');
        assert.ok(accHtml.includes('setUserGender'), 'my-account.html must have setUserGender');
        assert.ok(accHtml.includes('setUserDob'), 'my-account.html must have setUserDob');
        assert.ok(accHtml.includes('payoutBankDetails'), 'my-account.html must have payoutBankDetails');
        console.log('✅ Test 5 Passed: All UI markup and sync functions verified across dashboard.html and my-account.html.');

        console.log('\n🎉 ALL 5 STEP 78 USER PROFILE & WITHDRAWAL BANK SYNC TESTS PASSED 100%!\n');

    } finally {
        if (server) {
            try { server.kill(); } catch (e) {}
        }
        if (initialRaw && fs.existsSync(DB_STORE_FILE)) {
            fs.writeFileSync(DB_STORE_FILE, initialRaw, 'utf-8');
        }
    }
}

if (require.main === module) {
    runStep78Tests().catch(err => {
        console.error('Fatal Step 78 test failure:', err);
        process.exit(1);
    });
} else if (typeof global.test === 'function') {
    global.test('Step 78: User Profile, KYC Activation, and Withdrawal Bank Sync', async () => {
        await runStep78Tests();
    });
}

module.exports = { runStep78Tests };
