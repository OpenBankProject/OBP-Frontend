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
    <a href="/app-studio" class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">← Back to App Studio</a>
    <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
      <LayoutTemplate class="h-7 w-7" />
      Page Blocks
    </h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">
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
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
        onclick={() => (selectedKey = ex.key)}
        data-testid="landing-example-{ex.key}"
      >
        {ex.title}
      </button>
    {/each}
    <label class="ml-auto flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input type="checkbox" name="outline_blocks" bind:checked={outlineBlocks} data-testid="landing-outline-blocks" />
      Outline the blocks
    </label>
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      onclick={openInAppStudio}
      data-testid="landing-open-in-studio"
    >
      <Smartphone class="h-4 w-4" /> Open in App Studio
    </button>
    {#if !data.collectionId}
      <span class="text-sm text-yellow-700 dark:text-yellow-300">No API product has a collection, so the endpoints block shows an error on purpose.</span>
    {/if}
  </div>

  <!-- The rendered page. Base styles for the blocks, then the page's own CSS inside its HTML. -->
  {@html `<style>${LANDING_BASE_CSS}</style>`}
  {#key selected?.key}
    <div bind:this={pageEl} class="mb-8 overflow-hidden rounded-2xl border border-gray-200 shadow-sm dark:border-gray-700 {outlineBlocks ? 'outline-blocks' : ''}" data-testid="landing-rendered" data-state={outlineBlocks ? "outlined" : "plain"}>
      {@html selected?.html ?? ""}
    </div>
  {/key}

  <div class="grid gap-6 lg:grid-cols-2">
    <details class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <summary class="cursor-pointer font-semibold text-gray-900 dark:text-gray-100">Page source (what the author or Opey writes)</summary>
      <pre class="mt-3 max-h-[32rem] overflow-auto rounded-md bg-gray-50 p-3 text-xs leading-5 text-gray-800 dark:bg-gray-900 dark:text-gray-200" data-testid="landing-source">{selected?.source}</pre>
    </details>

    <details class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <summary class="cursor-pointer font-semibold text-gray-900 dark:text-gray-100">What Opey is told (generated from the registry)</summary>
      <pre class="mt-3 max-h-[32rem] overflow-auto rounded-md bg-gray-50 p-3 text-xs leading-5 text-gray-800 dark:bg-gray-900 dark:text-gray-200" data-testid="landing-opey-context">{data.opeyContext}</pre>
    </details>
  </div>

  <div class="mt-8 grid gap-6 lg:grid-cols-2">
    <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 class="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Live-data tags</h2>
      <ul class="space-y-3 text-sm">
        {#each LIVE_TAGS as t (t.tag)}
          <li>
            <code class="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">&lt;{t.tag}&gt;</code>
            <span class="text-gray-700 dark:text-gray-300"> {t.description}</span>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {#each t.attributes as a (a.name)}<span class="mr-3"><code>{a.name}</code>{a.required ? "*" : ""}</span>{/each}
            </div>
          </li>
        {/each}
      </ul>
    </section>
    <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 class="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Behaviours</h2>
      <ul class="space-y-3 text-sm">
        {#each BEHAVIOURS as b (b.name)}
          <li>
            <code class="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">data-behaviour="{b.name}"</code>
            <span class="text-gray-700 dark:text-gray-300"> {b.description}</span>
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
    outline: 2px dashed #e11d48;
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
    background: #e11d48;
    color: #fff;
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
