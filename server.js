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
const ProductEconomicsCalculator = require('./services/product-economics-calculator');
const ProductCommissionValidator = require('./services/product-commission-validator');
const SafeBinaryCommissionRateCalculator = require('./services/safe-binary-commission-calculator');
const ProductSnapshotService = require('./services/product-snapshot-service');

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
const mockProductSnapshots = [];
const mockCommissionTransactions = [];
const mockSponsors = [];
const mockDailyEarningsMap = new Map();

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
        const {
            name, code, pricingMode, marketPrice, discountType, discountValue, price,
            productCost, minimumCompanyProfit, operatingCostReserve, paymentProcessingReserve,
            refundRiskReserve, taxReserve, otherReserve, commissionSafetyBuffer,
            binaryVolume, directCommissionRate, binaryCommissionRate, maxBinaryQualifiedLevels,
            commissionMode, status
        } = body;

        if (!name || !code) {
            sendJSON(res, 400, { error: 'Name and code are required.' });
            return;
        }

        // Set defaults to preserve backward compatibility for simple payloads
        const pricing = {
            pricing_mode: pricingMode || 'FIXED',
            market_price: parseFloat(marketPrice || price || 0.00),
            discount_type: discountType || 'NONE',
            discount_value: parseFloat(discountValue || 0.00),
            selling_price: parseFloat(price || 0.00),
            product_cost: parseFloat(productCost || 0.00),
            minimum_company_profit: parseFloat(minimumCompanyProfit || 0.00),
            operating_cost_reserve: parseFloat(operatingCostReserve || 0.00),
            payment_processing_reserve: parseFloat(paymentProcessingReserve || 0.00),
            refund_risk_reserve: parseFloat(refundRiskReserve || 0.00),
            tax_reserve: parseFloat(taxReserve || 0.00),
            other_reserve: parseFloat(otherReserve || 0.00),
            commission_safety_buffer: parseFloat(commissionSafetyBuffer || 0.00),
            binary_volume: parseFloat(binaryVolume || 0.00),
            direct_commission_rate: parseFloat(directCommissionRate || body.directCommission || 8.00),
            binary_commission_rate: parseFloat(binaryCommissionRate || body.binaryCommission || 7.00),
            max_binary_qualified_levels: parseInt(maxBinaryQualifiedLevels || 7),
            commission_mode: commissionMode || 'MANUAL'
        };

        // Determine maximum safe binary rate
        const maxSafeRate = SafeBinaryCommissionRateCalculator.calculateMaxSafeRate(pricing);

        if (pricing.commission_mode === 'AUTO_SAFE') {
            pricing.binary_commission_rate = maxSafeRate;
        }

        // Run economics and validator
        const econCalc = ProductEconomicsCalculator.calculate(pricing);
        const validation = ProductCommissionValidator.validate(econCalc);

        // Protect Product Profit Activation Firewall: BLOCKED products can never be set ACTIVE
        const targetStatus = status || 'ACTIVE';
        if (targetStatus === 'ACTIVE') {
            // 1. Check basic economics block conditions first
            if (validation.status === 'BLOCKED') {
                sendJSON(res, 400, {
                    status: 'BLOCKED',
                    blocked_reason: validation.blocked_reason,
                    effective_commission_budget: econCalc.calculated.effective_commission_budget,
                    maximum_commission_exposure: econCalc.calculated.max_total_commission_exposure,
                    remaining_margin: econCalc.calculated.remaining_company_margin,
                    maximum_safe_binary_rate: maxSafeRate,
                    requested_binary_rate: pricing.binary_commission_rate
                });
                return;
            }

            // 2. Check manual commission limits second
            if (pricing.commission_mode === 'MANUAL' && pricing.binary_commission_rate > maxSafeRate) {
                sendJSON(res, 400, {
                    status: 'BLOCKED',
                    blocked_reason: `Manual binary commission rate ${pricing.binary_commission_rate}% exceeds maximum safe rate of ${maxSafeRate}%.`,
                    requested_binary_rate: pricing.binary_commission_rate,
                    maximum_safe_binary_rate: maxSafeRate,
                    difference: Math.round((pricing.binary_commission_rate - maxSafeRate) * 100) / 100,
                    expected_commission_exposure: econCalc.calculated.max_total_commission_exposure,
                    effective_commission_budget: econCalc.calculated.effective_commission_budget,
                    maximum_commission_exposure: econCalc.calculated.max_total_commission_exposure,
                    remaining_margin: econCalc.calculated.remaining_company_margin
                });
                return;
            }
        }

        const prodId = 'prod-' + Math.random().toString(36).substr(2, 9);
        const product = {
            id: prodId,
            name: SecurityCore.sanitizeInput(name),
            code: SecurityCore.sanitizeInput(code),
            price: econCalc.calculated.selling_price,
            binary_volume: pricing.binary_volume,
            direct_commission_percent: pricing.direct_commission_rate,
            binary_commission_percent: pricing.binary_commission_rate,
            pricing_mode: pricing.pricing_mode,
            market_price: pricing.market_price,
            discount_type: pricing.discount_type,
            discount_value: pricing.discount_value,
            product_cost: pricing.product_cost,
            minimum_company_profit: pricing.minimum_company_profit,
            operating_cost_reserve: pricing.operating_cost_reserve,
            payment_processing_reserve: pricing.payment_processing_reserve,
            refund_risk_reserve: pricing.refund_risk_reserve,
            tax_reserve: pricing.tax_reserve,
            other_reserve: pricing.other_reserve,
            commission_safety_buffer: pricing.commission_safety_buffer,
            max_binary_qualified_levels: pricing.max_binary_qualified_levels,
            commission_mode: pricing.commission_mode,
            economics_status: validation.status,
            validation_status: validation.status === 'BLOCKED' ? 'FAILED' : 'VALIDATED',
            blocked_reason: validation.blocked_reason,
            status: targetStatus
        };

        mockProducts.push(product);
        KycService.logAction(mockAuditLogs, authUser.id, 'PRODUCT_CREATED', 'products', prodId, null, product);

        sendJSON(res, 201, { success: true, product });
        return;
    }

    // POST /api/products/edit (Admin only)
    if (req.method === 'POST' && pathname === '/api/products/edit') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { id, name, status } = body;

        if (!id) {
            sendJSON(res, 400, { error: 'Product ID is required.' });
            return;
        }

        const prodIdx = mockProducts.findIndex(p => p.id === id);
        if (prodIdx === -1) {
            sendJSON(res, 404, { error: 'Product not found.' });
            return;
        }

        const currentProduct = mockProducts[prodIdx];

        // Merge existing values with incoming updates
        const merged = {
            pricing_mode: body.pricingMode || currentProduct.pricing_mode || 'FIXED',
            market_price: parseFloat(body.marketPrice !== undefined ? body.marketPrice : (currentProduct.market_price || currentProduct.price || 0.00)),
            discount_type: body.discountType || currentProduct.discount_type || 'NONE',
            discount_value: parseFloat(body.discountValue !== undefined ? body.discountValue : (currentProduct.discount_value || 0.00)),
            selling_price: parseFloat(body.price !== undefined ? body.price : (currentProduct.price || 0.00)),
            product_cost: parseFloat(body.productCost !== undefined ? body.productCost : (currentProduct.product_cost || 0.00)),
            minimum_company_profit: parseFloat(body.minimumCompanyProfit !== undefined ? body.minimumCompanyProfit : (currentProduct.minimum_company_profit || 0.00)),
            operating_cost_reserve: parseFloat(body.operatingCostReserve !== undefined ? body.operatingCostReserve : (currentProduct.operating_cost_reserve || 0.00)),
            payment_processing_reserve: parseFloat(body.paymentProcessingReserve !== undefined ? body.paymentProcessingReserve : (currentProduct.payment_processing_reserve || 0.00)),
            refund_risk_reserve: parseFloat(body.refundRiskReserve !== undefined ? body.refundRiskReserve : (currentProduct.refund_risk_reserve || 0.00)),
            tax_reserve: parseFloat(body.taxReserve !== undefined ? body.taxReserve : (currentProduct.tax_reserve || 0.00)),
            other_reserve: parseFloat(body.otherReserve !== undefined ? body.otherReserve : (currentProduct.other_reserve || 0.00)),
            commission_safety_buffer: parseFloat(body.commissionSafetyBuffer !== undefined ? body.commissionSafetyBuffer : (currentProduct.commission_safety_buffer || 0.00)),
            binary_volume: parseFloat(body.binaryVolume !== undefined ? body.binaryVolume : (currentProduct.binary_volume || 0.00)),
            direct_commission_rate: parseFloat(body.directCommissionRate !== undefined ? body.directCommissionRate : (currentProduct.direct_commission_percent || 8.00)),
            binary_commission_rate: parseFloat(body.binaryCommissionRate !== undefined ? body.binaryCommissionRate : (currentProduct.binary_commission_percent || 7.00)),
            max_binary_qualified_levels: parseInt(body.maxBinaryQualifiedLevels !== undefined ? body.maxBinaryQualifiedLevels : (currentProduct.max_binary_qualified_levels || 7)),
            commission_mode: body.commissionMode || currentProduct.commission_mode || 'MANUAL'
        };

        const maxSafeRate = SafeBinaryCommissionRateCalculator.calculateMaxSafeRate(merged);

        if (merged.commission_mode === 'AUTO_SAFE') {
            merged.binary_commission_rate = maxSafeRate;
        }

        const econCalc = ProductEconomicsCalculator.calculate(merged);
        const validation = ProductCommissionValidator.validate(econCalc);

        const targetStatus = status !== undefined ? status : currentProduct.status;
        if (targetStatus === 'ACTIVE') {
            // 1. Check basic economics block conditions first
            if (validation.status === 'BLOCKED') {
                sendJSON(res, 400, {
                    status: 'BLOCKED',
                    blocked_reason: validation.blocked_reason,
                    effective_commission_budget: econCalc.calculated.effective_commission_budget,
                    maximum_commission_exposure: econCalc.calculated.max_total_commission_exposure,
                    remaining_margin: econCalc.calculated.remaining_company_margin,
                    maximum_safe_binary_rate: maxSafeRate,
                    requested_binary_rate: merged.binary_commission_rate
                });
                return;
            }

            // 2. Check manual commission limits second
            if (merged.commission_mode === 'MANUAL' && merged.binary_commission_rate > maxSafeRate) {
                sendJSON(res, 400, {
                    status: 'BLOCKED',
                    blocked_reason: `Manual binary commission rate ${merged.binary_commission_rate}% exceeds maximum safe rate of ${maxSafeRate}%.`,
                    requested_binary_rate: merged.binary_commission_rate,
                    maximum_safe_binary_rate: maxSafeRate,
                    difference: Math.round((merged.binary_commission_rate - maxSafeRate) * 100) / 100,
                    expected_commission_exposure: econCalc.calculated.max_total_commission_exposure,
                    effective_commission_budget: econCalc.calculated.effective_commission_budget,
                    maximum_commission_exposure: econCalc.calculated.max_total_commission_exposure,
                    remaining_margin: econCalc.calculated.remaining_company_margin
                });
                return;
            }
        }

        // Apply edits
        mockProducts[prodIdx] = {
            ...currentProduct,
            name: name ? SecurityCore.sanitizeInput(name) : currentProduct.name,
            price: econCalc.calculated.selling_price,
            binary_volume: merged.binary_volume,
            direct_commission_percent: merged.direct_commission_rate,
            binary_commission_percent: merged.binary_commission_rate,
            pricing_mode: merged.pricing_mode,
            market_price: merged.market_price,
            discount_type: merged.discount_type,
            discount_value: merged.discount_value,
            product_cost: merged.product_cost,
            minimum_company_profit: merged.minimum_company_profit,
            operating_cost_reserve: merged.operating_cost_reserve,
            payment_processing_reserve: merged.payment_processing_reserve,
            refund_risk_reserve: merged.refund_risk_reserve,
            tax_reserve: merged.tax_reserve,
            other_reserve: merged.other_reserve,
            commission_safety_buffer: merged.commission_safety_buffer,
            max_binary_qualified_levels: merged.max_binary_qualified_levels,
            commission_mode: merged.commission_mode,
            economics_status: validation.status,
            validation_status: validation.status === 'BLOCKED' ? 'FAILED' : 'VALIDATED',
            blocked_reason: validation.blocked_reason,
            status: targetStatus
        };

        KycService.logAction(mockAuditLogs, authUser.id, 'PRODUCT_EDITED', 'products', id, currentProduct, mockProducts[prodIdx]);

        sendJSON(res, 200, { success: true, product: mockProducts[prodIdx] });
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
                const activePurchase = mockProductPurchases[purchIdx];
                activePurchase.status = 'ACTIVE';
                activePurchase.activated_at = new Date().toISOString();

                // 1. Fetch Product definition
                const product = mockProducts.find(p => p.id === activePurchase.product_id) || mockProducts[0];

                // 2. Create Immutable Economics Snapshot
                const snapshot = ProductSnapshotService.createSnapshot(
                    product, 
                    activePurchase.id, 
                    activePurchase.activated_at
                );
                mockProductSnapshots.push(snapshot);

                // 3. Process Commissions and Volume Propagation via Snapshot
                CommissionCore.processPurchaseCommissions(activePurchase, snapshot, {
                    binaryNodes: mockBinaryNodes,
                    purchases: mockProductPurchases,
                    sponsors: mockSponsors,
                    commissionLedger: mockCommissionTransactions,
                    volumeLedger: mockVolumeLedger,
                    walletLedger: mockWalletLedger,
                    dailyEarningsMap: mockDailyEarningsMap
                });

                ProductService.triggerPurchaseActivation(activePurchase);
                KycService.logAction(mockAuditLogs, authUser.id, 'PURCHASE_ACTIVATED', 'product_purchases', deposit.purchase_id, null, { snapshot_id: snapshot.id });
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
