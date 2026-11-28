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
  import { page } from "$app/stores";
  import { configHelpers } from "$lib/config";
  import { trackedFetch } from "$lib/utils/trackedFetch";


  interface ConnectorCount {
    connector_name: string;
    method_name: string;
    per_hour_outbound_count: number;
    per_hour_inbound_success_count: number;
    per_hour_inbound_failure_count: number;
    ttl_seconds: number;
  }

  let { data } = $props();

  const apiExplorerUrl =
    $page.data.externalLinks?.API_EXPLORER_URL ||
    "https://apiexplorer-ii-sandbox.openbankproject.com";

  const apiExplorerEndpointUrl = `${apiExplorerUrl}/resource-docs/OBPv6.0.0?operationid=OBPv6.0.0-getConnectorCallCounts`;

  let obpInfo = $derived(configHelpers.getObpConnectionInfo());

  // State
  let counts = $state<ConnectorCount[]>([]);
  let rawResponse = $state<any>(null);
  let isLoading = $state(false);
  let loadError = $state("");
  let lastRefreshTime = $state("");
  let lastCorrelationId = $state("N/A");
  let showRawJson = $state(false);

  // Auto refresh
  let autoRefresh = $state("60");
  let countdown = $state(60);
  let countdownInterval: ReturnType<typeof setInterval> | undefined = undefined;
  let timestampColorIndex = $state(0);
  let autoRefreshPaused = $state(false);
  let consecutiveErrors = $state(0);

  // Search filter
  let searchQuery = $state("");

  // Derived filtered counts
  const filteredCounts = $derived(
    counts.filter((c) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        c.connector_name?.toLowerCase().includes(query) ||
        c.method_name?.toLowerCase().includes(query)
      );
    })
  );

  // Summary stats
  let totalOutbound = $derived(filteredCounts.reduce((sum, c) => sum + (c.per_hour_outbound_count || 0), 0));
  let totalSuccess = $derived(filteredCounts.reduce((sum, c) => sum + (c.per_hour_inbound_success_count || 0), 0));
  let totalFailure = $derived(filteredCounts.reduce((sum, c) => sum + (c.per_hour_inbound_failure_count || 0), 0));

  async function refreshCounts() {
    isLoading = true;
    lastRefreshTime = new Date().toLocaleString(undefined, { hourCycle: "h23" });
    timestampColorIndex = (timestampColorIndex + 1) % 2;

    try {
      const response = await trackedFetch(`/proxy/obp/v6.0.0/management/connector/metrics/counts`);
      const correlationId =
        response.headers.get("X-Correlation-Id") ||
        response.headers.get("x-correlation-id") ||
        "N/A";
      lastCorrelationId = correlationId;

      const responseData = await response.json();
      rawResponse = responseData;

      if (responseData.message) {
        loadError = responseData.message;
        counts = [];
        consecutiveErrors++;
        if (consecutiveErrors >= 1) {
          autoRefreshPaused = true;
          if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = undefined;
          }
        }
      } else {
        loadError = "";
        counts = responseData.connector_counts || [];
        consecutiveErrors = 0;
        if (autoRefreshPaused) {
          autoRefreshPaused = false;
          startAutoRefresh();
        }
      }
    } catch (err) {
      console.error("Error fetching connector counts:", err);
      loadError = err instanceof Error ? err.message : "Failed to fetch connector counts";
      rawResponse = { error: loadError, type: "NetworkError", timestamp: new Date().toISOString() };
      counts = [];
      consecutiveErrors++;
      autoRefreshPaused = true;
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = undefined;
      }
    } finally {
      isLoading = false;
    }
  }

  function startAutoRefresh() {
    if (autoRefreshPaused || autoRefresh === "none") return;

    const refreshSeconds = parseInt(autoRefresh);
    countdown = refreshSeconds;

    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
      if (autoRefreshPaused) return;
      countdown--;
      if (countdown <= 0) {
        refreshCounts();
        countdown = refreshSeconds;
      }
    }, 1000);
  }

  function resumeAutoRefresh() {
    autoRefreshPaused = false;
    consecutiveErrors = 0;
    loadError = "";
    startAutoRefresh();
    refreshCounts();
  }

  function getFailureRateClass(success: number, failure: number): string {
    if (failure === 0) return "rate-good";
    const total = success + failure;
    if (total === 0) return "rate-good";
    const rate = failure / total;
    if (rate < 0.05) return "rate-good";
    if (rate < 0.2) return "rate-warn";
    return "rate-bad";
  }

  // Initialize
  let initialized = $state(false);

  $effect(() => {
    if (typeof window !== "undefined" && !initialized) {
      initialized = true;
      refreshCounts();
      startAutoRefresh();
    }
  });

  $effect(() => {
    if (initialized) {
      startAutoRefresh();
    }
  });

  $effect(() => {
    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };
  });
