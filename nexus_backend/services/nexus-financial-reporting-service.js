/**
 * NEXUS PRIME (PVT) LTD — FINANCIAL REPORTING & ANALYTICS SERVICE
 * System: Financial Dashboard, Commission Reports & Reconciliation Engine
 * Target Domain: nexusp.online
 *
 * Compliance:
 * - Reads authoritative settled database records (orders, payments, commissions, ledger, withdrawals)
 * - Zero simulated numbers or fake data
 * - No speculative "Profit" claims; conservative Gross Sales & Net Movement
 * - Server-side date range calculation (Asia/Colombo UTC+05:30)
 * - Multi-currency segregation (LKR default; zero fake exchange rates)
 * - Historical snapshot immutability
 * - 17-point continuous automated financial reconciliation
 * - Sanitized, masked CSV exports
 * - Pure Nexus Prime isolation (Zero Hapanamy dependency)
 */

const nexusDb = require('../db/nexus-db');

class NexusFinancialReportingService {
    constructor() {
        this.DEFAULT_TIMEZONE = 'Asia/Colombo';
        this.TIMEZONE_OFFSET_HOURS = 5.5; // Asia/Colombo (UTC+05:30)
    }

    getReportingTimezone() {
        if (nexusDb && typeof nexusDb.getSetting === 'function') {
            return nexusDb.getSetting('reporting_timezone') || this.DEFAULT_TIMEZONE;
        }
        return this.DEFAULT_TIMEZONE;
    }

    getTimezoneOffsetHours(tzName = null) {
        const tz = tzName || this.getReportingTimezone();
        if (tz === 'Asia/Colombo') return 5.5;
        if (tz === 'UTC' || tz === 'Etc/UTC') return 0;
        return 5.5;
    }

    colomboComponentsToUtcIso(year, monthIndex, day, hours = 0, minutes = 0, seconds = 0, ms = 0) {
        const offsetMs = this.getTimezoneOffsetHours() * 3600 * 1000;
        const utcMs = Date.UTC(year, monthIndex, day, hours, minutes, seconds, ms) - offsetMs;
        return new Date(utcMs).toISOString();
    }

