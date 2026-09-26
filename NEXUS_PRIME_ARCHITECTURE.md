# NEXUS PRIME (PVT) LTD — SYSTEM ARCHITECTURE SPECIFICATION
**Domain:** `nexusp.online`  
**Platform Version:** 1.0.0-PROD-ISOLATED  
**Classification:** Proprietary / Corporate Architecture & MLM Engine Specification  
**Status:** Approved Architectural Blueprint  

---

## 1. Project Overview

**Nexus Prime (PVT) Ltd** is a corporate digital commerce, vocational e-learning, and network-marketing (binary MLM) enterprise based in Sri Lanka operating on the production domain **`nexusp.online`**. 

The platform provides:
1. **Digital Skill Academies**: On-demand and cohort-based video training, course progress tracking, certification, and resource delivery.
2. **Binary Multi-Level Affiliate & Network Marketing**: Highly scalable multi-tier network distribution engine featuring automated spillover placement, volume accumulation, binary pairing compensation, direct sponsor commissions, and daily earnings safety capping.
3. **Financial Margin Firewall & Product Economics**: Real-time solvency calculations with 7 discrete operational and liability cost allocations to guarantee company sustainability and eliminate over-allocation risks.
4. **Double-Entry Wallet & Payout Infrastructure**: Verifiable double-entry ledgers for member commissions, withdrawal processing to Sri Lankan commercial banks, and multi-signature admin review workflows.

### Complete Independence Mandate
Nexus Prime is engineered using the proven core engines and UI patterns of `hapanamy.lk`, but operates as an **entirely independent, isolated platform**. Nexus Prime shares **no databases, no servers, no API credentials, no user data, and no operational state** with Hapanamy.lk.

---

## 2. Existing Hapanamy Architecture Summary

An exhaustive analysis of the `hapanamy.lk` codebase revealed the following structural components:

* **Frontend Structure**:
  * Multi-page architecture (MPA) with responsive vanilla HTML5, CSS3, and ES6+ JavaScript.
  * Central design system (`index.css`) built with CSS Custom Properties, featuring dual-theme support (Dark mode default) and bilingual localization (Sinhala `si` and English `en`).
  * Tabbed Single-Page Application (SPA) dashboard controllers (`dashboard.html` for members with 13 functional modules, and `admin.html` / `hapanamy-admin-portal-9226.html` with 8 management panels).
  * Client-side auth guard patterns inspecting `localStorage` session tokens with redirection to `/login.html`.
  * Public portal pages: `index.html` (Landing & Course Showcase), `checkout.html`, `order-success.html`, `blog.html`, `about-us.html`, `contact-us.html`, `student-dashboard.html`.

* **Backend Structure**:
  * High-performance native Node.js HTTP server (`server.js`, 3,716 lines) devoid of heavy framework overhead, implementing custom REST route dispatching, JSON body parsing, CORS management, rate limiting, and CSRF protection.
  * Dual-Execution Harness: An in-memory mock state harness for automated integration testing (`step13` to `step31` test suites) paired with a production "Fail-Closed" database driver requiring a valid PostgreSQL connection string (`DATABASE_URL`).
  * Strict URL rewriting and static asset serving with directory traversal protection, denying access to `.env`, `.git`, `.sql`, `/services/`, and `/storage/private/`.

* **Database & Ledger Model**:
  * PostgreSQL 15 / Supabase relational database with UUID primary keys.
  * 21 relational tables in `sql/schema.sql` tracking users, KYC profiles, binary nodes, volume ledgers, wallets, transactions, products, orders, deposit slips, immutable economics snapshots, and audit trails.
  * Double-entry ledger architecture for wallet balances and binary volume matching.
  * Immutable 25-field Product Economics Snapshot generated per active order with a SHA-256 cryptographic integrity hash to prevent commission recalculation drift or historical tampering.

* **Business Logic & Commission Rules**:
  * Direct Referral Commission: 8.00% paid immediately to the direct sponsor.
  * Binary Pairing Commission: 7.00% paid on matched left/right leg volume across up to 7 qualified uplines.
  * Daily Cap Engine: 30,000.00 LKR maximum commission payout per member per calendar day (Asia/Colombo timezone).
  * 14-day refund window with full automated commission deduction and volume rollback.

---

## 3. Nexus Prime Architecture & Technical Map

Nexus Prime adopts an isolated, cloud-native 3-tier architecture optimized for horizontal scale, security, and low latency:

