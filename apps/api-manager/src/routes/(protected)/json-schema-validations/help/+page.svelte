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
  import { CircleHelp, ExternalLink, RefreshCw, Braces, Plus } from "@lucide/svelte";
  import GlossaryEntry from "$lib/components/GlossaryEntry.svelte";

  let { data } = $props();
</script>

<svelte:head>
  <title>JSON Schema Validation Help - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-8">
  <nav class="mb-6 text-sm" aria-label="Breadcrumb">
    <a href="/json-schema-validations" class="text-blue-600 hover:underline dark:text-blue-400">JSON Schema Validations</a>
    <span class="mx-2 text-gray-400">/</span>
    <span class="text-gray-500 dark:text-gray-400">Help</span>
  </nav>

  <div class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div class="flex items-start gap-4 border-b border-gray-200 p-6 dark:border-gray-700">
      <CircleHelp size={32} class="shrink-0 text-blue-600 dark:text-blue-400" />
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">JSON Schema Validation Help</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">From the OBP glossary, with this instance's endpoints.</p>
      </div>
    </div>

    <div class="space-y-8 p-6">
      {#if data.warnings.length > 0}
        <div class="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100" data-testid="help-warnings">
          <ul class="list-disc pl-5">{#each data.warnings as w}<li>{w}</li>{/each}</ul>
          <a class="mt-2 inline-flex items-center gap-1 underline" href="?refresh=1"><RefreshCw size={12} /> Refresh from OBP</a>
        </div>
      {/if}

      <section id="glossary">
        <h2 class="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{data.glossary.title}</h2>
        <GlossaryEntry title={data.glossary.title} html={data.glossary.html} explorerUrl={data.glossary.explorerUrl} testid="glossary-json-schema-validation" />
      </section>

      <section id="endpoints">
        <h2 class="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Endpoints</h2>
        <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">Resource docs tagged <code>{data.tag}</code> on this instance.</p>
        {#if data.endpoints.length > 0}
          <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="w-full text-sm" data-testid="json-schema-validation-endpoints">
              <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
                <tr><th class="px-4 py-2">Verb</th><th class="px-4 py-2">Path</th><th class="px-4 py-2">Summary</th><th class="px-4 py-2">Roles</th></tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                {#each data.endpoints as e (e.operation_id)}
                  <tr>
                    <td class="px-4 py-2 font-mono text-xs">{e.request_verb}</td>
                    <td class="px-4 py-2 font-mono text-xs"><a class="text-blue-600 hover:underline dark:text-blue-400" href={e.explorerUrl} target="_blank" rel="noopener noreferrer">{e.request_url}</a></td>
                    <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{e.summary}</td>
                    <td class="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{e.roles.join(", ") || "none"}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="text-sm text-gray-500 dark:text-gray-400">None found.</p>
        {/if}
      </section>

      <div class="flex flex-wrap gap-3">
        <a class="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700" href="/json-schema-validations"><Braces size={16} /> JSON Schema Validations</a>
        <a class="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700" href="/json-schema-validations/create"><Plus size={16} /> Create</a>
        <a class="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700" href="{data.explorerUrl}/?tags={data.tag}" target="_blank" rel="noopener noreferrer">API Explorer: {data.tag} <ExternalLink size={12} /></a>
      </div>
    </div>
  </div>
</div>
