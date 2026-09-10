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
  import { ExternalLink, RefreshCw, Plus, BookOpen } from "@lucide/svelte";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";

  let { data } = $props();

  const SOURCES = [
    { key: "all", label: "All" },
    { key: "dynamic", label: "Dynamic" },
    { key: "static", label: "Static" },
    { key: "overriding", label: "Overriding a static item" },
  ] as const;

  function href(opts: { source?: string; query?: string } = {}): string {
    const source = opts.source ?? data.source;
    const query = opts.query ?? data.query;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (source !== "all") params.set("source", source);
    const qs = params.toString();
    return qs ? `/glossary?${qs}` : "/glossary";
  }
  const sourceHref = (source: string) => href({ source });
  const clearSearchHref = () => href({ query: "" });

  function countFor(key: string): number {
    if (key === "dynamic") return data.counts.dynamic;
    if (key === "static") return data.counts.static;
    if (key === "overriding") return data.counts.overriding;
    return data.counts.total;
  }
</script>

<svelte:head>
  <title>Glossary - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Glossary</h1>
      <p class="mt-1 max-w-3xl text-gray-600 dark:text-gray-400">
        The Glossary as consumers see it: the terms compiled into the API unioned with the
        <a href="/glossary-items" class="text-blue-600 hover:underline dark:text-blue-400">Dynamic Glossary Items</a>
        maintained here. Each entry reports where it came from.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <a href="?refresh=1" class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700" data-testid="refresh-link">
        <RefreshCw size={16} /> Refresh
      </a>
      <a href="{data.explorerUrl}/glossary" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
        API Explorer <ExternalLink size={12} />
      </a>
    </div>
  </div>

  <div class="mb-4">
    <ApiExplorerEndpoints endpoints={data.endpoints} />
  </div>

  {#if data.loadError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="load-error">{data.loadError}</div>
  {/if}

  {#if data.duplicateTitles.length > 0}
    <div class="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100" data-testid="duplicate-titles">
      OBP serves {data.duplicateTitles.length} title{data.duplicateTitles.length === 1 ? "" : "s"} more than once, so only the first copy of each is listed here:
      <span class="font-mono">{data.duplicateTitles.join(", ")}</span>. Two static Glossary Items declared in different places can collide like this.
    </div>
  {/if}

  <div class="mb-4 grid gap-3 sm:grid-cols-4" data-testid="glossary-counts">
    <div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{data.counts.total}</div>
      <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Entries</div>
    </div>
    <div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{data.counts.static}</div>
      <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Static</div>
    </div>
    <div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{data.counts.dynamic}</div>
      <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Dynamic</div>
    </div>
    <div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{data.counts.overriding}</div>
      <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Overriding a static item</div>
    </div>
  </div>

  <div class="mb-4 flex flex-wrap items-end justify-between gap-4">
    <form method="GET" action="/glossary" class="flex flex-wrap items-end gap-3" data-testid="search-form">
      <input type="hidden" name="source" value={data.source} />
      <div>
        <label for="glossary-search" class="block text-xs font-medium text-gray-600 dark:text-gray-400">Search titles and descriptions</label>
        <input
          id="glossary-search"
          name="q"
          type="search"
          value={data.query}
          placeholder="e.g. consent, view, counterparty"
          class="mt-1 w-80 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          data-testid="search-input"
        />
      </div>
      <button type="submit" class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Search</button>
      {#if data.query}
        <a href={clearSearchHref()} class="text-sm text-blue-600 hover:underline dark:text-blue-400" data-testid="clear-search">Clear</a>
      {/if}
    </form>

    <nav class="flex flex-wrap gap-2" aria-label="Filter by source" data-testid="source-filters">
      {#each SOURCES as s (s.key)}
        <a
          href={sourceHref(s.key)}
          aria-current={data.source === s.key ? "page" : undefined}
          class="rounded-full border px-3 py-1 text-xs font-medium {data.source === s.key
            ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
          data-testid="source-{s.key}"
        >
          {s.label} ({countFor(s.key)})
        </a>
      {/each}
    </nav>
  </div>

  <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    {#if data.rows.length === 0 && !data.loadError}
      <div class="p-8 text-center text-sm text-gray-500 dark:text-gray-400" data-testid="empty">
        {#if data.query}
          Nothing in the Glossary matches "{data.query}".
          <a href={clearSearchHref()} class="text-blue-600 hover:underline dark:text-blue-400">Clear the search</a>.
        {:else if data.source === "dynamic"}
          No Dynamic Glossary Items yet — every entry is compiled into the API.
          <a href="/glossary-items/create" class="text-blue-600 hover:underline dark:text-blue-400">Add one</a>.
        {:else if data.source === "overriding"}
          No Dynamic Glossary Item is overriding a static one.
        {:else}
          The Glossary is empty.
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm" data-testid="glossary-table">
          <thead class="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Term</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Description</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Source</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            {#each data.rows as row (row.title)}
              <tr data-testid="row-{row.title}">
                <td class="px-4 py-3 align-top">
                  <a href="/glossary/{encodeURIComponent(row.title)}" class="font-medium text-blue-600 hover:underline dark:text-blue-400">{row.title}</a>
                </td>
                <td class="px-4 py-3 align-top text-gray-700 dark:text-gray-300">
                  {#if row.excerpt}
                    {row.excerpt}
                  {:else}
                    <span class="text-xs italic text-gray-400 dark:text-gray-500">No description text — the entry is an image or is empty.</span>
                  {/if}
                </td>
                <td class="px-4 py-3 align-top">
                  {#if row.is_dynamic}
                    <span class="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" data-testid="dynamic-{row.title}">Dynamic</span>
                    {#if row.overrides_static_item}
                      <span class="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" data-testid="overriding-{row.title}">Overrides static</span>
                    {/if}
                  {:else}
                    <span class="text-xs text-gray-500 dark:text-gray-400">Static</span>
                  {/if}
                </td>
                <td class="px-4 py-3 align-top">
                  {#if row.is_dynamic}
                    <a href="/glossary-items/{encodeURIComponent(row.title)}" class="text-xs text-blue-600 hover:underline dark:text-blue-400" data-testid="edit-{row.title}">Edit</a>
                  {:else}
                    <a href="/glossary-items/create?title={encodeURIComponent(row.title)}" class="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400" data-testid="override-{row.title}"><Plus size={12} /> Override</a>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        <span data-testid="row-count">
          {data.rows.length} of {data.counts.total} entr{data.counts.total === 1 ? "y" : "ies"}{data.query ? ` matching "${data.query}"` : ""}
        </span>
        <a href="/glossary-items" class="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"><BookOpen size={12} /> Manage Dynamic Glossary Items</a>
      </div>
    {/if}
  </div>
</div>
