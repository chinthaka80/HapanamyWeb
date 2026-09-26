# Nexus Prime (PVT) Ltd — Centralized Account Eligibility Engine
**System Code:** NP-SYS-ELIG-019  
**Document Version:** 1.0.0  
**Environment:** Production-Isolated (`https://nexusp.online`)  
**Applicable Scope:** Prompt 19  

---

## 1. Architectural Overview

The **Nexus Prime Centralized Account Eligibility Engine** acts as the single source of truth for platform privileges and financial permissions. Modules must query this engine rather than making ad-hoc decisions on eligibility.

```
                              ┌───────────────────────────────────┐
                              │     Central Eligibility Engine    │
                              │    nexus-eligibility-engine.js    │
                              └─────────────────┬─────────────────┘
                                                │
         ┌───────────────────────┬──────────────┴────────┬───────────────────────┐
         ▼                       ▼                       ▼                       ▼
    Pillar 1                Pillar 2                Pillar 3                Pillar 4
  MLM Network             Commissions              Withdrawals             Rank System
 Participation            Qualification             Gate & Bank            Recognition
 (checkMlmElig)        (checkCommissionElig)   (checkWithdrawalElig)    (evaluateRankElig)
```

---

## 2. Four-Pillar Eligibility Matrix

Every distributor query returns a structured 4-pillar standing object:

```json
{
  "standing": {
    "account_status": "active",
    "membership_status": "active",
    "kyc_status": "verified",
    "package_tier": "NP-PKG-01"
  },
  "pillars": {
    "mlm": {
      "eligible": true,
      "reason_code": null,
      "message": "Eligible for MLM network placement and referral link activation."
    },
    "commissions": {
      "eligible": true,
      "reason_code": null,
      "message": "Active membership and package tier verified for commission qualification."
    },
    "withdrawals": {
      "eligible": true,
      "reason_code": null,
      "kycStatus": "verified",
      "hasActiveBank": true,
      "message": "Withdrawal eligibility criteria met."
    },
    "rank": {
      "eligible": true,
      "reason_code": null,
      "message": "Eligible for rank recognition and progression."
    }
  },
  "action_required": false,
  "blockers": []
}
```

---

## 3. Pillar Evaluation Rules

### Pillar 1: MLM Network Participation
- **Account Requirement:** Account status must be `active`.
- **Membership Requirement:** Membership status must be `active`.
- **Primary Blockers:**
  - `ACCOUNT_NOT_ACTIVE` / `ACCOUNT_SUSPENDED`
  - `MEMBERSHIP_NOT_ACTIVE`
  - `MEMBERSHIP_SUSPENDED`

### Pillar 2: Commission Qualification
- **Anti-Abuse Rule:** Self-referral commission is strictly barred (`SELF_REFERRAL_PROHIBITED`).
- **Account Requirement:** `profile.status === 'active'`.
- **Membership Standing:** Authoritative active membership required.
- **Package Holding:** Member must hold an active package tier (`!= 'NONE'`).
- **Consumed By:** `NexusQualificationService.isMemberEligibleForCommission()`.

### Pillar 3: Financial Withdrawal Gate
- **Account Requirement:** `profile.status === 'active'`.
- **Compliance Gate:** Identity verification status must be `verified` when `kyc_required_for_withdrawal === true`.
- **Banking Requirement:** Verified active bank account must be on file.
- **Limits & Thresholds:** Requested payout must satisfy configured minimum and maximum single payout thresholds.
- **Consumed By:** `nexusWithdrawalService.checkWithdrawalEligibility()`.

### Pillar 4: Rank Recognition
- **Account Requirement:** `profile.status === 'active'`.
- **Membership Requirement:** `membership.status === 'active'`.
- **Consumed By:** `nexusRankService.calculateMemberRank()`.
