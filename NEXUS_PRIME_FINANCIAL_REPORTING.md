# NEXUS PRIME (PVT) LTD — FINANCIAL REPORTING ARCHITECTURE
**Domain:** `nexusp.online`  
**System Version:** Financial Reporting & Analytics Engine 1.0.0  
**Target Scope:** Admin Financials, Commission Reporting, Categorical Audits & Export  

---

## 1. System Objectives

The Nexus Prime Financial Reporting & Analytics Engine provides corporate administrators with a centralized, accurate, and immutable view of financial activity across the enterprise. It establishes complete traceability from outward sales to inward commission claims, wallet credits, and bank payout disbursements.

---

## 2. Core Architecture & Reporting Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       NEXUS PRIME FINANCIAL SOURCES                         │
├──────────────┬──────────────────┬─────────────────┬────────────────────────┤
│ Orders       │ Payments         │ Commissions     │ Wallets & Ledger       │
│ (Sales Base) │ (Settled Inflow) │ (MLM Liability) │ (Double-Entry Balance) │
└───────┬──────┴─────────┬────────┴────────┬────────┴────────────┬───────────┘
        │                │                 │                     │
        ▼                ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│             nexus-financial-reporting-service.js (Server Engine)            │
│  - Date Range Calculation (Asia/Colombo UTC+05:30)                          │
│  - Currency Isolation (Zero Synthetic Conversions)                         │
│  - Point-in-Time Historical Snapshots (Orders, Items, Rates, Ranks)         │
│  - 6-Stage Traceability Resolver                                            │
│  - 17-Point Continuous Financial Reconciliation Diagnostic                 │
│  - Sanitized Streaming CSV Export Engine                                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────────┐
│ Admin Panel (/admin/financials)      │  │ Member Dashboard (/dashboard)     │
│ - Global Financial Overview & Charts │  │ - Isolated Commission Summary     │
│ - Multi-Tier Commission Ledger       │  │ - Personal Earnings History       │
│ - Traceability Dossier Modals        │  │ - Zero Cross-Member Visibility    │
│ - Reconciliation Issue Tracker       │  └───────────────────────────────────┘
│ - Categorical Reports (Lvl, Rnk, Pkg)│
└──────────────────────────────────────┘
```

---

## 3. Financial Traceability Chain

Every MLM commission is fully traceable across its lifecycle stages:

$$\text{Payment (P-XXXX)} \longrightarrow \text{Order (NP-ORD-XXXX)} \longrightarrow \text{Commission (NP-COM-XXXX)} \longrightarrow \text{Ledger (L-XXXX)} \longrightarrow \text{Withdrawal (NP-WD-XXXX)} \longrightarrow \text{Bank Payout (Ref-XXXX)}$$

1. **Payment Confirmation:** Gateway webhook verified with transaction reference.
2. **Order Placement:** Historical price snapshot and item configuration frozen.
3. **Commission Calculation:** Multi-level network traversal with snapshot rate and rule version frozen.
4. **Ledger Posting:** Atomic credit entry posted to `nexus_ledger_entries` when approved/credited.
5. **Withdrawal Reservation:** Balance reservation lock preventing double spending.
6. **Bank Payout:** Corporate administrator disbursement with external bank reference and masked account data.

---

## 4. Reports Catalog

1. **Financial Overview (`/admin/financials`):**
   - Consolidated executive dashboard with Sales, Payments, Commissions, Wallets, Withdrawals, Payouts, Net Financial Movement, and Sparkline trends.
2. **Commission Report (`/admin/commissions`):**
   - Full multi-filter tabular ledger with Member, Source Member, Order, Commission Type, Level, Rank, Plan, Version, Rate, Base, Amount, Currency, Status, and action triggers for full traceability dossiers.
3. **Level Report (`/admin/reports/levels`):**
   - Commission volume and record counts grouped dynamically by network depth (Level 1, Level 2, Level 3...). Supports unlimited tree depth.
4. **Rank Report (`/admin/reports/ranks`):**
   - Commission totals categorized by the historical rank held by the beneficiary at the exact moment of qualification.
5. **Package Sales Report (`/admin/reports/packages`):**
   - Total package units sold, gross sales volume, commission generated, and refunds evaluated from immutable order snapshots.
6. **Product Sales Report (`/admin/reports/products`):**
   - Product and SKU units sold, revenue generated, and commission liabilities evaluated from line-item snapshots.
7. **Withdrawal Performance Report (`/admin/reports/withdrawals`):**
   - Pipeline tracking across requested, approved, processing, paid, rejected, and failed states with masked banking information.
8. **Payout Performance Report (`/admin/reports/payouts`):**
   - Completed external bank disbursements with searchable external transaction references and audit timestamps.
9. **Wallet Ledger Report (`/admin/reports/ledger`):**
   - Immutable double-entry financial journal entries with running balance tracking.
10. **Financial Movement Report (`/admin/reports/movement`):**
    - Daily, weekly, or monthly opening balance, credits, debits, withdrawals, reversals, and closing balances derived directly from the ledger.
11. **Member 360 Financial Dossier (`/admin/members/:id/financials`):**
    - Read-only holistic inspection of an individual member's orders, payments, commissions, wallet, and withdrawals.

---

## 5. Security, Permissions & Export Rules

1. **Strict Server-Side Authorization:**
   - Normal members attempting to query administrative financial routes receive HTTP 403 Forbidden.
   - Normal members only query `/api/v1/nexus/member/commissions/summary`, strictly scoped to their authenticated `session.userId`.
2. **Sanitized CSV Exports:**
   - Bank account numbers are masked (`********1234`).
   - Formula injection characters (`=`, `+`, `-`, `@`) at cell beginnings are escaped with a leading single apostrophe (`'`).
   - Exports respect active filters (date, status, currency).
