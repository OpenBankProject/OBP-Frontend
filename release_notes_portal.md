# Portal Release Notes

## 2026-10-01

webui_props are rendered as markdown, unless the prop is in `WEB_UI_PROPS_NOT_MARKDOWN` (`packages/shared/src/lib/config/webUiProps.ts`; currently only `webui_support_platform_url`). This also applies to the matching env vars. Titles and questions shown in headings get inline markdown only (emphasis, code, links). Raw HTML is shown as literal text, and http(s) links open in a new tab. Existing values containing `*`, `_`, or a leading `#` or `1.` may now render differently.

webui_props are read from the OBP database only (`GET /obp/v6.0.0/webui-props?what=database`), through one shared cache that is refreshed every 5 minutes. The `config` rows that `what=active` adds come from OBP-API's sample props template, not from its running configuration, so they are no longer used.

The Terms of Service and Privacy Policy on the register page (`webui_terms_and_conditions`, `webui_privacy_policy`) are now loaded on the server instead of from the browser. If one is not set in the database, its dialog says so instead of showing sample text.

## 2026-09-30

Home page text can now be set with OBP webui_props. Each value is taken from the webui_prop, then the env var, then the built-in default. Values are cached for 5 minutes.

| webui_prop | Env var |
|---|---|
| `webui_welcome_title` | `PUBLIC_WELCOME_TITLE` |
| `webui_help_question` | `PUBLIC_HELP_QUESTION` |
| `webui_welcome_description` | `PUBLIC_WELCOME_DESCRIPTION` |
| `webui_welcome_message` | `PUBLIC_WELCOME_MESSAGE` |

The description and the first-visit welcome message support links written as `[label](url)`. Only http(s), mailto: and site-relative (`/path`, `#anchor`) URLs become links; all other markup is shown as literal text.
