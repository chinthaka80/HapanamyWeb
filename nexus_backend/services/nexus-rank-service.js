// ==============================================================================
// NEXUS PRIME (PVT) LTD — MLM RANK, LEVEL, QUALIFICATION & ACHIEVEMENT SERVICE
// DOMAIN: nexusp.online
// IMPLEMENTATION: PROMPT 14
// COMPLIANCE: 100% ISOLATION FROM HAPANAMY.LK
// ARCHITECTURE: DETERMINISTIC QUALIFICATION + FINANCIAL DECOUPLING
// ==============================================================================

const nexusDb = require('../db/nexus-db');

class NexusRankService {
    /**
     * Gathers trusted server-side metrics for a member.
     * 
     * @param {string} memberId - User ID or Member ID (NPXXXXXX)
     * @param {Object} options - Metric options { period_type, period_value, reference_date }
     * @returns {Promise<Object>} Calculated member metrics
     */
    async calculateMemberMetrics(memberId, options = {}) {
        const userId = nexusDb.resolveMemberUserId(memberId);
        if (!userId) throw new Error(`Member '${memberId}' not found.`);

        const profile = await nexusDb.findProfileByUserId(userId);
        if (!profile) throw new Error(`Member profile for '${userId}' not found.`);

        const [pv, tv, directs, network] = await Promise.all([
            nexusDb.calculateMemberPersonalVolume(userId, options),
            nexusDb.calculateMemberTeamVolume(userId, options),
            nexusDb.calculateMemberDirectReferrals(userId),
            nexusDb.calculateMemberNetworkSize(userId)
        ]);

        const hasPackage = profile.package_status && profile.package_status !== 'NONE' && profile.package_status !== 'INACTIVE';

        return {
            user_id: userId,
            member_id: profile.member_id,
            current_rank: profile.rank || 'MEMBER',
            account_status: profile.status,
            package_status: profile.package_status || 'NONE',
            has_active_package: Boolean(hasPackage),
            personal_volume: pv,
            team_volume: tv,
            direct_group_volume: tv, // In unilevel, direct group volume can be scoped or equivalent to level 1 volume
            direct_referrals: directs.total,
            active_direct_referrals: directs.active,
            total_network_members: network.total,
            active_network_members: network.active,
            calculated_at: new Date().toISOString()
        };
    }

    /**
     * Evaluates a single qualification requirement against member metrics.
     * 
     * @param {Object} req - Requirement definition
     * @param {Object} metrics - Calculated member metrics
     * @param {Object} profile - Member profile
     * @returns {Object} Evaluation result { passed, actual_value, target_value }
     */
    evaluateRequirement(req, metrics, profile) {
        let actualValue = 0;
        let passed = false;

        const metricType = req.metric_type || req.requirement_type;
        switch (metricType) {
            case 'personal_volume':
                actualValue = metrics.personal_volume;
                break;
            case 'team_volume':
                actualValue = metrics.team_volume;
                break;
            case 'direct_group_volume':
                actualValue = metrics.direct_group_volume || metrics.team_volume;
                break;
            case 'direct_referrals':
                actualValue = metrics.direct_referrals;
                break;
            case 'active_direct_referrals':
            case 'active_directs':
                actualValue = metrics.active_directs || metrics.active_direct_referrals || 0;
                break;
            case 'total_network_members':
                actualValue = metrics.total_network_members;
                break;
            case 'active_network_members':
                actualValue = metrics.active_network_members;
                break;
            case 'package':
            case 'package_status':
                actualValue = metrics.has_active_package ? 1 : 0;
                break;
            default:
                actualValue = 0;
        }

        const target = parseFloat(req.target_value) || 0;
        const op = req.comparison_operator || req.operator || '>=';

        switch (op) {
            case '>=':
                passed = actualValue >= target;
                break;
            case '>':
                passed = actualValue > target;
                break;
            case '<=':
                passed = actualValue <= target;
                break;
            case '<':
                passed = actualValue < target;
                break;
            case '=':
            case '==':
                passed = actualValue === target;
                break;
            case 'IN':
                if (req.target_value_string) {
                    const allowed = req.target_value_string.split(',').map(s => s.trim().toUpperCase());
                    passed = allowed.includes(String(actualValue).toUpperCase());
                } else {
                    passed = true;
                }
                break;
            default:
                passed = actualValue >= target;
        }

        // Special handling for package_status requirement
        if (req.metric_type === 'package_status' && req.target_value_string) {
            const allowed = req.target_value_string.split(',').map(s => s.trim().toUpperCase());
            passed = allowed.includes((profile.package_status || '').toUpperCase());
            actualValue = profile.package_status || 'NONE';
        }

        let progressPercent = 0;
        if (typeof actualValue === 'number' && target > 0) {
            progressPercent = Math.min(100, Math.round((actualValue / target) * 100));
        } else if (passed) {
            progressPercent = 100;
        }

        return {
            requirement_id: req.id,
            metric_type: req.metric_type,
            operator: op,
            target_value: req.target_value_string || target,
            actual_value: actualValue,
            is_required: req.is_required,
            passed,
            progress_percent: progressPercent
        };
    }

