# NEXUS PRIME (PVT) LTD — MLM RANK, LEVEL, QUALIFICATION & ACHIEVEMENT ENGINE
**Domain:** `nexusp.online`  
**System Module:** Member Ranks, Network Levels & Qualification Governance  
**Implementation Stage:** Prompt 14  
**Architecture Source of Truth:** Versioned Qualification Rules + Server-Side Metric Evaluation  

---

> [!IMPORTANT]
> **Mandatory Disclaimer — Production Business Rules:**  
> *Production rank names, qualification volumes, referral targets, and rank bonus percentages require corporate business configuration.*  
> All parameters documented below represent the architectural foundation and are marked as: **`CONFIGURATION REQUIRED`**.

---

## 1. Architectural Distinction: "Level" vs. "Rank"

A critical requirement of the Nexus Prime MLM platform is the strict separation of network topology depth from individual performance qualification.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            LEVEL vs. RANK SEPARATION                        │
├──────────────────────────────────────┬──────────────────────────────────────┤
│               LEVEL                  │                 RANK                 │
│         (Network Topology)           │       (Performance Achievement)      │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ • Represents tree depth distance     │ • Represents qualification tier      │
│ • Fixed by sponsor relationship      │ • Earned by volume & team metrics    │
│ • Example: Level 1 = Direct Sponsor  │ • Example: Member, Rank 1, Rank 2    │
│ • Calculated via network closure     │ • Evaluated by qualification engine  │
│ • Does NOT confer leadership title   │ • Determines compensation perks      │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

A distributor residing at **Level 4** of an upline's team can achieve **Rank 3** or higher based on their personal and team volume, completely independent of their placement depth in the organization.

---

## 2. Core Entity Data Models

### 2.1 Ranks (`nexus_ranks`)
Defines the configurable tiers of distributor progression.
- `id`: Unique identifier (e.g. `rank-member`, `rank-01`, `rank-02`).
- `code`: Unique code string (e.g. `MEMBER`, `RANK_01`, `RANK_02`, `FOUNDER`).
- `name`: Human-readable title (e.g. "Member", "Rank 1", "Corporate Founder").
- `slug`: URL and API identifier.
- `display_order`: Integer rank hierarchy sequence ($0, 1, 2, 3\dots$). Higher number denotes higher leadership rank.
- `status`: Lifecycle state (`active`, `inactive`, `archived`).
- `icon`: Visual iconography token (`user`, `star`, `award`, `shield`, `zap`, `crown`).
- `color_token`: Visual color code (`#94A3B8`, `#008DDA`, `#10B981`, `#F59E0B`, `#8B5CF6`, `#F1C40F`).
- `badge_style`: CSS token class.

### 2.2 Rule Versions (`nexus_rank_rule_versions`)
Guarantees that historical qualifications remain reproducible when corporate rules change.
- `id`: Version ID (e.g. `rrv-baseline-v1`).
- `version`: Semantic version string (`v1.0`, `v2.0`).
- `effective_from`: Activation date.
- `effective_to`: Expiration date (NULL indicates current active version).
- `status`: `active`, `draft`, `archived`.

### 2.3 Rank Requirements (`nexus_rank_requirements`)
Granular qualification conditions tied to a specific rank and rule version.
- `metric_type`: Metric evaluated (`personal_volume`, `team_volume`, `direct_group_volume`, `direct_referrals`, `active_direct_referrals`, `total_network_members`, `active_network_members`, `package_status`, `minimum_team_depth`).
- `operator`: Mathematical comparison (`>=`, `>`, `<=`, `<`, `=`, `IN`).
- `target_value`: Numeric threshold.
- `period_type`: Evaluation window (`lifetime`, `monthly`, `weekly`, `rolling_period`, `custom_period`).
- `period_value`: Integer window value (e.g. 30 days).
- `is_required`: Boolean flag (all required conditions must pass).

### 2.4 Member Rank History (`nexus_member_rank_history`)
Append-only historical journal of every rank promotion or demotion.
- `id`: Unique history record ID (`rh-XXXXXX`).
- `member_id`: User ID of distributor.
- `rank_id`: New rank achieved.
- `previous_rank_id`: Prior rank.
- `rule_version_id`: Version of rules under which qualification was awarded.
- `qualification_period`: Period evaluated (`lifetime`, `2026-09`).
- `qualified_at`: Timestamp of qualification.
- `reason`: `qualification_evaluation`, `manual_admin_override`, `demotion`.
- `snapshot`: Complete JSON snapshot capturing the exact metrics at qualification.

---

## 3. Qualification Evaluation Lifecycle

