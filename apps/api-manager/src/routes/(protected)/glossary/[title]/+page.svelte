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
  import { ExternalLink, Pencil, Plus, Code } from "@lucide/svelte";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";

  let { data } = $props();
  let showMarkdown = $state(false);
</script>

<svelte:head>
  <title>{data.entry.title} - Glossary - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
  <nav class="mb-6 text-sm" aria-label="Breadcrumb">
    <a href="/glossary" class="hover:underline ui-link">Glossary</a>
    <span class="mx-2 ui-muted">/</span>
    <span class="ui-muted">{data.entry.title}</span>
  </nav>

  <div class="rounded-lg border shadow-sm ui-card ui-border">
    <div class="flex flex-wrap items-start justify-between gap-4 border-b p-6 ui-border">
      <div>
        <h1 class="text-2xl font-bold ui-text">{data.entry.title}</h1>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          {#if data.entry.is_dynamic}
            <span class="rounded-full px-2 py-0.5 text-xs font-medium ui-tone-info" data-testid="badge-dynamic">Dynamic Glossary Item</span>
            {#if data.entry.overrides_static_item}
              <span class="rounded-full px-2 py-0.5 text-xs font-medium ui-tone-warning" data-testid="badge-overriding">Overrides the static item of this title</span>
            {/if}
          {:else}
            <span class="rounded-full px-2 py-0.5 text-xs font-medium ui-panel ui-muted" data-testid="badge-static">Static — compiled into the API</span>
          {/if}
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        {#if data.entry.is_dynamic}
          <a href="/glossary-items/{encodeURIComponent(data.entry.title)}" class="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border" data-testid="edit-link"><Pencil size={14} /> Edit</a>
        {:else}
          <a href="/glossary-items/create?title={encodeURIComponent(data.entry.title)}" class="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border" data-testid="override-link"><Plus size={14} /> Override</a>
        {/if}
        <a href={data.explorerUrl} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border">
          API Explorer <ExternalLink size={12} />
        </a>
      </div>
    </div>

    <div class="p-6">
      <!-- Rendered from the markdown with markdown-it (html:false), so raw HTML is escaped. -->
      <div class="glossary-body" data-testid="glossary-body">{@html data.entry.html}</div>

      <div class="mt-6 border-t pt-4 ui-border">
        <div class="mb-4"><ApiExplorerEndpoints endpoints={data.endpoints} /></div>
        <button type="button" onclick={() => (showMarkdown = !showMarkdown)} class="inline-flex items-center gap-1 text-sm hover:underline ui-link" aria-expanded={showMarkdown} data-testid="toggle-markdown">
          <Code size={14} /> {showMarkdown ? "Hide" : "Show"} markdown source
        </button>
        {#if showMarkdown}
          <pre class="mt-3 overflow-x-auto rounded-lg border p-4 text-xs ui-card ui-text ui-border" data-testid="markdown-source">{data.entry.markdown}</pre>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .glossary-body {
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--ui-text);
  }

  .glossary-body :global(h1) {
    display: none; /* the page already carries the title */
  }

  .glossary-body :global(h2) {
    font-size: 1.0625rem;
    font-weight: 600;
    margin: 1.25rem 0 0.5rem;
    color: var(--ui-text);
  }

  .glossary-body :global(h3) {
    font-size: 0.9375rem;
    font-weight: 600;
    margin: 1rem 0 0.375rem;
    color: var(--ui-text);
  }

  .glossary-body :global(p) {
    margin: 0 0 0.75rem;
  }

  .glossary-body :global(ul),
  .glossary-body :global(ol) {
    margin: 0 0 0.75rem 1.25rem;
    padding: 0;
    list-style: revert;
  }

  .glossary-body :global(li) {
    margin-bottom: 0.25rem;
  }

  .glossary-body :global(code) {
    font-size: 0.85em;
    background: var(--ui-panel);
    padding: 0.05rem 0.3rem;
    border-radius: 4px;
  }

  .glossary-body :global(pre) {
    overflow-x: auto;
    background: var(--ui-panel);
    color: var(--ui-text);
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    margin: 0 0 0.75rem;
  }

  .glossary-body :global(pre code) {
    background: none;
    padding: 0;
    color: inherit;
  }

  .glossary-body :global(a) {
    color: var(--ui-link);
    text-decoration: underline;
  }

  .glossary-body :global(table) {
    display: block;
    overflow-x: auto;
    border-collapse: collapse;
    margin: 0 0 0.75rem;
  }

  .glossary-body :global(th),
  .glossary-body :global(td) {
    border: 1px solid var(--ui-border);
    padding: 0.25rem 0.5rem;
    text-align: left;
  }

  .glossary-body :global(img) {
    max-width: 100%;
    height: auto;
  }
</style>
