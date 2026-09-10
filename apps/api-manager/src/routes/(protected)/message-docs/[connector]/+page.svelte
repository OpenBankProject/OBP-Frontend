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
  import { ExternalLink, RefreshCw, Route, Star } from "@lucide/svelte";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";

  let { data } = $props();

  function connectorHref(name: string): string {
    return data.query ? `/message-docs/${name}?q=${encodeURIComponent(data.query)}` : `/message-docs/${name}`;
  }

  const active = $derived(data.activeConnector);
  /** Connectors this instance actually reaches, so the picker can mark them. */
  const effective = $derived(new Set(active.effective));
  /** Star's fallback and delegates are all "in use", but only one of them is the whole story. */
  const isEffective = (name: string) => effective.has(name);
</script>

<svelte:head>
  <title>Message Docs — {data.connectorLabel} - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Message Docs</h1>
      <p class="mt-1 max-w-3xl text-gray-600 dark:text-gray-400">
        The messages OBP sends to a Core Banking or Payment adapter over a connector, with the example
        outbound message and the response it expects back. Adapter authors build against these.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <a href="?refresh=1" class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700" data-testid="refresh-link">
        <RefreshCw size={16} /> Refresh
      </a>
      <a href={data.explorerConnectorUrl} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700" data-testid="explorer-connector-link">
        API Explorer: {data.connector} <ExternalLink size={12} />
      </a>
    </div>
  </div>

  <div class="mb-4">
    <ApiExplorerEndpoints endpoints={data.endpoints} />
  </div>

  {#if active.prop || active.warnings.length > 0}
    <div class="mb-4 rounded-lg border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-800" data-testid="active-connector">
      {#if active.isStar}
        <p class="flex flex-wrap items-center gap-2 text-gray-900 dark:text-gray-100">
          <Star size={16} class="text-amber-500" />
          <span>This instance runs the <span class="font-mono font-semibold">star</span> connector, so there is no single active connector: each connector method is routed individually.</span>
        </p>
        {#if active.delegates.length > 0}
          <p class="mt-2 text-gray-700 dark:text-gray-300">
            Method Routings send calls to
            {#each active.delegates as d, i (d.name)}<!--
              -->{i > 0 ? ", " : " "}<a href={connectorHref(d.name)} class="font-mono text-blue-600 hover:underline dark:text-blue-400" data-testid="delegate-{d.name}">{d.name}</a> ({d.routings})<!--
            -->{/each}, and anything unrouted falls back to
            <a href={connectorHref("mapped")} class="font-mono text-blue-600 hover:underline dark:text-blue-400">mapped</a>, the local database.
          </p>
        {:else if active.warnings.length === 0}
          <p class="mt-2 text-gray-700 dark:text-gray-300">
            No Method Routings are set, so every method falls back to
            <a href={connectorHref("mapped")} class="font-mono text-blue-600 hover:underline dark:text-blue-400">mapped</a>, the local database — no adapter is being called.
          </p>
        {/if}
        <a href="/integration/method-routings" class="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400" data-testid="method-routings-link">
          <Route size={12} /> Method Routings
        </a>
      {:else if active.prop}
        <p class="flex flex-wrap items-center gap-2 text-gray-900 dark:text-gray-100">
          <span>Active connector on this instance:</span>
          <a href={connectorHref(active.prop)} class="font-mono font-semibold text-blue-600 hover:underline dark:text-blue-400" data-testid="active-connector-name">{active.prop}</a>
        </p>
      {/if}
      {#if active.warnings.length > 0}
        <ul class="mt-2 list-disc pl-5 text-xs text-amber-800 dark:text-amber-200" data-testid="active-connector-warnings">
          {#each active.warnings as w}<li>{w}</li>{/each}
        </ul>
      {/if}
    </div>
  {/if}

  <nav class="mb-4 flex flex-wrap gap-2" aria-label="Connector" data-testid="connector-picker">
    {#each data.connectors as c (c.name)}
      <a
        href={connectorHref(c.name)}
        aria-current={data.connector === c.name ? "page" : undefined}
        class="rounded-full border px-3 py-1 text-xs font-medium {data.connector === c.name
          ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
        data-testid="connector-{c.name}"
      >
        {c.label}
        {#if isEffective(c.name)}
          <span class="ml-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase text-green-800 dark:bg-green-900/50 dark:text-green-200" data-testid="in-use-{c.name}">in use</span>
        {/if}
      </a>
    {/each}
  </nav>

  {#if data.loadError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="load-error">{data.loadError}</div>
  {/if}

  {#if data.duplicateProcesses.length > 0}
    <div class="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100" data-testid="duplicate-processes">
      This connector documents {data.duplicateProcesses.length} process{data.duplicateProcesses.length === 1 ? "" : "es"} more than once, so only the first copy of each is listed:
      <span class="font-mono">{data.duplicateProcesses.join(", ")}</span>.
    </div>
  {/if}

  <form method="GET" action="/message-docs/{data.connector}" class="mb-4 flex flex-wrap items-end gap-3" data-testid="search-form">
    <div>
      <label for="message-docs-search" class="block text-xs font-medium text-gray-600 dark:text-gray-400">Search process and description</label>
      <input
        id="message-docs-search"
        name="q"
        type="search"
        value={data.query}
        placeholder="e.g. account, challenge, transaction"
        class="mt-1 w-80 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        data-testid="search-input"
      />
    </div>
    <button type="submit" class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Search</button>
    {#if data.query}
      <a href="/message-docs/{data.connector}" class="text-sm text-blue-600 hover:underline dark:text-blue-400" data-testid="clear-search">Clear</a>
    {/if}
  </form>

  <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    {#if data.rows.length === 0 && !data.loadError}
      <div class="p-8 text-center text-sm text-gray-500 dark:text-gray-400" data-testid="empty">
        {#if data.query}
          No message in <span class="font-mono">{data.connector}</span> matches "{data.query}".
          <a href="/message-docs/{data.connector}" class="text-blue-600 hover:underline dark:text-blue-400">Clear the search</a>.
        {:else}
          <span class="font-mono">{data.connector}</span> publishes no message docs on this instance. Connectors that talk to
          an external adapter do; local and chain connectors generally do not. Pick another connector above.
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm" data-testid="message-docs-table">
          <thead class="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">#</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Process</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Description</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Format</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Notes</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            {#each data.rows as row (row.process)}
              <tr data-testid="row-{row.process}">
                <td class="px-4 py-3 align-top text-xs text-gray-500 dark:text-gray-400">{row.suggested_order ?? ""}</td>
                <td class="px-4 py-3 align-top">
                  <a href="/message-docs/{data.connector}/{encodeURIComponent(row.process)}" class="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400">{row.process}</a>
                </td>
                <td class="px-4 py-3 align-top text-gray-700 dark:text-gray-300">{row.description}</td>
                <td class="px-4 py-3 align-top text-xs text-gray-600 dark:text-gray-400">{row.message_format}</td>
                <td class="px-4 py-3 align-top text-xs text-gray-600 dark:text-gray-400">
                  {#if row.required_field_count > 0}
                    <span class="rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-700">{row.required_field_count} required field{row.required_field_count === 1 ? "" : "s"}</span>
                  {/if}
                  {#if row.dependent_endpoint_count > 0}
                    <span class="rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-700">{row.dependent_endpoint_count} dependent endpoint{row.dependent_endpoint_count === 1 ? "" : "s"}</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400" data-testid="row-count">
        {data.rows.length} of {data.total} message{data.total === 1 ? "" : "s"}{data.query ? ` matching "${data.query}"` : ""} for {data.connector}. The # column is the order the connector suggests implementing them in.
      </div>
    {/if}
  </div>
</div>