    /**
     * Deterministically evaluates a member's rank eligibility based on active rules.
     * Selects the HIGHEST qualified rank according to configured display_order.
     * 
     * @param {string} memberId - User ID or Member ID
     * @param {string} period - Evaluation period ('lifetime', 'monthly', etc.)
     * @param {string|null} ruleVersionId - Specific rule version ID (optional)
     * @returns {Promise<Object>} Complete evaluation result
     */
    async evaluateMemberRank(memberId, period = 'lifetime', ruleVersionId = null) {
        const userId = nexusDb.resolveMemberUserId(memberId);
        if (!userId) throw new Error(`Member '${memberId}' not found.`);

        const profile = await nexusDb.findProfileByUserId(userId);
        if (!profile) throw new Error(`Member profile for '${userId}' not found.`);

        // 1. Resolve applicable rule version
        let ruleVersion;
        if (ruleVersionId) {
            ruleVersion = nexusDb.rankRuleVersions.find(v => v.id === ruleVersionId);
            if (!ruleVersion) throw new Error(`Rank rule version '${ruleVersionId}' not found.`);
        } else {
            ruleVersion = await nexusDb.getActiveRankRuleVersion();
        }

        // 2. Fetch all active ranks sorted by display_order ASC
        const allRanks = await nexusDb.getAllRanks({ status: 'active' });
        const allRequirements = await nexusDb.getRankRequirements({ rule_version_id: ruleVersion ? ruleVersion.id : null });

        // 3. Calculate member metrics
        const metrics = await this.calculateMemberMetrics(userId, { period_type: period });

        // 4. Evaluate each rank
        const rankEvaluations = [];
        const qualifyingRanks = [];

        for (const rank of allRanks) {
            // Corporate Root / Founder rank is reserved
            if (rank.code === 'FOUNDER' && profile.member_id !== 'NP000001') {
                continue;
            }

            const reqsForRank = allRequirements.filter(r => r.rank_id === rank.id);
            const evaluatedReqs = reqsForRank.map(r => this.evaluateRequirement(r, metrics, profile));

            // Only baseline entry-level member rank (display_order === 0 or code === 'MEMBER')
            // qualifies with zero requirements. Higher leadership ranks REQUIRE configured rules!
            let isQualifying = false;
            if (rank.display_order === 0 || rank.code === 'MEMBER') {
                isQualifying = true;
            } else if (reqsForRank.length > 0) {
                const requiredReqs = evaluatedReqs.filter(r => r.is_required);
                isQualifying = requiredReqs.every(r => r.passed);
            } else {
                isQualifying = false;
            }

            const evalSummary = {
                rank_id: rank.id,
                rank_code: rank.code,
                rank_name: rank.name,
                display_order: rank.display_order,
                icon: rank.icon,
                color_token: rank.color_token,
                badge_style: rank.badge_style,
                requirements_count: reqsForRank.length,
                requirements: evaluatedReqs,
                is_qualifying: isQualifying
            };

            rankEvaluations.push(evalSummary);
            if (isQualifying) {
                qualifyingRanks.push(rank);
            }
        }

        // 5. Select HIGHEST qualified rank based on display_order DESC
        qualifyingRanks.sort((a, b) => b.display_order - a.display_order);
        const highestRank = qualifyingRanks.length > 0 ? qualifyingRanks[0] : allRanks[0];

        // 6. Identify next target rank and compute progress
        const currentRankObj = allRanks.find(r => r.code === (profile.rank || 'MEMBER')) || allRanks[0];
        const nextRank = allRanks.find(r => r.display_order === currentRankObj.display_order + 1 && r.code !== 'FOUNDER') || null;

        let nextRankProgress = null;
        if (nextRank) {
            const nextEval = rankEvaluations.find(e => e.rank_id === nextRank.id);
            if (nextEval && nextEval.requirements.length > 0) {
                const reqs = nextEval.requirements;
                const avgProgress = Math.round(reqs.reduce((sum, r) => sum + r.progress_percent, 0) / reqs.length);
                nextRankProgress = {
                    next_rank: {
                        id: nextRank.id,
                        code: nextRank.code,
                        name: nextRank.name,
                        description: nextRank.description,
                        icon: nextRank.icon,
                        color_token: nextRank.color_token,
                        badge_style: nextRank.badge_style
                    },
                    overall_percent: avgProgress,
                    requirements: reqs
                };
            } else {
                nextRankProgress = {
                    next_rank: {
                        id: nextRank.id,
                        code: nextRank.code,
                        name: nextRank.name,
                        description: nextRank.description,
                        icon: nextRank.icon,
                        color_token: nextRank.color_token,
                        badge_style: nextRank.badge_style
                    },
                    overall_percent: 0,
                    requirements: [],
                    notice: 'Configuration required for next rank requirements.'
                };
            }
        }

        return {
            user_id: userId,
            member_id: profile.member_id,
            current_rank: {
                id: currentRankObj.id,
                code: currentRankObj.code,
                name: currentRankObj.name,
                display_order: currentRankObj.display_order,
                icon: currentRankObj.icon,
                color_token: currentRankObj.color_token,
                badge_style: currentRankObj.badge_style
            },
            highest_qualified_rank: {
                id: highestRank.id,
                code: highestRank.code,
                name: highestRank.name,
                display_order: highestRank.display_order,
                icon: highestRank.icon,
                color_token: highestRank.color_token,
                badge_style: highestRank.badge_style
            },
            qualifiedRank: {
                id: highestRank.id,
                code: highestRank.code,
                name: highestRank.name,
                display_order: highestRank.display_order,
                icon: highestRank.icon,
                color_token: highestRank.color_token,
                badge_style: highestRank.badge_style
            },
            next_rank_progress: nextRankProgress,
            current_metrics: metrics,
            rank_evaluations: rankEvaluations,
            eligible_ranks: qualifyingRanks.map(r => r.code),
            rule_version: ruleVersion ? { id: ruleVersion.id, version: ruleVersion.version, name: ruleVersion.name } : null,
            evaluated_at: new Date().toISOString()
        };
    }

