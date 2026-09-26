# NEXUS PRIME (PVT) LTD — MLM COMMISSION PLAN SPECIFICATION
**Domain:** `nexusp.online`  
**System Version:** Nexus Prime Engine 2.4.0  
**Schema Migration:** `007_create_nexus_commission_engine_schema.sql`

---

> [!IMPORTANT]
> **Mandatory Disclaimer:**  
> *Commission engine architecture is implemented, but production commission rates/business rules require configuration.*  
> All commission rates, payout tiers, qualification rules, and compression mechanics detailed below represent baseline reference defaults established for testing, compliance modeling, and audit framework verification. Final operational rates remain subject to executive board ratification and legal regulatory clearance.

---

## 1. Executive Summary & Philosophy

Nexus Prime's multi-level affiliate commission engine is engineered to reward sustainable business generation, customer product acquisition, and team mentorship while adhering strictly to Sri Lankan digital commerce laws and international direct selling compliance standards.

Key structural guarantees:
1. **Product & Service Value Centricity:** Commissions are calculated strictly upon verified monetary transactions (`status = 'paid'`, `payment_status = 'completed'`). Pre-orders, unverified checkout intents, and mock carts never trigger commission calculations.
2. **Versioned Plan Architecture:** Plans are stored with immutable historical versioning (`NP-PLAN-UNILEVEL` v1, v2...). Existing historical commission records remain pinned forever to the exact plan version in effect at the moment of payment verification.
3. **Decoupled Wallet Ledger:** Commission records are created exclusively in `approved` (or `pending`/`hold`) audit journal status. Liquid member wallets and balances are not inflated prematurely until an explicit disbursement/wallet batch cycle is triggered.

---

## 2. Reference Compensation Plan: `NP-PLAN-UNILEVEL` (Version 1)

### 2.1 Overview
* **Plan Code:** `NP-PLAN-UNILEVEL`
* **Plan Name:** Nexus Prime Standard Unilevel Compensation Plan
* **Version:** 1
* **Commission Base:** Order Total (`order_total` / `eligible_amount`)
* **Default Currency:** Sri Lankan Rupee (`LKR`)
* **Maximum Depth:** 5 Generation Tiers
* **Total Payout Ceiling:** 14.50% of eligible volume

### 2.2 Tier & Override Matrix

| Tier / Level | Classification | Reference Rate | Reference Amount on LKR 7,500 Order | Reference Amount on LKR 15,000 Order | Description |
|:---:|:---:|:---:|:---:|:---:|:---|
| **Level 1** | `DIRECT_REFERRAL` | **8.00%** | LKR 600.00 | LKR 1,200.00 | Direct Introducing Sponsor Reward |
| **Level 2** | `LEVEL_OVERRIDE` | **3.00%** | LKR 225.00 | LKR 450.00 | 2nd Generation Team Leadership Override |
| **Level 3** | `LEVEL_OVERRIDE` | **2.00%** | LKR 150.00 | LKR 300.00 | 3rd Generation Team Leadership Override |
| **Level 4** | `LEVEL_OVERRIDE` | **1.00%** | LKR 75.00 | LKR 150.00 | 4th Generation Team Leadership Override |
| **Level 5** | `LEVEL_OVERRIDE` | **0.50%** | LKR 37.50 | LKR 75.00 | 5th Generation Team Leadership Override |
| **Total** | — | **14.50%** | **LKR 1,087.50** | **LKR 2,175.00** | Maximum Distributed Volume |

---

## 3. Beneficiary Qualification & Eligibility Gates

Before any commission record is generated for an upline member, the `NexusQualificationService` evaluates the beneficiary against strict qualification gates:

```
                  [Order Payment Verified]
                             │
                             ▼
              [Traverse to Next Upline Member]
                             │
                             ▼
               Is Account Active? (status == 'active')
                 ├── NO ──> [Bypass Upline: Inactive Account]
                 └── YES
                      │
                      ▼
               Has Active Membership Package?
               (package_status != 'NONE' && package_status != 'INACTIVE')
                 ├── NO ──> [Bypass Upline: Lacks Package Standing]
                 └── YES
                      │
                      ▼
               Is Purchaser Self-Sponsoring?
                 ├── YES ─> [Bypass Upline: Self-Referral Guard]
                 └── NO
                      │
                      ▼
               Is Cycle or Visited Member Detected?
                 ├── YES ─> [Halt Traversal: Circular Loop Protection]
                 └── NO
                      │
                      ▼
               [Qualify Beneficiary & Generate Commission]
```

### 3.1 Eligibility Criteria Summary
1. **Account Standing:** Beneficiary account status must be `active`. Suspended, inactive, or terminated members are skipped.
2. **Membership Package Standing:** Beneficiary must hold an active membership tier (`NP-PKG-01`, `NP-PKG-02`, etc.). Members with `NONE` or `INACTIVE` standing are disqualified.
3. **Minimum Rank Gate:** Default minimum rank required is `MEMBER`.
4. **Self-Referral Prohibition:** A purchaser cannot earn affiliate commissions from their own order.
5. **Corporate Root Node:** Corporate Root (`NP000001` / `00000000-0000-4000-8000-000000000001`) serves as the administrative tree apex. When traversal reaches root, higher sponsorship does not exist and tree traversal safely terminates.

---

## 4. Commission Plan Versioning & Governance

To prevent retroactive balance recalculations and ensure mathematical auditability:
1. **New Versioning:** Administrators can draft and activate new plan versions (`NP-PLAN-UNILEVEL` v2, v3...).
2. **Historical Immutability:** Any order processed under Plan v1 records `plan_version: 1` and preserves historical rates (`8.00%`), regardless of subsequent plan rate adjustments.
3. **Admin REST Control:**
   * `GET /api/v1/nexus/admin/commission-plans` — Inspect all historical and active compensation plans.
   * `POST /api/v1/nexus/admin/commission-plans` — Author a new versioned plan matrix.
   * `PUT /api/v1/nexus/admin/commission-plans/:id/status` — Activate, draft, or deprecate compensation plans.
