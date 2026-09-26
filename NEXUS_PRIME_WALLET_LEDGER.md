# NEXUS PRIME (PVT) LTD — WALLET & FINANCIAL LEDGER SYSTEM
**Domain:** `nexusp.online`  
**System Version:** Nexus Prime Financial Engine 3.0.0  
**Schema Migration:** `nexus_migrations/008_create_nexus_wallet_ledger_schema.sql`  
**Core Service:** `nexus_backend/services/nexus-wallet-service.js`  
**Data Repository:** `nexus_backend/db/nexus-db.js`

---

> [!IMPORTANT]
> **Mandatory Disclaimer:**  
> *Production financial/withdrawal policies require configuration.*

---

## 1. Architectural Philosophy: The Ledger-First Principle

Traditional web applications frequently store account balances as mutable numerical values directly on the user row (`members.balance = members.balance + 1000`). This legacy pattern is vulnerable to race conditions, silent database corruption, lost update anomalies, and makes audit forensics impossible.

Nexus Prime implements a **Strict Double-Entry Ledger-First Architecture**:

1. **Balances are purely derived**: A member's available balance does not exist as an independently editable scalar. It is derived in real-time as:
   $$\text{Available Balance} = \sum \text{Posted Credits} - \sum \text{Posted Debits}$$
2. **Immutability**: Historical ledger records are permanently immutable. Once written (`status = 'posted'`), rows in `nexus_ledger_entries` cannot be modified or deleted.
3. **Compensating Adjustments**: All corrections, cancellations, or disputes must be executed through new, counterbalancing compensating entries (`reversal` or `adjustment`) with mandatory audit references.
4. **Isolated Financial Currency**: All ledger accounting is maintained in standard Sri Lankan Rupees (`LKR`) with 2-decimal fractional cent precision.

```
                                  NEXUS PRIME FINANCIAL PIPELINE
                                  
  Verified Payment ──► Paid Order ──► Commission Engine ──► Commission Record
                                                                (approved)
                                                                    │
                                                                    ▼
                                                            ┌───────────────┐
                                                            │ Wallet Ledger │
                                                            │    (CREDIT)   │
                                                            └───────┬───────┘
                                                                    ▼
                                                            Commission Record
                                                                (credited)
                                                                    │
                                                                    ▼
                                                            Member Available
                                                                 Balance
                                                                    │
                                                                    ▼
                                                            Future Withdrawal
                                                                Disbursement
```

---

## 2. Database Schema Specification

### 2.1 `nexus_wallets` Table
Maintains the individual member wallet metadata container and currency binding:

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | Unique wallet identifier (`wal-mem-xxxxxx`) |
| `member_id` | `VARCHAR(64)` | `NOT NULL, UNIQUE` | Foreign key referencing `nexus_members(id)` |
| `currency` | `VARCHAR(10)` | `NOT NULL DEFAULT 'LKR'` | ISO Currency code |
| `status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'active'` | Lifecycle status (`active`, `suspended`, `closed`) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Wallet creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last modification timestamp |

### 2.2 `nexus_ledger_entries` Table
The authoritative, tamper-proof financial journal:

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | Ledger entry identifier (`tx-xxxxxx`) |
| `wallet_id` | `VARCHAR(64)` | `NOT NULL, FK` | References `nexus_wallets(id)` |
| `member_id` | `VARCHAR(64)` | `NOT NULL, FK` | Direct foreign key to `nexus_members(id)` |
| `reference_type`| `VARCHAR(40)` | `NOT NULL` | Event origin (`commission`, `order`, `adjustment`, `withdrawal`, `reversal`) |
| `reference_id` | `VARCHAR(64)` | `NOT NULL` | Source entity ID (e.g. `comm-xxxxxx`, `ord-xxxxxx`) |
| `entry_type` | `VARCHAR(30)` | `NOT NULL` | Category (`commission`, `adjustment`, `withdrawal`, `reversal`, `payout`) |
| `direction` | `VARCHAR(10)` | `NOT NULL` | Direction of funds (`CREDIT` or `DEBIT`) |
| `amount` | `DECIMAL(14,2)` | `NOT NULL, CHECK (> 0)` | Absolute transaction value in LKR |
| `balance_before`| `DECIMAL(14,2)` | `NOT NULL` | Derived balance prior to entry posting |
| `balance_after` | `DECIMAL(14,2)` | `NOT NULL` | Resulting ledger balance post entry |
| `currency` | `VARCHAR(10)` | `NOT NULL DEFAULT 'LKR'` | Currency denomination |
| `status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'posted'`| Entry status (`posted`, `reversed`, `failed`) |
| `description` | `TEXT` | `NULL` | Human-readable audit narrative |
| `metadata` | `JSONB` | `DEFAULT '{}'` | Structured context (admin ID, reason, IP address) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Cryptographic timeline insertion |

### 2.3 Strict Idempotency Constraint
To mathematically preclude duplicate credits or debits resulting from network retries, webhook re-deliveries, or concurrent worker processing:
```sql
ALTER TABLE nexus_ledger_entries 
ADD CONSTRAINT uq_nexus_ledger_idempotency 
UNIQUE (reference_type, reference_id, entry_type);
```

