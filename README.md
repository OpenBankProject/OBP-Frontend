# OBP-Frontend

Monorepo for Open Bank Project frontend applications, using npm workspaces.

## Structure

```
apps/
  portal/          # OBP Portal (SvelteKit) — port 5174
  api-manager/     # API Manager II (SvelteKit) — port 3003
packages/
  shared/          # Shared components & utilities (@obp/shared)
```

## Setup

```bash
npm install          # installs all workspaces, symlinks @obp/shared
```

## Environment

Each app has its own `.env` file. Copy the example and configure:

```bash
cp apps/portal/.env.example apps/portal/.env
cp apps/api-manager/.env.example apps/api-manager/.env
```

Key differences between the two `.env` files:

| Variable | Portal | API Manager |
|---|---|---|
| `ORIGIN` | `http://localhost:5174` | `http://localhost:3003` |
| `APP_CALLBACK_URL` | `http://localhost:5174/login/obp/callback` | `http://localhost:3003/login/obp/callback` |

Everything else (OBP API URL, OAuth credentials, Redis, Opey) can be shared.

### gRPC connection (live streaming features)

Portal chat and API Manager metrics/log streaming connect to OBP-API over gRPC.
Both apps resolve the target the same way:

- `OBP_GRPC_HOST` — explicit gRPC target as `host:port`; always wins when set.
  When unset, the target is derived from `PUBLIC_OBP_BASE_URL`:
  - `https://api.example.com` → `grpc.api.example.com:443` (TLS ingress convention)
  - `http://api.example.com` → `grpc.api.example.com:50051`
  - `http://localhost:8080` or an IP → `localhost:50051` / `<ip>:50051` (no `grpc.` prefix)
- `OBP_GRPC_TLS` — `true` or `false`; forces TLS channel credentials on or off.
  When unset, TLS is inferred from the port of the resolved host: `:443` → TLS on,
  any other port → TLS off. 443 is virtually always a TLS ingress and raw gRPC
  ports are virtually always plaintext, so the port is a reliable signal; set this
  variable only for setups where it isn't (e.g. TLS on a non-443 port).
- `OBP_GRPC_AUTH_METADATA_KEY` — metadata key carrying the user's access token on
  gRPC calls. Default: `authorization`.
- `OBP_GRPC_AUTH_METADATA_VALUE_TEMPLATE` — metadata value template, `{token}`
  placeholder. Default: `Bearer {token}`.

The `/status` page of each app shows the resolved `OBP_GRPC_HOST` and
`OBP_GRPC_TLS` values, annotated with `(default …, env var unset)` when derived,
and its gRPC health check dials exactly the way the streaming clients do.

## Development

```bash
# Run Portal
npm run dev --workspace=apps/portal

# Run API Manager
npm run dev --workspace=apps/api-manager

# Run both at once (in separate terminals)
npm run dev --workspace=apps/portal &
npm run dev --workspace=apps/api-manager &

# Build
npm run build --workspace=apps/portal
npm run build --workspace=apps/api-manager

# Build shared package (required before first app build)
npm run build --workspace=packages/shared

# Type check
npm run check --workspace=apps/portal
npm run check --workspace=apps/api-manager

# Run tests
npm test --workspace=apps/portal
npm test --workspace=apps/api-manager
```

## How it works

The `@obp/shared` package is symlinked into each app's `node_modules` via npm workspaces. Changes to `packages/shared/` are picked up immediately by Vite's HMR in dev mode — no publishing or version bumping needed.

Apps import from the shared package using subpath exports:

```ts
import { OpeyChat } from '@obp/shared/components';
import { createOpeyAuthHandler } from '@obp/shared/server/opey';
import { deduplicateRoles } from '@obp/shared/opey';
```
