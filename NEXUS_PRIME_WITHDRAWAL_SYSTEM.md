# NEXUS PRIME (PVT) LTD — SECURE BANK WITHDRAWAL & ADMIN MANUAL PAYOUT SYSTEM
**Domain:** `nexusp.online`  
**Module:** Member Bank Withdrawals & Corporate Manual Payout Desk  
**Prompt Implementation:** Prompt 13  
**Architecture Source of Truth:** Double-Entry Financial Ledger + Balance Reservation Pipeline  

---

## 1. Executive Architecture Overview

The Nexus Prime Bank Withdrawal & Admin Manual Payout System enables verified distributors to request bank wire withdrawals in Sri Lankan Rupees (LKR) from their accumulated commission wallet balances. The system enforces strict financial immutability, zero double-deduction guarantees, atomic ledger debiting, and zero automated third-party bank disbursements.

### Core Architecture Principles:
1. **Ledger as Immutable Source of Truth:**
   All distributor balances derive mathematically from double-entry ledger entries in `nexus_ledger_entries`.
2. **Balance Reservation Locks (No Premature Debits):**
   When a member requests a withdrawal, funds are **not** immediately debited from the financial ledger. Instead, a **Pipeline Balance Reservation** lock is placed, reducing the member's *Available Balance* while leaving the *Ledger Balance* intact.
   $$\text{Available Balance} = \text{Ledger Balance} - \sum_{\text{status} \in \{\text{pending, under\_review, approved, processing}\}} \text{Requested Amount}$$
3. **Atomic Debit Upon Payout Confirmation:**
   When an authorized corporate administrator manually executes the wire transfer via their corporate banking terminal (CEFT / SLIPS / LankaPay) and clicks **"Mark as Paid"** with a mandatory external banking reference number:
   - Status transitions from `processing` to `paid` (releasing the reservation lock).
   - An atomic `DEBIT` entry is posted to `nexus_ledger_entries`.
   - Result: Available balance remains perfectly constant before and after the debit, guaranteeing **Zero Double-Deduction**.
4. **Reservation Release on Denial / Reversal:**
   If a withdrawal is cancelled by the member or rejected/failed by an administrator, the status transitions to `cancelled`, `rejected`, or `failed`. The reservation lock is instantly released back to the member's available balance, and **zero ledger debits** are created.
5. **Point-in-Time Bank Snapshots:**
   At the exact moment of withdrawal creation, a frozen snapshot of the member's bank details (`bank_name`, `branch_name`, `branch_code`, `account_name`, `account_number_masked`) is embedded into the withdrawal record. Subsequent changes to the member's bank accounts do not alter active or historical withdrawal records.
6. **Masked Bank Account Security:**
   Account numbers are masked everywhere (`********1234`) across public views, member dashboards, standard admin lists, and logs. Unmasked account numbers are quarantined exclusively to authorized administrators accessing the secure Wire Transfer Desk modal.

---

## 2. Withdrawal Lifecycle State Machine

```
                                ┌───────────────┐
                                │ Member Balance│
                                └───────┬───────┘
                                        │ (POST /member/withdrawals)
                                        ▼
                                ┌───────────────┐
                    ┌───────────┤    PENDING    ├───────────┐
                    │           └───────┬───────┘           │
   (Self-Cancel)    │                   │                   │ (Admin Reject)
                    ▼                   ▼                   ▼
            ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
            │   CANCELLED   │   │ UNDER_REVIEW  │   │   REJECTED    │
            └───────────────┘   └───────┬───────┘   └───────────────┘
            (Reservation                │ (Admin Approve)   (Reservation
              Released)                 ▼                     Released)
                                ┌───────────────┐
                                │   APPROVED    │
                                └───────┬───────┘
                                        │ (Admin Move to Processing)
                                        ▼
                                ┌───────────────┐
                    ┌───────────┤  PROCESSING   ├───────────┐
                    │           └───────┬───────┘           │
     (Bank Bounces) │                   │                   │ (Admin Rejection)
                    ▼                   │                   ▼
            ┌───────────────┐           │           ┌───────────────┐
            │    FAILED     │           │           │   REJECTED    │
            └───────────────┘           │           └───────────────┘
            (Reservation                │ (Admin Wires Funds via CEFT/SLIPS
              Released)                 │  & submits payout_reference)
                                        ▼
                                ┌───────────────┐
                                │     PAID      │
                                └───────────────┘
                           (Ledger DEBIT Created,
                            Reservation Released)
```