</script>

<svelte:head>
  <title>Connector Counts - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold ui-text">
        Connector Counts
      </h1>
      <p class="mt-1 ui-muted">
        Per-hour Redis counters for connector outbound and inbound messages (rolling window)
      </p>
    </div>
    <a
      href={apiExplorerEndpointUrl}
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium preset-filled-primary-500"
      title="Open in API Explorer"
    >
      <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      API Explorer
    </a>
  </div>

  <!-- Error Message -->
  {#if loadError}
    <div class="mb-6 rounded-lg border p-4 ui-tone-error">
      <div class="flex items-start">
        <svg class="mr-3 h-5 w-5 ui-text-error" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="font-semibold ui-text-error">Error Loading Connector Counts</h3>
          <p class="mt-1 text-sm ui-text-error">{loadError}</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Raw JSON Response Toggle -->
  {#if rawResponse !== null}
    <div class="mb-6 rounded-lg border shadow-sm ui-card ui-border">
      <button
        type="button"
        onclick={() => showRawJson = !showRawJson}
        class="flex w-full items-center justify-between p-4 text-left ui-hover"
      >
        <div class="flex items-center gap-2">
          <svg class="h-5 w-5 ui-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span class="font-medium ui-text">Raw OBP API Response</span>
          {#if loadError}
            <span class="rounded px-2 py-0.5 text-xs font-medium ui-tone-error">
              Error
            </span>
          {:else}
            <span class="rounded px-2 py-0.5 text-xs font-medium ui-tone-success">
              Success
            </span>
          {/if}
        </div>
        <svg
          class="h-5 w-5 transition-transform ui-muted {showRawJson ? 'rotate-180' : ''}"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {#if showRawJson}
        <div class="border-t p-4 ui-border">
          <pre class="max-h-96 overflow-auto rounded-lg p-4 text-xs ui-text-success ui-panel">{JSON.stringify(rawResponse, null, 2)}</pre>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Controls -->
  <div class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h2 class="text-lg font-semibold ui-text">Controls</h2>
      <div class="flex items-center gap-4">
        <!-- Auto Refresh -->
        <div class="flex items-center gap-2">
          <label class="text-sm font-medium ui-muted">Auto Refresh</label>
          <select
            bind:value={autoRefresh}
            class="rounded-lg border px-3 py-2 text-sm ui-panel ui-text ui-border"
          >
            <option value="10">10 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">60 seconds</option>
            <option value="none">Disabled</option>
          </select>
        </div>

        <button
          onclick={refreshCounts}
          disabled={isLoading}
          class="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 preset-filled-primary-500"
        >
          {#if isLoading}
            <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          {/if}
          Refresh
        </button>
      </div>
    </div>

    <!-- Query URL Display -->
    <div class="mt-4 text-xs ui-muted">
      <strong>URL:</strong> {obpInfo.baseUrl}/obp/v6.0.0/management/connector/metrics/counts
    </div>
  </div>

  <!-- Summary Stats -->
  {#if counts.length > 0}
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div class="rounded-lg border p-4 shadow-sm ui-card ui-border">
        <div class="text-sm font-medium ui-muted">Methods</div>
        <div class="mt-1 text-2xl font-bold ui-text">{filteredCounts.length}</div>
      </div>
      <div class="rounded-lg border p-4 shadow-sm ui-card ui-border">
        <div class="text-sm font-medium ui-muted">Outbound (per hour)</div>
        <div class="mt-1 text-2xl font-bold ui-link">{totalOutbound}</div>
      </div>
      <div class="rounded-lg border p-4 shadow-sm ui-card ui-border">
        <div class="text-sm font-medium ui-muted">Inbound Success (per hour)</div>
        <div class="mt-1 text-2xl font-bold ui-text-success">{totalSuccess}</div>
      </div>
      <div class="rounded-lg border p-4 shadow-sm ui-card ui-border">
        <div class="text-sm font-medium ui-muted">Inbound Failure (per hour)</div>
        <div class="mt-1 text-2xl font-bold {totalFailure > 0 ? 'ui-text-error' : 'ui-text'}">{totalFailure}</div>
      </div>
    </div>
  {/if}

  <!-- Results Panel -->
  <div class="rounded-lg border shadow-sm ui-card ui-border">
    <div class="border-b p-4 ui-border">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold ui-text">
            Connector Call Counts
            {#if counts.length > 0}
              <span class="ml-2 text-sm font-normal ui-muted">({filteredCounts.length} of {counts.length})</span>
            {/if}
          </h2>
          <div class="mt-1 text-sm ui-muted">
            Last updated: <span class="timestamp-color-{timestampColorIndex}">{lastRefreshTime}</span>
            &bull;
            {#if autoRefreshPaused}
              <span class="font-medium ui-text-error">Auto-refresh paused (error)</span>
              <button
                onclick={resumeAutoRefresh}
                class="ml-2 text-xs underline ui-link"
              >
                Resume
              </button>
            {:else if autoRefresh === "none"}
              <span class="ui-muted">Auto-refresh disabled</span>
            {:else}
              <span class="ui-text-warning">Refreshing in {countdown}s</span>
            {/if}
            &bull;
            <span class="font-mono text-xs">Correlation ID: {lastCorrelationId}</span>
          </div>
        </div>

        <!-- Table Search -->
        <div class="relative">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Filter by connector or method..."
            class="w-72 rounded-lg border px-4 py-2 pl-10 text-sm ui-panel ui-text ui-border"
          />
          <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ui-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
    </div>

    <div class="p-4">
      {#if isLoading && counts.length === 0}
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <svg class="mb-4 h-8 w-8 animate-spin ui-link" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p class="ui-muted">Loading connector counts...</p>
        </div>
      {:else if filteredCounts.length === 0}
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <svg class="mb-4 h-16 w-16 ui-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 class="mb-2 text-lg font-semibold ui-text">No Connector Counts Found</h3>
          <p class="ui-muted">
            {#if searchQuery}
              No counts match your filter. Try adjusting your search.
            {:else}
              No connector call counts available. Requires <code class="rounded px-1 ui-panel">write_connector_metrics_redis=true</code>.
            {/if}
          </p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y ui-border">
            <thead class="ui-card">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Connector</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Method</th>
                <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ui-muted">Outbound</th>
                <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ui-muted">Inbound Success</th>
                <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ui-muted">Inbound Failure</th>
                <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ui-muted">TTL (s)</th>
              </tr>
            </thead>
            <tbody class="divide-y ui-card ui-border">
              {#each filteredCounts as item, i (`${item.connector_name}-${item.method_name}-${i}`)}
                <tr class="ui-hover">
                  <td class="whitespace-nowrap px-4 py-3 text-sm">
                    <span class="rounded px-2 py-0.5 font-medium ui-tone-info">
                      {item.connector_name || "N/A"}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm font-mono ui-text">
                    {item.method_name || "N/A"}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-right text-sm font-mono font-medium ui-link">
                    {item.per_hour_outbound_count ?? 0}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-right text-sm font-mono font-medium ui-text-success">
                    {item.per_hour_inbound_success_count ?? 0}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <span class="rounded px-2 py-0.5 font-mono font-medium {getFailureRateClass(item.per_hour_inbound_success_count, item.per_hour_inbound_failure_count)}">
                      {item.per_hour_inbound_failure_count ?? 0}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-right text-sm font-mono ui-muted">
                    {item.ttl_seconds ?? "N/A"}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Results Summary -->
        <div class="mt-4 flex items-center justify-between border-t pt-4 ui-border">
          <div class="text-sm ui-muted">
            Showing <span class="font-medium">{filteredCounts.length}</span>
            of
            <span class="font-medium">{counts.length}</span>
            connector call counts from <span class="font-medium">{obpInfo.displayName}</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .timestamp-color-0 {
    color: var(--ui-link);
    font-weight: 600;
  }

  .timestamp-color-1 {
    color: var(--ui-success);
    font-weight: 600;
  }

  .rate-good {
    background-color: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .rate-warn {
    background-color: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
  }

  .rate-bad {
    background-color: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
  }
</style>
