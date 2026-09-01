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
require('./product-economics.test');
require('./product-validator.test');
require('./safe-binary-calculator.test');
require('./product-firewall.test');
require('./product-snapshot.test');
require('./commission-integration.test');
require('./critical-product-economics.test');
require('./placement.test');
require('./referral.test');

// Run
runTests();
