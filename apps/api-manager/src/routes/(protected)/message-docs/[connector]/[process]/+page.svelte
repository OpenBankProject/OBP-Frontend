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
  import { ExternalLink, ArrowUpRight, ArrowDownLeft } from "@lucide/svelte";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";

  let { data } = $props();

  /** Pretty JSON, left as text so it can be selected and copied as-is. */
  function asJson(value: unknown): string {
    if (value == null) return "";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  const requiredFields = $derived(Object.entries(data.doc.requiredFieldInfo ?? {}));
  const dependents = $derived(Array.isArray(data.doc.dependent_endpoints) ? data.doc.dependent_endpoints : []);

  /** dependent_endpoints has no fixed shape across connectors, so render whatever is there. */
  function dependentLabel(value: unknown): string {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const v = value as Record<string, unknown>;
      const parts = [v.version, v.verb, v.url ?? v.name ?? v.path].filter(Boolean);
      return parts.length > 0 ? parts.join(" ") : JSON.stringify(value);
    }
    return String(value);
  }
</script>

<svelte:head>
  <title>{data.doc.process} — Message Docs - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-8">
  <nav class="mb-6 text-sm" aria-label="Breadcrumb">
    <a href="/message-docs/{data.connector}" class="hover:underline ui-link">Message Docs</a>
    <span class="mx-2 ui-muted">/</span>
    <a href="/message-docs/{data.connector}" class="hover:underline ui-link">{data.connector}</a>
    <span class="mx-2 ui-muted">/</span>
    <span class="ui-muted">{data.doc.process}</span>
  </nav>

  <div class="rounded-lg border shadow-sm ui-card ui-border">
    <div class="flex flex-wrap items-start justify-between gap-4 border-b p-6 ui-border">
      <div>
        <h1 class="font-mono text-2xl font-bold ui-text">{data.doc.process}</h1>
        <p class="mt-1 ui-muted">{data.doc.description}</p>
        <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span class="rounded-full px-2 py-0.5 ui-panel ui-muted">Connector: {data.connectorLabel}</span>
          {#if data.doc.message_format}
            <span class="rounded-full px-2 py-0.5 ui-panel ui-muted">Format: {data.doc.message_format}</span>
          {/if}
          {#if data.group}
            <span class="rounded-full px-2 py-0.5 ui-panel ui-muted">Group: {data.group}</span>
          {/if}
          {#if data.doc.adapter_implementation?.suggested_order != null}
            <span class="rounded-full px-2 py-0.5 ui-panel ui-muted">Suggested order: {data.doc.adapter_implementation.suggested_order}</span>
          {/if}
        </div>
      </div>
      <a href={data.explorerProcessUrl} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border" data-testid="explorer-process-link">
        API Explorer <ExternalLink size={12} />
      </a>
    </div>

    <div class="space-y-8 p-6">
      <div><ApiExplorerEndpoints endpoints={data.endpoints} /></div>

      <section>
        <h2 class="mb-2 flex items-center gap-2 text-lg font-semibold ui-text">
          <ArrowUpRight size={18} class="ui-link" /> Outbound message
        </h2>
        <p class="mb-2 text-xs ui-muted">What OBP sends to the adapter.</p>
        <pre class="overflow-x-auto rounded-lg border p-4 text-xs ui-card ui-text ui-border" data-testid="outbound-message">{asJson(data.doc.example_outbound_message)}</pre>
      </section>

      <section>
        <h2 class="mb-2 flex items-center gap-2 text-lg font-semibold ui-text">
          <ArrowDownLeft size={18} class="ui-text-success" /> Inbound message
        </h2>
        <p class="mb-2 text-xs ui-muted">What the adapter is expected to send back.</p>
        <pre class="overflow-x-auto rounded-lg border p-4 text-xs ui-card ui-text ui-border" data-testid="inbound-message">{asJson(data.doc.example_inbound_message)}</pre>
      </section>

      {#if requiredFields.length > 0}
        <section>
          <h2 class="mb-2 text-lg font-semibold ui-text">Required fields</h2>
          <p class="mb-2 text-xs ui-muted">Fields the adapter must populate, and the API versions that need them.</p>
          <div class="overflow-x-auto rounded-lg border ui-border">
            <table class="w-full text-sm" data-testid="required-fields">
              <thead class="text-left text-xs uppercase ui-card ui-muted">
                <tr><th class="px-4 py-2">Field</th><th class="px-4 py-2">Applies to</th></tr>
              </thead>
              <tbody class="divide-y ui-border">
                {#each requiredFields as [field, applies] (field)}
                  <tr>
                    <td class="px-4 py-2 font-mono text-xs">{field}</td>
                    <td class="px-4 py-2 text-xs ui-muted">{Array.isArray(applies) ? applies.join(", ") : String(applies)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      {/if}

      {#if dependents.length > 0}
        <section>
          <h2 class="mb-2 text-lg font-semibold ui-text">Dependent endpoints</h2>
          <p class="mb-2 text-xs ui-muted">OBP endpoints that need this message, so an adapter that does not implement it breaks them.</p>
          <ul class="list-disc pl-5 text-sm ui-muted" data-testid="dependent-endpoints">
            {#each dependents as dep, i (i)}
              <li class="font-mono text-xs">{dependentLabel(dep)}</li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
  </div>
</div>
