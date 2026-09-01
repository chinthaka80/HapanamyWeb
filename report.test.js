// Hapanamy Reports & Analytics Unit Tests
const testRunner = require('./test-runner');
const ReportService = require('../services/report-service');

let sampleSales = [];

before(() => {
    sampleSales = [
        { id: '1', product_id: 'prod-fb-mon', price: 7450.00, user_id: 'user-1', status: 'ACTIVE', created_at: '2026-08-01T10:00:00Z' },
        { id: '2', product_id: 'prod-trading', price: 10000.00, user_id: 'user-2', status: 'ACTIVE', created_at: '2026-08-15T12:00:00Z' },
        { id: '3', product_id: 'prod-fb-mon', price: 7450.00, user_id: 'user-3', status: 'PENDING', created_at: '2026-08-20T08:00:00Z' }
    ];
});

test('ReportService filters data by date range correctly', () => {
    const report = ReportService.generateReport(sampleSales, {
        startDate: '2026-08-10',
        endDate: '2026-08-25'
    });
    
    assert.equal(report.totalCount, 2, 'Should find exactly 2 transactions within date range');
    assert.equal(report.data[0].id, '2');
});

test('ReportService aggregates total amount sums', () => {
    const report = ReportService.generateReport(sampleSales, {
        productId: 'prod-fb-mon'
    });

    assert.equal(report.totalCount, 2);
    assert.equal(report.totalAmount, 14900.00, 'Sum value of fb monetization courses should be 14900 LKR');
});

test('ReportService paginates results properly', () => {
    const report = ReportService.generateReport(sampleSales, {
        limit: 1,
        offset: 1
    });

    assert.equal(report.data.length, 1);
    assert.equal(report.data[0].id, '2');
});

test('ReportService exports records to CSV format string', () => {
    const csv = ReportService.exportToCSV([
        { id: '1', amount: 500 },
        { id: '2', amount: 300 }
    ]);

    assert(csv.includes('id,amount'));
    assert(csv.includes('"1","500"'));
});

if (require.main === module) {
    runTests();
}
