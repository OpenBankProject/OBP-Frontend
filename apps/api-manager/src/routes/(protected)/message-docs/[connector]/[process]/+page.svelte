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
    <a href="/message-docs/{data.connector}" class="text-blue-600 hover:underline dark:text-blue-400">Message Docs</a>
    <span class="mx-2 text-gray-400">/</span>
    <a href="/message-docs/{data.connector}" class="text-blue-600 hover:underline dark:text-blue-400">{data.connector}</a>
    <span class="mx-2 text-gray-400">/</span>
    <span class="text-gray-500 dark:text-gray-400">{data.doc.process}</span>
  </nav>

  <div class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div class="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 p-6 dark:border-gray-700">
      <div>
        <h1 class="font-mono text-2xl font-bold text-gray-900 dark:text-gray-100">{data.doc.process}</h1>
        <p class="mt-1 text-gray-600 dark:text-gray-400">{data.doc.description}</p>
        <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-300">Connector: {data.connectorLabel}</span>
          {#if data.doc.message_format}
            <span class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-300">Format: {data.doc.message_format}</span>
          {/if}
          {#if data.group}
            <span class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-300">Group: {data.group}</span>
          {/if}
          {#if data.doc.adapter_implementation?.suggested_order != null}
            <span class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-300">Suggested order: {data.doc.adapter_implementation.suggested_order}</span>
          {/if}
        </div>
      </div>
      <a href={data.explorerProcessUrl} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700" data-testid="explorer-process-link">
        API Explorer <ExternalLink size={12} />
      </a>
    </div>

    <div class="space-y-8 p-6">
      <div><ApiExplorerEndpoints endpoints={data.endpoints} /></div>

      <section>
        <h2 class="mb-2 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <ArrowUpRight size={18} class="text-blue-600 dark:text-blue-400" /> Outbound message
        </h2>
        <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">What OBP sends to the adapter.</p>
        <pre class="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200" data-testid="outbound-message">{asJson(data.doc.example_outbound_message)}</pre>
      </section>

      <section>
        <h2 class="mb-2 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <ArrowDownLeft size={18} class="text-green-600 dark:text-green-400" /> Inbound message
        </h2>
        <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">What the adapter is expected to send back.</p>
        <pre class="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200" data-testid="inbound-message">{asJson(data.doc.example_inbound_message)}</pre>
      </section>

      {#if requiredFields.length > 0}
        <section>
          <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Required fields</h2>
          <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">Fields the adapter must populate, and the API versions that need them.</p>
          <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="w-full text-sm" data-testid="required-fields">
              <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
                <tr><th class="px-4 py-2">Field</th><th class="px-4 py-2">Applies to</th></tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                {#each requiredFields as [field, applies] (field)}
                  <tr>
                    <td class="px-4 py-2 font-mono text-xs">{field}</td>
                    <td class="px-4 py-2 text-xs text-gray-700 dark:text-gray-300">{Array.isArray(applies) ? applies.join(", ") : String(applies)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      {/if}

      {#if dependents.length > 0}
        <section>
          <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Dependent endpoints</h2>
          <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">OBP endpoints that need this message, so an adapter that does not implement it breaks them.</p>
          <ul class="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300" data-testid="dependent-endpoints">
            {#each dependents as dep, i (i)}
              <li class="font-mono text-xs">{dependentLabel(dep)}</li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
  </div>
</div>
