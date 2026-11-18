# OBP-Conformator-Runner

Runs the tests of OBP-Conformator against participants' non-production systems. It is a Platform App with no pages: it finds queued runs in OBP-API, runs each test of the run's suite in order, records each result, and marks the run finished. The web app, in `apps/conformator`, is where people start runs and read results.

## How it works

Every `RUNNER_POLL_SECONDS`:

1. It reads the participant register in the central space, to find each participant's own space.
2. It declares its Scopes to OBP-API as a Platform App: one in the central space, and four in each participant's space.
3. In each participant's space it reads the runs. For each run whose status is `queued`, while fewer than `RUNNER_CONCURRENCY` are running, it:
   - marks the run `running`;
   - reads the suite, its tests and the system;
   - runs each test in suite order, recording each result as soon as it is known;
   - marks the run `finished`.

How it decides each outcome:

- **pass**: every step did what the test expects.
- **fail**: the system answered, but not as expected. The result says what was expected and what came back.
- **blocked, participant side**: the system could not be reached, or would not give the runner a token.
- **blocked, harness side**: the runner lacks something it needs, or the test uses a check this runner cannot do yet. This is never reported as the participant's failure.
- **not executed**: an evidence or control test, which waits for evidence and a reviewer.

A problem with the run as a whole ends it as `harness_error`, with the reason. Examples: its suite cannot be read, the runner's credentials for the system are broken, or a result cannot be recorded.

Every request carries a new `x-fapi-interaction-id`, and each result keeps the requests and responses, with tokens and secrets hidden, as evidence.

Schema checks: when a suite names its OpenAPI 3.0 or 3.1 document (JSON or YAML), the runner reads it once per run, and a step's `{"schema": "#/components/schemas/Name"}` expectation checks the response body against that schema (JSON Schema 2020-12). If the document cannot be read, only the tests that use schema checks are blocked, on the harness side, with the reason.

OpenID conformance suite: a `check` step `openid:plan` runs a plan of the OpenID Foundation's suite against the participant's authorisation server, with the configuration the participant gave the runner (`openid-config.json`). Set `OPENID_SUITE_URL` to use it; see [dev/openid-suite/README.md](dev/openid-suite/README.md), which also runs one locally.

Not available yet:

- tests of API consumers;
- getting a test customer's consent on a bank's own screens.

Those tests are blocked on the harness side, and say so.

## Secrets

Participants' secrets never go into OBP-API. Each system has a folder under `RUNNER_CREDENTIALS_DIR`, named by its system id (shown on the system's page in the web app). The folder can hold:

| File | Holds |
|---|---|
| `client.crt`, `client.key` | The runner's certificate and key for mTLS with that system. |
| `ca.crt` | The CA that signs the system's server certificate, if it is not a public one. |
| `secrets.json` | `client_secret` for the client the system issued to the runner, and `client_id` when it should not be in the system record (as for the OBP sandbox as the reference). Also `token_endpoint` (when the system has no discovery URL), `scope`, and `customer_access_token` (a test customer's token). |
| `openid-config.json` | The participant's configuration for the OpenID conformance suite, for `openid:plan` checks. |

In Kubernetes, mount a Secret as that folder.

## Setup

1. OIDC client: create `obp-conformator-runner` (client credentials). In the TESOBE dev setup, `commands/_helpers/sync_obp_consumers.sh` does this and writes `.env`.
2. Copy `.env.example` to `.env` and fill it in.
3. Start the runner. It writes its consumer_id to its log. Set that as `CONFORMATOR_RUNNER_CONSUMER_ID` in the web app.
4. In the API Manager, mark the runner's Consumer as a Platform App and grant its central Scope. Setting up a participant's space in the web app grants it the Scopes it needs there.

## A fake bank to try it against

`dev/fake-bank.mjs` is a small HTTPS server that asks for a client certificate, gives tokens by the client credentials grant and answers a few account information calls in OMR. The web app's example suite is written for it. `dev/make-dev-certs.sh <system id>` makes a dev CA, the bank's certificate and the runner's credentials for that system. `FAKE_BANK_BREAK=consent-status` makes the bank get a consent's status wrong, and `FAKE_BANK_BREAK=balance-decimals` gives balances with two decimals, which the example suite's schema check catches.

## Development

From the repository root:

```bash
npm install
cp apps/conformator-runner/.env.example apps/conformator-runner/.env
npm run dev --workspace=apps/conformator-runner     # builds with esbuild, then runs
npm run test --workspace=apps/conformator-runner
npm run check --workspace=apps/conformator-runner
```

## Docker

```bash
./build_conformator_runner_image.sh
```

## Licence

Copyright (C) 2026 TESOBE GmbH.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License, in [LICENSE](../../LICENSE) at the root of this repository, for more details.

Commercial licences are available from TESOBE.
