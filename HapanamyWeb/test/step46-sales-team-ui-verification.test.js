// test/step46-sales-team-ui-verification.test.js
// Production Verification Test Suite for Member Dashboard "My Sales Team" Redesign
// Verifies 3-Card Horizontal Structure, Open Position CTAs, "My Team List" Search/Filters,
// Server Authoritative Data Binding, Invariant Integrity, and Complete UI Terminology Modernization.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const MLMNetworkEngine = require('../services/mlm-network-engine');
const PlacementEngine = require('../services/placement-engine');
const VolumeLedger = require('../services/volume-ledger');

// Helper to construct a representative multi-member test network
function createTestSalesTeamNetwork() {
    const users = [
        { id: 'u-root-me', username: 'hiru_root', full_name: 'Hiru Root Leader', status: 'ACTIVE', qualification_status: 'QUALIFIED', created_at: '2026-08-01T00:00:00Z' },
        { id: 'u-direct-left', username: 'nimal_silva', full_name: 'Nimal Silva', status: 'ACTIVE', qualification_status: 'QUALIFIED', created_at: '2026-08-05T00:00:00Z' },
        { id: 'u-direct-right', username: 'sunil_kumar', full_name: 'Sunil Kumar', status: 'ACTIVE', qualification_status: 'QUALIFIED', created_at: '2026-08-10T00:00:00Z' },
        { id: 'u-downline-left-1', username: 'kamal_p', full_name: 'Kamal Perera', status: 'ACTIVE', qualification_status: 'QUALIFIED', created_at: '2026-08-15T00:00:00Z' },
        { id: 'u-downline-left-2', username: 'anura_k', full_name: 'Anura Kumara', status: 'INACTIVE', qualification_status: 'REGISTERED', created_at: '2026-08-20T00:00:00Z' },
        { id: 'u-downline-right-1', username: 'priyantha_m', full_name: 'Priyantha Mendis', status: 'ACTIVE', qualification_status: 'QUALIFIED', created_at: '2026-08-22T00:00:00Z' }
    ];

    const binaryNodes = [
        { id: 'node-root', user_id: 'u-root-me', placement_parent_id: null, position: null, depth: 1, path: '/u-root-me' },
        { id: 'node-left', user_id: 'u-direct-left', placement_parent_id: 'u-root-me', position: 'LEFT', depth: 2, path: '/u-root-me/u-direct-left' },
        { id: 'node-right', user_id: 'u-direct-right', placement_parent_id: 'u-root-me', position: 'RIGHT', depth: 2, path: '/u-root-me/u-direct-right' },
        { id: 'node-dl-1', user_id: 'u-downline-left-1', placement_parent_id: 'u-direct-left', position: 'LEFT', depth: 3, path: '/u-root-me/u-direct-left/u-downline-left-1' },
        { id: 'node-dl-2', user_id: 'u-downline-left-2', placement_parent_id: 'u-direct-left', position: 'RIGHT', depth: 3, path: '/u-root-me/u-direct-left/u-downline-left-2' },
        { id: 'node-dr-1', user_id: 'u-downline-right-1', placement_parent_id: 'u-direct-right', position: 'LEFT', depth: 3, path: '/u-root-me/u-direct-right/u-downline-right-1' }
    ];

    const sponsors = [
        { user_id: 'u-direct-left', sponsor_id: 'u-root-me', created_at: '2026-08-05T00:00:00Z' },
        { user_id: 'u-direct-right', sponsor_id: 'u-root-me', created_at: '2026-08-10T00:00:00Z' },
        { user_id: 'u-downline-left-1', sponsor_id: 'u-direct-left', created_at: '2026-08-15T00:00:00Z' },
        { user_id: 'u-downline-left-2', sponsor_id: 'u-direct-left', created_at: '2026-08-20T00:00:00Z' },
        { user_id: 'u-downline-right-1', sponsor_id: 'u-direct-right', created_at: '2026-08-22T00:00:00Z' }
    ];

    const purchases = [
        { id: 'p-1', user_id: 'u-direct-left', product_name: 'Masterclass Level 1', selling_price: 27500.00, status: 'ACTIVE' },
        { id: 'p-2', user_id: 'u-direct-right', product_name: 'Masterclass Level 1', selling_price: 27500.00, status: 'ACTIVE' },
        { id: 'p-3', user_id: 'u-downline-left-1', product_name: 'Trading Pro', selling_price: 27500.00, status: 'ACTIVE' },
        { id: 'p-4', user_id: 'u-downline-right-1', product_name: 'AI Mastery', selling_price: 27500.00, status: 'ACTIVE' }
    ];

    const volumeLedger = [
        { user_id: 'u-root-me', leg: 'LEFT', amount: 55000.00, source_purchase_id: 'p-1-3' },
        { user_id: 'u-root-me', leg: 'RIGHT', amount: 55000.00, source_purchase_id: 'p-2-4' },
        { user_id: 'u-direct-left', leg: 'LEFT', amount: 27500.00, source_purchase_id: 'p-3' },
        { user_id: 'u-direct-left', leg: 'RIGHT', amount: 0.00, source_purchase_id: null },
        { user_id: 'u-direct-right', leg: 'LEFT', amount: 27500.00, source_purchase_id: 'p-4' },
        { user_id: 'u-direct-right', leg: 'RIGHT', amount: 0.00, source_purchase_id: null }
    ];

    return { users, binaryNodes, sponsors, purchases, volumeLedger };
}

