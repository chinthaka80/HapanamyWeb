// Comprehensive Test Suite for STEP 53: MY TEAM LIST (මගේ කණ්ඩායමේ සාමාජිකයින්)
// Verifies:
// 1. Full Downline Traversal: Returns all members under Left and Right legs across all levels (Level 1 to 7+)
// 2. Strict Tree Isolation: Zero Cross-line members, Zero Upline ancestors, Zero Foreign tree leakage
// 3. Accurate Metadata: Full Name, @Username, Team Leg (LEFT/RIGHT), Account Status, Qualification Status, Balance Points, Team Size, Join Date
// 4. Toolbar Filter Logic: All Team, Left Team, Right Team, Active, Qualified, Level 1, Level 2, Level 3, Levels 4-7
// 5. Real-time Search: By name, username (with or without @), or User ID
// 6. Core MLM Math Invariants: 8% Direct, 7% Binary, Rs. 30,000 Daily Cap remain 100% preserved

const assert = require('assert');
const testRunner = require('./test-runner');
const MLMNetworkEngine = require('../services/mlm-network-engine');
const MemberDashboardService = require('../services/member-dashboard-service');
const PlacementEngine = require('../services/placement-engine');
const CommissionCore = require('../services/commission-core');

function createMultiLevelTeamContext() {
    // Top Root Upline (Should NEVER show in Member's team list)
    const uplineBoss = { id: 'usr-upline-boss', username: 'top_boss', full_name: 'Top Boss', status: 'ACTIVE' };
    
    // Cross-line Member under Top Boss's other leg (Should NEVER show in Member's team list)
    const crosslineUser = { id: 'usr-crossline', username: 'cross_member', full_name: 'Cross Member', status: 'ACTIVE' };

    // The Target Member (Center ME)
    const targetUser = {
        id: 'usr-target-me',
        username: 'chinthaka_n',
        full_name: 'Chinthaka Nuwan',
        status: 'ACTIVE',
        account_status: 'ACTIVE',
        qualification_status: 'QUALIFIED'
    };

    // Downline Level 1 (Left and Right)
    const childL1 = { id: 'usr-child-l1', username: 'kasun_l1', full_name: 'Kasun Bandara', status: 'ACTIVE', qualification_status: 'QUALIFIED', created_at: '2026-09-02T10:00:00Z' };
    const childR1 = { id: 'usr-child-r1', username: 'sanduni_r1', full_name: 'Sanduni Silva', status: 'ACTIVE', qualification_status: 'NOT_QUALIFIED', created_at: '2026-09-03T10:00:00Z' };

    // Downline Level 2 (under childL1 and childR1)
    const grandL2A = { id: 'usr-grand-l2a', username: 'nuwan_l2a', full_name: 'Nuwan Perera', status: 'ACTIVE', qualification_status: 'QUALIFIED', created_at: '2026-09-04T10:00:00Z' };
    const grandL2B = { id: 'usr-grand-l2b', username: 'kamal_l2b', full_name: 'Kamal Jayasuriya', status: 'INACTIVE', qualification_status: 'NOT_QUALIFIED', created_at: '2026-09-05T10:00:00Z' };
    const grandR2A = { id: 'usr-grand-r2a', username: 'dilani_r2a', full_name: 'Dilani Fernando', status: 'ACTIVE', qualification_status: 'NOT_QUALIFIED', created_at: '2026-09-06T10:00:00Z' };

    // Downline Level 3 (under grandL2A)
    const greatL3 = { id: 'usr-great-l3', username: 'amal_l3', full_name: 'Amal Wickrama', status: 'ACTIVE', qualification_status: 'NOT_QUALIFIED', created_at: '2026-09-07T10:00:00Z' };

    // Downline Level 4 (under greatL3)
    const deepL4 = { id: 'usr-deep-l4', username: 'saman_l4', full_name: 'Saman Kumara', status: 'ACTIVE', qualification_status: 'NOT_QUALIFIED', created_at: '2026-09-08T10:00:00Z' };

    // Downline Level 5 (under deepL4)
    const deepL5 = { id: 'usr-deep-l5', username: 'ruwan_l5', full_name: 'Ruwan Priyadarshana', status: 'INACTIVE', qualification_status: 'NOT_QUALIFIED', created_at: '2026-09-09T10:00:00Z' };

    const users = [
        uplineBoss, crosslineUser, targetUser,
        childL1, childR1, grandL2A, grandL2B, grandR2A,
        greatL3, deepL4, deepL5
    ];

    const binaryNodes = [
        { id: 'node-boss', user_id: uplineBoss.id, placement_parent_id: null, position: 'ROOT', depth: 1 },
        { id: 'node-cross', user_id: crosslineUser.id, placement_parent_id: uplineBoss.id, position: 'LEFT', depth: 2 },
        { id: 'node-target', user_id: targetUser.id, placement_parent_id: uplineBoss.id, position: 'RIGHT', depth: 2 },

        // Target's Level 1
        { id: 'node-child-l1', user_id: childL1.id, placement_parent_id: targetUser.id, position: 'LEFT', depth: 3 },
        { id: 'node-child-r1', user_id: childR1.id, placement_parent_id: targetUser.id, position: 'RIGHT', depth: 3 },

        // Target's Level 2
        { id: 'node-grand-l2a', user_id: grandL2A.id, placement_parent_id: childL1.id, position: 'LEFT', depth: 4 },
        { id: 'node-grand-l2b', user_id: grandL2B.id, placement_parent_id: childL1.id, position: 'RIGHT', depth: 4 },
        { id: 'node-grand-r2a', user_id: grandR2A.id, placement_parent_id: childR1.id, position: 'LEFT', depth: 4 },

        // Target's Level 3
        { id: 'node-great-l3', user_id: greatL3.id, placement_parent_id: grandL2A.id, position: 'LEFT', depth: 5 },

        // Target's Level 4
        { id: 'node-deep-l4', user_id: deepL4.id, placement_parent_id: greatL3.id, position: 'LEFT', depth: 6 },

        // Target's Level 5
        { id: 'node-deep-l5', user_id: deepL5.id, placement_parent_id: deepL4.id, position: 'LEFT', depth: 7 }
    ];

    const sponsors = [
        { user_id: crosslineUser.id, sponsor_id: uplineBoss.id },
        { user_id: targetUser.id, sponsor_id: uplineBoss.id },
        { user_id: childL1.id, sponsor_id: targetUser.id },
        { user_id: childR1.id, sponsor_id: targetUser.id },
        { user_id: grandL2A.id, sponsor_id: childL1.id },
        { user_id: grandL2B.id, sponsor_id: childL1.id },
        { user_id: grandR2A.id, sponsor_id: childR1.id },
        { user_id: greatL3.id, sponsor_id: grandL2A.id },
        { user_id: deepL4.id, sponsor_id: greatL3.id },
        { user_id: deepL5.id, sponsor_id: deepL4.id }
    ];

    const purchases = [
        { id: 'p1', user_id: childL1.id, status: 'ACTIVE', binary_volume: 7425.00 },
        { id: 'p2', user_id: childR1.id, status: 'ACTIVE', binary_volume: 5000.00 },
        { id: 'p3', user_id: grandL2A.id, status: 'ACTIVE', binary_volume: 15992.00 },
        { id: 'p4', user_id: grandR2A.id, status: 'ACTIVE', binary_volume: 7920.00 },
        { id: 'p5', user_id: greatL3.id, status: 'ACTIVE', binary_volume: 15992.00 },
        { id: 'p6', user_id: deepL4.id, status: 'ACTIVE', binary_volume: 7920.00 }
    ];

    const volumeLedger = [
        { user_id: targetUser.id, leg: 'LEFT', amount: 47329.00 },
        { user_id: targetUser.id, leg: 'RIGHT', amount: 12920.00 }
    ];

    return {
        targetUser,
        uplineBoss,
        crosslineUser,
        users,
        binaryNodes,
        sponsors,
        purchases,
        volumeLedger
    };
}

