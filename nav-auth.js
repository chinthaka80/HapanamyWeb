/**
 * HAPANAMY.LK — Unified Navigation Header Authentication & User Account Dropdown
 * Provides universal authenticated navbar synchronization, display name resolution,
 * and robust interactive dropdown toggling across all consumer and member pages.
 */

(function() {
    'use strict';

    // 1. Authoritative User Display Name Resolver
    // Priority: full_name > display_name > name > username > email prefix
    function getUserDisplayName(user) {
        if (!user) return 'Member Profile';
        if (typeof user === 'string') {
            try { user = JSON.parse(user); } catch (e) { return user || 'Member Profile'; }
        }
        const name = user.full_name || user.display_name || user.name || user.username || (user.email ? user.email.split('@')[0] : '');
        return name && String(name).trim() ? String(name).trim() : 'Member Profile';
    }

    // 2. Global Dropdown Menu Toggle Handler
    function toggleUserAccountDropdown(event, forceOpen) {
        if (event) {
            if (typeof event.preventDefault === 'function') event.preventDefault();
            if (typeof event.stopPropagation === 'function') event.stopPropagation();
        }
        const dropdown = document.getElementById('userAccountDropdown');
        const toggleBtn = document.getElementById('userAccountMenuToggle');
        if (!dropdown) return;

        const isOpen = forceOpen !== undefined ? Boolean(forceOpen) : !dropdown.classList.contains('open');
        if (isOpen) {
            dropdown.classList.add('open');
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
        } else {
            dropdown.classList.remove('open');
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
        }
    }

    // 3. User Account Dropdown Interactivity Setup
    function setupUserAccountDropdown() {
        const toggleBtn = document.getElementById('userAccountMenuToggle');
        const dropdown = document.getElementById('userAccountDropdown');
        const wrapper = document.getElementById('headerUserAccountMenu');

        if (!toggleBtn || !dropdown) return;

        // Direct click handler
        toggleBtn.onclick = function(e) {
            toggleUserAccountDropdown(e);
        };

        // Keyboard support (Enter, Space, ArrowDown, Escape)
        toggleBtn.onkeydown = function(e) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                toggleUserAccountDropdown(e, true);
                const firstItem = dropdown.querySelector('a, button');
                if (firstItem) firstItem.focus();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                toggleUserAccountDropdown(e, false);
            }
        };

        // Keyboard Escape inside dropdown menu
        dropdown.onkeydown = function(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                toggleUserAccountDropdown(e, false);
                toggleBtn.focus();
            }
        };

        // Outside click dismiss - idempotent registration
        if (window._userAccountOutsideClickListener) {
            document.removeEventListener('click', window._userAccountOutsideClickListener);
        }
        window._userAccountOutsideClickListener = function(e) {
            const wrapper = document.getElementById('headerUserAccountMenu');
            const dropdown = document.getElementById('userAccountDropdown');
            const toggleBtn = document.getElementById('userAccountMenuToggle');
            if (dropdown && dropdown.classList.contains('open')) {
                if (!wrapper || !wrapper.contains(e.target)) {
                    dropdown.classList.remove('open');
                    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
                }
            }
        };
        document.addEventListener('click', window._userAccountOutsideClickListener);
    }

    // 4. Dynamic Authenticated State Synchronization
    function syncNavAuthState() {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('active_token');
        const userStr = localStorage.getItem('active_user') || localStorage.getItem('hapanamy_user_profile');
        const authBtnContainer = document.getElementById('headerAuthButtons');
        const mobileAuthContainers = document.querySelectorAll('.mobile-only-auth');

        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                const isAdmin = user.role === 'admin' || user.role === 'ADMIN';
                const dashLink = isAdmin ? 'hapanamy-admin-portal-9226.html' : 'dashboard.html';
                const displayName = getUserDisplayName(user);
                const rawHandle = user.username || (user.id ? user.id.replace('user-', '') : (user.email ? user.email.split('@')[0] : 'member'));
                const usernameHandle = `@${rawHandle.replace(/^@+/, '')}`;
                const initial = (displayName && displayName !== 'Member Profile' ? displayName.charAt(0) : (rawHandle ? rawHandle.charAt(0) : '👤')).toUpperCase();

                if (authBtnContainer) {
                    authBtnContainer.innerHTML = `
                        <div class="user-account-menu-wrapper" id="headerUserAccountMenu">
                            <button type="button" class="user-account-toggle-btn header-register-btn" id="userAccountMenuToggle" onclick="window.toggleUserAccountDropdown && window.toggleUserAccountDropdown(event)" aria-expanded="false" aria-haspopup="menu" aria-label="User Account Menu: ${displayName}" title="${displayName} (${usernameHandle})">
                                <span class="user-account-avatar" id="headerUserAvatar">${initial}</span>
                                <span class="user-account-name" id="headerUserDisplayName">${displayName}</span>
                                <span class="user-account-chevron" aria-hidden="true">▾</span>
                            </button>
                            <div class="user-account-dropdown" id="userAccountDropdown" role="menu" aria-labelledby="userAccountMenuToggle">
                                <div class="user-account-dropdown-header">
                                    <div class="user-account-dropdown-name">${displayName}</div>
                                    <div class="user-account-dropdown-handle">${usernameHandle}</div>
                                </div>
                                <div class="user-account-dropdown-divider"></div>
                                <a href="${dashLink}" class="user-account-dropdown-item" role="menuitem">
                                    <span class="item-icon">📊</span>
                                    <span>👤 My Dashboard</span>
                                </a>
                                <a href="my-account.html" class="user-account-dropdown-item" role="menuitem">
                                    <span class="item-icon">👤</span>
                                    <span>Profile</span>
                                </a>
                                <a href="student-dashboard.html" class="user-account-dropdown-item" role="menuitem">
                                    <span class="item-icon">🎥</span>
                                    <span>My Learning</span>
                                </a>
                                <a href="dashboard.html#network" class="user-account-dropdown-item" role="menuitem">
                                    <span class="item-icon">👥</span>
                                    <span>My Team</span>
                                </a>
                                <a href="dashboard.html#financial" class="user-account-dropdown-item" role="menuitem">
                                    <span class="item-icon">💰</span>
                                    <span>Wallet</span>
                                </a>
                                <a href="dashboard.html#settings" class="user-account-dropdown-item" role="menuitem">
                                    <span class="item-icon">⚙️</span>
                                    <span>Settings</span>
                                </a>
                                ${isAdmin ? `
                                <a href="hapanamy-admin-portal-9226.html" class="user-account-dropdown-item" role="menuitem" style="color:var(--brand-gold);">
                                    <span class="item-icon">👑</span>
                                    <span>Admin Portal</span>
                                </a>
                                ` : ''}
                                <div class="user-account-dropdown-divider"></div>
                                <button type="button" class="user-account-dropdown-item logout-item header-login-btn" role="menuitem" onclick="handleGlobalLogout()" style="width: 100%; border: none; background: transparent; text-align: left; padding: 9px 12px; cursor: pointer;">
                                    <span class="item-icon">🚪</span>
                                    <span>🚪 Logout</span>
                                </button>
                            </div>
                        </div>
                    `;

                    setupUserAccountDropdown();
                }

                mobileAuthContainers.forEach(container => {
                    container.innerHTML = `
                        <div style="padding: 10px 14px; background: rgba(244,123,32,0.12); border-radius: 10px; border: 1px solid rgba(244,123,32,0.3); margin-bottom: 10px; text-align: left;">
                            <div style="font-weight: 800; font-size: 14px; color: var(--text-primary);">${displayName}</div>
                            <div style="font-size: 12px; color: var(--brand-gold);">${usernameHandle}</div>
                        </div>
                        <a href="${dashLink}" class="header-register-btn" style="justify-content: center; width: 100%; text-align: center; margin-bottom: 6px;">
                            <span>👤 My Dashboard</span>
                        </a>
                        <a href="student-dashboard.html" class="header-login-btn" style="justify-content: center; width: 100%; text-align: center; margin-bottom: 6px;">
                            <span>🎥 My Learning</span>
                        </a>
                        <button onclick="handleGlobalLogout()" class="header-login-btn" style="justify-content: center; width: 100%; text-align: center; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#ff7675 !important; cursor:pointer;">
                            <span>🚪 Logout</span>
                        </button>
                    `;
                });
            } catch (e) {
                console.error('Error syncing nav auth state:', e);
            }
        } else {
            if (authBtnContainer) {
                authBtnContainer.innerHTML = `
                    <a href="login.html" class="header-login-btn" id="headerLoginBtn">
                        <span>🔐 LOGIN</span>
                    </a>
                    <a href="register.html" class="header-register-btn" id="headerRegisterBtn">
                        <span>🚀 REGISTER FREE</span>
                    </a>
                `;
            }
            mobileAuthContainers.forEach(container => {
                container.innerHTML = `
                    <a href="login.html" class="header-login-btn" style="justify-content: center; width: 100%; text-align: center;">
                        <span>🔐 LOGIN</span>
                    </a>
                    <a href="register.html" class="header-register-btn" style="justify-content: center; width: 100%; text-align: center;">
                        <span>🚀 REGISTER FREE</span>
                    </a>
                `;
            });
        }
    }

    // 5. Global Logout Handler
    async function handleGlobalLogout() {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('active_token');
        localStorage.removeItem('active_user');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('active_token');
        localStorage.removeItem('hapanamy_user_profile');
        if (typeof sessionStorage !== 'undefined' && sessionStorage.clear) {
            sessionStorage.clear();
        }
        try {
            if (token && typeof fetch === 'function') {
                fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                }).catch(() => {});
            }
        } catch (e) {}
        if (typeof window !== 'undefined' && window.location && typeof window.location.replace === 'function') {
            window.location.replace('login.html');
        }
    }

    // 6. Universal Mobile Menu Interactivity Setup
    function setupMobileMenu() {
        const mobileMenuBtns = document.querySelectorAll('.mobile-menu-btn, #mobileMenuBtn');
        const navMenus = document.querySelectorAll('.nav-menu, #navMenu');

        mobileMenuBtns.forEach(btn => {
            if (btn._mobileMenuInitialized) return;
            btn._mobileMenuInitialized = true;
            btn.addEventListener('click', function(e) {
                if (e) {
                    if (typeof e.preventDefault === 'function') e.preventDefault();
                    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                    if (typeof e.stopPropagation === 'function') e.stopPropagation();
                }
                const isActive = btn.classList.toggle('active');
                navMenus.forEach(menu => {
                    menu.classList.toggle('active', isActive);
                });
                if (document.body) {
                    document.body.classList.toggle('menu-open', isActive);
                }
            });
        });

        navMenus.forEach(menu => {
            menu.querySelectorAll('.nav-link, a').forEach(link => {
                if (link._mobileCloseInitialized) return;
                link._mobileCloseInitialized = true;
                link.addEventListener('click', function() {
                    mobileMenuBtns.forEach(btn => btn.classList.remove('active'));
                    navMenus.forEach(m => m.classList.remove('active'));
                    if (document.body) {
                        document.body.classList.remove('menu-open');
                    }
                });
            });
        });

        // Outside click to close mobile menu
        if (!window._mobileMenuOutsideClickListener) {
            window._mobileMenuOutsideClickListener = function(e) {
                let clickedInside = false;
                mobileMenuBtns.forEach(btn => { if (btn.contains && btn.contains(e.target)) clickedInside = true; });
                navMenus.forEach(menu => { if (menu.contains && menu.contains(e.target)) clickedInside = true; });
                if (!clickedInside) {
                    mobileMenuBtns.forEach(btn => btn.classList.remove('active'));
                    navMenus.forEach(menu => menu.classList.remove('active'));
                    if (document.body) {
                        document.body.classList.remove('menu-open');
                    }
                }
            };
            document.addEventListener('click', window._mobileMenuOutsideClickListener);
        }
    }

    // Global exports
    window.getUserDisplayName = getUserDisplayName;
    window.toggleUserAccountDropdown = toggleUserAccountDropdown;
    window.setupUserAccountDropdown = setupUserAccountDropdown;
    window.setupMobileMenu = setupMobileMenu;
    window.syncNavAuthState = syncNavAuthState;
    window.handleGlobalLogout = handleGlobalLogout;

    // Helper to run all navbar initializations
    function initNavbar() {
        syncNavAuthState();
        setupMobileMenu();
    }

    // Automatic synchronization on DOMContentLoaded and Storage events
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavbar);
    } else {
        initNavbar();
    }
    window.addEventListener('storage', syncNavAuthState);

})();
