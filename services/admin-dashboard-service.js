// Hapanamy.lk Admin MLM Operations Dashboard Domain Service (STEP 27)
// Authoritative aggregation of platform-wide membership vitals, ledger-derived financial metrics,
// binary network performance, operational queues (KYC, payments, withdrawals, fraud), and RBAC security.

const QualificationEngine = require('./qualification-engine');
const EarningsCapEngine = require('./earnings-cap-engine');

const ALLOWED_ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'COMPLIANCE'];

const AdminDashboardService = {
    /**
     * Verifies that the requesting user possesses administrative permissions.
     */
    verifyAdminAccess(requestingUser) {
        if (!requestingUser) {
            return { authorized: false, status: 401, error: 'Authentication required.' };
        }

        const role = (requestingUser.role || '').toUpperCase();
        if (!ALLOWED_ADMIN_ROLES.includes(role)) {
            return { authorized: false, status: 403, error: '403 Forbidden: Administrative role required to access MLM Operations Dashboard.' };
        }

        return { authorized: true, role };
    },

    /**
     * Compiles complete authoritative Admin Operations Dashboard payload.
     */
    getAdminDashboardData({
        requestingUser,
        users = [],
        kycDocs = [],
        purchases = [],
        sponsors = [],
        binaryNodes = [],
        walletLedger = [],
        volumeLedger = [],
        withdrawals = [],
        paymentSubmissions = [],
        refundRequests = [],
        targetDate = new Date()
    }) {
        // 1. Enforce RBAC Access Control
        const auth = this.verifyAdminAccess(requestingUser);
        if (!auth.authorized) {
            throw new Error(auth.error);
        }

        const { dayKey, monthKey } = EarningsCapEngine.getDateKeys(targetDate);
        const qualificationContext = { users, kycDocs, purchases, sponsors, binaryNodes };

        // 2. Member Overview & Vital Statistics
        const totalMembers = users.length;
        const activeMembers = users.filter(u => purchases.some(p => p.user_id === u.id && p.status === 'ACTIVE')).length;

        let newRegistrationsToday = 0;
        let newRegistrationsMonth = 0;
        let qualifiedMembersCount = 0;

        users.forEach(u => {
            if (u.created_at) {
                const uDate = new Date(u.created_at);
                const { dayKey: uDay, monthKey: uMonth } = EarningsCapEngine.getDateKeys(uDate);
                if (uDay === dayKey) newRegistrationsToday++;
                if (uMonth === monthKey) newRegistrationsMonth++;
            }

            const q = QualificationEngine.evaluateQualification(u.id, qualificationContext);
            if (q.is_qualified) qualifiedMembersCount++;
        });

        const pendingKycCount = kycDocs.filter(k => k.status === 'PENDING' || k.status === 'UNDER_REVIEW').length;
        const pendingPaymentsCount = paymentSubmissions.filter(p => p.status === 'PENDING' || p.status === 'UNDER_REVIEW').length;
        const pendingWithdrawalsCount = withdrawals.filter(w => w.status === 'PENDING' || w.status === 'UNDER_REVIEW').length;

        // 3. Authoritative Financial Metrics (Derived strictly from purchases & snapshots)
        let totalRevenue = 0;
        let totalProductCost = 0;
        let dailySales = 0;
        let monthlySales = 0;

        purchases.forEach(p => {
            if (p.status !== 'ACTIVE' && p.status !== 'COMPLETED') return;

            const sellingPrice = Number(p.selling_price) || (p.economics_snapshot ? Number(p.economics_snapshot.selling_price) : 0);
            const productCost = p.economics_snapshot ? Number(p.economics_snapshot.product_cost || 0) : 0;

            totalRevenue += sellingPrice;
            totalProductCost += productCost;

            const pDate = p.created_at ? new Date(p.created_at) : new Date();
            const { dayKey: pDay, monthKey: pMonth } = EarningsCapEngine.getDateKeys(pDate);

            if (pDay === dayKey) dailySales += sellingPrice;
            if (pMonth === monthKey) monthlySales += sellingPrice;
        });

        const grossProfit = totalRevenue - totalProductCost;

        // Calculate Total Commissions from Wallet Ledger
        let totalCommissionPaid = 0;
        walletLedger.forEach(tx => {
            const txType = (tx.type || '').toUpperCase();
            if (txType.includes('COMMISSION') && !txType.includes('REVERSAL') && tx.status === 'COMPLETED') {
                totalCommissionPaid += Math.abs(Number(tx.amount) || 0);
            }
        });

        const companyNetMarginEstimate = Math.round((grossProfit - totalCommissionPaid) * 100) / 100;
        const profitMarginPercent = totalRevenue > 0 
            ? Math.round((companyNetMarginEstimate / totalRevenue) * 10000) / 100 
            : 0;

        // 4. Binary Network Performance & Volume Aggregates
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

        // Compute Top Growing Sponsors
        const sponsorCounts = new Map();
        sponsors.forEach(s => {
            const current = sponsorCounts.get(s.sponsor_id) || 0;
            sponsorCounts.set(s.sponsor_id, current + 1);
        });

        const topGrowingSponsors = Array.from(sponsorCounts.entries())
            .map(([sponsorId, directsCount]) => {
                const spUser = users.find(u => u.id === sponsorId);
                return {
                    sponsor_id: sponsorId,
                    username: spUser ? spUser.username : sponsorId,
                    full_name: spUser ? spUser.full_name : 'Member',
                    direct_referrals_count: directsCount
                };
            })
            .sort((a, b) => b.direct_referrals_count - a.direct_referrals_count)
            .slice(0, 10);

        // 5. Operational Queues & Suspicious Fraud Activity
        const pendingPaymentsQueue = paymentSubmissions.filter(p => p.status === 'PENDING' || p.status === 'UNDER_REVIEW');
        const pendingWithdrawalsQueue = withdrawals.filter(w => w.status === 'PENDING' || w.status === 'UNDER_REVIEW');
        const pendingKycQueue = kycDocs.filter(k => k.status === 'PENDING' || k.status === 'UNDER_REVIEW');
        const suspiciousPayments = paymentSubmissions.filter(p => p.flagged_for_review);

        return {
            success: true,
            overview: {
                total_members: totalMembers,
                active_members: activeMembers,
                qualified_members: qualifiedMembersCount,
                new_registrations_today: newRegistrationsToday,
                new_registrations_this_month: newRegistrationsMonth,
                pending_kyc_count: pendingKycCount,
                pending_payments_count: pendingPaymentsCount,
                pending_withdrawals_count: pendingWithdrawalsCount
            },
            financial_summary: {
                daily_sales: Math.round(dailySales * 100) / 100,
                monthly_sales: Math.round(monthlySales * 100) / 100,
                total_product_revenue: Math.round(totalRevenue * 100) / 100,
                total_product_cost: Math.round(totalProductCost * 100) / 100,
                total_gross_profit: Math.round(grossProfit * 100) / 100,
                total_commission_paid: Math.round(totalCommissionPaid * 100) / 100,
                company_net_margin_estimate: companyNetMarginEstimate,
                profit_margin_percent: profitMarginPercent
            },
            network_metrics: {
                total_left_volume: Math.round(totalLeftVolume * 100) / 100,
                total_right_volume: Math.round(totalRightVolume * 100) / 100,
                total_matched_volume: Math.round(totalMatchedVolume * 100) / 100,
                top_growing_sponsors: topGrowingSponsors
            },
            operational_queues: {
                pending_payments: pendingPaymentsQueue,
                pending_withdrawals: pendingWithdrawalsQueue,
                pending_kyc: pendingKycQueue,
                suspicious_activity: suspiciousPayments,
                pending_refunds: refundRequests.filter(r => r.status === 'PENDING')
            },
            generated_at: new Date().toISOString()
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = AdminDashboardService;
}
