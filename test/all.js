// Master test execution runner for Hapanamy MLM platform
require('./test-runner');

// Load test suites
require('./commission.test');
require('./database.test');
require('./auth.test');
require('./kyc.test');
require('./products.test');
require('./binary.test');
require('./wallet.test');
require('./report.test');
require('./refund.test');
require('./security.test');
require('./integration.test');
require('./database-economics.test');

// Run
runTests();
