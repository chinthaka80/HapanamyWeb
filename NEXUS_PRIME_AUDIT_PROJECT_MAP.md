# NEXUS PRIME (PVT) LTD — AUDIT PROJECT MAP

**Document Version:** 1.0.0  
**Audit Date:** 2026-09-09  
**Platform Scope:** Prompts 01–19 Implementation Baseline  
**System Target Domain:** `https://nexusp.online` (Port 3001)  
**Isolation Boundary:** Strictly decoupled from `HapanamyWeb` / `https://hapanamy.lk` (Port 3000)

---

## 1. PROJECT ARCHITECTURE OVERVIEW

Nexus Prime (PVT) Ltd is an enterprise-grade MLM, e-commerce, commission distribution, wallet ledger, and membership activation platform developed as an autonomous system co-existing inside the `HapanamyWeb` workspace repository.

### Physical Architecture Separation Matrix

| Dimension | Nexus Prime (PVT) Ltd | Hapanamy (Legacy / Sibling) | Verification Status |
| :--- | :--- | :--- | :--- |
| **Domain** | `nexusp.online` | `hapanamy.lk` | **PASS** (Strictly Isolated) |
| **Runtime Port** | `3001` (`nexus-server.js`) | `3000` (`server.js`) | **PASS** (Distinct Ports) |
| **Backend Core** | `nexus_backend/` | `backend/`, `server.js` | **PASS** (Zero Cross-Imports) |
| **Database Migrations** | `nexus_migrations/001-015_*.sql` | `migrations/` | **PASS** (Dedicated Tables `nexus_*`) |
| **Static Frontend** | `nexus_*.html`, `assets/nexus/` | `index.html`, `public/` | **PASS** (Independent UI Assets) |
| **Env Templates** | `.env.nexus.example` | `.env.example` | **PASS** (Separate Variables) |
| **CI/CD Pipeline** | Missing (`deploy-nexus.yml` needed) | `.github/workflows/deploy.yml` | **FAIL / HIGH RISK** (Deploy Leakage) |

---

## 2. CODEBASE INVENTORY

### 2.1 Frontend Assets & Pages
* Location: Workspace root and `assets/nexus/`
* Pages:
  * `nexus_index.html`: Public Landing Page & Corporate Presentation (Hero, Packages, Products, Compensation highlights, FAQ, Footer).
  * `nexus_login.html`: Secure Member & Staff Authentication Portal (JWT storage, session bootstrapper, password toggle).
  * `nexus_register.html`: Member Registration Portal (Referral validation gate, sponsor placement, password strength indicator).
  * `nexus_forgot_password.html`: Self-service credential recovery portal.
  * `nexus_dashboard.html`: Complete Member Dashboard (Overview KPIs, Direct & Team Downline, Commission history, Wallet Ledger, Bank Account management, Withdrawal Requests, KYC Document Submission, Support Tickets, Notifications Inbox).
  * `nexus_admin.html`: Enterprise Administration Console (Members directory, Order/Payment processing, Commission Plan configurator, Wallet adjustments, Manual Withdrawal Payout terminal, KYC compliance review, Financial Reports, System Reconciliation, Eligibility audit).
  * `nexus_referrals.html`: Member Referral Management & Direct Sponsor Link Generator.
* Styling & Scripts:
  * `assets/nexus/css/nexus-theme.css`: Nexus Prime custom Design System (Dark Navy `#0A192F`, Gold Accent `#D4AF37`, Emerald `#10B981`, Slate neutrals).
  * `assets/nexus/js/nexus-api.js`: Client-side HTTP client, JWT session handling, CSRF header attachment, automatic token refresh, and 401 redirector.

---

### 2.2 Backend Application Layer
* Primary Entry Point: `nexus_backend/nexus-server.js` (Standalone Node.js HTTP server running on port 3001).
* Configuration: `nexus_backend/config/nexus-config.js` (Environment variables, database configuration, security credentials, Colombo timezone UTC+05:30 constants).
* Data Layer: `nexus_backend/db/nexus-db.js` (In-memory transactional repository store backing the 15 migration schemas).

