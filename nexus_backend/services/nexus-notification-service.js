/**
 * NEXUS PRIME (PVT) LTD — PROMPT 16
 * Centralized Notification & Communication Service
 * 
 * Safety & Architecture:
 * - Deterministic idempotency prevents duplicate notifications during retries/reloads.
 * - Multi-channel dispatch (In-App active, Email abstracted via NexusEmailProvider).
 * - Sensitive data masking (bank accounts masked, zero credential leakage).
 * - Mandatory security & critical financial alerts bypass optional user opt-outs.
 * - Strict tenant isolation: Members can only access their own notifications.
 */

'use strict';

const crypto = require('crypto');
const nexusDb = require('../db/nexus-db');
const nexusEmailProvider = require('./nexus-email-provider');

// Standard Pre-seeded Templates Catalog
const DEFAULT_TEMPLATES = {
    // 1. Account & Security
    'member_registered': {
        category: 'account',
        priority: 'normal',
        title: 'Welcome to Nexus Prime!',
        body: 'Welcome, {{name}}! Your account has been registered successfully. Your Member ID is {{member_id}}.'
    },
    'new_login': {
        category: 'security',
        priority: 'high',
        title: 'Security Alert: New Sign-in',
        body: 'A new sign-in was detected for your account from IP {{ip}} at {{time}}.'
    },
    'password_changed': {
        category: 'security',
        priority: 'critical',
        title: 'Security Alert: Password Changed',
        body: 'Your account password was updated on {{time}}. If you did not make this change, please contact support immediately.'
    },
    'profile_updated': {
        category: 'account',
        priority: 'low',
        title: 'Profile Updated',
        body: 'Your personal profile information has been successfully updated.'
    },
    'kyc_submitted': {
        category: 'kyc',
        priority: 'normal',
        title: 'Verification Documents Submitted',
        body: 'Your KYC verification request has been received and is pending compliance review.'
    },
    'kyc_verified': {
        category: 'kyc',
        priority: 'high',
        title: 'Account Verified!',
        body: 'Congratulations! Your KYC documents have been approved. Financial features and bank payouts are now unlocked.'
    },
    'kyc_rejected': {
        category: 'kyc',
        priority: 'high',
        title: 'KYC Verification Action Required',
        body: 'Your verification submission could not be approved. Reason: {{reason}}. Please update your documents.'
    },

    // 2. MLM & Network
    'new_direct_referral': {
        category: 'network',
        priority: 'normal',
        title: 'New Direct Referral!',
        body: 'Exciting news! {{referee_name}} ({{referee_id}}) joined your direct referral team.'
    },

    // 3. Packages & Orders
    'package_activated': {
        category: 'package',
        priority: 'high',
        title: 'Package Activated: {{package_name}}',
        body: 'Your {{package_name}} subscription is now active! You have unlocked higher commission caps and exclusive features.'
    },
    'order_created': {
        category: 'order',
        priority: 'normal',
        title: 'Order Confirmation: {{order_number}}',
        body: 'Your order {{order_number}} for {{amount}} has been received and is currently being processed.'
    },
    'order_cancelled': {
        category: 'order',
        priority: 'normal',
        title: 'Order Cancelled: {{order_number}}',
        body: 'Order {{order_number}} has been cancelled. If payment was received, a refund will be processed to your wallet.'
    },
    'order_completed': {
        category: 'order',
        priority: 'normal',
        title: 'Order Fulfilled: {{order_number}}',
        body: 'Great news! Your order {{order_number}} has been fulfilled and completed.'
    },

    // 4. Payments
    'payment_initiated': {
        category: 'payment',
        priority: 'normal',
        title: 'Payment Received for Review',
        body: 'Your payment slip for {{amount}} (Order {{order_number}}) is awaiting administrative verification.'
    },
    'payment_verified': {
        category: 'payment',
        priority: 'high',
        title: 'Payment Confirmed: {{amount}}',
        body: 'Payment for order {{order_number}} has been verified successfully. Your invoice is now marked PAID.'
    },
    'payment_failed': {
        category: 'payment',
        priority: 'high',
        title: 'Payment Verification Failed',
        body: 'Verification for payment {{reference_id}} failed. Reason: {{reason}}. Please resubmit proof of payment.'
    },

    // 5. Commissions
    'commission_generated': {
        category: 'commission',
        priority: 'normal',
        title: 'Commission Generated: {{amount}}',
        body: 'You earned a {{commission_type}} commission of {{amount}} from order {{order_number}}.'
    },
    'commission_approved': {
        category: 'commission',
        priority: 'normal',
        title: 'Commission Approved: {{amount}}',
        body: 'Commission {{commission_id}} for {{amount}} has been approved and queued for wallet credit.'
    },
    'commission_credited': {
        category: 'commission',
        priority: 'normal',
        title: 'Commission Credited: {{amount}}',
        body: '{{amount}} has been credited to your available wallet balance from your approved commissions.'
    },
    'commission_reversed': {
        category: 'commission',
        priority: 'high',
        title: 'Commission Reversal Notice',
        body: 'Commission {{commission_id}} of {{amount}} was reversed due to an order refund or return.'
    },

    // 6. Wallet
    'wallet_credit': {
        category: 'wallet',
        priority: 'normal',
        title: 'Wallet Credited: {{amount}}',
        body: 'Your wallet has been credited with {{amount}}. Reference: {{description}}.'
    },
    'wallet_debit': {
        category: 'wallet',
        priority: 'normal',
        title: 'Wallet Debited: {{amount}}',
        body: 'Your wallet has been debited by {{amount}}. Reference: {{description}}.'
    },
    'wallet_adjustment': {
        category: 'wallet',
        priority: 'high',
        title: 'Administrative Ledger Adjustment',
        body: 'An audited balance adjustment of {{amount}} was applied to your wallet. Reason: {{reason}}.'
    },

    // 7. Withdrawals
    'withdrawal_requested': {
        category: 'withdrawal',
        priority: 'normal',
        title: 'Withdrawal Request Submitted: {{amount}}',
        body: 'Your request {{payout_number}} for {{amount}} to bank account {{bank_account}} is queued for review.'
    },
    'withdrawal_approved': {
        category: 'withdrawal',
        priority: 'high',
        title: 'Withdrawal Approved: {{amount}}',
        body: 'Withdrawal {{payout_number}} has been approved by finance and scheduled for bank transfer.'
    },
    'withdrawal_paid': {
        category: 'withdrawal',
        priority: 'high',
        title: 'Withdrawal Payout Complete: {{amount}}',
        body: 'Bank payout of {{amount}} has been remitted to {{bank_account}}. Bank Ref: {{bank_ref}}.'
    },
    'withdrawal_rejected': {
        category: 'withdrawal',
        priority: 'high',
        title: 'Withdrawal Request Rejected',
        body: 'Withdrawal {{payout_number}} was rejected. Reason: {{reason}}. Reserved funds have been refunded to your wallet.'
    },
    'withdrawal_cancelled': {
        category: 'withdrawal',
        priority: 'normal',
        title: 'Withdrawal Request Cancelled',
        body: 'Withdrawal {{payout_number}} was cancelled by you. Reserved funds have been restored to your wallet.'
    },

    // 8. Ranks
    'rank_achieved': {
        category: 'rank',
        priority: 'high',
        title: 'Rank Promotion: {{rank_name}}!',
        body: 'Congratulations! You have reached the rank of {{rank_name}}. Check your dashboard for new leadership privileges!'
    },

    // 9. Support Tickets
    'support_ticket_created': {
        category: 'support',
        priority: 'normal',
        title: 'Ticket Received: {{ticket_number}}',
        body: 'Your support ticket {{ticket_number}} "{{subject}}" has been received. Our helpdesk team will review it shortly.'
    },
    'support_ticket_replied': {
        category: 'support',
        priority: 'normal',
        title: 'New Reply on Ticket {{ticket_number}}',
        body: 'A new reply was posted on ticket {{ticket_number}} by {{sender_name}}.'
    },
    'support_ticket_status_changed': {
        category: 'support',
        priority: 'normal',
        title: 'Ticket {{ticket_number}} Status Updated',
        body: 'The status of ticket {{ticket_number}} was changed to {{status}}.'
    },
    'support_ticket_resolved': {
        category: 'support',
        priority: 'normal',
        title: 'Ticket {{ticket_number}} Resolved',
        body: 'Your ticket {{ticket_number}} has been marked as resolved. If you need further assistance, you may reply or reopen it.'
    },

    // 10. Broadcast Announcement
    'broadcast_announcement': {
        category: 'system',
        priority: 'high',
        title: '{{title}}',
        body: '{{content}}'
    }
};

