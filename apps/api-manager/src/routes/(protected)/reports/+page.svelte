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
      <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-gray-100"><FileSpreadsheet class="h-7 w-7" /> Reports</h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">Saved report definitions. Each runs in your browser with your own OBP access; ask Opey to write or change one.</p>
    </div>
    <a href="/reports/new" class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-testid="reports-new"><Plus class="h-4 w-4" /> New report</a>
  </div>

  {#if error}
    <p class="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200" data-testid="reports-error">{error}</p>
  {:else if loading}
    <p class="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
  {:else if reports.length === 0}
    <p class="text-sm text-gray-500 dark:text-gray-400" data-testid="reports-empty">No reports yet. Create one and let Opey write it.</p>
  {:else}
    <ul class="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800" data-testid="reports-list">
      {#each reports as r (r.id)}
        {@const params = parseParameters(r.parameters).params}
        <li class="flex flex-wrap items-center gap-3 px-4 py-3" data-testid="reports-item">
          <div class="min-w-0 flex-1">
            <a href="/reports/{r.id}" class="font-semibold text-gray-900 hover:underline dark:text-gray-100">{r.title}</a>
            <span class="ml-2 font-mono text-xs text-gray-500 dark:text-gray-400">{r.slug}</span>
            {#if r.description}<p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{r.description}</p>{/if}
          </div>
          <span class="text-xs text-gray-500 dark:text-gray-400">{params.length} parameter{params.length === 1 ? "" : "s"} · {r.author || "unknown"} · {r.updated_at}</span>
          <a href="/reports/{r.id}" class="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Open</a>
          <button type="button" class="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" disabled={duplicatingId === r.id} onclick={() => duplicate(r.id)} data-testid="reports-duplicate">{duplicatingId === r.id ? "Duplicating…" : "Duplicate"}</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
