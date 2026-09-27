// Comprehensive Test Suite for STEP 51: Dynamic 3-Dimensional Member Status Logic
// Verifies:
// 1. Independent Status Dimensions: Account Status, Qualification Status, KYC Status
// 2. Free Registration: Starts INACTIVE, NOT_QUALIFIED (0/2 Sales), KYC PENDING / NOT_SUBMITTED
// 3. Active Account Status: Earned only via >= 1 personal verified paid purchase
// 4. Qualification Status: Earned only via >= 2 sales team sales (0/2 -> 1/2 -> 2/2 QUALIFIED)
// 5. KYC Status Independence: Admin approval does not activate or qualify without purchases/sales
// 6. Refund Reversals: Personal purchase refund drops to INACTIVE, downline refund drops qualification
// 7. Core MLM Invariants: 8% Direct, 7% Binary, Rs. 30,000 Daily Cap remain 100% exact

const testRunner = require('./test-runner');
const AuthService = require('../services/auth-service');
const QualificationEngine = require('../services/qualification-engine');
const MemberDashboardService = require('../services/member-dashboard-service');
const PurchaseOrchestrator = require('../services/purchase-orchestrator');
const ProductSnapshotService = require('../services/product-snapshot-service');
const CommissionCore = require('../services/commission-core');
const WalletService = require('../services/wallet-service');

function createStatusContext() {
    const rootUser = {
        id: 'usr-root',
        username: 'root_admin',
        full_name: 'Hapanamy Master',
        role: 'admin',
        status: 'ACTIVE',
        account_status: 'ACTIVE',
        qualification_status: 'QUALIFIED',
        kyc_status: 'APPROVED'
    };

    const users = [rootUser];
    const sponsors = [];
    const binaryNodes = [{
        id: 'node-root',
        user_id: rootUser.id,
        placement_parent_id: null,
        position: null,
        depth: 1,
        path: '',
        left_child_id: null,
        right_child_id: null
    }];
    const purchases = [];
    const kycDocs = [];
    const bankAccounts = [];
    const volumeLedger = [];
    const walletLedger = [];
    const commissionLedger = [];
    const auditLogs = [];

    return {
        users,
        sponsors,
        binaryNodes,
        purchases,
        kycDocs,
        bankAccounts,
        volumeLedger,
        walletLedger,
        commissionLedger,
        auditLogs
    };
}

test('Step 51: 1. Free Registration starts INACTIVE, NOT_QUALIFIED (0/2 Sales), and KYC PENDING', () => {
    const ctx = createStatusContext();

    const regResult = AuthService.registerMember({
        fullName: 'Mapa Mudiyanselage Chinthaka Nuwan Gunasekara',
        username: 'chinthaka_nuwan',
        email: 'chinthaka@hapanamy.lk',
        mobile: '+94771234567',
        password: 'Password123#',
        sponsorCode: 'root_admin',
        position: 'LEFT',
        nicPassport: '801234567V',
        address: 'No 45, High Level Rd, Nugegoda'
    }, ctx);

    assert(regResult.success, 'Registration must succeed');
    const member = regResult.user;

    // Verify User Entity Properties
    assert.equal(member.account_status, 'INACTIVE', 'Account status must start INACTIVE on free registration');
    assert.equal(member.qualification_status, 'NOT_QUALIFIED', 'Qualification status must start NOT_QUALIFIED');
    assert.equal(member.kyc_status, 'PENDING', 'KYC status must start PENDING when NIC/address provided');

    // Verify Server-Authoritative Evaluation via QualificationEngine
    const compStatus = QualificationEngine.getMemberComprehensiveStatus(member.id, ctx);
    assert.equal(compStatus.account.status, 'INACTIVE');
    assert.equal(compStatus.account.is_active, false);
    assert.equal(compStatus.account.label, 'INACTIVE');
    assert.equal(compStatus.account.icon, '●');

    assert.equal(compStatus.qualification.status, 'NOT_QUALIFIED');
    assert.equal(compStatus.qualification.is_qualified, false);
    assert.equal(compStatus.qualification.progress_text, '0 / 2 Sales Completed');
    assert.equal(compStatus.qualification.qualifying_sales_count, 0);

    assert.equal(compStatus.kyc.status, 'PENDING');
    assert.equal(compStatus.kyc.is_approved, false);
});

