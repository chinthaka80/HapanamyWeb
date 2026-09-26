# NEXUS PRIME (PVT) LTD — PACKAGES & PRODUCTS ARCHITECTURE SPECIFICATION
**Domain:** `nexusp.online`  
**Document Version:** 1.0.0-PROD-ISOLATED  
**Implementation Stage:** Prompt 08 — Packages & Products Management System  

---

## 1. Executive Summary & System Overview

The **Nexus Prime Packages & Products System** establishes a normalized, enterprise-grade catalog management architecture for **Nexus Prime (PVT) Ltd** (`nexusp.online`). It models the platform's commercial curriculum offerings across two synchronized dimensions:

1. **Membership Packages**: Network entry tiers (e.g. *Starter*, *Professional*, *Executive*) that establish distributor ranking, curriculum entitlements, and direct referral affiliate rights.
2. **Digital Curriculum Products & Categories**: Modular masterclasses (e.g. *AI Workflow Automation*, *Digital Commerce Fundamentals*, *Team Leadership & Ethics*) categorized under domains such as *Digital Masterclasses*.

The system delivers administrative CRUD management, real-time public showcases, member package viewing, and immutable audit trail logging while maintaining **100% database, application, and session isolation from `hapanamy.lk`**.

---

## 2. Critical Safety & Pre-Payment Invariants

### 2.1 Complete Isolation from Hapanamy.lk
* **Zero shared schemas, database instances, or connection strings**: Nexus Prime operates strictly on its dedicated in-memory / relational schema inside `nexus_backend/`.
* **Zero Hapanamy table alterations**: No tables in Hapanamy have been touched, inspected with write locks, migrated, or mutated.
* **Independent Authentication & Admin Privileges**: Administrative access is restricted to verified Nexus Prime administrators (`admin` / `super_admin`) with cryptographic PBKDF2 verification.

### 2.2 Strict Phase 2 Pre-Payment Policy
* **No Live Payment Gateways**: Internet Payment Gateway (IPG) integrations, credit card processing, and manual bank deposit slip uploading remain strictly deferred to Phase 2.
* **No Wallet Debits or Automated Purchases**: No member wallet balance is debited for viewing or selecting catalog items.
* **No Fake Orders or Fabricated Commission Postings**: No simulated unilevel or binary commissions are generated during catalog browsing or preview interactions.
* **Explicit User-Facing Notices**: All public cards, modals, and member dashboard tabs display informative notifications (*"Ordering & checkout functionality coming soon in Phase 2"*).

---

## 3. Normalized Database Schema

The catalog layer consists of five normalized tables/entities:

### 3.1 `packages` (Membership Packages)
| Field | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | UUID / String | Primary key (e.g. `pkg-starter-01`) |
| `name` | String | Package display name (min 3 chars) |
| `package_code` | String | Unique uppercase identifier (e.g. `NP-PKG-01`) |
| `slug` | String | Unique lowercase URL slug (e.g. `starter-package`) |
| `short_description` | Text | Brief value proposition |
| `full_description` | Text | Comprehensive curriculum breakdown |
| `price` | Decimal | Base price in currency (non-negative) |
| `currency` | String | ISO-4217 code (default `'LKR'`) |
| `status` | Enum | `'draft'`, `'active'`, `'inactive'`, `'archived'` |
| `display_order` | Integer | Sorting rank (ascending) |
| `featured` | Boolean | Highlighted flag on public landing page |
| `image_icon` | String | FontAwesome icon class or asset URI |
| `created_at` | Timestamp | ISO 8601 creation timestamp |
| `updated_at` | Timestamp | ISO 8601 last modified timestamp |

### 3.2 `package_features` (Package Curriculum Bullet Points)
| Field | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | UUID / String | Primary key |
| `package_id` | UUID / String | Foreign key references `packages.id` |
| `feature_text` | String | Feature / curriculum highlight text |
| `display_order` | Integer | Order within package features list |
| `is_highlighted` | Boolean | Emphasized feature flag |

### 3.3 `product_categories` (Product Master Categories)
| Field | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | UUID / String | Primary key (e.g. `cat-digital-masterclasses`) |
| `name` | String | Category title (e.g. *Digital Masterclasses*) |
| `slug` | String | Unique lowercase slug (e.g. `digital-masterclasses`) |
| `description` | Text | Category educational scope |
| `status` | Enum | `'active'`, `'inactive'` |
| `display_order` | Integer | Sorting rank |
| `created_at` | Timestamp | ISO 8601 creation timestamp |
| `updated_at` | Timestamp | ISO 8601 last modified timestamp |

