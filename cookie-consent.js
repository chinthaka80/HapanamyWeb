/**
 * HAPANAMY.LK — Privacy & Cookie Consent Banner Engine
 * Compliant with Google Publisher Policies, GDPR, and ePrivacy Directive.
 */

(function(window) {
    'use strict';

    const CONSENT_KEY = 'hapanamy_cookie_consent_status';

    function initCookieConsent() {
        const path = window.location.pathname.toLowerCase();
        const isExcluded = path.includes('dashboard') || path.includes('admin') || path.includes('checkout') || path.includes('login') || path.includes('register');
        if (isExcluded) return;

        const currentConsent = localStorage.getItem(CONSENT_KEY);
        if (currentConsent) return; // User already consented or chose preference

        const banner = document.createElement('div');
        banner.id = 'hapanamyCookieBanner';
        banner.style = 'position: fixed; bottom: 16px; left: 16px; right: 16px; max-width: 600px; margin: 0 auto; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(240, 179, 35, 0.3); border-radius: 16px; padding: 18px 22px; z-index: 999999; box-shadow: 0 20px 40px rgba(0,0,0,0.6); color: #f8fafc; font-family: inherit; font-size: 13px; line-height: 1.5; display: flex; flex-direction: column; gap: 12px;';

        banner.innerHTML = 
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 24px;">🍪</span>
                <div style="flex: 1;">
                    <strong style="color: #f0b323; font-size: 14px; display: block; margin-bottom: 2px;">Privacy & Cookie Preferences</strong>
                    <span>HAPANAMY.LK uses cookies and Google advertising technologies to enhance site navigation, deliver personalized content, and analyze site traffic in accordance with our <a href="privacy-policy.html" style="color: #f0b323; text-decoration: underline;">Privacy Policy</a>.</span>
                </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap;">
                <button id="btnDeclineCookie" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #94a3b8; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">Decline</button>
                <button id="btnAcceptCookie" style="background: linear-gradient(135deg, #f0b323, #f47b20); border: none; color: #000; padding: 7px 18px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">Accept All</button>
            </div>
        ;

        document.body.appendChild(banner);

        document.getElementById('btnAcceptCookie').onclick = function() {
            localStorage.setItem(CONSENT_KEY, 'ACCEPTED');
            banner.remove();
        };

        document.getElementById('btnDeclineCookie').onclick = function() {
            localStorage.setItem(CONSENT_KEY, 'DECLINED');
            banner.remove();
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCookieConsent);
    } else {
        initCookieConsent();
    }

})(typeof window !== 'undefined' ? window : global);
