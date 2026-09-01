/**
 * HAPANAMY.LK — Centralized Google AdSense Monetization & Ad Placement Engine
 * Phase 2, 6, 7, 8, 9, 12, 13
 * 
 * Instructions:
 * Replace 'ca-pub-YOUR_ADSENSE_PUBLISHER_ID' with your verified Google AdSense Publisher ID
 * once site review is approved.
 */

(function(window) {
    'use strict';

    const HAPANAMY_ADSENSE_CONFIG = {
        // Replace with your real Google AdSense Publisher ID (e.g., 'ca-pub-1234567890123456')
        publisherId: 'ca-pub-YOUR_ADSENSE_PUBLISHER_ID',
        
        // Master switch: Set to true once AdSense account is approved and publisher ID is set
        enabled: true,

        // Test mode: Renders clean, labeled publisher placeholder boxes when real ads are not yet live
        testMode: true,

        // Ad Unit Configuration
        units: {
            TOP_CONTENT_AD: { slot: '1001', format: 'auto', fullWidthResponsive: true },
            ARTICLE_MIDDLE_AD: { slot: '1002', format: 'auto', fullWidthResponsive: true },
            CONTENT_BOTTOM_AD: { slot: '1003', format: 'auto', fullWidthResponsive: true },
            SIDEBAR_AD: { slot: '1004', format: 'vertical', fullWidthResponsive: true },
            MOBILE_INLINE_AD: { slot: '1005', format: 'rectangle', fullWidthResponsive: true }
        },

        // Pages where advertising is strictly FORBIDDEN (Security & Privacy Isolation)
        blockedPages: [
            '/login',
            '/login.html',
            '/register',
            '/register.html',
            '/dashboard',
            '/dashboard.html',
            '/hapanamy-admin-portal-9226.html',
            '/admin',
            '/checkout',
            '/checkout.html',
            '/student-dashboard',
            '/student-dashboard.html',
            '/my-account',
            '/my-account.html'
        ]
    };

    /**
     * Checks if current URL path is eligible for AdSense advertisements.
     */
    function isEligiblePage(customPath) {
        let path = '';
        if (customPath) {
            path = customPath.toLowerCase();
        } else if (typeof window !== 'undefined' && window.location && window.location.pathname) {
            path = window.location.pathname.toLowerCase();
        } else if (typeof global !== 'undefined' && global.window && global.window.location && global.window.location.pathname) {
            path = global.window.location.pathname.toLowerCase();
        }
        for (const blocked of HAPANAMY_ADSENSE_CONFIG.blockedPages) {
            if (path.includes(blocked) || path.endsWith(blocked) || path === blocked) {
                return false;
            }
        }
        return true;
    }

    /**
     * Loads the official Google AdSense script tag asynchronously once.
     */
    function loadAdSenseScript() {
        if (!isEligiblePage() || !HAPANAMY_ADSENSE_CONFIG.enabled) return;
        if (HAPANAMY_ADSENSE_CONFIG.publisherId.includes('YOUR_ADSENSE_PUBLISHER_ID')) {
            // Keep placeholder mode without throwing unhandled network errors
            return;
        }

        if (typeof document === 'undefined') return;

        if (document.querySelector('script[src*="pagead2.googlesyndication.com"]')) {
            return; // Already loaded
        }

        const script = document.createElement('script');
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(HAPANAMY_ADSENSE_CONFIG.publisherId);
        document.head.appendChild(script);
    }

    /**
     * Renders a responsive AdSense Component into a target container.
     */
    function renderAdUnit(containerId, unitType) {
        if (typeof document === 'undefined') return;
        const container = document.getElementById(containerId);
        if (!container || !isEligiblePage()) return;

        const effectiveType = unitType || 'TOP_CONTENT_AD';
        const unit = HAPANAMY_ADSENSE_CONFIG.units[effectiveType] || HAPANAMY_ADSENSE_CONFIG.units.TOP_CONTENT_AD;

        if (!HAPANAMY_ADSENSE_CONFIG.enabled) {
            container.style.display = 'none';
            return;
        }

        if (HAPANAMY_ADSENSE_CONFIG.publisherId.includes('YOUR_ADSENSE_PUBLISHER_ID')) {
            if (HAPANAMY_ADSENSE_CONFIG.testMode) {
                container.innerHTML = '<div class="hapanamy-ad-wrapper" style="margin: 24px auto; max-width: 960px; text-align: center;">' +
                    '<div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted, #94a3b8); margin-bottom: 4px;">Advertisement / දැන්වීම් අනුග්‍රහය</div>' +
                    '<div style="background: rgba(255, 255, 255, 0.03); border: 1px dashed rgba(240, 179, 35, 0.25); border-radius: 12px; padding: 25px 15px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100px; color: var(--text-muted, #94a3b8); font-size: 12px;">' +
                    '<span style="font-size: 16px; margin-bottom: 4px;">📢</span>' +
                    '<span style="font-weight: 600; color: var(--brand-gold, #f0b323);">Google AdSense Slot [' + effectiveType + ']</span>' +
                    '<span style="font-size: 11px; opacity: 0.8;">Responsive Ad Container • Layout Shift Protected</span>' +
                    '</div>' +
                    '</div>';
            }
            return;
        }

        // Live Google AdSense Tag
        container.innerHTML = '<div class="hapanamy-ad-wrapper" style="margin: 24px auto; max-width: 960px; text-align: center; overflow: hidden; min-height: 90px;">' +
            '<div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted, #94a3b8); margin-bottom: 4px;">Advertisement</div>' +
            '<ins class="adsbygoogle" style="display:block; text-align:center;" data-ad-layout="in-article" data-ad-format="' + unit.format + '" data-ad-client="' + HAPANAMY_ADSENSE_CONFIG.publisherId + '" data-ad-slot="' + unit.slot + '" data-full-width-responsive="' + unit.fullWidthResponsive + '"></ins>' +
            '</div>';

        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.log('AdSense init notice:', e.message);
        }
    }

    // Auto-init on DOMContentLoaded if running in browser
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                loadAdSenseScript();
            });
        } else {
            loadAdSenseScript();
        }
    }

    // Export to global scope
    if (typeof window !== 'undefined') {
        window.HapanamyAdSense = {
            config: HAPANAMY_ADSENSE_CONFIG,
            isEligiblePage,
            loadAdSenseScript,
            renderAdUnit
        };
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { HAPANAMY_ADSENSE_CONFIG, isEligiblePage };
    }

})(typeof window !== 'undefined' ? window : global);
