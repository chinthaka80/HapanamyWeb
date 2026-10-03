// test/step81-live-registration-referral-link-and-leg-placement.test.js
// Step 81: Automated Verification for Live Referral Link Parsing, Direct Leg Placement, Spillover & Full Genealogy Persistence

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

console.log('🧪 Starting Step 81 Test Suite: Referral Link Leg Placement, Spillover & Genealogy Persistence...');

const TEST_PORT = 3103;
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

        proc.stderr.on('data', () => {});

        proc.on('error', reject);
        setTimeout(() => resolve(proc), 2000);
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runStep81Tests() {
    let server = null;
    let initialRaw = null;

    try {
        if (fs.existsSync(DB_STORE_FILE)) {
            initialRaw = fs.readFileSync(DB_STORE_FILE, 'utf-8');
        }

        // 1. Verify Frontend Register Form Markup & Script
        console.log('👉 Step 81.1: Verifying register.html referral link parsing and leg selector markup...');
        const regHtml = fs.readFileSync(path.join(__dirname, '..', 'register.html'), 'utf8');
        assert.ok(regHtml.includes('sponsorCodeInput'), 'register.html must contain sponsorCodeInput field');
        assert.ok(regHtml.includes('legBtnLeft'), 'register.html must contain legBtnLeft button');
        assert.ok(regHtml.includes('legBtnRight'), 'register.html must contain legBtnRight button');
        assert.ok(regHtml.includes('parseReferralParams'), 'register.html must implement parseReferralParams()');
        assert.ok(regHtml.includes('sponsorBadge'), 'register.html must contain sponsorBadge');
        console.log('✅ Test 1 Passed: register.html UI markup & referral parsing verified.');

        // Start server
        console.log(`👉 Step 81.2: Starting Server Instance on port ${TEST_PORT}...`);
        server = await startServer(TEST_PORT);

        // 2. Test Direct Registration with Referral Link ?ref=HAPANA09&position=left
        console.log('👉 Step 81.3: Testing live registration under HAPANA09 on LEFT leg (direct link)...');
        const user1Payload = {
            fullName: 'Kasun Bandara Left',
            username: 'kasun_left_09',
            email: 'kasun_left_09@example.test',
            mobile: '0771112233',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            sponsorCode: 'https://hapanamy.lk/register?ref=HAPANA09&position=left',
            position: 'LEFT',
            role: 'member'
        };

        const reg1Res = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, user1Payload);

        assert.strictEqual(reg1Res.statusCode, 201, 'User 1 registration should return 201');
        assert.strictEqual(reg1Res.data.success, true, 'User 1 registration must succeed');
        const user1 = reg1Res.data.user;
        assert.strictEqual(user1.sponsor_username, 'HAPANA09', 'User 1 sponsor_username must be HAPANA09');
        assert.strictEqual(user1.sponsor_id, 'user-hapana-09', 'User 1 sponsor_id must be user-hapana-09');
        assert.strictEqual(reg1Res.data.placement.placement_parent_id, 'user-hapana-09', 'User 1 placement parent must be user-hapana-09');
        assert.strictEqual(reg1Res.data.placement.position, 'LEFT', 'User 1 position must be LEFT');
        console.log('✅ Test 2 Passed: User 1 correctly placed on direct LEFT under HAPANA09.');

        // 3. Test Direct Registration with Referral Link ?ref=HAPANA09&position=right
        console.log('👉 Step 81.4: Testing live registration under HAPANA09 on RIGHT leg (direct link)...');
        const user2Payload = {
            fullName: 'Nimal Silva Right',
            username: 'nimal_right_09',
            email: 'nimal_right_09@example.test',
            mobile: '0771112244',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            sponsorCode: 'HAPANA09',
            position: 'RIGHT',
            role: 'member'
        };

        const reg2Res = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, user2Payload);

        assert.strictEqual(reg2Res.statusCode, 201, 'User 2 registration should return 201');
        assert.strictEqual(reg2Res.data.success, true, 'User 2 registration must succeed');
        const user2 = reg2Res.data.user;
        assert.strictEqual(user2.sponsor_username, 'HAPANA09', 'User 2 sponsor_username must be HAPANA09');
        assert.strictEqual(user2.sponsor_id, 'user-hapana-09', 'User 2 sponsor_id must be user-hapana-09');
        assert.strictEqual(reg2Res.data.placement.placement_parent_id, 'user-hapana-09', 'User 2 placement parent must be user-hapana-09');
        assert.strictEqual(reg2Res.data.placement.position, 'RIGHT', 'User 2 position must be RIGHT');
        console.log('✅ Test 3 Passed: User 2 correctly placed on direct RIGHT under HAPANA09.');

        // 4. Test Spillover on LEFT Leg: Third Registration with ref=HAPANA09 & position=left
        console.log('👉 Step 81.5: Testing binary leg spillover under HAPANA09 on LEFT leg...');
        const user3Payload = {
            fullName: 'Sunil Perera Spillover Left',
            username: 'sunil_spill_left_09',
            email: 'sunil_spill_left_09@example.test',
            mobile: '0771112255',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            sponsorCode: '@HAPANA09',
            position: 'LEFT',
            role: 'member'
        };

        const reg3Res = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, user3Payload);

        assert.strictEqual(reg3Res.statusCode, 201, 'User 3 registration should return 201');
        assert.strictEqual(reg3Res.data.success, true, 'User 3 registration must succeed');
        const user3 = reg3Res.data.user;
        assert.strictEqual(user3.sponsor_username, 'HAPANA09', 'User 3 sponsor must remain direct sponsor HAPANA09');
        assert.strictEqual(user3.sponsor_id, 'user-hapana-09', 'User 3 sponsor_id must be user-hapana-09');
        // Placement parent must be User 1 because User 1 occupied HAPANA09's direct left slot!
        assert.strictEqual(reg3Res.data.placement.placement_parent_id, user1.id, 'User 3 must spillover under User 1');
        assert.strictEqual(reg3Res.data.placement.position, 'LEFT', 'User 3 position under User 1 must be LEFT');
        console.log('✅ Test 4 Passed: Binary spillover correctly attached User 3 under User 1 on LEFT leg.');

        // 5. Test Admin Members API & Cold Server Restart Persistence
        console.log('👉 Step 81.6: Testing Admin Members API and Cold Server Restart Persistence...');
        const adminToken = 'token-namobuddhaya-root';
        const membersRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/admin/members',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        assert.strictEqual(membersRes.statusCode, 200);
        const members = membersRes.data.members;
        const m1 = members.find(m => m.username === 'kasun_left_09');
        const m2 = members.find(m => m.username === 'nimal_right_09');
        const m3 = members.find(m => m.username === 'sunil_spill_left_09');

        assert.ok(m1 && m2 && m3, 'All 3 registered members must appear in Admin Members API');
        assert.strictEqual(m1.sponsor.username, 'HAPANA09');
        assert.strictEqual(m2.sponsor.username, 'HAPANA09');
        assert.strictEqual(m3.sponsor.username, 'HAPANA09');

        // Cold server restart
        server.kill();
        await delay(1000);
        server = await startServer(TEST_PORT);
        await delay(500);

        const restartMembersRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/admin/members',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert.strictEqual(restartMembersRes.statusCode, 200);
        const restartM1 = restartMembersRes.data.members.find(m => m.username === 'kasun_left_09');
        const restartM3 = restartMembersRes.data.members.find(m => m.username === 'sunil_spill_left_09');
        assert.ok(restartM1 && restartM3, 'Registered members must survive cold server restart');
        assert.strictEqual(restartM1.binary_node.placement_parent_id, 'user-hapana-09');
        assert.strictEqual(restartM3.binary_node.placement_parent_id, restartM1.id);
        console.log('✅ Test 5 Passed: Full genealogy and placement tree survived cold server restart.');

        console.log('\n🎉 ALL 5 STEP 81 LIVE REFERRAL & PLACEMENT INTEGRITY TESTS PASSED 100%!\n');

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
    runStep81Tests().catch(err => {
        console.error('Fatal Step 81 test failure:', err);
        process.exit(1);
    });
} else if (typeof global.test === 'function') {
    global.test('Step 81: Live Referral Link Leg Placement, Spillover & Genealogy Persistence', async () => {
        await runStep81Tests();
    });
}

module.exports = { runStep81Tests };
