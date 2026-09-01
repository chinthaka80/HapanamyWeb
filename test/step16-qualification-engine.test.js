// Comprehensive Test Suite for STEP 16 — Member Qualification Engine
const testRunner = require('./test-runner');
const QualificationEngine = require('../services/qualification-engine');

function createQualificationContext() {
    return {
        users: [
            { id: 'user-root', username: 'root_user', status: 'ACTIVE' },
            { id: 'user-qualified', username: 'top_leader', status: 'ACTIVE' },
            { id: 'user-left-direct', username: 'direct_left', status: 'ACTIVE' },
            { id: 'user-right-direct', username: 'direct_right', status: 'ACTIVE' },
            { id: 'user-suspended', username: 'bad_actor', status: 'SUSPENDED' }
        ],
        kycDocs: [
            { user_id: 'user-qualified', status: 'APPROVED' },
            { user_id: 'user-left-direct', status: 'APPROVED' },
            { user_id: 'user-right-direct', status: 'APPROVED' },
            { user_id: 'user-suspended', status: 'APPROVED' }
        ],
        purchases: [
            { id: 'p1', user_id: 'user-qualified', product_id: 'prod-fb-mon', status: 'ACTIVE' },
            { id: 'p2', user_id: 'user-left-direct', product_id: 'prod-fb-mon', status: 'ACTIVE' },
            { id: 'p3', user_id: 'user-right-direct', product_id: 'prod-fb-mon', status: 'ACTIVE' }
        ],
        sponsors: [
            { user_id: 'user-left-direct', sponsor_id: 'user-qualified' },
            { user_id: 'user-right-direct', sponsor_id: 'user-qualified' }
        ],
        binaryNodes: [
            { user_id: 'user-qualified', placement_parent_id: 'user-root', position: 'LEFT', depth: 2, path: 'user-root' },
            { user_id: 'user-left-direct', placement_parent_id: 'user-qualified', position: 'LEFT', depth: 3, path: 'user-root/user-qualified' },
            { user_id: 'user-right-direct', placement_parent_id: 'user-qualified', position: 'RIGHT', depth: 3, path: 'user-root/user-qualified' }
        ],
        volumeLedger: [
            { user_id: 'user-qualified', leg: 'LEFT', amount: 50000 },
            { user_id: 'user-qualified', leg: 'RIGHT', amount: 50000 }
        ]
    };
}

test('Step 16: 1. Fully QUALIFIED member: Meets KYC, active purchase, and active 1-Left + 1-Right directs', () => {
    const ctx = createQualificationContext();
    const result = QualificationEngine.evaluateQualification('user-qualified', ctx);

    assert(result.is_qualified, 'Leader with approved KYC, purchase, and active left+right directs should be QUALIFIED');
    assert.equal(result.status, 'QUALIFIED');
    assert.equal(result.unmet_requirements.length, 0);
    assert.equal(result.inputs.active_purchases_count, 1);
    assert.equal(result.inputs.left_direct_active_count, 1);
    assert.equal(result.inputs.right_direct_active_count, 1);
});

test('Step 16: 2. NOT_QUALIFIED / PENDING when missing active purchase or unverified KYC', () => {
    const ctx = createQualificationContext();

    // User without KYC or purchase
    const newMemberResult = QualificationEngine.evaluateQualification('user-root', ctx);
    assert(!newMemberResult.is_qualified, 'Root user with no KYC and no purchase must not be qualified');
    assert.equal(newMemberResult.status, 'PENDING');
    assert(newMemberResult.unmet_requirements.length > 0);
});

test('Step 16: 3. SUSPENDED member is strictly blocked from qualification', () => {
    const ctx = createQualificationContext();
    const result = QualificationEngine.evaluateQualification('user-suspended', ctx);

    assert(!result.is_qualified, 'Suspended account cannot be qualified');
    assert.equal(result.status, 'SUSPENDED');
    assert(result.unmet_requirements.some(r => r.includes('SUSPENDED')));
});

