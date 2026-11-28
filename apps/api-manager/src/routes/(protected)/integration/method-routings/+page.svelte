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
  import { fetchMethodRoutings as loadRoutings, isDefaultRouting, type FetchDebug, type MethodRouting } from "$lib/services/methodRoutings";

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

  // Debug panel: what the last load did, step by step, and whether the table failed to render.
  type LoadDebug = FetchDebug & {
    phase: "idle" | "requesting" | "received" | "failed";
    startedAt?: number;
    rows?: number;
    duplicateKeys: string[];
    error?: string;
    renderError?: string;
  };
  let debug = $state<LoadDebug>({ phase: "idle", duplicateKeys: [] });
  let now = $state(Date.now());

  // OBP sends defaults with method_routing_id "" (not absent), so key on isDefaultRouting, not ??.
  const rowKey = (r: MethodRouting) => (isDefaultRouting(r) ? `default:${r.method_name}` : `id:${r.method_routing_id}`);

  function duplicateRowKeys(rows: MethodRouting[]): string[] {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const r of rows) {
      const key = rowKey(r);
      if (seen.has(key)) dupes.add(key);
      seen.add(key);
    }
    return [...dupes];
  }

  async function fetchMethodRoutings() {
    const wire: FetchDebug = {};
    debug = { phase: "requesting", startedAt: Date.now(), duplicateKeys: [] };
    try {
      isLoading = true;
      error = null;
      const rows = await loadRoutings(viewMode === "active", wire);
      debug = { ...debug, ...wire, phase: "received", rows: rows.length, duplicateKeys: duplicateRowKeys(rows) };
      methodRoutings = rows;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch method routings";
      debug = { ...debug, ...wire, phase: "failed", error };
      console.error("Error fetching method routings:", err);
    } finally {
      isLoading = false;
    }
  }

  // Tick while a request is outstanding so the panel shows how long it has been waiting.
  $effect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => (now = Date.now()), 500);
    return () => clearInterval(timer);
  });

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
      <h1 class="flex items-center gap-2 text-3xl font-bold ui-text">
        <Route size={28} /> Method Routings
      </h1>
      <p class="mt-1 ui-muted">
        Which connector serves each connector method, for which banks. Custom routings override the defaults.
      </p>
    </div>
    <div class="flex items-center gap-2">
      {#if glossaryUrl}
        <a
          href={glossaryUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border"
          data-testid="method-routings-glossary-link"
        >
          Glossary <ExternalLink size={14} />
        </a>
      {/if}
      <a
        href="/integration/method-routings/create"
        class="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium preset-filled-primary-500"
        data-testid="create-method-routing"
      >
        <Plus size={16} /> Create Method Routing
      </a>
    </div>
  </div>

  {#if error}
    <div class="mb-6 flex items-start justify-between gap-4 rounded-lg border p-4 text-sm ui-tone-error" role="alert" data-testid="method-routings-error">
      <span><strong>Error:</strong> {error}</span>
      <button type="button" onclick={clearMessages} class="text-lg leading-none" aria-label="Dismiss">×</button>
    </div>
  {/if}
  {#if successMessage}
    <div class="mb-6 flex items-start justify-between gap-4 rounded-lg border p-4 text-sm ui-tone-success" role="status" data-testid="method-routings-success">
      <span>{successMessage}</span>
      <button type="button" onclick={clearMessages} class="text-lg leading-none" aria-label="Dismiss">×</button>
    </div>
  {/if}

  <div class="overflow-hidden rounded-lg border shadow-sm ui-card ui-border">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ui-border">
      <div class="inline-flex rounded-lg border p-0.5 ui-border" role="group" aria-label="Which routings to show">
        <button
          type="button"
          onclick={() => switchViewMode("active")}
          disabled={isLoading}
          class="rounded-md px-3 py-1.5 text-sm font-medium transition {viewMode === 'active' ? 'preset-filled-primary-500' : 'ui-hover ui-muted'}"
          aria-pressed={viewMode === "active"}
          data-testid="view-active"
        >
          Active
        </button>
        <button
          type="button"
          onclick={() => switchViewMode("configured")}
          disabled={isLoading}
          class="rounded-md px-3 py-1.5 text-sm font-medium transition {viewMode === 'configured' ? 'preset-filled-primary-500' : 'ui-hover ui-muted'}"
          aria-pressed={viewMode === "configured"}
          data-testid="view-configured"
        >
          Configured
        </button>
      </div>
      <div class="flex items-center gap-2">
        <label class="relative">
          <Search size={14} class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 ui-muted" />
          <input
            type="search"
            bind:value={filter}
            placeholder="Filter by method, connector or bank"
            spellcheck="false"
            class="w-64 rounded-lg border py-1.5 pr-3 pl-8 text-sm focus:ring-2 ui-card ui-text ui-border"
            data-testid="method-routings-filter"
          />
        </label>
        <button
          type="button"
          onclick={fetchMethodRoutings}
          disabled={isLoading}
          class="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 ui-hover ui-muted ui-border"
          data-testid="method-routings-refresh"
        >
          <RefreshCw size={14} class={isLoading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>
    </div>

    <svelte:boundary onerror={(e) => (debug.renderError = e instanceof Error ? e.message : String(e))}>
    {#if isLoading && methodRoutings.length === 0}
      <div class="flex items-center justify-center gap-3 p-12 text-sm ui-muted">
        <div class="h-6 w-6 animate-spin rounded-full border-4 border-t-transparent border-current ui-text-brand"></div>
        Loading method routings...
      </div>
    {:else if methodRoutings.length === 0}
      <div class="p-12 text-center text-sm ui-muted" data-testid="method-routings-empty">
        No method routings found.
        <a href="/integration/method-routings/create" class="hover:underline ui-link">Create your first method routing</a>.
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm" data-testid="method-routings-table">
          <thead class="ui-card">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Method</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Connector</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Bank ID pattern</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Match</th>
              {#if viewMode === "active"}
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Source</th>
              {/if}
              <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ui-muted">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y ui-border">
            {#each visibleRoutings as routing (rowKey(routing))}
              {@const isDefault = isDefaultRouting(routing)}
              <tr class={isDefault ? "ui-muted" : ""} data-state={isDefault ? "default" : "custom"}>
                <td class="px-4 py-3 font-mono text-xs {isDefault ? '' : 'font-semibold ui-text'}">{routing.method_name}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium {routing.connector_name === 'mapped' ? 'ui-panel ui-muted' : 'ui-tone-accent'}">
                    {routing.connector_name}
                  </span>
                </td>
                <td class="px-4 py-3 font-mono text-xs">{routing.bank_id_pattern || "—"}</td>
                <td class="px-4 py-3 text-xs">
                  {#if routing.is_bank_id_exact_match}
                    <span class="rounded-full px-2 py-0.5 font-medium ui-tone-success">exact</span>
                  {:else}
                    <span class="rounded-full px-2 py-0.5 ui-panel ui-muted">regex</span>
                  {/if}
                </td>
                {#if viewMode === "active"}
                  <td class="px-4 py-3 text-xs">
                    {#if isDefault}
                      <span class="rounded-full px-2 py-0.5 ui-panel ui-muted">default</span>
                    {:else}
                      <span class="rounded-full px-2 py-0.5 font-medium ui-tone-info">custom</span>
                    {/if}
                  </td>
                {/if}
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    {#if isDefault}
                      <a
                        href="/integration/method-routings/create?method={encodeURIComponent(routing.method_name)}"
                        class="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ui-hover ui-muted ui-border"
                        data-testid="override-{routing.method_name}"
                      >
                        <ArrowUpRight size={12} /> Override
                      </a>
                    {:else}
                      <a
                        href="/integration/method-routings/{routing.method_routing_id}"
                        class="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ui-hover ui-muted ui-border"
                        data-testid="edit-{routing.method_name}"
                      >
                        <Pencil size={12} /> Edit
                      </a>
                      <a
                        href="/integration/method-routings/create?from={routing.method_routing_id}"
                        class="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ui-hover ui-muted ui-border"
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
                <td colspan={viewMode === "active" ? 6 : 5} class="px-4 py-8 text-center text-sm ui-muted" data-testid="method-routings-no-match">
                  Nothing matches "{filter.trim()}".
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="border-t px-4 py-2 text-xs ui-muted ui-border" data-testid="method-routings-footer">
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
    {#snippet failed(renderError, reset)}
      <div class="p-6 text-sm ui-text-error" role="alert" data-testid="method-routings-render-error">
        <p><strong>The table failed to render:</strong> {renderError instanceof Error ? renderError.message : String(renderError)}</p>
        <button type="button" onclick={reset} class="mt-2 rounded border px-2 py-1 text-xs ui-tone-error">Try again</button>
      </div>
    {/snippet}
    </svelte:boundary>
  </div>

  <details
    class="mt-6 rounded-lg border text-xs ui-card ui-border"
    open={debug.phase === "failed" || !!debug.renderError || debug.duplicateKeys.length > 0}
    data-testid="method-routings-debug"
    data-state={debug.phase}
  >
    <summary class="cursor-pointer px-4 py-2 font-medium ui-muted">Debug</summary>
    <dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 border-t px-4 py-3 font-mono ui-muted ui-border">
      <dt>phase</dt>
      <dd data-testid="debug-phase">
        {debug.phase}{#if debug.phase === "requesting" && debug.startedAt}&nbsp;(waiting {Math.max(0, Math.round((now - debug.startedAt) / 1000))}s){/if}
      </dd>
      <dt>view</dt>
      <dd>{viewMode}</dd>
      <dt>started</dt>
      <dd>{debug.startedAt ? new Date(debug.startedAt).toISOString() : "—"}</dd>
      <dt>request</dt>
      <dd>{debug.url ?? "—"}</dd>
      <dt>http status</dt>
      <dd data-testid="debug-status">{debug.status ?? "—"}</dd>
      <dt>response</dt>
      <dd>{debug.bytes !== undefined ? `${debug.bytes.toLocaleString()} chars in ${debug.ms} ms` : "—"}</dd>
      <dt>rows</dt>
      <dd data-testid="debug-rows">{debug.rows ?? "—"} (custom {customCount}, default {defaultCount}, shown {visibleRoutings.length})</dd>
      <dt>duplicate row keys</dt>
      <dd data-testid="debug-duplicate-keys">{debug.duplicateKeys.length === 0 ? "none" : debug.duplicateKeys.join(", ")}</dd>
      <dt>error</dt>
      <dd data-testid="debug-error">{debug.error ?? "—"}</dd>
      <dt>render error</dt>
      <dd data-testid="debug-render-error">{debug.renderError ?? "—"}</dd>
    </dl>
  </details>
</div>
