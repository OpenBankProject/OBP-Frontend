# Training Page (`/training`)

A logged-in-only Portal page presenting the OBP training curriculum (24 sections, ~190 topics)
with per-user progress tracking: each topic row has **Interested** and **Covered** checkboxes and
a **Notes** field.

## Where the content comes from

`src/lib/data/trainingTopics.ts` is **generated** from `for_dylan_training.md` at the repo root —
regenerate it rather than hand-editing topic text. Section and topic ids are stable slugs;
`training_progress` records reference them, so avoid renaming ids once users have data.

## How progress is stored — personal dynamic entity

Progress uses a **personal dynamic entity** called `training_progress` — deliberately dog-fooding
one of the features the curriculum teaches. Personal entities give every authenticated user their
own private records with no entitlements required (`personalRequiresRole` defaults off).
(The name is snake_case because the API Manager's create form only accepts lowercase letters,
numbers and underscores in entity names.)

Data endpoints (via the Portal proxy, which adds the OAuth token):

- `GET  /proxy/obp/dynamic-entity/my/training_progress` → `{ "training_progress_list": [...] }`
- `POST /proxy/obp/dynamic-entity/my/training_progress`
- `PUT  /proxy/obp/dynamic-entity/my/training_progress/{training_progress_id}`

One record per (section_id, topic_id):

```json
{
  "section_id": "api-portal",
  "topic_id": "managing-consents",
  "interested": true,
  "covered": false,
  "notes": "Ask about consent expiry."
}
```

## One-time setup per OBP instance

An admin with `CanCreateSystemLevelDynamicEntity` creates the system-level entity definition.
The easiest way is the prefilled API Manager form:
`<API_MANAGER_URL>/dynamic-entities/system/create?template=training-progress`
(the Portal's missing-entity callout links there; the template lives in
`apps/api-manager/src/lib/data/dynamicEntityTemplates.ts`). Equivalent raw API call
(`POST /obp/v4.0.0/management/system-dynamic-entities`):

```json
{
  "hasPersonalEntity": true,
  "training_progress": {
    "description": "Per-user progress through the OBP training curriculum. Personal entity: each user records which topics they are interested in and have covered, plus notes.",
    "required": ["section_id", "topic_id"],
    "properties": {
      "section_id": { "type": "string", "minLength": 1, "maxLength": 100, "example": "api-portal", "description": "Curriculum section id (slug)" },
      "topic_id": { "type": "string", "minLength": 1, "maxLength": 200, "example": "managing-consents", "description": "Topic id within the section (slug)" },
      "interested": { "type": "boolean", "example": true, "description": "The user wants training on this topic" },
      "covered": { "type": "boolean", "example": false, "description": "The topic has been covered in training" },
      "notes": { "type": "string", "minLength": 0, "maxLength": 2000, "example": "Covered in session 2.", "description": "Free-text notes" }
    }
  }
}
```

Until the entity exists, the page still renders the full curriculum read-only and shows a setup
callout with this JSON (checkboxes and notes disabled).
