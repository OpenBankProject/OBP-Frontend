# OBP-Portal

## HTML Best Practices

Follow the guidelines in [docs/playwright-friendly-html.md](docs/playwright-friendly-html.md) when writing HTML. Key points:

- Add `data-testid` attributes to interactive and assertable elements
- Use semantic HTML and ARIA attributes for accessibility and testability
- Use `name` attributes on form inputs
- Avoid selectors tied to styling (no class-based or structural selectors in tests)
- Give unique `data-testid` values to repeated/list items
- Expose UI state via `data-` attributes rather than CSS classes
