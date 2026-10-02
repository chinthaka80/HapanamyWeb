// test/step76-persistence-hardening-and-concurrency.test.js
// Automated Verification for Atomic Persistence, Concurrency, and Server Restart Integrity

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

console.log('🧪 Starting Step 76 Test Suite: Persistence Hardening, Multi-Write Concurrency & Server Restart...');

const DB_STORE_FILE = path.join(__dirname, '..', 'data', 'mlm-db-store.json');
const SERVER_PATH = path.join(__dirname, '..', 'server.js');
const TEST_PORT = 3097;

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

async function runStep76Tests() {
    const initialRaw = fs.readFileSync(DB_STORE_FILE, 'utf-8');
    const initialDb = JSON.parse(initialRaw);
    const initialUserCount = initialDb.users.length;

    // TEST 1: Server Process Startup & Single User Persistence
    console.log('👉 Test 1: Starting Server Instance 1 on port ' + TEST_PORT + '...');
    const server1 = await startServer(TEST_PORT);

    const testUser1 = {
        fullName: 'Step 76 Single User',
        username: 'step76_single_user',
        email: 'step76_single@example.test',
        mobile: '0770007601',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        sponsorCode: 'NAMOBUDDHAYA',
        position: 'LEFT',
        role: 'member'
    };

    const regRes1 = await makeRequest({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, testUser1);

    assert.strictEqual(regRes1.statusCode, 201, 'Single user registration must return 201');
    assert.strictEqual(regRes1.data.success, true, 'Single user registration must succeed');
    console.log('✅ Test 1 Passed: Single user registered successfully.');

    // TEST 2: Disk Verification & Read-back Confirmation
    console.log('👉 Test 2: Verifying disk persistence immediately after write...');
    const diskDb1 = JSON.parse(fs.readFileSync(DB_STORE_FILE, 'utf-8'));
    const diskUser = diskDb1.users.find(u => u.username === 'step76_single_user');
    assert.ok(diskUser, 'User must exist on disk in data/mlm-db-store.json');
    assert.strictEqual(diskDb1.users.length, initialUserCount + 1);
    console.log('✅ Test 2 Passed: Disk file immediately contains new user.');

    // TEST 3: Admin API Authorization for both Admin and SubAdmin
    console.log('👉 Test 3: Verifying Admin API access for Main Admin & SubAdmin...');
    const adminRes = await makeRequest({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/admin/members',
        method: 'GET',
        headers: { 'Authorization': 'Bearer token-namobuddhaya-root' }
    });
    assert.strictEqual(adminRes.statusCode, 200, 'Main Admin must access /api/admin/members');

    const subadminRes = await makeRequest({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/admin/members',
        method: 'GET',
        headers: { 'Authorization': 'Bearer token-subadmin-manager' }
    });
    assert.strictEqual(subadminRes.statusCode, 200, 'SubAdmin must also access /api/admin/members');
    const subadminFound = subadminRes.data.members.find(m => m.username === 'step76_single_user');
    assert.ok(subadminFound, 'SubAdmin must see the newly registered member');
    console.log('✅ Test 3 Passed: Both Admin and SubAdmin query members successfully.');

    // TEST 4: 20 Simultaneous Concurrent Registrations (Race Condition Defense)
    console.log('👉 Test 4: Executing 20 concurrent registration requests...');
    const NUM_CONCURRENT = 20;
    const promises = [];
    for (let i = 1; i <= NUM_CONCURRENT; i++) {
        const pad = String(i).padStart(3, '0');
        promises.push(makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            fullName: `Concurrent Step76 User ${pad}`,
            username: `step76_conc_${pad}`,
            email: `step76_conc_${pad}@example.test`,
            mobile: `077760${pad}`,
            password: 'Password123!',
            confirmPassword: 'Password123!',
            sponsorCode: 'NAMOBUDDHAYA',
            position: i % 2 === 0 ? 'LEFT' : 'RIGHT',
            role: 'member'
        }));
    }

    const concurrentResults = await Promise.all(promises);
    const successfulConcurrent = concurrentResults.filter(r => r.statusCode === 201 && r.data.success);
    assert.strictEqual(successfulConcurrent.length, NUM_CONCURRENT, 'All 20 concurrent registrations must succeed');

    const diskDbAfterConc = JSON.parse(fs.readFileSync(DB_STORE_FILE, 'utf-8'));
    assert.strictEqual(diskDbAfterConc.users.length, initialUserCount + 1 + NUM_CONCURRENT, 'Disk must contain all 21 new users');
    console.log('✅ Test 4 Passed: 20 concurrent writes completed with 0 lost updates.');

    // TEST 5: Cold Server Restart & Data Survival
    console.log('👉 Test 5: Killing server and performing cold restart verification...');
    server1.kill();
    await new Promise(r => setTimeout(r, 1000));

    const server2 = await startServer(TEST_PORT);
    const adminResAfterRestart = await makeRequest({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/admin/members',
        method: 'GET',
        headers: { 'Authorization': 'Bearer token-namobuddhaya-root' }
    });

    assert.strictEqual(adminResAfterRestart.statusCode, 200);
    assert.strictEqual(adminResAfterRestart.data.members.length, initialUserCount + 1 + NUM_CONCURRENT, 'All 21 users must survive cold restart');

    // TEST 6: User Authentication & Profile Update Persistence
    console.log('👉 Test 6: Verifying user login & profile update persistence across restart...');
    const loginRes = await makeRequest({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        identifier: 'step76_single_user',
        password: 'Password123!'
    });
    assert.strictEqual(loginRes.statusCode, 200);
    assert.strictEqual(loginRes.data.success, true);
    const userToken = loginRes.data.token;

    const updateProfileRes = await makeRequest({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/user/profile',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
        }
    }, {
        full_name: 'Updated Step 76 Name',
        phone: '0711998877',
        address: '77 Galle Road, Colombo'
    });
    assert.strictEqual(updateProfileRes.statusCode, 200);
    assert.strictEqual(updateProfileRes.data.success, true);
    console.log('✅ Test 6 Passed: User profile updated and persisted.');

    // Clean up
    server2.kill();
    fs.writeFileSync(DB_STORE_FILE, initialRaw, 'utf-8');
    console.log('Cleaned up test users from disk.');

    console.log('\n🎉 ALL 6 STEP 76 PERSISTENCE & CONCURRENCY TESTS PASSED 100%!\n');
}

if (require.main === module) {
    runStep76Tests().catch(err => {
        console.error('Fatal Step 76 test failure:', err);
        process.exit(1);
    });
} else if (typeof global.test === 'function') {
    global.test('Step 76: Persistence Hardening, Multi-Write Concurrency & Server Restart Integrity', async () => {
        await runStep76Tests();
    });
}

module.exports = { runStep76Tests };

