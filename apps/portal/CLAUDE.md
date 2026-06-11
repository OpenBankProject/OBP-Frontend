# OBP-Portal

## OBP-API Proxy Pattern

When making client-side calls to the OBP-API, use the generic proxy at `/proxy/obp/...` instead of creating dedicated API route files. The proxy adds OAuth authentication and passes responses through unmodified. Only create dedicated `/backend/...` routes when custom logic is needed (e.g. protocol bridging like gRPC → SSE). See [docs/obp-proxy.md](docs/obp-proxy.md) for details.

## Page Layout & Width

Follow [page-layout.md](../../page-layout.md) (repo root — shared with API Manager) for content width on pages:

- Default config/dashboard page wrapper is `container mx-auto max-w-7xl px-4 py-8`.
- These are configuration pages, not prose — caps exist to limit eye-scan distance and center content, not to fit small screens.
- Wide tables / code blocks should break out to full width (and use `overflow-x-auto`) rather than widening the whole page.

## HTML Best Practices

Follow the guidelines in [docs/playwright-friendly-html.md](docs/playwright-friendly-html.md) when writing HTML. Key points:

- Add `data-testid` attributes to interactive and assertable elements
- Use semantic HTML and ARIA attributes for accessibility and testability
- Use `name` attributes on form inputs
- Avoid selectors tied to styling (no class-based or structural selectors in tests)
- Give unique `data-testid` values to repeated/list items
- Expose UI state via `data-` attributes rather than CSS classes
