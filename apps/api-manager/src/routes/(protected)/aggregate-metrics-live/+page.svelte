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
  import { goto } from "$app/navigation";
  import { invalidate } from "$app/navigation";
  import type { PageData } from "./$types";
  import { configHelpers } from "$lib/config";
  import AggregateMetricsQueryForm from "$lib/components/metrics/AggregateMetricsQueryForm.svelte";

  let { data } = $props<{ data: PageData }>();

  let metricsHistory = $state<
    Array<{
      count: number;
      average_response_time: number;
      minimum_response_time: number;
      maximum_response_time: number;
      from_date: string;
      to_date: string;
    }>
  >([]);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);
  let apiError = $state<string | undefined>(undefined);

  // Debug reactive statements
  $effect(() => {
    console.log("metricsHistory updated:", {
      historyLength: metricsHistory.length,
      timestamp: new Date().toLocaleTimeString(undefined, { hourCycle: "h23" }),
    });
  });

  let refreshInterval: ReturnType<typeof setInterval> | undefined = undefined;
  let countdownInterval: ReturnType<typeof setInterval> | undefined = undefined;
  let timeUpdateInterval: ReturnType<typeof setInterval> | undefined = undefined;
  let currentTime = $state(new Date().toLocaleString(undefined, { hourCycle: "h23" }));
  let currentTimeUTC = $state(
    new Date().toISOString().replace("T", " ").slice(0, 19),
  );
  let lastRefreshTime = $state(new Date().toLocaleString(undefined, { hourCycle: "h23" }));
  let countdown = $state(5);
  let isCountingDown = $state(false);
  let timestampColorIndex = $state(0);
  let autoRefresh = $state("5");
  let lastCorrelationId = $state<string>("N/A");

  // Configuration information
  let obpInfo = $derived(configHelpers.getObpConnectionInfo());

  // Helper function to convert datetime-local format to OBP API format
  function formatDateForAPI(dateString: string): string {
    if (!dateString || dateString.trim() === "") return "";

    // If it's already in ISO format with Z, return as is
    if (dateString.endsWith("Z")) {
      console.log("formatDateForAPI: Date already in ISO format:", dateString);
      return dateString;
    }

    // Convert datetime-local format (yyyy-MM-ddTHH:mm) to OBP format
    const date = new Date(dateString);
    const isoString = date.toISOString(); // Returns yyyy-MM-ddTHH:mm:ss.sssZ
    console.log("formatDateForAPI: Input:", dateString, "Output:", isoString);
    return isoString;
  }

  // Form data for query panel
  let queryForm = $state({
    from_date: "",
    to_date: "",
    consumer_id: "",
    user_id: "",
    username: "",
    anon: "",
    url: "",
    app_name: "",
    implemented_by_partial_function: "",
    implemented_in_version: "",
    verb: "",
    correlation_id: "",
    include_app_names: "",
    http_status_code: "",
  });

  // Function to update to_date and from_date based on Auto Refresh setting
  function updateToDate() {
    if (autoRefresh === "none") {
      return; // Don't update if Auto Refresh is disabled
    }

    const now = new Date();
    // Set to_date to current time
    queryForm.to_date = now.toISOString().slice(0, 19);

    // Set from_date based on auto refresh period (in seconds)
    const refreshSeconds = parseInt(autoRefresh);
    const fromDate = new Date(now);
    fromDate.setSeconds(fromDate.getSeconds() - refreshSeconds);
    queryForm.from_date = fromDate.toISOString().slice(0, 19);
  }

  // Watch for autoRefresh changes and update to_date
  $effect(() => {
    updateToDate();
    if (initialized) {
      startAutoRefresh();
    }
  });

  // Initialize on mount - run only once
  let initialized = $state(false);

  // Initialize on mount - run only once
  $effect(() => {
    if (typeof window !== "undefined" && !initialized) {
      initialized = true;

      const urlParams = new URLSearchParams(window.location.search);

      // Set default from_date to 5 minutes ago
      const fiveMinutesAgo = new Date();
      fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
      const defaultFromDate = fiveMinutesAgo.toISOString().slice(0, 16);

      queryForm = {
        from_date: urlParams.get("from_date") || defaultFromDate,
        to_date: urlParams.get("to_date") || "",
        consumer_id: urlParams.get("consumer_id") || "",
        user_id: urlParams.get("user_id") || "",
        username: urlParams.get("username") || "",
        anon: urlParams.get("anon") || "",
        url: urlParams.get("url") || "",
        app_name: urlParams.get("app_name") || "",
        implemented_by_partial_function:
          urlParams.get("implemented_by_partial_function") || "",
        implemented_in_version: urlParams.get("implemented_in_version") || "",
        verb: urlParams.get("verb") || "",
        correlation_id: urlParams.get("correlation_id") || "",
        include_app_names: urlParams.get("include_app_names") || "",
        http_status_code: urlParams.get("http_status_code") || "",
      };

      // Sync URL with form values and start auto-refresh
      refreshMetrics();
      startAutoRefresh();

      // Update current time every second
      timeUpdateInterval = setInterval(() => {
        currentTime = new Date().toLocaleString(undefined, { hourCycle: "h23" });
        currentTimeUTC = new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, 19);
      }, 1000);
    }
  });

  // Separate cleanup effect
  $effect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
      if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
      }
    };
  });

  function refreshMetrics() {
    console.log("refreshMetrics called at", new Date().toLocaleTimeString(undefined, { hourCycle: "h23" }));

    // Update dates if Auto Refresh is active
    if (autoRefresh !== "none") {
      updateToDate();
    }

    // Update last refresh timestamp and alternate color
    lastRefreshTime = new Date().toLocaleString(undefined, { hourCycle: "h23" });
    timestampColorIndex = (timestampColorIndex + 1) % 2;

    // Use currentQueryString - this is the ON_PAGE_METRICS_REQUEST_URL query params
    console.log("ON_PAGE_METRICS_REQUEST_URL params:", currentQueryString);

    // Call API endpoint directly with the ON_PAGE_METRICS_REQUEST_URL params
    fetch(`/backend/aggregate-metrics?${currentQueryString}`)
      .then((response) => {
        const correlationId =
          response.headers.get("X-Correlation-Id") ||
          response.headers.get("x-correlation-id") ||
          response.headers.get("correlation-id") ||
          response.headers.get("Correlation-Id") ||
          "N/A";
        return response
          .json()
          .then((result) => ({ ok: response.ok, result, correlationId }));
      })
      .then(({ ok, result, correlationId }) => {
        if (!ok) {
          console.error("API error:", result.message);
          apiError = result.message;
        } else if (result.error) {
          console.error("API error:", result.error);
          apiError = result.error;
        } else if (result.count !== undefined) {
          apiError = undefined;

          // Store the correlation ID
          lastCorrelationId = correlationId;

          // Add new result to the top of the history
          const newEntry = {
            count: result.count,
            average_response_time: result.average_response_time,
            minimum_response_time: result.minimum_response_time,
            maximum_response_time: result.maximum_response_time,
            from_date: queryForm.from_date,
            to_date: queryForm.to_date,
          };

          // Add to beginning of array and keep max 20 entries
          metricsHistory = [newEntry, ...metricsHistory].slice(0, 20);

          console.log("Aggregate metrics fetched, count:", result.count);
        }
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        apiError = "Failed to fetch aggregate metrics";
      });
  }

  function submitQuery() {
    // Just call refreshMetrics since it already handles the form data
    refreshMetrics();
  }

  // Reactive derived value that updates whenever queryForm changes
  let currentQueryString = $derived.by(() => {
    const params = new URLSearchParams();

    // Add date filters only if they have values
    if (queryForm.from_date && queryForm.from_date.trim() !== "") {
      params.set("from_date", formatDateForAPI(queryForm.from_date));
    }
    if (queryForm.to_date && queryForm.to_date.trim() !== "") {
      params.set("to_date", formatDateForAPI(queryForm.to_date));
    }

    // Add other filters if they have values
    if (queryForm.verb && queryForm.verb.trim() !== "") {
      params.set("verb", queryForm.verb);
    }
    if (queryForm.app_name && queryForm.app_name.trim() !== "") {
      params.set("app_name", queryForm.app_name);
    }
    if (queryForm.username && queryForm.username.trim() !== "") {
      params.set("username", queryForm.username);
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
    if (
      queryForm.include_app_names &&
      queryForm.include_app_names.trim() !== ""
    ) {
      params.set("include_app_names", queryForm.include_app_names);
    }
    if (
      queryForm.http_status_code &&
      queryForm.http_status_code.trim() !== ""
    ) {
      params.set("http_status_code", queryForm.http_status_code);
    }

    return params.toString();
  });

  function startAutoRefresh() {
    // Get countdown duration from autoRefresh (in seconds)
    const refreshSeconds = autoRefresh === "none" ? 5 : parseInt(autoRefresh);
    countdown = refreshSeconds;
    isCountingDown = true;

    if (refreshInterval) clearInterval(refreshInterval);
    if (countdownInterval) clearInterval(countdownInterval);

    console.log(`Starting auto-refresh countdown from ${refreshSeconds}`);
    countdownInterval = setInterval(() => {
      countdown--;
      console.log("Countdown:", countdown);
      if (countdown <= 0) {
        console.log("Countdown reached 0, refreshing...");
        refreshMetrics();
        countdown = refreshSeconds;
      }
    }, 1000);
  }

  function handleFieldChange() {
    // Immediately refresh when field changes
    console.log("Field changed, refreshing immediately");
    refreshMetrics();
    // Restart the normal 5-second auto-refresh cycle
    startAutoRefresh();
  }

  function clearQuery() {
    queryForm = {
      from_date: "",
      to_date: "",
      consumer_id: "",
      user_id: "",
      username: "",
      anon: "",
      url: "",
      app_name: "",
      implemented_by_partial_function: "",
      implemented_in_version: "",
      verb: "",
      correlation_id: "",
      include_app_names: "",
      http_status_code: "",
    };
  }

  function formatDuration(duration: number): string {
    if (duration < 1000) {
      return `${duration}ms`;
    }
    return `${(duration / 1000).toFixed(2)}s`;
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function calculateSpan(fromDate: string, toDate: string): string {
    if (!fromDate || !toDate) return "N/A";

    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diffMs = to.getTime() - from.getTime();

    if (diffMs < 0) return "Invalid";

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

    return `${days}d ${hours}h ${mins}m ${secs}s`;
  }

  function getVerbColor(verb: string): string {
    switch (verb.toUpperCase()) {
      case "GET":
        return "ui-tone-success";
      case "POST":
        return "ui-tone-info";
      case "PUT":
        return "ui-tone-warning";
      case "DELETE":
        return "ui-tone-error";
      case "PATCH":
        return "ui-tone-accent";
      default:
        return "ui-card ui-muted";
    }
  }
</script>

<svelte:head>
  <title>Aggregate Metrics - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Error Alert -->
  {#if error && !hasApiAccess}
    <div class="alert alert-error mb-6">
      <strong>Error:</strong>
      {error} - Unable to fetch metrics data.
    </div>
  {/if}

  <!-- API Error Alert -->
  {#if apiError}
    <div class="alert alert-error mb-6">
      <strong>API Error:</strong>
      {apiError}
    </div>
  {/if}

  <!-- Panel 1: Query Interface -->
  <div class="panel full-width-panel">
    <div class="panel-header">
      <h2 class="panel-title">Query Aggregate Metrics</h2>
      <div class="panel-subtitle">
        Current Date Time (UTC): <strong>{currentTimeUTC}</strong>
      </div>
    </div>

    <div class="panel-content">
      <!-- Query Form -->
      <AggregateMetricsQueryForm
        bind:queryForm
        bind:autoRefresh
        onFieldChange={handleFieldChange}
        onClear={clearQuery}
        onRefresh={refreshMetrics}
        onSubmit={submitQuery}
        showAutoRefresh={true}
        showClearButton={true}
        showRefreshButton={true}
      />
      <div style="margin-top: 1rem; font-size: 0.7rem; line-height: 1.4;">
        <strong>URL:</strong>
        {obpInfo.baseUrl}/obp/v6.0.0/management/aggregate-metrics?{decodeURIComponent(
          currentQueryString,
        )}
      </div>
    </div>
  </div>

  <!-- Panel 2: Aggregate Metrics Results -->
  <div class="panel full-width-panel">
    <div class="panel-header">
      <div
        style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;"
      >
        <h2 class="panel-title" style="margin: 0;">
          Aggregate Metrics Results
        </h2>
      </div>
      <div class="panel-subtitle">
        Last updated:
        <span class="timestamp-color-{timestampColorIndex}"
          >{lastRefreshTime} (UTC: {new Date().toISOString()})</span
        >
        •
        {#if isCountingDown}
          <span class="countdown">Refreshing in {countdown}s</span>
        {:else}
          <span class="countdown-idle">Next refresh in {countdown}s</span>
        {/if}
        •
        <span style="font-family: monospace; font-size: 0.85em;">
          Correlation ID: {lastCorrelationId}
        </span>
      </div>
    </div>

    <div class="panel-content">
      {#if metricsHistory.length > 0}
        <div class="metrics-summary">
          Showing {metricsHistory.length} aggregate metric{metricsHistory.length ===
          1
            ? ""
            : "s"} from {obpInfo.displayName}
        </div>
        <div class="table-wrapper">
          <table class="metrics-table">
            <thead>
              <tr>
                <th>From Date (UTC)</th>
                <th>To Date (UTC)</th>
                <th>Span</th>
                <th>Total Count</th>
                <th>Minimum Response Time</th>
                <th>Maximum Response Time</th>
                <th>Average Response Time</th>
              </tr>
            </thead>
            <tbody>
              {#each metricsHistory as metric}
                {@const maxInHistory = Math.max(
                  ...metricsHistory.map((m) => m.maximum_response_time),
                )}
                {@const minPercent =
                  (metric.minimum_response_time / maxInHistory) * 100}
                {@const minColor =
                  metric.minimum_response_time < 50
                    ? "var(--ui-success)"
                    : metric.minimum_response_time < 150
                      ? "var(--ui-warning)"
                      : "var(--ui-error)"}
                {@const maxPercent =
                  (metric.maximum_response_time / maxInHistory) * 100}
                {@const maxColor =
                  metric.maximum_response_time < 50
                    ? "var(--ui-success)"
                    : metric.maximum_response_time < 150
                      ? "var(--ui-warning)"
                      : "var(--ui-error)"}
                {@const avgPercent =
                  (metric.average_response_time / maxInHistory) * 100}
                {@const avgColor =
                  metric.average_response_time < 50
                    ? "var(--ui-success)"
                    : metric.average_response_time < 150
                      ? "var(--ui-warning)"
                      : "var(--ui-error)"}
                <tr>
                  <td class="date-cell">
                    {metric.from_date}
                  </td>
                  <td class="date-cell">
                    {metric.to_date}
                  </td>
                  <td class="date-cell">
                    {calculateSpan(metric.from_date, metric.to_date)}
                  </td>
                  <td class="count-cell">
                    {metric.count}
                  </td>
                  <td class="duration-cell">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="min-width: 60px;"
                        >{metric.minimum_response_time?.toFixed(2) ||
                          "N/A"}ms</span
                      >
                      <div
                        style="flex: 1; height: 20px; background: linear-gradient(90deg, {minColor} 0%, {minColor} {minPercent}%, transparent {minPercent}%); border-radius: 4px;"
                      ></div>
                    </div>
                  </td>
                  <td class="duration-cell">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="min-width: 60px;"
                        >{metric.maximum_response_time?.toFixed(2) ||
                          "N/A"}ms</span
                      >
                      <div
                        style="flex: 1; height: 20px; background: linear-gradient(90deg, {maxColor} 0%, {maxColor} {maxPercent}%, transparent {maxPercent}%); border-radius: 4px;"
                      ></div>
                    </div>
                  </td>
                  <td class="duration-cell">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="min-width: 60px;"
                        >{metric.average_response_time?.toFixed(2) ||
                          "N/A"}ms</span
                      >
                      <div
                        style="flex: 1; height: 20px; background: linear-gradient(90deg, {avgColor} 0%, {avgColor} {avgPercent}%, transparent {avgPercent}%); border-radius: 4px;"
                      ></div>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else if hasApiAccess}
        <div class="empty-state">
          <div
            style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; text-align: center;"
          >
            📡
          </div>
          <h4 class="ui-muted"
            style="margin-bottom: 0.5rem; font-size: 1.125rem; text-align: center;"
          >
            No Aggregate Metrics Found
          </h4>
          <p style="text-align: center; margin-bottom: 1.5rem;">
            No aggregate metrics found for <strong>{obpInfo.displayName}</strong
            >.
          </p>
          <div class="ui-panel"
            style="padding: 1rem; border-radius: 6px; margin-bottom: 1rem; text-align: left;"
          >
            <h5 class="ui-text"
              style="margin-bottom: 0.5rem; font-size: 0.875rem;"
            >
              Server Configuration:
            </h5>
            <div class="ui-muted"
              style="font-family: monospace; font-size: 0.75rem;"
            >
              <div>• Base URL: {obpInfo.baseUrl}</div>
              <div>• API URL: {obpInfo.apiUrl}</div>
              <div>• OIDC URL: {obpInfo.oidcUrl}</div>
            </div>
          </div>
          <button
            class="refresh-btn"
            onclick={refreshMetrics}
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
          <h4 class="ui-text-error"
            style="margin-bottom: 0.5rem; font-size: 1.125rem; text-align: center;"
          >
            API Access Unavailable
          </h4>
          <p style="text-align: center; margin-bottom: 1rem;">
            Cannot connect to OBP server at <strong
              >{obpInfo.displayName}</strong
            >
          </p>
          <p class="ui-muted" style="text-align: center; font-size: 0.875rem;">
            Please check your authentication or server configuration.
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(body) {
    color: var(--ui-text);
  }

  .container {
    max-width: 1400px;
  }

  .alert {
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .alert-error {
    background-color: var(--ui-tone-error-bg);
    border: 1px solid var(--ui-tone-error-border);
    color: var(--ui-tone-error-text);
  }

  .panel {
    background: var(--ui-card);
    border: 1px solid var(--ui-border);
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .full-width-panel {
    margin-bottom: 1.5rem;
    width: 100%;
  }

  .panel-header {
    background: var(--ui-panel);
    border-bottom: 1px solid var(--ui-border);
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
    color: var(--ui-text);
    margin: 0;
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: var(--ui-muted);
    margin: 0;
  }

  .refresh-btn {
    background: var(--ui-panel);
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    padding: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .refresh-btn:hover {
    background: var(--ui-hover);
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
    background: var(--ui-panel);
    padding: 0.75rem 0.5rem;
    text-align: left;
    font-weight: 600;
    color: var(--ui-text);
    border-bottom: 1px solid var(--ui-border);
    white-space: nowrap;
  }

  .metrics-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--ui-border);
    vertical-align: middle;
  }

  .metrics-table tr:hover {
    background: var(--ui-hover);
  }

  .date-cell {
    font-family: monospace;
    font-size: 0.8125rem;
    color: var(--ui-muted);
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
    background: var(--ui-panel);
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
    color: var(--ui-fill-main-text);
  }

  .method-get {
    background-color: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .method-post {
    background-color: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
  }

  .method-put {
    background-color: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
  }

  .method-delete {
    background-color: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
  }

  .method-patch {
    background-color: var(--ui-tone-accent-bg);
    color: var(--ui-tone-accent-text);
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
    background-color: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .duration-medium {
    background-color: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
  }

  .duration-slow {
    background-color: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
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
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
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
    color: var(--ui-warning);
    font-weight: 600;
    animation: pulse 1s ease-in-out infinite;
  }

  .countdown-idle {
    color: var(--ui-muted);
    font-weight: 500;
  }

  .timestamp-color-0 {
    color: var(--ui-link);
    font-weight: 600;
    transition: color 0.3s ease-in-out;
  }

  .timestamp-color-1 {
    color: var(--ui-success);
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
    color: var(--ui-muted);
    font-size: 0.875rem;
    padding: 1rem;
    background: var(--ui-panel);
    border-radius: 6px;
  }

  .empty-state {
    text-align: center;
    color: var(--ui-muted);
    padding: 2rem;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--ui-border);
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
    background: var(--ui-fill-main-bg);
    color: var(--ui-fill-main-text);
  }

  .btn-primary:hover {
    opacity: 0.85;
  }

  .btn-secondary {
    background: var(--ui-panel);
    color: var(--ui-text);
    border: 1px solid var(--ui-border);
  }

  .btn-secondary:hover {
    background: var(--ui-hover);
  }

  .query-results {
    margin-top: 2rem;
    border-top: 1px solid var(--ui-border);
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
    color: var(--ui-text);
    margin: 0;
  }

  .results-count {
    font-size: 0.875rem;
    color: var(--ui-muted);
    background: var(--ui-panel);
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
  }

  @media (max-width: 768px) {
    .panel-header {
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
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