```
+-----------------------------------------------------------------------------------+
|                              CLIENT TIER (nexusp.online)                          |
|  - Nexus Prime Brand Theme (Deep Navy #0B192C, Cyan #008DDA, Gold #FFD700)        |
|  - Member Portal (SPA Tabbed Shell)  - Corporate Landing & Public Showcase        |
|  - Admin Command Center             - Interactive SVG Binary Tree Visualizer     |
+-----------------------------------------------------------------------------------+
                                         |
                                         | HTTPS (TLS 1.3 / Strict-Transport-Security)
                                         v
+-----------------------------------------------------------------------------------+
|                        API & APPLICATION TIER (Nexus Prime Node API)             |
|  - Security Core: IP Rate Limiting (150 req/min), CSRF Origin Validation          |
|  - Auth & Session Service: PBKDF2-SHA512 Hashing, TOTP 2FA, Bearer JWTs          |
|  - Placement & Binary Engine: Auto-Spillover, Weaker-Leg Placement, Cycle Defense |
|  - Product Margin Firewall: 7 Discrete Cost Allocations + Solvency Validator      |
|  - Commission Core: 8% Direct, 7% Binary, 7-Level Upline Propagation, Daily Caps   |
|  - Financial Orchestrator: Double-Entry Wallet Ledger, Slip Review, Payouts       |
+-----------------------------------------------------------------------------------+
                                         |
                                         | Connection Pool (SSL Required)
                                         v
+-----------------------------------------------------------------------------------+
|                      DATA & STORAGE TIER (Nexus Prime Isolated DB)                |
|  - Dedicated PostgreSQL 15 / Supabase Instance: `nexus_prime_db`                  |
|  - Prefixed Database Tables (`nexus_*`) with Strict Foreign Keys & Indexes        |
|  - Row Level Security (RLS) Enforcing Tenant Isolation                            |
|  - Private Encrypted Vault: `nexus-private-vault` (KYC Documents, Bank Slips)    |
+-----------------------------------------------------------------------------------+
```

---

## 4. Database Schema Plan

Nexus Prime will deploy a completely dedicated, isolated schema. All tables use the `nexus_` prefix to distinctly signify ownership and guarantee that no shared or ambiguous references can ever occur.

### Complete Table Registry

| Table Name | Description | Key Relationships |
|---|---|---|
| `nexus_users` | Core auth entity, email, role, status | Primary Auth Table |
| `nexus_profiles` | Member KYC identity, full name, NIC/Passport, phone | `user_id` -> `nexus_users(id)` [1:1] |
| `nexus_kyc_documents` | Encrypted KYC document uploads and verification log | `user_id` -> `nexus_users(id)` |
| `nexus_bank_accounts` | Payout destination bank account details | `user_id` -> `nexus_users(id)` |
| `nexus_settings` | Dynamic platform parameters and commission constants | Key-Value Store |
| `nexus_product_economics_defaults` | Baseline cost allocation percentages and fixed fees | Corporate Margin Defaults |
| `nexus_sponsors` | Unilevel direct referral genealogy | `user_id` -> `nexus_users`, `sponsor_id` -> `nexus_users` |
| `nexus_binary_nodes` | Binary tree topology (left/right children, depth, path) | `user_id` -> `nexus_users`, `placement_parent_id` -> `nexus_users` |
| `nexus_products` | Digital courses, certifications, and product packages | Active Catalog |
| `nexus_product_economics_versions` | Historical version audit of product pricing configurations | `product_id` -> `nexus_products(id)` |
| `nexus_orders` | Customer purchases and enrollment transactions | `user_id` -> `nexus_users`, `product_id` -> `nexus_products` |
| `nexus_payment_deposits` | Manual bank slip uploads and verification queue | `order_id` -> `nexus_orders(id)` |
| `nexus_product_economics_snapshots`| Immutable 25-field snapshot generated upon order approval | `order_id` -> `nexus_orders(id)` |
| `nexus_binary_volume_ledger` | Double-entry LEFT/RIGHT binary volume accumulation | `user_id` -> `nexus_users`, `order_id` -> `nexus_orders` |
| `nexus_binary_matches` | Binary pairing match events and volume deduction records | `user_id` -> `nexus_users` |
| `nexus_commissions` | Direct and binary commission distribution ledger | `user_id` -> `nexus_users`, `order_id` -> `nexus_orders` |
| `nexus_wallet` | High-performance atomic balance counters | `user_id` -> `nexus_users(id)` [1:1] |
| `nexus_wallet_transactions` | Double-entry financial audit journal | `user_id` -> `nexus_users`, polymorphic reference |
| `nexus_withdrawals` | Bank payout requests and settlement lifecycle | `user_id` -> `nexus_users`, `bank_account_id` -> `nexus_bank_accounts` |
| `nexus_refund_requests` | 14-day refund requests, reviews, and reversals | `order_id` -> `nexus_orders(id)` |
| `nexus_notifications` | In-app user notifications and broadcast alerts | `user_id` -> `nexus_users` |
| `nexus_audit_logs` | Immutable operational activity and access logs | `user_id` -> `nexus_users` |
| `nexus_fraud_alerts` | Automated anomaly detection and risk warnings | `user_id` -> `nexus_users` |

---

## 5. Authentication Plan

