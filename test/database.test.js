// Unit tests to verify the integrity and constraints of Hapanamy Database Schema
const fs = require('fs');
const path = require('path');
const testRunner = require('./test-runner');

const schemaPath = path.join(__dirname, '../sql/schema.sql');
let schemaSQL = '';

before(() => {
    assert(fs.existsSync(schemaPath), 'schema.sql migration file must exist');
    schemaSQL = fs.readFileSync(schemaPath, 'utf8');
});

test('Schema should define all 21 core entities', () => {
    const requiredTables = [
        'users',
        'user_profiles',
        'kyc_documents',
        'bank_accounts',
        'sponsors',
        'binary_nodes',
        'products',
        'product_purchases',
        'payment_deposits',
        'binary_volume_ledger',
        'binary_matches',
        'commission_transactions',
        'wallets',
        'wallet_transactions',
        'withdrawal_requests',
        'refund_requests',
        'notifications',
        'audit_logs',
        'settings',
        'fraud_alerts'
    ];

    requiredTables.forEach(tableName => {
        const regex = new RegExp(`CREATE\\s+TABLE\\s+${tableName}\\b`, 'i');
        assert(regex.test(schemaSQL), `Schema must contain table definition for: ${tableName}`);
    });
});

test('Schema must use DECIMAL for all financial/monetary amounts (No floating-point allowed)', () => {
    // Find column declarations containing monetary words and verify they are DECIMAL, not FLOAT or DOUBLE
    const lines = schemaSQL.split('\n');
    const moneyColumns = [
        'price',
        'price_paid',
        'amount',
        'available_balance',
        'pending_balance',
        'withdrawn_amount',
        'matched_amount',
        'commission_distributed',
        'direct_commission_percent',
        'binary_commission_percent'
    ];

    lines.forEach((line, idx) => {
        moneyColumns.forEach(colName => {
            if (line.toLowerCase().includes(colName) && (line.toLowerCase().includes('float') || line.toLowerCase().includes('double') || line.toLowerCase().includes('real'))) {
                throw new Error(`Monetary column violation on line ${idx + 1}: "${line.trim()}". Financial columns must strictly use DECIMAL or INT.`);
            }
        });
    });
});

test('Schema must include referential constraints preventing self-referral and self-placement', () => {
    // Check for chk_no_self_sponsor and chk_no_self_placement constraints
    assert(schemaSQL.includes('chk_no_self_sponsor'), 'Schema must define check constraint to prevent self-sponsorship');
    assert(schemaSQL.includes('chk_no_self_placement'), 'Schema must define check constraint to prevent self-placement loops');
});

test('Schema must contain initial settings and admin seed data', () => {
    assert(schemaSQL.includes('admin@hapanamy.lk'), 'Schema must seed default administrator email');
    assert(schemaSQL.includes('daily_earning_limit'), 'Schema must seed global daily payout limit config');
    assert(schemaSQL.includes('Facebook Monetisation Course'), 'Schema must seed sample product catalog data');
});

if (require.main === module) {
    runTests();
}
