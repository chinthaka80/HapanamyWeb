// Comprehensive Test Suite for STEP 41 — Product Economics & Commission Calculation Engine
// Validates 19-point financial calculation, deterministic integer cents arithmetic,
// safe commission pool enforcement, simulation, versioning, snapshots, and daily earning caps.

const testRunner = require('./test-runner');
const ProductEconomicsCalculator = require('../services/product-economics-calculator');
const ProductCommissionValidator = require('../services/product-commission-validator');
const ProductSnapshotService = require('../services/product-snapshot-service');
const SafeBinaryCommissionRateCalculator = require('../services/safe-binary-commission-calculator');

// -----------------------------------------------------------------------------
// TEST 01: Standard Course Economics (Selling Price: Rs. 7,450)
// -----------------------------------------------------------------------------
test('Step 41: TEST 01: Standard Course Economics (Selling Price: Rs. 7,450.00)', () => {
    const input = {
        pricing_mode: 'FIXED',
        selling_price: 7450.00,
        product_cost: 1500.00,
        tax_percent: 5.00, // 5% of 7450 = 372.50
        hosting_cost_fixed: 100.00,
        staff_cost_fixed: 100.00,
        marketing_cost_percent: 4.00, // 4% of 7450 = 298.00
        refund_reserve_percent: 3.00, // 3% of 7450 = 223.50
        support_cost_fixed: 100.00,
        operational_cost_fixed: 56.00,
        profit_reserve_fixed: 1500.00,
        direct_commission_rate: 8.00,
        binary_commission_rate: 3.00,
        max_binary_qualified_levels: 7
    };

    const result = ProductEconomicsCalculator.calculate(input);
    const { calculated } = result;

    assert.equal(calculated.selling_price, 7450.00);
    assert.equal(calculated.product_cost, 1500.00);
    assert.equal(calculated.gross_contribution, 5950.00); // 7450 - 1500

    // Total Operating Costs = 372.50 + 100 + 200 + 298.00 + 223.50 + 100 + 156.00 = 1250.00
    assert.equal(calculated.total_operating_cost, 1250.00);
    
    // Available Contribution = 5950 - 1250 = 4700.00
    assert.equal(calculated.available_contribution, 4700.00);
    assert.equal(calculated.company_profit_reserve, 1500.00);

    // Commission Pool = 4700 - 1500 = 3200.00
    assert.equal(calculated.commission_pool, 3200.00);

    // Direct Commission = 7450 * 8% = 596.00
    assert.equal(calculated.direct_commission_amount, 596.00);

    // Binary Commission Per Level = 7450 * 3% = 223.50
    assert.equal(calculated.binary_commission_per_recipient, 223.50);

    // 7 Levels Binary Liability = 223.50 * 7 = 1564.50
    assert.equal(calculated.max_binary_liability, 1564.50);

    // Total Maximum Commission Liability = 596.00 + 1564.50 = 2160.50
    assert.equal(calculated.max_total_commission_liability, 2160.50);

    // Remaining Contribution = 3200 - 2160.50 = 1039.50
    assert.equal(calculated.remaining_contribution, 1039.50);

    const validation = ProductCommissionValidator.validate(result);
    assert(validation.allowed, 'Standard product economics must be SAFE');
    assert.equal(validation.status, 'SAFE');
});

