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
  import { ExternalLink, Plus, BookOpen } from "@lucide/svelte";
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
      <h1 class="text-3xl font-bold ui-text">Glossary</h1>
      <p class="mt-1 max-w-3xl ui-muted">
        The Glossary as consumers see it: the terms compiled into the API unioned with the
        <a href="/glossary-items" class="hover:underline ui-link">Dynamic Glossary Items</a>
        maintained here. Each entry reports where it came from.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <a href="{data.explorerUrl}/glossary" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border">
        API Explorer <ExternalLink size={12} />
      </a>
    </div>
  </div>

  <div class="mb-4">
    <ApiExplorerEndpoints endpoints={data.endpoints} />
  </div>

  {#if data.loadError}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error" data-testid="load-error">{data.loadError}</div>
  {/if}

  {#if data.duplicateTitles.length > 0}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-warning" data-testid="duplicate-titles">
      OBP serves {data.duplicateTitles.length} title{data.duplicateTitles.length === 1 ? "" : "s"} more than once, so only the first copy of each is listed here:
      <span class="font-mono">{data.duplicateTitles.join(", ")}</span>. Two static Glossary Items declared in different places can collide like this.
    </div>
  {/if}

  <div class="mb-4 grid gap-3 sm:grid-cols-4" data-testid="glossary-counts">
    <div class="rounded-lg border p-4 ui-card ui-border">
      <div class="text-2xl font-semibold ui-text">{data.counts.total}</div>
      <div class="text-xs uppercase tracking-wide ui-muted">Entries</div>
    </div>
    <div class="rounded-lg border p-4 ui-card ui-border">
      <div class="text-2xl font-semibold ui-text">{data.counts.static}</div>
      <div class="text-xs uppercase tracking-wide ui-muted">Static</div>
    </div>
    <div class="rounded-lg border p-4 ui-card ui-border">
      <div class="text-2xl font-semibold ui-text">{data.counts.dynamic}</div>
      <div class="text-xs uppercase tracking-wide ui-muted">Dynamic</div>
    </div>
    <div class="rounded-lg border p-4 ui-card ui-border">
      <div class="text-2xl font-semibold ui-text">{data.counts.overriding}</div>
      <div class="text-xs uppercase tracking-wide ui-muted">Overriding a static item</div>
    </div>
  </div>

  <div class="mb-4 flex flex-wrap items-end justify-between gap-4">
    <form method="GET" action="/glossary" class="flex flex-wrap items-end gap-3" data-testid="search-form">
      <input type="hidden" name="source" value={data.source} />
      <div>
        <label for="glossary-search" class="block text-xs font-medium ui-muted">Search titles and descriptions</label>
        <input
          id="glossary-search"
          name="q"
          type="search"
          value={data.query}
          placeholder="e.g. consent, view, counterparty"
          class="mt-1 w-80 rounded-lg border px-3 py-2 text-sm focus:ring-2 ui-card ui-text ui-border"
          data-testid="search-input"
        />
      </div>
      <button type="submit" class="rounded-lg border px-3 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border">Search</button>
      {#if data.query}
        <a href={clearSearchHref()} class="text-sm hover:underline ui-link" data-testid="clear-search">Clear</a>
      {/if}
    </form>

    <nav class="flex flex-wrap gap-2" aria-label="Filter by source" data-testid="source-filters">
      {#each SOURCES as s (s.key)}
        <a
          href={sourceHref(s.key)}
          aria-current={data.source === s.key ? "page" : undefined}
          class="rounded-full border px-3 py-1 text-xs font-medium {data.source === s.key
            ? 'preset-filled-primary-500'
            : 'ui-card ui-hover ui-muted ui-border'}"
          data-testid="source-{s.key}"
        >
          {s.label} ({countFor(s.key)})
        </a>
      {/each}
    </nav>
  </div>

  <div class="overflow-hidden rounded-lg border shadow-sm ui-card ui-border">
    {#if data.rows.length === 0 && !data.loadError}
      <div class="p-8 text-center text-sm ui-muted" data-testid="empty">
        {#if data.query}
          Nothing in the Glossary matches "{data.query}".
          <a href={clearSearchHref()} class="hover:underline ui-link">Clear the search</a>.
        {:else if data.source === "dynamic"}
          No Dynamic Glossary Items yet — every entry is compiled into the API.
          <a href="/glossary-items/create" class="hover:underline ui-link">Add one</a>.
        {:else if data.source === "overriding"}
          No Dynamic Glossary Item is overriding a static one.
        {:else}
          The Glossary is empty.
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm" data-testid="glossary-table">
          <thead class="ui-card">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Term</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Description</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Source</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y ui-border">
            {#each data.rows as row (row.title)}
              <tr data-testid="row-{row.title}">
                <td class="px-4 py-3 align-top">
                  <a href="/glossary/{encodeURIComponent(row.title)}" class="font-medium hover:underline ui-link">{row.title}</a>
                </td>
                <td class="px-4 py-3 align-top ui-muted">
                  {#if row.excerpt}
                    {row.excerpt}
                  {:else}
                    <span class="text-xs italic ui-muted">No description text — the entry is an image or is empty.</span>
                  {/if}
                </td>
                <td class="px-4 py-3 align-top">
                  {#if row.is_dynamic}
                    <span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium ui-tone-info" data-testid="dynamic-{row.title}">Dynamic</span>
                    {#if row.overrides_static_item}
                      <span class="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ui-tone-warning" data-testid="overriding-{row.title}">Overrides static</span>
                    {/if}
                  {:else}
                    <span class="text-xs ui-muted">Static</span>
                  {/if}
                </td>
                <td class="px-4 py-3 align-top">
                  {#if row.is_dynamic}
                    <a href="/glossary-items/{encodeURIComponent(row.title)}" class="text-xs hover:underline ui-link" data-testid="edit-{row.title}">Edit</a>
                  {:else}
                    <a href="/glossary-items/create?title={encodeURIComponent(row.title)}" class="inline-flex items-center gap-1 text-xs hover:underline ui-link" data-testid="override-{row.title}"><Plus size={12} /> Override</a>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2 text-xs ui-muted ui-border">
        <span data-testid="row-count">
          {data.rows.length} of {data.counts.total} entr{data.counts.total === 1 ? "y" : "ies"}{data.query ? ` matching "${data.query}"` : ""}
        </span>
        <a href="/glossary-items" class="inline-flex items-center gap-1 hover:underline ui-link"><BookOpen size={12} /> Manage Dynamic Glossary Items</a>
      </div>
    {/if}
  </div>
</div>