```
Member Activity (Orders, Downline Growth)
       │
       ▼
Trigger: Order Paid / Periodic Job / Admin Manual Request
       │
       ▼
NexusRankService.evaluateMemberRank(memberId, period)
       │
       ├─► 1. Load Active Rule Version for date
       ├─► 2. Load Active Ranks sorted by display_order ASC
       ├─► 3. Calculate Trusted Metrics (PV, TV, Directs, Active Directs)
       ├─► 4. Evaluate Each Requirement across Ranks
       ├─► 5. Identify Qualifying Ranks
       └─► 6. Deterministically Select HIGHEST Qualified Rank (Max display_order)
       │
       ▼
Rank Changed?
       ├── NO  ──► Record diagnostic snapshot; No profile change.
       └── YES ──► 1. Write immutable record to nexus_member_rank_history
                   2. Update member.rank in nexus_users / member profile
                   3. Emit Tamper-Proof Audit Log (RANK_ACHIEVED / RANK_DEMOTED)
                   4. Dispatch Member In-App Notification
                   5. Emit RANK_ACHIEVED event for optional Commission Engine hook
```

---

## 4. Rank Demotion & Grace Period Governance

### 4.1 Demotion Policy
- **Default Corporate Policy:** `NO DEMOTION` (`rank_demotion_enabled = false`).
- A distributor who achieves a rank retains that rank title for life, even if monthly volume fluctuates.
- If corporate management explicitly enables demotion in the future (`rank_demotion_enabled = true`), a member will only be demoted if they fail re-qualification upon expiration of the evaluation period.

### 4.2 Grace Period
- Configurable grace window (`rank_grace_period_enabled = true`, `rank_grace_period_days = 30`).
- If a distributor temporarily dips below monthly maintenance volume, their rank is preserved in grace status before demotion takes effect.

---

## 5. Decoupled Financial Architecture & Rank Bonuses

To guarantee financial immutability and prevent double-entry ledger contamination:
1. The **Rank Engine NEVER directly writes to `nexus_wallets` or `nexus_ledger_entries`**.
2. When a rank promotion occurs, the Rank Engine emits a `RANK_ACHIEVED` event containing:
   ```json
   {
     "event": "RANK_ACHIEVED",
     "achievement_id": "rh-9a1b2c3d",
     "member_id": "usr-00042",
     "new_rank_id": "rank-02",
     "previous_rank_id": "rank-01",
     "rule_version_id": "rrv-baseline-v1",
     "qualification_period": "lifetime",
     "snapshot": { "personal_volume": 15000, "direct_referrals": 5 }
   }
   ```
3. If an official Rank Bonus is configured in the Prompt 11 Commission Engine, the Commission Engine consumes the event and records an `approved` commission with:
   - `reference_type = 'rank_achievement'`
   - `reference_id = achievement_id`
4. The Prompt 12 Wallet Engine subsequently credits the approved commission to the distributor's wallet with compound idempotency protection against duplicate bonuses.

---

## 6. REST API Endpoint Directory

### 6.1 Member Rank Endpoints
All member endpoints require Bearer JWT authentication and operate strictly on the caller's profile.

| HTTP Verb | Path | Description | Access Guard |
|---|---|---|---|
| `GET` | `/api/v1/nexus/member/rank` | Current rank, next rank target, progress bars, and metrics | Caller Only |
| `GET` | `/api/v1/nexus/member/rank/history` | Paginated rank achievement history with snapshots | Caller Only |

### 6.2 Admin Rank Management Endpoints
All admin endpoints require administrative credentials (`corporate_admin`, `admin`).

| HTTP Verb | Path | Description |
|---|---|---|
| `GET` | `/api/v1/nexus/admin/ranks` | List all ranks with display order, rule counts, and member counts |
| `POST` | `/api/v1/nexus/admin/ranks` | Create a new rank tier |
| `PUT` | `/api/v1/nexus/admin/ranks/:id` | Update rank metadata, color, or display order |
| `GET` | `/api/v1/nexus/admin/ranks/:id` | Detailed rank dossier with requirements and rule versions |
| `GET` | `/api/v1/nexus/admin/ranks/rules/versions` | List versioned qualification rule sets |
| `POST` | `/api/v1/nexus/admin/ranks/rules/versions` | Create a new rule version with effective date |
| `POST` | `/api/v1/nexus/admin/ranks/requirements` | Add or update a qualification requirement |
| `GET` | `/api/v1/nexus/admin/ranks/performance` | Searchable directory of distributor rank performance |
| `POST` | `/api/v1/nexus/admin/ranks/recalculate-member/:id` | Admin-triggered manual server-side rank recalculation |
| `POST` | `/api/v1/nexus/admin/ranks/recalculate-all` | Batch recalculation utility |

---

## 7. Audit Logging & System Notifications

Every rank administrative action and qualification transition emits a tamper-proof entry to `nexus_audit_logs`:
- `RANK_CREATED`, `RANK_UPDATED`, `RANK_RULE_VERSION_CREATED`, `RANK_REQUIREMENT_CREATED`
- `RANK_EVALUATED`, `RANK_ACHIEVED`, `RANK_DEMOTED`, `RANK_RECALCULATED`

When a distributor achieves a higher rank, an in-app notification is automatically generated:
`"Congratulations! You have achieved [Rank Name]."`