1. **Password Security**:
   * Hashing via Node.js native `crypto.pbkdf2Sync` with SHA-512.
   * 10,000 iterations minimum, 16-byte cryptographically secure random salt (`crypto.randomBytes(16)`).
   * Constant-time verification using `crypto.timingSafeEqual` to eliminate side-channel timing attacks.
2. **Session Architecture**:
   * Cryptographically secure 256-bit bearer session tokens.
   * Stored in encrypted HTTP-only, `SameSite=Strict`, `Secure` cookies or transmitted via `Authorization: Bearer <token>` headers.
   * Configurable session expiry (default 7 days for members, 12 hours for administrators).
3. **Multi-Factor Authentication (MFA / 2FA)**:
   * Time-based One-Time Password (TOTP) compliance (RFC 6238) via standard authenticator apps (Google Authenticator, Microsoft Authenticator).
   * Mandatory for all administrator roles and withdrawal requests exceeding 50,000 LKR.
4. **Password Reset & Account Recovery**:
   * Single-use cryptographic reset tokens with a strict 30-minute expiry window.
   * Rate limited to a maximum of 3 requests per IP/email per hour.

---

## 6. User Roles & Permissions

Nexus Prime employs a strict Role-Based Access Control (RBAC) model:

```
[ Roles ]
   ├── nexus_member    : Access Member Dashboard, view own downline, buy courses, manage wallet, request payouts.
   ├── nexus_support   : View KYC queue, view support inquiries, read-only member status.
   ├── nexus_finance   : Review bank deposit slips, review & execute withdrawals, export financial statements.
   └── nexus_admin     : Full platform administration, product economics editing, margin overrides, user management.
```

### Permission Matrix

| Functionality | `nexus_member` | `nexus_support` | `nexus_finance` | `nexus_admin` |
|---|:---:|:---:|:---:|:---:|
| Browse Products & Checkout | Yes | Yes | Yes | Yes |
| Access Learning Dashboard | Yes (Active) | No | No | Yes |
| View Own Binary Tree & Referrals | Yes | No | No | Yes (All Trees) |
| Submit KYC & Bank Accounts | Yes | No | No | No |
| Request Wallet Withdrawal | Yes | No | No | No |
| Review KYC Documents | No | Yes | Yes | Yes |
| Approve/Reject Payment Slips | No | No | Yes | Yes |
| Approve/Execute Withdrawals | No | No | Yes | Yes |
| Edit Product Economics & Prices | No | No | No | Yes |
| Override Margins & Commission Caps| No | No | No | Yes |
| Export System-Wide Audit Logs | No | No | Yes | Yes |

---

## 7. Admin Architecture

The Nexus Prime Admin Command Center (`admin.html` / `nexus-admin-portal.html`) provides operational oversight across 8 specialized domains:

1. **Executive KPI Dashboard**: Real-time sales volume, commission liability ratio, pending deposit slips count, pending payout total, active member count, and daily earnings cap saturation rate.
2. **Product Economics & Margin Firewall**: Product CRUD interface with real-time interactive margin calculations for the 7 discrete cost allocations, gross margin validation, and commission solvency locks.
3. **Network & Tree Inspector**: Visual genealogy search, placement verification, node inspection, depth metrics, and manual spillover placement tooling.
4. **Payment Deposit Verification Queue**: High-speed slip verification desk with high-resolution image zoom, duplicate bank reference detection, auto-matching with customer order amounts, and one-click enrollment activation.
5. **Withdrawal Settlement Desk**: Batch processing of member payout requests, export of Sri Lankan bank transfer files (CEFT / SLIPS format), and two-step payout confirmation (`APPROVED` -> `PAID`).
6. **KYC Compliance Vault**: Secure viewer for National Identity Cards (NIC) and Passports with reviewer audit logs and rejection notice dispatch.
7. **Financial Reporting & Tax Compliance**: Multi-format reporting (CSV, Excel `.xlsx`, PDF) covering Gross Sales, Net Contribution, Commission Outflows, Operational Withholdings, and Tax Reserves.
8. **Security & Fraud Monitoring**: Alert console flagging self-referral attempts, placement cycling, velocity anomalies, and IP collision clusters.

---

## 8. Member Architecture

The Nexus Prime Member Dashboard (`dashboard.html`) is structured into a clean, modern, single-page interface with 13 modular tabs:

1. **Overview Tab**: Account status badge (`ACTIVE` / `PENDING`), quick referral links (Left & Right), wallet balance summary, daily earning cap progress bar, and recent team activations.
2. **Profile & Security Tab**: Personal profile management, avatar selection, password change, and 2FA TOTP activation.
3. **Network Genealogy Tab**: High-performance interactive binary tree visualizer with pan/zoom controls, upline breadcrumbs, search-by-username, and sub-tree volume counts (Total Left BV vs Total Right BV).
4. **Referral Management Tab**: Unilevel direct sponsor registry, referral link click analytics, conversion rates, and direct sponsor qualification indicators.
5. **Course Catalog Tab**: Available digital training programs with clear pricing, binary volume points, and direct checkout actions.
6. **My Classroom Tab**: Enrolled courses, video player integration, download resources, and progress tracking.
7. **Order History Tab**: Complete transaction history with payment status tracking (`PENDING`, `APPROVED`, `REJECTED`) and admin review notes.
8. **Financial & Ledger Tab**: Comprehensive double-entry ledger statement showing all credits (commissions) and debits (withdrawals, adjustments) with running balances.
9. **Commissions Tab**: Granular breakdown separating Direct Referral Commissions from Binary Volume Matching Commissions, including daily cap adjustments.
10. **Withdrawals Tab**: Payout request submission (minimum 1,000 LKR), destination bank selector, withdrawal status history, and payment reference numbers.
11. **KYC Verification Tab**: Document upload portal (NIC/Passport/Driving License front & back) with real-time review status indicator.
12. **Notifications Tab**: Real-time message center for account alerts, commission credits, and system announcements.
13. **Settings Tab**: Member preferences, notification toggles, and verified bank account management.

---

## 9. MLM / Binary Network Structure

```
                         [ROOT: nexus_admin]
                               /     \
                              /       \
                       [LEFT NODE]   [RIGHT NODE]
                          /   \          /   \
                         L1    R1       L2    R2
```

1. **Topology**: Pure Binary Tree where every node has at most two children (`position: 'LEFT' | 'RIGHT'`).
2. **Depth & Path Tracking**: Every node maintains:
   * `depth`: Integer depth from root (Root = 1, Children = 2...).
   * `path`: Materialized hierarchical path string (e.g., `'1/4/9/22'`) enabling $O(1)$ ancestor and descendant queries via index lookups without recursive overhead.
3. **Placement Algorithms**:
   * **Auto-Spillover (Extreme Outer Leg)**: Automatically descends to the bottom-most leaf of the selected leg (Leftmost or Rightmost) to build strong power legs.
   * **Balanced / Weaker-Leg Placement**: Evaluates the member's current Left Volume vs Right Volume and automatically assigns the new registrant to the weaker volume branch to maximize pairing opportunities.
4. **Collision Prevention**: Server-side in-memory mutex locking (`_slotLocks`) guarantees that concurrent registrations cannot occupy the same parent-position slot.
5. **Cycle Detection**: Traversal validation prevents circular parent-child placement loops or self-placement.

---

## 10. Commission Architecture

Nexus Prime enforces a deterministic, mathematically solvent commission engine:

### 10.1 Direct Referral Commission
* **Rate**: Configurable default of **8.00%** of the product's selling price.
* **Trigger**: Activated immediately upon admin approval of the customer's payment deposit slip.
* **Recipient**: The direct sponsor identified in `nexus_sponsors`.
* **Eligibility**: The sponsor must hold an `ACTIVE` status in `nexus_users`.

### 10.2 Binary Volume Accumulation & Matching Commission
* **Binary Volume (BV)**: 100% of the active product selling price generates equivalent Binary Volume points (or custom configured BV).
* **Propagation**: Upon order activation, BV propagates upward through the placement parent tree, accumulating in either the `LEFT` or `RIGHT` volume ledger of each ancestor node.
* **Rate**: Configurable default of **7.00%** on matched volume.
* **Matching Rule**: $\text{Matched Volume} = \min(\text{Left Volume}, \text{Right Volume})$.
* **Carryover**: Unmatched volume remains in the stronger leg and carries over indefinitely until matched by subsequent weaker-leg volume.
* **Upline Limit**: Volume matching propagates up to a maximum of **7 qualified upline generations**.

### 10.3 Qualification Rules
To qualify for binary matching payouts, a member must meet three concurrent conditions:
1. **Personal Active Status**: Must have at least one approved personal product purchase (`nexus_orders.status = 'ACTIVE'`).
2. **Direct Referral Threshold**: Must have sponsored at least two active direct referrals (minimum 1 active referral in their Left leg and 1 active referral in their Right leg).
3. **Account Standing**: Account status must be `ACTIVE` (not suspended or pending fraud review).

### 10.4 Daily Earnings Cap Engine
* **Cap Limit**: Configurable default of **30,000.00 LKR** per member per calendar day.
* **Timezone**: Strictly calculated according to Sri Lanka Standard Time (`Asia/Colombo`, UTC+05:30).
* **Scope**: Applied to Binary Pairing Commissions (or combined Direct + Binary based on system settings).
* **Flush Policy**: Earnings calculated in excess of 30,000.00 LKR within a single calendar day are capped and logged as `capped_amount` to safeguard company solvency.

---

## 11. Wallet Architecture

Nexus Prime implements a double-entry ledger model for all financial transactions:

```
[ Commission Earned ] ---> (+) nexus_wallet.available_balance
                                   |
[ Withdrawal Requested ] -> (-) nexus_wallet.available_balance  ===> (+) pending_balance
                                   |
                                   +--> [ Approved & Paid ] ===> (-) pending_balance & (+) withdrawn_amount
                                   |
                                   +--> [ Rejected ] ========> (+) available_balance & (-) pending_balance
```