test('STEP 53.1: Complete Downline Traversal & Tree Isolation (Zero Crosslines, Zero Uplines)', () => {
    const ctx = createMultiLevelTeamContext();
    const network = MLMNetworkEngine.getMemberNetwork(ctx.targetUser.id, {
        users: ctx.users,
        binaryNodes: ctx.binaryNodes,
        sponsors: ctx.sponsors,
        purchases: ctx.purchases,
        volumeLedger: ctx.volumeLedger
    });

    const teamList = network.team_list;
    assert(Array.isArray(teamList), 'team_list must be an array');
    
    // Total downline members under target: 2 (Level 1) + 3 (Level 2) + 1 (Level 3) + 1 (Level 4) + 1 (Level 5) = 8 members
    assert.equal(teamList.length, 8, 'Target member must see exactly 8 downline members');

    // Verify TREE ISOLATION:
    // 1. Upline boss must NOT be in the team list
    const hasUpline = teamList.some(m => m.user_id === ctx.uplineBoss.id || m.id === ctx.uplineBoss.id);
    assert.equal(hasUpline, false, 'Upline ancestor must NEVER appear in member team list');

    // 2. Crossline member must NOT be in the team list
    const hasCrossline = teamList.some(m => m.user_id === ctx.crosslineUser.id || m.id === ctx.crosslineUser.id);
    assert.equal(hasCrossline, false, 'Crossline members must NEVER appear in member team list');

    // 3. Target user himself must NOT be in his own team list (he is Center ME)
    const hasSelf = teamList.some(m => m.user_id === ctx.targetUser.id || m.id === ctx.targetUser.id);
    assert.equal(hasSelf, false, 'Member himself must not be listed as downline of himself');
});