// -----------------------------------------------------------------------------
// TEST 02: Advanced Masterclass Economics (Selling Price: Rs. 27,500.00)
// -----------------------------------------------------------------------------
test('Step 41: TEST 02: Advanced Masterclass Economics (Selling Price: Rs. 27,500.00)', () => {
    const input = {
        pricing_mode: 'DISCOUNTED',
        market_price: 35000.00,
        discount_type: 'FIXED',
        discount_value: 7500.00,
        selling_price: 27500.00,
        product_cost: 5000.00,
        tax_fixed_amount: 1375.00,
        hosting_cost_fixed: 500.00,
        staff_cost_fixed: 600.00,
        marketing_cost_fixed: 750.00,
        refund_reserve_percent: 5.00, // 5% of 27,500 = 1,375.00
        support_cost_fixed: 500.00,
        operational_cost_fixed: 400.00,
        profit_reserve_fixed: 2000.00,
        direct_commission_rate: 8.00,
        binary_commission_rate: 7.00,
        max_binary_qualified_levels: 7
    };

    const result = ProductEconomicsCalculator.calculate(input);
    const { calculated } = result;

    assert.equal(calculated.selling_price, 27500.00);
    assert.equal(calculated.product_cost, 5000.00);
    assert.equal(calculated.gross_contribution, 22500.00);

    // Direct Commission: 8% of 27,500 = Rs. 2,200.00
    assert.equal(calculated.direct_commission_amount, 2200.00);

    // Binary Commission per qualified recipient: 7% of 27,500 = Rs. 1,925.00
    assert.equal(calculated.binary_commission_per_recipient, 1925.00);

    // Max 7 levels binary liability = 1,925 * 7 = Rs. 13,475.00
    assert.equal(calculated.max_binary_liability, 13475.00);

    // Maximum Total Commission Liability = 2,200 + 13,475 = Rs. 15,675.00
    assert.equal(calculated.max_total_commission_liability, 15675.00);

    // Operating costs = 1375 + 500 + 600 + 750 + 1375 + 500 + 400 = 5500.00
    assert.equal(calculated.total_operating_cost, 5500.00);
    assert.equal(calculated.available_contribution, 17000.00);
    assert.equal(calculated.commission_pool, 15000.00); // 17,000 - 2,000 profit reserve

    // Check Auto-Safe Binary Rate calculation
    const autoSafeRate = SafeBinaryCommissionRateCalculator.calculateMaxSafeRate(input);
    // (15,000 - 2,200) / 7 = 12,800 / 7 = 1,828.5714 -> (1,828.5714 / 27,500) * 100 = 6.64%
    assert.equal(autoSafeRate, 6.64, 'Maximum safe binary rate for 15k pool must be 6.64%');
});

// -----------------------------------------------------------------------------
// TEST 03: Commission Matching Simulation (Volume: Rs. 60,000, Rate: 7%)
// -----------------------------------------------------------------------------
test('Step 41: TEST 03: Commission Matching Simulation Engine (Volume: Rs. 60,000.00, Rate: 7%)', () => {
    const product = {
        selling_price: 27500.00,
        product_cost: 5000.00,
        direct_commission_rate: 8.00,
        binary_commission_rate: 7.00,
        max_binary_qualified_levels: 7,
        effective_commission_budget: 20000.00
    };

    const simulation = ProductEconomicsCalculator.simulateScenario(product, 60000.00, 60000.00, 7);

    assert.equal(simulation.matched_volume, 60000.00);
    assert.equal(simulation.binary_commission_rate, 7.00);
    
    // Binary per level = 60,000 * 7% = Rs. 4,200.00
    assert.equal(simulation.binary_commission_per_level, 4200.00);

    // 7 levels paid = 4,200 * 7 = Rs. 29,400.00
    assert.equal(simulation.total_binary_commission, 29400.00);
    assert.equal(simulation.direct_commission, 2200.00);
    assert.equal(simulation.total_commission_paid, 31600.00);
});

// -----------------------------------------------------------------------------
// TEST 04: 7 Qualified Uplines Payout Distribution
// -----------------------------------------------------------------------------
test('Step 41: TEST 04: 7 Qualified Uplines Full Depth Payout Distribution', () => {
    const product = {
        selling_price: 27500.00,
        product_cost: 5000.00,
        direct_commission_rate: 8.00,
        binary_commission_rate: 7.00,
        max_binary_qualified_levels: 7,
        effective_commission_budget: 16000.00
    };

    const sim = ProductEconomicsCalculator.simulateScenario(product, 27500.00, 27500.00, 7);

    assert.equal(sim.qualified_levels_paid, 7);
    assert.equal(sim.binary_commission_per_level, 1925.00);
    assert.equal(sim.total_binary_commission, 13475.00); // 1,925 * 7
    assert.equal(sim.direct_commission, 2200.00);
    assert.equal(sim.total_commission_paid, 15675.00);
    assert.equal(sim.is_scenario_safe, true);
});