1. **Atomic Balances Table (`nexus_wallet`)**:
   * `available_balance`: Funds available for immediate withdrawal or course purchases.
   * `pending_balance`: Funds currently locked in pending withdrawal requests.
   * `withdrawn_amount`: Cumulative historical total of successfully paid withdrawals.
2. **Transaction Journal (`nexus_wallet_transactions`)**:
   * Every balance movement creates an immutable transaction entry with exact decimal amounts, transaction types (`COMMISSION_EARNED`, `WITHDRAWAL_REQUEST`, `WITHDRAWAL_PAID`, `REFUND_REVERSAL`, `ADJUSTMENT`), and foreign reference IDs.
   * Total system balance can be audited at any instant by taking $\sum(\text{amount})$ across the journal.

---

## 12. Payment & Withdrawal Architecture

### 12.1 Customer Payment & Order Lifecycle
1. **Checkout**: Customer selects product on `nexusp.online` and chooses payment method (Corporate Bank Transfer or Online Gateway).
2. **Deposit Submission**: Customer uploads bank transfer slip image, enters bank reference number, transfer date, and depositing bank branch.
3. **Integrity Lock**: The reference number is checked for global uniqueness in `nexus_payment_deposits` to prevent double-spending or duplicate submission.
4. **Admin Verification**: Finance admin inspects slip against company bank records in Admin Portal.
5. **Activation Trigger**: Upon clicking `APPROVE`:
   * Order status transitions to `ACTIVE`.
   * Immutable 25-field Product Economics Snapshot is generated and hashed.
   * Direct Commission is credited to the direct sponsor's wallet.
   * Binary Volume is propagated up the placement hierarchy.
   * Digital course access is unlocked in the member's classroom.

### 12.2 Member Withdrawal Lifecycle
1. **Request**: Member requests payout via `dashboard.html` (Minimum: 1,000.00 LKR).
2. **Validation Rules**:
   * Member must have an approved KYC document (`status = 'VERIFIED'`).
   * Member must have a verified, active Sri Lankan bank account linked.
   * Requested amount must not exceed `available_balance`.
3. **Locking**: Requested amount is atomically deducted from `available_balance` and credited to `pending_balance`.
4. **Admin Review**: Finance admin reviews pending queue, verifies bank account details, and approves request.
5. **Execution**: Finance admin marks transfer as `PAID` with corporate bank transaction reference. Funds transition from `pending_balance` to `withdrawn_amount`.
6. **Rejection Handling**: If rejected, funds are immediately credited back to `available_balance` via an automated `ADJUSTMENT` transaction.

---

## 13. RESTful API Architecture

The Nexus Prime backend exposes clean, structured RESTful API endpoints:

```
AUTHENTICATION & IDENTITY
  POST /api/v1/auth/register                 - Member registration & automatic tree placement
  POST /api/v1/auth/login                    - Password verification & session issuance
  POST /api/v1/auth/logout                   - Session termination
  GET  /api/v1/auth/me                       - Current authenticated profile
  POST /api/v1/auth/2fa/setup                - Generate TOTP QR secret
  POST /api/v1/auth/2fa/verify               - Confirm and activate 2FA
  POST /api/v1/auth/password/reset-request   - Request 30-min password reset token
  POST /api/v1/auth/password/reset-confirm   - Execute password reset

MEMBER PORTAL
  GET  /api/v1/member/dashboard              - Aggregate dashboard statistics & team counts
  GET  /api/v1/member/network/tree           - Fetch binary tree visualization nodes
  GET  /api/v1/member/network/directs        - Fetch unilevel direct referrals list
  GET  /api/v1/member/products               - Browse active digital course catalog
  POST /api/v1/member/checkout               - Initiate product enrollment order
  POST /api/v1/member/payments/slip-upload   - Upload bank transfer deposit slip
  GET  /api/v1/member/orders                 - Order history & slip approval status
  GET  /api/v1/member/wallet/balance         - Current wallet balances & ledger statements
  POST /api/v1/member/wallet/withdraw        - Submit bank payout request
  POST /api/v1/member/kyc/submit             - Submit NIC/Passport identification document
  GET  /api/v1/member/kyc/status             - Check current verification standing
  POST /api/v1/member/bank-account           - Register or update payout bank account
  GET  /api/v1/member/notifications          - Retrieve in-app alerts

ADMINISTRATION & FINANCIAL OPERATIONS
  GET  /api/v1/admin/dashboard               - High-level executive business KPIs
  GET  /api/v1/admin/deposits/pending        - Review queue for bank transfer slips
  POST /api/v1/admin/deposits/review         - Approve or reject deposit slip (triggers commissions)
  GET  /api/v1/admin/withdrawals/pending     - Review queue for member payout requests
  POST /api/v1/admin/withdrawals/review      - Approve or reject payout request
  POST /api/v1/admin/withdrawals/pay         - Mark approved payout as executed/paid
  GET  /api/v1/admin/kyc/pending             - Review queue for member identity documents
  POST /api/v1/admin/kyc/review              - Verify or reject KYC identity document
  POST /api/v1/admin/products/create         - Add product with 7 discrete cost allocations
  POST /api/v1/admin/products/edit           - Modify product configuration & margin check
  POST /api/v1/admin/products/validate       - Margin Firewall pre-validation check
  GET  /api/v1/admin/reports/financial       - Financial performance & margin audit report
  GET  /api/v1/admin/reports/mlm             - Binary volume, pairing, and payout analytics
  GET  /api/v1/admin/reports/export          - Export datasets to CSV, Excel, or PDF
  GET  /api/v1/admin/security/fraud-alerts   - Suspicious activity and policy violation alerts
```