    /**
     * Server-side recalculation of a member's rank.
     * Updates profile if changed, records immutable snapshot in history,
     * and emits audit logs and in-app notifications.
     * 
     * @param {string} memberId - Member ID or User ID
     * @param {Object} options - Recalculation options { reason, adminUserId, period, forceDemotion }
     * @returns {Promise<Object>} Recalculation result
     */
    async recalculateMemberRank(memberId, options = {}) {
        const userId = nexusDb.resolveMemberUserId(memberId);
        if (!userId) throw new Error(`Member '${memberId}' not found.`);

        const profile = await nexusDb.findProfileByUserId(userId);
        if (!profile) throw new Error(`Member profile '${userId}' not found.`);

        const evaluation = await this.evaluateMemberRank(userId, options.period || 'lifetime');
        const currentRankCode = (profile.rank || 'MEMBER').toUpperCase();
        const qualifiedRankCode = evaluation.highest_qualified_rank.code.toUpperCase();

        const currentRankObj = evaluation.current_rank;
        const qualifiedRankObj = evaluation.highest_qualified_rank;

        const isPromotion = qualifiedRankObj.display_order > currentRankObj.display_order;
        const isDemotion = qualifiedRankObj.display_order < currentRankObj.display_order;

        let rankChanged = false;
        let actionReason = options.reason || 'qualification_evaluation';
        let eventType = null;

        // 1. Promotion
        if (isPromotion) {
            rankChanged = true;
            eventType = 'RANK_ACHIEVED';
        } 
        // 2. Potential Demotion
        else if (isDemotion) {
            const demotionEnabled = options.forceDemotion || nexusDb.settings.get('rank_demotion_enabled') === 'true';
            if (demotionEnabled) {
                rankChanged = true;
                eventType = 'RANK_DEMOTED';
                actionReason = 'demotion';
            } else {
                // Retention policy: member maintains achieved lifetime rank
                rankChanged = false;
            }
        }

        let historyRecord = null;
        if (rankChanged) {
            // Apply rank change to profile
            await nexusDb.setMemberRank(userId, qualifiedRankCode);

            // Record immutable history entry with point-in-time metrics snapshot
            historyRecord = await nexusDb.insertMemberRankHistory({
                member_id: userId,
                rank_id: qualifiedRankObj.id,
                previous_rank_id: currentRankObj.id,
                rule_version_id: evaluation.rule_version ? evaluation.rule_version.id : null,
                qualification_period: options.period || 'lifetime',
                reason: actionReason,
                snapshot: {
                    metrics: evaluation.current_metrics,
                    highest_qualified_rank: evaluation.highest_qualified_rank,
                    eligible_ranks: evaluation.eligible_ranks,
                    rule_version: evaluation.rule_version
                },
                created_by: options.adminUserId || 'system'
            });

            // Emit Tamper-Proof Audit Log
            await nexusDb.insertAuditLog({
                action: eventType,
                entity_type: 'nexus_ranks',
                entity_id: qualifiedRankObj.id,
                actor_id: options.adminUserId || userId,
                payload: {
                    member_id: profile.member_id,
                    user_id: userId,
                    previous_rank: currentRankCode,
                    new_rank: qualifiedRankCode,
                    achievement_id: historyRecord.id,
                    reason: actionReason
                }
            });

            // Emit in-app notification
            if (eventType === 'RANK_ACHIEVED') {
                await nexusDb.createNotification({
                    user_id: userId,
                    title: 'New Rank Achieved! 🎖️',
                    message: `Congratulations! You have qualified for and achieved the rank of ${qualifiedRankObj.name}.`,
                    type: 'rank_promotion',
                    link: '/dashboard/rank'
                });
            } else if (eventType === 'RANK_DEMOTED') {
                await nexusDb.createNotification({
                    user_id: userId,
                    title: 'Rank Adjustment Notice',
                    message: `Your account rank standing has been adjusted to ${qualifiedRankObj.name} in accordance with periodic qualification criteria.`,
                    type: 'rank_adjustment',
                    link: '/dashboard/rank'
                });
            }
        }

        // Always log recalculation diagnostic audit if requested by admin
        if (options.adminUserId) {
            await nexusDb.insertAuditLog({
                action: 'RANK_RECALCULATED',
                entity_type: 'nexus_ranks',
                entity_id: qualifiedRankObj.id,
                actor_id: options.adminUserId,
                payload: {
                    member_id: profile.member_id,
                    user_id: userId,
                    evaluated_rank: qualifiedRankCode,
                    previous_rank: currentRankCode,
                    rank_changed: rankChanged,
                    metrics: evaluation.current_metrics
                }
            });
        }

        return {
            success: true,
            promoted: isPromotion && rankChanged,
            is_promotion: isPromotion && rankChanged,
            rank_changed: rankChanged,
            event: eventType,
            previous_rank: currentRankCode,
            previous_rank_code: currentRankCode,
            previous_rank_name: currentRankObj?.name || 'Member',
            current_rank: rankChanged ? qualifiedRankCode : currentRankCode,
            evaluated_rank: qualifiedRankCode,
            evaluated_rank_code: qualifiedRankCode,
            evaluated_rank_name: qualifiedRankObj?.name || 'Member',
            metrics: evaluation.current_metrics,
            evaluation,
            history_record: historyRecord
        };
    }

