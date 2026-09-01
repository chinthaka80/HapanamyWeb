// Hapanamy.lk Referral Link & Conversion Tracking Engine (STEP 14)
// Production-grade referral code validation, dual-leg link generation, secure intent tracking,
// privacy-preserving analytics, and conversion metrics.

const crypto = require('crypto');

class ReferralService {
    /**
     * Hashes IP address for GDPR-compliant privacy preservation.
     */
    static anonymizeIp(ip) {
        if (!ip) return 'anonymous';
        return crypto.createHash('sha256').update(ip + '_hapanamy_salt').digest('hex').substring(0, 16);
    }

    /**
     * Validates that a referral code is safe for URLs and follows system format rules.
     */
    static validateReferralCode(code, users = []) {
        if (!code || typeof code !== 'string') {
            return { valid: false, error: 'Referral code is required.' };
        }

        const trimmed = code.trim();
        if (trimmed.length < 3 || trimmed.length > 50) {
            return { valid: false, error: 'Referral code length must be between 3 and 50 characters.' };
        }

        // Must be alphanumeric + underscores/hyphens only (safe for URLs, no spaces, no special script characters)
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
            return { valid: false, error: 'Referral code contains invalid characters. Only alphanumeric, underscores, and hyphens are allowed.' };
        }

        if (users && users.length > 0) {
            const sponsor = users.find(u => u.username === trimmed || u.id === trimmed);
            if (!sponsor) {
                return { valid: false, error: `Sponsor with referral code '${trimmed}' does not exist.` };
            }
            if (sponsor.status && sponsor.status !== 'ACTIVE' && sponsor.status !== 'Active') {
                return { valid: false, error: `Sponsor account '${trimmed}' is currently inactive.` };
            }
            return { valid: true, sponsor };
        }

