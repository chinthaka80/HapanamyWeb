# NEXUS PRIME (PVT) LTD — DATABASE SPECIFICATION & DICTIONARY
**Target Domain:** `nexusp.online`  
**Database Engine:** PostgreSQL 15+ / Supabase (Dedicated Pooler)  
**Schema Classification:** Multi-Level Marketing & Digital E-Commerce Foundation  
**Version:** 1.0.0-FOUNDATION  
**Status:** Approved & Implemented  

---

## 1. Executive Summary & Isolation Mandate

This document serves as the authoritative database dictionary and migration blueprint for **Nexus Prime (PVT) Ltd** (`nexusp.online`). 

### Critical Isolation Invariants
* **100% Dedicated Database**: Nexus Prime operates on an isolated PostgreSQL/Supabase instance (`nexus_prime_db`). It never connects to, shares connection pools with, or queries any table belonging to `hapanamy.lk`.
* **Prefixed Namespace**: All tables, sequences, functions, and policies strictly utilize the `nexus_` prefix to guarantee unambiguous ownership and zero naming collisions.
* **Separation of Authentication & Profile Data**: Following security best practices, core authentication credentials (`nexus_users`) are segregated from business identity and marketing data (`nexus_member_profiles`). Passwords hashes are never exposed through application queries.
* **Row Level Security (RLS)**: Enforced across all member and financial tables to prevent unauthorized cross-tenant data access.

---

## 2. Table Directory & Entity Relationship Architecture

```
[nexus_users] (Auth Core)
   │
   ├── [nexus_user_roles] ───< [nexus_roles] (RBAC)
   │
   ├── [nexus_member_profiles] (Business Identity, Member ID, Referral Code)
   │        │
   │        ├── [nexus_sponsors] (Direct Unilevel Sponsorship)
   │        │
   │        ├── [nexus_network_nodes] (Hierarchical Tree & Materialized Path)
   │        │
   │        └── [nexus_network_closure] (Transitive Closure Matrix for Unlimited Depth)
   │
   ├── [nexus_member_settings] (Preferences & 2FA)
   │
   ├── [nexus_wallet_foundation] (Atomic Balances)
   │        │
   │        └── [nexus_wallet_transactions_foundation] (Double-Entry Financial Log)
   │
   ├── [nexus_commissions_foundation] (Future-Proof Commission Journal)
   │
   └── [nexus_audit_logs] (Tamper-Evident Security & Action Trails)
```

---

## 3. Data Dictionary: Core Tables

### 3.1 `nexus_users`
**Purpose**: Primary authentication entity storing system access credentials and account verification state.
* **Primary Key**: `id` (UUID, `DEFAULT uuid_generate_v4()`)
* **Foreign Keys**: None
* **Columns**:
  | Column Name | Data Type | Constraints | Description |
  |---|---|---|---|
  | `id` | UUID | PRIMARY KEY | Unique user identifier |
  | `email` | VARCHAR(255) | UNIQUE, NOT NULL | Primary login email |
  | `password_hash` | VARCHAR(255) | NOT NULL | PBKDF2-SHA512 `salt:hash` (10,000 iterations) |
  | `email_verified` | BOOLEAN | NOT NULL DEFAULT false | Email verification flag |
  | `email_verified_at` | TIMESTAMPTZ | NULL | Timestamp when email was confirmed |
  | `last_login_at` | TIMESTAMPTZ | NULL | Last successful authentication timestamp |
  | `last_login_ip` | VARCHAR(50) | NULL | IP address of last login |
  | `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Record creation timestamp |
  | `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Record last update timestamp |
* **Indexes**: `idx_nexus_users_email` ON `email`
* **RLS Requirements**: Users can SELECT and UPDATE only their own record (`auth.uid() = id`), or administrators.

---

### 3.2 `nexus_roles` & `nexus_user_roles`
**Purpose**: Multi-tier Role-Based Access Control (RBAC).
* **`nexus_roles`**:
  * `id`: SERIAL PRIMARY KEY
  * `name`: VARCHAR(50) UNIQUE NOT NULL (`'member'`, `'admin'`, `'super_admin'`)
  * `description`: TEXT
