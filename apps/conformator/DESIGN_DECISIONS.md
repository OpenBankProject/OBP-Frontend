# Design Decisions (draft)

OBP-Conformator tests whether participants in an open banking ecosystem (banks, payment service providers, fintechs, third-party providers) implement the agreed APIs, security profile and consent rules. It runs tests against their non-production systems, collects evidence, supports the regulator's review and issues signed conformance reports. The monorepo's [DESIGN_DECISIONS.md](../../DESIGN_DECISIONS.md) applies too.

This is a draft. Most of it is built; the README of each app says what works and what does not yet.

## Architecture

- **Two apps in OBP-Frontend, one product.** `apps/conformator` (SvelteKit, Svelte 5, TypeScript) is where people work: the test catalogue, participants, runs, evidence, review, waivers, appeals, reports and dashboards. `apps/conformator-runner` (Node, TypeScript) runs the tests. Each is built and deployed as its own image. Code both need, such as the test definition format, goes into `packages/shared`.
- **The runner is a separate service.** It calls participants' systems, holds client certificates and runs long jobs. None of that belongs in the web app's process.
- **The OpenID conformance suite runs beside the runner, unchanged**, in its own container. The runner drives it through its REST API for the FAPI, OpenID Connect and mTLS checks. In these documents it is always "the OpenID conformance suite", so it is not confused with this product.
- **OBP-API is the only backend.** Neither app has a database of its own. Records are dynamic entities; users, login, Roles, Customers, files and email are OBP features.
- **OBP-API's sandbox is the reference bank.** It already provides account information, payment initiation, consents and synthetic data, so testing a third-party provider needs no bank simulator of our own.
- **Both apps are Platform Apps.** Each declares the Scopes it needs and shows them on a setup page, as Cohort does. The web app creates its dynamic entities at startup and adds properties they lack.
- **Dynamic entity definitions live in code** and only grow: properties are added, never renamed, retyped or removed.
- **One name throughout.** The apps, packages, Consumers, cookies, settings and dynamic entities (`conformator_*`) all use `conformator`. The records still talk about conformance (a conformance report, a conformance run), because that is what they are.
- **This is not part of Cohort**, although both manage participants through stages. The two share code through `packages/shared` only.

## Spaces

- **One central space and one space per participant.** Participants' data, credentials, logs and results must be kept apart. Roles are checked per bank id, so a space per participant makes OBP-API enforce that, rather than our app filtering records.
- **The central space** (`OBP_ENTITY_SPACE_ID`, default `conformator`) holds the test catalogue, the participant register and the issued reports.
- **Each participant's space** (`conformator-<participant>`) holds everything about that participant's testing. It is created when the participant is admitted. Their users get Roles there through a Role Group; the regulator's reviewers and approvers get theirs through other Role Groups.
- **Participants are CORPORATE Customers of the central space**, and their users are linked to them by User Customer Links, as in Cohort.
- **An administrator sets up each participant's space with their own Roles**, from the participant's page, so the app's Consumer needs Scopes only in the central space. The steps: create the bank (system Role `CanCreateBank`), which gives the creator `CanCreateEntitlementAtOneBank` there; use it to grant themselves the dynamic entity definition Roles there; create the participant entities, which gives them the entities' record Roles. Every step checks first, so it is safe to repeat.
- **Setting up a space also grants the runner its Scopes there**, to the Consumer named by `CONFORMATOR_RUNNER_CONSUMER_ID`, using `CanCreateScopeAtOneBank`, which the administrator grants themselves there first. The runner's Scope list is in `packages/shared`, so what is granted and what the runner declares are the same list.
- **Staff add a participant's people by username**, granting them the participant Roles at the space (`participantRoles.ts`): they write their own records and read the regulator's, never write them. Results are written by the runner only. Role Groups may replace the list of single grants later.
- **A participant's space id is fixed at registration**, proposed as `<central space>-<slug of the name>`, at most 36 characters.

## Records

Decisions are separate records that are only ever added, never edited; the latest one is the current state. Each step in the separation of duties is its own dynamic entity, so its own Role.

### Central space: the catalogue

| Dynamic entity | Holds |
|---|---|
| `conformator_requirement` | One clause of the regulatory framework: reference, title, wording, source document and its version. Tests point to these, which gives traceability from requirement to test. |
| `conformator_suite` | A versioned set of tests for one participant role (API provider, authorisation server, API consumer) and API family (account information, payment initiation, funds confirmation, consent). Status: draft, approved or retired. An approved version is frozen; a change is a new version. |
| `conformator_test` | Test ID (for example `PIS-IDEM-004`), suite, the requirements it covers (`json`), kind (automated, evidence review, organisational control), whether it is mandatory, severity, expected result, evidence required, suggested fix, and `definition` (`json`: the steps and checks). |

