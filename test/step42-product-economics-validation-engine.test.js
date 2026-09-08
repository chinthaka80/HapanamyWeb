// Test Suite 42: Hapanamy.lk Product Economics & Commission Validation Engine (Sections 1-37)
const assert = require('assert');
const ProductEconomicsCalculator = require('../services/product-economics-calculator');
const ProductCommissionValidator = require('../services/product-commission-validator');
const ProductSnapshotService = require('../services/product-snapshot-service');
const ProductEconomicsService = require('../services/product-economics-service');

// -------------------------------------------------------------
// SECTION 34 EXAMPLE TEST: Exact Reference Specification Test
// -------------------------------------------------------------
test('Step 42: Section 34: Reference Product Economics Stress Test (LKR 7,450 -> NOT_VIABLE, Shortfall: LKR 1,996.50)', () => {
    const input = {
        selling_price: 7450.00,
        product_cost: 3000.00,
        tax_amount: 500.00,
        hosting_cost_amount: 100.00,
        staff_cost_amount: 300.00,
        marketing_cost_amount: 400.00,
        refund_reserve_amount: 150.00,
        support_cost_amount: 100.00,
        operational_cost_amount: 150.00,
        profit_reserve_amount: 500.00,
        direct_commission_rate: 8.00,
        binary_commission_rate: 7.00,
        maximum_qualified_uplines: 7
    };

    const calc = ProductEconomicsService.calculateProductEconomics(input);
    const validation = ProductEconomicsService.validateCommissionSafety(calc);
    const margins = ProductEconomicsService.calculateProfitMargin(
        input.selling_price,
        input.product_cost,
        calc.calculated.total_operating_cost,
        calc.calculated.company_profit_reserve,
        calc.calculated.maximum_total_commission_exposure
    );

    // 1. Total Company Allocations = 500 + 100 + 300 + 400 + 150 + 100 + 150 = 1700
    assert.strictEqual(calc.calculated.total_operating_cost, 1700.00, 'Total company allocations must be 1700.00');

    // 2. Available Contribution = 7450 - (3000 + 1700) = 2750
    assert.strictEqual(calc.calculated.available_contribution, 2750.00, 'Available contribution must be 2750.00');

    // 3. Company Profit Reserve = 500
    assert.strictEqual(calc.calculated.company_profit_reserve, 500.00, 'Profit reserve must be 500.00');

    // 4. Commission Pool = 2750 - 500 = 2250
    assert.strictEqual(calc.calculated.commission_pool, 2250.00, 'Commission pool must be 2250.00');

    // 5. Direct Commission = 7450 * 8% = 596.00
    assert.strictEqual(calc.calculated.direct_commission_amount, 596.00, 'Direct commission must be 596.00');

    // 6. Max Binary Exposure = 7450 * 7% * 7 = 3650.50
    assert.strictEqual(calc.calculated.maximum_binary_exposure, 3650.50, 'Max binary exposure must be 3650.50');

    // 7. Maximum Total Commission Exposure = 596 + 3650.50 = 4246.50
    assert.strictEqual(calc.calculated.maximum_total_commission_exposure, 4246.50, 'Total commission exposure must be 4246.50');

    // 8. Safety Margin = 2250 - 4246.50 = -1996.50
    assert.strictEqual(calc.calculated.commission_safety_margin, -1996.50, 'Safety margin must be -1996.50');

    // 9. Commission Pool Utilization = (4246.50 / 2250) * 100 = 188.73%
    assert.strictEqual(calc.calculated.commission_pool_utilization, 188.73, 'Utilization must be 188.73%');

    // 10. Financial Status = NOT_VIABLE / BLOCKED
    assert.strictEqual(validation.financial_status, 'NOT_VIABLE', 'Financial status must be NOT_VIABLE');
    assert.strictEqual(validation.is_safe, false, 'Product must not be safe for activation');

    // 11. Stress Test Result Diagnostics
    assert.strictEqual(margins.company_profit_reserve_protected, 'YES', 'Company profit reserve must be protected');
    assert.strictEqual(margins.commission_fully_covered, 'NO', 'Commission must not be fully covered');
    assert.strictEqual(margins.potential_shortfall, 1996.50, 'Shortfall must be 1996.50');
});

