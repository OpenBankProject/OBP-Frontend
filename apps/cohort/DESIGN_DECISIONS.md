# Design Decisions

OBP-Cohort manages startup programmes on the Open Bank Project: calls for applications, applications, evaluation, onboarding, programme delivery, milestones and graduation. The monorepo's [DESIGN_DECISIONS.md](../../DESIGN_DECISIONS.md) applies too.

## Architecture

- **OBP-API is the only backend.** Cohort has no database of its own. Its records are Dynamic Entities; users, login, roles, organisations, files, chat and email are OBP features.
- **One space per installation**, set by `OBP_ENTITY_SPACE_ID` (a bank id, default `cohort`, or `SYS`). Everything Cohort stores lives in it.
- **Cohort is a Platform App.** It declares the Scopes it needs (`cohortRequiredConsumerScopes` in `packages/shared`) and, with its application token, creates its entities at startup and adds properties they lack. `/setup` shows the space, the Scopes and the entities, and links to the API Manager pages that fix what is missing.
- **Entity definitions live in code** (`src/lib/server/entities`) and only grow: properties are added, never renamed, retyped or removed.
- **A third app in OBP-Frontend** (`apps/cohort`), built and deployed as its own image. Programme-specific code stays here; anything another app could use goes into `packages/shared`, never copied.

## Records

- **Programmes and calls are public records**, so the website lists open calls without login. Staff create them with the per-entity Roles at the space.
- **Applications are the applicant's personal records** (`/my/`, no Role needed): a draft until submitted, so applicants save and resume. Staff read every application through the community URL (`CanGetDynamicEntityRecord_cohort_application` at the space), read only.
- **Staff decisions are separate, append-only records** (screening, evaluation, stage changes), with who, when and why. They never edit the applicant's record.
- **Eligibility is checked on submission**: a local resident or a locally incorporated business is eligible; anyone else goes to a screener.
- **Stages are data, not code.** A programme has ordered stages; a gate is a set of conditions on a startup's records. There is no workflow engine.
- **Reviewers see only their assignments.** Assignments are records, and the reviewer pages show only the applications assigned to the reviewer.
- **One form builder and one renderer** for application forms, scoring rubrics and surveys. Each published form is its own Dynamic Entity, one property per question, so answers are typed, filterable and readable by Opey. A published form only grows; a bigger change is a new version.
- **Participants are OBP Organisations** in Cohort's space (`organisation_type`: startup, bank, university, regulator, partner). Users join them as Organisation members; membership grants no Roles, Cohort turns it into access.

## Access control

- **RBAC only.** Per-entity and per-field Roles at the space, granted through Role Groups. Jurisdiction is a field used in queries; subscription content is a Role Group granted on approval.

## Reuse before build

| Need | OBP feature |
|---|---|
| Registration, invitations, SSO | OBP users, user invitations, OBP-OIDC / Keycloak |
| Documents | Files attached to Dynamic Entity records |
| Discussion spaces, working groups, Q&A | Chat rooms |
| Email | Message outbox |
| Reacting to changes | Dynamic Entity webhooks |
| Public website pages | App Studio pages, served by Cohort |
| Branding and legal text | webui_props |
| Assistant, natural-language reports | Opey |

## Frontend

- **Cohort users do everything in Cohort.** Startups, mentors, reviewers and programme staff never need the Portal or the API Manager; the API Manager is the technical admin console.
- **SvelteKit, Svelte 5, TypeScript.** OBP calls are made server-side.
- **English and Arabic, including RTL.** All UI text goes through `t()` (`src/lib/i18n`). The locale comes from the `cohort_locale` cookie, then Accept-Language, and sets `lang` and `dir` on `<html>`. Layouts use logical CSS properties.
- **Accessible** (WCAG 2.1 AA): semantic HTML, keyboard navigation, contrast.

## Deployment

- **Runs on-premises**, with no external SaaS: OBP-API, OBP-OIDC, Redis, Postgres, Opey and OBP-Cohort.
- **Postgres**, because indexed Dynamic Entity queries need it.

## Licence

AGPL-3.0, as OBP-Frontend.
