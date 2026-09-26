/**
 * NEXUS PRIME (PVT) LTD — PROMPT 19
 * Centralized Membership Activation & Lifecycle Service
 * 
 * Safety & Compliance Principles:
 * - Distinct separation: Account Status vs. Membership Status vs. KYC vs. Payment vs. Package
 * - Server-side authoritative activation only: Webhooks / verified payments or audited admin actions.
 * - Idempotency protection: Duplicate payment callbacks produce ONE membership activation.
 * - Strict state machine transitions with immutable history trail in nexus_membership_history.
 * - Event-driven refund handling: Automatically transitions membership to suspended without deleting records.
 * - Zero direct balance mutation: Never alters wallet ledger balances directly.
 */

'use strict';

const crypto = require('crypto');
const nexusDb = require('../db/nexus-db');
const nexusNotificationService = require('./nexus-notification-service');

const VALID_MEMBERSHIP_STATUSES = [
    'not_activated',
    'pending_activation',
    'active',
    'suspended',
    'expired',
    'cancelled'
];

class NexusMembershipService {
    /**
     * Validate state machine transition
     */
    canTransition(currentStatus, nextStatus) {
        if (!VALID_MEMBERSHIP_STATUSES.includes(nextStatus)) return false;
        if (currentStatus === nextStatus) return true;

        const allowedTransitions = {
            'not_activated': ['pending_activation', 'active'],
            'pending_activation': ['active', 'cancelled'],
            'active': ['suspended', 'expired', 'cancelled'],
            'suspended': ['active', 'cancelled'],
            'expired': ['active', 'cancelled'],
            'cancelled': [] // Terminal state requiring explicit administrative reinstatement or re-enrollment
        };

        return allowedTransitions[currentStatus] ? allowedTransitions[currentStatus].includes(nextStatus) : false;
    }

    /**
     * Authoritative member membership object for REST API and dashboards
     */
    async getMembership(memberId) {
        const userId = nexusDb.resolveMemberUserId(memberId);
        const membership = await nexusDb.getMembershipByMemberId(userId);
        const history = await nexusDb.getMembershipHistory(userId);
        const statusData = await this.getMembershipStatus(userId);
        return {
            membership: membership || {
                member_id: userId,
                status: 'not_activated',
                package_id: null,
                package_code: 'NONE',
                activated_at: null,
                expires_at: null
            },
            history: history,
            ...statusData
        };
    }

    /**
     * Get authoritative membership status for a member
     */
    async getMembershipStatus(memberId) {
        const userId = nexusDb.resolveMemberUserId(memberId);
        const membership = await nexusDb.getMembershipByMemberId(userId);
        const history = await nexusDb.getMembershipHistory(userId);
        const profile = await nexusDb.findProfileByUserId(userId);

        let packageDetails = null;
        if (membership && membership.package_id) {
            packageDetails = await nexusDb.getPackageById(membership.package_id);
        } else if (profile && profile.package_status && profile.package_status !== 'NONE') {
            packageDetails = await nexusDb.getPackageByCode(profile.package_status);
        }

        return {
            membershipId: membership ? membership.id : null,
            memberId: userId,
            status: membership ? membership.status : 'not_activated',
            packageCode: membership ? membership.package_code : (profile ? profile.package_status : 'NONE'),
            packageDetails: packageDetails ? {
                id: packageDetails.id,
                name: packageDetails.name,
                code: packageDetails.package_code,
                price: packageDetails.price
            } : null,
            activatedAt: membership ? membership.activated_at : null,
            expiresAt: membership ? membership.expires_at : null,
            ruleVersion: membership ? membership.rule_version : '1.0.0',
            historyCount: history.length,
            latestHistory: history.length > 0 ? history[0] : null
        };
    }

