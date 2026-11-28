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
  const lastRun = $derived(diagnostics?.last_run);
  const lastSuccessfulRun = $derived(diagnostics?.last_successful_run);
  const checks = $derived(diagnostics?.checks ?? []);
  const everythingAsExpected = $derived(
    diagnostics?.everything_as_expected ?? false,
  );

  function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString(undefined, { hourCycle: "h23" });
  }

  function formatCount(value: number | null | undefined): string {
    if (value === null || value === undefined) return "—";
    return value.toLocaleString();
  }

  function formatAge(days: number | null | undefined): string {
    if (days === null || days === undefined) return "—";
    return `${days.toLocaleString()} day${days === 1 ? "" : "s"}`;
  }

  // Each field of an archive run, paired with its prop path under the given
  // prefix (last_run / last_successful_run) so every value stays traceable.
  function runFields(run: any, prefix: string) {
    return [
      { prop: `${prefix}.run_id`, value: run.run_id },
      { prop: `${prefix}.api_instance_id`, value: run.api_instance_id },
      { prop: `${prefix}.started_at`, value: formatDate(run.started_at) },
      { prop: `${prefix}.ended_at`, value: formatDate(run.ended_at) },
      { prop: `${prefix}.duration_ms`, value: formatCount(run.duration_ms) },
      { prop: `${prefix}.rows_moved_to_archive`, value: formatCount(run.rows_moved_to_archive) },
      { prop: `${prefix}.rows_deleted_from_archive`, value: formatCount(run.rows_deleted_from_archive) },
      { prop: `${prefix}.success`, value: String(run.success) },
      { prop: `${prefix}.remark`, value: run.remark === "" ? "—" : run.remark },
    ];
  }

  // Explicit display label per check id — no string munging. An unmapped id
  // falls back to its literal value rather than being reworded.
  const checkLabels: Record<string, string> = {
    check_metrics_are_being_written: "Metrics are being written",
    check_archive_scheduler_is_enabled: "Archive scheduler is enabled",
    check_metric_retention_policy_is_respected: "Metric retention policy is respected",
    check_all_old_metrics_can_be_archived: "All old metrics can be archived",
    check_archive_retention_policy_is_respected: "Archive retention policy is respected",
    check_archive_metrics_is_fresh_enough: "Archive metrics is fresh enough",
    check_last_archive_run_succeeded: "Last archive run succeeded",
  };

  // The props each derived integrity check is computed from, so every statement
  // on the page is traceable to a real field in the API response. Keyed by the
  // backend check id; "+7d grace" in the messages is a hardcoded constant.
  // check_all_old_metrics_can_be_archived has no matching prop (the backend
  // always reports OK since un-archivable rows no longer exist), so it is omitted.
  const checkProps: Record<string, string[]> = {
    check_metrics_are_being_written: ["config.write_metrics"],
    check_archive_scheduler_is_enabled: ["config.enable_metrics_scheduler"],
    check_metric_retention_policy_is_respected: [
      "metric.oldest_record_age_days",
      "config.retain_metrics_days",
    ],
    check_archive_retention_policy_is_respected: [
      "metric_archive.oldest_record_age_days",
      "config.retain_archive_metrics_days",
    ],
    check_archive_metrics_is_fresh_enough: [
      "metric.oldest_record_age_days",
      "metric_archive.newest_record_age_days",
      "config.retain_metrics_days",
    ],
    check_last_archive_run_succeeded: [
      "last_run.success",
      "last_run.started_at",
    ],
  };

  function checkBadgeColor(status: string): string {
    if (status === "OK")
      return "ui-tone-success";
    if (status === "WARNING")
      return "ui-tone-warning";
    return "ui-tone-error";
  }
</script>