### Central space: participants and reports

| Dynamic entity | Holds |
|---|---|
| `conformator_participant` | The Customer, category (bank, payment service provider, fintech, finance or leasing company, third-party provider), the participant's space and their sandbox `consumer_id`. |
| `conformator_participant_decision` | A lifecycle step, recorded by the regulator: admitted, onboarding, testing, remediation, graduated, suspended or exited, with who, when and why. |
| `conformator_report` | An issued report: reference number, participant, system, suite version, submission, issue and expiry dates, the hash of the canonical report, the signature and key id, and the PDF as an attached file. Public by reference, so anyone can verify a report. |
| `conformator_report_event` | Superseded or withdrawn, with who and why. Expiry follows from the date and is not recorded. |

### Participant's space: what the participant records

| Dynamic entity | Holds |
|---|---|
| `conformator_system` | A system to be tested: its role, base URL, discovery URL, API profile and version, and the client id their sandbox issued to the runner. No secrets. |
| `conformator_pairing` | An agreement between two participants to be tested together (a third-party provider against a bank), accepted by both. Needed for interoperability tests. |
| `conformator_run` | One execution: system, suite version, the other system (interoperability runs only), submission (empty for practice runs), trigger (person, CI, schedule or rerun), status (queued, running, finished, harness error), runner version and times. |
| `conformator_result` | One per test per run, never changed: outcome (pass, fail, blocked, not executed, not applicable), expected and actual behaviour, severity, which side caused a block, and correlation ids. The cleaned request and response are attached as JSON files. |
| `conformator_schedule` | Regular runs of a suite against a system, for regression checks. |
| `conformator_submission` | A system put forward for the regulator's review against a suite version, with the runs that count. |
| `conformator_evidence` | Evidence for evidence-review and control tests: a note and attached files. |
| `conformator_waiver_request` | A request to waive one test, with the reason. |
| `conformator_appeal` | A challenge to a result or a decision. The original record is never changed. |

### Participant's space: what the regulator records

Participants can read these, but only the regulator's Roles can create them.

| Dynamic entity | Holds |
|---|---|
| `conformator_review_assignment` | A reviewer assigned to a submission. |
| `conformator_assessment` | A reviewer's verdict on an evidence or control test, or on a disputed automated result. |
| `conformator_waiver_decision` | Approved or refused, with an expiry date. A waiver is shown on every report it affects. |
| `conformator_appeal_decision` | The outcome of an appeal. |
| `conformator_approval` | The final decision on a submission. Only the approver Role creates it, so whoever ran or reviewed the tests cannot also approve them. |

- **Scores and dashboards are counted from the records, never stored.**
- **The catalogue is public**: requirements, suites and tests are public dynamic entities, so participants and anyone else can read what is tested at `/catalogue`. Only staff Roles change them.
- **A suite version is approved only when it has tests and every automated test has a valid definition.** Approving freezes it. "Make a new version" copies the suite and its tests into a new draft, with the minor version raised and `replaces_suite_id` set.
- **A participant's lifecycle only moves forward in allowed steps**: admission first; never back to admitted; exited is final; a suspended participant can only go to remediation or exit.
- **Files are scanned before anyone opens them.** Evidence uploads start `pending` and OBP-Scanner marks them clean or rejected, as for Cohort.

## Running tests

1. **A run is a `conformator_run` record created with status `queued`.** A participant's user creates it in the app. Their CI creates the same record through OBP-API with its own token, and reads its status the same way. So the dynamic entity endpoints are the CI interface. The runner creates runs from schedules.
2. **The runner picks it up.** A dynamic entity webhook tells it; it also looks for queued runs every so often in case a webhook is missed. It sets the run to `running` and loads the frozen suite version, the system and its own credentials for that system.
3. **It runs each automated test in the role the system needs to work with:**
   - **API provider (bank or payment service provider):** the runner is the reference third-party provider. It connects over mTLS with its own certificate, completes the OAuth/FAPI flow, gets the test customer's consent on the bank's own screens with a headless browser, then calls the APIs and checks the responses.
   - **Authorisation server:** the runner hands the checks to the OpenID conformance suite, waits for the results, maps them to our test IDs and attaches its log as evidence.
   - **API consumer (third-party provider):** OBP-API's sandbox is the reference bank. The test tells the participant what to do (for example: create a consent for these accounts with this expiry, read the transactions, revoke it, try again). The runner then checks what OBP-API recorded for that `consumer_id` in the time allowed: consents, calls, certificate binding, idempotency keys, and no calls after revocation. Sandbox scenarios (errors, delays, outages) test how the provider copes.
   - **Interoperability:** the same journeys between the two systems of a pairing, with the runner watching both sides.
