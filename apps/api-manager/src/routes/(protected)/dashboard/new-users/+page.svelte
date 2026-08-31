<script lang="ts">
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import ErrorMessage from "$lib/components/ErrorMessage.svelte";
  import { pageHeading } from "$lib/stores/pageHeading.svelte";
  import { pageDataSummary } from "$lib/stores/pageDataSummary.svelte";

  let { data } = $props();

  function formatDateTime(iso: string): string {
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleString();
  }

  $effect(() => {
    pageHeading.set("New Users");
    pageDataSummary.set(
      data.window ? `${data.users.length} users created between ${data.window.from} and ${data.window.to}` : "",
    );
    return () => {
      pageHeading.clear();
      pageDataSummary.clear();
    };
  });
</script>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6">
    <a href="/dashboard" class="text-sm text-blue-600 hover:underline dark:text-blue-400">← Activity Summary Dashboard</a>
    <h1 class="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">New Users</h1>
    {#if data.window}
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400" data-testid="new-users-window">
        Created between {formatDateTime(data.window.from)} and {formatDateTime(data.window.to)} —
        <span class="font-semibold" data-testid="new-users-count">{data.users.length}</span> users.
        This list is built from the same data walk as the dashboard tile, so the count should match it exactly.
      </p>
    {/if}
  </div>

  {#if !data.window}
    <ErrorMessage
      message="This page needs a created-date window: open it from a row of the dashboard's New users card, or pass valid from_date and to_date query parameters."
      type="info"
    />
  {:else if data.fetchError}
    {#if data.fetchError.httpStatus === 403}
      <MissingRoleAlert roles={["CanGetAnyUser"]} message={data.fetchError.message} />
    {:else}
      <ErrorMessage message={data.fetchError.message} />
    {/if}
  {:else}
    {#if data.truncated}
      <div
        class="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
        data-testid="new-users-truncated"
      >
        Paging stopped at the safety cap before reaching the start of the window, so this list is a lower bound.
      </div>
    {/if}
    {#if data.users.length === 0}
      <p class="text-sm text-gray-600 dark:text-gray-400" data-testid="new-users-empty">
        No users were created in this window.
      </p>
    {:else}
      <div
        class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead>
            <tr class="text-left text-xs text-gray-600 dark:text-gray-400">
              <th class="px-4 py-3 font-medium">Username</th>
              <th class="px-4 py-3 font-medium">Email</th>
              <th class="px-4 py-3 font-medium">Provider</th>
              <th class="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            {#each data.users as user (user.user_id)}
              <tr data-testid="new-users-row-{user.user_id}">
                <td class="px-4 py-2">
                  <a
                    href="/users/{user.user_id}"
                    class="text-blue-600 hover:underline dark:text-blue-400">{user.username}</a
                  >
                </td>
                <td class="px-4 py-2">{user.email}</td>
                <td class="px-4 py-2">{user.provider}</td>
                <td class="px-4 py-2">{formatDateTime(user.created_date)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>