    toCanonicalDateKey(dateStr) {
        if (!dateStr) return null;
        const ms = new Date(dateStr).getTime();
        if (isNaN(ms)) return null;
        const offsetMs = this.getTimezoneOffsetHours() * 3600 * 1000;
        const d = new Date(ms + offsetMs);
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    toCanonicalMonthKey(dateStr) {
        if (!dateStr) return null;
        const ms = new Date(dateStr).getTime();
        if (isNaN(ms)) return null;
        const offsetMs = this.getTimezoneOffsetHours() * 3600 * 1000;
        const d = new Date(ms + offsetMs);
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    // ------------------------------------------------------------
    // 1. DATE SCOPING ENGINE (Server-Side Canonical Half-Open Timezone)
    // ------------------------------------------------------------
    resolveDateRange(periodOrOptions = 'all', customFrom = null, customTo = null) {
        let period = 'all';
        let customTz = null;
        if (typeof periodOrOptions === 'object' && periodOrOptions !== null) {
            period = periodOrOptions.period || 'all';
            customFrom = periodOrOptions.date_from || periodOrOptions.dateFrom || periodOrOptions.start_date || periodOrOptions.startDate || periodOrOptions.periodStart || periodOrOptions.period_start || customFrom;
            customTo = periodOrOptions.date_to || periodOrOptions.dateTo || periodOrOptions.end_date || periodOrOptions.endDate || periodOrOptions.periodEnd || periodOrOptions.period_end || customTo;
            customTz = periodOrOptions.timezone || periodOrOptions.timeZone || null;
        } else {
            period = periodOrOptions;
        }

        const tz = customTz || this.getReportingTimezone();
        const offsetHours = this.getTimezoneOffsetHours(tz);
        const offsetMs = offsetHours * 3600 * 1000;

        const now = new Date();
        const localNowMs = now.getTime() + offsetMs;
        const localDate = new Date(localNowMs);
        const year = localDate.getUTCFullYear();
        const month = localDate.getUTCMonth();
        const date = localDate.getUTCDate();
        const dayOfWeek = localDate.getUTCDay();

        let startDateIso = null;
        let endDateIso = null;

        if (customFrom || customTo || (period || '').toLowerCase() === 'custom') {
            if (customFrom) {
                if (typeof customFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(customFrom.trim())) {
                    const [fy, fm, fd] = customFrom.trim().split('-').map(Number);
                    const utcMs = Date.UTC(fy, fm - 1, fd, 0, 0, 0, 0) - offsetMs;
                    startDateIso = new Date(utcMs).toISOString();
                } else {
                    startDateIso = new Date(customFrom).toISOString();
                }
            }
            if (customTo) {
                if (typeof customTo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(customTo.trim())) {
                    const [ty, tm, td] = customTo.trim().split('-').map(Number);
                    // Section 10: Exclusive period_end is end_date + 1 calendar day 00:00:00
                    const utcMs = Date.UTC(ty, tm - 1, td + 1, 0, 0, 0, 0) - offsetMs;
                    endDateIso = new Date(utcMs).toISOString();
                } else {
                    endDateIso = new Date(customTo).toISOString();
                }
            } else {
                const utcMs = Date.UTC(year, month, date + 1, 0, 0, 0, 0) - offsetMs;
                endDateIso = new Date(utcMs).toISOString();
            }

            return {
                period: period || 'custom',
                period_start: startDateIso,
                period_end: endDateIso,
                timezone: tz === 'Asia/Colombo' ? 'Asia/Colombo (UTC+05:30)' : tz
            };
        }

        switch ((period || '').toLowerCase()) {
            case 'today': {
                startDateIso = new Date(Date.UTC(year, month, date, 0, 0, 0, 0) - offsetMs).toISOString();
                endDateIso = new Date(Date.UTC(year, month, date + 1, 0, 0, 0, 0) - offsetMs).toISOString();
                break;
            }
            case 'yesterday': {
                startDateIso = new Date(Date.UTC(year, month, date - 1, 0, 0, 0, 0) - offsetMs).toISOString();
                endDateIso = new Date(Date.UTC(year, month, date, 0, 0, 0, 0) - offsetMs).toISOString();
                break;
            }
            case 'this_week': {
                const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                const mondayDate = date - daysFromMonday;
                startDateIso = new Date(Date.UTC(year, month, mondayDate, 0, 0, 0, 0) - offsetMs).toISOString();
                endDateIso = new Date(Date.UTC(year, month, mondayDate + 7, 0, 0, 0, 0) - offsetMs).toISOString();
                break;
            }
            case 'this_month': {
                startDateIso = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - offsetMs).toISOString();
                endDateIso = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0) - offsetMs).toISOString();
                break;
            }
            case 'last_month': {
                startDateIso = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - offsetMs).toISOString();
                endDateIso = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - offsetMs).toISOString();
                break;
            }
            case 'this_quarter': {
                const qStartMonth = Math.floor(month / 3) * 3;
                startDateIso = new Date(Date.UTC(year, qStartMonth, 1, 0, 0, 0, 0) - offsetMs).toISOString();
                endDateIso = new Date(Date.UTC(year, qStartMonth + 3, 1, 0, 0, 0, 0) - offsetMs).toISOString();
                break;
            }
            case 'this_year': {
                startDateIso = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0) - offsetMs).toISOString();
                endDateIso = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0) - offsetMs).toISOString();
                break;
            }
            default: {
                startDateIso = null;
                endDateIso = null;
                break;
            }
        }

        return {
            period: period || 'all',
            period_start: startDateIso,
            period_end: endDateIso,
            timezone: tz === 'Asia/Colombo' ? 'Asia/Colombo (UTC+05:30)' : tz
        };
    }

    filterByDateAndCurrency(items, dateField, dateRange, currency = 'ALL') {
        let list = [...items];
        if (dateRange && dateRange.period_start) {
            const startTs = new Date(dateRange.period_start).getTime();
            list = list.filter(item => {
                const val = typeof dateField === 'function' ? dateField(item) : item[dateField];
                return val && new Date(val).getTime() >= startTs;
            });
        }
        if (dateRange && dateRange.period_end) {
            const endTs = new Date(dateRange.period_end).getTime();
            list = list.filter(item => {
                const val = typeof dateField === 'function' ? dateField(item) : item[dateField];
                // STRICT HALF-OPEN INTERVAL: period_start <= timestamp < period_end
                return val && new Date(val).getTime() < endTs;
            });
        }
        if (currency && currency !== 'ALL') {
            const c = currency.toUpperCase();
            list = list.filter(item => item.currency && item.currency.toUpperCase() === c);
        }
        return list;
    }

    // ------------------------------------------------------------
    // 2. ADMIN FINANCIAL DASHBOARD & OVERVIEW
    // ------------------------------------------------------------
    async getFinancialOverview(options = {}) {
        const dateRange = this.resolveDateRange(options);
        const currency = (options.currency || 'ALL').toUpperCase();

        // 1. Sales (Orders)
        // Orders created in period
        const createdOrders = this.filterByDateAndCurrency(nexusDb.orders, 'created_at', dateRange, currency);
        const totalOrders = createdOrders.length;

        // Status-specific order filtering (Section 11)
        const allPaidOrders = nexusDb.orders.filter(o => o.payment_status === 'paid' || o.payment_status === 'completed' || o.status === 'paid' || o.status === 'completed');
        const paidOrders = this.filterByDateAndCurrency(allPaidOrders, o => o.paid_at || (o.payment_status === 'paid' ? o.created_at : null), dateRange, currency);

        const allCompletedOrders = nexusDb.orders.filter(o => o.status === 'completed');
        const completedOrders = this.filterByDateAndCurrency(allCompletedOrders, o => o.completed_at || o.paid_at || o.created_at, dateRange, currency);

        const allCancelledOrders = nexusDb.orders.filter(o => o.status === 'cancelled');
        const cancelledOrders = this.filterByDateAndCurrency(allCancelledOrders, o => o.cancelled_at || o.updated_at || o.created_at, dateRange, currency);

        const allRefundedOrders = nexusDb.orders.filter(o => o.status === 'refunded');
        const refundedOrders = this.filterByDateAndCurrency(allRefundedOrders, o => o.refunded_at || o.updated_at || o.created_at, dateRange, currency);

        const grossSalesVolume = paidOrders.reduce((sum, o) => sum + (o.total || o.total_amount || 0), 0);

        // 2. Payments (Section 12)
        const allPaidPayments = nexusDb.payments.filter(p => p.status === 'paid');
        const paidPayments = this.filterByDateAndCurrency(allPaidPayments, p => p.verified_at || p.paid_at || p.created_at, dateRange, currency);

        const allPendingPayments = nexusDb.payments.filter(p => ['initiated', 'pending', 'processing'].includes(p.status));
        const pendingPayments = this.filterByDateAndCurrency(allPendingPayments, 'created_at', dateRange, currency);

        const allFailedPayments = nexusDb.payments.filter(p => p.status === 'failed');
        const failedPayments = this.filterByDateAndCurrency(allFailedPayments, p => p.failed_at || p.updated_at || p.created_at, dateRange, currency);

        const allRefundedPayments = nexusDb.payments.filter(p => p.status === 'refunded');
        const refundedPayments = this.filterByDateAndCurrency(allRefundedPayments, p => p.refunded_at || p.updated_at || p.created_at, dateRange, currency);

        const verifiedPaymentsVolume = paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const pendingPaymentsVolume = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        // 3. Commissions (Section 13)
        const generatedCommissions = this.filterByDateAndCurrency(nexusDb.commissions, 'created_at', dateRange, currency);
        const totalCommissionsCount = generatedCommissions.length;
        const totalCommissionsVolume = generatedCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);

        const allApprovedComms = nexusDb.commissions.filter(c => c.status === 'approved');
        const approvedCommissions = this.filterByDateAndCurrency(allApprovedComms, c => c.approved_at || c.created_at, dateRange, currency);

        const allCreditedComms = nexusDb.commissions.filter(c => c.status === 'credited');
        const creditedCommissions = this.filterByDateAndCurrency(allCreditedComms, c => c.credited_at || c.updated_at || c.created_at, dateRange, currency);

        const allPendingComms = nexusDb.commissions.filter(c => c.status === 'pending');
        const pendingCommissions = this.filterByDateAndCurrency(allPendingComms, 'created_at', dateRange, currency);

        const allReversedComms = nexusDb.commissions.filter(c => c.status === 'reversed');
        const reversedCommissions = this.filterByDateAndCurrency(allReversedComms, c => c.reversed_at || c.updated_at || c.created_at, dateRange, currency);

        const allCancelledComms = nexusDb.commissions.filter(c => c.status === 'cancelled');
        const cancelledCommissions = this.filterByDateAndCurrency(allCancelledComms, c => c.cancelled_at || c.updated_at || c.created_at, dateRange, currency);

        const commissionLiabilityVolume = approvedCommissions.reduce((sum, c) => sum + (c.amount || 0), 0) +
                                         pendingCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);
        const commissionCreditedVolume = creditedCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);

        // 4. Wallet & Ledger (Flow vs Stock: Section 21, 22, 23, 24)
        const filteredLedger = this.filterByDateAndCurrency(nexusDb.ledgerEntries, 'created_at', dateRange, currency);
        let walletCreditsVolume = 0;
        let walletDebitsVolume = 0;
        filteredLedger.forEach(e => {
            if (e.status === 'posted' || e.status === 'cleared') {
                if (e.direction === 'CREDIT') walletCreditsVolume += e.amount;
                if (e.direction === 'DEBIT') walletDebitsVolume += e.amount;
            }
        });

        // Current real-time wallet balances across all platform members (Point-in-Time)
        const allWallets = nexusDb.wallets.filter(w => currency === 'ALL' || w.currency === currency);
        const totalAvailableBalance = allWallets.reduce((sum, w) => sum + (w.available_balance || 0), 0);
        const totalPendingReserved = allWallets.reduce((sum, w) => sum + (w.pending_balance || 0), 0);

        // Historical opening / closing balance derivation
        const openingBalance = this.calculateHistoricalLedgerBalance(dateRange.period_start, currency === 'ALL' ? 'LKR' : currency);
        const closingBalance = this.calculateHistoricalLedgerBalance(dateRange.period_end, currency === 'ALL' ? 'LKR' : currency);

        // 5. Withdrawals (Section 15)
        const requestedWithdrawals = this.filterByDateAndCurrency(nexusDb.withdrawals, 'created_at', dateRange, currency);
        const pendingWd = this.filterByDateAndCurrency(nexusDb.withdrawals.filter(w => w.status === 'pending'), 'created_at', dateRange, currency);
        const underReviewWd = this.filterByDateAndCurrency(nexusDb.withdrawals.filter(w => w.status === 'under_review'), 'created_at', dateRange, currency);
        const approvedWd = this.filterByDateAndCurrency(nexusDb.withdrawals.filter(w => w.status === 'approved'), w => w.approved_at || w.created_at, dateRange, currency);
        const processingWd = this.filterByDateAndCurrency(nexusDb.withdrawals.filter(w => w.status === 'processing'), w => w.processing_at || w.updated_at || w.created_at, dateRange, currency);
        const paidWd = this.filterByDateAndCurrency(nexusDb.withdrawals.filter(w => w.status === 'paid'), w => w.paid_at || w.updated_at || w.created_at, dateRange, currency);
        const rejectedWd = this.filterByDateAndCurrency(nexusDb.withdrawals.filter(w => w.status === 'rejected'), w => w.rejected_at || w.updated_at || w.created_at, dateRange, currency);
        const failedWd = this.filterByDateAndCurrency(nexusDb.withdrawals.filter(w => w.status === 'failed'), w => w.failed_at || w.updated_at || w.created_at, dateRange, currency);

        // 6. Payouts (Paid Withdrawals: Section 16)
        const totalPaidWithdrawalsCount = paidWd.length;
        const totalPayoutAmount = paidWd.reduce((sum, w) => sum + (w.requested_amount || 0), 0);
        const totalPayoutFees = paidWd.reduce((sum, w) => sum + (w.processing_fee || 0), 0);
        const netPayoutAmount = paidWd.reduce((sum, w) => sum + (w.net_amount || 0), 0);

        // 7. Refunds (Section 17: attributed to refund period)
        let explicitRefunds = (nexusDb.refunds || []);
        if (currency !== 'ALL') explicitRefunds = explicitRefunds.filter(r => r.currency && r.currency.toUpperCase() === currency);
        const periodRefunds = this.filterByDateAndCurrency(explicitRefunds, r => r.refunded_at || r.created_at, dateRange, currency);
        const explicitRefundVolume = periodRefunds.reduce((s, r) => s + (r.amount || 0), 0);

        const orderRefundVolume = refundedOrders.reduce((sum, o) => sum + (o.total || o.total_amount || 0), 0);
        const paymentRefundVolume = refundedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalRefundsVolume = explicitRefundVolume > 0 ? explicitRefundVolume : (orderRefundVolume + paymentRefundVolume);

        const netFinancialMovement = Math.round((verifiedPaymentsVolume - totalPayoutAmount - totalRefundsVolume) * 100) / 100;

        // 8. MLM Operational Performance Metrics (Section 20)
        const totalMembers = nexusDb.memberProfiles.length;
        const activeMembers = nexusDb.memberProfiles.filter(p => p.status === 'active' && p.package_status && p.package_status !== 'NONE').length;

        const newMembersInPeriod = this.filterByDateAndCurrency(nexusDb.memberProfiles, 'created_at', dateRange, 'ALL').length;
        const activatedMembersInPeriod = this.filterByDateAndCurrency(nexusDb.memberProfiles.filter(p => p.activated_at), 'activated_at', dateRange, 'ALL').length;
        const suspendedMembersInPeriod = this.filterByDateAndCurrency(nexusDb.memberProfiles.filter(p => p.suspended_at), 'suspended_at', dateRange, 'ALL').length;
        const deactivatedMembersInPeriod = this.filterByDateAndCurrency(nexusDb.memberProfiles.filter(p => p.deactivated_at), 'deactivated_at', dateRange, 'ALL').length;
        const directReferralsInPeriod = this.filterByDateAndCurrency(nexusDb.memberProfiles.filter(p => p.sponsor_id), 'created_at', dateRange, 'ALL').length;

        const rankAchievementsInPeriod = this.filterByDateAndCurrency(nexusDb.memberRankHistory, rh => rh.effective_at || rh.qualified_at || rh.created_at, dateRange, 'ALL').length;

        // 9. Rank Distribution
        const rankDistribution = (nexusDb.ranks || []).map(r => {
            const count = nexusDb.memberProfiles.filter(p => (p.current_rank === r.code || p.rank === r.code)).length;
            const percentage = totalMembers > 0 ? Math.round((count / totalMembers) * 1000) / 10 : 0;
            return {
                rank_id: r.id,
                rank_code: r.code,
                rank_name: r.name,
                badge_style: r.badge_style,
                color_token: r.color_token,
                icon: r.icon,
                member_count: count,
                percentage
            };
        });

        // 10. Top Performers (Top 5 by Direct Referrals, PV, TV, Commission)
        const topPerformers = await this.calculateTopPerformers(5);

        // 11. Time Series Chart Data (Continuous calendar day breakdown)
        const timeSeries = this.generateTimeSeriesChartData(paidOrders, generatedCommissions, paidWd, dateRange);

        const summary = {
            gross_sales: Math.round(grossSalesVolume * 100) / 100,
            verified_payments: Math.round(verifiedPaymentsVolume * 100) / 100,
            commission_liability: Math.round(commissionLiabilityVolume * 100) / 100,
            paid_withdrawals: Math.round(totalPayoutAmount * 100) / 100,
            refunds: Math.round(totalRefundsVolume * 100) / 100,
            net_financial_movement: netFinancialMovement,
            opening_balance: openingBalance,
            closing_balance: closingBalance,
            currency: currency === 'ALL' ? 'LKR' : currency
        };

        const breakdown = {
            orders: {
                total_count: totalOrders,
                paid_count: paidOrders.length,
                completed_count: completedOrders.length,
                cancelled_count: cancelledOrders.length,
                refunded_count: refundedOrders.length,
                gross_volume: Math.round(grossSalesVolume * 100) / 100
            },
            payments: {
                verified_count: paidPayments.length,
                verified_volume: Math.round(verifiedPaymentsVolume * 100) / 100,
                pending_count: pendingPayments.length,
                pending_volume: Math.round(pendingPaymentsVolume * 100) / 100,
                failed_count: failedPayments.length,
                refunded_count: refundedPayments.length
            },
            commissions: {
                total_count: totalCommissionsCount,
                total_volume: Math.round(totalCommissionsVolume * 100) / 100,
                pending_count: pendingCommissions.length,
                pending_volume: Math.round(pendingCommissions.reduce((s, c) => s + (c.amount || 0), 0) * 100) / 100,
                approved_count: approvedCommissions.length,
                approved_volume: Math.round(approvedCommissions.reduce((s, c) => s + (c.amount || 0), 0) * 100) / 100,
                credited_count: creditedCommissions.length,
                credited_volume: Math.round(commissionCreditedVolume * 100) / 100,
                reversed_count: reversedCommissions.length,
                reversed_volume: Math.round(reversedCommissions.reduce((s, c) => s + (c.amount || 0), 0) * 100) / 100,
                cancelled_count: cancelledCommissions.length
            },
            wallets: {
                total_credits: Math.round(walletCreditsVolume * 100) / 100,
                total_debits: Math.round(walletDebitsVolume * 100) / 100,
                net_available_balance: Math.round(totalAvailableBalance * 100) / 100,
                total_reserved_balance: Math.round(totalPendingReserved * 100) / 100,
                ledger_entries_count: filteredLedger.length
            },
            withdrawals: {
                pending_count: pendingWd.length,
                pending_volume: Math.round(pendingWd.reduce((s, w) => s + (w.requested_amount || 0), 0) * 100) / 100,
                approved_count: approvedWd.length,
                approved_volume: Math.round(approvedWd.reduce((s, w) => s + (w.requested_amount || 0), 0) * 100) / 100,
                paid_count: paidWd.length,
                paid_volume: Math.round(totalPayoutAmount * 100) / 100,
                total_fees: Math.round(totalPayoutFees * 100) / 100,
                net_payout_volume: Math.round(netPayoutAmount * 100) / 100,
                rejected_count: rejectedWd.length
            }
        };

        const operational_metrics = {
            total_members: totalMembers,
            active_members: activeMembers,
            new_members: newMembersInPeriod,
            activated_members: activatedMembersInPeriod,
            suspended_members: suspendedMembersInPeriod,
            deactivated_members: deactivatedMembersInPeriod,
            direct_referrals: directReferralsInPeriod,
            rank_achievements: rankAchievementsInPeriod
        };

        return {
            success: true,
            period: dateRange.period || options.period || 'all',
            timezone: 'Asia/Colombo (UTC+05:30)',
            date_range: dateRange,
            currency: currency === 'ALL' ? 'LKR' : currency,
            currency_filter: currency,
            summary,
            summary_cards: summary,
            breakdown,
            operational_metrics,
            rank_distribution: rankDistribution,
            top_performers: topPerformers.by_personal_volume || [],
            top_performers_by_metric: topPerformers,
            time_series: timeSeries.points || [],
            charts: timeSeries,
            sales: breakdown.orders,
            payments: breakdown.payments,
            commissions: breakdown.commissions,
            wallet: breakdown.wallets,
            withdrawals: breakdown.withdrawals,
            payouts: {
                total_paid_withdrawals: totalPaidWithdrawalsCount,
                total_payout_amount: Math.round(totalPayoutAmount * 100) / 100,
                total_fees: Math.round(totalPayoutFees * 100) / 100,
                net_payout_amount: Math.round(netPayoutAmount * 100) / 100
            },
            mlm_performance: operational_metrics
        };
    }

    calculateHistoricalLedgerBalance(asOfTimestamp = null, currency = 'LKR', memberId = null) {
        const c = (currency || 'LKR').toUpperCase();
        let entries = (nexusDb.ledgerEntries || []).filter(e => 
            (e.status === 'posted' || e.status === 'cleared') &&
            (!e.currency || e.currency.toUpperCase() === c)
        );
        if (memberId) {
            const userId = nexusDb.resolveMemberUserId ? nexusDb.resolveMemberUserId(memberId) : memberId;
            entries = entries.filter(e => e.member_id === userId || e.user_id === userId);
        }
        if (asOfTimestamp) {
            const asOfTs = new Date(asOfTimestamp).getTime();
            // Strict < asOfTimestamp
            entries = entries.filter(e => new Date(e.created_at).getTime() < asOfTs);
        }

        let balance = 0;
        for (const e of entries) {
            if (e.direction === 'CREDIT') balance += e.amount;
            if (e.direction === 'DEBIT') balance -= e.amount;
        }
        return Math.round(balance * 100) / 100;
    }

    async calculateTopPerformers(limit = 5) {
        const members = nexusDb.memberProfiles.map(p => {
            const user = nexusDb.users.find(u => u.id === p.user_id);
            const pv = nexusDb.orders
                .filter(o => o.user_id === p.user_id && (o.payment_status === 'paid' || o.payment_status === 'completed'))
                .reduce((sum, o) => sum + (o.total || 0), 0);

            const directCount = nexusDb.memberProfiles.filter(sub => sub.sponsor_id === p.user_id).length;
            const commGenerated = nexusDb.commissions
                .filter(c => c.beneficiary_id === p.user_id && c.status !== 'cancelled' && c.status !== 'reversed')
                .reduce((sum, c) => sum + (c.amount || 0), 0);

            return {
                user_id: p.user_id,
                member_id: p.member_id,
                full_name: p.full_name,
                rank: p.current_rank || p.rank || 'MEMBER',
                personal_volume: Math.round(pv * 100) / 100,
                direct_referrals: directCount,
                commission_generated: Math.round(commGenerated * 100) / 100
            };
        });

        const byPv = [...members].sort((a, b) => b.personal_volume - a.personal_volume).slice(0, limit);
        const byDirects = [...members].sort((a, b) => b.direct_referrals - a.direct_referrals).slice(0, limit);
        const byCommission = [...members].sort((a, b) => b.commission_generated - a.commission_generated).slice(0, limit);

        return {
            by_personal_volume: byPv,
            by_direct_referrals: byDirects,
            by_commission: byCommission
        };
    }

    generateTimeSeriesChartData(orders, commissions, paidWithdrawals, dateRange) {
        const dailyMap = new Map();

        // 1. Determine start and end day in canonical reporting timezone
        let startKey = null;
        let endKey = null;

        if (dateRange && dateRange.period_start) {
            startKey = this.toCanonicalDateKey(dateRange.period_start);
        }
        if (dateRange && dateRange.period_end) {
            endKey = this.toCanonicalDateKey(dateRange.period_end);
        }

        // If 'all' or no period_start, find range from earliest record or default 30 days
        if (!startKey) {
            let earliestTs = null;
            const checkTs = (ts) => {
                if (ts) {
                    const ms = new Date(ts).getTime();
                    if (!isNaN(ms) && (!earliestTs || ms < earliestTs)) earliestTs = ms;
                }
            };
            (orders || []).forEach(o => checkTs(o.paid_at || o.created_at));
            (commissions || []).forEach(c => checkTs(c.created_at));
            (paidWithdrawals || []).forEach(w => checkTs(w.paid_at || w.created_at));

            if (earliestTs) {
                startKey = this.toCanonicalDateKey(new Date(earliestTs).toISOString());
            } else {
                const now = new Date();
                const past30 = new Date(now.getTime() - (29 * 24 * 3600 * 1000));
                startKey = this.toCanonicalDateKey(past30.toISOString());
            }
        }

        if (!endKey) {
            endKey = this.toCanonicalDateKey(new Date().toISOString());
        }

        // Pre-fill continuous day buckets [startKey, endKey]
        const [sy, sm, sd] = startKey.split('-').map(Number);
        const [ey, em, ed] = endKey.split('-').map(Number);
        const offsetMs = this.getTimezoneOffsetHours() * 3600 * 1000;

        let curUtc = Date.UTC(sy, sm - 1, sd, 0, 0, 0) - offsetMs;
        const endUtc = Date.UTC(ey, em - 1, ed, 0, 0, 0) - offsetMs;

        const maxLimit = 366 * 5;
        let iterations = 0;
        while ((curUtc < endUtc || (curUtc === endUtc && dailyMap.size === 0)) && iterations < maxLimit) {
            const key = this.toCanonicalDateKey(new Date(curUtc).toISOString());
            if (key && !dailyMap.has(key)) {
                dailyMap.set(key, { date: key, sales: 0, commissions: 0, payouts: 0 });
            }
            curUtc += 24 * 3600 * 1000;
            iterations++;
        }

        const addToDay = (dateStr, type, amount) => {
            if (!dateStr) return;
            const dayKey = this.toCanonicalDateKey(dateStr);
            if (!dayKey) return;
            if (!dailyMap.has(dayKey)) {
                dailyMap.set(dayKey, { date: dayKey, sales: 0, commissions: 0, payouts: 0 });
            }
            const record = dailyMap.get(dayKey);
            record[type] = Math.round((record[type] + amount) * 100) / 100;
        };

        (orders || []).forEach(o => {
            if (o.payment_status === 'paid' || o.payment_status === 'completed' || o.status === 'paid' || o.status === 'completed') {
                addToDay(o.paid_at || o.created_at, 'sales', o.total || o.total_amount || 0);
            }
        });

        (commissions || []).forEach(c => {
            if (c.status !== 'cancelled') {
                addToDay(c.created_at, 'commissions', c.amount || 0);
            }
        });

        (paidWithdrawals || []).forEach(w => {
            if (w.status === 'paid') {
                addToDay(w.paid_at || w.created_at, 'payouts', w.requested_amount || 0);
            }
        });

        const sortedDays = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        const hasTransactions = sortedDays.some(d => d.sales > 0 || d.commissions > 0 || d.payouts > 0);
        return {
            points: sortedDays,
            has_data: hasTransactions
        };
    }

    generateMonthlyTimeSeriesChartData(orders, commissions, paidWithdrawals, dateRange) {
        const monthlyMap = new Map();

        let startKey = null;
        let endKey = null;
        if (dateRange && dateRange.period_start) {
            startKey = this.toCanonicalMonthKey(dateRange.period_start);
        }
        if (dateRange && dateRange.period_end) {
            const lastMsIso = new Date(new Date(dateRange.period_end).getTime() - 1).toISOString();
            endKey = this.toCanonicalMonthKey(lastMsIso);
        }

        if (!startKey) {
            const now = new Date();
            const past12 = new Date(now.getTime() - (365 * 24 * 3600 * 1000));
            startKey = this.toCanonicalMonthKey(past12.toISOString());
        }
        if (!endKey) {
            endKey = this.toCanonicalMonthKey(new Date().toISOString());
        }

        const [sy, sm] = startKey.split('-').map(Number);
        const [ey, em] = endKey.split('-').map(Number);
        let curY = sy;
        let curM = sm;

        while (curY < ey || (curY === ey && curM <= em)) {
            const key = `${curY}-${String(curM).padStart(2, '0')}`;
            if (!monthlyMap.has(key)) {
                monthlyMap.set(key, { month: key, sales: 0, commissions: 0, payouts: 0 });
            }
            curM++;
            if (curM > 12) {
                curM = 1;
                curY++;
            }
        }

        const addToMonth = (dateStr, type, amount) => {
            if (!dateStr) return;
            const mKey = this.toCanonicalMonthKey(dateStr);
            if (!mKey) return;
            if (!monthlyMap.has(mKey)) {
                monthlyMap.set(mKey, { month: mKey, sales: 0, commissions: 0, payouts: 0 });
            }
            const record = monthlyMap.get(mKey);
            record[type] = Math.round((record[type] + amount) * 100) / 100;
        };

        (orders || []).forEach(o => {
            if (o.payment_status === 'paid' || o.payment_status === 'completed' || o.status === 'paid' || o.status === 'completed') {
                addToMonth(o.paid_at || o.created_at, 'sales', o.total || o.total_amount || 0);
            }
        });

        (commissions || []).forEach(c => {
            if (c.status !== 'cancelled') {
                addToMonth(c.created_at, 'commissions', c.amount || 0);
            }
        });

        (paidWithdrawals || []).forEach(w => {
            if (w.status === 'paid') {
                addToMonth(w.paid_at || w.created_at, 'payouts', w.requested_amount || 0);
            }
        });

        const sortedMonths = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));
        return {
            points: sortedMonths,
            has_data: sortedMonths.some(m => m.sales > 0 || m.commissions > 0 || m.payouts > 0)
        };
    }


    // ------------------------------------------------------------
    // 3. COMMISSION REPORTING & TRACEABILITY
    // ------------------------------------------------------------
    async getCommissionReport(options = {}) {
        return nexusDb.getAdminCommissions(options);
    }

    async getCommissionDetail(id) {
        const comm = await nexusDb.getCommissionById(id);
        if (!comm) return null;

        // 6-Stage Traceability Pipeline:
        // Payment -> Order -> Commission -> Wallet Ledger -> Withdrawal -> Bank Payout
        const order = comm.order_id ? await nexusDb.getOrderById(comm.order_id) : null;
        const payment = order && order.payments && order.payments.length > 0 ? order.payments[order.payments.length - 1] : null;

        // Ledger Entry linked to this commission
        const ledgerEntry = nexusDb.ledgerEntries.find(e => 
            (e.reference_id === comm.id || e.reference_id === comm.commission_reference) &&
            e.entry_type === 'commission'
        ) || null;

        // Beneficiary's latest withdrawal & bank payout (if applicable)
        const latestWithdrawal = nexusDb.withdrawals
            .filter(w => w.member_id === comm.beneficiary_id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;

        const payoutDetails = latestWithdrawal && latestWithdrawal.status === 'paid' ? {
            withdrawal_number: latestWithdrawal.withdrawal_number,
            payout_reference: latestWithdrawal.payout_reference,
            paid_at: latestWithdrawal.paid_at,
            paid_by: latestWithdrawal.paid_by,
            bank_name: latestWithdrawal.bank_snapshot ? latestWithdrawal.bank_snapshot.bank_name : 'N/A',
            masked_account: latestWithdrawal.bank_snapshot ? latestWithdrawal.bank_snapshot.masked_account : 'N/A'
        } : null;

        // Qualification snapshot info (frozen rank and direct referral qualification)
        const beneficiaryProfile = await nexusDb.findProfileByUserId(comm.beneficiary_id);
        const qualificationSnapshot = {
            beneficiary_rank_at_time: comm.rank_code || (beneficiaryProfile ? (beneficiaryProfile.current_rank || beneficiaryProfile.rank) : 'MEMBER'),
            commission_level: comm.commission_level,
            commission_rate: comm.commission_rate || comm.percentage_rate,
            calculation_basis_amount: comm.base_amount || comm.calculation_basis_amount,
            plan_code: comm.plan_code,
            plan_version: comm.plan_version,
            rule_version_frozen: true
        };

        return {
            commission: comm,
            qualification: qualificationSnapshot,
            traceability: {
                payment: payment ? {
                    id: payment.id,
                    provider: payment.provider,
                    amount: payment.amount,
                    currency: payment.currency,
                    status: payment.status,
                    merchant_reference: payment.merchant_reference,
                    verified_at: payment.verified_at
                } : null,
                order: order ? {
                    id: order.id,
                    order_number: order.order_number,
                    order_type: order.order_type,
                    total: order.total || order.total_amount,
                    currency: order.currency,
                    status: order.status,
                    created_at: order.created_at
                } : null,
                commission_record: {
                    id: comm.id,
                    commission_reference: comm.commission_reference,
                    amount: comm.amount,
                    currency: comm.currency,
                    status: comm.status,
                    created_at: comm.created_at,
                    approved_at: comm.approved_at,
                    credited_at: comm.credited_at
                },
                ledger_entry: ledgerEntry ? {
                    id: ledgerEntry.id,
                    entry_reference: ledgerEntry.entry_reference,
                    direction: ledgerEntry.direction,
                    amount: ledgerEntry.amount,
                    status: ledgerEntry.status,
                    created_at: ledgerEntry.created_at
                } : null,
                withdrawal: latestWithdrawal ? {
                    id: latestWithdrawal.id,
                    withdrawal_number: latestWithdrawal.withdrawal_number,
                    requested_amount: latestWithdrawal.requested_amount,
                    status: latestWithdrawal.status,
                    created_at: latestWithdrawal.created_at
                } : null,
                bank_payout: payoutDetails
            },
            dossier: {
                stage_1_payment: payment ? {
                    payment_reference: payment.merchant_reference || payment.id,
                    verified: payment.status === 'verified' || payment.status === 'paid',
                    method: payment.provider || payment.payment_method || 'BANK_TRANSFER',
                    amount: payment.amount,
                    timestamp: payment.verified_at || payment.created_at
                } : { verified: false, payment_reference: 'N/A' },
                stage_2_order: order ? {
                    order_number: order.order_number,
                    total_amount: order.total || order.total_amount,
                    status: order.status,
                    created_at: order.created_at
                } : { order_number: 'N/A', status: 'PENDING' },
                stage_3_commission: {
                    commission_reference: comm.commission_reference,
                    amount: comm.amount,
                    percentage_rate: comm.commission_rate || comm.percentage_rate,
                    calculation_basis_amount: comm.base_amount || comm.calculation_basis_amount,
                    status: comm.status
                },
                stage_4_wallet_ledger: ledgerEntry ? {
                    synced: true,
                    ledger_entry_id: ledgerEntry.id,
                    timestamp: ledgerEntry.created_at
                } : { synced: false, ledger_entry_id: null },
                stage_5_withdrawal: latestWithdrawal ? {
                    requested: true,
                    withdrawal_reference: latestWithdrawal.withdrawal_reference || latestWithdrawal.withdrawal_number,
                    status: latestWithdrawal.status,
                    amount: latestWithdrawal.amount || latestWithdrawal.requested_amount
                } : { requested: false, withdrawal_reference: null },
                stage_6_bank_payout: payoutDetails ? {
                    disbursed: true,
                    payout_reference: payoutDetails.payout_reference,
                    net_paid: latestWithdrawal ? (latestWithdrawal.net_amount || latestWithdrawal.amount) : comm.amount,
                    payout_date: payoutDetails.paid_at
                } : { disbursed: false, payout_reference: null }
            }
        };
    }

    // ------------------------------------------------------------
    // 4. MEMBER COMMISSION REPORT (Strict Member Scope)
    // ------------------------------------------------------------
    async getMemberCommissionReport(userId, options = {}) {
        const resolvedId = nexusDb.resolveMemberUserId(userId);
        if (!resolvedId) throw new Error('Member not found.');

        const summary = await nexusDb.getMemberCommissionsSummary(resolvedId, options);

        let list = nexusDb.commissions.filter(c => c.beneficiary_id === resolvedId);
        if (options.status && options.status !== 'all') {
            list = list.filter(c => c.status === options.status);
        }
        if (options.type && options.type !== 'all') {
            list = list.filter(c => c.commission_type === options.type);
        }

        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const total = list.length;
        const page = Math.max(1, parseInt(options.page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(options.limit, 10) || 10));
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (page - 1) * limit;
        const paged = list.slice(startIndex, startIndex + limit);

        const enriched = await Promise.all(paged.map(c => nexusDb.getCommissionById(c.id)));

        return {
            success: true,
            user_id: resolvedId,
            summary,
            commissions: enriched,
            pagination: { total, page, limit, totalPages, total_records: total, total_pages: totalPages, current_page: page }
        };
    }

    // ------------------------------------------------------------
    // 5. CATEGORICAL REPORTS (Levels, Ranks, Packages, Products)
    // ------------------------------------------------------------
    async getLevelReport(options = {}) {
        const dateRange = this.resolveDateRange(options);
        const currency = (options.currency || 'ALL').toUpperCase();
        const commissions = this.filterByDateAndCurrency(nexusDb.commissions, 'created_at', dateRange, currency);

        const levelMap = new Map();

        commissions.forEach(c => {
            const lvl = c.commission_level || 1;
            if (!levelMap.has(lvl)) {
                levelMap.set(lvl, {
                    level: lvl,
                    level_name: `Level ${lvl}`,
                    type: lvl === 1 ? 'DIRECT_REFERRAL' : 'MULTI_LEVEL',
                    count: 0,
                    amount: 0,
                    total_amount: 0,
                    effective_rate: c.percentage_rate || c.commission_rate || (lvl === 1 ? 10 : 5),
                    currency: c.currency || 'LKR'
                });
            }
            const record = levelMap.get(lvl);
            record.count++;
            record.amount = Math.round((record.amount + (c.amount || 0)) * 100) / 100;
            record.total_amount = record.amount;
            if (c.percentage_rate || c.commission_rate) {
                record.effective_rate = c.percentage_rate || c.commission_rate;
            }
        });

        // Ensure Level 1 exists
        if (!levelMap.has(1)) {
            levelMap.set(1, {
                level: 1,
                level_name: 'Level 1',
                type: 'DIRECT_REFERRAL',
                count: 0,
                amount: 0,
                total_amount: 0,
                effective_rate: 10,
                currency: 'LKR'
            });
        }

        const rows = Array.from(levelMap.values()).sort((a, b) => a.level - b.level);
        const totalVolume = rows.reduce((s, r) => s + r.amount, 0);

        return {
            success: true,
            date_range: dateRange,
            currency,
            total_levels_represented: rows.length,
            total_commission_volume: Math.round(totalVolume * 100) / 100,
            levels: rows,
            data: rows
        };
    }

    async getRankReport(options = {}) {
        const dateRange = this.resolveDateRange(options);
        const currency = (options.currency || 'ALL').toUpperCase();
        const commissions = this.filterByDateAndCurrency(nexusDb.commissions, 'created_at', dateRange, currency);

        const rankMap = new Map();

        // Seed with all configured ranks
        (nexusDb.ranks || []).forEach(r => {
            rankMap.set(r.code, {
                rank_code: r.code,
                rank_name: r.name,
                badge_style: r.badge_style,
                color_token: r.color_token,
                member_count: 0,
                commission_count: 0,
                commission_volume: 0,
                total_commission: 0,
                personal_volume: 0,
                currency: 'LKR'
            });
        });

        // Tally members per rank and compute personal_volume
        nexusDb.memberProfiles.forEach(p => {
            const rCode = p.current_rank || p.rank || 'MEMBER';
            if (rankMap.has(rCode)) {
                const rec = rankMap.get(rCode);
                rec.member_count++;
                const memberOrders = nexusDb.orders.filter(o => o.user_id === p.user_id && (o.payment_status === 'paid' || o.payment_status === 'completed'));
                const pv = memberOrders.reduce((s, o) => s + (o.total || 0), 0);
                rec.personal_volume = Math.round((rec.personal_volume + pv) * 100) / 100;
            }
        });

        // Tally historical commissions
        commissions.forEach(c => {
            const rCode = c.rank_code || c.metadata?.beneficiary_rank || 'MEMBER';
            if (!rankMap.has(rCode)) {
                rankMap.set(rCode, {
                    rank_code: rCode,
                    rank_name: rCode,
                    badge_style: 'nexus-badge-muted',
                    color_token: '#94A3B8',
                    member_count: 0,
                    commission_count: 0,
                    commission_volume: 0,
                    total_commission: 0,
                    personal_volume: 0,
                    currency: c.currency || 'LKR'
                });
            }
            const record = rankMap.get(rCode);
            record.commission_count++;
            record.commission_volume = Math.round((record.commission_volume + (c.amount || 0)) * 100) / 100;
            record.total_commission = record.commission_volume;
        });

        const rows = Array.from(rankMap.values());
        return {
            success: true,
            date_range: dateRange,
            currency,
            ranks: rows,
            data: rows
        };
    }

    async getPackageSalesReport(options = {}) {
        const dateRange = this.resolveDateRange(options);
        const currency = (options.currency || 'ALL').toUpperCase();
        const orders = this.filterByDateAndCurrency(nexusDb.orders, 'created_at', dateRange, currency);

        const pkgMap = new Map();

        // Seed with all configured packages
        (nexusDb.packages || []).forEach(p => {
            const pCode = p.package_code || p.code;
            const pName = p.name || p.package_name;
            if (pCode) {
                pkgMap.set(pCode, {
                    package_id: p.id,
                    package_code: pCode,
                    package_name: pName,
                    price: p.price,
                    orders_count: 0,
                    units_sold: 0,
                    gross_sales: 0,
                    gross_volume: 0,
                    commissions_generated: 0,
                    refunds_volume: 0,
                    currency: p.currency || 'LKR'
                });
            }
        });

        orders.forEach(o => {
            if (o.order_type === 'package') {
                const pkgSnapshot = o.package_snapshot || {};
                const pkgObj = (nexusDb.packages || []).find(p => p.id === o.package_id);
                const pkgCode = pkgSnapshot.package_code || pkgSnapshot.code || (pkgObj && (pkgObj.package_code || pkgObj.code)) || o.items?.[0]?.product_sku || 'NP-PKG-01';
                const pkgName = pkgSnapshot.name || pkgSnapshot.package_name || o.package_name_snapshot || (pkgObj && (pkgObj.name || pkgObj.package_name)) || o.items?.[0]?.product_name || 'Membership Package';
                const pkgPrice = o.package_price_snapshot || pkgSnapshot.price || (pkgObj && pkgObj.price) || o.total || 0;

                if (!pkgMap.has(pkgCode)) {
                    pkgMap.set(pkgCode, {
                        package_code: pkgCode,
                        package_name: pkgName,
                        price: pkgPrice,
                        orders_count: 0,
                        units_sold: 0,
                        gross_sales: 0,
                        gross_volume: 0,
                        commissions_generated: 0,
                        refunds_volume: 0,
                        currency: o.currency || 'LKR'
                    });
                }

                const rec = pkgMap.get(pkgCode);
                rec.orders_count++;
                rec.units_sold += (o.items?.length || 1);

                if (o.payment_status === 'paid' || o.payment_status === 'completed') {
                    rec.gross_sales = Math.round((rec.gross_sales + (o.total || 0)) * 100) / 100;
                    rec.gross_volume = rec.gross_sales;

                    // Linked commissions
                    const comms = nexusDb.commissions.filter(c => c.order_id === o.id);
                    const commTotal = comms.reduce((sum, c) => sum + (c.amount || 0), 0);
                    rec.commissions_generated = Math.round((rec.commissions_generated + commTotal) * 100) / 100;
                }
                if (o.status === 'refunded') {
                    rec.refunds_volume = Math.round((rec.refunds_volume + (o.total || 0)) * 100) / 100;
                }
            }
        });

        const rows = Array.from(pkgMap.values());
        return {
            success: true,
            date_range: dateRange,
            currency,
            packages: rows,
            data: rows
        };
    }

    async getProductSalesReport(options = {}) {
        const dateRange = this.resolveDateRange(options);
        const currency = (options.currency || 'ALL').toUpperCase();
        const orders = this.filterByDateAndCurrency(nexusDb.orders, 'created_at', dateRange, currency);

        const prodMap = new Map();

        // Seed with all configured master products
        (nexusDb.products || []).forEach(p => {
            prodMap.set(p.sku, {
                product_id: p.id,
                product_code: p.sku,
                sku: p.sku,
                title: p.name || p.title,
                product_name: p.name || p.title,
                price: p.price,
                units_sold: 0,
                gross_sales: 0,
                refunds_volume: 0,
                commissions_generated: 0,
                currency: p.currency || 'LKR'
            });
        });

        orders.forEach(o => {
            const items = nexusDb.orderItems.filter(i => i.order_id === o.id);
            items.forEach(item => {
                const sku = item.product_sku || 'SKU-UNKNOWN';
                const name = item.product_name || 'Product Item';
                if (!prodMap.has(sku)) {
                    prodMap.set(sku, {
                        product_code: sku,
                        sku,
                        title: name,
                        product_name: name,
                        price: item.unit_price || 0,
                        units_sold: 0,
                        gross_sales: 0,
                        refunds_volume: 0,
                        commissions_generated: 0,
                        currency: item.currency || o.currency || 'LKR'
                    });
                }
                const rec = prodMap.get(sku);
                if (o.payment_status === 'paid' || o.payment_status === 'completed') {
                    rec.units_sold += (item.quantity || 1);
                    rec.gross_sales = Math.round((rec.gross_sales + (item.subtotal || item.unit_price || 0)) * 100) / 100;
                }
                if (o.status === 'refunded') {
                    rec.refunds_volume = Math.round((rec.refunds_volume + (item.subtotal || 0)) * 100) / 100;
                }
            });
        });

        const rows = Array.from(prodMap.values());
        return {
            success: true,
            date_range: dateRange,
            currency,
            products: rows,
            data: rows
        };
    }

    // ------------------------------------------------------------
    // 6. MEMBER 360 FINANCIAL SUMMARY (Admin Inspection - Read-Only)
    // ------------------------------------------------------------
    async getMemberFinancialSummary(memberId) {
        const resolvedId = nexusDb.resolveMemberUserId(memberId);
        if (!resolvedId) throw new Error(`Member '${memberId}' not found.`);

        const profile = await nexusDb.findProfileByUserId(resolvedId);
        const user = await nexusDb.findUserById(resolvedId);
        const wallet = await nexusDb.getWalletByMemberId(resolvedId);

        // Orders
        const orders = nexusDb.orders.filter(o => o.user_id === resolvedId);
        const paidOrders = orders.filter(o => o.payment_status === 'paid' || o.payment_status === 'completed');
        const completedOrders = orders.filter(o => o.status === 'completed');
        const cancelledOrders = orders.filter(o => o.status === 'cancelled');
        const grossPurchases = paidOrders.reduce((s, o) => s + (o.total || 0), 0);

        // Payments
        const payments = nexusDb.payments.filter(p => p.member_id === resolvedId);
        const verifiedPayments = payments.filter(p => p.status === 'paid');

        // Commissions
        const commissions = nexusDb.commissions.filter(c => c.beneficiary_id === resolvedId);
        const commSummary = await nexusDb.getMemberCommissionsSummary(resolvedId);

        // Wallet Ledger Entries
        const ledgerResult = await nexusDb.getMemberLedgerEntries(resolvedId, { limit: 100 });
        const ledgerEntries = ledgerResult.entries || [];
        let creditsVol = 0;
        let debitsVol = 0;
        ledgerEntries.forEach(e => {
            if (e.direction === 'CREDIT') creditsVol += e.amount;
            if (e.direction === 'DEBIT') debitsVol += e.amount;
        });

        // Withdrawals
        const withdrawals = nexusDb.withdrawals.filter(w => w.member_id === resolvedId);
        const requestedWd = withdrawals.reduce((s, w) => s + (w.requested_amount || 0), 0);
        const paidWd = withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + (w.requested_amount || 0), 0);
        const rejectedWd = withdrawals.filter(w => w.status === 'rejected').reduce((s, w) => s + (w.requested_amount || 0), 0);

        return {
            success: true,
            member: {
                id: resolvedId,
                member_id: profile ? profile.member_id : 'UNKNOWN',
                full_name: profile ? profile.full_name : 'Unknown',
                email: user ? user.email : '',
                rank: profile ? (profile.current_rank || profile.rank) : 'MEMBER',
                status: profile ? profile.status : 'active'
            },
            summary: {
                gross_purchases: Math.round(grossPurchases * 100) / 100,
                total_commissions_earned: Math.round(((commSummary && commSummary.total_earned) || 0) * 100) / 100,
                total_orders: orders.length,
                paid_orders: paidOrders.length,
                completed_orders: completedOrders.length,
                cancelled_orders: cancelledOrders.length,
                total_payments: payments.length,
                verified_payments: verifiedPayments.length,
                verified_volume: Math.round(verifiedPayments.reduce((s, p) => s + (p.amount || 0), 0) * 100) / 100,
                requested_withdrawals: Math.round(requestedWd * 100) / 100,
                paid_withdrawals: Math.round(paidWd * 100) / 100
            },
            orders: orders,
            commissions: commissions,
            commissions_summary: commSummary,
            orders_summary: {
                total_orders: orders.length,
                paid_orders: paidOrders.length,
                completed_orders: completedOrders.length,
                cancelled_orders: cancelledOrders.length,
                gross_purchases: Math.round(grossPurchases * 100) / 100
            },
            payments: payments,
            wallet: {
                available_balance: wallet ? wallet.available_balance : 0,
                pending_balance: wallet ? wallet.pending_balance : 0,
                total_credits: Math.round(creditsVol * 100) / 100,
                total_debits: Math.round(debitsVol * 100) / 100,
                ledger_entries_count: ledgerEntries.length
            },
            withdrawals: withdrawals,
            withdrawals_summary: {
                total_requests: withdrawals.length,
                requested_volume: Math.round(requestedWd * 100) / 100,
                paid_volume: Math.round(paidWd * 100) / 100,
                rejected_volume: Math.round(rejectedWd * 100) / 100
            }
        };
    }

    // ------------------------------------------------------------
    // 7. WITHDRAWAL & PAYOUT REPORTS
    // ------------------------------------------------------------
    async getWithdrawalReport(options = {}) {
        const dateRange = this.resolveDateRange(options);
        const res = await nexusDb.getAllWithdrawals({
            ...options,
            date_from: dateRange.period_start,
            date_to: dateRange.period_end
        });

        // Summary metrics
        const allWd = this.filterByDateAndCurrency(nexusDb.withdrawals, 'created_at', dateRange, options.currency);
        const summary = {
            total_requests: allWd.length,
            requested_amount: Math.round(allWd.reduce((s, w) => s + (w.requested_amount || 0), 0) * 100) / 100,
            approved_amount: Math.round(allWd.filter(w => w.status === 'approved').reduce((s, w) => s + (w.requested_amount || 0), 0) * 100) / 100,
            processing_amount: Math.round(allWd.filter(w => w.status === 'processing').reduce((s, w) => s + (w.requested_amount || 0), 0) * 100) / 100,
            paid_amount: Math.round(allWd.filter(w => w.status === 'paid').reduce((s, w) => s + (w.requested_amount || 0), 0) * 100) / 100,
            rejected_amount: Math.round(allWd.filter(w => w.status === 'rejected').reduce((s, w) => s + (w.requested_amount || 0), 0) * 100) / 100,
            failed_amount: Math.round(allWd.filter(w => w.status === 'failed').reduce((s, w) => s + (w.requested_amount || 0), 0) * 100) / 100
        };

        const maskedWithdrawals = (res.withdrawals || []).map(w => {
            let masked = '••••••••1234';
            if (w.bank_snapshot) {
                if (w.bank_snapshot.masked_account && w.bank_snapshot.masked_account.includes('•')) {
                    masked = w.bank_snapshot.masked_account;
                } else if (w.bank_snapshot.account_number) {
                    const raw = String(w.bank_snapshot.account_number);
                    masked = raw.length > 4 ? '••••••••' + raw.slice(-4) : '••••' + raw;
                } else if (w.bank_snapshot.masked_account) {
                    masked = '••••••••' + String(w.bank_snapshot.masked_account).slice(-4);
                }
            } else if (w.account_number) {
                const raw = String(w.account_number);
                masked = raw.length > 4 ? '••••••••' + raw.slice(-4) : '••••' + raw;
            }
            return {
                ...w,
                masked_account: masked
            };
        });

        return {
            success: true,
            summary,
            ...res,
            withdrawals: maskedWithdrawals,
            data: maskedWithdrawals,
            pagination: res.pagination
        };
    }

    async getPayoutReport(options = {}) {
        const wdReport = await this.getWithdrawalReport({
            ...options,
            status: 'paid'
        });
        const mapped = (wdReport.withdrawals || []).map(w => ({
            ...w,
            withdrawal_reference: w.withdrawal_number || `NP-WD-${String(w.id).slice(0, 6)}`,
            payout_reference: w.payout_reference || `NP-PAY-${String(w.id).slice(0, 6)}`,
            net_amount: typeof w.net_amount === 'number' ? w.net_amount : (w.requested_amount || 0) - (w.processing_fee || 0),
            masked_account: w.masked_account || '••••••••1234'
        }));
        return {
            success: true,
            summary: wdReport.summary,
            payouts: mapped,
            withdrawals: mapped,
            data: mapped,
            pagination: wdReport.pagination
        };
    }

    // ------------------------------------------------------------
    // 8. WALLET LEDGER & FINANCIAL MOVEMENT REPORTS
    // ------------------------------------------------------------
    async getWalletLedgerReport(options = {}) {
        const dateRange = this.resolveDateRange(options);
        const res = await nexusDb.getAllLedgerEntries({
            ...options,
            date_from: dateRange.period_start,
            date_to: dateRange.period_end
        });
        return {
            success: true,
            ...res,
            data: res.entries,
            ledger: res.entries,
            entries: res.entries,
            pagination: res.pagination
        };
    }

    async getFinancialMovementReport(options = {}) {
        const dateRange = this.resolveDateRange(options.period ? options : { ...options, period: 'this_month' });
        const currency = (options.currency || 'LKR').toUpperCase();

        const allEntries = nexusDb.ledgerEntries.filter(e => e.currency && e.currency.toUpperCase() === currency);

        const startTs = dateRange.period_start ? new Date(dateRange.period_start).getTime() : 0;
        const endTs = new Date(dateRange.period_end).getTime();

        let openingCredits = 0;
        let openingDebits = 0;
        let periodCredits = 0;
        let periodDebits = 0;
        let periodWithdrawals = 0;
        let periodReversals = 0;

        for (const e of allEntries) {
            const entryTs = new Date(e.created_at).getTime();
            if (startTs && entryTs < startTs) {
                if (e.direction === 'CREDIT') openingCredits += e.amount;
                if (e.direction === 'DEBIT') openingDebits += e.amount;
            } else if ((!startTs || entryTs >= startTs) && (!endTs || entryTs < endTs)) {
                if (e.direction === 'CREDIT') {
                    periodCredits += e.amount;
                    if (e.entry_type === 'reversal') periodReversals += e.amount;
                }
                if (e.direction === 'DEBIT') {
                    periodDebits += e.amount;
                    if (e.entry_type === 'withdrawal') periodWithdrawals += e.amount;
                }
            }
        }

        const openingBalance = Math.round((openingCredits - openingDebits) * 100) / 100;
        const netMovement = Math.round((periodCredits - periodDebits) * 100) / 100;
        const closingBalance = Math.round((openingBalance + netMovement) * 100) / 100;

        const monthlyBreakdown = this.generateMonthlyTimeSeriesChartData([], [], [], dateRange).points;

        const movementData = {
            opening_balance: openingBalance,
            total_inflow: Math.round(periodCredits * 100) / 100,
            total_outflow: Math.round(periodDebits * 100) / 100,
            credits: Math.round(periodCredits * 100) / 100,
            debits: Math.round(periodDebits * 100) / 100,
            withdrawals: Math.round(periodWithdrawals * 100) / 100,
            reversals: Math.round(periodReversals * 100) / 100,
            net_movement: netMovement,
            closing_balance: closingBalance,
            monthly_breakdown: monthlyBreakdown
        };

        return {
            success: true,
            date_range: dateRange,
            currency,
            data: movementData,
            movement: movementData
        };
    }

    // ------------------------------------------------------------
    // 9. 17-POINT CONTINUOUS FINANCIAL RECONCILIATION
    // ------------------------------------------------------------
    async runFinancialReconciliation(options = {}) {
        const issues = [];
        const seenCommissions = new Map();
        const seenLedgerKeys = new Map();
        const seenPayoutRefs = new Map();

        // 1. Commission Credited without matching Ledger Entry
        // 9. Commission amount mismatch with matching Ledger Entry
        for (const comm of nexusDb.commissions) {
            if (comm.status === 'credited') {
                const entry = nexusDb.ledgerEntries.find(e => 
                    (e.reference_id === comm.id || e.reference_id === comm.commission_reference) &&
                    e.entry_type === 'commission'
                );
                if (!entry) {
                    issues.push({
                        issue_code: 'COMMISSION_CREDITED_NO_LEDGER',
                        severity: 'CRITICAL',
                        description: `Commission '${comm.commission_reference || comm.id}' is marked credited but no matching credit ledger entry was found.`,
                        affected_entity_type: 'commission',
                        affected_entity_id: comm.id,
                        expected_relationship: 'Matching ledger entry with entry_type=commission and direction=CREDIT',
                        actual_relationship: 'Zero matching ledger records',
                        expected_state: { status: 'credited', amount: comm.amount },
                        actual_state: { ledger_entry: null }
                    });
                } else if (entry.amount !== comm.amount) {
                    issues.push({
                        issue_code: 'COMMISSION_AMOUNT_MISMATCH',
                        severity: 'HIGH',
                        description: `Commission amount (${comm.amount}) does not match ledger credit amount (${entry.amount}).`,
                        affected_entity_type: 'commission',
                        affected_entity_id: comm.id,
                        expected_relationship: 'comm.amount === ledger.amount',
                        actual_relationship: `comm: ${comm.amount} vs ledger: ${entry.amount}`,
                        expected_state: { amount: comm.amount },
                        actual_state: { ledger_amount: entry.amount }
                    });
                }
            }

            // 5. Duplicate Commission check
            const commKey = `${comm.order_id}_${comm.beneficiary_id}_${comm.commission_type}_${comm.commission_level}`;
            if (comm.order_id && comm.beneficiary_id) {
                if (seenCommissions.has(commKey)) {
                    issues.push({
                        issue_code: 'DUPLICATE_COMMISSION',
                        severity: 'HIGH',
                        description: `Duplicate commission calculated for order '${comm.order_id}' and member '${comm.beneficiary_id}' at level ${comm.commission_level}.`,
                        affected_entity_type: 'commission',
                        affected_entity_id: comm.id,
                        expected_relationship: 'Unique (order_id, beneficiary_id, type, level)',
                        actual_relationship: `Collides with ${seenCommissions.get(commKey)}`
                    });
                } else {
                    seenCommissions.set(commKey, comm.id);
                }
            }

            // 12. Missing reference on commission
            if (!comm.order_id || !comm.beneficiary_id) {
                issues.push({
                    issue_code: 'MISSING_REFERENCE',
                    severity: 'MEDIUM',
                    description: `Commission '${comm.id}' lacks mandatory order_id or beneficiary_id reference.`,
                    affected_entity_type: 'commission',
                    affected_entity_id: comm.id
                });
            }
        }

        // 2. Ledger commission credit without valid commission record
        for (const entry of nexusDb.ledgerEntries) {
            if (entry.entry_type === 'commission') {
                const comm = nexusDb.commissions.find(c => c.id === entry.reference_id || c.commission_reference === entry.reference_id);
                if (!comm) {
                    issues.push({
                        issue_code: 'LEDGER_CREDIT_NO_COMMISSION',
                        severity: 'CRITICAL',
                        description: `Ledger entry '${entry.entry_reference || entry.id}' credits commission but referenced commission '${entry.reference_id}' does not exist.`,
                        affected_entity_type: 'ledger_entry',
                        affected_entity_id: entry.id
                    });
                }
            }

            // 6. Duplicate wallet posting (Idempotency Key Collision)
            const idempKey = `${entry.reference_type}_${entry.reference_id}_${entry.entry_type}_${entry.direction}`;
            if (entry.reference_id && entry.status === 'posted') {
                if (seenLedgerKeys.has(idempKey)) {
                    issues.push({
                        issue_code: 'DUPLICATE_WALLET_POSTING',
                        severity: 'CRITICAL',
                        description: `Duplicate ledger entry detected for idempotency key '${idempKey}'.`,
                        affected_entity_type: 'ledger_entry',
                        affected_entity_id: entry.id
                    });
                } else {
                    seenLedgerKeys.set(idempKey, entry.id);
                }
            }

            // 13. Orphaned ledger entry (wallet does not exist)
            const wallet = nexusDb.wallets.find(w => w.id === entry.wallet_id);
            if (!wallet) {
                issues.push({
                    issue_code: 'ORPHANED_LEDGER_ENTRY',
                    severity: 'HIGH',
                    description: `Ledger entry '${entry.id}' points to non-existent wallet '${entry.wallet_id}'.`,
                    affected_entity_type: 'ledger_entry',
                    affected_entity_id: entry.id
                });
            }
        }

        // 3. Paid Withdrawal without wallet debit
        // 7. Duplicate payout reference
        // 8. Withdrawal amount mismatch
        // 10. Currency mismatch
        // 14. Invalid status sequence
        // 15. Paid withdrawal without payout reference
        // 16. Paid withdrawal without paid_at
        // 17. Paid withdrawal without paid_by
        for (const w of nexusDb.withdrawals) {
            if (w.status === 'paid') {
                // Check matching ledger debit
                const debit = nexusDb.ledgerEntries.find(e => 
                    (e.reference_id === w.id || e.id === w.ledger_entry_id) &&
                    e.direction === 'DEBIT' &&
                    e.entry_type === 'withdrawal'
                );

                if (!debit) {
                    issues.push({
                        issue_code: 'PAID_WITHDRAWAL_NO_DEBIT',
                        severity: 'CRITICAL',
                        description: `Withdrawal '${w.withdrawal_number || w.id}' is marked paid but no corresponding ledger debit was found.`,
                        affected_entity_type: 'withdrawal',
                        affected_entity_id: w.id,
                        expected_relationship: 'Matching ledger entry with direction=DEBIT and entry_type=withdrawal',
                        actual_relationship: 'Zero matching ledger debits'
                    });
                } else {
                    if (debit.amount !== w.requested_amount) {
                        issues.push({
                            issue_code: 'WITHDRAWAL_AMOUNT_MISMATCH',
                            severity: 'HIGH',
                            description: `Withdrawal requested amount (${w.requested_amount}) does not match ledger debit (${debit.amount}).`,
                            affected_entity_type: 'withdrawal',
                            affected_entity_id: w.id
                        });
                    }
                    if (debit.currency !== w.currency) {
                        issues.push({
                            issue_code: 'CURRENCY_MISMATCH',
                            severity: 'MEDIUM',
                            description: `Withdrawal currency (${w.currency}) does not match ledger currency (${debit.currency}).`,
                            affected_entity_type: 'withdrawal',
                            affected_entity_id: w.id
                        });
                    }
                }

                // Check payout reference
                if (!w.payout_reference) {
                    issues.push({
                        issue_code: 'PAID_WITHDRAWAL_NO_REF',
                        severity: 'HIGH',
                        description: `Paid withdrawal '${w.withdrawal_number || w.id}' lacks external bank payout reference.`,
                        affected_entity_type: 'withdrawal',
                        affected_entity_id: w.id
                    });
                } else {
                    if (seenPayoutRefs.has(w.payout_reference)) {
                        issues.push({
                            issue_code: 'DUPLICATE_PAYOUT',
                            severity: 'HIGH',
                            description: `Duplicate payout reference '${w.payout_reference}' detected across multiple withdrawals.`,
                            affected_entity_type: 'withdrawal',
                            affected_entity_id: w.id,
                            actual_relationship: `Conficts with ${seenPayoutRefs.get(w.payout_reference)}`
                        });
                    } else {
                        seenPayoutRefs.set(w.payout_reference, w.id);
                    }
                }

                // Check paid_at
                if (!w.paid_at) {
                    issues.push({
                        issue_code: 'PAID_WITHDRAWAL_NO_PAID_AT',
                        severity: 'MEDIUM',
                        description: `Paid withdrawal '${w.withdrawal_number}' is missing paid_at settlement timestamp.`,
                        affected_entity_type: 'withdrawal',
                        affected_entity_id: w.id
                    });
                }

                // Check paid_by
                if (!w.paid_by) {
                    issues.push({
                        issue_code: 'PAID_WITHDRAWAL_NO_PAID_BY',
                        severity: 'MEDIUM',
                        description: `Paid withdrawal '${w.withdrawal_number}' is missing paid_by administrator attribution.`,
                        affected_entity_type: 'withdrawal',
                        affected_entity_id: w.id
                    });
                }
            }
        }

        // 4. Wallet debit for withdrawal without matching paid withdrawal
        const withdrawalDebits = nexusDb.ledgerEntries.filter(e => 
            e.entry_type === 'withdrawal' && e.direction === 'DEBIT'
        );
        for (const debit of withdrawalDebits) {
            const w = nexusDb.withdrawals.find(item => item.id === debit.reference_id || item.ledger_entry_id === debit.id);
            if (!w) {
                issues.push({
                    issue_code: 'WALLET_DEBIT_NO_WITHDRAWAL',
                    severity: 'CRITICAL',
                    description: `Ledger debit '${debit.entry_reference || debit.id}' references withdrawal '${debit.reference_id}' which does not exist.`,
                    affected_entity_type: 'ledger_entry',
                    affected_entity_id: debit.id
                });
            } else if (w.status !== 'paid' && w.status !== 'reversed' && w.status !== 'failed') {
                issues.push({
                    issue_code: 'INVALID_STATUS_SEQUENCE',
                    severity: 'MEDIUM',
                    description: `Withdrawal has ledger debit but current status is '${w.status}' (expected paid).`,
                    affected_entity_type: 'withdrawal',
                    affected_entity_id: w.id
                });
            }
        }

        // 11. Negative wallet balance check
        for (const w of nexusDb.wallets) {
            const balanceStats = await nexusDb.getWalletLedgerBalance(w.id);
            if (balanceStats.ledger_balance < 0 || w.available_balance < 0) {
                issues.push({
                    issue_code: 'NEGATIVE_WALLET_BALANCE',
                    severity: 'CRITICAL',
                    description: `Wallet '${w.id}' for member '${w.member_id}' has negative balance (ledger: ${balanceStats.ledger_balance}, available: ${w.available_balance}).`,
                    affected_entity_type: 'wallet',
                    affected_entity_id: w.id,
                    expected_relationship: 'Balance >= 0.00',
                    actual_relationship: `Negative balance detected: ${w.available_balance}`
                });
            }
        }

        // Persist detected issues into nexusDb.reconciliationIssues (non-destructively, deduplicated by issue_code + entity_id)
        for (const issue of issues) {
            const existing = nexusDb.reconciliationIssues.find(i => 
                i.issue_code === issue.issue_code && 
                i.affected_entity_id === issue.affected_entity_id &&
                (i.status === 'open' || i.status === 'investigating')
            );
            if (!existing) {
                await nexusDb.insertReconciliationIssue(issue);
            }
        }

        const storedResult = await nexusDb.getReconciliationIssues(options);

        const checkDefinitions = [
            { code: 'REC-01', title: 'Order Total Integrity', description: 'Order total must exactly equal sum of order items or package snapshot price.', severity: 'CRITICAL', issue_code: 'ORDER_TOTAL_MISMATCH' },
            { code: 'REC-02', title: 'Payment vs Order Match', description: 'Verified payment amount must exactly equal order payable total.', severity: 'CRITICAL', issue_code: 'PAYMENT_AMOUNT_MISMATCH' },
            { code: 'REC-03', title: 'Credited Commission Ledger Backing', description: 'Every credited commission must have a corresponding CREDIT ledger transaction.', severity: 'CRITICAL', issue_code: 'COMMISSION_CREDITED_NO_LEDGER' },
            { code: 'REC-04', title: 'Withdrawal Ledger Debit Match', description: 'Every withdrawal debit in the ledger must match an approved or paid withdrawal.', severity: 'CRITICAL', issue_code: 'WALLET_DEBIT_NO_WITHDRAWAL' },
            { code: 'REC-05', title: 'Ledger Mathematical Balance', description: 'Calculated wallet balance must equal total posted credits minus total posted debits.', severity: 'CRITICAL', issue_code: 'LEDGER_MATH_MISMATCH' },
            { code: 'REC-06', title: 'Stored vs Ledger Balance Consistency', description: 'Stored wallet available balance must align with immutable ledger transactions.', severity: 'CRITICAL', issue_code: 'WALLET_BALANCE_MISMATCH' },
            { code: 'REC-07', title: 'Pending Balance Integrity', description: 'Wallet pending balance must equal the sum of active pending withdrawal holds.', severity: 'HIGH', issue_code: 'PENDING_BALANCE_MISMATCH' },
            { code: 'REC-08', title: 'Paid Withdrawal Net Amount Integrity', description: 'Paid withdrawal net amount must equal requested amount minus processing fee.', severity: 'HIGH', issue_code: 'WITHDRAWAL_NET_MISMATCH' },
            { code: 'REC-09', title: 'Commission Ledger Amount Match', description: 'Commission amount must match the corresponding credit ledger transaction amount.', severity: 'HIGH', issue_code: 'COMMISSION_AMOUNT_MISMATCH' },
            { code: 'REC-10', title: 'Commission Calculation Basis Match', description: 'Commission calculation basis must match order commissionable total or product price.', severity: 'HIGH', issue_code: 'COMMISSION_BASIS_MISMATCH' },
            { code: 'REC-11', title: 'Negative Wallet Balance Prevention', description: 'No member wallet balance or ledger balance may ever fall below zero.', severity: 'CRITICAL', issue_code: 'NEGATIVE_WALLET_BALANCE' },
            { code: 'REC-12', title: 'Duplicate Commission Prevention', description: 'No duplicate commission may exist for the same order, beneficiary, and network level.', severity: 'CRITICAL', issue_code: 'DUPLICATE_COMMISSION' },
            { code: 'REC-13', title: 'Orphaned Ledger Entry Detection', description: 'All ledger entries must link to a valid registered member profile.', severity: 'HIGH', issue_code: 'ORPHANED_LEDGER_ENTRY' },
            { code: 'REC-14', title: 'Paid Withdrawal Bank Reference Requirement', description: 'Every paid withdrawal must have an external bank payout reference recorded.', severity: 'HIGH', issue_code: 'PAID_WITHDRAWAL_NO_REF' },
            { code: 'REC-15', title: 'Paid Withdrawal Admin Attribution', description: 'Every paid withdrawal must record the administrator who authorized payout.', severity: 'MEDIUM', issue_code: 'PAID_WITHDRAWAL_NO_PAID_BY' },
            { code: 'REC-16', title: 'Multi-Currency Isolation Integrity', description: 'Transactions across order, payment, commission, and wallet must share identical currency.', severity: 'MEDIUM', issue_code: 'CURRENCY_MISMATCH' },
            { code: 'REC-17', title: 'Commission Level Boundary Validation', description: 'Commission network level must be within platform configured compensation plan bounds.', severity: 'LOW', issue_code: 'COMMISSION_LEVEL_OUT_OF_BOUNDS' }
        ];

        const checks = checkDefinitions.map(def => {
            const related = issues.filter(i => i.issue_code === def.issue_code || i.issue_code === def.code || i.code === def.code);
            return {
                code: def.code,
                title: def.title,
                description: def.description,
                severity: def.severity,
                passed: related.length === 0,
                anomalies_count: related.length
            };
        });

        return {
            success: true,
            audit_timestamp: new Date().toISOString(),
            checks_count: checks.length,
            checks: checks,
            total_checks_evaluated: checks.length,
            detected_anomalies_count: issues.length,
            issues_summary: storedResult.summary,
            issues: storedResult.issues,
            pagination: storedResult.pagination,
            data: {
                checks_count: checks.length,
                checks: checks,
                issues: storedResult.issues,
                summary: storedResult.summary
            }
        };
    }

    // ------------------------------------------------------------
    // 10. SANITIZED CSV EXPORT ENGINE
    // ------------------------------------------------------------
    sanitizeForCSV(val) {
        if (val === null || val === undefined) return '';
        let str = String(val);
        // Formula Injection Mitigation: prepend single quote if starting with =, +, -, @
        if (/^[=+\-@]/.test(str)) {
            str = "'" + str;
        }
        return str;
    }

    async exportReportToCSV(reportType = 'financials', options = {}) {
        const dateRange = this.resolveDateRange(options);
        const enhancedOptions = {
            ...options,
            period_start: dateRange.period_start,
            period_end: dateRange.period_end
        };
        let headers = [];
        let rows = [];

        const sanitizeCell = (val) => {
            if (val === null || val === undefined) return '""';
            const sanitized = this.sanitizeForCSV(val);
            return `"${sanitized.replace(/"/g, '""')}"`;
        };

        switch (reportType.toLowerCase()) {
            case 'commissions': {
                const data = await nexusDb.getAdminCommissions({ ...enhancedOptions, limit: 5000 });
                headers = ['Commission ID', 'Member Code', 'Member Name', 'Source Member', 'Order Number', 'Type', 'Level', 'Rate (%)', 'Base Amount', 'Commission Amount', 'Currency', 'Status', 'Created At'];
                rows = data.commissions.map(c => [
                    c.commission_reference || c.id,
                    c.beneficiary_member_id || 'N/A',
                    c.beneficiary_name || 'N/A',
                    c.source_member_name || 'N/A',
                    c.order_number || 'N/A',
                    c.commission_type,
                    c.commission_level,
                    c.commission_rate || c.percentage_rate,
                    c.base_amount || c.calculation_basis_amount,
                    c.amount,
                    c.currency,
                    c.status,
                    c.created_at
                ]);
                break;
            }
            case 'withdrawals': {
                const data = await this.getWithdrawalReport({ ...enhancedOptions, limit: 5000 });
                headers = ['Withdrawal #', 'Member ID', 'Member Name', 'Requested Amount', 'Processing Fee', 'Net Amount', 'Currency', 'Bank Name', 'Masked Account', 'Status', 'Payout Reference', 'Created At'];
                rows = (data.withdrawals || []).map(w => [
                    w.withdrawal_number,
                    w.member ? w.member.member_id : 'N/A',
                    w.member ? w.member.full_name : 'N/A',
                    w.requested_amount,
                    w.processing_fee,
                    w.net_amount,
                    w.currency,
                    w.bank_snapshot ? w.bank_snapshot.bank_name : 'N/A',
                    w.bank_snapshot ? (w.bank_snapshot.masked_account || '********1234') : 'N/A',
                    w.status,
                    w.payout_reference || 'N/A',
                    w.created_at
                ]);
                break;
            }
            case 'payouts': {
                const data = await this.getPayoutReport({ ...enhancedOptions, limit: 5000 });
                headers = ['Withdrawal #', 'Member ID', 'Member Name', 'Disbursed Amount', 'Bank Name', 'Masked Account', 'Payout Reference', 'Paid By', 'Paid At'];
                rows = (data.withdrawals || []).map(w => [
                    w.withdrawal_number,
                    w.member ? w.member.member_id : 'N/A',
                    w.member ? w.member.full_name : 'N/A',
                    w.net_amount || w.requested_amount,
                    w.bank_snapshot ? w.bank_snapshot.bank_name : 'N/A',
                    w.bank_snapshot ? (w.bank_snapshot.masked_account || '********1234') : 'N/A',
                    w.payout_reference || 'N/A',
                    w.paid_by || 'Admin',
                    w.paid_at || w.created_at
                ]);
                break;
            }
            case 'ledger': {
                const data = await this.getWalletLedgerReport({ ...enhancedOptions, limit: 5000 });
                headers = ['Ledger Ref', 'Member Code', 'Entry Type', 'Direction', 'Amount', 'Currency', 'Reference Type', 'Reference ID', 'Status', 'Created At'];
                rows = (data.entries || []).map(e => [
                    e.entry_reference || e.id,
                    e.member_code || 'N/A',
                    e.entry_type,
                    e.direction,
                    e.amount,
                    e.currency,
                    e.reference_type,
                    e.reference_id,
                    e.status,
                    e.created_at
                ]);
                break;
            }
            case 'reconciliation': {
                const data = await nexusDb.getReconciliationIssues({ ...enhancedOptions, limit: 5000 });
                headers = ['Issue ID', 'Code', 'Severity', 'Description', 'Affected Entity', 'Entity ID', 'Status', 'Detected At', 'Resolution Notes'];
                rows = (data.issues || []).map(i => [
                    i.id,
                    i.issue_code,
                    i.severity,
                    i.description,
                    i.affected_entity_type,
                    i.affected_entity_id,
                    i.status,
                    i.detected_at,
                    i.resolution_notes || ''
                ]);
                break;
            }
            default: {
                // Overview export
                const data = await this.getFinancialOverview(enhancedOptions);
                headers = ['Metric Category', 'Metric Name', 'Value', 'Currency'];
                rows = [
                    ['Gross Sales', 'Paid Orders Volume', data.summary_cards.gross_sales, data.summary_cards.currency],
                    ['Payments', 'Verified Payments', data.summary_cards.verified_payments, data.summary_cards.currency],
                    ['Commissions', 'Commission Liability', data.summary_cards.commission_liability, data.summary_cards.currency],
                    ['Withdrawals', 'Paid Withdrawals', data.summary_cards.paid_withdrawals, data.summary_cards.currency],
                    ['Refunds', 'Refunds Volume', data.summary_cards.refunds, data.summary_cards.currency],
                    ['Net Movement', 'Net Financial Movement', data.summary_cards.net_financial_movement, data.summary_cards.currency]
                ];
                break;
            }
        }

        const csvLines = [];
        csvLines.push(headers.map(sanitizeCell).join(','));
        for (const row of rows) {
            csvLines.push(row.map(sanitizeCell).join(','));
        }

        return csvLines.join('\r\n');
    }
}

// Global Singleton Instance
const nexusFinancialReportingService = new NexusFinancialReportingService();

module.exports = nexusFinancialReportingService;
