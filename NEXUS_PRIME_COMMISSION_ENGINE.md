# NEXUS PRIME (PVT) LTD — MLM COMMISSION ENGINE ARCHITECTURE
**Domain:** `nexusp.online`  
**System Version:** Nexus Prime Engine 2.4.0  
**Backend Module:** `nexus_backend/services/nexus-commission-service.js`  
**Qualification Module:** `nexus_backend/services/nexus-qualification-service.js`

---

> [!IMPORTANT]
> **Mandatory Disclaimer:**  
> *Commission engine architecture is implemented, but production commission rates/business rules require configuration.*

---

## 1. Engine Architecture & Core Event Flow

The Nexus Prime MLM Commission Engine executes as an asynchronous, event-driven, decoupled subsystem triggered exclusively upon cryptographic payment verification.

```
┌─────────────────┐
│     Member      │
│  Purchases Pkg  │
└────────┬────────┘
         ▼
┌─────────────────┐
│  nexus_orders   │ (Status: 'awaiting_payment', Payment: 'pending')
└────────┬────────┘
         ▼
┌─────────────────┐
│ Payment Gateway │ (Sandbox HMAC / PayHere / Webhook)
└────────┬────────┘
         ▼
┌─────────────────┐
│ Payment Verified│ (Payment: 'completed', Order: 'paid')
└────────┬────────┘
         │
         ▼ [dispatchPaymentVerifiedHook]
┌─────────────────────────────────┐
│  NexusCommissionService.run()   │
└────────┬────────────────────────┘
         │
         ├─► Idempotency Guard (orderId processed?)
         ├─► Active Plan Resolution (NP-PLAN-UNILEVEL v1)
         │
         ▼ [Upline Traversal Loop: Levels 1 to 5]
┌─────────────────────────────────┐
│ NexusQualificationService.check │
│  - Account Active?              │
│  - Package Standing Active?     │
│  - Self-Referral Protected?     │
│  - Cycle/Loop Free?             │
└────────┬────────────────────────┘
         │
         ├── Qualified? ──► [Record Commission: status='approved']
         └── Disqualified? ─► [Skip Upline / Compression]
         │
         ▼
┌─────────────────────────────────┐
│  nexus_audit_logs & Notice Feed │
│  - COMMISSION_CALCULATED        │
│  - Member Notification Dispatched│
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│   [STRICT WALLET SEPARATION]    │
│  *Member balance NOT credited*  │
│  Awaiting Future Wallet Ledger  │
└─────────────────────────────────┘
```

---

## 2. Key Safeguards & Security Architecture

### 2.1 Strict Calculation Idempotency
- Before any calculation begins, `nexusDb.hasCommissionsForOrder(orderId)` verifies whether commissions have previously been generated for this order.
- In PostgreSQL, unique constraint `uq_nexus_commission_idempotency (order_id, beneficiary_id, commission_type, commission_level, plan_version)` guarantees that redundant webhook deliveries or repeated worker calls cannot create duplicate commissions.
- If called repeatedly, the engine safely returns `{ success: true, idempotent: true, count: 0 }`.

### 2.2 Payment Verification Gate
- The commission engine enforces a zero-trust check on order status:
  ```javascript
  if (order.status !== 'paid' && order.status !== 'completed') {
      throw new Error("Security Safeguard: Cannot calculate commissions for unverified order.");
  }
  ```
- Unpaid carts, drafts, cancelled orders, and pending payments are strictly rejected.

### 2.3 Infinite Loop & Circular Sponsor Protection
- A `visitedUplines` set tracks every sponsor encountered during traversal.
- If a circular link (e.g., A -> B -> C -> A) is detected, traversal immediately logs an alert and terminates, preventing stack overflows or recursive loops.

### 2.4 Corporate Root Boundary
- Upline traversal naturally terminates when reaching the Corporate Root (`00000000-0000-4000-8000-000000000001` / `NP000001`), as the corporate entity has no upline sponsor.

### 2.5 Strict Financial Precision & Rounding
- To prevent binary floating-point rounding drifts, all financial calculations are rounded via `NexusCommissionService.roundCurrency()`:
  $$\text{amount} = \frac{\operatorname{round}((\text{base} \times \text{rate}) / 100 \times 100)}{100}$$
- All fractions under half a cent round down; equal to or greater than half a cent round up to the nearest cent.

---

## 3. Strict Wallet Separation Policy

In alignment with Prompt 11 requirements:
- **No Direct Wallet Modification:** The commission engine records all calculated commissions in `approved` status in `nexus_commissions`.
- **Zero Premature Inflation:** `member.balance` remains strictly unaltered ($0.00$) upon commission calculation.
- **Future Wallet Ledger Integration:** Liquid balance crediting, minimum withdrawal thresholds, withholding taxes, and payout disbursements remain decoupled and reserved for subsequent wallet ledger prompts.

---

## 4. API Endpoints

### 4.1 Member Commission Desk
* `GET /api/v1/nexus/member/commissions` — Paginated ledger of own earned commissions with KPI summary cards (Total Earned, Direct Referral, Team Overrides, Approved Pipeline).
* `GET /api/v1/nexus/member/commissions/:id` — Detail view of a specific commission snapshot. Includes cross-member ownership guard (403 Forbidden on foreign commission IDs).

### 4.2 Administrative Commission Management
* `GET /api/v1/nexus/admin/commissions` — Global commission journal with multi-field search (order number, reference, member ID), status filters, and volume analytics.
* `GET /api/v1/nexus/admin/commissions/:id` — Full 360-degree audit dossier of any commission record.
* `PUT /api/v1/nexus/admin/commissions/:id/status` — Controlled status transition (`approved` $\leftrightarrow$ `hold` $\leftrightarrow$ `reversed`) with mandatory audit reason logging.
* `GET /api/v1/nexus/admin/commission-plans` — Versioned compensation plan matrix viewer.
* `POST /api/v1/nexus/admin/commission-plans` — Author a new compensation plan version.
* `PUT /api/v1/nexus/admin/commission-plans/:id/status` — Plan lifecycle transitions (`active`, `draft`, `deprecated`).

---

## 5. Front-End Integration

1. **Member Portal (`nexus_dashboard.html`):**
   * Accessible via `#tab-commissions`.
   * Displays 4 KPI analytics cards, accounting policy disclaimer, search/filter controls, commission table, and interactive detail audit modal.
2. **Administrative Back-Office (`nexus_admin.html`):**
   * Accessible via `#admin-tab-commissions` (Global Commission Journal) and `#admin-tab-commission-plans` (Compensation Matrix & Versioning Desk).
   * Supports manual status adjustments with audit tracking, live plan rate matrix previews, and new compensation plan creation modal.

---

## 6. Prompt 14 Rank Bonus Foundation & Decoupling

The Prompt 14 Rank Engine integrates with the Commission Engine through event-driven decoupling:
1. **Event Emission:** When a distributor qualifies for a new rank, the Rank Engine emits `RANK_ACHIEVED` containing the unique `achievement_id` (from `nexus_member_rank_history`).
2. **Commission Hook:** If an active compensation plan defines a Rank Achievement Bonus rule, the Commission Engine generates an `approved` commission record:
   - `reference_type: 'rank_achievement'`
   - `reference_id: achievement_id`
   - `commission_type: 'rank_bonus'`
3. **Compound Idempotency:** The compound unique constraint `(reference_type, reference_id, commission_type)` prevents duplicate bonus allocations for the same achievement.
4. **Wallet Decoupling:** Ranks never write directly to wallets. Funds flow strictly: $\text{Rank Engine} \to \text{Commission Engine} \to \text{Wallet Ledger}$.

