# API Products Feature - Implementation Plan

**Status:** Planning Phase
**Created:** 2026-02-05
**Last Updated:** 2026-11-17

> **Superseded for checkout and orders.** Subscribing now follows OBP-API's
> `docs/API_PRODUCT_SUBSCRIPTION_PLAN.md`: the Portal's `/subscriptions` page creates an API Product
> Subscription (v7.0.0). For a product whose `BILLING_SYSTEM` is `stripe`, it then sends the user to
> OBP-Stripe at `{PUBLIC_SUBSCRIPTIONS_URL}/checkout?api_product_subscription_id=...`. OBP-Stripe takes the
> payment and makes the subscription active. The old `/checkout/[product_code]` route, the account
> application step and `STRIPE_CHECKOUT_URL` have been removed. Sections 4.3, 4.4, 5 and Phases 3 to 5 below
> describe that earlier design and are kept only as history.

## 1. Overview

Add API Product functionality to OBP-Portal with a `/products` page that is similar to `/featured` but commercially focused. This feature will allow API consumers to browse, order, and subscribe to API products with integrated payment handling via Stripe.

## 2. Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           OBP-Portal                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │  /products   │    │  /orders     │    │  /my-products│               │
│  │  (browse)    │    │  (checkout)  │    │  (dashboard) │               │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘               │
│         │                   │                   │                        │
│         └───────────────────┼───────────────────┘                        │
│                             │                                            │
└─────────────────────────────┼────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           OBP-API                                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │   Products   │───▶│ API-Collections│   │    Roles     │               │
│  │  (catalog)   │    │ (via attribute)│   │ (rate limits)│               │
│  └──────────────┘    └──────────────┘    └──────────────┘               │
│         │                                       ▲                        │
│         ▼                                       │                        │
│  ┌──────────────┐    ┌──────────────┐          │                        │
│  │   Account    │───▶│   Accounts   │──────────┘                        │
│  │ Applications │    │ (provisioned)│                                   │
│  │  (Orders)    │    │              │                                   │
│  └──────┬───────┘    └──────────────┘                                   │
│         │                                                                │
└─────────┼────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          OBP-Stripe                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │ Subscription │    │   Webhooks   │───▶│  Set Roles & │               │
│  │   Creation   │    │  (payments)  │    │  Rate Limits │               │
│  └──────────────┘    └──────────────┘    └──────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3. OBP-API Entities & Data Model

### 3.1 Products (Catalog)

OBP Products will serve as the API product catalog. Key attributes:

| Field | Purpose |
|-------|---------|
| `product_code` | Unique identifier (e.g., `api-starter`, `api-pro`, `api-enterprise`) |
| `name` | Display name |
| `description` | Marketing description (markdown supported) |
| `meta.collection_id` | **Links to API Collection** - defines which endpoints are included |
| `meta.stripe_price_id` | Stripe Price ID for billing |
| `meta.rate_limit_per_minute` | API rate limit for this tier |
| `meta.rate_limit_per_day` | Daily API rate limit |
| `meta.features` | JSON array of feature highlights |

**OBP Endpoints:**
- `GET /obp/v6.0.0/products` - List all products (filtered for API products)
- `GET /obp/v6.0.0/banks/{bank_id}/products/{product_code}` - Get product details

### 3.2 Account Applications (Orders)

Account Applications will track the order/subscription process:

| Field | Purpose |
|-------|---------|
| `account_application_id` | Unique order ID |
| `product_code` | Links to the Product being ordered |
| `user_id` | The customer |
| `status` | `REQUESTED` → `ACCEPTED` → `ACTIVE` or `REJECTED` |
| `date_of_application` | Order timestamp |

**Status Flow:**
```
REQUESTED (order placed)
    ↓
[Payment via Stripe]
    ↓
ACCEPTED (payment confirmed via webhook)
    ↓
[Account & Roles provisioned]
    ↓
ACTIVE (customer can use API)
```

**OBP Endpoints:**
- `POST /obp/v6.0.0/banks/{bank_id}/account-applications` - Create order
- `GET /obp/v6.0.0/banks/{bank_id}/account-applications` - List orders
- `PUT /obp/v6.0.0/banks/{bank_id}/account-applications/{id}` - Update status

### 3.3 API Collections (Endpoint Bundles)

Each Product links to an API Collection defining included endpoints:

- Product's `meta.collection_id` → API Collection
- API Collection contains list of `operation_id`s the customer can access

**OBP Endpoints:**
- `GET /obp/v6.0.0/api-collections/{collection_id}` - Get collection
- `GET /obp/v6.0.0/api-collections/{collection_id}/api-collection-endpoints` - List endpoints

### 3.4 Accounts & Roles (Provisioning)

When subscription is active, OBP-Stripe webhooks provision:

1. **Account** - Associated with the Product
2. **Roles** - Grant API access permissions (e.g., `CanCreateBank`, `CanQueryAccounts`)
3. **Rate Limits** - Set via consumer/role rate limit endpoints

