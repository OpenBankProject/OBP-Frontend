# CLAUDE.md — API Manager II

## Communication style

- Never deflect blame or make excuses like "this isn't related to my changes". Just focus on diagnosing and fixing the problem.

## Code style

- Do not use fallbacks (e.g. `value || otherValue`). Use the correct field name directly. If the field name is wrong, fix it — don't paper over it.

## UX tone

- Do not add patronising or condescending warnings, tooltips, or helper text (e.g. "Use with caution", "Are you sure?", "This action cannot be undone"). Trust that users understand what they are doing.

## Page layout & width

Follow [`docs/page-layout.md`](docs/page-layout.md) for content width on pages:

- Default config/dashboard page wrapper is `container mx-auto max-w-7xl px-4 py-8`.
- These are API configuration pages, not prose — caps exist to limit eye-scan distance and center content, not to fit small screens.
- Wide tables / code blocks should break out to full width (and use `overflow-x-auto`) rather than widening the whole page.

## HTML best practices

Follow the guidelines in [`docs/playwright-friendly-html.md`](docs/playwright-friendly-html.md) when writing or modifying Svelte components:

- Add `data-testid` attributes to interactive and assertable elements
- Use semantic HTML and ARIA labels
- Use `name` attributes on form inputs
- Avoid selectors tied to CSS classes or DOM structure
- Give unique `data-testid` values to repeated items (e.g. table rows)
- Expose UI state via `data-state` or similar data attributes (e.g. `data-state="expanded"`)