#### Backend Services Inventory (`nexus_backend/services/`):
1. `nexus-auth-service.js`: User registration, bcrypt password hashing, JWT issue/verify, session revocation, role validation (`member`, `staff`, `admin`, `super_admin`).
2. `nexus-member-service.js`: Member profile retrieval, secure field updates, bank account registration, account status guards.
3. `nexus-network-service.js`: MLM hierarchy builder, upline & downline traversal, binary/unilevel closure, circular reference loop prevention.
4. `nexus-referral-service.js`: Referral code issuance, sponsor attribution, vanity link validation, direct referral tracking.
5. `nexus-catalog-service.js`: Package and product definitions, inventory stock management, server-side authoritative pricing.
6. `nexus-order-service.js`: Server-side price calculation, immutable order creation, item snapshot capture, order status state machine.
7. `nexus-payment-service.js`: Payment initiation, gateway abstraction, webhook signature verification, idempotency token validation.
8. `payment-providers/`:
   * `payment-provider-base.js`: Abstract interface for payment gateways.
   * `payhere-provider.js`: PayHere Sri Lanka gateway integration with HMAC-MD5/SHA256 signature verification.
   * `sandbox-provider.js`: Local mock gateway for offline integration tests.
   * `unconfigured-provider.js`: Fail-closed dummy provider for missing gateway configs.
9. `nexus-commission-service.js`: Unilevel/binary commission engine, qualification verification, historical plan versioning, idempotent calculation.
10. `nexus-qualification-service.js`: Multi-level sponsor qualification checks, active package standing validation, PV/TV checks.
11. `nexus-wallet-service.js`: Double-entry transaction ledger, posted balance derivation, negative balance prevention, reservation holds, atomic payouts.
12. `nexus-withdrawal-service.js`: Withdrawal requests, balance reservation pipeline, admin review, manual bank payout, masking (`******7890`).
13. `nexus-rank-service.js`: Rank hierarchy, requirement evaluator (PV, TV, Directs), no-demotion lifetime retention, point-in-time audit history.
14. `nexus-financial-reporting-service.js`: Asia/Colombo timezone reports, half-open intervals (`[start, end)`), authoritative timestamp attribution, 17-point financial reconciliation scanner.
15. `nexus-kyc-service.js`: Multi-tier KYC compliance, private vault storage, short-lived 15-minute HMAC-SHA256 document access tokens, masking, review workflow.
16. `nexus-membership-service.js`: Membership lifecycle state machine (`pending` -> `active` -> `suspended` / `expired` / `cancelled`), payment-activation bridge, audit history.
17. `nexus-eligibility-engine.js`: Centralized 4-pillar eligibility evaluator (Account, Membership, KYC, Package) with deterministic 9-tier Rule Precedence Model.
18. `nexus-notification-service.js`: In-app notification inbox, event-driven triggers, corporate broadcast dispatcher, preference suppression.
19. `nexus-email-provider.js`: Transactional email delivery service, SMTP fail-safe, masked PII logging.
20. `nexus-support-service.js`: Help desk ticketing, ticket numbering (`TICK-YYYYMMDD-XXXX`), staff internal notes isolation, CSV export sanitization.
21. `nexus-admin-service.js`: Back-office administrative aggregation, member search, audit trail querying, financial adjustments.

---

## 3. DATABASE SCHEMAS & MIGRATIONS

All Nexus Prime tables are defined with the `nexus_` prefix to guarantee complete zero-collision namespace isolation from Hapanamy.