    /**
     * Batch recalculation of all active distributor accounts.
     * 
     * @param {Object} options - Options { adminUserId, period }
     * @returns {Promise<Object>} Summary of batch processing
     */
    async recalculateAllEligibleRanks(options = {}) {
        const activeMembers = nexusDb.memberProfiles.filter(p => p.status === 'active');
        let promotedCount = 0;
        let demotedCount = 0;
        let unchangedCount = 0;
        const results = [];

        for (const member of activeMembers) {
            try {
                const res = await this.recalculateMemberRank(member.user_id, {
                    adminUserId: options.adminUserId || 'system',
                    reason: 'scheduled_batch_recalculation',
                    period: options.period || 'lifetime'
                });

                if (res.rank_changed) {
                    if (res.event === 'RANK_ACHIEVED') promotedCount++;
                    if (res.event === 'RANK_DEMOTED') demotedCount++;
                } else {
                    unchangedCount++;
                }

                results.push({
                    member_id: member.member_id,
                    user_id: member.user_id,
                    previous_rank: res.previous_rank,
                    current_rank: res.current_rank,
                    rank_changed: res.rank_changed
                });
            } catch (err) {
                results.push({
                    member_id: member.member_id,
                    user_id: member.user_id,
                    error: err.message
                });
            }
        }

        return {
            success: true,
            total_evaluated: activeMembers.length,
            total_promoted: promotedCount,
            promoted_count: promotedCount,
            demoted_count: demotedCount,
            unchanged_count: unchangedCount,
            results
        };
    }

