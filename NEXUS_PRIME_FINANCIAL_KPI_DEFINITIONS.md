# NEXUS PRIME (PVT) LTD — FINANCIAL KPI DEFINITIONS & TIME SEMANTICS SPECIFICATION
**Domain:** `nexusp.online`  
**System Version:** Financial Reporting & Analytics Engine 2.0.0 (Prompt 15A Compliant)  
**Reporting Standard:** Strict Source-Record Double-Entry Accrual & Cash Accounting  
**Canonical Reporting Timezone:** `Asia/Colombo` (UTC+05:30)  
**Strict Interval Standard:** Half-Open Interval ($\text{period\_start} \le \text{timestamp} < \text{period\_end}$)  
**Scope:** Universal Source of Truth for Admin Dashboards, Financial Overview, Reconciliation Engine, Time-Series Charts, Member Reports, and CSV/JSON Exports.

---

> [!IMPORTANT]
> **Strict Source of Truth & Developer Mandate:**  
> Every dashboard metric, financial report, chart, and export in Nexus Prime MUST strictly adhere to the time semantics, timestamp fields, and boundary definitions specified in this document.  
> Under no circumstances may different pages, components, or services interpret the same metric with divergent date fields or boundaries. No metric may be labeled as **"Profit"** unless complete, audited corporate operating expenses, procurement COGS, tax filings, and physical overheads are accounted for.

---

## 1. System Canonical Timezone: `Asia/Colombo` (UTC+05:30)

1. **One Authoritative Timezone:**
   - The canonical reporting timezone for all financial calculations is **`Asia/Colombo` (UTC+05:30)**.
   - Configurable at the platform level via `nexusDb.getSetting('reporting_timezone') || 'Asia/Colombo'`.
2. **Universal Application:**
   - Used for all preset periods (`today`, `yesterday`, `this_week`, `this_month`, `last_month`, `this_quarter`, `this_year`), custom date filters, daily chart buckets, monthly chart buckets, rank qualification periods, commission distribution cycles, and withdrawal reporting.
3. **No Browser Local Timezone:**
   - Client browser local timezones and offsets MUST NEVER influence financial reporting boundaries. An administrator viewing reports in London, Dubai, New York, or Colombo must see the exact same numbers down to the cent.
4. **UTC Storage vs. Colombo Scoping:**
   - All database records store immutable UTC timestamps (ISO 8601, e.g. `2026-08-31T20:00:00.000Z`).
   - Query filters and daily/monthly chart aggregations convert UTC timestamps to Colombo calendar days. For instance, `2026-08-31T20:00:00.000Z` is `2026-09-01 01:30:00 AM` in Colombo and is strictly attributed to September 1, 2026.

---

## 2. Strict Half-Open Interval Rule ($\text{period\_start} \le t < \text{period\_end}$)

1. **Mathematical Definition:**
   $$\text{Included} \iff \text{period\_start} \le \text{timestamp} < \text{period\_end}$$
2. **Inclusive Start:**
   - A transaction with a timestamp exactly matching `period_start` ($t = \text{period\_start}$) IS included.
   - A transaction even 1 millisecond before `period_start` ($t = \text{period\_start} - 1\text{ ms}$) IS EXCLUDED.
3. **Strictly Exclusive End:**
   - A transaction with a timestamp exactly matching `period_end` ($t = \text{period\_end}$) IS EXCLUDED.
   - A transaction 1 millisecond before `period_end` ($t = \text{period\_end} - 1\text{ ms}$, e.g. `23:59:59.999` Colombo) IS INCLUDED.
4. **Prohibition of Approximations:**
   - Implementations MUST NOT use `<= 23:59:59` or similar sub-second approximations, as they drop sub-second transactions occurring between `.000` and `.999`.

---

## 3. Standard Preset Boundaries (Asia/Colombo)

All intervals are defined by an inclusive `period_start` and an exclusive `period_end`:

| Preset | `period_start` (Inclusive) | `period_end` (Exclusive) |
| :--- | :--- | :--- |
| **Today** | Current day `00:00:00.000` Colombo | Next day `00:00:00.000` Colombo |
| **Yesterday** | Previous day `00:00:00.000` Colombo | Current day `00:00:00.000` Colombo |
| **This Week** | Monday of current week `00:00:00.000` Colombo | Next Monday `00:00:00.000` Colombo |
| **This Month** | 1st day of current month `00:00:00.000` Colombo | 1st day of next month `00:00:00.000` Colombo |
| **Last Month** | 1st day of previous month `00:00:00.000` Colombo | 1st day of current month `00:00:00.000` Colombo |
| **This Quarter** | 1st day of current calendar quarter `00:00:00` | 1st day of next calendar quarter `00:00:00` |
| **This Year** | January 1 of current year `00:00:00.000` Colombo | January 1 of next year `00:00:00.000` Colombo |
| **Custom Range** | `start_date` `00:00:00.000` Colombo | `end_date + 1 calendar day` `00:00:00.000` Colombo |

---

## 4. Status-Specific Timestamp Attribution Rules

