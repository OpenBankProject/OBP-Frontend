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
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import { Trash2, AlertTriangle, Loader2 } from "@lucide/svelte";

  let { data }: { data: PageData } = $props();

  let isDeleting = $state(false);
  let formError = $state("");

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

  const fields = $derived(
    data.job
      ? [
          { label: "Name", value: data.job.name, mono: false },
          { label: "Job ID", value: data.job.job_id, mono: true },
          { label: "API Instance", value: data.job.api_instance_id, mono: true },
          { label: "Started At", value: formatDate(data.job.started_at), mono: false },
          { label: "Age", value: formatAge(data.job.age_seconds), mono: false },
        ]
      : [],
  );

  async function handleDelete(event: Event) {
    event.preventDefault();
    isDeleting = true;
    formError = "";

    try {
      const response = await fetch(
        `/proxy/obp/v7.0.0/management/system/scheduler/job-locks/${encodeURIComponent(data.jobId)}`,
        { method: "DELETE" },
      );

      // 204 No Content on success; the endpoint is idempotent.
      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const body = await response.json();
          message = body?.message ?? message;
        } catch {
          // no JSON body
        }
        throw new Error(message);
      }

      goto("/system/scheduler-job-locks");
    } catch (err) {
      formError =
        err instanceof Error ? err.message : "Failed to delete scheduler job lock";
      isDeleting = false;
    }
  }

  function handleCancel() {
    goto("/system/scheduler-job-locks");
  }
</script>

<svelte:head>
  <title>Delete Scheduler Job Lock - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8" data-testid="scheduler-job-lock-delete-page">
  <div class="mb-6">
    <h1 class="text-3xl font-bold ui-text">
      Delete Scheduler Job Lock
    </h1>
    <p class="mt-2 max-w-2xl text-sm ui-muted">
      Clear this lock row from the <code class="font-mono">jobscheduler</code>
      table, releasing it so the scheduled job can run again.
    </p>
  </div>

  {#if !data.hasRole}
    <MissingRoleAlert
      roles={["CanDeleteSchedulerJobLock"]}
      message="You need this role to delete a scheduler job lock"
    />
  {:else}
    <div class="mx-auto max-w-2xl">
      <div class="rounded-lg p-6 shadow-md ui-card">
        {#if formError}
          <div
            class="mb-4 rounded-lg border p-4 ui-tone-error"
            data-testid="delete-error"
          >
            <p class="text-sm ui-text-error">{formError}</p>
          </div>
        {/if}

        <!-- Caution: deleting a live lock allows a concurrent second run. -->
        <div
          class="mb-6 flex items-start gap-3 rounded-lg border p-4 ui-tone-warning"
        >
          <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 ui-text-warning" />
          <p class="text-sm ui-text-warning">
            Only clear a lock you have confirmed is stale (much older than a
            normal run). If the job is genuinely still running on some node,
            deleting its lock lets a second run start concurrently.
          </p>
        </div>

        {#if data.job}
          <div class="mb-6 space-y-4">
            {#each fields as field (field.label)}
              <div>
                <div class="mb-1 text-sm font-medium ui-muted">
                  {field.label}
                </div>
                <div
                  class="rounded-lg border px-4 py-2 text-sm ui-card ui-text ui-border {field.mono ? 'font-mono' : ''}"
                >
                  {field.value}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <!-- Lock no longer present; delete is still safe (idempotent). -->
          <div class="mb-6 space-y-4">
            <div>
              <div class="mb-1 text-sm font-medium ui-muted">
                Job ID
              </div>
              <div class="rounded-lg border px-4 py-2 font-mono text-sm ui-card ui-text ui-border">
                {data.jobId}
              </div>
            </div>
            <p class="text-sm ui-muted">
              This lock is no longer present — it may have already cleared on its
              own. Deleting is safe and idempotent.
            </p>
          </div>
        {/if}

        <form onsubmit={handleDelete}>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              onclick={handleCancel}
              disabled={isDeleting}
              class="rounded-lg border px-6 py-2 text-sm font-medium disabled:opacity-50 ui-card ui-hover ui-muted ui-border"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDeleting}
              data-testid="confirm-delete"
              class="inline-flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-50 preset-filled-error-500"
            >
              {#if isDeleting}
                <Loader2 class="h-4 w-4 animate-spin" />
                Deleting…
              {:else}
                <Trash2 class="h-4 w-4" />
                Delete Lock
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>