test('Step 51: 2. Personal Paid Purchase activates Member Account Status to ACTIVE (Green ✓ / ●)', () => {
    const ctx = createStatusContext();

    const regResult = AuthService.registerMember({
        fullName: 'Kasun Chamara',
        username: 'kasun_c',
        email: 'kasun.c@hapanamy.lk',
        mobile: '+94772223334',
        password: 'Password123#',
        sponsorCode: 'root_admin',
        position: 'LEFT'
    }, ctx);

    const member = regResult.user;

    // Before purchase: INACTIVE
    let accountStatus = QualificationEngine.getMemberAccountStatus(member.id, ctx);
    assert.equal(accountStatus.status, 'INACTIVE');
    assert.equal(accountStatus.is_active, false);

    // Member purchases a Masterclass product (Rs. 27,500)
    const purchase = {
        id: 'purch-51-01',
        user_id: member.id,
        product_id: 'prod-pro-01',
        selling_price: 27500,
        status: 'PAID',
        created_at: new Date().toISOString()
    };
    ctx.purchases.push(purchase);

    // After verified paid purchase: ACTIVE
    accountStatus = QualificationEngine.getMemberAccountStatus(member.id, ctx);
    assert.equal(accountStatus.status, 'ACTIVE');
    assert.equal(accountStatus.is_active, true);
    assert.equal(accountStatus.active_purchases_count, 1);
    assert.equal(accountStatus.icon, '✓');

    const compStatus = QualificationEngine.getMemberComprehensiveStatus(member.id, ctx);
    assert.equal(compStatus.account.status, 'ACTIVE');
    assert.equal(compStatus.account.is_active, true);
});

test('Step 51: 3. Sales Team Progress: 0/2 -> 1/2 -> 2/2 QUALIFIED (Gold ★)', () => {
    const ctx = createStatusContext();

    // 1. Register Member A (Sponsor)
    const regA = AuthService.registerMember({
        fullName: 'Anura Bandara',
        username: 'anura_b',
        email: 'anura@hapanamy.lk',
        mobile: '+94773334445',
        password: 'Password123#',
        sponsorCode: 'root_admin',
        position: 'LEFT'
    }, ctx);
    const memberA = regA.user;

    // Initially 0 / 2 sales
    let qual = QualificationEngine.getMemberQualificationStatus(memberA.id, ctx);
    assert.equal(qual.status, 'NOT_QUALIFIED');
    assert.equal(qual.is_qualified, false);
    assert.equal(qual.progress_text, '0 / 2 Sales Completed');

    // 2. Register Downline 1 (LEFT) under Member A
    const regB = AuthService.registerMember({
        fullName: 'Bimal Silva',
        username: 'bimal_s',
        email: 'bimal@hapanamy.lk',
        mobile: '+94774445556',
        password: 'Password123#',
        sponsorCode: 'anura_b',
        position: 'LEFT'
    }, ctx);
    const memberB = regB.user;

    // Downline 1 purchases a product (Rs. 7,425)
    ctx.purchases.push({
        id: 'purch-51-b',
        user_id: memberB.id,
        product_id: 'prod-fb-01',
        selling_price: 7425,
        status: 'PAID',
        created_at: new Date().toISOString()
    });

    // After 1 downline sale: 1 / 2 sales completed (Still NOT_QUALIFIED)
    qual = QualificationEngine.getMemberQualificationStatus(memberA.id, ctx);
    assert.equal(qual.status, 'NOT_QUALIFIED');
    assert.equal(qual.is_qualified, false);
    assert.equal(qual.qualifying_sales_count, 1);
    assert.equal(qual.progress_text, '1 / 2 Sales Completed');

    // 3. Register Downline 2 (RIGHT) under Member A
    const regC = AuthService.registerMember({
        fullName: 'Chamari Perera',
        username: 'chamari_p',
        email: 'chamari@hapanamy.lk',
        mobile: '+94775556667',
        password: 'Password123#',
        sponsorCode: 'anura_b',
        position: 'RIGHT'
    }, ctx);
    const memberC = regC.user;

    // Downline 2 purchases a product (Rs. 7,425)
    ctx.purchases.push({
        id: 'purch-51-c',
        user_id: memberC.id,
        product_id: 'prod-fb-01',
        selling_price: 7425,
        status: 'PAID',
        created_at: new Date().toISOString()
    });

    // After 2 downline sales: 2 / 2 sales completed -> QUALIFIED!
    qual = QualificationEngine.getMemberQualificationStatus(memberA.id, ctx);
    assert.equal(qual.status, 'QUALIFIED');
    assert.equal(qual.is_qualified, true);
    assert.equal(qual.qualifying_sales_count, 2);
    assert.equal(qual.progress_text, '2 / 2 Sales Completed (QUALIFIED)');
    assert.equal(qual.icon, '★');
});

