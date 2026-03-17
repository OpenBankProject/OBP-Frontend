# Pages Missing from SITE_MAP

Pages that exist under `src/routes/(protected)/` but have no entry in `SITE_MAP` (in `src/lib/utils/roleChecker.ts`), meaning they render without the `PageRoleCheck` widget.

Excludes `/user` (profile) and `/user/site-map` which are user-facing and don't need OBP role guards.

---

## RBAC

| Route | Description |
|---|---|
| `/rbac/roles/[role]` | View individual role detail |
| `/rbac/banks` | RBAC banks view |

## System

| Route | Description |
|---|---|
| `/system/webui-props` | List WebUI properties (create/edit/delete are covered) |
| `/system/signal-publish` | Publish signal |

## Consumers

| Route | Description |
|---|---|
| `/consumers/[consumer_id]/rate-limits` | List rate limits for a consumer |
| `/consumers/[consumer_id]/rate-limits/create` | Create rate limit |

## Metrics

| Route | Description |
|---|---|
| `/metrics` | Metrics dashboard |
| `/aggregate-metrics` | Aggregate metrics dashboard |

## Banks

| Route | Description |
|---|---|
| `/banks` | List banks |
| `/banks/[bankId]` | View bank details |

## API Collections

| Route | Description |
|---|---|
| `/api-collections` | List API collections |
| `/api-collections/create` | Create API collection |
| `/api-collections/[collection_id]` | View API collection |
| `/api-collections/[collection_id]/edit` | Edit API collection |
| `/api-collections/[collection_id]/delete` | Delete API collection |

## Products

| Route | Description |
|---|---|
| `/products` | List products |
| `/products/create` | Create product |
| `/products/[bank_id]/[product_code]` | View product detail |
| `/products/[bank_id]/[product_code]/edit` | Edit product |
| `/products/bootstrap` | Bootstrap products |
| `/products/collections` | Product collections |
| `/products/financial` | Financial products |
| `/products/help` | Products help/documentation |

## Account Access

| Route | Description |
|---|---|
| `/account-access/accounts` | List accounts |
| `/account-access/system-views` | List system views (create/edit are covered) |
| `/account-access/system-views/[view_id]` | View system view detail |
| `/account-access/custom-views` | List custom views (create is covered) |
| `/account-access/custom-views/[view_id]` | View custom view detail |

## Dynamic Endpoints

| Route | Description |
|---|---|
| `/dynamic-endpoints/bank` | List bank-level dynamic endpoints |
| `/dynamic-endpoints/bank/[bank_id]/create` | Create bank dynamic endpoint |
| `/dynamic-endpoints/bank/[bank_id]/[id]` | View/edit bank dynamic endpoint |
| `/dynamic-endpoints/system` | List system dynamic endpoints |
| `/dynamic-endpoints/system/create` | Create system dynamic endpoint |
| `/dynamic-endpoints/system/[id]` | View/edit system dynamic endpoint |

## Dynamic Entities

| Route | Description |
|---|---|
| `/dynamic-entities/system` | List system dynamic entities (diagnostics is covered) |
| `/dynamic-entities/system/create` | Create system dynamic entity |
| `/dynamic-entities/system/[id]` | View system dynamic entity detail |
| `/dynamic-entities/system/[id]/crud` | CRUD operations for system dynamic entity |
| `/dynamic-entities/system/openapi-json` | OpenAPI JSON export |
| `/dynamic-entities/system/openapi-yaml` | OpenAPI YAML export |
| `/dynamic-entities/personal` | List personal dynamic entities |
| `/dynamic-entities/personal/[entityName]` | View personal dynamic entity |

## Users

| Route | Description |
|---|---|
| `/users/[user_id]/unlock` | Unlock user by ID (duplicate of `/users/[provider]/[username]/unlock`?) |
| `/users/[user_id]/lock` | Lock user by ID (duplicate of `/users/[provider]/[username]/lock`?) |
| `/user-invitations` | User invitations |

## User (own account — may not need admin role guards)

| Route | Description |
|---|---|
| `/user/consents` | User's own consents |
| `/user/entitlements` | User's own entitlements |
