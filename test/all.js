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
require('./registration-qualification.test');
require('./step13-binary-placement.test');
require('./step14-referral-engine.test');
require('./step15-member-registration.test');
require('./step16-qualification-engine.test');
require('./step17-binary-volume.test');
require('./step18-direct-commission.test');
require('./step19-qualified-upline-commission.test');
require('./step20-earnings-cap.test');
require('./step21-wallet-ledger.test');
require('./step22-payment-verification.test');
require('./step23-purchase-orchestrator.test');
require('./step24-withdrawal-system.test');
require('./step25-kyc-verification.test');
require('./step26-member-dashboard.test');
require('./step27-admin-dashboard.test');
require('./step28-reports-analytics.test');
require('./step29-refund-cancellation.test');
require('./step30-commission-volume-reversal.test');
require('./step31-security-fraud.test');
require('./step32-notification-engine.test');
require('./step33-simulation-load-testing.test');
require('./step34-production-readiness.test');
require('./e2e-user-journey.test');
require('./step35-public-auth-foundation.test');
require('./backup-restore.test');
require('./step36-live-login-register-flow.test');
require('./deployment-verification.test');
require('./step37-member-product-purchase-center.test');
require('./step38-final-product-purchase-center-e2e.test');
require('./step39-enterprise-security-hardening.test');

// Run
runTests();

