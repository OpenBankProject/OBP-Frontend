# CLAUDE.md — API Manager II

## HTML best practices

Follow the guidelines in [`docs/playwright-friendly-html.md`](docs/playwright-friendly-html.md) when writing or modifying Svelte components:

- Add `data-testid` attributes to interactive and assertable elements
- Use semantic HTML and ARIA labels
- Use `name` attributes on form inputs
- Avoid selectors tied to CSS classes or DOM structure
- Give unique `data-testid` values to repeated items (e.g. table rows)
- Expose UI state via `data-state` or similar data attributes (e.g. `data-state="expanded"`)
