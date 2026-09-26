# NEXUS PRIME (PVT) LTD — MLM & NETWORK MARKETING TOPOLOGY SPECIFICATION
**Domain:** `nexusp.online`  
**Network Architecture:** Hybrid Unilevel / Multi-Tier Transitive Closure Topology  
**Version:** 1.0.0-FOUNDATION  
**Status:** Approved Specification  

---

## 1. Network Topology Foundations

Nexus Prime is engineered to support modern, high-velocity multi-level marketing (MLM) and affiliate distribution models. The system establishes two interconnected structural layers:

1. **Unilevel Direct Referral Layer**:
   * Direct 1-to-Many relationship between a Sponsor and their personally sponsored members.
   * Every registered member (except the Corporate Root) has exactly **one direct sponsor**.
   * A member can sponsor an **unlimited number of direct referrals**.
2. **Multi-Level Network Layer**:
   * Unlimited-depth tree where downline generations propagate transitively ($L_1, L_2, L_3 \dots L_\infty$).
   * No hard-coded depth limits (e.g., not locked to 2, 5, or 7 levels).
   * Level boundaries, commission depths, and qualification rules are defined as configurable parameters rather than rigid schema constraints.

---

## 2. Network Relationship Architecture: Why the Closure Matrix Model?

### Comparison of Database Hierarchy Models in MLM Systems

| Model | Read Performance | Write Complexity | Unlimited Depth? | Cycle Defense | Recommended For |
|---|:---:|:---:|:---:|:---:|:---:|
| **Naive Adjacency List** (`parent_id` only) | Slow (Requires recursive queries per request) | Simple $O(1)$ | Yes | Complex | Low-volume apps |
| **Nested Sets** (`lft`, `rgt`) | Fast Reads | Extreme ($O(N)$ tree locks on every insert) | Difficult | Fragile | Static trees (E-commerce categories) |
| **Materialized Path** (`path: '/1/4/9/'`) | Moderate ($O(\log N)$ with prefix search) | Moderate | Yes | Simple | Tree viewers & navigation |
| **Transitive Closure Matrix** (`ancestor_id`, `descendant_id`) | **Instant $O(1)$ Reads** | Fast ($O(\text{depth})$ append-only insert) | **Yes (Unlimited)** | **Absolute** | **High-Volume Enterprise MLM** |

### Nexus Prime Hybrid Solution
Nexus Prime combines the **Adjacency List** (in `nexus_member_profiles.sponsor_id` and `nexus_sponsors`), **Materialized Path** (in `nexus_network_nodes.path`), and **Transitive Closure Matrix** (in `nexus_network_closure`):

```
Example Network Tree:
        ROOT (NP000001)
              │
           A (NP000002)
              │
           B (NP000003)
              │
           C (NP000004)
```

#### Corresponding Closure Table Entries (`nexus_network_closure`)

| Ancestor | Descendant | Depth Distance | Meaning |
|:---:|:---:|:---:|---|
| Root | Root | 0 | Self-link |
| Root | A | 1 | A is Level 1 to Root |
| A | A | 0 | Self-link |
| Root | B | 2 | B is Level 2 to Root |
| A | B | 1 | B is Level 1 to A |
| B | B | 0 | Self-link |
| Root | C | 3 | C is Level 3 to Root |
| A | C | 2 | C is Level 2 to A |
| B | C | 1 | C is Level 1 to B |
| C | C | 0 | Self-link |

#### Computational Benefits:
* **Fetch Complete Downline of A**:
  ```sql
  SELECT * FROM nexus_network_closure WHERE ancestor_id = 'A_UUID' AND depth_distance > 0;
  ```
  *Executes in $< 1 \text{ ms}$ via composite B-Tree index regardless of total network size.*
* **Fetch Immediate Directs of A**:
  ```sql
  SELECT * FROM nexus_network_closure WHERE ancestor_id = 'A_UUID' AND depth_distance = 1;
  ```
* **Fetch Upward Upline Chain of C**:
  ```sql
  SELECT * FROM nexus_network_closure WHERE descendant_id = 'C_UUID' AND depth_distance > 0 ORDER BY depth_distance ASC;
  ```
* **Compute Total Team Size of A**:
  ```sql
  SELECT total_team_count FROM nexus_network_nodes WHERE user_id = 'A_UUID';
  ```

---

## 3. Unique Identifiers & Referral URL System

### 3.1 Unique Member ID
* **Specification**: Sequential corporate identifier generated exclusively on the backend database.
* **Format**: `NP` prefix followed by 6 zero-padded sequential digits (`NP000001`, `NP000002`, `NP000003`...).
* **Immutability**: Assigned atomically during registration. Cannot be modified or reassigned.
* **Sequence**: Backed by PostgreSQL sequence `nexus_member_id_seq` with fail-safe in-memory fallback.

### 3.2 Unique Referral Code
* **Specification**: Human-readable, alphanumeric promotional code designed for easy sharing.
* **Format**: `NEXUS` prefix followed by the unique member number (`NEXUS001`, `NEXUS002`...).
* **Index**: Unique B-Tree index on `nexus_member_profiles(referral_code)` for instant lookup.
* **Sharing URL**:
  ```
  https://nexusp.online/register?ref=NEXUS001
  ```
* **Auto-Detection**: The registration page automatically parses the `?ref=` query parameter, validates sponsor standing in real time, and binds the new registrant to the sponsor's downline.

---

## 4. Sponsor Relationship & Constraints