---

## 14. Storage Architecture

Nexus Prime requires secure, segmented document storage:

```
[ Nexus Prime Storage Infrastructure ]
   ├── Public Storage (/assets/...)
   │     ├── Brand assets: `nexus-logo.png`, `nexus-favicon.ico`
   │     ├── Course promotional banners: `ai-mastery.jpg`, `cloud-dev.jpg`
   │     └── Marketing graphics & instructor headshots
   │
   └── Private Encrypted Vault (Bucket: `nexus-private-vault` / Local: `./storage/nexus_private/`)
         ├── Member Identity Documents: `kyc-nic-{uuid}.pdf`, `kyc-passport-{uuid}.jpg`
         └── Bank Deposit Slips: `slip-{order_uuid}-{timestamp}.jpg`
```

### Storage Security Controls
* **Direct Access Blocked**: Direct public URL access to `./storage/nexus_private/` or private cloud buckets is strictly denied via web server rules and cloud bucket ACLs.
* **Controlled Access Streaming**: Documents can only be viewed via the authenticated streaming endpoint `/api/v1/member/kyc/document?filename=...`, which verifies that the requesting user owns the document or possesses administrative privileges.
* **Encryption**: Files at rest are encrypted using AES-256 server-side encryption.

---

## 15. Security Architecture

1. **Denial of Service & Brute Force Defense**:
   * IP Rate Limiter: Maximum 150 requests per minute per IP address.
   * Auth Rate Limiter: Maximum 5 failed login attempts per 15 minutes before temporary lockout.
2. **Cross-Site Request Forgery (CSRF)**:
   * Origin and Referer header verification enforced on all mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`).
   * Requests with mismatched host headers are immediately rejected with HTTP 403.
3. **Input Sanitization & Injection Prevention**:
   * All user text inputs are sanitized to strip script tags, dangerous HTML elements, and SQL meta-characters.
   * Parameterized queries utilized for all database operations to eliminate SQL injection vulnerabilities.
4. **Production Fail-Closed Safety Circuit**:
   * The server checks for database availability prior to processing financial mutations. If the primary database connection is severed, financial mutation endpoints return HTTP 503 rather than corrupting in-memory fallbacks.
5. **Security Response Headers**:
   ```http
   Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;
   X-Content-Type-Options: nosniff
   X-Frame-Options: SAMEORIGIN
   X-XSS-Protection: 1; mode=block
   Referrer-Policy: strict-origin-when-cross-origin
   Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
   ```

---

## 16. Row Level Security (RLS) Strategy

If Supabase or PostgreSQL native RLS is utilized, the following policy framework will be enforced:

1. **`nexus_users`**:
   * `SELECT`: Users may only read their own user record (`auth.uid() = id`), or admin users (`auth.jwt()->>'role' = 'nexus_admin'`).
   * `UPDATE`: Users may only update non-role fields of their own record.
2. **`nexus_profiles`**:
   * `SELECT`: Authenticated users can view basic public fields (username, full name) of other users for team tree rendering; sensitive KYC fields (NIC, phone, address) restricted to self and admins.
3. **`nexus_binary_nodes`**:
   * `SELECT`: Members can read their own node and any descendant node where `path LIKE (current_user_node.path || '%')`.
   * `INSERT` / `UPDATE`: Restricted strictly to backend service-role.
4. **`nexus_wallet` & `nexus_wallet_transactions`**:
   * `SELECT`: Members can only view records where `user_id = auth.uid()`.
   * `INSERT` / `UPDATE`: Restricted strictly to database triggers and authenticated backend service-role.
5. **`nexus_kyc_documents` & `nexus_bank_accounts`**:
   * `SELECT`: Self or `nexus_admin` / `nexus_support`.
   * `INSERT`: Self.
   * `UPDATE`: Status fields only modifiable by `nexus_admin` / `nexus_support`.

---

## 17. Environment Variable Strategy

Nexus Prime requires its own isolated environment configuration file (`.env.nexus`). Under no circumstances should Hapanamy production credentials be imported.

### `.env.nexus.example`
```ini
# ==============================================================================
# NEXUS PRIME (PVT) LTD — PRODUCTION ENVIRONMENT CONFIGURATION
# DOMAIN: nexusp.online
# ==============================================================================