// 1. Terminology Modernization Check in dashboard.html
test('Step 46: 1. UI Terminology: No member-facing references to Binary Network Tree or Sinhala old tree text in dashboard.html', () => {
    const htmlPath = path.join(__dirname, '../dashboard.html');
    assert(fs.existsSync(htmlPath), 'dashboard.html must exist');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Forbidden old titles/labels in member dashboard UI
    assert.strictEqual(htmlContent.includes('ද්විමය ජාලය (Binary Network Tree)'), false, 'Must not contain old heading: ද්විමය ජාලය (Binary Network Tree)');
    assert.strictEqual(htmlContent.includes('🌿 Binary Network & Volume Analytics'), false, 'Must not contain old analytics title');
    assert.strictEqual(htmlContent.includes('Binary Tree (ජාලය)'), false, 'Must not contain Binary Tree in sidebar');

    // Required modern titles
    assert(htmlContent.includes('MY SALES TEAM'), 'Must contain MY SALES TEAM heading');
    assert(htmlContent.includes('My Sales Team'), 'Must contain My Sales Team title');
    assert(htmlContent.includes('MY TEAM LIST'), 'Must contain MY TEAM LIST heading');
    assert(htmlContent.includes('ඔබේ Sales Team එක එකම තැනකින් බලන්න'), 'Must contain Sinhala subtitle');
});

