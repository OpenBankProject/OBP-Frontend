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

  function formatCount(value: number): string {
    return value.toLocaleString("en-US");
  }

  const matchesTile = $derived(
    data.expectedDistinct === null ? null : data.users.length === data.expectedDistinct,
  );

  $effect(() => {
    pageHeading.set("Active Users");
    pageDataSummary.set(
      data.window
        ? `${data.users.length} active users between ${data.window.from} and ${data.window.to}`
        : "",
    );
    return () => {
      pageHeading.clear();
      pageDataSummary.clear();
    };
  });
</script>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6">
    <a href="/system-activity-dashboard" class="text-sm text-blue-600 hover:underline dark:text-blue-400">← Activity Summary Dashboard</a>
    <h1 class="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Active Users</h1>
    {#if data.window}
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400" data-testid="active-users-window">
        Users who made API calls between {formatDateTime(data.window.from)} and {formatDateTime(
          data.window.to,
        )} —
        <span class="font-semibold" data-testid="active-users-count">{data.users.length}</span> distinct users.
        Calls made via consents (e.g. by agents) count for the granting user.
      </p>
      {#if matchesTile !== null}
        {#if matchesTile}
          <p class="mt-1 text-sm text-green-700 dark:text-green-400" data-testid="active-users-consistency" data-state="match">
            ✓ Matches the dashboard tile's distinct user count ({formatCount(data.expectedDistinct!)}) for this window.
          </p>
        {:else}
          <p class="mt-1 text-sm text-red-700 dark:text-red-400" data-testid="active-users-consistency" data-state="mismatch">
            ✗ Does NOT match the dashboard tile: aggregate-metrics reports {formatCount(
              data.expectedDistinct!,
            )} distinct users but this list has {formatCount(data.users.length)}.
          </p>
        {/if}
      {/if}
    {/if}
  </div>

  {#if !data.window}
    <ErrorMessage
      message="This page needs a window: open it from a row of the dashboard's Active users card, or pass valid from_date and to_date query parameters."
      type="info"
    />
  {:else if data.fetchError}
    {#if data.fetchError.httpStatus === 403}
      <MissingRoleAlert roles={["CanReadMetrics"]} message={data.fetchError.message} />
    {:else}
      <ErrorMessage message={data.fetchError.message} />
    {/if}
  {:else}
    {#if data.possiblyTruncated}
      <div
        class="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
        data-testid="active-users-truncated"
      >
        The list hit the request limit, so it may be incomplete.
      </div>
    {/if}
    {#if data.users.length === 0}
      <p class="text-sm text-gray-600 dark:text-gray-400" data-testid="active-users-empty">
        No users made API calls in this window.
      </p>
    {:else}
      <div
        class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead>
            <tr class="text-left text-xs text-gray-600 dark:text-gray-400">
              <th class="px-4 py-3 font-medium">#</th>
              <th class="px-4 py-3 font-medium">Username</th>
              <th class="px-4 py-3 font-medium">User ID</th>
              <th class="px-4 py-3 text-right font-medium">API calls</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            {#each data.users as user, index (user.user_id)}
              <tr data-testid="active-users-row-{user.user_id}">
                <td class="px-4 py-2 text-gray-600 dark:text-gray-400">{index + 1}</td>
                <td class="px-4 py-2">
                  <a
                    href="/users/{user.user_id}"
                    class="text-blue-600 hover:underline dark:text-blue-400">{user.username}</a
                  >
                </td>
                <td class="px-4 py-2 font-mono text-xs">{user.user_id}</td>
                <td class="px-4 py-2 text-right font-semibold" data-testid="active-users-row-{user.user_id}-count">
                  {formatCount(user.count)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>
