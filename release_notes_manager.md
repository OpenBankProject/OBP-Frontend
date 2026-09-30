# API Manager Release Notes

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
