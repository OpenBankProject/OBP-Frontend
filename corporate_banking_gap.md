# Corporate Banking Gap List — API Manager + Portal

Pages required for an end-to-end corporate-banking workflow across the two frontends in this monorepo. Each item is a UI page that **does not yet exist** but is required to operate a feature the backend already supports. Each item is tagged with its target app.

OBP-Frontend is a generic product — nothing in the implementation should be tied to a specific customer, jurisdiction, or regional payment scheme. Where examples are given below, treat them as illustrative; the page itself must accept any value the backend accepts.

## Apps

- `apps/api-manager` (SvelteKit, port 3003) — bank-ops staff. Today has no UI for items 1.2 (write), 1.3, 1.4, 1.5, 2.1.
- `apps/portal` (SvelteKit, port 5174) — corporate customer self-service. A foundational accounts surface now exists (see "Status — Portal accounts foundation" below); items 1.1, 1.2 (read), 2.2, 2.3 are still net-new but can hang off it.

## Status — Portal accounts foundation (DONE)

A basic Portal accounts surface has been built and is the navigation root for the customer-facing items in this list. **Next agent: do not rebuild this; nest the new corporate-banking pages under these routes.**

Routes that exist:

- `(protected)/user/accounts/+page.svelte` — list of accounts the user has access to across all banks. Calls `GET /obp/v3.0.0/my/accounts` and `GET /obp/v5.1.0/banks` (for bank names).
- `(protected)/user/accounts/[bank_id]/[account_id]/+page.server.ts` — redirect-only. Resolves a default view (`owner` → first private → first available) via `GET /obp/v5.0.0/banks/{bank_id}/accounts/{account_id}/views` and 307s to the view-scoped URL.
- `(protected)/user/accounts/[bank_id]/[account_id]/[view_id]/+page.svelte` — per-view detail. Shows label, type, balance, routings, last 10 transactions, and a view picker (with "no access" disabled options). Calls:
  - `GET /obp/v7.0.0/banks/{bank_id}/accounts/{account_id}/{view_id}/account`
  - `GET /obp/v6.0.0/banks/{bank_id}/accounts/{account_id}/{view_id}/transactions?limit=10&sort_direction=DESC`
  - `GET /obp/v5.0.0/banks/{bank_id}/accounts/{account_id}/views` (view picker — requires owner; falls back to `/my/accounts` views if it fails)
  - `GET /obp/v3.0.0/my/accounts` (to mark which views the user has access to)
- Navigation: `Accounts` item added to `myAccountItems` in `apps/portal/src/lib/config/navigation.ts` (Wallet icon, between Profile and Consents).

What's intentionally **not** done — open for follow-up agents:

- No write actions on accounts (no label edit, transfer initiation, statement download, etc.).
- No link-outs from the detail page to mandates / counterparties / TR queue, because those pages don't exist yet — they should be added as the corresponding gap items below land.
- No corporate-vs-individual distinction; the page is generic and works for both.

Implication for the gap items below: where a Portal route currently says `(protected)/banks/[bank_id]/accounts/[account_id]/...`, prefer nesting under the existing surface as `(protected)/user/accounts/[bank_id]/[account_id]/...` (or `.../[view_id]/...` when view-scoped). This keeps the user-self-service navigation coherent. The originally proposed paths in items 1.1, 1.2 (read), 2.2, 2.3 should be re-rooted accordingly.

## Conventions

- API Manager reference page: `apps/api-manager/src/routes/(protected)/mandates/[bank_id]/[account_id]/create/+page.svelte` — uses `trackedFetch` against `/proxy/obp/v{N}.0.0/...`.
- Portal reference pages: the accounts surface listed above (`(protected)/user/accounts/...`) is the new Portal corporate-banking template. Server-side load functions use `obp_requests.get(endpoint, accessToken)` with `accessToken` read from `event.locals.session.data.oauth?.access_token`; client-side fetches go through `/proxy/obp/...` per `apps/portal/CLAUDE.md`.
- A reference Bruno collection lives at `~/Documents/workspace_2024/commands/` — open the relevant `.bru` files only for example request bodies and response shapes.
- For every new page, add a Playwright page object under `~/Documents/workspace_2024/OBP-End-To-End-Testing/src/pages/<app>/`.