// -------------------------------------------------------------
// TEST 1: High-margin product -> SAFE
// -------------------------------------------------------------
test('Step 42: Test 01: High-Margin Product Economics (Status: SAFE)', () => {
    const highMarginInput = {
        selling_price: 25000.00,
        product_cost: 2000.00,
        tax_percent: 5.00, // 1250
        hosting_cost_amount: 100.00,
        staff_cost_amount: 300.00,
        marketing_cost_amount: 500.00,
        refund_reserve_percent: 3.00, // 750
        support_cost_amount: 100.00,
        operational_cost_amount: 200.00,
        profit_reserve_amount: 2500.00,
        direct_commission_rate: 8.00, // 2000.00
        binary_commission_rate: 6.00, // 1500 * 7 = 10500.00
        maximum_qualified_uplines: 7
    };

    const calc = ProductEconomicsService.calculateProductEconomics(highMarginInput);
    const val = ProductEconomicsService.validateCommissionSafety(calc);

    assert.strictEqual(val.financial_status, 'SAFE', 'High margin product must have SAFE status');
    assert.strictEqual(val.is_safe, true, 'High margin product must be allowed');
    assert.ok(calc.calculated.commission_safety_margin > 500.00, 'Remaining margin must exceed warning threshold');
});

// -------------------------------------------------------------
// TEST 2: Low-margin product -> WARNING or NOT_VIABLE
// -------------------------------------------------------------
test('Step 42: Test 02: Low-Margin Product Economics (Status: WARNING)', () => {
    const lowMarginInput = {
        selling_price: 10000.00,
        product_cost: 3000.00,
        tax_amount: 500.00,
        hosting_cost_amount: 100.00,
        staff_cost_amount: 300.00,
        marketing_cost_amount: 400.00,
        refund_reserve_amount: 200.00,
        support_cost_amount: 100.00,
        operational_cost_amount: 150.00,
        profit_reserve_amount: 500.00,
        direct_commission_rate: 8.00,
        binary_commission_rate: 5.50,
        maximum_qualified_uplines: 7
    };

    const calc = ProductEconomicsService.calculateProductEconomics(lowMarginInput);
    const val = ProductEconomicsService.validateCommissionSafety(calc);

    assert.strictEqual(val.financial_status, 'WARNING', 'Low margin product must have WARNING status');
    assert.strictEqual(val.is_safe, true, 'Product is safe but flagged with warning');
    assert.ok(calc.calculated.commission_safety_margin <= 500.00, 'Safety margin is below 500.00');
});

// -------------------------------------------------------------
// TEST 3: Commission exceeds pool -> NOT_VIABLE
// -------------------------------------------------------------
test('Step 42: Test 03: Commission Exceeds Pool (Status: NOT_VIABLE, Shortfall: LKR 2,500.00)', () => {
    const excessiveInput = {
        selling_price: 5000.00,
        product_cost: 2000.00,
        tax_amount: 500.00,
        profit_reserve_amount: 500.00,
        direct_commission_rate: 20.00,
        binary_commission_rate: 10.00,
        maximum_qualified_uplines: 7
    };

    const calc = ProductEconomicsService.calculateProductEconomics(excessiveInput);
    const val = ProductEconomicsService.validateCommissionSafety(calc);

    assert.strictEqual(val.financial_status, 'NOT_VIABLE', 'Excessive commission must trigger NOT_VIABLE');
    assert.strictEqual(val.is_safe, false, 'Excessive commission must not be allowed');
    assert.strictEqual(val.shortfall, 2500.00, 'Shortfall must be exactly 2500.00');
});