* **`nexus_user_roles`**:
  * `user_id`: UUID NOT NULL REFERENCES `nexus_users(id)` ON DELETE CASCADE
  * `role_id`: INTEGER NOT NULL REFERENCES `nexus_roles(id)` ON DELETE CASCADE
  * **Primary Key**: Composite (`user_id`, `role_id`)
  * `assigned_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
  * `assigned_by`: UUID REFERENCES `nexus_users(id)` ON DELETE SET NULL
* **RLS Requirements**: Only administrators (`nexus_is_admin()`) can assign or modify roles.

---

### 3.3 `nexus_member_profiles`
**Purpose**: Primary member business identity, MLM identifiers, and contact information.
* **Primary Key**: `id` (UUID, `DEFAULT uuid_generate_v4()`)
* **Foreign Keys**:
  * `user_id` -> `nexus_users(id)` ON DELETE CASCADE (Unique 1:1)
  * `sponsor_id` -> `nexus_users(id)` ON DELETE RESTRICT
* **Columns**:
  | Column Name | Data Type | Constraints | Description |
  |---|---|---|---|
  | `id` | UUID | PRIMARY KEY | Internal profile identifier |
  | `user_id` | UUID | UNIQUE, NOT NULL | Reference to `nexus_users` |
  | `member_id` | VARCHAR(20) | UNIQUE, NOT NULL | Formatted sequential ID (e.g., `NP000001`) |
  | `referral_code` | VARCHAR(50) | UNIQUE, NOT NULL | Unique referral code (e.g., `NEXUS001`) |
  | `full_name` | VARCHAR(255) | NOT NULL | Legal full name |
  | `display_name` | VARCHAR(100) | NULL | Public display name |
  | `phone` | VARCHAR(50) | NULL | Contact mobile number |
  | `address` | TEXT | NULL | Physical mailing address |
  | `country` | VARCHAR(100) | NOT NULL DEFAULT 'Sri Lanka' | Operating country |
  | `profile_image_url` | VARCHAR(512) | NULL | Avatar image path |
  | `rank` | VARCHAR(50) | NOT NULL DEFAULT 'MEMBER' | Member career rank |
  | `package_status` | VARCHAR(50) | NOT NULL DEFAULT 'STANDARD' | Package tier |
  | `status` | VARCHAR(30) | NOT NULL DEFAULT 'active' | Account state: `'active'`, `'pending'`, `'suspended'`, `'blocked'`, `'inactive'` |
  | `sponsor_id` | UUID | NULL (Root only) | Reference to direct sponsor's `nexus_users(id)` |
  | `registration_date` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Member registration timestamp |
  | `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Record creation timestamp |
  | `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Record update timestamp |
* **Table Constraints**:
  * `chk_nexus_no_self_sponsor`: `user_id != sponsor_id`
  * `status CHECK (status IN ('active', 'pending', 'suspended', 'blocked', 'inactive'))`
* **Indexes**:
  * `idx_nexus_profiles_user_id` ON `user_id`
  * `idx_nexus_profiles_member_id` ON `member_id`
  * `idx_nexus_profiles_referral_code` ON `referral_code`
  * `idx_nexus_profiles_sponsor_id` ON `sponsor_id`
  * `idx_nexus_profiles_status` ON `status`

---

### 3.4 `nexus_member_settings`
**Purpose**: Stores member-specific preferences, localization, and multi-factor security credentials.
* **Primary Key**: `user_id` (UUID, REFERENCES `nexus_users(id)` ON DELETE CASCADE)
* **Columns**:
  * `two_factor_enabled`: BOOLEAN NOT NULL DEFAULT false
  * `two_factor_secret`: VARCHAR(255) NULL
  * `email_notifications`: BOOLEAN NOT NULL DEFAULT true
  * `sms_notifications`: BOOLEAN NOT NULL DEFAULT false
  * `dark_mode`: BOOLEAN NOT NULL DEFAULT true
  * `locale`: VARCHAR(10) NOT NULL DEFAULT 'en'
  * `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT now()

---

