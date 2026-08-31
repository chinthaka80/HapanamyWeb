const http = require('http');
const fs = require('fs');
const path = require('path');
const AuthService = require('./services/auth-service');
const PlacementEngine = require('./services/placement-engine');
const KycService = require('./services/kyc-service');
const ProductService = require('./services/product-service');
const WalletService = require('./services/wallet-service');
const ReportService = require('./services/report-service');
const RefundService = require('./services/refund-service');
const CommissionCore = require('./services/commission-core');
const VolumeLedger = require('./services/volume-ledger');
const SecurityCore = require('./services/security-core');

const PORT = 3000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
};

// Simulated Database Sessions (Token store)
const activeSessions = new Map();

// Mock Databases for Phase 3/4/5/8/11/12/13
const mockKycDocs = [];
const mockBankAccounts = [];
const mockAuditLogs = [];

const mockProducts = [
    {
        id: 'prod-fb-mon',
        name: 'Facebook Monetisation Course',
        code: 'FB-MON',
        description: 'Learn to monetize Facebook Pages smartly.',
        category: 'Social Media',
        price: 7450.00,
        binary_volume: 7450.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        image_url: 'assets/fb-mon.jpg',
        course_url: 'https://hapanamy.lk/courses/fb-mon',
        status: 'ACTIVE'
    }
];
const mockProductPurchases = [];
const mockPaymentDeposits = [];

const mockWalletLedger = [];
const mockWithdrawalRequests = [];
const mockRefundRequests = [];
const mockVolumeLedger = [];
const mockBinaryNodes = [];
const mockFraudAlerts = [];

function parseRequestBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({});
            }
        });
    });
}

function sendJSON(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
}

