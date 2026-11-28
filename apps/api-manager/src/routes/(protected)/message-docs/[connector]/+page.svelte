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
  import { ExternalLink, Route, Star } from "@lucide/svelte";
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
      <h1 class="text-3xl font-bold ui-text">Message Docs</h1>
      <p class="mt-1 max-w-3xl ui-muted">
        The messages OBP sends to a Core Banking or Payment adapter over a connector, with the example
        outbound message and the response it expects back. Adapter authors build against these.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <a href={data.explorerConnectorUrl} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border" data-testid="explorer-connector-link">
        API Explorer: {data.connector} <ExternalLink size={12} />
      </a>
    </div>
  </div>

  <div class="mb-4">
    <ApiExplorerEndpoints endpoints={data.endpoints} />
  </div>

  {#if active.prop || active.warnings.length > 0}
    <div class="mb-4 rounded-lg border p-4 text-sm ui-card ui-border" data-testid="active-connector">
      {#if active.isStar}
        <p class="flex flex-wrap items-center gap-2 ui-text">
          <Star size={16} class="ui-text-warning" />
          <span>This instance runs the <span class="font-mono font-semibold">star</span> connector, so there is no single active connector: each connector method is routed individually.</span>
        </p>
        {#if active.delegates.length > 0}
          <p class="mt-2 ui-muted">
            Method Routings send calls to
            {#each active.delegates as d, i (d.name)}<!--
              -->{i > 0 ? ", " : " "}<a href={connectorHref(d.name)} class="font-mono hover:underline ui-link" data-testid="delegate-{d.name}">{d.name}</a> ({d.routings})<!--
            -->{/each}, and anything unrouted falls back to
            <a href={connectorHref("mapped")} class="font-mono hover:underline ui-link">mapped</a>, the local database.
          </p>
        {:else if active.warnings.length === 0}
          <p class="mt-2 ui-muted">
            No Method Routings are set, so every method falls back to
            <a href={connectorHref("mapped")} class="font-mono hover:underline ui-link">mapped</a>, the local database — no adapter is being called.
          </p>
        {/if}
        <a href="/integration/method-routings" class="mt-2 inline-flex items-center gap-1 text-xs hover:underline ui-link" data-testid="method-routings-link">
          <Route size={12} /> Method Routings
        </a>
      {:else if active.prop}
        <p class="flex flex-wrap items-center gap-2 ui-text">
          <span>Active connector on this instance:</span>
          <a href={connectorHref(active.prop)} class="font-mono font-semibold hover:underline ui-link" data-testid="active-connector-name">{active.prop}</a>
        </p>
      {/if}
      {#if active.warnings.length > 0}
        <ul class="mt-2 list-disc pl-5 text-xs ui-text-warning" data-testid="active-connector-warnings">
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
          ? 'preset-filled-primary-500'
          : 'ui-card ui-hover ui-muted ui-border'}"
        data-testid="connector-{c.name}"
      >
        {c.label}
        {#if isEffective(c.name)}
          <span class="ml-1 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase ui-tone-success" data-testid="in-use-{c.name}">in use</span>
        {/if}
      </a>
    {/each}
  </nav>

  {#if data.loadError}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error" data-testid="load-error">{data.loadError}</div>
  {/if}

  {#if data.duplicateProcesses.length > 0}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-warning" data-testid="duplicate-processes">
      This connector documents {data.duplicateProcesses.length} process{data.duplicateProcesses.length === 1 ? "" : "es"} more than once, so only the first copy of each is listed:
      <span class="font-mono">{data.duplicateProcesses.join(", ")}</span>.
    </div>
  {/if}

  <form method="GET" action="/message-docs/{data.connector}" class="mb-4 flex flex-wrap items-end gap-3" data-testid="search-form">
    <div>
      <label for="message-docs-search" class="block text-xs font-medium ui-muted">Search process and description</label>
      <input
        id="message-docs-search"
        name="q"
        type="search"
        value={data.query}
        placeholder="e.g. account, challenge, transaction"
        class="mt-1 w-80 rounded-lg border px-3 py-2 text-sm focus:ring-2 ui-card ui-text ui-border"
        data-testid="search-input"
      />
    </div>
    <button type="submit" class="rounded-lg border px-3 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border">Search</button>
    {#if data.query}
      <a href="/message-docs/{data.connector}" class="text-sm hover:underline ui-link" data-testid="clear-search">Clear</a>
    {/if}
  </form>

  <div class="overflow-hidden rounded-lg border shadow-sm ui-card ui-border">
    {#if data.rows.length === 0 && !data.loadError}
      <div class="p-8 text-center text-sm ui-muted" data-testid="empty">
        {#if data.query}
          No message in <span class="font-mono">{data.connector}</span> matches "{data.query}".
          <a href="/message-docs/{data.connector}" class="hover:underline ui-link">Clear the search</a>.
        {:else}
          <span class="font-mono">{data.connector}</span> publishes no message docs on this instance. Connectors that talk to
          an external adapter do; local and chain connectors generally do not. Pick another connector above.
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm" data-testid="message-docs-table">
          <thead class="ui-card">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">#</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Process</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Description</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Format</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Notes</th>
            </tr>
          </thead>
          <tbody class="divide-y ui-border">
            {#each data.rows as row (row.process)}
              <tr data-testid="row-{row.process}">
                <td class="px-4 py-3 align-top text-xs ui-muted">{row.suggested_order ?? ""}</td>
                <td class="px-4 py-3 align-top">
                  <a href="/message-docs/{data.connector}/{encodeURIComponent(row.process)}" class="font-mono text-xs hover:underline ui-link">{row.process}</a>
                </td>
                <td class="px-4 py-3 align-top ui-muted">{row.description}</td>
                <td class="px-4 py-3 align-top text-xs ui-muted">{row.message_format}</td>
                <td class="px-4 py-3 align-top text-xs ui-muted">
                  {#if row.required_field_count > 0}
                    <span class="rounded-full px-2 py-0.5 ui-panel">{row.required_field_count} required field{row.required_field_count === 1 ? "" : "s"}</span>
                  {/if}
                  {#if row.dependent_endpoint_count > 0}
                    <span class="rounded-full px-2 py-0.5 ui-panel">{row.dependent_endpoint_count} dependent endpoint{row.dependent_endpoint_count === 1 ? "" : "s"}</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="border-t px-4 py-2 text-xs ui-muted ui-border" data-testid="row-count">
        {data.rows.length} of {data.total} message{data.total === 1 ? "" : "s"}{data.query ? ` matching "${data.query}"` : ""} for {data.connector}. The # column is the order the connector suggests implementing them in.
      </div>
    {/if}
  </div>
</div>