4. **Each result is recorded as soon as its test finishes**, with the cleaned request and response attached.
5. **A harness failure is never a participant failure.** If the runner cannot run a test (the OpenID conformance suite is down, its own certificate has expired), the result is blocked on the harness side and the run ends as `harness error`. A test whose precondition failed is blocked on the participant side and names the test that failed. Neither is recorded as a fail.
6. **Evidence-review and control tests start as not executed** and wait for evidence and a reviewer's assessment.
7. **A failed mandatory test is always shown above any percentage score.**
8. **Review, approval and report.** A reviewer assesses the submission and a different person approves it. The app then builds the canonical report, hashes it, signs it and records the `conformator_report`.

## The runner

- **A Node service with no pages**, in `apps/conformator-runner`, bundled by esbuild into one file with no runtime dependencies. It uses Node's own HTTP client, so it can present a client certificate for mTLS, and accepts TLS 1.2 or later only.
- **It finds work by asking OBP-API**, every `RUNNER_POLL_SECONDS`, rather than by webhook, for now. One runner instance at a time: it does not yet claim a run in a way that would stop a second instance taking it too.
- **Participants' secrets stay out of OBP-API**, in a folder per system id under `RUNNER_CREDENTIALS_DIR` (a mounted Kubernetes Secret in production).
- **Only approved suites can be run** by participants, and only against a system of the role the suite tests. What a system is never changes once added.
- **Evidence is kept in the result record for now**, in `exchanges`, cleaned of tokens and secrets and left out from the end (saying so) to fit. Attaching it as a file comes later.
- **Schema checks use the suite's own OpenAPI 3.1 document**, named by the suite and read once per run. A suite with tests that check schemas cannot be approved without one.
- **FAPI and OpenID Connect checks are the OpenID Foundation's suite**, driven over its REST API by an `openid:plan` check step; we do not write our own. The participant's suite configuration is a secret beside their others. A module the suite marks for review leaves the test to the regulator's reviewer; a failed module fails the test.
- **What it cannot do yet, it says**: API consumer tests and getting consent on a bank's own screens each block the test on the harness side, with the reason.

## Where a suite's endpoints come from

- **Two paths.** A suite tests either **a standard OBP implements** (an OBP API version such as `UKv3.1` or `BGv1.3`, whose OpenAPI document OBP-API serves publicly from its resource docs), or **an OpenAPI file**: a national standard or a bank's own profile. A file is either read from an address, or **loaded into OBP as a dynamic endpoint set** in the central space; then OBP holds it, documents it in the API Explorer, and, loaded with mock answers (`servers: obp_mock`), answers each endpoint with the file's examples.
- **One document either way.** Each path ends in an OpenAPI document, which is all the runner and the test editor need: the runner reads it for schema checks, and the editor lists its endpoints. The app serves a loaded file's document at `/catalogue/<suite>/openapi.json`, read from OBP with its own Scope `CanGetBankLevelDynamicEndpoint`.
- **JSON or YAML, one file per suite.** A file can be OpenAPI 3.0 or 3.1, in JSON or YAML (the shared `parseOpenApiText` tries JSON first). Standards bodies publish both: UK Open Banking publishes JSON and YAML, one file per API, on GitHub, with a tag for each release; the Berlin Group publishes YAML only, on GitLab. A suite reads one document, so a standard published as several files has one suite per file, such as one for accounts and one for payments. Its address should be pinned to a release, so the suite does not change when the publisher updates the file. These files mark mandatory fields as required, which the documents OBP generates from its example bodies cannot do.
- **Choosing an endpoint writes a step.** Picking an endpoint in the add-test form adds a request step that calls it as the runner's own client and expects its success status and response schema; the author then sets the credentials, the body and what to keep.
- **Reference runs.** The OBP sandbox is registered as a participant marked `is_reference`, with a system per role it plays (its API profile names the OBP API version or dynamic endpoint set it serves). A suite page runs the suite against it, draft or not, before participants use it: a test that fails against the reference is more likely wrong than the reference. A reference run is an ordinary run, so its results, evidence and summary are the same as anyone's.

## Review

- **The rules are pure functions** (`src/lib/review.ts`), tested apart from OBP-API:
  - An automated test's outcome is its result in the submission's latest run. A reviewer cannot override it, except by assessing it again after an appeal about that result is upheld.
  - An evidence or control test's outcome is the latest assessment; until then it is not executed.
  - A waiver never changes an outcome. An approved, unexpired one lets approval go ahead, and shows beside the outcome everywhere, the report included.
  - A submission can be approved only when every mandatory test passed, is not applicable, or has such a waiver. Refusing is always possible.