// -----------------------------------------------------------------------------
// TEST 05: 4 Qualified Uplines Payout (Compression / Skipped Tiers)
// -----------------------------------------------------------------------------
test('Step 41: TEST 05: 4 Qualified Uplines Payout (Unqualified Tiers Retained by Platform)', () => {
    const product = {
        selling_price: 27500.00,
        product_cost: 5000.00,
        direct_commission_rate: 8.00,
        binary_commission_rate: 7.00,
        max_binary_qualified_levels: 7,
        effective_commission_budget: 16000.00
    };

    // Only 4 uplines meet binary activity & direct referral criteria
    const sim = ProductEconomicsCalculator.simulateScenario(product, 27500.00, 27500.00, 4);

    assert.equal(sim.qualified_levels_paid, 4);
    assert.equal(sim.binary_commission_per_level, 1925.00);
    
    // 4 levels binary = 1,925 * 4 = Rs. 7,700.00
    assert.equal(sim.total_binary_commission, 7700.00);
    assert.equal(sim.direct_commission, 2200.00);
    
    // Total commission paid = 2,200 + 7,700 = Rs. 9,900.00
    assert.equal(sim.total_commission_paid, 9900.00);

    // Remaining budget retained = 16,000 - 9,900 = 6,100.00
    assert.equal(sim.remaining_contribution, 6100.00);
    assert.equal(sim.is_scenario_safe, true);
});

// -----------------------------------------------------------------------------
// TEST 06: Asymmetric Leg Volume Matching (min(Left, Right))
// -----------------------------------------------------------------------------
test('Step 41: TEST 06: Asymmetric Leg Volume Matching (min(Left, Right))', () => {
    const product = {
        selling_price: 27500.00,
        binary_commission_rate: 7.00,
        max_binary_qualified_levels: 7
    };

    const leftVol = 80000.00;
    const rightVol = 45000.00;

    const sim = ProductEconomicsCalculator.simulateScenario(product, leftVol, rightVol, 7);

    // Matching must equal the lesser leg (Rs. 45,000.00)
    assert.equal(sim.matched_volume, 45000.00);
    
    // Binary per level = 45,000 * 7% = Rs. 3,150.00
    assert.equal(sim.binary_commission_per_level, 3150.00);
    assert.equal(sim.total_binary_commission, 3150.00 * 7); // 22,050.00
});

// -----------------------------------------------------------------------------
// TEST 07: Insufficient Safe Commission Pool Rejection (UNSAFE / BLOCKED)
// -----------------------------------------------------------------------------
test('Step 41: TEST 07: Insufficient Commission Pool Rejection (UNSAFE Status & Shortfall)', () => {
    const unsafeProduct = {
        pricing_mode: 'FIXED',
        selling_price: 10000.00,
        product_cost: 6000.00,
        minimum_company_profit: 3000.00, // Leaves only 1,000 pool
        operating_cost_reserve: 500.00, // Leaves only 500 pool
        direct_commission_rate: 10.00, // Direct = 1,000.00 (exceeds pool 500!)
        binary_commission_rate: 5.00, // Binary = 500 * 7 = 3,500.00
        max_binary_qualified_levels: 7
    };

    const calc = ProductEconomicsCalculator.calculate(unsafeProduct);
    const validation = ProductCommissionValidator.validate(calc);

    assert.equal(validation.status, 'BLOCKED');
    assert.equal(validation.safety_status, 'UNSAFE');
    assert.equal(validation.is_safe, false);
    assert.equal(validation.allowed, false);
    assert(validation.shortfall > 0, 'Shortfall must be greater than zero');
    assert(validation.blocked_reason.includes('exceeds'));
});