<svelte:head>
  <title>Metrics Diagnostics - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8" data-testid="metrics-diagnostics-page">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-3xl font-bold ui-text">
      Metrics Diagnostics
    </h1>
    <p class="mt-1 ui-muted">
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
        ? 'ui-tone-success'
        : 'ui-tone-error'}"
      data-testid="overall-status"
      data-state={everythingAsExpected ? "ok" : "attention"}
    >
      <div class="flex items-center gap-3">
        {#if everythingAsExpected}
          <CheckCircle2 class="h-6 w-6 ui-text-success" />
          <p class="text-base font-semibold ui-text-success">
            Everything as expected
          </p>
        {:else}
          <AlertTriangle class="h-6 w-6 ui-text-error" />
          <p class="text-base font-semibold ui-text-error">
            Some checks need attention
          </p>
        {/if}
      </div>
    </div>

    <!-- Table Stats -->
    <div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {#each [{ title: "Metric Table", icon: Activity, stats: metric, color: "ui-link" }, { title: "Metric Archive Table", icon: Archive, stats: metricArchive, color: "ui-text-brand" }] as card (card.title)}
        <div
          class="rounded-lg border p-6 shadow-sm ui-card ui-border"
          data-testid="table-stats"
          data-table={card.stats?.table_name}
        >
          <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <card.icon class="h-5 w-5 {card.color}" />
              <h2 class="text-lg font-semibold ui-text">
                {card.title}
              </h2>
            </div>
            <code
              class="rounded px-2 py-1 text-xs font-mono ui-panel ui-muted"
            >
              {card.stats?.table_name ?? "—"}
            </code>
          </div>

          <div class="mb-4">
            <p class="text-sm font-medium ui-muted">
              Row Count
            </p>
            <p
              class="mt-1 text-3xl font-bold ui-text"
              data-testid="row-count"
            >
              {formatCount(card.stats?.count)}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4 rounded-lg p-4 ui-card">
            <div>
              <p class="text-sm font-medium ui-muted">
                Oldest Record
              </p>
              <p class="mt-1 text-sm ui-text">
                {formatDate(card.stats?.oldest_record_date)}
              </p>
              <p class="text-xs ui-muted">
                {formatAge(card.stats?.oldest_record_age_days)} old
              </p>
            </div>
            <div>
              <p class="text-sm font-medium ui-muted">
                Newest Record
              </p>
              <p class="mt-1 text-sm ui-text">
                {formatDate(card.stats?.newest_record_date)}
              </p>
              <p class="text-xs ui-muted">
                {formatAge(card.stats?.newest_record_age_days)} old
              </p>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Archiving Configuration -->
    <div
      class="mb-6 rounded-lg border shadow-sm ui-card ui-border"
    >
      <div class="flex items-center gap-2 border-b p-6 ui-border">
        <Settings class="h-5 w-5 ui-muted" />
        <h2 class="text-lg font-semibold ui-text">
          Metrics Configuration
        </h2>
      </div>
      <div class="grid grid-cols-1 gap-px overflow-hidden rounded-b-lg sm:grid-cols-2 lg:grid-cols-3 ui-panel">
        {#each Object.entries(config) as [key, value] (key)}
          <div class="p-4 ui-card" data-testid="config-item" data-config-key={key}>
            <code class="text-sm font-mono ui-muted">
              {key}
            </code>
            <p class="mt-1 text-lg font-semibold ui-text">
              {#if typeof value === "boolean"}
                {value ? "true" : "false"}
              {:else}
                {value}
              {/if}
            </p>
          </div>
        {/each}
      </div>
    </div>

    <!-- Last Run / Last Successful Run -->
    {#each [{ title: "Last Run", prefix: "last_run", run: lastRun }, { title: "Last Successful Run", prefix: "last_successful_run", run: lastSuccessfulRun }] as section (section.prefix)}
      <div
        class="mb-6 rounded-lg border shadow-sm ui-card ui-border"
        data-testid="archive-run"
        data-prefix={section.prefix}
      >
        <div class="border-b p-6 ui-border">
          <h2 class="text-lg font-semibold ui-text">
            {section.title}
          </h2>
          <code class="text-xs font-mono ui-muted">{section.prefix}</code>
        </div>
        {#if section.run}
          <div class="grid grid-cols-1 gap-px overflow-hidden rounded-b-lg sm:grid-cols-2 lg:grid-cols-3 ui-panel">
            {#each runFields(section.run, section.prefix) as field (field.prop)}
              <div class="p-4 ui-card" data-testid="run-field" data-prop={field.prop}>
                <code class="text-sm font-mono ui-muted">{field.prop}</code>
                <p class="mt-1 text-lg font-semibold break-words ui-text">
                  {field.value}
                </p>
              </div>
            {/each}
          </div>
        {:else}
          <p class="p-6 text-sm ui-muted">
            No archive run recorded.
          </p>
        {/if}
      </div>
    {/each}

    <!-- Integrity Checks -->
    <div
      class="mb-6 rounded-lg border shadow-sm ui-card ui-border"
    >
      <div class="border-b p-6 ui-border">
        <h2 class="text-lg font-semibold ui-text">
          Integrity Checks ({checks.length})
        </h2>
      </div>
      <ul class="divide-y ui-border">
        {#each checks as check (check.name)}
          <li class="flex items-start gap-3 p-4" data-testid="integrity-check" data-check={check.name} data-status={check.status}>
            <div class="mt-0.5">
              {#if check.status === "OK"}
                <CheckCircle2 class="h-5 w-5 ui-text-success" />
              {:else if check.status === "WARNING"}
                <AlertTriangle class="h-5 w-5 ui-text-warning" />
              {:else}
                <XCircle class="h-5 w-5 ui-text-error" />
              {/if}
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold ui-text">
                  {checkLabels[check.name] ?? check.name}
                </span>
                <span class="rounded-full px-2.5 py-0.5 text-xs font-medium {checkBadgeColor(check.status)}">
                  {check.status}
                </span>
              </div>
              <code class="text-xs font-mono ui-muted">{check.name}</code>
              <p class="mt-1 text-sm ui-muted">
                {check.message}
              </p>
              {#if checkProps[check.name]}
                <div class="mt-2 flex flex-wrap items-center gap-1.5" data-testid="check-props">
                  <span class="text-xs ui-muted">props:</span>
                  {#each checkProps[check.name] as prop (prop)}
                    <code class="rounded px-1.5 py-0.5 text-xs font-mono ui-panel ui-muted">{prop}</code>
                  {/each}
                </div>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </div>

    <!-- Raw Data -->
    <div
      class="rounded-lg border shadow-sm ui-card ui-border"
    >
      <div class="border-b p-6 ui-border">
        <h2 class="text-lg font-semibold ui-text">
          Raw Diagnostics Data
        </h2>
      </div>
      <div class="p-6">
        <div class="overflow-auto max-h-[600px]">
          <pre class="whitespace-pre-wrap break-words rounded-lg p-4 text-xs ui-card"><code
              class="ui-text">{JSON.stringify(diagnostics, null, 2)}</code></pre>
        </div>
      </div>
    </div>
  {/if}
</div>
