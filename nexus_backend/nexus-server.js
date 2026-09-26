// ==============================================================================
// NEXUS PRIME (PVT) LTD — DEDICATED INDEPENDENT API & WEB SERVER
// DOMAIN: nexusp.online
// PORT: 3001 (Default isolated port)
// ==============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const NexusConfig = require('./config/nexus-config');
const nexusDb = require('./db/nexus-db');
const NexusAuthService = require('./services/nexus-auth-service');
const NexusMemberService = require('./services/nexus-member-service');
const NexusReferralService = require('./services/nexus-referral-service');
const NexusNetworkService = require('./services/nexus-network-service');
const NexusAdminService = require('./services/nexus-admin-service');
const NexusCatalogService = require('./services/nexus-catalog-service');
const NexusOrderService = require('./services/nexus-order-service');
const nexusPaymentService = require('./services/nexus-payment-service');
const NexusCommissionService = require('./services/nexus-commission-service');
const nexusWalletService = require('./services/nexus-wallet-service');
const nexusWithdrawalService = require('./services/nexus-withdrawal-service');
const nexusRankService = require('./services/nexus-rank-service');
const nexusFinancialReportingService = require('./services/nexus-financial-reporting-service');
const nexusNotificationService = require('./services/nexus-notification-service');
const nexusSupportService = require('./services/nexus-support-service');
const nexusEmailProvider = require('./services/nexus-email-provider');
const nexusKycService = require('./services/nexus-kyc-service');
const nexusMembershipService = require('./services/nexus-membership-service');
const nexusEligibilityEngine = require('./services/nexus-eligibility-engine');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// In-Memory Rate Limiter
const ipRequestCounts = new Map();
function isRateLimited(ip, limit = NexusConfig.RATE_LIMIT_MAX_REQUESTS) {
    const now = Date.now();
    const entry = ipRequestCounts.get(ip) || { count: 0, resetAt: now + NexusConfig.RATE_LIMIT_WINDOW_MS };
    if (now > entry.resetAt) {
        entry.count = 1;
        entry.resetAt = now + NexusConfig.RATE_LIMIT_WINDOW_MS;
        ipRequestCounts.set(ip, entry);
        return false;
    }
    entry.count++;
    ipRequestCounts.set(ip, entry);
    return entry.count > limit;
}

// JSON Helper
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    res.end(JSON.stringify(data));
}