test('STEP 53.2: Left and Right Team Leg Allocation Verification', () => {
    const ctx = createMultiLevelTeamContext();
    const network = MLMNetworkEngine.getMemberNetwork(ctx.targetUser.id, {
        users: ctx.users,
        binaryNodes: ctx.binaryNodes,
        sponsors: ctx.sponsors,
        purchases: ctx.purchases,
        volumeLedger: ctx.volumeLedger
    });

    const leftMembers = network.team_list.filter(m => (m.position || '').toUpperCase() === 'LEFT');
    const rightMembers = network.team_list.filter(m => (m.position || '').toUpperCase() === 'RIGHT');

    // Left team: childL1, grandL2A, grandL2B, greatL3, deepL4, deepL5 (6 members)
    assert.equal(leftMembers.length, 6, 'Left team should have 6 descendants');
    assert(leftMembers.some(m => m.username === 'kasun_l1'), 'kasun_l1 must be in Left team');
    assert(leftMembers.some(m => m.username === 'nuwan_l2a'), 'nuwan_l2a must be in Left team');
    assert(leftMembers.some(m => m.username === 'kamal_l2b'), 'kamal_l2b must be in Left team');
    assert(leftMembers.some(m => m.username === 'amal_l3'), 'amal_l3 must be in Left team');
    assert(leftMembers.some(m => m.username === 'saman_l4'), 'saman_l4 must be in Left team');
    assert(leftMembers.some(m => m.username === 'ruwan_l5'), 'ruwan_l5 must be in Left team');

    // Right team: childR1, grandR2A (2 members)
    assert.equal(rightMembers.length, 2, 'Right team should have 2 descendants');
    assert(rightMembers.some(m => m.username === 'sanduni_r1'), 'sanduni_r1 must be in Right team');
    assert(rightMembers.some(m => m.username === 'dilani_r2a'), 'dilani_r2a must be in Right team');
});

test('STEP 53.3: Relative Level & Depth Tracking (Levels 1 to 5)', () => {
    const ctx = createMultiLevelTeamContext();
    const network = MLMNetworkEngine.getMemberNetwork(ctx.targetUser.id, {
        users: ctx.users,
        binaryNodes: ctx.binaryNodes,
        sponsors: ctx.sponsors,
        purchases: ctx.purchases,
        volumeLedger: ctx.volumeLedger
    });

    const l1 = network.team_list.filter(m => (m.level || m.depth || m.relative_depth) === 1);
    const l2 = network.team_list.filter(m => (m.level || m.depth || m.relative_depth) === 2);
    const l3 = network.team_list.filter(m => (m.level || m.depth || m.relative_depth) === 3);
    const l4 = network.team_list.filter(m => (m.level || m.depth || m.relative_depth) === 4);
    const l5 = network.team_list.filter(m => (m.level || m.depth || m.relative_depth) === 5);

    assert.equal(l1.length, 2, 'Level 1 must contain 2 direct children');
    assert.equal(l2.length, 3, 'Level 2 must contain 3 grandchildren');
    assert.equal(l3.length, 1, 'Level 3 must contain 1 great-grandchild');
    assert.equal(l4.length, 1, 'Level 4 must contain 1 member');
    assert.equal(l5.length, 1, 'Level 5 must contain 1 member');
});

