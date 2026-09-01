// Master End-to-End User Journey Test Suite (STEP 7 to 16)
// Verifies Complete User Journey: Sign Up -> Dual Links -> Referral Sign Up -> Binary Placement ->
// Purchase -> Bank Slip Upload -> Admin Approval -> Product Activation -> Binary Volume ->
// Direct Commission -> Qualified Upline Commission -> Wallet Update -> Withdrawal Request -> Admin Payout.

const testRunner = require('./test-runner');
const AuthService = require('../services/auth-service');
const PlacementEngine = require('../services/placement-engine');
const ReferralService = require('../services/referral-service');
const ProductService = require('../services/product-service');
const PurchaseOrchestrator = require('../services/purchase-orchestrator');
const WalletService = require('../services/wallet-service');
const WithdrawalService = require('../services/withdrawal-service');
const SupportService = require('../services/support-service');
const ReconciliationService = require('../services/reconciliation-service');

test('E2E Journey: Full Cycle (Sign Up -> Purchase -> Approval -> Activation -> Commissions -> Withdrawal -> Reconciled)', () => {
    // 0. Seed / Root Member Setup
    const users = [];
    const sponsors = [];
    const binaryNodes = [];
    const volumeLedger = [];
    const walletLedger = [];
    const kycDocs = [];
    const bankAccounts = [];
    const purchases = [];

    const rootUser = { id: 'usr-root', username: 'root_master', full_name: 'Company Root', role: 'admin', status: 'ACTIVE' };
    users.push(rootUser);
    binaryNodes.push({
        id: 'node-root',
        user_id: rootUser.id,
        placement_parent_id: null,
        position: null,
        depth: 1,
        path: '',
        left_child_id: null,
        right_child_id: null
    });
    kycDocs.push({ id: 'kyc-root', user_id: rootUser.id, status: 'APPROVED' });

    // 1. User A Signs Up under Root
    const userAPayload = {
        fullName: 'Kasun Perera',
        username: 'kasun_a',
        email: 'kasun@test.lk',
        mobile: '+94771234567',
        password: 'Password123!',
        sponsorCode: 'root_master',
        position: 'LEFT'
    };
    const regResultA = AuthService.registerMember(userAPayload, { users, sponsors, binaryNodes, volumeLedger, wallets: [] });
    assert(regResultA.success, 'User A registered');
    const userA = regResultA.user;
    kycDocs.push({ id: 'kyc-a', user_id: userA.id, status: 'APPROVED' });
    bankAccounts.push({ user_id: userA.id, bank_name: 'Commercial Bank', account_number: '8877665544', status: 'VERIFIED' });

    // 2. User A Gets Dual Referral Links
    const linksA = ReferralService.generateReferralLinks(userA.username, 'https://hapanamy.lk');
    assert(linksA.left_link.includes('position=left'));
    assert(linksA.right_link.includes('position=right'));

    // 3. User B Signs Up Through User A's LEFT Link
    const userBPayload = {
        fullName: 'Nimal Silva',
        username: 'nimal_b',
        email: 'nimal@test.lk',
        mobile: '+94779876543',
        password: 'Password123!',
        sponsorCode: 'kasun_a',
        position: 'LEFT'
    };
    const regResultB = AuthService.registerMember(userBPayload, { users, sponsors, binaryNodes, volumeLedger, wallets: [] });
    assert(regResultB.success, 'User B registered');
    const userB = regResultB.user;

    // 4. Verify User B Binary Placement
    const nodeB = binaryNodes.find(n => n.user_id === userB.id);
    assert(nodeB, 'User B node created');
    assert.equal(nodeB.placement_parent_id, userA.id, 'Placed under User A');
    assert.equal(nodeB.position, 'LEFT', 'Placed in LEFT slot');

    // 5. User B Buys "Professional Trading & AI Masterclass" (Rs. 27,500)
    const product = ProductService.getCatalog().find(p => p.id === 'prod-pro-02');
    const purchaseId = 'purch-e2e-1001';

    // 6. User B Uploads Payment Slip
    const purchaseRecord = {
        id: purchaseId,
        user_id: userB.id,
        product_id: product.id,
        price_paid: product.selling_price,
        product_cost: product.product_cost,
        bank_reference: 'SLIP-E2E-778899',
        slip_url: 'https://storage.hapanamy.lk/slips/slip-e2e.jpg',
        slip_hash: 'hash-slip-e2e-12345',
        status: 'PAYMENT_PENDING',
        created_at: new Date().toISOString()
    };
    purchases.push(purchaseRecord);

    // 7. Admin Approves Payment & Purchase Orchestrator Activates
    purchaseRecord.status = 'APPROVED';
    const orchResult = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
        purchase: purchaseRecord,
        product,
        userId: userB.id,
        users,
        sponsors,
        binaryNodes,
        walletLedger,
        volumeLedger,
        kycDocs,
        purchases
    });

    assert(orchResult.success, 'Purchase orchestration completed');
    assert(orchResult.summary.volume_propagated > 0, 'Binary volume distributed');
    assert(orchResult.summary.direct_commission.eligible_amount > 0, 'Direct commission distributed');

    // 8. Verify Product Delivery & Course Access
    const deliveryB = ProductService.getCourseDelivery(userB.id, product.id, purchases);
    assert.equal(deliveryB.is_entitled, true, 'User B is entitled to course');
    assert.equal(deliveryB.modules[0].lessons[0].is_unlocked, true, 'Lesson 1 unlocked');
    assert.equal(deliveryB.modules[0].lessons[1].is_unlocked, true, 'Lesson 2 unlocked');

    // 9. Verify User A Wallet Balance (Direct Commission = 8% of Rs. 27,500 = Rs. 2,200)
    const walletA = WalletService.getWalletBalances(userA.id, walletLedger);
    assert.equal(walletA.available_balance, 2200.00, 'User A earned Rs. 2,200 direct commission');

    // 10. User A Requests Withdrawal of Rs. 2,000
    const wdReq = WithdrawalService.requestWithdrawal({
        userId: userA.id,
        amount: 2000.00,
        bankDetails: {
            bank_name: 'Commercial Bank',
            account_number: '8877665544',
            account_holder_name: 'Kasun Perera',
            branch: 'Colombo 03'
        },
        kycStatus: 'APPROVED',
        walletLedger
    });
    assert(wdReq.success, 'Withdrawal request created');

    // 11. Verify Hold Balance Protection
    const walletAHeld = WalletService.getWalletBalances(userA.id, walletLedger);
    assert.equal(walletAHeld.available_balance, 200.00, 'Available balance reduced to Rs. 200');
    assert.equal(walletAHeld.withdrawal_hold_balance, 2000.00, 'Hold balance locked at Rs. 2,000');

    // 12. Admin Approves and Pays Withdrawal
    const payResult = WithdrawalService.markPaid({
        withdrawalId: wdReq.withdrawal_id,
        bankTransferReference: 'TXN-BANK-PAY-9900',
        adminUserId: 'admin-treasury',
        walletLedger
    });
    assert(payResult.success, 'Withdrawal marked paid');

    const walletAFinal = WalletService.getWalletBalances(userA.id, walletLedger);
    assert.equal(walletAFinal.available_balance, 200.00);
    assert.equal(walletAFinal.withdrawal_hold_balance, 0.00);
    assert.equal(walletAFinal.total_withdrawn, 2000.00);

    // 13. Bank Reconciliation & Company Accounting
    const bankStatements = [
        { id: 'btx-1', reference: 'SLIP-E2E-778899', amount: 27500.00, date: '2026-09-01' }
    ];
    const systemDeposits = [
        { id: 'dep-1', bank_reference: 'SLIP-E2E-778899', amount: 27500.00, slip_hash: 'hash-slip-e2e-12345', status: 'APPROVED' }
    ];
    const recon = ReconciliationService.reconcileBankDeposits(bankStatements, systemDeposits);
    assert.equal(recon.reconciled_count, 1, 'Bank statement reconciled');
    assert.equal(recon.duplicate_slips_count, 0, 'No duplicate slips');

    const companyAccounting = ReconciliationService.calculateCompanyNetPosition({
        purchases,
        walletLedger,
        refunds: []
    });
    assert.equal(companyAccounting.is_profitable, true, 'Company Net Position is positive');
    assert(companyAccounting.net_company_position > 0, 'Net company margin protected');
});

test('E2E Support Ticket Lifecycle: Create, Reply & Resolve', () => {
    const tktRes = SupportService.createTicket({
        userId: 'usr-support-test',
        subject: 'Course Access Inquiry',
        message: 'When will my trading indicators be delivered?'
    });
    assert(tktRes.success, 'Support ticket created');
    const ticketId = tktRes.ticket.id;

    const replyRes = SupportService.replyTicket(ticketId, 'admin-support', 'admin', 'Your indicators are available in the downloads tab.');
    assert(replyRes.success, 'Admin replied to ticket');

    const closeRes = SupportService.updateStatus(ticketId, 'RESOLVED', 'admin-support');
    assert.equal(closeRes.ticket.status, 'RESOLVED', 'Ticket resolved');
});

if (require.main === module) {
    runTests();
}
