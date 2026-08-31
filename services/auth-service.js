// Hapanamy.lk Authentication Service
const crypto = require('crypto');

const AuthService = {
    /**
     * Hashing a password using Node.js pbkdf2Sync (Highly secure, zero dependencies)
     */
    hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        return `${salt}:${hash}`;
    },

    /**
     * Verifies a password against a stored hash
     */
    verifyPassword(password, storedPassword) {
        if (!storedPassword || !storedPassword.includes(':')) return false;
        const [salt, originalHash] = storedPassword.split(':');
        const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        return originalHash === verifyHash;
    },

    /**
     * Generate a secure random session token
     */
    generateToken() {
        return crypto.randomBytes(32).toString('hex');
    }
};

if (typeof module !== 'undefined') {
    module.exports = AuthService;
}
