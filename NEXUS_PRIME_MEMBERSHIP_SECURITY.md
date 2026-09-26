# Nexus Prime (PVT) Ltd — Membership Security, Idempotency & Tenant Isolation
**System Code:** NP-SYS-SEC-019  
**Document Version:** 1.0.0  
**Environment:** Production-Isolated (`https://nexusp.online`)  
**Applicable Scope:** Prompt 19  

---

## 1. Security Architecture Principles

The Nexus Prime Membership & Eligibility Engine implements defense-in-depth safeguards designed to protect distributor standing, commercial legitimacy, and financial balances.

---

## 2. Strict Idempotency Guarantees

External payment gateways (such as PayHere or Sandbox simulators) may emit repeated callbacks for the same transaction due to network retries.

- **Idempotency Barrier**:
  ```javascript
  const existing = await nexusDb.getMembershipByMemberId(userId);
  if (existing && existing.status === 'active' && existing.activation_order_id === orderId) {
      return { success: true, idempotent: true, membership: existing };
  }
  ```
- **Guarantees**:
  - The activation timestamp (`activated_at`) is **never overwritten** or shifted forward on duplicate callbacks.
  - Zero duplicate rows are inserted into `nexus_membership_history`.
  - Zero duplicate affiliate commission events are dispatched.

---

## 3. Strict Tenant Isolation & Cross-Member Protection

1. **Member Portal Isolation**:
   - `GET /api/v1/nexus/member/membership`: Returns ONLY the authenticated member's record resolved from bearer session token (`session.userId`).
   - `GET /api/v1/nexus/member/eligibility`: Evaluates ONLY the authenticated session user.
   - Any unauthenticated request is rejected with `401 Unauthorized`.
   - Cross-member queries (attempting to view another member's eligibility or standing) are structurally impossible because no `member_id` query parameter is accepted by the member endpoint.

2. **Administrative Role Protection**:
   - All admin endpoints (`/api/v1/nexus/admin/eligibility/*`) require bearer authentication with `admin` or `super_admin` role.
   - Any member token attempting to query admin statistics or directory receives `403 Forbidden`.

---

## 4. Immutable Point-in-Time History Trail

- Table `nexus_membership_history` is an append-only ledger.
- Transitions record:
  - `from_status` / `previous_status`
  - `to_status` / `new_status`
  - `trigger_event` / `source_type`
  - `changed_by` (operator admin ID, member ID, or `system`)
  - `reason_code` and mandatory explanation
  - Canonical UTC timestamp
- Historical records are never modified or deleted under any circumstance.
