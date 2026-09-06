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


  interface ConnectorMetric {
    connector_name: string;
    function_name: string;
    correlation_id: string;
    date: string;
    duration: number;
  }

  let { data } = $props();

  const apiExplorerUrl =
    $page.data.externalLinks?.API_EXPLORER_URL ||
    "https://apiexplorer-ii-sandbox.openbankproject.com";

  const apiExplorerConnectorMetricsUrl = `${apiExplorerUrl}/resource-docs/OBPv6.0.0?operationid=OBPv2.2.0-getConnectorMetrics`;

  let obpInfo = $derived(configHelpers.getObpConnectionInfo());

  // State
  let metrics = $state<ConnectorMetric[]>([]);
  let rawResponse = $state<any>(null);
  let isLoading = $state(false);
  let loadError = $state("");
  let lastRefreshTime = $state("");
  let lastCorrelationId = $state("N/A");
  let showRawJson = $state(false);

  // Auto refresh
  let autoRefresh = $state("60");
  let countdown = $state(60);
  let countdownInterval: number | undefined = undefined;
  let timeUpdateInterval: number | undefined = undefined;
  let currentTimeUTC = $state(new Date().toISOString().replace("T", " ").slice(0, 19));
  let timestampColorIndex = $state(0);
  let autoRefreshPaused = $state(false);
  let consecutiveErrors = $state(0);

  // Query form
  let queryForm = $state({
    from_date: "",
    to_date: "",
    limit: "50",
    offset: "0",
    connector_name: "",
    function_name: "",
    correlation_id: "",
  });

  // Search filter for table
  let searchQuery = $state("");

  // Derived filtered metrics
  const filteredMetrics = $derived(
    metrics.filter((metric) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        metric.connector_name?.toLowerCase().includes(query) ||
        metric.function_name?.toLowerCase().includes(query) ||
        metric.correlation_id?.toLowerCase().includes(query)
      );
    })
  );

  // Build query string
  let currentQueryString = $derived.by(() => {
    const params = new URLSearchParams();

    if (queryForm.from_date?.trim()) {
      params.set("from_date", formatDateForAPI(queryForm.from_date));
    }
    if (queryForm.to_date?.trim()) {
      params.set("to_date", formatDateForAPI(queryForm.to_date));
    }
    if (queryForm.connector_name?.trim()) {
      params.set("connector_name", queryForm.connector_name);
    }
    if (queryForm.function_name?.trim()) {
      params.set("function_name", queryForm.function_name);
    }
    if (queryForm.correlation_id?.trim()) {
      params.set("correlation_id", queryForm.correlation_id);
    }

    params.set("limit", queryForm.limit);
    params.set("offset", queryForm.offset);

    return params.toString();
  });

  function formatDateForAPI(dateString: string): string {
    if (!dateString || dateString.trim() === "") return "";
    if (dateString.endsWith("Z")) return dateString;
    const date = new Date(dateString);
    return date.toISOString();
  }

  async function refreshMetrics() {
    isLoading = true;
    lastRefreshTime = new Date().toLocaleString();
    timestampColorIndex = (timestampColorIndex + 1) % 2;

    try {
      const response = await trackedFetch(`/backend/connector-metrics?${currentQueryString}`);
      const responseData = await response.json();
      lastCorrelationId = responseData.correlation_id || "N/A";

      // Always store the raw response for debugging
      rawResponse = responseData;

      if (responseData.message) {
        loadError = responseData.message;
        metrics = [];
        // Increment error count and pause auto-refresh after errors
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
        metrics = responseData.metrics || [];
        // Reset error count on success and resume auto-refresh if it was paused
        consecutiveErrors = 0;
        if (autoRefreshPaused) {
          autoRefreshPaused = false;
          startAutoRefresh();
        }
      }
    } catch (err) {
      console.error("Error fetching connector metrics:", err);
      loadError = err instanceof Error ? err.message : "Failed to fetch connector metrics";
      rawResponse = { error: loadError, type: "NetworkError", timestamp: new Date().toISOString() };
      metrics = [];
      // Pause auto-refresh on error
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
        refreshMetrics();
        countdown = refreshSeconds;
      }
    }, 1000);
  }

  function resumeAutoRefresh() {
    autoRefreshPaused = false;
    consecutiveErrors = 0;
    loadError = "";
    startAutoRefresh();
    refreshMetrics();
  }

  function clearFilters() {
    queryForm = {
      from_date: "",
      to_date: "",
      limit: "50",
      offset: "0",
      connector_name: "",
      function_name: "",
      correlation_id: "",
    };
    searchQuery = "";
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return dateString;
    }
  }

  function formatDuration(duration: number): string {
    if (duration === undefined || duration === null) return "N/A";
    if (duration < 1000) return `${duration.toFixed(2)}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  }

  function getDurationClass(duration: number): string {
    if (duration < 100) return "duration-fast";
    if (duration < 500) return "duration-medium";
    return "duration-slow";
  }

  // Initialize
  let initialized = $state(false);

  $effect(() => {
    if (typeof window !== "undefined" && !initialized) {
      initialized = true;

      // Set default from_date to current time
      queryForm.from_date = new Date().toISOString().slice(0, 16);

      refreshMetrics();
      startAutoRefresh();

      timeUpdateInterval = setInterval(() => {
        currentTimeUTC = new Date().toISOString().replace("T", " ").slice(0, 19);
      }, 1000);
    }
  });

  $effect(() => {
    // Restart auto-refresh when autoRefresh setting changes
    if (initialized) {
      startAutoRefresh();
    }
  });

  $effect(() => {
    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
      if (timeUpdateInterval) clearInterval(timeUpdateInterval);
    };
  });
</script>

<svelte:head>
  <title>Connector Metrics - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        Connector Metrics
      </h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        Monitor backend connector performance and response times
      </p>
    </div>
    <a
      href={apiExplorerConnectorMetricsUrl}
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center rounded-lg border border-purple-300 bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 dark:border-purple-600 dark:bg-purple-500 dark:hover:bg-purple-600"
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
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <div class="flex items-start">
        <svg class="mr-3 h-5 w-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="font-semibold text-red-800 dark:text-red-300">Error Loading Connector Metrics</h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-400">{loadError}</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Raw JSON Response Toggle -->
  {#if rawResponse !== null}
    <div class="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <button
        type="button"
        onclick={() => showRawJson = !showRawJson}
        class="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
      >
        <div class="flex items-center gap-2">
          <svg class="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span class="font-medium text-gray-900 dark:text-gray-100">Raw OBP API Response</span>
          {#if loadError}
            <span class="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
              Error
            </span>
          {:else}
            <span class="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Success
            </span>
          {/if}
        </div>
        <svg
          class="h-5 w-5 text-gray-500 transition-transform {showRawJson ? 'rotate-180' : ''}"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {#if showRawJson}
        <div class="border-t border-gray-200 p-4 dark:border-gray-700">
          <pre class="max-h-96 overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-green-400 dark:bg-gray-950">{JSON.stringify(rawResponse, null, 2)}</pre>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Query Panel -->
  <div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Query Filters</h2>
      <div class="text-sm text-gray-600 dark:text-gray-400">
        Current Date Time (UTC): <strong>{currentTimeUTC}</strong>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- From Date -->
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">From Date</label>
        <input
          type="datetime-local"
          bind:value={queryForm.from_date}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <!-- To Date -->
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">To Date</label>
        <input
          type="datetime-local"
          bind:value={queryForm.to_date}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <!-- Connector Name -->
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Connector Name</label>
        <input
          type="text"
          bind:value={queryForm.connector_name}
          placeholder="e.g., mapped"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <!-- Function Name -->
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Function Name</label>
        <input
          type="text"
          bind:value={queryForm.function_name}
          placeholder="e.g., getBanks"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <!-- Correlation ID -->
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Correlation ID</label>
        <input
          type="text"
          bind:value={queryForm.correlation_id}
          placeholder="Filter by correlation ID"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <!-- Limit -->
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Limit</label>
        <select
          bind:value={queryForm.limit}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        >
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200">200</option>
          <option value="500">500</option>
        </select>
      </div>

      <!-- Auto Refresh -->
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Auto Refresh</label>
        <select
          bind:value={autoRefresh}
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        >
          <option value="5">5 seconds</option>
          <option value="10">10 seconds</option>
          <option value="30">30 seconds</option>
          <option value="60">60 seconds</option>
          <option value="none">Disabled</option>
        </select>
      </div>

      <!-- Actions -->
      <div class="flex items-end gap-2">
        <button
          onclick={refreshMetrics}
          disabled={isLoading}
          class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {#if isLoading}
            <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          {/if}
          Refresh
        </button>
        <button
          onclick={clearFilters}
          class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Query URL Display -->
    <div class="mt-4 text-xs text-gray-500 dark:text-gray-400">
      <strong>URL:</strong> {obpInfo.baseUrl}/obp/v6.0.0/management/connector/metrics?{decodeURIComponent(currentQueryString)}
    </div>
  </div>

  <!-- Results Panel -->
  <div class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div class="border-b border-gray-200 p-4 dark:border-gray-700">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Connector Metrics Results
            {#if metrics.length > 0}
              <span class="ml-2 text-sm font-normal text-gray-500">({filteredMetrics.length} of {metrics.length})</span>
            {/if}
          </h2>
          <div class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Last updated: <span class="timestamp-color-{timestampColorIndex}">{lastRefreshTime}</span>
            •
            {#if autoRefreshPaused}
              <span class="text-red-500 font-medium">Auto-refresh paused (error)</span>
              <button
                onclick={resumeAutoRefresh}
                class="ml-2 text-xs text-blue-600 hover:text-blue-800 underline dark:text-blue-400"
              >
                Resume
              </button>
            {:else if autoRefresh === "none"}
              <span class="text-gray-500">Auto-refresh disabled</span>
            {:else}
              <span class="text-orange-500">Refreshing in {countdown}s</span>
            {/if}
            •
            <span class="font-mono text-xs">Correlation ID: {lastCorrelationId}</span>
          </div>
        </div>

        <!-- Table Search -->
        <div class="relative">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Filter results..."
            class="w-64 rounded-lg border border-gray-300 px-4 py-2 pl-10 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
    </div>

    <div class="p-4">
      {#if isLoading && metrics.length === 0}
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <svg class="mb-4 h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p class="text-gray-600 dark:text-gray-400">Loading connector metrics...</p>
        </div>
      {:else if filteredMetrics.length === 0}
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <svg class="mb-4 h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">No Connector Metrics Found</h3>
          <p class="text-gray-600 dark:text-gray-400">
            {#if searchQuery}
              No metrics match your filter. Try adjusting your search.
            {:else}
              No connector metrics found for the selected time range.
            {/if}
          </p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Connector</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Function</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Correlation ID</th>
                <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Duration</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {#each filteredMetrics as metric}
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td class="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">
                    {formatDate(metric.date)}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm">
                    <span class="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                      {metric.connector_name || "N/A"}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">
                    {metric.function_name || "N/A"}
                  </td>
                  <td class="px-4 py-3 text-sm">
                    <span class="rounded bg-purple-100 px-2 py-0.5 font-mono text-xs text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                      {metric.correlation_id ? (metric.correlation_id.length > 20 ? metric.correlation_id.substring(0, 20) + "..." : metric.correlation_id) : "N/A"}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <span class="rounded px-2 py-0.5 font-mono text-xs font-medium {getDurationClass(metric.duration)}">
                      {formatDuration(metric.duration)}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Results Summary -->
        <div class="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
          <div class="text-sm text-gray-700 dark:text-gray-300">
            Showing <span class="font-medium">{filteredMetrics.length}</span>
            of
            <span class="font-medium">{metrics.length}</span>
            connector metrics from <span class="font-medium">{obpInfo.displayName}</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .timestamp-color-0 {
    color: #6366f1;
    font-weight: 600;
  }

  .timestamp-color-1 {
    color: #10b981;
    font-weight: 600;
  }

  .duration-fast {
    background-color: #d1fae5;
    color: #065f46;
  }

  :global([data-mode="dark"]) .duration-fast {
    background-color: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
  }

  .duration-medium {
    background-color: #fef3c7;
    color: #92400e;
  }

  :global([data-mode="dark"]) .duration-medium {
    background-color: rgba(245, 158, 11, 0.2);
    color: #fcd34d;
  }

  .duration-slow {
    background-color: #fee2e2;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .duration-slow {
    background-color: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }
</style>
