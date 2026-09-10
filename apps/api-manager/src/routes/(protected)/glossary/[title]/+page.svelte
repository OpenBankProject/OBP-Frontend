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
    <a href="/glossary" class="text-blue-600 hover:underline dark:text-blue-400">Glossary</a>
    <span class="mx-2 text-gray-400">/</span>
    <span class="text-gray-500 dark:text-gray-400">{data.entry.title}</span>
  </nav>

  <div class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div class="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 p-6 dark:border-gray-700">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.entry.title}</h1>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          {#if data.entry.is_dynamic}
            <span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" data-testid="badge-dynamic">Dynamic Glossary Item</span>
            {#if data.entry.overrides_static_item}
              <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" data-testid="badge-overriding">Overrides the static item of this title</span>
            {/if}
          {:else}
            <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300" data-testid="badge-static">Static — compiled into the API</span>
          {/if}
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        {#if data.entry.is_dynamic}
          <a href="/glossary-items/{encodeURIComponent(data.entry.title)}" class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700" data-testid="edit-link"><Pencil size={14} /> Edit</a>
        {:else}
          <a href="/glossary-items/create?title={encodeURIComponent(data.entry.title)}" class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700" data-testid="override-link"><Plus size={14} /> Override</a>
        {/if}
        <a href={data.explorerUrl} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
          API Explorer <ExternalLink size={12} />
        </a>
      </div>
    </div>

    <div class="p-6">
      <!-- Rendered from the markdown with markdown-it (html:false), so raw HTML is escaped. -->
      <div class="glossary-body" data-testid="glossary-body">{@html data.entry.html}</div>

      <div class="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
        <div class="mb-4"><ApiExplorerEndpoints endpoints={data.endpoints} /></div>
        <button type="button" onclick={() => (showMarkdown = !showMarkdown)} class="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400" aria-expanded={showMarkdown} data-testid="toggle-markdown">
          <Code size={14} /> {showMarkdown ? "Hide" : "Show"} markdown source
        </button>
        {#if showMarkdown}
          <pre class="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200" data-testid="markdown-source">{data.entry.markdown}</pre>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .glossary-body {
    font-size: 0.9375rem;
    line-height: 1.6;
    color: #374151;
  }

  .glossary-body :global(h1) {
    display: none; /* the page already carries the title */
  }

  .glossary-body :global(h2) {
    font-size: 1.0625rem;
    font-weight: 600;
    margin: 1.25rem 0 0.5rem;
    color: #111827;
  }

  .glossary-body :global(h3) {
    font-size: 0.9375rem;
    font-weight: 600;
    margin: 1rem 0 0.375rem;
    color: #111827;
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
    background: #f3f4f6;
    padding: 0.05rem 0.3rem;
    border-radius: 4px;
  }

  .glossary-body :global(pre) {
    overflow-x: auto;
    background: #111827;
    color: #e5e7eb;
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
    color: #2563eb;
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
    border: 1px solid #e5e7eb;
    padding: 0.25rem 0.5rem;
    text-align: left;
  }

  .glossary-body :global(img) {
    max-width: 100%;
    height: auto;
  }

  :global([data-mode="dark"]) .glossary-body {
    color: var(--color-surface-200);
  }

  :global([data-mode="dark"]) .glossary-body :global(h2),
  :global([data-mode="dark"]) .glossary-body :global(h3) {
    color: var(--color-surface-50);
  }

  :global([data-mode="dark"]) .glossary-body :global(code) {
    background: rgb(var(--color-surface-700));
  }

  :global([data-mode="dark"]) .glossary-body :global(a) {
    color: #60a5fa;
  }

  :global([data-mode="dark"]) .glossary-body :global(th),
  :global([data-mode="dark"]) .glossary-body :global(td) {
    border-color: #374151;
  }
</style>
