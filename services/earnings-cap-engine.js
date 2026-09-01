// Hapanamy.lk Configurable Daily & Monthly Earnings Cap Engine (STEP 20)
// Manages daily and monthly earnings limits, multi-policy handling (PARTIAL_PAYMENT, REJECT_EXCESS, HOLD_EXCESS),
// timezone-deterministic period resets (Asia/Colombo), and audit logging.

const DEFAULT_CAP_CONFIG = {
    daily_cap_amount: 30000.00,
    monthly_cap_amount: 900000.00,
    timezone: 'Asia/Colombo',
    included_commission_types: ['DIRECT', 'BINARY', 'MATCHING', 'LEADERSHIP'],
    cap_policy: 'PARTIAL_PAYMENT', // 'PARTIAL_PAYMENT' | 'REJECT_EXCESS' | 'HOLD_EXCESS' | 'CARRY_FORWARD'
    type_specific_caps: {
        // e.g. BINARY: 30000.00, DIRECT: null (unlimited)
    }
};

const EarningsCapEngine = {
    _activeConfig: { ...DEFAULT_CAP_CONFIG },
    _capAuditLogs: [],
    _evalLocks: new Set(),

    /**
     * Retrieves the active cap configuration.
     */
    getConfig() {
        return { ...this._activeConfig };
    },

    /**
     * Updates the cap configuration (Admin capability).
     */
    updateConfig(newConfig, adminUserId = 'system', auditLogs = []) {
        if (!newConfig || typeof newConfig !== 'object') {
            throw new Error('Invalid earnings cap configuration object.');
        }

        const oldConfig = { ...this._activeConfig };
        this._activeConfig = {
            ...this._activeConfig,
            ...newConfig,
            updated_at: new Date().toISOString(),
            updated_by: adminUserId
        };

        if (auditLogs) {
            auditLogs.push({
                id: 'audit-cap-' + Math.random().toString(36).substr(2, 9),
                user_id: adminUserId,
                action: 'EARNINGS_CAP_CONFIG_UPDATED',
                entity_type: 'settings',
                entity_id: 'earnings_cap',
                old_values: oldConfig,
                new_values: this._activeConfig,
                created_at: new Date().toISOString()
            });
        }

        return this._activeConfig;
    },

    /**
     * Computes the current date keys (day and month) in the configured business timezone.
     */
    getDateKeys(date = new Date(), timezone = null) {
        const tz = timezone || this._activeConfig.timezone || 'Asia/Colombo';
        try {
            const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: tz,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            const dayKey = formatter.format(date); // Format: 'YYYY-MM-DD'
            const monthKey = dayKey.substring(0, 7); // Format: 'YYYY-MM'
            return { dayKey, monthKey, timezone: tz };
        } catch (e) {
            // Fallback for environments with standard ISO formatting
            const iso = date.toISOString();
            return { dayKey: iso.split('T')[0], monthKey: iso.substring(0, 7), timezone: 'UTC' };
        }
    },

    /**
     * Calculates current accumulated earnings for a user for a given day and month.
     */
    getAccumulatedEarnings(userId, commissionLedger = [], commissionType = null, targetDate = new Date()) {
        const { dayKey, monthKey } = this.getDateKeys(targetDate);
        const includedTypes = this._activeConfig.included_commission_types;

        let dailyEarnings = 0;
        let monthlyEarnings = 0;

        for (const entry of commissionLedger) {
            if (entry.user_id !== userId) continue;
            if (entry.status !== 'APPROVED' && entry.status !== 'PARTIAL_CAPPED') continue;

            const entryType = (entry.type || '').toUpperCase();
            if (commissionType && entryType !== commissionType.toUpperCase()) continue;
            if (!commissionType && includedTypes && !includedTypes.includes(entryType)) continue;

            const entryDate = entry.created_at ? new Date(entry.created_at) : new Date();
            const { dayKey: entryDay, monthKey: entryMonth } = this.getDateKeys(entryDate);

            const amount = Number(entry.eligible_amount) || Number(entry.amount) || 0;

            if (entryDay === dayKey) {
                dailyEarnings += amount;
            }
            if (entryMonth === monthKey) {
                monthlyEarnings += amount;
            }
        }

        return {
            userId,
            dayKey,
            monthKey,
            dailyEarnings: Math.round(dailyEarnings * 100) / 100,
            monthlyEarnings: Math.round(monthlyEarnings * 100) / 100
        };
    },

    /**
     * Evaluates a requested commission amount against daily and monthly earning caps.
     */
    evaluateEarningCap({
        userId,
        amount,
        commissionType = 'BINARY',
        commissionLedger = [],
        customConfig = null,
        targetDate = new Date()
    }) {
        const config = customConfig || this._activeConfig;
        const reqAmountCents = Math.round(Number(amount) * 100);

        if (reqAmountCents <= 0) {
            return {
                allowed: true,
                calculatedAmount: 0.00,
                eligibleAmount: 0.00,
                cappedAmount: 0.00,
                heldAmount: 0.00,
                status: 'APPROVED',
                policy: config.cap_policy
            };
        }

        const { dayKey, monthKey, timezone } = this.getDateKeys(targetDate, config.timezone);
        const accumulated = this.getAccumulatedEarnings(userId, commissionLedger, null, targetDate);

        const dailyCapCents = Math.round(Number(config.daily_cap_amount) * 100);
        const monthlyCapCents = Math.round(Number(config.monthly_cap_amount) * 100);

        const currentDailyCents = Math.round(accumulated.dailyEarnings * 100);
        const currentMonthlyCents = Math.round(accumulated.monthlyEarnings * 100);

        const remainingDailyCents = Math.max(0, dailyCapCents - currentDailyCents);
        const remainingMonthlyCents = Math.max(0, monthlyCapCents - currentMonthlyCents);

        const effectiveRemainingCents = Math.min(remainingDailyCents, remainingMonthlyCents);

        let eligibleCents = 0;
        let cappedCents = 0;
        let heldCents = 0;
        let finalStatus = 'APPROVED';
        const policy = config.cap_policy || 'PARTIAL_PAYMENT';

        if (reqAmountCents <= effectiveRemainingCents) {
            // Full amount allowed
            eligibleCents = reqAmountCents;
            cappedCents = 0;
            heldCents = 0;
            finalStatus = 'APPROVED';
        } else {
            // Amount exceeds remaining cap -> apply policy
            if (policy === 'PARTIAL_PAYMENT') {
                eligibleCents = effectiveRemainingCents;
                cappedCents = reqAmountCents - eligibleCents;
                heldCents = 0;
                finalStatus = eligibleCents > 0 ? 'PARTIAL_CAPPED' : 'FULLY_CAPPED';
            } else if (policy === 'REJECT_EXCESS') {
                eligibleCents = effectiveRemainingCents;
                cappedCents = reqAmountCents - eligibleCents;
                heldCents = 0;
                finalStatus = 'REJECTED_EXCESS';
            } else if (policy === 'HOLD_EXCESS') {
                eligibleCents = effectiveRemainingCents;
                heldCents = reqAmountCents - eligibleCents;
                cappedCents = 0;
                finalStatus = 'HELD_EXCESS';
            } else if (policy === 'CARRY_FORWARD') {
                eligibleCents = effectiveRemainingCents;
                cappedCents = 0;
                heldCents = reqAmountCents - eligibleCents; // Held for next period
                finalStatus = 'CARRIED_FORWARD';
            }
        }

        const outcome = {
            user_id: userId,
            day_key: dayKey,
            month_key: monthKey,
            timezone,
            policy,
            calculated_amount: reqAmountCents / 100,
            eligible_amount: eligibleCents / 100,
            capped_amount: cappedCents / 100,
            held_amount: heldCents / 100,
            status: finalStatus,
            daily_limit: dailyCapCents / 100,
            daily_current: currentDailyCents / 100,
            daily_remaining: remainingDailyCents / 100,
            monthly_limit: monthlyCapCents / 100,
            monthly_current: currentMonthlyCents / 100,
            monthly_remaining: remainingMonthlyCents / 100,
            evaluated_at: new Date().toISOString()
        };

        this._capAuditLogs.push(outcome);
        return outcome;
    },

    /**
     * Gets a complete earning summary vs caps for a member dashboard or admin review.
     */
    getMemberEarningsSummary(userId, commissionLedger = []) {
        const { dayKey, monthKey, timezone } = this.getDateKeys();
        const accumulated = this.getAccumulatedEarnings(userId, commissionLedger);
        const config = this._activeConfig;

        return {
            user_id: userId,
            day_key: dayKey,
            month_key: monthKey,
            timezone,
            policy: config.cap_policy,
            daily_cap: config.daily_cap_amount,
            daily_earned: accumulated.dailyEarnings,
            daily_remaining: Math.max(0, Math.round((config.daily_cap_amount - accumulated.dailyEarnings) * 100) / 100),
            daily_usage_percent: config.daily_cap_amount > 0 ? Math.min(100, Math.round((accumulated.dailyEarnings / config.daily_cap_amount) * 10000) / 100) : 0,
            monthly_cap: config.monthly_cap_amount,
            monthly_earned: accumulated.monthlyEarnings,
            monthly_remaining: Math.max(0, Math.round((config.monthly_cap_amount - accumulated.monthlyEarnings) * 100) / 100),
            monthly_usage_percent: config.monthly_cap_amount > 0 ? Math.min(100, Math.round((accumulated.monthlyEarnings / config.monthly_cap_amount) * 10000) / 100) : 0
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = EarningsCapEngine;
}