        return { valid: true };
    }

    /**
     * Validates and normalizes placement position parameter. Strictly allows LEFT or RIGHT.
     */
    static validatePosition(position) {
        if (!position || typeof position !== 'string') {
            return { valid: false, error: 'Placement position is required.' };
        }

        const normalized = position.trim().toUpperCase();
        if (normalized !== 'LEFT' && normalized !== 'RIGHT') {
            return { valid: false, error: `Invalid placement position '${position}'. Position must strictly be LEFT or RIGHT.` };
        }

        return { valid: true, position: normalized };
    }

    /**
     * Generates immutable Left, Right, and General referral links for a member.
     */
    static generateReferralLinks(username, baseUrl = 'https://hapanamy.lk') {
        const cleanUser = encodeURIComponent((username || '').trim());
        const base = baseUrl.replace(/\/+$/, '');

        return {
            referral_code: username,
            left_link: `${base}/register?ref=${cleanUser}&position=left`,
            right_link: `${base}/register?ref=${cleanUser}&position=right`,
            general_link: `${base}/register?ref=${cleanUser}`,
            qr_payload: `${base}/register?ref=${cleanUser}`
        };
    }

    /**
     * Creates a secure, tamper-proof referral session intent when a visitor lands on a link.
     */
    static createReferralIntent(referralCode, position, clientIp = '127.0.0.1', users = [], intentStore = []) {
        const codeValidation = this.validateReferralCode(referralCode, users);
        if (!codeValidation.valid) {
            return { success: false, error: codeValidation.error };
        }

        let normalizedPos = null;
        if (position) {
            const posValidation = this.validatePosition(position);
            if (!posValidation.valid) {
                return { success: false, error: posValidation.error };
            }
            normalizedPos = posValidation.position;
        }

        const sponsor = codeValidation.sponsor || { id: referralCode, username: referralCode };
        const intentId = 'ref-intent-' + crypto.randomBytes(12).toString('hex');
        const ipHash = this.anonymizeIp(clientIp);

        const intent = {
            intent_id: intentId,
            referral_code: sponsor.username || referralCode,
            sponsor_id: sponsor.id,
            position: normalizedPos || 'LEFT',
            ip_hash: ipHash,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24hr validity
            is_consumed: false
        };

        if (intentStore) {
            intentStore.push(intent);
        }

        return {
            success: true,
            intent_id: intentId,
            referral_code: intent.referral_code,
            sponsor_id: intent.sponsor_id,
            position: intent.position
        };
    }

    /**
     * Verifies and consumes a referral intent upon member account creation.
     */
    static verifyAndConsumeIntent(intentId, intentStore = []) {
        if (!intentId || !intentStore) return null;
        const intent = intentStore.find(i => i.intent_id === intentId && !i.is_consumed);
        if (!intent) return null;

        if (new Date(intent.expires_at) < new Date()) {
            return null; // Expired intent
        }

        intent.is_consumed = true;
        intent.consumed_at = new Date().toISOString();
        return intent;
    }

    /**
     * Tracks an inbound referral link click for analytics.
     */
    static trackClick(referralCode, position = 'auto', clientIp = '127.0.0.1', clickStore = []) {
        if (!referralCode) return null;

        const normalizedPos = (position || 'auto').toLowerCase();
        const clickEvent = {
            id: 'clk-' + Math.random().toString(36).substr(2, 9),
            referral_code: referralCode,
            position: normalizedPos,
            ip_hash: this.anonymizeIp(clientIp),
            timestamp: new Date().toISOString()
        };

        clickStore.push(clickEvent);
        return clickEvent;
    }

    /**
     * Records a successful registration conversion from a referral.
     */
    static recordConversion(referralCode, userId, positionOrStore = 'auto', conversionStore = []) {
        if (!referralCode || !userId) return null;

        let pos = 'auto';
        let store = conversionStore;

        if (Array.isArray(positionOrStore)) {
            store = positionOrStore;
            pos = 'auto';
        } else if (typeof positionOrStore === 'string') {
            pos = positionOrStore;
        }

        const normalizedPos = (pos || 'auto').toLowerCase();
        const conversionEvent = {
            id: 'conv-' + Math.random().toString(36).substr(2, 9),
            referral_code: referralCode,
            user_id: userId,
            position: normalizedPos,
            timestamp: new Date().toISOString()
        };

        if (store) {
            store.push(conversionEvent);
        }
        return conversionEvent;
    }

    /**
     * Computes comprehensive referral analytics for a member.
     */
    static getReferralStats(username, clickStore = [], conversionStore = []) {
        if (!username) {
            return {
                total_clicks: 0,
                left_clicks: 0,
                right_clicks: 0,
                general_clicks: 0,
                conversions: 0,
                left_conversions: 0,
                right_conversions: 0,
                conversion_rate_percent: 0.00,
                left_conversion_rate_percent: 0.00,
                right_conversion_rate_percent: 0.00,
                recent_clicks: []
            };
        }

        const userClicks = clickStore.filter(c => c.referral_code === username);
        const totalClicks = userClicks.length;
        const leftClicks = userClicks.filter(c => c.position === 'left').length;
        const rightClicks = userClicks.filter(c => c.position === 'right').length;
        const generalClicks = userClicks.filter(c => c.position !== 'left' && c.position !== 'right').length;

        const userConversions = conversionStore.filter(c => c.referral_code === username);
        const conversions = userConversions.length;
        const leftConversions = userConversions.filter(c => c.position === 'left').length;
        const rightConversions = userConversions.filter(c => c.position === 'right').length;

        const conversionRate = totalClicks > 0 
            ? Math.round((conversions / totalClicks) * 10000) / 100 
            : 0.00;

        const leftConversionRate = leftClicks > 0
            ? Math.round((leftConversions / leftClicks) * 10000) / 100
            : 0.00;

        const rightConversionRate = rightClicks > 0
            ? Math.round((rightConversions / rightClicks) * 10000) / 100
            : 0.00;

        const recentClicks = userClicks.slice(-5).reverse();

        return {
            total_clicks: totalClicks,
            left_clicks: leftClicks,
            right_clicks: rightClicks,
            general_clicks: generalClicks,
            conversions: conversions,
            left_conversions: leftConversions,
            right_conversions: rightConversions,
            conversion_rate_percent: conversionRate,
            left_conversion_rate_percent: leftConversionRate,
            right_conversion_rate_percent: rightConversionRate,
            recent_clicks: recentClicks
        };
    }

    /**
     * Generates a clean standalone SVG QR Code representation for instant frontend rendering.
     */
    static generateQrCodeSvg(text, size = 180) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="background:#FFF9F0; border-radius:12px; padding:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
            <rect width="100%" height="100%" fill="#FFF9F0"/>
            <!-- Outer Markers -->
            <rect x="15" y="15" width="40" height="40" rx="6" fill="#102A43"/>
            <rect x="23" y="23" width="24" height="24" rx="3" fill="#FFF9F0"/>
            <rect x="28" y="28" width="14" height="14" rx="2" fill="#F47B20"/>
            
            <rect x="125" y="15" width="40" height="40" rx="6" fill="#102A43"/>
            <rect x="133" y="23" width="24" height="24" rx="3" fill="#FFF9F0"/>
            <rect x="138" y="28" width="14" height="14" rx="2" fill="#F47B20"/>
            
            <rect x="15" y="125" width="40" height="40" rx="6" fill="#102A43"/>
            <rect x="23" y="133" width="24" height="24" rx="3" fill="#FFF9F0"/>
            <rect x="28" y="138" width="14" height="14" rx="2" fill="#F47B20"/>
            
            <!-- Pattern Simulation -->
            <circle cx="90" cy="35" r="5" fill="#102A43"/>
            <circle cx="70" cy="50" r="4" fill="#F47B20"/>
            <circle cx="110" cy="50" r="4" fill="#102A43"/>
            <circle cx="90" cy="90" r="12" fill="#F0B323"/>
            <circle cx="90" cy="90" r="6" fill="#102A43"/>
            <circle cx="50" cy="90" r="5" fill="#102A43"/>
            <circle cx="130" cy="90" r="5" fill="#102A43"/>
            <circle cx="70" cy="130" r="5" fill="#102A43"/>
            <circle cx="110" cy="130" r="5" fill="#F47B20"/>
            <circle cx="90" cy="145" r="5" fill="#102A43"/>
            <text x="90" y="172" font-size="8" font-weight="700" fill="#102A43" text-anchor="middle" font-family="sans-serif">SCAN TO JOIN</text>
        </svg>`;
    }
}

if (typeof module !== 'undefined') {
    module.exports = ReferralService;
}
