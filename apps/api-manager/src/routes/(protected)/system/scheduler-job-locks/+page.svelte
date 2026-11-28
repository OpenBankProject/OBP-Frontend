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
  import { goto, invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";
  import type { OBPSchedulerJob } from "$lib/obp/types";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import { Trash2, RefreshCw, CheckCircle2, AlertTriangle } from "@lucide/svelte";

  let { data }: { data: PageData } = $props();

  let refreshing = $state(false);

  // A lock older than an hour almost certainly belongs to a JVM that died
  // mid-run, so highlight it as stale.
  const STALE_THRESHOLD_SECONDS = 3600;

  function isStale(job: OBPSchedulerJob): boolean {
    return job.age_seconds >= STALE_THRESHOLD_SECONDS;
  }

  function formatAge(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString(undefined, { hourCycle: "h23" });
  }

  function openDelete(job: OBPSchedulerJob) {
    goto(`/system/scheduler-job-locks/${encodeURIComponent(job.job_id)}/delete`);
  }

  async function refresh() {
    refreshing = true;
    await invalidateAll();
    refreshing = false;
  }
</script>

<svelte:head>
  <title>Scheduler Job Locks - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8" data-testid="scheduler-job-locks-page">
  <!-- Header -->
  <div class="mb-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold ui-text">
          Scheduler Job Locks
        </h1>
        <p class="mt-1 max-w-3xl ui-muted">
          Lock rows from the
          <code class="font-mono">jobscheduler</code> table (most recent first, up
          to 100). This is a <strong>lock table, not a job-history log</strong> — a
          row exists only while a scheduled job holds its lock, so in healthy
          operation this list is <strong>empty</strong>. A row with a small
          <code class="font-mono">age_seconds</code> is a job running right now; a
          large <code class="font-mono">age_seconds</code> is a
          <strong>stale lock</strong> left by a JVM that died mid-run, which blocks
          new runs of that job until it is cleared.
        </p>
      </div>
      {#if data.hasRole}
        <button
          type="button"
          onclick={refresh}
          disabled={refreshing}
          data-testid="refresh"
          class="inline-flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 ui-card ui-hover ui-muted ui-border"
        >
          <RefreshCw class="h-4 w-4 {refreshing ? 'animate-spin' : ''}" />
          Refresh
        </button>
      {/if}
    </div>
  </div>

  {#if !data.hasRole}
    <MissingRoleAlert
      roles={["CanGetSchedulerJobLocks"]}
      message="You need this role to view scheduler job locks"
    />
  {:else if data.jobs.length === 0}
    <!-- Healthy empty state -->
    <div
      class="rounded-lg border p-8 text-center ui-tone-success"
      data-testid="no-jobs"
    >
      <CheckCircle2 class="mx-auto mb-3 h-12 w-12 ui-text-success" />
      <p class="text-lg font-medium ui-text">
        No scheduler locks
      </p>
      <p class="mt-1 text-sm ui-muted">
        No job is currently holding a lock. This is the normal, healthy state.
      </p>
    </div>
  {:else}
    <!-- Jobs table -->
    <div
      class="overflow-hidden rounded-lg border shadow-sm ui-card ui-border"
    >
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y ui-border">
          <thead class="ui-card">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ui-muted">Name</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ui-muted">Job ID</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ui-muted">API Instance</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ui-muted">Started At</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ui-muted">Age</th>
              <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider ui-muted">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y ui-border">
            {#each data.jobs as job (job.job_id)}
              <tr
                class="ui-hover"
                data-testid="job-row"
                data-job-id={job.job_id}
                data-stale={isStale(job)}
              >
                <td class="px-4 py-3 text-sm font-medium ui-text">
                  {job.name}
                </td>
                <td class="px-4 py-3 font-mono text-sm ui-muted">
                  {job.job_id}
                </td>
                <td class="px-4 py-3 font-mono text-sm ui-muted">
                  {job.api_instance_id}
                </td>
                <td class="px-4 py-3 text-sm ui-muted">
                  {formatDate(job.started_at)}
                </td>
                <td class="px-4 py-3 text-sm">
                  {#if isStale(job)}
                    <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ui-tone-warning">
                      <AlertTriangle class="h-3 w-3" />
                      {formatAge(job.age_seconds)} · stale?
                    </span>
                  {:else}
                    <span class="ui-text">{formatAge(job.age_seconds)}</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    type="button"
                    onclick={() => openDelete(job)}
                    data-testid="delete-job"
                    class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium preset-filled-error-500"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                    Delete
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