Metrics must NEVER use generic timestamps when reporting operational states. Each status transition has its own authoritative timestamp:

### 4.1 Orders (`nexus_orders`)
- **Orders Created:** Filtered by `order.created_at`.
- **Paid Orders & Gross Sales Volume:** Filtered by `order.paid_at` (fallback: `order.created_at` if `payment_status === 'paid'`).
- **Completed Orders:** Filtered by `order.completed_at`.
- **Cancelled Orders:** Filtered by `order.cancelled_at`.
- **Refunded Orders:** Filtered by `order.refunded_at`.

### 4.2 Payments (`nexus_payments`)
- **Verified Payments:** Filtered by `payment.verified_at || payment.paid_at`.
- **Initiated / Pending Payments:** Filtered by `payment.created_at`.
- **Failed Payments:** Filtered by `payment.failed_at`.
- **Refunded Payments:** Filtered by `payment.refunded_at`.

### 4.3 MLM Commissions (`nexus_commissions`)
- **Commissions Generated / Created:** Filtered by `commission.created_at`.
- **Commissions Approved:** Filtered by `commission.approved_at || commission.created_at`.
- **Commissions Credited (Liquid Wallet):** Filtered by `commission.credited_at`.
- **Commissions Reversed:** Filtered by `commission.reversed_at`.
- **Commissions Cancelled:** Filtered by `commission.cancelled_at`.

### 4.4 Wallet Ledger Entries (`nexus_ledger_entries`)
- **Ledger Inflows / Outflows:** Filtered by immutable posted timestamp `ledger_entry.created_at`.

### 4.5 Withdrawals & Payouts (`nexus_withdrawals`)
- **Withdrawals Requested:** Filtered by `withdrawal.created_at`.
- **Withdrawals Approved:** Filtered by `withdrawal.approved_at`.
- **Paid Withdrawals (Disbursements):** Filtered by `withdrawal.paid_at`.
- **Rejected Withdrawals:** Filtered by `withdrawal.rejected_at`.
- **Failed External Payouts:** Filtered by `withdrawal.failed_at`.

### 4.6 Refunds (`nexus_refunds`)
- **Refund Timing Standard:** Refunds are attributed to the period in which the refund was issued (`refund.refunded_at`), NEVER backdated to the original order's creation period.
- If an order placed in August is refunded in September:
  - August Gross Sales remains unaffected.
  - September report records the Refund Outflow.

---

## 5. Flow Metrics vs. Stock (Point-in-Time) Metrics

Financial and operational dashboard metrics are strictly partitioned into two categories:

### 5.1 Flow Metrics (Period Bound)
Flow metrics measure activity accumulated over an interval $[\text{period\_start}, \text{period\_end})$. They reset to 0 for periods with no activity:
- Gross Sales Volume
- Verified Payments Volume
- Commissions Generated / Credited
- Withdrawals Paid (Disbursements)
- Refunds Issued
- Ledger Credits and Debits

### 5.2 Stock Metrics (Point-in-Time)
Stock metrics measure system state at a specific snapshot moment and **DO NOT change based on date filter presets**:
- Available Wallet Balance (`current_total_wallet_balance`)
- Reserved / Pending Withdrawal Balance
- Active Member Count
- Inventory Levels

---

## 6. Historical Opening & Closing Balances

For any historical period $[\text{period\_start}, \text{period\_end})$:
1. **Opening Balance:**
   $$\text{Opening Balance} = \sum_{t < \text{period\_start}} \text{Credit} - \sum_{t < \text{period\_start}} \text{Debit}$$
2. **Closing Balance:**
   $$\text{Closing Balance} = \sum_{t < \text{period\_end}} \text{Credit} - \sum_{t < \text{period\_end}} \text{Debit}$$
3. **Fundamental Mathematical Identity:**
   $$\text{Closing Balance} \equiv \text{Opening Balance} + \text{Period Inflow} - \text{Period Outflow}$$

---

## 7. Continuous Time-Series Guarantee (Zero-Fill)

1. **Continuous Daily Buckets:**
   - Daily charts (e.g. last 30 days, custom date range) MUST pre-fill continuous calendar days between `period_start` and `period_end`.
   - Days with zero transactions MUST return `{ date: 'YYYY-MM-DD', sales: 0, commissions: 0, payouts: 0 }`.
   - Empty days are NEVER omitted. The time axis must remain uninterrupted.
2. **Continuous Monthly Buckets:**
   - Monthly charts MUST pre-fill continuous calendar months between `period_start` and `period_end`.
   - Empty months return `{ month: 'YYYY-MM', sales: 0, commissions: 0, payouts: 0 }`.

---

## 8. Multi-Currency Separation

1. **No Conflated Aggregation:**
   - `LKR` and `USD` (or other currencies) MUST NEVER be added together without explicit, settled exchange rates.
2. **Currency Scoping:**
   - The admin overview filters records by currency (`currency = 'LKR'`, `currency = 'USD'`).
   - Default reporting is in platform currency (`LKR`).
   - All summary cards and breakdown blocks display the exact currency code of the query.

