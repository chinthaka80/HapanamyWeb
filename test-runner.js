// Custom lightweight unit testing framework for Hapanamy MLM software
const fs = require('fs');
const path = require('path');

const tests = [];
const beforeHooks = [];

function test(description, fn) {
    tests.push({ description, fn });
}

function before(fn) {
    beforeHooks.push(fn);
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

assert.equal = function(val1, val2, message) {
    if (val1 !== val2) {
        throw new Error(`${message || 'Assertion failed'}: expected ${val2} but got ${val1}`);
    }
};

assert.closeTo = function(val1, val2, maxDiff = 0.0001, message) {
    if (Math.abs(val1 - val2) > maxDiff) {
        throw new Error(`${message || 'Assertion failed'}: value ${val1} is not close to ${val2} within margin ${maxDiff}`);
    }
};

assert.throws = function(fn, regex, message) {
    let threw = false;
    let thrownErr = null;
    try {
        fn();
    } catch (err) {
        threw = true;
        thrownErr = err;
    }
    if (!threw) {
        throw new Error(message || 'Expected function to throw an error, but it did not.');
    }
    if (regex && thrownErr) {
        const str = thrownErr.message || String(thrownErr);
        if (!regex.test(str)) {
            throw new Error(`Expected error message matching ${regex}, but got: "${str}"`);
        }
    }
};

async function runTests() {
    console.log('\n🏃 Running Hapanamy MLM Unit Tests...\n');
    let passed = 0;
    let failed = 0;

    for (const hook of beforeHooks) {
        await hook();
    }

    for (const t of tests) {
        try {
            await t.fn();
            console.log(`✅ PASSED: ${t.description}`);
            passed++;
        } catch (err) {
            console.error(`❌ FAILED: ${t.description}`);
            console.error(err.stack || err);
            failed++;
        }
    }

    console.log(`\n📊 Test Execution Results: ${passed} passed, ${failed} failed.\n`);
    if (failed > 0) {
        process.exit(1);
    }
}

// Global exposure for test script files
global.test = test;
global.before = before;
global.assert = assert;
global.runTests = runTests;

// Auto-run if executed directly
if (require.main === module) {
    // Basic test to verify runner works
    test('Runner Integrity Check', () => {
        assert(true);
        assert.equal(1 + 1, 2);
    });

    runTests();
}
