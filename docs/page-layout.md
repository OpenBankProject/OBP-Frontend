# Page Layout & Width Conventions

How wide should a page's content be? These are **configuration / dashboard pages for an
API system** — not prose or marketing. The goal is dense, scannable, uncramped control
surfaces, not a comfortable reading column for long-form text.

## Why cap the width at all

A `max-width` cap is **not** about fitting small screens — narrow displays are already
handled by responsive padding (`px-4`), `sm:`/`md:` breakpoints, and `overflow-x-auto`.
The cap only matters on screens *wider* than the cap, and it earns its place by:

- **Keeping eye-scan distance sane.** Form labels and rows of fields stretched across a
  27"/4K monitor force the eye to travel a long way to pair a label with its value.
- **Centering content** (`mx-auto`) so wide screens look intentional instead of pinning
  everything to the left with a huge empty right gutter.
- **Sizing forms sensibly** — a single text input is absurd at 2000px wide.

It is **not** about line length for prose (we rarely have paragraphs here).

## The default

Standard configuration page wrapper:

```svelte
<div class="container mx-auto max-w-7xl px-4 py-8">
```

`max-w-7xl` (1280px) is our default for pages that mix metadata cards, forms, and tables.
It feels full on a laptop without sprawling on a large monitor.

| Use case                                             | Width            |
| ---------------------------------------------------- | ---------------- |
| **Default** config/dashboard page (cards + forms)    | `max-w-7xl`      |
| Focused single-column form / wizard step             | `max-w-2xl`–`3xl`|
| Wide data: tables, code/JSON, diagrams               | **break out** (see below) |

Avoid inventing new in-between caps (`4xl`, `5xl`, `6xl`) per page. Pick from the rows
above so detail pages line up with each other.

## Why consistency across pages matters

Consistency is best practice — but it's a **means, not the goal**. The goal is to reduce
friction and communicate clearly. Consistency serves that by:

- **Predictability.** When every detail page is the same width and aligns the same way,
  users build a mental model once and reuse it everywhere (Jakob's Law — people expect
  your app to match patterns they already know, including its own internal patterns). The
  page becomes muscle memory instead of something to figure out.
- **Lower cognitive load.** Every arbitrary visual difference is a small question the brain
  has to answer — "is this page wider on purpose? does it mean something?" Random variation
  spends the user's attention on noise instead of the task (configuring the API).
- **Maintainability.** A small set of known widths is easier to restyle and test than a
  dozen bespoke ones. Change the default once, not on every page.
- **Perceived quality.** Consistent spacing/width reads as intentional; random variation
  reads as unfinished, even when users can't say why.

The important nuance — **constrain arbitrary variation, allow meaningful variation:**

- Consistency means "similar things look similar; different things look different." A
  focused single-field form *should* be narrower than a wide data table — that difference
  is meaningful and helps. That's why this doc allows a few tiers (form / default /
  break-out) rather than one width everywhere.
- The reason to avoid a new `4xl`/`5xl`/`6xl` per page isn't that those values are wrong —
  it's that picking widths *ad hoc, page by page* produces variation that carries no
  meaning. If a genuinely new tier is needed, **add it to the table above** so other pages
  can line up with it too, rather than leaving a one-off.
- Don't let consistency calcify a bad default. "We've always done it this way" isn't a
  reason; deviate deliberately when a page has a real different need — then promote that
  deviation back into the shared set.

## Wide data should break out, not squeeze

The width that's comfortable for forms is too narrow for a wide table. When a page has a
table/code block with many columns, **don't** widen the whole page to fit it — that makes
the forms sprawl too. Instead let the wide element break out of the reading-width column
while the cards/forms stay capped:

```svelte
<div class="container mx-auto max-w-7xl px-4 py-8">
  <!-- metadata cards, forms: stay at max-w-7xl -->

  <!-- wide table: break out to full viewport width -->
  <div class="mb-6">
    <div class="overflow-x-auto">
      <table class="min-w-full ...">...</table>
    </div>
  </div>
</div>
```

Always wrap wide tables in `overflow-x-auto` so they scroll horizontally on smaller
screens instead of overflowing the page. Note the scrollbar sits at the *bottom* of the
table — for very tall tables, prefer breaking out / widening so users don't have to find
it, rather than relying on the scroll alone.

## Checklist for a new detail/config page

- [ ] Page wrapper is `container mx-auto max-w-7xl px-4 py-8` (or a narrower cap from the
      table above if it's a focused form).
- [ ] Any multi-column table or code/JSON block is wrapped in `overflow-x-auto`.
- [ ] If a table is the widest thing on the page and feels cramped, break it out to full
      width rather than bumping the whole page's cap.
