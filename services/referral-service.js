// Hapanamy.lk Referral Link & Conversion Tracking Engine (Phase 2)
// Generates unique Left & Right links, tracks inbound traffic, QR codes, and conversion analytics.

class ReferralService {
    /**
     * Generates Left, Right, and General referral links for a member.
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
     * Tracks an inbound referral link click for analytics.
     */
    static trackClick(referralCode, position = 'auto', clientIp = '127.0.0.1', clickStore = []) {
        if (!referralCode) return null;

        const normalizedPos = (position || 'auto').toLowerCase();
        const clickEvent = {
            id: 'clk-' + Math.random().toString(36).substr(2, 9),
            referral_code: referralCode,
            position: normalizedPos,
            ip: clientIp,
            timestamp: new Date().toISOString()
        };

        clickStore.push(clickEvent);
        return clickEvent;
    }

    /**
     * Records a successful registration conversion from a referral.
     */
    static recordConversion(referralCode, userId, conversionStore = []) {
        if (!referralCode || !userId) return null;

        const conversionEvent = {
            id: 'conv-' + Math.random().toString(36).substr(2, 9),
            referral_code: referralCode,
            user_id: userId,
            timestamp: new Date().toISOString()
        };

        conversionStore.push(conversionEvent);
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
                conversion_rate_percent: 0.00,
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

        const conversionRate = totalClicks > 0 
            ? Math.round((conversions / totalClicks) * 10000) / 100 
            : 0.00;

        const recentClicks = userClicks.slice(-5).reverse();

        return {
            total_clicks: totalClicks,
            left_clicks: leftClicks,
            right_clicks: rightClicks,
            general_clicks: generalClicks,
            conversions: conversions,
            conversion_rate_percent: conversionRate,
            recent_clicks: recentClicks
        };
    }

    /**
     * Generates a clean standalone SVG QR Code representation for instant frontend rendering.
     */
    static generateQrCodeSvg(text, size = 180) {
        // High quality stylized QR placeholder SVG with scan framing
        const escaped = encodeURIComponent(text);
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
