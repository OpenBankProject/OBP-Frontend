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
  import { FileSpreadsheet, Plus } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { fetchReports, fetchReport, duplicateReport, parseParameters, type ReportSummary } from "$lib/services/reports";

  let reports = $state<ReportSummary[]>([]);
  let loading = $state(true);
  let error = $state("");
  onMount(async () => {
    try { reports = await fetchReports(); } catch (e) { error = e instanceof Error ? e.message : String(e); } finally { loading = false; }
  });

  let duplicatingId = $state("");
  async function duplicate(id: string) {
    duplicatingId = id;
    try {
      const src = await fetchReport(id);
      const copy = await duplicateReport({ slug: src.slug, title: src.title, description: src.description, definition: src.definition, parameters: src.parameters });
      await goto(`/reports/${copy.id}`);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      duplicatingId = "";
    }
  }
</script>

<svelte:head><title>Reports - API Manager</title></svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="flex items-center gap-2 text-3xl font-bold ui-text"><FileSpreadsheet class="h-7 w-7" /> Reports</h1>
      <p class="mt-1 ui-muted">Saved report definitions. Each runs in your browser with your own OBP access; ask Opey to write or change one.</p>
    </div>
    <a href="/reports/new" class="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium preset-filled-primary-500" data-testid="reports-new"><Plus class="h-4 w-4" /> New report</a>
  </div>

  {#if error}
    <p class="rounded-lg border p-4 text-sm ui-tone-error" data-testid="reports-error">{error}</p>
  {:else if loading}
    <p class="text-sm ui-muted">Loading…</p>
  {:else if reports.length === 0}
    <p class="text-sm ui-muted" data-testid="reports-empty">No reports yet. Create one and let Opey write it.</p>
  {:else}
    <ul class="divide-y rounded-lg border ui-card ui-border" data-testid="reports-list">
      {#each reports as r (r.id)}
        {@const params = parseParameters(r.parameters).params}
        <li class="flex flex-wrap items-center gap-3 px-4 py-3" data-testid="reports-item">
          <div class="min-w-0 flex-1">
            <a href="/reports/{r.id}" class="font-semibold hover:underline ui-text">{r.title}</a>
            <span class="ml-2 font-mono text-xs ui-muted">{r.slug}</span>
            {#if r.description}<p class="mt-0.5 text-sm ui-muted">{r.description}</p>{/if}
          </div>
          <span class="text-xs ui-muted">{params.length} parameter{params.length === 1 ? "" : "s"} · {r.author || "unknown"} · {r.updated_at}</span>
          <a href="/reports/{r.id}" class="rounded-md border px-3 py-1 text-sm ui-hover ui-muted ui-border">Open</a>
          <button type="button" class="rounded-md border px-3 py-1 text-sm disabled:opacity-60 ui-hover ui-muted ui-border" disabled={duplicatingId === r.id} onclick={() => duplicate(r.id)} data-testid="reports-duplicate">{duplicatingId === r.id ? "Duplicating…" : "Duplicate"}</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
