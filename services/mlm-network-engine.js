// Hapanamy.lk Production MLM Network Engine
// Authoritative Engine for Registration, Referral, Binary Tree, Volume, Matching, and Ledger Commissions
// Fulfills Phase 1 through Phase 30 Requirements with End-to-End Idempotency, Concurrency, and Invariant Verification.

const crypto = require('crypto');
const PlacementEngine = require('./placement-engine');
const VolumeLedger = require('./volume-ledger');
const DirectCommissionEngine = require('./direct-commission-engine');
const QualifiedUplineCommissionEngine = require('./qualified-upline-commission-engine');
const EarningsCapEngine = require('./earnings-cap-engine');
const WalletService = require('./wallet-service');
const ProductSnapshotService = require('./product-snapshot-service');
const QualificationEngine = require('./qualification-engine');
const ReversalEngine = require('./reversal-engine');

const MLMNetworkEngine = {
    _concurrencyLocks: new Set(),

    /**
     * Phase 6: Tree Integrity Validator for a Single Member Node
     * Detects: duplicate node, duplicate parent, invalid position, orphan, cycle, self-parent, broken ancestor path.
     */
    validateBinaryTree(memberId, binaryNodes = [], users = []) {
        if (!memberId) {
            return { valid: false, error: 'Member ID is required.', code: 'MISSING_MEMBER_ID' };
        }

        // 1. Locate Node
        const nodesForMember = binaryNodes.filter(n => n.user_id === memberId);
        if (nodesForMember.length === 0) {
            return { valid: false, error: `Member ${memberId} does not exist in binary tree.`, code: 'NODE_NOT_FOUND' };
        }
        if (nodesForMember.length > 1) {
            return { valid: false, error: `Duplicate node detected: Member ${memberId} appears ${nodesForMember.length} times in tree.`, code: 'DUPLICATE_NODE' };
        }

        const node = nodesForMember[0];

        // 2. Root Node Check
        if (!node.placement_parent_id) {
            if (node.position !== null && node.position !== undefined && node.position !== '') {
                return { valid: false, error: `Root member ${memberId} must have null position.`, code: 'INVALID_ROOT_POSITION' };
            }
            return { valid: true, is_root: true };
        }

        // 3. Position Check
        const pos = (node.position || '').toUpperCase();
        if (pos !== 'LEFT' && pos !== 'RIGHT') {
            return { valid: false, error: `Invalid position "${node.position}" for member ${memberId}. Must be LEFT or RIGHT.`, code: 'INVALID_POSITION' };
        }

        // 4. Self-Parent Check
        if (node.placement_parent_id === memberId) {
            return { valid: false, error: `Self-parent reference detected for member ${memberId}.`, code: 'SELF_PARENT' };
        }

        // 5. Parent Existence Check
        const parentNode = binaryNodes.find(n => n.user_id === node.placement_parent_id);
        if (!parentNode) {
            return { valid: false, error: `Parent node ${node.placement_parent_id} for member ${memberId} does not exist (Orphan).`, code: 'ORPHAN_NODE' };
        }

        // 6. Duplicate Child Position Collision Check under Parent
        const siblingsOnSamePos = binaryNodes.filter(n => 
            n.placement_parent_id === node.placement_parent_id && 
            (n.position || '').toUpperCase() === pos
        );
        if (siblingsOnSamePos.length > 1) {
            return { valid: false, error: `Position ${pos} under parent ${node.placement_parent_id} is occupied by multiple nodes.`, code: 'DUPLICATE_CHILD_POSITION' };
        }

        // 7. Cycle & Loop Detection in Ancestor Chain
        let currentId = node.placement_parent_id;
        const visited = new Set([memberId]);
        let depthCount = 0;
        const MAX_ALLOWED_DEPTH = 1000;

        while (currentId) {
            depthCount++;
            if (depthCount > MAX_ALLOWED_DEPTH) {
                return { valid: false, error: `Maximum tree depth exceeded (> ${MAX_ALLOWED_DEPTH}) or deep cycle detected for member ${memberId}.`, code: 'MAX_DEPTH_EXCEEDED' };
            }
            if (visited.has(currentId)) {
                return { valid: false, error: `Cycle detected in binary tree path: node ${currentId} is both ancestor and descendant of ${memberId}.`, code: 'CYCLE_DETECTED' };
            }
            visited.add(currentId);

            const p = binaryNodes.find(n => n.user_id === currentId);
            if (!p) {
                return { valid: false, error: `Broken ancestor path: Ancestor ${currentId} missing from binary nodes.`, code: 'BROKEN_ANCESTOR_PATH' };
            }
            currentId = p.placement_parent_id;
        }

        return { valid: true, depth: depthCount + 1 };
    },

    /**
     * Phase 25: Network Repair & Integrity Validator
     * Validates the entire MLM network against 13 comprehensive invariants.
     */
    validateEntireMLMNetwork({
        users = [],
        sponsors = [],
        binaryNodes = [],
        purchases = [],
        commissionLedger = [],
        volumeLedger = [],
        walletLedger = []
    } = {}) {
        const issues = [];

        // 1. Check Binary Nodes
        const rootNodes = binaryNodes.filter(n => !n.placement_parent_id);
        if (binaryNodes.length > 0 && rootNodes.length === 0) {
            issues.push({ type: 'ROOT_MISSING', message: 'No root node found in binary tree.' });
        }
        if (rootNodes.length > 1) {
            issues.push({ type: 'MULTIPLE_ROOTS', message: `Found ${rootNodes.length} root nodes in binary tree. Expected exactly 1.` });
        }

        // Verify each binary node
        const nodeUserSet = new Set();
        const parentSlotMap = new Map();

        for (const node of binaryNodes) {
            // Uniqueness
            if (nodeUserSet.has(node.user_id)) {
                issues.push({ type: 'DUPLICATE_NODE', member_id: node.user_id, message: `Member ${node.user_id} appears multiple times in binary tree.` });
            }
            nodeUserSet.add(node.user_id);

            // Per-node validation
            const nodeVal = this.validateBinaryTree(node.user_id, binaryNodes, users);
            if (!nodeVal.valid) {
                issues.push({ type: nodeVal.code, member_id: node.user_id, message: nodeVal.error });
            }

            // Slot Collision
            if (node.placement_parent_id && node.position) {
                const slotKey = `${node.placement_parent_id}:${node.position.toUpperCase()}`;
                if (parentSlotMap.has(slotKey)) {
                    issues.push({ type: 'SLOT_COLLISION', parent_id: node.placement_parent_id, position: node.position, message: `Multiple children occupy slot ${slotKey}.` });
                }
                parentSlotMap.set(slotKey, node.user_id);
            }
        }

        // 2. Check Sponsors Genealogy
        const sponsorUserSet = new Set();
        for (const s of sponsors) {
            if (sponsorUserSet.has(s.user_id)) {
                issues.push({ type: 'DUPLICATE_SPONSOR_RECORD', member_id: s.user_id, message: `Member ${s.user_id} has multiple sponsor records.` });
            }
            sponsorUserSet.add(s.user_id);

            if (s.user_id === s.sponsor_id) {
                issues.push({ type: 'SELF_SPONSOR', member_id: s.user_id, message: `Member ${s.user_id} is their own sponsor.` });
            }

            // Circular referral check
            let cur = s.sponsor_id;
            const visited = new Set([s.user_id]);
            while (cur) {
                if (visited.has(cur)) {
                    issues.push({ type: 'CIRCULAR_REFERRAL', member_id: s.user_id, message: `Circular referral loop detected between ${s.user_id} and ${cur}.` });
                    break;
                }
                visited.add(cur);
                const nextS = sponsors.find(item => item.user_id === cur);
                cur = nextS ? nextS.sponsor_id : null;
            }
        }

        // 3. Check Commission Ledger References
        const validOrderIds = new Set(purchases.map(p => p.id));
        for (const comm of commissionLedger) {
            const orderId = comm.source_purchase_id || comm.order_id;
            if (orderId && !orderId.startsWith('match-') && !orderId.startsWith('snap-') && !orderId.startsWith('MANUAL')) {
                if (validOrderIds.size > 0 && !validOrderIds.has(orderId)) {
                    issues.push({ type: 'ORPHAN_COMMISSION_ORDER', commission_id: comm.id, order_id: orderId, message: `Commission ${comm.id} references non-existent order ${orderId}.` });
                }
            }
        }

        // 4. Financial Wallet Balance Reconciliation
        const userIds = [...new Set(users.map(u => u.id))];
        for (const uid of userIds) {
            const uWalletTx = walletLedger.filter(tx => tx.user_id === uid && (tx.status === 'COMPLETED' || tx.status === undefined));
            const credits = uWalletTx.filter(tx => (tx.amount || 0) > 0).reduce((sum, tx) => sum + tx.amount, 0);
            const debits = uWalletTx.filter(tx => (tx.amount || 0) < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
            const expectedBalance = Math.round((credits - debits) * 100) / 100;

            const computedBalances = WalletService.getWalletBalances(uid, walletLedger);
            if (Math.abs(computedBalances.available_balance + computedBalances.withdrawal_hold_balance - expectedBalance) > 0.05) {
                issues.push({
                    type: 'WALLET_MISMATCH',
                    user_id: uid,
                    message: `Wallet for user ${uid} does not reconcile with ledger. Computed: ${computedBalances.available_balance}, Ledger Net: ${expectedBalance}`
                });
            }
        }

        return {
            status: issues.length === 0 ? 'PASS' : 'FAIL',
            total_nodes_checked: binaryNodes.length,
            total_sponsors_checked: sponsors.length,
            total_commissions_checked: commissionLedger.length,
            total_wallets_checked: userIds.length,
            issues_count: issues.length,
            issues
        };
    },

    /**
     * Phase 22: Authoritative Server-Side Commission Calculation Engine
     * calculateOrderCommissions(orderId)
     */
    calculateOrderCommissions(orderId, context = {}) {
        const {
            purchases = [],
            products = [],
            users = [],
            sponsors = [],
            binaryNodes = [],
            kycDocs = [],
            commissionLedger = [],
            volumeLedger = [],
            walletLedger = [],
            dailyEarningsMap = new Map(),
            dailyCapLimit = 30000.00
        } = context;

        // 1. Validate Order
        if (!orderId) {
            return { success: false, error: 'Order ID is required.', code: 'MISSING_ORDER_ID' };
        }

        const purchase = purchases.find(p => p.id === orderId || p.order_id === orderId);
        if (!purchase) {
            return { success: false, error: `Order ${orderId} not found in database.`, code: 'ORDER_NOT_FOUND' };
        }

        // 2. Validate Payment Status
        const validStatuses = ['PAID', 'APPROVED', 'ACTIVE', 'CONFIRMED', 'COMPLETED'];
        if (!validStatuses.includes((purchase.status || '').toUpperCase())) {
            return {
                success: false,
                error: `Order ${orderId} status is "${purchase.status}". Commissions only payable for paid/approved orders.`,
                code: 'INVALID_PAYMENT_STATUS'
            };
        }

        // Concurrency Mutex Lock
        const lockKey = `calc-comm-lock-${orderId}`;
        if (this._concurrencyLocks.has(lockKey)) {
            return { success: false, error: `Commission calculation already in progress for order ${orderId}`, code: 'CONCURRENT_CALCULATION' };
        }
        this._concurrencyLocks.add(lockKey);

        try {
            // 3. Load Buyer & Product
            const buyerId = purchase.user_id || purchase.buyer_member_id;
            const buyer = users.find(u => u.id === buyerId || u.username === buyerId);
            const productId = purchase.product_id;
            const product = products.find(p => p.id === productId || p.code === productId) || {
                id: productId,
                name: purchase.product_name || 'Hapanamy Digital Course',
                selling_price: purchase.price_paid || purchase.total_amount || 7425.00,
                product_cost: purchase.product_cost || 1500.00,
                binary_volume: purchase.binary_volume || purchase.price_paid || 7425.00,
                direct_commission_percent: 8.00,
                binary_commission_percent: 7.00,
                max_binary_qualified_levels: 7,
                status: 'ACTIVE'
            };

            // 4. Create or Load Immutable Snapshot
            let snapshot = purchase.economics_snapshot;
            if (!snapshot) {
                snapshot = ProductSnapshotService.createSnapshot(product, orderId);
                purchase.economics_snapshot = snapshot;
            }

            const integrity = ProductSnapshotService.verifySnapshotIntegrity(snapshot);
            if (!integrity.valid) {
                return { success: false, error: `Snapshot verification failed: ${integrity.reason}`, code: 'SNAPSHOT_CORRUPTED' };
            }

            // 5. Commission Allowed Check
            if (snapshot.economics_status === 'BLOCKED') {
                return {
                    success: false,
                    error: 'Product economics status is BLOCKED. Commission distribution prohibited.',
                    code: 'ECONOMICS_BLOCKED'
                };
            }

            const calculationBreakdown = {
                order_id: orderId,
                buyer_id: buyerId,
                product_name: snapshot.product_name || product.name,
                selling_price: snapshot.selling_price,
                commissionable_volume: snapshot.binary_volume || snapshot.selling_price,
                direct_rate: snapshot.direct_commission_rate !== undefined ? snapshot.direct_commission_rate : 8.00,
                binary_rate: snapshot.binary_commission_rate !== undefined ? snapshot.binary_commission_rate : 7.00,
                max_binary_qualified_levels: snapshot.max_binary_qualified_levels || 7,
                direct_commission: null,
                volume_propagation: null,
                binary_matching_payouts: [],
                total_commissions_calculated: 0.00,
                total_commissions_paid: 0.00,
                created_ledger_entries: []
            };

            // 6. Direct Commission Calculation
            const sponsorLink = sponsors.find(s => s.user_id === buyerId);
            const sponsorId = sponsorLink ? sponsorLink.sponsor_id : (buyer ? buyer.sponsor_id : null);

            if (sponsorId) {
                const directCommIdempotencyKey = `comm-direct-${orderId}-${sponsorId}`;
                const alreadyDirectPaid = commissionLedger.some(c => 
                    c.idempotency_key === directCommIdempotencyKey || 
                    (c.source_purchase_id === orderId && c.type === 'DIRECT')
                );

                if (!alreadyDirectPaid) {
                    const directRate = calculationBreakdown.direct_rate;
                    const directGross = Math.round(snapshot.selling_price * (directRate / 100) * 100) / 100;

                    const todayKey = `${sponsorId}-${new Date().toISOString().split('T')[0]}`;
                    const currentDaily = dailyEarningsMap.get(todayKey) || 0.00;
                    const capResult = EarningsCapEngine.applyDailyCap 
                        ? EarningsCapEngine.applyDailyCap(directGross, currentDaily, dailyCapLimit)
                        : { calculatedAmount: directGross, eligibleAmount: directGross, cappedAmount: 0.00 };

                    const directEntry = {
                        id: 'comm-dir-' + crypto.randomBytes(8).toString('hex'),
                        idempotency_key: directCommIdempotencyKey,
                        user_id: sponsorId,
                        beneficiary_member_id: sponsorId,
                        source_user_id: buyerId,
                        source_member_id: buyerId,
                        source_purchase_id: orderId,
                        order_id: orderId,
                        type: 'DIRECT',
                        commission_type: 'DIRECT',
                        tier: 1,
                        rate: directRate,
                        base_volume: snapshot.selling_price,
                        volume: snapshot.selling_price,
                        calculated_amount: capResult.calculatedAmount,
                        gross_commission: capResult.calculatedAmount,
                        eligible_amount: capResult.eligibleAmount,
                        net_commission: capResult.eligibleAmount,
                        capped_amount: capResult.cappedAmount,
                        cap_adjustment: capResult.cappedAmount,
                        status: 'APPROVED',
                        calculation_reference: `DIRECT ${directRate}% of ${snapshot.selling_price} LKR = ${directGross} LKR`,
                        created_at: new Date().toISOString()
                    };

                    commissionLedger.push(directEntry);
                    calculationBreakdown.created_ledger_entries.push(directEntry);

                    if (walletLedger && capResult.eligibleAmount > 0) {
                        walletLedger.push({
                            id: 'tx-dir-' + crypto.randomBytes(8).toString('hex'),
                            user_id: sponsorId,
                            source_purchase_id: orderId,
                            type: 'DIRECT_COMMISSION',
                            amount: capResult.eligibleAmount,
                            status: 'COMPLETED',
                            created_at: new Date().toISOString()
                        });
                    }

                    dailyEarningsMap.set(todayKey, currentDaily + capResult.eligibleAmount);
                    calculationBreakdown.direct_commission = {
                        sponsor_id: sponsorId,
                        rate: directRate,
                        gross: capResult.calculatedAmount,
                        eligible: capResult.eligibleAmount,
                        capped: capResult.cappedAmount
                    };
                    calculationBreakdown.total_commissions_calculated += capResult.calculatedAmount;
                    calculationBreakdown.total_commissions_paid += capResult.eligibleAmount;
                }
            }

            // 7. Binary Volume Propagation
            if (volumeLedger && snapshot.binary_volume > 0) {
                const volResult = VolumeLedger.processSaleVolume({
                    purchase,
                    snapshot,
                    binaryNodes,
                    ledger: volumeLedger
                });
                calculationBreakdown.volume_propagation = volResult;
            }

            // 8. 7 Qualified Uplines Binary Commission
            if (binaryNodes.length > 0) {
                const qualificationContext = { users, kycDocs, purchases, sponsors, binaryNodes };
                const uplineResult = QualifiedUplineCommissionEngine.processQualifiedUplineCommissions({
                    purchase,
                    snapshot,
                    binaryNodes,
                    qualificationContext,
                    commissionLedger,
                    walletLedger,
                    dailyEarningsMap,
                    dailyCapLimit
                });

                if (uplineResult && uplineResult.paid_entries) {
                    calculationBreakdown.binary_matching_payouts = uplineResult.paid_entries;
                    for (const entry of uplineResult.paid_entries) {
                        calculationBreakdown.created_ledger_entries.push(entry);
                        calculationBreakdown.total_commissions_calculated += entry.calculated_amount || 0;
                        calculationBreakdown.total_commissions_paid += entry.eligible_amount || 0;
                    }
                }
            }

            // Mark purchase commissions processed
            purchase.commissions_processed = true;
            purchase.commission_calculation_reference = `CALC-${orderId}-${Date.now()}`;

            return {
                success: true,
                order_id: orderId,
                breakdown: calculationBreakdown
            };

        } finally {
            this._concurrencyLocks.delete(lockKey);
        }
    },

    /**
     * Reverses all commissions and volume for a refunded order.
     */
    reverseOrderCommissions(orderId, context = {}) {
        const {
            purchases = [],
            commissionLedger = [],
            volumeLedger = [],
            walletLedger = [],
            binaryNodes = []
        } = context;

        const purchase = purchases.find(p => p.id === orderId || p.order_id === orderId);
        if (!purchase) {
            return { success: false, error: 'Order not found for reversal.' };
        }

        // 1. Reverse Volume
        const reversedVol = VolumeLedger.reverseVolume(orderId, binaryNodes, volumeLedger);

        // 2. Reverse Direct & Binary Commissions
        const directEntries = commissionLedger.filter(c => 
            (c.source_purchase_id === orderId || c.order_id === orderId) && 
            c.type === 'DIRECT' && 
            c.status === 'APPROVED'
        );

        const reversedComms = [];
        for (const entry of directEntries) {
            const revKey = `rev-comm-dir-${orderId}-${entry.user_id}`;
            const revComm = {
                id: 'comm-rev-' + crypto.randomBytes(8).toString('hex'),
                idempotency_key: revKey,
                user_id: entry.user_id,
                source_purchase_id: orderId,
                order_id: orderId,
                type: 'REVERSAL',
                commission_type: 'REVERSAL',
                rate: entry.rate,
                base_volume: entry.base_volume,
                calculated_amount: -entry.calculated_amount,
                eligible_amount: -entry.eligible_amount,
                gross_commission: -entry.calculated_amount,
                net_commission: -entry.eligible_amount,
                status: 'REVERSED',
                created_at: new Date().toISOString()
            };
            commissionLedger.push(revComm);
            reversedComms.push(revComm);

            if (walletLedger) {
                walletLedger.push({
                    id: 'tx-rev-' + crypto.randomBytes(8).toString('hex'),
                    user_id: entry.user_id,
                    source_purchase_id: orderId,
                    type: 'COMMISSION_REVERSAL',
                    amount: -entry.eligible_amount,
                    status: 'COMPLETED',
                    created_at: new Date().toISOString()
                });
            }
        }

        const reversedUplines = QualifiedUplineCommissionEngine.reverseQualifiedUplineCommissions(
            orderId,
            commissionLedger,
            walletLedger
        );

        purchase.status = 'REFUNDED';
        purchase.refunded_at = new Date().toISOString();

        return {
            success: true,
            order_id: orderId,
            reversed_volume_entries: reversedVol.length,
            reversed_commission_entries: reversedComms.length + reversedUplines.length
        };
    },

    /**
     * Phase 23: Dashboard Queries
     */
    getMemberNetwork(userId, context = {}, maybeNodes = []) {
        let users = [];
        let binaryNodes = [];
        let purchases = [];
        let volumeLedger = [];
        let sponsors = [];
        if (Array.isArray(context)) {
            users = context;
            binaryNodes = Array.isArray(maybeNodes) ? maybeNodes : [];
        } else {
            users = context.users || [];
            binaryNodes = context.binaryNodes || [];
            purchases = context.purchases || [];
            volumeLedger = context.volumeLedger || [];
            sponsors = context.sponsors || [];
        }

        const tree = PlacementEngine.buildTreeHierarchy(userId, binaryNodes, users, purchases, volumeLedger, 4);
        const directs = PlacementEngine.getDirectReferrals(userId, sponsors, users, purchases, binaryNodes);
        const volumeSummary = VolumeLedger.getVolumeSummary(userId, volumeLedger);

        return {
            user_id: userId,
            tree,
            direct_referrals: directs,
            volume_summary: volumeSummary
        };
    },

    getMemberCommissions(userId, context = []) {
        const commissionLedger = Array.isArray(context) ? context : (context.commissionLedger || []);
        const userComms = commissionLedger.filter(c => c.user_id === userId || c.beneficiary_member_id === userId);
        return {
            user_id: userId,
            total_count: userComms.length,
            commissions: userComms
        };
    },

    getMemberWallet(userId, context = []) {
        const walletLedger = Array.isArray(context) ? context : (context.walletLedger || []);
        const balances = WalletService.getWalletBalances(userId, walletLedger);
        const transactions = walletLedger.filter(tx => tx.user_id === userId);
        return {
            user_id: userId,
            available_balance: balances.available_balance,
            balances,
            recent_transactions: transactions.slice(-20)
        };
    },

    getMemberEarningsSummary(userId, context = {}, maybeWallet = []) {
        let commissionLedger = [];
        let walletLedger = [];
        if (Array.isArray(context)) {
            commissionLedger = context;
            walletLedger = Array.isArray(maybeWallet) ? maybeWallet : [];
        } else {
            commissionLedger = context.commissionLedger || [];
            walletLedger = context.walletLedger || [];
        }

        const userComms = commissionLedger.filter(c => (c.user_id === userId || c.beneficiary_member_id === userId) && c.status === 'APPROVED');
        
        let directEarned = 0;
        let binaryEarned = 0;
        let tierEarned = 0;

        for (const c of userComms) {
            const amount = c.eligible_amount || c.net_commission || 0;
            if (c.type === 'DIRECT' || c.commission_type === 'DIRECT') {
                directEarned += amount;
            } else if (c.type === 'BINARY' || c.commission_type === 'BINARY') {
                binaryEarned += amount;
            } else if (c.type === 'TIER' || c.commission_type === 'TIER') {
                tierEarned += amount;
            }
        }

        const balances = WalletService.getWalletBalances(userId, walletLedger);

        return {
            user_id: userId,
            total_earned: Math.round((directEarned + binaryEarned + tierEarned) * 100) / 100,
            direct_commission: Math.round(directEarned * 100) / 100,
            binary_commission: Math.round(binaryEarned * 100) / 100,
            tier_commission: Math.round(tierEarned * 100) / 100,
            pending_balance: balances.pending_balance,
            paid_balance: balances.total_withdrawn,
            withdrawn_balance: balances.total_withdrawn,
            available_balance: balances.available_balance,
            withdrawal_hold_balance: balances.withdrawal_hold_balance
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = MLMNetworkEngine;
}