## 4. Portal Implementation

### 4.1 New Routes

| Route | Purpose | Auth Required |
|-------|---------|---------------|
| `/products` | Browse API products catalog | No |
| `/products/[product_code]` | Product detail page | No |
| `/user/orders` | Customer's orders/subscriptions | Yes |
| `/user/orders/[order_id]` | Order detail/status | Yes |
| `/subscriptions` | Subscribe a consumer to an API product; pay or manage billing in OBP-Stripe | Yes |

### 4.2 `/products` Page Implementation

**Based on `/featured` pattern:**

```
src/routes/products/
├── +page.server.ts    # Load products from OBP-API
├── +page.svelte       # Product cards grid (commercial focus)
└── [product_code]/
    ├── +page.server.ts
    └── +page.svelte   # Product detail with pricing & CTA
```

**Data Loading (`+page.server.ts`):**
1. Fetch products: `GET /obp/v6.0.0/products`
2. Filter for API products (by product_code prefix or meta attribute)
3. For each product, fetch linked collection to show endpoint count
4. Return enriched product data

**UI Components (`+page.svelte`):**
- Product cards with:
  - Name, description
  - Price (from Stripe or meta)
  - Key features list
  - Endpoint count ("Access 50+ endpoints")
  - Rate limit info
  - CTA button ("Subscribe" / "Get Started")
- Comparison table for tiers
- FAQ section

### 4.3 `/checkout/[product_code]` Flow

1. User clicks "Subscribe" on product
2. If not logged in → redirect to login with return URL
3. Create Account Application (status: REQUESTED)
4. Redirect to Stripe Checkout with:
   - `price_id` from product meta
   - `client_reference_id` = account_application_id
   - `success_url` = `/user/orders/{order_id}?status=success`
   - `cancel_url` = `/products/{product_code}?status=cancelled`

### 4.4 `/user/orders` Dashboard

- List all Account Applications for current user
- Show status, product, date, actions
- Link to manage subscription in Stripe portal

## 5. OBP-Stripe Integration

### 5.1 Current Functionality (Existing)

- Creates Stripe subscriptions
- Webhooks call OBP endpoints to create roles (e.g., `CanCreateBank`)

### 5.2 Required Modifications

#### 5.2.1 Webhook Handler Updates

When `checkout.session.completed` or `invoice.paid`:

1. **Extract `client_reference_id`** (= account_application_id)
2. **Update Account Application status** → `ACCEPTED`
3. **Lookup Product** to get:
   - `collection_id` (for endpoint access)
   - `rate_limit_per_minute` / `rate_limit_per_day`
   - Role list to grant
4. **Provision Access:**
   - Create Account (if needed)
   - Grant Roles
   - **NEW: Set Rate Limits** via OBP rate limit endpoints
5. **Update Account Application status** → `ACTIVE`

#### 5.2.2 Rate Limit Setting

**OBP Endpoints for Rate Limits:**
- `PUT /obp/v6.0.0/management/consumers/{consumer_id}/consumer/call-limits`
- Or role-based: Configure rate limits per role

**Payload Example:**
```json
{
  "per_minute_call_limit": "100",
  "per_day_call_limit": "10000",
  "per_week_call_limit": "-1",
  "per_month_call_limit": "-1"
}
```

#### 5.2.3 Subscription Lifecycle Events

| Stripe Event | Action |
|--------------|--------|
| `checkout.session.completed` | Create/update order, provision access |
| `invoice.paid` | Ensure access is active, extend if needed |
| `customer.subscription.updated` | Handle plan changes (upgrade/downgrade) |
| `customer.subscription.deleted` | Revoke roles, update status to cancelled |
| `invoice.payment_failed` | Mark order as payment_issue, notify user |

## 6. Open Questions & Decisions Needed

### 6.1 Product Catalog Management

**Q1:** Where should Products be created/managed?
- [ ] **Option A:** Directly in OBP-API (admin endpoints)
- [ ] **Option B:** Via a separate admin UI in Portal
- [ ] **Option C:** Seeded via configuration/migration scripts

### 6.2 Rate Limit Granularity

**Q2:** Should rate limits be per-consumer or per-role?
- [ ] **Option A:** Per-consumer (each customer gets individual limits)
- [ ] **Option B:** Per-role (all customers with same role share limit definition)
- [ ] **Option C:** Both - base limit from role, override at consumer level

### 6.3 Endpoint Access Control

**Q3:** How to enforce collection-based endpoint access?
- [ ] **Option A:** Roles map to collections (e.g., `CanUseStarterCollection`)
- [ ] **Option B:** Dynamic checking against collection membership
- [ ] **Option C:** Generate granular roles per endpoint automatically

### 6.4 Trial/Free Tier

