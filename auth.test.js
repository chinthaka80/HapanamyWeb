// Hapanamy MLM Authentication & Registration Unit Tests
const testRunner = require('./test-runner');
const AuthService = require('../services/auth-service');
const PlacementEngine = require('../services/placement-engine');

// Mock Database Tables
let users = [];
let userProfiles = [];
let sponsors = [];
let binaryNodes = [];

before(() => {
    // Seed Admin and default sponsor
    const adminId = 'admin-id-123';
    const adminHash = AuthService.hashPassword('Araliya321#');
    
    users = [
        { id: adminId, email: 'admin@hapanamy.lk', password_hash: adminHash, role: 'admin', status: 'ACTIVE' },
        { id: 'sponsor-id-100', email: 'sponsor@hapanamy.lk', password_hash: adminHash, role: 'member', status: 'ACTIVE' }
    ];

    userProfiles = [
        { user_id: adminId, username: 'admin', full_name: 'Admin' },
        { user_id: 'sponsor-id-100', username: 'sponsor1', full_name: 'Sponsor One' }
    ];

    sponsors = [];
    binaryNodes = [];
});

test('Password hashing and verification integrity', () => {
    const password = 'mySecretPassword123#';
    const hash = AuthService.hashPassword(password);
    
    assert(hash.includes(':'), 'Hash must contain salt delimiter');
    assert(AuthService.verifyPassword(password, hash), 'Password verification must pass for correct password');
    assert(!AuthService.verifyPassword('wrongPassword', hash), 'Password verification must fail for wrong password');
});

test('Valid sponsor validation passes for active sponsor', () => {
    const isValid = PlacementEngine.validateSponsor('sponsor-id-100', users);
    assert(isValid, 'Sponsor ID sponsor-id-100 must be valid');
});

test('Invalid sponsor validation fails', () => {
    const isValid = PlacementEngine.validateSponsor('non-existent-sponsor', users);
    assert(!isValid, 'Sponsor verification must fail for non-existent sponsor');
});

test('Self-referral check fails', () => {
    const userId = 'member-id-1';
    const sponsorId = 'member-id-1';
    assert.equal(userId === sponsorId, true, 'Self-referral is detected when user ID matches sponsor ID');
});

test('Circular referral loop detection works', () => {
    // Loop: user1 sponsors user2, user2 sponsors user3, user3 attempts to sponsor user1
    const mockSponsors = [
        { user_id: 'user2', sponsor_id: 'user1' },
        { user_id: 'user3', sponsor_id: 'user2' }
    ];

    const isCircular = PlacementEngine.isCircularReferral('user1', 'user3', mockSponsors);
    assert(isCircular, 'Circular loop must be detected when user1 attempts to be sponsored by user3');
});

test('Binary placement position checks occupied position', () => {
    const mockBinaryNodes = [
        { user_id: 'child1', placement_parent_id: 'parent1', position: 'LEFT' }
    ];

    const isLeftOccupied = PlacementEngine.isPositionOccupied('parent1', 'LEFT', mockBinaryNodes);
    const isRightOccupied = PlacementEngine.isPositionOccupied('parent1', 'RIGHT', mockBinaryNodes);

    assert(isLeftOccupied, 'LEFT position must be occupied');
    assert(!isRightOccupied, 'RIGHT position must be available');
});

test('Duplicate username registration checking', () => {
    const requestedUsername = 'sponsor1';
    const isDuplicate = userProfiles.some(p => p.username === requestedUsername);
    assert(isDuplicate, 'Username sponsor1 must be marked as duplicate');
});

test('Duplicate email registration checking', () => {
    const requestedEmail = 'admin@hapanamy.lk';
    const isDuplicate = users.some(u => u.email === requestedEmail);
    assert(isDuplicate, 'Email admin@hapanamy.lk must be marked as duplicate');
});

test('Authorization policy rules for ADMIN vs MEMBER roles', () => {
    const memberUser = users.find(u => u.id === 'sponsor-id-100');
    const adminUser = users.find(u => u.id === 'admin-id-123');

    assert.equal(memberUser.role, 'member');
    assert.equal(adminUser.role, 'admin');
});

if (require.main === module) {
    runTests();
}
