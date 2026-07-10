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
    return d.toLocaleString();
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
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
      Delete Scheduler Job Lock
    </h1>
    <p class="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
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
      <div class="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800 dark:shadow-gray-900/50">
        {#if formError}
          <div
            class="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
            data-testid="delete-error"
          >
            <p class="text-sm text-red-800 dark:text-red-200">{formError}</p>
          </div>
        {/if}

        <!-- Caution: deleting a live lock allows a concurrent second run. -->
        <div
          class="mb-6 flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20"
        >
          <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <p class="text-sm text-yellow-800 dark:text-yellow-200">
            Only clear a lock you have confirmed is stale (much older than a
            normal run). If the job is genuinely still running on some node,
            deleting its lock lets a second run start concurrently.
          </p>
        </div>

        {#if data.job}
          <div class="mb-6 space-y-4">
            {#each fields as field (field.label)}
              <div>
                <div class="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {field.label}
                </div>
                <div
                  class="rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 {field.mono ? 'font-mono' : ''}"
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
              <div class="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                Job ID
              </div>
              <div class="rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                {data.jobId}
              </div>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400">
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
              class="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDeleting}
              data-testid="confirm-delete"
              class="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
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
