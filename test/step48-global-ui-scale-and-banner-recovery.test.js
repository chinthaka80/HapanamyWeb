// Step 48: Global UI Scale Lock, Visual Stability & Banner Recovery Verification Suite
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const indexHtmlPath = path.join(rootDir, 'index.html');
const indexCssPath = path.join(rootDir, 'index.css');
const indexJsPath = path.join(rootDir, 'index.js');
const dashboardHtmlPath = path.join(rootDir, 'dashboard.html');

console.log('--- Step 48: Global UI Scale Lock, Visual Stability & Banner Recovery Tests ---');

// 1. Design Tokens System in index.css
test('Step 48: 1. Authoritative Design Tokens Declaration in index.css', () => {
    const css = fs.readFileSync(indexCssPath, 'utf-8');
    
    // Header & container
    assert(css.includes('--header-height: 66px;'), 'Header height token must be 66px');
    assert(css.includes('--container-max: 1280px;'), 'Container max width token must be 1280px');
    
    // Spacing scale
    assert(css.includes('--space-xs: 4px;'), 'Spacing token --space-xs must exist');
    assert(css.includes('--space-sm: 8px;'), 'Spacing token --space-sm must exist');
    assert(css.includes('--space-md: 12px;'), 'Spacing token --space-md must exist');
    assert(css.includes('--space-lg: 16px;'), 'Spacing token --space-lg must exist');
    assert(css.includes('--space-xl: 24px;'), 'Spacing token --space-xl must exist');
    assert(css.includes('--space-2xl: 32px;'), 'Spacing token --space-2xl must exist');
    assert(css.includes('--space-3xl: 48px;'), 'Spacing token --space-3xl must exist');
    assert(css.includes('--space-4xl: 64px;'), 'Spacing token --space-4xl must exist');

    // Icon scale
    assert(css.includes('--icon-xs: 14px;'), 'Icon scale --icon-xs must be 14px');
    assert(css.includes('--icon-sm: 18px;'), 'Icon scale --icon-sm must be 18px');
    assert(css.includes('--icon-md: 22px;'), 'Icon scale --icon-md must be 22px');
    assert(css.includes('--icon-lg: 28px;'), 'Icon scale --icon-lg must be 28px');
    assert(css.includes('--icon-xl: 36px;'), 'Icon scale --icon-xl must be 36px');

    // Button heights
    assert(css.includes('--button-height-sm: 36px;'), 'Button height sm must be 36px');
    assert(css.includes('--button-height-md: 42px;'), 'Button height md must be 42px');
    assert(css.includes('--button-height-lg: 48px;'), 'Button height lg must be 48px');

    // Border radius
    assert(css.includes('--radius-sm: 8px;'), 'Radius sm must be 8px');
    assert(css.includes('--radius-md: 12px;'), 'Radius md must be 12px');
    assert(css.includes('--radius-lg: 16px;'), 'Radius lg must be 16px');
    assert(css.includes('--radius-xl: 20px;'), 'Radius xl must be 20px');
    assert(css.includes('--radius-2xl: 28px;'), 'Radius 2xl must be 28px');
});

// 2. Hero Banner CSS & Container Properties
test('Step 48: 2. Hero Banner Background CSS Recovery & Proportions', () => {
    const css = fs.readFileSync(indexCssPath, 'utf-8');
    
    // .hero-bg-paddy definition
    assert(css.includes('.hero-bg-paddy {'), '.hero-bg-paddy CSS class must be defined');
    assert(css.includes("background-image: url('assets/glass_digital_campus.jpg');"), 'Hero background fallback image must be defined');
    assert(css.includes('background-size: cover;'), 'Hero background must use cover sizing');
    assert(css.includes('background-position: center center;') || css.includes('background-position: center;'), 'Hero background must be center aligned');
    assert(css.includes('opacity: 0.22;'), 'Hero background opacity must be set to 0.22');
    assert(css.includes('z-index: 1;'), 'Hero background z-index must be 1');

    // Hero section padding and min-height
    assert(css.includes('min-height: 500px;'), 'Hero min-height must be 500px');
    assert(css.includes('padding: clamp(36px, 5vw, 65px) 0 0 0;'), 'Hero padding must use responsive clamp');
});

// 3. Hero Slide Progressive Enhancement in index.html
test('Step 48: 3. Hero Slide 0 Pre-rendered Static HTML (Progressive Enhancement)', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf-8');
    
    // Must contain #heroBgPaddy element
    assert(html.includes('id="heroBgPaddy"'), 'heroBgPaddy element must exist in index.html');
    assert(html.includes('class="hero-bg-paddy"'), 'hero-bg-paddy class must be attached');

    // Slide 0 pre-rendered content
    assert(html.includes('id="heroSliderContent"'), 'heroSliderContent container must exist');
    assert(html.includes('id="heroSliderVisual"'), 'heroSliderVisual container must exist');
    assert(html.includes('id="heroStatsContainer"'), 'heroStatsContainer container must exist');

    // Static fallback ensures no blank flash before JS executes
    assert(html.includes('HAPANAMY ACADEMY'), 'Static pre-render must include HAPANAMY ACADEMY panel');
    assert(html.includes('10+'), 'Static pre-render must include 10+ courses stat');
    assert(html.includes('500+'), 'Static pre-render must include 500+ resources stat');
    assert(html.includes('100%'), 'Static pre-render must include 100% practical stat');
    assert(html.includes('ජීවිත කාලයටම'), 'Static pre-render must include lifetime support stat');
});

