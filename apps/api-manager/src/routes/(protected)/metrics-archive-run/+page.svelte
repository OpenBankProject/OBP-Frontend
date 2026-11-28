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
    Play,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Loader2,
  } from "@lucide/svelte";

  let { data }: { data: PageData } = $props();

  const RUN_ENDPOINT = "/proxy/obp/v7.0.0/management/system/diagnostics/metrics/run";

  let running = $state(false);
  let result = $state<any>(null);
  let errorMessage = $state<string | null>(null);

  async function triggerRun() {
    running = true;
    result = null;
    errorMessage = null;
    try {
      const response = await fetch(RUN_ENDPOINT, { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        errorMessage = body.message ?? `HTTP ${response.status}`;
        return;
      }
      result = body;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Failed to trigger archive run";
    } finally {
      running = false;
    }
  }

  function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString(undefined, { hourCycle: "h23" });
  }

  function formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) return "—";
    return value.toLocaleString();
  }

  // status is "completed" or "skipped_already_in_progress"; within "completed",
  // run.success tells you whether the run itself succeeded.
  const isCompleted = $derived(result?.status === "completed");
  const isSkipped = $derived(result?.status === "skipped_already_in_progress");
  const runSucceeded = $derived(result?.run?.success === true);

  // run.* prop -> displayed value, so every field is traceable to the response.
  const runFields = $derived(
    result?.run
      ? [
          { prop: "run.run_id", value: result.run.run_id },
          { prop: "run.api_instance_id", value: result.run.api_instance_id },
          { prop: "run.started_at", value: formatDate(result.run.started_at) },
          { prop: "run.ended_at", value: formatDate(result.run.ended_at) },
          { prop: "run.duration_ms", value: formatNumber(result.run.duration_ms) },
          { prop: "run.rows_moved_to_archive", value: formatNumber(result.run.rows_moved_to_archive) },
          { prop: "run.rows_deleted_from_archive", value: formatNumber(result.run.rows_deleted_from_archive) },
          { prop: "run.success", value: String(result.run.success) },
          { prop: "run.remark", value: result.run.remark === "" ? "—" : result.run.remark },
        ]
      : [],
  );
</script>

<svelte:head>
  <title>Trigger Metrics Archive Run - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8" data-testid="metrics-archive-run-page">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-3xl font-bold ui-text">
      Trigger Metrics Archive Run
    </h1>
    <p class="mt-1 ui-muted">
      Run the metrics-archiving job once, on demand. This invokes the same code
      path as the scheduled <code class="font-mono">MetricsArchiveScheduler</code>:
      it moves <code class="font-mono">metric</code> rows older than the effective
      <code class="font-mono">retain_metrics_days</code> into
      <code class="font-mono">metricarchive</code> (up to
      <code class="font-mono">retain_metrics_move_limit</code> rows), deletes
      <code class="font-mono">metricarchive</code> rows past the effective
      <code class="font-mono">retain_archive_metrics_days</code>, respects the
      concurrency lock, and records the outcome in
      <code class="font-mono">metricsarchiverun</code>. It runs synchronously, so
      a large backlog may take a while.
    </p>
  </div>

  {#if !data.hasRole}
    <MissingRoleAlert
      roles={["CanCreateMetricsArchiveRun"]}
      message="You need this role to trigger a metrics archive run"
    />
  {:else}
    <!-- Trigger -->
    <div class="mb-6">
      <button
        type="button"
        onclick={triggerRun}
        disabled={running}
        data-testid="trigger-run"
        class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50 preset-filled-primary-500"
      >
        {#if running}
          <Loader2 class="h-4 w-4 animate-spin" />
          Running…
        {:else}
          <Play class="h-4 w-4" />
          Run Archive Now
        {/if}
      </button>
    </div>

    <!-- Error -->
    {#if errorMessage}
      <div
        class="mb-6 rounded-lg border p-4 ui-tone-error"
        data-testid="run-error"
      >
        <div class="flex items-center gap-2">
          <XCircle class="h-5 w-5 ui-text-error" />
          <p class="text-sm font-medium ui-text-error">{errorMessage}</p>
        </div>
      </div>
    {/if}

    <!-- Result -->
    {#if result}
      <!-- Status banner -->
      <div
        class="mb-6 rounded-lg border p-4 {isSkipped
          ? 'ui-tone-warning'
          : runSucceeded
            ? 'ui-tone-success'
            : 'ui-tone-error'}"
        data-testid="run-status"
        data-status={result.status}
      >
        <div class="flex items-start gap-3">
          {#if isSkipped}
            <AlertTriangle class="mt-0.5 h-6 w-6 ui-text-warning" />
          {:else if runSucceeded}
            <CheckCircle2 class="mt-0.5 h-6 w-6 ui-text-success" />
          {:else}
            <XCircle class="mt-0.5 h-6 w-6 ui-text-error" />
          {/if}
          <div>
            <div class="flex items-center gap-2">
              <span class="text-base font-semibold ui-text">
                {#if isSkipped}
                  Skipped — already in progress
                {:else if runSucceeded}
                  Run completed
                {:else}
                  Run completed with errors
                {/if}
              </span>
              <code class="rounded px-1.5 py-0.5 text-xs font-mono ui-panel ui-muted">status</code>
            </div>
            <p class="mt-1 text-sm ui-muted">{result.message}</p>
            <code class="text-xs font-mono ui-muted">message</code>
          </div>
        </div>
      </div>

      <!-- Run detail -->
      {#if isCompleted && runFields.length > 0}
        <div class="mb-6 rounded-lg border shadow-sm ui-card ui-border">
          <div class="border-b p-6 ui-border">
            <h2 class="text-lg font-semibold ui-text">
              Recorded Run
            </h2>
          </div>
          <div class="grid grid-cols-1 gap-px overflow-hidden rounded-b-lg sm:grid-cols-2 lg:grid-cols-3 ui-panel">
            {#each runFields as field (field.prop)}
              <div class="p-4 ui-card" data-testid="run-field" data-prop={field.prop}>
                <code class="text-sm font-mono ui-muted">{field.prop}</code>
                <p class="mt-1 text-lg font-semibold break-words ui-text">
                  {field.value}
                </p>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Raw response -->
      <div class="rounded-lg border shadow-sm ui-card ui-border">
        <div class="border-b p-6 ui-border">
          <h2 class="text-lg font-semibold ui-text">
            Raw Response
          </h2>
        </div>
        <div class="p-6">
          <div class="overflow-auto max-h-[600px]">
            <pre class="whitespace-pre-wrap break-words rounded-lg p-4 text-xs ui-card"><code
                class="ui-text">{JSON.stringify(result, null, 2)}</code></pre>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>
