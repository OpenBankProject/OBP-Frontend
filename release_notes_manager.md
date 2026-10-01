# API Manager Release Notes

## 2026-10-01

webui_props are rendered as markdown, unless the prop is in `WEB_UI_PROPS_NOT_MARKDOWN` (`packages/shared/src/lib/config/webUiProps.ts`; currently only `webui_support_platform_url`). This also applies to the matching env vars. Titles and questions shown in headings get inline markdown only (emphasis, code, links). Raw HTML is shown as literal text, and http(s) links open in a new tab. Existing values containing `*`, `_`, or a leading `#` or `1.` may now render differently.

webui_props are read from the OBP database only (`GET /obp/v6.0.0/webui-props?what=database`), through one shared cache that is refreshed every 5 minutes. The `config` rows that `what=active` adds come from OBP-API's sample props template, not from its running configuration, so they are no longer used.

The webui_props create and edit form previews known props the way their page renders them.

User Invitations (`/user-invitations`) is now in the menu under Govern → Identity.

## 2026-09-30

Home page text can now be set with OBP webui_props. Each value is taken from the webui_prop, then the env var, then the built-in default. Values are cached for 5 minutes.

| webui_prop | Env var |
|---|---|
| `webui_welcome_title_manager` | `PUBLIC_WELCOME_TITLE_MANAGER` |
| `webui_help_question_manager` | `PUBLIC_HELP_QUESTION_MANAGER` |
| `webui_welcome_description_manager` | `PUBLIC_WELCOME_DESCRIPTION_MANAGER` |

The description supports links written as `[label](url)`. Only http(s), mailto: and site-relative (`/path`, `#anchor`) URLs become links; all other markup is shown as literal text.

**Breaking:** API Manager no longer reads `PUBLIC_WELCOME_TITLE`, `PUBLIC_HELP_QUESTION` or `PUBLIC_WELCOME_DESCRIPTION`. Rename them to the `_MANAGER` versions above.

## 2026-03-08

API-Manager-II now connects directly to the Opey backend from the browser. The Opey backend's `CORS_ALLOWED_ORIGINS` env var must include the API-Manager-II URL (e.g. `http://localhost:3003`), and `PUBLIC_OPEY_BASE_URL` must be set in API-Manager-II's `.env` (e.g. `http://localhost:5000`).