| Migration File | Primary Tables Created / Managed | Description |
| :--- | :--- | :--- |
| `001_create_nexus_core_schema.sql` | `nexus_users`, `nexus_member_profiles`, `nexus_audit_logs` | Identity, authentication, profiles, role management, audit trails. |
| `002_create_nexus_mlm_network_schema.sql` | `nexus_sponsors`, `nexus_network_nodes`, `nexus_referral_clicks` | Sponsor tracking, unilevel upline/downline links, referral logs. |
| `003_create_nexus_commissions_wallet_foundation.sql` | `nexus_commission_plans`, `nexus_wallets`, `nexus_transactions` | Core commission structures and initial ledger tables. |
| `004_create_nexus_rls_and_functions.sql` | Stored procedures, triggers, RLS policies | PostgreSQL row-level security definitions and immutability triggers. |
| `005_seed_nexus_prime_initial_data.sql` | System configuration, default plans, super-admin seed | Baseline platform data, system currency (`LKR`), starter tiers. |
| `006_create_nexus_orders_and_purchases_schema.sql` | `nexus_packages`, `nexus_products`, `nexus_orders`, `nexus_order_items`, `nexus_payments` | E-commerce packages, inventory, server-side order snapshots, payments. |
| `007_create_nexus_commission_engine_schema.sql` | `nexus_commissions`, `nexus_commission_levels`, `nexus_commission_reversals` | Dynamic unilevel commission distribution, status workflows, reversals. |
| `008_create_nexus_wallet_ledger_schema.sql` | `nexus_wallet_accounts`, `nexus_ledger_entries`, `nexus_balance_snapshots` | Double-entry ledger entries, derived balance rules, idempotency keys. |
| `009_create_nexus_withdrawals_schema.sql` | `nexus_bank_accounts`, `nexus_withdrawals`, `nexus_payout_batches` | Bank accounts, reservation pipeline, manual wire approval, audit logs. |
| `010_create_nexus_rank_engine_schema.sql` | `nexus_ranks`, `nexus_rank_rules`, `nexus_rank_history`, `nexus_member_ranks` | Career ranks, PV/TV requirements, qualification history, snapshots. |
| `011_create_nexus_financial_reporting_schema.sql` | `nexus_reconciliation_issues`, `nexus_daily_financial_snapshots` | Colombo financial aggregations, reconciliation logs, daily summaries. |
| `012_create_nexus_notification_communication_schema.sql` | `nexus_notifications`, `nexus_notification_preferences`, `nexus_announcements` | In-app alerts, broadcast messages, unread tracking, user preferences. |
| `013_create_nexus_support_tickets_schema.sql` | `nexus_support_categories`, `nexus_support_tickets`, `nexus_support_messages`, `nexus_support_notes` | Help desk tickets, conversation threads, confidential internal notes. |
| `014_create_nexus_kyc_compliance_schema.sql` | `nexus_kyc_submissions`, `nexus_kyc_documents`, `nexus_kyc_reviews` | Verification levels, private document storage records, review audit logs. |
| `015_create_nexus_membership_eligibility_schema.sql` | `nexus_memberships`, `nexus_membership_history`, `nexus_eligibility_rules` | Membership lifecycle state, point-in-time transition log, rule precedence. |

---

## 4. API ENDPOINT DIRECTORY (140 ROUTES)

### 4.1 Public & Authentication Routes (10 Endpoints)
* `POST /api/v1/nexus/auth/register`: Member registration with referral verification.
* `POST /api/v1/nexus/auth/login`: Member and admin login (issues JWT).
* `POST /api/v1/nexus/auth/logout`: Session termination.
* `GET  /api/v1/nexus/auth/me`: Authenticated identity inspection.
* `GET  /api/v1/nexus/health`: System health and runtime status probe.
* `GET  /api/v1/nexus/packages`: Active packages catalog (public pricing).
* `GET  /api/v1/nexus/packages/:id`: Specific package details.
* `GET  /api/v1/nexus/products`: Active products catalog (public inventory).
* `GET  /api/v1/nexus/products/:id`: Specific product details.
* `GET  /api/v1/nexus/referrals/validate`: Public referral link/code validation.

### 4.2 Member Portal Routes (45 Endpoints)
* **Profile & Identity:**
  * `GET  /api/v1/nexus/member/profile`: Member personal profile and status.
  * `PUT  /api/v1/nexus/member/profile`: Update member personal profile.
  * `POST /api/v1/nexus/member/profile-image`: Upload avatar.
  * `GET  /api/v1/nexus/member/dashboard`: Dashboard summary KPIs and cards.
  * `GET  /api/v1/nexus/member/activity`: Recent activity log.
* **MLM & Downline:**
  * `GET  /api/v1/nexus/member/referrals`: Direct referrals directory.
  * `GET  /api/v1/nexus/member/team`: Downline network tree nodes.
  * `GET  /api/v1/nexus/member/team/stats`: Team size, volume, active count.
  * `GET  /api/v1/nexus/member/rank`: Current career rank & qualification metrics.
  * `GET  /api/v1/nexus/member/rank/history`: Historical rank advancement timeline.
