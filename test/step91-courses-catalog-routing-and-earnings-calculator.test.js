// test/step91-courses-catalog-routing-and-earnings-calculator.test.js
// Verification for Courses Catalog Query Routing, Category Filters, and Earnings Calculator Math & Mirror Parity

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test } = require('./test-runner');

const rootDir = path.resolve(__dirname, '..');

test('Step 91: 1. courses.html and HapanamyWeb/courses.html support query param category, search, and modal triggers', () => {
    const courseFiles = ['courses.html', 'HapanamyWeb/courses.html'];

    for (const file of courseFiles) {
        const filePath = path.join(rootDir, file);
        assert.ok(fs.existsSync(filePath), `${file} must exist`);
        const content = fs.readFileSync(filePath, 'utf8');

        // Check query parameter handling
        assert.ok(content.includes("urlParams.get('category')"), `${file} must check category query param`);
        assert.ok(content.includes("urlParams.get('cat')"), `${file} must check cat query param`);
        assert.ok(content.includes("urlParams.get('search')"), `${file} must check search query param`);
        assert.ok(content.includes("urlParams.get('modal')"), `${file} must check modal query param`);
        assert.ok(content.includes("urlParams.get('product')"), `${file} must check product query param`);

        // Check nav-auth.js inclusion
        assert.ok(content.includes('<script src="nav-auth.js"></script>'), `${file} must include nav-auth.js`);
    }
});

test('Step 91: 2. earnings-calculator.html enforces exact MLM math (8% Direct, 7% Binary, Carry-Forward, Rs. 30,000 Daily Cap)', () => {
    const calcFiles = ['earnings-calculator.html', 'HapanamyWeb/earnings-calculator.html'];

    for (const file of calcFiles) {
        const filePath = path.join(rootDir, file);
        assert.ok(fs.existsSync(filePath), `${file} must exist`);
        const content = fs.readFileSync(filePath, 'utf8');

        // Extract updateCalculator function code
        const fnMatch = content.match(/function updateCalculator\(\)[\s\S]*?^ {8}\}/m);
        assert.ok(fnMatch, `${file} must define updateCalculator()`);
        const fnCode = fnMatch[0];

        // Test math scenarios
        const runCalc = (price, directs, leftUnits, rightUnits) => {
            const elements = {
                rngPrice: { value: String(price) },
                rngDirect: { value: String(directs) },
                rngLeft: { value: String(leftUnits) },
                rngRight: { value: String(rightUnits) },
                lblCoursePrice: { textContent: '' },
                lblDirectSales: { textContent: '' },
                lblLeftSales: { textContent: '' },
                lblRightSales: { textContent: '' },
                resDirect: { textContent: '' },
                resMatchedBV: { textContent: '' },
                resBinary: { textContent: '' },
                resCarry: { textContent: '' },
                resTotal: { textContent: '' }
            };

            const context = {
                document: {
                    getElementById: (id) => elements[id] || { textContent: '', value: '' }
                },
                Number: Number,
                Math: Math
            };

            vm.runInNewContext(`(${fnCode})()`, context);

            return {
                directText: elements.resDirect.textContent,
                matchedBVText: elements.resMatchedBV.textContent,
                binaryText: elements.resBinary.textContent,
                carryText: elements.resCarry.textContent,
                totalText: elements.resTotal.textContent
            };
        };

        // Scenario A: Standard Base (7425 LKR, 4 directs, 10 Left, 8 Right)
        const resA = runCalc(7425, 4, 10, 8);
        assert.strictEqual(resA.directText, 'රු. 2,376.00', 'Direct comm must be 4 * 7425 * 0.08 = 2376');
        assert.strictEqual(resA.matchedBVText, '59,400 BV', 'Matched BV must be 8 * 7425 = 59400');
        assert.strictEqual(resA.binaryText, 'රු. 4,158.00', 'Binary comm must be 59400 * 0.07 = 4158');
        assert.strictEqual(resA.carryText, '14,850 BV', 'Carry BV must be (10 - 8) * 7425 = 14850');
        assert.strictEqual(resA.totalText, 'රු. 6,534.00', 'Total must be 2376 + 4158 = 6534');

        // Scenario B: High Volume with Daily Cap (19900 LKR, 20 directs, 50 Left, 50 Right)
        const resB = runCalc(19900, 20, 50, 50);
        // Direct: 20 * 19900 * 0.08 = 31840
        // Matched: 50 * 19900 = 995000 BV -> Binary: 69650
        // Uncapped total: 31840 + 69650 = 101490 -> Capped at 30000
        assert.strictEqual(resB.carryText, '0 BV');
        assert.strictEqual(resB.totalText, 'රු. 30,000.00', 'Total must cap at Rs. 30,000.00');

        // Scenario C: Zero Volume
        const resC = runCalc(7425, 0, 0, 0);
        assert.strictEqual(resC.directText, 'රු. 0.00');
        assert.strictEqual(resC.matchedBVText, '0 BV');
        assert.strictEqual(resC.binaryText, 'රු. 0.00');
        assert.strictEqual(resC.carryText, '0 BV');
        assert.strictEqual(resC.totalText, 'රු. 0.00');
    }
});

test('Step 91: 3. Mirror parity between root and HapanamyWeb/ across catalog and calculator files', () => {
    const pairs = [
        ['courses.html', 'HapanamyWeb/courses.html'],
        ['earnings-calculator.html', 'HapanamyWeb/earnings-calculator.html']
    ];

    for (const [f1, f2] of pairs) {
        const path1 = path.join(rootDir, f1);
        const path2 = path.join(rootDir, f2);

        assert.ok(fs.existsSync(path1), `${f1} must exist`);
        assert.ok(fs.existsSync(path2), `${f2} must exist`);

        const c1 = fs.readFileSync(path1, 'utf8');
        const c2 = fs.readFileSync(path2, 'utf8');

        assert.ok(c1.length > 0, `${f1} must not be empty`);
        assert.ok(c2.length > 0, `${f2} must not be empty`);
    }
});
