# NEXUS PRIME (PVT) LTD — OFFICIAL ROUTE SITEMAP & PAGE HIERARCHY
**Domain:** `nexusp.online`  
**Classification:** Application Architecture & Route Navigation Directory  
**Version:** 1.0.0-PROD  
**Status:** Approved Architectural Blueprint  

---

## 1. Complete Route Directory & Access Levels

The Nexus Prime web application is strictly partitioned into three distinct security and routing tiers:
1. **Public Website (Tier 1)**: Accessible to anonymous visitors and prospective distributors.
2. **Member Application (Tier 2)**: Restricted to authenticated members holding an active session.
3. **Admin Application (Tier 3)**: Restricted to authenticated users with server-verified `admin` or `super_admin` roles.

---

## 2. Public Website Route Map (Tier 1)

| Route Path | Page Title | Access Level | Layout / Shell Template | Key Components & Purpose | SEO Title & Metadata |
|---|---|---|---|---|---|
| `/` | Nexus Prime | Public | `nexus_index.html` | 14-Section Homepage (Hero, Trust/Value, How It Works, Opportunity, Packages, Products, Network Visual, Member Benefits, FAQ, CTAs, Footer) | "Nexus Prime — Build Your Network. Grow Your Future." |
| `/about` | About Us | Public | `nexus_index.html#about` | Corporate background, trust and values, leadership, long-term opportunity | "About Nexus Prime (PVT) Ltd \| Leadership & Vision" |
| `/how-it-works` | How It Works | Public | `nexus_index.html#how-it-works` | 4-Step onboarding roadmap: 01 Join, 02 Connect, 03 Grow, 04 Track | "How Nexus Prime Works \| Step-by-Step Platform Guide" |
| `/network-marketing` | Network Model | Public | `nexus_index.html#network-marketing` | Educational overview of direct selling, ethical network distribution, compliance | "Modern Network Marketing \| Nexus Prime Distribution" |
| `/opportunity` | Business Opportunity | Public | `nexus_index.html#opportunity` | Compensation plan overview, bonuses, career progression, earning potentials | "Global Business Opportunity \| Nexus Prime Rewards" |
| `/packages` | Packages | Public | `nexus_index.html#packages` | Membership tiers (Starter, Professional, Executive), curriculum inclusions | "Membership Packages & Digital Bundles \| Nexus Prime" |
| `/products` | Digital Products | Public | `nexus_index.html#products` | Flagship courses (AI Automation, Digital Commerce, Leadership) preview | "Digital Academies & Courses \| Nexus Prime" |
| `/faq` | FAQ | Public | `nexus_index.html#faq` | Interactive categorized 9-item accordion: General, Enrollment, Referrals, Payouts | "Frequently Asked Questions \| Nexus Prime Support" |
| `/contact` | Contact Us | Public | `nexus_index.html#contact` | Corporate contact form, support channels, operating hours | "Contact Nexus Prime (PVT) Ltd \| Customer Care" |
| `/login` | Member Login | Public | `nexus_login.html` | 2-Column split auth, email/password login, visibility toggle, role-based redirection | "Member Sign In \| Nexus Prime Portal" |
| `/register` | Join Nexus Prime | Public | `nexus_register.html` | 5-Step progressive registration wizard with live sponsor verification & invite banner | "Create Free Account \| Nexus Prime Global Network" |
| `/register?ref=CODE` | Join via Sponsor | Public | `nexus_register.html` | Auto-populated sponsor verification, contextual invitation banner | "Join Team \| Nexus Prime Referral Registration" |
| `/forgot-password` | Password Recovery | Public | `nexus_forgot_password.html` | Email reset form, generic secure response | "Reset Password \| Nexus Prime Account Help" |
| `/privacy` | Privacy Policy | Public | `nexus_index.html#privacy` | Data protection, privacy adherence, cookie disclosure | "Privacy Policy \| Nexus Prime Legal" |
| `/terms` | Terms of Service | Public | `nexus_index.html#terms` | Distributor agreement, code of ethics, refund policy, compliance terms | "Terms of Service \| Nexus Prime (PVT) Ltd" |

---

## 3. Member Protected Application Route Map (Tier 2)

