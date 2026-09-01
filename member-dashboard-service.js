// Hapanamy.lk Member Dashboard Domain Service (STEP 26)
// Compiles full personalized member dashboard metrics, earnings summaries, binary tree stats,
// direct referral lists, referral link tools, product entitlements, and wallet financial ledgers.

const WalletService = require('./wallet-service');
const EarningsCapEngine = require('./earnings-cap-engine');
const VolumeLedger = require('./volume-ledger');
const QualificationEngine = require('./qualification-engine');
const ReferralService = require('./referral-service');
const PlacementEngine = require('./placement-engine');

const MemberDashboardService = {
    /**
     * Compiles complete member dashboard payload for a specific user.
     * Enforces privacy and tenant isolation (never returns other members' private data).
     */
    getMemberDashboardData({
        userId,
        users = [],
        kycDocs = [],
        purchases = [],
        sponsors = [],
        binaryNodes = [],
        walletLedger = [],
        volumeLedger = [],
        withdrawals = [],
        paymentSubmissions = [],
        baseUrl = 'https://hapanamy.lk'
    }) {
        if (!userId) throw new Error('User ID is required.');

        // 1. Resolve User
        const user = users.find(u => u.id === userId || u.username === userId);
        if (!user) {
            throw new Error(`Member ${userId} not found.`);
        }

        const actualUserId = user.id;

        // 2. Member Profile & KYC Status
        const kycRecord = kycDocs.find(k => k.user_id === actualUserId);
        const kycStatus = kycRecord ? kycRecord.status : (user.kyc_status || 'NOT_SUBMITTED');

        // 3. Qualification Evaluation
        const qualificationContext = { users, kycDocs, purchases, sponsors, binaryNodes };
        const qDecision = QualificationEngine.evaluateQualification(actualUserId, qualificationContext);

        // 4. Financial & Earnings Summary
        const walletBalances = WalletService.getWalletBalances(actualUserId, walletLedger);
        const capSummary = EarningsCapEngine.getMemberEarningsSummary(actualUserId, walletLedger);

        // 5. Binary Network Volume & Counts
        const volumeSummary = VolumeLedger.getVolumeSummary(actualUserId, volumeLedger);
        const node = binaryNodes.find(n => n.user_id === actualUserId);

        // Compute direct descendants under Left and Right subtrees
        let leftTeamCount = 0;
        let rightTeamCount = 0;
        const leftTeamMembers = [];
        const rightTeamMembers = [];

        if (node) {
            const allDescendants = PlacementEngine.getDescendants(actualUserId, binaryNodes);
            const leftDescendants = allDescendants.filter(d => d.branch_leg === 'LEFT');
            const rightDescendants = allDescendants.filter(d => d.branch_leg === 'RIGHT');

            leftTeamCount = leftDescendants.length;
            rightTeamCount = rightDescendants.length;

            leftDescendants.forEach(d => {
                const u = users.find(usr => usr.id === d.user_id);
                if (u) leftTeamMembers.push({ id: u.id, username: u.username, full_name: u.full_name, position: 'LEFT' });
            });

            rightDescendants.forEach(d => {
                const u = users.find(usr => usr.id === d.user_id);
                if (u) rightTeamMembers.push({ id: u.id, username: u.username, full_name: u.full_name, position: 'RIGHT' });
            });
        }

        // 6. Direct Referrals List
        const directSponsorLinks = sponsors.filter(s => s.sponsor_id === actualUserId);
        const directReferrals = directSponsorLinks.map(link => {
            const referredUser = users.find(u => u.id === link.user_id);
            const refNode = binaryNodes.find(n => n.user_id === link.user_id);
            const refPurchases = purchases.filter(p => p.user_id === link.user_id && p.status === 'ACTIVE');
            const refQDecision = QualificationEngine.evaluateQualification(link.user_id, qualificationContext);

            return {
                user_id: link.user_id,
                username: referredUser ? referredUser.username : link.user_id,
                full_name: referredUser ? referredUser.full_name : 'Member',
                email: referredUser ? referredUser.email : null,
                join_date: referredUser ? (referredUser.created_at || '2026-09-01') : null,
                tree_position: refNode ? refNode.position : 'UNPLACED',
                has_active_purchase: refPurchases.length > 0,
                qualification_status: refQDecision.status
            };
        });

        // 7. Referral Link Tools
        const referralCode = user.referral_code || user.username;
        const referralLinks = ReferralService.generateReferralLinks(user.username, baseUrl);

        // 8. Purchased Products
        const userPurchases = purchases.filter(p => p.user_id === actualUserId);
        const activeProducts = userPurchases.map(p => ({
            purchase_id: p.id,
            product_id: p.product_id,
            product_name: p.economics_snapshot ? p.economics_snapshot.product_name : (p.product_name || 'Masterclass'),
            selling_price: p.selling_price || (p.economics_snapshot ? p.economics_snapshot.selling_price : 0),
            status: p.status,
            activated_at: p.activated_at || p.created_at
        }));

        // 9. Financial Ledgers & Pending Actions
        const userWalletTransactions = walletLedger.filter(tx => tx.user_id === actualUserId);
        const userWithdrawals = withdrawals.filter(w => w.user_id === actualUserId);
        const userPendingPayments = paymentSubmissions.filter(pay => pay.user_id === actualUserId && pay.status === 'PENDING');

        return {
            success: true,
            user_id: actualUserId,
            profile: {
                id: actualUserId,
                full_name: user.full_name || 'Hapanamy Member',
                username: user.username,
                email: user.email,
                phone: user.phone || user.mobile_number,
                account_status: user.status || 'ACTIVE',
                kyc_status: kycStatus,
                qualification_status: qDecision.status,
                is_qualified: qDecision.is_qualified,
                unmet_requirements: qDecision.unmet_requirements
            },
            earnings: {
                today_earnings: capSummary.daily_earned,
                month_earnings: capSummary.monthly_earned,
                total_earned: walletBalances.total_earned,
                available_balance: walletBalances.available_balance,
                pending_balance: walletBalances.pending_balance,
                withdrawal_hold_balance: walletBalances.withdrawal_hold_balance,
                total_withdrawn: walletBalances.total_withdrawn,
                reversed_balance: walletBalances.reversed_balance,
                daily_cap: capSummary.daily_cap,
                daily_remaining: capSummary.daily_remaining,
                monthly_cap: capSummary.monthly_cap,
                monthly_remaining: capSummary.monthly_remaining
            },
            binary_network: {
                left_team_count: leftTeamCount,
                right_team_count: rightTeamCount,
                left_volume_lifetime: volumeSummary.lifetime_left_volume,
                right_volume_lifetime: volumeSummary.lifetime_right_volume,
                left_volume_current: volumeSummary.current_left_volume,
                right_volume_current: volumeSummary.current_right_volume,
                matched_volume: (volumeSummary.matched_left_volume || 0) + (volumeSummary.matched_right_volume || 0),
                reversed_left: volumeSummary.reversed_left_volume || 0,
                reversed_right: volumeSummary.reversed_right_volume || 0,
                left_directs_count: directReferrals.filter(d => d.tree_position === 'LEFT').length,
                right_directs_count: directReferrals.filter(d => d.tree_position === 'RIGHT').length
            },
            direct_referrals: {
                total_directs: directReferrals.length,
                list: directReferrals
            },
            referral_tools: {
                referral_code: referralCode,
                general_link: referralLinks.general_link,
                left_link: referralLinks.left_link,
                right_link: referralLinks.right_link
            },
            products: {
                total_purchased: userPurchases.length,
                active_count: activeProducts.filter(a => a.status === 'ACTIVE').length,
                list: activeProducts
            },
            financial_activity: {
                recent_transactions: userWalletTransactions.slice(-10).reverse(),
                pending_payments: userPendingPayments,
                withdrawal_history: userWithdrawals.slice(-10).reverse()
            }
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = MemberDashboardService;
}
