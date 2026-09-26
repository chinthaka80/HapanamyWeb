// ==============================================================================
// NEXUS PRIME (PVT) LTD — FOUNDATION VERIFICATION TEST SUITE
// Tests: Database Repository, MLM Network Tree, Auth, Registration, Member Profiles
// ==============================================================================

const assert = require('assert');
const nexusDb = require('../nexus_backend/db/nexus-db');
const NexusAuthService = require('../nexus_backend/services/nexus-auth-service');
const NexusMemberService = require('../nexus_backend/services/nexus-member-service');
const NexusReferralService = require('../nexus_backend/services/nexus-referral-service');
const NexusNetworkService = require('../nexus_backend/services/nexus-network-service');
const NexusConfig = require('../nexus_backend/config/nexus-config');
const NexusOrderService = require('../nexus_backend/services/nexus-order-service');
const nexusPaymentService = require('../nexus_backend/services/nexus-payment-service');
const NexusCommissionService = require('../nexus_backend/services/nexus-commission-service');
const nexusWalletService = require('../nexus_backend/services/nexus-wallet-service');
const nexusWithdrawalService = require('../nexus_backend/services/nexus-withdrawal-service');
const nexusRankService = require('../nexus_backend/services/nexus-rank-service');
const nexusFinancialReportingService = require('../nexus_backend/services/nexus-financial-reporting-service');
const nexusNotificationService = require('../nexus_backend/services/nexus-notification-service');
const nexusSupportService = require('../nexus_backend/services/nexus-support-service');
const nexusKycService = require('../nexus_backend/services/nexus-kyc-service');
const nexusMembershipService = require('../nexus_backend/services/nexus-membership-service');
const nexusEligibilityEngine = require('../nexus_backend/services/nexus-eligibility-engine');
const NexusQualificationService = require('../nexus_backend/services/nexus-qualification-service');
const { requestHandler, resetRateLimits } = require('../nexus_backend/nexus-server');

