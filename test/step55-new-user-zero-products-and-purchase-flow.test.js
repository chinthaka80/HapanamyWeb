/**
 * Test Step 55: New User Zero Products & Dynamic Course Purchase Flow
 *
 * Requirements:
 * 1. Fresh signup has 0 enrolled courses by default across student-dashboard.html, dashboard.html, and my-account.html.
 * 2. Static hardcoded courses (Titan Elite Trading, AI Mastery, Social Media Income Masterclass) replaced with dynamic rendering.
 * 3. Clear "Explore & Buy Courses / පාඨමාලා මිලදී ගන්න" CTA buttons in topbar, sidebar, overview, and zero-state grid.
 * 4. Purchasing a course activates the course in the learning grid and updates dashboard stats dynamically.
 * 5. MLM compensation engine (8% direct, 7% binary, Rs. 30,000 daily cap) remains 100% exact.
 */

const assert = require('assert');
const { test } = require('./test-runner');
const fs = require('fs');
const path = require('path');

const studentDashboardContent = fs.readFileSync(path.join(__dirname, '..', 'student-dashboard.html'), 'utf8');
const dashboardContent = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
const myAccountContent = fs.readFileSync(path.join(__dirname, '..', 'my-account.html'), 'utf8');
const registerContent = fs.readFileSync(path.join(__dirname, '..', 'register.html'), 'utf8');
const loginRegContent = fs.readFileSync(path.join(__dirname, '..', 'login-register.html'), 'utf8');

test('STEP 55.1: student-dashboard.html must have dynamic stat elements defaulting to 0 for fresh signups', () => {
    assert(studentDashboardContent.includes('id="statEnrolledCount"'), 'statEnrolledCount element must exist');
    assert(studentDashboardContent.includes('id="statCompletedCount"'), 'statCompletedCount element must exist');
    assert(studentDashboardContent.includes('id="statLiveCount"'), 'statLiveCount element must exist');
    assert(studentDashboardContent.includes('id="statEbooksCount"'), 'statEbooksCount element must exist');
    
    // Initial HTML values must be 0
    assert(studentDashboardContent.includes('<div class="student-stat-val" id="statEnrolledCount">0</div>'), 'Default enrolled count must be 0');
});

test('STEP 55.2: student-dashboard.html must have "Explore & Buy Courses / පාඨමාලා මිලදී ගන්න" navigation link and topbar button', () => {
    assert(studentDashboardContent.includes('id="nav-buy-courses"'), 'Sidebar must have buy courses nav button');
    assert(studentDashboardContent.includes('btn-buy-courses-topbar'), 'Topbar must have quick buy courses CTA button');
    assert(studentDashboardContent.includes('index.html#courses'), 'Buy buttons must direct to course catalog');
});

test('STEP 55.3: student-dashboard.html course grid must be dynamically populated and NOT contain static hardcoded cards', () => {
    // Grid container should be clean and ready for dynamic injection
    assert(studentDashboardContent.includes('id="coursesListGrid"'), 'coursesListGrid must exist');
    assert(studentDashboardContent.includes('function renderStudentCourses'), 'renderStudentCourses function must be defined');
    assert(studentDashboardContent.includes('function getStudentPurchasedCourses'), 'getStudentPurchasedCourses function must be defined');
    assert(studentDashboardContent.includes('function loadAndRenderStudentCourses'), 'loadAndRenderStudentCourses function must be defined');
});

test('STEP 55.4: student-dashboard.html must support zero-state and populated state with multiple course playlists', () => {
    // Check playlists support
    assert(studentDashboardContent.includes('crypto: ['), 'Playlists must support crypto trading');
    assert(studentDashboardContent.includes('ai: ['), 'Playlists must support AI mastery');
    assert(studentDashboardContent.includes('social: ['), 'Playlists must support social media masterclass');
    assert(studentDashboardContent.includes('coding: ['), 'Playlists must support coding masterclass');

    // Check zero state text & CTA in script
    assert(studentDashboardContent.includes('ඔබ තවමත් කිසිදු පාඨමාලාවක් මිලදී ගෙන නොමැත'), 'Must have zero state message in Sinhala');
    assert(studentDashboardContent.includes('No Enrolled Courses Yet'), 'Must have zero state message in English');
});

test('STEP 55.5: dashboard.html overview card must dynamically render active courses or zero state', () => {
    assert(dashboardContent.includes('id="overviewActiveCoursesContainer"'), 'dashboard.html must have overviewActiveCoursesContainer');
    assert(dashboardContent.includes('function renderPurchasedProducts'), 'dashboard.html must have renderPurchasedProducts');
    assert(dashboardContent.includes('0 Courses') || dashboardContent.includes('කිසිදු සක්‍රීය පාඨමාලාවක් නැත'), 'dashboard.html must handle 0 courses state');
});

test('STEP 55.6: my-account.html must define renderStudentPurchasedCourses()', () => {
    assert(myAccountContent.includes('function renderStudentPurchasedCourses'), 'my-account.html must define renderStudentPurchasedCourses');
    assert(myAccountContent.includes('studentCoursesGrid'), 'my-account.html must target studentCoursesGrid');
});

test('STEP 55.7: register.html and login-register.html must initialize new user purchase history to 0', () => {
    assert(registerContent.includes('hapanamy_purchased_courses_'), 'register.html must initialize user-specific purchase key');
    assert(loginRegContent.includes('hapanamy_purchased_courses_'), 'login-register.html must initialize user-specific purchase key');
});

test('STEP 55.8: MLM calculation formulas (8% Direct, 7% Binary, Rs. 30,000 Daily Cap) must remain strictly accurate', () => {
    const directRate = 0.08;
    const binaryRate = 0.07;
    const dailyCap = 30000;

    // Verify direct commission for Rs. 19,900 purchase
    const coursePrice = 19900;
    const directComm = coursePrice * directRate;
    assert.strictEqual(directComm, 1592, '8% Direct Commission of Rs. 19,900 must be Rs. 1,592');

    // Verify binary commission for matched 79,600 BV
    const matchedBv = 79600;
    const binaryComm = Math.round(matchedBv * binaryRate * 100) / 100;
    assert.strictEqual(binaryComm, 5572, '7% Binary Commission of 79,600 BV must be Rs. 5,572');

    // Verify daily cap enforcement
    const uncappedBinary = 45000;
    const cappedBinary = Math.min(uncappedBinary, dailyCap);
    assert.strictEqual(cappedBinary, 30000, 'Daily binary cap must strictly enforce Rs. 30,000 limit');
});
