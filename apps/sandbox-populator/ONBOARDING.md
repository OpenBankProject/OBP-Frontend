# Onboarding Guide

This guide is for developers working on or extending the OBP Sandbox Populator. It covers the architecture, key code locations, and how to add new data sets or extend functionality.

## Prerequisites

- Familiarity with [SvelteKit](https://kit.svelte.dev/) (routes, load functions, form actions)
- Basic knowledge of the [Open Bank Project API](https://www.openbankproject.com/) (banks, accounts, customers, transactions)
- Node 22+ and a running Redis instance for local development

## Project Layout

```
apps/sandbox-populator/          (in OBP-Frontend)
├── src/
│   ├── hooks.server.ts          session middleware, OAuth guard, monitoring
│   ├── routes/
│   │   ├── +page.svelte         landing page (public)
│   │   ├── login/               OAuth initiation and callback
│   │   ├── logout/              session destruction
│   │   ├── monitoring/          log cache and Telemetry for OBP-Sentinel
│   │   └── (protected)/
│   │       ├── populate/        interactive populator
│   │       └── csv/             CSV bulk import
│   └── lib/
│       ├── obp/                 OBP API client + types
│       ├── data/                country/business data
│       ├── csv/                 CSV parser
│       ├── oauth/               OAuth2 provider layer
│       ├── redis/               Redis client wrapper
│       └── utils/               logger
├── start-dev.sh                 dev server, with a copy of the log in /tmp
└── .env.example
```

The Docker image is built from `Dockerfile_sandbox_populator` at the root of OBP-Frontend. The log cache, Telemetry and the Role check that guards them come from the shared package (`@obp/shared/server/monitoring`), as in the other apps.

## Authentication Flow

1. User visits `/login` and clicks the OBP login button.
2. `src/routes/login/[provider]/+server.ts` initiates an OAuth2 authorization code flow via the [arctic](https://arcticjs.dev/) library.
3. OBP redirects to `APP_CALLBACK_URL` (`/login/obp/callback`).
4. The callback handler exchanges the code for an access token and stores it in a Redis-backed session (managed by `svelte-kit-sessions`).
5. All subsequent requests to protected routes carry the session cookie. `hooks.server.ts` reads the session and redirects unauthenticated requests to `/login`.

The access token is attached to every OBP API request as a Bearer token by `src/lib/obp/client.ts`.

## OBP API Client (`src/lib/obp/client.ts`)

`OBPClient` is the single entry point for all OBP API calls. It is instantiated with a base URL and access token:

```typescript
const client = new OBPClient(baseUrl, accessToken);
await client.getBanks();
await client.createBank(payload);
```

All entity types are defined in `src/lib/obp/types.ts`. Errors are normalised through `src/lib/obp/errors.ts`. If you need to call a new OBP endpoint, add a method to `OBPClient` and the corresponding interface to `types.ts`.

The client handles rate-limit responses (HTTP 429) with automatic retries and backs off exponentially.

## Population Logic (`src/routes/(protected)/populate/+page.server.ts`)

This is the largest file (~1 000 lines). The SvelteKit form action:

1. Reads form data (bank count, account count, country, options).
2. Calls `OBPClient` methods in sequence: create banks → grant entitlements → create accounts → create counterparties → create customers → link customers to accounts → create FX rates → generate transactions.
3. Each step appends result messages to an array that is returned to the page for display.
4. User preferences (last bank prefix, country, currency) are persisted to OBP Personal Data Fields so they survive sessions.

### Rate Limiting

All mutating calls go through a small wrapper that retries on 429 responses. If you add new bulk operations, use the same pattern.

## CSV Import (`src/routes/(protected)/csv/+page.server.ts` + `src/lib/csv/parser.ts`)

The CSV page accepts file uploads. Each CSV type has a dedicated parser function in `parser.ts` that returns typed objects. The server action then iterates those objects and calls `OBPClient` — same client as the interactive populator.

### CSV Format Reference

**banks.csv**

```
full_name,bank_code
Commercial Bank of Botswana,CBW
First National Bank,FNB
```

**accounts.csv**

```
bank_code,number,currency,legal_name
CBW,ACC001,BWP,John Doe
FNB,ACC002,USD,Acme Corp
```

**customers.csv**

```
legal_name,customer_type,mobile_phone_number,email,date_of_birth,title,employment_status,highest_education_attained,relationship_status,category,bank_code
John Doe,individual,+267721234567,john@example.bw,1985-06-20,Mr.,employed,Bachelor,single,,CBW
Acme Corp,corporate,+267391234567,info@acme.bw,,,,,,,CBW
```

`customer_type` is `individual` or `corporate`. For corporate customers, the personal fields (`date_of_birth`, `title`, etc.) are ignored.

**transactions.csv**

```
date,from_account_number,from_bank_code,to_account_number,to_bank_code,amount,currency,description
2024-03-01,ACC001,CBW,ACC002,FNB,250.00,BWP,Invoice payment
```

## Country and Business Data (`src/lib/data/countries.ts`)

Each country entry provides:

- A list of small businesses (name, industry, description) used as counterparties.
- A list of individual customer templates (name, phone, email, DOB).
- A list of corporate customer templates.
- Default currency.

To add a new country, follow the existing `botswana` and `singapore` entries in `countries.ts`. Export the new entry from the same file and add it to the `countries` map so it appears in the UI dropdown.

## Session Storage

Sessions are stored in Redis with the key prefix `sandbox-populator-session:`. The session name cookie is `sandbox-populator-connect.sid`. Session configuration is in `hooks.server.ts`.

The session cookie is signed with `SESSION_SECRET`. Outside development the app refuses to start without one of at least 16 characters; generate it with `openssl rand -hex 32`.

## Adding a New OAuth Provider

1. Install the corresponding arctic provider package (or implement a custom one).
2. Add a new case in `src/lib/oauth/providerFactory.ts`.
3. Add a login button to `src/routes/login/+page.svelte`.
4. The callback route `/login/[provider]/callback` is already generic; no new route needed.

## Environment Configuration Reference

See `.env.example` for all variables with inline comments. The key ones during development:

```env
# Register an OAuth application in OBP to get these
OBP_OAUTH_CLIENT_ID=your_id
OBP_OAUTH_CLIENT_SECRET=your_secret

# Must match what you registered as the redirect URI in OBP
# Use port 5178 for local dev, 3000 for Docker
APP_CALLBACK_URL=http://localhost:5178/login/obp/callback
ORIGIN=http://localhost:5178

# Signs the session cookie; required outside development
SESSION_SECRET=output_of_openssl_rand_hex_32

# Redis — must be running in both local dev and Docker modes
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Docker Image

`Dockerfile_sandbox_populator`, at the root of OBP-Frontend, builds the app with the shared package and produces a Node 22 Alpine image. Build it locally with `./build_sandbox_populator_image.sh`. The image listens on port 3000. Pass every environment variable when the container starts, including `SESSION_SECRET`.

## CI/CD

OBP-Frontend's `.github/workflows/build_container_image.yml` builds, pushes and signs the `obp-sandbox-populator` image on Docker Hub on every push to `main`, together with the other apps' images.

## Common Tasks

### Add a new field to the populate form

1. Add the input to `src/routes/(protected)/populate/+page.svelte`.
2. Read the value in the form action in `+page.server.ts`.
3. Pass it to the relevant `OBPClient` method or use it to control flow.

### Add a new OBP API call

1. Add the TypeScript interface to `src/lib/obp/types.ts`.
2. Add the method to `OBPClient` in `src/lib/obp/client.ts`.
3. Call it from the appropriate route action.

### Add a new CSV entity type

1. Add a parser function to `src/lib/csv/parser.ts` that returns a typed array.
2. Add the file input and upload handling to `src/routes/(protected)/csv/+page.svelte`.
3. Add the processing loop to the form action in `src/routes/(protected)/csv/+page.server.ts`.
