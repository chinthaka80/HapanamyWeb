// test/step75-live-signup-persistence-and-sponsor-fallback.test.js
// Automated Verification for Live Signup Persistence and Sponsor Fallback Integrity

const assert = require('assert');
const AuthService = require('../services/auth-service');
const ReferralService = require('../services/referral-service');
const PlacementEngine = require('../services/placement-engine');

console.log('🧪 Starting Step 75 Test Suite: Live Signup Persistence and Sponsor Fallback Integrity...');

function runStep75Tests() {
    const mockUsers = [
        {
            id: 'user-namobuddhaya-root',
            username: 'NAMOBUDDHAYA',
            full_name: 'Main Admin (NAMOBUDDHAYA)',
            name: 'Main Admin (NAMOBUDDHAYA)',
            email: 'admin@hapanamy.lk',
            role: 'admin',
            status: 'ACTIVE',
            account_status: 'ACTIVE',
            qualification_status: 'QUALIFIED',
            position: 'ROOT',
            referral_code: 'NAMOBUDDHAYA',
            created_at: '2026-09-01T00:00:00Z'
        },
        {
            id: 'user-hapana-01',
            username: 'HAPANA01',
            full_name: 'Hapana 01',
            name: 'Hapana 01',
            email: 'hapana01@hapanamy.lk',
            role: 'member',
            status: 'ACTIVE',
            account_status: 'ACTIVE',
            qualification_status: 'QUALIFIED',
            position: 'LEFT',
            referral_code: 'HAPANA01',
            created_at: '2026-10-01T00:00:00Z'
        }
    ];

    const mockSponsors = [
        { id: 'spon-1', user_id: 'user-hapana-01', sponsor_id: 'user-namobuddhaya-root', created_at: '2026-10-01T00:00:00Z' }
    ];

    const mockBinaryNodes = [
        {
            id: 'node-namobuddhaya-root',
            user_id: 'user-namobuddhaya-root',
            placement_parent_id: null,
            position: null,
            depth: 1,
            path: '',
            left_child_id: 'user-hapana-01',
            right_child_id: null,
            created_at: '2026-09-01T00:00:00Z'
        },
        {
            id: 'node-hapana-01',
            user_id: 'user-hapana-01',
            placement_parent_id: 'user-namobuddhaya-root',
            position: 'LEFT',
            depth: 2,
            path: '/node-namobuddhaya-root',
            left_child_id: null,
            right_child_id: null,
            created_at: '2026-10-01T00:00:00Z'
        }
    ];

    const mockVolumeLedger = [];
    const mockWallets = [];
    const mockKycDocs = [];
    const mockBankAccounts = [];
    const mockAuditLogs = [];
    const mockReferralConversions = [];
    const mockIntentStore = [];

    // TEST 1: Register without sponsorCode (gracefully defaults to NAMOBUDDHAYA)
    console.log('👉 Test 1: Registering free user without sponsorCode (should default to NAMOBUDDHAYA)...');
    const res1 = AuthService.registerMember({
        fullName: 'Nimal Silva',
        username: 'nimalsilva',
        email: 'nimal@example.com',
        mobile: '0771234567',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        position: 'LEFT',
        role: 'member'
    }, {
        users: mockUsers,
        sponsors: mockSponsors,
        binaryNodes: mockBinaryNodes,
        volumeLedger: mockVolumeLedger,
        wallets: mockWallets,
        kycDocs: mockKycDocs,
        bankAccounts: mockBankAccounts,
        auditLogs: mockAuditLogs,
        referralConversions: mockReferralConversions,
        intentStore: mockIntentStore
    });

    assert.strictEqual(res1.success, true, 'Registration without sponsor must succeed');
    assert.strictEqual(res1.sponsor.sponsor_username, 'NAMOBUDDHAYA', 'Default sponsor must be NAMOBUDDHAYA');
    assert.strictEqual(res1.user.username, 'nimalsilva');
    assert.strictEqual(res1.placement.placement_parent_id, 'user-hapana-01');
    assert.strictEqual(res1.placement.position, 'LEFT');
    console.log('✅ Test 1 Passed: Successfully registered without sponsor under NAMOBUDDHAYA.');

    // TEST 2: Register with legacy "Hiru" code (resolves to root admin NAMOBUDDHAYA)
    console.log('👉 Test 2: Registering with legacy sponsor code "Hiru"...');
    const res2 = AuthService.registerMember({
        fullName: 'Sunil Perera',
        username: 'sunilperera',
        email: 'sunil@example.com',
        mobile: '0719876543',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        sponsorCode: 'Hiru',
        position: 'RIGHT',
        role: 'member'
    }, {
        users: mockUsers,
        sponsors: mockSponsors,
        binaryNodes: mockBinaryNodes,
        volumeLedger: mockVolumeLedger,
        wallets: mockWallets,
        kycDocs: mockKycDocs,
        bankAccounts: mockBankAccounts,
        auditLogs: mockAuditLogs,
        referralConversions: mockReferralConversions,
        intentStore: mockIntentStore
    });

    assert.strictEqual(res2.success, true, 'Legacy Hiru sponsor code must succeed');
    assert.strictEqual(res2.sponsor.sponsor_id, 'user-namobuddhaya-root');
    assert.strictEqual(res2.placement.placement_parent_id, 'user-namobuddhaya-root');
    assert.strictEqual(res2.placement.position, 'RIGHT');
    console.log('✅ Test 2 Passed: Legacy sponsor code "Hiru" resolved to root admin NAMOBUDDHAYA.');

    // TEST 3: Register with "direct" / "company" / "root" aliases
    console.log('👉 Test 3: Registering with "direct" alias code...');
    const res3 = AuthService.registerMember({
        fullName: 'Kamal Gunaratne',
        username: 'kamalguna',
        email: 'kamal@example.com',
        mobile: '0781234567',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        sponsorCode: 'direct',
        position: 'LEFT',
        role: 'student'
    }, {
        users: mockUsers,
        sponsors: mockSponsors,
        binaryNodes: mockBinaryNodes,
        volumeLedger: mockVolumeLedger,
        wallets: mockWallets,
        kycDocs: mockKycDocs,
        bankAccounts: mockBankAccounts,
        auditLogs: mockAuditLogs,
        referralConversions: mockReferralConversions,
        intentStore: mockIntentStore
    });

    assert.strictEqual(res3.success, true);
    assert.strictEqual(res3.sponsor.sponsor_id, 'user-namobuddhaya-root');
    console.log('✅ Test 3 Passed: "direct" alias resolved successfully.');

    // TEST 4: Register under downline member HAPANA01
    console.log('👉 Test 4: Registering under downline sponsor HAPANA01 on RIGHT leg...');
    const res4 = AuthService.registerMember({
        fullName: 'Anura Kumara',
        username: 'anurak',
        email: 'anura@example.com',
        mobile: '0751234567',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        sponsorCode: 'HAPANA01',
        position: 'RIGHT',
        role: 'member'
    }, {
        users: mockUsers,
        sponsors: mockSponsors,
        binaryNodes: mockBinaryNodes,
        volumeLedger: mockVolumeLedger,
        wallets: mockWallets,
        kycDocs: mockKycDocs,
        bankAccounts: mockBankAccounts,
        auditLogs: mockAuditLogs,
        referralConversions: mockReferralConversions,
        intentStore: mockIntentStore
    });

    assert.strictEqual(res4.success, true);
    assert.strictEqual(res4.sponsor.sponsor_id, 'user-hapana-01');
    assert.strictEqual(res4.placement.placement_parent_id, 'user-hapana-01');
    assert.strictEqual(res4.placement.position, 'RIGHT');
    console.log('✅ Test 4 Passed: Registered under HAPANA01 on RIGHT position.');

    // TEST 5: Duplicate validation check
    console.log('👉 Test 5: Verifying duplicate username and email rejection...');
    const res5a = AuthService.registerMember({
        fullName: 'Duplicate User',
        username: 'HAPANA01',
        email: 'unique@example.com',
        mobile: '0751234567',
        password: 'Password123!',
        confirmPassword: 'Password123!'
    }, {
        users: mockUsers,
        sponsors: mockSponsors,
        binaryNodes: mockBinaryNodes,
        volumeLedger: mockVolumeLedger,
        wallets: mockWallets,
        kycDocs: mockKycDocs,
        bankAccounts: mockBankAccounts,
        auditLogs: mockAuditLogs,
        referralConversions: mockReferralConversions,
        intentStore: mockIntentStore
    });

    assert.strictEqual(res5a.success, false);
    assert.ok(res5a.error.includes('already taken'));

    const res5b = AuthService.registerMember({
        fullName: 'Duplicate User 2',
        username: 'uniquename',
        email: 'admin@hapanamy.lk',
        mobile: '0751234567',
        password: 'Password123!',
        confirmPassword: 'Password123!'
    }, {
        users: mockUsers,
        sponsors: mockSponsors,
        binaryNodes: mockBinaryNodes,
        volumeLedger: mockVolumeLedger,
        wallets: mockWallets,
        kycDocs: mockKycDocs,
        bankAccounts: mockBankAccounts,
        auditLogs: mockAuditLogs,
        referralConversions: mockReferralConversions,
        intentStore: mockIntentStore
    });

    assert.strictEqual(res5b.success, false);
    assert.ok(res5b.error.includes('already registered'));
    console.log('✅ Test 5 Passed: Duplicate username and email correctly rejected.');

    console.log('\n🎉 ALL 5 STEP 75 LIVE SIGNUP & SPONSOR FALLBACK TESTS PASSED 100%!\n');
}

runStep75Tests();
