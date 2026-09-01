// Hapanamy.lk Reports & Analytics Engine (STEP 28)
// Authoritative reporting based on immutable database ledgers, product economics snapshots,
// and double-entry bookkeeping records. Enforces RBAC permissions, audit logging, and export formatting.

const EarningsCapEngine = require('./earnings-cap-engine');
const QualificationEngine = require('./qualification-engine');
const WalletService = require('./wallet-service');
const VolumeLedger = require('./volume-ledger');
const KycService = require('./kyc-service');

const ALLOWED_ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'COMPLIANCE', 'AUDITOR'];

const ReportService = {
    /**
     * Verifies admin RBAC access.
     */
    verifyAdminAccess(requestingUser) {
        if (!requestingUser) {
            return { authorized: false, status: 401, error: 'Authentication required to access administrative reports.' };
        }
        const role = (requestingUser.role || '').toUpperCase();
        if (!ALLOWED_ADMIN_ROLES.includes(role)) {
            return { authorized: false, status: 403, error: '403 Forbidden: Administrative role required to access reports.' };
        }
        return { authorized: true, role };
    },

    /**
     * Verifies member tenant access (Admin or self).
     */
    verifyMemberReportAccess(requestingUser, targetUserId) {
        if (!requestingUser) {
            return { authorized: false, status: 401, error: 'Authentication required.' };
        }
        const role = (requestingUser.role || '').toUpperCase();
        if (ALLOWED_ADMIN_ROLES.includes(role)) {
            return { authorized: true, role };
        }
        if (requestingUser.id === targetUserId || requestingUser.username === targetUserId) {
            return { authorized: true, role: 'MEMBER_SELF' };
        }
        return { authorized: false, status: 403, error: '403 Forbidden: You cannot access another member\'s confidential report.' };
    },

    /**
     * Filters any dataset by standard criteria.
     */
    filterDataset(dataset = [], filters = {}) {
        let results = [...dataset];

        // 1. Date Range
        if (filters.startDate) {
            const start = new Date(filters.startDate).getTime();
            results = results.filter(row => {
                const date = new Date(row.created_at || row.timestamp || row.paid_at || Date.now()).getTime();
                return date >= start;
            });
        }
        if (filters.endDate) {
            const end = new Date(filters.endDate).getTime();
            results = results.filter(row => {
                const date = new Date(row.created_at || row.timestamp || row.paid_at || Date.now()).getTime();
                return date <= end;
            });
        }

        // 2. Product Filter
        if (filters.productId) {
            results = results.filter(row => row.product_id === filters.productId || row.reference_id === filters.productId);
        }

        // 3. Member / User Filter
        if (filters.userId) {
            results = results.filter(row => row.user_id === filters.userId || row.sponsor_id === filters.userId);
        }

        // 4. Commission Type Filter
        if (filters.commissionType) {
            results = results.filter(row => row.type === filters.commissionType || row.commission_type === filters.commissionType);
        }

        // 5. Status Filter
        if (filters.status) {
            results = results.filter(row => row.status === filters.status);
        }

        const totalCount = results.length;
        const totalAmount = results.reduce((sum, row) => sum + Math.abs(parseFloat(row.amount || row.price || row.selling_price || 0) || 0), 0);

        // Pagination
        const limit = filters.limit ? parseInt(filters.limit) : totalCount;
        const offset = filters.offset ? parseInt(filters.offset) : 0;
        const paginatedData = results.slice(offset, offset + limit);

        return {
            totalCount,
            totalAmount: Math.round(totalAmount * 100) / 100,
            data: paginatedData,
            limit,
            offset
        };
    },

    /**
     * FINANCIAL REPORTS
     * Generates authoritative financial reports derived directly from purchases and double-entry wallet ledger.
     */
    generateFinancialReport({
        requestingUser,
        purchases = [],
        walletLedger = [],
        withdrawals = [],
        products = [],
        filters = {},
        auditLogs = []
    }) {
        const auth = this.verifyAdminAccess(requestingUser);
        if (!auth.authorized) {
            throw new Error(auth.error);
        }

        // Filter purchases
        const filteredPurchasesResult = this.filterDataset(purchases, filters);
        const filteredPurchases = filteredPurchasesResult.data.filter(p => p.status === 'ACTIVE' || p.status === 'COMPLETED');

        let totalRevenue = 0;
        let totalProductCost = 0;
        const dailySalesMap = new Map();
        const monthlySalesMap = new Map();
        const productSalesMap = new Map();

        filteredPurchases.forEach(p => {
            const price = Number(p.selling_price) || (p.economics_snapshot ? Number(p.economics_snapshot.selling_price) : 0);
            const cost = p.economics_snapshot ? Number(p.economics_snapshot.product_cost || 0) : 0;
            const pDate = p.created_at ? new Date(p.created_at) : new Date();
            const { dayKey, monthKey } = EarningsCapEngine.getDateKeys(pDate);

            totalRevenue += price;
            totalProductCost += cost;

            // Daily aggregate
            dailySalesMap.set(dayKey, (dailySalesMap.get(dayKey) || 0) + price);

            // Monthly aggregate
            monthlySalesMap.set(monthKey, (monthlySalesMap.get(monthKey) || 0) + price);

            // Product sales breakdown
            const prodId = p.product_id || 'unknown';
            const prodName = p.economics_snapshot ? p.economics_snapshot.product_name : (p.product_name || prodId);
            const currentProd = productSalesMap.get(prodId) || {
                product_id: prodId,
                product_name: prodName,
                units_sold: 0,
                revenue: 0,
                product_cost: 0,
                gross_profit: 0
            };
            currentProd.units_sold += 1;
            currentProd.revenue += price;
            currentProd.product_cost += cost;
            currentProd.gross_profit += (price - cost);
            productSalesMap.set(prodId, currentProd);
        });

        const totalGrossProfit = totalRevenue - totalProductCost;

        // Authoritative Commission Totals from Wallet Ledger
        let totalCommissionPaid = 0;
        let totalCommissionPending = 0;

        walletLedger.forEach(tx => {
            const txType = (tx.type || '').toUpperCase();
            if (txType.includes('COMMISSION') && !txType.includes('REVERSAL')) {
                if (tx.status === 'COMPLETED') {
                    totalCommissionPaid += Math.abs(Number(tx.amount) || 0);
                } else if (tx.status === 'PENDING') {
                    totalCommissionPending += Math.abs(Number(tx.amount) || 0);
                }
            }
        });

        // Add pending withdrawal requests to commission liability
        withdrawals.forEach(w => {
            if (w.status === 'PENDING' || w.status === 'UNDER_REVIEW') {
                totalCommissionPending += Number(w.amount) || 0;
            }
        });

        const commissionLiability = Math.round((totalCommissionPaid + totalCommissionPending) * 100) / 100;
        const companyNetMarginEstimate = Math.round((totalGrossProfit - totalCommissionPaid) * 100) / 100;
        const profitMarginPercent = totalRevenue > 0
            ? Math.round((companyNetMarginEstimate / totalRevenue) * 10000) / 100
            : 0;

        // Audit Logging for Sensitive Export
        if (auditLogs) {
            KycService.logAction(auditLogs, requestingUser.id, 'REPORT_GENERATED', 'financial_reports', 'report-financial', null, { filters });
        }

        return {
            success: true,
            summary: {
                total_revenue: Math.round(totalRevenue * 100) / 100,
                total_product_cost: Math.round(totalProductCost * 100) / 100,
                total_gross_profit: Math.round(totalGrossProfit * 100) / 100,
                commission_paid: Math.round(totalCommissionPaid * 100) / 100,
                commission_pending: Math.round(totalCommissionPending * 100) / 100,
                commission_liability: commissionLiability,
                company_margin_estimate: companyNetMarginEstimate,
                profit_margin_percent: profitMarginPercent
            },
            daily_sales: Array.from(dailySalesMap.entries()).map(([day, sales]) => ({ day, sales: Math.round(sales * 100) / 100 })),
            monthly_sales: Array.from(monthlySalesMap.entries()).map(([month, sales]) => ({ month, sales: Math.round(sales * 100) / 100 })),
            product_sales: Array.from(productSalesMap.values()),
            generated_at: new Date().toISOString()
        };
    },

    /**
     * MLM REPORTS
     * Analyzes network binary volume, direct referrals, qualification ratios, 7-tier upline payouts, and top earners.
     */
    generateMlmReport({
        requestingUser,
        users = [],
        binaryNodes = [],
        volumeLedger = [],
        sponsors = [],
        walletLedger = [],
        purchases = [],
        kycDocs = [],
        filters = {},
        auditLogs = []
    }) {
        const auth = this.verifyAdminAccess(requestingUser);
        if (!auth.authorized) {
            throw new Error(auth.error);
        }

        const qualificationContext = { users, kycDocs, purchases, sponsors, binaryNodes };

        // 1. Binary Volume Summary
        let totalLeftVolume = 0;
        let totalRightVolume = 0;
        let totalMatchedVolume = 0;
        volumeLedger.forEach(entry => {
            const amt = Number(entry.amount) || 0;
            if (entry.type === 'SALE_VOLUME' && amt > 0) {
                if (entry.leg === 'LEFT') totalLeftVolume += amt;
                if (entry.leg === 'RIGHT') totalRightVolume += amt;
            } else if (entry.type === 'MATCHED_VOLUME') {
                totalMatchedVolume += Math.abs(amt);
            }
        });

        // 2. Direct Referrals Analysis
        const sponsorCounts = new Map();
        sponsors.forEach(s => {
            sponsorCounts.set(s.sponsor_id, (sponsorCounts.get(s.sponsor_id) || 0) + 1);
        });

        // 3. Qualification Statistics
        let qualifiedCount = 0;
        let unqualifiedCount = 0;
        const unmetReasonsCount = {
            NO_ACTIVE_PURCHASE: 0,
            MISSING_LEFT_DIRECT: 0,
            MISSING_RIGHT_DIRECT: 0,
            KYC_NOT_APPROVED: 0
        };

        users.forEach(u => {
            const q = QualificationEngine.evaluateQualification(u.id, qualificationContext);
            if (q.is_qualified) {
                qualifiedCount++;
            } else {
                unqualifiedCount++;
                (q.unmet_requirements || []).forEach(reason => {
                    if (unmetReasonsCount[reason] !== undefined) unmetReasonsCount[reason]++;
                });
            }
        });

        // 4. Qualified Upline Payouts (Binary Commission Breakdown)
        let totalBinaryPaid = 0;
        let binaryTransactionsCount = 0;
        walletLedger.forEach(tx => {
            if (tx.type === 'BINARY_COMMISSION' && tx.status === 'COMPLETED') {
                totalBinaryPaid += Math.abs(Number(tx.amount) || 0);
                binaryTransactionsCount++;
            }
        });

        // 5. Top Earners Leaderboard
        const memberEarningsMap = new Map();
        walletLedger.forEach(tx => {
            if ((tx.type || '').includes('COMMISSION') && !(tx.type || '').includes('REVERSAL') && tx.status === 'COMPLETED') {
                const current = memberEarningsMap.get(tx.user_id) || 0;
                memberEarningsMap.set(tx.user_id, current + Math.abs(Number(tx.amount) || 0));
            }
        });

        const topEarners = Array.from(memberEarningsMap.entries())
            .map(([userId, totalEarned]) => {
                const u = users.find(usr => usr.id === userId);
                return {
                    user_id: userId,
                    username: u ? u.username : userId,
                    full_name: u ? u.full_name : 'Member',
                    total_earnings: Math.round(totalEarned * 100) / 100
                };
            })
            .sort((a, b) => b.total_earnings - a.total_earnings)
            .slice(0, 20);

        if (auditLogs) {
            KycService.logAction(auditLogs, requestingUser.id, 'REPORT_GENERATED', 'mlm_reports', 'report-mlm', null, { filters });
        }

        return {
            success: true,
            binary_volume: {
                total_left_volume: Math.round(totalLeftVolume * 100) / 100,
                total_right_volume: Math.round(totalRightVolume * 100) / 100,
                total_matched_volume: Math.round(totalMatchedVolume * 100) / 100
            },
            direct_referrals_stats: {
                total_sponsorship_links: sponsors.length,
                unique_active_sponsors: sponsorCounts.size
            },
            qualification_statistics: {
                total_evaluated: users.length,
                qualified_members: qualifiedCount,
                unqualified_members: unqualifiedCount,
                unmet_reasons_breakdown: unmetReasonsCount
            },
            qualified_upline_payouts: {
                total_binary_commissions_paid: Math.round(totalBinaryPaid * 100) / 100,
                transactions_count: binaryTransactionsCount
            },
            top_earners: topEarners,
            generated_at: new Date().toISOString()
        };
    },

    /**
     * MEMBER REPORTS
     * Compiles an individual member's earnings statement, purchase history, withdrawal history, and commission ledger.
     */
    generateMemberReport({
        requestingUser,
        targetUserId,
        users = [],
        purchases = [],
        walletLedger = [],
        withdrawals = [],
        binaryNodes = [],
        kycDocs = [],
        filters = {},
        auditLogs = []
    }) {
        const auth = this.verifyMemberReportAccess(requestingUser, targetUserId);
        if (!auth.authorized) {
            throw new Error(auth.error);
        }

        const user = users.find(u => u.id === targetUserId || u.username === targetUserId);
        if (!user) {
            throw new Error(`Member ${targetUserId} not found.`);
        }
        const actualUserId = user.id;

        // 1. Member Balances & Earnings
        const balances = WalletService.getWalletBalances(actualUserId, walletLedger);
        const capSummary = EarningsCapEngine.getMemberEarningsSummary(actualUserId, walletLedger);

        // 2. Purchase History
        const userPurchases = purchases.filter(p => p.user_id === actualUserId);
        const filteredPurchases = this.filterDataset(userPurchases, filters).data;

        // 3. Withdrawal History
        const userWithdrawals = withdrawals.filter(w => w.user_id === actualUserId);
        const filteredWithdrawals = this.filterDataset(userWithdrawals, filters).data;

        // 4. Commission History
        const userCommissions = walletLedger.filter(tx => tx.user_id === actualUserId && (tx.type || '').includes('COMMISSION'));
        const filteredCommissions = this.filterDataset(userCommissions, filters).data;

        if (auditLogs && auth.role !== 'MEMBER_SELF') {
            KycService.logAction(auditLogs, requestingUser.id, 'MEMBER_REPORT_EXPORTED', 'users', actualUserId, null, { filters });
        }

        return {
            success: true,
            member_profile: {
                id: actualUserId,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                account_status: user.status || 'ACTIVE'
            },
            earnings_summary: {
                available_balance: balances.available_balance,
                total_earned: balances.total_earned,
                total_withdrawn: balances.total_withdrawn,
                pending_balance: balances.pending_balance,
                daily_remaining_cap: capSummary.daily_remaining,
                monthly_remaining_cap: capSummary.monthly_remaining
            },
            purchase_history: filteredPurchases,
            withdrawal_history: filteredWithdrawals,
            commission_history: filteredCommissions,
            generated_at: new Date().toISOString()
        };
    },

    /**
     * EXPORT GENERATORS
     * Exports tabular data into CSV, Excel-XML/HTML format, or printable PDF/HTML format.
     */
    exportToCSV(data) {
        if (!data || data.length === 0) return 'No data available';
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];

        data.forEach(row => {
            const values = headers.map(header => {
                const val = row[header] !== undefined && row[header] !== null ? row[header] : '';
                const escaped = (typeof val === 'object' ? JSON.stringify(val) : String(val)).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        });

        return csvRows.join('\n');
    },

    exportToExcel(data, sheetName = 'Report') {
        if (!data || data.length === 0) return '<table border="1"><tr><td>No data available</td></tr></table>';
        const headers = Object.keys(data[0]);
        let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
        html += `<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${sheetName}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>`;
        html += `<table border="1"><thead><tr style="background:#102A43;color:#FFF9F0;">`;
        headers.forEach(h => {
            html += `<th>${h}</th>`;
        });
        html += `</tr></thead><tbody>`;

        data.forEach(row => {
            html += `<tr>`;
            headers.forEach(h => {
                const val = row[h] !== undefined && row[h] !== null ? row[h] : '';
                html += `<td>${typeof val === 'object' ? JSON.stringify(val) : String(val)}</td>`;
            });
            html += `</tr>`;
        });

        html += `</tbody></table></body></html>`;
        return html;
    },

    exportToPDFFormat(title, summaryStats = {}, records = []) {
        let doc = `=== ${title.toUpperCase()} ===\n`;
        doc += `Generated: ${new Date().toISOString()}\n`;
        doc += `Authoritative Platform: Hapanamy.lk\n\n`;
        
        doc += `--- SUMMARY METRICS ---\n`;
        Object.entries(summaryStats).forEach(([k, v]) => {
            doc += `${k}: ${v}\n`;
        });
        doc += `\n--- DETAILED RECORDS (${records.length}) ---\n`;
        
        if (records.length > 0) {
            records.forEach((r, idx) => {
                doc += `[${idx + 1}] ${JSON.stringify(r)}\n`;
            });
        } else {
            doc += `No records available.\n`;
        }
        
        return doc;
    },

    // Backward compatibility for existing basic endpoint
    generateReport(dataset, filters = {}) {
        return this.filterDataset(dataset, filters);
    }
};

if (typeof module !== 'undefined') {
    module.exports = ReportService;
}