### 3.5 `nexus_sponsors`
**Purpose**: Direct unilevel sponsor-distributor relationship mapping.
* **Primary Key**: `user_id` (UUID, REFERENCES `nexus_users(id)` ON DELETE CASCADE)
* **Foreign Keys**: `sponsor_id` -> `nexus_users(id)` ON DELETE RESTRICT
* **Columns**:
  * `user_id`: UUID PRIMARY KEY
  * `sponsor_id`: UUID NOT NULL
  * `created_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
* **Constraint**: `user_id != sponsor_id`
* **Indexes**: `idx_nexus_sponsors_sponsor_id` ON `sponsor_id`

---

### 3.6 `nexus_network_nodes`
**Purpose**: Tree topology with materialized path hierarchy for rapid visualizer queries.
* **Primary Key**: `user_id` (UUID, REFERENCES `nexus_users(id)` ON DELETE CASCADE)
* **Foreign Keys**: `parent_id` -> `nexus_users(id)` ON DELETE RESTRICT
* **Columns**:
  * `user_id`: UUID PRIMARY KEY
  * `parent_id`: UUID NULL (NULL for root only)
  * `depth`: INTEGER NOT NULL DEFAULT 1 (Root = 1, Child = 2...)
  * `path`: TEXT NOT NULL (e.g. `'/root-uuid/parent-uuid/user-uuid/'`)
  * `direct_team_count`: INTEGER NOT NULL DEFAULT 0
  * `total_team_count`: INTEGER NOT NULL DEFAULT 0
  * `created_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
  * `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
* **Indexes**:
  * `idx_nexus_network_nodes_parent_id` ON `parent_id`
  * `idx_nexus_network_nodes_path` ON `path`

---

### 3.7 `nexus_network_closure`
**Purpose**: Transitive ancestor-descendant closure matrix enabling $O(1)$ unlimited-depth downline, upline, and team count queries without recursive overhead.
* **Primary Key**: Composite (`ancestor_id`, `descendant_id`)
* **Foreign Keys**:
  * `ancestor_id` -> `nexus_users(id)` ON DELETE CASCADE
  * `descendant_id` -> `nexus_users(id)` ON DELETE CASCADE
* **Columns**:
  * `ancestor_id`: UUID NOT NULL
  * `descendant_id`: UUID NOT NULL
  * `depth_distance`: INTEGER NOT NULL (0 for self, 1 for direct child, 2 for grandchild...)
  * `created_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
* **Indexes**:
  * `idx_nexus_closure_ancestor` ON (`ancestor_id`, `depth_distance`)
  * `idx_nexus_closure_descendant` ON (`descendant_id`, `depth_distance`)

---

### 3.8 `nexus_commissions_foundation`
**Purpose**: Establishes the ledger architecture for future sales-linked commission distribution. No money is generated simply from user registration.
* **Primary Key**: `id` (UUID, `DEFAULT uuid_generate_v4()`)
* **Foreign Keys**:
  * `beneficiary_id` -> `nexus_users(id)` ON DELETE RESTRICT
  * `source_user_id` -> `nexus_users(id)` ON DELETE SET NULL
* **Columns**:
  * `commission_type`: VARCHAR(50) CHECK (`commission_type IN ('DIRECT_REFERRAL', 'NETWORK_LEVEL', 'BINARY_PAIR', 'RANK_BONUS', 'LEADERSHIP_MATCH')`)
  * `source_transaction_ref`: VARCHAR(100) NULL
  * `level`: INTEGER NOT NULL DEFAULT 1
  * `amount`: DECIMAL(15, 2) NOT NULL CHECK (`amount >= 0.00`)
  * `currency`: VARCHAR(10) NOT NULL DEFAULT 'LKR'
  * `status`: VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (`status IN ('PENDING', 'APPROVED', 'PAID', 'REVERSED', 'CANCELLED')`)
  * `calculation_metadata`: JSONB NULL
  * `created_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
  * `approved_at`: TIMESTAMPTZ NULL
  * `paid_at`: TIMESTAMPTZ NULL
* **Indexes**: `idx_nexus_commissions_beneficiary`, `idx_nexus_commissions_status`

---

### 3.9 `nexus_wallet_foundation` & `nexus_wallet_transactions_foundation`
**Purpose**: Double-entry financial balance container and journal.
* **`nexus_wallet_foundation`**:
  * `user_id`: UUID PRIMARY KEY REFERENCES `nexus_users(id)` ON DELETE RESTRICT
  * `available_balance`: DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (`available_balance >= 0.00`)
  * `pending_balance`: DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (`pending_balance >= 0.00`)
  * `total_withdrawn`: DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (`total_withdrawn >= 0.00`)
  * `total_earned`: DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (`total_earned >= 0.00`)
  * `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
