# Design Decisions

Decisions that apply across the Portal, the API Manager and `packages/shared`. Read before changing either app.

Also: [docs/page-layout.md](docs/page-layout.md) (page width), [docs/playwright-friendly-html.md](docs/playwright-friendly-html.md) (`data-testid`, semantic HTML).

## Security

- **Cache invalidation is a security decision.** Never expose URL parameters (e.g. `?refresh=1`), headers or form fields that make a server cache refetch from OBP: anyone who can load the page can use them to drive load onto OBP-API. Caches expire on their TTL. They are cleared only by trusted server code after a successful write the app itself made (Manager: `clearCachesAfterWrite`, called by the `/proxy` routes). Keep such rules narrow (path, method, 2xx only). The `force` option on cache functions is for tests only.
- **Quantise timestamps sent to OBP.** Never send a raw "now" as `from_date` / `to_date`; floor it (10-minute or hour marks) so OBP's query-keyed cache can hit.
- **The browser never calls Opey directly.** All browser → Opey traffic goes through the app's `/backend/opey` proxy (`createOpeyProxyHandlers` in `packages/shared`).
- **Identify consumers by `consumer_id`.** The client id is the consumer key, a credential: never display it or put it in links. Do not shorten `consumer_id` to `id`.
- **No author JavaScript in the Portal origin.** User-written apps and reports run in the App Studio sandbox.

## Code structure

- **Shared from the start.** Code used by both apps lives in `packages/shared`. Remove duplicates when you find them.
- **Generic OBP proxy.** Client-side OBP calls go through `/proxy/obp/...`; add a `/backend/...` route only when custom logic is needed.
- **Route files export only what SvelteKit expects.** Helpers exported from `+server.ts` / `+page.server.ts` break the route; put them in `$lib/server`.
- **Never modify `/health`.** Kubernetes liveness depends on it. Health-check work goes in `/ready`, `/status` or the hooks registry.
- **End-to-end tests live in OBP-End-To-End-Testing**, not in ad-hoc Playwright scripts here.

## UI

- **Browser standards first.** Never block copy/paste, text selection, right-click, keyboard shortcuts or focus outlines.
- **No `title=` tooltips or `cursor: help` on data** (cells, chips, IDs): they get in the way of selecting and copying the value. Use a visible label or `aria-label`.
- **The URL drives the content.** Filters and view state live in the query string and are honoured on arrival, so links (including documentation links) land on the right view.
- **Users are professionals.** No explanatory subtitles or intro blurbs under headings, and no "are you sure"-style warnings; a heading and the data are enough.
- **Show env var names literally.** Diagnostic UI uses the real name as the key (`PUBLIC_OBP_BASE_URL`), never a renamed form.

## Documentation in the apps

- **Explanatory text comes from the OBP glossary**, not from prose hardcoded in pages. Help pages render glossary entries (`GlossaryEntry`) next to live values.
- **Help pages end with a small references footer** (`HelpReferences`): *Sources* lists the glossary entries used, *Links* lists the list page and the API Explorer. No large link buttons.
- **Link every Manager page to the API Explorer** resource docs for the endpoints it reads or writes (`ApiExplorerEndpoints.svelte`, `explorerResourceDocUrl`).

## API Manager menu

- Six verb domains with headed subsections: **Build, Messaging, Govern, Observe, Operate, Catalogue** (`apps/api-manager/src/lib/config/navigation.ts`). New pages go into the subsection for their concept; a distinct concept gets its own subsection rather than a near neighbour.
- "Create …" is a button on the list page, never a menu item. Help is a `?` link in the page header; a Help menu item only where explicitly decided (Build → Resource Docs → Help).
- Keep each domain's base paths accurate so the active domain highlights.

## webui_props

- Operator-configurable text comes from an OBP webui_prop, then an env var, then a built-in default. The webui_prop name is derived from the env var (`PUBLIC_WELCOME_TITLE` → `webui_welcome_title`). API Manager names end in `_MANAGER` / `_manager` so they never collide with the Portal's.
- Values are read with `what=database` only. The `config` rows OBP-API returns for `what=active` come from its sample props template, not its running configuration.
- Values are **rendered as markdown** unless the prop is in `WEB_UI_PROPS_NOT_MARKDOWN` (`packages/shared/src/lib/config/webUiProps.ts`). Use `renderWebUiProp`; pass `inline` when the value sits in a heading. Raw HTML is escaped.

## Release notes

`release_notes_manager.md` and `release_notes_portal.md` are for breaking changes that operators must act on (renamed env vars, changed behaviour of configured values), not for every change.

## Syncing from the standalone repos

When pulling from OBP-Portal or API-Manager-II, prefer the upstream functional changes; structural work in this monorepo (de-duplication, renames) stays.
