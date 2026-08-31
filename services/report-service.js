// Hapanamy.lk Reporting & Analytics Service
// Implements reporting aggregates, query filters, pagination, and CSV exporters

const ReportService = {
    /**
     * Filters and paginates database logs or lists based on parameters.
     */
    generateReport(dataset, filters = {}) {
        let results = [...dataset];

        // 1. Date Range Filter
        if (filters.startDate) {
            const start = new Date(filters.startDate).getTime();
            results = results.filter(row => {
                const date = new Date(row.created_at || row.timestamp || Date.now()).getTime();
                return date >= start;
            });
        }
        if (filters.endDate) {
            const end = new Date(filters.endDate).getTime();
            results = results.filter(row => {
                const date = new Date(row.created_at || row.timestamp || Date.now()).getTime();
                return date <= end;
            });
        }

        // 2. Product ID Filter
        if (filters.productId) {
            results = results.filter(row => row.product_id === filters.productId || row.reference_id === filters.productId);
        }

        // 3. User ID Filter
        if (filters.userId) {
            results = results.filter(row => row.user_id === filters.userId);
        }

        // 4. Status Filter
        if (filters.status) {
            results = results.filter(row => row.status === filters.status);
        }

        // Aggregate stats
        const totalCount = results.length;
        const totalAmount = results.reduce((sum, row) => sum + parseFloat(row.amount || row.price || row.price_paid || 0), 0);

        // Pagination (avoid loading all records into response)
        const limit = parseInt(filters.limit || 10);
        const offset = parseInt(filters.offset || 0);
        const paginatedData = results.slice(offset, offset + limit);

        return {
            totalCount,
            totalAmount,
            data: paginatedData,
            limit,
            offset
        };
    },

    /**
     * Converts JSON report data to CSV format.
     */
    exportToCSV(data) {
        if (!data || data.length === 0) return 'No data available';
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];

        data.forEach(row => {
            const values = headers.map(header => {
                const val = row[header];
                const escaped = ('' + val).replace(/"/g, '\\"');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        });

        return csvRows.join('\n');
    }
};

if (typeof module !== 'undefined') {
    module.exports = ReportService;
}