All member routes enforce client-side auth guards (`nexus_token`) and server-side session verification. Unauthorized requests are intercepted and redirected to `/login?redirect=...`.

```
/dashboard (Member App Shell)
   ├── /dashboard          - Executive KPI Cards, Recent Activity, Quick Actions
   ├── /profile            - Personal Profile, KYC Identity, Avatar, Contact Details
   ├── /referrals          - Referral Code, Personal URL with Copy/Share, Direct Referrals
   ├── /network            - Interactive MLM Network Tree, Search Downline, Level Filters
   ├── /team               - Comprehensive Team Directory, Status Filters, Performance
   ├── /wallet             - Available/Pending Balances, Earnings Summary, Financial Statement
   ├── /transactions       - Double-Entry Journal, Date Filters, Transaction Reference Search
   ├── /commissions        - Multi-Tier Commission History, Status, Levels, Source Orders
   ├── /withdrawals        - Payout Request Submission, Sri Lankan Bank Accounts, History
   ├── /my-packages        - Active Enrolled Digital Academy Bundles & Digital Delivery
   ├── /orders             - Purchase Order History, Bank Transfer Deposit Slips, Status
   ├── /notifications      - Real-Time System Announcements, In-App Message Center
   ├── /support            - Help Desk, Corporate FAQ, Ticket Submission
   └── /settings           - Account Security, Password Change, 2FA TOTP Setup, Preferences
```

### Detailed Member Route Registry

| Member Route | Module Name | Primary Responsibilities | Data Sources & API Endpoints |
|---|---|---|---|
| `/dashboard` | Dashboard Overview | Summary cards (Member ID, Status, Directs, Total Network, Balance, Earnings), recent activities, quick action buttons | `GET /api/v1/nexus/member/dashboard` |
| `/profile` | My Profile | View & edit personal details, phone, address, profile image. View locked Member ID, Referral Code, Sponsor ID | `GET /api/v1/nexus/auth/me`, `PUT /api/v1/nexus/member/profile` |
| `/referrals` | My Referrals | Displays referral code, shareable URL, copy button, share buttons, list of direct referrals with status badges | `GET /api/v1/nexus/referrals/my-referrals` |
| `/network` | My Network Tree | Interactive expandable tree visualizer, member level depth, account status badges, downline search box | `GET /api/v1/nexus/network/tree`, `GET /api/v1/nexus/network/downline` |
| `/team` | My Team Directory | Full tabular list of all downline team members across all levels with level filters ($L_1 \dots L_\infty$) | `GET /api/v1/nexus/network/downline` |
| `/wallet` | Member Wallet | Displays Available Balance, Pending Balance, Total Withdrawn, Total Earned. Direct link to withdrawal | `GET /api/v1/nexus/member/dashboard` |
| `/transactions`| Transaction Log | Complete double-entry financial ledger of all credits and debits with running balance tracking | `GET /api/v1/nexus/member/transactions` |
| `/commissions` | Commissions | Detailed commission records, commission types (Direct, Network, etc.), level distance, source transaction | `GET /api/v1/nexus/member/commissions` |
| `/withdrawals` | Withdrawals Desk | Minimum 1,000 LKR threshold check, bank account selector, withdrawal request form, status tracker | `GET /api/v1/nexus/member/withdrawals`, `POST /api/v1/nexus/member/wallet/withdraw` |
| `/my-packages` | My Packages | Active digital training bundles, course progress tracking, classroom links | `GET /api/v1/nexus/member/packages` |
| `/orders` | Order History | Purchases history, manual bank transfer slip status (`PENDING`, `APPROVED`, `REJECTED`), reviewer notes | `GET /api/v1/nexus/member/orders` |
| `/notifications`| Notifications | System alerts, commission notifications, network milestone alerts with unread counter | `GET /api/v1/nexus/member/notifications` |
| `/support` | Support Desk | Customer care inquiries, contact tickets, platform help guide | `GET /api/v1/nexus/member/support` |
| `/settings` | Security & Settings| Password change form, TOTP 2FA setup, email/SMS notification toggles | `PUT /api/v1/nexus/member/settings` |

---

