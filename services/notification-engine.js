// Hapanamy.lk Centralized Event-Driven Notification Engine (STEP 32)
// Implements event dispatching, multi-channel delivery (In-App, Email, SMS, WhatsApp),
// asynchronous resilient queueing with retries, duplicate suppression (idempotency),
// member notification preferences, and financial fault-isolation.

const crypto = require('crypto');

// Standard Event Definitions
const NOTIFICATION_EVENTS = {
    REGISTRATION_SUCCESSFUL: 'REGISTRATION_SUCCESSFUL',
    PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
    PAYMENT_APPROVED: 'PAYMENT_APPROVED',
    PAYMENT_REJECTED: 'PAYMENT_REJECTED',
    PRODUCT_ACTIVATED: 'PRODUCT_ACTIVATED',
    COMMISSION_EARNED: 'COMMISSION_EARNED',
    DAILY_CAP_REACHED: 'DAILY_CAP_REACHED',
    WITHDRAWAL_SUBMITTED: 'WITHDRAWAL_SUBMITTED',
    WITHDRAWAL_APPROVED: 'WITHDRAWAL_APPROVED',
    WITHDRAWAL_PAID: 'WITHDRAWAL_PAID',
    KYC_STATUS_CHANGED: 'KYC_STATUS_CHANGED',
    REFUND_STATUS_CHANGED: 'REFUND_STATUS_CHANGED'
};

// Supported Channels
const CHANNELS = {
    IN_APP: 'IN_APP',
    EMAIL: 'EMAIL',
    SMS: 'SMS',
    WHATSAPP: 'WHATSAPP'
};

// Critical events that cannot be silenced on mandatory channels
const CRITICAL_FINANCIAL_EVENTS = new Set([
    NOTIFICATION_EVENTS.PAYMENT_APPROVED,
    NOTIFICATION_EVENTS.PAYMENT_REJECTED,
    NOTIFICATION_EVENTS.COMMISSION_EARNED,
    NOTIFICATION_EVENTS.WITHDRAWAL_APPROVED,
    NOTIFICATION_EVENTS.WITHDRAWAL_PAID,
    NOTIFICATION_EVENTS.KYC_STATUS_CHANGED,
    NOTIFICATION_EVENTS.REFUND_STATUS_CHANGED
]);

