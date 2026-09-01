// Hapanamy.lk Bank Reconciliation & Company Accounting Engine (STEP 15 & 16)
// Provides daily bank deposit matching, duplicate slip detection, missing deposit scans,
// and authoritative Company Net Accounting Position (Revenue - Costs - Commissions - Refunds - Charges = Net).

const ReconciliationService = {
    /**
     * Executes daily bank statement reconciliation against system purchase records.
     */
    reconcileBankDeposits(bankStatements = [], systemDeposits = []) {
        const matched = [];
        const unmatchedBankRecords = [];
        const missingSystemRecords = [];
        const duplicateSlips = [];

        const slipHashMap = new Map();

        // 1. Duplicate Slip Detection
        systemDeposits.forEach(dep => {
            if (dep.slip_hash) {
                if (slipHashMap.has(dep.slip_hash)) {
                    duplicateSlips.push({
                        deposit_id: dep.id,
                        original_id: slipHashMap.get(dep.slip_hash),
                        slip_hash: dep.slip_hash
                    });
                } else {
                    slipHashMap.set(dep.slip_hash, dep.id);
                }
            }
        });

        // 2. Match Bank Statement Transactions by Bank Reference & Amount
        bankStatements.forEach(bTx => {
            const match = systemDeposits.find(s => 
                (s.bank_reference && s.bank_reference.trim() === bTx.reference.trim()) &&
                Math.abs(s.amount - bTx.amount) < 0.01
            );

            if (match) {
                matched.push({
                    bank_tx_id: bTx.id,
                    system_deposit_id: match.id,
                    amount: bTx.amount,
                    reference: bTx.reference,
                    date: bTx.date,
                    status: 'RECONCILED'
                });
            } else {
                unmatchedBankRecords.push(bTx);
            }
        });

        // 3. Find Approved System Deposits not in Bank Statement
        systemDeposits.forEach(s => {
            if (s.status === 'APPROVED') {
                const found = matched.some(m => m.system_deposit_id === s.id);
                if (!found) {
                    missingSystemRecords.push(s);
                }
            }
        });

        return {
            timestamp: new Date().toISOString(),
            total_bank_records: bankStatements.length,
            total_system_records: systemDeposits.length,
            reconciled_count: matched.length,
            unmatched_bank_count: unmatchedBankRecords.length,
            missing_in_bank_count: missingSystemRecords.length,
            duplicate_slips_count: duplicateSlips.length,
            matched,
            unmatchedBankRecords,
            missingSystemRecords,
            duplicateSlips
        };
    },

    /**
     * Calculates Authoritative Company Accounting Net Position.
     * Formula:
     * Gross Sales Revenue
     * - Product Direct Cost
     * - Direct Commissions Paid
     * - Binary Commissions Paid
     * - Net Refunds
     * - Payment Gateway & Bank Charges
     * - Operating Expenses Reserve
     * = Net Company Operating Position
     */
    calculateCompanyNetPosition({
        purchases = [],
        walletLedger = [],
        refunds = [],
        paymentGatewayFeePercent = 1.5,
        operatingExpensePercent = 5.0
    } = {}) {
        let totalGrossSales = 0.00;
        let totalProductCost = 0.00;
        let totalDirectCommissions = 0.00;
        let totalBinaryCommissions = 0.00;
        let totalRefundsAmount = 0.00;

        // 1. Gross Sales & Cost
        purchases.forEach(p => {
            if (p.status === 'APPROVED' || p.status === 'ACTIVE' || p.status === 'COMPLETED') {
                totalGrossSales += Number(p.price_paid || p.price || 0);
                totalProductCost += Number(p.product_cost || (p.snapshot ? p.snapshot.product_cost : 0) || 0);
            }
        });

        // 2. Commissions from Ledger
        walletLedger.forEach(tx => {
            if (tx.status === 'COMPLETED') {
                if (tx.type === 'DIRECT_COMMISSION' || tx.type === 'DIRECT') {
                    totalDirectCommissions += Math.abs(Number(tx.amount || 0));
                } else if (tx.type === 'BINARY_COMMISSION' || tx.type === 'BINARY') {
                    totalBinaryCommissions += Math.abs(Number(tx.amount || 0));
                }
            }
        });

        // 3. Refunds from Ledger/Refund records
        refunds.forEach(r => {
            if (r.status === 'APPROVED' || r.status === 'REFUNDED') {
                totalRefundsAmount += Number(r.refund_amount || r.amount || 0);
            }
        });

        // 4. Financial Deductions & Operating Expenses
        const paymentGatewayFees = (totalGrossSales * paymentGatewayFeePercent) / 100;
        const operatingExpenses = (totalGrossSales * operatingExpensePercent) / 100;
        const totalCommissions = totalDirectCommissions + totalBinaryCommissions;

        const netCompanyPosition = totalGrossSales - (
            totalProductCost +
            totalCommissions +
            totalRefundsAmount +
            paymentGatewayFees +
            operatingExpenses
        );

        return {
            currency: 'LKR',
            total_gross_sales: totalGrossSales,
            deductions: {
                total_product_cost: totalProductCost,
                total_direct_commissions: totalDirectCommissions,
                total_binary_commissions: totalBinaryCommissions,
                total_commissions: totalCommissions,
                total_refunds: totalRefundsAmount,
                payment_gateway_fees: paymentGatewayFees,
                operating_expenses: operatingExpenses
            },
            net_company_position: Math.round(netCompanyPosition * 100) / 100,
            net_company_margin_percent: totalGrossSales > 0 
                ? ((netCompanyPosition / totalGrossSales) * 100).toFixed(2) + '%' 
                : '0.00%',
            is_profitable: netCompanyPosition > 0
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = ReconciliationService;
}
