# Portal Release Notes

## 2026-09-30

Home page text can now be set with OBP webui_props. Each value is taken from the webui_prop, then the env var, then the built-in default. Values are cached for 5 minutes.

| webui_prop | Env var |
|---|---|
| `webui_welcome_title` | `PUBLIC_WELCOME_TITLE` |
| `webui_help_question` | `PUBLIC_HELP_QUESTION` |
| `webui_welcome_description` | `PUBLIC_WELCOME_DESCRIPTION` |
| `webui_welcome_message` | `PUBLIC_WELCOME_MESSAGE` |

The description and the first-visit welcome message support links written as `[label](url)`. Only http(s), mailto: and site-relative (`/path`, `#anchor`) URLs become links; all other markup is shown as literal text.