# Core Application Settings
NODE_ENV=production
PORT=3000
APPLICATION_URL=https://nexusp.online

# Dedicated Database Connection (PostgreSQL 15 / Supabase Pooler)
# MUST POINT TO NEXUS PRIME DATABASE ONLY (NEVER HAPANAMY DB)
DATABASE_URL=postgresql://nexus_admin:YOUR_NEXUS_SECURE_PASSWORD@db.your-nexus-project.supabase.co:5432/postgres?sslmode=require

# Security Keys (64-byte random hex strings)
SESSION_SECRET=YOUR_64_CHAR_HEX_NEXUS_SESSION_SECRET
AUTH_SECRET=YOUR_64_CHAR_HEX_NEXUS_AUTH_SECRET
JWT_SECRET=YOUR_64_CHAR_HEX_NEXUS_JWT_SECRET

# Transactional Corporate Mail (Nexus Prime)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=YOUR_NEXUS_SENDGRID_KEY
EMAIL_FROM="Nexus Prime Support" <support@nexusp.online>

# Reverse Proxy & Cloudflare
TRUST_PROXY=true

# Private Storage Vault (Nexus Prime KYC & Slips)
STORAGE_PROVIDER=supabase
STORAGE_BUCKET=nexus-private-vault
STORAGE_ENDPOINT=https://your-nexus-project.supabase.co/storage/v1
STORAGE_ACCESS_KEY=YOUR_NEXUS_STORAGE_KEY

# Business Invariants & Financial Margins
DIRECT_COMMISSION_PERCENT=8.00
BINARY_COMMISSION_PERCENT=7.00
MAX_QUALIFIED_UPLINE_RECIPIENTS=7
DAILY_EARNINGS_CAP_LKR=30000.00
TIMEZONE=Asia/Colombo
```

---

## 18. Migration & Replication Strategy

To adhere strictly to the **CRITICAL SAFETY RULE**:

1. **Zero Data Replication**: No existing users, password hashes, affiliate statistics, bank slips, wallet balances, or transactions from Hapanamy.lk will be moved or imported.
2. **Schema-Only Extraction**: Only the structural DDL definitions are adapted, refactored with the `nexus_` prefix, and applied to the new Nexus Prime database.
3. **Clean Seed Initialization**:
   * Nexus Prime starts with a single clean corporate root administrator (`admin@nexusp.online`).
   * Initial products seeded with Nexus Prime corporate catalog offerings.
   * Corporate bank accounts configured for **Nexus Prime (PVT) Ltd**.

---

## 19. Components Safe to Reuse

The following architectural components from Hapanamy are modular, generic, and safe to reuse for Nexus Prime:

1. **Binary Placement Engine Logic (`placement-engine.js`)**: Spillover determination, ancestor traversal, path generation, cycle detection.
2. **Product Economics Calculator (`product-economics-calculator.js`)**: The 7 discrete cost allocation math, integer cents calculations, and Margin Safety Firewall.
3. **Immutable Snapshot Engine (`product-snapshot-service.js`)**: 25-field purchase snapshot generator and SHA-256 integrity hasher.
4. **Double-Entry Wallet Service (`wallet-service.js`)**: Balance aggregation, transaction journal validation, withdrawal eligibility checker.
5. **Interactive Binary Tree Visualizer**: Frontend SVG/Canvas hierarchy renderer with pan/zoom and downline node inspection.
6. **Earnings Calculator Widget**: Frontend earnings simulation slider and pairing visualizer.
7. **Security Core Utilities (`security-core.js`)**: Rate limiter, CSRF validator, input sanitizer, and password hashing algorithms.

---

## 20. Components to Redesign for Nexus Prime

The following elements must be customized or redesigned for Nexus Prime:

1. **Brand Identity & Color Palette**:
   * Transition from Hapanamy's Orange/Gold palette (`#F57C00`, `#D4AF37`) to Nexus Prime's modern corporate palette:
     * Primary Brand: **Deep Navy / Midnight Blue** (`#0B192C` / `#1E3E62`)
     * Accent & Action: **Electric Cyan / Bright Blue** (`#008DDA` / `#41C9E2`)
     * Highlight & Prestige: **Cyber Gold** (`#FFD700`)
     * Background Surface: Deep Dark Modern Glass (`#060E1A` / `#101F35`)
2. **Typography & Logos**:
   * Replace Hapanamy logos with **Nexus Prime (PVT) Ltd** corporate branding.
   * Modern typography pairing: **Outfit** (Headings) and **Plus Jakarta Sans** / **Poppins** (Body).
3. **Product Catalog & Course Material**:
   * Replace existing localized social media courses with Nexus Prime's flagship curriculum (e.g., AI & Automation Masterclasses, Cloud Architecture, Global E-commerce, Financial Technology).
