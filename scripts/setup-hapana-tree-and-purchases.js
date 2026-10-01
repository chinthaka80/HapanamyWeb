// Setup 15 HAPANA accounts (HAPANA01 - HAPANA15) with OLU321# password,
// complete binary tree hierarchy matching handwritten specification,
// and execute TikTok Monetization course purchase (Rs. 4,500) sequentially from 1 to 15.

const fs = require('fs');
const path = require('path');
const AuthService = require('../services/auth-service');
const PurchaseOrchestrator = require('../services/purchase-orchestrator');
const WalletService = require('../services/wallet-service');

const DB_STORE_FILE = path.join(__dirname, '..', 'data', 'mlm-db-store.json');

function run() {
    console.log('🚀 Starting HAPANA01 - HAPANA15 Accounts & Purchase Setup...');

    let db = {
        users: [],
        binaryNodes: [],
        sponsors: [],
        wallets: [],
        bankAccounts: [],
        products: [],
        productPurchases: [],
        paymentDeposits: [],
        productSnapshots: [],
        commissionTransactions: [],
        walletLedger: [],
        volumeLedger: [],
        withdrawalRequests: [],
        refundRequests: [],
        kycDocs: [],
        fraudAlerts: [],
        auditLogs: [],
        referralConversions: [],
        referralClicks: []
    };

    if (fs.existsSync(DB_STORE_FILE)) {
        try {
            const loaded = JSON.parse(fs.readFileSync(DB_STORE_FILE, 'utf-8'));
            db = { ...db, ...loaded };
        } catch (e) {
            console.warn('Could not read existing store:', e.message);
        }
    }

    db.products = db.products || [];
    db.users = db.users || [];
    db.binaryNodes = db.binaryNodes || [];
    db.sponsors = db.sponsors || [];
    db.wallets = db.wallets || [];
    db.bankAccounts = db.bankAccounts || [];
    db.productPurchases = db.productPurchases || [];
    db.paymentDeposits = db.paymentDeposits || [];
    db.productSnapshots = db.productSnapshots || [];
    db.commissionTransactions = db.commissionTransactions || [];
    db.walletLedger = db.walletLedger || [];
    db.volumeLedger = db.volumeLedger || [];
    db.withdrawalRequests = db.withdrawalRequests || [];
    db.refundRequests = db.refundRequests || [];
    db.kycDocs = db.kycDocs || [];
    db.fraudAlerts = db.fraudAlerts || [];
    db.auditLogs = db.auditLogs || [];
    db.referralConversions = db.referralConversions || [];
    db.referralClicks = db.referralClicks || [];

    // Ensure core admin accounts exist
    const adminAccounts = [
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
            kyc_status: 'APPROVED',
            position: 'ROOT',
            referral_code: 'NAMOBUDDHAYA',
            password: 'Hapana123',
            password_hash: '3bf5525fad501b58c2697d9cc193dc7c:bab6b3f3d0f8e68e4385e6caab42b13d7d4a17b262871f2ea445ec0654cad51292da95f3169419ee179a313f442810ce28b736be7cd0564da5a711dd98cfa134',
            created_at: '2026-09-01T00:00:00Z'
        },
        {
            id: 'user-subadmin-manager',
            username: 'subadmin',
            full_name: 'Sub Admin (Operations Manager)',
            name: 'Sub Admin (Operations Manager)',
            email: 'manager@hapanamy.lk',
            role: 'subadmin',
            status: 'ACTIVE',
            account_status: 'ACTIVE',
            qualification_status: 'QUALIFIED',
            kyc_status: 'APPROVED',
            position: 'ROOT',
            referral_code: 'SUBADMIN',
            password: 'Hapana123',
            password_hash: '3bf5525fad501b58c2697d9cc193dc7c:bab6b3f3d0f8e68e4385e6caab42b13d7d4a17b262871f2ea445ec0654cad51292da95f3169419ee179a313f442810ce28b736be7cd0564da5a711dd98cfa134',
            created_at: '2026-09-01T00:00:00Z'
        },
        {
            id: 'user-subadmin-finance',
            username: 'subadmin2',
            full_name: 'Sub Admin 2 (Finance & Verification)',
            name: 'Sub Admin 2 (Finance & Verification)',
            email: 'finance@hapanamy.lk',
            role: 'subadmin',
            status: 'ACTIVE',
            account_status: 'ACTIVE',
            qualification_status: 'QUALIFIED',
            kyc_status: 'APPROVED',
            position: 'ROOT',
            referral_code: 'SUBADMIN2',
            password: 'Hapana123',
            password_hash: '3bf5525fad501b58c2697d9cc193dc7c:bab6b3f3d0f8e68e4385e6caab42b13d7d4a17b262871f2ea445ec0654cad51292da95f3169419ee179a313f442810ce28b736be7cd0564da5a711dd98cfa134',
            created_at: '2026-09-01T00:00:00Z'
        },
        {
            id: 'user-subadmin-support',
            username: 'subadmin3',
            full_name: 'Sub Admin 3 (Customer Support & Relations)',
            name: 'Sub Admin 3 (Customer Support & Relations)',
            email: 'support@hapanamy.lk',
            role: 'subadmin',
            status: 'ACTIVE',
            account_status: 'ACTIVE',
            qualification_status: 'QUALIFIED',
            kyc_status: 'APPROVED',
            position: 'ROOT',
            referral_code: 'SUBADMIN3',
            password: 'Hapana123',
            password_hash: '3bf5525fad501b58c2697d9cc193dc7c:bab6b3f3d0f8e68e4385e6caab42b13d7d4a17b262871f2ea445ec0654cad51292da95f3169419ee179a313f442810ce28b736be7cd0564da5a711dd98cfa134',
            created_at: '2026-09-01T00:00:00Z'
        }
    ];

    // Filter out old test users while preserving admins
    db.users = adminAccounts;

    // Binary Root Node for NAMOBUDDHAYA
    db.binaryNodes = [
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
        }
    ];

    db.sponsors = [];
    db.wallets = [
        { id: 'wallet-namobuddhaya-root', user_id: 'user-namobuddhaya-root', available_balance: 0, hold_balance: 0, total_earned: 0, total_withdrawn: 0, updated_at: new Date().toISOString() },
        { id: 'wallet-subadmin-manager', user_id: 'user-subadmin-manager', available_balance: 0, hold_balance: 0, total_earned: 0, total_withdrawn: 0, updated_at: new Date().toISOString() },
        { id: 'wallet-subadmin-finance', user_id: 'user-subadmin-finance', available_balance: 0, hold_balance: 0, total_earned: 0, total_withdrawn: 0, updated_at: new Date().toISOString() },
        { id: 'wallet-subadmin-support', user_id: 'user-subadmin-support', available_balance: 0, hold_balance: 0, total_earned: 0, total_withdrawn: 0, updated_at: new Date().toISOString() }
    ];
    db.productPurchases = [];
    db.paymentDeposits = [];
    db.productSnapshots = [];
    db.commissionTransactions = [];
    db.walletLedger = [];
    db.volumeLedger = [];
    db.withdrawalRequests = [];
    db.refundRequests = [];
    db.kycDocs = [];

    // TikTok Course Definition
    const tiktokProduct = {
        id: 'tiktok-course',
        code: 'TIK-MON',
        name: 'TikTok Monetization ප්‍රායෝගික පාඨමාලාව (Online Zoom)',
        title: 'TikTok Monetization ප්‍රායෝගික පාඨමාලාව (Online Zoom)',
        category: 'Social Media',
        original_price: 5000.00,
        discount_price: 4500.00,
        price: 4500.00,
        selling_price: 4500.00,
        product_cost: 900.00,
        binary_volume: 4500.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        image_url: 'assets/tiktok_course_banner.jpg',
        course_url: 'https://hapanamy.lk/courses/tiktok-mon',
        duration: '2 Weeks (4 Live Zoom Sessions)',
        access_type: 'Lifetime Access',
        description: 'TikTok Creativity Program Beta, TikTok Shop Affiliate, and organic viral scaling framework.',
        benefits: [
            'TikTok US/UK Account Creation & Verification',
            'Creativity Program Beta Payout Strategies',
            'Affiliate Product Sourcing & High-Converting Videos'
        ],
        modules_count: 5,
        status: 'ACTIVE'
    };

    // Ensure product is in db.products
    const prodIdx = db.products.findIndex(p => p.id === tiktokProduct.id);
    if (prodIdx >= 0) {
        db.products[prodIdx] = tiktokProduct;
    } else {
        db.products.push(tiktokProduct);
    }

    const hapanaPassword = 'OLU321#';
    const passwordHash = AuthService.hashPassword(hapanaPassword);

    // Tree definitions for 1 to 15
    // Node 1: Parent = user-namobuddhaya-root (LEFT), Sponsor = user-namobuddhaya-root
    // For i in 2..15:
    // parent index p = Math.floor(i / 2)
    // pos = (i % 2 === 0) ? 'LEFT' : 'RIGHT'
    // sponsor = parent (i.e. HAPANA{p})
    const hapanaUsers = [];
    const hapanaNodes = [];

    for (let i = 1; i <= 15; i++) {
        const numStr = String(i).padStart(2, '0');
        const userId = `user-hapana-${numStr}`;
        const username = `HAPANA${numStr}`;
        const nodeId = `node-hapana-${numStr}`;
        const email = `hapana${numStr}@gmail.com`;
        const mobile = `07710000${numStr}`;

        let parentUserId = 'user-namobuddhaya-root';
        let sponsorUserId = 'user-namobuddhaya-root';
        let position = 'LEFT';
        let depth = 2;
        let nodePath = '/node-namobuddhaya-root';

        if (i > 1) {
            const parentIndex = Math.floor(i / 2);
            const parentNumStr = String(parentIndex).padStart(2, '0');
            parentUserId = `user-hapana-${parentNumStr}`;
            sponsorUserId = `user-hapana-${parentNumStr}`;
            position = (i % 2 === 0) ? 'LEFT' : 'RIGHT';
            
            // calculate depth: level 0 = node 1 (depth 2), level 1 = 2,3 (depth 3), level 2 = 4..7 (depth 4), level 3 = 8..15 (depth 5)
            depth = Math.floor(Math.log2(i)) + 2;

            // construct path
            const pathParts = ['node-namobuddhaya-root'];
            let curr = parentIndex;
            const ancestors = [];
            while (curr >= 1) {
                ancestors.unshift(`node-hapana-${String(curr).padStart(2, '0')}`);
                curr = Math.floor(curr / 2);
            }
            pathParts.push(...ancestors);
            nodePath = '/' + pathParts.join('/');
        }

        const leftChildUserId = (i * 2 <= 15) ? `user-hapana-${String(i * 2).padStart(2, '0')}` : null;
        const rightChildUserId = (i * 2 + 1 <= 15) ? `user-hapana-${String(i * 2 + 1).padStart(2, '0')}` : null;

        const userObj = {
            id: userId,
            username: username,
            full_name: `Hapana ${numStr}`,
            name: `Hapana ${numStr}`,
            email: email,
            mobile: mobile,
            role: 'member',
            status: 'ACTIVE',
            account_status: 'ACTIVE',
            qualification_status: 'NOT_QUALIFIED',
            kyc_status: 'APPROVED',
            position: position,
            referral_code: username,
            password: hapanaPassword,
            password_hash: passwordHash,
            created_at: new Date(Date.now() - (16 - i) * 60000).toISOString()
        };

        const nodeObj = {
            id: nodeId,
            user_id: userId,
            placement_parent_id: parentUserId,
            position: position,
            depth: depth,
            path: nodePath,
            left_child_id: leftChildUserId,
            right_child_id: rightChildUserId,
            created_at: userObj.created_at
        };

        const sponsorObj = {
            id: `sp-${userId}`,
            user_id: userId,
            sponsor_id: sponsorUserId,
            created_at: userObj.created_at
        };

        const walletObj = {
            id: `wallet-${userId}`,
            user_id: userId,
            available_balance: 0,
            hold_balance: 0,
            total_earned: 0,
            total_withdrawn: 0,
            updated_at: userObj.created_at
        };

        const kycObj = {
            id: `kyc-${userId}`,
            user_id: userId,
            status: 'APPROVED',
            document_type: 'NIC',
            nic_number: `2000${String(i).padStart(8, '0')}`,
            submitted_at: userObj.created_at,
            reviewed_at: userObj.created_at,
            reviewed_by: 'user-namobuddhaya-root'
        };

        db.users.push(userObj);
        db.binaryNodes.push(nodeObj);
        db.sponsors.push(sponsorObj);
        db.wallets.push(walletObj);
        db.kycDocs.push(kycObj);

        hapanaUsers.push(userObj);
        hapanaNodes.push(nodeObj);
    }

    console.log(`✅ Created ${hapanaUsers.length} HAPANA user accounts and binary tree nodes.`);

    // Now execute purchase for each user sequentially from 1 to 15
    const dailyEarningsMap = new Map();

    for (let i = 1; i <= 15; i++) {
        const numStr = String(i).padStart(2, '0');
        const userId = `user-hapana-${numStr}`;
        const username = `HAPANA${numStr}`;
        const purchaseId = `purch-hapana-${numStr}`;
        const orderId = `ORD-TIK-${numStr}`;

        console.log(`\n📦 Processing TikTok Course Purchase for ${username} (${userId})...`);

        const purchase = {
            id: purchaseId,
            order_id: orderId,
            order_number: orderId,
            user_id: userId,
            buyer_id: userId,
            product_id: tiktokProduct.id,
            product_name: tiktokProduct.name,
            selling_price: tiktokProduct.selling_price,
            product_cost: tiktokProduct.product_cost,
            binary_volume: tiktokProduct.binary_volume,
            price_paid: tiktokProduct.selling_price,
            payment_method: 'BANK_TRANSFER',
            status: 'ACTIVE',
            created_at: new Date(Date.now() - (16 - i) * 30000).toISOString(),
            activated_at: new Date(Date.now() - (16 - i) * 30000).toISOString()
        };

        const paymentDeposit = {
            id: `dep-hapana-${numStr}`,
            user_id: userId,
            product_id: tiktokProduct.id,
            order_id: orderId,
            order_number: orderId,
            amount: tiktokProduct.selling_price,
            bank_reference: `TXN-TIK-${numStr}-${Date.now()}`,
            slip_url: `storage/private/slips/slip-hapana-${numStr}.jpg`,
            status: 'APPROVED',
            approved_by: 'user-namobuddhaya-root',
            approved_at: purchase.activated_at,
            created_at: purchase.created_at
        };

        db.paymentDeposits.push(paymentDeposit);

        // Execute via PurchaseOrchestrator
        const result = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
            purchase,
            product: tiktokProduct,
            userId: userId,
            binaryNodes: db.binaryNodes,
            sponsors: db.sponsors,
            users: db.users,
            kycDocs: db.kycDocs,
            purchases: db.productPurchases,
            commissionLedger: db.commissionTransactions,
            volumeLedger: db.volumeLedger,
            walletLedger: db.walletLedger,
            dailyEarningsMap: dailyEarningsMap,
            auditLogs: db.auditLogs
        });

        const dirComm = result.summary.direct_commission ? result.summary.direct_commission.eligible_amount : 0;
        const uplineComm = result.summary.upline_commissions ? result.summary.upline_commissions.total_commission_paid : 0;
        console.log(`   Direct Commission: Rs. ${dirComm}`);
        console.log(`   Binary Commissions Paid: Rs. ${uplineComm}`);
    }

    // Reconcile Wallet Balances from walletLedger using WalletService
    db.wallets.forEach(w => {
        const balances = WalletService.calculateBalances(db.walletLedger, w.user_id);
        w.available_balance = balances.availableBalance;
        w.commission_balance = balances.commissionBalance;
        w.total_earned = balances.totalEarned;
        w.updated_at = new Date().toISOString();
    });

    // Save to mlm-db-store.json
    fs.writeFileSync(DB_STORE_FILE, JSON.stringify(db, null, 2), 'utf-8');
    console.log(`\n💾 Saved updated authoritative database store to ${DB_STORE_FILE}`);

    // Print summary table of all users and wallet balances
    console.log('\n=================== HAPANAMY ACCOUNTS SUMMARY ===================');
    console.log('Username\tEmail\t\t\tWallet Balance (Rs.)\tTotal Earned (Rs.)');
    db.users.forEach(u => {
        const wallet = db.wallets.find(w => w.user_id === u.id);
        const bal = wallet ? wallet.available_balance.toFixed(2) : '0.00';
        const earned = wallet ? wallet.total_earned.toFixed(2) : '0.00';
        console.log(`${u.username.padEnd(12)}\t${u.email.padEnd(24)}\t${bal.padStart(15)}\t${earned.padStart(15)}`);
    });
    console.log('=================================================================\n');

    return true;
}

if (require.main === module) {
    run();
}

module.exports = { run };