- **Separation of duties, twice over.** Reviewers and approvers get different Role sets: reviewers assess and decide waivers and appeals; approvers make the final decision. And the app refuses a final decision from anyone who assessed a test of that submission.
- **A decision is final**, unless an appeal about a refusal is upheld; then reviewers may assess again and an approver decide again. Appeals never change the record they are about.
- **Evidence files** are OBP files in the participant's space, attached to the evidence record. Downloads go through the app with the User's token, as attachments, never shown inline.

## Reports

- **Signed with Ed25519** by a key in `REPORT_SIGNING_KEY_FILE`, held by whoever runs the app for the regulator. The report's content is canonical JSON (sorted keys); its SHA-256 hash is signed. The content is kept in the report record, so a report can be checked from OBP-API's data alone.
- **Approving issues the report at once**, with the approver's own Roles. Without a signing key, approval is refused rather than leaving an approved submission without a report.
- **Every report says what it is not**: it evidences the listed technical tests only, and is not a licence or permission to use live data or payments.
- **Standing is worked out, never stored**: withdrawn or superseded from report events, expired from its date, otherwise valid. A newer report for the same participant, system and suite code supersedes the older one.
- **Anyone can check a report** at `/reports/<reference>`, download it as JSON with its hash, signature and key id, and fetch the public key, so it can be checked without this site. Printing the page gives a PDF.

## Dashboard

- **Counted from the records whenever it is shown, never stored**, with the User's own Roles. Spaces the User cannot read count as "not known", never as empty.
- **Exports in open formats**: CSV (participants, tests failed most) and JSON (everything, with when it was counted). CSV cells that a spreadsheet would read as a formula are made plain text.
- **API traffic is not repeated here**: calls, latency and errors are OBP-API's own metrics, shown by the API Manager.

## Test definitions

- **Tests are data, not code**, so the regulator can write and change them without us. A test's `definition` is a list of steps: a request (method, path, headers, body, which credentials to use), values to take from the response, and waits. Checks cover the status code, the JSON schema from the OpenAPI file, field values and required headers.
- **Code only where steps cannot say it.** A step can name a check written in code, such as `openid:fapi2-security-profile`.
- **A run is tied to one suite version**, so old results keep their meaning when tests change.

## Frontend

- **SvelteKit, Svelte 5, TypeScript**, in the Portal's and the API Manager's design: the shared `NavigationSidebar` (logo, menu, Staff section, the API Manager link, light and dark), and the same bar with the User and Logout above the page. OBP calls are made server-side.
- **Setup is at `/setup`** and needs a login but no Role, so an administrator can use it before anyone holds a staff Role. It covers the API Manager's address, the central space, both Platform Apps and their Scopes, the report signing key, the dynamic entities and the User's own staff Roles. Every missing piece links to the API Manager page that fixes it; a missing Role links to its Grant Role page with the username, Role and bank filled in.
- **Opey beside the suite page**, as on the API Manager's create pages: a resizable side panel, shown only when `OPEY_BASE_URL` is set. Only logged-in Users may chat, and Opey acts through a consent the User gives it, so it reads no more than they may. It can fill in the "Add a test" form (its `set_form_fields` tool, `src/lib/formFill.ts`), writing each field as typing would, but never submits it: the User checks every value and adds the test. With each message the page tells Opey about the suite, its tests and endpoints and the form's fields, and the server adds where the catalogue is and the test definition format (`src/lib/server/opeyGuide.ts`). Conversations are not recorded. Opey's status lights link to the Portal's status and consents pages.
- **English only for now.** Arabic and right-to-left layout, as in Cohort, come later.
- **The shared role widgets** (`MissingRoleAlert`, `PageRoleCheck`, `SpaceRoleAlerts` in `packages/shared`, the same as the API Manager's). Each page shows its form only to a User holding the Role it needs; anyone else sees the missing Role and can request it there. Requests go through this app's `/backend/rbac/entitlement-requests`, which accepts only the Roles the app uses; administrators accept them in the API Manager. OBP-API still checks every Role.

## Licence

AGPL-3.0-or-later, as the rest of OBP-Frontend. Every source file carries the TESOBE copyright and licence notice.

## Open questions

1. Should the report signing key move to the regulator's own PKI or HSM? Today it is a key file held by the app.
2. Is the hash-chained audit log of decisions built in the app for now, or added to OBP-API as a feature other apps can use?