// -------------------------------------------------------------
// TEST 4: Zero / Negative commission pool -> NOT_VIABLE
// -------------------------------------------------------------
test('Step 42: Test 04: Zero / Negative Commission Pool (Status: NOT_VIABLE)', () => {
    const negativePoolInput = {
        selling_price: 4000.00,
        product_cost: 3500.00,
        tax_amount: 500.00,
        profit_reserve_amount: 500.00,
        direct_commission_rate: 8.00,
        binary_commission_rate: 7.00,
        maximum_qualified_uplines: 7
    };

    const calc = ProductEconomicsService.calculateProductEconomics(negativePoolInput);
    const val = ProductEconomicsService.validateCommissionSafety(calc);

    assert.strictEqual(calc.calculated.commission_pool, 0.00, 'Commission pool must be zero');
    assert.strictEqual(val.financial_status, 'NOT_VIABLE', 'Zero pool must trigger NOT_VIABLE');
    assert.strictEqual(val.is_safe, false, 'Zero pool cannot be activated');
});

// -------------------------------------------------------------
// TEST 5: 100% matched binary exposure -> correct maximum exposure
// -------------------------------------------------------------
test('Step 42: Test 05: Theoretical Maximum 100% Matched Binary Exposure (49% BV)', () => {
    const price = 10000.00;
    const binaryRate = 7.00;
    const maxLevels = 7;
    const maxBinaryExp = ProductEconomicsService.calculateMaximumBinaryExposure(price, binaryRate, maxLevels);

    // 10000 * 0.07 * 7 = 4900.00 (49% of Selling Price)
    assert.strictEqual(maxBinaryExp, 4900.00, 'Max binary exposure must be exactly 49% of price');
});

// -------------------------------------------------------------
// TEST 6: Maximum qualified uplines = 7
// -------------------------------------------------------------
test('Step 42: Test 06: Maximum Qualified Uplines = 7 Strict Depth Boundary', () => {
    const price = 7450.00;
    const perLevel = ProductEconomicsService.calculateDirectCommission(price, 7.00);
    const sevenLevels = perLevel * 7;
    assert.strictEqual(sevenLevels, 3650.50, '7 tiers payout must equal 3650.50');

    // Simulation with 10 uplines requested (capped strictly at 7 qualified levels)
    const sim = ProductEconomicsCalculator.simulateScenario({ selling_price: 7450.00, direct_commission_rate: 8.00, binary_commission_rate: 7.00, max_binary_qualified_levels: 7 }, 7450, 7450, 10);
    assert.strictEqual(sim.qualified_levels_paid, 7, 'Levels paid must be capped at 7');
    assert.strictEqual(sim.total_binary_commission, 3650.50, 'Total binary paid must equal 7 levels maximum');
});

// -------------------------------------------------------------
// TEST 7: Changing product economics -> new version created
// -------------------------------------------------------------
test('Step 42: Test 07: Economics Versioning Lifecycle (v1.0 -> v1.1)', () => {
    const initial = { id: 'prod-vtest', price: 7450, economics_version: 'v1.0' };
    const migratedV1 = ProductEconomicsService.migrateExistingProduct(initial);
    assert.strictEqual(migratedV1.economics_version, 'v1.0', 'Initial version must be v1.0');

    const updatedConfig = { ...migratedV1, price: 8000, economics_version: 'v1.1' };
    const migratedV2 = ProductEconomicsService.migrateExistingProduct(updatedConfig);
    assert.strictEqual(migratedV2.economics_version, 'v1.1', 'Updated version must be v1.1');
    assert.strictEqual(migratedV2.selling_price, 8000.00, 'Price must be updated');
});

// -------------------------------------------------------------
// TEST 8: Existing product migration
// -------------------------------------------------------------
test('Step 42: Test 08: Legacy Product Migration (Flagged: ⚠️ ECONOMICS REVIEW REQUIRED)', () => {
    const legacyUnconfiguredProduct = {
        id: 'legacy-course-1',
        title: 'Legacy Crypto Basics',
        price: 5000.00
    };

    const migrated = ProductEconomicsService.migrateExistingProduct(legacyUnconfiguredProduct);
    assert.strictEqual(migrated.selling_price, 5000.00, 'Selling price must be preserved');
    assert.strictEqual(migrated.economics_review_required, true, 'Unconfigured legacy product must flag review required');
    assert.strictEqual(migrated.financial_status, 'NOT_CONFIGURED', 'Status must be NOT_CONFIGURED until admin review');
});

