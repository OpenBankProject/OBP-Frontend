# Branding: themes and colours

An installation can give an OBP-Frontend app its own colours, fonts and favicon without changing its code. Every app supports this: the Portal, the API Manager, the Conformator and Cohort.

## Settings

Each app reads three environment variables, named with its own prefix: `PORTAL_`, `API_MANAGER_`, `CONFORMATOR_` or `COHORT_`. For the Portal:

| Variable | What it does | Default |
|---|---|---|
| `PORTAL_THEME` | The theme's name: the `data-theme` of every page | `obptheme` |
| `PORTAL_STYLESHEET_URL` | A stylesheet loaded after the app's own: one that defines the theme named in `PORTAL_THEME`, or that changes `obptheme` | none |
| `PORTAL_FAVICON_URL` | The icon in the browser tab | `/favicon.png` |

The logos stay where they were: `PUBLIC_LOGO_URL`, `PUBLIC_DARK_LOGO_URL` and `PUBLIC_MINIMAL_LOGO_URL`.

URLs must be http(s) or a path on the app's own site. The settings are read when the app starts, so restart it after changing them.

## Writing a theme

A theme is a [Skeleton](https://www.skeleton.dev) theme: one CSS rule, `[data-theme='name'] { ... }`, that sets colour scales, fonts and corner radius. The easiest start is `packages/shared/themes/example-theme.css`, a copy of `obptheme` with other colours:

1. Copy it, and change `example` in the selector to your theme's name.
2. Replace the colour scales with your own. Skeleton's theme generator (https://themes.skeleton.dev) makes a full set from a few brand colours.
3. Host the file, set `PORTAL_STYLESHEET_URL` to its URL and `PORTAL_THEME` to its name, and restart the Portal.

The same file covers light and dark mode: each colour has eleven shades, 50 (lightest) to 950 (darkest), and the app picks the shade for the mode.

To change only a few things in the default theme, for example the font, write a stylesheet with `[data-theme='obptheme'] { ... }` and set only `PORTAL_STYLESHEET_URL`.

## Checking a theme

The Portal's `/style-guide` page shows every named style below, and the theme's colour scales. Open it in light and dark mode after changing the theme.

## The named styles

Pages never pick a colour shade themselves. They use these named styles from `packages/shared/styles.css`, which a theme colours. Each sets colours only, for light and dark mode.

| Style | Used for |
|---|---|
| `ui-text` | Strong text, such as headings and values |
| `ui-muted` | Secondary text: labels, dates, hints |
| `ui-text-brand` | Text in the brand colour (primary) |
| `ui-link` | Links and link-like actions (tertiary). Plain links with `anchor` look the same |
| `ui-text-success`, `ui-text-warning`, `ui-text-error` | Text that reports a state |
| `ui-page` | The page's own background, for the side menu, so that it matches the page |
| `ui-card` | A card on the page |
| `ui-panel` | A panel inside a card, or a selected area |
| `ui-hover` | A row or item that highlights under the mouse |
| `ui-border` | Borders, and the dividers between children |
| `ui-border-brand` | The marker on a selected item or your own message: a border in the brand colour |
| `ui-tone-success`, `ui-tone-warning`, `ui-tone-error`, `ui-tone-info`, `ui-tone-accent`, `ui-tone-neutral` | Badges, messages and highlighted boxes: background, text and border together |
| `ui-glow`, `ui-fade` | The dark-mode background glow, and the fade at the foot of a cut-off card |
| `preset-filled-primary-500`, `preset-tonal`, `preset-outlined-surface-500`, `preset-filled-error-500` | Buttons: main, secondary, outline and danger (Skeleton presets) |

### In a page's own CSS

Where a class cannot reach (a table cell, a hover or focus state, a placeholder, an SVG chart), page CSS uses the same styles as variables. They switch with dark mode, so page CSS needs no dark-mode rules.

| Variable | Same as |
|---|---|
| `--ui-text`, `--ui-muted`, `--ui-brand`, `--ui-link`, `--ui-link-hover`, `--ui-success`, `--ui-warning`, `--ui-error` | The text styles |
| `--ui-page`, `--ui-card`, `--ui-panel`, `--ui-hover`, `--ui-border`, `--ui-border-brand` | The backgrounds and borders |
| `--ui-tone-<name>-bg`, `--ui-tone-<name>-text`, `--ui-tone-<name>-border` | The tones (success, warning, error, info, accent, neutral) |
| `--ui-fill-main-bg`, `--ui-fill-main-text`, `--ui-fill-danger-bg`, `--ui-fill-danger-text` | The main and danger buttons |
| `--ui-chart-1` to `--ui-chart-8`, `--ui-chart-label`, `--ui-chart-label-halo` | Chart series, and a label drawn on a series |

The chart series are a categorical palette checked for contrast on light and dark cards. A theme may set its own.

The theme's colour scales are for the theme: primary is the brand colour, secondary a second brand colour, tertiary links and information, success, warning and error the states, and surface the backgrounds, borders and text.

## For developers

Use only the named styles above for colour: the classes in markup, the variables in a page's `<style>` block or a `style` attribute. Never a Tailwind palette colour (`text-gray-600`), a theme shade (`bg-surface-100` or `var(--color-surface-100)`), another Skeleton preset, or a written-out colour (`#e5e7eb`, `rgb(…)`, `white`) in page CSS; a neutral black shadow is the one exception. A test fails if one appears (`src/lib/themeColours.test.ts` in the Portal, the API Manager, the Conformator and Cohort, `src/lib/server/themeColours.test.ts` in the shared package). If a page needs something the styles don't cover, add a style to `styles.css` and the style guide, rather than a one-off colour.
