# Building Playwright-Friendly Web Pages

Tips for writing HTML that is easy to test and resilient to CSS/styling changes.

## Use `data-testid` attributes

The single most impactful thing you can do. Test IDs survive class renames, component refactors, and redesigns.

```html
<!-- Good: stable test anchor -->
<button data-testid="submit-registration">Register</button>

<!-- Fragile: breaks if class or text changes -->
<button class="btn-primary text-sm rounded-lg">Register</button>
```

```ts
// In Playwright
page.getByTestId('submit-registration')
```

Playwright has built-in support via `getByTestId()`. You can configure the attribute name in `playwright.config.ts` if you prefer something like `data-test` or `data-cy`.

## Use semantic HTML and ARIA attributes

Semantic elements and ARIA roles give tests meaningful anchors that also improve accessibility.

```html
<form aria-label="registration">
  <input name="username" aria-label="Username" />
  <button type="submit" aria-label="submit">Register</button>
</form>
```

```ts
page.getByRole('form', { name: 'registration' })
page.getByRole('textbox', { name: 'Username' })
page.getByRole('button', { name: 'submit' })
```

These selectors are independent of CSS classes, tag nesting, and visual layout.

## Use `name` attributes on form inputs

The `name` attribute is stable, functional (needed for form submission), and unlikely to change for cosmetic reasons.

```html
<input name="first_name" />
<input name="email" />
```

```ts
page.locator('input[name="first_name"]')
page.locator('input[name="email"]')
```

## Avoid selectors tied to styling

| Fragile | Why | Better alternative |
|---|---|---|
| `.btn-primary` | Styling class, changes with redesigns | `data-testid="submit-btn"` |
| `.flex.items-center.space-x-3` | Layout utility classes | `data-testid="provider-row"` |
| `div > div > button` | Structural coupling, breaks with refactors | `button[data-testid="..."]` |
| `:nth-child(2)` | Position-dependent, breaks if order changes | `data-testid` on each item |

## Give distinct identities to repeated items

When you have lists of similar elements, give each one a unique test ID.

```html
<!-- Good: each document row is identifiable -->
<div data-testid="legal-doc-terms-of-service">
  <span>Terms of Service</span>
  <button data-testid="accept-terms-of-service">Read & Accept</button>
</div>
<div data-testid="legal-doc-privacy-policy">
  <span>Privacy Policy</span>
  <button data-testid="accept-privacy-policy">Read & Accept</button>
</div>
```

```ts
// Direct, no ambiguity
page.getByTestId('accept-privacy-policy').click()
```

Without this, tests resort to fragile text matching or positional selectors to distinguish items.

## Mark key states with data attributes

Expose UI state in the DOM so tests can assert on it directly.

```html
<div data-testid="role-checker" data-state="collapsed">...</div>
<div data-testid="role-checker" data-state="expanded">...</div>
```

```ts
await expect(page.getByTestId('role-checker')).toHaveAttribute('data-state', 'expanded')
```

This is more reliable than checking for CSS classes like `.expanded` which may be renamed.

## Summary

| Principle | Effect |
|---|---|
| Add `data-testid` to interactive and assertable elements | Tests don't break on styling changes |
| Use semantic HTML + ARIA | Tests read like user intent, not DOM spelunking |
| Use `name` on form fields | Stable, functional anchors |
| Avoid class-based and structural selectors | Decouples tests from CSS and layout |
| Give unique IDs to repeated items | Eliminates ambiguous selectors |
| Expose state via data attributes | Clean assertions without class sniffing |
