<script lang="ts">
  import type { PageData } from "./$types";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import {
    Activity,
    Archive,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Settings,
  } from "@lucide/svelte";

  let { data }: { data: PageData } = $props();

  const diagnostics = $derived(data.diagnostics);
  const config = $derived(diagnostics?.config);
  const metric = $derived(diagnostics?.metric);
  const metricArchive = $derived(diagnostics?.metric_archive);
  const checks = $derived(diagnostics?.checks ?? []);
  const everythingAsExpected = $derived(
    diagnostics?.everything_as_expected ?? false,
  );

  function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  }

  function formatCount(value: number | null | undefined): string {
    if (value === null || value === undefined) return "—";
    return value.toLocaleString();
  }

  function formatAge(days: number | null | undefined): string {
    if (days === null || days === undefined) return "—";
    return `${days.toLocaleString()} day${days === 1 ? "" : "s"}`;
  }

  function checkBadgeColor(status: string): string {
    if (status === "OK")
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (status === "WARNING")
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }
</script>

<svelte:head>
  <title>Metrics Diagnostics - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8" data-testid="metrics-diagnostics-page">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
      Metrics Diagnostics
    </h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">
      State of the <code class="font-mono">metric</code> and
      <code class="font-mono">metricarchive</code> tables, the archiving
      configuration, and integrity checks for the metrics archive scheduler.
    </p>
  </div>

  {#if !data.hasRole}
    <MissingRoleAlert
      roles={["CanGetMetricsDiagnostics"]}
      message="You need this role to view metrics diagnostics"
    />
  {:else if diagnostics}
    <!-- Overall Status -->
    <div
      class="mb-6 rounded-lg border p-4 {everythingAsExpected
        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
        : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'}"
      data-testid="overall-status"
      data-state={everythingAsExpected ? "ok" : "attention"}
    >
      <div class="flex items-center gap-3">
        {#if everythingAsExpected}
          <CheckCircle2 class="h-6 w-6 text-green-600 dark:text-green-400" />
          <p class="text-base font-semibold text-green-800 dark:text-green-200">
            Everything as expected
          </p>
        {:else}
          <AlertTriangle class="h-6 w-6 text-red-600 dark:text-red-400" />
          <p class="text-base font-semibold text-red-800 dark:text-red-200">
            Some checks need attention
          </p>
        {/if}
      </div>
    </div>

    <!-- Table Stats -->
    <div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {#each [{ title: "Metric Table", icon: Activity, stats: metric, color: "text-blue-500" }, { title: "Metric Archive Table", icon: Archive, stats: metricArchive, color: "text-purple-500" }] as card (card.title)}
        <div
          class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          data-testid="table-stats"
          data-table={card.stats?.table_name}
        >
          <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <card.icon class="h-5 w-5 {card.color}" />
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {card.title}
              </h2>
            </div>
            <code
              class="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              {card.stats?.table_name ?? "—"}
            </code>
          </div>

          <div class="mb-4">
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              Row Count
            </p>
            <p
              class="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100"
              data-testid="row-count"
            >
              {formatCount(card.stats?.count)}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
                Oldest Record
              </p>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {formatDate(card.stats?.oldest_record_date)}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(card.stats?.oldest_record_age_days)} old
              </p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
                Newest Record
              </p>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {formatDate(card.stats?.newest_record_date)}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(card.stats?.newest_record_age_days)} old
              </p>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Archiving Configuration -->
    <div
      class="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="flex items-center gap-2 border-b border-gray-200 p-6 dark:border-gray-700">
        <Settings class="h-5 w-5 text-gray-500" />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Archiving Configuration
        </h2>
      </div>
      <div class="grid grid-cols-1 gap-px overflow-hidden rounded-b-lg bg-gray-200 dark:bg-gray-700 sm:grid-cols-2 lg:grid-cols-3">
        {#each [{ key: "write_metrics", label: "Write Metrics", value: config?.write_metrics }, { key: "enable_metrics_scheduler", label: "Scheduler Enabled", value: config?.enable_metrics_scheduler }, { key: "retain_metrics_move_limit", label: "Move Batch Limit", value: config?.retain_metrics_move_limit }, { key: "retain_metrics_days", label: "Retain Metrics (days)", value: config?.retain_metrics_days, effective: config?.retain_metrics_days_effective }, { key: "retain_archive_metrics_days", label: "Retain Archive (days)", value: config?.retain_archive_metrics_days, effective: config?.retain_archive_metrics_days_effective }] as item (item.key)}
          <div class="bg-white p-4 dark:bg-gray-800" data-testid="config-item" data-config-key={item.key}>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {item.label}
            </p>
            <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {#if typeof item.value === "boolean"}
                {item.value ? "Yes" : "No"}
              {:else}
                {item.value ?? "—"}
              {/if}
            </p>
            {#if item.effective !== undefined && item.effective !== item.value}
              <p class="text-xs text-gray-500 dark:text-gray-400">
                effective: {item.effective}
              </p>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- Integrity Checks -->
    <div
      class="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="border-b border-gray-200 p-6 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Integrity Checks ({checks.length})
        </h2>
      </div>
      <ul class="divide-y divide-gray-200 dark:divide-gray-700">
        {#each checks as check (check.name)}
          <li class="flex items-start gap-3 p-4" data-testid="integrity-check" data-check={check.name} data-status={check.status}>
            <div class="mt-0.5">
              {#if check.status === "OK"}
                <CheckCircle2 class="h-5 w-5 text-green-600 dark:text-green-400" />
              {:else if check.status === "WARNING"}
                <AlertTriangle class="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              {:else}
                <XCircle class="h-5 w-5 text-red-600 dark:text-red-400" />
              {/if}
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <code class="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">
                  {check.name}
                </code>
                <span class="rounded-full px-2.5 py-0.5 text-xs font-medium {checkBadgeColor(check.status)}">
                  {check.status}
                </span>
              </div>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {check.message}
              </p>
            </div>
          </li>
        {/each}
      </ul>
    </div>

    <!-- Raw Data -->
    <div
      class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="border-b border-gray-200 p-6 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Raw Diagnostics Data
        </h2>
      </div>
      <div class="p-6">
        <div class="overflow-auto max-h-[600px]">
          <pre class="whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-4 text-xs dark:bg-gray-900"><code
              class="text-gray-900 dark:text-gray-100">{JSON.stringify(diagnostics, null, 2)}</code></pre>
        </div>
      </div>
    </div>
  {/if}
</div>
