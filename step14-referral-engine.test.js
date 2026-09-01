// Comprehensive Test Suite for STEP 14 — Referral Link Engine & Analytics
const testRunner = require('./test-runner');
const ReferralService = require('../services/referral-service');

test('Step 14: 1. Unique code and dual-leg referral link generation', () => {
    const links = ReferralService.generateReferralLinks('kasun_t', 'https://hapanamy.lk');

    assert.equal(links.referral_code, 'kasun_t');
    assert.equal(links.left_link, 'https://hapanamy.lk/register?ref=kasun_t&position=left');
    assert.equal(links.right_link, 'https://hapanamy.lk/register?ref=kasun_t&position=right');
    assert.equal(links.general_link, 'https://hapanamy.lk/register?ref=kasun_t');
    assert(links.qr_payload.includes('kasun_t'));
});

test('Step 14: 2. Referral code validation accepts valid alphanumeric codes and rejects illegal characters', () => {
    const users = [
        { id: 'u1', username: 'kasun_t', status: 'ACTIVE' },
        { id: 'u2', username: 'inactive_user', status: 'SUSPENDED' }
    ];

    // Valid code
    const validRes = ReferralService.validateReferralCode('kasun_t', users);
    assert(validRes.valid, 'Valid username should pass validation');
    assert.equal(validRes.sponsor.id, 'u1');

    // Non-existent sponsor
    const notFoundRes = ReferralService.validateReferralCode('non_existent', users);
    assert(!notFoundRes.valid, 'Non-existent sponsor must fail validation');

    // Inactive sponsor
    const inactiveRes = ReferralService.validateReferralCode('inactive_user', users);
    assert(!inactiveRes.valid, 'Inactive sponsor must fail validation');

    // Invalid characters (XSS/Script payload)
    const xssRes = ReferralService.validateReferralCode('<script>alert(1)</script>', users);
    assert(!xssRes.valid, 'Special characters/scripts in referral code must fail validation');
});

test('Step 14: 3. Position parameter strictly allows LEFT or RIGHT and rejects all other values', () => {
    // Valid positions
    const leftRes = ReferralService.validatePosition('left');
    assert(leftRes.valid);
    assert.equal(leftRes.position, 'LEFT');

    const rightRes = ReferralService.validatePosition('RIGHT');
    assert(rightRes.valid);
    assert.equal(rightRes.position, 'RIGHT');

    // Invalid positions
    const middleRes = ReferralService.validatePosition('middle');
    assert(!middleRes.valid, 'Position middle must fail validation');

    const topRes = ReferralService.validatePosition('TOP');
    assert(!topRes.valid, 'Position TOP must fail validation');

    const emptyRes = ReferralService.validatePosition('');
    assert(!emptyRes.valid, 'Empty position must fail validation');
});

test('Step 14: 4. Secure referral intent creation and tamper-proof consumption', () => {
    const users = [{ id: 'u1', username: 'nimal_s', status: 'ACTIVE' }];
    const intentStore = [];

    // Visitor opens left referral link
    const intentResult = ReferralService.createReferralIntent('nimal_s', 'left', '192.168.1.100', users, intentStore);
    assert(intentResult.success, 'Referral intent should be successfully created');
    assert(intentResult.intent_id.startsWith('ref-intent-'));
    assert.equal(intentResult.position, 'LEFT');
    assert.equal(intentStore.length, 1);

    // Consume intent upon registration
    const consumed = ReferralService.verifyAndConsumeIntent(intentResult.intent_id, intentStore);
    assert(consumed, 'Intent should be valid and consumed');
    assert.equal(consumed.is_consumed, true);

    // Re-consuming the same intent should fail (one-time use)
    const reConsumed = ReferralService.verifyAndConsumeIntent(intentResult.intent_id, intentStore);
    assert.equal(reConsumed, null, 'Already consumed intent cannot be reused');
});

test('Step 14: 5. Privacy preservation: IP addresses are hashed and anonymized', () => {
    const ip = '123.45.67.89';
    const anonymized = ReferralService.anonymizeIp(ip);

    assert(anonymized !== ip, 'IP address must not be stored in plaintext');
    assert.equal(typeof anonymized, 'string');
    assert.equal(anonymized.length, 16);
});

test('Step 14: 6. Analytics tracking: Left vs Right conversions and conversion rates', () => {
    const clickStore = [];
    const conversionStore = [];

    const username = 'marketing_pro';

    // 10 Left clicks, 5 Right clicks, 5 General clicks (Total = 20 clicks)
    for (let i = 0; i < 10; i++) ReferralService.trackClick(username, 'left', '10.0.0.' + i, clickStore);
    for (let i = 0; i < 5; i++) ReferralService.trackClick(username, 'right', '10.0.1.' + i, clickStore);
    for (let i = 0; i < 5; i++) ReferralService.trackClick(username, 'auto', '10.0.2.' + i, clickStore);

    // 2 Left conversions, 1 Right conversion (Total = 3 conversions)
    ReferralService.recordConversion(username, 'user-new-1', 'left', conversionStore);
    ReferralService.recordConversion(username, 'user-new-2', 'left', conversionStore);
    ReferralService.recordConversion(username, 'user-new-3', 'right', conversionStore);

    const stats = ReferralService.getReferralStats(username, clickStore, conversionStore);

    assert.equal(stats.total_clicks, 20);
    assert.equal(stats.left_clicks, 10);
    assert.equal(stats.right_clicks, 5);
    assert.equal(stats.general_clicks, 5);
    assert.equal(stats.conversions, 3);
    assert.equal(stats.left_conversions, 2);
    assert.equal(stats.right_conversions, 1);

    // Overall conversion rate = (3 / 20) * 100 = 15.00%
    assert.equal(stats.conversion_rate_percent, 15.00);

    // Left conversion rate = (2 / 10) * 100 = 20.00%
    assert.equal(stats.left_conversion_rate_percent, 20.00);

    // Right conversion rate = (1 / 5) * 100 = 20.00%
    assert.equal(stats.right_conversion_rate_percent, 20.00);
});

test('Step 14: 7. QR Code SVG output is valid XML markup with scan payload', () => {
    const qrSvg = ReferralService.generateQrCodeSvg('https://hapanamy.lk/register?ref=kasun_t', 200);
    assert(qrSvg.includes('<svg'), 'QR Code must be valid SVG element');
    assert(qrSvg.includes('viewBox="0 0 200 200"'));
    assert(qrSvg.includes('SCAN TO JOIN'));
});

if (require.main === module) {
    runTests();
}