## Priority 1

### 1.1 Signatory Panels — `[portal]`

Groupings of users a corporate customer designates as authorized signatories for an account's mandate. The corporate administrator names and assembles these; the bank shouldn't be the bottleneck.

- **App**: Portal
- **New routes** (proposed):
  - `(protected)/banks/[bank_id]/accounts/[account_id]/mandates/[mandate_id]/signatory-panels/+page.svelte` — list
  - `.../signatory-panels/create/+page.svelte` — create
  - `.../signatory-panels/[panel_id]/+page.svelte` — view + edit members
- **API**: `POST/GET/PUT/DELETE /obp/v6.0.0/banks/{bank_id}/mandates/{mandate_id}/signatory-panels` (no account_id in the URL — the route hierarchy carries it for navigation only)
- **Form fields**: `panel_name`, `description`, `user_ids[]` (multi-pick from `/users`).
- **Reference**: `commands/.../signatory-panels` Bruno requests.
- **Acceptance**: a corporate admin can create panels named freely, add multiple users, edit membership, and see all panels listed.

Note: API Manager may want a read-only mirror for bank-ops audit. Not in scope here.

### 1.2 Mandate Provisions — `[api-manager write / portal read]`

The thresholded signing rules (e.g. "single signer below X, dual signer at or above X" — values, currency, and rule logic are user-defined) that codify a mandate's signing requirements. Because provisions are part of the legal mandate, the bank typically authors them and the customer reads them.

- **Apps**:
  - API Manager — create / edit / delete
  - Portal — list + view (read-only) so the corporate can see what rules govern their mandate
- **API Manager routes**:
  - `(protected)/mandates/[bank_id]/[account_id]/[mandate_id]/provisions/+page.svelte` — list
  - `.../provisions/create/+page.svelte` — create
  - `.../provisions/[provision_id]/+page.svelte` — view + edit
- **Portal routes**:
  - `(protected)/banks/[bank_id]/accounts/[account_id]/mandates/[mandate_id]/provisions/+page.svelte` — list (read-only)
  - `.../provisions/[provision_id]/+page.svelte` — view (read-only)
- **API**: `POST/GET/PUT/DELETE /obp/v6.0.0/banks/{bank_id}/mandates/{mandate_id}/provisions`
- **Form fields** (API Manager): `provision_name`, `provision_description`, `legal_reference`, `provision_type` (enum from backend; start with `SIGNATORY_RULE`), `conditions` (free JSON editor — the page must not constrain the JSON schema), `signatory_requirements[]` (repeating group of `{panel_id, required_count}`, with `panel_id` references resolved against panels created in 1.1), `linked_view_id` (select from custom views on the account), `linked_challenge_type` (enum), `is_active` (boolean).
- **Cross-app dependency**: provisions reference `panel_id`s created in Portal (1.1). API Manager's create page resolves panel IDs via the shared backend; do not duplicate panel UI in API Manager.
- **Acceptance**: an ops user can create provisions with arbitrary conditions and signatory requirements in API Manager; the corporate sees them in Portal.

### 1.3 Account Routings — `[api-manager]`

Manage the list of `{scheme, address}` routing pairs on an account (IBAN, BIC, sort code, etc.). The bank assigns routing identifiers; the customer does not pick these. Today only `integration/method-routings` exists in API Manager, which is unrelated (connector internals).

- **App**: API Manager
- **New route**: `(protected)/banks/[bankId]/accounts/[account_id]/routings/+page.svelte` — list + inline create + delete.
- **API**: `PUT /obp/v3.1.0/management/banks/{bank_id}/accounts/{account_id}` with `account_routings: [{scheme, address}]` — the whole list is set on the account in one call (see `commons.model.BankAccount.accountRoutings`). Read via the account GET (`/obp/v.../banks/{bank_id}/accounts/{account_id}/account` family — pick the version available to ops).
- **Form fields per row**: `scheme` (free text), `address` (free text). Do **not** hardcode a scheme allow-list — any scheme the backend accepts must be accepted by the page. Optional typeahead suggestions are acceptable as long as they don't block arbitrary input.
- **Acceptance**: an ops user can add, edit, and delete any number of routings with any scheme/address pair the backend allows.