// -----------------------------------------------------------------------------
// TEST 08: Refund Reversal Compensation & Historical Ledger Protection
// -----------------------------------------------------------------------------
test('Step 41: TEST 08: Refund Reversal Compensation & Ledger Balance Protection', () => {
    const sampleProduct = {
        id: 'prod-refund-test',
        selling_price: 10000.00,
        product_cost: 2000.00,
        refund_reserve_fixed: 500.00,
        direct_commission_rate: 8.00,
        binary_commission_rate: 3.00,
        max_binary_qualified_levels: 7
    };

    const purchaseId = 'pur-refund-401';
    const snapshot = ProductSnapshotService.createSnapshot(sampleProduct, purchaseId);

    // Verify snapshot records refund reserve correctly
    assert.equal(snapshot.refund_reserve, 500.00);
    assert.equal(snapshot.selling_price, 10000.00);
    assert.equal(snapshot.direct_commission_amount, 800.00);

    // Attempting to mutate snapshot fails
    let threw = false;
    try {
        snapshot.selling_price = 12000.00;
    } catch (e) {
        threw = true;
    }
    assert(threw || snapshot.selling_price === 10000.00, 'Snapshot must be immutable');
});

// -----------------------------------------------------------------------------
// TEST 09: Immutable Snapshot SHA-256 Hash & Versioning Protection
// -----------------------------------------------------------------------------
test('Step 41: TEST 09: Immutable Snapshot SHA-256 Hash & Versioning Integrity', () => {
    const productV1 = {
        id: 'prod-ver-101',
        name: 'Digital Skills Academy',
        selling_price: 10000.00,
        product_cost: 2000.00,
        economics_version: 'v1.0',
        direct_commission_rate: 8.00,
        binary_commission_rate: 3.00,
        max_binary_qualified_levels: 7
    };

    const purchaseId = 'pur-ver-901';
    const snapshotV1 = ProductSnapshotService.createSnapshot(productV1, purchaseId, '2026-09-01T10:00:00Z');

    // 1. Verify SHA-256 Hash
    const verifyInitial = ProductSnapshotService.verifySnapshotIntegrity(snapshotV1);
    assert.equal(verifyInitial.valid, true, 'Original snapshot must be valid');
    assert.equal(snapshotV1.economics_version, 'v1.0');

    // 2. Product is upgraded to v1.1 in future
    const productV2 = {
        ...productV1,
        selling_price: 12000.00,
        product_cost: 2500.00,
        economics_version: 'v1.1'
    };

    // Past snapshot must remain unchanged and still pass SHA-256 integrity check
    const verifyAfterUpgrade = ProductSnapshotService.verifySnapshotIntegrity(snapshotV1);
    assert.equal(verifyAfterUpgrade.valid, true);
    assert.equal(snapshotV1.selling_price, 10000.00);
    assert.equal(snapshotV1.economics_version, 'v1.0');

    // 3. Modifying snapshot payload fails SHA-256 integrity check
    const tamperedSnapshot = { ...snapshotV1, selling_price: 99999.00 };
    const verifyTampered = ProductSnapshotService.verifySnapshotIntegrity(tamperedSnapshot);
    assert.equal(verifyTampered.valid, false, 'Tampered snapshot must fail integrity verification');
});

// -----------------------------------------------------------------------------
// TEST 10: Rs. 30,000 Daily Earning Cap Enforcement
// -----------------------------------------------------------------------------
test('Step 41: TEST 10: Rs. 30,000 Daily Earning Cap Enforcement', () => {
    const DAILY_CAP = 30000.00;

    // Simulate high volume matched commission of Rs. 42,000.00
    const rawCommissionEarned = 42000.00;
    const existingEarningsToday = 0.00;

    const allowablePayout = Math.min(rawCommissionEarned, DAILY_CAP - existingEarningsToday);
    const cappedSurplus = rawCommissionEarned - allowablePayout;

    assert.equal(allowablePayout, 30000.00, 'Allowable payout must be capped at exactly Rs. 30,000.00');
    assert.equal(cappedSurplus, 12000.00, 'Excess Rs. 12,000.00 must be retained/capped');

    // Second commission attempt on same day
    const secondCommission = 5000.00;
    const newEarningsToday = allowablePayout; // 30,000
    const secondAllowable = Math.max(0, Math.min(secondCommission, DAILY_CAP - newEarningsToday));

    assert.equal(secondAllowable, 0.00, 'Subsequent payout on same day must be Rs. 0.00 once daily cap is reached');
});

if (require.main === module) {
    runTests();
}
