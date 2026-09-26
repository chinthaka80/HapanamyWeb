# NEXUS PRIME (PVT) LTD — FINANCIAL SECURITY & INTEGRITY GOVERNANCE
**Domain:** `nexusp.online`  
**System Version:** Nexus Prime Financial Engine 3.0.0  
**Compliance Standard:** Double-Entry Ledger Security & Immutability  
**Target Scope:** `nexus_wallets`, `nexus_ledger_entries`, `nexus_audit_logs`

---

> [!IMPORTANT]
> **Mandatory Disclaimer:**  
> *Production financial/withdrawal policies require configuration.*

---

## 1. Executive Summary & Security Foundations

The financial engine of Nexus Prime is engineered on a zero-trust, ledger-authoritative financial paradigm. Direct manipulation of account balances is strictly barred at both the code and database architectural layers. Every Sri Lankan Rupee (`LKR`) that flows into, within, or out of the Nexus Prime platform is accounted for as an immutable historical journal entry.

---

## 2. Core Financial Security Controls

### 2.1 Immutability of Historical Journal Entries
- **Append-Only Store**: In PostgreSQL, the `nexus_ledger_entries` table operates as an append-only transaction stream.
- **SQL Hardening**: In production deployments, `UPDATE` and `DELETE` privileges on `nexus_ledger_entries` are revoked for the standard application database user:
  ```sql
  REVOKE UPDATE, DELETE ON nexus_ledger_entries FROM nexus_app_user;
  GRANT SELECT, INSERT ON nexus_ledger_entries TO nexus_app_user;
  ```
- **Compensating Postings**: If an entry was posted in error (e.g., fraudulent order or miscalculated bonus), the entry remains in the database marked `reversed`, and an opposite compensating transaction is posted with clear reference to the original.

### 2.2 Mathematical Negative Balance Prevention
- At no point may a member or administrator withdraw or debit funds exceeding the member's current available balance.
- Balance verification is executed synchronously before any debit ledger entry is appended:
  ```javascript
  const currentBalance = this.calculateAvailableBalance(walletId);
  if (currentBalance < debitAmount) {
      throw new Error(`INSUFFICIENT_FUNDS: Available balance (LKR ${currentBalance.toFixed(2)}) is less than requested debit (LKR ${debitAmount.toFixed(2)})`);
  }
  ```
- Any operation violating this rule is rejected with an HTTP 400 `INSUFFICIENT_FUNDS` error.

### 2.3 Strict Idempotency & Replay Protection
- Network blips, gateway retries, or duplicate webhook dispatches must never generate phantom credits.
- Idempotency is enforced by compound uniqueness:
  `UNIQUE (reference_type, reference_id, entry_type)`
- Example: If commission `comm-00042` is credited to a member, subsequent calls with the same commission ID will detect the existing entry, log an idempotency hit, and return the original ledger entry without duplicate fund allocation.

### 2.4 Cross-Tenant Financial Isolation
- Member endpoints enforce strict ownership verification using JWT claims (`req.member.id`).
- When a member queries `GET /api/v1/nexus/member/wallet/transactions/:id`:
  ```javascript
  if (entry.member_id !== req.member.id) {
      return res.status(403).json({ 
          success: false, 
          error: "Forbidden: Cross-tenant ledger inspection is strictly prohibited." 
      });
  }
  ```
- A member cannot view or infer another distributor's ledger history, earnings, or balance.

### 2.5 Multi-Tenant Separation from Hapanamy.lk
- Nexus Prime maintains complete logical, operational, and database isolation from `hapanamy.lk`.
- No shared database tables, connection strings, session cookies, API keys, or financial records exist between the two platforms.

---

## 3. Administrative Governance & Audit Controls

### 3.1 Controlled Manual Financial Adjustments
- The Nexus Prime Admin Panel does not provide an "edit balance" field.
- System administrators who need to issue a manual financial credit or deduction (e.g., resolving a customer support ticket, goodwill credit, or fee correction) must utilize the **Controlled Ledger Adjustment Protocol**:
  1. **Mandatory Admin Reason**: The administrator must provide an unambiguous, auditable justification string.
  2. **Reference Category**: Categorizes the adjustment (e.g. `support_ticket`, `fee_reversal`, `goodwill_bonus`).
  3. **Immutable Posting**: The adjustment is committed as a first-class `nexus_ledger_entry` with `entry_type: 'adjustment'`.
  4. **Tamper-Proof Audit Trail**: An entry is immediately recorded in `nexus_audit_logs` capturing:
     - `action`: `'ADMIN_WALLET_ADJUSTMENT'`
     - `entity_type`: `'nexus_wallets'`
     - `actor_id`: Administrator's ID
     - `payload`: Amount, direction, reason, previous balance, new balance, IP address.

### 3.2 Transaction Reversal Auditing
- Administrative reversals require a mandatory justification and are restricted to posted transactions.
- Already reversed entries or reversal compensating entries themselves cannot be reversed again.
- Recorded in `nexus_audit_logs` as `'TRANSACTION_REVERSED'`.

---

## 4. System Reconciliation & Automated Diagnostics

Nexus Prime includes a deep-inspection diagnostic engine accessible via `GET /api/v1/nexus/admin/financial/reconciliation`:

```
┌──────────────────────────────────────────────────────────────┐
│       NEXUS PRIME FINANCIAL RECONCILIATION DIAGNOSTICS       │
├──────────────────────────────────────────────────────────────┤
│ 1. Balance Integrity:                                        │
│    Re-calculates Σ(Credits) - Σ(Debits) for every wallet     │
│    and asserts zero discrepancy against cached balances.     │
│                                                              │
│ 2. Idempotency Collision Check:                              │
│    Verifies zero duplicates across (reference_type,          │
│    reference_id, entry_type) tuples.                         │
│                                                              │
│ 3. Commission Crediting Synchronization:                     │
│    Flags any commission record in status 'approved' that     │
│    has not yet been posted to a member's ledger.             │
│                                                              │
│ 4. Orphaned Entry Detection:                                 │
│    Ensures every ledger entry references a valid, active     │
│    member wallet.                                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Security Checklist for Production Deployment

- [ ] Ensure PostgreSQL database credentials for the web application have `REVOKE UPDATE, DELETE ON nexus_ledger_entries`.
- [ ] Configure multi-factor authentication (MFA) for all Nexus Prime corporate administrators.
- [ ] Set up automated hourly cron jobs running `/api/v1/nexus/admin/financial/reconciliation` with alerts sent to corporate security channels if `balance_discrepancies.length > 0`.
- [ ] Set up automated daily reconciliation for `/api/v1/nexus/admin/withdrawals/reconciliation` ensuring zero missing ledger entries and zero duplicate payout references.
- [ ] Configure webhook HMAC signature secrets for external payment gateways.
- [ ] Conduct pre-launch financial penetration testing and withdrawal rate-limiting audits.

---

## 6. Prompt 13 Withdrawal & Payout Security Controls

### 6.1 Balance Reservation Pipeline
- To prevent race conditions and double-spending without premature ledger debits, withdrawals implement a reservation lock:
  $$\text{Available Balance} = \text{Ledger Balance} - \text{Active Pipeline Reservations}$$
- Active reservation states: `pending`, `under_review`, `approved`, `processing`.
- Funds are only subtracted from available balance; the ledger balance remains untouched until payout confirmation.

### 6.2 Zero Double-Deduction Guarantees
- When `markAsPaid` is executed by an authorized administrator:
  1. The withdrawal status updates to `paid` (releasing the reservation lock).
  2. Simultaneously, a formal `DEBIT` entry is posted to `nexus_ledger_entries`.
  3. The distributor's net available balance remains constant across the operation:
     - Before mark-paid: $\text{Ledger} - \text{Reservation} = \text{Balance}$
     - After mark-paid: $(\text{Ledger} - \text{Amount}) - 0 = \text{Balance}$

### 6.3 Zero Ledger Debits on Cancellation or Denial
- When a withdrawal is cancelled by the distributor or rejected/failed by an administrator:
  - Status updates to `cancelled`, `rejected`, or `failed`.
  - Reservation lock is immediately released.
  - Zero ledger debit entries are written to `nexus_ledger_entries`.
  - Member's available balance is fully restored with zero financial distortion.

### 6.4 Bank Account Masking & Quarantine
- Bank account numbers are masked (`********1234`) across all public APIs, member profiles, dashboards, and standard administrative listing endpoints.
- Unmasked account numbers are quarantined strictly to `GET /api/v1/nexus/admin/withdrawals/:id` accessed by corporate administrators during active manual wire transfer execution.

### 6.5 External Payout Idempotency
- Manual payouts require a non-empty `payout_reference` (e.g. CEFT or SLIPS wire reference).
- Submitting `markAsPaid` with an already processed withdrawal returns `{ idempotent: true, already_paid: true }` and creates zero duplicate ledger debits.

---

## 7. Prompt 15 Financial Reporting & Audit Security Controls

### 7.1 Real-Time vs. Cached Data Integrity
- Reporting queries read authoritative transaction rows from `nexus_orders`, `nexus_payments`, `nexus_commissions`, `nexus_ledger_entries`, and `nexus_withdrawals`.
- No derived balance or financial total may be cached without a declared maximum TTL (60 seconds) and explicit freshness header.
- Cached frontend numbers are never trusted for financial operations or ledger balances.

### 7.2 Read-Only Reporting Safeguards
- Financial reporting endpoints (`/api/v1/nexus/admin/financials/*` and `/api/v1/nexus/admin/reports/*`) are strictly **READ-ONLY**.
- No mutation of ledger records, order totals, commission rates, or wallet balances can be initiated via reporting interfaces.
- Reconciliation tools allow recording investigation notes and status updates, but strictly bar mutation of underlying financial rows.

### 7.3 Multi-Level Cross-Tenant Privacy & RLS
- Normal members are prevented by JWT role middleware from querying `/admin/financials` and any administrative reporting APIs (HTTP 403 Forbidden).
- Member reporting queries (`/api/v1/nexus/member/commissions/summary`) enforce database-level parameterization using `session.userId`.
- No member can infer, browse, or export the earnings, volume, or withdrawal history of any other member.

### 7.4 Safe CSV Export & Formula Injection Sanitization
- All tabular financial exports (`/api/v1/nexus/admin/reports/export`) strip or escape formula-injection prefixes (`=`, `+`, `-`, `@`) with a leading apostrophe (`'`).
- Sensitive banking account numbers are masked (`********1234`) in all CSV downloads.
- Exports enforce server-side streaming / pagination bounds (maximum 5,000 records per synchronous download) to prevent memory exhaustion attacks.

### 7.5 Continuous 17-Point Reconciliation Monitoring
- An automated audit sweeps the database continuously or on-demand to detect discrepancies between commissions, ledger entries, withdrawals, and bank payouts.
- Anomalies are logged as non-destructive issue records in `nexus_financial_reconciliation_issues` with mandatory resolution notes and audit logging.