const NotificationEngine = {
    EVENTS: NOTIFICATION_EVENTS,
    CHANNELS,
    CRITICAL_EVENTS: CRITICAL_FINANCIAL_EVENTS,

    // In-memory queues & stores
    outboxQueue: [],
    inAppStore: [],
    sentDeduplicationKeys: new Set(),
    userPreferencesStore: new Map(),

    /**
     * Default notification preferences for a member.
     */
    getDefaultPreferences() {
        return {
            in_app_enabled: true,
            email_enabled: true,
            sms_enabled: true,
            whatsapp_enabled: true,
            marketing_emails: false,
            sound_enabled: true
        };
    },

    /**
     * Retrieves member notification preferences.
     */
    getPreferences(userId, store = this.userPreferencesStore) {
        if (!userId) return this.getDefaultPreferences();
        if (store instanceof Map) {
            return store.get(userId) || this.getDefaultPreferences();
        }
        const record = (store || []).find(p => p.user_id === userId);
        return record ? record.preferences : this.getDefaultPreferences();
    },

    /**
     * Updates member notification preferences.
     */
    updatePreferences(userId, newPrefs = {}, store = this.userPreferencesStore) {
        const current = this.getPreferences(userId, store);
        const updated = { ...current, ...newPrefs };
        if (store instanceof Map) {
            store.set(userId, updated);
        } else if (Array.isArray(store)) {
            const idx = store.findIndex(p => p.user_id === userId);
            if (idx !== -1) {
                store[idx].preferences = updated;
            } else {
                store.push({ user_id: userId, preferences: updated });
            }
        }
        return updated;
    },

    /**
     * Formats localized notification templates.
     */
    formatNotification(event, payload = {}) {
        const p = payload;
        switch (event) {
            case NOTIFICATION_EVENTS.REGISTRATION_SUCCESSFUL:
                return {
                    title: 'සාදරයෙන් පිළිගනිමු! (Welcome to Hapanamy.lk)',
                    message: `ආයුබෝවන් ${p.name || p.username || 'Member'}, ඔබගේ ගිණුම සාර්ථකව නිර්මාණය විය.`,
                    icon: '🎉'
                };
            case NOTIFICATION_EVENTS.PAYMENT_SUBMITTED:
                return {
                    title: 'ගෙවීම් ස්ලිපය ලැබුණි (Payment Submitted)',
                    message: `රු. ${Number(p.amount || 0).toLocaleString()} ක ගෙවීම් ස්ලිපය සමාලෝචනය සඳහා ලැබුණි. (Ref: ${p.bank_reference || 'N/A'})`,
                    icon: '📄'
                };
            case NOTIFICATION_EVENTS.PAYMENT_APPROVED:
                return {
                    title: 'ගෙවීම අනුමත විය (Payment Approved)',
                    message: `ඔබගේ රු. ${Number(p.amount || 0).toLocaleString()} ක ගෙවීම සාර්ථකව අනුමත විය. පාඨමාලා ප්‍රවේශය සක්‍රීයයි!`,
                    icon: '✅'
                };
            case NOTIFICATION_EVENTS.PAYMENT_REJECTED:
                return {
                    title: 'ගෙවීම ප්‍රතික්ෂේප විය (Payment Rejected)',
                    message: `ඔබ ඉදිරිපත් කළ ගෙවීම ප්‍රතික්ෂේප විය. හේතුව: ${p.reason || 'ස්ලිපය අපැහැදිලියි.'}`,
                    icon: '❌'
                };
            case NOTIFICATION_EVENTS.PRODUCT_ACTIVATED:
                return {
                    title: 'පාඨමාලාව සක්‍රීයයි (Product Activated)',
                    message: `${p.product_name || 'Masterclass'} පාඨමාලාව සඳහා පූර්ණ ප්‍රවේශය සක්‍රීය කර ඇත.`,
                    icon: '🎓'
                };
            case NOTIFICATION_EVENTS.COMMISSION_EARNED:
                return {
                    title: 'නව කොමිස් මුදලක් ලැබුණි! (Commission Received)',
                    message: `ඔබගේ ජාලයෙන් රු. ${Number(p.amount || 0).toLocaleString()} ක ${p.commission_type || 'DIRECT'} කොමිස් මුදලක් Wallet එකට බැර විය.`,
                    icon: '💰'
                };
            case NOTIFICATION_EVENTS.DAILY_CAP_REACHED:
                return {
                    title: 'දෛනික ආදායම් සීමාව (Daily Cap Reached)',
                    message: `අද දින සඳහා ඔබගේ උපරිම ආදායම් සීමාව (Rs. ${Number(p.cap || 0).toLocaleString()}) සපුරා ඇත.`,
                    icon: '⚠️'
                };
            case NOTIFICATION_EVENTS.WITHDRAWAL_SUBMITTED:
                return {
                    title: 'මුදල් ලබාගැනීමේ ඉල්ලීම (Withdrawal Requested)',
                    message: `රු. ${Number(p.amount || 0).toLocaleString()} ක මුදල් ලබාගැනීමේ ඉල්ලීමක් ඉදිරිපත් කරන ලදී.`,
                    icon: '🏦'
                };
            case NOTIFICATION_EVENTS.WITHDRAWAL_APPROVED:
                return {
                    title: 'මුදල් ලබාගැනීම අනුමතයි (Withdrawal Approved)',
                    message: `ඔබගේ රු. ${Number(p.amount || 0).toLocaleString()} ක මුදල් ලබාගැනීමේ ඉල්ලීම පරිපාලක විසින් අනුමත කරන ලදී.`,
                    icon: '✔️'
                };
            case NOTIFICATION_EVENTS.WITHDRAWAL_PAID:
                return {
                    title: 'මුදල් බැංකුවට බැර කරන ලදී (Withdrawal Paid)',
                    message: `රු. ${Number(p.amount || 0).toLocaleString()} ක මුදල ඔබගේ බැංකු ගිණුමට සාර්ථකව බැර කරන ලදී.`,
                    icon: '💸'
                };
            case NOTIFICATION_EVENTS.KYC_STATUS_CHANGED:
                return {
                    title: 'KYC සත්‍යාපන තත්ත්වය (KYC Status Updated)',
                    message: `ඔබගේ KYC තත්ත්වය '${p.status || 'UPDATED'}' ලෙස යාවත්කාලීන විය. ${p.reason ? `(හේතුව: ${p.reason})` : ''}`,
                    icon: '🆔'
                };
            case NOTIFICATION_EVENTS.REFUND_STATUS_CHANGED:
                return {
                    title: 'මුදල් ආපසු ගෙවීමේ තත්ත්වය (Refund Status)',
                    message: `Purchase #${p.purchase_id} සඳහා වූ Refund ඉල්ලීම '${p.status || 'UPDATED'}' තත්ත්වයට පත් විය.`,
                    icon: '🔄'
                };
            default:
                return {
                    title: p.title || 'Hapanamy Notification',
                    message: p.message || 'You have a new update from Hapanamy.lk',
                    icon: '🔔'
                };
        }
    },

    /**
     * Primary Event Dispatcher.
     * Guaranteed never to fail or roll back the calling financial transaction.
     */
    dispatch({
        event,
        userId,
        recipient = null,
        payload = {},
        channels = [CHANNELS.IN_APP, CHANNELS.EMAIL],
        outboxQueue = this.outboxQueue,
        inAppStore = this.inAppStore,
        dedupKeys = this.sentDeduplicationKeys,
        preferencesStore = this.userPreferencesStore
    }) {
        const results = {
            success: true,
            event,
            userId,
            queued_channels: [],
            skipped_channels: [],
            in_app_id: null,
            errors: []
        };

        try {
            const formatted = this.formatNotification(event, payload);
            const userPrefs = this.getPreferences(userId, preferencesStore);
            const isCritical = CRITICAL_FINANCIAL_EVENTS.has(event);
            const entityId = payload.entity_id || payload.purchase_id || payload.withdrawal_id || payload.id || 'gen';

            channels.forEach(channel => {
                // 1. Deduplication key (Idempotency)
                const dedupKey = `notif-${event}-${userId}-${entityId}-${channel}`;
                if (dedupKeys.has(dedupKey)) {
                    results.skipped_channels.push({ channel, reason: 'DUPLICATE_SUPPRESSED' });
                    return;
                }

                // 2. Member Preference Check (Critical Financial Events override non-mandatory channel silencing)
                let allowedByPreference = true;
                if (channel === CHANNELS.SMS && !userPrefs.sms_enabled && !isCritical) allowedByPreference = false;
                if (channel === CHANNELS.WHATSAPP && !userPrefs.whatsapp_enabled && !isCritical) allowedByPreference = false;
                if (channel === CHANNELS.EMAIL && !userPrefs.email_enabled && !isCritical) allowedByPreference = false;
                if (channel === CHANNELS.IN_APP && !userPrefs.in_app_enabled && !isCritical) allowedByPreference = false;

                if (!allowedByPreference) {
                    results.skipped_channels.push({ channel, reason: 'MUTED_BY_USER_PREFERENCE' });
                    return;
                }

                // 3. Dispatch by Channel
                if (channel === CHANNELS.IN_APP) {
                    const inAppNotif = {
                        id: 'inapp-' + crypto.randomBytes(8).toString('hex'),
                        user_id: userId,
                        event,
                        title: formatted.title,
                        message: formatted.message,
                        icon: formatted.icon,
                        metadata: payload,
                        read: false,
                        created_at: new Date().toISOString()
                    };
                    inAppStore.push(inAppNotif);
                    dedupKeys.add(dedupKey);
                    results.in_app_id = inAppNotif.id;
                    results.queued_channels.push(channel);
                } else {
                    // External channels go into Outbox Queue with retries
                    const queueItem = {
                        id: 'outbox-' + crypto.randomBytes(8).toString('hex'),
                        dedup_key: dedupKey,
                        user_id: userId,
                        channel,
                        event,
                        recipient: recipient || payload.email || payload.mobile || 'customer@hapanamy.lk',
                        title: formatted.title,
                        message: formatted.message,
                        metadata: payload,
                        status: 'PENDING',
                        retry_count: 0,
                        max_retries: 3,
                        last_error: null,
                        created_at: new Date().toISOString()
                    };
                    outboxQueue.push(queueItem);
                    dedupKeys.add(dedupKey);
                    results.queued_channels.push(channel);
                }
            });

        } catch (err) {
            // Fault-isolation: Never crash the financial transaction
            results.success = false;
            results.errors.push(err.message);
        }

        return results;
    },

    /**
     * Processes outbox queue with optional mock providers.
     */
    async processQueue(outboxQueue = this.outboxQueue, providers = {}) {
        const processed = {
            total: 0,
            sent: 0,
            failed: 0,
            retrying: 0
        };

        const pendingItems = outboxQueue.filter(i => i.status === 'PENDING' || i.status === 'RETRY');

        for (const item of pendingItems) {
            processed.total++;
            try {
                if (providers.simulateFailAll) {
                    throw new Error('External notification provider network outage');
                }

                // Simulate channel-specific delivery
                if (item.channel === CHANNELS.EMAIL && providers.emailProvider) {
                    await providers.emailProvider(item);
                } else if (item.channel === CHANNELS.SMS && providers.smsProvider) {
                    await providers.smsProvider(item);
                } else if (item.channel === CHANNELS.WHATSAPP && providers.whatsappProvider) {
                    await providers.whatsappProvider(item);
                }

                item.status = 'SENT';
                item.sent_at = new Date().toISOString();
                processed.sent++;

            } catch (err) {
                item.last_error = err.message;
                item.retry_count++;

                if (item.retry_count >= item.max_retries) {
                    item.status = 'FAILED';
                    processed.failed++;
                } else {
                    item.status = 'RETRY';
                    processed.retrying++;
                }
            }
        }

        return processed;
    },

    /**
     * Retries failed items in the queue.
     */
    async retryFailedQueue(outboxQueue = this.outboxQueue, providers = {}) {
        const retriableItems = outboxQueue.filter(i => i.status === 'RETRY' || i.status === 'FAILED');
        retriableItems.forEach(i => {
            i.status = 'RETRY';
        });
        return this.processQueue(outboxQueue, providers);
    },

    /**
     * Retrieves in-app notifications for a member.
     */
    getUserInAppNotifications(userId, inAppStore = this.inAppStore, { unreadOnly = false, limit = 50 } = {}) {
        return inAppStore
            .filter(n => n.user_id === userId && (!unreadOnly || !n.read))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit);
    },

    /**
     * Marks an in-app notification as read.
     */
    markInAppAsRead(notificationId, userId, inAppStore = this.inAppStore) {
        const notif = inAppStore.find(n => n.id === notificationId && n.user_id === userId);
        if (notif) {
            notif.read = true;
            return true;
        }
        return false;
    }
};

if (typeof module !== 'undefined') {
    module.exports = NotificationEngine;
}