test('Step 16: 4. Qualification Gained: Member purchases product and gains active qualification', () => {
    const ctx = createQualificationContext();
    const userId = 'user-new-member';

    ctx.users.push({ id: userId, username: 'new_pro', status: 'ACTIVE' });
    ctx.kycDocs.push({ user_id: userId, status: 'APPROVED' });
    ctx.sponsors.push({ user_id: 'd_left', sponsor_id: userId });
    ctx.sponsors.push({ user_id: 'd_right', sponsor_id: userId });
    ctx.binaryNodes.push({ user_id: 'd_left', placement_parent_id: userId, position: 'LEFT' });
    ctx.binaryNodes.push({ user_id: 'd_right', placement_parent_id: userId, position: 'RIGHT' });
    ctx.purchases.push({ id: 'p-dl', user_id: 'd_left', status: 'ACTIVE' });
    ctx.purchases.push({ id: 'p-dr', user_id: 'd_right', status: 'ACTIVE' });

    // Initial state: No purchase -> PENDING / NOT_QUALIFIED
    const beforePurchase = QualificationEngine.evaluateQualification(userId, ctx);
    assert(!beforePurchase.is_qualified);

    // Event: Product purchase approved
    ctx.purchases.push({ id: 'p-new-1', user_id: userId, product_id: 'prod-fb-mon', status: 'ACTIVE' });

    // Re-evaluate: Now QUALIFIED
    const afterPurchase = QualificationEngine.evaluateQualification(userId, ctx);
    assert(afterPurchase.is_qualified, 'Member becomes qualified after purchasing required product');
    assert.equal(afterPurchase.status, 'QUALIFIED');
});

test('Step 16: 5. Qualification Lost & Refund Effect: Refunding purchase revokes qualification', () => {
    const ctx = createQualificationContext();

    // 1. Leader is QUALIFIED
    const initialRes = QualificationEngine.evaluateQualification('user-qualified', ctx);
    assert(initialRes.is_qualified);

    // 2. Leader's personal purchase is REFUNDED
    const leaderPurchase = ctx.purchases.find(p => p.user_id === 'user-qualified');
    leaderPurchase.status = 'REFUNDED';

    // 3. Re-evaluate: Leader loses qualification
    const afterRefund = QualificationEngine.evaluateQualification('user-qualified', ctx);
    assert(!afterRefund.is_qualified, 'Refund of personal purchase must revoke qualification');
    assert(afterRefund.unmet_requirements.some(r => r.includes('active product purchase')));
});

test('Step 16: 6. Downline Refund Effect: Downline refund revokes sponsor active direct qualification', () => {
    const ctx = createQualificationContext();

    // Left direct's purchase is refunded
    const leftDirectPurchase = ctx.purchases.find(p => p.user_id === 'user-left-direct');
    leftDirectPurchase.status = 'REFUNDED';

    const result = QualificationEngine.evaluateQualification('user-qualified', ctx);
    assert(!result.is_qualified, 'Sponsor loses qualification when left direct is refunded');
    assert(result.unmet_requirements.some(r => r.includes('LEFT leg')));
});

test('Step 16: 7. Configurable Rules: Admin can update qualification criteria dynamically', () => {
    const ctx = createQualificationContext();

    // Custom lenient rule: 0 directs required, only personal active purchase needed
    const lenientRule = {
        rule_version: 'v-lenient-2026',
        require_active_account: true,
        require_approved_kyc: true,
        require_product_purchase: true,
        min_active_purchases: 1,
        require_left_direct_active: false,
        require_right_direct_active: false,
        min_total_directs: 0
    };

    // User who has purchase and KYC, but NO directs
    ctx.users.push({ id: 'solo_member', username: 'solo_guy', status: 'ACTIVE' });
    ctx.kycDocs.push({ user_id: 'solo_member', status: 'APPROVED' });
    ctx.purchases.push({ id: 'p-solo', user_id: 'solo_member', status: 'ACTIVE' });

    // Under standard rule -> NOT QUALIFIED
    const standardRes = QualificationEngine.evaluateQualification('solo_member', ctx);
    assert(!standardRes.is_qualified);

    // Under lenient rule -> QUALIFIED
    const lenientRes = QualificationEngine.evaluateQualification('solo_member', ctx, lenientRule);
    assert(lenientRes.is_qualified, 'Member should be qualified under customized lenient rule configuration');
    assert.equal(lenientRes.rule_version, 'v-lenient-2026');
});

test('Step 16: 8. Historical Decision Logs & Immutability', () => {
    const ctx = createQualificationContext();
    const result = QualificationEngine.evaluateQualification('user-qualified', ctx);

    assert(result.id.startsWith('qdec-'));
    assert(result.evaluated_at);
    assert.equal(typeof result.inputs, 'object');

    const history = QualificationEngine.getMemberQualificationHistory('user-qualified');
    assert(history.length > 0, 'Qualification decisions must be recorded in history');
});

if (require.main === module) {
    runTests();
}
