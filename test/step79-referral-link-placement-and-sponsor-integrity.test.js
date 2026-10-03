// test/step79-referral-link-placement-and-sponsor-integrity.test.js
// Step 79: Automated Verification for Referral Link Parsing, Sponsor Resolution, Leg Placement & Kavishka Placement Correction

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

console.log('🧪 Starting Step 79 Test Suite: Referral Link Sponsor Resolution, Leg Placement & Kavishka Integrity...');

const TEST_PORT = 3100;
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

        proc.stderr.on('data', (d) => {});

        proc.on('error', reject);
        setTimeout(() => resolve(proc), 2000);
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runStep79Tests() {
    let server = null;
    let initialRaw = null;

    try {
        if (fs.existsSync(DB_STORE_FILE)) {
            initialRaw = fs.readFileSync(DB_STORE_FILE, 'utf-8');
        }

        console.log(`👉 Step 79.1: Verifying Kavishka 4418 sponsor and placement under HAPANA09 in database store...`);
        const dbData = JSON.parse(initialRaw);
        const k4418 = dbData.users.find(u => u.username === 'kavishkadineth4418');
        assert.ok(k4418, 'kavishkadineth4418 must exist in users');
        assert.strictEqual(k4418.sponsor_id, 'user-hapana-09', 'kavishkadineth4418 sponsor_id must be user-hapana-09');
        assert.strictEqual(k4418.sponsor, 'HAPANA09', 'kavishkadineth4418 sponsor must be HAPANA09');

        const spon4418 = dbData.sponsors.find(s => s.user_id === 'user-kavishkadineth4418');
        assert.ok(spon4418, 'spon-4418 must exist in sponsors');
        assert.strictEqual(spon4418.sponsor_id, 'user-hapana-09', 'spon-4418 sponsor_id must be user-hapana-09');

        const node4418 = dbData.binaryNodes.find(n => n.user_id === 'user-kavishkadineth4418');
        assert.ok(node4418, 'node-4418 must exist in binaryNodes');
        assert.strictEqual(node4418.placement_parent_id, 'user-hapana-09', 'node-4418 placement_parent_id must be user-hapana-09');
        assert.strictEqual(node4418.position, 'LEFT', 'node-4418 position must be LEFT');

        const nodeHapana09 = dbData.binaryNodes.find(n => n.user_id === 'user-hapana-09');
        assert.ok(nodeHapana09, 'node-hapana-09 must exist');
        assert.strictEqual(nodeHapana09.left_child_id, 'user-kavishkadineth4418', 'node-hapana-09 left_child_id must be user-kavishkadineth4418');

        const nodeHapana08 = dbData.binaryNodes.find(n => n.user_id === 'user-hapana-08');
        assert.ok(nodeHapana08, 'node-hapana-08 must exist');
        assert.strictEqual(nodeHapana08.left_child_id, null, 'node-hapana-08 left_child_id must be null');

        console.log('✅ Test 1 Passed: Kavishka 4418 sponsor and binary placement under HAPANA09 verified in DB store.');

        // Start server
        console.log(`👉 Step 79.2: Starting Server Instance on port ${TEST_PORT}...`);
        server = await startServer(TEST_PORT);

        // 2. Test Admin Members API reflects HAPANA09 as sponsor for kavishkadineth4418
        console.log('👉 Step 79.3: Testing GET /api/admin/members returns HAPANA09 as sponsor for kavishkadineth4418...');
        const adminToken = 'token-namobuddhaya-root';
        const membersRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/admin/members?search=kavishkadineth4418',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert.strictEqual(membersRes.statusCode, 200, 'GET /api/admin/members should return 200');
        const m4418 = membersRes.data.members.find(m => m.username === 'kavishkadineth4418');
        assert.ok(m4418, 'kavishkadineth4418 must be in admin members list');
        assert.ok(m4418.sponsor, 'Member must have sponsor object');
        assert.strictEqual(m4418.sponsor.username, 'HAPANA09', 'Sponsor username in admin API must be HAPANA09');
        assert.strictEqual(m4418.sponsor.id, 'user-hapana-09', 'Sponsor ID in admin API must be user-hapana-09');
        assert.strictEqual(m4418.binary_node.placement_parent_id, 'user-hapana-09', 'Placement parent ID must be user-hapana-09');
        assert.strictEqual(m4418.binary_node.position, 'LEFT', 'Position must be LEFT');
        console.log('✅ Test 2 Passed: Admin API returns HAPANA09 as sponsor and parent for kavishkadineth4418.');

        // 3. Test Live Registration with ref=HAPANA09 & position=right
        console.log('👉 Step 79.4: Testing live registration with ref=HAPANA09 & position=RIGHT...');
        const newMemberPayload = {
            fullName: 'Test Referral Right Member',
            username: 'test_ref_right_09',
            email: 'test_ref_right_09@example.lk',
            mobile: '0779998877',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            sponsorCode: 'HAPANA09',
            requestedPosition: 'RIGHT',
            role: 'member'
        };

        const regRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, newMemberPayload);

        assert.strictEqual(regRes.statusCode, 201, 'Registration should return 201 Created');
        assert.strictEqual(regRes.data.success, true, 'Registration must succeed');
        assert.strictEqual(regRes.data.user.sponsor_id, 'user-hapana-09', 'New registrant sponsor_id must be user-hapana-09');
        assert.strictEqual(regRes.data.user.sponsor_username, 'HAPANA09', 'New registrant sponsor_username must be HAPANA09');
        assert.strictEqual(regRes.data.placement.placement_parent_id, 'user-hapana-09', 'New registrant placementParentId must be user-hapana-09');
        assert.strictEqual(regRes.data.placement.position, 'RIGHT', 'New registrant position must be RIGHT');
        console.log('✅ Test 3 Passed: Live registration with ref=HAPANA09 was placed on RIGHT of user-hapana-09.');

        // 4. Test Case-Insensitive and Prefix Resilience (@hapana09, HAPANA09)
        console.log('👉 Step 79.5: Testing live registration with ref=@hapana09 & position=LEFT (case-insensitive & @ stripping)...');
        const newMemberPayload2 = {
            fullName: 'Test Referral Left Member',
            username: 'test_ref_left_09',
            email: 'test_ref_left_09@example.lk',
            mobile: '0779998878',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            sponsorCode: '@hapana09',
            requestedPosition: 'LEFT',
            role: 'member'
        };

        const regRes2 = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, newMemberPayload2);

        assert.strictEqual(regRes2.statusCode, 201, 'Registration with @hapana09 should return 201');
        assert.strictEqual(regRes2.data.user.sponsor_id, 'user-hapana-09', 'Sponsor must resolve to user-hapana-09');
        assert.strictEqual(regRes2.data.user.sponsor_username, 'HAPANA09', 'Sponsor username must resolve to HAPANA09');
        console.log('✅ Test 4 Passed: @hapana09 successfully resolved to user-hapana-09.');

        // 5. Test Persistence across cold server restart
        console.log('👉 Step 79.6: Testing server cold restart persistence for placement & sponsor relationships...');
        if (server) {
            server.kill();
            await delay(1000);
        }

        server = await startServer(TEST_PORT);
        await delay(500);

        const restartMembersRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/admin/members?search=kavishkadineth4418',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert.strictEqual(restartMembersRes.statusCode, 200, 'GET /api/admin/members after restart should return 200');
        const restartM4418 = restartMembersRes.data.members.find(m => m.username === 'kavishkadineth4418');
        assert.strictEqual(restartM4418.sponsor.username, 'HAPANA09', 'Sponsor must remain HAPANA09 across server restart');
        assert.strictEqual(restartM4418.binary_node.placement_parent_id, 'user-hapana-09', 'Placement parent must remain user-hapana-09 across server restart');
        console.log('✅ Test 5 Passed: Kavishka 4418 sponsor and placement survived cold server restart.');

        console.log('\n🎉 ALL 5 STEP 79 REFERRAL LINK & PLACEMENT INTEGRITY TESTS PASSED 100%!\n');

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
    runStep79Tests().catch(err => {
        console.error('Fatal Step 79 test failure:', err);
        process.exit(1);
    });
} else if (typeof global.test === 'function') {
    global.test('Step 79: Referral Link Sponsor Resolution, Leg Placement & Kavishka Integrity', async () => {
        await runStep79Tests();
    });
}

module.exports = { runStep79Tests };