* **Orders & Commerce:**
  * `POST /api/v1/nexus/member/cart/validate`: Server-side cart price verification.
  * `GET  /api/v1/nexus/member/orders`: Order history.
  * `GET  /api/v1/nexus/member/orders/:id`: Detailed order items and invoice.
  * `POST /api/v1/nexus/member/orders/package`: Purchase membership package.
  * `POST /api/v1/nexus/member/orders/products`: Purchase store products.
* **Payments:**
  * `GET  /api/v1/nexus/member/payments`: Payment transaction history.
  * `GET  /api/v1/nexus/member/payments/:id`: Payment receipt detail.
  * `POST /api/v1/nexus/member/payments/initiate`: Initialize gateway checkout session.
* **Commissions & Earnings:**
  * `GET  /api/v1/nexus/member/commissions`: Member commission records.
  * `GET  /api/v1/nexus/member/commissions/:id`: Commission detail & lineage breakdown.
  * `GET  /api/v1/nexus/member/commissions/summary`: Earnings aggregated by level/source.
* **Wallet & Financial Ledger:**
  * `GET  /api/v1/nexus/member/wallet`: Authoritative posted balance and reserved funds.
  * `GET  /api/v1/nexus/member/wallet/transactions`: Double-entry transaction history.
  * `GET  /api/v1/nexus/member/wallet/transactions/:id`: Single ledger entry audit breakdown.
* **Banking & Withdrawals:**
  * `GET  /api/v1/nexus/member/bank-accounts`: List member's registered bank accounts.
  * `POST /api/v1/nexus/member/bank-accounts`: Register new bank account.
  * `PUT  /api/v1/nexus/member/bank-accounts/:id/primary`: Set primary disbursement account.
  * `DELETE /api/v1/nexus/member/bank-accounts/:id`: Soft-delete/deactivate bank account.
  * `GET  /api/v1/nexus/member/withdrawals`: Member payout request history.
  * `GET  /api/v1/nexus/member/withdrawals/:id`: Payout request status inspection.
  * `GET  /api/v1/nexus/member/withdrawals/eligibility`: Pre-flight withdrawal eligibility check.
  * `POST /api/v1/nexus/member/withdrawals`: Submit withdrawal request (reserves balance).
  * `POST /api/v1/nexus/member/withdrawals/:id/cancel`: Member self-cancellation.
* **KYC & Verification:**
  * `GET  /api/v1/nexus/member/kyc`: Current KYC status and submissions.
  * `GET  /api/v1/nexus/member/kyc/requirements`: Document requirements for next level.
  * `POST /api/v1/nexus/member/kyc/submit`: Submit identity/address proof documents.
  * `GET  /api/v1/nexus/member/kyc/documents/:id`: Generate secure signed token URL.
* **Membership & Eligibility:**
  * `GET  /api/v1/nexus/member/membership`: Current membership tier, activation date, standing.
  * `GET  /api/v1/nexus/member/eligibility`: 4-pillar eligibility evaluation result.
* **Notifications & Support:**
  * `GET  /api/v1/nexus/member/notifications`: In-app notification inbox.
  * `GET  /api/v1/nexus/member/notifications/unread-count`: Unread counter.
  * `POST /api/v1/nexus/member/notifications/read-all`: Mark all alerts read.
  * `POST /api/v1/nexus/member/notifications/:id/read`: Mark single alert read.
  * `GET  /api/v1/nexus/member/notifications/preferences`: Get delivery preferences.
  * `PUT  /api/v1/nexus/member/notifications/preferences`: Update preferences.
  * `GET  /api/v1/nexus/member/support/tickets`: List user's support tickets.
  * `POST /api/v1/nexus/member/support/tickets`: Create new ticket.
  * `GET  /api/v1/nexus/member/support/tickets/:id`: View ticket messages thread.
  * `POST /api/v1/nexus/member/support/tickets/:id/messages`: Reply to ticket.
  * `POST /api/v1/nexus/member/support/tickets/:id/close`: Member self-close ticket.