4. **Corporate Banking Details**:
   * Configure corporate deposit recipient accounts under `NEXUS PRIME (PVT) LTD` (Commercial Bank of Ceylon, Hatton National Bank).
5. **Legal & Compliance Documents**:
   * Tailor Terms of Service, Privacy Policy, Disclaimer, and 14-Day Refund Policy for `nexusp.online` and Nexus Prime (PVT) Ltd legal entities.

---

## 21. Components That Must Remain Independent

The following elements must remain strictly segregated:

| Component | Hapanamy.lk | Nexus Prime (`nexusp.online`) | Isolation Guarantee |
|---|---|---|---|
| **Database** | `hapanamy_mlm` / Hapanamy Supabase | `nexus_prime_db` / Nexus Supabase | Distinct connection strings, distinct IP endpoints |
| **User Data** | Existing user base | Empty at launch; new signups only | Zero cross-table queries or imports |
| **Authentication** | Separate salt keys & JWT secrets | Separate salt keys & JWT secrets | Token from one platform will fail on the other |
| **Storage Vault** | `private-kyc-vault` | `nexus-private-vault` | Separate cloud buckets with independent access keys |
| **Mail Server** | `noreply@hapanamy.lk` | `support@nexusp.online` | Dedicated SMTP domains and sender verification |
| **Bank Details** | Hapanamy Enterprises (Pvt) Ltd | Nexus Prime (PVT) Ltd | Completely separate corporate banking details |
| **Payment Slips** | Stored in Hapanamy private storage | Stored in Nexus Prime private storage | Independent slip queues and audit trails |

---

## 22. Phase 1 Foundation Implementation Status & Completed Deliverables

The foundational layer for Nexus Prime (PVT) Ltd has been fully implemented, verified, and isolated from Hapanamy.lk:

1. **Version-Controlled Migrations ([`nexus_migrations/`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_migrations))**:
   * [`001_create_nexus_core_schema.sql`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_migrations/001_create_nexus_core_schema.sql): Identity, roles, sequence-backed Member IDs, member profiles, and settings.
   * [`002_create_nexus_mlm_network_schema.sql`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_migrations/002_create_nexus_mlm_network_schema.sql): Sponsors, network nodes, and the transitive closure table with recursive traversal functions.
   * [`003_create_nexus_commissions_wallet_foundation.sql`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_migrations/003_create_nexus_commissions_wallet_foundation.sql): Commission ledger foundation, double-entry wallet foundation, and audit logs.
   * [`004_create_nexus_rls_and_functions.sql`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_migrations/004_create_nexus_rls_and_functions.sql): Row Level Security policies and security enforcement functions.
   * [`005_seed_nexus_prime_initial_data.sql`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_migrations/005_seed_nexus_prime_initial_data.sql): Corporate settings, root corporate administrator (`NP000001`, `NEXUS001`).

2. **Standalone Isolated Backend ([`nexus_backend/`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_backend))**:
   * [`config/nexus-config.js`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_backend/config/nexus-config.js): Isolated configuration module.
   * [`db/nexus-db.js`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_backend/db/nexus-db.js): Isolated database adapter and repository.
   * [`services/nexus-auth-service.js`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_backend/services/nexus-auth-service.js): 13-step registration pipeline, PBKDF2-SHA512 password hashing, login, and session tokens.
   * [`services/nexus-member-service.js`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_backend/services/nexus-member-service.js): Member profile management and dashboard aggregation.
   * [`services/nexus-referral-service.js`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_backend/services/nexus-referral-service.js): Referral code validation and direct referrals directory.
   * [`services/nexus-network-service.js`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_backend/services/nexus-network-service.js): Unlimited-depth downline/upline traversal and tree hierarchy formatter.
   * [`nexus-server.js`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_backend/nexus-server.js): Independent HTTP server running on port 3001 with rate limiting and CSRF defense.

3. **Nexus Prime Brand Frontend**:
   * [`assets/nexus/nexus-style.css`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/assets/nexus/nexus-style.css): Nexus Prime corporate styling (Midnight Blue, Electric Cyan, Cyber Gold).
   * [`nexus_register.html`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_register.html): Branded registration page with `?ref=` auto-detection and live sponsor verification.
   * [`nexus_login.html`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_login.html): Branded login page.
   * [`nexus_dashboard.html`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_dashboard.html): Foundation member dashboard displaying member metrics, sponsor details, referral URL, and direct team.
   * [`nexus_referrals.html`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_referrals.html): Dedicated referral management foundation.

4. **Dedicated Verification Test Suite ([`test/nexus-foundation.test.js`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/test/nexus-foundation.test.js))**:
   * 15/15 automated tests passing covering Member ID sequences, referral codes, registration flow, multi-level tree creation, downline/upline queries, login, account status enforcement, profile protection, and session revocation.

