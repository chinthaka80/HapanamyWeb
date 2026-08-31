// Master test execution runner for Hapanamy MLM platform
require('./test-runner');

// Load test suites
require('./commission.test');
require('./database.test');

// Run
runTests();