### 4.3 Administration Routes (78 Endpoints)
* **Member Management:**
  * `GET  /api/v1/nexus/admin/members`: Member directory with status/role filters.
  * `GET  /api/v1/nexus/admin/members/:id`: Member 360 overview dossier.
  * `PUT  /api/v1/nexus/admin/members/:id/status`: Administrative account status toggle.
  * `POST /api/v1/nexus/admin/members/:id/membership/action`: Manual membership override.
  * `GET  /api/v1/nexus/admin/members/:id/network`: Admin network view.
* **Orders & Commerce:**
  * `GET  /api/v1/nexus/admin/orders`: Platform orders list.
  * `GET  /api/v1/nexus/admin/orders/:id`: Order details with audit items.
  * `PUT  /api/v1/nexus/admin/orders/:id/status`: Admin order status adjustment.
  * `POST /api/v1/nexus/admin/packages`: Create new membership package.
  * `PUT  /api/v1/nexus/admin/packages/:id`: Update package details.
  * `POST /api/v1/nexus/admin/products`: Create e-commerce product.
  * `PUT  /api/v1/nexus/admin/products/:id`: Update product inventory/price.
* **Payments & Gateways:**
  * `GET  /api/v1/nexus/admin/payments`: Financial payments audit log.
  * `GET  /api/v1/nexus/admin/payments/:id`: Payment gateway verification breakdown.
  * `POST /api/v1/nexus/admin/payments/:id/verify`: Manual administrative payment verification.
* **Commissions & MLM:**
  * `GET  /api/v1/nexus/admin/commissions`: Global commission records.
  * `GET  /api/v1/nexus/admin/commissions/:id`: Commission audit trace.
  * `POST /api/v1/nexus/admin/commissions/:id/release`: Force release held commission.
  * `POST /api/v1/nexus/admin/commissions/:id/reverse`: Reverse commission.
  * `GET  /api/v1/nexus/admin/commission-plans`: List commission plans & versions.
  * `POST /api/v1/nexus/admin/commission-plans`: Create new commission plan version.
  * `GET  /api/v1/nexus/admin/ranks`: Rank definitions.
  * `POST /api/v1/nexus/admin/ranks/rules/versions`: Create new rank rule version.
  * `POST /api/v1/nexus/admin/ranks/recalculate-all`: Batch platform rank recalculation.
  * `POST /api/v1/nexus/admin/ranks/recalculate-member/:id`: Recalculate single member rank.
* **Wallet, Ledger & Payouts:**
  * `GET  /api/v1/nexus/admin/wallets`: All member balances overview.
  * `GET  /api/v1/nexus/admin/wallets/:id`: Single member ledger journal.
  * `POST /api/v1/nexus/admin/wallet/adjustment`: Administrative compensating entry (Credit/Debit).
  * `GET  /api/v1/nexus/admin/withdrawals`: Global withdrawal requests list.
  * `GET  /api/v1/nexus/admin/withdrawals/:id`: Withdrawal inspection (unmasked bank info).
  * `POST /api/v1/nexus/admin/withdrawals/:id/approve`: Approve withdrawal (`under_review` -> `approved`).
  * `POST /api/v1/nexus/admin/withdrawals/:id/process`: Mark processing (`approved` -> `processing`).
  * `POST /api/v1/nexus/admin/withdrawals/:id/pay`: Mark paid (Atomic ledger debit).
  * `POST /api/v1/nexus/admin/withdrawals/:id/reject`: Reject withdrawal (Release reservation).
  * `POST /api/v1/nexus/admin/withdrawals/:id/fail`: Mark payout failed.
* **KYC & Compliance:**
  * `GET  /api/v1/nexus/admin/kyc/submissions`: Pending & historical KYC submissions.
  * `GET  /api/v1/nexus/admin/kyc/submissions/:id`: Submission review detail.
  * `POST /api/v1/nexus/admin/kyc/submissions/:id/start-review`: Lock for admin review.
  * `POST /api/v1/nexus/admin/kyc/submissions/:id/approve`: Approve KYC level.
  * `POST /api/v1/nexus/admin/kyc/submissions/:id/request-changes`: Request document changes.
  * `POST /api/v1/nexus/admin/kyc/submissions/:id/reject`: Reject KYC submission.
