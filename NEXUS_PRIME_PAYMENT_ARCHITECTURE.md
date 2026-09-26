# NEXUS PRIME (PVT) LTD — PAYMENT GATEWAY ARCHITECTURE & SECURITY SPECIFICATION
**Domain:** `nexusp.online`  
**Corporate Entity:** Nexus Prime (PVT) Ltd  
**Architecture Classification:** Decoupled Payment Gateway Abstraction & Cryptographic Verification Engine  
**Security Tier:** Strict Server-Side Financial Authority & Idempotent Webhook Integrity  

---

## 1. Executive Summary

The **Nexus Prime Payment Gateway Architecture** establishes a resilient, cryptographically secure, and modular payment processing subsystem for `nexusp.online`. Built to handle digital commerce and MLM package enrollments, it isolates core business logic from third-party gateway nuances via a **Provider Abstraction Layer**.

### Core Tenets
1. **Absolute Isolation from Hapanamy.lk:** Zero use of Hapanamy merchant accounts, webhook endpoints, databases, or API keys.
2. **Authoritative Server-Side Amount Enforcement:** Client-submitted amounts are never accepted. Payment amounts are derived exclusively from authoritative order records.
3. **Cryptographic Webhook & IPN Verification:** Gateway callbacks require strict cryptographic signature verification (HMAC-SHA256 in Sandbox; MD5 multi-field checksum in PayHere).
4. **Idempotency & Atomic State Transition:** Duplicate webhook deliveries are safely acknowledged without duplicate state mutations.
5. **Decoupled MLM Commission Hook:** Verified payments emit a decoupled `PAYMENT_VERIFIED` event, but **no MLM commission calculation or wallet disbursement occurs** in this stage.

---

## 2. Payment Provider Abstraction Layer

The system defines a pluggable provider interface in `nexus_backend/services/payment-providers/payment-provider-base.js`:

```
                    ┌─────────────────────────┐
                    │   PaymentProviderBase   │
                    │      (Abstract Class)   │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Unconfigured   │    │     Sandbox      │    │     PayHere      │
│  Provider (none) │    │  Provider (dev)  │    │  Provider (live) │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

### 2.1 Supported Providers
- **`UnconfiguredPaymentProvider` (`'none'`):** Safe fallback when no merchant gateway is configured. Prevents runtime exceptions, safely keeps orders in `awaiting_payment` status, and responds with code `PAYMENT_NOT_CONFIGURED`.
- **`SandboxPaymentProvider` (`'sandbox'`):** Full development and testing harness. Computes HMAC-SHA256 tokens, provides visual checkout simulation, and verifies test webhooks without external internet dependencies.
- **`PayHerePaymentProvider` (`'payhere'`):** Production-ready gateway implementation for Sri Lanka (LKR currency). Formats checkout redirects, implements multi-field MD5 signature validation (`merchant_id + order_id + amount + currency + md5(secret)`), and verifies server-to-server IPN callbacks.

---

## 3. Cryptographic Verification & Security Models

### 3.1 PayHere Cryptographic Checksum Formulation
In accordance with Central Bank of Sri Lanka payment specifications:

#### Checkout Hash:
$$\text{hash} = \text{MD5}(\text{merchant\_id} + \text{order\_id} + \text{amount\_formatted} + \text{currency} + \text{MD5}(\text{merchant\_secret})).\text{toUpperCase}()$$

#### Webhook / IPN Verification:
$$\text{expected\_md5} = \text{MD5}(\text{merchant\_id} + \text{order\_id} + \text{payhere\_amount} + \text{payhere\_currency} + \text{status\_code} + \text{MD5}(\text{merchant\_secret})).\text{toUpperCase}()$$

If the incoming `md5sig` header or field does not match `expected_md5`, the request is immediately rejected with `401 Unauthorized` and an audit security event is logged.

### 3.2 Sandbox HMAC-SHA256 Checksum Formulation
$$\text{signature} = \text{HMAC-SHA256}_{\text{webhookSecret}}(\text{order\_number} + ":" + \text{amount.toFixed(2)} + ":" + \text{currency})$$

Incoming requests must supply the signature in header `x-nexus-signature` or payload field `signature`.

---

## 4. End-to-End Payment Flow & Webhook Processing

```
[Member] ──► POST /member/payments/initiate ──► [NexusPaymentService]
                                                        │
                                         (Validates Server Amount)
                                         (Creates / Reuses Payment Record)
                                                        │
                                                        ▼
[Gateway Webhook / IPN] ──► POST /payments/webhook/:provider
                                    │
                         (Cryptographic Signature Verification)
                         (Amount & Currency Integrity Check)
                         (Idempotency Check)
                                    │
                                    ├─── [Duplicate Webhook] ──► HTTP 200 (idempotent: true)
                                    │
                                    └─── [Valid First Delivery]
                                                 │
                                                 ├──► Update Payment: status = 'paid'
                                                 ├──► Update Order: status = 'paid'
                                                 ├──► If Package: profile.package_status = pkg.package_code
                                                 ├──► Emit Member Activity & Notification
                                                 ├──► Emit Audit Log: PAYMENT_VERIFIED
                                                 └──► Dispatch Decoupled Hook: PAYMENT_VERIFIED
```

---

## 5. Idempotency & Concurrency Guarantees

1. **Payment Initiation Idempotency:** If a member retries payment for an order already in `awaiting_payment` status, `initiatePayment()` reuses the existing `initiated`/`pending` payment record, preventing orphan records and double charge sessions.
2. **Webhook Idempotency:** If a payment gateway sends repeated IPN notifications for an order that is already marked `paid`, the service recognizes the terminal state and immediately returns `HTTP 200 { success: true, idempotent: true }` without re-executing activation or emitting duplicate audit entries.
3. **Database Uniqueness:** Each payment record contains a unique `merchant_reference` and tracks `provider_payment_id`.

---

## 6. MLM Commission Decoupling Safeguard

Per the strict architectural boundaries of Prompt 10:
- **Event Dispatched:** When a payment is cryptographically verified, the payment service fires:
  ```javascript
  dispatchPaymentVerifiedHook({
      event: 'PAYMENT_VERIFIED',
      order_id,
      order_number,
      member_id,
      amount,
      currency,
      package_id,
      timestamp
  });
  ```
- **Zero Commission Computation:** The hook is an event-driven listener stub. **NO direct commission, binary commission, upline distribution, or wallet balance mutation is performed in this phase.**
- **Member & Sponsor Financial Neutrality:** Kasun Bandara and Sponsor (Root NP000001) continue to see `financials.isAvailable: false, badge: 'Coming Soon'` on their dashboard. No phantom or simulated balances are introduced.

---

## 7. Admin Payment Ledger & Controlled Reconciliation

Located in the Nexus Prime Admin Panel (`/admin` -> Payments tab):
- **4 Real-Time KPI Cards:** Total Payments Count, Pending/Initiated Payments, Verified Paid Count, Total Reconciled Volume (LKR).
- **Multi-Field Filter & Search:** Filter by status (`initiated`, `pending`, `paid`, `failed`), search by `NP-ORD-...`, payment ID, or member name.
- **Manual Reconciliation Modal:** Authorized administrators (`admin` or `super_admin`) can manually reconcile unverified or disputed gateway transactions with mandatory audit notes. Emits `PAYMENT_MANUALLY_RECONCILED` in the tamper-proof audit trail.