class NexusNotificationService {
    constructor() {
        this.templates = DEFAULT_TEMPLATES;
    }

    /**
     * Mask bank account for privacy (e.g., "1234567890" -> "****7890")
     */
    maskBankNumber(acc) {
        if (!acc || typeof acc !== 'string') return '****';
        const clean = acc.trim();
        if (clean.length <= 4) return '****';
        return '****' + clean.slice(-4);
    }

    maskBankAccount(acc) {
        return this.maskBankNumber(acc);
    }

    /**
     * Sanitize variables by masking sensitive account fields
     */
    sanitizeVariables(variables = {}) {
        const out = {};
        for (const [key, val] of Object.entries(variables)) {
            if (key.includes('bank') || key.includes('account_number')) {
                out[key] = this.maskBankNumber(String(val));
            } else {
                out[key] = val;
            }
        }
        return out;
    }

    /**
     * Interpolate template variables safely
     */
    interpolate(templateStr, variables = {}) {
        if (!templateStr) return '';
        let result = templateStr;
        for (const [key, rawVal] of Object.entries(variables)) {
            let val = rawVal;
            if (key.includes('bank_account') || key.includes('account_number')) {
                val = this.maskBankAccount(String(rawVal));
            } else if (val === null || val === undefined) {
                val = '';
            } else {
                val = String(val);
            }
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            result = result.replace(regex, val);
        }
        return result;
    }