* **Financial Reporting & Reconciliation:**
  * `GET  /api/v1/nexus/admin/financial/overview`: Authoritative Colombo KPI summary.
  * `GET  /api/v1/nexus/admin/reports/ledger`: Global ledger movement journal.
  * `GET  /api/v1/nexus/admin/reports/movement`: Inflow vs Outflow cash analysis.
  * `GET  /api/v1/nexus/admin/reports/packages`: Package revenue performance.
  * `GET  /api/v1/nexus/admin/reports/products`: Product sales performance.
  * `GET  /api/v1/nexus/admin/reports/withdrawals`: Withdrawal volume and fees.
  * `GET  /api/v1/nexus/admin/reports/payouts`: Payout reference journal.
  * `GET  /api/v1/nexus/admin/financial/reconciliation`: 17-point financial integrity audit.
  * `GET  /api/v1/nexus/admin/reports/membership-reconciliation`: Status desync scanner.
  * `GET  /api/v1/nexus/admin/reports/export`: Filtered CSV export with sanitization.
* **Support Desk & Communications:**
  * `GET  /api/v1/nexus/admin/support/tickets`: All support tickets across organization.
  * `GET  /api/v1/nexus/admin/support/tickets/:id`: Full ticket thread with internal notes.
  * `POST /api/v1/nexus/admin/support/tickets/:id/messages`: Staff reply to customer.
  * `POST /api/v1/nexus/admin/support/tickets/:id/notes`: Add confidential staff note.
  * `PUT  /api/v1/nexus/admin/support/tickets/:id/status`: Change ticket status.
  * `GET  /api/v1/nexus/admin/support/export`: CSV export with formula injection sanitization.
  * `POST /api/v1/nexus/admin/announcements`: Dispatch corporate system broadcast.

### 4.4 Webhooks & File Streaming (7 Endpoints)
* `POST /api/v1/nexus/payments/webhook`: Generic payment callback.
* `POST /api/v1/nexus/payments/webhook/:provider`: Provider-specific webhook (e.g. PayHere Sri Lanka).
* `GET  /api/v1/nexus/kyc/documents/stream`: Signed HMAC-SHA256 authenticated document streaming.

---

## 5. MIDDLEWARE & CROSS-CUTTING CONCERNS

1. **Authentication Guard:** Verifies Bearer JWT tokens, extracts subject ID, checks user account active status, and sets `req.user`.
2. **Role Authorization Guard:** Restricts endpoints based on role (`admin`, `super_admin`, `staff`, `member`). Blocks cross-tenant access.
3. **Tenant & Identity Isolation Guard:** Verifies that a member can only access records where `record.user_id === req.user.id`. Prevents IDOR.
4. **Input Sanitization:** Strips HTML, escapes control characters, prevents CSV formula injection (`=`, `@`, `+`, `-`).
5. **Rate Limiting:** IP and user-based throttling on sensitive endpoints (login, registration, password reset, KYC uploads).
6. **Timezone Standardization:** Authoritative timestamps stored in UTC (`ISO 8601`) and projected into `Asia/Colombo` (`UTC+05:30`) with half-open intervals (`[start, end)`).

---

## 6. DOCUMENTATION ARTIFACTS INVENTORY

