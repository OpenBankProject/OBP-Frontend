# OBP-Conformator

Conformance testing of open banking participants on the Open Bank Project. Banks, payment service providers and third-party providers have their non-production systems tested against the agreed APIs, security profile and consent rules. The regulator reviews the results and issues conformance reports. It is a Platform App in the OBP-Frontend monorepo, next to the Portal, the API Manager and Cohort.

The name is the Latin *conformator*, "one who shapes" or "one who makes alike", from the verb *conformare*: the regulator sets the shape, and Conformator checks each participant's API against it.

Read [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md) before changing anything.

## What works so far

- Login through OBP-API's OIDC providers, and the setup page (`/setup`, a login but no Role needed): the central space, the Consumer's Scopes and the dynamic entities.
- The test catalogue: requirements, versioned suites and their tests, with the test definition format checked as you save. Drafts are approved, then frozen; a change is a new version. The catalogue is public at `/catalogue`.
- The participant register: registering, the lifecycle (admitted to exited), and setting up each participant's own space with its dynamic entities and the runner's Scopes there. Each participant's people are an Organisation in OBP-API, created when the participant is registered, with its first admin named; its members get access to its space, and staff bring that access in line with the members.
- For participants (`/spaces`): their systems, starting a run against an approved suite, and each run's results, with the summary, what was expected and what happened, and the requests and responses. The run page updates itself until the run ends.
- The runner, in `apps/conformator-runner`, which carries out the runs.
- Review: a participant submits a finished run, adds evidence (with files) for evidence and control tests, asks for waivers and appeals results or decisions. The regulator's reviewers (`/reviews`) assess tests and decide waivers and appeals; an approver, who cannot also assess, makes the final decision.
- Signed reports: approving issues a report signed with Ed25519, superseding the earlier one for the same system and suite. Anyone can check a report at `/reports/<reference>`, download it as JSON with its signature, and fetch the public key at `/reports/signing-key`. Staff can withdraw a report.
- Example data (`/staff/example-data`): an example suite written for the runner's fake bank, with its OpenAPI document served at `/catalogue/example-openapi.json`.
- Where a suite's endpoints come from: a standard OBP implements (an OBP API version such as `UKv3.1`), or an OpenAPI file, read from an address or loaded into OBP as dynamic endpoints, with mock answers from its examples if wanted. Its tests check responses against the document's schemas, and the add-test form offers its endpoints: choosing one writes the step.
- Opey on the suite page, where it is set up: it reads the suite, its endpoints and requirements, drafts tests and fills in the "Add a test" form, which the User checks and submits.
- Reference runs: a suite page runs the suite against the OBP sandbox (or the mock of its file) before participants use it.
- The regulator's dashboard (`/staff/dashboard`): participants by stage and kind, reports by standing and by API family and kind of participant, each participant's position, and the tests failed most; with CSV and JSON exports.
- Audit chains (`/staff/audit`): OBP-API keeps a hash chain of every change to the records of participants' lifecycle decisions, reports and report events in the central space, and of submissions, waiver requests, appeals, review assignments, assessments, waiver and appeal decisions and approvals in each participant's space. The app starts the central chains itself; each participant's space gets its chains when it is set up. Staff check every chain from one page and seal the root chain, which gives one hash to keep outside OBP-API. A chain cannot be stopped, and its entity can no longer be deleted or renamed.

Not built yet: schedules, pairings and interoperability runs, tests of API consumers, the runner logging in and approving consent on a bank's own pages, an evidence bundle to download, several runners sharing the work, and sealing the audit chains on a timetable. The OpenID conformance suite is wired into the runner (`openid:plan` checks), but has not been run against a live suite here.

## Development

From the repository root:

```bash
npm install
cp apps/conformator/.env.example apps/conformator/.env
./start_dev_conformator.sh   # http://localhost:5185
npm run test --workspace=apps/conformator
npm run check --workspace=apps/conformator
```

Then, as an administrator:

1. Create the OIDC client `obp-conformator` and put its id and secret in `.env`.
2. Open `/setup`. Create the central space's bank if it is missing. Mark the app's Consumer as a Platform App in the API Manager, and grant the Scopes listed.
3. Ask for the staff Roles you need on `/staff/access`.
4. Start the runner (see its README) and set its consumer_id as `CONFORMATOR_RUNNER_CONSUMER_ID` here.
5. Make a report signing key (`openssl genpkey -algorithm ed25519 -out report-signing.pem`), keep it out of the repository, and set `REPORT_SIGNING_KEY_FILE` to it.

### Setting up the reference

The reference is the OBP sandbox itself, registered as a participant, so a suite can be run against it before participants use it.

1. On Participants, register "OBP sandbox" with "This is the OBP sandbox itself" ticked, and yourself as the first admin of its Organisation. Admit it and set up its space, which gives you access to it.
2. Add a system in Your organisation: an API provider whose base URL is OBP-API's (`http://localhost:8080` on a laptop), whose discovery URL is OBP-OIDC's (`http://localhost:9000/obp-oidc/.well-known/openid-configuration`), and whose API profile is the OBP API version it serves, such as `UKv3.1`. For a loaded file with mock answers, use OBP-API's `/obp/dynamic-endpoint` as the base URL and the set's id as the API profile.
3. In the runner's credentials folder, give that system a `secrets.json` with the runner's own OIDC client (`client_id`, `client_secret`) and a test user's OBP token as `customer_access_token`. The client id stays there, never in a record people see.

### Trying it end to end

1. On `/staff/example-data`, add the example suite.
2. Register a participant, with yourself as the first admin of its Organisation, then admit it and set up its space on its page. Add someone else (or a second account) as a reviewer and as an approver.
3. In Your organisation, add a system. Then in `apps/conformator-runner`, run `dev/make-dev-certs.sh <system id>` and `node dev/fake-bank.mjs`, and give the system the base URL, discovery URL and client id the script prints.
4. Start a run of the example suite. Submit it, add evidence for the two evidence tests, and review and approve it with the other accounts. The report is then public at `/reports/<reference>`.

## Docker

```bash
./build_conformator_image.sh
```

## Licence

Copyright (C) 2026 TESOBE GmbH.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License, in [LICENSE](../../LICENSE) at the root of this repository, for more details.

Commercial licences are available from TESOBE.