## 4. Admin Protected Application Route Map (Tier 3)

The Admin Application is strictly isolated from the Member Portal. Access requires authenticated session validation with verified `admin` or `super_admin` role.

```
/admin (Admin Command Center)
   ├── /admin                    - System-Wide KPI Counters, Financial Liabilites, Network Growth
   ├── /admin/members            - Member Master Registry, Search, Filter by Status, Suspension Tool
   ├── /admin/members/:id        - Deep-Dive Member Profile, Network Placement, Financial History
   ├── /admin/network            - Global Genealogy Explorer, Tree Search, Orphan Inspection
   ├── /admin/referrals          - Global Sponsor-Referral Analytics, Top Sponsors Leaderboard
   ├── /admin/packages           - Membership Packages & Curriculum Configuration
   ├── /admin/products           - Digital Products & Masterclasses Manager
   ├── /admin/orders             - Order Review & Bank Transfer Deposit Slip Approval Queue
   ├── /admin/commissions        - Commission Ledger Oversight, Solvency Auditing
   ├── /admin/wallet             - Corporate Liability Tracker, Member Balances Audit
   ├── /admin/withdrawals        - Payout Queue, CEFT/SLIPS Bank Export, Mark as Paid
   ├── /admin/transactions       - Global System Journal, Double-Entry Verification
   ├── /admin/reports            - Multi-Format Financial & MLM Performance Reports (CSV/Excel/PDF)
   ├── /admin/notifications      - Broadcast Notifications Composer & System Alerts Queue
   ├── /admin/support            - Member Inquiries & Support Ticket Resolution Desk
   ├── /admin/settings           - Global Platform Configuration & Invariant Overrides
   └── /admin/audit-logs         - Tamper-Evident System Audit Trail & Security Logs
```

### Detailed Admin Route Registry

| Admin Route | Panel Name | Purpose & Capabilities | Primary Security Controls |
|---|---|---|---|
| `/admin` | Overview Dashboard | High-level metrics: Total Members, Active Members, Total Network Volume, Total Commissions, Pending Withdrawals | Admin Auth Guard (`nexus_is_admin`) |
| `/admin/members` | Member Manager | Search, inspect, filter by status (`active`, `pending`, `suspended`, `blocked`), update member standing | Server-side role verification |
| `/admin/network` | Network Explorer | Visual tree exploration starting from root or any member, depth analysis, spillover inspection | Read-only genealogical explorer |
| `/admin/orders` | Deposit Slip Review | Inspect uploaded bank transfer slips, verify against corporate bank statements, approve/reject | Financial mutation audit trail |
| `/admin/withdrawals`| Payout Desk | Batch approve/reject member withdrawal requests, export bank batch files, record bank transfer reference | Double-entry journal lock |
| `/admin/reports` | Financial Reporting | Generate gross sales, net commission liabilities, company reserves, and tax withholding reports | Export rate limit & audit log |
| `/admin/settings` | System Settings | Dynamic platform parameter configuration (company name, domain, orphan policy, commission rates) | Restricted to `super_admin` |
| `/admin/audit-logs`| Audit Trails | Filter and review all security events, authentication attempts, status changes, and admin actions | Append-only immutable log |

---

## 5. Navigation State Matrix & Route Transitions

```
[ Unauthenticated Visitor ]
       │
       ├── Browses Public Pages: /, /about, /opportunity, /packages, /faq
       ├── Registration Flow: /register?ref=CODE ──> Success ──> Sets Session ──> Redirects /dashboard
       └── Login Flow: /login ──> Authenticates ──> Member Role: /dashboard
                                                └── Admin Role: /admin

[ Authenticated Member ]
       │
       ├── Toggles Navigation Sidebar (Dashboard, Profile, Referrals, Network, Team, Wallet...)
       ├── Attempts to access /admin ──> Intercepted (HTTP 403 / Redirected to /dashboard)
       └── Clicks Sign Out ──> Invalidates Token ──> Redirects to /login

[ Authenticated Administrator ]
       │
       ├── Accesses /admin Command Center (Overview, Members, Orders, Withdrawals, Reports...)
       └── Full administrative privileges with immutable audit logging
```