**Q4:** Should there be a free tier?
- [ ] **Option A:** Yes, with limited rate limits and endpoint access
- [ ] **Option B:** No, require payment for any access
- [ ] **Option C:** Time-limited trial (e.g., 14 days)

### 6.5 Multi-Bank Support

**Q5:** Which bank_id should be used for Account Applications?
- [ ] **Option A:** Single designated "API Products" bank
- [ ] **Option B:** User selects bank during checkout
- [ ] **Option C:** Create virtual bank per customer

### 6.6 Existing Subscriptions

**Q6:** How to handle users who already have OBP-Stripe subscriptions?
- [ ] **Option A:** Migrate to new product-based system
- [ ] **Option B:** Grandfather existing, new system for new customers
- [ ] **Option C:** Run both systems in parallel

## 7. Implementation Phases

### Phase 1: Foundation (Portal)
- [ ] Create `/products` route with mock/static data
- [ ] Design product card component
- [ ] Create product detail page
- [ ] Add types for Product, Order in `src/lib/obp/types.ts`

### Phase 2: OBP Integration (Products)
- [ ] Add OBP API calls for Products in `src/lib/obp/requests.ts`
- [ ] Create Products with `meta.collection_id` attribute in OBP
- [ ] Wire up `/products` to fetch real data
- [ ] Display linked collection endpoint counts

### Phase 3: Checkout Flow
- [ ] Create `/checkout/[product_code]` route
- [ ] Implement Account Application creation
- [ ] Integrate Stripe Checkout redirect
- [ ] Create success/cancel handling pages

### Phase 4: OBP-Stripe Modifications
- [ ] Update webhook handler for new flow
- [ ] Add rate limit setting logic
- [ ] Implement subscription lifecycle handlers
- [ ] Test end-to-end payment flow

### Phase 5: Customer Dashboard
- [ ] Create `/user/orders` route
- [ ] Display order history and status
- [ ] Add Stripe customer portal link
- [ ] Show current subscription details

### Phase 6: Polish & Launch
- [ ] Add upgrade/downgrade flows
- [ ] Implement cancellation handling
- [ ] Add email notifications (via OBP or Stripe)
- [ ] Documentation and marketing content

## 8. File Structure (Proposed)

```
src/
├── routes/
│   ├── products/
│   │   ├── +page.server.ts       # Load products catalog
│   │   ├── +page.svelte          # Products grid
│   │   └── [product_code]/
│   │       ├── +page.server.ts   # Load single product
│   │       └── +page.svelte      # Product detail
│   ├── subscriptions/
│   │   ├── +page.server.ts       # Create the subscription, redirect to OBP-Stripe checkout
│   │   └── +page.svelte          # Apply form and the user's subscriptions
│   └── (protected)/
│       └── user/
│           └── orders/
│               ├── +page.server.ts   # Load user's orders
│               ├── +page.svelte      # Orders list
│               └── [order_id]/
│                   ├── +page.server.ts
│                   └── +page.svelte  # Order detail
├── lib/
│   ├── obp/
│   │   ├── types.ts              # Add Product, AccountApplication types
│   │   └── requests.ts           # Add product/order API methods
│   └── components/
│       ├── ProductCard.svelte    # Reusable product card
│       └── OrderStatus.svelte    # Order status badge/timeline
```

## 9. Environment Variables (New)

```env
# Stripe integration
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx

# API Products bank
OBP_PRODUCTS_BANK_ID=api-products-bank

# Feature flags
PUBLIC_ENABLE_PRODUCTS=true
```

## 10. Next Steps

1. **Resolve Open Questions** (Section 6) - need decisions on Q1-Q6
2. **Begin Phase 1** - Create basic `/products` page structure
3. **Coordinate with OBP-API team** - Ensure Product endpoints support needed meta attributes
4. **Coordinate with OBP-Stripe team** - Plan webhook handler modifications

---

## Appendix A: Example Product Data

```json
{
  "product_code": "api-pro",
  "name": "API Pro",
  "category": "API_ACCESS",
  "description": "Full access to core banking APIs with generous rate limits. Perfect for growing applications.",
  "meta": {
    "collection_id": "pro-collection-123",
    "stripe_price_id": "price_1234567890",
    "rate_limit_per_minute": 100,
    "rate_limit_per_day": 10000,
    "features": [
      "Access to 150+ endpoints",
      "100 requests/minute",
      "Priority support",
      "Sandbox & Production access"
    ],
    "tier": "pro",
    "monthly_price_usd": 99
  }
}
```

## Appendix B: Account Application Example

```json
{
  "account_application_id": "app-uuid-12345",
  "product_code": "api-pro",
  "user_id": "user-uuid-67890",
  "status": "ACTIVE",
  "date_of_application": "2026-02-05T10:30:00Z",
  "customer_number": "CUST-001",
  "stripe_subscription_id": "sub_1234567890",
  "stripe_customer_id": "cus_1234567890"
}
```