    /**
     * Central Event Emitter
     * 
     * @param {string} eventType e.g. 'order_created', 'withdrawal_paid'
     * @param {Object} payload
     * @param {string} [payload.recipient_id] Member or Admin User ID
     * @param {boolean} [payload.is_admin_recipient] True if targeted to admin
     * @param {string} [payload.reference_type] Entity type ('order', 'withdrawal', 'ticket')
     * @param {string} [payload.reference_id] Entity ID
     * @param {string} [payload.action_url] Click-through URL
     * @param {string} [payload.idempotency_key] Explicit key, or auto-generated
     * @param {Object} [payload.variables] Template variables
     * @param {string} [payload.custom_title] Override default title
     * @param {string} [payload.custom_message] Override default message
     * @param {string} [payload.priority] Override default priority
     * @param {Object} [payload.metadata] Additional JSON metadata
     */
    async emit(eventType, payload = {}) {
        try {
            const template = this.templates[eventType] || {
                category: 'system',
                priority: 'normal',
                title: 'Notification',
                body: 'You have a new notification.'
            };

            const recipientId = payload.recipient_id || payload.userId || payload.user_id;
            const isAdmin = !!payload.is_admin_recipient;

            // Generate deterministic idempotency key if not explicitly given
            const idempotencyKey = payload.idempotency_key || 
                (recipientId && payload.reference_id 
                    ? `${eventType}:${payload.reference_type || 'entity'}:${payload.reference_id}:${recipientId}` 
                    : null);

            // Check if notification already exists via idempotency
            if (idempotencyKey) {
                const existing = await nexusDb.getNotificationByIdempotencyKey(idempotencyKey);
                if (existing) {
                    return { success: true, duplicated: true, notification: existing };
                }
            }

            // Interpolate title and body
            const variables = payload.variables || {};
            const title = payload.custom_title || this.interpolate(template.title, variables);
            const message = payload.custom_message || this.interpolate(template.body, variables);
            const priority = payload.priority || template.priority || 'normal';
            const category = template.category || 'system';

            // Check recipient preferences
            let inAppEnabled = true;
            let emailEnabled = true;
            if (recipientId) {
                const prefs = await nexusDb.getNotificationPreferences(recipientId);
                if (prefs) {
                    // Security & critical financial alerts cannot be turned off
                    const isMandatory = priority === 'critical' || category === 'security';
                    if (!isMandatory) {
                        if (prefs.in_app_enabled === false) inAppEnabled = false;
                        if (prefs.email_enabled === false) emailEnabled = false;
                        if (prefs.category_preferences && prefs.category_preferences[category] === false) {
                            inAppEnabled = false;
                            emailEnabled = false;
                        }
                    }
                }
            }

            let createdNotif = null;

            // 1. Deliver In-App Notification if enabled
            if (inAppEnabled && recipientId) {
                createdNotif = await nexusDb.createNotificationRecord({
                    recipient_member_id: isAdmin ? null : recipientId,
                    recipient_admin_id: isAdmin ? recipientId : null,
                    user_id: recipientId, // For backwards compatibility
                    notification_type: eventType,
                    category: category,
                    priority: priority,
                    title: title,
                    message: message,
                    reference_type: payload.reference_type || null,
                    reference_id: payload.reference_id || null,
                    action_url: payload.action_url || null,
                    idempotency_key: idempotencyKey,
                    metadata: payload.metadata || {}
                });

                // Log in-app delivery
                await nexusDb.logNotificationDelivery({
                    notification_id: createdNotif.id,
                    channel: 'in_app',
                    recipient_destination: recipientId,
                    delivery_status: 'delivered'
                });
            }

            // 2. Deliver Email Notification if enabled
            if (emailEnabled && recipientId) {
                const user = await nexusDb.findUserById(recipientId);
                if (user && user.email) {
                    const emailResult = await nexusEmailProvider.sendEmail({
                        to: user.email,
                        subject: `[Nexus Prime] ${title}`,
                        html: `<p>${message}</p>`,
                        text: message
                    });

                    // Log email delivery attempt
                    if (createdNotif) {
                        await nexusDb.logNotificationDelivery({
                            notification_id: createdNotif.id,
                            channel: 'email',
                            recipient_destination: nexusEmailProvider.maskEmail(user.email),
                            delivery_status: emailResult.status,
                            error_message: emailResult.error || emailResult.notice || null
                        });
                    }
                }
            }

            return {
                success: true,
                notification: createdNotif,
                deliveredInApp: inAppEnabled,
                deliveredEmail: emailEnabled
            };
        } catch (err) {
            console.error('[NexusNotificationService.emit] Error:', err);
            return { success: false, error: err.message };
        }
    }