---

## 3. Transaction Types & Lifecycle

```
                 ┌────────────────────────────────────────────────┐
                 │                TRANSACTION TYPES               │
                 ├────────────────────────┬───────────────────────┤
                 │         CREDIT         │         DEBIT         │
                 ├────────────────────────┼───────────────────────┤
                 │ • commission           │ • withdrawal          │
                 │ • adjustment (credit)  │ • adjustment (debit)  │
                 │ • reversal (of debit)  │ • reversal (of credit)│
                 └────────────────────────┴───────────────────────┘
```

### 3.1 Commission Crediting Flow
1. Commission record is generated by the MLM Commission Engine in status `'approved'`.
2. `NexusWalletService.creditApprovedCommission(commissionId)` executes:
   - Validates that commission exists and is in status `'approved'`.
   - Checks idempotency: if already credited, returns existing entry safely.
   - Posts a `CREDIT` entry to the beneficiary's wallet:
     - `reference_type`: `'commission'`
     - `reference_id`: `commissionId`
     - `entry_type`: `'commission'`
     - `direction`: `'CREDIT'`
   - Updates commission record: `status = 'credited'`, `credited_at = NOW()`, `ledger_entry_id = tx.id`.
   - Logs an authoritative audit record `COMMISSION_CREDITED_TO_WALLET`.

### 3.2 Negative Balance Protection
When posting a `DEBIT` operation (such as a future withdrawal or fee deduction):
```javascript
const currentBalance = this.calculateAvailableBalance(walletId);
if (currentBalance < amount) {
    throw new Error(`INSUFFICIENT_FUNDS: Available balance (LKR ${currentBalance.toFixed(2)}) is less than requested debit (LKR ${amount.toFixed(2)})`);
}
```
Debits that would cause an account balance to fall below zero are immediately aborted at the domain logic level.

### 3.3 Reversals & Compensating Entries
Ledger records are never deleted. When an administrative transaction reversal is performed:
1. The original transaction is flagged as `status = 'reversed'`.
2. An opposing compensating entry is generated:
   - If original was `CREDIT`, compensating is `DEBIT`.
   - If original was `DEBIT`, compensating is `CREDIT`.
   - `reference_type`: `'reversal'`
   - `reference_id`: `originalTx.id`
   - `entry_type`: `'reversal'`
3. Complete audit log created recording Admin ID, timestamp, and mandatory justification.

---

## 4. API Endpoints

### 4.1 Member Endpoints (Authenticated Member JWT)
- `GET /api/v1/nexus/member/wallet`: Returns wallet metadata, live available balance, pending commission volume, total historical credits, and debits.
- `GET /api/v1/nexus/member/wallet/transactions`: Returns paginated member ledger entries with filtering by direction and entry type.
- `GET /api/v1/nexus/member/wallet/transactions/:id`: Returns full details for a single transaction. Strictly enforces cross-member tenant isolation (403 Forbidden if accessed by another member).

### 4.2 Administrator Endpoints (Admin JWT Required)
- `GET /api/v1/nexus/admin/wallets`: Returns master directory of all member wallets with search, status filters, and real-time ledger balances.
- `GET /api/v1/nexus/admin/wallets/:id`: Returns dossier of specific wallet with complete ledger history.
- `GET /api/v1/nexus/admin/transactions`: Global double-entry journal across the entire organization with direction, type, search, and date filters.
- `GET /api/v1/nexus/admin/transactions/:id`: Deep audit inspection for a specific ledger entry including complete metadata and audit trail.
- `POST /api/v1/nexus/admin/wallet/adjustment`: Posts a controlled financial adjustment (`CREDIT` or `DEBIT`) with mandatory justification.
- `POST /api/v1/nexus/admin/transactions/:id/reverse`: Issues a compensating reversal entry.
- `POST /api/v1/nexus/admin/commissions/:id/credit-to-wallet`: Manually triggers wallet crediting for an approved commission.
- `GET /api/v1/nexus/admin/financial/reconciliation`: Runs a system-wide diagnostic checking for balance discrepancies, duplicate references, and uncredited approved commissions.
- `GET /api/v1/nexus/admin/financial/overview`: System-wide KPI summary (total credits, total debits, net balance reserve liability, total wallets).

---

## 5. Future Withdrawal Integration Roadmap

Nexus Prime Prompt 12 establishes the foundational financial ledger. Bank withdrawal processing will be integrated in Phase 2:
1. **Withdrawal Request**: Member requests withdrawal $\to$ Ledger records a pending `DEBIT` hold (`entry_type: 'withdrawal'`, `status: 'pending'`), decreasing available balance.
2. **KYC & Minimum Threshold Verification**: Ensures account status is active, verified Sri Lankan NIC/bank account, and threshold ($\ge \text{LKR 2,000}$) is met.
3. **Administrative Approval**: Admin reviews and approves withdrawal batch.
4. **CEFT Bank Payout**: Payout file exported to Commercial Bank of Ceylon / Sampath Bank CEFT gateway.
5. **Settlement Confirmation**: Upon bank receipt confirmation, entry transitions to `posted`. If bank rejects payout, the hold is released via compensating credit.