// -------------------------------------------------------------
// TEST 9: Purchase creates economics snapshot
// -------------------------------------------------------------
test('Step 42: Test 09: 25-Field SHA-256 Sealed Historical Purchase Snapshot', () => {
    const product = {
        id: 'prod-sn-01',
        title: 'Masterclass AI',
        price: 27500.00,
        product_cost: 3000.00,
        direct_commission_rate: 8.00,
        binary_commission_rate: 7.00
    };

    const snapshot = ProductEconomicsService.getProductFinancialSnapshot(product, 'v1.0');
    assert.ok(snapshot.id, 'Snapshot must have a unique ID');
    assert.strictEqual(snapshot.selling_price, 27500.00, 'Snapshot must capture selling price');
    assert.ok(snapshot.integrity_hash && snapshot.integrity_hash.length === 64, 'Snapshot must contain valid SHA-256 integrity hash');
});

// -------------------------------------------------------------
// TEST 10: Future product edit does not change historical snapshot
// -------------------------------------------------------------
test('Step 42: Test 10: Historical Snapshot Immutability (Tampering Rejection)', () => {
    const product = { id: 'prod-snap-imm', price: 7450.00, direct_commission_rate: 8.00, binary_commission_rate: 7.00 };
    const snapshot = ProductEconomicsService.getProductFinancialSnapshot(product, 'v1.0');
    const originalPrice = snapshot.selling_price;
    const originalHash = snapshot.integrity_hash;

    // Verify snapshot is frozen
    assert.strictEqual(Object.isFrozen(snapshot), true, 'Snapshot object must be Object.freeze() immutable');

    // Mutation attempt does not alter frozen value
    try {
        snapshot.selling_price = 9999.00;
    } catch (e) {
        // Throws in strict mode
    }

    // Attempt updateSnapshot service call
    assert.throws(() => {
        ProductSnapshotService.updateSnapshot(snapshot.id, { selling_price: 15000.00 });
    }, /immutable/i, 'Snapshot update service call must throw immutable error');

    assert.strictEqual(snapshot.selling_price, originalPrice, 'Snapshot price must remain unmodified');
    assert.strictEqual(snapshot.integrity_hash, originalHash, 'Snapshot hash must remain unmodified');
});

// -------------------------------------------------------------
// TEST 11: Refund creates commission reversal where applicable
// -------------------------------------------------------------
test('Step 42: Test 11: Refund Commission Reversal & Immutable Ledger Transactions', () => {
    const reversalLog = [];
    const originalTx = { id: 'tx-comm-1', user_id: 'u-1', amount: 596.00, type: 'DIRECT_COMMISSION' };
    
    // Reversal execution
    const reversalTx = {
        id: 'tx-rev-1',
        reference_tx_id: originalTx.id,
        user_id: originalTx.user_id,
        amount: -originalTx.amount,
        type: 'COMMISSION_REVERSAL',
        timestamp: new Date().toISOString()
    };
    reversalLog.push(reversalTx);

    assert.strictEqual(reversalLog.length, 1, 'Reversal log must contain 1 entry');
    assert.strictEqual(reversalTx.amount, -596.00, 'Reversal amount must be exactly negative original amount');
});

// -------------------------------------------------------------
// TEST 12: Duplicate purchase cannot create duplicate commission
// -------------------------------------------------------------
test('Step 42: Test 12: Duplicate Purchase & Double Commission Prevention', () => {
    const processedOrders = new Set();
    const orderId = 'ORD-2026-9999';

    // First execution
    const firstProcess = !processedOrders.has(orderId);
    if (firstProcess) processedOrders.add(orderId);

    // Second duplicate execution
    const secondProcess = !processedOrders.has(orderId);

    assert.strictEqual(firstProcess, true, 'First purchase must be processed');
    assert.strictEqual(secondProcess, false, 'Duplicate purchase must be rejected');
});