function getAuthenticatedUser(req) {
    const authHeader = req.headers['authorization'];
    const token = authHeader ? authHeader.replace('Bearer ', '') : '';
    return activeSessions.get(token) || null;
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Enforce Rate Limiter on all incoming requests (API Abuse, Brute force prevention)
    const clientIp = req.socket.remoteAddress || '127.0.0.1';
    if (SecurityCore.isRateLimited(clientIp, 150)) { // Set threshold slightly higher for dev
        sendJSON(res, 429, { error: 'Too many requests. Please try again later.' });
        return;
    }

    // API Route: Image Upload (Original functionality preserved)
    if (req.method === 'POST' && pathname === '/api/upload') {
        const filename = url.searchParams.get('filename');
        if (!filename) {
            sendJSON(res, 400, { error: 'Missing filename parameter' });
            return;
        }

        if (!SecurityCore.isSafeFilename(filename)) {
            sendJSON(res, 400, { error: 'Invalid or unsafe file name format.' });
            return;
        }

        const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
        const uploadPath = path.join(__dirname, 'assets', safeFilename);

        const writeStream = fs.createWriteStream(uploadPath);
        req.pipe(writeStream);

        writeStream.on('finish', () => {
            sendJSON(res, 200, { success: true, filePath: 'assets/' + safeFilename });
        });

        writeStream.on('error', (err) => {
            sendJSON(res, 500, { success: false, error: err.message });
        });
        return;
    }

    // ========================================================
    // AUTHENTICATION & REGISTRATION API ROUTER (PHASE 3)
    // ========================================================

    // POST /api/auth/register
    if (req.method === 'POST' && pathname === '/api/auth/register') {
        const body = await parseRequestBody(req);
        const { fullName, username, email, mobile, password, dob, address, nicPassport, sponsorCode, position } = body;

        if (!fullName || !username || !email || !mobile || !password || !dob || !address || !nicPassport || !sponsorCode || !position) {
            sendJSON(res, 400, { error: 'All registration fields are required.' });
            return;
        }

        if (position !== 'LEFT' && position !== 'RIGHT') {
            sendJSON(res, 400, { error: 'Placement position must be LEFT or RIGHT.' });
            return;
        }

        // Sanitize Username & Email to prevent XSS injection
        const cleanUsername = SecurityCore.sanitizeInput(username);
        const cleanEmail = SecurityCore.sanitizeInput(email);

        if (cleanUsername === 'admin' || cleanUsername === 'sponsor1') {
            sendJSON(res, 400, { error: 'Username is already taken.' });
            return;
        }

        if (cleanEmail === 'admin@hapanamy.lk') {
            sendJSON(res, 400, { error: 'Email address is already registered.' });
            return;
        }

        if (sponsorCode === cleanUsername) {
            sendJSON(res, 400, { error: 'Self-referral is strictly prohibited.' });
            return;
        }

        const validSponsors = ['admin', 'sponsor1'];
        if (!validSponsors.includes(sponsorCode)) {
            sendJSON(res, 400, { error: 'Invalid or non-existent sponsor referral code.' });
            return;
        }

        const userId = 'user-uuid-' + Math.random().toString(36).substr(2, 9);
        const passwordHash = AuthService.hashPassword(password);

        sendJSON(res, 201, {
            success: true,
            message: 'Registration successful! Verification notification sent.',
            user: { id: userId, username: cleanUsername, email: cleanEmail, role: 'member' }
        });
        return;
    }

    // POST /api/auth/login
    if (req.method === 'POST' && pathname === '/api/auth/login') {
        const body = await parseRequestBody(req);
        const { email, password } = body;

        if (!email || !password) {
            sendJSON(res, 400, { error: 'Email and password are required.' });
            return;
        }

        const adminEmail = 'admin@hapanamy.lk';
        if (email === adminEmail && password === 'Araliya321#') {
            const token = AuthService.generateToken();
            activeSessions.set(token, { email, role: 'admin', id: 'admin-uuid-123' });
            sendJSON(res, 200, { success: true, token, user: { email, role: 'admin' } });
            return;
        }

        // Student Mock Login
        if (email === 'member@hapanamy.lk' && password === 'Araliya321#') {
            const token = AuthService.generateToken();
            activeSessions.set(token, { email, role: 'member', id: 'member-uuid-100' });
            sendJSON(res, 200, { success: true, token, user: { email, role: 'member' } });
            return;
        }

        sendJSON(res, 401, { error: 'Invalid credentials or access denied.' });
        return;
    }

    // POST /api/auth/logout
    if (req.method === 'POST' && pathname === '/api/auth/logout') {
        const authHeader = req.headers['authorization'];
        const token = authHeader ? authHeader.replace('Bearer ', '') : '';

        if (token && activeSessions.has(token)) {
            activeSessions.delete(token);
            sendJSON(res, 200, { success: true, message: 'Logged out successfully.' });
        } else {
            sendJSON(res, 400, { error: 'Invalid session or token.' });
        }
        return;
    }

    // ========================================================
    // KYC & BANK ACCOUNT SYSTEM REST ENDPOINTS (PHASE 4)
    // ========================================================

    // POST /api/kyc/submit
    if (req.method === 'POST' && pathname === '/api/kyc/submit') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        if (!KycService.isValidSubmission(body)) {
            sendJSON(res, 400, { error: 'All KYC fields and Bank Account details are required.' });
            return;
        }

        // Check for Suspicious duplication fraud indicators
        const alerts = SecurityCore.detectFraudAlerts(
            { nicPassport: body.nicPassport, accountNumber: body.accountNumber },
            mockKycDocs,
            mockBankAccounts
        );
        if (alerts.length > 0) {
            mockFraudAlerts.push(...alerts);
            KycService.logAction(mockAuditLogs, authUser.id, 'FRAUD_ALERT_TRIGGERED', 'kyc_documents', null, null, alerts[0]);
        }

        const docId = 'kyc-doc-' + Math.random().toString(36).substr(2, 9);
        const docEntry = {
            id: docId,
            user_id: authUser.id,
            nic_passport: body.nicPassport,
            document_url: body.documentUrl,
            status: 'PENDING',
            created_at: new Date().toISOString()
        };

        const bankId = 'bank-ac-' + Math.random().toString(36).substr(2, 9);
        const bankEntry = {
            id: bankId,
            user_id: authUser.id,
            bank_name: body.bankName,
            branch_name: body.branchName,
            account_holder_name: body.accountHolderName,
            account_number: body.accountNumber,
            is_active: true
        };

        mockKycDocs.push(docEntry);
        mockBankAccounts.push(bankEntry);

        KycService.logAction(mockAuditLogs, authUser.id, 'KYC_SUBMITTED', 'kyc_documents', docId, null, { status: 'PENDING' });
        KycService.logAction(mockAuditLogs, authUser.id, 'BANK_ADDED', 'bank_accounts', bankId, null, { accountNumber: body.accountNumber });

        sendJSON(res, 201, { success: true, message: 'KYC submitted successfully and bank details updated.' });
        return;
    }

    // GET /api/kyc/status
    if (req.method === 'GET' && pathname === '/api/kyc/status') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const doc = mockKycDocs.find(d => d.user_id === authUser.id);
        const bank = mockBankAccounts.find(b => b.user_id === authUser.id && b.is_active);
        sendJSON(res, 200, {
            kycStatus: doc ? doc.status : 'NOT_SUBMITTED',
            kycDetails: doc || null,
            bankDetails: bank || null
        });
        return;
    }

    // GET /api/admin/kyc/pending
    if (req.method === 'GET' && pathname === '/api/admin/kyc/pending') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const pending = mockKycDocs.filter(d => d.status === 'PENDING');
        sendJSON(res, 200, { pending });
        return;
    }

    // POST /api/admin/kyc/review
    if (req.method === 'POST' && pathname === '/api/admin/kyc/review') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { kycId, action, notes } = body;

        if (!kycId || !action || !['VERIFIED', 'REJECTED'].includes(action)) {
            sendJSON(res, 400, { error: 'KycId and action are required.' });
            return;
        }

        const docIdx = mockKycDocs.findIndex(d => d.id === kycId);
        if (docIdx === -1) {
            sendJSON(res, 404, { error: 'KYC Document not found.' });
            return;
        }

        const oldStatus = mockKycDocs[docIdx].status;
        mockKycDocs[docIdx].status = action;
        mockKycDocs[docIdx].reviewer_id = authUser.id;
        mockKycDocs[docIdx].review_notes = notes || '';
        mockKycDocs[docIdx].reviewed_at = new Date().toISOString();

        const auditAction = action === 'VERIFIED' ? 'KYC_APPROVED' : 'KYC_REJECTED';
        KycService.logAction(mockAuditLogs, authUser.id, auditAction, 'kyc_documents', kycId, { status: oldStatus }, { status: action, notes });

        sendJSON(res, 200, { success: true, message: `KYC request status has been updated to ${action}.` });
        return;
    }

    // POST /api/bank/update
    if (req.method === 'POST' && pathname === '/api/bank/update') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { bankName, branchName, accountHolderName, accountNumber } = body;

        if (!bankName || !branchName || !accountHolderName || !accountNumber) {
            sendJSON(res, 400, { error: 'All Bank details are required.' });
            return;
        }

        const oldBankIdx = mockBankAccounts.findIndex(b => b.user_id === authUser.id && b.is_active);
        let oldBank = null;
        if (oldBankIdx !== -1) {
            oldBank = { ...mockBankAccounts[oldBankIdx] };
            mockBankAccounts[oldBankIdx].is_active = false;
        }

        const newBankId = 'bank-ac-' + Math.random().toString(36).substr(2, 9);
        const newBank = {
            id: newBankId,
            user_id: authUser.id,
            bank_name: bankName,
            branch_name: branchName,
            account_holder_name: accountHolderName,
            account_number: accountNumber,
            is_active: true
        };
        mockBankAccounts.push(newBank);

        const actionType = oldBank ? 'BANK_CHANGED' : 'BANK_ADDED';
        KycService.logAction(mockAuditLogs, authUser.id, actionType, 'bank_accounts', newBankId, oldBank, newBank);

        sendJSON(res, 200, { success: true, message: 'Bank account updated successfully.' });
        return;
    }

    // GET /api/kyc/document
    if (req.method === 'GET' && pathname === '/api/kyc/document') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized to view secure document.' });
            return;
        }

        const filename = url.searchParams.get('filename');
        if (!filename) {
            sendJSON(res, 400, { error: 'Missing filename.' });
            return;
        }

        if (!SecurityCore.isSafeFilename(filename)) {
            sendJSON(res, 400, { error: 'Unsafe filename format.' });
            return;
        }

        const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
        const securePath = path.join(__dirname, 'storage', 'private', 'kyc', safeFilename);

        if (!fs.existsSync(securePath)) {
            sendJSON(res, 404, { error: 'Document not found or access denied.' });
            return;
        }

        const ownsDoc = mockKycDocs.some(d => d.user_id === authUser.id && d.document_url.includes(safeFilename));
        if (!ownsDoc && authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/pdf' });
        fs.createReadStream(securePath).pipe(res);
        return;
    }

    // POST /api/kyc/upload
    if (req.method === 'POST' && pathname === '/api/kyc/upload') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const filename = url.searchParams.get('filename');
        if (!filename) {
            sendJSON(res, 400, { error: 'Missing filename.' });
            return;
        }

        if (!SecurityCore.isSafeFilename(filename)) {
            sendJSON(res, 400, { error: 'Unsafe file format.' });
            return;
        }

        const kycDir = path.join(__dirname, 'storage', 'private', 'kyc');
        if (!fs.existsSync(kycDir)) {
            fs.mkdirSync(kycDir, { recursive: true });
        }

        const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
        const uploadPath = path.join(kycDir, safeFilename);

        const writeStream = fs.createWriteStream(uploadPath);
        req.pipe(writeStream);

        writeStream.on('finish', () => {
            sendJSON(res, 200, { success: true, filePath: 'storage/private/kyc/' + safeFilename });
        });

        writeStream.on('error', (err) => {
            sendJSON(res, 500, { success: false, error: err.message });
        });
        return;
    }

    // ========================================================
    // PRODUCTS & BANK DEPOSIT PAYMENT SYSTEM (PHASE 5)
    // ========================================================

    // GET /api/products/list
    if (req.method === 'GET' && pathname === '/api/products/list') {
        const activeOnly = mockProducts.filter(p => p.status === 'ACTIVE');
        sendJSON(res, 200, { products: activeOnly });
        return;
    }

    // POST /api/products/create (Admin only)
    if (req.method === 'POST' && pathname === '/api/products/create') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { name, code, price, binaryVolume, directCommission, binaryCommission } = body;

        if (!name || !code || !price || !binaryVolume) {
            sendJSON(res, 400, { error: 'Name, code, price and binaryVolume are required.' });
            return;
        }

        const prodId = 'prod-' + Math.random().toString(36).substr(2, 9);
        const product = {
            id: prodId,
            name: SecurityCore.sanitizeInput(name),
            code: SecurityCore.sanitizeInput(code),
            price: parseFloat(price),
            binary_volume: parseFloat(binaryVolume),
            direct_commission_percent: parseFloat(directCommission || 8),
            binary_commission_percent: parseFloat(binaryCommission || 7),
            status: 'ACTIVE'
        };

        mockProducts.push(product);
        KycService.logAction(mockAuditLogs, authUser.id, 'PRODUCT_CREATED', 'products', prodId, null, product);

        sendJSON(res, 201, { success: true, product });
        return;
    }

    // POST /api/deposits/submit
    if (req.method === 'POST' && pathname === '/api/deposits/submit') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { productId, bankReference, amount, slipUrl, notes } = body;

        if (!productId || !bankReference || !amount || !slipUrl) {
            sendJSON(res, 400, { error: 'All fields (productId, reference, amount, slip) are required.' });
            return;
        }

        const duplicate = mockPaymentDeposits.some(d => d.bank_reference === bankReference);
        if (duplicate) {
            sendJSON(res, 400, { error: 'This payment reference code has already been submitted.' });
            return;
        }

        const purchaseId = 'purch-' + Math.random().toString(36).substr(2, 9);
        const purchase = {
            id: purchaseId,
            user_id: authUser.id,
            product_id: productId,
            price_paid: parseFloat(amount),
            status: 'PENDING',
            created_at: new Date().toISOString()
        };

        const depositId = 'dep-' + Math.random().toString(36).substr(2, 9);
        const deposit = {
            id: depositId,
            purchase_id: purchaseId,
            user_id: authUser.id,
            bank_reference: SecurityCore.sanitizeInput(bankReference),
            slip_url: slipUrl,
            status: 'PENDING',
            notes: SecurityCore.sanitizeInput(notes || ''),
            created_at: new Date().toISOString()
        };

        mockProductPurchases.push(purchase);
        mockPaymentDeposits.push(deposit);

        KycService.logAction(mockAuditLogs, authUser.id, 'DEPOSIT_SUBMITTED', 'payment_deposits', depositId, null, deposit);

        sendJSON(res, 201, { success: true, purchaseId });
        return;
    }

    // GET /api/admin/deposits/pending
    if (req.method === 'GET' && pathname === '/api/admin/deposits/pending') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const pending = mockPaymentDeposits.filter(d => d.status === 'PENDING');
        sendJSON(res, 200, { pending });
        return;
    }

    // POST /api/admin/deposits/review
    if (req.method === 'POST' && pathname === '/api/admin/deposits/review') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { depositId, action, notes } = body;

        if (!depositId || !action || !['APPROVED', 'REJECTED'].includes(action)) {
            sendJSON(res, 400, { error: 'DepositId and action are required.' });
            return;
        }

        const depIdx = mockPaymentDeposits.findIndex(d => d.id === depositId);
        if (depIdx === -1) {
            sendJSON(res, 404, { error: 'Deposit not found.' });
            return;
        }

        const deposit = mockPaymentDeposits[depIdx];
        const oldStatus = deposit.status;
        mockPaymentDeposits[depIdx].status = action;
        mockPaymentDeposits[depIdx].reviewer_id = authUser.id;
        mockPaymentDeposits[depIdx].reviewed_at = new Date().toISOString();

        const purchIdx = mockProductPurchases.findIndex(p => p.id === deposit.purchase_id);
        if (purchIdx !== -1) {
            if (action === 'APPROVED') {
                mockProductPurchases[purchIdx].status = 'ACTIVE';
                mockProductPurchases[purchIdx].activated_at = new Date().toISOString();

                ProductService.triggerPurchaseActivation(mockProductPurchases[purchIdx]);
                KycService.logAction(mockAuditLogs, authUser.id, 'PURCHASE_ACTIVATED', 'product_purchases', deposit.purchase_id);

                // Auto Seed Direct Referral commission (8%) to sponsor for local testing
                const sponsorCommission = ProductService.isValidDeposit(deposit) ? mockProducts[0].price * 0.08 : 596.00;
                mockWalletLedger.push({
                    id: 'tx-' + Math.random().toString(36).substr(2, 9),
                    user_id: 'sponsor-uuid-99',
                    source_purchase_id: deposit.purchase_id, // Store source purchase reference for reversal
                    type: 'DIRECT_COMMISSION',
                    amount: sponsorCommission,
                    created_at: new Date().toISOString()
                });
            } else {
                mockProductPurchases[purchIdx].status = 'CANCELLED';
            }
        }

        const auditAction = action === 'APPROVED' ? 'DEPOSIT_APPROVED' : 'DEPOSIT_REJECTED';
        KycService.logAction(mockAuditLogs, authUser.id, auditAction, 'payment_deposits', depositId, { status: oldStatus }, { status: action });

        sendJSON(res, 200, { success: true, message: `Deposit status has been updated to ${action}.` });
        return;
    }

    // ========================================================
    // WALLET & WITHDRAWAL SYSTEM API ROUTER (PHASE 8)
    // ========================================================

    // GET /api/wallet/balance
    if (req.method === 'GET' && pathname === '/api/wallet/balance') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const userLedger = mockWalletLedger.filter(tx => tx.user_id === authUser.id);
        const balances = WalletService.calculateBalances(userLedger);
        sendJSON(res, 200, { balances, ledger: userLedger });
        return;
    }

    // POST /api/withdrawal/request
    if (req.method === 'POST' && pathname === '/api/withdrawal/request') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        const amount = parseFloat(body.amount);

        if (!amount || amount <= 0) {
            sendJSON(res, 400, { error: 'A valid amount is required.' });
            return;
        }

        // Fetch User KYC Status & Active Bank Details
        const kyc = mockKycDocs.find(d => d.user_id === authUser.id);
        const kycStatus = kyc ? kyc.status : 'PENDING';

        const userLedger = mockWalletLedger.filter(tx => tx.user_id === authUser.id);
        const balances = WalletService.calculateBalances(userLedger);

        const check = WalletService.validateWithdrawal(amount, balances.availableBalance, kycStatus);
        if (!check.valid) {
            sendJSON(res, 400, { error: check.error });
            return;
        }

        const reqId = 'withdraw-' + Math.random().toString(36).substr(2, 9);
        const request = {
            id: reqId,
            user_id: authUser.id,
            amount: amount,
            status: 'PENDING',
            created_at: new Date().toISOString()
        };

        mockWithdrawalRequests.push(request);

        // Lock funds in Wallet Ledger (Negative Entry)
        mockWalletLedger.push({
            id: 'tx-' + Math.random().toString(36).substr(2, 9),
            user_id: authUser.id,
            type: 'WITHDRAWAL_REQUEST',
            amount: -amount,
            reference_id: reqId,
            reference_type: 'withdrawal_requests',
            created_at: new Date().toISOString()
        });

        KycService.logAction(mockAuditLogs, authUser.id, 'WITHDRAWAL_REQUESTED', 'withdrawal_requests', reqId, null, { amount });

        sendJSON(res, 201, { success: true, request });
        return;
    }

    // GET /api/admin/withdrawals/pending (Admin only)
    if (req.method === 'GET' && pathname === '/api/admin/withdrawals/pending') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const pending = mockWithdrawalRequests.filter(w => w.status === 'PENDING');
        sendJSON(res, 200, { pending });
        return;
    }

    // POST /api/admin/withdrawals/review (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/withdrawals/review') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { requestId, action, notes } = body; // action is 'APPROVED' or 'REJECTED'

        if (!requestId || !action || !['APPROVED', 'REJECTED'].includes(action)) {
            sendJSON(res, 400, { error: 'RequestId and action are required.' });
            return;
        }

        const reqIdx = mockWithdrawalRequests.findIndex(w => w.id === requestId);
        if (reqIdx === -1) {
            sendJSON(res, 404, { error: 'Withdrawal request not found.' });
            return;
        }

        const reqObj = mockWithdrawalRequests[reqIdx];
        const oldStatus = reqObj.status;
        mockWithdrawalRequests[reqIdx].status = action;
        mockWithdrawalRequests[reqIdx].reviewer_id = authUser.id;
        mockWithdrawalRequests[reqIdx].reviewed_at = new Date().toISOString();

        if (action === 'REJECTED') {
            // Unlock funds: credit back to wallet ledger
            mockWalletLedger.push({
                id: 'tx-' + Math.random().toString(36).substr(2, 9),
                user_id: reqObj.user_id,
                type: 'ADJUSTMENT',
                amount: reqObj.amount, // Positive adjustment to refund back
                reference_id: requestId,
                reference_type: 'withdrawal_requests',
                created_at: new Date().toISOString()
            });
        }

        const auditAction = action === 'APPROVED' ? 'WITHDRAWAL_APPROVED' : 'WITHDRAWAL_REJECTED';
        KycService.logAction(mockAuditLogs, authUser.id, auditAction, 'withdrawal_requests', requestId, { status: oldStatus }, { status: action, notes });

        sendJSON(res, 200, { success: true, message: `Request status has been updated to ${action}.` });
        return;
    }

    // POST /api/admin/withdrawals/pay (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/withdrawals/pay') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { requestId } = body;

        if (!requestId) {
            sendJSON(res, 400, { error: 'RequestId is required.' });
            return;
        }

        const reqIdx = mockWithdrawalRequests.findIndex(w => w.id === requestId);
        if (reqIdx === -1) {
            sendJSON(res, 404, { error: 'Withdrawal request not found.' });
            return;
        }

        const reqObj = mockWithdrawalRequests[reqIdx];
        if (reqObj.status !== 'APPROVED') {
            sendJSON(res, 400, { error: 'Only approved requests can be marked as paid.' });
            return;
        }

        mockWithdrawalRequests[reqIdx].status = 'PAID';
        mockWithdrawalRequests[reqIdx].paid_at = new Date().toISOString();

        // Log paid withdrawal in wallet ledger
        mockWalletLedger.push({
            id: 'tx-' + Math.random().toString(36).substr(2, 9),
            user_id: reqObj.user_id,
            type: 'WITHDRAWAL_PAID',
            amount: -reqObj.amount, // Lock out transaction
            reference_id: requestId,
            reference_type: 'withdrawal_requests',
            created_at: new Date().toISOString()
        });

        KycService.logAction(mockAuditLogs, authUser.id, 'WITHDRAWAL_PAID', 'withdrawal_requests', requestId, { status: 'APPROVED' }, { status: 'PAID' });

        sendJSON(res, 200, { success: true, message: 'Withdrawal marked as paid successfully.' });
        return;
    }

    // ========================================================
    // REPORTING & ANALYTICS API ROUTER (PHASE 11)
    // ========================================================

    // GET /api/admin/reports
    if (req.method === 'GET' && pathname === '/api/admin/reports') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const type = url.searchParams.get('type') || 'sales';
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const productId = url.searchParams.get('productId');
        const userId = url.searchParams.get('userId');
        const limit = url.searchParams.get('limit') || 10;
        const offset = url.searchParams.get('offset') || 0;

        let dataset = [];
        if (type === 'sales') {
            dataset = mockProductPurchases;
        } else if (type === 'commissions') {
            dataset = mockWalletLedger.filter(tx => tx.type === 'DIRECT_COMMISSION' || tx.type === 'BINARY_COMMISSION');
        } else if (type === 'withdrawals') {
            dataset = mockWithdrawalRequests;
        } else if (type === 'deposits') {
            dataset = mockPaymentDeposits;
        } else if (type === 'kyc') {
            dataset = mockKycDocs;
        }

        const report = ReportService.generateReport(dataset, { startDate, endDate, productId, userId, limit, offset });
        sendJSON(res, 200, report);
        return;
    }

    // GET /api/admin/reports/export
    if (req.method === 'GET' && pathname === '/api/admin/reports/export') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const type = url.searchParams.get('type') || 'sales';
        let dataset = [];
        if (type === 'sales') {
            dataset = mockProductPurchases;
        } else if (type === 'commissions') {
            dataset = mockWalletLedger.filter(tx => tx.type === 'DIRECT_COMMISSION' || tx.type === 'BINARY_COMMISSION');
        } else if (type === 'withdrawals') {
            dataset = mockWithdrawalRequests;
        } else if (type === 'deposits') {
            dataset = mockPaymentDeposits;
        }

        const csvString = ReportService.exportToCSV(dataset);
        res.writeHead(200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="hapanamy_${type}_report.csv"`
        });
        res.end(csvString);
        return;
    }

    // ========================================================
    // REFUND & REVERSAL SYSTEM REST ENDPOINTS (PHASE 12)
    // ========================================================

    // POST /api/refund/request
    if (req.method === 'POST' && pathname === '/api/refund/request') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { purchaseId } = body;

        if (!purchaseId) {
            sendJSON(res, 400, { error: 'PurchaseId is required.' });
            return;
        }

        const purchase = mockProductPurchases.find(p => p.id === purchaseId && p.user_id === authUser.id);
        const check = RefundService.checkEligibility(purchase);
        if (!check.eligible) {
            sendJSON(res, 400, { error: check.error });
            return;
        }

        const refId = 'refund-' + Math.random().toString(36).substr(2, 9);
        const refundRequest = {
            id: refId,
            purchase_id: purchaseId,
            user_id: authUser.id,
            status: 'PENDING',
            created_at: new Date().toISOString()
        };

        mockRefundRequests.push(refundRequest);
        KycService.logAction(mockAuditLogs, authUser.id, 'REFUND_REQUESTED', 'refund_requests', refId);

        sendJSON(res, 201, { success: true, refundRequest });
        return;
    }

    // GET /api/admin/refunds/pending (Admin only)
    if (req.method === 'GET' && pathname === '/api/admin/refunds/pending') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const pending = mockRefundRequests.filter(r => r.status === 'PENDING');
        sendJSON(res, 200, { pending });
        return;
    }

    // POST /api/admin/refunds/review (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/refunds/review') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { refundId, action } = body; // action is 'APPROVED' or 'REJECTED'

        if (!refundId || !action || !['APPROVED', 'REJECTED'].includes(action)) {
            sendJSON(res, 400, { error: 'RefundId and action are required.' });
            return;
        }

        const refIdx = mockRefundRequests.findIndex(r => r.id === refundId);
        if (refIdx === -1) {
            sendJSON(res, 404, { error: 'Refund request not found.' });
            return;
        }

        const refObj = mockRefundRequests[refIdx];
        mockRefundRequests[refIdx].status = action === 'APPROVED' ? 'COMPLETED' : 'REJECTED';

        if (action === 'APPROVED') {
            const purchIdx = mockProductPurchases.findIndex(p => p.id === refObj.purchase_id);
            if (purchIdx !== -1) {
                mockProductPurchases[purchIdx].status = 'REFUNDED';
                mockProductPurchases[purchIdx].refunded_at = new Date().toISOString();

                // Reverse commissions referencing original purchase
                CommissionCore.reverseCommission(refObj.purchase_id, mockWalletLedger);

                // Reverse volume referencing original purchase
                VolumeLedger.reverseVolume(refObj.purchase_id, mockBinaryNodes, mockVolumeLedger);

                KycService.logAction(mockAuditLogs, authUser.id, 'PURCHASE_REFUNDED', 'product_purchases', refObj.purchase_id);
            }
        }

        const auditAction = action === 'APPROVED' ? 'REFUND_APPROVED' : 'REFUND_REJECTED';
        KycService.logAction(mockAuditLogs, authUser.id, auditAction, 'refund_requests', refundId);

        sendJSON(res, 200, { success: true, message: `Refund request updated to ${action}.` });
        return;
    }

    // ========================================================
    // STATIC ASSET SERVING
    // ========================================================
    let safeUrl = pathname;
    let filePath = path.join(__dirname, safeUrl === '/' ? 'index.html' : safeUrl);
    
    if (safeUrl.startsWith('/storage/private/') || !filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