    /**
     * Returns full rank progression dossier for a member.
     * 
     * @param {string} memberId - Member ID or User ID
     * @returns {Promise<Object>} Rank progress overview and history
     */
    async getMemberRankProgress(memberId) {
        const userId = nexusDb.resolveMemberUserId(memberId);
        if (!userId) throw new Error(`Member '${memberId}' not found.`);

        const evaluation = await this.evaluateMemberRank(userId);
        const history = await nexusDb.getMemberRankHistory(userId, { limit: 10 });
        const latestHistory = await nexusDb.getLatestMemberRankHistory(userId);

        return {
            success: true,
            user_id: userId,
            member_id: evaluation.member_id,
            current_rank: evaluation.current_rank,
            next_rank: evaluation.next_rank_progress?.next_rank || null,
            requirements_checklist: evaluation.next_rank_progress?.requirements || [],
            demotion_policy: { enabled: false, message: 'Lifetime retention policy active. No rank demotion applied.' },
            rank_since: latestHistory ? latestHistory.qualified_at : null,
            highest_qualified_rank: evaluation.highest_qualified_rank,
            next_rank_progress: evaluation.next_rank_progress,
            current_metrics: evaluation.current_metrics,
            history: history.history,
            rule_version: evaluation.rule_version
        };
    }
}

// Global Singleton Instance
const nexusRankService = new NexusRankService();

module.exports = nexusRankService;