Nexus Prime strictly enforces data integrity rules across all network relations:

1. **No Self-Referral**: A member cannot sponsor themselves (`user_id != sponsor_id`).
2. **Cycle Prevention**: A member cannot be sponsored by an entity already residing in their own downline.
3. **Controlled Sponsor Assignment**: The sponsor is permanently bound at the instant of registration. Casual or arbitrary sponsor modifications are blocked. Any future sponsor transfer requires an administrative protocol with audit logging.
4. **Configurable Orphan Policy**: If a user attempts to register without a referral code:
   * When `ALLOW_ORPHAN_REGISTRATION = true`: The system automatically attaches the registrant to the Corporate Root (`NEXUS001`).
   * When `ALLOW_ORPHAN_REGISTRATION = false`: Registration is blocked with a clear message requesting a valid sponsor referral code.

---

## 5. Team Size & Network Metrics

Every network node maintains cached, atomically updated team metrics:

* **Direct Team Count (`direct_team_count`)**: The exact number of members directly sponsored by this member (Level 1 count).
* **Total Team Count (`total_team_count`)**: The total count of all members across all downline levels ($L_1 + L_2 + \dots + L_\infty$).
* **Atomic Cache Maintenance**: When a new member enrolls, database procedures update the direct count of the immediate parent and the total count of all ancestors in a single atomic transaction.

---

## 6. Progressive Network Tree Loading & Genealogy Visualizer

To guarantee fast rendering and minimal bandwidth across enterprise-scale downlines ($10,000+$ distributors), Nexus Prime uses an asynchronous progressive tree loading strategy:

```
[Initial Tree Render]
Root Node (L0) ─── Direct Children (L1) [Expand +]
                                            │
                                            └── (Asynchronously fetched on click)
                                                Children (L2) [Expand +]
```

1. **Initial Load**:
   - The client fetches only the viewer's node and their immediate Level 1 children (`/api/v1/nexus/network/children?parentId=USER_ID`).
   - Each child node provides a `hasChildren` flag calculated from `direct_team_count > 0`.
2. **On-Demand Expansion**:
   - When the user clicks `Expand (+)` on any child node, the frontend calls `/api/v1/nexus/network/children?parentId=CHILD_ID`.
   - The sub-branch is rendered dynamically without re-querying the whole network.
3. **Interactive Inspection Modal**:
   - Clicking `Inspect 🔍` on any node triggers `/api/v1/nexus/network/node-details?nodeId=NODE_ID`, displaying Member ID, referral code, rank standing, direct vs total team counts, sponsor attribution, and enrollment timestamp.
4. **Genealogy Search Engine**:
   - Downline members can be queried by name, Member ID (`NP...`), or referral code (`NEXUS...`) via `/api/v1/nexus/network/search?q=QUERY`.

---

## 7. Dynamic Level Distance Calculation

Level distances between any two related members in the network are computed dynamically from the transitive closure matrix:

$$\text{Level Distance}(A, D) = \text{depth}(D) - \text{depth}(A)$$

```javascript
// Query from closure matrix
const record = networkClosure.find(c => c.ancestor_id === A && c.descendant_id === D);
return record ? record.depth_distance : null; // null if D is not in A's downline
```

* **Self Distance**: $0$
* **Direct Child**: $1$
* **Grandchild**: $2$
* **Reverse Traversal**: `null` (Descendant cannot be an ancestor)

---

## 8. Circular Sponsor Prevention Algorithm

In transitive closure topologies, a cycle $A \to B \to C \to A$ would corrupt the Directed Acyclic Graph (DAG) property. Nexus Prime enforces strict cycle prevention:

> [!CAUTION]
> **Cycle Defense Theorem**:
> Node $S$ can be assigned as sponsor to Node $U$ if and only if $U$ does not already exist as an ancestor of $S$ in the closure matrix:
> $$\nexists \, (U, S, k) \in \text{nexus\_network\_closure} \quad \text{where } k > 0$$
> If such an entry exists, assigning $S$ as sponsor of $U$ would create a circular loop. The system immediately rejects the transaction with:
> `Circular sponsor relationship detected. Cannot assign a downline member as a sponsor.`

---

## 9. Future-Proof MLM Commission & Compensation Architecture

> [!IMPORTANT]
> **Zero Registration Commissions Policy**:
> In accordance with international direct-selling regulations and sustainable financial design, **commission money is NEVER generated simply because a user registers**.
> Commission events can only be triggered by verified product sales, educational course enrollments, or subscription transactions.

### Extension Points for Future Compensation Modules
The schema foundation ([`nexus_commissions_foundation`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_migrations/003_create_nexus_commissions_wallet_foundation.sql)) provides polymorphic extension fields designed to support diverse compensation mechanisms:

1. **Unilevel Tiered Commissions**:
   * Example: 8% on Level 1, 3% on Level 2, 1% on Level 3.
   * Queried via: `nexus_network_closure.depth_distance`.
2. **Binary Volume Matching**:
   * Supports pairing left and right leg volumes via node position tags.
3. **Rank & Leadership Bonuses**:
   * Supported via `nexus_member_profiles.rank` (`MEMBER`, `BRONZE`, `SILVER`, `GOLD`, `DIAMOND`, `FOUNDER`).
4. **Daily Earnings Caps**:
   * Configurable daily payout cap (e.g. 30,000.00 LKR per day) evaluated against historical calendar-day earnings in the commission journal.
