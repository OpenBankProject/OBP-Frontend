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
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { Plus, Route, ExternalLink, Search, RefreshCw, Pencil, Copy, ArrowUpRight } from "@lucide/svelte";
  import { fetchMethodRoutings as loadRoutings, isDefaultRouting, type MethodRouting } from "$lib/services/methodRoutings";

  // Creating, overriding and editing live on their own pages (with Opey beside the form):
  // /integration/method-routings/create[?method=NAME|?from=ID] and /integration/method-routings/ID.
  let methodRoutings = $state<MethodRouting[]>([]);
  let viewMode = $state<"active" | "configured">("active");
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let successMessage = $state<string | null>(null);
  let filter = $state("");

  const apiExplorerUrl = String(page.data.externalLinks?.API_EXPLORER_URL || "")
    .replace(/\/$/, "")
    .replace(/\/?\?.*$/, "");
  const glossaryUrl = apiExplorerUrl ? `${apiExplorerUrl}/glossary#Method%20Routing` : "";

  async function fetchMethodRoutings() {
    try {
      isLoading = true;
      error = null;
      methodRoutings = await loadRoutings(viewMode === "active");
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch method routings";
      console.error("Error fetching method routings:", err);
    } finally {
      isLoading = false;
    }
  }

  function clearMessages() {
    error = null;
    successMessage = null;
  }

  function switchViewMode(mode: "active" | "configured") {
    if (viewMode === mode) return;
    viewMode = mode;
    fetchMethodRoutings();
  }

  // Words separated by spaces must all appear somewhere in the row.
  let visibleRoutings = $derived.by(() => {
    const terms = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return methodRoutings;
    return methodRoutings.filter((r) => {
      const hay = `${r.method_name} ${r.connector_name} ${r.bank_id_pattern ?? ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  });
  let customCount = $derived(methodRoutings.filter((r) => !isDefaultRouting(r)).length);
  let defaultCount = $derived(methodRoutings.length - customCount);

  onMount(() => {
    const saved = page.url.searchParams.get("saved");
    const deleted = page.url.searchParams.get("deleted");
    if (saved) successMessage = `Method routing for ${saved} saved.`;
    if (deleted) successMessage = `Method routing for ${deleted} deleted.`;
    fetchMethodRoutings();
  });
</script>

<svelte:head>
  <title>Method Routings - Integration - API Manager II</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
        <Route size={28} /> Method Routings
      </h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        Which connector serves each connector method, for which banks. Custom routings override the defaults.
      </p>
    </div>
    <div class="flex items-center gap-2">
      {#if glossaryUrl}
        <a
          href={glossaryUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          data-testid="method-routings-glossary-link"
        >
          Glossary <ExternalLink size={14} />
        </a>
      {/if}
      <a
        href="/integration/method-routings/create"
        class="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        data-testid="create-method-routing"
      >
        <Plus size={16} /> Create Method Routing
      </a>
    </div>
  </div>

  {#if error}
    <div class="mb-6 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" role="alert" data-testid="method-routings-error">
      <span><strong>Error:</strong> {error}</span>
      <button type="button" onclick={clearMessages} class="text-lg leading-none" aria-label="Dismiss">×</button>
    </div>
  {/if}
  {#if successMessage}
    <div class="mb-6 flex items-start justify-between gap-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300" role="status" data-testid="method-routings-success">
      <span>{successMessage}</span>
      <button type="button" onclick={clearMessages} class="text-lg leading-none" aria-label="Dismiss">×</button>
    </div>
  {/if}

  <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <div class="inline-flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-600" role="group" aria-label="Which routings to show">
        <button
          type="button"
          onclick={() => switchViewMode("active")}
          disabled={isLoading}
          class="rounded-md px-3 py-1.5 text-sm font-medium transition {viewMode === 'active' ? 'bg-blue-600 text-white dark:bg-blue-500' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}"
          aria-pressed={viewMode === "active"}
          data-testid="view-active"
        >
          Active
        </button>
        <button
          type="button"
          onclick={() => switchViewMode("configured")}
          disabled={isLoading}
          class="rounded-md px-3 py-1.5 text-sm font-medium transition {viewMode === 'configured' ? 'bg-blue-600 text-white dark:bg-blue-500' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}"
          aria-pressed={viewMode === "configured"}
          data-testid="view-configured"
        >
          Configured
        </button>
      </div>
      <div class="flex items-center gap-2">
        <label class="relative">
          <Search size={14} class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            bind:value={filter}
            placeholder="Filter by method, connector or bank"
            spellcheck="false"
            class="w-64 rounded-lg border border-gray-300 bg-white py-1.5 pr-3 pl-8 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            data-testid="method-routings-filter"
          />
        </label>
        <button
          type="button"
          onclick={fetchMethodRoutings}
          disabled={isLoading}
          class="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          data-testid="method-routings-refresh"
        >
          <RefreshCw size={14} class={isLoading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>
    </div>

    {#if isLoading && methodRoutings.length === 0}
      <div class="flex items-center justify-center gap-3 p-12 text-sm text-gray-600 dark:text-gray-300">
        <div class="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        Loading method routings...
      </div>
    {:else if methodRoutings.length === 0}
      <div class="p-12 text-center text-sm text-gray-500 dark:text-gray-400" data-testid="method-routings-empty">
        No method routings found.
        <a href="/integration/method-routings/create" class="text-blue-600 hover:underline dark:text-blue-400">Create your first method routing</a>.
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm" data-testid="method-routings-table">
          <thead class="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Method</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Connector</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Bank ID pattern</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Match</th>
              {#if viewMode === "active"}
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Source</th>
              {/if}
              <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            {#each visibleRoutings as routing (routing.method_routing_id ?? routing.method_name)}
              {@const isDefault = isDefaultRouting(routing)}
              <tr class={isDefault ? "text-gray-600 dark:text-gray-400" : ""} data-state={isDefault ? "default" : "custom"}>
                <td class="px-4 py-3 font-mono text-xs {isDefault ? '' : 'font-semibold text-gray-900 dark:text-gray-100'}">{routing.method_name}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium {routing.connector_name === 'mapped' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' : 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200'}">
                    {routing.connector_name}
                  </span>
                </td>
                <td class="px-4 py-3 font-mono text-xs">{routing.bank_id_pattern || "—"}</td>
                <td class="px-4 py-3 text-xs">
                  {#if routing.is_bank_id_exact_match}
                    <span class="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">exact</span>
                  {:else}
                    <span class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-200">regex</span>
                  {/if}
                </td>
                {#if viewMode === "active"}
                  <td class="px-4 py-3 text-xs">
                    {#if isDefault}
                      <span class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-200">default</span>
                    {:else}
                      <span class="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">custom</span>
                    {/if}
                  </td>
                {/if}
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    {#if isDefault}
                      <a
                        href="/integration/method-routings/create?method={encodeURIComponent(routing.method_name)}"
                        class="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        data-testid="override-{routing.method_name}"
                      >
                        <ArrowUpRight size={12} /> Override
                      </a>
                    {:else}
                      <a
                        href="/integration/method-routings/{routing.method_routing_id}"
                        class="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        data-testid="edit-{routing.method_name}"
                      >
                        <Pencil size={12} /> Edit
                      </a>
                      <a
                        href="/integration/method-routings/create?from={routing.method_routing_id}"
                        class="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        data-testid="duplicate-{routing.method_name}"
                      >
                        <Copy size={12} /> Duplicate
                      </a>
                    {/if}
                  </div>
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan={viewMode === "active" ? 6 : 5} class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400" data-testid="method-routings-no-match">
                  Nothing matches "{filter.trim()}".
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400" data-testid="method-routings-footer">
        {#if filter.trim()}
          {visibleRoutings.length} of {methodRoutings.length} shown.
        {/if}
        {#if viewMode === "active"}
          {methodRoutings.length} active routing{methodRoutings.length === 1 ? "" : "s"}: {customCount} custom, {defaultCount} default.
        {:else}
          {methodRoutings.length} configured routing{methodRoutings.length === 1 ? "" : "s"}.
        {/if}
      </div>
    {/if}
  </div>
</div>
