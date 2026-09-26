// ==============================================================================
// NEXUS PRIME (PVT) LTD — MEMBER SERVICE
// DOMAIN: nexusp.online
// ==============================================================================

const nexusDb = require('../db/nexus-db');
const NexusConfig = require('../config/nexus-config');

const NexusMemberService = {
    /**
     * Retrieves full dashboard summary data for an authenticated member
     */
    async getMemberDashboardData(userId) {
        if (!userId) return null;

        const user = await nexusDb.findUserById(userId);
        if (!user) return null;

        const profile = await nexusDb.findProfileByUserId(userId);
        if (!profile) return null;

        // Fetch Sponsor details
        let sponsorInfo = {
            isIndependent: true,
            name: 'Independent Member',
            memberId: 'N/A',
            referralCode: 'N/A'
        };

        if (profile.sponsor_id) {
            const sponsorProfile = await nexusDb.findProfileByUserId(profile.sponsor_id);
            if (sponsorProfile) {
                sponsorInfo = {
                    isIndependent: false,
                    name: sponsorProfile.full_name,
                    memberId: sponsorProfile.member_id,
                    referralCode: sponsorProfile.referral_code
                };
            }
        }

        // Fetch Real Team Statistics
        const teamStats = await nexusDb.getMemberTeamStats(userId);

        // Fetch Direct Referrals list (First 5 for dashboard preview)
        const directs = await nexusDb.getDirectReferrals(userId);

        // Fetch unread notifications count
        const unreadNotifCount = await nexusDb.getUnreadNotificationCount(userId);

        // Fetch recent member activities
        const recentActivities = await nexusDb.getMemberActivities(userId, 6);

        // Canonical Referral URL
        const referralUrl = `https://${NexusConfig.DOMAIN}/register?ref=${encodeURIComponent(profile.referral_code)}`;

        return {
            member: {
                userId: user.id,
                memberId: profile.member_id,
                fullName: profile.full_name,
                displayName: profile.display_name || profile.full_name,
                email: user.email,
                phone: profile.phone || '',
                address: profile.address || '',
                country: profile.country || 'Sri Lanka',
                rank: profile.rank || 'MEMBER',
                packageStatus: profile.package_status || 'STANDARD',
                status: profile.status || 'active',
                profileImageUrl: profile.profile_image_url || null,
                registrationDate: profile.registration_date,
                referralCode: profile.referral_code,
                referralUrl: referralUrl
            },
            sponsor: sponsorInfo,
            network: {
                directTeamCount: teamStats.directTeamCount,
                totalTeamCount: teamStats.totalTeamCount,
                activeTeamCount: teamStats.activeTeamCount,
                pendingTeamCount: teamStats.pendingTeamCount,
                inactiveTeamCount: teamStats.inactiveTeamCount,
                recentDirects: directs.slice(0, 5)
            },
            networkStats: {
                directTeamCount: teamStats.directTeamCount,
                totalTeamCount: teamStats.totalTeamCount,
                activeTeamCount: teamStats.activeTeamCount,
                pendingTeamCount: teamStats.pendingTeamCount,
                inactiveTeamCount: teamStats.inactiveTeamCount,
                recentDirects: directs.slice(0, 5)
            },
            // CRITICAL REQUIREMENT: Strict financial card placeholder policy
            // No fake LKR or dollar balances are generated.
            financials: {
                isAvailable: false,
                badge: 'Coming Soon',
                statusMessage: 'Available in Phase 2',
                notice: 'Financial wallet, live commissions, and withdrawal processing will be activated in Phase 2.',
                availableBalance: null,
                totalEarnings: null,
                pendingCommission: null
            },
            unreadNotificationsCount: unreadNotifCount,
            recentActivities: recentActivities
        };
    },

    /**
     * Retrieves Profile with strict separation of Personal vs Account information
     */
    async getMemberProfile(userId) {
        if (!userId) return null;

        const user = await nexusDb.findUserById(userId);
        if (!user) return null;

        const profile = await nexusDb.findProfileByUserId(userId);
        if (!profile) return null;

        let sponsorInfo = {
            isIndependent: true,
            name: 'Independent Member',
            memberId: 'N/A',
            referralCode: 'N/A'
        };

        if (profile.sponsor_id) {
            const sponsorProfile = await nexusDb.findProfileByUserId(profile.sponsor_id);
            if (sponsorProfile) {
                sponsorInfo = {
                    isIndependent: false,
                    name: sponsorProfile.full_name,
                    memberId: sponsorProfile.member_id,
                    referralCode: sponsorProfile.referral_code
                };
            }
        }

        return {
            personal: {
                fullName: profile.full_name,
                displayName: profile.display_name || profile.full_name,
                email: user.email,
                phone: profile.phone || '',
                address: profile.address || '',
                country: profile.country || 'Sri Lanka',
                profileImageUrl: profile.profile_image_url || null
            },
            account: {
                memberId: profile.member_id,
                referralCode: profile.referral_code,
                status: profile.status,
                rank: profile.rank,
                packageStatus: profile.package_status,
                registrationDate: profile.registration_date,
                sponsor: sponsorInfo
            }
        };
    },

    /**
     * Updates permitted profile fields with strict server-side validation and allowlist
     */
    async updateProfile(userId, updates) {
        if (!userId) return { success: false, error: 'User ID is required' };

        // Whitelist allowed fields with field immunity on protected attributes
        const safeUpdates = {};
        if (updates.fullName !== undefined || updates.full_name !== undefined) {
            const name = (updates.fullName !== undefined ? updates.fullName : updates.full_name).trim();
            if (name.length < 2) {
                return { success: false, error: 'Full name must be at least 2 characters.' };
            }
            safeUpdates.full_name = name;
        }

        if (updates.displayName !== undefined || updates.display_name !== undefined) {
            safeUpdates.display_name = (updates.displayName !== undefined ? updates.displayName : updates.display_name).trim();
        }

        if (updates.phone !== undefined) {
            const cleanPhone = updates.phone.trim();
            if (cleanPhone && !/^\+?[0-9\s\-()]{7,20}$/.test(cleanPhone)) {
                return { success: false, error: 'Invalid phone number format.' };
            }
            safeUpdates.phone = cleanPhone;
        }

        if (updates.address !== undefined) {
            safeUpdates.address = updates.address.trim();
        }

        if (updates.country !== undefined) {
            safeUpdates.country = updates.country.trim();
        }

        if (updates.profileImageUrl !== undefined || updates.profile_image_url !== undefined) {
            const img = updates.profileImageUrl !== undefined ? updates.profileImageUrl : updates.profile_image_url;
            safeUpdates.profile_image_url = img ? img.trim() : null;
        }

        if (Object.keys(safeUpdates).length === 0) {
            return { success: false, error: 'No valid profile fields provided for update.' };
        }

        const updated = await nexusDb.updateProfile(userId, safeUpdates);
        if (!updated) {
            return { success: false, error: 'Profile update failed.' };
        }

        // Log Member Activity
        await nexusDb.insertMemberActivity({
            userId: userId,
            action: 'PROFILE_UPDATED',
            description: 'Personal contact information was updated.',
            icon: '✏️'
        });

        // Security Audit Log
        await nexusDb.insertAuditLog({
            user_id: userId,
            action: 'PROFILE_UPDATE',
            entity_type: 'nexus_member_profiles',
            entity_id: updated.member_id,
            new_values: safeUpdates
        });

        return {
            success: true,
            message: 'Profile updated successfully.',
            profile: updated
        };
    },

    /**
     * Paginated Direct Referrals
     */
    async getMemberReferrals(userId, options = {}) {
        return nexusDb.getMemberReferrals(userId, options);
    },

    /**
     * Paginated Downline Team Directory
     */
    async getMemberTeam(userId, options = {}) {
        return nexusDb.getMemberTeam(userId, options);
    },

    /**
     * Team Statistics Summary
     */
    async getMemberTeamStats(userId) {
        return nexusDb.getMemberTeamStats(userId);
    },

    /**
     * Member Notifications
     */
    async getMemberNotifications(userId, options = {}) {
        const notifications = await nexusDb.getMemberNotifications(userId, options);
        const unreadCount = await nexusDb.getUnreadNotificationCount(userId);
        return {
            unreadCount,
            notifications
        };
    },

    /**
     * Mark Notification Read
     */
    async markNotificationRead(userId, notificationId) {
        if (!notificationId) {
            return { success: false, error: 'Notification ID is required.' };
        }
        const updated = await nexusDb.markNotificationRead(userId, notificationId);
        return { success: updated };
    },

    /**
     * Mark All Notifications Read
     */
    async markAllNotificationsRead(userId) {
        const count = await nexusDb.markAllNotificationsRead(userId);
        return { success: true, markedCount: count };
    },

    /**
     * Member Activity Feed
     */
    async getMemberActivities(userId, limit = 20) {
        const activities = await nexusDb.getMemberActivities(userId, limit);
        return { activities };
    }
};

module.exports = NexusMemberService;
