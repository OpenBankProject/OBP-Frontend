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
  import { onMount } from "svelte";

  let features = $state<Record<string, boolean> | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  async function fetchFeatures() {
    try {
      isLoading = true;
      error = null;

      const response = await fetch("/proxy/obp/v6.0.0/features");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message;
        throw new Error(
          `Failed to fetch features (${response.status}): ${errorMsg}`,
        );
      }

      const data = await response.json();

      if (data.message) {
        throw new Error(data.message);
      }

      features = data;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch features";
    } finally {
      isLoading = false;
    }
  }

  let featureEntries = $derived(
    features
      ? Object.entries(features).sort(([a], [b]) => a.localeCompare(b))
      : [],
  );

  let enabledCount = $derived(
    featureEntries.filter(([, v]) => v === true).length,
  );
  let disabledCount = $derived(
    featureEntries.filter(([, v]) => v === false).length,
  );

  function formatFeatureName(key: string): string {
    return key
      .replace(/^allow_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  onMount(() => {
    fetchFeatures();
  });
</script>

<svelte:head>
  <title>Features - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Features
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Features enabled on this OBP instance
        </p>
      </div>
      <button
        onclick={fetchFeatures}
        disabled={isLoading}
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        data-testid="refresh-features"
      >
        {isLoading ? "Refreshing..." : "Refresh"}
      </button>
    </div>
  </div>

  {#if error}
    <div
      class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
      data-testid="features-error"
    >
      <strong>Error:</strong>
      {error}
    </div>
  {:else if isLoading}
    <div
      class="flex items-center justify-center rounded-lg bg-gray-100 p-8 dark:bg-gray-800"
    >
      <div
        class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
      ></div>
      <p class="ml-3 text-gray-700 dark:text-gray-300">
        Loading features...
      </p>
    </div>
  {:else if features}
    <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      <div
        class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
          Total Features
        </div>
        <div
          class="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100"
          data-testid="features-total-count"
        >
          {featureEntries.length}
        </div>
      </div>
      <div
        class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
          Enabled
        </div>
        <div
          class="mt-2 text-3xl font-bold text-green-600 dark:text-green-400"
          data-testid="features-enabled-count"
        >
          {enabledCount}
        </div>
      </div>
      <div
        class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
          Disabled
        </div>
        <div
          class="mt-2 text-3xl font-bold text-gray-500 dark:text-gray-400"
          data-testid="features-disabled-count"
        >
          {disabledCount}
        </div>
      </div>
    </div>

    <div
      class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
      data-testid="features-table-container"
    >
      <table class="w-full">
        <thead>
          <tr
            class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
          >
            <th
              class="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"
            >
              Feature
            </th>
            <th
              class="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"
            >
              API Key
            </th>
            <th
              class="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"
            >
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {#each featureEntries as [key, value]}
            <tr
              class="border-b border-gray-100 last:border-b-0 dark:border-gray-700"
              data-testid="feature-row-{key}"
            >
              <td
                class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100"
              >
                {formatFeatureName(key)}
              </td>
              <td class="px-6 py-4">
                <code
                  class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                >
                  {key}
                </code>
              </td>
              <td class="px-6 py-4">
                {#if value === true}
                  <span
                    class="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    data-state="enabled"
                  >
                    Enabled
                  </span>
                {:else}
                  <span
                    class="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                    data-state="disabled"
                  >
                    Disabled
                  </span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
