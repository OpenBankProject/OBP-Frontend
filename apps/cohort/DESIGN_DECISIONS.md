# Design Decisions

OBP-Cohort manages startup programmes on the Open Bank Project: calls for applications, applications, evaluation, onboarding, programme delivery, milestones and graduation. The monorepo's [DESIGN_DECISIONS.md](../../DESIGN_DECISIONS.md) applies too.

## Architecture

- **OBP-API is the only backend.** Cohort has no database of its own. Its records are dynamic entities; users, login, roles, organisations, files, chat and email are OBP features.
- **One space per installation**, set by `OBP_ENTITY_SPACE_ID` (a bank id, default `cohort`, or `SYS`). Everything Cohort stores lives in it.
- **Cohort is a Platform App.** It declares the Scopes it needs (`cohortRequiredConsumerScopes` in `packages/shared`) and, with its application token, creates its dynamic entities at startup and adds properties they lack. `/setup` shows the space, the Scopes and the dynamic entities, and links to the API Manager pages that fix what is missing.
- **Dynamic entity definitions live in code** (`src/lib/server/entities`) and only grow: properties are added, never renamed, retyped or removed.
- **A third app in OBP-Frontend** (`apps/cohort`), built and deployed as its own image. Programme-specific code stays here; anything another app could use goes into `packages/shared`, never copied.

## Records

- **Programmes and calls are public records**, so the website lists open calls without login. Staff create them with the per-dynamic-entity Roles at the space.
- **Applications are the applicant's personal records** (`/my/`, no Role needed): a draft until submitted, so applicants save and resume. Staff read every application through the community URL (`CanGetDynamicEntityRecord_cohort_application` at the space), read only.
- **Staff decisions are separate, append-only records** (screening, evaluation, stage changes), with who, when and why. They never edit the applicant's record. The latest decision is the current outcome.
- **Applicants see the outcome, never the reasoning.** Cohort reads decisions with its own token (applicants hold no Role) and shows the applicant the decision and the message written for them, never the internal reason. "More information needed" reopens the application for editing and resubmission.
- **Eligibility is checked on submission**: a local resident or a locally incorporated business is eligible; anyone else goes to a screener.
- **Stages are data, not code.** A programme has ordered stages; a gate is a set of conditions on a startup's records. There is no workflow engine.
- **Reviewers see only their assignments.** Assignments are records, and the reviewer pages show only the applications assigned to the reviewer.
- **One form builder and one renderer** for application forms, scoring rubrics and surveys. Each published form is its own dynamic entity, one property per question, so answers are typed, filterable and readable by Opey. A published form only grows; a bigger change is a new version.
- **Participants are OBP Organisations** in Cohort's space (`organisation_type`: startup, bank, university, regulator, partner). Users join them as Organisation members; membership grants no Roles, Cohort turns it into access.

## Files

- **Applicants upload their own files, with no staff in the way.** Attachments are part of the application form, and applying needs no staff contact, so the gate is automatic: a logged-in user with a validated email may upload personal files within a per-user quota (count and total size per space), of allowed types (PDF, Office documents, images), never public, each attached to one of their own records, such as a draft application.
- **Quarantined until scanned.** Each file has a `scan_status` (`pending`, `clean`, `rejected`) with when, by whom and why. Personal uploads start `pending`; uploads by holders of `CanCreateFileAtOneBank` start `clean` unless a prop says to scan everything. Until a file is `clean` its metadata is shown but its content is served only to its owner and to the scanner; a `rejected` file is never served.
- **One way to change the status:** `PUT /banks/BANK_ID/files/FILE_ID/scan-status`, guarded by `CanUpdateFileScanStatusAtOneBank`, which also lets its holder read the content of pending files. A scanner app holds it as a Scope and sets the result; staff use it to approve a file when no scanner is configured, to reject a reported file, and to clear a false positive.
- **Scanning is pluggable.** With a prop such as `files.clamav.host` set, OBP-API scans at upload with ClamAV and sets the status itself. Without it, files wait for a scanner app (the installation's own antivirus) or a member of staff.
- **Staff never see a file by surprise.** No inline previews or thumbnails of applicant files: staff see the name, type, size and scan status, and a file opens only on an explicit click, as a download. A "Report" action hides the file and stops the uploader uploading more.
- **Staff read applicant files with `CanGetFileAtOneBank`** at the space; access never follows from reading the record a file is attached to.

## Access control

- **RBAC only.** Per-dynamic-entity and per-field Roles at the space, granted through Role Groups. Jurisdiction is a field used in queries; subscription content is a Role Group granted on approval.

## Reuse before build

| Need | OBP feature |
|---|---|
| Registration, invitations, SSO | OBP users, user invitations, OBP-OIDC / Keycloak |
| Documents | Files attached to dynamic entity records |
| Discussion spaces, working groups, Q&A | Chat rooms |
| Email | Message outbox |
| Reacting to changes | Dynamic entity webhooks |
| Public website pages | App Studio pages, served by Cohort |
| Branding and legal text | webui_props |
| Assistant, natural-language reports | Opey |

## Frontend

- **Cohort users do everything in Cohort.** Startups, mentors, reviewers and programme staff never need the Portal or the API Manager; the API Manager is the technical admin console.
- **Two layouts.** The public pages (`(public)`: open calls, a call, login, setup) are a website with a top bar. The logged-in pages (`(protected)`) have the Portal's sidebar shell, on the start side so it mirrors in Arabic. Cohort has its own sidebar rather than the shared `NavigationSidebar`, whose text is English only.
- **List, view, edit.** Staff lists and detail pages need only read access. Editing is a separate page, guarded by the dynamic entity's update Role at the space; a User without it sees a request for the Role there instead of the form. Create and edit share one set of form fields, and a save replaces the whole record.
- **SvelteKit, Svelte 5, TypeScript.** OBP calls are made server-side.
- **English and Arabic, including RTL.** All UI text goes through `t()` (`src/lib/i18n`). The locale comes from the `cohort_locale` cookie, then Accept-Language, and sets `lang` and `dir` on `<html>`. Layouts use logical CSS properties.
- **Accessible** (WCAG 2.1 AA): semantic HTML, keyboard navigation, contrast.

## Deployment

- **Runs on-premises**, with no external SaaS: OBP-API, OBP-OIDC, Redis, Postgres, Opey and OBP-Cohort.
- **Postgres**, because indexed dynamic entity queries need it.

## Licence

AGPL-3.0, as OBP-Frontend.
