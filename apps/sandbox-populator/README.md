# OBP Sandbox Populator

Fills an [Open Bank Project](https://www.openbankproject.com/) sandbox with realistic test data: banks, accounts, customers, counterparties, FX rates, transactions and users. You log in with your own OBP account, and everything is created through OBP-API with your token.

It used to live in its own repository, OBP-Sandbox-Populator. It is now one of the OBP-Frontend apps, and uses the shared package for its log cache and Telemetry.

## What it does

- **Populate:** at `/populate`, choose how many banks and accounts to create, the country (which sets the business names, customer templates and currency), and which kinds of record to add. Then select **Populate**. The page shows what it created and links to API Explorer to check it.
- **CSV import:** at `/populate/csv`, upload CSV files of banks, accounts, customers (individual and corporate) and transactions. [ONBOARDING.md](ONBOARDING.md#csv-format-reference) gives the columns of each file.
- **Monitoring:** `/monitoring/log-cache/{level}` and `/monitoring/telemetry` serve the app's log cache and Telemetry in OBP-API's shape, for Senti. They need the same Roles as OBP-API's own endpoints.
- **Status:** `/status`, open to anyone like every OBP app's, shows whether OBP-API, Redis and the OAuth2 providers answer, lists the monitoring endpoints with the Roles each needs, and gives the build.

## Running it locally

You need Node 22 or newer, a running OBP-API and Redis. From the root of OBP-Frontend:

```bash
npm install
cp apps/sandbox-populator/.env.example apps/sandbox-populator/.env   # then fill it in
./start_dev_sandbox_populator.sh                                      # http://localhost:5178
```

Other commands, run from `apps/sandbox-populator`:

```bash
npm run check      # type check
npm run build      # production build
npm run lint       # formatting check
npm run format     # format with Prettier
```

## Settings

Every setting is described in `.env.example`.

| Group | Settings |
|---|---|
| App | `ORIGIN`, `PUBLIC_OBP_BASE_URL`, `SESSION_SECRET` |
| Login | `OBP_OAUTH_CLIENT_ID`, `OBP_OAUTH_CLIENT_SECRET`, `APP_CALLBACK_URL` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| Defaults for the form | `DEFAULT_NUM_BANKS`, `DEFAULT_NUM_ACCOUNTS_PER_BANK`, `DEFAULT_COUNTRY`, `DEFAULT_CURRENCY` |

`SESSION_SECRET` signs the session cookie. Outside development the app refuses to start without one of at least 16 characters. Generate it with `openssl rand -hex 32`.

## Docker

`Dockerfile_sandbox_populator`, at the root of OBP-Frontend, builds the image. Build it locally with `./build_sandbox_populator_image.sh`. The image listens on port 3000; pass the settings when the container starts. On every push to `main`, OBP-Frontend's workflow builds, pushes and signs `obp-sandbox-populator` on Docker Hub, the same image name as before the move.

## How it is built

SvelteKit 5, Tailwind CSS 4 and Skeleton, with sessions in Redis. Every call to OBP-API goes through the typed client in `src/lib/obp/client.ts`. [ONBOARDING.md](ONBOARDING.md) explains the code and common changes.
