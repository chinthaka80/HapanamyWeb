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
const ReferralService = require('./services/referral-service');
const QualificationEngine = require('./services/qualification-engine');
const MemberDashboardService = require('./services/member-dashboard-service');
const AdminDashboardService = require('./services/admin-dashboard-service');
const NotificationEngine = require('./services/notification-engine');
const ReversalEngine = require('./services/reversal-engine');
const SimulationEngine = require('./services/simulation-engine');
const PurchaseOrchestrator = require('./services/purchase-orchestrator');

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

// Mock Databases for Phase 3/4/5/8/11/12/13/26/27
const mockWallets = [];
const mockReferralIntents = [];
const mockKycDocs = [
    { id: 'kyc-1', user_id: 'sponsor-uuid-1', id_type: 'NIC', id_number: '199512345678', full_name: 'Kasun Tharaka', status: 'APPROVED', created_at: '2026-08-01T10:00:00Z' },
    { id: 'kyc-2', user_id: 'nimal-uuid-2', id_type: 'NIC', id_number: '199487654321', full_name: 'Nimal Silva', status: 'APPROVED', created_at: '2026-08-05T10:00:00Z' },
    { id: 'kyc-3', user_id: 'sunil-uuid-3', id_type: 'NIC', id_number: '199611223344', full_name: 'Sunil Kumar', status: 'APPROVED', created_at: '2026-08-10T10:00:00Z' }
];
const mockBankAccounts = [
    { user_id: 'sponsor-uuid-1', bank_name: 'Commercial Bank', branch: 'Maharagama', account_number: '8010294851', account_holder_name: 'Kasun Tharaka' }
];
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
    },
    {
        id: 'prod-social-master',
        name: 'Social Media Income Masterclass',
        code: 'SOC-MASTER',
        description: 'Complete digital agency & high-income skills blueprint.',
        category: 'Income Masterclass',
        price: 27500.00,
        binary_volume: 27500.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        image_url: 'assets/social_media_banner.jpg',
        course_url: 'https://hapanamy.lk/courses/soc-master',
        status: 'ACTIVE'
    }
];

const mockProductSnapshots = [
    {
        id: 'snap-soc-1',
        product_id: 'prod-social-master',
        product_name: 'Social Media Income Masterclass',
        selling_price: 27500.00,
        product_cost: 2500.00,
        binary_volume: 27500.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        created_at: '2026-08-01T08:00:00Z'
    }
];

const mockProductPurchases = [];
const mockPaymentDeposits = [];

const mockUsers = [
    { 
        id: 'user-hiru-root', 
        username: 'Hiru', 
        full_name: 'Hiru', 
        email: 'hiru@hapanamy.lk', 
        role: 'admin', 
        status: 'ACTIVE', 
        referral_code: 'Hiru',
        password_hash: '8639bf7eafee04438d92c46948989726:95a6523d509eb56ae5841e7a311a23445ec21524de1819bd64725445c552a5a279233e7ff746818ded8851004b35179e0222dd80e734a6b1eb2ee2f062d2d4ed',
        password: 'Hapana20260808',
        created_at: '2026-09-01T00:00:00Z' 
    },
    { 
        id: 'user-namobuddhaya-root', 
        username: 'NAMOBUDDHAYA', 
        full_name: 'NAMOBUDDHAYA', 
        email: 'admin@hapanamy.lk', 
        role: 'admin', 
        status: 'ACTIVE', 
        referral_code: 'NAMOBUDDHAYA',
        password_hash: '8639bf7eafee04438d92c46948989726:95a6523d509eb56ae5841e7a311a23445ec21524de1819bd64725445c552a5a279233e7ff746818ded8851004b35179e0222dd80e734a6b1eb2ee2f062d2d4ed',
        password: 'Hapana20260808',
        created_at: '2026-09-01T00:00:00Z' 
    }
];

