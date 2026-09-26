# NEXUS PRIME (PVT) LTD — PURCHASE & ORDER SYSTEM SPECIFICATION
**Domain:** `nexusp.online`  
**Corporate Entity:** Nexus Prime (PVT) Ltd  
**Architecture Classification:** Enterprise Order Processing Engine & Immutable Financial Snapshots  
**Security Tier:** Strict Server-Side Financial Authority  

---

## 1. Executive Summary & Objective

The **Nexus Prime Purchase & Order System** establishes a safe, auditable, and extensible order processing lifecycle for both **Membership Packages** and **Retail/Digital Products**. Designed from the ground up to prevent price tampering, race conditions, stock desynchronization, and unauthorized cross-member data access, the engine enforces strict separation of concerns between catalog pricing and historical purchase agreements.

The system guarantees:
- **100% Isolation from Hapanamy.lk:** Zero dependencies on legacy code, databases, API keys, or storage systems.
- **Server-Side Price Authority:** Client-submitted prices, subtotals, and totals are rejected or ignored. The corporate database catalog is the sole source of financial truth.
- **Historical Immutability via Snapshots:** Every order and item preserves an immutable snapshot of package names, product SKUs, and unit prices at the exact millisecond of order generation. Catalog mutations never alter historical purchase records.
- **Sequential Human-Readable Identifiers:** Formatted monotonically as `NP-ORD-XXXXXX` (e.g. `NP-ORD-000001`).
- **Pre-Payment Order Safeguard:** Orders are created in `awaiting_payment` (packages) or `pending` (products) status with `payment_status: 'pending'`. Fulfillment and membership activation occur only upon cryptographic payment verification.

---

## 2. Order Lifecycle State Machines

### 2.1 Package Order State Machine
```
[User Selects Package] 
          │
          ▼
   POST /orders/package
          │
          ▼
┌──────────────────┐
│ awaiting_payment │ ──(Timeout / Expired)──► [cancelled]
└──────────────────┘
          │
   (Cryptographic Payment Verified)
          │
          ▼
┌──────────────────┐
│       paid       │ ──► [Activates Member Package Standing (e.g. NP-PKG-01)]
└──────────────────┘     [Emits PAYMENT_VERIFIED Event for MLM Engine]
          │
   (Admin Completion)
          │
          ▼
┌──────────────────┐
│    completed     │
└──────────────────┘
```

### 2.2 Product Order State Machine
```
[User Validates Cart & Submits]
          │
          ▼
   POST /orders/products
   (Stock Decremented Server-Side)
          │
          ▼
┌──────────────────┐
│     pending      │ ──(Customer / Admin Cancel)──► [cancelled] (Restores Stock)
└──────────────────┘
          │
   (Cryptographic Payment Verified)
          │
          ▼
┌──────────────────┐
│    processing    │ ──► [Digital License / Physical Delivery Dispatch]
└──────────────────┘
          │
   (Fulfillment Complete)
          │
          ▼
┌──────────────────┐
│    completed     │
└──────────────────┘
```

---

## 3. Database Architecture & Schema

The order subsystem is codified in `nexus_migrations/006_create_nexus_orders_and_purchases_schema.sql` and backed by the in-memory persistence layer `nexus_backend/db/nexus-db.js`:

### 3.1 `nexus_orders`
| Column | Type | Description |
|---|---|---|
| `id` | `UUID` / `TEXT` | Primary key (`ord-...`) |
| `order_number` | `VARCHAR(32)` | Sequential corporate identifier (`NP-ORD-000001`) |
| `user_id` | `UUID` / `TEXT` | Purchasing member ID |
| `order_type` | `VARCHAR(20)` | `'package'` or `'product'` |
| `package_id` | `TEXT` | Referenced package ID (nullable for product orders) |
| `status` | `VARCHAR(30)` | `'pending'`, `'awaiting_payment'`, `'paid'`, `'processing'`, `'completed'`, `'cancelled'`, `'failed'` |
| `payment_status` | `VARCHAR(30)` | `'pending'`, `'paid'`, `'failed'`, `'refunded'` |
| `subtotal` | `NUMERIC(14,2)` | Server-calculated subtotal in LKR |
| `discount` | `NUMERIC(14,2)` | Promotional or voucher discount |
| `total` | `NUMERIC(14,2)` | Authoritative total payable amount |
| `currency` | `VARCHAR(3)` | Default `'LKR'` |
| `package_name_snapshot` | `VARCHAR(255)` | Immutable package name at order time |
| `package_price_snapshot`| `NUMERIC(14,2)` | Immutable package price at order time |
| `idempotency_key` | `VARCHAR(128)` | Client-supplied key to prevent double submits |
| `customer_notes` | `TEXT` | Optional delivery/license instructions |
| `created_at` / `updated_at` | `TIMESTAMP` | ISO 8601 audit timestamps |

