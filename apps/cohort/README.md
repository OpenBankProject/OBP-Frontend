# OBP-Cohort

Startup programme management on the Open Bank Project: application intake, evaluation, onboarding, programme delivery, milestones and graduation. A Platform App in the OBP-Frontend monorepo, next to the Portal and the API Manager.

Read [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md) before changing anything.

## Development

From the repository root:

```bash
npm install
cp apps/cohort/.env.example apps/cohort/.env
./start_dev_cohort.sh          # http://localhost:5183
npm run test --workspace=apps/cohort
npm run check --workspace=apps/cohort
```

## Docker

```bash
./build_cohort_image.sh
```

## Licence

AGPL-3.0-or-later, as the rest of OBP-Frontend.
