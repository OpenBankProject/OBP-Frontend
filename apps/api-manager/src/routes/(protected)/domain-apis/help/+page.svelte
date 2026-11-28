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
  import { CircleHelp } from "@lucide/svelte";
  import GlossaryEntry from "$lib/components/GlossaryEntry.svelte";
  import HelpReferences from "$lib/components/HelpReferences.svelte";

  let { data } = $props();
</script>

<svelte:head>
  <title>Domain APIs Help - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-8">
  <nav class="mb-6 text-sm" aria-label="Breadcrumb">
    <a href="/domain-apis" class="hover:underline ui-link">Domain APIs</a>
    <span class="mx-2 ui-muted">/</span>
    <span class="ui-muted">Help</span>
  </nav>

  <div class="rounded-lg border shadow-sm ui-card ui-border">
    <div class="flex items-start gap-4 border-b p-6 ui-border">
      <CircleHelp size={32} class="shrink-0 ui-link" />
      <div>
        <h1 class="text-2xl font-bold ui-text">Domain APIs Help</h1>
      </div>
    </div>

    <div class="space-y-8 p-6">
      {#if data.warnings.length > 0}
        <div class="rounded-lg border p-4 text-sm ui-tone-warning" data-testid="help-warnings">
          <ul class="list-disc pl-5">{#each data.warnings as w}<li>{w}</li>{/each}</ul>
        </div>
      {/if}

      <section id="glossary">
        <h2 class="mb-3 text-lg font-semibold ui-text">{data.glossary.title}</h2>
        <GlossaryEntry html={data.glossary.html} testid="glossary-domain-apis" />
      </section>

      <section id="endpoints">
        <h2 class="mb-1 text-lg font-semibold ui-text">Endpoints</h2>
        {#if data.endpoints.length > 0}
          <div class="overflow-x-auto rounded-lg border ui-border">
            <table class="w-full text-sm" data-testid="domain-api-endpoints">
              <thead class="text-left text-xs uppercase ui-card ui-muted">
                <tr><th class="px-4 py-2">Verb</th><th class="px-4 py-2">Path</th><th class="px-4 py-2">Summary</th><th class="px-4 py-2">Roles</th></tr>
              </thead>
              <tbody class="divide-y ui-border">
                {#each data.endpoints as e (e.operation_id)}
                  <tr>
                    <td class="px-4 py-2 font-mono text-xs">{e.request_verb}</td>
                    <td class="px-4 py-2 font-mono text-xs"><a class="hover:underline ui-link" href={e.explorerUrl} target="_blank" rel="noopener noreferrer">{e.request_url}</a></td>
                    <td class="px-4 py-2 ui-muted">{e.summary}</td>
                    <td class="px-4 py-2 font-mono text-xs ui-muted">{e.roles.join(", ") || "none"}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="text-sm ui-muted">None found.</p>
        {/if}
      </section>

      <HelpReferences
        sources={[{ title: data.glossary.title, explorerUrl: data.glossary.explorerUrl }]}
        links={[
          { label: "Domain APIs", href: "/domain-apis" },
        ]}
      />
    </div>
  </div>
</div>
