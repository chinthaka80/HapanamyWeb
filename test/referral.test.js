// Unit Tests for Phase 2: Referral Link Engine & Analytics
const testRunner = require('./test-runner');
const ReferralService = require('../services/referral-service');

test('ReferralService: Generates unique Left, Right, and General referral links', () => {
    const links = ReferralService.generateReferralLinks('kasun_t', 'https://hapanamy.lk');

    assert.equal(links.referral_code, 'kasun_t', 'Referral code should be kasun_t');
    assert.equal(links.left_link, 'https://hapanamy.lk/register?ref=kasun_t&position=left', 'Left link must contain position=left');
    assert.equal(links.right_link, 'https://hapanamy.lk/register?ref=kasun_t&position=right', 'Right link must contain position=right');
    assert.equal(links.general_link, 'https://hapanamy.lk/register?ref=kasun_t', 'General link must contain ref');
});

test('ReferralService: Tracks inbound clicks with position and client IP', () => {
    const clickStore = [];
    const event1 = ReferralService.trackClick('kasun_t', 'left', '192.168.1.1', clickStore);
    const event2 = ReferralService.trackClick('kasun_t', 'right', '192.168.1.2', clickStore);
    const event3 = ReferralService.trackClick('kasun_t', 'auto', '192.168.1.3', clickStore);

    assert.equal(clickStore.length, 3, 'Click store should have 3 records');
    assert.equal(event1.referral_code, 'kasun_t');
    assert.equal(event1.position, 'left');
    assert.equal(event2.position, 'right');
});

test('ReferralService: Records conversion and computes conversion analytics rates', () => {
    const clickStore = [
        { referral_code: 'sanduni', position: 'left', timestamp: new Date().toISOString() },
        { referral_code: 'sanduni', position: 'left', timestamp: new Date().toISOString() },
        { referral_code: 'sanduni', position: 'right', timestamp: new Date().toISOString() },
        { referral_code: 'sanduni', position: 'auto', timestamp: new Date().toISOString() }
    ];
    const conversionStore = [];

    // Record 2 conversions
    ReferralService.recordConversion('sanduni', 'user-101', conversionStore);
    ReferralService.recordConversion('sanduni', 'user-102', conversionStore);

    const stats = ReferralService.getReferralStats('sanduni', clickStore, conversionStore);

    assert.equal(stats.total_clicks, 4, 'Total clicks should be 4');
    assert.equal(stats.left_clicks, 2, 'Left clicks should be 2');
    assert.equal(stats.right_clicks, 1, 'Right clicks should be 1');
    assert.equal(stats.conversions, 2, 'Conversions should be 2');
    assert.equal(stats.conversion_rate_percent, 50.00, 'Conversion rate should be 50.00% (2 / 4 * 100)');
});

test('ReferralService: Generates clean SVG QR Code markup', () => {
    const svg = ReferralService.generateQrCodeSvg('https://hapanamy.lk/register?ref=kasun_t', 200);

    assert(typeof svg === 'string', 'QR output should be string');
    assert(svg.includes('<svg'), 'Output should contain SVG opening tag');
    assert(svg.includes('</svg>'), 'Output should contain SVG closing tag');
    assert(svg.includes('SCAN TO JOIN'), 'SVG should contain scan text');
});

if (require.main === module) {
    runTests();
}