---

## 3. Database Schema

### Table 1: `nexus_bank_accounts`
Stores distributor bank accounts in Sri Lanka.
```sql
CREATE TABLE IF NOT EXISTS nexus_bank_accounts (
    id VARCHAR(64) PRIMARY KEY,
    member_id VARCHAR(64) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    branch_name VARCHAR(100) NOT NULL,
    branch_code VARCHAR(20) NOT NULL,
    account_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    account_number_masked VARCHAR(50) NOT NULL,
    account_type VARCHAR(20) DEFAULT 'savings',
    swift_bic VARCHAR(20),
    currency VARCHAR(3) DEFAULT 'LKR',
    is_primary BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### Table 2: `nexus_withdrawals`
Stores the complete withdrawal pipeline and execution lifecycle.
```sql
CREATE TABLE IF NOT EXISTS nexus_withdrawals (
    id VARCHAR(64) PRIMARY KEY,
    withdrawal_number VARCHAR(32) UNIQUE NOT NULL,
    member_id VARCHAR(64) NOT NULL,
    wallet_id VARCHAR(64) NOT NULL,
    bank_account_id VARCHAR(64) NOT NULL,
    bank_snapshot JSONB NOT NULL,
    requested_amount NUMERIC(15, 2) NOT NULL,
    fee_amount NUMERIC(15, 2) DEFAULT 0.00,
    net_amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'LKR',
    status VARCHAR(30) DEFAULT 'pending',
    payout_method VARCHAR(30) DEFAULT 'manual_bank_wire',
    payout_reference VARCHAR(100),
    ledger_entry_id VARCHAR(64),
    admin_notes TEXT,
    rejection_reason TEXT,
    failure_reason TEXT,
    member_note TEXT,
    reviewed_by VARCHAR(64),
    reviewed_at TIMESTAMPTZ,
    approved_by VARCHAR(64),
    approved_at TIMESTAMPTZ,
    processed_by VARCHAR(64),
    processed_at TIMESTAMPTZ,
    paid_by VARCHAR(64),
    paid_at TIMESTAMPTZ,
    rejected_by VARCHAR(64),
    rejected_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. REST API Endpoint Directory

### 4.1 Member Payout & Bank Account Endpoints
All member endpoints require Bearer JWT authentication and operate strictly within the caller's account context.

| HTTP Verb | Path | Description | Access Guard |
|---|---|---|---|
| `GET` | `/api/v1/nexus/member/bank-accounts` | List member's registered bank accounts | Caller Only |
| `POST` | `/api/v1/nexus/member/bank-accounts` | Add a new bank account (masks account number) | Caller Only |
| `PUT` | `/api/v1/nexus/member/bank-accounts/:id/primary` | Set specified account as default primary | Caller Only |
| `DELETE` | `/api/v1/nexus/member/bank-accounts/:id` | Soft-deactivate a bank account | Caller Only |
| `GET` | `/api/v1/nexus/member/withdrawals` | Get member withdrawal history & reservation overview | Caller Only |
| `GET` | `/api/v1/nexus/member/withdrawals/:id` | Get specific withdrawal request details | 403 Forbidden for cross-member |
| `POST` | `/api/v1/nexus/member/withdrawals` | Submit new withdrawal request (creates reservation) | Caller Only |
| `POST` | `/api/v1/nexus/member/withdrawals/:id/cancel` | Cancel a pending withdrawal request | 403 Forbidden for cross-member |

### 4.2 Admin Payout Desk Endpoints
All admin endpoints require Bearer JWT authentication with an administrative role (`corporate_admin`, `admin`, `financial_controller`).

| HTTP Verb | Path | Description |
|---|---|---|
| `GET` | `/api/v1/nexus/admin/withdrawals` | Filtered list with pagination, status, amount, and search |
| `GET` | `/api/v1/nexus/admin/withdrawals/stats` | Pipeline KPI counters and totals by status |
| `GET` | `/api/v1/nexus/admin/withdrawals/:id` | Full withdrawal dossier with **unmasked account number** for wire transfer |
| `POST` | `/api/v1/nexus/admin/withdrawals/:id/review` | Transition status to `under_review` |
| `POST` | `/api/v1/nexus/admin/withdrawals/:id/approve` | Transition status to `approved` |
| `POST` | `/api/v1/nexus/admin/withdrawals/:id/processing` | Transition status to `processing` (moved to bank desk) |
| `POST` | `/api/v1/nexus/admin/withdrawals/:id/mark-paid` | Confirm manual payout with `payout_reference` & post ledger `DEBIT` |
| `POST` | `/api/v1/nexus/admin/withdrawals/:id/reject` | Reject request with mandatory reason & release reservation |
| `POST` | `/api/v1/nexus/admin/withdrawals/:id/fail` | Mark failed payout (bounced wire) with mandatory reason |
| `GET` | `/api/v1/nexus/admin/withdrawals/reconciliation` | Deep audit diagnostic verifying ledger sync, idempotency, and balance integrity |

---

## 5. Admin Manual Wire Transfer Workflow

1. **Review & Queuing:**
   Administrator navigates to the **Withdrawals** tab in the Admin Panel (`nexus_admin.html`).
   Requests in `pending` can be moved to `under_review` and subsequently `approved`.
2. **Batching to Processing Desk:**
   Administrator moves approved requests to `processing`.
3. **Manual Bank Wire Disbursement:**
   Administrator opens the **Wire Transfer Desk** modal. This retrieves the unmasked bank account number, bank name, branch code, and net transfer amount.
   The administrator logs into their corporate bank portal (e.g., Commercial Bank, BOC, Sampath Bank) and submits a **CEFT / SLIPS / LankaPay** wire transfer to the distributor.
4. **Recording Payout Reference:**
   Upon receiving the bank transaction acknowledgment reference (e.g., `CEFT-20260909-883492`), the administrator clicks **"Mark as Paid"** in the Admin Panel and enters:
   - External Payout Reference: `CEFT-20260909-883492`
   - Payout Channel: `CEFT`
   - Corporate Notes: `Executed via corporate online banking desk`
5. **System Execution:**
   - Validates that `payout_reference` is unique and non-empty.
   - Posts atomic `DEBIT` to member's wallet ledger with entry type `withdrawal`.
   - Updates withdrawal record status to `paid`, referencing `ledger_entry_id`.
   - Records audit log entry and sends member in-app notification.

---

## 6. Verification & Automated Test Coverage

The entire withdrawal pipeline is covered by comprehensive automated tests in `test/nexus-foundation.test.js` (Tests 93 to 107):
- **Test 93:** Member bank account creation, primary assignment, and account masking (`********9012`).
- **Test 94:** Secondary bank accounts, primary toggling, and deactivation safeguards.
- **Test 95:** Withdrawal submission, sequential number generation (`NP-WD-XXXXXX`), and balance reservation math.
- **Test 96:** Overdraft protection & insufficient available balance rejections.
- **Test 97:** Minimum (`LKR 1,000.00`) and maximum limits enforcement.
- **Test 98:** Member self-cancellation of pending requests and reservation restoration.
- **Test 99:** Admin workflow state transitions (`under_review` -> `approved` -> `processing`).
- **Test 100:** Authorized administrator unmasked bank account inspection for wire transfer.
- **Test 101:** Payout confirmation (`markAsPaid`), mandatory reference verification, and atomic ledger debit.
- **Test 102:** Idempotency guard preventing duplicate payouts on repeated execution.
- **Test 103:** Admin rejection flow, reason logging, and zero ledger debit creation.
- **Test 104:** External payout failure flow (`processing` -> `failed`) and reservation restoration.
- **Test 105:** Cross-member access rejection (`403 Forbidden`) on inspection and cancellation.
- **Test 106:** Admin withdrawal stats and status filtering.
- **Test 107:** Deep system reconciliation diagnostic (`zero missing entries, zero duplicate references, zero orphan entries`).