    /**
     * Broadcast Announcement to Audience
     */
    async broadcastAnnouncement({ title, content, priority = 'normal', targetAudience = 'all', authorId }) {
        if (!title || !content) {
            return { success: false, error: 'Title and content are required for broadcast announcement.' };
        }

        const announcement = await nexusDb.createAnnouncement({
            title: title.trim(),
            content: content.trim(),
            priority: priority,
            target_audience: targetAudience,
            author_id: authorId
        });

        // Determine matching member user IDs
        let targetUserIds = [];
        if (targetAudience === 'all') {
            targetUserIds = nexusDb.users.map(u => u.id);
        } else if (targetAudience === 'verified_members') {
            targetUserIds = nexusDb.memberProfiles
                .filter(p => p.verification_status === 'verified')
                .map(p => p.user_id);
        } else if (targetAudience === 'active_subscribers') {
            targetUserIds = nexusDb.memberProfiles
                .filter(p => p.package_status && p.package_status !== 'INACTIVE')
                .map(p => p.user_id);
        } else if (targetAudience === 'admins') {
            const adminRoles = nexusDb.userRoles.filter(r => r.role_id === 2 || r.role_id === 3);
            targetUserIds = adminRoles.map(r => r.user_id);
        } else {
            targetUserIds = nexusDb.users.map(u => u.id);
        }

        // Emit announcement notification to target audience
        for (const uid of targetUserIds) {
            await this.emit('broadcast_announcement', {
                recipient_id: uid,
                custom_title: title,
                custom_message: content,
                priority: priority,
                reference_type: 'announcement',
                reference_id: announcement.id,
                metadata: { announcement_id: announcement.id, target_audience: targetAudience }
            });
        }

        return {
            success: true,
            announcement: announcement,
            recipientsCount: targetUserIds.length
        };
    }
}

module.exports = new NexusNotificationService();