// Request Body Parser
function parseBody(req) {
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

// Auth Middleware Helper
function authenticateRequest(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return null;
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
    const check = NexusAuthService.verifySession(token);
    return check.valid ? check.session : null;
}

function requireAuth(req, res) {
    const session = authenticateRequest(req);
    if (!session) {
        sendJSON(res, 401, { success: false, error: 'Unauthorized. Valid authentication token required.' });
        return null;
    }
    return session;
}

function requireAdmin(req, res) {
    const session = requireAuth(req, res);
    if (!session) return null;
    const roles = session.roles || [];
    if (!roles.includes('admin') && !roles.includes('super_admin')) {
        sendJSON(res, 403, { success: false, error: 'Forbidden. Administrative privileges required.' });
        return null;
    }
    return session;
}

const requestHandler = async (req, res) => {
    const clientIp = req.socket.remoteAddress || '127.0.0.1';

    // 1. Enforce Rate Limiter
    if (isRateLimited(clientIp)) {
        sendJSON(res, 429, { success: false, error: 'Rate limit exceeded. Please try again in a minute.' });
        return;
    }

    // Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        });
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3001'}`);
    const pathname = parsedUrl.pathname;

    // ==============================================================================
    // API ROUTING
    // ==============================================================================

    // Health & System Info
    if (req.method === 'GET' && pathname === '/api/v1/nexus/health') {
        sendJSON(res, 200, {
            status: 'ok',
            system: NexusConfig.COMPANY_NAME,
            domain: NexusConfig.DOMAIN,
            version: '1.0.0-PROD-ISOLATED',
            timestamp: new Date().toISOString()
        });
        return;
    }

    // Referral Code Live Validation
    if (req.method === 'GET' && pathname === '/api/v1/nexus/referrals/validate') {
        const code = parsedUrl.searchParams.get('code');
        const result = await NexusReferralService.validateReferralCode(code);
        sendJSON(res, result.valid ? 200 : 400, result);
        return;
    }

    // ==========================================================================
    // PUBLIC CATALOG: PACKAGES & PRODUCTS
    // ==========================================================================

    // Public Active Packages Listing
    if (req.method === 'GET' && pathname === '/api/v1/nexus/packages') {
        const packages = await NexusCatalogService.getActivePackages();
        sendJSON(res, 200, { success: true, count: packages.length, packages });
        return;
    }

    // Public Package Detail by Slug/Code
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/packages/')) {
        const slug = pathname.substring('/api/v1/nexus/packages/'.length).trim();
        const pkg = await NexusCatalogService.getPackageBySlug(slug);
        if (!pkg || pkg.status !== 'active') {
            sendJSON(res, 404, { success: false, error: `Package '${slug}' not found.` });
            return;
        }
        sendJSON(res, 200, { success: true, package: pkg });
        return;
    }

    // Public Active Categories Listing
    if (req.method === 'GET' && pathname === '/api/v1/nexus/categories') {
        const categories = await NexusCatalogService.getActiveCategories();
        sendJSON(res, 200, { success: true, count: categories.length, categories });
        return;
    }

    // Public Active Products Listing with Filtering
    if (req.method === 'GET' && pathname === '/api/v1/nexus/products') {
        const category = parsedUrl.searchParams.get('category') || '';
        const search = parsedUrl.searchParams.get('search') || '';
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 50;

        const result = await NexusCatalogService.getActiveProducts({
            categorySlug: category,
            search,
            page,
            limit
        });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Public Product Detail by Slug
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/products/')) {
        const slug = pathname.substring('/api/v1/nexus/products/'.length).trim();
        const product = await NexusCatalogService.getProductBySlug(slug);
        if (!product || product.status !== 'active') {
            sendJSON(res, 404, { success: false, error: `Product '${slug}' not found.` });
            return;
        }
        sendJSON(res, 200, { success: true, product });
        return;
    }

    // Member Registration (13-step flow)
    if (req.method === 'POST' && pathname === '/api/v1/nexus/auth/register') {
        const body = await parseBody(req);
        const result = await NexusAuthService.registerMember(body, {
            ip: clientIp,
            userAgent: req.headers['user-agent'] || 'Unknown'
        });
        sendJSON(res, result.success ? 201 : 400, result);
        return;
    }

    // Member Login
    if (req.method === 'POST' && pathname === '/api/v1/nexus/auth/login') {
        const body = await parseBody(req);
        const result = await NexusAuthService.login(body.email, body.password, {
            ip: clientIp,
            userAgent: req.headers['user-agent'] || 'Unknown'
        });
        sendJSON(res, result.success ? 200 : 401, result);
        return;
    }

    // Logout
    if (req.method === 'POST' && pathname === '/api/v1/nexus/auth/logout') {
        const authHeader = req.headers['authorization'];
        if (authHeader) {
            NexusAuthService.logout(authHeader);
        }
        sendJSON(res, 200, { success: true, message: 'Logged out successfully.' });
        return;
    }

    // Current Authenticated User & Profile
    if (req.method === 'GET' && pathname === '/api/v1/nexus/auth/me') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized. Please log in.' });
            return;
        }
        const profile = await nexusDb.findProfileByUserId(session.userId);
        sendJSON(res, 200, {
            success: true,
            user: {
                id: session.userId,
                email: session.email,
                roles: session.roles || ['member']
            },
            profile: profile
        });
        return;
    }

    // Member Dashboard Foundation
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/dashboard') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const dashboardData = await NexusMemberService.getMemberDashboardData(session.userId);
        if (!dashboardData) {
            sendJSON(res, 404, { success: false, error: 'Member dashboard not found.' });
            return;
        }
        sendJSON(res, 200, { success: true, ...dashboardData });
        return;
    }

    // Member Profile (Separated Personal vs Account)
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/profile') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const profile = await NexusMemberService.getMemberProfile(session.userId);
        if (!profile) {
            sendJSON(res, 404, { success: false, error: 'Member profile not found.' });
            return;
        }
        sendJSON(res, 200, { success: true, ...profile });
        return;
    }

    // Update Profile
    if (req.method === 'PUT' && pathname === '/api/v1/nexus/member/profile') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const body = await parseBody(req);
        const result = await NexusMemberService.updateProfile(session.userId, body);
        sendJSON(res, result.success ? 200 : 400, result);
        return;
    }

    // Member Avatar Upload
    if (req.method === 'POST' && pathname === '/api/v1/nexus/member/profile-image') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const body = await parseBody(req);
        const { imageBase64, mimeType } = body;
        if (!imageBase64 || !mimeType) {
            sendJSON(res, 400, { success: false, error: 'imageBase64 and mimeType are required.' });
            return;
        }
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(mimeType.toLowerCase())) {
            sendJSON(res, 400, { success: false, error: 'Invalid file format. Only JPG, PNG, and WebP are allowed.' });
            return;
        }
        const sizeInBytes = Buffer.byteLength(imageBase64, 'base64');
        if (sizeInBytes > 2 * 1024 * 1024) {
            sendJSON(res, 400, { success: false, error: 'Image size exceeds maximum limit of 2MB.' });
            return;
        }

        const dataUrl = `data:${mimeType};base64,${imageBase64}`;
        await NexusMemberService.updateProfile(session.userId, { profileImageUrl: dataUrl });
        
        sendJSON(res, 200, {
            success: true,
            message: 'Profile image updated successfully.',
            profileImageUrl: dataUrl
        });
        return;
    }

    // Member Paginated Direct Referrals
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/referrals') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 10;
        const status = parsedUrl.searchParams.get('status') || 'all';
        const search = parsedUrl.searchParams.get('search') || '';

        const result = await NexusMemberService.getMemberReferrals(session.userId, { page, limit, status, search });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Member Paginated Downline Team Directory
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/team') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 10;
        const status = parsedUrl.searchParams.get('status') || 'all';
        const search = parsedUrl.searchParams.get('search') || '';

        const result = await NexusMemberService.getMemberTeam(session.userId, { page, limit, status, search });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Member Team Statistics Summary
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/team/stats') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const stats = await NexusMemberService.getMemberTeamStats(session.userId);
        sendJSON(res, 200, { success: true, stats });
        return;
    }

    // Member Activity Feed
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/activity') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 20;
        const result = await NexusMemberService.getMemberActivities(session.userId, limit);
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // =========================================================================
    // MEMBER NOTIFICATIONS & COMMUNICATION (Prompt 16)
    // =========================================================================
    // Member Unread Notification Count
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/notifications/unread-count') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const unreadCount = await nexusDb.getUnreadNotificationCount(session.userId);
        sendJSON(res, 200, { success: true, unreadCount });
        return;
    }

    // Member Notification Preferences
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/notifications/preferences') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const preferences = await nexusDb.getNotificationPreferences(session.userId);
        sendJSON(res, 200, { success: true, preferences });
        return;
    }

    if (req.method === 'PUT' && pathname === '/api/v1/nexus/member/notifications/preferences') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const body = await parseBody(req);
        const updated = await nexusDb.updateNotificationPreferences(session.userId, body);
        sendJSON(res, 200, { success: true, preferences: updated });
        return;
    }

    // Member Mark All Notifications Read
    if (req.method === 'PUT' && pathname === '/api/v1/nexus/member/notifications/read-all') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const category = parsedUrl.searchParams.get('category');
        const count = await nexusDb.markAllNotificationsRead(session.userId, category);
        sendJSON(res, 200, { success: true, markedCount: count });
        return;
    }

    // Member Legacy Read Route (Backwards Compatibility)
    if (req.method === 'PUT' && pathname === '/api/v1/nexus/member/notifications/read') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const body = await parseBody(req);
        if (body.all) {
            const result = await NexusMemberService.markAllNotificationsRead(session.userId);
            sendJSON(res, 200, { success: true, ...result });
            return;
        }
        if (!body.notificationId) {
            sendJSON(res, 400, { success: false, error: 'notificationId or all:true is required.' });
            return;
        }
        const result = await NexusMemberService.markNotificationRead(session.userId, body.notificationId);
        sendJSON(res, result.success ? 200 : 404, result);
        return;
    }

    // Member Notifications List (Multi-Filter & Pagination)
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/notifications') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const category = parsedUrl.searchParams.get('category');
        const priority = parsedUrl.searchParams.get('priority');
        const status = parsedUrl.searchParams.get('status') || (parsedUrl.searchParams.get('unread') === 'true' ? 'unread' : null);
        const search = parsedUrl.searchParams.get('search');
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 50;
        const offset = parseInt(parsedUrl.searchParams.get('offset'), 10) || 0;

        const result = await nexusDb.getNotifications({
            recipientId: session.userId,
            category,
            priority,
            status,
            search,
            limit,
            offset
        });

        // Ensure backward compatibility shape for existing callers
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Member Single Notification Detail & Actions
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/member/notifications/')) {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const notifId = pathname.replace('/api/v1/nexus/member/notifications/', '');
        const notif = await nexusDb.getNotificationById(notifId);
        if (!notif || (notif.recipient_member_id !== session.userId && notif.user_id !== session.userId)) {
            sendJSON(res, 404, { success: false, error: 'Notification not found or access denied.' });
            return;
        }
        sendJSON(res, 200, { success: true, notification: notif });
        return;
    }

    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/member/notifications/') && pathname.endsWith('/read')) {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const notifId = pathname.replace('/api/v1/nexus/member/notifications/', '').replace('/read', '');
        const marked = await nexusDb.markNotificationRead(session.userId, notifId);
        if (!marked) {
            sendJSON(res, 404, { success: false, error: 'Notification not found or access denied.' });
            return;
        }
        sendJSON(res, 200, { success: true, message: 'Notification marked as read.' });
        return;
    }

    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/member/notifications/') && pathname.endsWith('/archive')) {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const notifId = pathname.replace('/api/v1/nexus/member/notifications/', '').replace('/archive', '');
        const archived = await nexusDb.archiveNotification(session.userId, notifId);
        if (!archived) {
            sendJSON(res, 404, { success: false, error: 'Notification not found or access denied.' });
            return;
        }
        sendJSON(res, 200, { success: true, message: 'Notification archived.' });
        return;
    }

    // =========================================================================
    // MEMBER SUPPORT TICKETS & HELPDESK (Prompt 17)
    // =========================================================================
    // Support Categories
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/support/categories') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const categories = await nexusDb.getSupportCategories();
        sendJSON(res, 200, { success: true, categories });
        return;
    }

    // Member Support Tickets List
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/support/tickets') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const status = parsedUrl.searchParams.get('status');
        const priority = parsedUrl.searchParams.get('priority');
        const category = parsedUrl.searchParams.get('category');
        const search = parsedUrl.searchParams.get('search');
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 50;
        const offset = parseInt(parsedUrl.searchParams.get('offset'), 10) || 0;

        const result = await nexusDb.getSupportTickets({
            memberId: session.userId,
            status,
            priority,
            category,
            search,
            limit,
            offset
        });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Member Create Support Ticket
    if (req.method === 'POST' && pathname === '/api/v1/nexus/member/support/tickets') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const body = await parseBody(req);
        const result = await nexusSupportService.createTicket({
            memberId: session.userId,
            subject: body.subject,
            category: body.category,
            message: body.message,
            priority: body.priority,
            relatedEntityType: body.relatedEntityType || body.related_entity_type,
            relatedEntityId: body.relatedEntityId || body.related_entity_id,
            attachments: body.attachments
        });
        sendJSON(res, result.success ? 201 : 400, result);
        return;
    }

    // Member Single Ticket Detail
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/member/support/tickets/') && 
        !pathname.endsWith('/reply') && !pathname.endsWith('/close')) {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const ticketId = pathname.replace('/api/v1/nexus/member/support/tickets/', '');
        const ticket = await nexusSupportService.getTicketDetails(ticketId, { id: session.userId }, false);
        if (!ticket) {
            sendJSON(res, 404, { success: false, error: 'Support ticket not found or access denied.' });
            return;
        }
        sendJSON(res, 200, { success: true, ticket });
        return;
    }

    // Member Reply on Ticket
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/member/support/tickets/') && pathname.endsWith('/reply')) {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const ticketId = pathname.replace('/api/v1/nexus/member/support/tickets/', '').replace('/reply', '');
        const body = await parseBody(req);
        const result = await nexusSupportService.addMessage({
            ticketId: ticketId,
            senderType: 'member',
            senderId: session.userId,
            message: body.message,
            isInternal: false,
            attachments: body.attachments
        });
        sendJSON(res, result.success ? 200 : 400, result);
        return;
    }

    // Member Close Ticket
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/member/support/tickets/') && pathname.endsWith('/close')) {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const ticketId = pathname.replace('/api/v1/nexus/member/support/tickets/', '').replace('/close', '');
        const result = await nexusSupportService.updateStatus(ticketId, 'closed', session.userId, false);
        sendJSON(res, result.success ? 200 : 400, result);
        return;
    }

    // =========================================================================
    // MEMBER COMPLIANCE & VERIFICATION (KYC Pipeline - Prompt 18)
    // =========================================================================
    // Member KYC Overview & Requirements Checklist
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/kyc') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const data = await nexusKycService.getMemberKyc(session.userId);
        if (!data) {
            sendJSON(res, 404, { success: false, error: 'Member profile not found.' });
            return;
        }
        sendJSON(res, 200, { success: true, ...data });
        return;
    }

    // Member KYC Requirements Configuration
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/kyc/requirements') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const level = parsedUrl.searchParams.get('level') || 'basic';
        const country = parsedUrl.searchParams.get('country') || 'ALL';
        const requirements = await nexusKycService.getRequirements(level, country);
        sendJSON(res, 200, { success: true, requirements });
        return;
    }

    // Member KYC Submit
    if (req.method === 'POST' && pathname === '/api/v1/nexus/member/kyc/submit') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const body = await parseBody(req);
        const result = await nexusKycService.submitKyc({
            memberId: session.userId,
            verificationLevel: body.verification_level || body.verificationLevel || 'basic',
            legalName: body.legal_name || body.legalName,
            dateOfBirth: body.date_of_birth || body.dateOfBirth,
            country: body.country || 'Sri Lanka',
            residentialAddress: body.residential_address || body.residentialAddress || '',
            documents: body.documents || []
        });
        sendJSON(res, result.success ? 201 : 400, result);
        return;
    }

    // Member Secure Document Access URL (HMAC Signed)
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/member/kyc/documents/') && pathname.endsWith('/access')) {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const docId = pathname.replace('/api/v1/nexus/member/kyc/documents/', '').replace('/access', '');
        const result = await nexusKycService.getSecureDocumentAccessUrl(docId, { id: session.userId }, false);
        sendJSON(res, result.success ? 200 : (result.error && result.error.includes('Unauthorized') ? 403 : 404), result);
        return;
    }

    // Member Withdrawal Eligibility Standing Gate
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/withdrawals/eligibility') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const result = await nexusWithdrawalService.checkWithdrawalEligibility(session.userId);
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // =========================================================================
    // MEMBER MEMBERSHIP & ELIGIBILITY ENGINE (Prompt 19)
    // =========================================================================
    // Member Formal Membership Details & State History
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/membership') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const data = await nexusMembershipService.getMembership(session.userId);
        if (!data) {
            sendJSON(res, 404, { success: false, error: 'Member not found.' });
            return;
        }
        sendJSON(res, 200, { success: true, ...data });
        return;
    }

    // Member Centralized Eligibility Evaluation (All 4 Pillars)
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/eligibility') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const eligibility = await nexusEligibilityEngine.evaluateMemberEligibility(session.userId);
        sendJSON(res, 200, { success: true, ...eligibility });
        return;
    }

    // Backwards Compatibility KYC Endpoints
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/verification') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const verification = await nexusDb.getMemberVerification(session.userId);
        sendJSON(res, 200, { success: true, verification });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/v1/nexus/member/verification') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const body = await parseBody(req);
        const updated = await nexusDb.updateMemberVerification(session.userId, {
            verification_status: 'pending',
            id_document_url: body.id_document_url || body.idDocumentUrl,
            address_document_url: body.address_document_url || body.addressDocumentUrl,
            verification_notes: body.notes
        });

        await nexusNotificationService.emit('kyc_submitted', {
            recipient_id: session.userId,
            reference_type: 'kyc',
            reference_id: session.userId,
            action_url: '/dashboard#verification'
        });

        sendJSON(res, 200, { success: true, message: 'Verification documents submitted successfully for compliance review.', verification: updated });
        return;
    }


    // Member Referrals Area Foundation
    if (req.method === 'GET' && pathname === '/api/v1/nexus/referrals/my-referrals') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const referralData = await NexusReferralService.getMemberReferralData(session.userId);
        sendJSON(res, 200, { success: true, ...referralData });
        return;
    }

    // Member Packages View (Current Standing & Available Tiers)
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/packages') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const profile = await NexusMemberService.getMemberProfile(session.userId);
        const activePackages = await NexusCatalogService.getActivePackages();
        sendJSON(res, 200, {
            success: true,
            currentPackage: profile?.profile?.package_status || 'STANDARD',
            memberRank: profile?.profile?.rank || 'MEMBER',
            packages: activePackages,
            notice: 'Direct package upgrade checkout will be activated in Phase 2.'
        });
        return;
    }

    // ==============================================================================
    // MEMBER ORDERS & CART ROUTES
    // ==============================================================================

    // Create Package Order: POST /api/v1/nexus/member/orders/package
    if (req.method === 'POST' && pathname === '/api/v1/nexus/member/orders/package') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const body = await parseBody(req);
        try {
            const ip = req.socket.remoteAddress || '127.0.0.1';
            const result = await NexusOrderService.createPackageOrder(session.userId, body.packageId || body.package_id, {
                idempotencyKey: body.idempotencyKey || body.idempotency_key,
                notes: body.notes,
                paymentProvider: body.paymentProvider || 'none',
                ip
            });
            sendJSON(res, 201, { success: true, order: result });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Create Product Order: POST /api/v1/nexus/member/orders/products
    if (req.method === 'POST' && pathname === '/api/v1/nexus/member/orders/products') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const body = await parseBody(req);
        try {
            const ip = req.socket.remoteAddress || '127.0.0.1';
            const result = await NexusOrderService.createProductOrder(session.userId, body.items, {
                idempotencyKey: body.idempotencyKey || body.idempotency_key,
                notes: body.notes,
                paymentProvider: body.paymentProvider || 'none',
                ip
            });
            sendJSON(res, 201, { success: true, order: result });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Cart Server-Side Validation: POST /api/v1/nexus/member/cart/validate
    if (req.method === 'POST' && pathname === '/api/v1/nexus/member/cart/validate') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const body = await parseBody(req);
        const result = await NexusOrderService.validateAndCalculateCart(body.items || []);
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Member Orders History: GET /api/v1/nexus/member/orders
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/orders') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 10;
        const status = parsedUrl.searchParams.get('status') || '';
        const orderType = parsedUrl.searchParams.get('type') || '';
        const search = parsedUrl.searchParams.get('search') || '';

        const result = await NexusOrderService.getMemberOrders(session.userId, { page, limit, status, order_type: orderType, search });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Member Order Detail: GET /api/v1/nexus/member/orders/:id
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/member/orders/')) {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const orderId = pathname.replace('/api/v1/nexus/member/orders/', '');
        try {
            const order = await NexusOrderService.getMemberOrderDetail(session.userId, orderId);
            if (!order) {
                sendJSON(res, 404, { success: false, error: 'Order not found.' });
                return;
            }
            sendJSON(res, 200, { success: true, order });
        } catch (err) {
            const code = err.statusCode || 400;
            sendJSON(res, code, { success: false, error: err.message });
        }
        return;
    }

    // ==============================================================================
    // MEMBER PAYMENTS ROUTES
    // ==============================================================================

    // Initiate Payment Session: POST /api/v1/nexus/member/payments/initiate
    if (req.method === 'POST' && pathname === '/api/v1/nexus/member/payments/initiate') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const body = await parseBody(req);
        try {
            const result = await nexusPaymentService.initiatePayment(session.userId, body.orderId || body.order_id, {
                amount: body.amount,
                returnUrl: body.returnUrl,
                cancelUrl: body.cancelUrl
            });
            sendJSON(res, 200, { success: true, ...result });
        } catch (err) {
            const code = err.statusCode || 400;
            sendJSON(res, code, { success: false, error: err.message });
        }
        return;
    }

    // Member Payments Ledger: GET /api/v1/nexus/member/payments
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/payments') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 10;
        const status = parsedUrl.searchParams.get('status') || '';

        const result = await nexusPaymentService.getMemberPayments(session.userId, { page, limit, status });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Polling / Status Query for Return Page: GET /api/v1/nexus/member/payments/:id/status
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/member/payments/') && pathname.endsWith('/status')) {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const parts = pathname.split('/');
        const paymentId = parts[6];
        try {
            const statusResult = await nexusPaymentService.getPaymentVerificationStatus(session.userId, paymentId);
            if (!statusResult) {
                sendJSON(res, 404, { success: false, error: 'Payment record not found.' });
                return;
            }
            sendJSON(res, 200, { success: true, ...statusResult });
        } catch (err) {
            const code = err.statusCode || 400;
            sendJSON(res, code, { success: false, error: err.message });
        }
        return;
    }

    // Member Payment Detail: GET /api/v1/nexus/member/payments/:id
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/member/payments/')) {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const paymentId = pathname.replace('/api/v1/nexus/member/payments/', '');
        const payment = await nexusDb.getPaymentById(paymentId);
        if (!payment) {
            sendJSON(res, 404, { success: false, error: 'Payment not found.' });
            return;
        }
        if (payment.member_id !== session.userId) {
            sendJSON(res, 403, { success: false, error: 'Access denied.' });
            return;
        }
        sendJSON(res, 200, { success: true, payment });
        return;
    }

    // ==============================================================================
    // MEMBER COMMISSIONS ROUTES
    // ==============================================================================

    // Member Commissions History: GET /api/v1/nexus/member/commissions
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/commissions') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 10;
        const status = parsedUrl.searchParams.get('status') || '';
        const type = parsedUrl.searchParams.get('type') || '';

        const result = await nexusDb.getMemberCommissions(session.userId, { page, limit, status, type });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Member Commission Detail: GET /api/v1/nexus/member/commissions/:id
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/member/commissions/') && !pathname.endsWith('/summary') && !pathname.endsWith('/breakdown')) {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const commissionId = pathname.replace('/api/v1/nexus/member/commissions/', '');
        const comm = await nexusDb.getCommissionById(commissionId);
        if (!comm) {
            sendJSON(res, 404, { success: false, error: 'Commission record not found.' });
            return;
        }
        if (comm.beneficiary_id !== session.userId) {
            sendJSON(res, 403, { success: false, error: 'Forbidden: Access denied to this commission record.' });
            return;
        }
        sendJSON(res, 200, { success: true, commission: comm });
        return;
    }

    // ==============================================================================
    // PUBLIC GATEWAY WEBHOOK / IPN CALLBACK ROUTE
    // ==============================================================================

    if (req.method === 'POST' && (pathname === '/api/v1/nexus/payments/webhook' || pathname.startsWith('/api/v1/nexus/payments/webhook/'))) {
        const parts = pathname.split('/');
        const providerParam = parts[6] || null;
        const body = await parseBody(req);
        try {
            const webhookResult = await nexusPaymentService.handleWebhook(providerParam, body, req.headers);
            sendJSON(res, webhookResult.statusCode, webhookResult.response);
        } catch (err) {
            sendJSON(res, 500, { success: false, error: 'WEBHOOK_INTERNAL_ERROR', message: err.message });
        }
        return;
    }

    // Network Tree Hierarchy
    if (req.method === 'GET' && pathname === '/api/v1/nexus/network/tree') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const maxDepth = parseInt(parsedUrl.searchParams.get('depth'), 10) || 4;
        const tree = await NexusNetworkService.getTreeHierarchy(session.userId, maxDepth);
        sendJSON(res, 200, { success: true, tree });
        return;
    }

    // Progressive Loading: Fetch direct children of a specific node
    if (req.method === 'GET' && pathname === '/api/v1/nexus/network/children') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const parentId = parsedUrl.searchParams.get('parentId') || session.userId;
        
        // Security check: ensure parentId is within user's downline or is user themselves (or admin)
        const isAdmin = session.roles && (session.roles.includes('admin') || session.roles.includes('super_admin'));
        if (!isAdmin && parentId !== session.userId) {
            const relLevel = await NexusNetworkService.getRelativeLevel(session.userId, parentId);
            if (relLevel === null) {
                sendJSON(res, 403, { success: false, error: 'Access denied. Target node is outside your downline network.' });
                return;
            }
        }

        const children = await NexusNetworkService.getNodeChildren(parentId);
        sendJSON(res, 200, { success: true, parentId, count: children.length, children });
        return;
    }

    // Node Details Modal Endpoint
    if (req.method === 'GET' && pathname === '/api/v1/nexus/network/node-details') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const nodeId = parsedUrl.searchParams.get('nodeId') || session.userId;

        const isAdmin = session.roles && (session.roles.includes('admin') || session.roles.includes('super_admin'));
        if (!isAdmin && nodeId !== session.userId) {
            const relLevel = await NexusNetworkService.getRelativeLevel(session.userId, nodeId);
            if (relLevel === null) {
                sendJSON(res, 403, { success: false, error: 'Access denied. Node is outside your downline network.' });
                return;
            }
        }

        const details = await NexusNetworkService.getNodeDetails(nodeId);
        if (!details) {
            sendJSON(res, 404, { success: false, error: 'Member node not found.' });
            return;
        }
        sendJSON(res, 200, { success: true, node: details });
        return;
    }

    // Search Downline Members
    if (req.method === 'GET' && pathname === '/api/v1/nexus/network/search') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const query = parsedUrl.searchParams.get('q') || '';
        const results = await NexusNetworkService.searchDownline(session.userId, query);
        sendJSON(res, 200, { success: true, count: results.length, results });
        return;
    }

    // Dynamic Relative Level Distance
    if (req.method === 'GET' && pathname === '/api/v1/nexus/network/relative-level') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const ancestorId = parsedUrl.searchParams.get('ancestorId');
        const descendantId = parsedUrl.searchParams.get('descendantId');
        if (!ancestorId || !descendantId) {
            sendJSON(res, 400, { success: false, error: 'Both ancestorId and descendantId are required.' });
            return;
        }
        const levelDistance = await NexusNetworkService.getRelativeLevel(ancestorId, descendantId);
        sendJSON(res, 200, { success: true, ancestorId, descendantId, levelDistance });
        return;
    }

    // Multi-Level Downline List (with status and depth filtering)
    if (req.method === 'GET' && pathname === '/api/v1/nexus/network/downline') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const maxDepth = parsedUrl.searchParams.get('depth') ? parseInt(parsedUrl.searchParams.get('depth'), 10) : null;
        const status = parsedUrl.searchParams.get('status') || 'all';
        const downline = await NexusNetworkService.getDownline(session.userId, maxDepth, status);
        sendJSON(res, 200, { success: true, count: downline.length, downline });
        return;
    }

    // Upline Chain
    if (req.method === 'GET' && pathname === '/api/v1/nexus/network/upline') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const maxLevels = parsedUrl.searchParams.get('levels') ? parseInt(parsedUrl.searchParams.get('levels'), 10) : null;
        const upline = await NexusNetworkService.getUpline(session.userId, maxLevels);
        sendJSON(res, 200, { success: true, count: upline.length, upline });
        return;
    }

    // ==============================================================================
    // ADMIN ENDPOINTS (Protected: Requires admin or super_admin role)
    // ==============================================================================

    // Helper for admin authorization
    function requireAdmin(req, res) {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Authentication required. Please sign in.' });
            return null;
        }
        if (!session.roles || (!session.roles.includes('admin') && !session.roles.includes('super_admin'))) {
            sendJSON(res, 403, { success: false, error: 'Access denied. Administrative privileges required.' });
            return null;
        }
        return session;
    }

    // 1. Admin Dashboard Stats
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/stats') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const stats = await NexusAdminService.getDashboardStats();
        sendJSON(res, 200, { success: true, stats });
        return;
    }

    // 2. Admin Member Status Update: PUT /api/v1/nexus/admin/members/:id/status
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/members/') && pathname.endsWith('/status')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const parts = pathname.split('/');
        const targetId = parts[6];
        const body = await parseBody(req);
        if (!body || !body.status) {
            sendJSON(res, 400, { success: false, error: 'Target status is required.' });
            return;
        }
        const ip = req.socket.remoteAddress || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || 'Nexus Admin Panel';
        const result = await NexusAdminService.updateMemberStatus(targetId, body.status, body.reason, {
            userId: session.userId,
            ip,
            userAgent
        });
        sendJSON(res, result.success ? 200 : 400, result);
        return;
    }

    // 3. Admin Member 360 Details: GET /api/v1/nexus/admin/members/:id
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/members/') && !pathname.endsWith('/financials')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const parts = pathname.split('/');
        const targetId = parts[6];
        if (!targetId) {
            sendJSON(res, 400, { success: false, error: 'Member identifier is required.' });
            return;
        }
        const details = await NexusAdminService.getMemberDetails(targetId);
        if (!details) {
            sendJSON(res, 404, { success: false, error: `Member '${targetId}' not found.` });
            return;
        }
        sendJSON(res, 200, { success: true, member: details });
        return;
    }

    // 4. Admin Members Directory: GET /api/v1/nexus/admin/members
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/members') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 10;
        const search = parsedUrl.searchParams.get('search') || '';
        const status = parsedUrl.searchParams.get('status') || 'all';
        const role = parsedUrl.searchParams.get('role') || 'all';

        const result = await NexusAdminService.getMembers({ page, limit, search, status, role });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // 5. Admin Network Tree Explorer: GET /api/v1/nexus/admin/network/tree
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/network/tree') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const rootId = parsedUrl.searchParams.get('rootId') || 'NP000001';
        const depth = parseInt(parsedUrl.searchParams.get('depth'), 10) || 4;
        const result = await NexusAdminService.getNetworkTree(rootId, depth);
        sendJSON(res, result.success ? 200 : 404, result);
        return;
    }

    // 6. Admin Network Children: GET /api/v1/nexus/admin/network/children
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/network/children') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const parentId = parsedUrl.searchParams.get('parentId');
        if (!parentId) {
            sendJSON(res, 400, { success: false, error: 'parentId parameter is required.' });
            return;
        }
        const children = await NexusAdminService.getNodeChildren(parentId);
        sendJSON(res, 200, { success: true, parentId, count: children.length, children });
        return;
    }

    // 7. Admin Referrals Ledger: GET /api/v1/nexus/admin/referrals
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/referrals') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 10;
        const search = parsedUrl.searchParams.get('search') || '';
        const status = parsedUrl.searchParams.get('status') || 'all';

        const result = await NexusAdminService.getReferralsList({ page, limit, search, status });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // 8. Admin Audit Trail: GET /api/v1/nexus/admin/audit-logs
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/audit-logs') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 20;
        const action = parsedUrl.searchParams.get('action') || 'all';
        const search = parsedUrl.searchParams.get('search') || '';

        const result = await NexusAdminService.getAuditLogs({ page, limit, action, search });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // 9. Admin Platform Settings: GET & PUT /api/v1/nexus/admin/settings
    if (pathname === '/api/v1/nexus/admin/settings') {
        const session = requireAdmin(req, res);
        if (!session) return;

        if (req.method === 'GET') {
            const settings = await NexusAdminService.getSettings();
            sendJSON(res, 200, { success: true, settings });
            return;
        }

        if (req.method === 'PUT') {
            const body = await parseBody(req);
            const ip = req.socket.remoteAddress || '127.0.0.1';
            const userAgent = req.headers['user-agent'] || 'Nexus Admin Panel';
            const result = await NexusAdminService.updateSettings(body, {
                userId: session.userId,
                ip,
                userAgent
            });
            sendJSON(res, 200, result);
            return;
        }
    }

    // =========================================================================
    // ADMIN CATALOG: PACKAGES
    // =========================================================================

    // Admin Packages List: GET /api/v1/nexus/admin/packages
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/packages') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const status = parsedUrl.searchParams.get('status') || 'all';
        const search = parsedUrl.searchParams.get('search') || '';
        const featured = parsedUrl.searchParams.get('featured');
        const packages = await NexusCatalogService.getAdminPackages({
            status,
            search,
            featured: featured === null ? undefined : featured
        });
        sendJSON(res, 200, { success: true, count: packages.length, packages });
        return;
    }

    // Admin Create Package: POST /api/v1/nexus/admin/packages
    if (req.method === 'POST' && pathname === '/api/v1/nexus/admin/packages') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const body = await parseBody(req);
        try {
            const ip = req.socket.remoteAddress || '127.0.0.1';
            const userAgent = req.headers['user-agent'] || 'Nexus Admin Panel';
            const result = await NexusCatalogService.createPackage(body, {
                userId: session.userId,
                ip,
                userAgent
            });
            sendJSON(res, 201, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Update Package Status: PUT /api/v1/nexus/admin/packages/:id/status
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/packages/') && pathname.endsWith('/status')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const parts = pathname.split('/');
        const id = parts[6];
        const body = await parseBody(req);
        if (!body || !body.status) {
            sendJSON(res, 400, { success: false, error: 'Status is required.' });
            return;
        }
        try {
            const ip = req.socket.remoteAddress || '127.0.0.1';
            const userAgent = req.headers['user-agent'] || 'Nexus Admin Panel';
            const result = await NexusCatalogService.setPackageStatus(id, body.status, {
                userId: session.userId,
                ip,
                userAgent
            });
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Update Package: PUT /api/v1/nexus/admin/packages/:id
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/packages/')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const parts = pathname.split('/');
        const id = parts[6];
        const body = await parseBody(req);
        try {
            const ip = req.socket.remoteAddress || '127.0.0.1';
            const userAgent = req.headers['user-agent'] || 'Nexus Admin Panel';
            const result = await NexusCatalogService.updatePackage(id, body, {
                userId: session.userId,
                ip,
                userAgent
            });
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // =========================================================================
    // ADMIN CATALOG: CATEGORIES
    // =========================================================================

    // Admin Categories List: GET /api/v1/nexus/admin/categories
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/categories') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const search = parsedUrl.searchParams.get('search') || '';
        const status = parsedUrl.searchParams.get('status') || 'all';
        const categories = await NexusCatalogService.getAdminCategories({ search, status });
        sendJSON(res, 200, { success: true, count: categories.length, categories });
        return;
    }

    // Admin Create Category: POST /api/v1/nexus/admin/categories
    if (req.method === 'POST' && pathname === '/api/v1/nexus/admin/categories') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const body = await parseBody(req);
        try {
            const ip = req.socket.remoteAddress || '127.0.0.1';
            const userAgent = req.headers['user-agent'] || 'Nexus Admin Panel';
            const result = await NexusCatalogService.createCategory(body, {
                userId: session.userId,
                ip,
                userAgent
            });
            sendJSON(res, 201, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Update Category: PUT /api/v1/nexus/admin/categories/:id
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/categories/')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const parts = pathname.split('/');
        const id = parts[6];
        const body = await parseBody(req);
        try {
            const ip = req.socket.remoteAddress || '127.0.0.1';
            const userAgent = req.headers['user-agent'] || 'Nexus Admin Panel';
            const result = await NexusCatalogService.updateCategory(id, body, {
                userId: session.userId,
                ip,
                userAgent
            });
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // =========================================================================
    // ADMIN CATALOG: PRODUCTS
    // =========================================================================

    // Admin Products List: GET /api/v1/nexus/admin/products
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/products') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 20;
        const search = parsedUrl.searchParams.get('search') || '';
        const status = parsedUrl.searchParams.get('status') || 'all';
        const categoryId = parsedUrl.searchParams.get('category') || '';
        const result = await NexusCatalogService.getAdminProducts({ page, limit, search, status, categoryId });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Admin Create Product: POST /api/v1/nexus/admin/products
    if (req.method === 'POST' && pathname === '/api/v1/nexus/admin/products') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const body = await parseBody(req);
        try {
            const ip = req.socket.remoteAddress || '127.0.0.1';
            const userAgent = req.headers['user-agent'] || 'Nexus Admin Panel';
            const result = await NexusCatalogService.createProduct(body, {
                userId: session.userId,
                ip,
                userAgent
            });
            sendJSON(res, 201, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Update Product Status: PUT /api/v1/nexus/admin/products/:id/status
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/products/') && pathname.endsWith('/status')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const parts = pathname.split('/');
        const id = parts[6];
        const body = await parseBody(req);
        if (!body || !body.status) {
            sendJSON(res, 400, { success: false, error: 'Status is required.' });
            return;
        }
        try {
            const ip = req.socket.remoteAddress || '127.0.0.1';
            const userAgent = req.headers['user-agent'] || 'Nexus Admin Panel';
            const result = await NexusCatalogService.setProductStatus(id, body.status, {
                userId: session.userId,
                ip,
                userAgent
            });
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Update Product: PUT /api/v1/nexus/admin/products/:id
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/products/')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const parts = pathname.split('/');
        const id = parts[6];
        const body = await parseBody(req);
        try {
            const ip = req.socket.remoteAddress || '127.0.0.1';
            const userAgent = req.headers['user-agent'] || 'Nexus Admin Panel';
            const result = await NexusCatalogService.updateProduct(id, body, {
                userId: session.userId,
                ip,
                userAgent
            });
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // ==============================================================================
    // ADMIN ORDERS & PAYMENTS COMMAND CENTER
    // ==============================================================================

    // Admin Orders List: GET /api/v1/nexus/admin/orders
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/orders') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 20;
        const search = parsedUrl.searchParams.get('search') || '';
        const status = parsedUrl.searchParams.get('status') || '';
        const orderType = parsedUrl.searchParams.get('type') || '';

        const result = await NexusOrderService.getAdminOrders({ page, limit, search, status, order_type: orderType });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Admin Update Order Status: PUT /api/v1/nexus/admin/orders/:id/status
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/orders/') && pathname.endsWith('/status')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const parts = pathname.split('/');
        const orderId = parts[6];
        const body = await parseBody(req);
        if (!body || !body.status) {
            sendJSON(res, 400, { success: false, error: 'Status is required.' });
            return;
        }
        try {
            const result = await NexusOrderService.updateOrderStatus(orderId, body.status, body.reason, {
                id: session.userId,
                role: session.roles.includes('super_admin') ? 'super_admin' : 'admin'
            });
            sendJSON(res, 200, { success: true, order: result });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Order Detail: GET /api/v1/nexus/admin/orders/:id
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/orders/')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const orderId = pathname.replace('/api/v1/nexus/admin/orders/', '');
        const order = await NexusOrderService.getAdminOrderDetail(orderId);
        if (!order) {
            sendJSON(res, 404, { success: false, error: 'Order not found.' });
            return;
        }
        sendJSON(res, 200, { success: true, order });
        return;
    }

    // Admin Payments Ledger: GET /api/v1/nexus/admin/payments
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/payments') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 20;
        const search = parsedUrl.searchParams.get('search') || '';
        const status = parsedUrl.searchParams.get('status') || '';

        const result = await nexusPaymentService.getAdminPayments({ page, limit, search, status });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Admin Reconcile Payment: POST /api/v1/nexus/admin/payments/:id/reconcile
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/payments/') && pathname.endsWith('/reconcile')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const parts = pathname.split('/');
        const paymentId = parts[6];
        const body = await parseBody(req);
        if (!body || !body.resolution) {
            sendJSON(res, 400, { success: false, error: 'Resolution (paid/failed/cancelled) is required.' });
            return;
        }
        try {
            const result = await nexusPaymentService.reconcilePayment(paymentId, body.resolution, body.notes, {
                id: session.userId,
                role: session.roles.includes('super_admin') ? 'super_admin' : 'admin'
            });
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Payment Detail: GET /api/v1/nexus/admin/payments/:id
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/payments/')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const paymentId = pathname.replace('/api/v1/nexus/admin/payments/', '');
        const payment = await nexusDb.getPaymentById(paymentId);
        if (!payment) {
            sendJSON(res, 404, { success: false, error: 'Payment not found.' });
            return;
        }
        sendJSON(res, 200, { success: true, payment });
        return;
    }

    // ==============================================================================
    // ADMIN MLM COMMISSION ENGINE ROUTES
    // ==============================================================================

    // Admin Commissions List & Ledger: GET /api/v1/nexus/admin/commissions
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/commissions') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 15;
        const status = parsedUrl.searchParams.get('status') || null;
        const type = parsedUrl.searchParams.get('type') || parsedUrl.searchParams.get('commission_type') || null;
        const level = parsedUrl.searchParams.get('level') || null;
        const search = parsedUrl.searchParams.get('search') || '';
        const member = parsedUrl.searchParams.get('member') || parsedUrl.searchParams.get('member_id') || null;
        const sourceMember = parsedUrl.searchParams.get('source_member') || parsedUrl.searchParams.get('source_member_id') || null;
        const rank = parsedUrl.searchParams.get('rank') || parsedUrl.searchParams.get('rank_id') || null;
        const plan = parsedUrl.searchParams.get('plan') || parsedUrl.searchParams.get('plan_id') || null;
        const planVersion = parsedUrl.searchParams.get('plan_version') || null;
        const currency = parsedUrl.searchParams.get('currency') || null;
        const order = parsedUrl.searchParams.get('order') || parsedUrl.searchParams.get('order_id') || null;
        const minAmount = parsedUrl.searchParams.get('min_amount') || null;
        const maxAmount = parsedUrl.searchParams.get('max_amount') || null;
        const dateFrom = parsedUrl.searchParams.get('date_from') || parsedUrl.searchParams.get('dateFrom') || null;
        const dateTo = parsedUrl.searchParams.get('date_to') || parsedUrl.searchParams.get('dateTo') || null;
        const sortBy = parsedUrl.searchParams.get('sort_by') || 'created_at';
        const sortDir = parsedUrl.searchParams.get('sort_dir') || 'desc';

        const result = await nexusDb.getAdminCommissions({ 
            page, limit, status, type, level, search,
            member, source_member: sourceMember, rank, plan, plan_version: planVersion,
            currency, order, min_amount: minAmount, max_amount: maxAmount,
            date_from: dateFrom, date_to: dateTo, sort_by: sortBy, sort_dir: sortDir
        });
        sendJSON(res, 200, {
            success: true,
            commissions: result.commissions,
            pagination: result.pagination,
            summary: result.summary,
            stats: result.stats
        });
        return;
    }

    // Admin Level Report: GET /api/v1/nexus/admin/commissions/reports/levels
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/commissions/reports/levels') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const period = parsedUrl.searchParams.get('period') || 'all';
        const dateFrom = parsedUrl.searchParams.get('date_from') || parsedUrl.searchParams.get('dateFrom') || parsedUrl.searchParams.get('start_date') || parsedUrl.searchParams.get('startDate');
        const dateTo = parsedUrl.searchParams.get('date_to') || parsedUrl.searchParams.get('dateTo') || parsedUrl.searchParams.get('end_date') || parsedUrl.searchParams.get('endDate');
        const currency = parsedUrl.searchParams.get('currency') || 'ALL';
        try {
            const report = await nexusFinancialReportingService.getLevelReport({ period, date_from: dateFrom, date_to: dateTo, currency });
            sendJSON(res, 200, { success: true, ...report, data: report.levels, levels: report.levels });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Rank Report: GET /api/v1/nexus/admin/commissions/reports/ranks
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/commissions/reports/ranks') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const period = parsedUrl.searchParams.get('period') || 'all';
        const dateFrom = parsedUrl.searchParams.get('date_from') || parsedUrl.searchParams.get('dateFrom') || parsedUrl.searchParams.get('start_date') || parsedUrl.searchParams.get('startDate');
        const dateTo = parsedUrl.searchParams.get('date_to') || parsedUrl.searchParams.get('dateTo') || parsedUrl.searchParams.get('end_date') || parsedUrl.searchParams.get('endDate');
        const currency = parsedUrl.searchParams.get('currency') || 'ALL';
        try {
            const report = await nexusFinancialReportingService.getRankReport({ period, date_from: dateFrom, date_to: dateTo, currency });
            sendJSON(res, 200, { success: true, ...report, data: report.ranks, ranks: report.ranks });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Commission Status Update: PUT /api/v1/nexus/admin/commissions/:id/status
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/commissions/') && pathname.endsWith('/status')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const commissionId = pathname.replace('/api/v1/nexus/admin/commissions/', '').replace('/status', '');
        const body = await parseBody(req);
        const { status, reason } = body;

        const allowedStatuses = ['pending', 'approved', 'hold', 'reversed', 'cancelled'];
        if (!status || !allowedStatuses.includes(status)) {
            sendJSON(res, 400, {
                success: false,
                error: `Invalid status. Allowed statuses: ${allowedStatuses.join(', ')}`
            });
            return;
        }

        const updated = await nexusDb.updateCommissionStatus(commissionId, status, reason, session);
        if (!updated) {
            sendJSON(res, 404, { success: false, error: 'Commission record not found.' });
            return;
        }
        sendJSON(res, 200, { success: true, commission: updated });
        return;
    }

    // Admin Commission Detail with Full 6-Stage Traceability: GET /api/v1/nexus/admin/commissions/:id
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/commissions/') && !pathname.includes('/reports/') && !pathname.includes('/breakdown')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const commissionId = pathname.replace('/api/v1/nexus/admin/commissions/', '');
        const detail = await nexusFinancialReportingService.getCommissionDetail(commissionId);
        if (!detail) {
            sendJSON(res, 404, { success: false, error: 'Commission record not found.' });
            return;
        }
        sendJSON(res, 200, { success: true, ...detail, data: detail, commission: detail.commission });
        return;
    }

    // Admin Commission Plans List: GET /api/v1/nexus/admin/commission-plans
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/commission-plans') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const result = await nexusDb.getAllCommissionPlans({ includeInactive: true });
        sendJSON(res, 200, { success: true, plans: result.plans, total: result.total });
        return;
    }

    // Admin Create Commission Plan: POST /api/v1/nexus/admin/commission-plans
    if (req.method === 'POST' && pathname === '/api/v1/nexus/admin/commission-plans') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const body = await parseBody(req);
        if (!body.plan_code || !body.plan_name) {
            sendJSON(res, 400, { success: false, error: 'Plan code and plan name are required.' });
            return;
        }
        if (!body.levels || !Array.isArray(body.levels) || body.levels.length === 0) {
            sendJSON(res, 400, { success: false, error: 'Commission plan levels matrix is required.' });
            return;
        }
        try {
            const newPlan = await nexusDb.createCommissionPlan(body, session);
            sendJSON(res, 201, { success: true, plan: newPlan });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Commission Plan Status Update: PUT /api/v1/nexus/admin/commission-plans/:id/status
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/commission-plans/') && pathname.endsWith('/status')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const planId = pathname.replace('/api/v1/nexus/admin/commission-plans/', '').replace('/status', '');
        const body = await parseBody(req);
        if (!body.status) {
            sendJSON(res, 400, { success: false, error: 'Status is required.' });
            return;
        }
        const updated = await nexusDb.updateCommissionPlan(planId, { status: body.status }, session);
        if (!updated) {
            sendJSON(res, 404, { success: false, error: 'Commission plan not found.' });
            return;
        }
        sendJSON(res, 200, { success: true, plan: updated });
        return;
    }

    // Admin Commission Plan Detail: GET /api/v1/nexus/admin/commission-plans/:id
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/commission-plans/')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const planId = pathname.replace('/api/v1/nexus/admin/commission-plans/', '');
        const plan = await nexusDb.getCommissionPlanById(planId);
        if (!plan) {
            sendJSON(res, 404, { success: false, error: 'Commission plan not found.' });
            return;
        }
        sendJSON(res, 200, { success: true, plan });
        return;
    }

    // ==============================================================================
    // WALLET & FINANCIAL LEDGER ENDPOINTS (PROMPT 12)
    // ==============================================================================

    // Member Wallet Overview: GET /api/v1/nexus/member/wallet
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/wallet') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        try {
            const summary = await nexusDb.getMemberLedgerSummary(session.userId);
            sendJSON(res, 200, { success: true, wallet: summary });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Member Wallet Transactions: GET /api/v1/nexus/member/wallet/transactions
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/wallet/transactions') {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        try {
            const options = {
                page: parsedUrl.searchParams.get('page') || 1,
                limit: parsedUrl.searchParams.get('limit') || 10,
                direction: parsedUrl.searchParams.get('direction') || null,
                entry_type: parsedUrl.searchParams.get('type') || null,
                status: parsedUrl.searchParams.get('status') || null,
                search: parsedUrl.searchParams.get('search') || null,
                dateFrom: parsedUrl.searchParams.get('dateFrom') || null,
                dateTo: parsedUrl.searchParams.get('dateTo') || null
            };
            const result = await nexusDb.getMemberLedgerEntries(session.userId, options);
            sendJSON(res, 200, { success: true, ...result });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Member Transaction Detail: GET /api/v1/nexus/member/wallet/transactions/:id
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/member/wallet/transactions/')) {
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }
        const txId = pathname.replace('/api/v1/nexus/member/wallet/transactions/', '');
        const entry = await nexusDb.getLedgerEntryById(txId);
        if (!entry) {
            sendJSON(res, 404, { success: false, error: 'Transaction record not found.' });
            return;
        }

        const isAdmin = session.roles && (session.roles.includes('admin') || session.roles.includes('super_admin'));
        if (entry.member_id !== session.userId && !isAdmin) {
            sendJSON(res, 403, { success: false, error: 'Access denied. You cannot view another member\'s financial transaction.' });
            return;
        }

        sendJSON(res, 200, { success: true, transaction: entry });
        return;
    }

    // Admin Wallets Directory: GET /api/v1/nexus/admin/wallets
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/wallets') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const options = {
            page: parsedUrl.searchParams.get('page') || 1,
            limit: parsedUrl.searchParams.get('limit') || 10,
            status: parsedUrl.searchParams.get('status') || null,
            currency: parsedUrl.searchParams.get('currency') || null,
            search: parsedUrl.searchParams.get('search') || null
        };
        const result = await nexusDb.getAllWallets(options);
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Admin Wallet Detail: GET /api/v1/nexus/admin/wallets/:id
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/wallets/')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const walletId = pathname.replace('/api/v1/nexus/admin/wallets/', '');
        const wallet = await nexusDb.getWalletById(walletId);
        if (!wallet) {
            sendJSON(res, 404, { success: false, error: 'Wallet not found.' });
            return;
        }
        const balance = await nexusDb.getWalletLedgerBalance(wallet.id);
        const profile = await nexusDb.findProfileByUserId(wallet.member_id);
        sendJSON(res, 200, { success: true, wallet: { ...wallet, profile, balance } });
        return;
    }

    // Admin Global Transactions Journal: GET /api/v1/nexus/admin/transactions
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/transactions') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const options = {
            page: parsedUrl.searchParams.get('page') || 1,
            limit: parsedUrl.searchParams.get('limit') || 15,
            direction: parsedUrl.searchParams.get('direction') || null,
            entry_type: parsedUrl.searchParams.get('type') || null,
            status: parsedUrl.searchParams.get('status') || null,
            member_id: parsedUrl.searchParams.get('member_id') || null,
            search: parsedUrl.searchParams.get('search') || null,
            dateFrom: parsedUrl.searchParams.get('dateFrom') || null,
            dateTo: parsedUrl.searchParams.get('dateTo') || null
        };
        const result = await nexusDb.getAllLedgerEntries(options);
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Admin Transaction Detail: GET /api/v1/nexus/admin/transactions/:id
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/transactions/')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const txId = pathname.replace('/api/v1/nexus/admin/transactions/', '');
        const entry = await nexusDb.getLedgerEntryById(txId);
        if (!entry) {
            sendJSON(res, 404, { success: false, error: 'Transaction record not found.' });
            return;
        }
        sendJSON(res, 200, { success: true, transaction: entry });
        return;
    }

    // Admin Controlled Financial Adjustment: POST /api/v1/nexus/admin/wallet/adjustment
    if (req.method === 'POST' && pathname === '/api/v1/nexus/admin/wallet/adjustment') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const body = await parseBody(req);
        try {
            const result = await nexusWalletService.postAdjustment({
                memberId: body.member_id || body.memberId,
                amount: body.amount,
                direction: body.direction,
                reason: body.reason,
                notes: body.notes || '',
                actor: session
            });
            sendJSON(res, 201, { success: true, ...result });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Transaction Reversal: POST /api/v1/nexus/admin/transactions/:id/reverse
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/transactions/') && pathname.endsWith('/reverse')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const txId = pathname.replace('/api/v1/nexus/admin/transactions/', '').replace('/reverse', '');
        const body = await parseBody(req);
        try {
            const result = await nexusWalletService.reverseTransaction(txId, body.reason, session);
            sendJSON(res, 200, { success: true, ...result });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Credit Commission to Wallet: POST /api/v1/nexus/admin/commissions/:id/credit-to-wallet
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/commissions/') && pathname.endsWith('/credit-to-wallet')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const commId = pathname.replace('/api/v1/nexus/admin/commissions/', '').replace('/credit-to-wallet', '');
        try {
            const result = await nexusWalletService.creditApprovedCommission(commId, session);
            sendJSON(res, 200, { success: true, ...result });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Financial Reconciliation Diagnostics: GET /api/v1/nexus/admin/financial/reconciliation
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/financial/reconciliation') {
        const session = requireAdmin(req, res);
        if (!session) return;
        try {
            const diagnostics = await nexusWalletService.runReconciliationDiagnostics();
            sendJSON(res, 200, { success: true, diagnostics });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Financial Aggregate Overview: GET /api/v1/nexus/admin/financial/overview
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/financial/overview') {
        const session = requireAdmin(req, res);
        if (!session) return;
        try {
            const stats = await nexusDb.getFinancialSummaryStats();
            sendJSON(res, 200, { success: true, overview: stats, stats });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // ==============================================================================
    // PROMPT 13: BANK ACCOUNTS & WITHDRAWAL PAYOUT API ENDPOINTS
    // ==============================================================================

    // Member Bank Accounts List: GET /api/v1/nexus/member/bank-accounts
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/bank-accounts') {
        const session = requireAuth(req, res);
        if (!session) return;
        const accounts = await nexusWithdrawalService.getMemberBankAccounts(session.userId);
        sendJSON(res, 200, { success: true, bank_accounts: accounts, accounts });
        return;
    }

    // Member Create Bank Account: POST /api/v1/nexus/member/bank-accounts
    if (req.method === 'POST' && pathname === '/api/v1/nexus/member/bank-accounts') {
        const session = requireAuth(req, res);
        if (!session) return;
        const body = await parseBody(req);
        try {
            const account = await nexusWithdrawalService.createBankAccount({
                memberId: session.userId,
                bankName: body.bank_name || body.bankName,
                branchName: body.branch_name || body.branchName,
                branchCode: body.branch_code || body.branchCode,
                accountName: body.account_name || body.accountName,
                accountNumber: body.account_number || body.accountNumber,
                accountType: body.account_type || body.accountType,
                currency: body.currency || 'LKR',
                isPrimary: body.is_primary !== undefined ? body.is_primary : body.isPrimary
            });
            sendJSON(res, 201, { success: true, bank_account: account, account });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Member Set Primary Bank Account: PUT /api/v1/nexus/member/bank-accounts/:id/primary
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/member/bank-accounts/') && pathname.endsWith('/primary')) {
        const session = requireAuth(req, res);
        if (!session) return;
        const accountId = pathname.replace('/api/v1/nexus/member/bank-accounts/', '').replace('/primary', '');
        try {
            const account = await nexusWithdrawalService.setPrimaryBankAccount(session.userId, accountId);
            sendJSON(res, 200, { success: true, bank_account: account, account });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Member Deactivate Bank Account: DELETE /api/v1/nexus/member/bank-accounts/:id
    if (req.method === 'DELETE' && pathname.startsWith('/api/v1/nexus/member/bank-accounts/')) {
        const session = requireAuth(req, res);
        if (!session) return;
        const accountId = pathname.replace('/api/v1/nexus/member/bank-accounts/', '');
        try {
            const account = await nexusWithdrawalService.deactivateBankAccount(session.userId, accountId);
            sendJSON(res, 200, { success: true, bank_account: account, account });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Member Withdrawal Overview & History: GET /api/v1/nexus/member/withdrawals
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/withdrawals') {
        const session = requireAuth(req, res);
        if (!session) return;
        const options = {
            page: parsedUrl.searchParams.get('page') || 1,
            limit: parsedUrl.searchParams.get('limit') || 10,
            status: parsedUrl.searchParams.get('status') || null
        };
        const [history, overview] = await Promise.all([
            nexusDb.getMemberWithdrawals(session.userId, options),
            nexusWithdrawalService.getMemberWithdrawalOverview(session.userId)
        ]);
        sendJSON(res, 200, { success: true, ...history, overview });
        return;
    }

    // Member Withdrawal Detail: GET /api/v1/nexus/member/withdrawals/:id
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/member/withdrawals/') && !pathname.endsWith('/cancel')) {
        const session = requireAuth(req, res);
        if (!session) return;
        const withdrawalId = pathname.replace('/api/v1/nexus/member/withdrawals/', '');
        const withdrawal = await nexusDb.getWithdrawalById(withdrawalId);
        if (!withdrawal) {
            sendJSON(res, 404, { success: false, error: 'Withdrawal request not found.' });
            return;
        }
        if (withdrawal.member_id !== session.userId) {
            sendJSON(res, 403, { success: false, error: 'Access Denied: You cannot view another member\'s withdrawal record.' });
            return;
        }
        sendJSON(res, 200, { success: true, withdrawal });
        return;
    }

    // Member Request Withdrawal: POST /api/v1/nexus/member/withdrawals
    if (req.method === 'POST' && pathname === '/api/v1/nexus/member/withdrawals') {
        const session = requireAuth(req, res);
        if (!session) return;
        const body = await parseBody(req);
        try {
            const result = await nexusWithdrawalService.requestWithdrawal({
                memberId: session.userId,
                amount: body.amount,
                bankAccountId: body.bank_account_id || body.bankAccountId,
                memberNote: body.member_note || body.notes || ''
            });
            sendJSON(res, 201, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Member Cancel Withdrawal: POST /api/v1/nexus/member/withdrawals/:id/cancel
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/member/withdrawals/') && pathname.endsWith('/cancel')) {
        const session = requireAuth(req, res);
        if (!session) return;
        const withdrawalId = pathname.replace('/api/v1/nexus/member/withdrawals/', '').replace('/cancel', '');
        const body = await parseBody(req);
        try {
            const result = await nexusWithdrawalService.cancelWithdrawal({
                withdrawalId,
                memberId: session.userId,
                reason: body.reason || 'Member cancelled request'
            });
            sendJSON(res, 200, result);
        } catch (err) {
            const status = (err.message && err.message.includes('Access Denied')) ? 403 : 400;
            sendJSON(res, status, { success: false, error: err.message });
        }
        return;
    }

    // Admin Withdrawals List: GET /api/v1/nexus/admin/withdrawals
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/withdrawals') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const options = {
            page: parsedUrl.searchParams.get('page') || 1,
            limit: parsedUrl.searchParams.get('limit') || 15,
            status: parsedUrl.searchParams.get('status') || null,
            currency: parsedUrl.searchParams.get('currency') || null,
            search: parsedUrl.searchParams.get('search') || null,
            minAmount: parsedUrl.searchParams.get('minAmount') || null,
            maxAmount: parsedUrl.searchParams.get('maxAmount') || null
        };
        const result = await nexusDb.getAllWithdrawals(options);
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Admin Withdrawals Stats: GET /api/v1/nexus/admin/withdrawals/stats
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/withdrawals/stats') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const stats = await nexusDb.getWithdrawalStats();
        sendJSON(res, 200, { success: true, stats });
        return;
    }

    // Admin Withdrawal Detail (with wire transfer details): GET /api/v1/nexus/admin/withdrawals/:id
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/withdrawals/') && !pathname.endsWith('/reconciliation') && !pathname.endsWith('/stats')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const withdrawalId = pathname.replace('/api/v1/nexus/admin/withdrawals/', '');
        const withdrawal = await nexusDb.getWithdrawalById(withdrawalId);
        if (!withdrawal) {
            sendJSON(res, 404, { success: false, error: 'Withdrawal record not found.' });
            return;
        }

        // Fetch unmasked bank account for authorized admin manual transfer
        const bankAccount = await nexusDb.getBankAccountById(withdrawal.bank_account_id);
        sendJSON(res, 200, {
            success: true,
            withdrawal,
            bank_transfer_details: {
                bank_name: withdrawal.bank_snapshot.bank_name,
                branch_name: withdrawal.bank_snapshot.branch_name,
                branch_code: withdrawal.bank_snapshot.branch_code,
                account_name: withdrawal.bank_snapshot.account_name,
                account_number: bankAccount ? bankAccount.account_number : withdrawal.bank_snapshot.account_number_masked,
                account_type: withdrawal.bank_snapshot.account_type,
                net_amount: withdrawal.net_amount,
                currency: withdrawal.currency,
                withdrawal_number: withdrawal.withdrawal_number
            }
        });
        return;
    }

    // Admin Review Withdrawal: POST /api/v1/nexus/admin/withdrawals/:id/review
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/withdrawals/') && pathname.endsWith('/review')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const withdrawalId = pathname.replace('/api/v1/nexus/admin/withdrawals/', '').replace('/review', '');
        const body = await parseBody(req);
        try {
            const result = await nexusWithdrawalService.reviewWithdrawal({
                withdrawalId,
                adminUser: session,
                adminNote: body.admin_note || body.notes || ''
            });
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Approve Withdrawal: POST /api/v1/nexus/admin/withdrawals/:id/approve
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/withdrawals/') && pathname.endsWith('/approve')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const withdrawalId = pathname.replace('/api/v1/nexus/admin/withdrawals/', '').replace('/approve', '');
        const body = await parseBody(req);
        try {
            const result = await nexusWithdrawalService.approveWithdrawal({
                withdrawalId,
                adminUser: session,
                adminNote: body.admin_note || body.notes || ''
            });
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Mark Processing: POST /api/v1/nexus/admin/withdrawals/:id/processing
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/withdrawals/') && pathname.endsWith('/processing')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const withdrawalId = pathname.replace('/api/v1/nexus/admin/withdrawals/', '').replace('/processing', '');
        const body = await parseBody(req);
        try {
            const result = await nexusWithdrawalService.markProcessing({
                withdrawalId,
                adminUser: session,
                adminNote: body.admin_note || body.notes || ''
            });
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Confirm Manual Bank Payout (Mark as Paid): POST /api/v1/nexus/admin/withdrawals/:id/pay
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/withdrawals/') && pathname.endsWith('/pay')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const withdrawalId = pathname.replace('/api/v1/nexus/admin/withdrawals/', '').replace('/pay', '');
        const body = await parseBody(req);
        try {
            const result = await nexusWithdrawalService.markAsPaid({
                withdrawalId,
                adminUser: session,
                payoutReference: body.payout_reference || body.payoutReference,
                payoutNote: body.payout_note || body.notes || '',
                paidAt: body.paid_at || body.paidAt || null
            });
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Reject Withdrawal: POST /api/v1/nexus/admin/withdrawals/:id/reject
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/withdrawals/') && pathname.endsWith('/reject')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const withdrawalId = pathname.replace('/api/v1/nexus/admin/withdrawals/', '').replace('/reject', '');
        const body = await parseBody(req);
        try {
            const result = await nexusWithdrawalService.rejectWithdrawal({
                withdrawalId,
                adminUser: session,
                rejectionReason: body.rejection_reason || body.rejectionReason || body.reason
            });
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Fail Payout: POST /api/v1/nexus/admin/withdrawals/:id/fail
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/withdrawals/') && pathname.endsWith('/fail')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const withdrawalId = pathname.replace('/api/v1/nexus/admin/withdrawals/', '').replace('/fail', '');
        const body = await parseBody(req);
        try {
            const result = await nexusWithdrawalService.failPayout({
                withdrawalId,
                adminUser: session,
                failureReason: body.failure_reason || body.failureReason || body.reason
            });
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Withdrawals Reconciliation: GET /api/v1/nexus/admin/withdrawals/reconciliation
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/withdrawals/reconciliation') {
        const session = requireAdmin(req, res);
        if (!session) return;
        try {
            const diagnostics = await nexusWithdrawalService.reconcileWithdrawals();
            sendJSON(res, 200, { success: true, diagnostics });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // ==============================================================================
    // PROMPT 14: MLM RANK, LEVEL, QUALIFICATION & ACHIEVEMENT ENDPOINTS
    // ==============================================================================

    // Member Rank Progress: GET /api/v1/nexus/member/rank
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/rank') {
        const session = requireAuth(req, res);
        if (!session) return;
        try {
            const result = await nexusRankService.getMemberRankProgress(session.userId);
            sendJSON(res, 200, { success: true, ...result, data: result });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Member Rank History: GET /api/v1/nexus/member/rank/history
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/rank/history') {
        const session = requireAuth(req, res);
        if (!session) return;
        const page = parsedUrl.searchParams.get('page') || 1;
        const limit = parsedUrl.searchParams.get('limit') || 20;
        try {
            const result = await nexusDb.getMemberRankHistory(session.userId, { page, limit });
            sendJSON(res, 200, { success: true, ...result, data: result.history });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin List Rule Versions: GET /api/v1/nexus/admin/ranks/rules/versions
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/ranks/rules/versions') {
        const session = requireAdmin(req, res);
        if (!session) return;
        try {
            const versions = await nexusDb.getRankRuleVersions();
            sendJSON(res, 200, { success: true, versions, data: versions });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Create Rule Version: POST /api/v1/nexus/admin/ranks/rules/versions
    if (req.method === 'POST' && pathname === '/api/v1/nexus/admin/ranks/rules/versions') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const body = await parseBody(req);
        try {
            const version = await nexusDb.createRankRuleVersion({
                ...body,
                created_by: session.username || session.userId
            });
            await nexusDb.insertAuditLog({
                action: 'RANK_RULE_VERSION_CREATED',
                entity_type: 'nexus_rank_rule_versions',
                entity_id: version.id,
                actor_id: session.userId,
                payload: { version: version.version, name: version.name, effective_from: version.effective_from }
            });
            sendJSON(res, 201, { success: true, version, data: version });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Create Rank Requirement: POST /api/v1/nexus/admin/ranks/requirements
    if (req.method === 'POST' && pathname === '/api/v1/nexus/admin/ranks/requirements') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const body = await parseBody(req);
        try {
            const requirement = await nexusDb.createRankRequirement(body);
            await nexusDb.insertAuditLog({
                action: 'RANK_REQUIREMENT_CREATED',
                entity_type: 'nexus_rank_requirements',
                entity_id: requirement.id,
                actor_id: session.userId,
                payload: { rank_id: requirement.rank_id, metric_type: requirement.metric_type, target_value: requirement.target_value }
            });
            sendJSON(res, 201, { success: true, requirement, data: requirement });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Rank Performance Directory: GET /api/v1/nexus/admin/ranks/performance
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/ranks/performance') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const options = {
            page: parsedUrl.searchParams.get('page') || 1,
            limit: parsedUrl.searchParams.get('limit') || 15,
            rank: parsedUrl.searchParams.get('rank') || null,
            status: parsedUrl.searchParams.get('status') || null,
            search: parsedUrl.searchParams.get('search') || null
        };
        try {
            const result = await nexusDb.getRankPerformanceDirectory(options);
            sendJSON(res, 200, { success: true, ...result, data: result.members });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Recalculate Specific Member Rank: POST /api/v1/nexus/admin/ranks/recalculate-member/:id
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/ranks/recalculate-member/')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const targetMemberId = pathname.replace('/api/v1/nexus/admin/ranks/recalculate-member/', '');
        const body = await parseBody(req);
        try {
            const result = await nexusRankService.recalculateMemberRank(targetMemberId, {
                adminUserId: session.userId,
                forceDemotion: Boolean(body.forceDemotion),
                reason: body.reason || 'Admin manual recalculation'
            });
            sendJSON(res, 200, { success: true, ...result, data: result });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Batch Recalculate All Members: POST /api/v1/nexus/admin/ranks/recalculate-all
    if (req.method === 'POST' && pathname === '/api/v1/nexus/admin/ranks/recalculate-all') {
        const session = requireAdmin(req, res);
        if (!session) return;
        try {
            const result = await nexusRankService.recalculateAllEligibleRanks({
                adminUserId: session.userId
            });
            sendJSON(res, 200, { success: true, ...result, data: result });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin List Ranks: GET /api/v1/nexus/admin/ranks
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/ranks') {
        const session = requireAdmin(req, res);
        if (!session) return;
        try {
            const ranks = await nexusDb.getAllRanks();
            const requirements = await nexusDb.getRankRequirements();
            const activeVer = await nexusDb.getActiveRankRuleVersion();
            const enriched = ranks.map(r => {
                const reqCount = requirements.filter(reqItem => reqItem.rank_id === r.id).length;
                const membersCount = nexusDb.memberProfiles.filter(p => (p.rank || 'MEMBER').toUpperCase() === r.code.toUpperCase()).length;
                return {
                    ...r,
                    requirements_count: reqCount,
                    members_count: membersCount
                };
            });
            sendJSON(res, 200, { 
                success: true, 
                ranks: enriched, 
                data: enriched, 
                meta: { active_rule_version: activeVer?.version || 'v1.0' } 
            });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Create Rank: POST /api/v1/nexus/admin/ranks
    if (req.method === 'POST' && pathname === '/api/v1/nexus/admin/ranks') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const body = await parseBody(req);
        try {
            const rank = await nexusDb.createRank(body);
            await nexusDb.insertAuditLog({
                action: 'RANK_CREATED',
                entity_type: 'nexus_ranks',
                entity_id: rank.id,
                actor_id: session.userId,
                payload: { code: rank.code, name: rank.name, display_order: rank.display_order }
            });
            sendJSON(res, 201, { success: true, rank, data: rank });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Update Rank: PUT /api/v1/nexus/admin/ranks/:id
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/ranks/') && !pathname.includes('/rules') && !pathname.includes('/recalculate')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const rankId = pathname.replace('/api/v1/nexus/admin/ranks/', '');
        const body = await parseBody(req);
        try {
            const rank = await nexusDb.updateRank(rankId, body);
            await nexusDb.insertAuditLog({
                action: 'RANK_UPDATED',
                entity_type: 'nexus_ranks',
                entity_id: rank.id,
                actor_id: session.userId,
                payload: body
            });
            sendJSON(res, 200, { success: true, rank, data: rank });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin Get Rank Detail: GET /api/v1/nexus/admin/ranks/:id
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/ranks/') && !pathname.includes('/rules') && !pathname.includes('/performance') && !pathname.includes('/recalculate')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const rankId = pathname.replace('/api/v1/nexus/admin/ranks/', '');
        try {
            const rank = await nexusDb.getRankById(rankId);
            if (!rank) {
                sendJSON(res, 404, { success: false, error: `Rank '${rankId}' not found.` });
                return;
            }
            const requirements = await nexusDb.getRankRequirements({ rank_id: rank.id });
            const membersCount = nexusDb.memberProfiles.filter(p => (p.rank || 'MEMBER').toUpperCase() === rank.code.toUpperCase()).length;
            sendJSON(res, 200, { 
                success: true, 
                rank, 
                requirements, 
                members_count: membersCount,
                data: { ...rank, requirements, members_count: membersCount }
            });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // ==============================================================================
    // FINANCIAL REPORTING, ANALYTICS & RECONCILIATION ROUTES (Prompt 15)
    // ==============================================================================

    // Admin Financial Overview / Dashboard: GET /api/v1/nexus/admin/financials/overview
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/financials/overview') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const period = parsedUrl.searchParams.get('period') || 'all';
        const dateFrom = parsedUrl.searchParams.get('date_from') || parsedUrl.searchParams.get('dateFrom') || parsedUrl.searchParams.get('start_date') || parsedUrl.searchParams.get('startDate');
        const dateTo = parsedUrl.searchParams.get('date_to') || parsedUrl.searchParams.get('dateTo') || parsedUrl.searchParams.get('end_date') || parsedUrl.searchParams.get('endDate');
        const currency = parsedUrl.searchParams.get('currency') || 'ALL';
        try {
            const overview = await nexusFinancialReportingService.getFinancialOverview({ period, date_from: dateFrom, date_to: dateTo, currency });
            sendJSON(res, 200, { success: true, ...overview, data: overview });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Package Sales Report: GET /api/v1/nexus/admin/reports/packages
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/reports/packages') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const period = parsedUrl.searchParams.get('period') || 'all';
        const dateFrom = parsedUrl.searchParams.get('date_from') || parsedUrl.searchParams.get('dateFrom') || parsedUrl.searchParams.get('start_date') || parsedUrl.searchParams.get('startDate');
        const dateTo = parsedUrl.searchParams.get('date_to') || parsedUrl.searchParams.get('dateTo') || parsedUrl.searchParams.get('end_date') || parsedUrl.searchParams.get('endDate');
        const currency = parsedUrl.searchParams.get('currency') || 'ALL';
        try {
            const report = await nexusFinancialReportingService.getPackageSalesReport({ period, date_from: dateFrom, date_to: dateTo, currency });
            sendJSON(res, 200, { success: true, ...report, data: report.packages, packages: report.packages });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Product Sales Report: GET /api/v1/nexus/admin/reports/products
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/reports/products') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const period = parsedUrl.searchParams.get('period') || 'all';
        const dateFrom = parsedUrl.searchParams.get('date_from') || parsedUrl.searchParams.get('dateFrom') || parsedUrl.searchParams.get('start_date') || parsedUrl.searchParams.get('startDate');
        const dateTo = parsedUrl.searchParams.get('date_to') || parsedUrl.searchParams.get('dateTo') || parsedUrl.searchParams.get('end_date') || parsedUrl.searchParams.get('endDate');
        const currency = parsedUrl.searchParams.get('currency') || 'ALL';
        try {
            const report = await nexusFinancialReportingService.getProductSalesReport({ period, date_from: dateFrom, date_to: dateTo, currency });
            sendJSON(res, 200, { success: true, ...report, data: report.products, products: report.products });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Member Financial Dossier: GET /api/v1/nexus/admin/members/:id/financials
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/members/') && pathname.endsWith('/financials')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const memberId = pathname.replace('/api/v1/nexus/admin/members/', '').replace('/financials', '');
        try {
            const report = await nexusFinancialReportingService.getMemberFinancialSummary(memberId);
            sendJSON(res, 200, { success: true, ...report, data: report });
        } catch (err) {
            sendJSON(res, 404, { success: false, error: err.message });
        }
        return;
    }

    // Admin Withdrawals Report: GET /api/v1/nexus/admin/reports/withdrawals
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/reports/withdrawals') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 20;
        const status = parsedUrl.searchParams.get('status') || null;
        const period = parsedUrl.searchParams.get('period') || 'all';
        const dateFrom = parsedUrl.searchParams.get('date_from') || parsedUrl.searchParams.get('start_date');
        const dateTo = parsedUrl.searchParams.get('date_to') || parsedUrl.searchParams.get('end_date');
        const search = parsedUrl.searchParams.get('search') || '';
        try {
            const report = await nexusFinancialReportingService.getWithdrawalReport({ page, limit, status, period, date_from: dateFrom, date_to: dateTo, search });
            sendJSON(res, 200, { success: true, ...report, data: report.withdrawals, withdrawals: report.withdrawals, pagination: report.pagination });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Payouts Report: GET /api/v1/nexus/admin/reports/payouts
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/reports/payouts') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 20;
        const period = parsedUrl.searchParams.get('period') || 'all';
        const dateFrom = parsedUrl.searchParams.get('date_from') || parsedUrl.searchParams.get('start_date');
        const dateTo = parsedUrl.searchParams.get('date_to') || parsedUrl.searchParams.get('end_date');
        const search = parsedUrl.searchParams.get('search') || '';
        try {
            const report = await nexusFinancialReportingService.getPayoutReport({ page, limit, period, date_from: dateFrom, date_to: dateTo, search });
            sendJSON(res, 200, { success: true, ...report, data: report.payouts, payouts: report.payouts, pagination: report.pagination });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Wallet Ledger Report: GET /api/v1/nexus/admin/reports/ledger
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/reports/ledger') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 20;
        const period = parsedUrl.searchParams.get('period') || 'all';
        const dateFrom = parsedUrl.searchParams.get('date_from') || parsedUrl.searchParams.get('start_date');
        const dateTo = parsedUrl.searchParams.get('date_to') || parsedUrl.searchParams.get('end_date');
        const direction = parsedUrl.searchParams.get('direction') || null;
        const search = parsedUrl.searchParams.get('search') || '';
        try {
            const report = await nexusFinancialReportingService.getWalletLedgerReport({ page, limit, period, date_from: dateFrom, date_to: dateTo, direction, search });
            sendJSON(res, 200, { success: true, ...report, data: report.entries || report.ledger, ledger: report.entries || report.ledger, entries: report.entries || report.ledger, pagination: report.pagination });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Financial Movement Report: GET /api/v1/nexus/admin/reports/movement
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/reports/movement') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const period = parsedUrl.searchParams.get('period') || 'this_month';
        const dateFrom = parsedUrl.searchParams.get('date_from') || parsedUrl.searchParams.get('start_date');
        const dateTo = parsedUrl.searchParams.get('date_to') || parsedUrl.searchParams.get('end_date');
        const currency = parsedUrl.searchParams.get('currency') || 'LKR';
        try {
            const report = await nexusFinancialReportingService.getFinancialMovementReport({ period, date_from: dateFrom, date_to: dateTo, currency });
            sendJSON(res, 200, { success: true, ...report, data: report.movement, movement: report.movement });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Reconciliation Report: GET /api/v1/nexus/admin/reports/reconciliation
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/reports/reconciliation') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const status = parsedUrl.searchParams.get('status') || null;
        const severity = parsedUrl.searchParams.get('severity') || null;
        const search = parsedUrl.searchParams.get('search') || '';
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 20;
        try {
            const report = await nexusFinancialReportingService.runFinancialReconciliation({ status, severity, search, page, limit });
            sendJSON(res, 200, { success: true, ...report, data: report });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Reconciliation Issue Detail: GET /api/v1/nexus/admin/reports/reconciliation/:id
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/reports/reconciliation/')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const issueId = pathname.replace('/api/v1/nexus/admin/reports/reconciliation/', '');
        try {
            const issue = await nexusDb.getReconciliationIssueById(issueId);
            if (!issue) {
                sendJSON(res, 404, { success: false, error: `Reconciliation issue '${issueId}' not found.` });
                return;
            }
            sendJSON(res, 200, { success: true, issue, data: issue });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Resolve Reconciliation Issue: POST /api/v1/nexus/admin/reports/reconciliation/:id/resolve
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/reports/reconciliation/') && pathname.endsWith('/resolve')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const issueId = pathname.replace('/api/v1/nexus/admin/reports/reconciliation/', '').replace('/resolve', '');
        const body = await parseBody(req);
        const notes = body.resolution_notes || body.notes || '';
        try {
            const updated = await nexusDb.updateReconciliationIssueStatus(issueId, body.status || 'resolved', notes, session.userId);
            sendJSON(res, 200, { success: true, issue: updated, data: updated });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // Admin CSV Report Export: GET /api/v1/nexus/admin/reports/export
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/reports/export') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const type = parsedUrl.searchParams.get('report') || parsedUrl.searchParams.get('type') || 'financials';
        const period = parsedUrl.searchParams.get('period') || 'all';
        const dateFrom = parsedUrl.searchParams.get('date_from') || parsedUrl.searchParams.get('start_date');
        const dateTo = parsedUrl.searchParams.get('date_to') || parsedUrl.searchParams.get('end_date');
        const status = parsedUrl.searchParams.get('status') || null;
        const currency = parsedUrl.searchParams.get('currency') || 'ALL';
        const format = (parsedUrl.searchParams.get('format') || 'csv').toLowerCase();
        try {
            if (format === 'json') {
                const dateRange = nexusFinancialReportingService.resolveDateRange({ period, date_from: dateFrom, date_to: dateTo });
                let data;
                if (type === 'commissions') {
                    data = await nexusDb.getAdminCommissions({ period_start: dateRange.period_start, period_end: dateRange.period_end, status, currency, limit: 5000 });
                } else if (type === 'withdrawals') {
                    data = await nexusFinancialReportingService.getWithdrawalReport({ period_start: dateRange.period_start, period_end: dateRange.period_end, status, currency, limit: 5000 });
                } else {
                    data = await nexusFinancialReportingService.getFinancialOverview({ period_start: dateRange.period_start, period_end: dateRange.period_end, currency });
                }
                sendJSON(res, 200, { success: true, report: type, data, date_range: dateRange });
                return;
            }
            const csv = await nexusFinancialReportingService.exportReportToCSV(type, { period, date_from: dateFrom, date_to: dateTo, status, currency });
            res.writeHead(200, {
                'Content-Type': 'text/csv; charset=utf-8',
                'content-type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="nexus_prime_report_${type}_${Date.now()}.csv"`
            });
            res.end(csv);
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Member Commission Summary & History: GET /api/v1/nexus/member/commissions/summary
    if (req.method === 'GET' && pathname === '/api/v1/nexus/member/commissions/summary') {
        const session = requireAuth(req, res);
        if (!session) return;
        const page = parseInt(parsedUrl.searchParams.get('page'), 10) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 10;
        const status = parsedUrl.searchParams.get('status') || null;
        const type = parsedUrl.searchParams.get('type') || null;
        try {
            const report = await nexusFinancialReportingService.getMemberCommissionReport(session.userId, { page, limit, status, type });
            sendJSON(res, 200, { success: true, ...report, data: report });
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // =========================================================================
    // ADMIN NOTIFICATIONS & BROADCAST ANNOUNCEMENTS (Prompt 16)
    // =========================================================================
    // Admin Unread Notifications Count
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/notifications/unread-count') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const unreadCount = await nexusDb.getUnreadNotificationCount(session.userId);
        sendJSON(res, 200, { success: true, unreadCount });
        return;
    }

    // Admin Notification Settings & Provider Status
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/settings/notifications') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const emailStatus = nexusEmailProvider.getStatus();
        sendJSON(res, 200, {
            success: true,
            emailProvider: emailStatus,
            channels: {
                inApp: { enabled: true, status: 'active' },
                email: emailStatus,
                sms: { enabled: false, status: 'prepared_stub', notice: 'SMS gateway interface ready' },
                push: { enabled: false, status: 'prepared_stub', notice: 'WebPush interface ready' },
                whatsapp: { enabled: false, status: 'prepared_stub', notice: 'WhatsApp Business API interface ready' }
            }
        });
        return;
    }

    // Admin Mark All Notifications Read
    if (req.method === 'PUT' && pathname === '/api/v1/nexus/admin/notifications/read-all') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const category = parsedUrl.searchParams.get('category');
        const count = await nexusDb.markAllNotificationsRead(session.userId, category);
        sendJSON(res, 200, { success: true, markedCount: count });
        return;
    }

    // Admin Notifications List
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/notifications') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const category = parsedUrl.searchParams.get('category');
        const priority = parsedUrl.searchParams.get('priority');
        const status = parsedUrl.searchParams.get('status');
        const search = parsedUrl.searchParams.get('search');
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 50;
        const offset = parseInt(parsedUrl.searchParams.get('offset'), 10) || 0;

        const result = await nexusDb.getNotifications({
            isAdmin: true,
            recipientId: session.userId,
            category,
            priority,
            status,
            search,
            limit,
            offset
        });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Admin Single Notification
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/notifications/')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const notifId = pathname.replace('/api/v1/nexus/admin/notifications/', '');
        const notif = await nexusDb.getNotificationById(notifId);
        if (!notif) {
            sendJSON(res, 404, { success: false, error: 'Notification not found.' });
            return;
        }
        sendJSON(res, 200, { success: true, notification: notif });
        return;
    }

    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/notifications/') && pathname.endsWith('/read')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const notifId = pathname.replace('/api/v1/nexus/admin/notifications/', '').replace('/read', '');
        const marked = await nexusDb.markNotificationRead(session.userId, notifId);
        if (!marked) {
            sendJSON(res, 404, { success: false, error: 'Notification not found.' });
            return;
        }
        sendJSON(res, 200, { success: true, message: 'Notification marked as read.' });
        return;
    }

    // Admin Broadcast Announcement
    if (req.method === 'POST' && pathname === '/api/v1/nexus/admin/announcements') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const body = await parseBody(req);
        const result = await nexusNotificationService.broadcastAnnouncement({
            title: body.title,
            content: body.content,
            priority: body.priority || 'normal',
            targetAudience: body.target_audience || body.targetAudience || 'all',
            authorId: session.userId
        });
        sendJSON(res, result.success ? 201 : 400, result);
        return;
    }

    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/announcements') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const audience = parsedUrl.searchParams.get('audience');
        const result = await nexusDb.getAnnouncements({ audience, activeOnly: false });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // =========================================================================
    // ADMIN SUPPORT DESK & TICKET RESOLUTION (Prompt 17)
    // =========================================================================
    // Support Desk KPI Stats
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/support/stats') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const stats = await nexusDb.getSupportStats();
        sendJSON(res, 200, { success: true, stats });
        return;
    }

    // Support Categories List & Create
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/support/categories') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const categories = await nexusDb.getSupportCategories();
        sendJSON(res, 200, { success: true, categories });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/v1/nexus/admin/support/categories') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const body = await parseBody(req);
        if (!body.name || !body.code) {
            sendJSON(res, 400, { success: false, error: 'Category name and code are required.' });
            return;
        }
        const created = await nexusDb.createSupportCategory(body);
        sendJSON(res, 201, { success: true, category: created });
        return;
    }

    // Admin Support Tickets List
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/support/tickets') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const status = parsedUrl.searchParams.get('status');
        const priority = parsedUrl.searchParams.get('priority');
        const category = parsedUrl.searchParams.get('category');
        const assignedAdminId = parsedUrl.searchParams.get('assigned_admin_id');
        const search = parsedUrl.searchParams.get('search');
        const startDate = parsedUrl.searchParams.get('start_date');
        const endDate = parsedUrl.searchParams.get('end_date');
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 50;
        const offset = parseInt(parsedUrl.searchParams.get('offset'), 10) || 0;

        const result = await nexusDb.getSupportTickets({
            status,
            priority,
            category,
            assignedAdminId,
            search,
            startDate,
            endDate,
            limit,
            offset
        });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Admin CSV Export of Tickets
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/support/export') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const status = parsedUrl.searchParams.get('status');
        const priority = parsedUrl.searchParams.get('priority');
        const category = parsedUrl.searchParams.get('category');
        const search = parsedUrl.searchParams.get('search');

        try {
            const csv = await nexusSupportService.exportTicketsCsv({ status, priority, category, search });
            const filename = `nexus_support_tickets_${new Date().toISOString().split('T')[0]}.csv`;
            res.writeHead(200, {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`
            });
            res.end(csv);
        } catch (err) {
            sendJSON(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // Admin Single Ticket Detail
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/support/tickets/') &&
        !pathname.endsWith('/reply') && !pathname.endsWith('/status') && 
        !pathname.endsWith('/priority') && !pathname.endsWith('/assign') && !pathname.endsWith('/reopen')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const ticketId = pathname.replace('/api/v1/nexus/admin/support/tickets/', '');
        const ticket = await nexusSupportService.getTicketDetails(ticketId, { id: session.userId }, true);
        if (!ticket) {
            sendJSON(res, 404, { success: false, error: 'Support ticket not found.' });
            return;
        }
        sendJSON(res, 200, { success: true, ticket });
        return;
    }

    // Admin Add Reply / Internal Note
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/support/tickets/') && pathname.endsWith('/reply')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const ticketId = pathname.replace('/api/v1/nexus/admin/support/tickets/', '').replace('/reply', '');
        const body = await parseBody(req);
        const result = await nexusSupportService.addMessage({
            ticketId: ticketId,
            senderType: 'admin',
            senderId: session.userId,
            message: body.message,
            isInternal: !!body.is_internal,
            attachments: body.attachments
        });
        sendJSON(res, result.success ? 200 : 400, result);
        return;
    }

    // Admin Update Status
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/support/tickets/') && pathname.endsWith('/status')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const ticketId = pathname.replace('/api/v1/nexus/admin/support/tickets/', '').replace('/status', '');
        const body = await parseBody(req);
        const result = await nexusSupportService.updateStatus(ticketId, body.status, session.userId, true);
        sendJSON(res, result.success ? 200 : 400, result);
        return;
    }

    // Admin Update Priority
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/support/tickets/') && pathname.endsWith('/priority')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const ticketId = pathname.replace('/api/v1/nexus/admin/support/tickets/', '').replace('/priority', '');
        const body = await parseBody(req);
        const result = await nexusSupportService.updatePriority(ticketId, body.priority, session.userId);
        sendJSON(res, result.success ? 200 : 400, result);
        return;
    }

    // Admin Assign Ticket
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/support/tickets/') && pathname.endsWith('/assign')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const ticketId = pathname.replace('/api/v1/nexus/admin/support/tickets/', '').replace('/assign', '');
        const body = await parseBody(req);
        const assignTo = body.assigned_admin_id !== undefined ? body.assigned_admin_id : body.adminId;
        const result = await nexusSupportService.assignTicket(ticketId, assignTo, session.userId);
        sendJSON(res, result.success ? 200 : 400, result);
        return;
    }

    // Admin Reopen Ticket
    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/support/tickets/') && pathname.endsWith('/reopen')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const ticketId = pathname.replace('/api/v1/nexus/admin/support/tickets/', '').replace('/reopen', '');
        const body = await parseBody(req);
        const result = await nexusSupportService.reopenTicket(ticketId, session.userId, body.reason);
        sendJSON(res, result.success ? 200 : 400, result);
        return;
    }

    // =========================================================================
    // ADMIN MEMBER COMPLIANCE & VERIFICATION REVIEW (KYC Pipeline)
    // =========================================================================
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/verification') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const status = parsedUrl.searchParams.get('status');
        let profiles = [...nexusDb.memberProfiles];
        if (status && status !== 'all') {
            profiles = profiles.filter(p => p.verification_status === status);
        }
        const verifications = profiles.map(p => ({
            userId: p.user_id,
            memberId: p.member_id,
            fullName: p.full_name,
            verificationStatus: p.verification_status || 'unverified',
            verifiedAt: p.verified_at || null,
            verifiedBy: p.verified_by || null,
            notes: p.verification_notes || null,
            idDocumentUrl: p.id_document_url || null,
            addressDocumentUrl: p.address_document_url || null,
            updatedAt: p.verification_updated_at || p.updated_at
        }));
        sendJSON(res, 200, { success: true, count: verifications.length, verifications });
        return;
    }

    if (req.method === 'PUT' && pathname.startsWith('/api/v1/nexus/admin/verification/')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const targetUserId = pathname.replace('/api/v1/nexus/admin/verification/', '');
        const body = await parseBody(req);
        const newStatus = body.verification_status || body.status;
        if (!['unverified', 'pending', 'verified', 'rejected'].includes(newStatus)) {
            sendJSON(res, 400, { success: false, error: 'Invalid verification status.' });
            return;
        }

        const updated = await nexusDb.updateMemberVerification(targetUserId, {
            verification_status: newStatus,
            verified_by: session.userId,
            verification_notes: body.notes || body.reason
        });

        if (!updated) {
            sendJSON(res, 404, { success: false, error: 'Member not found.' });
            return;
        }

        if (newStatus === 'verified') {
            await nexusNotificationService.emit('kyc_verified', {
                recipient_id: targetUserId,
                reference_type: 'kyc',
                reference_id: targetUserId,
                action_url: '/dashboard#profile'
            });
        } else if (newStatus === 'rejected') {
            await nexusNotificationService.emit('kyc_rejected', {
                recipient_id: targetUserId,
                reference_type: 'kyc',
                reference_id: targetUserId,
                variables: { reason: body.notes || 'Document verification failed.' },
                action_url: '/dashboard#profile'
            });
        }

        sendJSON(res, 200, { success: true, message: `Member verification status set to ${newStatus}.`, verification: updated });
        return;
    }

    // Admin KYC KPI Stats (Prompt 18)
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/kyc/stats') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const stats = await nexusKycService.getKycStats();
        sendJSON(res, 200, { success: true, stats });
        return;
    }

    // Admin KYC Submissions Directory
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/kyc/submissions') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const status = parsedUrl.searchParams.get('status');
        const level = parsedUrl.searchParams.get('level');
        const search = parsedUrl.searchParams.get('search');
        const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 50;
        const offset = parseInt(parsedUrl.searchParams.get('offset'), 10) || 0;

        const result = await nexusDb.getKycSubmissions({ status, level, search, limit, offset });
        sendJSON(res, 200, { success: true, ...result });
        return;
    }

    // Admin Single KYC Submission Detail & Document Review
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/kyc/submissions/') &&
        !pathname.endsWith('/approve') && !pathname.endsWith('/reject') && 
        !pathname.endsWith('/request-changes') && !pathname.endsWith('/start-review')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const submissionId = pathname.replace('/api/v1/nexus/admin/kyc/submissions/', '');
        const sub = await nexusDb.getKycSubmissionById(submissionId);
        if (!sub) {
            sendJSON(res, 404, { success: false, error: 'KYC submission not found.' });
            return;
        }

        const memberProfile = await nexusDb.findProfileByUserId(sub.member_id);
        const memberUser = await nexusDb.findUserById(sub.member_id);
        const documents = await nexusDb.getKycDocumentsBySubmissionId(sub.id);
        const events = await nexusDb.getKycReviewEvents(sub.id);

        sendJSON(res, 200, {
            success: true,
            submission: sub,
            member: {
                userId: sub.member_id,
                memberId: memberProfile ? memberProfile.member_id : sub.member_id,
                fullName: memberProfile ? memberProfile.full_name : sub.legal_name,
                email: memberUser ? memberUser.email : '',
                accountStatus: memberProfile ? memberProfile.status : 'active',
                rank: memberProfile ? memberProfile.rank : 'MEMBER'
            },
            documents,
            reviewEvents: events
        });
        return;
    }

    // Admin Start Review on Submission
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/kyc/submissions/') && pathname.endsWith('/start-review')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const submissionId = pathname.replace('/api/v1/nexus/admin/kyc/submissions/', '').replace('/start-review', '');
        const result = await nexusKycService.startReview(submissionId, session.userId);
        sendJSON(res, result.success ? 200 : 400, result);
        return;
    }

    // Admin Approve Submission
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/kyc/submissions/') && pathname.endsWith('/approve')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const submissionId = pathname.replace('/api/v1/nexus/admin/kyc/submissions/', '').replace('/approve', '');
        const body = await parseBody(req);
        const result = await nexusKycService.approveKyc(submissionId, session.userId, body.notes);
        sendJSON(res, result.success ? 200 : 400, result);
        return;
    }

    // Admin Reject Submission
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/kyc/submissions/') && pathname.endsWith('/reject')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const submissionId = pathname.replace('/api/v1/nexus/admin/kyc/submissions/', '').replace('/reject', '');
        const body = await parseBody(req);
        const result = await nexusKycService.rejectKyc(submissionId, session.userId, body.reason || body.notes);
        sendJSON(res, result.success ? 200 : 400, result);
        return;
    }

    // Admin Request Changes on Submission
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/kyc/submissions/') && pathname.endsWith('/request-changes')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const submissionId = pathname.replace('/api/v1/nexus/admin/kyc/submissions/', '').replace('/request-changes', '');
        const body = await parseBody(req);
        const result = await nexusKycService.requestChanges(submissionId, session.userId, body.reason || body.notes);
        sendJSON(res, result.success ? 200 : 400, result);
        return;
    }

    // Admin Secure Document Access URL (HMAC Signed)
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/kyc/documents/') && pathname.endsWith('/access')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const docId = pathname.replace('/api/v1/nexus/admin/kyc/documents/', '').replace('/access', '');
        const result = await nexusKycService.getSecureDocumentAccessUrl(docId, { id: session.userId }, true);
        sendJSON(res, result.success ? 200 : 404, result);
        return;
    }

    // Ephemeral Signed Token Private Document Streaming
    if (req.method === 'GET' && pathname === '/api/v1/nexus/kyc/documents/stream') {
        const token = parsedUrl.searchParams.get('token');
        const session = authenticateRequest(req);
        if (!session) {
            sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
            return;
        }

        const validDocId = nexusKycService.validateDocumentToken(token, session.userId);
        if (!validDocId) {
            sendJSON(res, 403, { success: false, error: 'Invalid or expired document access token.' });
            return;
        }

        const doc = await nexusDb.getKycDocumentById(validDocId);
        if (!doc) {
            sendJSON(res, 404, { success: false, error: 'Document not found.' });
            return;
        }

        // Return secure preview payload
        sendJSON(res, 200, {
            success: true,
            document: {
                id: doc.id,
                documentType: doc.document_type,
                documentSide: doc.document_side,
                fileName: doc.file_name,
                mimeType: doc.mime_type,
                maskedNumber: doc.document_number_masked,
                status: doc.document_status,
                issuingCountry: doc.issuing_country
            },
            message: 'Secure token verified. Private document view granted.'
        });
        return;
    }

    // =========================================================================
    // ADMIN MEMBERSHIP & ELIGIBILITY ENGINE (Prompt 19)
    // =========================================================================

    // Admin Membership & Eligibility Stats
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/eligibility/stats') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const stats = await nexusDb.getMembershipStats();
        sendJSON(res, 200, { success: true, stats });
        return;
    }

    // Admin Membership & Eligibility Rules Configuration
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/eligibility/rules') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const activationRules = await nexusDb.getActivationRules();
        const eligibilityRules = await nexusDb.getEligibilityRules();
        sendJSON(res, 200, { success: true, activationRules, eligibilityRules });
        return;
    }

    // Admin Membership & Eligibility Directory (Filterable & Paginated)
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/eligibility/directory') {
        const session = requireAdmin(req, res);
        if (!session) return;

        const q = (parsedUrl.searchParams.get('q') || '').toLowerCase().trim();
        const accountStatusFilter = parsedUrl.searchParams.get('account_status') || '';
        const membershipStatusFilter = parsedUrl.searchParams.get('membership_status') || '';
        const kycStatusFilter = parsedUrl.searchParams.get('kyc_status') || '';
        const mlmEligibleFilter = parsedUrl.searchParams.get('mlm_eligible');
        const commissionEligibleFilter = parsedUrl.searchParams.get('commission_eligible');
        const withdrawalEligibleFilter = parsedUrl.searchParams.get('withdrawal_eligible');
        const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
        const limit = parseInt(parsedUrl.searchParams.get('limit') || '20', 10);

        const allProfiles = nexusDb.memberProfiles || [];
        const results = [];

        for (const prof of allProfiles) {
            const user = (nexusDb.users || []).find(u => u.id === prof.user_id);
            if (!user) continue;

            const membership = (nexusDb.memberships || []).find(m => m.member_id === prof.user_id) || {
                status: 'not_activated',
                package_name: prof.package_status || 'None',
                activated_at: null,
                expires_at: null
            };

            const kycStatus = prof.verification_status || 'not_started';
            const accountStatus = prof.status || 'pending';
            const membershipStatus = membership.status || 'not_activated';

            // Filter checks
            if (accountStatusFilter && accountStatus !== accountStatusFilter) continue;
            if (membershipStatusFilter && membershipStatus !== membershipStatusFilter) continue;
            if (kycStatusFilter && kycStatus !== kycStatusFilter) continue;

            if (q) {
                const matchName = (prof.full_name || '').toLowerCase().includes(q);
                const matchEmail = (user.email || '').toLowerCase().includes(q);
                const matchCode = (prof.referral_code || '').toLowerCase().includes(q);
                if (!matchName && !matchEmail && !matchCode) continue;
            }

            const isMlmEligible = accountStatus === 'active' && membershipStatus === 'active';
            const isCommEligible = isMlmEligible;
            const isWithEligible = accountStatus === 'active' && (!Boolean(nexusDb.settings.get('kyc_required_for_withdrawal') === 'true') || kycStatus === 'verified');

            if (mlmEligibleFilter !== null && mlmEligibleFilter !== undefined && mlmEligibleFilter !== '') {
                if (String(isMlmEligible) !== mlmEligibleFilter) continue;
            }
            if (commissionEligibleFilter !== null && commissionEligibleFilter !== undefined && commissionEligibleFilter !== '') {
                if (String(isCommEligible) !== commissionEligibleFilter) continue;
            }
            if (withdrawalEligibleFilter !== null && withdrawalEligibleFilter !== undefined && withdrawalEligibleFilter !== '') {
                if (String(isWithEligible) !== withdrawalEligibleFilter) continue;
            }

            results.push({
                member_id: prof.user_id,
                full_name: prof.full_name || 'Member',
                email: user.email,
                referral_code: prof.referral_code || 'N/A',
                account_status: accountStatus,
                membership_status: membershipStatus,
                kyc_status: kycStatus,
                package_name: membership.package_name || prof.package_status || 'None',
                activated_at: membership.activated_at,
                expires_at: membership.expires_at,
                mlm_eligible: isMlmEligible,
                commission_eligible: isCommEligible,
                withdrawal_eligible: isWithEligible,
                rank: prof.rank || 'MEMBER'
            });
        }

        const total = results.length;
        const startIndex = (page - 1) * limit;
        const paginated = results.slice(startIndex, startIndex + limit);

        sendJSON(res, 200, {
            success: true,
            total,
            page,
            limit,
            members: paginated
        });
        return;
    }

    // Admin Member Membership Dossier
    if (req.method === 'GET' && pathname.startsWith('/api/v1/nexus/admin/members/') && pathname.endsWith('/membership')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const memberId = pathname.replace('/api/v1/nexus/admin/members/', '').replace('/membership', '');
        const data = await nexusMembershipService.getMembership(memberId);
        if (!data) {
            sendJSON(res, 404, { success: false, error: 'Member not found.' });
            return;
        }
        const eligibility = await nexusEligibilityEngine.evaluateMemberEligibility(memberId);
        sendJSON(res, 200, {
            success: true,
            ...data,
            eligibility
        });
        return;
    }

    // Admin Manual Membership Action
    if (req.method === 'POST' && pathname.startsWith('/api/v1/nexus/admin/members/') && pathname.endsWith('/membership/action')) {
        const session = requireAdmin(req, res);
        if (!session) return;
        const memberId = pathname.replace('/api/v1/nexus/admin/members/', '').replace('/membership/action', '');
        const body = await parseBody(req);
        const result = await nexusMembershipService.manualAdminAction({
            memberId,
            action: body.action,
            adminUserId: session.userId,
            reason: body.reason,
            expiresAt: body.expires_at || body.expiresAt,
            packageId: body.package_id || body.packageId,
            notes: body.notes
        });
        sendJSON(res, result.success ? 200 : 400, result);
        return;
    }

    // Admin Membership Reconciliation Scanner Report
    if (req.method === 'GET' && pathname === '/api/v1/nexus/admin/reports/membership-reconciliation') {
        const session = requireAdmin(req, res);
        if (!session) return;
        const issues = await nexusDb.getMembershipReconciliationIssues();
        sendJSON(res, 200, {
            success: true,
            scanned_at: new Date().toISOString(),
            total_issues: issues.length,
            issues
        });
        return;
    }

    let cleanPath = pathname;

    if (cleanPath.startsWith('/products/') || cleanPath.startsWith('/packages/')) {
        cleanPath = '/nexus_index.html';
    }

    // 1. Public Routes
    if (cleanPath === '/' || cleanPath === '/nexus' || 
        cleanPath === '/about' || cleanPath === '/how-it-works' || 
        cleanPath === '/opportunity' || cleanPath === '/packages' || 
        cleanPath === '/products' || cleanPath === '/faq' || 
        cleanPath === '/contact' || cleanPath === '/privacy' || 
        cleanPath === '/terms' || cleanPath === '/network-marketing') {
        cleanPath = '/nexus_index.html';
    } 
    // 2. Authentication Routes
    else if (cleanPath === '/register') {
        cleanPath = '/nexus_register.html';
    } else if (cleanPath === '/login') {
        cleanPath = '/nexus_login.html';
    } else if (cleanPath === '/forgot-password') {
        cleanPath = '/nexus_forgot_password.html';
    } 
    // 3. Admin Application Routes
    else if (cleanPath === '/admin' || cleanPath.startsWith('/admin/')) {
        cleanPath = '/nexus_admin.html';
    } 
    // 4. Member Protected Application Routes
    else if (cleanPath === '/dashboard' || cleanPath.startsWith('/dashboard/') ||
             cleanPath === '/profile' || cleanPath === '/network' || cleanPath === '/team' || 
             cleanPath === '/wallet' || cleanPath === '/transactions' || 
             cleanPath === '/commissions' || cleanPath === '/withdrawals' || cleanPath === '/rank' || 
             cleanPath === '/my-packages' || cleanPath === '/orders' || cleanPath.startsWith('/orders/') ||
             cleanPath === '/payments' || cleanPath.startsWith('/payments/') || cleanPath === '/payment-result' ||
             cleanPath === '/notifications' || cleanPath === '/support' || 
             cleanPath === '/verification' || cleanPath === '/dashboard/verification' ||
             cleanPath === '/membership' || cleanPath === '/dashboard/membership' ||
             cleanPath === '/eligibility' || cleanPath === '/dashboard/eligibility' ||
             cleanPath === '/settings') {
        cleanPath = '/nexus_dashboard.html';
    } else if (cleanPath === '/referrals') {
        cleanPath = '/nexus_referrals.html';
    } else if (!path.extname(cleanPath)) {
        cleanPath += '.html';
    }

    // Disallow directory traversal & sensitive files
    const rootDir = path.resolve(__dirname, '..');
    const filePath = path.normalize(path.join(rootDir, cleanPath));

    if (!filePath.startsWith(rootDir) || 
        cleanPath.includes('.env') || 
        cleanPath.includes('.git') || 
        cleanPath.includes('/services/') ||
        cleanPath.endsWith('.sql')) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h1>404 Not Found - ${NexusConfig.COMPANY_NAME}</h1><p>The requested page does not exist on ${NexusConfig.DOMAIN}.</p>`);
        } else {
            const ext = String(path.extname(filePath)).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
};

const server = http.createServer(requestHandler);

if (require.main === module) {
    server.listen(NexusConfig.PORT, () => {
        console.log(`🚀 ${NexusConfig.COMPANY_NAME} Server running at http://localhost:${NexusConfig.PORT}/`);
        console.log(`🌐 Target Domain: ${NexusConfig.DOMAIN}`);
    });
}

function resetRateLimits() {
    ipRequestCounts.clear();
}

module.exports = { server, requestHandler, resetRateLimits };
