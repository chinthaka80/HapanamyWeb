const http = require('http');
const fs = require('fs');
const path = require('path');
const AuthService = require('./services/auth-service');
const PlacementEngine = require('./services/placement-engine');
const KycService = require('./services/kyc-service');
const ProductService = require('./services/product-service');

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

// Mock Databases for Phase 3/4/5
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

    // API Route: Image Upload (Original functionality preserved)
    if (req.method === 'POST' && pathname === '/api/upload') {
        const filename = url.searchParams.get('filename');
        if (!filename) {
            sendJSON(res, 400, { error: 'Missing filename parameter' });
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

        if (username === 'admin' || username === 'sponsor1') {
            sendJSON(res, 400, { error: 'Username is already taken.' });
            return;
        }

        if (email === 'admin@hapanamy.lk') {
            sendJSON(res, 400, { error: 'Email address is already registered.' });
            return;
        }

        if (sponsorCode === username) {
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
            user: { id: userId, username, email, role: 'member' }
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

    // POST /api/auth/forgot-password
    if (req.method === 'POST' && pathname === '/api/auth/forgot-password') {
        const body = await parseRequestBody(req);
        const { email } = body;
        if (!email) {
            sendJSON(res, 400, { error: 'Email is required.' });
            return;
        }
        sendJSON(res, 200, { success: true, message: 'Reset link sent if email exists.' });
        return;
    }

    // POST /api/auth/reset-password
    if (req.method === 'POST' && pathname === '/api/auth/reset-password') {
        const body = await parseRequestBody(req);
        const { token, newPassword } = body;
        if (!token || !newPassword) {
            sendJSON(res, 400, { error: 'Token and new password are required.' });
            return;
        }
        sendJSON(res, 200, { success: true, message: 'Password has been successfully updated.' });
        return;
    }

    // GET /api/auth/verify-email
    if (req.method === 'GET' && pathname === '/api/auth/verify-email') {
        sendJSON(res, 200, { success: true, message: 'Email verified successfully.' });
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
            sendJSON(res, 400, { error: 'KycId and action (VERIFIED/REJECTED) are required.' });
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
            name,
            code,
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

        // Prevent Duplicate Payment Reference submissions
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
            bank_reference: bankReference,
            slip_url: slipUrl,
            status: 'PENDING',
            notes: notes || '',
            created_at: new Date().toISOString()
        };

        mockProductPurchases.push(purchase);
        mockPaymentDeposits.push(deposit);

        KycService.logAction(mockAuditLogs, authUser.id, 'DEPOSIT_SUBMITTED', 'payment_deposits', depositId, null, deposit);

        sendJSON(res, 201, { success: true, purchaseId });
        return;
    }

    // GET /api/admin/deposits/pending (Admin only)
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

    // POST /api/admin/deposits/review (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/deposits/review') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { depositId, action, notes } = body; // action is 'APPROVED' or 'REJECTED'

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
        mockPaymentDeposits[depIdx].review_notes = notes || '';

        const purchIdx = mockProductPurchases.findIndex(p => p.id === deposit.purchase_id);
        if (purchIdx !== -1) {
            if (action === 'APPROVED') {
                mockProductPurchases[purchIdx].status = 'ACTIVE';
                mockProductPurchases[purchIdx].activated_at = new Date().toISOString();

                // Trigger decoupled commission engine and binary matching events
                ProductService.triggerPurchaseActivation(mockProductPurchases[purchIdx]);
                KycService.logAction(mockAuditLogs, authUser.id, 'PURCHASE_ACTIVATED', 'product_purchases', deposit.purchase_id);
            } else {
                mockProductPurchases[purchIdx].status = 'CANCELLED';
            }
        }

        const auditAction = action === 'APPROVED' ? 'DEPOSIT_APPROVED' : 'DEPOSIT_REJECTED';
        KycService.logAction(mockAuditLogs, authUser.id, auditAction, 'payment_deposits', depositId, { status: oldStatus }, { status: action });

        sendJSON(res, 200, { success: true, message: `Deposit reviewed successfully. Status updated to ${action}.` });
        return;
    }

    // GET /api/deposits/slip (Private storage streaming gate for payment slips)
    if (req.method === 'GET' && pathname === '/api/deposits/slip') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized to view secure slip.' });
            return;
        }

        const filename = url.searchParams.get('filename');
        if (!filename) {
            sendJSON(res, 400, { error: 'Missing filename.' });
            return;
        }

        const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
        const securePath = path.join(__dirname, 'storage', 'private', 'slips', safeFilename);

        if (!fs.existsSync(securePath)) {
            sendJSON(res, 404, { error: 'Slip not found or access denied.' });
            return;
        }

        const ownsSlip = mockPaymentDeposits.some(d => d.user_id === authUser.id && d.slip_url.includes(safeFilename));
        if (!ownsSlip && authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        res.writeHead(200, { 'Content-Type': 'image/png' }); // Assuming standard slip formats
        fs.createReadStream(securePath).pipe(res);
        return;
    }

    // POST /api/deposits/upload
    if (req.method === 'POST' && pathname === '/api/deposits/upload') {
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

        const slipsDir = path.join(__dirname, 'storage', 'private', 'slips');
        if (!fs.existsSync(slipsDir)) {
            fs.mkdirSync(slipsDir, { recursive: true });
        }

        const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
        const uploadPath = path.join(slipsDir, safeFilename);

        const writeStream = fs.createWriteStream(uploadPath);
        req.pipe(writeStream);

        writeStream.on('finish', () => {
            sendJSON(res, 200, { success: true, filePath: 'storage/private/slips/' + safeFilename });
        });

        writeStream.on('error', (err) => {
            sendJSON(res, 500, { success: false, error: err.message });
        });
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
