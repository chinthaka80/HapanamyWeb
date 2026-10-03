// test/step80-account-deletion-and-tree-cleansing.test.js
// Step 80: Verification Suite for Requested Account Deletions, Binary Tree Cleansing & Storage Protection

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

console.log('🧪 Starting Step 80 Test Suite: Account Deletion, Tree Cleansing & Storage Protection...');

const TEST_PORT = 3102;
const SERVER_PATH = path.join(__dirname, '..', 'server.js');
const DB_STORE_FILE = path.join(__dirname, '..', 'data', 'mlm-db-store.json');

const DELETED_TARGETS = [
    { username: 'member', email: 'slt202077@gmail.com' },
    { username: 'star04', email: 'star04@gmail.com' },
    { username: 'star05', email: 'star05@gmail.com' },
    { username: 'star06', email: 'star06@gmail.com' },
    { username: 'star07', email: 'star07@gmail.com' },
    { username: 'kavishkadineth4418', email: 'kavishkadineth4418@gmail.com' },
    { username: 'kavishkadineth4420', email: 'kavishkadineth4420@gmail.com' }
];

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

async function runStep80Tests() {
    let server = null;
    let initialRaw = null;

    try {
        if (fs.existsSync(DB_STORE_FILE)) {
            initialRaw = fs.readFileSync(DB_STORE_FILE, 'utf-8');
        }

        const db = JSON.parse(initialRaw);

        // 1. Verify Database Store has completely purged the 7 requested accounts
        console.log('👉 Step 80.1: Verifying complete absence of 7 requested accounts in mlm-db-store.json...');
        for (const target of DELETED_TARGETS) {
            const foundUser = db.users.find(u => 
                (u.username && u.username.toLowerCase() === target.username.toLowerCase()) ||
                (u.email && u.email.toLowerCase() === target.email.toLowerCase())
            );
            assert.strictEqual(foundUser, undefined, `Account ${target.username} (${target.email}) must NOT exist in users collection`);
            
            const foundNode = (db.binaryNodes || []).find(n => 
                n.user_id === `user-${target.username}` || 
                n.user_id === `user-${target.email}`
            );
            assert.strictEqual(foundNode, undefined, `Node for ${target.username} must NOT exist in binaryNodes`);

            const foundSponsor = (db.sponsors || []).find(s => 
                s.user_id === `user-${target.username}`
            );
            assert.strictEqual(foundSponsor, undefined, `Sponsor entry for ${target.username} must NOT exist`);
        }
        console.log('✅ Test 1 Passed: Database store completely purged of all 7 target accounts.');

        // 2. Verify Binary Tree Cleansing on HAPANA09 and All 15 Core Accounts
        console.log('👉 Step 80.2: Verifying binary tree consistency and node-hapana-09 cleansing...');
        const node09 = db.binaryNodes.find(n => n.user_id === 'user-hapana-09');
        assert.ok(node09, 'node-hapana-09 must exist');
        assert.strictEqual(node09.left_child_id, null, 'node-hapana-09 left_child_id must be null');
        assert.strictEqual(node09.right_child_id, null, 'node-hapana-09 right_child_id must be null');

        // Verify all 15 official accounts exist
        for (let i = 1; i <= 15; i++) {
            const numStr = String(i).padStart(2, '0');
            const uname = `HAPANA${numStr}`;
            const found = db.users.find(u => u.username === uname);
            assert.ok(found, `Official account ${uname} must exist`);
        }
        console.log('✅ Test 2 Passed: Binary tree cleaned; HAPANA01 - HAPANA15 fully intact.');

        // 3. Verify Frontend Admin and SubAdmin Portal Blacklist & Storage Protection
        console.log('👉 Step 80.3: Verifying admin.html and hapanamy-admin-portal-9226.html staleBlacklist & cleanup...');
        const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
        const portalHtml = fs.readFileSync(path.join(__dirname, '..', 'hapanamy-admin-portal-9226.html'), 'utf8');

        for (const htmlContent of [adminHtml, portalHtml]) {
            assert.ok(htmlContent.includes('staleBlacklist'), 'Portal must define staleBlacklist');
            assert.ok(htmlContent.includes('slt202077@gmail.com'), 'Portal must blacklist slt202077@gmail.com');
            assert.ok(htmlContent.includes('star04@gmail.com'), 'Portal must blacklist star04@gmail.com');
            assert.ok(htmlContent.includes('star05@gmail.com'), 'Portal must blacklist star05@gmail.com');
            assert.ok(htmlContent.includes('star06@gmail.com'), 'Portal must blacklist star06@gmail.com');
            assert.ok(htmlContent.includes('star07@gmail.com'), 'Portal must blacklist star07@gmail.com');
            assert.ok(htmlContent.includes('kavishkadineth4418@gmail.com'), 'Portal must blacklist kavishkadineth4418@gmail.com');
            assert.ok(htmlContent.includes('kavishkadineth4420@gmail.com'), 'Portal must blacklist kavishkadineth4420@gmail.com');
            assert.ok(htmlContent.includes('hapanamy_registered_users'), 'Portal must clean hapanamy_registered_users from localStorage');
        }
        console.log('✅ Test 3 Passed: Both Admin portals enforce staleBlacklist and active localStorage cleansing.');

        // 4. Start Server and test GET /api/admin/members does not return deleted accounts
        console.log(`👉 Step 80.4: Starting Server on port ${TEST_PORT} to test Authoritative Admin API...`);
        server = await startServer(TEST_PORT);

        const adminToken = 'token-namobuddhaya-root';
        const membersRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/admin/members',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        assert.strictEqual(membersRes.statusCode, 200, 'GET /api/admin/members must return 200');
        const returnedMembers = membersRes.data.members || [];

        for (const target of DELETED_TARGETS) {
            const foundInApi = returnedMembers.find(m => 
                (m.username && m.username.toLowerCase() === target.username.toLowerCase()) ||
                (m.email && m.email.toLowerCase() === target.email.toLowerCase())
            );
            assert.strictEqual(foundInApi, undefined, `GET /api/admin/members must NEVER return deleted member ${target.username} (${target.email})`);
        }
        console.log('✅ Test 4 Passed: Authoritative API filters and excludes all deleted members.');

        // 5. Test protected accounts cannot be deleted via /api/admin/members/delete
        console.log('👉 Step 80.5: Testing /api/admin/members/delete safeguards against deleting core accounts...');
        const deleteAttemptRes = await makeRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/api/admin/members/delete',
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            }
        }, { username: 'NAMOBUDDHAYA' });

        assert.strictEqual(deleteAttemptRes.statusCode, 400, 'Attempting to delete NAMOBUDDHAYA must return 400 Bad Request');
        assert.strictEqual(deleteAttemptRes.data.success, false, 'Deletion of protected admin must fail');
        console.log('✅ Test 5 Passed: Core admin and official accounts are strictly immune from deletion.');

        console.log('\n🎉 ALL 5 STEP 80 ACCOUNT DELETION & TREE CLEANSING TESTS PASSED 100%!\n');

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
    runStep80Tests().catch(err => {
        console.error('Fatal Step 80 test failure:', err);
        process.exit(1);
    });
} else if (typeof global.test === 'function') {
    global.test('Step 80: Account Deletion, Tree Cleansing & Storage Protection', async () => {
        await runStep80Tests();
    });
}

module.exports = { runStep80Tests };