### 3.2 `nexus_order_items`
| Column | Type | Description |
|---|---|---|
| `id` | `UUID` / `TEXT` | Primary key (`item-...`) |
| `order_id` | `TEXT` | Foreign key referencing `nexus_orders.id` |
| `item_type` | `VARCHAR(20)` | `'package'` or `'product'` |
| `item_id` | `TEXT` | Referenced product or package entity ID |
| `item_name_snapshot` | `VARCHAR(255)` | Immutable item name at purchase |
| `sku_or_code_snapshot` | `VARCHAR(100)` | Immutable SKU (`NP-SKU-...`) or Package Code |
| `quantity` | `INTEGER` | Quantity ordered ($\ge 1$) |
| `unit_price_snapshot` | `NUMERIC(14,2)` | Authoritative catalog unit price at purchase |
| `discount_snapshot` | `NUMERIC(14,2)` | Unit discount snapshot |
| `line_total_snapshot` | `NUMERIC(14,2)` | $\text{Unit Price} \times \text{Quantity} - \text{Discount}$ |
| `currency` | `VARCHAR(3)` | Currency code (`LKR`) |

---

## 4. API Endpoints & Contract Matrix

### 4.1 Member Purchase & Order Desk
- `POST /api/v1/nexus/member/cart/validate`: Validates array of product IDs and quantities, verifies active status and remaining inventory, computes server-side line totals.
- `POST /api/v1/nexus/member/orders/package`: Creates a membership package order. Requires `{ packageId }`. Client-provided prices are ignored.
- `POST /api/v1/nexus/member/orders/products`: Creates a product order. Requires `{ items: [{ productId, quantity }] }`. Automatically validates and decrements inventory.
- `GET /api/v1/nexus/member/orders`: Retrieves member's paginated order history with search and status filters.
- `GET /api/v1/nexus/member/orders/:id`: Retrieves 360-degree order detail. Enforces strict ownership: requesting another member's order ID returns `403 Forbidden`.

### 4.2 Admin Order Management Desk
- `GET /api/v1/nexus/admin/orders`: Full ledger of all corporate orders with KPI counters (`totalOrders`, `awaitingPaymentCount`, `processingCount`, `completedCount`, `cancelledCount`, `totalVolumeLKR`), pagination, search, and status/type filters.
- `GET /api/v1/nexus/admin/orders/:id`: Full order dossier including member profile, item snapshots, payment history, and fulfillment logs.
- `PUT /api/v1/nexus/admin/orders/:id/status`: Controlled status transition with mandatory reason note. Emits `ORDER_STATUS_CHANGED` audit log and sends member notification.

---

## 5. Security & Isolation Controls

1. **Anti-Tampering Financial Engine:**
   - Any client payload attempting to specify prices, discounts, or totals is ignored.
   - Price calculation reads directly from `nexusDb.packages` or `nexusDb.products`.
2. **Stock Protection:**
   - Orders cannot be placed if requested quantity exceeds available `stock_quantity`.
   - Inactive or out-of-stock products cannot be added to an order.
3. **Cross-Member Authorization Guard:**
   - Member endpoints extract `userId` from verified JWT/session tokens.
   - Any access attempt across account boundaries is blocked with `403 Forbidden: Access denied to this order`.
4. **Idempotency Guard:**
   - Submitting an order with an identical `idempotencyKey` returns the existing order record without creating duplicates.
