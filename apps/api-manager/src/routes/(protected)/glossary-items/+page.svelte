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
  import { page } from "$app/state";
  import { invalidateAll } from "$app/navigation";
  import { CircleHelp, Plus, Trash2, Pencil, ExternalLink } from "@lucide/svelte";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";
  import { deleteGlossaryItem, isUndeclaredShadow } from "$lib/services/glossaryItems";

  let { data } = $props();

  const savedTitle = page.url.searchParams.get("saved");
  let message = $state<string | null>(savedTitle ? `Saved "${savedTitle}".` : null);
  let actionError = $state<string | null>(null);
  let deleting = $state<string | null>(null);

  let firstShown = $derived(data.rows.length === 0 ? 0 : data.pagination.offset + 1);
  let lastShown = $derived(data.pagination.offset + data.rows.length);
  let prevOffset = $derived(Math.max(0, data.pagination.offset - data.pageSize));
  let nextOffset = $derived(data.pagination.offset + data.pageSize);
  let hasPrev = $derived(data.pagination.offset > 0);
  let hasNext = $derived(lastShown < data.pagination.total);

  function pageHref(offset: number): string {
    const params = new URLSearchParams();
    if (data.titleFilter) params.set("title", data.titleFilter);
    if (offset > 0) params.set("offset", String(offset));
    const qs = params.toString();
    return qs ? `/glossary-items?${qs}` : "/glossary-items";
  }

  /** First line of the markdown, so the table shows what the entry says without the whole body. */
  function firstLine(markdown: string): string {
    const line = markdown.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
    return line.length > 160 ? line.slice(0, 160) + "…" : line;
  }

  function formatDate(value: string): string {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
  }

  async function remove(title: string, shadowsStatic: boolean) {
    const consequence = shadowsStatic
      ? " The static Glossary Item of the same title will be served again."
      : " It will disappear from the Glossary.";
    if (!confirm(`Delete the Dynamic Glossary Item "${title}"?${consequence}`)) return;
    deleting = title;
    actionError = null;
    try {
      await deleteGlossaryItem(title);
      message = `Deleted "${title}".`;
      await invalidateAll();
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      deleting = null;
    }
  }
</script>

<svelte:head>
  <title>Dynamic Glossary Items - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Dynamic Glossary Items</h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        Glossary entries held in the database and editable at runtime. They are served alongside the static ones, and replace a static entry of the same title.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <a href="{data.explorerUrl}/glossary" target="_blank" rel="noopener noreferrer" data-testid="explorer-glossary-link" class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
        API Explorer <ExternalLink size={12} />
      </a>
      <a href="/glossary-items/help" data-testid="glossary-items-help-link" class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
        <CircleHelp size={16} /> Help
      </a>
      <a href="/glossary-items/create" data-testid="create-link" class="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
        <Plus size={16} /> Create Glossary Item
      </a>
    </div>
  </div>

  <div class="mb-4">
    <ApiExplorerEndpoints endpoints={data.endpoints} />
  </div>

  {#if data.loadError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="load-error">{data.loadError}</div>
  {/if}
  {#if actionError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="action-error">{actionError}</div>
  {/if}
  {#if message}
    <div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300" role="status" data-testid="message">{message}</div>
  {/if}

  <form method="GET" action="/glossary-items" class="mb-4 flex flex-wrap items-end gap-3" data-testid="filter-form">
    <div>
      <label for="title-filter" class="block text-xs font-medium text-gray-600 dark:text-gray-400">Filter by title</label>
      <input
        id="title-filter"
        name="title"
        type="search"
        value={data.titleFilter}
        placeholder="Part of a title, e.g. bank"
        class="mt-1 w-72 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        data-testid="title-filter"
      />
    </div>
    <button type="submit" class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Filter</button>
    {#if data.titleFilter}
      <a href="/glossary-items" class="text-sm text-blue-600 hover:underline dark:text-blue-400">Clear</a>
    {/if}
  </form>

  <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    {#if data.rows.length === 0}
      <div class="p-8 text-center text-sm text-gray-500 dark:text-gray-400" data-testid="empty">
        {#if data.titleFilter}
          No Dynamic Glossary Item title contains "{data.titleFilter}".
          <a href="/glossary-items" class="text-blue-600 hover:underline dark:text-blue-400">Show all</a>.
        {:else}
          No Dynamic Glossary Items yet. The Glossary is being served from the static entries alone.
          <a href="/glossary-items/create" class="text-blue-600 hover:underline dark:text-blue-400">Create one</a> to add or correct a term.
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm" data-testid="glossary-items-table">
          <thead class="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Title</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Description</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Overrides static</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">In the Glossary</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Updated</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            {#each data.rows as row (row.glossary_item_id)}
              <tr data-testid="row-{row.title}">
                <td class="px-4 py-3 font-mono text-xs text-gray-900 dark:text-gray-100">
                  <a href="/glossary-items/{encodeURIComponent(row.title)}" class="text-blue-600 hover:underline dark:text-blue-400">{row.title}</a>
                </td>
                <td class="px-4 py-3 text-gray-700 dark:text-gray-300">{firstLine(row.description.markdown)}</td>
                <td class="px-4 py-3">
                  {#if isUndeclaredShadow(row)}
                    <span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200" data-testid="undeclared-{row.title}">Undeclared</span>
                    <div class="mt-1 text-xs text-red-700 dark:text-red-300">Shadowing a static item it never declared</div>
                  {:else if row.overrides_static_item}
                    <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" data-testid="overrides-{row.title}">Yes</span>
                  {:else}
                    <span class="text-xs text-gray-500 dark:text-gray-400">No</span>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  <a href="/glossary/{encodeURIComponent(row.title)}" class="text-xs text-blue-600 hover:underline dark:text-blue-400" data-testid="view-{row.title}">View entry</a>
                </td>
                <td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{formatDate(row.updated_at)}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <a href="/glossary-items/{encodeURIComponent(row.title)}" class="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" data-testid="edit-{row.title}"><Pencil size={12} /> Edit</a>
                    <a href={row.explorerUrl} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" data-testid="explorer-{row.title}">API Explorer <ExternalLink size={12} /></a>
                    <button type="button" onclick={() => remove(row.title, row.shadows_static_glossary_item)} disabled={deleting === row.title} class="inline-flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20" data-testid="delete-{row.title}">
                      <Trash2 size={12} /> {deleting === row.title ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        <span data-testid="pagination-summary">Showing {firstShown}–{lastShown} of {data.pagination.total}</span>
        {#if hasPrev || hasNext}
          <span class="flex gap-3">
            {#if hasPrev}<a href={pageHref(prevOffset)} class="text-blue-600 hover:underline dark:text-blue-400" data-testid="prev-page">← Previous</a>{/if}
            {#if hasNext}<a href={pageHref(nextOffset)} class="text-blue-600 hover:underline dark:text-blue-400" data-testid="next-page">Next →</a>{/if}
          </span>
        {/if}
      </div>
    {/if}
  </div>
</div>