* **`nexus_wallet_transactions_foundation`**:
  * `id`: UUID PRIMARY KEY DEFAULT `uuid_generate_v4()`
  * `user_id`: UUID NOT NULL REFERENCES `nexus_users(id)` ON DELETE RESTRICT
  * `type`: VARCHAR(50) NOT NULL CHECK (`type IN ('COMMISSION_CREDIT', 'WITHDRAWAL_LOCK', 'WITHDRAWAL_PAID', 'REFUND_DEBIT', 'ADMIN_ADJUSTMENT')`)
  * `amount`: DECIMAL(15, 2) NOT NULL
  * `balance_after`: DECIMAL(15, 2) NOT NULL CHECK (`balance_after >= 0.00`)
  * `reference_type`: VARCHAR(50) NOT NULL
  * `reference_id`: VARCHAR(100) NOT NULL
  * `description`: TEXT
  * `created_at`: TIMESTAMPTZ NOT NULL DEFAULT now()

---

### 3.10 `nexus_audit_logs`
**Purpose**: Tamper-evident logging of security, authentication, profile updates, and admin actions.
* **Primary Key**: `id` (UUID, `DEFAULT uuid_generate_v4()`)
* **Foreign Keys**: `user_id` -> `nexus_users(id)` ON DELETE SET NULL
* **Columns**:
  * `action`: VARCHAR(100) NOT NULL (e.g. `'AUTH_REGISTER'`, `'AUTH_LOGIN'`, `'PROFILE_UPDATE'`, `'SPONSOR_ASSIGN'`, `'STATUS_CHANGE'`)
  * `entity_type`: VARCHAR(50) NOT NULL
  * `entity_id`: VARCHAR(100) NULL
  * `old_values`: JSONB NULL
  * `new_values`: JSONB NULL
  * `ip_address`: VARCHAR(50)
  * `user_agent`: VARCHAR(255)
  * `created_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
* **Indexes**: `idx_nexus_audit_user`, `idx_nexus_audit_action`, `idx_nexus_audit_created_at`

---

## 4. Database Functions & Procedures

### 4.1 Member ID Generator (`nexus_generate_member_id`)
```sql
CREATE OR REPLACE FUNCTION nexus_generate_member_id()
RETURNS VARCHAR(20) AS $$
DECLARE
    next_num BIGINT;
BEGIN
    next_num := nextval('nexus_member_id_seq');
    RETURN 'NP' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;
```

### 4.2 Network Closure Maintainer (`nexus_insert_network_closure`)
Automatically links new registrants to themselves (depth 0) and replicates all ancestor relations from their sponsor, incrementing depths by 1. Also updates direct and total team count caches atomically.

### 4.3 Unlimited Downline Retrieval (`nexus_get_downline`)
```sql
SELECT * FROM nexus_get_downline('00000000-0000-4000-8000-000000000001', max_depth := NULL);
```

### 4.4 Upline Ancestry Retrieval (`nexus_get_upline`)
```sql
SELECT * FROM nexus_get_upline('user-uuid-here', max_levels := 7);
```

---

## 5. Version-Controlled Migrations Sequence

All migrations are located in [`nexus_migrations/`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_migrations):

1. [`001_create_nexus_core_schema.sql`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_migrations/001_create_nexus_core_schema.sql): Roles, users, sequence, Member ID generator, member profiles, member settings.
2. [`002_create_nexus_mlm_network_schema.sql`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_migrations/002_create_nexus_mlm_network_schema.sql): Sponsors, network nodes, closure matrix, traversal functions.
3. [`003_create_nexus_commissions_wallet_foundation.sql`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_migrations/003_create_nexus_commissions_wallet_foundation.sql): Commission foundation, wallet balances, wallet transactions, audit logs.
4. [`004_create_nexus_rls_and_functions.sql`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_migrations/004_create_nexus_rls_and_functions.sql): Row Level Security policies and admin verification functions.
5. [`005_seed_nexus_prime_initial_data.sql`](file:///c:/Users/User/Documents/antigravity/zealous-hypatia/nexus_migrations/005_seed_nexus_prime_initial_data.sql): Corporate settings, root corporate administrator (`NP000001`, `NEXUS001`).
