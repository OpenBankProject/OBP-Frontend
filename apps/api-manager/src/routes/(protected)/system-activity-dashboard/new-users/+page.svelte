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
    <a href="/system-activity-dashboard" class="text-sm hover:underline ui-link">← Activity Summary Dashboard</a>
    <h1 class="mt-2 text-2xl font-bold ui-text">New Users</h1>
    {#if data.window}
      <p class="mt-1 text-sm ui-muted" data-testid="new-users-window">
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
        class="mb-4 rounded-lg border p-3 text-sm ui-tone-warning"
        data-testid="new-users-truncated"
      >
        Paging stopped at the safety cap before reaching the start of the window, so this list is a lower bound.
      </div>
    {/if}
    {#if data.users.length === 0}
      <p class="text-sm ui-muted" data-testid="new-users-empty">
        No users were created in this window.
      </p>
    {:else}
      <div
        class="overflow-x-auto rounded-lg border shadow-sm ui-card ui-border"
      >
        <table class="min-w-full divide-y text-sm ui-border">
          <thead>
            <tr class="text-left text-xs ui-muted">
              <th class="px-4 py-3 font-medium">Username</th>
              <th class="px-4 py-3 font-medium">Email</th>
              <th class="px-4 py-3 font-medium">Provider</th>
              <th class="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody class="divide-y ui-border">
            {#each data.users as user (user.user_id)}
              <tr data-testid="new-users-row-{user.user_id}">
                <td class="px-4 py-2">
                  <a
                    href="/users/{user.user_id}"
                    class="hover:underline ui-link">{user.username}</a
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