    /**
     * Activate membership through verified server-side business rules
     */
    async activateMembership(memberId, activationContext = {}) {
        try {
            const userId = nexusDb.resolveMemberUserId(memberId);
            const user = await nexusDb.findUserById(userId);
            if (!user) {
                return { success: false, error: 'Member account not found.' };
            }

            const profile = await nexusDb.findProfileByUserId(userId);
            if (!profile) {
                return { success: false, error: 'Member profile not found.' };
            }

            // 1. Validate Account Status (cannot activate if suspended or deactivated)
            if (profile.status === 'suspended' || profile.status === 'deactivated' || profile.status === 'closed') {
                return {
                    success: false,
                    error: `Cannot activate membership: Member account is currently '${profile.status}'.`
                };
            }

            // 2. Validate KYC if configured as mandatory for activation
            const kycRequiredSetting = nexusDb.settings.get('kyc_required_for_activation') === 'true';
            if (kycRequiredSetting && profile.verification_status !== 'verified') {
                return {
                    success: false,
                    error: 'KYC_NOT_APPROVED: Identity verification is required prior to membership activation.'
                };
            }

            const now = new Date().toISOString();
            const source = activationContext.source || 'order_payment';
            const orderId = activationContext.orderId || activationContext.order_id;
            const paymentId = activationContext.paymentId || activationContext.payment_id;
            let packageId = activationContext.packageId || activationContext.package_id;
            let packageCode = activationContext.packageCode || activationContext.package_code || 'STANDARD';

            // 3. Validate Order & Payment conditions if not admin manual override
            if (source !== 'admin_manual') {
                if (!orderId) {
                    return { success: false, error: 'Order ID is required for payment-triggered activation.' };
                }
                const order = await nexusDb.getOrderById(orderId);
                if (!order) {
                    return { success: false, error: `Order ${orderId} not found.` };
                }
                if (order.user_id !== userId) {
                    return { success: false, error: 'Cross-member activation attempt: Order does not belong to member.' };
                }
                if (order.status !== 'paid' && order.status !== 'completed' && order.status !== 'processing') {
                    return { success: false, error: `Cannot activate membership: Order status is '${order.status}', payment not verified.` };
                }

                if (order.package_id) {
                    packageId = order.package_id;
                    const pkg = await nexusDb.getPackageById(order.package_id);
                    if (pkg) packageCode = pkg.package_code;
                }
            }

            // 4. Duplicate Activation Protection (Idempotency)
            const existingMembership = await nexusDb.getMembershipByMemberId(userId);
            if (existingMembership && existingMembership.status === 'active') {
                // If already active with same order/package, return idempotent success
                if (existingMembership.activation_order_id === orderId) {
                    return {
                        success: true,
                        duplicated: true,
                        membership: existingMembership,
                        message: 'Membership is already active under this verified order.'
                    };
                }
            }

            const prevStatus = existingMembership ? existingMembership.status : 'not_activated';

            // 5. Update/Create Membership Record
            const updatedMembership = await nexusDb.createOrUpdateMembership({
                id: existingMembership ? existingMembership.id : ('mship-' + crypto.randomBytes(8).toString('hex')),
                member_id: userId,
                package_id: packageId || null,
                package_code: packageCode,
                status: 'active',
                activation_order_id: orderId || null,
                activation_payment_id: paymentId || null,
                activated_at: existingMembership && existingMembership.activated_at ? existingMembership.activated_at : now,
                expires_at: null, // Lifetime or configurable renewal date
                last_re_evaluated_at: now,
                rule_version: '1.0.0',
                metadata: {
                    activation_source: source,
                    admin_id: activationContext.adminId || null,
                    notes: activationContext.reason || 'Activated via verified order payment'
                }
            });

            // 6. Update Profile Package Status
            profile.package_status = packageCode;
            profile.updated_at = now;

            // 7. Record Immutable Transition History
            const historyEntry = await nexusDb.addMembershipHistory({
                member_id: userId,
                membership_id: updatedMembership.id,
                previous_status: prevStatus,
                new_status: 'active',
                reason_code: source === 'admin_manual' ? 'ADMIN_MANUAL_ACTIVATION' : 'VERIFIED_PACKAGE_PAYMENT',
                source_type: source,
                source_id: orderId || paymentId || activationContext.adminId || null,
                notes: activationContext.reason || 'Membership activated upon verified payment',
                changed_by: activationContext.adminId || 'system_gateway',
                rule_version: '1.0.0'
            });

            // 8. Audit Log
            await nexusDb.insertAuditLog({
                user_id: userId,
                action: 'MEMBERSHIP_ACTIVATED',
                entity_type: 'nexus_memberships',
                entity_id: updatedMembership.id,
                actor_id: activationContext.adminId || 'system_gateway',
                actor_role: activationContext.adminId ? 'admin' : 'system',
                details: {
                    package_code: packageCode,
                    order_id: orderId,
                    payment_id: paymentId,
                    previous_status: prevStatus
                }
            });

            // 9. Prompt 16 Notification
            await nexusNotificationService.emit('membership_activated', {
                recipient_id: userId,
                reference_type: 'membership',
                reference_id: updatedMembership.id,
                variables: {
                    member_id: profile.member_id || userId,
                    package: packageCode
                },
                custom_title: 'Nexus Prime Membership Activated!',
                custom_message: `Congratulations! Your Nexus Prime membership tier [${packageCode}] is now fully activated. MLM networking and business features are enabled.`,
                action_url: '/dashboard#membership'
            });

            return Object.assign({}, updatedMembership, {
                success: true,
                membership: updatedMembership,
                historyEntry
            });
        } catch (err) {
            console.error('[NexusMembershipService.activateMembership] Error:', err);
            return { success: false, error: err.message };
        }
    }