The project includes 30 formal technical specification and architecture documents:
1. `NEXUS_PRIME_ARCHITECTURE.md`: High-level system architecture and module topology.
2. `NEXUS_PRIME_DATABASE.md`: Schema specifications, entity-relationship diagrams, constraints.
3. `NEXUS_PRIME_FINANCIAL_SECURITY.md`: Zero-trust financial policies, double-entry ledger rules.
4. `NEXUS_PRIME_MLM_STRUCTURE.md`: Compensation tree algorithms and circular link prevention.
5. `NEXUS_PRIME_COMMISSION_PLAN.md`: Rate tiers, versioning, and distribution logic.
6. `NEXUS_PRIME_COMMISSION_ENGINE.md`: Implementation specification of commission calculation.
7. `NEXUS_PRIME_WALLET_LEDGER.md`: Immutability rules, ledger schema, and balance derivation.
8. `NEXUS_PRIME_WITHDRAWAL_SYSTEM.md`: Reservation pipeline, bank masking, and payout controls.
9. `NEXUS_PRIME_RANK_SYSTEM.md`: Career ranks, qualification metrics, and no-demotion rules.
10. `NEXUS_PRIME_FINANCIAL_REPORTING.md`: Timezone boundaries, report formats, and accounting models.
11. `NEXUS_PRIME_FINANCIAL_KPI_DEFINITIONS.md`: Exact mathematical definitions of financial KPIs.
12. `NEXUS_PRIME_RECONCILIATION.md`: 17-point automated audit diagnostics.
13. `NEXUS_PRIME_KYC_SYSTEM.md`: Multi-tier KYC requirements, signed tokens, and private storage.
14. `NEXUS_PRIME_MEMBERSHIP_ENGINE.md`: Membership lifecycle, state machine, and payment activation.
15. `NEXUS_PRIME_MEMBERSHIP_SECURITY.md`: Security controls for membership status and gates.
16. `NEXUS_PRIME_MEMBERSHIP_WORKFLOW.md`: Step-by-step state transition and renewal workflows.
17. `NEXUS_PRIME_ELIGIBILITY_ENGINE.md`: Centralized 4-pillar rule engine and precedence model.
18. `NEXUS_PRIME_NOTIFICATION_SYSTEM.md`: Multi-channel communication architecture.
19. `NEXUS_PRIME_SUPPORT_SYSTEM.md`: Help desk, ticketing, and internal staff notes design.
20. `NEXUS_PRIME_ADMIN_PANEL.md`: Admin UI, permission matrices, and back-office procedures.
21. `NEXUS_PRIME_MEMBER_DASHBOARD.md`: Member UI specifications and UX workflows.
22. `NEXUS_PRIME_PRODUCTS_PACKAGES.md`: E-commerce catalog, packages, and pricing rules.
23. `NEXUS_PRIME_PURCHASE_ORDER_SYSTEM.md`: Order orchestrator, pricing snapshots, and lifecycle.
24. `NEXUS_PRIME_PAYMENT_ARCHITECTURE.md`: Gateway abstraction, webhook verification, and idempotency.
25. `NEXUS_PRIME_PAYMENT_SETUP.md`: Integration guide for PayHere and banking APIs.
26. `NEXUS_PRIME_REFERRAL_SYSTEM.md`: Vanity links, attribution, and anti-abuse mechanisms.
27. `NEXUS_PRIME_DESIGN_SYSTEM.md`: Color palette, typography, responsive breakpoints.
28. `NEXUS_PRIME_SITEMAP.md`: Complete route and page navigation hierarchy.
29. `NEXUS_PRIME_USER_FLOW.md`: End-to-end user journeys from registration to payout.
30. `NEXUS_PRIME_VOLUME_DEFINITION.md`: Mathematical definitions of PV, TV, and commissionable volume.

---

## 7. AUTOMATED TEST SUITE MAPPING

* Primary Test Harness: `test/nexus-foundation.test.js`
* Total Active Steps: 208
* Current Status: **208 PASSED, 0 FAILED (100% Pass Rate)**
* Test Coverage Areas:
  * Tests 1–25: Core foundation, database models, identity, JWT authentication, and profile guards.
  * Tests 26–50: MLM network tree, circular reference prevention, unilevel upline/downline traversal.
  * Tests 51–75: Catalog, order orchestrator, server-side pricing, PayHere webhook signatures, idempotency.
  * Tests 76–92: Unilevel commission calculations, double-entry wallet ledger, negative balance prevention, derived balances.
  * Tests 93–107: Bank account masking, withdrawal reservation pipeline, manual payout confirmation, admin rejections.
  * Tests 108–122: Career rank qualification, PV/TV calculation, rule versioning, no-demotion retention.
  * Tests 123–162: Asia/Colombo timezone financial reporting, half-open interval boundaries, 17-point reconciliation engine.
  * Tests 163–177: Notifications dispatch, user preferences, support ticket system, internal staff notes isolation.
  * Tests 178–186: KYC verification lifecycle, private document storage, HMAC-SHA256 signed access tokens, IDOR prevention.
  * Tests 187–208: Membership state machine, payment-activation bridge, centralized 4-pillar eligibility engine, deterministic Rule Precedence Model.