### 1.4 Account Attributes — `[api-manager]`

Open-ended `{name, type, value}` triples on an account. Bank-side admin metadata.

- **App**: API Manager
- **New route**: `(protected)/banks/[bankId]/accounts/[account_id]/attributes/+page.svelte` — list + create + delete.
- **API**:
  - Create: `POST /obp/v3.1.0/banks/{bank_id}/accounts/{account_id}/products/{product_code}/attribute`
  - Update: `PUT /obp/v3.1.0/banks/{bank_id}/accounts/{account_id}/products/{product_code}/attributes/{account_attribute_id}`
- **⚠ Backend gap — resolve before starting the page.** The OBP backend currently has **no list-GET and no DELETE** for Account Attributes (verified against the `Attribute` tag — 60 endpoints; Bank/Customer/Transaction/ATM/User attributes all have full CRUD, Account Attribute is the outlier with only POST + PUT). Either the backend has to add the missing endpoints, or the page is restricted to create + edit.
- **Form fields**: `name` (free text), `type` (`STRING` | `INTEGER` | `DOUBLE` | `DATE_WITH_TIME`), `value` (free text, validated against `type`), `product_code` (required — it's in the URL path).
- **Acceptance** (subject to backend fix): an ops user can add arbitrary attributes and read them back on the account detail page.

### 1.5 Customer Links (customer ↔ customer relationships) — `[api-manager]`

Create, list, and delete customer-to-customer KYC/CRM relationships. The graph at `/customers/graph` likely renders them but there is no management surface. This is bank-side reference data.

- **App**: API Manager
- **New routes**:
  - `(protected)/customers/links/+page.svelte` — list all customer links at a bank
  - `(protected)/customers/links/create/+page.svelte` — create
  - `(protected)/customers/[bank_id]/[customer_id]/links/+page.svelte` — links *from* this customer
- **API**: `POST/GET /obp/v6.0.0/banks/{bank_id}/customer-links`, `DELETE /obp/v6.0.0/banks/{bank_id}/customer-links/{customer_link_id}`.
- **Form fields**: `customer_id` (this side), `other_bank_id`, `other_customer_id`, `relationship_to` (free text — backend accepts arbitrary relationship labels; do **not** restrict to a fixed list).
- **Acceptance**: from a customer detail page, an ops user can add links to any number of other customers with any relationship label; `/customers/graph` reflects the change.

## Priority 2

### 2.1 Operator-issued consent flow — `[api-manager]`

Today `/user/consents` (both apps) shows only the logged-in user's consents. Operators need to issue a scoped consent **on behalf of** a user for a third-party consumer, including `account_access[]` + `entitlements[]` arrays and an SCA challenge step.

- **App**: API Manager
- **New routes**:
  - `(protected)/consumers/[consumer_id]/consents/+page.svelte` — consents issued to this consumer
  - `(protected)/consumers/[consumer_id]/consents/create/+page.svelte` — create consent-request → challenge → activate
- **API** (verify exact paths against the OBP server before implementing — the channel segment may be a body field rather than a path segment):
  - `POST /obp/v5.0.0/consumer/consent-requests`
  - `POST /obp/v5.0.0/consumer/consent-requests/{cr_id}/{channel}/consents` (channel: SMS, EMAIL, …)
  - `POST /obp/v5.0.0/banks/{bank_id}/consents/{consent_id}/challenge`
  - `DELETE /obp/v5.0.0/banks/{bank_id}/my/consents/{consent_id}`
- **Form fields**: bank, `account_access[]` (repeating `{account_routing|account_id, view_id}`), `entitlements[]` (repeating `{bank_id, role_name}`), `valid_from`, `time_to_live` (seconds), `phone_number`, `email`, challenge answer.
- **Acceptance**: an operator can issue a scoped, expiring consent to a chosen consumer, complete the SCA challenge inline, and revoke it.

### 2.2 Counterparty allow-list management — `[portal]`

Counterparties are viewable per `account/view` in API Manager today (under `account-access/...`). What's missing is a *flat per-account* allow-list with approval state, so a corporate's junior users can only pay pre-approved counterparties. This is the corporate's own beneficiary list with an internal maker/checker workflow.

- **App**: Portal
- **New route**: `(protected)/banks/[bank_id]/accounts/[account_id]/counterparties/+page.svelte` — flat list of all counterparties on the account, with create + delete + (where the backend supports it) approval state.
- **API**: existing counterparty endpoints under `/obp/v4.0.0/banks/{bank_id}/accounts/{account_id}/{view_id}/counterparties`.
- **Acceptance**: a corporate admin can curate an allow-list; the page distinguishes approved and unapproved entries.

Note: bank ops may need an AML/sanctions oversight view. Not in scope here.

### 2.3 Transaction Request approval queue (maker / checker) — `[portal]`

A queue of pending `TransactionRequest`s awaiting challenge / approval — pairs with the mandate provisions in 1.2. Payment initiator and approver are both customer-side roles.

- **App**: Portal
- **New route**: `(protected)/banks/[bank_id]/accounts/[account_id]/transaction-requests/+page.svelte` — list pending + completed + ability to answer challenges.
- **API**: `GET /obp/v4.0.0/banks/{bank_id}/accounts/{account_id}/{view_id}/transaction-requests`, `POST …/transaction-request-types/{type}/transaction-requests/{request_id}/challenge`.
- **Acceptance**: a payment initiator creates a TR, an approver sees it in the queue, completes the challenge, the TR moves to completed.

## What this list does **not** include

Considered and intentionally left out — these exist already (don't duplicate) or are out of scope here:

- API Manager: `/customers/corporate`, `/customers/graph`, `/customers/account-links` — exist
- API Manager: `/account-access/system-views`, `/account-access/custom-views`, `/account-access/view-permissions` — exist
- API Manager: `/mandates/[bank_id]/[account_id]/create` — exists (only panels + provisions are missing — items 1.1 and 1.2)
- API Manager: `/products/[bank_id]/[product_code]`, `/banks/fx-rates` — exist
- API Manager: `/rbac/roles`, `/rbac/groups`, `/rbac/entitlements/bulk-grant`, `/rbac/entitlement-requests` — exist
- API Manager: `/aggregate-metrics`, `/aggregate-metrics-live`, `/aggregate-metrics-trends`, `/metrics` — exist
- API Manager: `/abac/rules`, `/dynamic-entities/system`, `/dynamic-endpoints/system` — exist
- API Manager: `/chat-rooms/*` — out of scope
- API Manager: `/integration/method-routings` — connector internals, unrelated to account routings (1.3)
- API Manager: `/system/*` — bank-ops admin, out of scope
- Portal: `/user/consents`, `/user/personal-data-fields`, `/user/api-collections`, `/user/consumers` — exist (personal scope only)

## Build order recommendation

0. **DONE** — Portal accounts foundation (list + per-view detail + view picker + nav). See "Status — Portal accounts foundation" above.

Cross-app dependency: provisions (1.2 API Manager) reference panel_ids created in 1.1 (Portal). Build 1.1 first.

1. 1.1 Signatory Panels (Portal) — nest under the existing account detail routes
2. 1.2 Mandate Provisions — API Manager write first, then Portal read
3. 1.3 (API Manager) + 1.4 (API Manager) in parallel — **resolve 1.4 backend gap first**
4. 1.5 (API Manager)
5. P2 items as time allows — 2.1 (API Manager), 2.2 + 2.3 (Portal); 2.2 and 2.3 are the obvious link-outs from the existing Portal account detail page

## Genericity guardrails for implementers

- No customer names in code, copy, comments, fixtures, or seeds.
- No country / region / regulatory-body names baked into labels, validation, or option lists. Use the backend's enums where they exist; otherwise free text.
- No payment scheme codes in allow-lists. The user must be able to type any string the backend accepts.
- Default placeholder text should be empty or domain-generic (e.g. "e.g. BIC, IBAN"), never a specific market.
- Example data in tests should use generic placeholders (`Acme Corp`, `Subsidiary 1`, `Currency A`).