    /**
     * Update Membership Status through Controlled State Machine
     */
    async updateMembershipStatus(arg1, arg2, arg3, arg4, arg5) {
        let memberId, newStatus, reasonCode, actorId, context = {};
        if (typeof arg1 === 'object' && arg1 !== null) {
            memberId = arg1.memberId || arg1.member_id;
            newStatus = arg1.toStatus || arg1.newStatus || arg1.new_status;
            reasonCode = arg1.reasonCode || arg1.reason_code || arg1.triggerEvent || 'STATUS_MANUALLY_UPDATED';
            actorId = arg1.actorId || arg1.actor_id || 'system';
            context = arg1;
        } else {
            memberId = arg1;
            newStatus = arg2;
            reasonCode = arg3;
            actorId = arg4;
            context = arg5 || {};
        }

        const userId = nexusDb.resolveMemberUserId(memberId);
        const membership = await nexusDb.getMembershipByMemberId(userId);
        if (!membership) {
            throw new Error('Membership record not found.');
        }

        const currentStatus = membership.status;
        if (!this.canTransition(currentStatus, newStatus)) {
            throw new Error(`Invalid transition: Cannot transition membership from '${currentStatus}' to '${newStatus}'.`);
        }

        const now = new Date().toISOString();
        const prevStatus = membership.status;

        // Apply transition
        membership.status = newStatus;
        membership.last_re_evaluated_at = now;
        membership.updated_at = now;

        const profile = await nexusDb.findProfileByUserId(userId);
        if (profile) {
            if (newStatus === 'active') {
                profile.package_status = membership.package_code || 'STANDARD';
            } else if (newStatus === 'suspended' || newStatus === 'cancelled' || newStatus === 'expired') {
                profile.package_status = 'INACTIVE';
            }
            profile.updated_at = now;
        }

        // Record history
        const historyEntry = await nexusDb.addMembershipHistory({
            member_id: userId,
            membership_id: membership.id,
            previous_status: prevStatus,
            new_status: newStatus,
            reason_code: reasonCode || 'STATUS_MANUALLY_UPDATED',
            source_type: context.source_type || 'admin_action',
            source_id: context.source_id || null,
            notes: context.notes || context.reason || `Status transitioned to ${newStatus}`,
            changed_by: actorId || 'system',
            rule_version: '1.0.0'
        });

        // Audit Log
        await nexusDb.insertAuditLog({
            user_id: userId,
            action: `MEMBERSHIP_STATUS_${newStatus.toUpperCase()}`,
            entity_type: 'nexus_memberships',
            entity_id: membership.id,
            actor_id: actorId || 'system',
            details: {
                previous_status: prevStatus,
                new_status: newStatus,
                reason_code: reasonCode
            }
        });

        // Notifications
        if (newStatus === 'suspended') {
            await nexusNotificationService.emit('membership_suspended', {
                recipient_id: userId,
                reference_type: 'membership',
                reference_id: membership.id,
                custom_title: 'Membership Account Suspended',
                custom_message: `Your membership has been suspended. Reason: ${context.reason || reasonCode || 'Administrative action'}.`,
                action_url: '/dashboard#membership'
            });
        } else if (newStatus === 'active') {
            await nexusNotificationService.emit('membership_reactivated', {
                recipient_id: userId,
                reference_type: 'membership',
                reference_id: membership.id,
                custom_title: 'Membership Account Reactivated',
                custom_message: 'Your Nexus Prime membership has been reinstated and is now active.',
                action_url: '/dashboard#membership'
            });
        }

        return Object.assign({}, membership, {
            success: true,
            membership,
            historyEntry
        });
    }