### 3.4 `products` (Certified Digital Curriculums & SKUs)
| Field | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | UUID / String | Primary key (e.g. `prod-ai-01`) |
| `name` | String | Product name (e.g. *AI Workflow Automation*) |
| `sku` | String | Unique uppercase SKU (e.g. `NP-SKU-AI01`) |
| `slug` | String | Unique lowercase slug (e.g. `ai-workflow-automation`) |
| `category_id` | UUID / String | Foreign key references `product_categories.id` |
| `short_description`| Text | One-sentence summary |
| `full_description` | Text | Syllabus outcomes, modules, and target audience |
| `price` | Decimal | Unit price in LKR (non-negative) |
| `currency` | String | Default `'LKR'` |
| `stock_quantity` | Integer | Inventory counter (defaults to `9999` for digital) |
| `status` | Enum | `'draft'`, `'active'`, `'inactive'`, `'archived'`, `'out_of_stock'` |
| `featured` | Boolean | Highlighted on public website |
| `image_url` | String | Image asset relative path |
| `display_order` | Integer | Sorting rank |
| `created_at` | Timestamp | ISO 8601 creation timestamp |
| `updated_at` | Timestamp | ISO 8601 last modified timestamp |

### 3.5 `package_products` (Package-Product Junction)
| Field | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | UUID / String | Primary key |
| `package_id` | UUID / String | Foreign key references `packages.id` |
| `product_id` | UUID / String | Foreign key references `products.id` |

---

## 4. Default Corporate Seed Data

Nexus Prime initial corporate seeds established in `NexusDatabase.seedPackagesAndProducts()`:

| Type | Code / SKU | Name | Price (LKR) | Status | Included Products / Features |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Package** | `NP-PKG-01` | Starter Package | 7,500.00 | `active` | 4 features, includes Digital Commerce Fundamentals |
| **Package** | `NP-PKG-02` | Professional Package (Featured) | 15,000.00 | `active` | 5 features, includes AI Automation + Digital Commerce |
| **Package** | `NP-PKG-03` | Executive Package | 30,000.00 | `active` | 5 features, includes All 3 Masterclasses + VIP perks |
| **Category** | `digital-masterclasses` | Digital Masterclasses | — | `active` | Core technical curriculum category |
| **Product** | `NP-SKU-AI01` | AI Workflow Automation | 5,000.00 | `active` | Prompt design, agent workflows, API integrations |
| **Product** | `NP-SKU-DC01` | Digital Commerce Fundamentals | 5,000.00 | `active` | Omni-channel e-commerce, customer acquisition |
| **Product** | `NP-SKU-TL01` | Team Leadership & Ethics | 5,000.00 | `active` | Ethical coaching, team compliance, executive leadership |

---

## 5. API Endpoint Specifications

### 5.1 Public Endpoints (No Authentication Required)
* **`GET /api/v1/nexus/packages`**  
  Returns all `active` packages sorted by `display_order`, enriched with `features` and `included_products`.
* **`GET /api/v1/nexus/packages/:slug`**  
  Returns full package dossier by slug or uppercase `package_code`. Returns `404` if not found or inactive.
* **`GET /api/v1/nexus/categories`**  
  Returns all `active` product categories with active product counts.
* **`GET /api/v1/nexus/products`**  
  Query params: `category` (slug or id), `search`, `page`, `limit`.  
  Returns paginated list of `active` products with joined category names.
* **`GET /api/v1/nexus/products/:slug`**  
  Returns single product details by slug. Returns `404` if not found or inactive.

### 5.2 Member Endpoints (Member Session Token Required)
* **`GET /api/v1/nexus/member/packages`**  
  Returns member's current package status (`currentPackage`), rank (`memberRank`), active catalog tiers (`packages`), and explicit Phase 2 notice.

### 5.3 Admin Command Center Endpoints (`admin` / `super_admin` Role Required)
* **`GET /api/v1/nexus/admin/packages`**  
  Query params: `status`, `search`, `featured`.  
  Returns all packages matching filter criteria.
* **`POST /api/v1/nexus/admin/packages`**  
  Creates new package. Validates required fields, checks `package_code` and `slug` uniqueness, validates non-negative price, logs `PACKAGE_CREATED` in audit trail.
* **`PUT /api/v1/nexus/admin/packages/:id`**  
  Updates package fields, features, or product mappings. Logs `PACKAGE_UPDATED`.
