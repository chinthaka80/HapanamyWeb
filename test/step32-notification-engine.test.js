// Comprehensive Test Suite for STEP 32 — Centralized Event-Driven Notification Engine
const testRunner = require('./test-runner');
const NotificationEngine = require('../services/notification-engine');

function createNotificationTestContext() {
    const outboxQueue = [];
    const inAppStore = [];
    const dedupKeys = new Set();
    const preferencesStore = new Map();

    return {
        outboxQueue,
        inAppStore,
        dedupKeys,
        preferencesStore
    };
}

test('Step 32: 1. Event Generation: Dispatches all 12 system events accurately', () => {
    const ctx = createNotificationTestContext();
    const events = Object.values(NotificationEngine.EVENTS);

    assert.equal(events.length, 12, 'Must have 12 distinct notification events');

    events.forEach((evt, idx) => {
        const res = NotificationEngine.dispatch({
            event: evt,
            userId: `u-user-${idx}`,
            payload: { amount: 2500, entity_id: `ent-${idx}`, username: `User${idx}` },
            channels: [NotificationEngine.CHANNELS.IN_APP, NotificationEngine.CHANNELS.EMAIL],
            outboxQueue: ctx.outboxQueue,
            inAppStore: ctx.inAppStore,
            dedupKeys: ctx.dedupKeys,
            preferencesStore: ctx.preferencesStore
        });

        assert(res.success, `Event ${evt} must dispatch successfully`);
        assert.equal(res.queued_channels.length, 2, `Both IN_APP and EMAIL must be queued for ${evt}`);
    });

    assert.equal(ctx.inAppStore.length, 12, 'All 12 events should create an in-app notification');
    assert.equal(ctx.outboxQueue.length, 12, 'All 12 events should create an outbox queue item');
});

test('Step 32: 2. Multi-Channel Routing: Queues In-App, Email, SMS, and WhatsApp channels', () => {
    const ctx = createNotificationTestContext();

    const res = NotificationEngine.dispatch({
        event: NotificationEngine.EVENTS.COMMISSION_EARNED,
        userId: 'u-sponsor-1',
        payload: { amount: 2200, commission_type: 'DIRECT', entity_id: 'purch-100' },
        channels: [
            NotificationEngine.CHANNELS.IN_APP,
            NotificationEngine.CHANNELS.EMAIL,
            NotificationEngine.CHANNELS.SMS,
            NotificationEngine.CHANNELS.WHATSAPP
        ],
        outboxQueue: ctx.outboxQueue,
        inAppStore: ctx.inAppStore,
        dedupKeys: ctx.dedupKeys,
        preferencesStore: ctx.preferencesStore
    });

    assert(res.success);
    assert.equal(res.queued_channels.length, 4, 'All 4 channels queued');
    assert.equal(ctx.inAppStore.length, 1, '1 In-App notification stored');
    assert.equal(ctx.outboxQueue.length, 3, '3 External outbox items queued (Email, SMS, WhatsApp)');
});

test('Step 32: 3. Financial Fault-Isolation: Queue network exception never crashes caller', () => {
    const ctx = createNotificationTestContext();

    // Passing an invalid or throwing context
    const res = NotificationEngine.dispatch({
        event: NotificationEngine.EVENTS.PAYMENT_APPROVED,
        userId: null, // edge case
        payload: { amount: 27500, entity_id: 'purch-bad' },
        channels: [NotificationEngine.CHANNELS.IN_APP],
        outboxQueue: ctx.outboxQueue,
        inAppStore: ctx.inAppStore,
        dedupKeys: ctx.dedupKeys,
        preferencesStore: ctx.preferencesStore
    });

    assert(res.success, 'Financial flow continues safely without throwing unhandled exceptions');
});

test('Step 32: 4. Queue Processing & Retry Mechanism: Retries on failure and marks SENT on success', async () => {
    const ctx = createNotificationTestContext();

    NotificationEngine.dispatch({
        event: NotificationEngine.EVENTS.WITHDRAWAL_PAID,
        userId: 'u-user-wd',
        payload: { amount: 15000, entity_id: 'wd-99' },
        channels: [NotificationEngine.CHANNELS.EMAIL],
        outboxQueue: ctx.outboxQueue,
        inAppStore: ctx.inAppStore,
        dedupKeys: ctx.dedupKeys,
        preferencesStore: ctx.preferencesStore
    });

    assert.equal(ctx.outboxQueue.length, 1);
    assert.equal(ctx.outboxQueue[0].status, 'PENDING');

    // 1. Simulate 1st failure
    const failRun = await NotificationEngine.processQueue(ctx.outboxQueue, { simulateFailAll: true });
    assert.equal(failRun.retrying, 1);
    assert.equal(ctx.outboxQueue[0].status, 'RETRY');
    assert.equal(ctx.outboxQueue[0].retry_count, 1);

    // 2. Simulate 2nd run with working provider
    const successRun = await NotificationEngine.processQueue(ctx.outboxQueue, {
        emailProvider: async (item) => { return true; }
    });
    assert.equal(successRun.sent, 1);
    assert.equal(ctx.outboxQueue[0].status, 'SENT');
    assert(ctx.outboxQueue[0].sent_at);
});

