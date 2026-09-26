# NEXUS PRIME (PVT) LTD — FINANCIAL RECONCILIATION SPECIFICATION
**Domain:** `nexusp.online`  
**System Version:** Financial Reconciliation Engine 1.0.0  
**Compliance Standard:** Automated Anomaly Detection & Non-Destructive Audit  
**Scope:** Continuous Audit of Commissions, Ledgers, Wallets, Withdrawals & Payouts  

---

> [!IMPORTANT]
> **Non-Destructive Reconciliation Principle:**  
> The reconciliation engine detects and records financial discrepancies, but **NEVER automatically modifies or mutates authoritative financial records**. Discrepancies are persisted as structured issues in `nexus_financial_reconciliation_issues` with investigation lifecycles (`open`, `investigating`, `resolved`, `ignored`) and mandatory administrative resolution notes.

---

## 1. The 17 Automated Reconciliation Checks

The reconciliation engine executes a continuous 17-point audit across all financial source records:

| Check # | Code | Severity | Description & Detection Rule | Expected vs. Actual Relationship |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `COMMISSION_CREDITED_NO_LEDGER` | `CRITICAL` | Commission marked `status = 'credited'` has no matching credit entry in `nexus_ledger_entries`. | Expected matching `nexus_ledger_entry` with `reference_type = 'commission'` and `reference_id = commission.id`. |
| **2** | `LEDGER_CREDIT_NO_COMMISSION` | `CRITICAL` | Ledger entry with `entry_type = 'commission'` references a commission ID that does not exist or has non-credited status. | Expected valid, existing commission with status `credited`. |
| **3** | `PAID_WITHDRAWAL_NO_DEBIT` | `CRITICAL` | Withdrawal marked `status = 'paid'` has no corresponding debit in `nexus_ledger_entries`. | Expected matching `DEBIT` entry in ledger with `entry_type = 'withdrawal'` and `reference_id = withdrawal.id`. |
| **4** | `WALLET_DEBIT_NO_WITHDRAWAL` | `CRITICAL` | Ledger debit with `entry_type = 'withdrawal'` references a withdrawal ID that does not exist or is not in `paid` status. | Expected valid, existing withdrawal record with status `paid`. |
| **5** | `DUPLICATE_COMMISSION` | `HIGH` | Multiple commission records generated for the identical `(order_id, beneficiary_id, commission_type, commission_level)`. | Expected exactly one commission per order/beneficiary/type/level combination. |
| **6** | `DUPLICATE_WALLET_POSTING` | `CRITICAL` | Multiple ledger entries found for the same `(reference_type, reference_id, entry_type)`. | Expected strict uniqueness under idempotency keys. |
| **7** | `DUPLICATE_PAYOUT` | `HIGH` | Multiple paid withdrawals share the exact same external bank `payout_reference`. | Expected each external banking payout reference to be globally unique. |
| **8** | `WITHDRAWAL_AMOUNT_MISMATCH` | `HIGH` | Amount on the withdrawal record does not match the amount debited in the corresponding ledger entry. | `withdrawal.requested_amount == ledger_entry.amount`. |
| **9** | `COMMISSION_AMOUNT_MISMATCH` | `HIGH` | Amount on the credited commission does not match the amount credited in the matching ledger entry. | `commission.amount == ledger_entry.amount`. |
| **10** | `CURRENCY_MISMATCH` | `MEDIUM` | Withdrawal, commission, or ledger entry currency codes do not match between related records. | Related records must share identical ISO currency strings (e.g. `LKR`). |
| **11** | `NEGATIVE_WALLET_BALANCE` | `CRITICAL` | Derived wallet ledger balance is less than zero ($\sum \text{Credits} - \sum \text{Debits} < 0$). | Wallet balances must always satisfy $\ge 0.00$. |
| **12** | `MISSING_REFERENCE` | `MEDIUM` | Financial transaction lacks required business reference (`order_id`, `withdrawal_id`, or `user_id`). | Mandatory business reference keys must be populated. |
| **13** | `ORPHANED_LEDGER_ENTRY` | `HIGH` | Ledger entry references an entity ID that does not exist in any system collection. | Referenced entity must exist in the database. |
| **14** | `INVALID_STATUS_SEQUENCE` | `MEDIUM` | Financial record jumped statuses illegally (e.g. withdrawal `pending` directly to `paid` without `approved`). | Lifecycle must adhere to strict state transition state machines. |
| **15** | `PAID_WITHDRAWAL_NO_REF` | `HIGH` | Withdrawal marked `status = 'paid'` has an empty or null `payout_reference`. | External bank transaction reference is strictly mandatory upon payment confirmation. |
| **16** | `PAID_WITHDRAWAL_NO_PAID_AT` | `MEDIUM` | Withdrawal marked `status = 'paid'` has null `paid_at` timestamp. | Settlement timestamp is mandatory for audited accounting. |
| **17** | `PAID_WITHDRAWAL_NO_PAID_BY` | `MEDIUM` | Withdrawal marked `status = 'paid'` has null `paid_by` administrator attribution. | Disbursing administrator ID must be recorded for corporate accountability. |

---

## 2. Issue Lifecycle & Resolution Notes Protocol

Reconciliation findings transition through a 4-state lifecycle:

```
[ OPEN ] ───► [ INVESTIGATING ] ───► [ RESOLVED ]
   │                                       ▲
   └────────────────► [ IGNORED ] ─────────┘
```

1. **Open:** Discrepancy detected by automated diagnostic scan.
2. **Investigating:** Assigned to corporate compliance officer or administrator for review.
3. **Resolved:** Discrepancy addressed through legitimate compensating entry or correction, accompanied by required administrative resolution notes.
4. **Ignored:** Authorized administrative override with justification (e.g., test transaction in sandbox mode).

**Non-Deletion Guarantee:** Issues are never deleted from `nexus_financial_reconciliation_issues`. An immutable historical record of every detected anomaly is preserved indefinitely for audit compliance.