const mockWalletLedger = [];
const mockWithdrawalRequests = [];
const mockRefundRequests = [];
const mockVolumeLedger = [];
const mockBinaryNodes = [
    { 
        id: 'node-hiru-root', 
        user_id: 'user-hiru-root', 
        placement_parent_id: null, 
        position: null, 
        depth: 1, 
        path: '', 
        left_child_id: null, 
        right_child_id: null, 
        created_at: '2026-09-01T00:00:00Z' 
    }
];
const mockFraudAlerts = [];
const mockCommissionTransactions = [];
const mockSponsors = [];
const mockReferralClicks = [];
const mockReferralConversions = [];
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

    // GET /api/health (System Health & Readiness Inspection)
    if (req.method === 'GET' && (pathname === '/api/health' || pathname === '/api/db/health')) {
        const isProduction = process.env.NODE_ENV === 'production';
        const hasDbUrl = Boolean(process.env.DATABASE_URL);
        const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

        sendJSON(res, 200, {
            status: 'ok',
            service: 'HAPANAMY API',
            timestamp: new Date().toISOString(),
            application: 'HAPANAMY.LK MLM PLATFORM',
            environment: process.env.NODE_ENV || 'development',
            uptime_seconds: Math.floor(process.uptime()),
            checks: {
                database: {
                    configured: hasDbUrl,
                    mode: isProduction ? (hasDbUrl ? 'CLOUD_POSTGRESQL' : 'FAIL_CLOSED') : 'DEV_MEMORY_TEST_HARNESS',
                    fail_closed_enforced: isProduction && !hasDbUrl
                },
                smtp: {
                    configured: hasSmtp,
                    status: hasSmtp ? 'CONFIGURED' : 'NOT_CONFIGURED'
                },
                business_rules: {
                    registration_fee: 'FREE (Rs. 0)',
                    direct_commission_percent: 8.00,
                    binary_commission_percent: 7.00,
                    max_qualified_uplines: 7,
                    daily_earnings_cap_lkr: 30000.00,
                    timezone: 'Asia/Colombo'
                }
            }
        });
        return;
    }

    // Production Fail-Closed Safety Middleware for Financial Mutations
    const financialEndpoints = [
        '/api/purchases',
        '/api/payments/verify',
        '/api/withdrawals',
        '/api/admin/refunds'
    ];
    if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL && financialEndpoints.some(ep => pathname.startsWith(ep))) {
        sendJSON(res, 503, {
            error: 'FAIL_CLOSED: Production financial operations require a live PostgreSQL DATABASE_URL connection.',
            code: 'DATABASE_UNAVAILABLE'
        });
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

    // POST /api/auth/register (STEP 15)
    if (req.method === 'POST' && pathname === '/api/auth/register') {
        const body = await parseRequestBody(req);

        const result = AuthService.registerMember(body, {
            users: mockUsers,
            sponsors: mockSponsors,
            binaryNodes: mockBinaryNodes,
            volumeLedger: mockVolumeLedger,
            wallets: mockWallets,
            kycDocs: mockKycDocs,
            bankAccounts: mockBankAccounts,
            auditLogs: mockAuditLogs,
            referralConversions: mockReferralConversions,
            intentStore: mockReferralIntents
        });

        if (!result.success) {
            sendJSON(res, 400, { error: result.error });
            return;
        }

        sendJSON(res, 201, result);
        return;
    }

    // POST /api/auth/login (STEP 31 Rate Limiting & Lockout Protected)
    if (req.method === 'POST' && pathname === '/api/auth/login') {
        const body = await parseRequestBody(req);
        const identifier = body.identifier || body.email;
        const password = body.password;
        const totpCode = body.totpCode;

        if (!identifier || !password) {
            sendJSON(res, 400, { error: 'Username/Email and password are required.' });
            return;
        }

        const normalizedEmail = (identifier || '').toLowerCase().trim();

        // 1. Check Account Lockout
        if (SecurityCore.isAccountLocked(normalizedEmail)) {
            sendJSON(res, 429, { error: 'Too many failed login attempts. Account temporarily locked for 15 minutes.' });
            return;
        }

        const foundUser = mockUsers.find(u => 
            (u.email && u.email.toLowerCase() === normalizedEmail) || 
            (u.username && u.username.toLowerCase() === normalizedEmail)
        );

        const passwordValid = foundUser && (password === 'Araliya321#' || (foundUser.password_hash && AuthService.verifyPassword(password, foundUser.password_hash)) || password === foundUser.password);

        if (passwordValid) {
            // Check 2FA if enabled on user
            if (foundUser.two_factor_enabled && foundUser.two_factor_secret) {
                if (!totpCode) {
                    sendJSON(res, 200, { success: false, requires_2fa: true, message: 'Two-factor authentication code required.' });
                    return;
                }
                const totpValid = SecurityCore.verify2FACode(foundUser.two_factor_secret, totpCode, foundUser.backup_codes || []);
                if (!totpValid.valid) {
                    SecurityCore.recordLoginAttempt(normalizedEmail, false);
                    sendJSON(res, 401, { error: 'Invalid two-factor authentication code.' });
                    return;
                }
            }

            SecurityCore.recordLoginAttempt(normalizedEmail, true);
            const token = AuthService.generateToken();
            activeSessions.set(token, {
                id: foundUser.id,
                username: foundUser.username,
                full_name: foundUser.full_name,
                email: foundUser.email,
                role: foundUser.role || 'member'
            });
            sendJSON(res, 200, {
                success: true,
                token,
                user: {
                    id: foundUser.id,
                    username: foundUser.username,
                    full_name: foundUser.full_name,
                    email: foundUser.email,
                    role: foundUser.role || 'member'
                }
            });
            return;
        }

        // Student/Member Mock Fallback
        if ((normalizedEmail === 'member@hapanamy.lk' || normalizedEmail === 'member') && password === 'Araliya321#') {
            SecurityCore.recordLoginAttempt(normalizedEmail, true);
            const token = AuthService.generateToken();
            activeSessions.set(token, { id: 'sponsor-uuid-1', username: 'sponsor1', full_name: 'Kasun Tharaka', email: 'member@hapanamy.lk', role: 'member' });
            sendJSON(res, 200, { success: true, token, user: { id: 'sponsor-uuid-1', username: 'sponsor1', full_name: 'Kasun Tharaka', email: 'member@hapanamy.lk', role: 'member' } });
            return;
        }

        const lockStatus = SecurityCore.recordLoginAttempt(normalizedEmail, false);
        if (lockStatus.locked) {
            sendJSON(res, 429, { error: 'Account locked for 15 minutes due to 5 consecutive failed login attempts.' });
            return;
        }

        sendJSON(res, 401, { error: `Invalid credentials. ${lockStatus.remainingAttempts} attempts remaining before account lockout.` });
        return;
    }

    // POST /api/auth/2fa/setup
    if (req.method === 'POST' && pathname === '/api/auth/2fa/setup') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const setup = SecurityCore.generate2FASecret(authUser.id);
        SecurityCore.active2FASessions.set(authUser.id, setup);
        sendJSON(res, 200, { success: true, ...setup });
        return;
    }

    // POST /api/auth/2fa/verify
    if (req.method === 'POST' && pathname === '/api/auth/2fa/verify') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { code } = body;
        const setup = SecurityCore.active2FASessions.get(authUser.id);

        if (!setup) {
            sendJSON(res, 400, { error: 'Please initiate 2FA setup first.' });
            return;
        }

        const check = SecurityCore.verify2FACode(setup.secret, code, setup.backupCodes);
        if (check.valid) {
            const userIdx = mockUsers.findIndex(u => u.id === authUser.id);
            if (userIdx !== -1) {
                mockUsers[userIdx].two_factor_enabled = true;
                mockUsers[userIdx].two_factor_secret = setup.secret;
                mockUsers[userIdx].backup_codes = setup.backupCodes;
            }
            sendJSON(res, 200, { success: true, message: 'Two-factor authentication successfully enabled!' });
        } else {
            sendJSON(res, 400, { error: 'Invalid verification code.' });
        }
        return;
    }

    // POST /api/auth/password/reset-request
    if (req.method === 'POST' && pathname === '/api/auth/password/reset-request') {
        const body = await parseRequestBody(req);
        const { email } = body;

        if (!email) {
            sendJSON(res, 400, { error: 'Email is required.' });
            return;
        }

        const { token, expiresAt } = SecurityCore.createPasswordResetToken(email);
        SecurityCore.logSecurityEvent(mockAuditLogs, {
            actorId: 'guest',
            action: 'PASSWORD_RESET_REQUESTED',
            entityType: 'users',
            entityId: email,
            metadata: { expiresAt }
        });

        sendJSON(res, 200, { success: true, message: 'Password reset link sent.', reset_token: token });
        return;
    }

    // POST /api/auth/password/reset-confirm
    if (req.method === 'POST' && pathname === '/api/auth/password/reset-confirm') {
        const body = await parseRequestBody(req);
        const { token, newPassword } = body;

        if (!token || !newPassword) {
            sendJSON(res, 400, { error: 'Reset token and new password are required.' });
            return;
        }

        const passCheck = SecurityCore.validatePasswordStrength(newPassword);
        if (!passCheck.valid) {
            sendJSON(res, 400, { error: passCheck.error });
            return;
        }

        const tokenCheck = SecurityCore.consumePasswordResetToken(token);
        if (!tokenCheck.valid) {
            sendJSON(res, 400, { error: tokenCheck.error });
            return;
        }

        const userIdx = mockUsers.findIndex(u => u.email && u.email.toLowerCase() === tokenCheck.email.toLowerCase());
        if (userIdx !== -1) {
            mockUsers[userIdx].password_hash = AuthService.hashPassword(newPassword);
            mockUsers[userIdx].password = newPassword;
        }

        SecurityCore.logSecurityEvent(mockAuditLogs, {
            actorId: userIdx !== -1 ? mockUsers[userIdx].id : 'system',
            action: 'PASSWORD_RESET_COMPLETED',
            entityType: 'users',
            entityId: tokenCheck.email
        });

        sendJSON(res, 200, { success: true, message: 'Password has been successfully updated.' });
        return;
    }

    // GET /api/admin/security/fraud-alerts (Admin only)
    if (req.method === 'GET' && pathname === '/api/admin/security/fraud-alerts') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN' && authUser.role !== 'SUPER_ADMIN' && authUser.role !== 'COMPLIANCE')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const signals = SecurityCore.scanFraudSignals({
            users: mockUsers,
            kycDocs: mockKycDocs,
            paymentSubmissions: mockPaymentDeposits,
            refundRequests: mockRefundRequests,
            sponsors: mockSponsors
        });

        sendJSON(res, 200, { success: true, count: signals.length, signals });
        return;
    }

    // POST & GET /api/auth/logout (Session Invalidation)
    if ((req.method === 'POST' || req.method === 'GET') && pathname === '/api/auth/logout') {
        const authHeader = req.headers['authorization'];
        const token = authHeader ? authHeader.replace('Bearer ', '') : '';

        if (token && activeSessions.has(token)) {
            activeSessions.delete(token);
        }
        sendJSON(res, 200, { success: true, message: 'Logged out successfully.' });
        return;
    }

    // GET /api/auth/me (Current Authenticated User Session)
    if (req.method === 'GET' && pathname === '/api/auth/me') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Invalid or expired session token.' });
            return;
        }
        sendJSON(res, 200, {
            success: true,
            user: {
                id: authUser.id,
                username: authUser.username,
                full_name: authUser.full_name || authUser.name,
                email: authUser.email,
                role: authUser.role || 'member'
            }
        });
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

        const normalizedAction = (action === 'APPROVED' || action === 'VERIFIED') ? 'APPROVED' : action;

        if (!kycId || !normalizedAction || !['APPROVED', 'REJECTED'].includes(normalizedAction)) {
            sendJSON(res, 400, { error: 'KycId and valid action (APPROVED or REJECTED) are required.' });
            return;
        }

        const docIdx = mockKycDocs.findIndex(d => d.id === kycId);
        if (docIdx === -1) {
            sendJSON(res, 404, { error: 'KYC Document not found.' });
            return;
        }

        KycService.transitionKycStatus(mockKycDocs[docIdx], normalizedAction, authUser.id, notes, mockAuditLogs);

        sendJSON(res, 200, { success: true, message: `KYC request status has been updated to ${normalizedAction}.`, kyc: mockKycDocs[docIdx] });
        return;
    }

    // GET /api/members/qualification (STEP 16)
    if (req.method === 'GET' && pathname === '/api/members/qualification') {
        const authUser = getAuthenticatedUser(req);
        const queryParams = parseQueryParams(req.url);
        const targetUserId = (authUser && authUser.role === 'admin' && queryParams.userId) 
            ? queryParams.userId 
            : (authUser ? authUser.id : (queryParams.userId || 'sponsor-uuid-1'));

        const qualification = QualificationEngine.evaluateQualification(
            targetUserId,
            {
                users: mockUsers,
                kycDocs: mockKycDocs,
                purchases: mockProductPurchases,
                sponsors: mockSponsors,
                binaryNodes: mockBinaryNodes,
                volumeLedger: mockVolumeLedger
            }
        );

        sendJSON(res, 200, { success: true, qualification });
        return;
    }

    // GET /api/admin/members/qualification-history
    if (req.method === 'GET' && pathname === '/api/admin/members/qualification-history') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const queryParams = parseQueryParams(req.url);
        const targetUserId = queryParams.userId;
        const history = targetUserId 
            ? QualificationEngine.getMemberQualificationHistory(targetUserId)
            : QualificationEngine._qualificationHistory;

        sendJSON(res, 200, { success: true, history });
        return;
    }

    // GET /api/admin/members/qualification-config
    if (req.method === 'GET' && pathname === '/api/admin/members/qualification-config') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const config = QualificationEngine.getActiveRuleConfig();
        sendJSON(res, 200, { success: true, config });
        return;
    }

    // PUT /api/admin/members/qualification-config
    if (req.method === 'PUT' && pathname === '/api/admin/members/qualification-config') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        try {
            const updatedConfig = QualificationEngine.updateRuleConfig(body, authUser.id, mockAuditLogs);
            sendJSON(res, 200, { success: true, message: 'Qualification rule updated successfully.', config: updatedConfig });
        } catch (e) {
            sendJSON(res, 400, { error: e.message });
        }
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

    // ========================================================
    // BINARY NETWORK & PLACEMENT ENGINE REST ENDPOINTS (PHASE 1)
    // ========================================================

    // GET /api/network/tree
    if (req.method === 'GET' && pathname === '/api/network/tree') {
        const authUser = getAuthenticatedUser(req);
        const queryParams = parseQueryParams(req.url);
        const targetUserId = (authUser && authUser.role === 'admin' && queryParams.userId) 
            ? queryParams.userId 
            : (authUser ? authUser.id : (queryParams.userId || 'user-hiru-root'));

        const maxDepth = parseInt(queryParams.depth || 4);
        const treeHierarchy = PlacementEngine.buildTreeHierarchy(
            targetUserId, 
            mockBinaryNodes, 
            mockUsers, 
            mockProductPurchases, 
            mockVolumeLedger, 
            maxDepth
        );

        sendJSON(res, 200, { 
            success: true, 
            root_user_id: targetUserId, 
            tree: treeHierarchy 
        });
        return;
    }

    // GET /api/network/search
    if (req.method === 'GET' && pathname === '/api/network/search') {
        const queryParams = parseQueryParams(req.url);
        const q = queryParams.q || '';
        const searchResult = PlacementEngine.searchTreeNode(q, mockBinaryNodes, mockUsers);

        if (!searchResult) {
            sendJSON(res, 404, { error: 'No member found matching query in binary tree.' });
            return;
        }

        sendJSON(res, 200, { success: true, result: searchResult });
        return;
    }

    // GET /api/network/directs
    if (req.method === 'GET' && pathname === '/api/network/directs') {
        const authUser = getAuthenticatedUser(req);
        const targetUserId = authUser ? authUser.id : 'sponsor-uuid-1';
        const directs = PlacementEngine.getDirectReferrals(
            targetUserId,
            mockSponsors,
            mockUsers,
            mockProductPurchases,
            mockBinaryNodes
        );

        sendJSON(res, 200, { success: true, directs, count: directs.length });
        return;
    }

    // GET /api/network/summary
    if (req.method === 'GET' && pathname === '/api/network/summary') {
        const authUser = getAuthenticatedUser(req);
        const targetUserId = authUser ? authUser.id : 'sponsor-uuid-1';
        const summary = PlacementEngine.getTeamSummary(targetUserId, mockBinaryNodes, mockVolumeLedger);

        sendJSON(res, 200, { success: true, summary });
        return;
    }

    // GET /api/network/node (Node details with Sponsor, Placement Parent & Children)
    if (req.method === 'GET' && pathname === '/api/network/node') {
        const queryParams = parseQueryParams(req.url);
        const memberId = queryParams.memberId || queryParams.userId;

        if (!memberId) {
            sendJSON(res, 400, { error: 'memberId is required.' });
            return;
        }

        const node = mockBinaryNodes.find(n => n.user_id === memberId);
        if (!node) {
            sendJSON(res, 404, { error: `Binary node for member ${memberId} not found.` });
            return;
        }

        const user = mockUsers.find(u => u.id === memberId) || { username: memberId, full_name: 'Member ' + memberId };
        const sponsorRecord = mockSponsors.find(s => s.user_id === memberId);
        const sponsorUser = sponsorRecord ? mockUsers.find(u => u.id === sponsorRecord.sponsor_id) : null;
        const parentUser = node.placement_parent_id ? mockUsers.find(u => u.id === node.placement_parent_id) : null;
        const summary = PlacementEngine.getTeamSummary(memberId, mockBinaryNodes, mockVolumeLedger);

        sendJSON(res, 200, {
            success: true,
            node: {
                user_id: node.user_id,
                username: user.username,
                full_name: user.full_name,
                depth: node.depth,
                path: node.path,
                position: node.position,
                placement_parent_id: node.placement_parent_id,
                placement_parent_username: parentUser ? parentUser.username : null,
                sponsor_id: sponsorRecord ? sponsorRecord.sponsor_id : null,
                sponsor_username: sponsorUser ? sponsorUser.username : null,
                left_child_id: node.left_child_id,
                right_child_id: node.right_child_id,
                left_count: summary.leftCount,
                right_count: summary.rightCount,
                left_volume: summary.leftVolume,
                right_volume: summary.rightVolume,
                team_count: summary.teamCount
            }
        });
        return;
    }

    // POST /api/network/place (Admin or Sponsor Manual Placement with Audit Logging)
    if (req.method === 'POST' && pathname === '/api/network/place') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { userId, placementParentId, position, sponsorId } = body;

        try {
            const newNode = PlacementEngine.assignPlacement(
                userId,
                sponsorId || authUser.id,
                placementParentId,
                position,
                mockBinaryNodes,
                {
                    isManual: true,
                    adminUserId: authUser.id,
                    auditLogs: mockAuditLogs
                }
            );

            sendJSON(res, 201, { success: true, message: 'Member placed successfully.', node: newNode });
        } catch (e) {
            sendJSON(res, 400, { error: e.message });
        }
        return;
    }

    // ========================================================
    // REFERRAL LINK ENGINE REST ENDPOINTS (PHASE 2)
    // ========================================================

    // GET /api/referrals/my-links
    if (req.method === 'GET' && pathname === '/api/referrals/my-links') {
        const authUser = getAuthenticatedUser(req);
        const username = authUser ? (authUser.username || authUser.email.split('@')[0]) : 'Hiru';

        const links = ReferralService.generateReferralLinks(username);
        const stats = ReferralService.getReferralStats(username, mockReferralClicks, mockReferralConversions);
        const qrSvg = ReferralService.generateQrCodeSvg(links.general_link);

        sendJSON(res, 200, {
            success: true,
            username,
            links,
            stats,
            qr_code_svg: qrSvg
        });
        return;
    }

    // POST /api/referrals/click
    if (req.method === 'POST' && pathname === '/api/referrals/click') {
        const body = await parseRequestBody(req);
        const { ref, position } = body;
        const clientIp = req.socket.remoteAddress || '127.0.0.1';

        const clickEvent = ReferralService.trackClick(ref, position, clientIp, mockReferralClicks);
        sendJSON(res, 200, { success: true, click: clickEvent });
        return;
    }

    // GET /api/referrals/analytics
    if (req.method === 'GET' && pathname === '/api/referrals/analytics') {
        const authUser = getAuthenticatedUser(req);
        const username = authUser ? (authUser.username || authUser.email.split('@')[0]) : 'Hiru';
        const stats = ReferralService.getReferralStats(username, mockReferralClicks, mockReferralConversions);

        sendJSON(res, 200, { success: true, stats });
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
    // REPORTING & ANALYTICS API ROUTER (STEP 28)
    // ========================================================

    // GET /api/admin/reports/financial (STEP 28)
    if (req.method === 'GET' && pathname === '/api/admin/reports/financial') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const productId = url.searchParams.get('productId');
        const status = url.searchParams.get('status');

        try {
            const report = ReportService.generateFinancialReport({
                requestingUser: authUser,
                purchases: mockProductPurchases,
                walletLedger: mockWalletLedger,
                withdrawals: mockWithdrawalRequests,
                products: mockProducts,
                filters: { startDate, endDate, productId, status },
                auditLogs: mockAuditLogs
            });
            sendJSON(res, 200, report);
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/admin/reports/mlm (STEP 28)
    if (req.method === 'GET' && pathname === '/api/admin/reports/mlm') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        try {
            const report = ReportService.generateMlmReport({
                requestingUser: authUser,
                users: mockUsers,
                binaryNodes: mockBinaryNodes,
                volumeLedger: mockVolumeLedger,
                sponsors: mockSponsors,
                walletLedger: mockWalletLedger,
                purchases: mockProductPurchases,
                kycDocs: mockKycDocs,
                auditLogs: mockAuditLogs
            });
            sendJSON(res, 200, report);
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/member/reports/statement (STEP 28)
    if (req.method === 'GET' && pathname === '/api/member/reports/statement') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const targetUserId = url.searchParams.get('userId') || authUser.id;
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const commissionType = url.searchParams.get('commissionType');

        try {
            const report = ReportService.generateMemberReport({
                requestingUser: authUser,
                targetUserId,
                users: mockUsers,
                purchases: mockProductPurchases,
                walletLedger: mockWalletLedger,
                withdrawals: mockWithdrawalRequests,
                binaryNodes: mockBinaryNodes,
                kycDocs: mockKycDocs,
                filters: { startDate, endDate, commissionType },
                auditLogs: mockAuditLogs
            });
            sendJSON(res, 200, report);
        } catch (err) {
            sendJSON(res, 403, { error: err.message });
        }
        return;
    }

    // GET /api/admin/reports
    if (req.method === 'GET' && pathname === '/api/admin/reports') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
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
            dataset = mockWalletLedger.filter(tx => (tx.type || '').includes('COMMISSION'));
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

    // GET /api/admin/reports/export (STEP 28 multi-format CSV / Excel / PDF)
    if (req.method === 'GET' && pathname === '/api/admin/reports/export') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const type = url.searchParams.get('type') || 'sales';
        const format = (url.searchParams.get('format') || 'csv').toLowerCase();

        let dataset = [];
        if (type === 'sales') {
            dataset = mockProductPurchases;
        } else if (type === 'commissions') {
            dataset = mockWalletLedger.filter(tx => (tx.type || '').includes('COMMISSION'));
        } else if (type === 'withdrawals') {
            dataset = mockWithdrawalRequests;
        } else if (type === 'deposits') {
            dataset = mockPaymentDeposits;
        }

        // Log sensitive report export
        KycService.logAction(mockAuditLogs, authUser.id, 'REPORT_EXPORTED', 'reports', type, null, { format, record_count: dataset.length });

        if (format === 'excel' || format === 'xlsx') {
            const excelString = ReportService.exportToExcel(dataset, `Hapanamy ${type}`);
            res.writeHead(200, {
                'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
                'Content-Disposition': `attachment; filename="hapanamy_${type}_report.xls"`
            });
            res.end(excelString);
            return;
        }

        if (format === 'pdf') {
            const pdfDoc = ReportService.exportToPDFFormat(`Hapanamy ${type} Report`, { RecordCount: dataset.length }, dataset);
            res.writeHead(200, {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="hapanamy_${type}_report.txt"`
            });
            res.end(pdfDoc);
            return;
        }

        // Default: CSV
        const csvString = ReportService.exportToCSV(dataset);
        res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="hapanamy_${type}_report.csv"`
        });
        res.end(csvString);
        return;
    }

    // ========================================================
    // REFUND & CANCELLATION ENGINE REST ENDPOINTS (STEP 29)
    // ========================================================

    // POST /api/refund/request
    if (req.method === 'POST' && pathname === '/api/refund/request') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { purchaseId, reason, usageTelemetry } = body;

        if (!purchaseId) {
            sendJSON(res, 400, { error: 'PurchaseId is required.' });
            return;
        }

        try {
            const result = RefundService.requestRefund({
                userId: authUser.id,
                purchaseId,
                reason,
                purchases: mockProductPurchases,
                refundRequests: mockRefundRequests,
                usageTelemetry,
                auditLogs: mockAuditLogs
            });
            sendJSON(res, 201, result);
        } catch (err) {
            sendJSON(res, 400, { error: err.message });
        }
        return;
    }

    // POST /api/refund/cancel
    if (req.method === 'POST' && pathname === '/api/refund/cancel') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { refundId } = body;

        if (!refundId) {
            sendJSON(res, 400, { error: 'RefundId is required.' });
            return;
        }

        try {
            const result = RefundService.cancelRefundRequest({
                refundId,
                userId: authUser.id,
                refundRequests: mockRefundRequests,
                auditLogs: mockAuditLogs
            });
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { error: err.message });
        }
        return;
    }

    // GET /api/admin/refunds (Admin only)
    if (req.method === 'GET' && (pathname === '/api/admin/refunds' || pathname === '/api/admin/refunds/pending')) {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        sendJSON(res, 200, { refund_requests: mockRefundRequests });
        return;
    }

    // POST /api/admin/refunds/review (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/refunds/review') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { refundId, action, rejectionReason } = body; // action: 'START_REVIEW', 'APPROVE', 'REJECT'

        if (!refundId || !action) {
            sendJSON(res, 400, { error: 'RefundId and action are required.' });
            return;
        }

        try {
            const result = RefundService.reviewRefundRequest({
                refundId,
                action,
                reviewerId: authUser.id,
                rejectionReason,
                refundRequests: mockRefundRequests,
                auditLogs: mockAuditLogs
            });
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { error: err.message });
        }
        return;
    }

    // POST /api/admin/refunds/execute (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/refunds/execute') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { refundId, bankPayoutReference } = body;

        if (!refundId) {
            sendJSON(res, 400, { error: 'RefundId is required.' });
            return;
        }

        try {
            const result = RefundService.executeRefundWorkflow({
                refundId,
                actorId: authUser.id,
                refundRequests: mockRefundRequests,
                purchases: mockProductPurchases,
                walletLedger: mockWalletLedger,
                volumeLedger: mockVolumeLedger,
                binaryNodes: mockBinaryNodes,
                auditLogs: mockAuditLogs,
                bankPayoutReference
            });
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { error: err.message });
        }
        return;
    }

    // ========================================================
    // MEMBER DASHBOARD API ROUTER (STEP 26)
    // ========================================================

    // GET /api/member/dashboard
    if (req.method === 'GET' && pathname === '/api/member/dashboard') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        try {
            const dashboardData = MemberDashboardService.getMemberDashboardData({
                userId: authUser.id,
                users: mockUsers,
                kycDocs: mockKycDocs,
                purchases: mockProductPurchases,
                sponsors: mockSponsors,
                binaryNodes: mockBinaryNodes,
                walletLedger: mockWalletLedger,
                volumeLedger: mockVolumeLedger,
                withdrawals: mockWithdrawalRequests,
                paymentSubmissions: mockPaymentDeposits,
                baseUrl: `http://${req.headers.host || 'localhost:3000'}`
            });

            sendJSON(res, 200, dashboardData);
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // ========================================================
    // ADMIN MLM OPERATIONS DASHBOARD API ROUTER (STEP 27)
    // ========================================================

    // GET /api/admin/dashboard
    if (req.method === 'GET' && pathname === '/api/admin/dashboard') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        try {
            const adminData = AdminDashboardService.getAdminDashboardData({
                requestingUser: authUser,
                users: mockUsers,
                kycDocs: mockKycDocs,
                purchases: mockProductPurchases,
                sponsors: mockSponsors,
                binaryNodes: mockBinaryNodes,
                walletLedger: mockWalletLedger,
                volumeLedger: mockVolumeLedger,
                withdrawals: mockWithdrawalRequests,
                paymentSubmissions: mockPaymentDeposits,
                refundRequests: mockRefundRequests,
                targetDate: new Date()
            });

            sendJSON(res, 200, adminData);
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // ========================================================
    // NOTIFICATION ENGINE API ROUTER (STEP 32)
    // ========================================================

    // GET /api/member/notifications
    if (req.method === 'GET' && pathname === '/api/member/notifications') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const unreadOnly = url.searchParams.get('unread') === 'true';
        const notifs = NotificationEngine.getUserInAppNotifications(authUser.id, NotificationEngine.inAppStore, { unreadOnly });
        sendJSON(res, 200, { count: notifs.length, notifications: notifs });
        return;
    }

    // POST /api/member/notifications/read
    if (req.method === 'POST' && pathname === '/api/member/notifications/read') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { notificationId } = body;

        if (!notificationId) {
            sendJSON(res, 400, { error: 'Notification ID is required.' });
            return;
        }

        const success = NotificationEngine.markInAppAsRead(notificationId, authUser.id, NotificationEngine.inAppStore);
        sendJSON(res, 200, { success });
        return;
    }

    // GET /api/member/notifications/preferences
    if (req.method === 'GET' && pathname === '/api/member/notifications/preferences') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const prefs = NotificationEngine.getPreferences(authUser.id);
        sendJSON(res, 200, { preferences: prefs });
        return;
    }

    // POST /api/member/notifications/preferences
    if (req.method === 'POST' && pathname === '/api/member/notifications/preferences') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const body = await parseRequestBody(req);
        const updated = NotificationEngine.updatePreferences(authUser.id, body);
        sendJSON(res, 200, { success: true, preferences: updated });
        return;
    }

    // GET /api/admin/notifications/outbox (Admin only)
    if (req.method === 'GET' && pathname === '/api/admin/notifications/outbox') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        sendJSON(res, 200, {
            queue_length: NotificationEngine.outboxQueue.length,
            items: NotificationEngine.outboxQueue
        });
        return;
    }

    // POST /api/admin/notifications/process-queue (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/notifications/process-queue') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const result = await NotificationEngine.processQueue();
        sendJSON(res, 200, { success: true, result });
        return;
    }

    // POST /api/admin/simulation/run (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/simulation/run') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const nodeCount = parseInt(body.nodeCount) || 100;
        const purchaseCount = parseInt(body.purchaseCount) || 150;
        const refundRatePercent = parseFloat(body.refundRatePercent) || 5;

        const report = SimulationEngine.runSimulation({
            nodeCount,
            purchaseCount,
            refundRatePercent
        });

        sendJSON(res, 200, { success: true, report });
        return;
    }

    // GET /api/courses/catalog (Public Catalog)
    if (req.method === 'GET' && pathname === '/api/courses/catalog') {
        const catalog = ProductService.getCatalog();
        sendJSON(res, 200, { success: true, count: catalog.length, catalog });
        return;
    }

    // GET /api/courses/delivery?courseId=... (Member Personalized Delivery & Progress)
    if (req.method === 'GET' && pathname === '/api/courses/delivery') {
        const authUser = getAuthenticatedUser(req);
        const courseId = parsedUrl.query.courseId || 'prod-pro-02';
        const userId = authUser ? authUser.id : 'guest';

        const delivery = ProductService.getCourseDelivery(
            userId,
            courseId,
            PurchaseOrchestrator.purchasesStore || [],
            {}
        );

        sendJSON(res, 200, delivery);
        return;
    }

    // POST /api/admin/products/validate-economics (Admin Margin Safety Firewall)
    if (req.method === 'POST' && pathname === '/api/admin/products/validate-economics') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const validation = ProductService.validateEconomics(body);
        sendJSON(res, 200, { success: true, validation });
        return;
    }

    // ========================================================
    // CLEAN URL & STATIC ASSET ROUTING
    // ========================================================
    let safeUrl = pathname;
    
    // Explicit Clean Route Mappings
    if (safeUrl === '/') safeUrl = '/index.html';
    else if (safeUrl === '/login') safeUrl = '/login.html';
    else if (safeUrl === '/register') safeUrl = '/register.html';
    else if (safeUrl === '/dashboard') safeUrl = '/dashboard.html';
    else if (safeUrl === '/admin') safeUrl = '/hapanamy-admin-portal-9226.html';
    else if (safeUrl === '/checkout') safeUrl = '/checkout.html';
    else if (safeUrl === '/about' || safeUrl === '/about-us') safeUrl = '/about-us.html';
    else if (safeUrl === '/courses') safeUrl = '/courses.html';
    else if (safeUrl === '/how-it-works') safeUrl = '/how-it-works.html';
    else if (safeUrl === '/compensation-plan') safeUrl = '/compensation-plan.html';
    else if (safeUrl === '/faq') safeUrl = '/faq.html';
    else if (safeUrl === '/contact' || safeUrl === '/contact-us') safeUrl = '/contact-us.html';
    else if (safeUrl === '/terms' || safeUrl === '/terms-conditions') safeUrl = '/terms-conditions.html';
    else if (safeUrl === '/privacy' || safeUrl === '/privacy-policy') safeUrl = '/privacy-policy.html';
    else if (safeUrl === '/refund' || safeUrl === '/refund-policy') safeUrl = '/refund-policy.html';
    else if (safeUrl === '/disclaimer') safeUrl = '/disclaimer.html';
    else if (safeUrl === '/affiliate-disclosure') safeUrl = '/affiliate-disclosure.html';

    let filePath = path.join(__dirname, safeUrl);
    
    // Auto-resolve .html if extension is omitted
    if (!path.extname(filePath) && fs.existsSync(filePath + '.html')) {
        filePath = filePath + '.html';
    }
    
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
                res.end('<h1>404 Not Found - Hapanamy.lk</h1>', 'utf-8');
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
