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
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { invalidate } from "$app/navigation";
  import type { PageData } from "./$types";
  import { configHelpers } from "$lib/config";

  export let data: PageData;

  $: recentMetrics = data.recentMetrics;
  $: queryMetrics = data.queryMetrics;
  $: hasApiAccess = data.hasApiAccess;
  $: error = data.error;

  // Debug reactive statements
  $: {
    if (recentMetrics) {
      console.log("📊 recentMetrics updated:", {
        count: recentMetrics.count,
        metricsLength: recentMetrics.metrics?.length,
        timestamp: new Date().toLocaleTimeString(),
        firstMetricDate: recentMetrics.metrics?.[0]?.date,
        lastMetricDate:
          recentMetrics.metrics?.[recentMetrics.metrics.length - 1]?.date,
      });
    }
  }

  // Debug data prop changes
  $: {
    console.log("📦 data prop updated:", {
      hasRecentMetrics: !!data.recentMetrics,
      recentMetricsCount: data.recentMetrics?.count,
      lastUpdated: data.lastUpdated,
      timestamp: new Date().toLocaleTimeString(),
    });
  }

  let refreshInterval: NodeJS.Timeout;
  let countdownInterval: NodeJS.Timeout;
  let currentTime = new Date().toLocaleString();
  let lastRefreshTime = new Date().toLocaleString();
  let countdown = 5;
  let isCountingDown = false;
  let timestampColorIndex = 0;

  // Configuration information
  $: obpInfo = configHelpers.getObpConnectionInfo();

  // Form data for query panel
  let queryForm = {
    from_date: "",
    to_date: "",
    limit: "100",
    offset: "0",
    sort_by: "date",
    direction: "desc",
    consumer_id: "",
    user_id: "",
    user_name: "",
    anon: "",
    url: "",
    app_name: "",
    implemented_by_partial_function: "",
    implemented_in_version: "",
    verb: "",
    correlation_id: "",
    duration: "",
  };

  onMount(() => {
    // Initialize form values from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    queryForm = {
      from_date: urlParams.get("from_date") || "",
      to_date: urlParams.get("to_date") || "",
      limit: urlParams.get("limit") || "100",
      offset: urlParams.get("offset") || "0",
      sort_by: urlParams.get("sort_by") || "date",
      direction: urlParams.get("direction") || "desc",
      consumer_id: urlParams.get("consumer_id") || "",
      user_id: urlParams.get("user_id") || "",
      user_name: urlParams.get("user_name") || "",
      anon: urlParams.get("anon") || "",
      url: urlParams.get("url") || "",
      app_name: urlParams.get("app_name") || "",
      implemented_by_partial_function:
        urlParams.get("implemented_by_partial_function") || "",
      implemented_in_version: urlParams.get("implemented_in_version") || "",
      verb: urlParams.get("verb") || "",
      correlation_id: urlParams.get("correlation_id") || "",
      duration: urlParams.get("duration") || "",
    };

    startAutoRefresh();

    // Update current time every second
    setInterval(() => {
      currentTime = new Date().toLocaleString();
    }, 1000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
  });

  function refreshRecentMetrics() {
    console.log(
      "🔄 refreshRecentMetrics called at",
      new Date().toLocaleTimeString(),
    );
    console.log("Current queryForm.limit:", queryForm.limit);
    console.log("Current recentMetrics count:", recentMetrics?.count);
    console.log(
      "Current recentMetrics length:",
      recentMetrics?.metrics?.length,
    );

    // Update last refresh timestamp and alternate color
    lastRefreshTime = new Date().toLocaleString();
    timestampColorIndex = (timestampColorIndex + 1) % 2;

    // Update URL with Query Metrics form parameters without navigation
    const params = new URLSearchParams();

    // Add date filters only if they have values
    if (queryForm.from_date && queryForm.from_date.trim() !== "") {
      params.set("from_date", queryForm.from_date);
    }
    if (queryForm.to_date && queryForm.to_date.trim() !== "") {
      params.set("to_date", queryForm.to_date);
    }

    // Add other filters if they have values
    if (queryForm.verb && queryForm.verb.trim() !== "") {
      params.set("verb", queryForm.verb);
    }
    if (queryForm.app_name && queryForm.app_name.trim() !== "") {
      params.set("app_name", queryForm.app_name);
    }
    if (queryForm.user_name && queryForm.user_name.trim() !== "") {
      params.set("user_name", queryForm.user_name);
    }
    if (queryForm.url && queryForm.url.trim() !== "") {
      params.set("url", queryForm.url);
    }
    if (queryForm.consumer_id && queryForm.consumer_id.trim() !== "") {
      params.set("consumer_id", queryForm.consumer_id);
    }
    if (queryForm.anon && queryForm.anon.trim() !== "") {
      params.set("anon", queryForm.anon);
    }

    // Always include pagination and sorting for Recent API Calls
    params.set("limit", queryForm.limit);
    params.set("offset", queryForm.offset);
    params.set("sort_by", queryForm.sort_by);
    params.set("direction", queryForm.direction);

    // Update URL without navigation and trigger data refresh
    const newUrl = window.location.pathname + "?" + params.toString();
    console.log("🌐 Updating URL to:", newUrl);
    console.log("📋 Params being sent:", params.toString());
    window.history.replaceState({}, "", newUrl);
    console.log("🔄 Calling invalidate('app:metrics')");
    invalidate("app:metrics").then(() => {
      console.log("✅ invalidate completed");
      console.log("New recentMetrics count:", recentMetrics?.count);
      console.log("New recentMetrics length:", recentMetrics?.metrics?.length);
    });
  }

  function submitQuery() {
    const params = new URLSearchParams();

    Object.entries(queryForm).forEach(([key, value]) => {
      if (value && value.trim() !== "") {
        params.append(key, value);
      }
    });

    goto(`/metrics?${params.toString()}`);
  }

  function getCurrentQueryString() {
    const params = new URLSearchParams();

    // Add date filters only if they have values
    if (queryForm.from_date && queryForm.from_date.trim() !== "") {
      params.set("from_date", queryForm.from_date);
    }
    if (queryForm.to_date && queryForm.to_date.trim() !== "") {
      params.set("to_date", queryForm.to_date);
    }

    // Add other filters if they have values
    if (queryForm.verb && queryForm.verb.trim() !== "") {
      params.set("verb", queryForm.verb);
    }
    if (queryForm.app_name && queryForm.app_name.trim() !== "") {
      params.set("app_name", queryForm.app_name);
    }
    if (queryForm.user_name && queryForm.user_name.trim() !== "") {
      params.set("user_name", queryForm.user_name);
    }
    if (queryForm.url && queryForm.url.trim() !== "") {
      params.set("url", queryForm.url);
    }
    if (queryForm.consumer_id && queryForm.consumer_id.trim() !== "") {
      params.set("consumer_id", queryForm.consumer_id);
    }
    if (queryForm.anon && queryForm.anon.trim() !== "") {
      params.set("anon", queryForm.anon);
    }

    // Always include pagination and sorting
    params.set("limit", queryForm.limit);
    params.set("offset", queryForm.offset);
    params.set("sort_by", queryForm.sort_by);
    params.set("direction", queryForm.direction);

    return params.toString();
  }

  function startAutoRefresh() {
    // Start 5-second auto-refresh cycle
    countdown = 5;
    isCountingDown = true;

    if (refreshInterval) clearInterval(refreshInterval);
    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        refreshRecentMetrics();
        countdown = 5;
      }
    }, 1000);
  }

  function handleFieldChange() {
    // Reset countdown to 3 seconds when field changes
    countdown = 3;
    isCountingDown = true;

    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        refreshRecentMetrics();
        startAutoRefresh(); // Resume normal 5-second cycle
      }
    }, 1000);
  }

  function clearQuery() {
    queryForm = {
      from_date: "",
      to_date: "",
      limit: "100",
      offset: "0",
      sort_by: "date",
      direction: "desc",
      consumer_id: "",
      user_id: "",
      user_name: "",
      anon: "",
      url: "",
      app_name: "",
      implemented_by_partial_function: "",
      implemented_in_version: "",
      verb: "",
      correlation_id: "",
      duration: "",
    };

    // Reset default date range
  }

  function formatDuration(duration: number): string {
    if (duration < 1000) {
      return `${duration}ms`;
    }
    return `${(duration / 1000).toFixed(2)}s`;
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  function getVerbColor(verb: string): string {
    switch (verb.toUpperCase()) {
      case "GET":
        return "text-green-600 bg-green-50";
      case "POST":
        return "text-blue-600 bg-blue-50";
      case "PUT":
        return "text-yellow-600 bg-yellow-50";
      case "DELETE":
        return "text-red-600 bg-red-50";
      case "PATCH":
        return "text-purple-600 bg-purple-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  }
</script>

<svelte:head>
  <title>API Metrics - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Navigation Breadcrumb -->
  <nav class="breadcrumb mb-8">
    <a href="/" class="breadcrumb-link">Home</a>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">Metrics</span>
  </nav>

  <!-- Error Alert -->
  {#if error && !hasApiAccess}
    <div class="alert alert-error mb-6">
      <strong>Error:</strong>
      {error} - Unable to fetch metrics data.
    </div>
  {/if}

  <!-- Panel 1: Query Interface -->
  <div class="panel full-width-panel">
    <div class="panel-header">
      <h2 class="panel-title">Query Metrics</h2>
      <div class="panel-subtitle">
        Search and filter API metrics with custom parameters
      </div>
    </div>

    <div class="panel-content">
      <!-- Query Form -->
      <form on:submit|preventDefault={submitQuery} class="query-form">
        <div class="form-section">
          <h3 class="form-section-title">Query Parameters</h3>
          <div class="form-row">
            <div class="form-field date-field">
              <label for="from_date">From Date</label>
              <input
                type="datetime-local"
                id="from_date"
                bind:value={queryForm.from_date}
                on:blur={handleFieldChange}
                class="form-input"
              />
            </div>
            <div class="form-field date-field">
              <label for="to_date">To Date</label>
              <input
                type="datetime-local"
                id="to_date"
                bind:value={queryForm.to_date}
                on:blur={handleFieldChange}
                class="form-input"
              />
            </div>
            <div class="form-field narrow-field">
              <label for="limit">Limit</label>
              <input
                type="number"
                id="limit"
                bind:value={queryForm.limit}
                min="1"
                max="10000"
                on:blur={handleFieldChange}
                class="form-input"
              />
            </div>
            <div class="form-field narrow-field">
              <label for="offset">Offset</label>
              <input
                type="number"
                id="offset"
                bind:value={queryForm.offset}
                min="0"
                on:blur={handleFieldChange}
                class="form-input"
              />
            </div>
            <div class="form-field">
              <label for="sort_by">Sort By</label>
              <select
                id="sort_by"
                bind:value={queryForm.sort_by}
                on:change={handleFieldChange}
                class="form-input"
              >
                <option value="date">Date</option>
                <option value="url">URL</option>
                <option value="user_name">User Name</option>
                <option value="app_name">App Name</option>
                <option value="verb">HTTP Method</option>
                <option value="duration">Duration</option>
              </select>
            </div>
            <div class="form-field narrow-field">
              <label for="direction">Direction</label>
              <select
                id="direction"
                bind:value={queryForm.direction}
                on:change={handleFieldChange}
                class="form-input"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="verb">HTTP Method</label>
              <select
                id="verb"
                bind:value={queryForm.verb}
                on:change={handleFieldChange}
                class="form-input"
              >
                <option value="">All Methods</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
            <div class="form-field">
              <label for="app_name">App Name</label>
              <input
                type="text"
                id="app_name"
                bind:value={queryForm.app_name}
                placeholder="Filter by app name"
                on:blur={handleFieldChange}
                class="form-input"
              />
            </div>
            <div class="form-field">
              <label for="user_name">User</label>
              <input
                type="text"
                id="user_name"
                bind:value={queryForm.user_name}
                placeholder="Filter by user"
                on:blur={handleFieldChange}
                class="form-input"
              />
            </div>
            <div class="form-field">
              <label for="url">URL Contains</label>
              <input
                type="text"
                id="url"
                bind:value={queryForm.url}
                placeholder="Filter by URL"
                on:blur={handleFieldChange}
                class="form-input"
              />
            </div>
            <div class="form-field">
              <label for="consumer_id">Consumer ID</label>
              <input
                type="text"
                id="consumer_id"
                bind:value={queryForm.consumer_id}
                placeholder="Filter by consumer ID"
                on:blur={handleFieldChange}
                class="form-input"
              />
            </div>
            <div class="form-field">
              <label for="anon">Anonymous</label>
              <select
                id="anon"
                bind:value={queryForm.anon}
                on:change={handleFieldChange}
                class="form-input"
              >
                <option value="">All Users</option>
                <option value="true">Anonymous Only</option>
                <option value="false">Authenticated Only</option>
              </select>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" on:click={clearQuery}>
            🗑️ Clear Form
          </button>
        </div>
      </form>

      <!-- Query Results -->
      {#if queryMetrics}
        <div class="query-results">
          <div class="results-header">
            <h3>Query Results</h3>
            <span class="results-count">
              {queryMetrics.count} results found
            </span>
          </div>

          {#if queryMetrics.metrics && queryMetrics.metrics.length > 0}
            <div class="metrics-table-container">
              <table class="metrics-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th>URL</th>
                    <th>User</th>
                    <th>App</th>
                    <th>Duration</th>
                    <th>Version</th>
                    <th>Correlation ID</th>
                  </tr>
                </thead>
                <tbody>
                  {#each queryMetrics.metrics as metric}
                    <tr>
                      <td class="time-cell">
                        {formatDate(metric.date)}
                      </td>
                      <td>
                        <span class="verb-badge {getVerbColor(metric.verb)}">
                          {metric.verb}
                        </span>
                      </td>
                      <td class="url-cell" title={metric.url}>
                        {metric.url.length > 50
                          ? metric.url.substring(0, 50) + "..."
                          : metric.url}
                      </td>
                      <td class="user-cell">
                        {metric.user_name || "Anonymous"}
                      </td>
                      <td class="app-cell">
                        {metric.app_name || "N/A"}
                      </td>
                      <td class="duration-cell">
                        {formatDuration(metric.duration)}
                      </td>
                      <td class="version-cell">
                        {metric.implemented_in_version || "N/A"}
                      </td>
                      <td class="correlation-cell">
                        <code class="correlation-id"
                          >{metric.correlation_id || "N/A"}</code
                        >
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <div class="empty-state">
              <p>No results found for your query. Try adjusting the filters.</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Panel 2: Real-time Recent API Calls -->
  <div class="panel full-width-panel">
    <div class="panel-header">
      <h2 class="panel-title">Recent API Calls</h2>
      <div class="panel-subtitle">
        URL: {obpInfo.apiUrl}/obp/v5.1.0/management/metrics?{getCurrentQueryString()}
        • Last updated:
        <span class="timestamp-color-{timestampColorIndex}"
          >{lastRefreshTime}</span
        >
        •
        {#if isCountingDown}
          <span class="countdown">Refreshing in {countdown}s</span>
        {:else}
          <span class="countdown-idle">Next refresh in {countdown}s</span>
        {/if}
      </div>
      <button
        class="refresh-btn"
        on:click={refreshRecentMetrics}
        title="Manual refresh"
      >
        🔄
      </button>
    </div>

    <div class="panel-content">
      {#if recentMetrics?.metrics && recentMetrics.metrics.length > 0}
        <div class="table-wrapper">
          {#key data.lastUpdated}
            <table class="metrics-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>App</th>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Duration</th>
                  <th>Correlation ID</th>
                </tr>
              </thead>
              <tbody>
                {#each recentMetrics.metrics as metric}
                  <tr>
                    <td class="date-cell">
                      {new Date(metric.date).toLocaleString()}
                    </td>
                    <td class="user-cell">
                      {metric.user_name || "Anonymous"}
                    </td>
                    <td class="app-cell">
                      {metric.app_name || "Unknown"}
                    </td>
                    <td class="method-cell">
                      <span
                        class="method-badge method-{metric.verb.toLowerCase()}"
                      >
                        {metric.verb}
                      </span>
                    </td>
                    <td class="endpoint-cell">
                      <code class="endpoint-path">{metric.url}</code>
                    </td>
                    <td class="duration-cell">
                      <span
                        class="duration-badge"
                        class:duration-fast={metric.duration < 100}
                        class:duration-medium={metric.duration >= 100 &&
                          metric.duration < 500}
                        class:duration-slow={metric.duration >= 500}
                      >
                        {metric.duration}ms
                      </span>
                    </td>
                    <td class="correlation-cell">
                      <code class="correlation-id"
                        >{metric.correlation_id || "N/A"}</code
                      >
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/key}
        </div>
        <div class="metrics-summary">
          Showing {recentMetrics.count} recent API calls (last 50 records) from
          {obpInfo.displayName}
        </div>
      {:else if hasApiAccess}
        <div class="empty-state">
          <div
            style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; text-align: center;"
          >
            📡
          </div>
          <h4
            style="color: #4a5568; margin-bottom: 0.5rem; font-size: 1.125rem; text-align: center;"
          >
            No Recent API Calls
          </h4>
          <p style="text-align: center; margin-bottom: 1.5rem;">
            No recent API requests found for <strong
              >{obpInfo.displayName}</strong
            >.
          </p>
          <div
            style="background: #f7fafc; padding: 1rem; border-radius: 6px; margin-bottom: 1rem; text-align: left;"
          >
            <h5
              style="color: #2d3748; margin-bottom: 0.5rem; font-size: 0.875rem;"
            >
              Server Configuration:
            </h5>
            <div
              style="font-family: monospace; font-size: 0.75rem; color: #4a5568;"
            >
              <div>• Base URL: {obpInfo.baseUrl}</div>
              <div>• API URL: {obpInfo.apiUrl}</div>
              <div>• OIDC URL: {obpInfo.oidcUrl}</div>
            </div>
          </div>
          <button
            class="refresh-btn"
            on:click={refreshRecentMetrics}
            style="display: block; margin: 0 auto;"
          >
            🔄 Refresh Data
          </button>
        </div>
      {:else}
        <div class="empty-state">
          <div
            style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; text-align: center;"
          >
            🔒
          </div>
          <h4
            style="color: #e53e3e; margin-bottom: 0.5rem; font-size: 1.125rem; text-align: center;"
          >
            API Access Unavailable
          </h4>
          <p style="text-align: center; margin-bottom: 1rem;">
            Cannot connect to OBP server at <strong
              >{obpInfo.displayName}</strong
            >
          </p>
          <p style="text-align: center; font-size: 0.875rem; color: #718096;">
            Please check your authentication or server configuration.
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1400px;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .breadcrumb-link {
    color: #3b82f6;
    text-decoration: none;
  }

  .breadcrumb-link:hover {
    color: #1d4ed8;
  }

  .breadcrumb-separator {
    margin: 0 0.5rem;
    color: #d1d5db;
  }

  .breadcrumb-current {
    color: #374151;
    font-weight: 500;
  }

  .alert {
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .alert-error {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
  }

  .panel {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .full-width-panel {
    margin-bottom: 1.5rem;
    width: 100%;
  }

  .panel-header {
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .panel-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .refresh-btn {
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .refresh-btn:hover {
    background: #e5e7eb;
  }

  .panel-content {
    padding: 1.5rem;
  }

  .metrics-table-container {
    overflow-x: auto;
    margin-bottom: 1rem;
  }

  .metrics-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    min-width: 800px;
  }

  .metrics-table th {
    background: #f9fafb;
    padding: 0.75rem 0.5rem;
    text-align: left;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    white-space: nowrap;
  }

  .metrics-table td {
    padding: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: middle;
  }

  .metrics-table tr:hover {
    background: #f9fafb;
  }

  .date-cell {
    font-family: monospace;
    font-size: 0.8125rem;
    color: #6b7280;
    white-space: nowrap;
    min-width: 120px;
  }

  .endpoint-cell {
    font-family: monospace;
    font-size: 0.8125rem;
    max-width: 400px;
    word-break: break-all;
  }

  .endpoint-path {
    background: #f3f4f6;
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.75rem;
  }

  .user-cell,
  .app-cell {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .method-cell {
    white-space: nowrap;
  }

  .method-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    display: inline-block;
    min-width: 4rem;
    text-align: center;
    color: white;
  }

  .method-get {
    background-color: #10b981;
  }

  .method-post {
    background-color: #3b82f6;
  }

  .method-put {
    background-color: #f59e0b;
  }

  .method-delete {
    background-color: #ef4444;
  }

  .method-patch {
    background-color: #8b5cf6;
  }

  .duration-cell {
    text-align: right;
    white-space: nowrap;
  }

  .duration-badge {
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 500;
    font-family: monospace;
  }

  .duration-fast {
    background-color: #d1fae5;
    color: #065f46;
  }

  .duration-medium {
    background-color: #fef3c7;
    color: #92400e;
  }

  .duration-slow {
    background-color: #fee2e2;
    color: #991b1b;
  }

  .correlation-cell {
    font-family: monospace;
    font-size: 0.75rem;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .correlation-id {
    background: #f0f4ff;
    color: #1e40af;
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .table-wrapper {
    overflow-x: auto;
    margin: -1px;
  }

  .countdown {
    color: #f59e0b;
    font-weight: 600;
    animation: pulse 1s ease-in-out infinite;
  }

  .countdown-idle {
    color: #6b7280;
    font-weight: 500;
  }

  .timestamp-color-0 {
    color: #3b82f6;
    font-weight: 600;
    transition: color 0.3s ease-in-out;
  }

  .timestamp-color-1 {
    color: #10b981;
    font-weight: 600;
    transition: color 0.3s ease-in-out;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }

  .metrics-summary {
    text-align: center;
    color: #6b7280;
    font-size: 0.875rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 6px;
  }

  .empty-state {
    text-align: center;
    color: #6b7280;
    padding: 2rem;
  }

  .query-form {
    margin-bottom: 2rem;
  }

  .form-section {
    margin-bottom: 1.5rem;
  }

  .form-section-title {
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .form-row.compact {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .form-field {
    display: flex;
    flex-direction: column;
  }

  .form-field.date-field {
    max-width: 200px;
  }

  .form-field.narrow-field {
    max-width: 120px;
  }

  .form-field label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.25rem;
  }

  .form-input {
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: border-color 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 1px #3b82f6;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover {
    background: #e5e7eb;
  }

  .query-results {
    margin-top: 2rem;
    border-top: 1px solid #e5e7eb;
    padding-top: 2rem;
  }

  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .results-header h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .results-count {
    font-size: 0.875rem;
    color: #6b7280;
    background: #f3f4f6;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
  }

  @media (max-width: 1200px) {
    .form-row {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }
  }

  @media (max-width: 768px) {
    .panel-header {
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .form-actions {
      flex-direction: column;
    }

    .results-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
  }
</style>