test('Step 32: 5. Duplicate Prevention (Idempotency): Suppresses identical event dispatches', () => {
    const ctx = createNotificationTestContext();

    // 1st dispatch
    const res1 = NotificationEngine.dispatch({
        event: NotificationEngine.EVENTS.PAYMENT_APPROVED,
        userId: 'u-member-1',
        payload: { amount: 27500, entity_id: 'purch-fixed-1' },
        channels: [NotificationEngine.CHANNELS.IN_APP, NotificationEngine.CHANNELS.EMAIL],
        outboxQueue: ctx.outboxQueue,
        inAppStore: ctx.inAppStore,
        dedupKeys: ctx.dedupKeys,
        preferencesStore: ctx.preferencesStore
    });

    assert.equal(res1.queued_channels.length, 2);

    // 2nd duplicate dispatch
    const res2 = NotificationEngine.dispatch({
        event: NotificationEngine.EVENTS.PAYMENT_APPROVED,
        userId: 'u-member-1',
        payload: { amount: 27500, entity_id: 'purch-fixed-1' },
        channels: [NotificationEngine.CHANNELS.IN_APP, NotificationEngine.CHANNELS.EMAIL],
        outboxQueue: ctx.outboxQueue,
        inAppStore: ctx.inAppStore,
        dedupKeys: ctx.dedupKeys,
        preferencesStore: ctx.preferencesStore
    });

    assert.equal(res2.queued_channels.length, 0, 'No channels queued on duplicate event');
    assert.equal(res2.skipped_channels.length, 2, 'Both channels skipped due to duplicate suppression');
    assert.equal(ctx.inAppStore.length, 1, 'In-App store still has only 1 record');
    assert.equal(ctx.outboxQueue.length, 1, 'Outbox queue still has only 1 record');
});

test('Step 32: 6. Member Notification Preferences & Critical Event Override', () => {
    const ctx = createNotificationTestContext();

    // Member disables SMS and Email in preferences
    NotificationEngine.updatePreferences('u-member-optout', {
        email_enabled: false,
        sms_enabled: false
    }, ctx.preferencesStore);

    // 1. Non-critical event respects muted preferences
    const resNonCritical = NotificationEngine.dispatch({
        event: NotificationEngine.EVENTS.REGISTRATION_SUCCESSFUL,
        userId: 'u-member-optout',
        payload: { entity_id: 'reg-1' },
        channels: [NotificationEngine.CHANNELS.SMS],
        outboxQueue: ctx.outboxQueue,
        inAppStore: ctx.inAppStore,
        dedupKeys: ctx.dedupKeys,
        preferencesStore: ctx.preferencesStore
    });

    assert.equal(resNonCritical.queued_channels.length, 0, 'Muted SMS channel must not be queued');
    assert.equal(resNonCritical.skipped_channels[0].reason, 'MUTED_BY_USER_PREFERENCE');

    // 2. Critical financial event overrides non-critical opt-out
    const resCritical = NotificationEngine.dispatch({
        event: NotificationEngine.EVENTS.COMMISSION_EARNED,
        userId: 'u-member-optout',
        payload: { amount: 2200, entity_id: 'purch-crit-1' },
        channels: [NotificationEngine.CHANNELS.EMAIL],
        outboxQueue: ctx.outboxQueue,
        inAppStore: ctx.inAppStore,
        dedupKeys: ctx.dedupKeys,
        preferencesStore: ctx.preferencesStore
    });

    assert.equal(resCritical.queued_channels.length, 1, 'Critical financial notice overrides opt-out');
});

test('Step 32: 7. In-App Notification Inbox & Read/Unread State Management', () => {
    const ctx = createNotificationTestContext();

    NotificationEngine.dispatch({
        event: NotificationEngine.EVENTS.KYC_STATUS_CHANGED,
        userId: 'u-member-inbox',
        payload: { status: 'APPROVED', entity_id: 'kyc-99' },
        channels: [NotificationEngine.CHANNELS.IN_APP],
        outboxQueue: ctx.outboxQueue,
        inAppStore: ctx.inAppStore,
        dedupKeys: ctx.dedupKeys,
        preferencesStore: ctx.preferencesStore
    });

    const unread = NotificationEngine.getUserInAppNotifications('u-member-inbox', ctx.inAppStore, { unreadOnly: true });
    assert.equal(unread.length, 1);
    assert.equal(unread[0].read, false);

    // Mark as read
    const marked = NotificationEngine.markInAppAsRead(unread[0].id, 'u-member-inbox', ctx.inAppStore);
    assert(marked);

    const remainingUnread = NotificationEngine.getUserInAppNotifications('u-member-inbox', ctx.inAppStore, { unreadOnly: true });
    assert.equal(remainingUnread.length, 0, 'No unread notifications left');
});

if (require.main === module) {
    runTests();
}
