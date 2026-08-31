// Hapanamy Product Economics Database Schema Validation Tests
const testRunner = require('./test-runner');
const fs = require('fs');
const path = require('path');

let schemaContent = '';

before(() => {
    const schemaPath = path.join(__dirname, '../sql/schema.sql');
    schemaContent = fs.readFileSync(schemaPath, 'utf8');
});

test('Schema should define all product economics pricing columns', () => {
    assert(schemaContent.includes('market_price DECIMAL'), 'Should declare market_price column');
    assert(schemaContent.includes('pricing_mode VARCHAR'), 'Should declare pricing_mode column');
    assert(schemaContent.includes('discount_type VARCHAR'), 'Should declare discount_type column');
    assert(schemaContent.includes('discount_value DECIMAL'), 'Should declare discount_value column');
});

test('Schema should define cost and reserves columns', () => {
    assert(schemaContent.includes('product_cost DECIMAL'), 'Should declare product_cost column');
    assert(schemaContent.includes('minimum_company_profit DECIMAL'), 'Should declare minimum_company_profit column');
    assert(schemaContent.includes('operating_cost_reserve DECIMAL'), 'Should declare operating_cost_reserve');
    assert(schemaContent.includes('payment_processing_reserve DECIMAL'), 'Should declare payment_processing_reserve');
    assert(schemaContent.includes('refund_risk_reserve DECIMAL'), 'Should declare refund_risk_reserve');
    assert(schemaContent.includes('tax_reserve DECIMAL'), 'Should declare tax_reserve');
    assert(schemaContent.includes('other_reserve DECIMAL'), 'Should declare other_reserve');
    assert(schemaContent.includes('commission_safety_buffer DECIMAL'), 'Should declare commission_safety_buffer');
});

test('Schema should define commission configuration parameters', () => {
    assert(schemaContent.includes('max_binary_qualified_levels INTEGER'), 'Should declare max_binary_qualified_levels');
    assert(schemaContent.includes('commission_mode VARCHAR'), 'Should declare commission_mode column');
});

test('Schema should define validation checks and constraints', () => {
    assert(schemaContent.includes('economics_status VARCHAR'), 'Should declare economics_status column');
    assert(schemaContent.includes('validation_status VARCHAR'), 'Should declare validation_status column');
    assert(schemaContent.includes('blocked_reason TEXT'), 'Should declare blocked_reason column');
});

if (require.main === module) {
    runTests();
}
