<!--
  Copyright (C) 2025-2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { initLandingBehaviours, LANDING_BASE_CSS, LIVE_TAGS, BEHAVIOURS } from "@obp/shared/landing";
  import { LayoutTemplate, Smartphone } from "@lucide/svelte";

  let { data } = $props();

  let selectedKey = $state("");
  const selected = $derived(data.examples.find((e) => e.key === selectedKey) ?? data.examples[0]);

  let pageEl = $state<HTMLElement | null>(null);
  // Draw an outline and a label around every block in the rendered page.
  let outlineBlocks = $state(false);

  // Wire the behaviours whenever a different example is shown; tear down the previous ones.
  $effect(() => {
    void selected;
    if (!pageEl) return;
    const teardown = initLandingBehaviours(pageEl);
    return teardown;
  });

  /** Hand the example to App Studio's landing-page mode, where Opey can change it. */
  function openInAppStudio() {
    if (!selected) return;
    sessionStorage.setItem("app-studio:landing-source", selected.source);
    sessionStorage.setItem("app-studio:landing-title", selected.title);
    goto("/app-studio?mode=page");
  }
</script>

<svelte:head>
  <title>Page Blocks - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6">
    <a href="/app-studio" class="mb-4 inline-flex items-center text-sm ui-link">← Back to App Studio</a>
    <h1 class="flex items-center gap-2 text-3xl font-bold ui-text">
      <LayoutTemplate class="h-7 w-7" />
      Page Blocks
    </h1>
    <p class="mt-1 ui-muted">
      Two example Portal pages written as free HTML and CSS. They share the same five live-data tags and five behaviours,
      expanded on the server with real catalogue data. No author-written script runs on this page.
    </p>
  </div>

  <div class="mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="Example pages">
    {#each data.examples as ex (ex.key)}
      <button
        type="button"
        role="tab"
        aria-selected={ex.key === selected?.key}
        class="rounded-md border px-3 py-1.5 text-sm font-medium {ex.key === selected?.key
          ? 'preset-filled-primary-500'
          : 'ui-card ui-hover ui-muted ui-border'}"
        onclick={() => (selectedKey = ex.key)}
        data-testid="landing-example-{ex.key}"
      >
        {ex.title}
      </button>
    {/each}
    <label class="ml-auto flex items-center gap-2 text-sm ui-muted">
      <input type="checkbox" name="outline_blocks" bind:checked={outlineBlocks} data-testid="landing-outline-blocks" />
      Outline the blocks
    </label>
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium ui-card ui-hover ui-muted ui-border"
      onclick={openInAppStudio}
      data-testid="landing-open-in-studio"
    >
      <Smartphone class="h-4 w-4" /> Open in App Studio
    </button>
    {#if !data.collectionId}
      <span class="text-sm ui-text-warning">No API product has a collection, so the endpoints block shows an error on purpose.</span>
    {/if}
  </div>

  <!-- The rendered page. Base styles for the blocks, then the page's own CSS inside its HTML. -->
  {@html `<style>${LANDING_BASE_CSS}</style>`}
  {#key selected?.key}
    <div bind:this={pageEl} class="mb-8 overflow-hidden rounded-2xl border shadow-sm ui-border {outlineBlocks ? 'outline-blocks' : ''}" data-testid="landing-rendered" data-state={outlineBlocks ? "outlined" : "plain"}>
      {@html selected?.html ?? ""}
    </div>
  {/key}

  <div class="grid gap-6 lg:grid-cols-2">
    <details class="rounded-lg border p-4 ui-card ui-border">
      <summary class="cursor-pointer font-semibold ui-text">Page source (what the author or Opey writes)</summary>
      <pre class="mt-3 max-h-[32rem] overflow-auto rounded-md p-3 text-xs leading-5 ui-card ui-text" data-testid="landing-source">{selected?.source}</pre>
    </details>

    <details class="rounded-lg border p-4 ui-card ui-border">
      <summary class="cursor-pointer font-semibold ui-text">What Opey is told (generated from the registry)</summary>
      <pre class="mt-3 max-h-[32rem] overflow-auto rounded-md p-3 text-xs leading-5 ui-card ui-text" data-testid="landing-opey-context">{data.opeyContext}</pre>
    </details>
  </div>

  <div class="mt-8 grid gap-6 lg:grid-cols-2">
    <section class="rounded-lg border p-4 ui-card ui-border">
      <h2 class="mb-3 text-lg font-semibold ui-text">Live-data tags</h2>
      <ul class="space-y-3 text-sm">
        {#each LIVE_TAGS as t (t.tag)}
          <li>
            <code class="rounded px-1.5 py-0.5 text-xs ui-panel">&lt;{t.tag}&gt;</code>
            <span class="ui-muted"> {t.description}</span>
            <div class="mt-1 text-xs ui-muted">
              {#each t.attributes as a (a.name)}<span class="mr-3"><code>{a.name}</code>{a.required ? "*" : ""}</span>{/each}
            </div>
          </li>
        {/each}
      </ul>
    </section>
    <section class="rounded-lg border p-4 ui-card ui-border">
      <h2 class="mb-3 text-lg font-semibold ui-text">Behaviours</h2>
      <ul class="space-y-3 text-sm">
        {#each BEHAVIOURS as b (b.name)}
          <li>
            <code class="rounded px-1.5 py-0.5 text-xs ui-panel">data-behaviour="{b.name}"</code>
            <span class="ui-muted"> {b.description}</span>
          </li>
        {/each}
      </ul>
    </section>
  </div>
</div>

<style>
  /* Outline mode: every live-data tag and behaviour gets a dashed edge and a label naming it. */
  .outline-blocks :global(.obp-products),
  .outline-blocks :global(.obp-endpoints),
  .outline-blocks :global(.obp-banks),
  .outline-blocks :global(.obp-signup),
  .outline-blocks :global(.obp-stat),
  .outline-blocks :global([data-behaviour]) {
    outline: 2px dashed var(--ui-error);
    outline-offset: 3px;
    position: relative;
  }
  .outline-blocks :global(.obp-products)::before,
  .outline-blocks :global(.obp-endpoints)::before,
  .outline-blocks :global(.obp-banks)::before,
  .outline-blocks :global(.obp-signup)::before,
  .outline-blocks :global(.obp-stat)::before,
  .outline-blocks :global([data-behaviour])::before {
    position: absolute;
    top: -14px;
    left: -3px;
    z-index: 5;
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--ui-fill-danger-bg);
    color: var(--ui-fill-danger-text);
    font: 600 10px/1.4 ui-monospace, monospace;
    letter-spacing: .04em;
    pointer-events: none;
  }
  .outline-blocks :global(.obp-products)::before { content: "<obp-products>"; }
  .outline-blocks :global(.obp-endpoints)::before { content: "<obp-endpoints>"; }
  .outline-blocks :global(.obp-banks)::before { content: "<obp-banks>"; }
  .outline-blocks :global(.obp-signup)::before { content: "<obp-signup>"; }
  .outline-blocks :global(.obp-stat)::before { content: "<obp-stat>"; }
  .outline-blocks :global([data-behaviour])::before { content: "data-behaviour=" attr(data-behaviour); }
</style>