// 4. Hero Background Image Assets Existence on Disk
test('Step 48: 4. Physical Existence of All Hero Banner Image Assets', () => {
    const assetsDir = path.join(rootDir, 'assets');
    const requiredImages = [
        'glass_digital_campus.jpg',
        'ai_future_city.jpg',
        'paddy_field_sunset.jpg',
        'hero_showcase.jpg'
    ];

    for (const img of requiredImages) {
        const fullPath = path.join(assetsDir, img);
        assert(fs.existsSync(fullPath), `Required asset ${img} must exist on disk`);
        const stats = fs.statSync(fullPath);
        assert(stats.size > 1000, `Asset ${img} must have valid content (size > 1KB)`);
    }
});

// 5. Hero Slider JavaScript Logic & Seamless Load
test('Step 48: 5. Hero Slider Controller & Transition Logic in index.js', () => {
    const js = fs.readFileSync(indexJsPath, 'utf-8');
    
    assert(js.includes('function renderHeroSlide(slideIdx, isInitial = false)'), 'renderHeroSlide must support isInitial parameter');
    assert(js.includes('function initHeroSlider()'), 'initHeroSlider must exist');
    assert(js.includes('renderHeroSlide(0, true)'), 'initHeroSlider must render slide 0 with isInitial=true');
    assert(js.includes('slideIntervalMs = 7000'), 'Slide interval must be 7 seconds');
    assert(js.includes('bgPaddy.style.backgroundImage'), 'renderHeroSlide must dynamically swap background images');
});

// 6. Floating Action Controls Standardized Scale
test('Step 48: 6. Standardized Scale for Floating Action Controls (Chat, Cart, WhatsApp)', () => {
    const css = fs.readFileSync(indexCssPath, 'utf-8');
    const html = fs.readFileSync(indexHtmlPath, 'utf-8');

    // CSS class definitions
    assert(css.includes('#helpdeskChatBubble {'), '#helpdeskChatBubble CSS rule must exist');
    assert(css.includes('#floatingCartBtn {'), '#floatingCartBtn CSS rule must exist');
    assert(css.includes('.floating-whatsapp-widget {'), '.floating-whatsapp-widget CSS rule must exist');

    // Desktop size 48px
    assert(css.includes('width: 48px;'), 'Floating buttons width must be standardized to 48px in CSS');
    assert(css.includes('height: 48px;'), 'Floating buttons height must be standardized to 48px in CSS');

    // Mobile size 42px in media queries
    assert(css.includes('width: 42px;'), 'Floating buttons width on mobile must be 42px');
    assert(css.includes('height: 42px;'), 'Floating buttons height on mobile must be 42px');

    // HTML should not have inline bloated width: 60px or height: 60px overrides
    assert(!html.includes('id="helpdeskChatBubble" onclick="toggleHelpdeskChat(true)" style="position: fixed; bottom: 30px; left: 30px; width: 60px; height: 60px;'), 'Oversized 60px inline style must be removed from helpdesk bubble');
    assert(!html.includes('id="floatingCartBtn" onclick="toggleCartDrawer(true)" style="position: fixed; bottom: 95px; right: 25px; width: 56px; height: 56px;'), 'Oversized 56px inline style must be removed from floating cart button');
});

// 7. MLM Engine Business Rules & Invariants Protection
test('Step 48: 7. MLM Engine Business Rules & Invariants Remain 100% Unchanged', () => {
    const DirectCommissionEngine = require('../services/direct-commission-engine');
    const QualifiedUplineCommissionEngine = require('../services/qualified-upline-commission-engine');
    const EarningsCapEngine = require('../services/earnings-cap-engine');
    
    // Direct commission rate calculation check (8%)
    const comm1 = DirectCommissionEngine.calculateDirectCommission(7425.00);
    assert.strictEqual(comm1, 594.00, 'Direct commission for 7,425 LKR at default 8% must equal 594.00 LKR');

    // Binary matching calculation check (7%)
    const binComm = QualifiedUplineCommissionEngine.calculateBinaryCommission(10000.00);
    assert.strictEqual(binComm, 700.00, 'Binary commission for 10,000 BV match at default 7% must equal 700.00 LKR');

    // Daily cap calculation check (Rs. 30,000)
    const capResult = EarningsCapEngine.applyDailyCap(50000.00, 0.00, 30000.00);
    assert.strictEqual(capResult.eligibleAmount, 30000.00, 'Eligible amount bounded by Rs. 30,000 daily cap');
    assert.strictEqual(capResult.cappedAmount, 20000.00, 'Excess amount correctly marked as capped');
});
