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
    data.expectedDistinct === null ? null : data.consumers.length === data.expectedDistinct,
  );

  $effect(() => {
    pageHeading.set("Active Consumers");
    pageDataSummary.set(
      data.window
        ? `${data.consumers.length} active consumers between ${data.window.from} and ${data.window.to}`
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
    <h1 class="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Active Consumers</h1>
    {#if data.window}
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400" data-testid="active-consumers-window">
        Consumers (apps) that made API calls between {formatDateTime(data.window.from)} and {formatDateTime(
          data.window.to,
        )} —
        <span class="font-semibold" data-testid="active-consumers-count">{data.consumers.length}</span> distinct consumers.
      </p>
      {#if matchesTile !== null}
        {#if matchesTile}
          <p class="mt-1 text-sm text-green-700 dark:text-green-400" data-testid="active-consumers-consistency" data-state="match">
            ✓ Matches the dashboard tile's distinct consumer count ({formatCount(data.expectedDistinct!)}) for this window.
          </p>
        {:else}
          <p class="mt-1 text-sm text-red-700 dark:text-red-400" data-testid="active-consumers-consistency" data-state="mismatch">
            ✗ Does NOT match the dashboard tile: aggregate-metrics reports {formatCount(
              data.expectedDistinct!,
            )} distinct consumers but this list has {formatCount(data.consumers.length)}.
          </p>
        {/if}
      {/if}
    {/if}
  </div>

  {#if !data.window}
    <ErrorMessage
      message="This page needs a window: open it from a row of the dashboard's Active consumers card, or pass valid from_date and to_date query parameters."
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
        data-testid="active-consumers-truncated"
      >
        The list hit the request limit, so it may be incomplete.
      </div>
    {/if}
    {#if data.consumers.length === 0}
      <p class="text-sm text-gray-600 dark:text-gray-400" data-testid="active-consumers-empty">
        No consumers made API calls in this window.
      </p>
    {:else}
      <div
        class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead>
            <tr class="text-left text-xs text-gray-600 dark:text-gray-400">
              <th class="px-4 py-3 font-medium">#</th>
              <th class="px-4 py-3 font-medium">App name</th>
              <th class="px-4 py-3 font-medium">Consumer ID</th>
              <th class="px-4 py-3 font-medium">Developer email</th>
              <th class="px-4 py-3 text-right font-medium">API calls</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            {#each data.consumers as consumer, index (consumer.consumer_id)}
              <tr data-testid="active-consumers-row-{consumer.consumer_id}">
                <td class="px-4 py-2 text-gray-600 dark:text-gray-400">{index + 1}</td>
                <td class="px-4 py-2">
                  {#if consumer.app_name}
                    <a
                      href="/consumers/{consumer.consumer_id}/edit"
                      class="text-blue-600 hover:underline dark:text-blue-400">{consumer.app_name}</a
                    >
                  {:else}
                    <span class="italic text-gray-600 dark:text-gray-400">consumer no longer exists</span>
                  {/if}
                </td>
                <td class="px-4 py-2 font-mono text-xs">{consumer.consumer_id}</td>
                <td class="px-4 py-2">{consumer.developer_email}</td>
                <td class="px-4 py-2 text-right font-semibold" data-testid="active-consumers-row-{consumer.consumer_id}-count">
                  {formatCount(consumer.count)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>