test('Step 51: 4. KYC Status Independence: Admin Approval does NOT activate or qualify member', () => {
    const ctx = createStatusContext();

    const regResult = AuthService.registerMember({
        fullName: 'Danushka Fernando',
        username: 'danushka_f',
        email: 'danushka@hapanamy.lk',
        mobile: '+94776667778',
        password: 'Password123#',
        sponsorCode: 'root_admin',
        position: 'LEFT',
        nicPassport: '851234567V'
    }, ctx);
    const member = regResult.user;

    // Add submitted KYC doc
    ctx.kycDocs.push({
        id: 'kyc-danushka',
        user_id: member.id,
        status: 'PENDING',
        created_at: new Date().toISOString()
    });

    // Admin reviews and approves KYC
    const kycDoc = ctx.kycDocs.find(k => k.user_id === member.id);
    kycDoc.status = 'APPROVED';
    kycDoc.reviewed_by = 'admin-user';
    kycDoc.reviewed_at = new Date().toISOString();
    member.kyc_status = 'APPROVED';

    // Verify Comprehensive Status
    const compStatus = QualificationEngine.getMemberComprehensiveStatus(member.id, ctx);
    assert.equal(compStatus.kyc.status, 'APPROVED');
    assert.equal(compStatus.kyc.is_approved, true);

    // Crucial Invariant: Account remains INACTIVE (0 personal purchases)
    assert.equal(compStatus.account.status, 'INACTIVE');
    assert.equal(compStatus.account.is_active, false);

    // Crucial Invariant: Qualification remains NOT_QUALIFIED (0 team sales)
    assert.equal(compStatus.qualification.status, 'NOT_QUALIFIED');
    assert.equal(compStatus.qualification.is_qualified, false);
});

test('Step 51: 5. Refund Reversals: Personal refund drops to INACTIVE, downline refund revokes QUALIFIED', () => {
    const ctx = createStatusContext();

    // 1. Sponsor Registration & Personal Purchase (ACTIVE)
    const regSponsor = AuthService.registerMember({
        fullName: 'Eshan Wickrama',
        username: 'eshan_w',
        email: 'eshan@hapanamy.lk',
        mobile: '+94777778889',
        password: 'Password123#',
        sponsorCode: 'root_admin',
        position: 'LEFT'
    }, ctx);
    const sponsor = regSponsor.user;

    const sponsorPurchase = {
        id: 'purch-eshan-1',
        user_id: sponsor.id,
        product_id: 'prod-trading-01',
        selling_price: 27500,
        status: 'PAID'
    };
    ctx.purchases.push(sponsorPurchase);

    // 2. Add 2 Downline Sales (QUALIFIED)
    const regDown1 = AuthService.registerMember({
        fullName: 'Downline One',
        username: 'down_1',
        email: 'down1@hapanamy.lk',
        mobile: '+94778889990',
        password: 'Password123#',
        sponsorCode: 'eshan_w',
        position: 'LEFT'
    }, ctx);
    const regDown2 = AuthService.registerMember({
        fullName: 'Downline Two',
        username: 'down_2',
        email: 'down2@hapanamy.lk',
        mobile: '+94779990001',
        password: 'Password123#',
        sponsorCode: 'eshan_w',
        position: 'RIGHT'
    }, ctx);

    const down1Purchase = { id: 'purch-down-1', user_id: regDown1.user.id, product_id: 'prod-fb-01', selling_price: 7425, status: 'PAID' };
    const down2Purchase = { id: 'purch-down-2', user_id: regDown2.user.id, product_id: 'prod-fb-01', selling_price: 7425, status: 'PAID' };
    ctx.purchases.push(down1Purchase, down2Purchase);

    // Verify initial state: ACTIVE and QUALIFIED
    let comp = QualificationEngine.getMemberComprehensiveStatus(sponsor.id, ctx);
    assert.equal(comp.account.status, 'ACTIVE');
    assert.equal(comp.qualification.status, 'QUALIFIED');

    // Refund Sponsor's Personal Purchase
    sponsorPurchase.status = 'REFUNDED';
    comp = QualificationEngine.getMemberComprehensiveStatus(sponsor.id, ctx);
    assert.equal(comp.account.status, 'INACTIVE', 'Refunding personal purchase returns account to INACTIVE');
    assert.equal(comp.account.is_active, false);

    // Refund Downline 2 Purchase
    down2Purchase.status = 'REFUNDED';
    comp = QualificationEngine.getMemberComprehensiveStatus(sponsor.id, ctx);
    assert.equal(comp.qualification.status, 'NOT_QUALIFIED', 'Downline refund drops active sales below 2, revoking QUALIFIED');
    assert.equal(comp.qualification.is_qualified, false);
    assert.equal(comp.qualification.progress_text, '1 / 2 Sales Completed');
});