* **`PUT /api/v1/nexus/admin/packages/:id/status`**  
  Updates package status (`draft`, `active`, `inactive`, `archived`). Logs `PACKAGE_STATUS_CHANGED`.
* **`GET /api/v1/nexus/admin/categories`**  
  Returns all categories with product counts.
* **`POST /api/v1/nexus/admin/categories`**  
  Creates new category with unique slug. Logs `CATEGORY_CREATED`.
* **`PUT /api/v1/nexus/admin/categories/:id`**  
  Updates category metadata. Logs `CATEGORY_UPDATED`.
* **`GET /api/v1/nexus/admin/products`**  
  Query params: `page`, `limit`, `category`, `status`, `search`.  
  Returns paginated products list with category metadata.
* **`POST /api/v1/nexus/admin/products`**  
  Creates new product. Enforces unique SKU and unique slug, validates non-negative price/stock, logs `PRODUCT_CREATED`.
* **`PUT /api/v1/nexus/admin/products/:id`**  
  Updates product details and inventory levels. Logs `PRODUCT_UPDATED`.
* **`PUT /api/v1/nexus/admin/products/:id/status`**  
  Updates product status (`draft`, `active`, `inactive`, `archived`, `out_of_stock`). Logs `PRODUCT_STATUS_CHANGED`.

---

## 6. Audit Trail Integration

All administrative mutations generate tamper-proof records in `nexusDb.auditLogs`:

| Event Action | Entity Type | Recorded Attributes |
| :--- | :--- | :--- |
| `PACKAGE_CREATED` | `PACKAGE` | Full package object, creator ID, IP, user-agent |
| `PACKAGE_UPDATED` | `PACKAGE` | Previous values, new updated values, modifier ID |
| `PACKAGE_STATUS_CHANGED` | `PACKAGE` | Old status, new status, modifier ID |
| `PRODUCT_CREATED` | `PRODUCT` | Full product object, creator ID |
| `PRODUCT_UPDATED` | `PRODUCT` | Price/stock modifications, old vs new values |
| `PRODUCT_STATUS_CHANGED` | `PRODUCT` | Status transition, modifier ID |
| `CATEGORY_CREATED` | `CATEGORY` | Category metadata, creator ID |
| `CATEGORY_UPDATED` | `CATEGORY` | Category updates, modifier ID |

---

## 7. Frontend User Interfaces

1. **Admin Panel (`nexus_admin.html`)**:
   - **Tab 7 (Membership Packages)**: Complete table with order, code, name, price, features count, featured flag, status badge, search, status filter, and Create/Edit modal.
   - **Tab 8 (Digital Products)**: Complete table with SKU, name, category, price, stock quantity, featured flag, status badge, category filter, search, and Create/Edit modal.
2. **Public Landing Page (`nexus_index.html`)**:
   - Dynamically loads active packages in `#packages` with curriculum bullets and "View Details" modal.
   - Dynamically loads active products in `#products` with price, curriculum description, and "Learn More" detail modal.
3. **Member Dashboard (`nexus_dashboard.html`)**:
   - `#tab-my-packages` displays member's current subscription (`STANDARD`) alongside active upgrade packages with clear Phase 2 upgrade notification.

---

## 8. Automated Verification Results

Automated test suite (`test/nexus-foundation.test.js`) executes 52 test cases with 100% pass rate:

```
============================================================
🧪 RUNNING NEXUS PRIME FOUNDATION VERIFICATION TEST SUITE
============================================================
...
✅ PASSED: 35. Public Active Packages Listing & Feature Enrichment
✅ PASSED: 36. Public Package Detail & Slug Lookup
✅ PASSED: 37. Public Categories & Products Listing with Filtering
✅ PASSED: 38. Public Product Detail Dossier by Slug
✅ PASSED: 39. Security Guard: Public & Member Role Rejection on Admin Endpoints
✅ PASSED: 40. Admin Package Creation & Unique Code/Slug Validation
✅ PASSED: 41. Admin Package Update & Feature Modification
✅ PASSED: 42. Admin Package Status Transition & Audit Trail Verification
✅ PASSED: 43. Admin Product Creation, SKU Uniqueness & Validation
✅ PASSED: 44. Admin Product Update, Stock Tracking & Audit Logging
✅ PASSED: 45. Member Dashboard Package View & Phase 2 Pre-Payment Safeguard

============================================================
📊 TEST SUITE SUMMARY: 52 PASSED, 0 FAILED
============================================================
```

All 52 tests verify cryptographic security, database normalization, isolation guarantees, and operational stability.