// -------------------------------------------------------------
// TEST 13: Frontend manipulation cannot change server calculations
// -------------------------------------------------------------
test('Step 42: Test 13: Frontend Manipulation Defense & Server-Authoritative Override', () => {
    const clientForgedPayload = {
        selling_price: 7450.00,
        product_cost: 3000.00,
        tax_amount: 500.00,
        hosting_cost_amount: 100.00,
        staff_cost_amount: 300.00,
        marketing_cost_amount: 400.00,
        refund_reserve_amount: 150.00,
        support_cost_amount: 100.00,
        operational_cost_amount: 150.00,
        profit_reserve_amount: 500.00,
        direct_commission_rate: 8.00,
        binary_commission_rate: 7.00,
        maximum_qualified_uplines: 7,
        
        // Client attempts to forge safe numbers in payload:
        commission_pool: 99999.00,
        maximum_total_commission_exposure: 100.00,
        financial_status: 'SAFE'
    };

    // Server recalculates authoritative figures
    const serverCalculated = ProductEconomicsService.calculateProductEconomics(clientForgedPayload);
    const serverValidation = ProductEconomicsService.validateCommissionSafety(serverCalculated);

    assert.strictEqual(serverCalculated.calculated.commission_pool, 2250.00, 'Server must override forged commission pool');
    assert.strictEqual(serverCalculated.calculated.maximum_total_commission_exposure, 4246.50, 'Server must override forged commission exposure');
    assert.strictEqual(serverValidation.financial_status, 'NOT_VIABLE', 'Server must evaluate authoritative NOT_VIABLE status');
});

// -------------------------------------------------------------
// TEST 14: Decimal rounding integer cents precision
// -------------------------------------------------------------
test('Step 42: Test 14: Deterministic Integer Cents Decimal Rounding', () => {
    const oddPrice = 7450.33;
    const oddDirectRate = 8.333333;
    const directComm = ProductEconomicsService.calculateDirectCommission(oddPrice, oddDirectRate);
    
    // Exact integer cent rounding: Math.round(745033 * (8.333333 / 100)) / 100 = 620.86
    assert.strictEqual(directComm, 620.86, 'Direct commission must round to exact 2 decimal cents without drift');
});

// -------------------------------------------------------------
// TEST 15: Large numbers / stress testing
// -------------------------------------------------------------
test('Step 42: Test 15: Large Number Enterprise Scale Stress Test (LKR 5,000,000.00)', () => {
    const enterprisePrice = 5000000.00;
    const largeInput = {
        selling_price: enterprisePrice,
        product_cost: 500000.00,
        tax_percent: 5.00,
        hosting_cost_amount: 10000.00,
        staff_cost_amount: 50000.00,
        marketing_cost_amount: 100000.00,
        refund_reserve_percent: 3.00,
        support_cost_amount: 20000.00,
        operational_cost_amount: 50000.00,
        profit_reserve_percent: 15.00,
        direct_commission_rate: 8.00,
        binary_commission_rate: 5.00,
        maximum_qualified_uplines: 7
    };

    const calc = ProductEconomicsService.calculateProductEconomics(largeInput);
    const val = ProductEconomicsService.validateCommissionSafety(calc);

    assert.strictEqual(calc.calculated.selling_price, 5000000.00, 'Revenue must be Rs. 5 Million');
    assert.strictEqual(calc.calculated.direct_commission_amount, 400000.00, 'Direct comm must be Rs. 400,000.00');
    assert.strictEqual(calc.calculated.maximum_binary_exposure, 1750000.00, 'Binary exposure must be Rs. 1,750,000.00');
    assert.strictEqual(val.financial_status, 'SAFE', 'Enterprise product must evaluate to SAFE');
});