    /**
     * Handle Refund / Order Cancellation Event
     */
    async handleRefundOrReversal(orderId, arg2, arg3) {
        let paymentId = null;
        let reason = 'Order refunded';
        if (typeof arg2 === 'string' && !arg3) {
            reason = arg2;
        } else {
            paymentId = arg2;
            reason = arg3 || 'Order refunded';
        }

        const order = await nexusDb.getOrderById(orderId);
        if (!order) return { success: false, affected: false, error: 'Order not found' };

        const membership = await nexusDb.getMembershipByMemberId(order.user_id);
        if (!membership) return { success: true, affected: false };

        // If this membership was activated by the refunded order
        if (membership.activation_order_id === orderId || (paymentId && membership.activation_payment_id === paymentId)) {
            if (membership.status === 'active') {
                const res = await this.updateMembershipStatus({
                    memberId: order.user_id,
                    toStatus: 'suspended',
                    triggerEvent: 'ORDER_REFUNDED',
                    reasonCode: 'ORDER_REFUNDED',
                    reason: reason || 'Associated package order was refunded or reversed',
                    actorId: 'system_refund',
                    source_type: 'refund',
                    source_id: orderId
                });
                return { success: true, affected: true, membership: res.membership || membership };
            }
        }

        return { success: true, affected: false, membership };
    }

    /**
     * Admin Manual Membership Control (Requires explicit reason)
     */
    async manualAdminAction(arg1, arg2, arg3, arg4) {
        let memberId, action, reason, adminId, expiresAt, packageId, notes;
        if (typeof arg1 === 'object' && arg1 !== null) {
            memberId = arg1.memberId || arg1.member_id;
            action = arg1.action;
            reason = arg1.reason;
            adminId = arg1.adminUserId || arg1.adminId || arg1.admin_id;
            expiresAt = arg1.expiresAt || arg1.expires_at;
            packageId = arg1.packageId || arg1.package_id;
            notes = arg1.notes;
        } else {
            memberId = arg1;
            action = arg2;
            reason = arg3;
            adminId = arg4;
        }

        if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
            throw new Error('Reason is required for administrative membership modification (minimum 5 characters).');
        }

        const userId = nexusDb.resolveMemberUserId(memberId);
        const actionUpper = (action || '').toUpperCase();

        if (actionUpper === 'ACTIVATE') {
            const act = await this.activateMembership(userId, {
                source: 'admin_manual',
                adminId,
                reason: reason.trim(),
                packageId
            });
            return act;
        }

        if (actionUpper === 'SUSPEND') {
            const res = await this.updateMembershipStatus(userId, 'suspended', 'ADMIN_MANUAL_SUSPENSION', adminId, {
                reason: reason.trim(),
                source_type: 'admin_action',
                notes
            });
            return { success: true, membership: res.membership || res };
        }

        if (actionUpper === 'REACTIVATE' || actionUpper === 'REINSTATE') {
            const res = await this.updateMembershipStatus(userId, 'active', 'ADMIN_MANUAL_REINSTATEMENT', adminId, {
                reason: reason.trim(),
                source_type: 'admin_action',
                notes
            });
            return { success: true, membership: res.membership || res };
        }

        if (actionUpper === 'CANCEL') {
            const res = await this.updateMembershipStatus(userId, 'cancelled', 'ADMIN_MANUAL_CANCELLATION', adminId, {
                reason: reason.trim(),
                source_type: 'admin_action',
                notes
            });
            return { success: true, membership: res.membership || res };
        }

        if (actionUpper === 'EXTEND_EXPIRY') {
            const membership = await nexusDb.getMembershipByMemberId(userId);
            if (!membership) throw new Error('Membership record not found.');
            membership.expires_at = expiresAt;
            membership.updated_at = new Date().toISOString();

            await nexusDb.addMembershipHistory({
                member_id: userId,
                membership_id: membership.id,
                previous_status: membership.status,
                new_status: membership.status,
                reason_code: 'EXPIRY_MODIFIED',
                source_type: 'admin_action',
                notes: reason.trim(),
                changed_by: adminId || 'admin',
                rule_version: '1.0.0'
            });

            return { success: true, membership };
        }

        return { success: false, error: `Unsupported admin membership action: ${action}` };
    }
}

module.exports = new NexusMembershipService();
