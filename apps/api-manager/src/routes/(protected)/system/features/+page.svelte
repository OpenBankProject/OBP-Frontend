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
        <h1 class="text-3xl font-bold ui-text">
          Features
        </h1>
        <p class="mt-1 text-sm ui-muted">
          Features enabled on this OBP instance
        </p>
      </div>
      <button
        onclick={fetchFeatures}
        disabled={isLoading}
        class="rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 preset-filled-primary-500"
        data-testid="refresh-features"
      >
        {isLoading ? "Refreshing..." : "Refresh"}
      </button>
    </div>
  </div>

  {#if error}
    <div
      class="rounded-lg border p-4 ui-tone-error"
      data-testid="features-error"
    >
      <strong>Error:</strong>
      {error}
    </div>
  {:else if isLoading}
    <div
      class="flex items-center justify-center rounded-lg p-8 ui-panel"
    >
      <div
        class="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent border-current ui-text-brand"
      ></div>
      <p class="ml-3 ui-muted">
        Loading features...
      </p>
    </div>
  {:else if features}
    <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      <div
        class="rounded-lg border p-6 shadow-sm ui-card ui-border"
      >
        <div class="text-sm font-medium ui-muted">
          Total Features
        </div>
        <div
          class="mt-2 text-3xl font-bold ui-text"
          data-testid="features-total-count"
        >
          {featureEntries.length}
        </div>
      </div>
      <div
        class="rounded-lg border p-6 shadow-sm ui-card ui-border"
      >
        <div class="text-sm font-medium ui-muted">
          Enabled
        </div>
        <div
          class="mt-2 text-3xl font-bold ui-text-success"
          data-testid="features-enabled-count"
        >
          {enabledCount}
        </div>
      </div>
      <div
        class="rounded-lg border p-6 shadow-sm ui-card ui-border"
      >
        <div class="text-sm font-medium ui-muted">
          Disabled
        </div>
        <div
          class="mt-2 text-3xl font-bold ui-muted"
          data-testid="features-disabled-count"
        >
          {disabledCount}
        </div>
      </div>
    </div>

    <div
      class="rounded-lg border shadow-sm ui-card ui-border"
      data-testid="features-table-container"
    >
      <table class="w-full">
        <thead>
          <tr
            class="border-b ui-card ui-border"
          >
            <th
              class="px-6 py-3 text-left text-sm font-semibold ui-muted"
            >
              Feature
            </th>
            <th
              class="px-6 py-3 text-left text-sm font-semibold ui-muted"
            >
              API Key
            </th>
            <th
              class="px-6 py-3 text-left text-sm font-semibold ui-muted"
            >
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {#each featureEntries as [key, value]}
            <tr
              class="border-b last:border-b-0 ui-border"
              data-testid="feature-row-{key}"
            >
              <td
                class="px-6 py-4 text-sm font-medium ui-text"
              >
                {formatFeatureName(key)}
              </td>
              <td class="px-6 py-4">
                <code
                  class="rounded px-2 py-1 text-xs ui-panel ui-muted"
                >
                  {key}
                </code>
              </td>
              <td class="px-6 py-4">
                {#if value === true}
                  <span
                    class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ui-tone-success"
                    data-state="enabled"
                  >
                    Enabled
                  </span>
                {:else}
                  <span
                    class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ui-panel ui-muted"
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
