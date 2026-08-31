const http = require('http');
const fs = require('fs');
const path = require('path');
const AuthService = require('./services/auth-service');
const PlacementEngine = require('./services/placement-engine');

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

        // Validations
        if (!fullName || !username || !email || !mobile || !password || !dob || !address || !nicPassport || !sponsorCode || !position) {
            sendJSON(res, 400, { error: 'All registration fields are required.' });
            return;
        }

        if (position !== 'LEFT' && position !== 'RIGHT') {
            sendJSON(res, 400, { error: 'Placement position must be LEFT or RIGHT.' });
            return;
        }

        // Simulate Database Transactions/Checks
        // (In Phase 4/Supabase integrations these query PostgreSQL tables)
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

        // Mock Sponsor Lookups
        const validSponsors = ['admin', 'sponsor1'];
        if (!validSponsors.includes(sponsorCode)) {
            sendJSON(res, 400, { error: 'Invalid or non-existent sponsor referral code.' });
            return;
        }

        // Successful registration response
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

        // Simple validation checks for Mock database (Admin credentials default check)
        const adminEmail = 'admin@hapanamy.lk';
        const adminHash = '$2y$10$TKh8H1.PfQx37YgCzwiKb.KjNyWgpVM9ku71yqS8vW1g8Yt4a7X9.'; // hash of Araliya321#

        if (email === adminEmail && password === 'Araliya321#') {
            const token = AuthService.generateToken();
            activeSessions.set(token, { email, role: 'admin' });
            sendJSON(res, 200, { success: true, token, user: { email, role: 'admin' } });
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
    // STATIC ASSET SERVING
    // ========================================================
    let safeUrl = pathname;
    let filePath = path.join(__dirname, safeUrl === '/' ? 'index.html' : safeUrl);
    
    if (!filePath.startsWith(__dirname)) {
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