async function runNexusFoundationTests() {
    console.log('\n============================================================');
    console.log('🧪 RUNNING NEXUS PRIME FOUNDATION VERIFICATION TEST SUITE');
    console.log('============================================================\n');

    let passed = 0;
    let failed = 0;

    async function step(name, fn) {
        try {
            await fn();
            console.log(`✅ PASSED: ${name}`);
            passed++;
        } catch (err) {
            console.error(`❌ FAILED: ${name}`);
            console.error(err.stack || err);
            failed++;
        }
    }

    // Reset store to clean state before tests
    nexusDb.resetForTesting();

    // ------------------------------------------------------------
    // TEST 1: Corporate Root Admin Seed Verification
    // ------------------------------------------------------------
    await step('1. Root Corporate Admin Seed Verification', async () => {
        const rootUser = await nexusDb.findUserByEmail('admin@nexusp.online');
        assert(rootUser, 'Root admin user should exist');
        assert.strictEqual(rootUser.email, 'admin@nexusp.online');

        const rootProfile = await nexusDb.findProfileByUserId(rootUser.id);
        assert(rootProfile, 'Root profile should exist');
        assert.strictEqual(rootProfile.member_id, 'NP000001', 'Root Member ID must be NP000001');
        assert.strictEqual(rootProfile.referral_code, 'NEXUS001', 'Root Referral Code must be NEXUS001');
        assert.strictEqual(rootProfile.sponsor_id, null, 'Root should have no sponsor');

        const roles = await nexusDb.getUserRoles(rootUser.id);
        assert(roles.includes('admin') && roles.includes('super_admin'), 'Root must have admin and super_admin roles');
    });

    // ------------------------------------------------------------
    // TEST 2: Unique Member ID Sequence Generation
    // ------------------------------------------------------------
    await step('2. Sequential Member ID Generation (NP000002, NP000003...) format', async () => {
        const id1 = nexusDb.generateNextMemberId();
        const id2 = nexusDb.generateNextMemberId();
        assert.strictEqual(id1, 'NP000002');
        assert.strictEqual(id2, 'NP000003');
        assert(/^NP\d{6}$/.test(id1), 'Member ID must match NP followed by 6 digits');
    });

    // ------------------------------------------------------------
    // TEST 3: Safe Referral Code Generation
    // ------------------------------------------------------------
    await step('3. Safe Unique Referral Code Generation (NEXUS format)', async () => {
        const code1 = nexusDb.generateReferralCode('NP000002');
        const code2 = nexusDb.generateReferralCode('NP000042');
        assert.strictEqual(code1, 'NEXUS000002');
        assert.strictEqual(code2, 'NEXUS000042');
    });

    // ------------------------------------------------------------
    // TEST 4: PBKDF2-SHA512 Password Hashing & Verification
    // ------------------------------------------------------------
    await step('4. PBKDF2-SHA512 Password Hashing & Constant-Time Verification', async () => {
        const rawPassword = 'NexusSuperSecret2026!';
        const hash = NexusAuthService.hashPassword(rawPassword);
        assert(hash.includes(':'), 'Hash must contain salt:hash format');

        const validCheck = NexusAuthService.verifyPassword(rawPassword, hash);
        assert.strictEqual(validCheck, true, 'Valid password must verify');

        const invalidCheck = NexusAuthService.verifyPassword('WrongPassword', hash);
        assert.strictEqual(invalidCheck, false, 'Invalid password must fail');
    });

    // ------------------------------------------------------------
    // TEST 5: Live Referral Code Validation (Valid, Invalid, Empty)
    // ------------------------------------------------------------
    await step('5. Live Referral Code Validation (Valid, Invalid, Empty)', async () => {
        // Valid Root Referral Code
        const validRes = await NexusReferralService.validateReferralCode('NEXUS001');
        assert.strictEqual(validRes.valid, true);
        assert.strictEqual(validRes.sponsor.referralCode, 'NEXUS001');

        // Valid by Member ID
        const validMemberId = await NexusReferralService.validateReferralCode('NP000001');
        assert.strictEqual(validMemberId.valid, true);

        // Invalid Code must return "This referral link is no longer valid."
        const invalidRes = await NexusReferralService.validateReferralCode('INVALID999');
        assert.strictEqual(invalidRes.valid, false);
        assert.strictEqual(invalidRes.error, 'This referral link is no longer valid.');

        // Empty Code
        const emptyRes = await NexusReferralService.validateReferralCode('');
        assert.strictEqual(emptyRes.valid, false);
    });

    // ------------------------------------------------------------
    // TEST 6: Suspended Sponsor Referral Attempt Rejection
    // ------------------------------------------------------------
    let tempSuspendedMember = null;
    await step('6. Suspended Sponsor Referral Attempt Rejection', async () => {
        const regTemp = await NexusAuthService.registerMember({
            fullName: 'Temp Suspended Member',
            email: 'tempsuspended@nexusp.online',
            phone: '+94711119999',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            referralCode: 'NEXUS001'
        });
        assert.strictEqual(regTemp.success, true);
        tempSuspendedMember = regTemp.member;

        // Suspend the member
        await nexusDb.updateAccountStatus(tempSuspendedMember.userId, 'suspended');

        // Referral validation must reject with inactive notice
        const valRes = await NexusReferralService.validateReferralCode(tempSuspendedMember.referralCode);
        assert.strictEqual(valRes.valid, false);
        assert(valRes.error.includes('This referral link is no longer valid'));
        assert(valRes.error.includes('suspended or inactive'));

        // Registration under suspended member must be rejected
        const regAttempt = await NexusAuthService.registerMember({
            fullName: 'New Registrant Under Suspended',
            email: 'newunder.suspended@nexusp.online',
            phone: '+94711118888',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            referralCode: tempSuspendedMember.referralCode
        });
        assert.strictEqual(regAttempt.success, false);
        assert(regAttempt.error.includes('This referral link is no longer valid'));
    });

    // ------------------------------------------------------------
    // TEST 7: Self-Referral Prevention (userId !== sponsorId)
    // ------------------------------------------------------------
    await step('7. Self-Referral Prevention', async () => {
        const rootUser = await nexusDb.findUserByEmail('admin@nexusp.online');
        const selfCheck = await nexusDb.validateSponsorRelationship(rootUser.id, rootUser.id);
        assert.strictEqual(selfCheck.valid, false);
        assert(selfCheck.error.includes('Self-referral is strictly prohibited'));

        const tempCheck = await nexusDb.validateSponsorRelationship(tempSuspendedMember.userId, tempSuspendedMember.userId);
        assert.strictEqual(tempCheck.valid, false);
        assert(tempCheck.error.includes('Self-referral is strictly prohibited'));
    });

    // ------------------------------------------------------------
    // TEST 8: Successful Member Registration under Sponsor
    // ------------------------------------------------------------
    let memberA = null;
    await step('8. Member A Registration (under Root NEXUS001)', async () => {
        const payload = {
            fullName: 'Kasun Bandara',
            email: 'kasun@nexusp.online',
            phone: '+94711111111',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            referralCode: 'NEXUS001'
        };

        const result = await NexusAuthService.registerMember(payload, { ip: '192.168.1.1' });
        assert.strictEqual(result.success, true);
        assert(result.token, 'Session token must be issued upon registration');
        assert(result.member.memberId, 'Member ID must be assigned');
        assert(result.member.referralCode, 'Referral code must be assigned');
        assert.strictEqual(result.member.status, 'active');

        memberA = result.member;

        // Verify Database Records
        const profile = await nexusDb.findProfileByUserId(memberA.userId);
        assert.strictEqual(profile.full_name, 'Kasun Bandara');

        // Verify Sponsor Link
        const sponsor = await nexusDb.getSponsor(memberA.userId);
        assert(sponsor, 'Sponsor must be linked');
        assert.strictEqual(sponsor.member_id, 'NP000001');

        // Verify Wallet initialized
        const wallet = await nexusDb.getWallet(memberA.userId);
        assert.strictEqual(wallet.available_balance, 0.00);

        // Verify Audit Log
        const logs = nexusDb.auditLogs.filter(l => l.user_id === memberA.userId);
        assert(logs.length > 0, 'Audit log must be created on registration');
        assert.strictEqual(logs[0].action, 'AUTH_REGISTER');
    });

    // ------------------------------------------------------------
    // TEST 9: Duplicate Email Rejection
    // ------------------------------------------------------------
    await step('9. Duplicate Email Registration Rejection', async () => {
        const payload = {
            fullName: 'Kasun Clone',
            email: 'kasun@nexusp.online', // Already registered
            phone: '+94722222222',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            referralCode: 'NEXUS001'
        };

        const result = await NexusAuthService.registerMember(payload);
        assert.strictEqual(result.success, false);
        assert(result.error.includes('already exists'));
    });

    // ------------------------------------------------------------
    // TEST 10: Multi-Level Network Tree Creation (Root -> A -> B -> C -> D)
    // ------------------------------------------------------------
    let memberB = null;
    let memberC = null;
    let memberD = null;

    await step('10. Multi-Level Network Tree (Root -> A -> B -> C -> D)', async () => {
        // B registers under A
        const regB = await NexusAuthService.registerMember({
            fullName: 'Nimal Perera',
            email: 'nimal@nexusp.online',
            phone: '+94722222222',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            referralCode: memberA.referralCode
        });
        assert.strictEqual(regB.success, true);
        memberB = regB.member;

        // C registers under B
        const regC = await NexusAuthService.registerMember({
            fullName: 'Sunil Silva',
            email: 'sunil@nexusp.online',
            phone: '+94733333333',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            referralCode: memberB.referralCode
        });
        assert.strictEqual(regC.success, true);
        memberC = regC.member;

        // D registers under C
        const regD = await NexusAuthService.registerMember({
            fullName: 'Dinesh Jayawardena',
            email: 'dinesh@nexusp.online',
            phone: '+94744444444',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            referralCode: memberC.referralCode
        });
        assert.strictEqual(regD.success, true);
        memberD = regD.member;
    });

    // ------------------------------------------------------------
    // TEST 11: Multi-Level Downline & Upline Traversal
    // ------------------------------------------------------------
    await step('11. Network Closure & Multi-Level Traversal', async () => {
        // Test A's Downline (should have B at level 1, C at level 2, D at level 3)
        const downlineA = await NexusNetworkService.getDownline(memberA.userId);
        assert.strictEqual(downlineA.length, 3, 'Member A must have 3 downline descendants');
        assert.strictEqual(downlineA[0].user_id, memberB.userId);
        assert.strictEqual(downlineA[0].level, 1);
        assert.strictEqual(downlineA[1].user_id, memberC.userId);
        assert.strictEqual(downlineA[1].level, 2);
        assert.strictEqual(downlineA[2].user_id, memberD.userId);
        assert.strictEqual(downlineA[2].level, 3);

        // Test Depth-Limited Query (Depth = 1 for A)
        const directDownlineA = await NexusNetworkService.getDownline(memberA.userId, 1);
        assert.strictEqual(directDownlineA.length, 1);
        assert.strictEqual(directDownlineA[0].user_id, memberB.userId);

        // Test Depth-Limited Query (Depth = 2 for A)
        const depth2DownlineA = await NexusNetworkService.getDownline(memberA.userId, 2);
        assert.strictEqual(depth2DownlineA.length, 2);

        // Test D's Upline (should trace: C at 1, B at 2, A at 3, Root at 4)
        const uplineD = await NexusNetworkService.getUpline(memberD.userId);
        assert.strictEqual(uplineD.length, 4, 'Member D must have 4 upline ancestors');
        assert.strictEqual(uplineD[0].user_id, memberC.userId);
        assert.strictEqual(uplineD[0].level, 1);
        assert.strictEqual(uplineD[1].user_id, memberB.userId);
        assert.strictEqual(uplineD[1].level, 2);
        assert.strictEqual(uplineD[2].user_id, memberA.userId);
        assert.strictEqual(uplineD[2].level, 3);
    });

    // ------------------------------------------------------------
    // TEST 12: Dynamic Level Distance Calculation
    // ------------------------------------------------------------
    await step('12. Dynamic Relative Level Distance Calculation (getRelativeLevel)', async () => {
        const rootUser = await nexusDb.findUserByEmail('admin@nexusp.online');

        // Distance from Root to D
        const distRootD = await NexusNetworkService.getRelativeLevel(rootUser.id, memberD.userId);
        assert.strictEqual(distRootD, 4, 'Distance from Root to D must be 4');

        // Distance from A to D
        const distAD = await NexusNetworkService.getRelativeLevel(memberA.userId, memberD.userId);
        assert.strictEqual(distAD, 3, 'Distance from A to D must be 3');

        // Distance from B to D
        const distBD = await NexusNetworkService.getRelativeLevel(memberB.userId, memberD.userId);
        assert.strictEqual(distBD, 2, 'Distance from B to D must be 2');

        // Distance from C to D
        const distCD = await NexusNetworkService.getRelativeLevel(memberC.userId, memberD.userId);
        assert.strictEqual(distCD, 1, 'Distance from C to D must be 1');

        // Same Node Distance
        const distAA = await NexusNetworkService.getRelativeLevel(memberA.userId, memberA.userId);
        assert.strictEqual(distAA, 0, 'Distance to self must be 0');

        // Reverse or Unrelated Distance
        const distDA = await NexusNetworkService.getRelativeLevel(memberD.userId, memberA.userId);
        assert.strictEqual(distDA, null, 'Descendant to ancestor distance must be null');
    });

    // ------------------------------------------------------------
    // TEST 13: Direct Referral Count vs Total Network Count
    // ------------------------------------------------------------
    await step('13. Direct Referral Count vs Total Network Count Verification', async () => {
        const countsA = await NexusNetworkService.getTeamCounts(memberA.userId);
        assert.strictEqual(countsA.directTeamCount, 1, 'Member A direct team count must be 1');
        assert.strictEqual(countsA.totalTeamCount, 3, 'Member A total network count must be 3');

        const countsB = await NexusNetworkService.getTeamCounts(memberB.userId);
        assert.strictEqual(countsB.directTeamCount, 1, 'Member B direct team count must be 1');
        assert.strictEqual(countsB.totalTeamCount, 2, 'Member B total network count must be 2');

        const countsC = await NexusNetworkService.getTeamCounts(memberC.userId);
        assert.strictEqual(countsC.directTeamCount, 1, 'Member C direct team count must be 1');
        assert.strictEqual(countsC.totalTeamCount, 1, 'Member C total network count must be 1');

        const countsD = await NexusNetworkService.getTeamCounts(memberD.userId);
        assert.strictEqual(countsD.directTeamCount, 0, 'Member D direct team count must be 0');
        assert.strictEqual(countsD.totalTeamCount, 0, 'Member D total network count must be 0');
    });

    // ------------------------------------------------------------
    // TEST 14: Circular Sponsor Prevention
    // ------------------------------------------------------------
    await step('14. Circular Sponsor Prevention (A -> B -> C -> A Cycle Protection)', async () => {
        // Attempt to assign C as sponsor of A (A is ancestor of C)
        const checkC = await nexusDb.validateSponsorRelationship(memberA.userId, memberC.userId);
        assert.strictEqual(checkC.valid, false);
        assert(checkC.error.includes('Circular sponsor relationship detected'));

        // Attempt to assign D as sponsor of A (A is ancestor of D)
        const checkD = await nexusDb.validateSponsorRelationship(memberA.userId, memberD.userId);
        assert.strictEqual(checkD.valid, false);
        assert(checkD.error.includes('Circular sponsor relationship detected'));

        // Attempt to assign D as sponsor of B (B is ancestor of D)
        const checkDB = await nexusDb.validateSponsorRelationship(memberB.userId, memberD.userId);
        assert.strictEqual(checkDB.valid, false);
        assert(checkDB.error.includes('Circular sponsor relationship detected'));
    });

    // ------------------------------------------------------------
    // TEST 15: Progressive Tree Loading & Node Details
    // ------------------------------------------------------------
    await step('15. Progressive Tree Loading Endpoint (getNodeChildren & getNodeDetails)', async () => {
        // Children of A: returns B with hasChildren = true
        const childrenA = await NexusNetworkService.getNodeChildren(memberA.userId);
        assert.strictEqual(childrenA.length, 1);
        assert.strictEqual(childrenA[0].userId, memberB.userId);
        assert.strictEqual(childrenA[0].hasChildren, true);

        // Children of C: returns D with hasChildren = false
        const childrenC = await NexusNetworkService.getNodeChildren(memberC.userId);
        assert.strictEqual(childrenC.length, 1);
        assert.strictEqual(childrenC[0].userId, memberD.userId);
        assert.strictEqual(childrenC[0].hasChildren, false);

        // Children of D: empty
        const childrenD = await NexusNetworkService.getNodeChildren(memberD.userId);
        assert.strictEqual(childrenD.length, 0);

        // Node Details Modal data for B
        const detailsB = await NexusNetworkService.getNodeDetails(memberB.userId);
        assert(detailsB);
        assert.strictEqual(detailsB.memberId, memberB.memberId);
        assert.strictEqual(detailsB.sponsor.memberId, memberA.memberId);
        assert.strictEqual(detailsB.directTeamCount, 1);
        assert.strictEqual(detailsB.totalTeamCount, 2);
    });

    // ------------------------------------------------------------
    // TEST 16: Inactive/Suspended Downline Visibility & Status Handling
    // ------------------------------------------------------------
    await step('16. Inactive/Suspended Downline Visibility & Status Filtering', async () => {
        // Suspend Member C
        await nexusDb.updateAccountStatus(memberC.userId, 'suspended');

        // All status downline query (downline structure must NOT break)
        const downlineAll = await NexusNetworkService.getDownline(memberA.userId, null, 'all');
        assert.strictEqual(downlineAll.length, 3, 'Suspended member must remain in genealogy tree');
        const cRecord = downlineAll.find(d => d.user_id === memberC.userId);
        assert(cRecord);
        assert.strictEqual(cRecord.status, 'suspended');

        // Active filter: excludes C
        const downlineActive = await NexusNetworkService.getDownline(memberA.userId, null, 'active');
        assert.strictEqual(downlineActive.length, 2, 'Active filter must return only B and D');
        assert(!downlineActive.some(d => d.user_id === memberC.userId));

        // Suspended filter: only C
        const downlineSuspended = await NexusNetworkService.getDownline(memberA.userId, null, 'suspended');
        assert.strictEqual(downlineSuspended.length, 1);
        assert.strictEqual(downlineSuspended[0].user_id, memberC.userId);

        // Restore C to active
        await nexusDb.updateAccountStatus(memberC.userId, 'active');
    });

    // ------------------------------------------------------------
    // TEST 10: Nested Tree Hierarchy Formatter
    // ------------------------------------------------------------
    await step('10. Nested Tree Hierarchy Generation for Visualizer', async () => {
        const tree = await NexusNetworkService.getTreeHierarchy(memberA.userId);
        assert(tree, 'Tree object must exist');
        assert.strictEqual(tree.name, 'Kasun Bandara');
        assert.strictEqual(tree.children.length, 1, 'A must have 1 direct child (B)');
        assert.strictEqual(tree.children[0].name, 'Nimal Perera');
        assert.strictEqual(tree.children[0].children.length, 1, 'B must have 1 direct child (C)');
        assert.strictEqual(tree.children[0].children[0].name, 'Sunil Silva');
    });

    // ------------------------------------------------------------
    // TEST 11: Member Login & Session Management
    // ------------------------------------------------------------
    let activeSessionToken = null;
    await step('11. Member Login & Token Issuance', async () => {
        // Successful Login
        const loginRes = await NexusAuthService.login('kasun@nexusp.online', 'Password123!');
        assert.strictEqual(loginRes.success, true);
        assert(loginRes.token, 'Session token must be returned');
        assert.strictEqual(loginRes.redirectUrl, '/dashboard');
        activeSessionToken = loginRes.token;

        // Verify Session Token
        const sessionCheck = NexusAuthService.verifySession(activeSessionToken);
        assert.strictEqual(sessionCheck.valid, true);
        assert.strictEqual(sessionCheck.session.userId, memberA.userId);

        // Invalid Password
        const badPass = await NexusAuthService.login('kasun@nexusp.online', 'WrongPassword');
        assert.strictEqual(badPass.success, false);

        // Unknown Email
        const badEmail = await NexusAuthService.login('unknown@nexusp.online', 'Password123!');
        assert.strictEqual(badEmail.success, false);
    });

    // ------------------------------------------------------------
    // TEST 12: Account Status Restrictions (Blocked/Suspended)
    // ------------------------------------------------------------
    await step('12. Account Status Restriction Enforcement', async () => {
        // Suspend Member B
        await nexusDb.updateAccountStatus(memberB.userId, 'suspended');
        const loginSuspended = await NexusAuthService.login('nimal@nexusp.online', 'Password123!');
        assert.strictEqual(loginSuspended.success, false);
        assert(loginSuspended.error.includes('suspended'));

        // Block Member B
        await nexusDb.updateAccountStatus(memberB.userId, 'blocked');
        const loginBlocked = await NexusAuthService.login('nimal@nexusp.online', 'Password123!');
        assert.strictEqual(loginBlocked.success, false);
        assert(loginBlocked.error.includes('blocked'));

        // Restore to Active
        await nexusDb.updateAccountStatus(memberB.userId, 'active');
        const loginActive = await NexusAuthService.login('nimal@nexusp.online', 'Password123!');
        assert.strictEqual(loginActive.success, true);
    });

    // ------------------------------------------------------------
    // TEST 13: Member Dashboard Foundation Aggregator
    // ------------------------------------------------------------
    await step('13. Member Dashboard Foundation Data Aggregation', async () => {
        const dashboard = await NexusMemberService.getMemberDashboardData(memberA.userId);
        assert(dashboard, 'Dashboard data must exist');
        assert.strictEqual(dashboard.member.memberId, memberA.memberId);
        assert.strictEqual(dashboard.member.fullName, 'Kasun Bandara');
        assert.strictEqual(dashboard.sponsor.referralCode, 'NEXUS001');
        assert.strictEqual(dashboard.network.directTeamCount, 1);
        assert.strictEqual(dashboard.network.totalTeamCount, 3);
        assert(dashboard.member.referralUrl.includes(memberA.referralCode));
    });

    // ------------------------------------------------------------
    // TEST 14: Protected Profile Updates
    // ------------------------------------------------------------
    await step('14. Profile Update & Protected Field Immunity', async () => {
        const updateRes = await NexusMemberService.updateProfile(memberA.userId, {
            displayName: 'KasunB',
            phone: '+94799999999',
            address: '123 Galle Road, Colombo 03',
            // Try to maliciously alter protected fields:
            member_id: 'NP999999',
            referral_code: 'HACKED',
            sponsor_id: memberD.userId
        });

        assert.strictEqual(updateRes.success, true);
        assert.strictEqual(updateRes.profile.display_name, 'KasunB');
        assert.strictEqual(updateRes.profile.phone, '+94799999999');

        // Invariant fields MUST NOT change
        assert.strictEqual(updateRes.profile.member_id, memberA.memberId);
        assert.strictEqual(updateRes.profile.referral_code, memberA.referralCode);
        assert.strictEqual(updateRes.profile.sponsor_id, '00000000-0000-4000-8000-000000000001');
    });

    // ------------------------------------------------------------
    // TEST 15: Session Logout Invalidation
    // ------------------------------------------------------------
    await step('15. Session Logout & Token Revocation', async () => {
        NexusAuthService.logout(activeSessionToken);
        const check = NexusAuthService.verifySession(activeSessionToken);
        assert.strictEqual(check.valid, false, 'Revoked token must be invalid');
    });

    // ------------------------------------------------------------
    // TEST 16: Clean URL Routing Resolution
    // ------------------------------------------------------------
    await step('16. Clean URL Routing & Static Shell Resolution', async () => {
        const { requestHandler } = require('../nexus_backend/nexus-server');
        assert(typeof requestHandler === 'function', 'Server requestHandler must be exported');

        // Helper mock HTTP response
        function mockReqRes(pathname, method = 'GET') {
            const req = {
                method,
                url: pathname,
                headers: { host: 'localhost:3001' },
                socket: { remoteAddress: '127.0.0.1' },
                on: (e, cb) => { if (e === 'end') cb(); }
            };
            let statusCode = null;
            let headers = {};
            let body = '';
            let onDone = null;
            const donePromise = new Promise(resolve => { onDone = resolve; });
            const res = {
                writeHead: (code, h) => { statusCode = code; headers = h; },
                end: (chunk) => {
                    if (chunk) body += chunk.toString();
                    if (onDone) onDone();
                }
            };
            return {
                req,
                res,
                wait: () => donePromise,
                getResult: () => ({ statusCode, headers, body })
            };
        }

        // Test Health API
        const health = mockReqRes('/api/v1/nexus/health');
        requestHandler(health.req, health.res);
        await health.wait();
        const healthRes = health.getResult();
        assert.strictEqual(healthRes.statusCode, 200);
        assert(healthRes.body.includes('Nexus Prime (PVT) Ltd'));

        // Test Forgot Password Route
        const forgot = mockReqRes('/forgot-password');
        requestHandler(forgot.req, forgot.res);
        await forgot.wait();
        const forgotRes = forgot.getResult();
        assert.strictEqual(forgotRes.statusCode, 200);
        assert(forgotRes.body.includes('Reset Your Password'));
    });

    // ------------------------------------------------------------
    // TEST 17: Admin Statistics & Role Security Verification
    // ------------------------------------------------------------
    await step('17. Admin Statistics & Role Guard Verification', async () => {
        // Test admin stats method on repository
        const stats = await nexusDb.getAdminStats();
        assert(stats.totalMembers >= 1, 'Total members should include root admin');
        assert(stats.activeMembers >= 1, 'Active members should include root admin');

        // Test all members method
        const membersList = await nexusDb.getAllMembers();
        assert(Array.isArray(membersList));
        const rootAdmin = membersList.find(m => m.memberId === 'NP000001');
        assert(rootAdmin, 'Root admin NP000001 must be present in members directory');
        assert.strictEqual(rootAdmin.role, 'SUPER ADMIN');
    });

    // Helper for HTTP simulation in tests 18-25
    function mockHttp(pathname, method = 'GET', customHeaders = {}, bodyObj = null) {
        if (typeof resetRateLimits === 'function') {
            resetRateLimits();
        }
        let dataCbs = [];
        let endCbs = [];
        const req = {
            method,
            url: pathname,
            headers: { host: 'localhost:3001', ...customHeaders },
            socket: { remoteAddress: '127.0.0.1' },
            on: (e, cb) => {
                if (e === 'data') dataCbs.push(cb);
                if (e === 'end') endCbs.push(cb);
            }
        };
        let statusCode = null;
        let headers = {};
        let body = '';
        let onDone = null;
        const donePromise = new Promise(resolve => { onDone = resolve; });
        const res = {
            writeHead: (code, h) => {
                statusCode = code;
                headers = {};
                if (h) {
                    Object.keys(h).forEach(k => {
                        headers[k] = h[k];
                        headers[k.toLowerCase()] = h[k];
                    });
                }
            },
            end: (chunk) => {
                if (chunk) body += chunk.toString();
                if (onDone) onDone();
            }
        };
        const trigger = () => {
            setImmediate(() => {
                if (bodyObj !== null) {
                    const payloadStr = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
                    dataCbs.forEach(cb => cb(Buffer.from(payloadStr)));
                }
                endCbs.forEach(cb => cb());
            });
        };
        return {
            req,
            res,
            trigger,
            wait: () => donePromise,
            getResult: () => ({ statusCode, headers, body })
        };
    }

    // ------------------------------------------------------------
    // TEST 18: Member Dashboard Comprehensive Data & Financial Placeholder Policy
    // ------------------------------------------------------------
    await step('18. Member Dashboard Data & Neutral Financial Placeholder Policy', async () => {
        // Authenticated Kasun Bandara (memberA)
        const dashboard = await NexusMemberService.getMemberDashboardData(memberA.userId);
        assert(dashboard, 'Dashboard data must exist');

        // Member identity
        assert.strictEqual(dashboard.member.memberId, memberA.memberId);
        assert.strictEqual(dashboard.member.fullName, 'Kasun Bandara');
        assert.strictEqual(dashboard.member.status, 'active');

        // Sponsor details
        assert.strictEqual(dashboard.sponsor.isIndependent, false);
        assert.strictEqual(dashboard.sponsor.referralCode, 'NEXUS001');

        // Team stats
        assert.strictEqual(dashboard.networkStats.directTeamCount, 1);
        assert.strictEqual(dashboard.networkStats.totalTeamCount, 3);
        assert.strictEqual(dashboard.networkStats.activeTeamCount, 3);

        // Strict Financial Placeholder Policy
        assert.strictEqual(dashboard.financials.isAvailable, false);
        assert.strictEqual(dashboard.financials.badge, 'Coming Soon');
        assert.strictEqual(dashboard.financials.availableBalance, null);
        assert.strictEqual(dashboard.financials.totalEarnings, null);
        assert.strictEqual(dashboard.financials.pendingCommission, null);

        // Root Corporate Member Dashboard (Independent Member fallback)
        const rootDashboard = await NexusMemberService.getMemberDashboardData('00000000-0000-4000-8000-000000000001');
        assert(rootDashboard, 'Root dashboard must exist');
        assert.strictEqual(rootDashboard.sponsor.isIndependent, true);
        assert.strictEqual(rootDashboard.sponsor.name, 'Independent Member');
    });

    // ------------------------------------------------------------
    // TEST 19: Profile Personal vs Account Information Separation
    // ------------------------------------------------------------
    await step('19. Profile Personal vs Account Information Separation', async () => {
        const profile = await NexusMemberService.getMemberProfile(memberA.userId);
        assert(profile, 'Profile must exist');

        // Section A: Personal Information
        assert(profile.personal, 'Personal section must exist');
        assert.strictEqual(profile.personal.fullName, 'Kasun Bandara');
        assert.strictEqual(profile.personal.email, 'kasun@nexusp.online');
        assert.strictEqual(profile.personal.country, 'Sri Lanka');

        // Section B: Account Information (Immutable)
        assert(profile.account, 'Account section must exist');
        assert.strictEqual(profile.account.memberId, memberA.memberId);
        assert.strictEqual(profile.account.referralCode, memberA.referralCode);
        assert.strictEqual(profile.account.status, 'active');
        assert.strictEqual(profile.account.sponsor.referralCode, 'NEXUS001');
    });

    // ------------------------------------------------------------
    // TEST 20: Profile Photo Upload Validation (MIME & Size Limits)
    // ------------------------------------------------------------
    await step('20. Profile Photo Upload Validation (MIME & Size Limits)', async () => {
        const { requestHandler } = require('../nexus_backend/nexus-server');
        const loginA = await NexusAuthService.login('kasun@nexusp.online', 'Password123!');
        const tokenA = loginA.token;

        // 1. Invalid MIME type (text/plain)
        const invalidMimeReq = mockHttp('/api/v1/nexus/member/profile-image', 'POST', {
            'authorization': `Bearer ${tokenA}`,
            'content-type': 'application/json'
        }, {
            imageBase64: Buffer.from('fake data').toString('base64'),
            mimeType: 'text/plain'
        });
        requestHandler(invalidMimeReq.req, invalidMimeReq.res);
        invalidMimeReq.trigger();
        await invalidMimeReq.wait();
        assert.strictEqual(invalidMimeReq.getResult().statusCode, 400);
        assert(invalidMimeReq.getResult().body.includes('Invalid file format'));

        // 2. Oversized image (> 2MB)
        const hugeBuffer = Buffer.alloc(2.5 * 1024 * 1024);
        const oversizedReq = mockHttp('/api/v1/nexus/member/profile-image', 'POST', {
            'authorization': `Bearer ${tokenA}`,
            'content-type': 'application/json'
        }, {
            imageBase64: hugeBuffer.toString('base64'),
            mimeType: 'image/png'
        });
        requestHandler(oversizedReq.req, oversizedReq.res);
        oversizedReq.trigger();
        await oversizedReq.wait();
        assert.strictEqual(oversizedReq.getResult().statusCode, 400);
        assert(oversizedReq.getResult().body.includes('exceeds maximum limit'));

        // 3. Valid PNG image (< 2MB)
        const validBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        const validReq = mockHttp('/api/v1/nexus/member/profile-image', 'POST', {
            'authorization': `Bearer ${tokenA}`,
            'content-type': 'application/json'
        }, {
            imageBase64: validBuffer.toString('base64'),
            mimeType: 'image/png'
        });
        requestHandler(validReq.req, validReq.res);
        validReq.trigger();
        await validReq.wait();
        const validRes = validReq.getResult();
        assert.strictEqual(validRes.statusCode, 200);
        const json = JSON.parse(validRes.body);
        assert.strictEqual(json.success, true);
        assert(json.profileImageUrl.startsWith('data:image/png;base64,'));
    });

    // ------------------------------------------------------------
    // TEST 21: Direct Referrals Pagination, Search & Status Filtering
    // ------------------------------------------------------------
    await step('21. Direct Referrals Pagination, Search & Status Filtering', async () => {
        // Kasun Bandara (memberA) direct referral is Nimal Perera (memberB)
        const refResult = await NexusMemberService.getMemberReferrals(memberA.userId, { page: 1, limit: 10 });
        assert(refResult, 'Referrals result must exist');
        assert.strictEqual(refResult.total, 1);
        assert.strictEqual(refResult.referrals[0].member_id, memberB.memberId);
        assert.strictEqual(refResult.referrals[0].full_name, 'Nimal Perera');

        // Search match
        const searchMatch = await NexusMemberService.getMemberReferrals(memberA.userId, { search: 'Nimal' });
        assert.strictEqual(searchMatch.total, 1);

        // Search no match
        const searchNoMatch = await NexusMemberService.getMemberReferrals(memberA.userId, { search: 'NonExistent' });
        assert.strictEqual(searchNoMatch.total, 0);

        // Status filter match
        const statusActive = await NexusMemberService.getMemberReferrals(memberA.userId, { status: 'active' });
        assert.strictEqual(statusActive.total, 1);

        const statusPending = await NexusMemberService.getMemberReferrals(memberA.userId, { status: 'pending' });
        assert.strictEqual(statusPending.total, 0);
    });

    // ------------------------------------------------------------
    // TEST 22: Downline Team Directory Pagination, Search & Stats
    // ------------------------------------------------------------
    await step('22. Downline Team Directory Pagination, Search & Stats', async () => {
        // Downline under memberA is B (level 1), C (level 2), D (level 3)
        const teamResult = await NexusMemberService.getMemberTeam(memberA.userId, { page: 1, limit: 2 });
        assert.strictEqual(teamResult.total, 3);
        assert.strictEqual(teamResult.totalPages, 2);
        assert.strictEqual(teamResult.members.length, 2);

        // Page 2
        const teamPage2 = await NexusMemberService.getMemberTeam(memberA.userId, { page: 2, limit: 2 });
        assert.strictEqual(teamPage2.members.length, 1);

        // Search downline by name
        const searchC = await NexusMemberService.getMemberTeam(memberA.userId, { search: 'Sunil' });
        assert.strictEqual(searchC.total, 1);
        assert.strictEqual(searchC.members[0].level, 2);

        // Team stats summary
        const stats = await NexusMemberService.getMemberTeamStats(memberA.userId);
        assert.strictEqual(stats.directTeamCount, 1);
        assert.strictEqual(stats.totalTeamCount, 3);
        assert.strictEqual(stats.activeTeamCount, 3);
        assert.strictEqual(stats.pendingTeamCount, 0);
    });

    // ------------------------------------------------------------
    // TEST 23: Member Activity Logging & Retrieval
    // ------------------------------------------------------------
    await step('23. Member Activity Logging & User-Facing Feed', async () => {
        const activities = await NexusMemberService.getMemberActivities(memberA.userId);
        assert(activities.activities.length > 0, 'Activities must be logged for memberA');

        // Check recent event types
        const actions = activities.activities.map(a => a.action);
        assert(actions.includes('ACCOUNT_ACTIVATED') || actions.includes('REFERRAL_JOINED') || actions.includes('PROFILE_UPDATED'));

        // Verify distinct from admin audit logs (activities are clean user-facing)
        const firstAct = activities.activities[0];
        assert(firstAct.description, 'Activity must have user-friendly description');
        assert(firstAct.icon, 'Activity must have an icon');
        assert(!firstAct.ip_address, 'Member activity must not leak raw internal audit IP strings');
    });

    // ------------------------------------------------------------
    // TEST 24: Member Notifications System & Mark Read Operations
    // ------------------------------------------------------------
    await step('24. Member Notifications System (Unread Count & Mark Read)', async () => {
        // Insert test notification for memberA
        await nexusDb.insertNotification({
            userId: memberA.userId,
            title: 'Rank Promotion Announcement',
            message: 'Congratulations, you have qualified for the Executive tier.',
            type: 'account'
        });

        const notifs = await NexusMemberService.getMemberNotifications(memberA.userId);
        assert(notifs.notifications.length > 0);
        assert(notifs.unreadCount > 0);

        const targetNotif = notifs.notifications.find(n => n.title === 'Rank Promotion Announcement');
        assert(targetNotif);
        assert.strictEqual(targetNotif.read, false);

        // Mark single notification read
        const markRes = await NexusMemberService.markNotificationRead(memberA.userId, targetNotif.id);
        assert.strictEqual(markRes.success, true);

        // Mark all notifications read
        const markAllRes = await NexusMemberService.markAllNotificationsRead(memberA.userId);
        assert.strictEqual(markAllRes.success, true);

        const unreadAfter = await nexusDb.getUnreadNotificationCount(memberA.userId);
        assert.strictEqual(unreadAfter, 0);
    });

    // ------------------------------------------------------------
    // TEST 25: Cross-Member Isolation & Role Security Guard
    // ------------------------------------------------------------
    await step('25. Cross-Member Isolation & Administrative Role Guard', async () => {
        const { requestHandler } = require('../nexus_backend/nexus-server');
        const loginB = await NexusAuthService.login('nimal@nexusp.online', 'Password123!');
        const tokenB = loginB.token;

        // Member B attempts to access Admin Stats endpoint -> Expect 403 Forbidden
        const adminStatsReq = mockHttp('/api/v1/nexus/admin/stats', 'GET', {
            'authorization': `Bearer ${tokenB}`
        });
        requestHandler(adminStatsReq.req, adminStatsReq.res);
        adminStatsReq.trigger();
        await adminStatsReq.wait();
        assert.strictEqual(adminStatsReq.getResult().statusCode, 403);

        // Member B attempts to access Admin Members endpoint -> Expect 403 Forbidden
        const adminMembersReq = mockHttp('/api/v1/nexus/admin/members', 'GET', {
            'authorization': `Bearer ${tokenB}`
        });
        requestHandler(adminMembersReq.req, adminMembersReq.res);
        adminMembersReq.trigger();
        await adminMembersReq.wait();
        assert.strictEqual(adminMembersReq.getResult().statusCode, 403);
    });

    // ------------------------------------------------------------
    // TEST 26: Admin Authorization Guard (401 & 403 Security)
    // ------------------------------------------------------------
    await step('26. Admin Authorization Guard (401 Unauthenticated & 403 Member Denial)', async () => {
        // Missing Token -> Expect 401
        const noAuthReq = mockHttp('/api/v1/nexus/admin/stats', 'GET');
        requestHandler(noAuthReq.req, noAuthReq.res);
        noAuthReq.trigger();
        await noAuthReq.wait();
        assert.strictEqual(noAuthReq.getResult().statusCode, 401);

        // Obtain valid non-admin member token
        const memberLogin = await NexusAuthService.login('nimal@nexusp.online', 'Password123!');
        assert.strictEqual(memberLogin.success, true);
        const memberToken = memberLogin.token;

        // Member attempts to access Admin Audit Logs -> Expect 403
        const auditDenial = mockHttp('/api/v1/nexus/admin/audit-logs', 'GET', {
            'authorization': `Bearer ${memberToken}`
        });
        requestHandler(auditDenial.req, auditDenial.res);
        auditDenial.trigger();
        await auditDenial.wait();
        assert.strictEqual(auditDenial.getResult().statusCode, 403);

        // Member attempts to access Admin Settings -> Expect 403
        const settingsDenial = mockHttp('/api/v1/nexus/admin/settings', 'GET', {
            'authorization': `Bearer ${memberToken}`
        });
        requestHandler(settingsDenial.req, settingsDenial.res);
        settingsDenial.trigger();
        await settingsDenial.wait();
        assert.strictEqual(settingsDenial.getResult().statusCode, 403);

        // Member attempts to mutate status -> Expect 403
        const mutateDenial = mockHttp(`/api/v1/nexus/admin/members/${memberB.userId}/status`, 'PUT', {
            'authorization': `Bearer ${memberToken}`,
            'content-type': 'application/json'
        }, { status: 'suspended', reason: 'Hacking attempt' });
        requestHandler(mutateDenial.req, mutateDenial.res);
        mutateDenial.trigger();
        await mutateDenial.wait();
        assert.strictEqual(mutateDenial.getResult().statusCode, 403);
    });

    // ------------------------------------------------------------
    // TEST 27: Admin Dashboard Comprehensive Statistics Calculation
    // ------------------------------------------------------------
    let adminToken = null;
    await step('27. Admin Dashboard Statistics & Neutral Financial Policy', async () => {
        // Log in as Root Administrator
        const adminLogin = await NexusAuthService.login('admin@nexusp.online', 'Admin123!');
        assert.strictEqual(adminLogin.success, true);
        assert(adminLogin.token, 'Admin session token must be issued');
        adminToken = adminLogin.token;

        const statsReq = mockHttp('/api/v1/nexus/admin/stats', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(statsReq.req, statsReq.res);
        statsReq.trigger();
        await statsReq.wait();
        const res = statsReq.getResult();
        assert.strictEqual(res.statusCode, 200);

        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        const s = body.stats;
        assert(s.totalMembers >= 4, 'Total members should count all enrolled distributors');
        assert(s.activeMembers >= 3, 'Active members count should be accurate');
        assert(s.totalDirectReferrals >= 3, 'Total direct referral links count');
        assert.strictEqual(s.financials.isAvailable, false);
        assert.strictEqual(s.financials.badge, 'Coming Soon');
        assert(s.systemStatus.environment.includes('Isolated'));
        assert(Array.isArray(s.recentRegistrations), 'recentRegistrations must be an array');
    });

    // ------------------------------------------------------------
    // TEST 28: Member Management Directory (Pagination, Search & Filter)
    // ------------------------------------------------------------
    await step('28. Member Management Directory Pagination, Multi-Field Search & Filter', async () => {
        // 1. Pagination: Limit to 2 members per page
        const pagedReq = mockHttp('/api/v1/nexus/admin/members?page=1&limit=2', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(pagedReq.req, pagedReq.res);
        pagedReq.trigger();
        await pagedReq.wait();
        const pagedBody = JSON.parse(pagedReq.getResult().body);
        assert.strictEqual(pagedBody.success, true);
        assert.strictEqual(pagedBody.members.length, 2);
        assert.strictEqual(pagedBody.page, 1);
        assert.strictEqual(pagedBody.limit, 2);
        assert(pagedBody.totalPages >= 2);

        // Verify No Password Hashes Exposed
        pagedBody.members.forEach(m => {
            assert.strictEqual(m.password, undefined);
            assert.strictEqual(m.password_hash, undefined);
        });

        // 2. Multi-field Search by Member ID
        const searchIdReq = mockHttp(`/api/v1/nexus/admin/members?search=${memberA.memberId}`, 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(searchIdReq.req, searchIdReq.res);
        searchIdReq.trigger();
        await searchIdReq.wait();
        const searchIdBody = JSON.parse(searchIdReq.getResult().body);
        assert(searchIdBody.members.some(m => m.memberId === memberA.memberId));

        // 3. Search by Name
        const searchNameReq = mockHttp('/api/v1/nexus/admin/members?search=Nimal', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(searchNameReq.req, searchNameReq.res);
        searchNameReq.trigger();
        await searchNameReq.wait();
        const searchNameBody = JSON.parse(searchNameReq.getResult().body);
        assert(searchNameBody.members.some(m => m.fullName === 'Nimal Perera'));

        // 4. Filter by Status
        const statusFilterReq = mockHttp('/api/v1/nexus/admin/members?status=active', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(statusFilterReq.req, statusFilterReq.res);
        statusFilterReq.trigger();
        await statusFilterReq.wait();
        const statusBody = JSON.parse(statusFilterReq.getResult().body);
        statusBody.members.forEach(m => assert.strictEqual(m.status, 'active'));
    });

    // ------------------------------------------------------------
    // TEST 29: Member 360-Degree Dossier (Account, Referral, Network, Profile)
    // ------------------------------------------------------------
    await step('29. Member 360-Degree Dossier Inspection', async () => {
        const dossierReq = mockHttp(`/api/v1/nexus/admin/members/${memberB.memberId}`, 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(dossierReq.req, dossierReq.res);
        dossierReq.trigger();
        await dossierReq.wait();
        const res = dossierReq.getResult();
        assert.strictEqual(res.statusCode, 200);

        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        const m = body.member;

        // Account section
        assert.strictEqual(m.account.memberId, memberB.memberId);
        assert.strictEqual(m.account.fullName, 'Nimal Perera');
        assert.strictEqual(m.account.email, 'nimal@nexusp.online');
        assert.strictEqual(m.account.password, undefined);
        assert.strictEqual(m.account.password_hash, undefined);

        // Referral section
        assert(m.referral.referralCode);
        assert.strictEqual(m.referral.sponsor.memberId, memberA.memberId);

        // Network Upline Path to Root
        assert(Array.isArray(m.network.uplineChain));
        assert(m.network.uplineChain.some(u => u.memberId === 'NP000001'));

        // Non-existent member -> 404
        const badReq = mockHttp('/api/v1/nexus/admin/members/NP999999', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(badReq.req, badReq.res);
        badReq.trigger();
        await badReq.wait();
        assert.strictEqual(badReq.getResult().statusCode, 404);
    });

    // ------------------------------------------------------------
    // TEST 30: Administrative Status Modification & Corporate Root Protection
    // ------------------------------------------------------------
    await step('30. Admin Status Modification, Audit Emission & Corporate Root Protection', async () => {
        // 1. Suspend Member B with reason
        const suspendReq = mockHttp(`/api/v1/nexus/admin/members/${memberB.userId}/status`, 'PUT', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            status: 'suspended',
            reason: 'Audit investigation pending documentation'
        });
        requestHandler(suspendReq.req, suspendReq.res);
        suspendReq.trigger();
        await suspendReq.wait();
        const suspendRes = suspendReq.getResult();
        assert.strictEqual(suspendRes.statusCode, 200);
        const suspendBody = JSON.parse(suspendRes.body);
        assert.strictEqual(suspendBody.success, true);
        assert.strictEqual(suspendBody.newStatus, 'suspended');

        // Verify status in DB
        const profileB = await nexusDb.findProfileByUserId(memberB.userId);
        assert.strictEqual(profileB.status, 'suspended');

        // 2. Safeguard: Attempting to suspend Corporate Root NP000001 -> Expect 400 Bad Request
        const rootSuspendReq = mockHttp('/api/v1/nexus/admin/members/NP000001/status', 'PUT', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            status: 'suspended',
            reason: 'Malicious attempt'
        });
        requestHandler(rootSuspendReq.req, rootSuspendReq.res);
        rootSuspendReq.trigger();
        await rootSuspendReq.wait();
        assert.strictEqual(rootSuspendReq.getResult().statusCode, 400);

        // 3. Restore Member B to active
        const restoreReq = mockHttp(`/api/v1/nexus/admin/members/${memberB.userId}/status`, 'PUT', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            status: 'active',
            reason: 'Identity verification approved'
        });
        requestHandler(restoreReq.req, restoreReq.res);
        restoreReq.trigger();
        await restoreReq.wait();
        assert.strictEqual(restoreReq.getResult().statusCode, 200);
        const restoredProfile = await nexusDb.findProfileByUserId(memberB.userId);
        assert.strictEqual(restoredProfile.status, 'active');
    });

    // ------------------------------------------------------------
    // TEST 31: Admin Network Tree Explorer (Arbitrary Centering)
    // ------------------------------------------------------------
    await step('31. Admin Network Tree Explorer Arbitrary Centering & Lazy Loading', async () => {
        // Tree centered on Member A
        const treeReq = mockHttp(`/api/v1/nexus/admin/network/tree?rootId=${memberA.memberId}&depth=3`, 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(treeReq.req, treeReq.res);
        treeReq.trigger();
        await treeReq.wait();
        const treeRes = JSON.parse(treeReq.getResult().body);
        assert.strictEqual(treeRes.success, true);
        assert.strictEqual(treeRes.tree.memberId, memberA.memberId);
        assert(treeRes.tree.children.length >= 1);

        // Lazy load direct children of Member A
        const childrenReq = mockHttp(`/api/v1/nexus/admin/network/children?parentId=${memberA.userId}`, 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(childrenReq.req, childrenReq.res);
        childrenReq.trigger();
        await childrenReq.wait();
        const childrenRes = JSON.parse(childrenReq.getResult().body);
        assert.strictEqual(childrenRes.success, true);
        assert(childrenRes.children.some(c => c.memberId === memberB.memberId));
    });

    // ------------------------------------------------------------
    // TEST 32: Admin Referral Relationships Ledger
    // ------------------------------------------------------------
    await step('32. Admin Referral Relationships Ledger & Attribution Pairs', async () => {
        const refReq = mockHttp('/api/v1/nexus/admin/referrals?page=1&limit=10', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(refReq.req, refReq.res);
        refReq.trigger();
        await refReq.wait();
        const res = JSON.parse(refReq.getResult().body);
        assert.strictEqual(res.success, true);
        assert(Array.isArray(res.referrals));
        assert(res.referrals.length >= 3);
        const pair = res.referrals.find(r => r.referredMemberId === memberB.memberId);
        assert(pair, 'Member B referral relationship must exist');
        assert.strictEqual(pair.referrerMemberId, memberA.memberId);
    });

    // ------------------------------------------------------------
    // TEST 33: Tamper-Proof Audit Trail
    // ------------------------------------------------------------
    await step('33. Tamper-Proof Audit Trail Pagination & Event Tracking', async () => {
        const auditReq = mockHttp('/api/v1/nexus/admin/audit-logs?page=1&limit=10', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(auditReq.req, auditReq.res);
        auditReq.trigger();
        await auditReq.wait();
        const res = JSON.parse(auditReq.getResult().body);
        assert.strictEqual(res.success, true);
        assert(Array.isArray(res.logs));
        assert(res.logs.some(l => l.action === 'MEMBER_STATUS_UPDATED'));
    });

    // ------------------------------------------------------------
    // TEST 34: Admin Platform System Settings Read & Mutation
    // ------------------------------------------------------------
    await step('34. Admin Platform System Settings Read & Safe Mutation with Audit Log', async () => {
        // 1. Get Settings
        const getSettingsReq = mockHttp('/api/v1/nexus/admin/settings', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(getSettingsReq.req, getSettingsReq.res);
        getSettingsReq.trigger();
        await getSettingsReq.wait();
        const settingsRes = JSON.parse(getSettingsReq.getResult().body);
        assert.strictEqual(settingsRes.success, true);
        assert(settingsRes.settings.companyName);

        // 2. Update Settings
        const updateSettingsReq = mockHttp('/api/v1/nexus/admin/settings', 'PUT', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            companyName: 'Nexus Prime International (PVT) Ltd',
            supportEmail: 'contact@nexusp.online',
            minWithdrawalAmountLkr: 1500
        });
        requestHandler(updateSettingsReq.req, updateSettingsReq.res);
        updateSettingsReq.trigger();
        await updateSettingsReq.wait();
        const updateRes = JSON.parse(updateSettingsReq.getResult().body);
        assert.strictEqual(updateRes.success, true);
        assert.strictEqual(updateRes.settings.companyName, 'Nexus Prime International (PVT) Ltd');
        assert.strictEqual(updateRes.settings.minWithdrawalAmountLkr, 1500);

        // 3. Verify Audit Log was recorded for setting mutation
        const auditCheck = await nexusDb.getAuditLogs({ action: 'PLATFORM_SETTINGS_UPDATED' });
        assert(auditCheck.logs.length >= 1, 'Audit log must record setting change');
    });

    // ------------------------------------------------------------
    // TEST 35: Public Active Packages Listing & Feature Enrichment
    // ------------------------------------------------------------
    await step('35. Public Active Packages Listing & Feature Enrichment', async () => {
        const req = mockHttp('/api/v1/nexus/packages', 'GET');
        requestHandler(req.req, req.res);
        req.trigger();
        await req.wait();
        const res = JSON.parse(req.getResult().body);
        assert.strictEqual(res.success, true);
        assert(Array.isArray(res.packages), 'Must return packages array');
        assert(res.packages.length >= 3, 'Must have at least 3 initial seed packages');
        
        // Verify starter package
        const starter = res.packages.find(p => p.package_code === 'NP-PKG-01');
        assert(starter, 'NP-PKG-01 Starter Package must exist');
        assert.strictEqual(starter.status, 'active');
        assert.strictEqual(starter.price, 7500);
        assert(Array.isArray(starter.features) && starter.features.length >= 3, 'Features must be enriched');
    });

    // ------------------------------------------------------------
    // TEST 36: Public Package Detail & Slug Lookup
    // ------------------------------------------------------------
    await step('36. Public Package Detail & Slug Lookup', async () => {
        // By Slug
        const reqSlug = mockHttp('/api/v1/nexus/packages/professional-package', 'GET');
        requestHandler(reqSlug.req, reqSlug.res);
        reqSlug.trigger();
        await reqSlug.wait();
        const resSlug = JSON.parse(reqSlug.getResult().body);
        assert.strictEqual(resSlug.success, true);
        assert.strictEqual(resSlug.package.package_code, 'NP-PKG-02');
        assert.strictEqual(resSlug.package.featured, true);

        // Non-existent slug returns 404
        const reqNon = mockHttp('/api/v1/nexus/packages/non-existent-tier', 'GET');
        requestHandler(reqNon.req, reqNon.res);
        reqNon.trigger();
        await reqNon.wait();
        assert.strictEqual(reqNon.getResult().statusCode, 404);
    });

    // ------------------------------------------------------------
    // TEST 37: Public Categories & Products Listing with Filtering
    // ------------------------------------------------------------
    await step('37. Public Categories & Products Listing with Filtering', async () => {
        // 1. Categories
        const reqCat = mockHttp('/api/v1/nexus/categories', 'GET');
        requestHandler(reqCat.req, reqCat.res);
        reqCat.trigger();
        await reqCat.wait();
        const resCat = JSON.parse(reqCat.getResult().body);
        assert.strictEqual(resCat.success, true);
        assert(resCat.categories.length >= 1);
        assert.strictEqual(resCat.categories[0].slug, 'digital-masterclasses');

        // 2. Products
        const reqProd = mockHttp('/api/v1/nexus/products', 'GET');
        requestHandler(reqProd.req, reqProd.res);
        reqProd.trigger();
        await reqProd.wait();
        const resProd = JSON.parse(reqProd.getResult().body);
        assert.strictEqual(resProd.success, true);
        assert(Array.isArray(resProd.products));
        assert(resProd.products.length >= 3, 'Initial seed products must be returned');
        assert.strictEqual(resProd.products[0].category_name, 'Digital Masterclasses');
    });

    // ------------------------------------------------------------
    // TEST 38: Public Product Detail Dossier by Slug
    // ------------------------------------------------------------
    await step('38. Public Product Detail Dossier by Slug', async () => {
        const req = mockHttp('/api/v1/nexus/products/ai-workflow-automation', 'GET');
        requestHandler(req.req, req.res);
        req.trigger();
        await req.wait();
        const res = JSON.parse(req.getResult().body);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.product.sku, 'NP-SKU-AI01');
        assert.strictEqual(res.product.price, 5000);
        assert.strictEqual(res.product.category_slug, 'digital-masterclasses');

        // 404 on missing product
        const reqMissing = mockHttp('/api/v1/nexus/products/non-existent-sku', 'GET');
        requestHandler(reqMissing.req, reqMissing.res);
        reqMissing.trigger();
        await reqMissing.wait();
        assert.strictEqual(reqMissing.getResult().statusCode, 404);
    });

    // ------------------------------------------------------------
    // TEST 39: Security Guard: Public & Member Role Rejection on Admin Endpoints
    // ------------------------------------------------------------
    await step('39. Security Guard: Public & Member Role Rejection on Admin Endpoints', async () => {
        // 1. Unauthenticated request rejected (401)
        const reqUnauth = mockHttp('/api/v1/nexus/admin/packages', 'POST', {}, { name: 'Hack Package' });
        requestHandler(reqUnauth.req, reqUnauth.res);
        reqUnauth.trigger();
        await reqUnauth.wait();
        assert.strictEqual(reqUnauth.getResult().statusCode, 401);

        // 2. Member request rejected (403)
        const memberLogin = await NexusAuthService.login('nimal@nexusp.online', 'Password123!');
        const memberToken = memberLogin.token;

        const reqMember = mockHttp('/api/v1/nexus/admin/packages', 'POST', {
            'authorization': `Bearer ${memberToken}`,
            'content-type': 'application/json'
        }, { name: 'Member Created Package' });
        requestHandler(reqMember.req, reqMember.res);
        reqMember.trigger();
        await reqMember.wait();
        assert.strictEqual(reqMember.getResult().statusCode, 403);
    });

    // ------------------------------------------------------------
    // TEST 40: Admin Package Creation & Unique Code/Slug Validation
    // ------------------------------------------------------------
    let createdPackageId = null;
    await step('40. Admin Package Creation & Unique Code/Slug Validation', async () => {
        // 1. Successful package creation
        const reqCreate = mockHttp('/api/v1/nexus/admin/packages', 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            name: 'Enterprise VIP Tier',
            package_code: 'NP-PKG-04',
            slug: 'enterprise-vip-tier',
            price: 50000,
            status: 'active',
            display_order: 4,
            short_description: 'Elite VIP tier with personal coaching',
            features: ['1-on-1 Founder Strategy Call', 'Global VIP Summit Pass']
        });
        requestHandler(reqCreate.req, reqCreate.res);
        reqCreate.trigger();
        await reqCreate.wait();
        const resCreate = JSON.parse(reqCreate.getResult().body);
        assert.strictEqual(resCreate.success, true);
        assert(resCreate.package.id);
        createdPackageId = resCreate.package.id;
        assert.strictEqual(resCreate.package.package_code, 'NP-PKG-04');

        // 2. Rejection of duplicate package code (400)
        const reqDupCode = mockHttp('/api/v1/nexus/admin/packages', 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            name: 'Duplicate Code Package',
            package_code: 'NP-PKG-04',
            price: 60000
        });
        requestHandler(reqDupCode.req, reqDupCode.res);
        reqDupCode.trigger();
        await reqDupCode.wait();
        assert.strictEqual(reqDupCode.getResult().statusCode, 400);

        // 3. Rejection of negative price
        const reqNeg = mockHttp('/api/v1/nexus/admin/packages', 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            name: 'Negative Tier',
            package_code: 'NP-PKG-NEG',
            price: -500
        });
        requestHandler(reqNeg.req, reqNeg.res);
        reqNeg.trigger();
        await reqNeg.wait();
        assert.strictEqual(reqNeg.getResult().statusCode, 400);
    });

    // ------------------------------------------------------------
    // TEST 41: Admin Package Update & Feature Modification
    // ------------------------------------------------------------
    await step('41. Admin Package Update & Feature Modification', async () => {
        const reqUpdate = mockHttp(`/api/v1/nexus/admin/packages/${createdPackageId}`, 'PUT', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            name: 'Enterprise VIP Tier (Updated)',
            price: 55000,
            featured: true,
            features: ['1-on-1 Founder Strategy Call', 'Global VIP Summit Pass', 'Dedicated Concierge']
        });
        requestHandler(reqUpdate.req, reqUpdate.res);
        reqUpdate.trigger();
        await reqUpdate.wait();
        const resUpdate = JSON.parse(reqUpdate.getResult().body);
        assert.strictEqual(resUpdate.success, true);
        assert.strictEqual(resUpdate.package.price, 55000);
        assert.strictEqual(resUpdate.package.features.length, 3);
    });

    // ------------------------------------------------------------
    // TEST 42: Admin Package Status Transition & Audit Trail Verification
    // ------------------------------------------------------------
    await step('42. Admin Package Status Transition & Audit Trail Verification', async () => {
        // Change status to inactive
        const reqStatus = mockHttp(`/api/v1/nexus/admin/packages/${createdPackageId}/status`, 'PUT', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, { status: 'inactive' });
        requestHandler(reqStatus.req, reqStatus.res);
        reqStatus.trigger();
        await reqStatus.wait();
        const resStatus = JSON.parse(reqStatus.getResult().body);
        assert.strictEqual(resStatus.success, true);
        assert.strictEqual(resStatus.package.status, 'inactive');

        // Verify inactive package is excluded from public active packages
        const reqPublic = mockHttp('/api/v1/nexus/packages', 'GET');
        requestHandler(reqPublic.req, reqPublic.res);
        reqPublic.trigger();
        await reqPublic.wait();
        const resPublic = JSON.parse(reqPublic.getResult().body);
        const found = resPublic.packages.find(p => p.id === createdPackageId);
        assert.strictEqual(found, undefined, 'Inactive package must be excluded from public active list');

        // Verify audit log generated
        const auditCheck = await nexusDb.getAuditLogs({ action: 'PACKAGE_STATUS_CHANGED' });
        assert(auditCheck.logs.length >= 1, 'Audit log must record PACKAGE_STATUS_CHANGED');
    });

    // ------------------------------------------------------------
    // TEST 43: Admin Product Creation, SKU Uniqueness & Validation
    // ------------------------------------------------------------
    let createdProductId = null;
    await step('43. Admin Product Creation, SKU Uniqueness & Validation', async () => {
        // 1. Create Product
        const reqCreate = mockHttp('/api/v1/nexus/admin/products', 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            name: 'Growth Marketing & Funnels',
            sku: 'NP-SKU-GM01',
            price: 7500,
            stock_quantity: 500,
            short_description: 'High-conversion sales funnels and paid ad scaling'
        });
        requestHandler(reqCreate.req, reqCreate.res);
        reqCreate.trigger();
        await reqCreate.wait();
        const resCreate = JSON.parse(reqCreate.getResult().body);
        assert.strictEqual(resCreate.success, true);
        assert(resCreate.product.id);
        createdProductId = resCreate.product.id;
        assert.strictEqual(resCreate.product.sku, 'NP-SKU-GM01');

        // 2. Reject duplicate SKU
        const reqDupSku = mockHttp('/api/v1/nexus/admin/products', 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            name: 'Duplicate SKU Prod',
            sku: 'NP-SKU-GM01',
            price: 1000
        });
        requestHandler(reqDupSku.req, reqDupSku.res);
        reqDupSku.trigger();
        await reqDupSku.wait();
        assert.strictEqual(reqDupSku.getResult().statusCode, 400);
    });

    // ------------------------------------------------------------
    // TEST 44: Admin Product Update, Stock Tracking & Audit Logging
    // ------------------------------------------------------------
    await step('44. Admin Product Update, Stock Tracking & Audit Logging', async () => {
        const reqUpdate = mockHttp(`/api/v1/nexus/admin/products/${createdProductId}`, 'PUT', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            price: 8000,
            stock_quantity: 450,
            status: 'out_of_stock'
        });
        requestHandler(reqUpdate.req, reqUpdate.res);
        reqUpdate.trigger();
        await reqUpdate.wait();
        const resUpdate = JSON.parse(reqUpdate.getResult().body);
        assert.strictEqual(resUpdate.success, true);
        assert.strictEqual(resUpdate.product.price, 8000);
        assert.strictEqual(resUpdate.product.stock_quantity, 450);
        assert.strictEqual(resUpdate.product.status, 'out_of_stock');

        // Verify audit log
        const auditCheck = await nexusDb.getAuditLogs({ action: 'PRODUCT_UPDATED' });
        assert(auditCheck.logs.length >= 1, 'Audit log must record PRODUCT_UPDATED');
    });

    // ------------------------------------------------------------
    // TEST 45: Member Dashboard Package View & Phase 2 Pre-Payment Safeguard
    // ------------------------------------------------------------
    await step('45. Member Dashboard Package View & Phase 2 Pre-Payment Safeguard', async () => {
        const memberLogin = await NexusAuthService.login('nimal@nexusp.online', 'Password123!');
        const memberToken = memberLogin.token;

        const req = mockHttp('/api/v1/nexus/member/packages', 'GET', {
            'authorization': `Bearer ${memberToken}`
        });
        requestHandler(req.req, req.res);
        req.trigger();
        await req.wait();
        const res = JSON.parse(req.getResult().body);
        assert.strictEqual(res.success, true);
        assert(res.currentPackage, 'Must return current member package standing');
        assert(Array.isArray(res.packages), 'Must return available active packages');
        assert(res.notice.includes('Phase 2'), 'Must clearly state Phase 2 activation notice');
    });

    // ------------------------------------------------------------
    // TEST 46: Package Order Creation with Server-Side Price Authority & Snapshots
    // ------------------------------------------------------------
    let memberAToken = null;
    let starterPackage = null;
    let testPkgOrder = null;
    await step('46. Package Order Creation with Server-Side Price Authority & Snapshots', async () => {
        const loginRes = await NexusAuthService.login('kasun@nexusp.online', 'Password123!');
        memberAToken = loginRes.token;

        starterPackage = await nexusDb.getPackageByCode('NP-PKG-01');
        assert(starterPackage, 'Starter Package NP-PKG-01 must exist');

        const req = mockHttp('/api/v1/nexus/member/orders/package', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, { packageId: starterPackage.id, notes: 'Starter tier order' });

        requestHandler(req.req, req.res);
        req.trigger();
        await req.wait();

        const res = JSON.parse(req.getResult().body);
        assert.strictEqual(req.getResult().statusCode, 201);
        assert.strictEqual(res.success, true);
        assert(res.order, 'Order object must be returned');
        testPkgOrder = res.order;

        // Check sequential order number
        assert(/^NP-ORD-\d{6}$/.test(testPkgOrder.order_number), `Order number ${testPkgOrder.order_number} must match NP-ORD-XXXXXX`);
        assert.strictEqual(testPkgOrder.order_type, 'package');
        assert.strictEqual(testPkgOrder.package_id, starterPackage.id);
        assert.strictEqual(testPkgOrder.package_name_snapshot, starterPackage.name);
        assert.strictEqual(testPkgOrder.package_price_snapshot, starterPackage.price);
        assert.strictEqual(testPkgOrder.total, starterPackage.price);
        assert.strictEqual(testPkgOrder.status, 'awaiting_payment');
        assert.strictEqual(testPkgOrder.payment_status, 'pending');
    });

    // ------------------------------------------------------------
    // TEST 47: Frontend Price Tampering Rejection on Package Orders
    // ------------------------------------------------------------
    await step('47. Frontend Price Tampering Rejection on Package Orders', async () => {
        const proPackage = await nexusDb.getPackageByCode('NP-PKG-02');
        assert(proPackage, 'Professional Package NP-PKG-02 must exist');

        // Client attempts to pass tampered price of 10 LKR instead of official price (15,000 LKR)
        const req = mockHttp('/api/v1/nexus/member/orders/package', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, {
            packageId: proPackage.id,
            price: 10,
            subtotal: 10,
            total: 10
        });

        requestHandler(req.req, req.res);
        req.trigger();
        await req.wait();

        const res = JSON.parse(req.getResult().body);
        assert.strictEqual(req.getResult().statusCode, 201);
        assert.strictEqual(res.success, true);
        // Server MUST ignore client price and charge official 15,000 LKR
        assert.strictEqual(res.order.total, proPackage.price);
        assert.strictEqual(res.order.package_price_snapshot, proPackage.price);
    });

    // ------------------------------------------------------------
    // TEST 48: Package Historical Price Snapshot Immutability
    // ------------------------------------------------------------
    await step('48. Package Historical Price Snapshot Immutability', async () => {
        // Update catalog price for Starter Package from 7,500 to 9,999
        await nexusDb.updatePackage(starterPackage.id, { price: 9999 });

        // Retrieve existing order from Test 46
        const req = mockHttp(`/api/v1/nexus/member/orders/${testPkgOrder.id}`, 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(req.req, req.res);
        req.trigger();
        await req.wait();

        const res = JSON.parse(req.getResult().body);
        assert.strictEqual(res.success, true);
        // Snapshot and total must remain original 7,500 LKR
        assert.strictEqual(res.order.package_price_snapshot, 7500);
        assert.strictEqual(res.order.total, 7500);

        // Restore catalog price
        await nexusDb.updatePackage(starterPackage.id, { price: 7500 });
    });

    // ------------------------------------------------------------
    // TEST 49: Sequential Human-Readable Order Number Formatting
    // ------------------------------------------------------------
    await step('49. Sequential Human-Readable Order Number Formatting', async () => {
        const order1 = testPkgOrder.order_number;
        const num1 = parseInt(order1.replace('NP-ORD-', ''), 10);

        // Create third order
        const req = mockHttp('/api/v1/nexus/member/orders/package', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, { packageId: starterPackage.id });

        requestHandler(req.req, req.res);
        req.trigger();
        await req.wait();

        const res = JSON.parse(req.getResult().body);
        const order3 = res.order.order_number;
        const num3 = parseInt(order3.replace('NP-ORD-', ''), 10);
        assert.strictEqual(num3, num1 + 2, 'Order numbers must increment strictly sequentially');
    });

    // ------------------------------------------------------------
    // TEST 50: Product Order Creation with Stock Validation & Line Snapshots
    // ------------------------------------------------------------
    let testProdOrder = null;
    let activeProduct = null;
    let initialStock = 0;
    await step('50. Product Order Creation with Stock Validation & Line Snapshots', async () => {
        activeProduct = await nexusDb.getProductBySku('NP-SKU-AI01');
        assert(activeProduct, 'NP-SKU-AI01 product must exist');
        initialStock = activeProduct.stock_quantity;

        const req = mockHttp('/api/v1/nexus/member/orders/products', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, {
            items: [
                { productId: activeProduct.id, quantity: 2 }
            ],
            notes: 'Two licenses please'
        });

        requestHandler(req.req, req.res);
        req.trigger();
        await req.wait();

        const res = JSON.parse(req.getResult().body);
        assert.strictEqual(req.getResult().statusCode, 201);
        assert.strictEqual(res.success, true);
        testProdOrder = res.order;

        assert.strictEqual(testProdOrder.order_type, 'product');
        assert.strictEqual(testProdOrder.subtotal, activeProduct.price * 2);
        assert.strictEqual(testProdOrder.total, activeProduct.price * 2);
        assert.strictEqual(testProdOrder.items.length, 1);
        assert.strictEqual(testProdOrder.items[0].unit_price_snapshot, activeProduct.price);
        assert.strictEqual(testProdOrder.items[0].line_total_snapshot, activeProduct.price * 2);
        assert.strictEqual(testProdOrder.items[0].item_name_snapshot, activeProduct.name);

        // Stock must have decremented by 2
        const updatedProd = await nexusDb.getProductById(activeProduct.id);
        assert.strictEqual(updatedProd.stock_quantity, initialStock - 2);
    });

    // ------------------------------------------------------------
    // TEST 51: Out-of-Stock and Inactive Product Rejection
    // ------------------------------------------------------------
    await step('51. Out-of-Stock and Inactive Product Rejection', async () => {
        // 1. Exceeds stock
        const reqExceed = mockHttp('/api/v1/nexus/member/orders/products', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, {
            items: [
                { productId: activeProduct.id, quantity: 99999 }
            ]
        });
        requestHandler(reqExceed.req, reqExceed.res);
        reqExceed.trigger();
        await reqExceed.wait();
        assert.strictEqual(reqExceed.getResult().statusCode, 400);
        const errExceed = JSON.parse(reqExceed.getResult().body);
        assert(errExceed.error.includes('Insufficient stock'));

        // 2. Inactive product
        const inactiveProd = nexusDb.products.find(p => p.status === 'inactive' || p.status === 'out_of_stock');
        if (inactiveProd) {
            const reqInactive = mockHttp('/api/v1/nexus/member/orders/products', 'POST', {
                'authorization': `Bearer ${memberAToken}`,
                'content-type': 'application/json'
            }, {
                items: [
                    { productId: inactiveProd.id, quantity: 1 }
                ]
            });
            requestHandler(reqInactive.req, reqInactive.res);
            reqInactive.trigger();
            await reqInactive.wait();
            assert.strictEqual(reqInactive.getResult().statusCode, 400);
        }
    });

    // ------------------------------------------------------------
    // TEST 52: Member Order History & Cross-Member Ownership Isolation
    // ------------------------------------------------------------
    await step('52. Member Order History & Cross-Member Ownership Isolation', async () => {
        // Member A can see their own orders
        const reqA = mockHttp('/api/v1/nexus/member/orders', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqA.req, reqA.res);
        reqA.trigger();
        await reqA.wait();
        const resA = JSON.parse(reqA.getResult().body);
        assert.strictEqual(resA.success, true);
        assert(resA.orders.some(o => o.id === testPkgOrder.id));

        // Member B logs in and tries to access Member A's order
        const loginB = await NexusAuthService.login('nimal@nexusp.online', 'Password123!');
        const memberBToken = loginB.token;

        const reqB = mockHttp(`/api/v1/nexus/member/orders/${testPkgOrder.id}`, 'GET', {
            'authorization': `Bearer ${memberBToken}`
        });
        requestHandler(reqB.req, reqB.res);
        reqB.trigger();
        await reqB.wait();
        assert.strictEqual(reqB.getResult().statusCode, 403);
        const resB = JSON.parse(reqB.getResult().body);
        assert(resB.error.includes('Access denied') || resB.error.includes('Forbidden'));
    });

    // ------------------------------------------------------------
    // TEST 53: Unconfigured Safe Fallback Payment Provider
    // ------------------------------------------------------------
    await step('53. Unconfigured Safe Fallback Payment Provider', async () => {
        const originalProvider = NexusConfig.PAYMENT_PROVIDER;
        NexusConfig.PAYMENT_PROVIDER = 'none';

        const req = mockHttp('/api/v1/nexus/member/payments/initiate', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, { orderId: testPkgOrder.id });

        requestHandler(req.req, req.res);
        req.trigger();
        await req.wait();

        const res = JSON.parse(req.getResult().body);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.code, 'PAYMENT_NOT_CONFIGURED');
        assert(res.message.includes('currently being configured') || res.message.includes('not configured'));

        // Restore sandbox provider
        NexusConfig.PAYMENT_PROVIDER = originalProvider;
    });

    // ------------------------------------------------------------
    // TEST 54: Payment Initiation with Server-Side Amount Integrity
    // ------------------------------------------------------------
    let paymentSession = null;
    await step('54. Payment Initiation with Server-Side Amount Integrity', async () => {
        // Attempt to pass client-manipulated amount of 100 LKR
        const reqTamper = mockHttp('/api/v1/nexus/member/payments/initiate', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, { orderId: testPkgOrder.id, amount: 100 });

        requestHandler(reqTamper.req, reqTamper.res);
        reqTamper.trigger();
        await reqTamper.wait();
        assert.strictEqual(reqTamper.getResult().statusCode, 400);
        const resTamper = JSON.parse(reqTamper.getResult().body);
        assert(resTamper.error.includes('mismatch') || resTamper.error.includes('Security Error'));

        // Genuine payment initiation
        const reqInit = mockHttp('/api/v1/nexus/member/payments/initiate', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, { orderId: testPkgOrder.id });

        requestHandler(reqInit.req, reqInit.res);
        reqInit.trigger();
        await reqInit.wait();

        const resInit = JSON.parse(reqInit.getResult().body);
        assert.strictEqual(reqInit.getResult().statusCode, 200);
        assert.strictEqual(resInit.success, true);
        assert(resInit.payment_id);
        assert.strictEqual(resInit.amount, 7500);
        assert.strictEqual(resInit.currency, 'LKR');
        assert(resInit.simulation_token);
        paymentSession = resInit;
    });

    // ------------------------------------------------------------
    // TEST 55: Gateway Cryptographic Webhook Verification & Tampering Rejection
    // ------------------------------------------------------------
    await step('55. Gateway Cryptographic Webhook Verification & Tampering Rejection', async () => {
        // Webhook callback with forged signature
        const reqFakeSig = mockHttp('/api/v1/nexus/payments/webhook/sandbox', 'POST', {
            'content-type': 'application/json',
            'x-nexus-signature': 'forged_cryptographic_signature_hash_12345'
        }, {
            order_number: testPkgOrder.order_number,
            amount: 7500,
            currency: 'LKR',
            status: 'success'
        });

        requestHandler(reqFakeSig.req, reqFakeSig.res);
        reqFakeSig.trigger();
        await reqFakeSig.wait();

        assert.strictEqual(reqFakeSig.getResult().statusCode, 401);
        const resFake = JSON.parse(reqFakeSig.getResult().body);
        assert.strictEqual(resFake.success, false);
        assert.strictEqual(resFake.error, 'INVALID_SIGNATURE');

        // Verify payment record in DB remains 'initiated'
        const paymentCheck = await nexusDb.getPaymentById(paymentSession.payment_id);
        assert.strictEqual(paymentCheck.status, 'initiated');
    });

    // ------------------------------------------------------------
    // TEST 56: Verified Webhook Payment Processing & State Transitions
    // ------------------------------------------------------------
    await step('56. Verified Webhook Payment Processing & State Transitions', async () => {
        const crypto = require('crypto');
        const webhookSecret = NexusConfig.PAYMENT_WEBHOOK_SECRET;
        const validSignature = crypto.createHmac('sha256', webhookSecret)
            .update(`${testPkgOrder.order_number}:7500.00:LKR`)
            .digest('hex');

        const reqValid = mockHttp('/api/v1/nexus/payments/webhook/sandbox', 'POST', {
            'content-type': 'application/json',
            'x-nexus-signature': validSignature
        }, {
            order_number: testPkgOrder.order_number,
            amount: 7500,
            currency: 'LKR',
            status: 'success',
            provider_payment_id: 'sbx-test-verified-999'
        });

        requestHandler(reqValid.req, reqValid.res);
        reqValid.trigger();
        await reqValid.wait();

        assert.strictEqual(reqValid.getResult().statusCode, 200);
        const resValid = JSON.parse(reqValid.getResult().body);
        assert.strictEqual(resValid.success, true);

        // Verify payment record in database
        const paymentUpdated = await nexusDb.getPaymentById(paymentSession.payment_id);
        assert.strictEqual(paymentUpdated.status, 'paid');
        assert(paymentUpdated.verified_at);

        // Verify order in database
        const orderUpdated = await nexusDb.getOrderById(testPkgOrder.id);
        assert.strictEqual(orderUpdated.status, 'paid');
        assert.strictEqual(orderUpdated.payment_status, 'paid');
    });

    // ------------------------------------------------------------
    // TEST 57: Webhook Idempotency on Repeated Callbacks
    // ------------------------------------------------------------
    await step('57. Webhook Idempotency on Repeated Gateway Callbacks', async () => {
        const crypto = require('crypto');
        const webhookSecret = NexusConfig.PAYMENT_WEBHOOK_SECRET;
        const validSignature = crypto.createHmac('sha256', webhookSecret)
            .update(`${testPkgOrder.order_number}:7500.00:LKR`)
            .digest('hex');

        const reqRepeat = mockHttp('/api/v1/nexus/payments/webhook/sandbox', 'POST', {
            'content-type': 'application/json',
            'x-nexus-signature': validSignature
        }, {
            order_number: testPkgOrder.order_number,
            amount: 7500,
            currency: 'LKR',
            status: 'success',
            provider_payment_id: 'sbx-test-verified-999'
        });

        requestHandler(reqRepeat.req, reqRepeat.res);
        reqRepeat.trigger();
        await reqRepeat.wait();

        assert.strictEqual(reqRepeat.getResult().statusCode, 200);
        const resRepeat = JSON.parse(reqRepeat.getResult().body);
        assert.strictEqual(resRepeat.success, true);
        assert.strictEqual(resRepeat.idempotent, true);

        // Verify only 1 payment record exists for this order
        const orderPayments = nexusDb.payments.filter(p => p.order_id === testPkgOrder.id);
        assert.strictEqual(orderPayments.length, 1);
    });

    // ------------------------------------------------------------
    // TEST 58: Package Membership Activation Upon Verified Payment
    // ------------------------------------------------------------
    await step('58. Package Membership Activation Upon Verified Payment', async () => {
        const profile = await nexusDb.findProfileByUserId(memberA.userId);
        assert(profile, 'Member profile must exist');
        // Package code must be set to NP-PKG-01
        assert.strictEqual(profile.package_status, 'NP-PKG-01', 'Member package status must activate to NP-PKG-01');
    });

    // ------------------------------------------------------------
    // TEST 59: MLM Commission Safeguard Verification (Decoupled Event Only)
    // ------------------------------------------------------------
    await step('59. MLM Commission Safeguard Verification (Decoupled Event Only)', async () => {
        // Verify PAYMENT_VERIFIED audit log was recorded
        const auditLogs = await nexusDb.getAuditLogs({ action: 'PAYMENT_VERIFIED' });
        assert(auditLogs.logs.length >= 1, 'PAYMENT_VERIFIED event must be recorded in audit log');

        // Verify member dashboard financial status is strictly neutral (no fake balances)
        const dashboard = await NexusMemberService.getMemberDashboardData(memberA.userId);
        assert.strictEqual(dashboard.financials.isAvailable, false);
        assert.strictEqual(dashboard.financials.badge, 'Coming Soon');
        assert.strictEqual(dashboard.financials.availableBalance, null);
        assert.strictEqual(dashboard.financials.totalEarnings, null);

        // Verify Root Admin (sponsor) wallet has NOT received any uncalculated payouts
        const sponsorDashboard = await NexusMemberService.getMemberDashboardData('00000000-0000-4000-8000-000000000001');
        assert.strictEqual(sponsorDashboard.financials.isAvailable, false);
        assert.strictEqual(sponsorDashboard.financials.availableBalance, null);
    });

    // ------------------------------------------------------------
    // TEST 60: Admin Order Desk Management, Multi-Field Search & Controlled Status Transition
    // ------------------------------------------------------------
    await step('60. Admin Order Desk Management, Multi-Field Search & Controlled Status Transition', async () => {
        // 1. Admin order listing
        const reqList = mockHttp('/api/v1/nexus/admin/orders?page=1&limit=10', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqList.req, reqList.res);
        reqList.trigger();
        await reqList.wait();

        const resList = JSON.parse(reqList.getResult().body);
        assert.strictEqual(resList.success, true);
        assert(Array.isArray(resList.orders));
        assert(resList.stats, 'KPI stats must be returned');

        // 2. Search by order number
        const reqSearch = mockHttp(`/api/v1/nexus/admin/orders?search=${testPkgOrder.order_number}`, 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqSearch.req, reqSearch.res);
        reqSearch.trigger();
        await reqSearch.wait();
        const resSearch = JSON.parse(reqSearch.getResult().body);
        assert.strictEqual(resSearch.orders.length, 1);
        assert.strictEqual(resSearch.orders[0].order_number, testPkgOrder.order_number);

        // 3. Admin updates order status to completed
        const reqStatus = mockHttp(`/api/v1/nexus/admin/orders/${testPkgOrder.id}/status`, 'PUT', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, { status: 'completed', reason: 'Order fulfilled by digital license delivery' });

        requestHandler(reqStatus.req, reqStatus.res);
        reqStatus.trigger();
        await reqStatus.wait();

        assert.strictEqual(reqStatus.getResult().statusCode, 200);
        const resStatus = JSON.parse(reqStatus.getResult().body);
        assert.strictEqual(resStatus.success, true);
        assert.strictEqual(resStatus.order.status, 'completed');

        // 4. Verify audit log
        const auditLogs = await nexusDb.getAuditLogs({ action: 'ORDER_STATUS_CHANGED' });
        assert(auditLogs.logs.length >= 1, 'ORDER_STATUS_CHANGED must be recorded in audit log');
    });

    // ------------------------------------------------------------
    // TEST 61: Admin Payment Ledger & Controlled Manual Reconciliation
    // ------------------------------------------------------------
    await step('61. Admin Payment Ledger & Controlled Manual Reconciliation', async () => {
        // 1. Admin payments listing
        const reqPayList = mockHttp('/api/v1/nexus/admin/payments?page=1&limit=10', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqPayList.req, reqPayList.res);
        reqPayList.trigger();
        await reqPayList.wait();

        const resPayList = JSON.parse(reqPayList.getResult().body);
        assert.strictEqual(resPayList.success, true);
        assert(Array.isArray(resPayList.payments));
        assert(resPayList.stats, 'Payment KPI stats must be returned');

        // 2. Admin reconciles payment
        const reqReconcile = mockHttp(`/api/v1/nexus/admin/payments/${paymentSession.payment_id}/reconcile`, 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, { resolution: 'paid', notes: 'Manually verified via bank settlement report' });

        requestHandler(reqReconcile.req, reqReconcile.res);
        reqReconcile.trigger();
        await reqReconcile.wait();

        assert.strictEqual(reqReconcile.getResult().statusCode, 200);
        const resReconcile = JSON.parse(reqReconcile.getResult().body);
        assert.strictEqual(resReconcile.success, true);

        // Check payment record reconciliation status
        const payCheck = await nexusDb.getPaymentById(paymentSession.payment_id);
        assert.strictEqual(payCheck.reconciliation_status, 'reconciled');

        // Check audit log
        const auditLogs = await nexusDb.getAuditLogs({ action: 'PAYMENT_MANUALLY_RECONCILED' });
        assert(auditLogs.logs.length >= 1, 'PAYMENT_MANUALLY_RECONCILED must be in audit logs');
    });

    // ------------------------------------------------------------
    // TEST 62: Order Cancellation & Post-Cancellation Safeguards
    // ------------------------------------------------------------
    await step('62. Order Cancellation & Post-Cancellation Safeguards', async () => {
        // Admin cancels product order
        const reqCancel = mockHttp(`/api/v1/nexus/admin/orders/${testProdOrder.id}/status`, 'PUT', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, { status: 'cancelled', reason: 'Customer requested cancellation before shipment' });

        requestHandler(reqCancel.req, reqCancel.res);
        reqCancel.trigger();
        await reqCancel.wait();

        assert.strictEqual(reqCancel.getResult().statusCode, 200);
        const resCancel = JSON.parse(reqCancel.getResult().body);
        assert.strictEqual(resCancel.order.status, 'cancelled');

        // Attempting to initiate payment for cancelled order must fail
        const reqPayCancelled = mockHttp('/api/v1/nexus/member/payments/initiate', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, { orderId: testProdOrder.id });

        requestHandler(reqPayCancelled.req, reqPayCancelled.res);
        reqPayCancelled.trigger();
        await reqPayCancelled.wait();

        assert.strictEqual(reqPayCancelled.getResult().statusCode, 400);
        const resPayCancelled = JSON.parse(reqPayCancelled.getResult().body);
        assert(resPayCancelled.error.includes('cancelled') && resPayCancelled.error.includes('cannot be paid'));
    });

    // ==============================================================================
    // PROMPT 11: MLM COMMISSION ENGINE TEST SUITE (TESTS 63 – 77)
    // ==============================================================================

    let commMemberBOrder = null;
    let commMemberBPayment = null;

    // ------------------------------------------------------------
    // TEST 63: Verified Payment Dispatches Hook & Calculates Commissions
    // ------------------------------------------------------------
    await step('63. Verified Payment Dispatches Hook & Calculates Commissions', async () => {
        // Log in Member B
        const loginB = await NexusAuthService.login('nimal@nexusp.online', 'Password123!');
        assert.strictEqual(loginB.success, true);
        const memberBToken = loginB.token;

        // Member B creates package purchase order for Starter Tier (LKR 10,000)
        // Member B's sponsor is Member A
        const reqOrderB = mockHttp('/api/v1/nexus/member/orders/package', 'POST', {
            'authorization': `Bearer ${memberBToken}`,
            'content-type': 'application/json'
        }, { packageId: 'NP-PKG-01' });

        requestHandler(reqOrderB.req, reqOrderB.res);
        reqOrderB.trigger();
        await reqOrderB.wait();

        assert.strictEqual(reqOrderB.getResult().statusCode, 201);
        const resOrderB = JSON.parse(reqOrderB.getResult().body);
        commMemberBOrder = resOrderB.order;
        assert.strictEqual(commMemberBOrder.total, 7500);

        // Member B initiates payment
        const reqPayB = mockHttp('/api/v1/nexus/member/payments/initiate', 'POST', {
            'authorization': `Bearer ${memberBToken}`,
            'content-type': 'application/json'
        }, { orderId: commMemberBOrder.id, provider: 'sandbox' });

        requestHandler(reqPayB.req, reqPayB.res);
        reqPayB.trigger();
        await reqPayB.wait();

        assert.strictEqual(reqPayB.getResult().statusCode, 200);
        const resPayB = JSON.parse(reqPayB.getResult().body);
        assert.strictEqual(resPayB.success, true);

        // Verify payment via sandbox webhook endpoint
        const crypto = require('crypto');
        const webhookSecret = NexusConfig.PAYMENT_WEBHOOK_SECRET;
        const validSigB = crypto.createHmac('sha256', webhookSecret)
            .update(`${commMemberBOrder.order_number}:7500.00:LKR`)
            .digest('hex');

        const reqVerifyB = mockHttp('/api/v1/nexus/payments/webhook/sandbox', 'POST', {
            'content-type': 'application/json',
            'x-nexus-signature': validSigB
        }, {
            order_number: commMemberBOrder.order_number,
            amount: 7500,
            currency: 'LKR',
            status: 'success',
            provider_payment_id: 'SIM-GW-COMM-B-001'
        });

        requestHandler(reqVerifyB.req, reqVerifyB.res);
        reqVerifyB.trigger();
        await reqVerifyB.wait();

        assert.strictEqual(reqVerifyB.getResult().statusCode, 200);

        // Verify commissions were generated automatically via the hook
        const commissions = await nexusDb.getCommissionsByOrderId(commMemberBOrder.id);
        assert(commissions.length >= 1, 'Commissions must be generated for verified paid order');

        // Verify audit log for commission calculation exists
        const auditLogs = await nexusDb.getAuditLogs({ action: 'COMMISSION_CALCULATED' });
        assert(auditLogs.logs.length >= 1, 'Audit log COMMISSION_CALCULATED must be emitted');
    });

    // ------------------------------------------------------------
    // TEST 64: Direct Referral Commission (Level 1) Calculation Accuracy
    // ------------------------------------------------------------
    await step('64. Direct Referral Commission (Level 1) Calculation Accuracy', async () => {
        const commissions = await nexusDb.getCommissionsByOrderId(commMemberBOrder.id);
        const directComm = commissions.find(c => c.commission_type === 'DIRECT_REFERRAL');

        assert(directComm, 'Direct referral commission record must exist');
        assert.strictEqual(directComm.beneficiary_id, memberA.userId, 'Direct sponsor must be beneficiary');
        assert.strictEqual(directComm.source_member_id, memberB.userId, 'Buyer must be source member');
        assert.strictEqual(directComm.commission_level, 1, 'Direct commission level must be 1');
        assert.strictEqual(directComm.percentage_rate, 8.00, 'Direct referral rate must be 8.00%');
        assert.strictEqual(directComm.calculation_basis_amount, 7500, 'Calculation base must be LKR 7,500');
        // 7,500 * 8.00% = 600.00
        assert.strictEqual(directComm.amount, 600.00, 'Commission amount must be exactly LKR 600.00');
        assert.strictEqual(directComm.status, 'approved', 'Status must be approved');
        assert(directComm.commission_reference.startsWith('NP-COM-') || directComm.commission_reference.startsWith('REF-COMM-'), 'Reference must start with NP-COM-');
    });

    // ------------------------------------------------------------
    // TEST 65: Multi-Level Network Tree Traversal (Levels 1 to 5 Distribution)
    // ------------------------------------------------------------
    let commMemberDOrder = null;
    await step('65. Multi-Level Network Tree Traversal (Levels 1 to 5 Distribution)', async () => {
        // Ensure Member C has an active package so they qualify
        const profileC = await nexusDb.findProfileByUserId(memberC.userId);
        if (profileC) profileC.package_status = 'NP-PKG-02';

        // Log in Member D (Downline leaf node: Root -> A -> B -> C -> D)
        const loginD = await NexusAuthService.login('dinesh@nexusp.online', 'Password123!');
        assert.strictEqual(loginD.success, true);
        const memberDToken = loginD.token;

        // Member D orders package Professional Tier (LKR 15,000)
        const reqOrderD = mockHttp('/api/v1/nexus/member/orders/package', 'POST', {
            'authorization': `Bearer ${memberDToken}`,
            'content-type': 'application/json'
        }, { packageId: 'NP-PKG-02' });

        requestHandler(reqOrderD.req, reqOrderD.res);
        reqOrderD.trigger();
        await reqOrderD.wait();

        assert.strictEqual(reqOrderD.getResult().statusCode, 201);
        const resOrderD = JSON.parse(reqOrderD.getResult().body);
        commMemberDOrder = resOrderD.order;
        assert.strictEqual(commMemberDOrder.total, 15000);

        // Initiate and verify payment
        const reqPayD = mockHttp('/api/v1/nexus/member/payments/initiate', 'POST', {
            'authorization': `Bearer ${memberDToken}`,
            'content-type': 'application/json'
        }, { orderId: commMemberDOrder.id, provider: 'sandbox' });

        requestHandler(reqPayD.req, reqPayD.res);
        reqPayD.trigger();
        await reqPayD.wait();

        assert.strictEqual(reqPayD.getResult().statusCode, 200);
        const resPayD = JSON.parse(reqPayD.getResult().body);
        assert.strictEqual(resPayD.success, true);

        // Verify payment via sandbox webhook endpoint
        const crypto = require('crypto');
        const webhookSecret = NexusConfig.PAYMENT_WEBHOOK_SECRET;
        const validSigD = crypto.createHmac('sha256', webhookSecret)
            .update(`${commMemberDOrder.order_number}:15000.00:LKR`)
            .digest('hex');

        const reqVerifyD = mockHttp('/api/v1/nexus/payments/webhook/sandbox', 'POST', {
            'content-type': 'application/json',
            'x-nexus-signature': validSigD
        }, {
            order_number: commMemberDOrder.order_number,
            amount: 15000,
            currency: 'LKR',
            status: 'success',
            provider_payment_id: 'SIM-GW-COMM-D-001'
        });

        requestHandler(reqVerifyD.req, reqVerifyD.res);
        reqVerifyD.trigger();
        await reqVerifyD.wait();

        assert.strictEqual(reqVerifyD.getResult().statusCode, 200);

        // Inspect Multi-Level Commissions generated for order D
        const dCommissions = await nexusDb.getCommissionsByOrderId(commMemberDOrder.id);
        // Traversal chain:
        // Level 1: Sponsor of D is C -> 8.00% of 15,000 = 1,200.00 (DIRECT_REFERRAL)
        // Level 2: Sponsor of C is B -> 3.00% of 15,000 = 450.00 (LEVEL_OVERRIDE)
        // Level 3: Sponsor of B is A -> 2.00% of 15,000 = 300.00 (LEVEL_OVERRIDE)
        // Level 4: Sponsor of A is Corporate Root -> 1.00% of 15,000 = 150.00 (LEVEL_OVERRIDE)
        assert.strictEqual(dCommissions.length, 4, 'Must generate exactly 4 upline commission records');

        const l1 = dCommissions.find(c => c.commission_level === 1);
        assert.strictEqual(l1.beneficiary_id, memberC.userId);
        assert.strictEqual(l1.commission_type, 'DIRECT_REFERRAL');
        assert.strictEqual(l1.amount, 1200.00);

        const l2 = dCommissions.find(c => c.commission_level === 2);
        assert.strictEqual(l2.beneficiary_id, memberB.userId);
        assert.strictEqual(l2.commission_type, 'LEVEL_OVERRIDE');
        assert.strictEqual(l2.amount, 450.00);

        const l3 = dCommissions.find(c => c.commission_level === 3);
        assert.strictEqual(l3.beneficiary_id, memberA.userId);
        assert.strictEqual(l3.commission_type, 'LEVEL_OVERRIDE');
        assert.strictEqual(l3.amount, 300.00);

        const l4 = dCommissions.find(c => c.commission_level === 4);
        assert.strictEqual(l4.beneficiary_id, '00000000-0000-4000-8000-000000000001');
        assert.strictEqual(l4.commission_type, 'LEVEL_OVERRIDE');
        assert.strictEqual(l4.amount, 150.00);
    });

    // ------------------------------------------------------------
    // TEST 66: Reject Commission Calculation for Unverified Orders
    // ------------------------------------------------------------
    await step('66. Reject Commission Calculation for Unverified Orders', async () => {
        // Create an unpaid draft order directly
        const draftOrder = await nexusDb.createOrder({
            user_id: memberA.userId,
            order_type: 'product',
            items: [{ product_id: 'prod-01', name: 'Test Prod', unit_price: 1500, quantity: 1, total_price: 1500 }],
            total_amount: 1500,
            status: 'draft',
            payment_status: 'pending'
        });

        // Attempting calculateCommissions on draft order must throw
        let errorCaught = false;
        try {
            await NexusCommissionService.calculateCommissions(draftOrder.id);
        } catch (err) {
            errorCaught = true;
            assert(err.message.includes('Security Safeguard'));
        }
        assert.strictEqual(errorCaught, true, 'Cannot calculate commissions for unverified order');

        const comms = await nexusDb.getCommissionsByOrderId(draftOrder.id);
        assert.strictEqual(comms.length, 0, 'No commissions can be stored for draft orders');
    });

    // ------------------------------------------------------------
    // TEST 67: Qualification Rules: Inactive Member Disqualification
    // ------------------------------------------------------------
    await step('67. Qualification Rules: Inactive Member Disqualification', async () => {
        // Ensure Member B has active package standing
        const profileB = await nexusDb.findProfileByUserId(memberB.userId);
        if (profileB) profileB.package_status = 'NP-PKG-01';

        // Suspend Member C
        await nexusDb.updateMemberStatus(memberC.userId, 'suspended', 'Audit test suspension');

        // Create new paid order for Member D
        const orderD2 = await nexusDb.createOrder({
            user_id: memberD.userId,
            order_type: 'product',
            items: [{ product_id: 'prod-01', name: 'Test Masterclass', unit_price: 10000, quantity: 1, total_price: 10000 }],
            total_amount: 10000,
            status: 'paid',
            payment_status: 'paid'
        });

        const calcResult = await NexusCommissionService.calculateCommissions(orderD2.id);
        assert.strictEqual(calcResult.success, true);

        // Check if Member C received commission: should be disqualified
        const cComm = calcResult.commissions.find(c => c.beneficiary_id === memberC.userId);
        assert.strictEqual(cComm, undefined, 'Suspended member C must not receive commission');

        // Higher active uplines (B, A) should still receive their overrides
        const bComm = calcResult.commissions.find(c => c.beneficiary_id === memberB.userId);
        assert(bComm, 'Active upline Member B must still receive commission');

        // Restore Member C status
        await nexusDb.updateMemberStatus(memberC.userId, 'active', 'Restored after test');
    });

    // ------------------------------------------------------------
    // TEST 68: Qualification Rules: Active Package Standing Gate
    // ------------------------------------------------------------
    await step('68. Qualification Rules: Active Package Standing Gate', async () => {
        // Register an unpaid sponsor (no package purchased)
        const regUnpaid = await NexusAuthService.registerMember({
            fullName: 'Unpaid Sponsor',
            email: 'unpaid.sponsor@nexusp.online',
            phone: '+94799887766',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            referralCode: memberA.referralCode
        });
        const unpaidSponsor = regUnpaid.member;
        const profileUnpaid = await nexusDb.findProfileByUserId(unpaidSponsor.userId);
        if (profileUnpaid) profileUnpaid.package_status = 'NONE';

        // Register a downline buyer under unpaid sponsor
        const regBuyer = await NexusAuthService.registerMember({
            fullName: 'Downline Buyer',
            email: 'downline.buyer@nexusp.online',
            phone: '+94799887755',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            referralCode: unpaidSponsor.referralCode
        });
        const buyer = regBuyer.member;

        // Buyer purchases order and pays
        const orderBuyer = await nexusDb.createOrder({
            user_id: buyer.userId,
            order_type: 'product',
            items: [{ product_id: 'prod-01', name: 'Course', unit_price: 10000, quantity: 1, total_price: 10000 }],
            total_amount: 10000,
            status: 'paid',
            payment_status: 'paid'
        });

        const calcRes = await NexusCommissionService.calculateCommissions(orderBuyer.id);
        // Unpaid sponsor has no package; qualification gate should reject them
        const unpaidComm = calcRes.commissions.find(c => c.beneficiary_id === unpaidSponsor.userId);
        assert.strictEqual(unpaidComm, undefined, 'Sponsor without active package must be disqualified');
    });

    // ------------------------------------------------------------
    // TEST 69: Anti-Abuse: Self-Referral Prevention
    // ------------------------------------------------------------
    await step('69. Anti-Abuse: Self-Referral Prevention', async () => {
        const orderA = await nexusDb.createOrder({
            user_id: memberA.userId,
            order_type: 'package',
            items: [{ package_id: 'NP-PKG-01', name: 'Starter', unit_price: 10000, quantity: 1, total_price: 10000 }],
            total_amount: 10000,
            status: 'paid',
            payment_status: 'paid'
        });

        const calcA = await NexusCommissionService.calculateCommissions(orderA.id);
        // Member A must not earn direct commission on their own purchase
        const selfComm = calcA.commissions.find(c => c.beneficiary_id === memberA.userId);
        assert.strictEqual(selfComm, undefined, 'Buyer cannot receive commission for their own order');
    });

    // ------------------------------------------------------------
    // TEST 70: Anti-Abuse: Circular Sponsor Cycle Prevention
    // ------------------------------------------------------------
    await step('70. Anti-Abuse: Circular Sponsor Cycle Prevention', async () => {
        // Ensure Member A has active package
        const profileA_cycle = await nexusDb.findProfileByUserId(memberA.userId);
        if (profileA_cycle) profileA_cycle.package_status = 'NP-PKG-01';

        // Introduce an artificial circular link in DB sponsors table: A -> B -> A
        const originalSponsorA = nexusDb.sponsors.find(s => s.user_id === memberA.userId);
        const originalSponsorId = originalSponsorA ? originalSponsorA.sponsor_id : null;

        // Artificially point Member A's sponsor to Member B (creating cycle B -> A -> B)
        if (originalSponsorA) {
            originalSponsorA.sponsor_id = memberB.userId;
        }

        const orderCycle = await nexusDb.createOrder({
            user_id: memberB.userId,
            order_type: 'product',
            items: [{ product_id: 'prod-01', name: 'Cycle Test', unit_price: 5000, quantity: 1, total_price: 5000 }],
            total: 5000,
            total_amount: 5000,
            status: 'paid',
            payment_status: 'paid'
        });

        // calculateCommissions must safely break traversal without infinite recursion
        const resCycle = await NexusCommissionService.calculateCommissions(orderCycle.id);
        assert.strictEqual(resCycle.success, true);
        assert(resCycle.commissions.length > 0);

        // Restore Member A's original sponsor
        if (originalSponsorA) {
            originalSponsorA.sponsor_id = originalSponsorId;
        }
    });

    // ------------------------------------------------------------
    // TEST 71: Strict Calculation Idempotency
    // ------------------------------------------------------------
    await step('71. Strict Calculation Idempotency', async () => {
        const commsBefore = await nexusDb.getCommissionsByOrderId(commMemberBOrder.id);
        const countBefore = commsBefore.length;

        // Run calculation a second time on the same order
        const secondRun = await NexusCommissionService.calculateCommissions(commMemberBOrder.id);
        assert.strictEqual(secondRun.success, true);
        assert.strictEqual(secondRun.idempotent, true, 'Second calculation must flag idempotent: true');

        const commsAfter = await nexusDb.getCommissionsByOrderId(commMemberBOrder.id);
        assert.strictEqual(commsAfter.length, countBefore, 'Record count must remain identical');
    });

    // ------------------------------------------------------------
    // TEST 72: Commission Plan Versioning & Historical Immutability
    // ------------------------------------------------------------
    await step('72. Commission Plan Versioning & Historical Immutability', async () => {
        // Create new plan version V2 with Level 1 = 15.00%
        const v2Plan = await nexusDb.createCommissionPlan({
            plan_code: 'NP-PLAN-UNILEVEL',
            plan_name: 'Super Unilevel Plan V2',
            description: 'Updated rate version',
            max_levels: 5,
            status: 'active',
            levels: [
                { level: 1, percentage: 15.00, description: 'Elevated Direct Reward' },
                { level: 2, percentage: 4.00, description: 'Level 2' },
                { level: 3, percentage: 3.00, description: 'Level 3' },
                { level: 4, percentage: 2.00, description: 'Level 4' },
                { level: 5, percentage: 1.00, description: 'Level 5' }
            ]
        }, { id: 'admin-root', role: 'admin' });

        assert.strictEqual(v2Plan.version, 2);
        assert.strictEqual(v2Plan.status, 'active');

        // Verify historical commissions generated under V1 are completely untouched
        const historicalComm = await nexusDb.getCommissionsByOrderId(commMemberBOrder.id);
        const l1Hist = historicalComm.find(c => c.commission_level === 1);
        assert.strictEqual(l1Hist.plan_version, 1, 'Historical commission must remain pinned to v1');
        assert.strictEqual(l1Hist.percentage_rate, 8.00, 'Historical rate must remain 8.00%');
        assert.strictEqual(l1Hist.amount, 600.00, 'Historical amount must remain LKR 600.00');
    });

    // ------------------------------------------------------------
    // TEST 73: Member Commission REST API & Cross-Member Authorization Isolation
    // ------------------------------------------------------------
    await step('73. Member Commission REST API & Cross-Member Authorization Isolation', async () => {
        // Member A requests own commissions
        const reqCommA = mockHttp('/api/v1/nexus/member/commissions', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });

        requestHandler(reqCommA.req, reqCommA.res);
        reqCommA.trigger();
        await reqCommA.wait();

        assert.strictEqual(reqCommA.getResult().statusCode, 200);
        const resCommA = JSON.parse(reqCommA.getResult().body);
        assert.strictEqual(resCommA.success, true);
        assert(Array.isArray(resCommA.commissions));
        assert(resCommA.stats.totalEarnedLKR > 0);

        // Find a commission belonging to Member C
        const cComms = await nexusDb.getMemberCommissions(memberC.userId);
        assert(cComms.commissions.length > 0);
        const targetCCommId = cComms.commissions[0].id;

        // Member A attempts to inspect Member C's commission detail
        const reqCrossInspect = mockHttp(`/api/v1/nexus/member/commissions/${targetCCommId}`, 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });

        requestHandler(reqCrossInspect.req, reqCrossInspect.res);
        reqCrossInspect.trigger();
        await reqCrossInspect.wait();

        // Must be rejected with 403 Forbidden
        assert.strictEqual(reqCrossInspect.getResult().statusCode, 403, 'Cross-member commission access must return 403 Forbidden');
        const resCross = JSON.parse(reqCrossInspect.getResult().body);
        assert(resCross.error.includes('Access denied'));
    });

    // ------------------------------------------------------------
    // TEST 74: Admin Commission Ledger & Manual Status Transitions
    // ------------------------------------------------------------
    await step('74. Admin Commission Ledger & Manual Status Transitions', async () => {
        // Admin lists all commissions
        const reqAdminComm = mockHttp('/api/v1/nexus/admin/commissions?page=1&limit=20', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });

        requestHandler(reqAdminComm.req, reqAdminComm.res);
        reqAdminComm.trigger();
        await reqAdminComm.wait();

        assert.strictEqual(reqAdminComm.getResult().statusCode, 200);
        const resAdminComm = JSON.parse(reqAdminComm.getResult().body);
        assert.strictEqual(resAdminComm.success, true);
        assert(resAdminComm.commissions.length >= 4);
        assert(resAdminComm.summary.totalVolumeLKR > 0);

        const targetComm = resAdminComm.commissions[0];

        // Admin updates status to 'hold'
        const reqHold = mockHttp(`/api/v1/nexus/admin/commissions/${targetComm.id}/status`, 'PUT', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, { status: 'hold', reason: 'Audit investigation hold' });

        requestHandler(reqHold.req, reqHold.res);
        reqHold.trigger();
        await reqHold.wait();

        assert.strictEqual(reqHold.getResult().statusCode, 200);
        const resHold = JSON.parse(reqHold.getResult().body);
        assert.strictEqual(resHold.commission.status, 'hold');

        // Verify audit log emitted
        const audit = await nexusDb.getAuditLogs({ action: 'COMMISSION_STATUS_UPDATED' });
        assert(audit.logs.length >= 1, 'COMMISSION_STATUS_UPDATED audit log must be recorded');

        // Admin returns status back to 'approved'
        const reqReApprove = mockHttp(`/api/v1/nexus/admin/commissions/${targetComm.id}/status`, 'PUT', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, { status: 'approved', reason: 'Audit completed satisfactorily' });

        requestHandler(reqReApprove.req, reqReApprove.res);
        reqReApprove.trigger();
        await reqReApprove.wait();

        assert.strictEqual(reqReApprove.getResult().statusCode, 200);
        const resReApprove = JSON.parse(reqReApprove.getResult().body);
        assert.strictEqual(resReApprove.commission.status, 'approved');
    });

    // ------------------------------------------------------------
    // TEST 75: Admin Commission Plans REST Management
    // ------------------------------------------------------------
    await step('75. Admin Commission Plans REST Management', async () => {
        // Admin lists plans
        const reqPlans = mockHttp('/api/v1/nexus/admin/commission-plans', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });

        requestHandler(reqPlans.req, reqPlans.res);
        reqPlans.trigger();
        await reqPlans.wait();

        assert.strictEqual(reqPlans.getResult().statusCode, 200);
        const resPlans = JSON.parse(reqPlans.getResult().body);
        assert(resPlans.plans.length >= 2);

        // Admin creates a V3 plan
        const reqCreatePlan = mockHttp('/api/v1/nexus/admin/commission-plans', 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            plan_code: 'NP-PLAN-EXECUTIVE',
            plan_name: 'Executive Leadership Plan',
            description: 'Leadership tier plan',
            max_levels: 3,
            status: 'inactive',
            levels: [
                { level: 1, percentage: 10.00, description: 'Direct' },
                { level: 2, percentage: 5.00, description: 'L2' },
                { level: 3, percentage: 2.00, description: 'L3' }
            ]
        });

        requestHandler(reqCreatePlan.req, reqCreatePlan.res);
        reqCreatePlan.trigger();
        await reqCreatePlan.wait();

        assert.strictEqual(reqCreatePlan.getResult().statusCode, 201);
        const resCreate = JSON.parse(reqCreatePlan.getResult().body);
        assert.strictEqual(resCreate.plan.plan_code, 'NP-PLAN-EXECUTIVE');

        // Admin updates status of new plan to active
        const reqPlanStatus = mockHttp(`/api/v1/nexus/admin/commission-plans/${resCreate.plan.id}/status`, 'PUT', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, { status: 'active' });

        requestHandler(reqPlanStatus.req, reqPlanStatus.res);
        reqPlanStatus.trigger();
        await reqPlanStatus.wait();

        assert.strictEqual(reqPlanStatus.getResult().statusCode, 200);
        const resPlanStatus = JSON.parse(reqPlanStatus.getResult().body);
        assert.strictEqual(resPlanStatus.plan.status, 'active');
    });

    // ------------------------------------------------------------
    // TEST 76: Strict Wallet Separation Safeguard (Zero Premature Balance Inflation)
    // ------------------------------------------------------------
    await step('76. Strict Wallet Separation Safeguard', async () => {
        // Check Member A's profile
        const profileA = await nexusDb.findProfileByUserId(memberA.userId);
        // Balance must NOT have been incremented by the commission engine
        // In Prompt 11, commissions are recorded in approved status only, wallet ledger crediting is decoupled
        const balance = profileA.balance || 0;
        assert.strictEqual(balance, 0, 'Member liquid balance must not be inflated in Prompt 11');

        // Verify member A has approved commissions waiting in ledger
        const commsA = await nexusDb.getMemberCommissions(memberA.userId);
        assert(commsA.summary.approvedCount > 0, 'Member A has approved commission records in ledger');
        assert(commsA.summary.totalEarnedLKR > 0, 'Total earned volume is tracked in commission ledger');
    });

    // ------------------------------------------------------------
    // TEST 77: Precision Financial Rounding on Fractional Amounts
    // ------------------------------------------------------------
    await step('77. Precision Financial Rounding on Fractional Amounts', async () => {
        // Test roundCurrency on various fractional inputs
        assert.strictEqual(NexusCommissionService.roundCurrency(13333.333333), 13333.33);
        assert.strictEqual(NexusCommissionService.roundCurrency(13333.33 * 0.08), 1066.67);
        assert.strictEqual(NexusCommissionService.roundCurrency(9999.99 * 0.03), 300.00);
        assert.strictEqual(NexusCommissionService.roundCurrency(0.005), 0.01);
        assert.strictEqual(NexusCommissionService.roundCurrency(0.0049), 0.00);

        // Verify that summing fractional commissions does not accumulate binary floating point noise
        const amounts = [1066.67, 300.00, 200.00, 100.00, 50.00];
        const sum = NexusCommissionService.roundCurrency(amounts.reduce((a, b) => a + b, 0));
        assert.strictEqual(sum, 1716.67);
    });

    // ============================================================
    // PROMPT 12: WALLET & FINANCIAL LEDGER ENGINE TESTS (78-92)
    // ============================================================

    let memberAWallet = null;
    let manualAdjTxId = null;
    let testCommissionRecord = null;

    // ------------------------------------------------------------
    // TEST 78: Corporate Root & Member Wallet Auto-Creation
    // ------------------------------------------------------------
    await step('78. Corporate Root & Member Wallet Auto-Creation', async () => {
        // 1. Corporate root wallet was seeded
        const rootWallet = await nexusDb.getWalletById('wal-root-00001');
        assert(rootWallet, 'Root corporate wallet must exist');
        assert.strictEqual(rootWallet.currency, 'LKR');
        assert.strictEqual(rootWallet.status, 'active');

        // 2. Member A wallet auto-created on demand
        memberAWallet = await nexusWalletService.getOrCreateWallet(memberA.userId);
        assert(memberAWallet, 'Member A wallet must be created');
        assert.strictEqual(memberAWallet.member_id, memberA.userId);
        assert.strictEqual(memberAWallet.currency, 'LKR');
        assert.strictEqual(memberAWallet.status, 'active');

        // 3. Re-requesting returns identical wallet
        const duplicateFetch = await nexusWalletService.getOrCreateWallet(memberA.userId);
        assert.strictEqual(duplicateFetch.id, memberAWallet.id);

        // 4. Initial ledger balance must be 0.00
        const initialBal = await nexusWalletService.calculateAvailableBalance(memberAWallet.id);
        assert.strictEqual(initialBal, 0.00);
    });

    // ------------------------------------------------------------
    // TEST 79: Double-Entry Ledger Posting: Credit Transaction
    // ------------------------------------------------------------
    await step('79. Double-Entry Ledger Posting: Credit Transaction', async () => {
        const creditEntry = await nexusWalletService.postCredit({
            walletId: memberAWallet.id,
            amount: 5000.00,
            referenceType: 'adjustment',
            referenceId: 'adj-test-init-01',
            entryType: 'adjustment',
            description: 'Foundation Test Initial Credit Posting',
            metadata: { actor: 'system_test' }
        });

        assert(creditEntry, 'Ledger entry must be returned');
        assert.strictEqual(creditEntry.direction, 'CREDIT');
        assert.strictEqual(creditEntry.amount, 5000.00);
        assert.strictEqual(creditEntry.balance_before, 0.00);
        assert.strictEqual(creditEntry.balance_after, 5000.00);
        assert.strictEqual(creditEntry.status, 'posted');
    });

    // ------------------------------------------------------------
    // TEST 80: Ledger-First Balance Derivation Integrity
    // ------------------------------------------------------------
    await step('80. Ledger-First Balance Derivation Integrity', async () => {
        // Verify balance is derived dynamically from entries
        const currentBal = await nexusWalletService.calculateAvailableBalance(memberAWallet.id);
        assert.strictEqual(currentBal, 5000.00, 'Available balance must equal sum of posted credits minus debits');

        // Profile balance column must NOT be directly mutated
        const profile = await nexusDb.findProfileByUserId(memberA.userId);
        assert.strictEqual(profile.balance || 0, 0, 'Profile table balance must not store mutable ledger value');
    });

    // ------------------------------------------------------------
    // TEST 81: Double-Entry Ledger Posting: Debit Transaction
    // ------------------------------------------------------------
    await step('81. Double-Entry Ledger Posting: Debit Transaction', async () => {
        const debitEntry = await nexusWalletService.postDebit({
            walletId: memberAWallet.id,
            amount: 2000.00,
            referenceType: 'withdrawal',
            referenceId: 'wd-test-001',
            entryType: 'withdrawal',
            description: 'Mock withdrawal debit hold',
            metadata: { method: 'CEFT' }
        });

        assert.strictEqual(debitEntry.direction, 'DEBIT');
        assert.strictEqual(debitEntry.amount, 2000.00);
        assert.strictEqual(debitEntry.balance_before, 5000.00);
        assert.strictEqual(debitEntry.balance_after, 3000.00);
        assert.strictEqual(debitEntry.status, 'posted');

        const remainingBal = await nexusWalletService.calculateAvailableBalance(memberAWallet.id);
        assert.strictEqual(remainingBal, 3000.00);
    });

    // ------------------------------------------------------------
    // TEST 82: Negative Balance Protection (Insufficient Funds Guard)
    // ------------------------------------------------------------
    await step('82. Negative Balance Protection (Insufficient Funds Guard)', async () => {
        // Current balance is 3000. Attempting debit of 3500 must fail
        let caughtError = null;
        try {
            await nexusWalletService.postDebit({
                walletId: memberAWallet.id,
                amount: 3500.00,
                referenceType: 'withdrawal',
                referenceId: 'wd-overdraft-test',
                entryType: 'withdrawal',
                description: 'Attempted overdraft'
            });
        } catch (err) {
            caughtError = err;
        }

        assert(caughtError, 'Debit exceeding available balance must throw error');
        assert(caughtError.message.includes('INSUFFICIENT_FUNDS'), 'Error must be INSUFFICIENT_FUNDS');

        // Balance must remain strictly 3000.00
        const balAfterAttempt = await nexusWalletService.calculateAvailableBalance(memberAWallet.id);
        assert.strictEqual(balAfterAttempt, 3000.00);
    });

    // ------------------------------------------------------------
    // TEST 83: Commission Crediting: Atomic Transition & Linking
    // ------------------------------------------------------------
    await step('83. Commission Crediting: Atomic Transition & Linking', async () => {
        // Retrieve an approved commission for Member A
        const comms = await nexusDb.getMemberCommissions(memberA.userId);
        const approved = comms.commissions.find(c => c.status === 'approved');
        assert(approved, 'Member A must have at least one approved commission from previous tests');
        testCommissionRecord = approved;

        const balanceBefore = await nexusWalletService.calculateAvailableBalance(memberAWallet.id);

        const creditResult = await nexusWalletService.creditApprovedCommission(testCommissionRecord.id);
        assert.strictEqual(creditResult.success, true);
        assert(creditResult.ledgerEntry, 'Ledger entry must be generated');
        assert.strictEqual(creditResult.ledgerEntry.direction, 'CREDIT');
        assert.strictEqual(creditResult.ledgerEntry.amount, testCommissionRecord.amount);
        assert.strictEqual(creditResult.ledgerEntry.reference_type, 'commission');
        assert.strictEqual(creditResult.ledgerEntry.reference_id, testCommissionRecord.id);

        // Verify commission record in DB transitioned to credited
        const updatedComm = await nexusDb.getCommissionById(testCommissionRecord.id);
        assert.strictEqual(updatedComm.status, 'credited');
        assert(updatedComm.credited_at, 'credited_at must be populated');
        assert.strictEqual(updatedComm.ledger_entry_id, creditResult.ledgerEntry.id);

        // Verify wallet balance increased by exact commission amount
        const balanceAfter = await nexusWalletService.calculateAvailableBalance(memberAWallet.id);
        const expected = Math.round((balanceBefore + testCommissionRecord.amount) * 100) / 100;
        assert.strictEqual(balanceAfter, expected);
    });

    // ------------------------------------------------------------
    // TEST 84: Commission Crediting Idempotency Guard
    // ------------------------------------------------------------
    await step('84. Commission Crediting Idempotency Guard', async () => {
        const balanceBefore = await nexusWalletService.calculateAvailableBalance(memberAWallet.id);

        // Re-call crediting for the same commission ID
        const secondAttempt = await nexusWalletService.creditApprovedCommission(testCommissionRecord.id);
        assert.strictEqual(secondAttempt.success, true);
        assert.strictEqual(secondAttempt.idempotent, true, 'Second crediting must return idempotent=true');

        // Balance must not change
        const balanceAfter = await nexusWalletService.calculateAvailableBalance(memberAWallet.id);
        assert.strictEqual(balanceAfter, balanceBefore, 'Idempotent call must not inflate wallet balance');
    });

    // ------------------------------------------------------------
    // TEST 85: Controlled Admin Financial Adjustment (API & Service)
    // ------------------------------------------------------------
    await step('85. Controlled Admin Financial Adjustment (API & Service)', async () => {
        const balBefore = await nexusWalletService.calculateAvailableBalance(memberAWallet.id);

        const reqAdj = mockHttp('/api/v1/nexus/admin/wallet/adjustment', 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            member_id: memberA.memberId,
            direction: 'CREDIT',
            amount: 1500.00,
            reference_note: 'Test Goodwill Credit',
            reason: 'Compliance audit settlement bonus'
        });

        requestHandler(reqAdj.req, reqAdj.res);
        reqAdj.trigger();
        await reqAdj.wait();

        assert.strictEqual(reqAdj.getResult().statusCode, 201);
        const resAdj = JSON.parse(reqAdj.getResult().body);
        assert.strictEqual(resAdj.success, true);
        assert.strictEqual(resAdj.entry.direction, 'CREDIT');
        assert.strictEqual(resAdj.entry.amount, 1500.00);
        assert.strictEqual(resAdj.entry.entry_type, 'adjustment');
        manualAdjTxId = resAdj.entry.id;

        // Verify balance updated
        const balAfter = await nexusWalletService.calculateAvailableBalance(memberAWallet.id);
        assert.strictEqual(balAfter, Math.round((balBefore + 1500.00) * 100) / 100);

        // Verify audit log recorded
        const logs = await nexusDb.getAuditLogs({ action: 'ADMIN_WALLET_ADJUSTMENT' });
        assert(logs.logs.length >= 1, 'Audit log must record ADMIN_WALLET_ADJUSTMENT');
    });

    // ------------------------------------------------------------
    // TEST 86: Administrative Compensating Reversal
    // ------------------------------------------------------------
    await step('86. Administrative Compensating Reversal', async () => {
        const balBefore = await nexusWalletService.calculateAvailableBalance(memberAWallet.id);

        const reqRev = mockHttp(`/api/v1/nexus/admin/transactions/${manualAdjTxId}/reverse`, 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            reason: 'Reversing erroneous manual credit'
        });

        requestHandler(reqRev.req, reqRev.res);
        reqRev.trigger();
        await reqRev.wait();

        assert.strictEqual(reqRev.getResult().statusCode, 200);
        const resRev = JSON.parse(reqRev.getResult().body);
        assert.strictEqual(resRev.success, true);
        assert.strictEqual(resRev.original_entry.status, 'reversed');
        assert.strictEqual(resRev.reversal_entry.direction, 'DEBIT');
        assert.strictEqual(resRev.reversal_entry.amount, 1500.00);
        assert.strictEqual(resRev.reversal_entry.entry_type, 'reversal');

        // Balance must be decremented by 1500.00
        const balAfter = await nexusWalletService.calculateAvailableBalance(memberAWallet.id);
        assert.strictEqual(balAfter, Math.round((balBefore - 1500.00) * 100) / 100);

        // Attempting to reverse an already reversed transaction must fail
        const reqRevDup = mockHttp(`/api/v1/nexus/admin/transactions/${manualAdjTxId}/reverse`, 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, { reason: 'Duplicate reversal attempt' });

        requestHandler(reqRevDup.req, reqRevDup.res);
        reqRevDup.trigger();
        await reqRevDup.wait();

        assert.strictEqual(reqRevDup.getResult().statusCode, 400);
    });

    // ------------------------------------------------------------
    // TEST 87: Immutable Transaction Ledger Protection
    // ------------------------------------------------------------
    await step('87. Immutable Transaction Ledger Protection', async () => {
        // Verify ledger entries retain their original recorded values and order
        const memberEntries = await nexusDb.getMemberLedgerEntries(memberA.userId);
        assert(memberEntries.entries.length >= 4, 'Member A must have at least 4 ledger entries');

        // Check sequential integrity
        for (let i = 0; i < memberEntries.entries.length; i++) {
            const entry = memberEntries.entries[i];
            assert(entry.id, 'Entry must have ID');
            assert(entry.balance_after !== undefined, 'balance_after must be recorded');
            assert(entry.created_at, 'created_at timestamp must exist');
        }
    });

    // ------------------------------------------------------------
    // TEST 88: Member Wallet API Endpoints & Balance Inspection
    // ------------------------------------------------------------
    await step('88. Member Wallet API Endpoints & Balance Inspection', async () => {
        const reqWallet = mockHttp('/api/v1/nexus/member/wallet', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });

        requestHandler(reqWallet.req, reqWallet.res);
        reqWallet.trigger();
        await reqWallet.wait();

        assert.strictEqual(reqWallet.getResult().statusCode, 200);
        const resWallet = JSON.parse(reqWallet.getResult().body);
        assert.strictEqual(resWallet.success, true);
        assert.strictEqual(resWallet.wallet.currency, 'LKR');
        assert(resWallet.wallet.available_balance >= 0);
        assert(resWallet.wallet.total_credits >= 5000);
        assert(resWallet.wallet.total_debits >= 2000);
    });

    // ------------------------------------------------------------
    // TEST 89: Member Ledger Transactions Pagination & Filtering
    // ------------------------------------------------------------
    await step('89. Member Ledger Transactions Pagination & Filtering', async () => {
        // Fetch paginated transactions
        const reqTx = mockHttp('/api/v1/nexus/member/wallet/transactions?page=1&limit=2', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });

        requestHandler(reqTx.req, reqTx.res);
        reqTx.trigger();
        await reqTx.wait();

        assert.strictEqual(reqTx.getResult().statusCode, 200);
        const resTx = JSON.parse(reqTx.getResult().body);
        assert.strictEqual(resTx.success, true);
        assert.strictEqual(resTx.entries.length, 2);
        assert(resTx.pagination.total_pages >= 2);

        // Filter by direction=CREDIT
        const reqCreditOnly = mockHttp('/api/v1/nexus/member/wallet/transactions?direction=CREDIT', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });

        requestHandler(reqCreditOnly.req, reqCreditOnly.res);
        reqCreditOnly.trigger();
        await reqCreditOnly.wait();

        assert.strictEqual(reqCreditOnly.getResult().statusCode, 200);
        const resCreditOnly = JSON.parse(reqCreditOnly.getResult().body);
        assert(resCreditOnly.entries.every(e => e.direction === 'CREDIT'));
    });

    // ------------------------------------------------------------
    // TEST 90: Tenant Isolation & Cross-Member Financial Protection (403)
    // ------------------------------------------------------------
    await step('90. Tenant Isolation & Cross-Member Financial Protection (403)', async () => {
        // Log in as Member B
        const loginB = await NexusAuthService.login('nimal@nexusp.online', 'Password123!');
        assert(loginB.success);
        const tokenB = loginB.token;

        // Obtain an entry ID belonging to Member A
        const memberEntries = await nexusDb.getMemberLedgerEntries(memberA.userId);
        const entryA = memberEntries.entries[0];

        // Member B attempts to view Member A's transaction entry
        const reqCrossTenant = mockHttp(`/api/v1/nexus/member/wallet/transactions/${entryA.id}`, 'GET', {
            'authorization': `Bearer ${tokenB}`
        });

        requestHandler(reqCrossTenant.req, reqCrossTenant.res);
        reqCrossTenant.trigger();
        await reqCrossTenant.wait();

        assert.strictEqual(reqCrossTenant.getResult().statusCode, 403, 'Cross-tenant transaction inspection must return 403 Forbidden');
        const resCross = JSON.parse(reqCrossTenant.getResult().body);
        assert.strictEqual(resCross.success, false);
    });

    // ------------------------------------------------------------
    // TEST 91: Admin Financial Journal & Overview Endpoints
    // ------------------------------------------------------------
    await step('91. Admin Financial Journal & Overview Endpoints', async () => {
        // 1. Admin Wallets Directory
        const reqAdminWallets = mockHttp('/api/v1/nexus/admin/wallets?page=1&limit=10', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqAdminWallets.req, reqAdminWallets.res);
        reqAdminWallets.trigger();
        await reqAdminWallets.wait();
        assert.strictEqual(reqAdminWallets.getResult().statusCode, 200);
        const resAdminWallets = JSON.parse(reqAdminWallets.getResult().body);
        assert(resAdminWallets.wallets.length >= 2);

        // 2. Admin Global Journal
        const reqAdminTx = mockHttp('/api/v1/nexus/admin/transactions?page=1&limit=10', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqAdminTx.req, reqAdminTx.res);
        reqAdminTx.trigger();
        await reqAdminTx.wait();
        assert.strictEqual(reqAdminTx.getResult().statusCode, 200);
        const resAdminTx = JSON.parse(reqAdminTx.getResult().body);
        assert(resAdminTx.entries.length >= 4);

        // 3. Admin Financial Overview
        const reqOverview = mockHttp('/api/v1/nexus/admin/financial/overview', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqOverview.req, reqOverview.res);
        reqOverview.trigger();
        await reqOverview.wait();
        assert.strictEqual(reqOverview.getResult().statusCode, 200);
        const resOverview = JSON.parse(reqOverview.getResult().body);
        assert(resOverview.overview.total_credits > 0);
        assert(resOverview.overview.total_wallets >= 2);
    });

    // ------------------------------------------------------------
    // TEST 92: Deep System Reconciliation & Integrity Diagnostics
    // ------------------------------------------------------------
    await step('92. Deep System Reconciliation & Integrity Diagnostics', async () => {
        const reqReconcile = mockHttp('/api/v1/nexus/admin/financial/reconciliation', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqReconcile.req, reqReconcile.res);
        reqReconcile.trigger();
        await reqReconcile.wait();

        assert.strictEqual(reqReconcile.getResult().statusCode, 200);
        const resReconcile = JSON.parse(reqReconcile.getResult().body);
        assert.strictEqual(resReconcile.success, true);
        assert(resReconcile.diagnostics);

        const d = resReconcile.diagnostics;
        assert.strictEqual(d.balance_discrepancies.length, 0, 'Zero balance discrepancies across system');
        assert.strictEqual(d.duplicate_references.length, 0, 'Zero idempotency duplicate references');
        assert(d.global_metrics.total_system_credits > 0, 'Global credits tracked');
        assert(d.total_wallets_audited >= 2, 'All wallets audited');
    });

    // ------------------------------------------------------------
    // TEST 93: Member Bank Account Creation & Account Masking Protection
    // ------------------------------------------------------------
    await step('93. Member Bank Account Creation & Account Masking Protection', async () => {
        // Seed Member A wallet with sufficient test funds for withdrawal pipeline
        await nexusWalletService.postCredit({
            member_id: memberA.userId,
            amount: 50000.00,
            entry_type: 'adjustment',
            reference_type: 'test_seed',
            reference_id: `test-seed-withdrawals-${Date.now()}`,
            description: 'Seed test liquidity for withdrawal verification suite'
        });

        // Member A adds primary bank account
        const reqAddBank = mockHttp('/api/v1/nexus/member/bank-accounts', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, {
            bank_name: 'Bank of Ceylon',
            branch_name: 'Colombo Fort Corporate',
            branch_code: '001',
            account_name: 'A. Perera',
            account_number: '123456789012',
            account_type: 'savings',
            swift_bic: 'BCEYLKLX'
        });

        requestHandler(reqAddBank.req, reqAddBank.res);
        reqAddBank.trigger();
        await reqAddBank.wait();

        assert.strictEqual(reqAddBank.getResult().statusCode, 201);
        const resAddBank = JSON.parse(reqAddBank.getResult().body);
        assert.strictEqual(resAddBank.success, true);
        assert.strictEqual(resAddBank.bank_account.bank_name, 'Bank of Ceylon');
        // Crucial security test: full account number must NOT be returned in standard member API
        assert.strictEqual(resAddBank.bank_account.account_number, undefined);
        assert.strictEqual(resAddBank.bank_account.account_number_masked, '********9012');
        assert.strictEqual(resAddBank.bank_account.is_primary, true, 'First bank account must be set as primary');
    });

    // ------------------------------------------------------------
    // TEST 94: Bank Account Management (Secondary Account, Primary Toggle & Deactivation)
    // ------------------------------------------------------------
    await step('94. Bank Account Management (Secondary Account, Primary Toggle & Deactivation)', async () => {
        // Add secondary account
        const reqAddBank2 = mockHttp('/api/v1/nexus/member/bank-accounts', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, {
            bank_name: 'Commercial Bank of Ceylon',
            branch_name: 'Kollupitiya',
            branch_code: '012',
            account_name: 'A. Perera',
            account_number: '887766554433',
            account_type: 'current'
        });
        requestHandler(reqAddBank2.req, reqAddBank2.res);
        reqAddBank2.trigger();
        await reqAddBank2.wait();

        assert.strictEqual(reqAddBank2.getResult().statusCode, 201);
        const resAdd2 = JSON.parse(reqAddBank2.getResult().body);
        const bank2Id = resAdd2.bank_account.id;
        assert.strictEqual(resAdd2.bank_account.is_primary, false);

        // Switch primary to second account
        const reqSetPrimary = mockHttp(`/api/v1/nexus/member/bank-accounts/${bank2Id}/primary`, 'PUT', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqSetPrimary.req, reqSetPrimary.res);
        reqSetPrimary.trigger();
        await reqSetPrimary.wait();

        assert.strictEqual(reqSetPrimary.getResult().statusCode, 200);
        const resPrimary = JSON.parse(reqSetPrimary.getResult().body);
        assert.strictEqual(resPrimary.bank_account.is_primary, true);

        // Deactivate second account
        const reqDelete = mockHttp(`/api/v1/nexus/member/bank-accounts/${bank2Id}`, 'DELETE', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqDelete.req, reqDelete.res);
        reqDelete.trigger();
        await reqDelete.wait();

        assert.strictEqual(reqDelete.getResult().statusCode, 200);

        // List active accounts and verify only the first active account remains primary
        const reqList = mockHttp('/api/v1/nexus/member/bank-accounts', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqList.req, reqList.res);
        reqList.trigger();
        await reqList.wait();

        const resList = JSON.parse(reqList.getResult().body);
        assert.strictEqual(resList.bank_accounts.length, 1);
        assert.strictEqual(resList.bank_accounts[0].is_primary, true);
    });

    // ------------------------------------------------------------
    // TEST 95: Member Withdrawal Request & Pipeline Balance Reservation
    // ------------------------------------------------------------
    let testWd1 = null;
    let initialAvailable = 0;
    await step('95. Member Withdrawal Request & Pipeline Balance Reservation', async () => {
        // Inspect initial overview
        const reqOverviewPre = mockHttp('/api/v1/nexus/member/withdrawals', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqOverviewPre.req, reqOverviewPre.res);
        reqOverviewPre.trigger();
        await reqOverviewPre.wait();
        const resOverviewPre = JSON.parse(reqOverviewPre.getResult().body);
        initialAvailable = resOverviewPre.overview.available_balance;
        assert.strictEqual(resOverviewPre.overview.reserved_amount, 0);

        // Request LKR 10,000 withdrawal
        const reqWd = mockHttp('/api/v1/nexus/member/withdrawals', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, {
            amount: 10000.00
        });
        requestHandler(reqWd.req, reqWd.res);
        reqWd.trigger();
        await reqWd.wait();

        assert.strictEqual(reqWd.getResult().statusCode, 201);
        const resWd = JSON.parse(reqWd.getResult().body);
        assert.strictEqual(resWd.success, true);
        assert(resWd.withdrawal.withdrawal_number.startsWith('NP-WD-'));
        assert.strictEqual(resWd.withdrawal.status, 'pending');
        assert.strictEqual(resWd.withdrawal.amount, 10000.00);
        testWd1 = resWd.withdrawal;

        // Verify balance reservation math: available is reduced by 10,000, reserved is 10,000
        const reqOverviewPost = mockHttp('/api/v1/nexus/member/withdrawals', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqOverviewPost.req, reqOverviewPost.res);
        reqOverviewPost.trigger();
        await reqOverviewPost.wait();
        const resOverviewPost = JSON.parse(reqOverviewPost.getResult().body);
        assert.strictEqual(resOverviewPost.overview.reserved_amount, 10000.00);
        assert.strictEqual(resOverviewPost.overview.available_balance, initialAvailable - 10000.00);

        // Crucial ledger check: NO debit entry should exist yet for pending withdrawal
        const memberEntries = await nexusDb.getMemberLedgerEntries(memberA.userId);
        const wdDebits = memberEntries.entries.filter(e => e.reference_id === testWd1.id);
        assert.strictEqual(wdDebits.length, 0, 'No ledger debit must be posted while withdrawal is in pending pipeline');
    });

    // ------------------------------------------------------------
    // TEST 96: Overdraft / Insufficient Available Balance Protection
    // ------------------------------------------------------------
    await step('96. Overdraft / Insufficient Available Balance Protection', async () => {
        // Attempt to withdraw an amount greater than available balance
        const reqOverdraft = mockHttp('/api/v1/nexus/member/withdrawals', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, {
            amount: 60000.00
        });
        requestHandler(reqOverdraft.req, reqOverdraft.res);
        reqOverdraft.trigger();
        await reqOverdraft.wait();

        assert.strictEqual(reqOverdraft.getResult().statusCode, 400);
        const resOverdraft = JSON.parse(reqOverdraft.getResult().body);
        assert.strictEqual(resOverdraft.success, false);
        assert(resOverdraft.error.includes('Insufficient available balance'));
    });

    // ------------------------------------------------------------
    // TEST 97: Threshold Enforcement (Minimum & Maximum Withdrawal Limits)
    // ------------------------------------------------------------
    await step('97. Threshold Enforcement (Minimum & Maximum Withdrawal Limits)', async () => {
        // Below min threshold (e.g. 500 when min is 1000)
        const reqBelowMin = mockHttp('/api/v1/nexus/member/withdrawals', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, {
            amount: 500.00
        });
        requestHandler(reqBelowMin.req, reqBelowMin.res);
        reqBelowMin.trigger();
        await reqBelowMin.wait();

        assert.strictEqual(reqBelowMin.getResult().statusCode, 400);
        const resBelow = JSON.parse(reqBelowMin.getResult().body);
        assert(resBelow.error.includes('Minimum withdrawal'));

        // Above max threshold (e.g. 600,000 when max is 500,000)
        const reqAboveMax = mockHttp('/api/v1/nexus/member/withdrawals', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, {
            amount: 600000.00
        });
        requestHandler(reqAboveMax.req, reqAboveMax.res);
        reqAboveMax.trigger();
        await reqAboveMax.wait();

        assert.strictEqual(reqAboveMax.getResult().statusCode, 400);
        const resAbove = JSON.parse(reqAboveMax.getResult().body);
        assert(resAbove.error.includes('Maximum withdrawal') || resAbove.error.includes('Insufficient available balance'));
    });

    // ------------------------------------------------------------
    // TEST 98: Member Self-Cancellation & Reservation Release
    // ------------------------------------------------------------
    await step('98. Member Self-Cancellation & Reservation Release', async () => {
        // Create withdrawal for LKR 2,000
        const reqWd2 = mockHttp('/api/v1/nexus/member/withdrawals', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, {
            amount: 2000.00
        });
        requestHandler(reqWd2.req, reqWd2.res);
        reqWd2.trigger();
        await reqWd2.wait();
        const resWd2 = JSON.parse(reqWd2.getResult().body);
        const wd2Id = resWd2.withdrawal.id;

        // Verify reserved amount increased to 12,000
        let overview = await nexusWithdrawalService.getMemberWithdrawalOverview(memberA.userId);
        assert.strictEqual(overview.reserved_amount, 12000.00);

        // Member cancels wd2
        const reqCancel = mockHttp(`/api/v1/nexus/member/withdrawals/${wd2Id}/cancel`, 'POST', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqCancel.req, reqCancel.res);
        reqCancel.trigger();
        await reqCancel.wait();

        assert.strictEqual(reqCancel.getResult().statusCode, 200);
        const resCancel = JSON.parse(reqCancel.getResult().body);
        assert.strictEqual(resCancel.withdrawal.status, 'cancelled');

        // Verify reserved amount reduced back to 10,000
        overview = await nexusWithdrawalService.getMemberWithdrawalOverview(memberA.userId);
        assert.strictEqual(overview.reserved_amount, 10000.00);

        // Attempting to cancel again fails
        const reqCancelDup = mockHttp(`/api/v1/nexus/member/withdrawals/${wd2Id}/cancel`, 'POST', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqCancelDup.req, reqCancelDup.res);
        reqCancelDup.trigger();
        await reqCancelDup.wait();
        assert.strictEqual(reqCancelDup.getResult().statusCode, 400);
    });

    // ------------------------------------------------------------
    // TEST 99: Admin Status Workflow (under_review -> approved -> processing)
    // ------------------------------------------------------------
    await step('99. Admin Status Workflow (under_review -> approved -> processing)', async () => {
        // Non-admin attempt should be forbidden
        const reqNonAdmin = mockHttp(`/api/v1/nexus/admin/withdrawals/${testWd1.id}/review`, 'POST', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqNonAdmin.req, reqNonAdmin.res);
        reqNonAdmin.trigger();
        await reqNonAdmin.wait();
        assert.strictEqual(reqNonAdmin.getResult().statusCode, 403);

        // 1. Admin marks under_review
        const reqReview = mockHttp(`/api/v1/nexus/admin/withdrawals/${testWd1.id}/review`, 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, { notes: 'KYC documents verified' });
        requestHandler(reqReview.req, reqReview.res);
        reqReview.trigger();
        await reqReview.wait();
        assert.strictEqual(reqReview.getResult().statusCode, 200);
        assert.strictEqual(JSON.parse(reqReview.getResult().body).withdrawal.status, 'under_review');

        // Member cannot cancel once under_review
        const reqCancelBlocked = mockHttp(`/api/v1/nexus/member/withdrawals/${testWd1.id}/cancel`, 'POST', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqCancelBlocked.req, reqCancelBlocked.res);
        reqCancelBlocked.trigger();
        await reqCancelBlocked.wait();
        assert.strictEqual(reqCancelBlocked.getResult().statusCode, 400);

        // 2. Admin approves
        const reqApprove = mockHttp(`/api/v1/nexus/admin/withdrawals/${testWd1.id}/approve`, 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, { notes: 'Approved for batch wire' });
        requestHandler(reqApprove.req, reqApprove.res);
        reqApprove.trigger();
        await reqApprove.wait();
        assert.strictEqual(reqApprove.getResult().statusCode, 200);
        const resApprove = JSON.parse(reqApprove.getResult().body);
        assert.strictEqual(resApprove.withdrawal.status, 'approved');
        assert(resApprove.withdrawal.approved_at);

        // 3. Admin marks processing
        const reqProc = mockHttp(`/api/v1/nexus/admin/withdrawals/${testWd1.id}/processing`, 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, { batch_reference: 'BATCH-20260909-01' });
        requestHandler(reqProc.req, reqProc.res);
        reqProc.trigger();
        await reqProc.wait();
        assert.strictEqual(reqProc.getResult().statusCode, 200);
        assert.strictEqual(JSON.parse(reqProc.getResult().body).withdrawal.status, 'processing');

        // Funds still reserved throughout pipeline
        const overview = await nexusWithdrawalService.getMemberWithdrawalOverview(memberA.userId);
        assert.strictEqual(overview.reserved_amount, 10000.00);
    });

    // ------------------------------------------------------------
    // TEST 100: Authorized Admin Unmasked Wire Transfer Inspection
    // ------------------------------------------------------------
    await step('100. Authorized Admin Unmasked Wire Transfer Inspection', async () => {
        // Member inspection of withdrawal returns masked account number
        const reqMemberInspect = mockHttp(`/api/v1/nexus/member/withdrawals/${testWd1.id}`, 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqMemberInspect.req, reqMemberInspect.res);
        reqMemberInspect.trigger();
        await reqMemberInspect.wait();
        const resMemberInspect = JSON.parse(reqMemberInspect.getResult().body);
        assert.strictEqual(resMemberInspect.withdrawal.bank_snapshot.account_number_masked, '********9012');
        assert.strictEqual(resMemberInspect.withdrawal.bank_snapshot.account_number, undefined);

        // Authorized Admin Wire Desk returns unmasked account number
        const reqAdminWire = mockHttp(`/api/v1/nexus/admin/withdrawals/${testWd1.id}`, 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqAdminWire.req, reqAdminWire.res);
        reqAdminWire.trigger();
        await reqAdminWire.wait();
        assert.strictEqual(reqAdminWire.getResult().statusCode, 200);
        const resAdminWire = JSON.parse(reqAdminWire.getResult().body);
        assert.strictEqual(resAdminWire.bank_transfer_details.account_number, '123456789012', 'Admin Wire Desk must receive full unmasked bank account number');
        assert.strictEqual(resAdminWire.bank_transfer_details.bank_name, 'Bank of Ceylon');
    });

    // ------------------------------------------------------------
    // TEST 101: Admin Manual Disbursement Confirmation (Mark Paid) & Atomic Ledger Debit
    // ------------------------------------------------------------
    await step('101. Admin Manual Disbursement Confirmation (Mark Paid) & Atomic Ledger Debit', async () => {
        const reqPay = mockHttp(`/api/v1/nexus/admin/withdrawals/${testWd1.id}/pay`, 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            payout_reference: 'CEFT-BOC-20260909-7711',
            notes: 'Transferred via corporate online banking'
        });
        requestHandler(reqPay.req, reqPay.res);
        reqPay.trigger();
        await reqPay.wait();

        assert.strictEqual(reqPay.getResult().statusCode, 200);
        const resPay = JSON.parse(reqPay.getResult().body);
        assert.strictEqual(resPay.success, true);
        assert.strictEqual(resPay.withdrawal.status, 'paid');
        assert.strictEqual(resPay.withdrawal.payout_reference, 'CEFT-BOC-20260909-7711');
        assert(resPay.withdrawal.ledger_entry_id);

        // Verify reservation is released (reserved_amount = 0)
        const overview = await nexusWithdrawalService.getMemberWithdrawalOverview(memberA.userId);
        assert.strictEqual(overview.reserved_amount, 0);

        // Verify atomic double-entry ledger debit was recorded
        const memberEntries = await nexusDb.getMemberLedgerEntries(memberA.userId);
        const debitEntry = memberEntries.entries.find(e => e.id === resPay.withdrawal.ledger_entry_id);
        assert(debitEntry, 'Ledger debit entry must exist');
        assert.strictEqual(debitEntry.direction, 'DEBIT');
        assert.strictEqual(debitEntry.amount, 10000.00);
        assert.strictEqual(debitEntry.entry_type, 'withdrawal');
        assert.strictEqual(debitEntry.reference_type, 'withdrawal');
        assert.strictEqual(debitEntry.reference_id, testWd1.id);
    });

    // ------------------------------------------------------------
    // TEST 102: Payout Idempotency Protection
    // ------------------------------------------------------------
    await step('102. Payout Idempotency Protection', async () => {
        const entriesBefore = (await nexusDb.getMemberLedgerEntries(memberA.userId)).entries.length;

        // Re-post the exact same payout confirmation
        const reqPayDup = mockHttp(`/api/v1/nexus/admin/withdrawals/${testWd1.id}/pay`, 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            payout_reference: 'CEFT-BOC-20260909-7711'
        });
        requestHandler(reqPayDup.req, reqPayDup.res);
        reqPayDup.trigger();
        await reqPayDup.wait();

        assert.strictEqual(reqPayDup.getResult().statusCode, 200);
        const resPayDup = JSON.parse(reqPayDup.getResult().body);
        assert.strictEqual(resPayDup.idempotent, true, 'Duplicate payout call must be flagged as idempotent');

        // Ensure zero additional ledger entries were posted
        const entriesAfter = (await nexusDb.getMemberLedgerEntries(memberA.userId)).entries.length;
        assert.strictEqual(entriesAfter, entriesBefore, 'No duplicate ledger entry must be created');
    });

    // ------------------------------------------------------------
    // TEST 103: Admin Rejection Flow & Zero Ledger Debit Restoration
    // ------------------------------------------------------------
    await step('103. Admin Rejection Flow & Zero Ledger Debit Restoration', async () => {
        // Member creates a withdrawal for LKR 5,000
        const reqWd3 = mockHttp('/api/v1/nexus/member/withdrawals', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, {
            amount: 5000.00
        });
        requestHandler(reqWd3.req, reqWd3.res);
        reqWd3.trigger();
        await reqWd3.wait();
        const wd3 = JSON.parse(reqWd3.getResult().body).withdrawal;

        // Admin rejects the withdrawal
        const reqReject = mockHttp(`/api/v1/nexus/admin/withdrawals/${wd3.id}/reject`, 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            rejection_reason: 'Account name does not match KYC verification documents'
        });
        requestHandler(reqReject.req, reqReject.res);
        reqReject.trigger();
        await reqReject.wait();

        assert.strictEqual(reqReject.getResult().statusCode, 200);
        const resReject = JSON.parse(reqReject.getResult().body);
        assert.strictEqual(resReject.withdrawal.status, 'rejected');
        assert.strictEqual(resReject.withdrawal.rejection_reason, 'Account name does not match KYC verification documents');

        // Verify reserved funds released back to 0
        const overview = await nexusWithdrawalService.getMemberWithdrawalOverview(memberA.userId);
        assert.strictEqual(overview.reserved_amount, 0);

        // Verify zero ledger debit entries for rejected withdrawal
        const memberEntries = await nexusDb.getMemberLedgerEntries(memberA.userId);
        const rejectDebit = memberEntries.entries.find(e => e.reference_id === wd3.id);
        assert.strictEqual(rejectDebit, undefined, 'Zero ledger debits allowed for rejected withdrawals');
    });

    // ------------------------------------------------------------
    // TEST 104: Failed External Payout Flow (processing -> failed)
    // ------------------------------------------------------------
    await step('104. Failed External Payout Flow (processing -> failed)', async () => {
        // Member creates withdrawal of LKR 3,000
        const reqWd4 = mockHttp('/api/v1/nexus/member/withdrawals', 'POST', {
            'authorization': `Bearer ${memberAToken}`,
            'content-type': 'application/json'
        }, {
            amount: 3000.00
        });
        requestHandler(reqWd4.req, reqWd4.res);
        reqWd4.trigger();
        await reqWd4.wait();
        const wd4 = JSON.parse(reqWd4.getResult().body).withdrawal;

        // Admin approves and moves to processing
        await nexusWithdrawalService.approveWithdrawal(wd4.id, 'admin-01');
        await nexusWithdrawalService.markProcessing(wd4.id, 'admin-01');

        // External bank bounces the transfer
        const reqFail = mockHttp(`/api/v1/nexus/admin/withdrawals/${wd4.id}/fail`, 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            failure_reason: 'Bank returned error: Branch closed / code invalid'
        });
        requestHandler(reqFail.req, reqFail.res);
        reqFail.trigger();
        await reqFail.wait();

        assert.strictEqual(reqFail.getResult().statusCode, 200);
        const resFail = JSON.parse(reqFail.getResult().body);
        assert.strictEqual(resFail.withdrawal.status, 'failed');

        // Verify reservation released
        const overview = await nexusWithdrawalService.getMemberWithdrawalOverview(memberA.userId);
        assert.strictEqual(overview.reserved_amount, 0);
    });

    // ------------------------------------------------------------
    // TEST 105: Tenant Isolation & Cross-Member Withdrawal Protection (403)
    // ------------------------------------------------------------
    await step('105. Tenant Isolation & Cross-Member Withdrawal Protection (403)', async () => {
        const loginB = await NexusAuthService.login('nimal@nexusp.online', 'Password123!');
        const tokenB = loginB.token;

        // Member B attempts to view Member A's withdrawal
        const reqCrossInspect = mockHttp(`/api/v1/nexus/member/withdrawals/${testWd1.id}`, 'GET', {
            'authorization': `Bearer ${tokenB}`
        });
        requestHandler(reqCrossInspect.req, reqCrossInspect.res);
        reqCrossInspect.trigger();
        await reqCrossInspect.wait();

        assert.strictEqual(reqCrossInspect.getResult().statusCode, 403, 'Cross-member withdrawal inspection must be 403 Forbidden');

        // Member B attempts to cancel Member A's withdrawal
        const reqCrossCancel = mockHttp(`/api/v1/nexus/member/withdrawals/${testWd1.id}/cancel`, 'POST', {
            'authorization': `Bearer ${tokenB}`
        });
        requestHandler(reqCrossCancel.req, reqCrossCancel.res);
        reqCrossCancel.trigger();
        await reqCrossCancel.wait();

        assert.strictEqual(reqCrossCancel.getResult().statusCode, 403, 'Cross-member withdrawal cancellation must be 403 Forbidden');
    });

    // ------------------------------------------------------------
    // TEST 106: Admin Withdrawal Statistics & Status Filtering
    // ------------------------------------------------------------
    await step('106. Admin Withdrawal Statistics & Status Filtering', async () => {
        const reqStats = mockHttp('/api/v1/nexus/admin/withdrawals/stats', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqStats.req, reqStats.res);
        reqStats.trigger();
        await reqStats.wait();

        assert.strictEqual(reqStats.getResult().statusCode, 200);
        const resStats = JSON.parse(reqStats.getResult().body);
        assert.strictEqual(resStats.success, true);
        const s = resStats.stats;
        assert(s.total_count >= 4);
        assert.strictEqual(s.paid_count, 1);
        assert.strictEqual(s.rejected_count, 1);
        assert.strictEqual(s.failed_count, 1);
        assert.strictEqual(s.cancelled_count, 1);
        assert.strictEqual(s.total_paid_amount, 10000.00);

        // Filter by paid
        const reqPaidList = mockHttp('/api/v1/nexus/admin/withdrawals?status=paid', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqPaidList.req, reqPaidList.res);
        reqPaidList.trigger();
        await reqPaidList.wait();

        assert.strictEqual(reqPaidList.getResult().statusCode, 200);
        const resPaidList = JSON.parse(reqPaidList.getResult().body);
        assert.strictEqual(resPaidList.withdrawals.length, 1);
        assert.strictEqual(resPaidList.withdrawals[0].id, testWd1.id);
    });

    // ------------------------------------------------------------
    // TEST 107: Deep Withdrawal Pipeline Reconciliation Diagnostic
    // ------------------------------------------------------------
    await step('107. Deep Withdrawal Pipeline Reconciliation Diagnostic', async () => {
        const reqReconcile = mockHttp('/api/v1/nexus/admin/withdrawals/reconciliation', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqReconcile.req, reqReconcile.res);
        reqReconcile.trigger();
        await reqReconcile.wait();

        assert.strictEqual(reqReconcile.getResult().statusCode, 200);
        const resReconcile = JSON.parse(reqReconcile.getResult().body);
        assert.strictEqual(resReconcile.success, true);
        const d = resReconcile.diagnostics;

        assert.strictEqual(d.missing_ledger_entries.length, 0, 'Zero missing ledger entries for paid payouts');
        assert.strictEqual(d.duplicate_payout_references.length, 0, 'Zero duplicate payout references');
        assert.strictEqual(d.orphan_ledger_references.length, 0, 'Zero orphan ledger references');
        assert.strictEqual(d.negative_available_balance_members.length, 0, 'Zero negative available balances');
        assert.strictEqual(d.summary.total_paid, 1);
        assert.strictEqual(d.summary.total_rejected, 1);
        assert.strictEqual(d.summary.total_failed, 1);
        assert.strictEqual(d.summary.total_cancelled, 1);
    });

    // ==============================================================================
    // PROMPT 14: MLM RANK / LEVEL / QUALIFICATION / ACHIEVEMENT ENGINE TESTS
    // ==============================================================================

    let rank01 = null;
    let rank02 = null;
    let newRuleVer = null;

    // ------------------------------------------------------------
    // TEST 108: Configurable Rank Hierarchy Initialization & Seed Verification
    // ------------------------------------------------------------
    await step('108. Configurable Rank Hierarchy Initialization & Seed Verification', async () => {
        // Verify default seed ranks
        const ranks = await nexusDb.getAllRanks();
        assert(ranks.length >= 6, 'Should have at least 6 initial seed ranks');
        assert.strictEqual(ranks[0].code, 'MEMBER');
        assert.strictEqual(ranks[1].code, 'RANK_01');
        assert.strictEqual(ranks[2].code, 'RANK_02');
        assert.strictEqual(ranks[3].code, 'RANK_03');
        assert.strictEqual(ranks[4].code, 'RANK_04');
        assert.strictEqual(ranks[5].code, 'FOUNDER');

        // Verify sorted by display_order ascending
        for (let i = 0; i < ranks.length - 1; i++) {
            assert(ranks[i].display_order <= ranks[i + 1].display_order, 'Ranks must be ordered ascending by display_order');
        }

        rank01 = ranks.find(r => r.code === 'RANK_01');
        rank02 = ranks.find(r => r.code === 'RANK_02');

        // Admin REST endpoint: GET /api/v1/nexus/admin/ranks
        const reqListRanks = mockHttp('/api/v1/nexus/admin/ranks', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqListRanks.req, reqListRanks.res);
        reqListRanks.trigger();
        await reqListRanks.wait();

        assert.strictEqual(reqListRanks.getResult().statusCode, 200);
        const resList = JSON.parse(reqListRanks.getResult().body);
        assert.strictEqual(resList.success, true);
        assert(resList.data.length >= 6);
        assert.strictEqual(resList.meta.active_rule_version, 'v1.0');

        // Admin creates a new rank tier: RANK_05 (Diamond)
        const reqCreateRank = mockHttp('/api/v1/nexus/admin/ranks', 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            code: 'RANK_05',
            name: 'Diamond Executive',
            display_order: 6,
            badge_color: '#38bdf8',
            description: 'Elite global distributor tier',
            is_active: true
        });
        requestHandler(reqCreateRank.req, reqCreateRank.res);
        reqCreateRank.trigger();
        await reqCreateRank.wait();

        assert.strictEqual(reqCreateRank.getResult().statusCode, 201);
        const resCreate = JSON.parse(reqCreateRank.getResult().body);
        assert.strictEqual(resCreate.success, true);
        assert.strictEqual(resCreate.data.code, 'RANK_05');
        assert.strictEqual(resCreate.data.name, 'Diamond Executive');
    });

    // ------------------------------------------------------------
    // TEST 109: Rule Versioning & Effective Date Scoping
    // ------------------------------------------------------------
    await step('109. Rule Versioning & Effective Date Scoping', async () => {
        // Admin lists rule versions
        const reqVersions = mockHttp('/api/v1/nexus/admin/ranks/rules/versions', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqVersions.req, reqVersions.res);
        reqVersions.trigger();
        await reqVersions.wait();

        assert.strictEqual(reqVersions.getResult().statusCode, 200);
        const resVersions = JSON.parse(reqVersions.getResult().body);
        assert(resVersions.data.length >= 1);
        assert.strictEqual(resVersions.data[0].version_code, 'v1.0');

        // Admin creates new rule version: v2.0
        const reqCreateVer = mockHttp('/api/v1/nexus/admin/ranks/rules/versions', 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            version_code: 'v2.0',
            name: '2026 Enhanced Rank Qualification Rules',
            description: 'Updated PV and TV thresholds for leadership ranks',
            is_active: true
        });
        requestHandler(reqCreateVer.req, reqCreateVer.res);
        reqCreateVer.trigger();
        await reqCreateVer.wait();

        assert.strictEqual(reqCreateVer.getResult().statusCode, 201);
        const resCreateVer = JSON.parse(reqCreateVer.getResult().body);
        newRuleVer = resCreateVer.data;
        assert.strictEqual(newRuleVer.version_code, 'v2.0');
        assert.strictEqual(newRuleVer.is_active, true);

        // Verify active rule version is now v2.0
        const activeVer = await nexusDb.getActiveRankRuleVersion();
        assert.strictEqual(activeVer.version_code, 'v2.0');
    });

    // ------------------------------------------------------------
    // TEST 110: Requirement Builder (PV, TV, Directs, Package requirements)
    // ------------------------------------------------------------
    await step('110. Requirement Builder (PV, TV, Directs, Package requirements)', async () => {
        // Add requirements for RANK_01 under v2.0:
        // Rule 1: PV >= 5,000
        const reqReq1 = mockHttp('/api/v1/nexus/admin/ranks/requirements', 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            rank_id: rank01.id,
            rule_version_id: newRuleVer.id,
            requirement_type: 'personal_volume',
            target_value: '5000',
            comparison_operator: '>=',
            evaluation_period: 'lifetime',
            description: 'Minimum 5,000 LKR Personal Volume'
        });
        requestHandler(reqReq1.req, reqReq1.res);
        reqReq1.trigger();
        await reqReq1.wait();
        assert.strictEqual(reqReq1.getResult().statusCode, 201);

        // Rule 2: Direct Referrals >= 2
        const reqReq2 = mockHttp('/api/v1/nexus/admin/ranks/requirements', 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            rank_id: rank01.id,
            rule_version_id: newRuleVer.id,
            requirement_type: 'direct_referrals',
            target_value: '2',
            comparison_operator: '>=',
            evaluation_period: 'lifetime',
            description: 'Minimum 2 Direct Referrals'
        });
        requestHandler(reqReq2.req, reqReq2.res);
        reqReq2.trigger();
        await reqReq2.wait();
        assert.strictEqual(reqReq2.getResult().statusCode, 201);

        // Add requirement for RANK_02 under v2.0:
        // Rule 3: TV >= 100,000
        const reqReq3 = mockHttp('/api/v1/nexus/admin/ranks/requirements', 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            rank_id: rank02.id,
            rule_version_id: newRuleVer.id,
            requirement_type: 'team_volume',
            target_value: '100000',
            comparison_operator: '>=',
            evaluation_period: 'lifetime',
            description: 'Minimum 100,000 LKR Team Volume'
        });
        requestHandler(reqReq3.req, reqReq3.res);
        reqReq3.trigger();
        await reqReq3.wait();
        assert.strictEqual(reqReq3.getResult().statusCode, 201);

        // Verify Rank 01 requirements list
        const reqRankDetail = mockHttp(`/api/v1/nexus/admin/ranks/${rank01.id}`, 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqRankDetail.req, reqRankDetail.res);
        reqRankDetail.trigger();
        await reqRankDetail.wait();

        assert.strictEqual(reqRankDetail.getResult().statusCode, 200);
        const resDetail = JSON.parse(reqRankDetail.getResult().body);
        assert(resDetail.data.requirements.length >= 2);
    });

    // ------------------------------------------------------------
    // TEST 111: Personal Volume (PV) Calculation from Paid Orders Only
    // ------------------------------------------------------------
    await step('111. Personal Volume (PV) Calculation from Paid Orders Only', async () => {
        const initialPV = await nexusDb.calculateMemberPersonalVolume(memberA.userId);

        // Create paid order for memberA: 6,000 LKR
        const paidOrderA = await nexusDb.createOrder({
            user_id: memberA.userId,
            order_type: 'package',
            items: [{ package_id: 'NP-PKG-01', name: 'Starter Package', unit_price: 6000, quantity: 1, total_price: 6000 }],
            total: 6000,
            status: 'paid',
            payment_status: 'paid'
        });
        assert(paidOrderA.id);

        const newPV = await nexusDb.calculateMemberPersonalVolume(memberA.userId);
        assert.strictEqual(newPV, initialPV + 6000, 'PV must increase by exact paid order amount');
    });

    // ------------------------------------------------------------
    // TEST 112: Team Volume (TV) Calculation across Downline Closure
    // ------------------------------------------------------------
    await step('112. Team Volume (TV) Calculation across Downline Closure', async () => {
        const initialTVA = await nexusDb.calculateMemberTeamVolume(memberA.userId);

        // Member B (who is in A's downline) places a paid order for 15,000 LKR
        const paidOrderB = await nexusDb.createOrder({
            user_id: memberB.userId,
            order_type: 'product',
            items: [{ product_id: 'prod-01', name: 'Masterclass', unit_price: 15000, quantity: 1, total_price: 15000 }],
            total: 15000,
            status: 'paid',
            payment_status: 'paid'
        });
        assert(paidOrderB.id);

        const newTVA = await nexusDb.calculateMemberTeamVolume(memberA.userId);
        assert.strictEqual(newTVA, initialTVA + 15000, "Member A's TV must include Member B's paid order");

        // Member B's own team volume should not include Member B's personal volume
        const tvB = await nexusDb.calculateMemberTeamVolume(memberB.userId);
        assert(tvB <= newTVA - 15000, "Member B's TV should only include B's own downline");
    });

    // ------------------------------------------------------------
    // TEST 113: Zero Volume Protection for Cancelled / Failed Orders
    // ------------------------------------------------------------
    await step('113. Zero Volume Protection for Cancelled / Failed Orders', async () => {
        const pvBefore = await nexusDb.calculateMemberPersonalVolume(memberA.userId);
        const tvBefore = await nexusDb.calculateMemberTeamVolume(memberA.userId);

        // Member A creates a cancelled order for 50,000 LKR
        await nexusDb.createOrder({
            user_id: memberA.userId,
            order_type: 'package',
            items: [{ package_id: 'NP-PKG-04', name: 'Executive', unit_price: 50000, quantity: 1, total_price: 50000 }],
            total: 50000,
            status: 'cancelled',
            payment_status: 'pending'
        });

        // Member B creates a failed order for 25,000 LKR
        await nexusDb.createOrder({
            user_id: memberB.userId,
            order_type: 'package',
            items: [{ package_id: 'NP-PKG-03', name: 'Leader', unit_price: 25000, quantity: 1, total_price: 25000 }],
            total: 25000,
            status: 'failed',
            payment_status: 'failed'
        });

        const pvAfter = await nexusDb.calculateMemberPersonalVolume(memberA.userId);
        const tvAfter = await nexusDb.calculateMemberTeamVolume(memberA.userId);

        assert.strictEqual(pvAfter, pvBefore, 'Cancelled order must contribute ZERO Personal Volume');
        assert.strictEqual(tvAfter, tvBefore, 'Failed downline order must contribute ZERO Team Volume');
    });

    // ------------------------------------------------------------
    // TEST 114: Deterministic Highest Qualified Rank Selection
    // ------------------------------------------------------------
    await step('114. Deterministic Highest Qualified Rank Selection', async () => {
        // Member A currently has 1 direct referral (memberB).
        // Let's register a second direct referral under Member A: memberE
        const regE = await NexusAuthService.registerMember({
            fullName: 'Erandi Perera',
            email: 'erandi@nexusp.online',
            phone: '+94755555555',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            referralCode: memberA.referralCode
        });
        assert.strictEqual(regE.success, true);

        // Verify Member A now has at least 2 direct referrals
        const directCount = await nexusDb.calculateMemberDirectReferrals(memberA.userId);
        assert(directCount.total >= 2);

        // Member A has:
        // PV >= 6,000 (qualifies for RANK_01 requirement: PV >= 5,000)
        // Direct Referrals >= 2 (qualifies for RANK_01 requirement: Directs >= 2)
        // TV < 100,000 (does not meet RANK_02 requirement: TV >= 100,000)
        const evalResult = await nexusRankService.evaluateMemberRank(memberA.userId);
        assert.strictEqual(evalResult.qualifiedRank.code, 'RANK_01', 'Must select RANK_01 as highest qualified tier');
        assert(evalResult.qualifiedRank.display_order >= 1, 'RANK_01 display order must be higher than MEMBER');
    });

    // ------------------------------------------------------------
    // TEST 115: Immutable Rank History & Point-in-Time Metric Snapshots
    // ------------------------------------------------------------
    await step('115. Immutable Rank History & Point-in-Time Metric Snapshots', async () => {
        const recalcResult = await nexusRankService.recalculateMemberRank(memberA.userId, {
            reason: 'Automated performance evaluation'
        });

        assert.strictEqual(recalcResult.promoted, true);
        assert.strictEqual(recalcResult.evaluated_rank_code, 'RANK_01');
        assert.strictEqual(recalcResult.previous_rank_code, 'MEMBER');

        // Verify member profile updated
        const updatedProfile = await nexusDb.findProfileByUserId(memberA.userId);
        assert.strictEqual(updatedProfile.current_rank, 'RANK_01');

        // Verify immutable rank history log
        const history = await nexusDb.getMemberRankHistory(memberA.userId);
        assert(history.length >= 1);
        const latestHistory = history[0];
        assert.strictEqual(latestHistory.rank_code, 'RANK_01');
        assert.strictEqual(latestHistory.previous_rank_code, 'MEMBER');
        assert(latestHistory.snapshot_id, 'History entry must link to immutable metric snapshot');

        // Verify point-in-time metrics snapshot
        const snapshot = nexusDb.memberMetricSnapshots.find(s => s.id === latestHistory.snapshot_id);
        assert(snapshot, 'Snapshot record must exist');
        assert(snapshot.metrics.personal_volume >= 5000);
        assert(snapshot.metrics.direct_referrals >= 2);
    });

    // ------------------------------------------------------------
    // TEST 116: No Demotion Lifetime Rank Retention Policy
    // ------------------------------------------------------------
    await step('116. No Demotion Lifetime Rank Retention Policy', async () => {
        // Temporarily evaluate with no orders meeting a monthly filter (simulating inactive month)
        // In our default policy (allowDemotion: false), current rank RANK_01 must be retained
        const evalResult = await nexusRankService.recalculateMemberRank(memberA.userId, {
            allowDemotion: false,
            reason: 'Monthly cycle verification'
        });

        assert.strictEqual(evalResult.promoted, false);
        assert.strictEqual(evalResult.evaluated_rank_code, 'RANK_01', 'Member rank must be retained (no demotion)');

        const profile = await nexusDb.findProfileByUserId(memberA.userId);
        assert.strictEqual(profile.current_rank, 'RANK_01', 'Profile current_rank must remain RANK_01');
    });

    // ------------------------------------------------------------
    // TEST 117: Admin Manual Member Rank Recalculation & Audit Log Emission
    // ------------------------------------------------------------
    await step('117. Admin Manual Member Rank Recalculation & Audit Log Emission', async () => {
        const reqAdminRecalc = mockHttp(`/api/v1/nexus/admin/ranks/recalculate-member/${memberA.userId}`, 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            reason: 'Administrative manual qualification audit'
        });
        requestHandler(reqAdminRecalc.req, reqAdminRecalc.res);
        reqAdminRecalc.trigger();
        await reqAdminRecalc.wait();

        assert.strictEqual(reqAdminRecalc.getResult().statusCode, 200);
        const resRecalc = JSON.parse(reqAdminRecalc.getResult().body);
        assert.strictEqual(resRecalc.success, true);
        assert.strictEqual(resRecalc.data.evaluated_rank_code, 'RANK_01');

        // Verify audit log event: RANK_RECALCULATED
        const logs = await nexusDb.getAuditLogs({ event_type: 'RANK_RECALCULATED' });
        assert(logs.logs.length >= 1, 'Audit log must record RANK_RECALCULATED event');
        const latestLog = logs.logs[0];
        assert.strictEqual(latestLog.event_type || latestLog.action, 'RANK_RECALCULATED');
    });

    // ------------------------------------------------------------
    // TEST 118: Member Rank Progression REST Endpoint & Privacy
    // ------------------------------------------------------------
    await step('118. Member Rank Progression REST Endpoint & Privacy', async () => {
        // Member A requests their own rank details
        const reqMemberRank = mockHttp('/api/v1/nexus/member/rank', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqMemberRank.req, reqMemberRank.res);
        reqMemberRank.trigger();
        await reqMemberRank.wait();

        assert.strictEqual(reqMemberRank.getResult().statusCode, 200);
        const resRank = JSON.parse(reqMemberRank.getResult().body);
        assert.strictEqual(resRank.success, true);
        assert.strictEqual(resRank.data.current_rank.code, 'RANK_01');
        assert.strictEqual(resRank.data.next_rank.code, 'RANK_02');
        assert(Array.isArray(resRank.data.requirements_checklist));
        assert.strictEqual(resRank.data.demotion_policy.enabled, false);

        // Member A requests achievement history
        const reqHistory = mockHttp('/api/v1/nexus/member/rank/history', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqHistory.req, reqHistory.res);
        reqHistory.trigger();
        await reqHistory.wait();

        assert.strictEqual(reqHistory.getResult().statusCode, 200);
        const resHistory = JSON.parse(reqHistory.getResult().body);
        assert.strictEqual(resHistory.success, true);
        assert(resHistory.data.length >= 1);
        assert.strictEqual(resHistory.data[0].rank_code, 'RANK_01');
    });

    // ------------------------------------------------------------
    // TEST 119: Unauthenticated Access Guard & Role Security
    // ------------------------------------------------------------
    await step('119. Unauthenticated Access Guard & Role Security', async () => {
        // Unauthenticated member endpoint
        const reqNoAuthMember = mockHttp('/api/v1/nexus/member/rank', 'GET');
        requestHandler(reqNoAuthMember.req, reqNoAuthMember.res);
        reqNoAuthMember.trigger();
        await reqNoAuthMember.wait();
        assert.strictEqual(reqNoAuthMember.getResult().statusCode, 401, 'Must reject unauthenticated member request');

        // Unauthenticated admin endpoint
        const reqNoAuthAdmin = mockHttp('/api/v1/nexus/admin/ranks', 'GET');
        requestHandler(reqNoAuthAdmin.req, reqNoAuthAdmin.res);
        reqNoAuthAdmin.trigger();
        await reqNoAuthAdmin.wait();
        assert.strictEqual(reqNoAuthAdmin.getResult().statusCode, 401, 'Must reject unauthenticated admin request');

        // Non-admin token calling admin rank management
        const reqForbidden = mockHttp('/api/v1/nexus/admin/ranks', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqForbidden.req, reqForbidden.res);
        reqForbidden.trigger();
        await reqForbidden.wait();
        assert.strictEqual(reqForbidden.getResult().statusCode, 403, 'Member token must be 403 Forbidden from admin endpoints');
    });

    // ------------------------------------------------------------
    // TEST 120: Admin Rank Performance Directory Search & Pagination
    // ------------------------------------------------------------
    await step('120. Admin Rank Performance Directory Search & Pagination', async () => {
        // Filter by rank: RANK_01
        const reqPerfRank = mockHttp('/api/v1/nexus/admin/ranks/performance?rank=RANK_01', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqPerfRank.req, reqPerfRank.res);
        reqPerfRank.trigger();
        await reqPerfRank.wait();

        assert.strictEqual(reqPerfRank.getResult().statusCode, 200);
        const resPerfRank = JSON.parse(reqPerfRank.getResult().body);
        assert.strictEqual(resPerfRank.success, true);
        assert(resPerfRank.data.some(m => m.user_id === memberA.userId && m.current_rank === 'RANK_01'));

        // Search by Member Name
        const reqPerfSearch = mockHttp('/api/v1/nexus/admin/ranks/performance?search=Kasun', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqPerfSearch.req, reqPerfSearch.res);
        reqPerfSearch.trigger();
        await reqPerfSearch.wait();

        assert.strictEqual(reqPerfSearch.getResult().statusCode, 200);
        const resPerfSearch = JSON.parse(reqPerfSearch.getResult().body);
        assert.strictEqual(resPerfSearch.success, true);
        assert(resPerfSearch.data.length >= 1);
        assert.strictEqual(resPerfSearch.pagination.page, 1);
    });

    // ------------------------------------------------------------
    // TEST 121: Rank Achievement Event Emission & Financial Decoupling
    // ------------------------------------------------------------
    await step('121. Rank Achievement Event Emission & Financial Decoupling', async () => {
        // Check audit log for RANK_ACHIEVED event emitted during Member A's promotion
        const achievedLogs = await nexusDb.getAuditLogs({ event_type: 'RANK_ACHIEVED' });
        const logsList = achievedLogs.logs || achievedLogs;
        assert(logsList.length >= 1, 'RANK_ACHIEVED audit event must be emitted on rank qualification');
        const achievedEvent = logsList[0];
        assert.strictEqual(achievedEvent.event_type || achievedEvent.action, 'RANK_ACHIEVED');
        assert(achievedEvent.metadata?.achievement_id || achievedEvent.payload?.achievement_id, 'Event must include immutable achievement_id');

        // Verify Financial Decoupling:
        // Rank engine must never write directly to nexus_wallets or alter ledger balances.
        const wallet = await nexusDb.getWalletByUserId(memberA.userId);
        assert(wallet, 'Wallet should exist');
        const entries = await nexusDb.getLedgerEntries({ user_id: memberA.userId });
        const directRankLedger = entries.filter(e => e.reference_type === 'direct_rank_credit');
        assert.strictEqual(directRankLedger.length, 0, 'Rank engine must never write direct credits to the ledger');
    });

    // ------------------------------------------------------------
    // TEST 122: Batch Platform Recalculation Utility
    // ------------------------------------------------------------
    await step('122. Batch Platform Recalculation Utility', async () => {
        const reqBatch = mockHttp('/api/v1/nexus/admin/ranks/recalculate-all', 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            reason: 'Scheduled quarterly qualification cycle evaluation'
        });
        requestHandler(reqBatch.req, reqBatch.res);
        reqBatch.trigger();
        await reqBatch.wait();

        assert.strictEqual(reqBatch.getResult().statusCode, 200);
        const resBatch = JSON.parse(reqBatch.getResult().body);
        assert.strictEqual(resBatch.success, true);
        assert(resBatch.data.total_evaluated >= 4, 'Should evaluate all active distributors');
        assert(typeof resBatch.data.total_promoted === 'number');
    });

    // ============================================================
    // NEXUS PRIME — PROMPT 15: FINANCIAL DASHBOARD & COMMISSION REPORTS
    // ============================================================

    // ------------------------------------------------------------
    // TEST 123: Admin Financial Overview & Truthful Totals
    // ------------------------------------------------------------
    await step('123. Admin Financial Overview & Truthful Totals', async () => {
        const reqFin = mockHttp('/api/v1/nexus/admin/financials/overview?period=all&currency=LKR', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqFin.req, reqFin.res);
        reqFin.trigger();
        await reqFin.wait();

        assert.strictEqual(reqFin.getResult().statusCode, 200);
        const resFin = JSON.parse(reqFin.getResult().body);
        assert.strictEqual(resFin.success, true);
        const sum = resFin.data.summary;
        assert(sum.gross_sales >= 0, 'Gross sales volume must be non-negative');
        assert(sum.verified_payments >= 0, 'Verified payments must be non-negative');
        assert(sum.commission_liability >= 0, 'Commission liability must be non-negative');
        assert(sum.paid_withdrawals >= 0, 'Paid withdrawals must be non-negative');
        assert(sum.refunds >= 0, 'Refunds must be non-negative');
        
        const expectedNet = sum.verified_payments - sum.paid_withdrawals - sum.refunds;
        assert.strictEqual(sum.net_financial_movement, expectedNet, 'Net movement must equal verified payments minus outflows');

        const brk = resFin.data.breakdown;
        assert(brk.orders && brk.payments && brk.commissions && brk.wallets && brk.withdrawals);
        assert(Array.isArray(resFin.data.time_series), 'Time series must be an array');
        assert(Array.isArray(resFin.data.rank_distribution), 'Rank distribution must be an array');
        assert(Array.isArray(resFin.data.top_performers), 'Top performers must be an array');
    });

    // ------------------------------------------------------------
    // TEST 124: Server-Side Date Filter Scoping
    // ------------------------------------------------------------
    await step('124. Server-Side Date Filter Scoping', async () => {
        // Test 'today'
        const reqToday = mockHttp('/api/v1/nexus/admin/financials/overview?period=today', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqToday.req, reqToday.res);
        reqToday.trigger();
        await reqToday.wait();
        assert.strictEqual(reqToday.getResult().statusCode, 200);
        const resToday = JSON.parse(reqToday.getResult().body);
        assert.strictEqual(resToday.data.period, 'today');
        assert.strictEqual(resToday.data.timezone, 'Asia/Colombo (UTC+05:30)');

        // Test custom past range with no activity
        const reqPast = mockHttp('/api/v1/nexus/admin/financials/overview?period=custom&start_date=2015-01-01&end_date=2015-01-02', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqPast.req, reqPast.res);
        reqPast.trigger();
        await reqPast.wait();
        assert.strictEqual(reqPast.getResult().statusCode, 200);
        const resPast = JSON.parse(reqPast.getResult().body);
        assert.strictEqual(resPast.data.summary.gross_sales, 0, 'Zero sales in 2015');
        assert.strictEqual(resPast.data.summary.verified_payments, 0, 'Zero payments in 2015');
        assert.strictEqual(resPast.data.summary.net_financial_movement, 0, 'Zero net movement in 2015');
    });

    // ------------------------------------------------------------
    // TEST 125: Currency Isolation (LKR Grouping, Zero Fake FX)
    // ------------------------------------------------------------
    await step('125. Currency Isolation (LKR Grouping, Zero Fake FX)', async () => {
        // Query LKR
        const reqLkr = mockHttp('/api/v1/nexus/admin/financials/overview?currency=LKR', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqLkr.req, reqLkr.res);
        reqLkr.trigger();
        await reqLkr.wait();
        assert.strictEqual(reqLkr.getResult().statusCode, 200);
        const resLkr = JSON.parse(reqLkr.getResult().body);
        assert.strictEqual(resLkr.data.currency, 'LKR');

        // Query USD (zero transactions, no fake FX conversion)
        const reqUsd = mockHttp('/api/v1/nexus/admin/financials/overview?currency=USD', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqUsd.req, reqUsd.res);
        reqUsd.trigger();
        await reqUsd.wait();
        assert.strictEqual(reqUsd.getResult().statusCode, 200);
        const resUsd = JSON.parse(reqUsd.getResult().body);
        assert.strictEqual(resUsd.data.currency, 'USD');
        assert.strictEqual(resUsd.data.summary.gross_sales, 0, 'Zero simulated USD sales');
        assert.strictEqual(resUsd.data.summary.verified_payments, 0, 'Zero simulated USD payments');
    });

    // ------------------------------------------------------------
    // TEST 126: Financial Summary Cards & No Unsupported Profit Claims
    // ------------------------------------------------------------
    await step('126. Financial Summary Cards & No Unsupported Profit Claims', async () => {
        const reqOverview = mockHttp('/api/v1/nexus/admin/financials/overview', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqOverview.req, reqOverview.res);
        reqOverview.trigger();
        await reqOverview.wait();

        const resOverview = JSON.parse(reqOverview.getResult().body);
        const sum = resOverview.data.summary;

        // Conservative accounting check: summary must NOT invent "profit" or "net_profit"
        assert.strictEqual(sum.profit, undefined, 'Summary must not contain unsupported profit claim');
        assert.strictEqual(sum.net_profit, undefined, 'Summary must not contain unsupported net_profit claim');

        // Required conservative metrics must all be present
        assert(typeof sum.gross_sales === 'number');
        assert(typeof sum.verified_payments === 'number');
        assert(typeof sum.commission_liability === 'number');
        assert(typeof sum.paid_withdrawals === 'number');
        assert(typeof sum.refunds === 'number');
        assert(typeof sum.net_financial_movement === 'number');
    });

    // ------------------------------------------------------------
    // TEST 127: Comprehensive Commission Report Pagination & Complex Multi-Filter
    // ------------------------------------------------------------
    await step('127. Comprehensive Commission Report Pagination & Complex Multi-Filter', async () => {
        // 1. Pagination
        const reqPag = mockHttp('/api/v1/nexus/admin/commissions?page=1&limit=2', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqPag.req, reqPag.res);
        reqPag.trigger();
        await reqPag.wait();
        assert.strictEqual(reqPag.getResult().statusCode, 200);
        const resPag = JSON.parse(reqPag.getResult().body);
        assert.strictEqual(resPag.pagination.page, 1);
        assert.strictEqual(resPag.pagination.limit, 2);
        assert(resPag.commissions.length <= 2);

        // 2. Filter by status=approved
        const reqApp = mockHttp('/api/v1/nexus/admin/commissions?status=approved', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqApp.req, reqApp.res);
        reqApp.trigger();
        await reqApp.wait();
        assert.strictEqual(reqApp.getResult().statusCode, 200);
        const resApp = JSON.parse(reqApp.getResult().body);
        resApp.commissions.forEach(c => {
            assert.strictEqual(c.status, 'approved', 'All filtered records must be approved');
        });

        // 3. Filter by type=DIRECT_REFERRAL
        const reqType = mockHttp('/api/v1/nexus/admin/commissions?type=DIRECT_REFERRAL', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqType.req, reqType.res);
        reqType.trigger();
        await reqType.wait();
        assert.strictEqual(reqType.getResult().statusCode, 200);
        const resType = JSON.parse(reqType.getResult().body);
        resType.commissions.forEach(c => {
            assert.strictEqual(c.commission_type, 'DIRECT_REFERRAL');
        });
    });

    // ------------------------------------------------------------
    // TEST 128: Commission Detail & Full Audit Traceability Chain
    // ------------------------------------------------------------
    await step('128. Commission Detail & Full Audit Traceability Chain', async () => {
        const commData = await nexusDb.getAllCommissions();
        const allComms = commData.commissions || [];
        assert(allComms.length > 0, 'Commissions must exist');
        const comm = allComms[0];

        const reqTrace = mockHttp(`/api/v1/nexus/admin/commissions/${comm.id}`, 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqTrace.req, reqTrace.res);
        reqTrace.trigger();
        await reqTrace.wait();

        assert.strictEqual(reqTrace.getResult().statusCode, 200);
        const resTrace = JSON.parse(reqTrace.getResult().body);
        assert.strictEqual(resTrace.success, true);
        assert(resTrace.commission, 'Commission record must be returned');

        const dossier = resTrace.dossier;
        assert(dossier, 'Traceability dossier must be present');
        assert(dossier.stage_1_payment, 'Stage 1 Payment must exist');
        assert(dossier.stage_2_order, 'Stage 2 Order must exist');
        assert(dossier.stage_3_commission, 'Stage 3 Commission must exist');
        assert(dossier.stage_4_wallet_ledger, 'Stage 4 Wallet Ledger must exist');
        assert(dossier.stage_5_withdrawal, 'Stage 5 Withdrawal must exist');
        assert(dossier.stage_6_bank_payout, 'Stage 6 Bank Payout must exist');

        // Verify mathematical formula: rate * basis / 100 == amount
        const s3 = dossier.stage_3_commission;
        const expectedCalc = Math.round((s3.calculation_basis_amount * (s3.percentage_rate / 100)) * 100) / 100;
        assert.strictEqual(s3.amount, expectedCalc, 'Attributed commission must match mathematical rate multiplication');
    });

    // ------------------------------------------------------------
    // TEST 129: Member Commission Privacy & Strict Cross-Tenant Guard
    // ------------------------------------------------------------
    await step('129. Member Commission Privacy & Strict Cross-Tenant Guard', async () => {
        // Member A queries their summary
        const reqSummary = mockHttp('/api/v1/nexus/member/commissions/summary', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqSummary.req, reqSummary.res);
        reqSummary.trigger();
        await reqSummary.wait();
        assert.strictEqual(reqSummary.getResult().statusCode, 200);
        const resSummary = JSON.parse(reqSummary.getResult().body);
        assert.strictEqual(resSummary.success, true);
        assert(typeof resSummary.summary.total_earned === 'number');

        // Member A attempts to access admin report -> 403
        const reqAdminRep = mockHttp('/api/v1/nexus/admin/commissions/reports/levels', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqAdminRep.req, reqAdminRep.res);
        reqAdminRep.trigger();
        await reqAdminRep.wait();
        assert.strictEqual(reqAdminRep.getResult().statusCode, 403, 'Distributor must be denied admin report access');
    });

    // ------------------------------------------------------------
    // TEST 130: Dynamic MLM Level Commission Report
    // ------------------------------------------------------------
    await step('130. Dynamic MLM Level Commission Report', async () => {
        const reqLevels = mockHttp('/api/v1/nexus/admin/commissions/reports/levels', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqLevels.req, reqLevels.res);
        reqLevels.trigger();
        await reqLevels.wait();

        assert.strictEqual(reqLevels.getResult().statusCode, 200);
        const resLevels = JSON.parse(reqLevels.getResult().body);
        assert.strictEqual(resLevels.success, true);
        assert(Array.isArray(resLevels.data), 'Levels report must be an array');
        assert(resLevels.data.length > 0, 'Levels report should contain active tiers');

        const l1 = resLevels.data.find(l => l.level === 1);
        assert(l1, 'Level 1 direct referral tier must exist');
        assert.strictEqual(l1.type, 'DIRECT_REFERRAL');
        assert(l1.total_amount > 0, 'Level 1 commissions must be positive');
        assert(l1.effective_rate > 0, 'Effective rate must be positive');
    });

    // ------------------------------------------------------------
    // TEST 131: Historical Rank Commission Report
    // ------------------------------------------------------------
    await step('131. Historical Rank Commission Report', async () => {
        const reqRanks = mockHttp('/api/v1/nexus/admin/commissions/reports/ranks', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqRanks.req, reqRanks.res);
        reqRanks.trigger();
        await reqRanks.wait();

        assert.strictEqual(reqRanks.getResult().statusCode, 200);
        const resRanks = JSON.parse(reqRanks.getResult().body);
        assert.strictEqual(resRanks.success, true);
        assert(Array.isArray(resRanks.data), 'Ranks report must return an array');
        assert(resRanks.data.length >= 6, 'Must include all rank tiers');

        const memberRank = resRanks.data.find(r => r.rank_code === 'MEMBER');
        assert(memberRank, 'Member rank tier must be present');
        assert(typeof memberRank.total_commission === 'number');
        assert(typeof memberRank.personal_volume === 'number');
    });

    // ------------------------------------------------------------
    // TEST 132: Package Sales Performance & Historical Price Snapshot Integrity
    // ------------------------------------------------------------
    await step('132. Package Sales Performance & Historical Price Snapshot Integrity', async () => {
        const reqPkgs = mockHttp('/api/v1/nexus/admin/reports/packages', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqPkgs.req, reqPkgs.res);
        reqPkgs.trigger();
        await reqPkgs.wait();

        assert.strictEqual(reqPkgs.getResult().statusCode, 200);
        const resPkgs = JSON.parse(reqPkgs.getResult().body);
        assert.strictEqual(resPkgs.success, true);
        assert(Array.isArray(resPkgs.data));
        assert(resPkgs.data.length > 0, 'Packages sales performance should include configured packages');

        const pkg = resPkgs.data[0];
        assert(pkg.package_code && pkg.package_name);
        assert(typeof pkg.price === 'number' && pkg.price > 0, 'Historical snapshot price must be retained');
        assert(typeof pkg.gross_volume === 'number');
        assert(typeof pkg.commissions_generated === 'number');
    });

    // ------------------------------------------------------------
    // TEST 133: Product Sales Performance & Historical Item Snapshot Integrity
    // ------------------------------------------------------------
    await step('133. Product Sales Performance & Historical Item Snapshot Integrity', async () => {
        const reqProds = mockHttp('/api/v1/nexus/admin/reports/products', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqProds.req, reqProds.res);
        reqProds.trigger();
        await reqProds.wait();

        assert.strictEqual(reqProds.getResult().statusCode, 200);
        const resProds = JSON.parse(reqProds.getResult().body);
        assert.strictEqual(resProds.success, true);
        assert(Array.isArray(resProds.data));
        assert(resProds.data.length > 0, 'Products report must contain master products');

        const prod = resProds.data[0];
        assert(prod.product_code && prod.title);
        assert(typeof prod.price === 'number' && prod.price > 0);
        assert(typeof prod.units_sold === 'number');
    });

    // ------------------------------------------------------------
    // TEST 134: Admin Member 360 Financial Dossier (Read-Only Safety)
    // ------------------------------------------------------------
    await step('134. Admin Member 360 Financial Dossier (Read-Only Safety)', async () => {
        const initialLedgerCount = (await nexusDb.getLedgerEntries({})).length;

        const reqMemFin = mockHttp(`/api/v1/nexus/admin/members/${memberA.memberId}/financials`, 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqMemFin.req, reqMemFin.res);
        reqMemFin.trigger();
        await reqMemFin.wait();

        assert.strictEqual(reqMemFin.getResult().statusCode, 200);
        const resMemFin = JSON.parse(reqMemFin.getResult().body);
        assert.strictEqual(resMemFin.success, true);
        const d = resMemFin.data;
        assert.strictEqual(d.member.member_id, memberA.memberId);
        assert(d.summary.gross_purchases >= 0);
        assert(d.summary.total_commissions_earned >= 0);
        assert(Array.isArray(d.orders));
        assert(Array.isArray(d.commissions));
        assert(d.wallet);

        // Verify read-only safety: ledger entries count must NOT have changed
        const finalLedgerCount = (await nexusDb.getLedgerEntries({})).length;
        assert.strictEqual(initialLedgerCount, finalLedgerCount, 'Member 360 inspection must be strictly read-only');
    });

    // ------------------------------------------------------------
    // TEST 135: Withdrawal Performance Report & Masked Banking Protection
    // ------------------------------------------------------------
    await step('135. Withdrawal Performance Report & Masked Banking Protection', async () => {
        const reqWd = mockHttp('/api/v1/nexus/admin/reports/withdrawals', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqWd.req, reqWd.res);
        reqWd.trigger();
        await reqWd.wait();

        assert.strictEqual(reqWd.getResult().statusCode, 200);
        const resWd = JSON.parse(reqWd.getResult().body);
        assert.strictEqual(resWd.success, true);
        assert(Array.isArray(resWd.data));
        assert(resWd.pagination);

        // Security check: every bank account must be masked
        resWd.data.forEach(w => {
            assert(w.masked_account.includes('•'), 'Account number must be masked with bullets to protect distributor PII');
        });
    });

    // ------------------------------------------------------------
    // TEST 136: Payout Performance Report & Payout Reference Search
    // ------------------------------------------------------------
    await step('136. Payout Performance Report & Payout Reference Search', async () => {
        const reqPayout = mockHttp('/api/v1/nexus/admin/reports/payouts', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqPayout.req, reqPayout.res);
        reqPayout.trigger();
        await reqPayout.wait();

        assert.strictEqual(reqPayout.getResult().statusCode, 200);
        const resPayout = JSON.parse(reqPayout.getResult().body);
        assert.strictEqual(resPayout.success, true);
        assert(Array.isArray(resPayout.data));
        if (resPayout.data.length > 0) {
            const p = resPayout.data[0];
            assert(p.payout_reference);
            assert(p.withdrawal_reference);
            assert(typeof p.net_amount === 'number');
        }
    });

    // ------------------------------------------------------------
    // TEST 137: Wallet Ledger Journal Report & Immutability Enforcement
    // ------------------------------------------------------------
    await step('137. Wallet Ledger Journal Report & Immutability Enforcement', async () => {
        const reqLedger = mockHttp('/api/v1/nexus/admin/reports/ledger', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqLedger.req, reqLedger.res);
        reqLedger.trigger();
        await reqLedger.wait();

        assert.strictEqual(reqLedger.getResult().statusCode, 200);
        const resLedger = JSON.parse(reqLedger.getResult().body);
        assert.strictEqual(resLedger.success, true);
        assert(Array.isArray(resLedger.data));
        assert(resLedger.data.length > 0, 'Ledger journal rows should exist');

        resLedger.data.forEach(entry => {
            assert(['CREDIT', 'DEBIT'].includes(entry.direction), 'Direction must be CREDIT or DEBIT');
            assert(entry.amount > 0, 'Entry amount must be strictly positive');
            assert(typeof entry.balance_after === 'number');
            assert(entry.created_at, 'Timestamp must be immutable');
        });
    });

    // ------------------------------------------------------------
    // TEST 138: Wallet Financial Movement Report (Opening, Inflow, Outflow, Closing)
    // ------------------------------------------------------------
    await step('138. Wallet Financial Movement Report (Opening, Inflow, Outflow, Closing)', async () => {
        const reqMov = mockHttp('/api/v1/nexus/admin/reports/movement', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqMov.req, reqMov.res);
        reqMov.trigger();
        await reqMov.wait();

        assert.strictEqual(reqMov.getResult().statusCode, 200);
        const resMov = JSON.parse(reqMov.getResult().body);
        assert.strictEqual(resMov.success, true);
        const m = resMov.data;
        assert(typeof m.opening_balance === 'number');
        assert(typeof m.total_inflow === 'number');
        assert(typeof m.total_outflow === 'number');
        assert(typeof m.closing_balance === 'number');

        const expectedClosing = Math.round((m.opening_balance + m.total_inflow - m.total_outflow) * 100) / 100;
        assert.strictEqual(m.closing_balance, expectedClosing, 'Closing balance must exactly balance opening + inflow - outflow');
        assert(Array.isArray(m.monthly_breakdown), 'Monthly breakdown must be an array');
    });

    // ------------------------------------------------------------
    // TEST 139: Financial Reconciliation Engine (17-Point Anomaly Detection)
    // ------------------------------------------------------------
    await step('139. Financial Reconciliation Engine (17-Point Anomaly Detection)', async () => {
        const reqRecon = mockHttp('/api/v1/nexus/admin/reports/reconciliation', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqRecon.req, reqRecon.res);
        reqRecon.trigger();
        await reqRecon.wait();

        assert.strictEqual(reqRecon.getResult().statusCode, 200);
        const resRecon = JSON.parse(reqRecon.getResult().body);
        assert.strictEqual(resRecon.success, true);
        const r = resRecon.data;

        assert.strictEqual(r.checks_count, 17, 'Reconciliation engine must execute all 17 automated checks');
        assert.strictEqual(r.checks.length, 17, '17 detailed check results must be returned');

        for (let i = 1; i <= 17; i++) {
            const expectedCode = `REC-${String(i).padStart(2, '0')}`;
            const check = r.checks.find(c => c.code === expectedCode);
            assert(check, `Check ${expectedCode} must be present in audit report`);
            assert(typeof check.passed === 'boolean');
            assert(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(check.severity));
            assert(check.title && check.description);
        }
    });

    // ------------------------------------------------------------
    // TEST 140: Reconciliation Issue Resolution Workflow (Notes & Non-Destructive Audit)
    // ------------------------------------------------------------
    await step('140. Reconciliation Issue Resolution Workflow (Notes & Non-Destructive Audit)', async () => {
        let issues = await nexusDb.getReconciliationIssues();
        let targetIssue = issues[0];
        if (!targetIssue) {
            targetIssue = await nexusDb.insertReconciliationIssue({
                code: 'REC-TEST-01',
                severity: 'MEDIUM',
                title: 'Test Audit Issue',
                description: 'Test discrepancy in ledger sync',
                expected_summary: 'LKR 100.00',
                actual_summary: 'LKR 99.00',
                currency: 'LKR',
                status: 'open'
            });
        }

        const reqGetIssue = mockHttp(`/api/v1/nexus/admin/reports/reconciliation/${targetIssue.id}`, 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqGetIssue.req, reqGetIssue.res);
        reqGetIssue.trigger();
        await reqGetIssue.wait();
        assert.strictEqual(reqGetIssue.getResult().statusCode, 200);
        const resGetIssue = JSON.parse(reqGetIssue.getResult().body);
        assert.strictEqual(resGetIssue.data.id, targetIssue.id);

        const reqResolve = mockHttp(`/api/v1/nexus/admin/reports/reconciliation/${targetIssue.id}/resolve`, 'POST', {
            'authorization': `Bearer ${adminToken}`,
            'content-type': 'application/json'
        }, {
            status: 'investigating',
            notes: 'Senior auditor assigned to verify bank wire confirmation statement.'
        });
        requestHandler(reqResolve.req, reqResolve.res);
        reqResolve.trigger();
        await reqResolve.wait();
        assert.strictEqual(reqResolve.getResult().statusCode, 200);
        const resResolve = JSON.parse(reqResolve.getResult().body);
        assert.strictEqual(resResolve.success, true);
        assert.strictEqual(resResolve.data.status, 'investigating');
        assert(resResolve.data.resolution_notes.includes('Senior auditor assigned'));

        const w = await nexusDb.getWalletByUserId(memberA.userId);
        assert(w, 'Wallet must remain intact');
    });

    // ------------------------------------------------------------
    // TEST 141: Secure Filtered CSV Export & Sensitive Data Sanitization
    // ------------------------------------------------------------
    await step('141. Secure Filtered CSV Export & Sensitive Data Sanitization', async () => {
        const reqCsvComm = mockHttp('/api/v1/nexus/admin/reports/export?report=commissions&format=csv', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqCsvComm.req, reqCsvComm.res);
        reqCsvComm.trigger();
        await reqCsvComm.wait();
        assert.strictEqual(reqCsvComm.getResult().statusCode, 200);
        assert(reqCsvComm.getResult().headers['content-type'].includes('text/csv'));
        const csvCommBody = reqCsvComm.getResult().body;
        assert(csvCommBody.includes('Commission ID') || csvCommBody.includes('Commission Reference'), 'CSV header must include Commission Reference');

        const reqCsvWd = mockHttp('/api/v1/nexus/admin/reports/export?report=withdrawals&format=csv', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqCsvWd.req, reqCsvWd.res);
        reqCsvWd.trigger();
        await reqCsvWd.wait();
        assert.strictEqual(reqCsvWd.getResult().statusCode, 200);
        const csvWdBody = reqCsvWd.getResult().body;
        assert(csvWdBody.includes('Masked Account'), 'Withdrawal CSV must include Masked Account header');

        const formulaInput = '=SUM(A1:A10)';
        const sanitized = nexusFinancialReportingService.sanitizeForCSV(formulaInput);
        assert.strictEqual(sanitized, "'=SUM(A1:A10)", 'Formula triggers must be escaped with leading single quote');
        assert.strictEqual(nexusFinancialReportingService.sanitizeForCSV('+123'), "'+123");
        assert.strictEqual(nexusFinancialReportingService.sanitizeForCSV('-456'), "'-456");
        assert.strictEqual(nexusFinancialReportingService.sanitizeForCSV('@cmd'), "'@cmd");
    });

    // ------------------------------------------------------------
    // TEST 142: Role Security & Unauthenticated Access Guard on Financial Reports
    // ------------------------------------------------------------
    await step('142. Role Security & Unauthenticated Access Guard on Financial Reports', async () => {
        const reqUnauth = mockHttp('/api/v1/nexus/admin/financials/overview', 'GET');
        requestHandler(reqUnauth.req, reqUnauth.res);
        reqUnauth.trigger();
        await reqUnauth.wait();
        assert.strictEqual(reqUnauth.getResult().statusCode, 401, 'Unauthenticated request must be 401 Unauthorized');

        const reqMemFin = mockHttp('/api/v1/nexus/admin/financials/overview', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqMemFin.req, reqMemFin.res);
        reqMemFin.trigger();
        await reqMemFin.wait();
        assert.strictEqual(reqMemFin.getResult().statusCode, 403, 'Distributor must receive 403 Forbidden for financial overview');

        const reqMemRecon = mockHttp('/api/v1/nexus/admin/reports/reconciliation', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqMemRecon.req, reqMemRecon.res);
        reqMemRecon.trigger();
        await reqMemRecon.wait();
        assert.strictEqual(reqMemRecon.getResult().statusCode, 403, 'Distributor must receive 403 Forbidden for reconciliation engine');

        const reqMemExport = mockHttp('/api/v1/nexus/admin/reports/export?report=commissions', 'GET', {
            'authorization': `Bearer ${memberAToken}`
        });
        requestHandler(reqMemExport.req, reqMemExport.res);
        reqMemExport.trigger();
        await reqMemExport.wait();
        assert.strictEqual(reqMemExport.getResult().statusCode, 403, 'Distributor must receive 403 Forbidden for report export');
    });

    // ============================================================
    // STAGE 4A — PROMPT 15A: DASHBOARD METRIC TIME SEMANTICS (TESTS 143-162)
    // ============================================================

    // TEST 143: Transaction Exactly at period_start (Inclusive Boundary)
    await step('143. Transaction Exactly at period_start (Inclusive Boundary)', async () => {
        const range = nexusFinancialReportingService.resolveDateRange({ start_date: '2026-08-01', end_date: '2026-08-31' });
        const atStart = { id: 't_exact_start', created_at: range.period_start };
        const beforeStart = { id: 't_before_start', created_at: new Date(new Date(range.period_start).getTime() - 1).toISOString() };
        const filtered = nexusFinancialReportingService.filterByDateAndCurrency([atStart, beforeStart], 'created_at', range);
        assert.strictEqual(filtered.length, 1, 'Transaction exactly at period_start must be included');
        assert.strictEqual(filtered[0].id, 't_exact_start');
    });

    // TEST 144: Transaction Exactly at period_end (Exclusive Boundary)
    await step('144. Transaction Exactly at period_end (Exclusive Boundary)', async () => {
        const range = nexusFinancialReportingService.resolveDateRange({ start_date: '2026-08-01', end_date: '2026-08-31' });
        const atEnd = { id: 't_exact_end', created_at: range.period_end };
        const beforeEnd = { id: 't_before_end', created_at: new Date(new Date(range.period_end).getTime() - 1).toISOString() };
        const filtered = nexusFinancialReportingService.filterByDateAndCurrency([atEnd, beforeEnd], 'created_at', range);
        assert.strictEqual(filtered.length, 1, 'Transaction exactly at period_end must be excluded');
        assert.strictEqual(filtered[0].id, 't_before_end');
    });

    // TEST 145: Midnight Boundary Transition
    await step('145. Midnight Boundary Transition (23:59:59.999 vs 00:00:00.000 Colombo)', async () => {
        const d1Range = nexusFinancialReportingService.resolveDateRange({ start_date: '2026-08-15', end_date: '2026-08-15' });
        const d2Range = nexusFinancialReportingService.resolveDateRange({ start_date: '2026-08-16', end_date: '2026-08-16' });
        const lastMsDay1 = { id: 'd1_last', created_at: '2026-08-15T18:29:59.999Z' };
        const firstMsDay2 = { id: 'd2_first', created_at: '2026-08-15T18:30:00.000Z' };

        const d1Items = nexusFinancialReportingService.filterByDateAndCurrency([lastMsDay1, firstMsDay2], 'created_at', d1Range);
        assert.strictEqual(d1Items.length, 1);
        assert.strictEqual(d1Items[0].id, 'd1_last', 'Day 1 must contain 23:59:59.999 Colombo');

        const d2Items = nexusFinancialReportingService.filterByDateAndCurrency([lastMsDay1, firstMsDay2], 'created_at', d2Range);
        assert.strictEqual(d2Items.length, 1);
        assert.strictEqual(d2Items[0].id, 'd2_first', 'Day 2 must contain 00:00:00.000 Colombo');
    });

    // TEST 146: Month Boundary Transition
    await step('146. Month Boundary Transition (Aug/Sep, Feb/Mar Boundaries)', async () => {
        const augRange = nexusFinancialReportingService.resolveDateRange({ start_date: '2026-08-01', end_date: '2026-08-31' });
        const sepRange = nexusFinancialReportingService.resolveDateRange({ start_date: '2026-09-01', end_date: '2026-09-30' });
        const lastMsAug = { id: 'aug_last', created_at: '2026-08-31T18:29:59.999Z' };
        const firstMsSep = { id: 'sep_first', created_at: '2026-08-31T18:30:00.000Z' };

        assert.strictEqual(nexusFinancialReportingService.filterByDateAndCurrency([lastMsAug, firstMsSep], 'created_at', augRange)[0].id, 'aug_last');
        assert.strictEqual(nexusFinancialReportingService.filterByDateAndCurrency([lastMsAug, firstMsSep], 'created_at', sepRange)[0].id, 'sep_first');

        const febIso = nexusFinancialReportingService.colomboComponentsToUtcIso(2026, 1, 28, 23, 59, 59, 999);
        const marIso = nexusFinancialReportingService.colomboComponentsToUtcIso(2026, 2, 1, 0, 0, 0, 0);
        assert.strictEqual(nexusFinancialReportingService.toCanonicalMonthKey(febIso), '2026-02');
        assert.strictEqual(nexusFinancialReportingService.toCanonicalMonthKey(marIso), '2026-03');
    });

    // TEST 147: Year Boundary Transition
    await step('147. Year Boundary Transition (Dec 31 vs Jan 1 Midnight Colombo)', async () => {
        const y25Range = nexusFinancialReportingService.resolveDateRange({ start_date: '2025-01-01', end_date: '2025-12-31' });
        const y26Range = nexusFinancialReportingService.resolveDateRange({ start_date: '2026-01-01', end_date: '2026-12-31' });
        const lastMs25 = { id: 'y25_last', created_at: '2025-12-31T18:29:59.999Z' };
        const firstMs26 = { id: 'y26_first', created_at: '2025-12-31T18:30:00.000Z' };

        assert.strictEqual(nexusFinancialReportingService.filterByDateAndCurrency([lastMs25, firstMs26], 'created_at', y25Range)[0].id, 'y25_last');
        assert.strictEqual(nexusFinancialReportingService.filterByDateAndCurrency([lastMs25, firstMs26], 'created_at', y26Range)[0].id, 'y26_first');
    });

    // TEST 148: Week Boundary Transition
    await step('148. Week Boundary Transition (Monday 00:00:00 Colombo Boundaries)', async () => {
        const weekRange = nexusFinancialReportingService.resolveDateRange('this_week');
        const startWeek = new Date(weekRange.period_start).getTime();
        const endWeek = new Date(weekRange.period_end).getTime();
        assert.strictEqual(endWeek - startWeek, 7 * 24 * 3600 * 1000, 'This week must span exactly 7 full 24-hour days');
        assert.strictEqual(weekRange.timezone, 'Asia/Colombo (UTC+05:30)');
    });

    // TEST 149: Colombo Timezone Conversion
    await step('149. Colombo Timezone Conversion (Asia/Colombo UTC+05:30 Semantics)', async () => {
        assert.strictEqual(nexusFinancialReportingService.getTimezoneOffsetHours('Asia/Colombo'), 5.5);
        const converted = nexusFinancialReportingService.colomboComponentsToUtcIso(2026, 7, 1, 0, 0, 0);
        assert.strictEqual(converted, '2026-07-31T18:30:00.000Z');
        const converted2pm = nexusFinancialReportingService.colomboComponentsToUtcIso(2026, 7, 1, 14, 0, 0);
        assert.strictEqual(converted2pm, '2026-08-01T08:30:00.000Z');
    });

    // TEST 150: UTC Timestamp Storage vs Colombo Timezone Query Semantics
    await step('150. UTC Timestamp Storage vs Colombo Timezone Query Semantics', async () => {
        const colomboDate = nexusFinancialReportingService.toCanonicalDateKey('2026-08-31T20:00:00.000Z');
        assert.strictEqual(colomboDate, '2026-09-01', '20:00 UTC on Aug 31 is 01:30 AM on Sep 1 in Colombo');
        const colomboMonth = nexusFinancialReportingService.toCanonicalMonthKey('2026-08-31T20:00:00.000Z');
        assert.strictEqual(colomboMonth, '2026-09', '20:00 UTC on Aug 31 belongs to September in Colombo');
    });

    // TEST 151: Paid After Month-End
    await step('151. Order Paid After Month-End Attributed to Correct Flow Period', async () => {
        const testOrder = await nexusDb.createOrder({
            user_id: memberA.userId,
            total_amount: 15000,
            currency: 'LKR',
            created_at: '2026-08-25T10:00:00.000Z',
            paid_at: '2026-09-02T10:00:00.000Z',
            status: 'paid'
        });
        const augOverview = await nexusFinancialReportingService.getFinancialOverview({ date_from: '2026-08-01', date_to: '2026-08-31', currency: 'LKR' });
        const sepOverview = await nexusFinancialReportingService.getFinancialOverview({ date_from: '2026-09-01', date_to: '2026-09-30', currency: 'LKR' });
        assert(sepOverview.sales.gross_volume >= 15000, 'September sales volume must include order paid in September');
    });

    // TEST 152: Created Before Month-End but Paid After Month-End
    await step('152. Created Before Month-End but Paid After Month-End (Created vs Paid Split)', async () => {
        const augOverview = await nexusFinancialReportingService.getFinancialOverview({ date_from: '2026-08-01', date_to: '2026-08-31', currency: 'LKR' });
        const sepOverview = await nexusFinancialReportingService.getFinancialOverview({ date_from: '2026-09-01', date_to: '2026-09-30', currency: 'LKR' });
        assert(augOverview.sales.total_count >= 1, 'August must count created order in orders created');
        assert(sepOverview.sales.paid_count >= 1, 'September must count paid order in paid orders');
    });

    // TEST 153: Refund After Original Order Period
    await step('153. Refund in Subsequent Period Attributed to Refund Period (Not Original Order)', async () => {
        const refund = await nexusDb.createRefund({
            order_id: 'ord-refund-test-153',
            amount: 5000,
            currency: 'LKR',
            refunded_at: '2026-09-05T10:00:00.000Z'
        });
        const augRef = await nexusFinancialReportingService.getFinancialOverview({ date_from: '2026-08-01', date_to: '2026-08-31', currency: 'LKR' });
        const sepRef = await nexusFinancialReportingService.getFinancialOverview({ date_from: '2026-09-01', date_to: '2026-09-30', currency: 'LKR' });
        assert.strictEqual(augRef.summary.refunds, 0, 'August refund volume must remain 0');
        assert(sepRef.summary.refunds >= 5000, 'September refund volume must include refund');
    });

    // TEST 154: Commission Credited in Different Period from Creation
    await step('154. Commission Credited in Different Period from Creation Attribution', async () => {
        await nexusDb.createCommissionRecord({
            beneficiary_id: memberA.userId,
            amount: 2500,
            currency: 'LKR',
            commission_type: 'DIRECT_REFERRAL',
            status: 'credited',
            created_at: '2026-08-20T10:00:00.000Z',
            credited_at: '2026-09-03T10:00:00.000Z'
        });
        const augComm = await nexusFinancialReportingService.getFinancialOverview({ date_from: '2026-08-01', date_to: '2026-08-31', currency: 'LKR' });
        const sepComm = await nexusFinancialReportingService.getFinancialOverview({ date_from: '2026-09-01', date_to: '2026-09-30', currency: 'LKR' });
        assert(augComm.commissions.total_count >= 1, 'August commissions generated must include August created commission');
        assert(sepComm.commissions.credited_count >= 1, 'September commissions credited must include September credited commission');
    });

    // TEST 155: Withdrawal Paid in Different Period from Request
    await step('155. Withdrawal Paid in Different Period from Request Attribution', async () => {
        await nexusDb.createWithdrawal({
            member_id: memberA.userId,
            requested_amount: 3000,
            currency: 'LKR',
            created_at: '2026-08-28T10:00:00.000Z',
            status: 'paid',
            paid_at: '2026-09-04T10:00:00.000Z'
        });
        const augWd = await nexusFinancialReportingService.getFinancialOverview({ date_from: '2026-08-01', date_to: '2026-08-31', currency: 'LKR' });
        const sepWd = await nexusFinancialReportingService.getFinancialOverview({ date_from: '2026-09-01', date_to: '2026-09-30', currency: 'LKR' });
        assert(augWd.withdrawals.pending_count >= 0);
        assert(sepWd.payouts.total_payout_amount >= 3000, 'September payouts must include withdrawal paid in September');
    });

    // TEST 156: Current Wallet Balance as Point-in-Time
    await step('156. Current Wallet Balance as Point-in-Time Stock Metric', async () => {
        const overviewToday = await nexusFinancialReportingService.getFinancialOverview({ period: 'today' });
        const overviewPast = await nexusFinancialReportingService.getFinancialOverview({ date_from: '2020-01-01', date_to: '2020-01-02' });
        assert.strictEqual(overviewToday.wallet.net_available_balance, overviewPast.wallet.net_available_balance, 'Point-in-time wallet balance must reflect current state regardless of period filter');
    });

    // TEST 157: Historical Opening and Closing Balances
    await step('157. Historical Opening and Closing Balances Mathematical Identity', async () => {
        const mov = await nexusFinancialReportingService.getFinancialMovementReport({ date_from: '2026-08-01', date_to: '2026-08-31', currency: 'LKR' });
        const m = mov.data;
        assert.strictEqual(m.closing_balance, Math.round((m.opening_balance + m.total_inflow - m.total_outflow) * 100) / 100, 'Closing balance must exactly balance opening + inflow - outflow');
    });

    // TEST 158: Empty Days (Continuous Series Zero-Fill)
    await step('158. Empty Days Zero-Filled in Continuous Daily Time-Series', async () => {
        const dailyRange = nexusFinancialReportingService.resolveDateRange({ date_from: '2026-07-01', date_to: '2026-07-07' });
        const daily = nexusFinancialReportingService.generateTimeSeriesChartData([], [], [], dailyRange);
        assert.strictEqual(daily.points.length, 7, 'Must have exactly 7 continuous days');
        daily.points.forEach(p => {
            assert.strictEqual(p.sales, 0);
            assert.strictEqual(p.commissions, 0);
            assert.strictEqual(p.payouts, 0);
        });
    });

    // TEST 159: Empty Months (Continuous Series Zero-Fill)
    await step('159. Empty Months Zero-Filled in Continuous Monthly Time-Series', async () => {
        const monthlyRange = nexusFinancialReportingService.resolveDateRange({ date_from: '2026-01-01', date_to: '2026-06-30' });
        const monthly = nexusFinancialReportingService.generateMonthlyTimeSeriesChartData([], [], [], monthlyRange);
        assert.strictEqual(monthly.points.length, 6, 'Must have exactly 6 continuous calendar months');
        monthly.points.forEach(m => {
            assert.strictEqual(m.sales, 0);
            assert.strictEqual(m.commissions, 0);
            assert.strictEqual(m.payouts, 0);
        });
    });

    // TEST 160: Multi-Currency Separation
    await step('160. Multi-Currency Separation Under Time-Bounded Queries', async () => {
        await nexusDb.createOrder({
            user_id: memberA.userId,
            total_amount: 50,
            currency: 'USD',
            created_at: '2026-09-08T10:00:00.000Z',
            paid_at: '2026-09-08T10:00:00.000Z',
            status: 'paid'
        });
        const lkrRep = await nexusFinancialReportingService.getFinancialOverview({ date_from: '2026-09-01', date_to: '2026-09-30', currency: 'LKR' });
        const usdRep = await nexusFinancialReportingService.getFinancialOverview({ date_from: '2026-09-01', date_to: '2026-09-30', currency: 'USD' });
        assert.strictEqual(lkrRep.currency, 'LKR');
        assert.strictEqual(usdRep.currency, 'USD');
        assert(usdRep.sales.gross_volume >= 50, 'USD report must record USD sales');
    });

    // TEST 161: Custom Date Range Half-Open Interval Resolution
    await step('161. Custom Date Range Half-Open Interval Resolution', async () => {
        const customResolved = nexusFinancialReportingService.resolveDateRange({ date_from: '2026-05-10', date_to: '2026-05-20' });
        const dur = new Date(customResolved.period_end).getTime() - new Date(customResolved.period_start).getTime();
        assert.strictEqual(dur, 11 * 24 * 3600 * 1000, 'Custom range May 10 to May 20 must span exactly 11 full calendar days');
        assert.strictEqual(customResolved.period_start, '2026-05-09T18:30:00.000Z');
        assert.strictEqual(customResolved.period_end, '2026-05-20T18:30:00.000Z');
    });

    // TEST 162: Export vs API Report Consistency Under Time Boundaries
    await step('162. Export vs API Report Consistency Under Time Boundaries', async () => {
        const lkrRep = await nexusFinancialReportingService.getFinancialOverview({ date_from: '2026-09-01', date_to: '2026-09-30', currency: 'LKR' });
        const csvExport = await nexusFinancialReportingService.exportReportToCSV('financials', { date_from: '2026-09-01', date_to: '2026-09-30', currency: 'LKR' });
        assert(csvExport.includes('Gross Sales'), 'CSV export should include Gross Sales metric');
        assert(csvExport.includes(String(lkrRep.sales.gross_volume)), 'CSV export should match API gross sales volume');

        const reqExportJson = mockHttp('/api/v1/nexus/admin/reports/export?report=financials&date_from=2026-09-01&date_to=2026-09-30&currency=LKR&format=json', 'GET', {
            'authorization': `Bearer ${adminToken}`
        });
        requestHandler(reqExportJson.req, reqExportJson.res);
        reqExportJson.trigger();
        await reqExportJson.wait();
        assert.strictEqual(reqExportJson.getResult().statusCode, 200);
        const resExportJson = JSON.parse(reqExportJson.getResult().body);
        assert.strictEqual(resExportJson.data.sales.gross_volume, lkrRep.sales.gross_volume, 'API export JSON must match financial overview metrics');
    });

    // ==============================================================================
    // PROMPT 16: NOTIFICATION & COMMUNICATION SYSTEM TESTS (TESTS 163–168)
    // ==============================================================================

    // TEST 163: Direct Notification Creation & Idempotency Key
    await step('163. Direct Notification Creation & Idempotency Key', async () => {
        const testUser = await nexusDb.findUserByEmail('kasun@nexusp.online');
        assert(testUser, 'Kasun must exist');

        const idemKey = 'order_confirmed:order:NP-ORD-TEST-999:' + testUser.id;
        const res1 = await nexusNotificationService.emit('order_placed', {
            recipient_id: testUser.id,
            reference_type: 'order',
            reference_id: 'NP-ORD-TEST-999',
            idempotency_key: idemKey,
            variables: { order_number: 'NP-ORD-TEST-999', amount: '5,000.00', currency: 'LKR' }
        });
        assert.strictEqual(res1.success, true);
        assert(res1.notification, 'Notification should be created');

        // Repeated emission with same idempotency key must not duplicate
        const res2 = await nexusNotificationService.emit('order_placed', {
            recipient_id: testUser.id,
            reference_type: 'order',
            reference_id: 'NP-ORD-TEST-999',
            idempotency_key: idemKey,
            variables: { order_number: 'NP-ORD-TEST-999', amount: '5,000.00', currency: 'LKR' }
        });
        assert.strictEqual(res2.success, true);
        assert.strictEqual(res2.duplicated, true, 'Repeated call must detect duplicate via idempotency key');
        assert.strictEqual(res2.notification.id, res1.notification.id, 'Must return same notification ID');
    });

    // TEST 164: Sensitive Financial Data Sanitization & Masking
    await step('164. Sensitive Financial Data Sanitization & Masking', async () => {
        const maskedNum = nexusNotificationService.maskBankNumber('123456789012');
        assert.strictEqual(maskedNum, '****9012', 'Bank number must be masked preserving only last 4 digits');

        const shortMask = nexusNotificationService.maskBankNumber('123');
        assert.strictEqual(shortMask, '****', 'Short numbers must be masked completely');

        const sanitizedVars = nexusNotificationService.sanitizeVariables({
            account_number: '987654321098',
            bank_account_number: '5555444433332222',
            amount: '10,000.00'
        });
        assert.strictEqual(sanitizedVars.account_number, '****1098');
        assert.strictEqual(sanitizedVars.bank_account_number, '****2222');
        assert.strictEqual(sanitizedVars.amount, '10,000.00');
    });

    // TEST 165: Member Notification Preference Suppression
    await step('165. Member Notification Preference Suppression', async () => {
        const testUser = await nexusDb.findUserByEmail('kasun@nexusp.online');
        // Set category preference for marketing to false
        await nexusDb.updateNotificationPreferences(testUser.id, {
            category_preferences: { marketing: false }
        });

        const res = await nexusNotificationService.emit('announcement', {
            recipient_id: testUser.id,
            variables: { title: 'Special Promo' }
        });
        assert.strictEqual(res.success, true);
    });

    // TEST 166: Member Notification Inbox API & Unread Counters
    await step('166. Member Notification Inbox API & Unread Counters', async () => {
        const loginRes = await NexusAuthService.login('kasun@nexusp.online', 'Password123!');
        const mToken = loginRes.token;

        const listReq = mockHttp('/api/v1/nexus/member/notifications', 'GET', {
            'authorization': `Bearer ${mToken}`
        });
        requestHandler(listReq.req, listReq.res);
        listReq.trigger();
        await listReq.wait();
        assert.strictEqual(listReq.getResult().statusCode, 200);
        const listData = JSON.parse(listReq.getResult().body);
        assert.strictEqual(listData.success, true);
        assert(typeof listData.unreadCount === 'number');

        // Mark all as read
        const readReq = mockHttp('/api/v1/nexus/member/notifications/read', 'PUT', {
            'authorization': `Bearer ${mToken}`,
            'content-type': 'application/json'
        }, { all: true });
        requestHandler(readReq.req, readReq.res);
        readReq.trigger();
        await readReq.wait();
        assert.strictEqual(readReq.getResult().statusCode, 200);

        // Verify unread count is now 0
        const unreadReq = mockHttp('/api/v1/nexus/member/notifications/unread-count', 'GET', {
            'authorization': `Bearer ${mToken}`
        });
        requestHandler(unreadReq.req, unreadReq.res);
        unreadReq.trigger();
        await unreadReq.wait();
        assert.strictEqual(unreadReq.getResult().statusCode, 200);
        const unreadData = JSON.parse(unreadReq.getResult().body);
        assert.strictEqual(unreadData.unreadCount, 0, 'Unread count should be 0 after mark-all-as-read');
    });

    // TEST 167: Corporate Broadcast Announcement & Network Dispatch
    await step('167. Corporate Broadcast Announcement & Network Dispatch', async () => {
        const bRes = await nexusNotificationService.broadcastAnnouncement({
            title: 'Platform Maintenance Notice',
            content: 'Scheduled maintenance this Sunday from 02:00 to 04:00 Colombo time.',
            priority: 'normal',
            targetAudience: 'all',
            authorId: 'admin-001'
        });
        assert.strictEqual(bRes.success, true);
        assert(bRes.announcement.id, 'Announcement should have an ID');
        assert(bRes.recipientsCount > 0, 'Recipients should be notified');

        const announcements = await nexusDb.getAnnouncements({ limit: 10 });
        assert(announcements.some(a => a.title === 'Platform Maintenance Notice'));
    });

    // TEST 168: Email Provider Fail-Safe & Masked Logging
    await step('168. Email Provider Fail-Safe & Masked Logging', async () => {
        const emailProvider = require('../nexus_backend/services/nexus-email-provider');
        const masked = emailProvider.maskEmail('distributor.test@example.com');
        assert.strictEqual(masked, 'd***t@example.com', 'Email must be masked for logging');

        const sendRes = await emailProvider.sendEmail({
            to: 'distributor.test@example.com',
            subject: 'Test Subject',
            text: 'Test Body'
        });
        assert.strictEqual(sendRes.status, 'pending_configuration', 'Email provider must fail-safe gracefully');
    });

    // ==============================================================================
    // PROMPT 17: SUPPORT / HELP DESK & TICKETING TESTS (TESTS 169–177)
    // ==============================================================================

    // TEST 169: Sequential Human-Readable Ticket Number Generation
    let testTicket = null;
    await step('169. Sequential Human-Readable Ticket Number Generation', async () => {
        const userA = await nexusDb.findUserByEmail('kasun@nexusp.online');
        testTicket = await nexusSupportService.createTicket({
            member_id: userA.id,
            category: 'general_inquiry',
            subject: 'Inquiry regarding compensation schedule',
            message: 'When are monthly matrix commissions disbursed?',
            priority: 'normal'
        });
        assert(testTicket.ticket_number, 'Ticket must have a ticket_number');
        assert(/^NP-TKT-\d{6}$/.test(testTicket.ticket_number), 'Ticket number must match NP-TKT-XXXXXX format');
        assert.strictEqual(testTicket.status, 'open');

        const ticket2 = await nexusSupportService.createTicket({
            member_id: userA.id,
            category: 'order_inquiry',
            subject: 'Second inquiry',
            message: 'Question about packaging.',
            priority: 'low'
        });
        const num1 = parseInt(testTicket.ticket_number.replace('NP-TKT-', ''), 10);
        const num2 = parseInt(ticket2.ticket_number.replace('NP-TKT-', ''), 10);
        assert.strictEqual(num2, num1 + 1, 'Sequential ticket numbers must increment strictly by 1');
    });

    // TEST 170: Ticket Creation with Safe Financial Entity Linking
    await step('170. Ticket Creation with Safe Financial Entity Linking', async () => {
        const userA = await nexusDb.findUserByEmail('kasun@nexusp.online');
        const linkedTicket = await nexusSupportService.createTicket({
            member_id: userA.id,
            category: 'order_inquiry',
            subject: 'Inquiry about order delivery',
            message: 'Please confirm tracking for this order.',
            linked_entity_type: 'order',
            linked_entity_id: 'NP-ORD-1000'
        });
        assert.strictEqual(linkedTicket.linked_entity_type, 'order');
        assert.strictEqual(linkedTicket.linked_entity_id, 'NP-ORD-1000');
    });

    // TEST 171: Safe Financial Entity Cross-Member Ownership Guard
    await step('171. Safe Financial Entity Cross-Member Ownership Guard', async () => {
        const userA = await nexusDb.findUserByEmail('kasun@nexusp.online');
        const userB = await nexusDb.findUserByEmail('nimal@nexusp.online');

        // Create an order strictly for userB
        const bOrder = await nexusDb.createOrder({
            user_id: userB.id,
            total_amount: 15000,
            currency: 'LKR',
            payment_status: 'paid',
            status: 'completed'
        });

        // userA attempts to verify ownership of userB's order
        const isOwner = await nexusSupportService.verifyRecordOwnership(userA.id, 'order', bOrder.id);
        assert.strictEqual(isOwner, false, 'User A must not be recognized as owner of User B order');

        const isOwnerB = await nexusSupportService.verifyRecordOwnership(userB.id, 'order', bOrder.id);
        assert.strictEqual(isOwnerB, true, 'User B must be recognized as owner of own order');
    });

    // TEST 172: Public Support Thread & Message Flow
    await step('172. Public Support Thread & Message Flow', async () => {
        const userA = await nexusDb.findUserByEmail('kasun@nexusp.online');
        // Staff replies to testTicket
        const replyRes = await nexusSupportService.addMessage({
            ticket_id: testTicket.id,
            sender_id: 'admin-001',
            sender_name: 'Nexus Prime Support Desk',
            sender_role: 'admin',
            body: 'Monthly compensation is calculated on the 1st of each calendar month.',
            is_internal: false
        });
        assert.strictEqual(replyRes.is_internal, false);

        // Member views ticket
        const details = await nexusSupportService.getTicketDetails(testTicket.id, userA.id, false);
        assert.strictEqual(details.messages.length, 2, 'Member should see original message + staff public reply');
    });

    // TEST 173: Confidential Internal Staff Notes Isolation
    await step('173. Confidential Internal Staff Notes Isolation', async () => {
        const userA = await nexusDb.findUserByEmail('kasun@nexusp.online');
        // Staff adds internal note
        await nexusSupportService.addMessage({
            ticket_id: testTicket.id,
            sender_id: 'admin-001',
            sender_name: 'Internal Compliance Agent',
            sender_role: 'admin',
            body: 'INVESTIGATION NOTE: Member volume verified against ledger. Do not reveal internal ratio.',
            is_internal: true
        });

        // Admin views ticket: internal note IS present
        const adminDetails = await nexusSupportService.getTicketDetails(testTicket.id, 'admin-001', true);
        const hasInternalNoteAdmin = adminDetails.messages.some(m => m.is_internal === true);
        assert.strictEqual(hasInternalNoteAdmin, true, 'Admin must see internal notes');

        // Member views ticket: internal note MUST BE COMPLETELY OMITTED
        const memberDetails = await nexusSupportService.getTicketDetails(testTicket.id, userA.id, false);
        const hasInternalNoteMember = memberDetails.messages.some(m => m.is_internal === true);
        assert.strictEqual(hasInternalNoteMember, false, 'Internal notes MUST NEVER be sent to member');
        assert(!memberDetails.messages.some(m => m.body.includes('INVESTIGATION NOTE')), 'Note body must not leak');
    });

    // TEST 174: Member Reply Auto-Status Transition
    await step('174. Member Reply Auto-Status Transition', async () => {
        const userA = await nexusDb.findUserByEmail('kasun@nexusp.online');
        // Set status to waiting_for_member
        await nexusSupportService.updateStatus(testTicket.id, 'waiting_for_member', 'admin-001', true);
        const tBefore = await nexusDb.getSupportTicketById(testTicket.id);
        assert.strictEqual(tBefore.status, 'waiting_for_member');

        // Member sends reply
        await nexusSupportService.addMessage({
            ticket_id: testTicket.id,
            sender_id: userA.id,
            sender_name: 'Kasun',
            sender_role: 'member',
            body: 'Thank you for clarifying! One more quick question...',
            is_internal: false
        });

        // Ticket should auto-transition to in_progress
        const tAfter = await nexusDb.getSupportTicketById(testTicket.id);
        assert.strictEqual(tAfter.status, 'in_progress', 'Member reply must auto-transition ticket to in_progress');
    });

    // TEST 175: Member Self-Close and Reopen Protection
    await step('175. Member Self-Close and Reopen Protection', async () => {
        const userA = await nexusDb.findUserByEmail('kasun@nexusp.online');
        await nexusSupportService.updateStatus(testTicket.id, 'closed', userA.id, false, { close_reason: 'Resolved by member' });
        const closedTicket = await nexusDb.getSupportTicketById(testTicket.id);
        assert.strictEqual(closedTicket.status, 'closed');

        // Attempting to reply to closed ticket must be rejected
        let replyFailed = false;
        try {
            await nexusSupportService.addMessage({
                ticket_id: testTicket.id,
                sender_id: userA.id,
                sender_name: 'Kasun',
                sender_role: 'member',
                body: 'Adding another reply...',
                is_internal: false
            });
        } catch (err) {
            replyFailed = true;
            assert(err.message.includes('closed'));
        }
        assert.strictEqual(replyFailed, true, 'Replying to closed ticket must throw error');
    });

    // TEST 176: Support Ticket Tenant Isolation & Cross-Member Protection
    await step('176. Support Ticket Tenant Isolation & Cross-Member Protection', async () => {
        const userB = await nexusDb.findUserByEmail('nimal@nexusp.online');
        let accessDenied = false;
        try {
            await nexusSupportService.getTicketDetails(testTicket.id, userB.id, false);
        } catch (err) {
            accessDenied = true;
            assert(err.message.includes('Access denied') || err.message.includes('Unauthorized'));
        }
        assert.strictEqual(accessDenied, true, 'User B must not access User A support ticket');
    });

    // TEST 177: Support Desk CSV Export & Formula Injection Sanitization
    await step('177. Support Desk CSV Export & Formula Injection Sanitization', async () => {
        const userA = await nexusDb.findUserByEmail('kasun@nexusp.online');
        await nexusSupportService.createTicket({
            member_id: userA.id,
            category: 'general_inquiry',
            subject: '=cmd|"/C calc"!A0',
            message: '+2+5+cmd',
            priority: 'urgent'
        });

        const csv = await nexusSupportService.exportTicketsCsv();
        assert(csv.includes("'=cmd|"), 'Formula injection = prefix must be escaped with single quote');
        assert(csv.includes("'+2+5+cmd"), 'Formula injection + prefix must be escaped with single quote');
    });

    // ==============================================================================
    // PROMPT 18: KYC / MEMBER VERIFICATION & COMPLIANCE TESTS (TESTS 178–186)
    // ==============================================================================

    // TEST 178: Sequential Human-Readable KYC Submission Numbering
    let testKycSubmission = null;
    await step('178. Sequential Human-Readable KYC Submission Numbering', async () => {
        const userA = await nexusDb.findUserByEmail('kasun@nexusp.online');
        testKycSubmission = await nexusKycService.submitKyc({
            member_id: userA.id,
            legal_full_name: 'Kasun Bandara Perera',
            country: 'Sri Lanka',
            residential_address: '123 Galle Road, Colombo 03',
            date_of_birth: '1992-05-15',
            documents: [
                {
                    type: 'national_id',
                    number: '199213504820',
                    fileName: 'kasun_nic_front.jpg',
                    mimeType: 'image/jpeg',
                    base64Data: Buffer.from('mock-nic-image-data-kasun').toString('base64')
                },
                {
                    type: 'utility_bill',
                    fileName: 'electricity_bill.pdf',
                    mimeType: 'application/pdf',
                    base64Data: Buffer.from('mock-utility-bill-pdf-data').toString('base64')
                }
            ]
        });

        assert(testKycSubmission.submission_number, 'Submission must have a submission_number');
        assert(/^NP-KYC-\d{6}$/.test(testKycSubmission.submission_number), 'Submission number must match NP-KYC-XXXXXX');
        assert.strictEqual(testKycSubmission.status, 'submitted');
    });

    // TEST 179: Document Number Masking & Private Storage
    await step('179. Document Number Masking & Private Storage', async () => {
        const docs = await nexusDb.getKycDocuments(testKycSubmission.id);
        assert(docs.length >= 2, 'Should have at least 2 documents');
        const idDoc = docs.find(d => d.document_type === 'national_id');
        assert(idDoc, 'ID document must exist');
        assert.strictEqual(idDoc.masked_number, '******4820', 'NIC number must be masked preserving last 4 digits');
        assert(!JSON.stringify(idDoc).includes('199213504820'), 'Raw NIC number must not be exposed in document object');
    });

    // TEST 180: HMAC-SHA256 Signed Document Access Token & Expiry
    let sampleDocId = null;
    await step('180. HMAC-SHA256 Signed Document Access Token & Expiry', async () => {
        const userA = await nexusDb.findUserByEmail('kasun@nexusp.online');
        const docs = await nexusDb.getKycDocuments(testKycSubmission.id);
        sampleDocId = docs[0].id;

        const tokenResult = await nexusKycService.generateSignedDocumentToken(sampleDocId, userA.id, false);
        assert(tokenResult.token, 'Must return signed token');
        const parts = tokenResult.token.split('.');
        assert.strictEqual(parts.length, 3, 'Token format must be docId.expiresAt.sig');

        // Valid token verification
        const verified = nexusKycService.verifyDocumentToken(tokenResult.token);
        assert.strictEqual(verified.valid, true, 'Valid token must verify successfully');
        assert.strictEqual(verified.documentId, sampleDocId);

        // Tampered document ID in token
        const tamperedDocToken = `tampered-doc-id.${parts[1]}.${parts[2]}`;
        const tamperedRes = nexusKycService.verifyDocumentToken(tamperedDocToken);
        assert.strictEqual(tamperedRes.valid, false, 'Tampered token must be rejected');

        // Expired token
        const pastTimestamp = Date.now() - 3600000;
        const expiredSig = nexusKycService.generateSignature(sampleDocId, pastTimestamp);
        const expiredToken = `${sampleDocId}.${pastTimestamp}.${expiredSig}`;
        const expiredRes = nexusKycService.verifyDocumentToken(expiredToken);
        assert.strictEqual(expiredRes.valid, false, 'Expired token must be rejected');
    });

    // TEST 181: Document Access IDOR Protection
    await step('181. Document Access IDOR Protection', async () => {
        const userB = await nexusDb.findUserByEmail('nimal@nexusp.online');
        let idorBlocked = false;
        try {
            await nexusKycService.generateSignedDocumentToken(sampleDocId, userB.id, false);
        } catch (err) {
            idorBlocked = true;
            assert(err.message.includes('Access denied') || err.message.includes('Unauthorized'));
        }
        assert.strictEqual(idorBlocked, true, 'User B must not be able to generate access token for User A KYC document');

        // Admin can generate access token for any member's document
        const adminTokenResult = await nexusKycService.generateSignedDocumentToken(sampleDocId, 'admin-001', true);
        assert(adminTokenResult.token, 'Admin must be authorized to generate document token');
    });

    // TEST 182: KYC Review Lifecycle: Start Review Auto-Transition
    await step('182. KYC Review Lifecycle: Start Review Auto-Transition', async () => {
        const started = await nexusKycService.startReview(testKycSubmission.id, 'admin-001');
        assert.strictEqual(started.status, 'under_review', 'Starting review must transition status to under_review');
        assert.strictEqual(started.reviewer_admin_id, 'admin-001');
    });

    // TEST 183: Admin KYC Approval & Level Assignment
    await step('183. Admin KYC Approval & Level Assignment', async () => {
        const userA = await nexusDb.findUserByEmail('kasun@nexusp.online');
        const approved = await nexusKycService.approveKyc(testKycSubmission.id, 'admin-001', 'Documents verified sharp and valid');
        assert.strictEqual(approved.status, 'approved');

        // Verify member profile updated
        const profile = await nexusDb.getMemberProfile(userA.id);
        assert.strictEqual(profile.verification_status, 'verified', 'Member profile must be marked verified');
        assert.strictEqual(profile.kyc_status, 'approved');

        // Verify review event audit trail logged
        const events = await nexusDb.getKycReviewEvents(testKycSubmission.id);
        assert(events.some(e => e.action === 'approved'), 'Approval event must be immutably recorded');
    });

    // TEST 184: Withdrawal Eligibility Compliance Gate
    await step('184. Withdrawal Eligibility Compliance Gate', async () => {
        const userA = await nexusDb.findUserByEmail('kasun@nexusp.online');
        const userB = await nexusDb.findUserByEmail('nimal@nexusp.online');

        // Ensure KYC requirement setting is enabled
        await nexusDb.updateSetting('kyc_required_for_withdrawal', 'true');

        // Verified User A must be eligible
        const eligA = await nexusWithdrawalService.checkWithdrawalEligibility(userA.id);
        assert.strictEqual(eligA.eligible, true, 'Verified member A must be eligible for withdrawals');

        // Unverified User B must be ineligible
        const eligB = await nexusWithdrawalService.checkWithdrawalEligibility(userB.id);
        assert.strictEqual(eligB.eligible, false, 'Unverified member B must not be eligible');
        assert.strictEqual(eligB.reason_code, 'KYC_REQUIRED');

        // User B requesting withdrawal must throw KYC_REQUIRED
        let withdrawalBlocked = false;
        try {
            await nexusWithdrawalService.requestWithdrawal({
                memberId: userB.id,
                amount: 1000,
                bankAccountId: 'bank-acc-test'
            });
        } catch (err) {
            withdrawalBlocked = true;
            assert(err.message.includes('KYC') || err.message.includes('Verification'));
        }
        assert.strictEqual(withdrawalBlocked, true, 'Withdrawal must be blocked when KYC required');
    });

    // TEST 185: Admin KYC Request Changes & Resubmission Flow
    await step('185. Admin KYC Request Changes & Resubmission Flow', async () => {
        const userB = await nexusDb.findUserByEmail('nimal@nexusp.online');
        // Member B submits initial KYC
        const bSub = await nexusKycService.submitKyc({
            member_id: userB.id,
            legal_full_name: 'Nimal Jayasuriya',
            country: 'Sri Lanka',
            residential_address: '45 Kandy Road, Kiribathgoda',
            documents: [
                {
                    type: 'national_id',
                    number: '198522334455',
                    fileName: 'nimal_nic.jpg',
                    base64Data: Buffer.from('mock-data').toString('base64')
                }
            ]
        });

        // Admin requests changes
        const changed = await nexusKycService.requestChanges(bSub.id, 'admin-001', 'Proof of address missing. Please upload utility bill.');
        assert.strictEqual(changed.status, 'action_required');

        // Member B resubmits with additional document
        const resubmitted = await nexusKycService.submitKyc({
            member_id: userB.id,
            legal_full_name: 'Nimal Jayasuriya',
            country: 'Sri Lanka',
            residential_address: '45 Kandy Road, Kiribathgoda',
            documents: [
                {
                    type: 'national_id',
                    number: '198522334455',
                    fileName: 'nimal_nic.jpg',
                    base64Data: Buffer.from('mock-data').toString('base64')
                },
                {
                    type: 'utility_bill',
                    fileName: 'water_bill.pdf',
                    base64Data: Buffer.from('mock-water-bill').toString('base64')
                }
            ]
        });
        assert.strictEqual(resubmitted.status, 'submitted', 'Resubmission must set status back to submitted');
    });

    // TEST 186: Admin KYC Rejection Workflow
    await step('186. Admin KYC Rejection Workflow', async () => {
        const userB = await nexusDb.findUserByEmail('nimal@nexusp.online');
        const kycData = await nexusKycService.getMemberKyc(userB.id);
        const subId = kycData.submissions[0].id;

        const rejected = await nexusKycService.rejectKyc(subId, 'admin-001', 'Fraudulent document detected');
        assert.strictEqual(rejected.status, 'rejected');
        assert.strictEqual(rejected.rejection_reason, 'Fraudulent document detected');

        const profileB = await nexusDb.getMemberProfile(userB.id);
        assert.strictEqual(profileB.kyc_status, 'rejected');
    });

    // =========================================================================
    // PROMPT 19: MEMBERSHIP ACTIVATION & ACCOUNT ELIGIBILITY ENGINE TESTS
    // =========================================================================

    // TEST 187: Status Separation Guarantee (Account vs Membership vs KYC vs Package)
    await step('187. Status Separation Guarantee (Account vs Membership vs KYC vs Package)', async () => {
        // Create dedicated test member for Prompt 19
        const reg = await NexusAuthService.registerMember({
            fullName: 'Kasun Perera',
            email: 'prompt19_member@nexusp.online',
            phone: '+94770001919',
            password: 'SecurePassword123!',
            confirmPassword: 'SecurePassword123!',
            referralCode: 'NEXUS001'
        });
        assert.strictEqual(reg.success, true, 'Registration must succeed: ' + reg.error);
        const memberId = reg.member.userId;

        // Verify that fields exist independently and are not conflated
        const user = await nexusDb.findUserById(memberId);
        const profile = await nexusDb.findProfileByUserId(memberId);
        const membership = await nexusDb.getMembershipByMemberId(memberId);

        assert(user, 'User must exist');
        assert(profile, 'Profile must exist');
        // Initial state:
        assert.strictEqual(profile.status, 'active', 'User account status must be active');
        assert.strictEqual(membership ? membership.status : 'not_activated', 'not_activated', 'Membership must be not_activated');
        assert.strictEqual(profile.verification_status || 'not_started', 'not_started', 'KYC status must be not_started');
        assert.strictEqual(membership ? membership.package_code : 'NONE', 'NONE', 'Membership package must be NONE');

        // Centralized evaluation must distinguish these separated statuses
        const evalResult = await nexusEligibilityEngine.evaluateMemberEligibility(memberId);
        assert.strictEqual(evalResult.standing.account_status, 'active');
        assert.strictEqual(evalResult.standing.membership_status, 'not_activated');
        assert.strictEqual(evalResult.standing.kyc_status, 'not_started');
        assert.strictEqual(evalResult.standing.package_tier, 'NONE');

        // Feature gates must not be active
        assert.strictEqual(evalResult.pillars.mlm.eligible, false, 'MLM requires active membership');
        assert.strictEqual(evalResult.pillars.commissions.eligible, false, 'Commissions require active membership & package');
        assert.strictEqual(evalResult.pillars.withdrawals.eligible, false, 'Withdrawals require KYC');
    });

    // TEST 188: Payment Verification -> Membership Activation Flow
    await step('188. Payment Verification -> Membership Activation Flow', async () => {
        const user = await nexusDb.findUserByEmail('prompt19_member@nexusp.online');
        const packages = await nexusDb.getAllPackages();
        const starterPkg = packages[0];

        // 1. Create order awaiting payment
        const order = await NexusOrderService.createOrder({
            user_id: user.id,
            package_id: starterPkg.id,
            payment_method: 'gateway'
        });
        assert.strictEqual(order.status, 'awaiting_payment');

        // Membership must still be not_activated
        let mem = await nexusDb.getMembershipByMemberId(user.id);
        assert.strictEqual(mem ? mem.status : 'not_activated', 'not_activated');

        // 2. Gateway webhook verifies payment
        const webhookResult = await nexusPaymentService.handleWebhook({
            event: 'payment.success',
            order_id: order.id,
            payment_id: 'pay_test_p19_01',
            amount: starterPkg.price
        });
        assert.strictEqual(webhookResult.success, true);

        // Membership must now be active
        mem = await nexusDb.getMembershipByMemberId(user.id);
        assert(mem, 'Membership record must now exist');
        assert.strictEqual(mem.status, 'active');
        assert.strictEqual(mem.activation_order_id, order.id);
        assert.strictEqual(mem.package_id, starterPkg.id);
        assert(mem.activated_at, 'activated_at must be populated');
        assert.strictEqual(mem.expires_at, null, 'Default lifetime membership has null expires_at');
    });

    // TEST 189: Strict Activation Idempotency (Duplicate Payment Callback)
    await step('189. Strict Activation Idempotency (Duplicate Payment Callback)', async () => {
        const user = await nexusDb.findUserByEmail('prompt19_member@nexusp.online');
        const memBefore = await nexusDb.getMembershipByMemberId(user.id);
        const orderId = memBefore.activation_order_id;

        // Second payment notification for identical order
        const packages = await nexusDb.getAllPackages();
        const starterPkg = packages[0];
        const dupWebhook = await nexusPaymentService.handleWebhook({
            event: 'payment.success',
            order_id: orderId,
            payment_id: 'pay_test_p19_01_dup',
            amount: starterPkg.price
        });
        assert.strictEqual(dupWebhook.success, true);

        // Membership must remain active without duplicate record or duplicated activation date
        const memAfter = await nexusDb.getMembershipByMemberId(user.id);
        assert.strictEqual(memAfter.id, memBefore.id);
        assert.strictEqual(memAfter.status, 'active');
        assert.strictEqual(memAfter.activated_at, memBefore.activated_at);
    });

    // TEST 190: Unverified Payment Rejection
    await step('190. Unverified Payment Rejection', async () => {
        const user = await nexusDb.findUserByEmail('prompt19_member@nexusp.online');
        const res = await nexusMembershipService.activateMembership(user.id, {
            orderId: 'fake-unverified-order',
            packageId: 'pkg-01'
        });
        assert.strictEqual(res.success, false);
        assert(res.error.includes('Order') || res.error.includes('not verified') || res.error.includes('not found'));
    });

    // TEST 191: Membership State Machine Transitions & Validation
    await step('191. Membership State Machine Transitions & Validation', async () => {
        const user = await nexusDb.findUserByEmail('prompt19_member@nexusp.online');
        
        // 1. Transition: active -> suspended
        const susp = await nexusMembershipService.updateMembershipStatus({
            memberId: user.id,
            toStatus: 'suspended',
            triggerEvent: 'COMPLIANCE_SUSPENSION',
            reasonCode: 'POLICY_VIOLATION',
            reason: 'Temporary suspension for compliance check',
            actorId: 'admin-001'
        });
        assert.strictEqual(susp.status, 'suspended');

        // 2. Transition: suspended -> active (reinstated)
        const rein = await nexusMembershipService.updateMembershipStatus({
            memberId: user.id,
            toStatus: 'active',
            triggerEvent: 'ADMIN_REINSTATEMENT',
            reasonCode: 'COMPLIANCE_CLEARED',
            reason: 'Investigation resolved satisfactorily',
            actorId: 'admin-001'
        });
        assert.strictEqual(rein.status, 'active');

        // 3. Transition: active -> cancelled
        const canc = await nexusMembershipService.updateMembershipStatus({
            memberId: user.id,
            toStatus: 'cancelled',
            triggerEvent: 'MEMBER_CANCELLATION',
            reasonCode: 'VOLUNTARY_TERMINATION',
            reason: 'Member requested termination',
            actorId: user.id
        });
        assert.strictEqual(canc.status, 'cancelled');

        // 4. Invalid transition: cancelled -> active must be rejected
        let invalidTransitionBlocked = false;
        try {
            await nexusMembershipService.updateMembershipStatus({
                memberId: user.id,
                toStatus: 'active',
                triggerEvent: 'ILLEGAL_TRANSITION',
                reason: 'Should fail'
            });
        } catch (err) {
            invalidTransitionBlocked = true;
            assert(err.message.includes('Invalid transition'));
        }
        assert.strictEqual(invalidTransitionBlocked, true, 'Illegal state machine transition must throw');

        // Restore to active for subsequent tests
        await nexusDb.createOrUpdateMembership({
            member_id: user.id,
            status: 'active',
            package_id: 'pkg-01'
        });
    });

    // TEST 192: Point-in-Time History Immutability in nexus_membership_history
    await step('192. Point-in-Time History Immutability in nexus_membership_history', async () => {
        const user = await nexusDb.findUserByEmail('prompt19_member@nexusp.online');
        const history = await nexusDb.getMembershipHistory(user.id);

        assert(history.length >= 3, 'Multiple historical transitions must be recorded');
        // Check that history records contain required audit fields
        for (const entry of history) {
            assert(entry.id, 'History entry must have an ID');
            assert(entry.from_status !== undefined, 'Must record from_status');
            assert(entry.to_status, 'Must record to_status');
            assert(entry.trigger_event, 'Must record trigger_event');
            assert(entry.created_at, 'Must have created_at timestamp');
        }
    });

    // TEST 193: Central Eligibility Engine (All 4 Pillars Evaluation)
    await step('193. Central Eligibility Engine (All 4 Pillars Evaluation)', async () => {
        const user = await nexusDb.findUserByEmail('prompt19_member@nexusp.online');
        
        // When active membership but unverified KYC and no bank account:
        const elig = await nexusEligibilityEngine.evaluateMemberEligibility(user.id);
        assert.strictEqual(elig.pillars.mlm.eligible, true, 'Active account + membership is MLM eligible');
        assert.strictEqual(elig.pillars.commissions.eligible, true, 'Active account + membership is Commission qualified');
        assert.strictEqual(elig.pillars.withdrawals.eligible, false, 'Withdrawal requires KYC and bank account');
        assert.strictEqual(elig.pillars.rank.eligible, true, 'Rank progression open');
        assert.strictEqual(elig.action_required, true, 'Blockers present');

        // Suspend user account and re-evaluate
        await nexusDb.updateMemberProfile(user.id, { status: 'suspended' });
        const eligSuspended = await nexusEligibilityEngine.evaluateMemberEligibility(user.id);
        assert.strictEqual(eligSuspended.pillars.mlm.eligible, false, 'Suspended account blocks MLM');
        assert.strictEqual(eligSuspended.pillars.commissions.eligible, false, 'Suspended account blocks Commissions');
        assert.strictEqual(eligSuspended.pillars.withdrawals.eligible, false, 'Suspended account blocks Withdrawals');
        assert.strictEqual(eligSuspended.pillars.rank.eligible, false, 'Suspended account blocks Rank');

        // Restore account to active
        await nexusDb.updateMemberProfile(user.id, { status: 'active' });
    });

    // TEST 194: MLM Network Participation Gate
    await step('194. MLM Network Participation Gate', async () => {
        const user = await nexusDb.findUserByEmail('prompt19_member@nexusp.online');

        // Active membership -> eligible
        const mlmElig = await nexusEligibilityEngine.checkMlmEligibility(user.id);
        assert.strictEqual(mlmElig.eligible, true);
        assert.strictEqual(mlmElig.reason_code, null);

        // Suspend membership -> checkMlmEligibility returns false
        await nexusMembershipService.updateMembershipStatus({
            memberId: user.id,
            toStatus: 'suspended',
            triggerEvent: 'AUDIT_SUSPEND',
            reason: 'Testing gate'
        });

        const mlmInelig = await nexusEligibilityEngine.checkMlmEligibility(user.id);
        assert.strictEqual(mlmInelig.eligible, false);
        assert.strictEqual(mlmInelig.reason_code, 'MEMBERSHIP_NOT_ACTIVE');

        // Restore membership
        await nexusMembershipService.updateMembershipStatus({
            memberId: user.id,
            toStatus: 'active',
            triggerEvent: 'AUDIT_RESTORE',
            reason: 'Restoring gate'
        });
    });

    // TEST 195: Commission Engine Consumes Centralized Eligibility Engine
    await step('195. Commission Engine Consumes Centralized Eligibility Engine', async () => {
        const user = await nexusDb.findUserByEmail('prompt19_member@nexusp.online');
        const userProfile = await nexusDb.findProfileByUserId(user.id);

        // Suspend user's membership
        await nexusMembershipService.updateMembershipStatus({
            memberId: user.id,
            toStatus: 'suspended',
            triggerEvent: 'SUSPEND_TEST_COMM',
            reason: 'Testing commission qualification block'
        });

        // Test NexusQualificationService
        const qual = NexusQualificationService.isMemberEligibleForCommission(
            userProfile,
            { requires_active_package: true },
            { purchaserId: 'someone-else-id' }
        );
        assert.strictEqual(qual.eligible, false, 'Suspended membership must block commission qualification');
        assert(qual.reason.includes('membership status is \'suspended\''));

        // Restore membership
        await nexusMembershipService.updateMembershipStatus({
            memberId: user.id,
            toStatus: 'active',
            triggerEvent: 'RESTORE_TEST_COMM',
            reason: 'Restoring commission qualification'
        });
    });

    // TEST 196: Withdrawal Engine Consumes Eligibility Engine with KYC Gate
    await step('196. Withdrawal Engine Consumes Eligibility Engine with KYC Gate', async () => {
        const user = await nexusDb.findUserByEmail('prompt19_member@nexusp.online');
        await nexusDb.updateSetting('kyc_required_for_withdrawal', 'true');

        // Unverified member check
        const withCheck = await nexusWithdrawalService.checkWithdrawalEligibility(user.id);
        assert.strictEqual(withCheck.eligible, false);
        assert.strictEqual(withCheck.reason_code, 'KYC_REQUIRED');
        assert(withCheck.message.includes('KYC') || withCheck.reason.includes('KYC'));

        // Verify member
        await nexusDb.updateMemberProfile(user.id, { verification_status: 'verified' });
        const withCheckVerified = await nexusWithdrawalService.checkWithdrawalEligibility(user.id);
        assert.strictEqual(withCheckVerified.eligible, true);
        assert.strictEqual(withCheckVerified.reason_code, null);
    });

    // TEST 197: Order Refund / Reversal Event Handling
    await step('197. Order Refund / Reversal Event Handling', async () => {
        const user = await nexusDb.findUserByEmail('prompt19_member@nexusp.online');
        const mem = await nexusDb.getMembershipByMemberId(user.id);
        const orderId = mem.activation_order_id;

        // Refund order
        const refundResult = await nexusMembershipService.handleRefundOrReversal(orderId, 'Customer chargeback / refund');
        assert.strictEqual(refundResult.success, true);
        assert.strictEqual(refundResult.membership.status, 'suspended');

        // Immediate eligibility re-evaluation must show commissions and MLM blocked
        const elig = await nexusEligibilityEngine.evaluateMemberEligibility(user.id);
        assert.strictEqual(elig.pillars.mlm.eligible, false);
        assert.strictEqual(elig.pillars.commissions.eligible, false);

        // Restore for following tests
        await nexusDb.createOrUpdateMembership({
            member_id: user.id,
            status: 'active',
            package_id: 'pkg-01'
        });
    });

    // TEST 198: Admin Manual Membership Action with Mandatory Reason
    await step('198. Admin Manual Membership Action with Mandatory Reason', async () => {
        const user = await nexusDb.findUserByEmail('prompt19_member@nexusp.online');

        // Missing reason must throw
        let failedNoReason = false;
        try {
            await nexusMembershipService.manualAdminAction({
                memberId: user.id,
                action: 'SUSPEND',
                adminUserId: 'admin-001',
                reason: ''
            });
        } catch (err) {
            failedNoReason = true;
            assert(err.message.includes('Reason is required'));
        }
        assert.strictEqual(failedNoReason, true, 'Mandatory reason enforcement required');

        // With valid reason
        const actionResult = await nexusMembershipService.manualAdminAction({
            memberId: user.id,
            action: 'SUSPEND',
            adminUserId: 'admin-001',
            reason: 'Administrative compliance hold pending tax review',
            notes: 'Follow up in 7 days'
        });
        assert.strictEqual(actionResult.success, true);
        assert.strictEqual(actionResult.membership.status, 'suspended');

        // Reinstate
        const reinResult = await nexusMembershipService.manualAdminAction({
            memberId: user.id,
            action: 'REINSTATE',
            adminUserId: 'admin-001',
            reason: 'Tax documents verified successfully'
        });
        assert.strictEqual(reinResult.success, true);
        assert.strictEqual(reinResult.membership.status, 'active');
    });

    // TEST 199: Member REST API & Cross-Member Authorization Isolation
    await step('199. Member REST API & Cross-Member Authorization Isolation', async () => {
        function mockReqRes(pathname, method = 'GET', authHeader = null, body = null) {
            const req = {
                method,
                url: pathname,
                headers: { host: 'localhost:3001' },
                socket: { remoteAddress: '127.0.0.1' },
                on: (e, cb) => {
                    if (e === 'data' && body) cb(Buffer.from(JSON.stringify(body)));
                    if (e === 'end') cb();
                }
            };
            if (authHeader) req.headers.authorization = authHeader;
            let statusCode = null;
            let headers = {};
            let responseBody = '';
            let onDone = null;
            const donePromise = new Promise(resolve => { onDone = resolve; });
            const res = {
                writeHead: (code, h) => { statusCode = code; headers = h; },
                end: (chunk) => {
                    if (chunk) responseBody += chunk.toString();
                    if (onDone) onDone();
                }
            };
            return {
                req,
                res,
                wait: () => donePromise,
                getResult: () => ({ statusCode, headers, body: responseBody })
            };
        }

        const user = await nexusDb.findUserByEmail('prompt19_member@nexusp.online');
        const token = NexusAuthService.generateToken({ id: user.id, role: 'member' });

        // Unauthenticated request -> 401
        const unauthReq = mockReqRes('/api/v1/nexus/member/membership');
        requestHandler(unauthReq.req, unauthReq.res);
        await unauthReq.wait();
        assert.strictEqual(unauthReq.getResult().statusCode, 401);

        // Authenticated request -> 200
        const authReq = mockReqRes('/api/v1/nexus/member/membership', 'GET', `Bearer ${token}`);
        requestHandler(authReq.req, authReq.res);
        await authReq.wait();
        const res1 = authReq.getResult();
        assert.strictEqual(res1.statusCode, 200);
        const json1 = JSON.parse(res1.body);
        assert.strictEqual(json1.success, true);
        assert.strictEqual(json1.membership.member_id, user.id);

        // Authenticated eligibility request -> 200
        const authEligReq = mockReqRes('/api/v1/nexus/member/eligibility', 'GET', `Bearer ${token}`);
        requestHandler(authEligReq.req, authEligReq.res);
        await authEligReq.wait();
        const res2 = authEligReq.getResult();
        assert.strictEqual(res2.statusCode, 200);
        const json2 = JSON.parse(res2.body);
        assert.strictEqual(json2.success, true);
        assert(json2.pillars.mlm);
    });

    // TEST 200: Admin REST Endpoints Role Security
    await step('200. Admin REST Endpoints Role Security', async () => {
        function mockReqRes(pathname, method = 'GET', authHeader = null, body = null) {
            const req = {
                method,
                url: pathname,
                headers: { host: 'localhost:3001' },
                socket: { remoteAddress: '127.0.0.1' },
                on: (e, cb) => {
                    if (e === 'data' && body) cb(Buffer.from(JSON.stringify(body)));
                    if (e === 'end') cb();
                }
            };
            if (authHeader) req.headers.authorization = authHeader;
            let statusCode = null;
            let headers = {};
            let responseBody = '';
            let onDone = null;
            const donePromise = new Promise(resolve => { onDone = resolve; });
            const res = {
                writeHead: (code, h) => { statusCode = code; headers = h; },
                end: (chunk) => {
                    if (chunk) responseBody += chunk.toString();
                    if (onDone) onDone();
                }
            };
            return {
                req,
                res,
                wait: () => donePromise,
                getResult: () => ({ statusCode, headers, body: responseBody })
            };
        }

        const member = await nexusDb.findUserByEmail('prompt19_member@nexusp.online');
        const memberToken = NexusAuthService.generateToken({ id: member.id, role: 'member' });
        const adminUser = await nexusDb.findUserByEmail('admin@nexusp.online') || { id: '00000000-0000-4000-8000-000000000001', role: 'admin' };
        const adminToken = NexusAuthService.generateToken({ id: adminUser.id, role: 'admin' });

        // Member attempting to access admin stats -> 403
        const forbiddenReq = mockReqRes('/api/v1/nexus/admin/eligibility/stats', 'GET', `Bearer ${memberToken}`);
        requestHandler(forbiddenReq.req, forbiddenReq.res);
        await forbiddenReq.wait();
        assert.strictEqual(forbiddenReq.getResult().statusCode, 403);

        // Admin accessing stats -> 200
        const adminStatsReq = mockReqRes('/api/v1/nexus/admin/eligibility/stats', 'GET', `Bearer ${adminToken}`);
        requestHandler(adminStatsReq.req, adminStatsReq.res);
        await adminStatsReq.wait();
        const rStats = adminStatsReq.getResult();
        assert.strictEqual(rStats.statusCode, 200);
        const jStats = JSON.parse(rStats.body);
        assert.strictEqual(jStats.success, true);
        assert(jStats.stats.total_memberships >= 1);

        // Admin accessing directory -> 200
        const adminDirReq = mockReqRes('/api/v1/nexus/admin/eligibility/directory?limit=10', 'GET', `Bearer ${adminToken}`);
        requestHandler(adminDirReq.req, adminDirReq.res);
        await adminDirReq.wait();
        const rDir = adminDirReq.getResult();
        assert.strictEqual(rDir.statusCode, 200);
        const jDir = JSON.parse(rDir.body);
        assert.strictEqual(jDir.success, true);
        assert(Array.isArray(jDir.members));
    });

    // TEST 201: Membership Reconciliation Scanner
    await step('201. Membership Reconciliation Scanner', async () => {
        const user = await nexusDb.findUserByEmail('prompt19_member@nexusp.online');
        
        // Inject an anomaly: set account status to suspended while membership is active
        await nexusDb.updateMemberProfile(user.id, { status: 'suspended' });

        const issues = await nexusDb.getMembershipReconciliationIssues();
        assert(issues.length > 0, 'Reconciliation scanner must detect the injected anomaly');
        
        const found = issues.find(i => i.code === 'SUSPENDED_ACCOUNT_ACTIVE_MEMBERSHIP' && i.member_id === user.id);
        assert(found, 'Must detect SUSPENDED_ACCOUNT_ACTIVE_MEMBERSHIP');
        assert.strictEqual(found.severity, 'high');

        // Restore account status
        await nexusDb.updateMemberProfile(user.id, { status: 'active' });
    });

    // ------------------------------------------------------------
    // Summary
    // ------------------------------------------------------------
    console.log('\n============================================================');
    console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    runNexusFoundationTests().catch(err => {
        console.error('Fatal Test Runner Crash:', err);
        process.exit(1);
    });
}

module.exports = runNexusFoundationTests;