---

## 9. Export vs. API Report Exact Consistency

1. **1-to-1 Mathematical Parity:**
   - CSV and JSON exports (`/api/v1/nexus/admin/reports/export`) use the exact same `resolveDateRange()` service method and half-open filtering engine as the dashboard APIs.
   - For any date range and currency filter, the total rows and sums in the exported CSV match the JSON endpoint down to the exact rupee and cent.

---

## 10. The 8 Canonical Questions — Master Metric Matrix

Every financial KPI answers the 8 canonical questions:

| Metric Name | 1. Date Field | 2. `period_start` | 3. `period_end` | 4. Timezone | 5. Status Filter | 6. Currency | 7. Aggregation | 8. Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Gross Sales Volume** | `paid_at` | Range Start 00:00:00 | Range End (Exclusive) | Colombo (+05:30) | `payment_status IN ('paid', 'completed')` | Per Currency | Sum of `order.total` | Flow |
| **Orders Created** | `created_at` | Range Start 00:00:00 | Range End (Exclusive) | Colombo (+05:30) | All statuses | Per Currency | Count of orders | Flow |
| **Verified Payments** | `verified_at` | Range Start 00:00:00 | Range End (Exclusive) | Colombo (+05:30) | `status = 'paid'` | Per Currency | Sum of `payment.amount` | Flow |
| **Pending Payments** | `created_at` | Range Start 00:00:00 | Range End (Exclusive) | Colombo (+05:30) | `status IN ('initiated', 'pending')` | Per Currency | Sum of `payment.amount` | Flow |
| **Commissions Generated** | `created_at` | Range Start 00:00:00 | Range End (Exclusive) | Colombo (+05:30) | `status != 'cancelled'` | Per Currency | Sum of `commission.amount` | Flow |
| **Commissions Approved** | `approved_at` | Range Start 00:00:00 | Range End (Exclusive) | Colombo (+05:30) | `status = 'approved'` | Per Currency | Sum of `commission.amount` | Flow |
| **Commissions Credited** | `credited_at` | Range Start 00:00:00 | Range End (Exclusive) | Colombo (+05:30) | `status = 'credited'` | Per Currency | Sum of `commission.amount` | Flow |
| **Commissions Reversed** | `reversed_at` | Range Start 00:00:00 | Range End (Exclusive) | Colombo (+05:30) | `status = 'reversed'` | Per Currency | Sum of `commission.amount` | Flow |
| **Withdrawal Requests** | `created_at` | Range Start 00:00:00 | Range End (Exclusive) | Colombo (+05:30) | All statuses | Per Currency | Sum of `requested_amount` | Flow |
| **Withdrawals Paid** | `paid_at` | Range Start 00:00:00 | Range End (Exclusive) | Colombo (+05:30) | `status = 'paid'` | Per Currency | Sum of `requested_amount` | Flow |
| **Net Payout Volume** | `paid_at` | Range Start 00:00:00 | Range End (Exclusive) | Colombo (+05:30) | `status = 'paid'` | Per Currency | Sum of `net_amount` | Flow |
| **Payout Fees** | `paid_at` | Range Start 00:00:00 | Range End (Exclusive) | Colombo (+05:30) | `status = 'paid'` | Per Currency | Sum of `processing_fee` | Flow |
| **Refunds Volume** | `refunded_at` | Range Start 00:00:00 | Range End (Exclusive) | Colombo (+05:30) | `status = 'refunded'` | Per Currency | Sum of `refund.amount` | Flow |
| **Wallet Available Balance** | N/A (Snapshot) | N/A | Current Moment | Colombo (+05:30) | `status = 'active'` | Per Currency | Sum of `wallet.balance` | **Stock** |
| **Pending Reserved Balance** | N/A (Snapshot) | N/A | Current Moment | Colombo (+05:30) | `status IN ('pending', 'processing')` | Per Currency | Sum of reserved amounts | **Stock** |
| **Historical Opening Balance**| `created_at` | $t < \text{period\_start}$ | $\text{period\_start}$ | Colombo (+05:30) | `status = 'posted'` | Per Currency | $\sum \text{Credits} - \sum \text{Debits}$ | Stock Snapshot |
| **Historical Closing Balance**| `created_at` | $t < \text{period\_end}$ | $\text{period\_end}$ | Colombo (+05:30) | `status = 'posted'` | Per Currency | $\sum \text{Credits} - \sum \text{Debits}$ | Stock Snapshot |
| **Net Financial Movement** | Status-specific | Range Start 00:00:00 | Range End (Exclusive) | Colombo (+05:30) | Posted / verified | Per Currency | Payments - Payouts - Refunds | Flow |

---

## 11. Automated Verification Standard

All rules in this specification are permanently safeguarded by automated regression tests:
- **Test Suite:** `test/nexus-foundation.test.js`
- **Total Test Count:** 169 tests (Tests 143 to 162 validate the 20 time semantic boundary conditions).
- **Execution Command:** `node test/nexus-foundation.test.js`
