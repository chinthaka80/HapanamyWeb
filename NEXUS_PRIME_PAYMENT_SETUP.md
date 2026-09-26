# NEXUS PRIME (PVT) LTD — PAYMENT GATEWAY SETUP & CONFIGURATION RUNBOOK
**Domain:** `nexusp.online`  
**Corporate Entity:** Nexus Prime (PVT) Ltd  
**Target Environment:** Staging & Production Deployment  

---

## 1. Environment Variables Configuration

Configure the following environment variables in your deployment environment (or `.env` file for local development):

```bash
# ==============================================================================
# NEXUS PRIME PAYMENT CONFIGURATION (STRICTLY SEPARATE FROM HAPANAMY.LK)
# ==============================================================================

# Active Payment Provider: 'none' | 'sandbox' | 'payhere'
NEXUS_PAYMENT_PROVIDER=sandbox

# PayHere Merchant Credentials (Obtain from PayHere Merchant Portal for nexusp.online)
NEXUS_PAYMENT_MERCHANT_ID=YOUR_NEXUS_PAYHERE_MERCHANT_ID
NEXUS_PAYMENT_API_SECRET=YOUR_NEXUS_PAYHERE_MERCHANT_SECRET

# Webhook Cryptographic Secret (Used for HMAC verification in sandbox or secondary validation)
NEXUS_PAYMENT_WEBHOOK_SECRET=your_secure_random_nexus_webhook_secret_here

# Sandbox Mode Flag: 'true' for sandbox testing, 'false' for live production payments
NEXUS_PAYMENT_SANDBOX=true

# Authoritative Application URL (Used for Return/Cancel Redirects)
NEXUS_APP_URL=https://nexusp.online
```

> [!IMPORTANT]
> **CRITICAL ISOLATION NOTICE:**  
> Never enter Hapanamy.lk merchant IDs, API secrets, or webhook URLs into Nexus Prime configuration. Nexus Prime must have its own dedicated merchant account registered under **Nexus Prime (PVT) Ltd** on `nexusp.online`.

---

## 2. Webhook & IPN Callback Endpoints

Configure these URLs in your gateway portal under Notification / IPN Settings:

| Provider | Webhook URL | Supported Methods | Signature Requirement |
|---|---|---|---|
| **PayHere (Live/Sandbox)** | `https://nexusp.online/api/v1/nexus/payments/webhook/payhere` | `POST` (application/x-www-form-urlencoded or JSON) | `md5sig` multi-field checksum |
| **Sandbox Simulation** | `https://nexusp.online/api/v1/nexus/payments/webhook/sandbox` | `POST` (application/json) | `x-nexus-signature` HMAC-SHA256 |
| **Generic Gateway Route** | `https://nexusp.online/api/v1/nexus/payments/webhook` | `POST` | Default active provider signature |

---

## 3. How to Test Using Sandbox Provider

When `NEXUS_PAYMENT_PROVIDER=sandbox` is active:

1. **Log in as a Member:** Navigate to `/login` and sign in with test credentials (e.g. `kasun@nexusp.online` / `Password123!`).
2. **Select a Package or Product:** Go to `/dashboard` -> Packages tab, and click **Purchase Package** (e.g. *Starter Package - 7,500 LKR*).
3. **Initiate Payment Session:** The order modal opens with authoritative server price snapshots. Click **Proceed to Payment Checkout**.
4. **Interactive Sandbox Modal:** A payment modal pops up showing:
   - Order Number (`NP-ORD-XXXXXX`)
   - Authoritative Total (`7,500 LKR`)
   - Cryptographic HMAC Token
5. **Simulate Webhook Delivery:**
   - Click **Simulate Successful Gateway Webhook**.
   - The client triggers `POST /api/v1/nexus/payments/webhook/sandbox` with the calculated cryptographic HMAC signature.
   - The backend validates the signature, marks payment and order as `paid`, activates the member's package standing to `NP-PKG-01`, and emits `PAYMENT_VERIFIED`.
6. **Confirm Verification:**
   - The modal updates to show verified confirmation.
   - The Member Dashboard and Orders Ledger now display the order in `paid` standing with active package status.

---

## 4. Production Onboarding for PayHere

When ready to accept live Sri Lankan debit/credit cards and Sampath Vishwa / Genie mobile payments:

1. Register a merchant account at [PayHere.lk](https://www.payhere.lk) under **Nexus Prime (PVT) Ltd** for the domain `nexusp.online`.
2. Retrieve your **Merchant ID** and **Merchant Secret** from the PayHere Dashboard.
3. In your server environment, update:
   ```bash
   NEXUS_PAYMENT_PROVIDER=payhere
   NEXUS_PAYMENT_MERCHANT_ID=1234567
   NEXUS_PAYMENT_API_SECRET=your_payhere_live_merchant_secret
   NEXUS_PAYMENT_SANDBOX=false
   ```
4. Set the **Notify URL** in the PayHere Merchant Portal to:
   `https://nexusp.online/api/v1/nexus/payments/webhook/payhere`
5. Set Return URL to: `https://nexusp.online/dashboard/orders`
6. Set Cancel URL to: `https://nexusp.online/dashboard/orders`
7. Perform a 100 LKR test transaction with a live card to verify end-to-end IPN receipt and order fulfillment.

---

## 5. Admin Manual Payment Reconciliation Runbook

If a customer claims they were charged but the webhook failed to deliver due to internet routing issues:

1. Log into the Nexus Prime Admin Panel at `/admin`.
2. Select the **Payments** tab from the sidebar.
3. Locate the payment by searching for the order number (e.g. `NP-ORD-000001`) or customer name.
4. Check the transaction status in the bank / PayHere merchant console.
5. If the charge is verified in the bank portal, click the **Reconcile** button on the payment row.
6. Select **Mark as Paid**, enter the bank settlement reference or audit reason (e.g. *"Matched against Bank of Ceylon settlement ref #99812"*), and click **Confirm Reconciliation**.
7. The system atomically:
   - Updates payment status to `paid` and sets `reconciliation_status: 'reconciled'`.
   - Transitions order status to `paid` (or `processing`).
   - Activates the member's package standing if a package was purchased.
   - Records `PAYMENT_MANUALLY_RECONCILED` in the tamper-proof audit trail.
