// Hapanamy Product Activation Firewall Unit Tests
const testRunner = require('./test-runner');
const ProductEconomicsCalculator = require('../services/product-economics-calculator');
const ProductCommissionValidator = require('../services/product-commission-validator');
const SafeBinaryCommissionRateCalculator = require('../services/safe-binary-commission-calculator');

// Simulated router helper resembling the server.js route handler logic
function simulateProductCreationFirewall(payload) {
    const pricing = {
        pricing_mode: payload.pricingMode || 'FIXED',
        market_price: parseFloat(payload.marketPrice || payload.price || 0.00),
        discount_type: payload.discountType || 'NONE',
        discount_value: parseFloat(payload.discountValue || 0.00),
        selling_price: parseFloat(payload.price || 0.00),
        product_cost: parseFloat(payload.productCost || 0.00),
        minimum_company_profit: parseFloat(payload.minimumCompanyProfit || 0.00),
        operating_cost_reserve: parseFloat(payload.operatingCostReserve || 0.00),
        payment_processing_reserve: parseFloat(payload.paymentProcessingReserve || 0.00),
        refund_risk_reserve: parseFloat(payload.refundRiskReserve || 0.00),
        tax_reserve: parseFloat(payload.taxReserve || 0.00),
        other_reserve: parseFloat(payload.otherReserve || 0.00),
        commission_safety_buffer: parseFloat(payload.commissionSafetyBuffer || 0.00),
        binary_volume: parseFloat(payload.binaryVolume || 0.00),
        direct_commission_rate: parseFloat(payload.directCommissionRate || payload.directCommission || 8.00),
        binary_commission_rate: parseFloat(payload.binaryCommissionRate || payload.binaryCommission || 7.00),
        max_binary_qualified_levels: parseInt(payload.maxBinaryQualifiedLevels || 7),
        commission_mode: payload.commissionMode || 'MANUAL'
    };

    const maxSafeRate = SafeBinaryCommissionRateCalculator.calculateMaxSafeRate(pricing);

    if (pricing.commission_mode === 'AUTO_SAFE') {
        pricing.binary_commission_rate = maxSafeRate;
    }

    const econCalc = ProductEconomicsCalculator.calculate(pricing);
    const validation = ProductCommissionValidator.validate(econCalc);

    const targetStatus = payload.status || 'ACTIVE';
    if (targetStatus === 'ACTIVE') {
        // 1. Check basic economics first
        if (validation.status === 'BLOCKED') {
            return {
                allowed: false,
                status: 'BLOCKED',
                blocked_reason: validation.blocked_reason,
                effective_commission_budget: econCalc.calculated.effective_commission_budget,
                maximum_commission_exposure: econCalc.calculated.max_total_commission_exposure,
                remaining_margin: econCalc.calculated.remaining_company_margin,
                maximum_safe_binary_rate: maxSafeRate,
                requested_binary_rate: pricing.binary_commission_rate
            };
        }

        // 2. Check manual commission rates second
        if (pricing.commission_mode === 'MANUAL' && pricing.binary_commission_rate > maxSafeRate) {
            return {
                allowed: false,
                status: 'BLOCKED',
                blocked_reason: `Manual binary commission rate ${pricing.binary_commission_rate}% exceeds maximum safe rate of ${maxSafeRate}%.`,
                requested_binary_rate: pricing.binary_commission_rate,
                maximum_safe_binary_rate: maxSafeRate,
                difference: Math.round((pricing.binary_commission_rate - maxSafeRate) * 100) / 100,
                expected_commission_exposure: econCalc.calculated.max_total_commission_exposure,
                effective_commission_budget: econCalc.calculated.effective_commission_budget,
                maximum_commission_exposure: econCalc.calculated.max_total_commission_exposure,
                remaining_margin: econCalc.calculated.remaining_company_margin
            };
        }
    }

    return {
        allowed: true,
        status: validation.status,
        product: {
            ...payload,
            price: econCalc.calculated.selling_price,
            binary_commission_percent: pricing.binary_commission_rate,
            economics_status: validation.status
        }
    };
}

test('Activation Firewall ALLOWS active product with safe economics parameters', () => {
    const payload = {
        name: 'Safe Course',
        code: 'SAFE-C',
        price: 10000.00,
        productCost: 1000.00,
        minimumCompanyProfit: 1000.00,
        binaryVolume: 10000.00,
        directCommissionRate: 5.00,
        binaryCommissionRate: 1.00, // Safe low rate
        maxBinaryQualifiedLevels: 7,
        status: 'ACTIVE'
    };

    const res = simulateProductCreationFirewall(payload);
    assert(res.allowed, 'Safe product should be allowed');
    assert.equal(res.status, 'SAFE');
});

test('Activation Firewall BLOCKS active product if cost exceeds selling price', () => {
    const payload = {
        name: 'Negative Profit Course',
        code: 'NEG-C',
        price: 5000.00,
        productCost: 6000.00, // Cost exceeds price
        status: 'ACTIVE'
    };

    const res = simulateProductCreationFirewall(payload);
    assert(!res.allowed, 'Negative profit course activation must be blocked');
    assert.equal(res.status, 'BLOCKED');
    assert(res.blocked_reason.includes('cost exceeds selling price'));
});

test('Activation Firewall BLOCKS active product if manual commission exceeds safe rate limit', () => {
    const payload = {
        name: 'High Comm Course',
        code: 'HIGH-C',
        price: 10000.00,
        productCost: 2000.00,
        minimumCompanyProfit: 2000.00,
        binaryVolume: 10000.00,
        directCommissionRate: 10.00,
        binaryCommissionRate: 15.00, // Safe is 10.00%
        maxBinaryQualifiedLevels: 5,
        status: 'ACTIVE'
    };

    const res = simulateProductCreationFirewall(payload);
    assert(!res.allowed, 'Excess manual commission rate must block activation');
    assert.equal(res.status, 'BLOCKED');
    assert.equal(res.maximum_safe_binary_rate, 10.00);
    assert.equal(res.requested_binary_rate, 15.00);
});

test('Activation Firewall ALLOWS blocked product if created in INACTIVE state', () => {
    const payload = {
        name: 'Inactive Blocked Course',
        code: 'INACT-B',
        price: 5000.00,
        productCost: 6000.00, // Economically blocked
        status: 'INACTIVE' // Draft status, not active
    };

    const res = simulateProductCreationFirewall(payload);
    assert(res.allowed, 'Unsafe product should be allowed to save in INACTIVE state');
    assert.equal(res.status, 'BLOCKED');
});

if (require.main === module) {
    runTests();
}