test('Step 51: 6. Member Dashboard & Admin APIs return authoritative 3-dimensional status payload', () => {
    const ctx = createStatusContext();

    const regResult = AuthService.registerMember({
        fullName: 'Gamini Jayasuriya',
        username: 'gamini_j',
        email: 'gamini@hapanamy.lk',
        mobile: '+94770001112',
        password: 'Password123#',
        sponsorCode: 'root_admin',
        position: 'LEFT'
    }, ctx);
    const member = regResult.user;

    // Test Dashboard Payload
    const dashboardData = MemberDashboardService.getMemberDashboardData({
        userId: member.id,
        users: ctx.users,
        kycDocs: ctx.kycDocs,
        purchases: ctx.purchases,
        sponsors: ctx.sponsors,
        binaryNodes: ctx.binaryNodes,
        walletLedger: ctx.walletLedger,
        volumeLedger: ctx.volumeLedger
    });
    assert(dashboardData.profile, 'Dashboard must return member profile');
    assert.equal(dashboardData.profile.account_status, 'INACTIVE');
    assert.equal(dashboardData.profile.qualification_status, 'NOT_QUALIFIED');
    assert.equal(dashboardData.profile.qualification_progress, '0 / 2 Sales Completed');
    assert(dashboardData.profile.display_banner, 'Dashboard must return display banner for top bar');
    assert(dashboardData.profile.display_banner.account_pill.includes('INACTIVE'), 'Account pill should include INACTIVE');
    assert(dashboardData.profile.display_banner.qualification_pill.includes('NOT QUALIFIED'), 'Qualification pill should include NOT QUALIFIED');
    assert.equal(dashboardData.profile.display_banner.progress_display, '0 / 2 Sales Completed');
});

test('Step 51: 7. Core MLM Commission Math Invariants remain 100% exact (8% Direct, 7% Binary, Rs. 30k Cap)', () => {
    // 1. Direct Commission: 8% of Rs. 7,425.00 = Rs. 594.00
    const directComm1 = CommissionCore.calculateDirectCommission(7425, 8.00);
    assert.equal(directComm1, 594.00, 'Direct commission on Rs. 7,425 must be exactly Rs. 594.00');

    // Direct Commission: 8% of Rs. 27,500.00 = Rs. 2,200.00
    const directComm2 = CommissionCore.calculateDirectCommission(27500, 8.00);
    assert.equal(directComm2, 2200.00, 'Direct commission on Rs. 27,500 must be exactly Rs. 2,200.00');

    // 2. Binary Matching Commission: 7% of matched volume (e.g. 5,000 BV = Rs. 350.00)
    const binaryComm = CommissionCore.calculateBinaryCommission(5000, 7.00);
    assert.equal(binaryComm, 350.00, 'Binary matching commission on 5,000 BV must be exactly Rs. 350.00');

    // 3. Daily Cap Limit: Rs. 30,000.00
    const capCheck1 = CommissionCore.applyDailyCap(15000, 20000, 30000);
    assert.equal(capCheck1.eligibleAmount, 10000.00, 'Only Rs. 10,000 of Rs. 15,000 is eligible under Rs. 30k cap');
    assert.equal(capCheck1.cappedAmount, 5000.00, 'Rs. 5,000 is capped');

    const capCheck2 = CommissionCore.applyDailyCap(5000, 30000, 30000);
    assert.equal(capCheck2.eligibleAmount, 0.00, '0 eligible once cap is fully reached');
    assert.equal(capCheck2.cappedAmount, 5000.00, 'All Rs. 5,000 is capped');
});