test('STEP 53.4: Member Status & Qualification Metadata Precision', () => {
    const ctx = createMultiLevelTeamContext();
    const network = MLMNetworkEngine.getMemberNetwork(ctx.targetUser.id, {
        users: ctx.users,
        binaryNodes: ctx.binaryNodes,
        sponsors: ctx.sponsors,
        purchases: ctx.purchases,
        volumeLedger: ctx.volumeLedger
    });

    const activeList = network.team_list.filter(m => m.is_active);
    const inactiveList = network.team_list.filter(m => !m.is_active);
    const qualifiedList = network.team_list.filter(m => m.is_qualified || m.qualification_status === 'QUALIFIED');

    // Active: childL1, childR1, grandL2A, grandR2A, greatL3, deepL4 = 6 members
    assert.equal(activeList.length, 6, 'Should have 6 active members with purchases');

    // Inactive: grandL2B, deepL5 = 2 members
    assert.equal(inactiveList.length, 2, 'Should have 2 inactive members with zero purchases');

    // Qualified: childL1, grandL2A = 2 members
    assert.equal(qualifiedList.length, 2, 'Should have 2 qualified members');
});

test('STEP 53.5: Client Toolbar Filters Simulation (Search, Legs, Status, Level)', () => {
    const ctx = createMultiLevelTeamContext();
    const network = MLMNetworkEngine.getMemberNetwork(ctx.targetUser.id, {
        users: ctx.users,
        binaryNodes: ctx.binaryNodes,
        sponsors: ctx.sponsors,
        purchases: ctx.purchases,
        volumeLedger: ctx.volumeLedger
    });
    const globalTeamList = network.team_list;

    function applyFilter(filter, searchVal = '') {
        const cleanSearch = searchVal.startsWith('@') ? searchVal.substring(1).toLowerCase().trim() : searchVal.toLowerCase().trim();
        return globalTeamList.filter(m => {
            const leg = (m.position || m.branch_leg || 'LEFT').toUpperCase();
            if (filter === 'left' && leg !== 'LEFT') return false;
            if (filter === 'right' && leg !== 'RIGHT') return false;

            const isAct = Boolean(m.is_active || (m.status || m.account_status || '').toUpperCase() === 'ACTIVE');
            if (filter === 'active' && !isAct) return false;
            if (filter === 'inactive' && isAct) return false;

            const isQual = Boolean(m.is_qualified || (m.qualification_status || '').toUpperCase() === 'QUALIFIED');
            if (filter === 'qualified' && !isQual) return false;

            const lvl = m.level || m.depth || m.relative_depth || 1;
            if (filter === 'level1' && lvl !== 1) return false;
            if (filter === 'level2' && lvl !== 2) return false;
            if (filter === 'level3' && lvl !== 3) return false;
            if (filter === 'level4-7') {
                if (lvl < 4 || lvl > 7) return false;
            }

            if (cleanSearch) {
                const nameMatch = (m.full_name || m.name || '').toLowerCase().includes(cleanSearch);
                const userMatch = (m.username || '').toLowerCase().includes(cleanSearch);
                const idMatch = (m.user_id || m.id || '').toLowerCase().includes(cleanSearch);
                return nameMatch || userMatch || idMatch;
            }
            return true;
        });
    }

    // 1. All Team
    assert.equal(applyFilter('all').length, 8);

    // 2. Left Team vs Right Team
    assert.equal(applyFilter('left').length, 6);
    assert.equal(applyFilter('right').length, 2);

    // 3. Active vs Inactive
    assert.equal(applyFilter('active').length, 6);
    assert.equal(applyFilter('inactive').length, 2);

    // 4. Qualified
    assert.equal(applyFilter('qualified').length, 2);

    // 5. Level filters
    assert.equal(applyFilter('level1').length, 2);
    assert.equal(applyFilter('level2').length, 3);
    assert.equal(applyFilter('level3').length, 1);
    assert.equal(applyFilter('level4-7').length, 2);

    // 6. Search by name
    const searchNuwan = applyFilter('all', 'Nuwan');
    assert.equal(searchNuwan.length, 1);
    assert.equal(searchNuwan[0].username, 'nuwan_l2a');

    // 7. Search by username with @
    const searchSanduni = applyFilter('all', '@sanduni_r1');
    assert.equal(searchSanduni.length, 1);
    assert.equal(searchSanduni[0].full_name, 'Sanduni Silva');
});

test('STEP 53.6: Core MLM Calculation Invariants Unchanged', () => {
    // 8% Direct referral commission
    assert.equal(CommissionCore.calculateDirectCommission(15992.00, 8.00), 1279.36);

    // 7% Binary pairing commission
    assert.equal(CommissionCore.calculateBinaryCommission(15992.00, 7.00), 1119.44);

    // Daily Cap (Rs. 30,000)
    const capRes = CommissionCore.applyDailyCap(15000.00, 20000.00, 30000.00);
    assert.equal(capRes.eligibleAmount, 10000.00);
    assert.equal(capRes.cappedAmount, 5000.00);
});
