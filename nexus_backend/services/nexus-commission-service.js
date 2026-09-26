// ==============================================================================
// NEXUS PRIME (PVT) LTD — MLM COMMISSION ENGINE SERVICE
// DOMAIN: nexusp.online
// ==============================================================================

const nexusDb = require('../db/nexus-db');
const NexusQualificationService = require('./nexus-qualification-service');

class NexusCommissionService {
    /**
     * Safe financial rounding to 2 decimal places.
     */
    static roundCurrency(value) {
        return Math.round((parseFloat(value) + Number.EPSILON) * 100) / 100;
    }

    /**
     * Calculates and records authoritative commission distributions for a paid order.
     * 
     * Enforces:
     * 1. Trusted Server-Side Order & Payment Verification
     * 2. Strict Idempotency (Cannot run twice on the same order)
     * 3. Plan Versioning by Order Timestamp
     * 4. Multi-Level Tree Traversal with Cycle & Self-Referral Protection
     * 5. Qualification Gatekeeping
     * 6. Wallet Separation (Approved status without premature wallet credit)
     * 
     * @param {string} orderId - The UUID or order number of the paid order.
     * @param {Object} options - Execution options (e.g. trigger: 'PAYMENT_VERIFIED').
     * @returns {Object} Calculation result summary and generated commission records.
     */
    static async calculateCommissions(orderId, options = {}) {
        if (!orderId) {
            throw new Error('Order identifier is required for commission calculation.');
        }

        // 1. Fetch Authoritative Order
        const order = await nexusDb.getOrderById(orderId) || await nexusDb.getOrderByNumber(orderId);
        if (!order) {
            throw new Error(`Order [${orderId}] was not found.`);
        }

        // 2. Strict Server-Side State Validation
        // Commissions MUST NOT be created from pending, unverified, failed, or cancelled orders
        const isPaidStatus = order.status === 'paid' || order.status === 'completed';
        const isPaymentVerified = order.payment_status === 'paid';

        if (!isPaidStatus || !isPaymentVerified) {
            throw new Error(
                `Security Safeguard: Cannot calculate commissions for unverified order ${order.order_number}. ` +
                `Order status: '${order.status}', Payment status: '${order.payment_status}'.`
            );
        }

        // 3. Idempotency Guard — Prevent duplicate commissions for same order
        const existingCommissions = await nexusDb.getCommissionsByOrderId(order.id);
        if (existingCommissions && existingCommissions.length > 0) {
            return {
                success: true,
                idempotent: true,
                message: `Commissions for order ${order.order_number} have already been calculated and recorded.`,
                order_id: order.id,
                order_number: order.order_number,
                count: existingCommissions.length,
                commissions: existingCommissions
            };
        }

        // 4. Load Active Versioned Commission Plan
        const plan = await nexusDb.getActiveCommissionPlan(order.created_at);
        if (!plan) {
            await nexusDb.insertAuditLog({
                actor_id: 'commission_engine',
                actor_role: 'system',
                action: 'COMMISSION_CALCULATION_HALTED_NO_PLAN',
                target_id: order.id,
                details: {
                    order_number: order.order_number,
                    order_created_at: order.created_at,
                    reason: 'No active commission plan version configured for order date.'
                }
            });

            return {
                success: false,
                code: 'NO_ACTIVE_PLAN',
                message: 'No active commission plan configured for order timestamp.',
                commissions: []
            };
        }

        // 5. Determine Authoritative Commissionable Base Amount
        let baseAmount = parseFloat(order.total !== undefined ? order.total : (order.total_amount || 0)) || 0.00;
        if (plan.commission_base_type === 'package_price' && order.package_price_snapshot) {
            baseAmount = parseFloat(order.package_price_snapshot) || baseAmount;
        } else if (plan.commission_base_type === 'eligible_amount' && order.subtotal) {
            baseAmount = parseFloat(order.subtotal) || baseAmount;
        }

        if (baseAmount <= 0) {
            return {
                success: true,
                message: `Order ${order.order_number} has zero commissionable base. No commissions generated.`,
                commissions: []
            };
        }

        // 6. Identify Source Member & Tree Traversal Initiation
        const purchaserId = order.user_id;
        const purchaserProfile = await nexusDb.findProfileByUserId(purchaserId);

        // Find initial direct sponsor
        let currentUplineId = null;
        const directSponsorLink = nexusDb.sponsors.find(s => s.user_id === purchaserId);
        if (directSponsorLink && directSponsorLink.sponsor_id) {
            currentUplineId = directSponsorLink.sponsor_id;
        } else if (purchaserProfile && purchaserProfile.sponsor_id) {
            currentUplineId = purchaserProfile.sponsor_id;
        }

        const generatedCommissions = [];
        const visitedUplines = new Set([purchaserId]); // Prevent self-referral and circular loops
        const maxLevels = Math.min(plan.max_levels || 5, (plan.level_rules || []).length);
        const corporateRootId = '00000000-0000-4000-8000-000000000001';

        // 7. Multi-Level Upline Traversal Loop
        for (let currentLevel = 1; currentLevel <= maxLevels; currentLevel++) {
            if (!currentUplineId) break;

            // Cycle Protection
            if (visitedUplines.has(currentUplineId)) {
                await nexusDb.insertAuditLog({
                    actor_id: 'commission_engine',
                    actor_role: 'system',
                    action: 'COMMISSION_CIRCULAR_LOOP_DETECTED',
                    target_id: order.id,
                    details: {
                        order_number: order.order_number,
                        purchaser_id: purchaserId,
                        detected_circular_node: currentUplineId,
                        level: currentLevel
                    }
                });
                break;
            }
            visitedUplines.add(currentUplineId);

            // Fetch Level Rule
            const levelRule = (plan.level_rules || []).find(r => r.level === currentLevel);
            if (!levelRule || parseFloat(levelRule.rate) <= 0) {
                // Move to next upline without creating commission for this level
                currentUplineId = this.getNextSponsorId(currentUplineId);
                continue;
            }

            // Fetch Upline Profile
            const uplineProfile = await nexusDb.findProfileByUserId(currentUplineId);
            if (!uplineProfile) {
                currentUplineId = this.getNextSponsorId(currentUplineId);
                continue;
            }

            // Qualification Gatekeeping
            const commissionType = currentLevel === 1 ? 'DIRECT_REFERRAL' : 'LEVEL_OVERRIDE';
            const qualificationCheck = NexusQualificationService.isMemberEligibleForCommission(
                uplineProfile,
                plan.qualification_rules,
                {
                    purchaserId,
                    orderId: order.id,
                    orderTotal: baseAmount,
                    level: currentLevel,
                    commissionType
                }
            );

            if (!qualificationCheck.eligible) {
                // Beneficiary is not qualified (e.g. account suspended, no active package)
                // Record audit trace for transparency
                await nexusDb.insertAuditLog({
                    actor_id: 'commission_engine',
                    actor_role: 'system',
                    action: 'COMMISSION_BENEFICIARY_UNQUALIFIED',
                    target_id: order.id,
                    details: {
                        order_number: order.order_number,
                        beneficiary_id: currentUplineId,
                        level: currentLevel,
                        reason: qualificationCheck.reason
                    }
                });
            } else {
                // 8. Safe Precise Decimal Calculation
                const rate = parseFloat(levelRule.rate);
                const commissionAmount = this.roundCurrency((baseAmount * rate) / 100.0);

                if (commissionAmount > 0) {
                    const notes = currentLevel === 1
                        ? `Direct referral commission (${rate}%) from order ${order.order_number}`
                        : `Tier ${currentLevel} team override (${rate}%) from order ${order.order_number}`;

                    // Create Immutable Commission Snapshot
                    const commRecord = await nexusDb.createCommissionRecord({
                        order_id: order.id,
                        order_number: order.order_number,
                        beneficiary_id: currentUplineId,
                        source_member_id: purchaserId,
                        sponsor_id: purchaserProfile?.sponsor_id || null,
                        commission_type: commissionType,
                        commission_level: currentLevel,
                        plan_id: plan.id,
                        plan_code: plan.plan_code,
                        plan_version: plan.version,
                        commission_rate: rate,
                        base_amount: baseAmount,
                        amount: commissionAmount,
                        currency: order.currency || 'LKR',
                        status: 'approved', // Initial status: approved, awaiting wallet ledger disbursement
                        calculation_notes: notes,
                        metadata: {
                            level: currentLevel,
                            plan_name: plan.plan_name,
                            calculated_at: new Date().toISOString()
                        }
                    });

                    generatedCommissions.push(commRecord);

                    // Send In-App Member Notification to Beneficiary
                    await nexusDb.insertMemberNotification({
                        user_id: currentUplineId,
                        title: 'Commission Approved',
                        message: `A new commission of ${order.currency} ${commissionAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} has been approved (${notes}).`,
                        type: 'commission',
                        link: '/dashboard/commissions'
                    });
                }
            }

            // If upline is Corporate Root NP000001, root has no higher sponsor, end traversal
            if (currentUplineId === corporateRootId) {
                break;
            }

            // Move to Next Higher Upline Node
            currentUplineId = this.getNextSponsorId(currentUplineId);
        }

        // 9. Emit Audit Log for Overall Run
        const totalCommissionSum = this.roundCurrency(
            generatedCommissions.reduce((sum, c) => sum + (c.amount || 0), 0)
        );

        await nexusDb.insertAuditLog({
            actor_id: 'commission_engine',
            actor_role: 'system',
            action: 'COMMISSION_CALCULATED',
            target_id: order.id,
            details: {
                order_number: order.order_number,
                plan_code: plan.plan_code,
                plan_version: plan.version,
                commissions_count: generatedCommissions.length,
                total_commission_amount: totalCommissionSum,
                currency: order.currency || 'LKR'
            }
        });

        return {
            success: true,
            order_id: order.id,
            order_number: order.order_number,
            plan_code: plan.plan_code,
            plan_version: plan.version,
            commissions_count: generatedCommissions.length,
            total_commission_amount: totalCommissionSum,
            currency: order.currency || 'LKR',
            commissions: generatedCommissions
        };
    }

    /**
     * Helper to retrieve sponsor ID for a given user ID without mutating network.
     */
    static getNextSponsorId(userId) {
        if (!userId) return null;
        const link = nexusDb.sponsors.find(s => s.user_id === userId);
        if (link && link.sponsor_id) return link.sponsor_id;

        const profile = nexusDb.memberProfiles.find(p => p.user_id === userId);
        if (profile && profile.sponsor_id) return profile.sponsor_id;

        return null;
    }
}

module.exports = NexusCommissionService;
