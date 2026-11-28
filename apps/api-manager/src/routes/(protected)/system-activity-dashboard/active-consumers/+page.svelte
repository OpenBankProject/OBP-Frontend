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
    return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleString(undefined, { hourCycle: "h23" });
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
    <a href="/system-activity-dashboard" class="text-sm hover:underline ui-link">← Activity Summary Dashboard</a>
    <h1 class="mt-2 text-2xl font-bold ui-text">Active Consumers</h1>
    {#if data.window}
      <p class="mt-1 text-sm ui-muted" data-testid="active-consumers-window">
        Consumers (apps) that made API calls between {formatDateTime(data.window.from)} and {formatDateTime(
          data.window.to,
        )} —
        <span class="font-semibold" data-testid="active-consumers-count">{data.consumers.length}</span> distinct consumers.
      </p>
      {#if matchesTile !== null}
        {#if matchesTile}
          <p class="mt-1 text-sm ui-text-success" data-testid="active-consumers-consistency" data-state="match">
            ✓ Matches the dashboard tile's distinct consumer count ({formatCount(data.expectedDistinct!)}) for this window.
          </p>
        {:else}
          <p class="mt-1 text-sm ui-text-error" data-testid="active-consumers-consistency" data-state="mismatch">
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
        class="mb-4 rounded-lg border p-3 text-sm ui-tone-warning"
        data-testid="active-consumers-truncated"
      >
        The list hit the request limit, so it may be incomplete.
      </div>
    {/if}
    {#if data.consumers.length === 0}
      <p class="text-sm ui-muted" data-testid="active-consumers-empty">
        No consumers made API calls in this window.
      </p>
    {:else}
      <div
        class="overflow-x-auto rounded-lg border shadow-sm ui-card ui-border"
      >
        <table class="min-w-full divide-y text-sm ui-border">
          <thead>
            <tr class="text-left text-xs ui-muted">
              <th class="px-4 py-3 font-medium">#</th>
              <th class="px-4 py-3 font-medium">App name</th>
              <th class="px-4 py-3 font-medium">Consumer ID</th>
              <th class="px-4 py-3 font-medium">Developer email</th>
              <th class="px-4 py-3 text-right font-medium">API calls</th>
            </tr>
          </thead>
          <tbody class="divide-y ui-border">
            {#each data.consumers as consumer, index (consumer.consumer_id)}
              <tr data-testid="active-consumers-row-{consumer.consumer_id}">
                <td class="px-4 py-2 ui-muted">{index + 1}</td>
                <td class="px-4 py-2">
                  {#if consumer.app_name}
                    <a
                      href="/consumers/{consumer.consumer_id}/edit"
                      class="hover:underline ui-link">{consumer.app_name}</a
                    >
                  {:else}
                    <span class="italic ui-muted">consumer no longer exists</span>
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