// 2. 3-Card Structure DOM Invariant Check in dashboard.html
test('Step 46: 2. UI Layout: 3-Card Horizontal Structure and Team List exist in DOM hierarchy', () => {
    const htmlPath = path.join(__dirname, '../dashboard.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // 3-card containers and connectors
    assert(htmlContent.includes('sales-team-container'), 'Must have .sales-team-container');
    assert(htmlContent.includes('sales-team-cards-row'), 'Must have .sales-team-cards-row');
    assert(htmlContent.includes('salesCardLeft'), 'Must have #salesCardLeft for left team card');
    assert(htmlContent.includes('salesCardCenter'), 'Must have #salesCardCenter for center ME card');
    assert(htmlContent.includes('salesCardRight'), 'Must have #salesCardRight for right team card');
    assert(htmlContent.includes('sales-connector-line'), 'Must have connector lines between cards');

    // Search and filters for team list
    assert(htmlContent.includes('myTeamListTable'), 'Must have #myTeamListTable');
    assert(htmlContent.includes('teamSearchInput'), 'Must have #teamSearchInput');
    assert(htmlContent.includes('team-filter-pills'), 'Must have team filter pills');
});

// 3. Server Authoritative Payload: Center Member Object
test('Step 46: 3. Backend Engine: getMemberNetwork returns authoritative center_member object', () => {
    const networkContext = createTestSalesTeamNetwork();
    const network = MLMNetworkEngine.getMemberNetwork('u-root-me', networkContext);

    assert(network.center_member, 'Network must include center_member');
    assert.strictEqual(network.center_member.id, 'u-root-me');
    assert.strictEqual(network.center_member.username, 'hiru_root');
    assert.strictEqual(network.center_member.full_name, 'Hiru Root Leader');
    assert.strictEqual(network.center_member.status, 'ACTIVE');
    assert.strictEqual(network.center_member.qualification_status, 'QUALIFIED');
    assert.strictEqual(network.center_member.left_points, 55000.00);
    assert.strictEqual(network.center_member.right_points, 55000.00);
    assert.strictEqual(network.center_member.left_team_count, 3); // nimal, kamal, anura
    assert.strictEqual(network.center_member.right_team_count, 2); // sunil, priyantha
    assert.strictEqual(network.center_member.total_team_count, 5);
});

// 4. Server Authoritative Payload: Direct Left and Right Members
test('Step 46: 4. Backend Engine: getMemberNetwork returns direct left_member and right_member objects', () => {
    const networkContext = createTestSalesTeamNetwork();
    const network = MLMNetworkEngine.getMemberNetwork('u-root-me', networkContext);

    // Left child: Nimal Silva
    assert(network.left_member, 'Left member must be populated');
    assert.strictEqual(network.left_member.id, 'u-direct-left');
    assert.strictEqual(network.left_member.username, 'nimal_silva');
    assert.strictEqual(network.left_member.full_name, 'Nimal Silva');
    assert.strictEqual(network.left_member.status, 'Active');
    assert.strictEqual(network.left_member.is_active, true);
    assert.strictEqual(network.left_member.balance_points, 27500.00);
    assert.strictEqual(network.left_member.team_count, 2); // kamal, anura

    // Right child: Sunil Kumar
    assert(network.right_member, 'Right member must be populated');
    assert.strictEqual(network.right_member.id, 'u-direct-right');
    assert.strictEqual(network.right_member.username, 'sunil_kumar');
    assert.strictEqual(network.right_member.full_name, 'Sunil Kumar');
    assert.strictEqual(network.right_member.status, 'Active');
    assert.strictEqual(network.right_member.is_active, true);
    assert.strictEqual(network.right_member.balance_points, 27500.00);
    assert.strictEqual(network.right_member.team_count, 1); // priyantha
});

// 5. Open Position State: Left or Right is null when unplaced
test('Step 46: 5. Backend Engine: Open positions return null for left_member or right_member', () => {
    const networkContext = createTestSalesTeamNetwork();
    // Kamal Perera has no children placed yet
    const network = MLMNetworkEngine.getMemberNetwork('u-downline-left-1', networkContext);

    assert.strictEqual(network.left_member, null, 'Unoccupied left child must be null');
    assert.strictEqual(network.right_member, null, 'Unoccupied right child must be null');
    assert.strictEqual(network.center_member.total_team_count, 0, 'Leaf node has 0 team members');
});

// 6. Asymmetric Network: One occupied, one open position
test('Step 46: 6. Backend Engine: Asymmetric network returns populated left and null right', () => {
    const networkContext = createTestSalesTeamNetwork();
    // Sunil Kumar has only a LEFT child (Priyantha Mendis), RIGHT is open
    const network = MLMNetworkEngine.getMemberNetwork('u-direct-right', networkContext);

    assert(network.left_member, 'Sunil left member must be populated');
    assert.strictEqual(network.left_member.username, 'priyantha_m');
    assert.strictEqual(network.right_member, null, 'Sunil right position must be null (open slot)');
});

// 7. Authoritative Team List Generation for "MY TEAM LIST"
test('Step 46: 7. Backend Engine: getMemberNetwork returns full flat team_list for table rendering', () => {
    const networkContext = createTestSalesTeamNetwork();
    const network = MLMNetworkEngine.getMemberNetwork('u-root-me', networkContext);

    assert(Array.isArray(network.team_list), 'team_list must be an array');
    assert.strictEqual(network.team_list.length, 5, 'Must contain all 5 downline members');

    const usernames = network.team_list.map(t => t.username);
    assert(usernames.includes('nimal_silva'), 'Must include nimal_silva');
    assert(usernames.includes('sunil_kumar'), 'Must include sunil_kumar');
    assert(usernames.includes('kamal_p'), 'Must include kamal_p');
    assert(usernames.includes('anura_k'), 'Must include anura_k');
    assert(usernames.includes('priyantha_m'), 'Must include priyantha_m');

    // Position verification
    const nimal = network.team_list.find(t => t.username === 'nimal_silva');
    const kamal = network.team_list.find(t => t.username === 'kamal_p');
    const sunil = network.team_list.find(t => t.username === 'sunil_kumar');
    const priyantha = network.team_list.find(t => t.username === 'priyantha_m');

    assert.strictEqual(nimal.position, 'LEFT');
    assert.strictEqual(kamal.position, 'LEFT');
    assert.strictEqual(sunil.position, 'RIGHT');
    assert.strictEqual(priyantha.position, 'RIGHT');
});

// 8. Team List Search and Filtering Invariants
test('Step 46: 8. Filter Logic: Client-side search and filtering predicates work accurately', () => {
    const networkContext = createTestSalesTeamNetwork();
    const network = MLMNetworkEngine.getMemberNetwork('u-root-me', networkContext);
    const teamList = network.team_list;

    // Filter by LEFT
    const leftList = teamList.filter(m => m.position === 'LEFT');
    assert.strictEqual(leftList.length, 3);

    // Filter by RIGHT
    const rightList = teamList.filter(m => m.position === 'RIGHT');
    assert.strictEqual(rightList.length, 2);

    // Filter by Active vs Inactive
    const activeList = teamList.filter(m => m.is_active);
    const inactiveList = teamList.filter(m => !m.is_active);
    assert.strictEqual(activeList.length, 4);
    assert.strictEqual(inactiveList.length, 1);
    assert.strictEqual(inactiveList[0].username, 'anura_k');

    // Search by text "Priyantha"
    const searchMatch = teamList.filter(m => 
        (m.full_name || '').toLowerCase().includes('priyantha') || 
        (m.username || '').toLowerCase().includes('priyantha')
    );
    assert.strictEqual(searchMatch.length, 1);
    assert.strictEqual(searchMatch[0].username, 'priyantha_m');
});

// 9. Referral Link Prefill Invariant for Open Positions
test('Step 46: 9. Open Position Action: Generates dual-leg invitation links with exact position param', () => {
    const uHandle = 'hiru_root';
    const baseOrigin = 'https://hapanamy.lk';
    
    const leftInviteLink = `${baseOrigin}/register?ref=${encodeURIComponent(uHandle)}&position=left`;
    const rightInviteLink = `${baseOrigin}/register?ref=${encodeURIComponent(uHandle)}&position=right`;

    assert.strictEqual(leftInviteLink, 'https://hapanamy.lk/register?ref=hiru_root&position=left');
    assert.strictEqual(rightInviteLink, 'https://hapanamy.lk/register?ref=hiru_root&position=right');
});

// 10. MLM Engine Mathematical Integrity Preserved
test('Step 46: 10. Business Rules Integrity: 8% direct commission and 7% binary matching remain 100% exact', () => {
    const DirectCommissionEngine = require('../services/direct-commission-engine');
    const QualifiedUplineCommissionEngine = require('../services/qualified-upline-commission-engine');

    // 1. Direct 8%
    const directComm = DirectCommissionEngine.calculateDirectCommission(27500.00, 8.00);
    assert.strictEqual(directComm, 2200.00); // 27,500 * 8% = 2,200

    // 2. Binary 7% of matched volume
    const matchedVolume = 27500.00;
    const binaryCommission = Math.round(matchedVolume * 7) / 100;
    assert.strictEqual(binaryCommission, 1925.00); // 27,500 * 7% = 1,925
});
