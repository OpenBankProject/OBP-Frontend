<script lang="ts">
  import { goto } from "$app/navigation";
  import { invalidate } from "$app/navigation";
  import { page } from "$app/stores";
  import type { PageData } from "./$types";
  import { configHelpers } from "$lib/config";
  import MetricsQueryForm from "$lib/components/metrics/MetricsQueryForm.svelte";

  let { data } = $props<{ data: PageData }>();

  // API Explorer URL for linking operation IDs
  const apiExplorerUrl = $page.data.externalLinks?.API_EXPLORER_URL || "https://apiexplorer-ii-sandbox.openbankproject.com";

  function getOperationId(metric: any): string {
    return metric.operation_id || "Err";
  }

  function getApiExplorerLink(metric: any): string {
    const operationId = getOperationId(metric);
    if (operationId === "Err") return "";
    return `${apiExplorerUrl}/resource-docs/OBPv6.0.0?operationid=${operationId}`;
  }

  let metrics = $derived(data.metrics);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  // Debug reactive statements
  $effect(() => {
    if (metrics) {
      console.log("metrics updated:", {
        count: metrics.count,
        metricsLength: metrics.metrics?.length,
        timestamp: new Date().toLocaleTimeString(),
        firstMetricDate: metrics.metrics?.[0]?.date,
        lastMetricDate: metrics.metrics?.[metrics.metrics.length - 1]?.date,
      });
    }
  });

  // Debug data prop changes
  $effect(() => {
    console.log("data prop updated:", {
      hasMetrics: !!data.metrics,
      metricsCount: data.metrics?.count,
      lastUpdated: data.lastUpdated,
      timestamp: new Date().toLocaleTimeString(),
    });
  });

  let refreshInterval: number | undefined = undefined;
  let countdownInterval: number | undefined = undefined;
  let timeUpdateInterval: number | undefined = undefined;
  let currentTime = $state(new Date().toLocaleString());
  let lastRefreshTime = $state(new Date().toLocaleString());
  let countdown = $state(5);
  let isCountingDown = $state(false);
  let timestampColorIndex = $state(0);
  let showUrl = $state(false);

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
    include_app_names: "",
    http_status_code: "",
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
        include_app_names: urlParams.get("include_app_names") || "",
        http_status_code: urlParams.get("http_status_code") || "",
      };

      // Sync URL with form values and start auto-refresh
      refreshMetrics();
      startAutoRefresh();

      // Update current time every second
      timeUpdateInterval = setInterval(() => {
        currentTime = new Date().toLocaleString();
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
    console.log("refreshMetrics called at", new Date().toLocaleTimeString());
    console.log("Current queryForm.limit:", queryForm.limit);

    // Update last refresh timestamp and alternate color
    lastRefreshTime = new Date().toLocaleString();
    timestampColorIndex = (timestampColorIndex + 1) % 2;

    // Use currentQueryString - this is the ON_PAGE_METRICS_REQUEST_URL query params
    console.log("ON_PAGE_METRICS_REQUEST_URL params:", currentQueryString);

    // Call API endpoint directly with the ON_PAGE_METRICS_REQUEST_URL params
    fetch(`/api/metrics?${currentQueryString}`)
      .then((response) => response.json())
      .then((result) => {
        if (result.error) {
          console.error("API error:", result.error);
          metrics = { metrics: [], count: 0, error: result.error };
        } else if (result.metrics) {
          metrics = {
            metrics: result.metrics,
            count: result.count,
          };
          console.log("Metrics fetched, count:", result.count);
        }
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        metrics = { metrics: [], count: 0, error: "Failed to fetch metrics" };
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
    if (queryForm.duration && String(queryForm.duration).trim() !== "") {
      params.set("duration", String(queryForm.duration));
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

    // Always include pagination and sorting
    params.set("limit", queryForm.limit);
    params.set("offset", queryForm.offset);
    params.set("sort_by", queryForm.sort_by);
    params.set("direction", queryForm.direction);

    return params.toString();
  });

  function startAutoRefresh() {
    // Start 5-second auto-refresh cycle
    countdown = 5;
    isCountingDown = true;

    if (refreshInterval) clearInterval(refreshInterval);
    if (countdownInterval) clearInterval(countdownInterval);

    console.log("Starting auto-refresh countdown from 5");
    countdownInterval = setInterval(() => {
      countdown--;
      console.log("Countdown:", countdown);
      if (countdown <= 0) {
        console.log("Countdown reached 0, refreshing...");
        refreshMetrics();
        countdown = 5;
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
      include_app_names: "",
      http_status_code: "",
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
    return new Date(dateString).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
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
  <!-- Error Alert -->
  {#if error && !hasApiAccess}
    <div class="alert alert-error mb-6">
      <strong>Error:</strong>
      {error} - Unable to fetch metrics data.
    </div>
  {/if}

  <!-- API Error Alert -->
  {#if metrics?.error}
    <div class="alert alert-error mb-6">
      <strong>API Error:</strong>
      {metrics.error}
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
      <MetricsQueryForm
        bind:queryForm
        onFieldChange={handleFieldChange}
        onClear={clearQuery}
        onSubmit={submitQuery}
        showAutoRefresh={false}
        showClearButton={true}
        showRefreshButton={false}
      />
    </div>
  </div>

  <!-- Panel 2: API Metrics Results -->
  <div class="panel full-width-panel">
    <div class="panel-header-compact">
      <div class="panel-header-row">
        <h2 class="panel-title">API Metrics Results</h2>
        <div class="panel-meta">
          <button
            class="url-toggle"
            onclick={() => showUrl = !showUrl}
            title={showUrl ? "Hide URL" : "Show URL"}
          >
            {showUrl ? "▼" : "▶"} URL
          </button>
          <span class="meta-separator">•</span>
          <span class="timestamp-color-{timestampColorIndex}">{lastRefreshTime}</span>
          <span class="meta-separator">•</span>
          {#if isCountingDown}
            <span class="countdown">{countdown}s</span>
          {:else}
            <span class="countdown-idle">{countdown}s</span>
          {/if}
          <button
            class="refresh-btn-inline"
            onclick={refreshMetrics}
            title="Manual refresh"
          >
            🔄
          </button>
        </div>
      </div>
      {#if showUrl}
        <div class="url-display">
          <code>{obpInfo.baseUrl}/obp/v6.0.0/management/metrics?{currentQueryString}</code>
        </div>
      {/if}
    </div>

    <div class="panel-content">
      {#if metrics?.metrics && metrics.metrics.length > 0}
        <div class="metrics-summary">
          Showing {metrics.count} API calls from {obpInfo.displayName}
        </div>
        <div class="table-wrapper">
          {#key data.lastUpdated}
            <table class="metrics-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>App</th>
                  <th>Operation ID</th>
                  <th>Method</th>
                  <th>Duration</th>
                  <th>Correlation ID</th>
                </tr>
              </thead>
              <tbody>
                {#each metrics.metrics as metric}
                  <tr class="metric-row-main">
                    <td class="date-cell">
                      {formatDate(metric.date)}
                    </td>
                    <td class="user-cell">
                      {metric.user_name || "Anonymous"}
                    </td>
                    <td class="app-cell">
                      {metric.app_name || "Unknown"}
                    </td>
                    <td class="operation-id-cell">
                      {#if getApiExplorerLink(metric)}
                        <a
                          href={getApiExplorerLink(metric)}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="operation-id-link"
                          title="View in API Explorer"
                        >
                          <code class="operation-id">{getOperationId(metric)}</code>
                        </a>
                      {:else}
                        <code class="operation-id">{getOperationId(metric)}</code>
                      {/if}
                    </td>
                    <td class="method-cell">
                      <span
                        class="method-badge method-{metric.verb.toLowerCase()}"
                      >
                        {metric.verb}
                      </span>
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
                  <tr class="metric-row-endpoint">
                    <td colspan="7" class="endpoint-cell-full">
                      <code class="endpoint-path">{metric.url}</code>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/key}
        </div>
        <div class="metrics-summary">
          Showing {metrics.count} API calls from
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
            No API Metrics Found
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
  :global(body) {
    color: var(--color-surface-900);
  }

  :global([data-mode="dark"] body) {
    color: var(--color-surface-100);
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
    background-color: var(--color-error-100);
    border: 1px solid var(--color-error-300);
    color: var(--color-error-800);
  }

  :global([data-mode="dark"]) .alert-error {
    background-color: var(--color-error-900);
    border-color: var(--color-error-700);
    color: var(--color-error-200);
  }

  .panel {
    background: var(--color-surface-50);
    border: 1px solid var(--color-surface-300);
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  :global([data-mode="dark"]) .panel {
    background: var(--color-surface-900);
    border-color: var(--color-surface-700);
  }

  .full-width-panel {
    margin-bottom: 1.5rem;
    width: 100%;
  }

  .panel-header {
    background: var(--color-surface-100);
    border-bottom: 1px solid var(--color-surface-300);
    padding: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
  }

  :global([data-mode="dark"]) .panel-header {
    background: var(--color-surface-800);
    border-color: var(--color-surface-700);
  }

  .panel-header-compact {
    background: var(--color-surface-100);
    border-bottom: 1px solid var(--color-surface-300);
    padding: 0.75rem 1.5rem;
  }

  :global([data-mode="dark"]) .panel-header-compact {
    background: var(--color-surface-800);
    border-color: var(--color-surface-700);
  }

  .panel-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .panel-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-surface-600);
  }

  :global([data-mode="dark"]) .panel-meta {
    color: var(--color-surface-400);
  }

  .meta-separator {
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .meta-separator {
    color: var(--color-surface-600);
  }

  .url-toggle {
    background: none;
    border: 1px solid var(--color-surface-300);
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--color-surface-600);
    transition: all 0.2s;
  }

  :global([data-mode="dark"]) .url-toggle {
    border-color: var(--color-surface-600);
    color: var(--color-surface-400);
  }

  .url-toggle:hover {
    background: var(--color-surface-200);
    color: var(--color-surface-800);
  }

  :global([data-mode="dark"]) .url-toggle:hover {
    background: var(--color-surface-700);
    color: var(--color-surface-200);
  }

  .url-display {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: var(--color-surface-200);
    border-radius: 4px;
    overflow-x: auto;
  }

  :global([data-mode="dark"]) .url-display {
    background: var(--color-surface-900);
  }

  .url-display code {
    font-size: 0.75rem;
    color: var(--color-surface-700);
    word-break: break-all;
  }

  :global([data-mode="dark"]) .url-display code {
    color: var(--color-surface-300);
  }

  .refresh-btn-inline {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    padding: 0.25rem;
    transition: transform 0.2s;
  }

  .refresh-btn-inline:hover {
    transform: rotate(180deg);
  }

  .panel-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-surface-900);
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: var(--color-surface-600);
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .refresh-btn {
    background: var(--color-surface-200);
    border: 1px solid var(--color-surface-400);
    border-radius: 6px;
    padding: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  :global([data-mode="dark"]) .refresh-btn {
    background: var(--color-surface-800);
    border-color: var(--color-surface-600);
  }

  .refresh-btn:hover {
    background: var(--color-surface-300);
  }

  :global([data-mode="dark"]) .refresh-btn:hover {
    background: var(--color-surface-700);
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
    background: var(--color-surface-100);
    padding: 0.75rem 0.5rem;
    text-align: left;
    font-weight: 600;
    color: var(--color-surface-700);
    border-bottom: 1px solid var(--color-surface-300);
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .metrics-table th {
    background: var(--color-surface-800);
    color: var(--color-surface-300);
    border-color: var(--color-surface-700);
  }

  .metrics-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-surface-200);
    vertical-align: middle;
  }

  :global([data-mode="dark"]) .metrics-table td {
    border-color: var(--color-surface-800);
  }

  /* Row hover is handled by .metric-row-main:hover styles */

  .date-cell {
    font-family: monospace;
    font-size: 0.8125rem;
    color: var(--color-surface-600);
    white-space: nowrap;
    min-width: 120px;
  }

  :global([data-mode="dark"]) .date-cell {
    color: var(--color-surface-400);
  }

  .metric-row-main td {
    border-bottom: none;
  }

  .metric-row-endpoint {
    background: var(--color-surface-50);
  }

  :global([data-mode="dark"]) .metric-row-endpoint {
    background: var(--color-surface-900);
  }

  .metric-row-endpoint td {
    padding-top: 0;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-surface-300);
  }

  :global([data-mode="dark"]) .metric-row-endpoint td {
    border-color: var(--color-surface-700);
  }

  .metric-row-main:hover,
  .metric-row-main:hover + .metric-row-endpoint {
    background: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .metric-row-main:hover,
  :global([data-mode="dark"]) .metric-row-main:hover + .metric-row-endpoint {
    background: var(--color-surface-800);
  }

  .endpoint-cell-full {
    font-family: monospace;
    font-size: 0.8125rem;
    word-break: break-all;
  }

  .endpoint-path {
    background: var(--color-surface-200);
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.75rem;
    display: inline-block;
  }

  :global([data-mode="dark"]) .endpoint-path {
    background: var(--color-surface-800);
  }

  .user-cell,
  .app-cell {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .operation-id-cell {
    font-family: monospace;
    font-size: 0.8125rem;
  }

  .operation-id {
    background: var(--color-secondary-100);
    color: var(--color-secondary-800);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.75rem;
  }

  :global([data-mode="dark"]) .operation-id {
    background: var(--color-secondary-900);
    color: var(--color-secondary-200);
  }

  .operation-id-link {
    text-decoration: none;
  }

  .operation-id-link:hover .operation-id {
    background: var(--color-secondary-200);
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .operation-id-link:hover .operation-id {
    background: var(--color-secondary-800);
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
    background-color: var(--color-success-500);
  }

  .method-post {
    background-color: var(--color-tertiary-500);
  }

  .method-put {
    background-color: var(--color-warning-500);
  }

  .method-delete {
    background-color: var(--color-error-500);
  }

  .method-patch {
    background-color: var(--color-secondary-500);
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
    background-color: var(--color-success-200);
    color: var(--color-success-800);
  }

  :global([data-mode="dark"]) .duration-fast {
    background-color: var(--color-success-900);
    color: var(--color-success-200);
  }

  .duration-medium {
    background-color: var(--color-warning-200);
    color: var(--color-warning-800);
  }

  :global([data-mode="dark"]) .duration-medium {
    background-color: var(--color-warning-900);
    color: var(--color-warning-200);
  }

  .duration-slow {
    background-color: var(--color-error-200);
    color: var(--color-error-800);
  }

  :global([data-mode="dark"]) .duration-slow {
    background-color: var(--color-error-900);
    color: var(--color-error-200);
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
    background: var(--color-tertiary-100);
    color: var(--color-tertiary-800);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  :global([data-mode="dark"]) .correlation-id {
    background: var(--color-tertiary-900);
    color: var(--color-tertiary-200);
  }

  .table-wrapper {
    overflow-x: auto;
    margin: -1px;
  }

  .countdown {
    color: var(--color-warning-500);
    font-weight: 600;
    animation: pulse 1s ease-in-out infinite;
  }

  .countdown-idle {
    color: var(--color-surface-600);
    font-weight: 500;
  }

  :global([data-mode="dark"]) .countdown-idle {
    color: var(--color-surface-400);
  }

  .timestamp-color-0 {
    color: var(--color-tertiary-500);
    font-weight: 600;
    transition: color 0.3s ease-in-out;
  }

  .timestamp-color-1 {
    color: var(--color-success-500);
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
    color: var(--color-surface-600);
    font-size: 0.875rem;
    padding: 1rem;
    background: var(--color-surface-100);
    border-radius: 6px;
  }

  :global([data-mode="dark"]) .metrics-summary {
    color: var(--color-surface-400);
    background: var(--color-surface-800);
  }

  .empty-state {
    text-align: center;
    color: var(--color-surface-600);
    padding: 2rem;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
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
    color: var(--color-surface-700);
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--color-surface-300);
  }

  :global([data-mode="dark"]) .form-section-title {
    color: var(--color-surface-300);
    border-color: var(--color-surface-700);
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
    color: var(--color-surface-700);
    margin-bottom: 0.25rem;
  }

  :global([data-mode="dark"]) .form-field label {
    color: var(--color-surface-300);
  }

  .form-input {
    padding: 0.5rem;
    border: 1px solid var(--color-surface-400);
    border-radius: 6px;
    font-size: 0.875rem;
    transition: border-color 0.2s;
    background: var(--color-surface-50);
    color: var(--color-surface-900);
  }

  :global([data-mode="dark"]) .form-input {
    background: var(--color-surface-900);
    border-color: var(--color-surface-600);
    color: var(--color-surface-100);
  }

  .form-input:focus {
    outline: none;
    border-color: var(--color-tertiary-500);
    box-shadow: 0 0 0 1px var(--color-tertiary-500);
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-surface-300);
  }

  :global([data-mode="dark"]) .form-actions {
    border-color: var(--color-surface-700);
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
    background: var(--color-tertiary-500);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-tertiary-600);
  }

  .btn-secondary {
    background: var(--color-surface-200);
    color: var(--color-surface-700);
    border: 1px solid var(--color-surface-400);
  }

  :global([data-mode="dark"]) .btn-secondary {
    background: var(--color-surface-800);
    color: var(--color-surface-300);
    border-color: var(--color-surface-600);
  }

  .btn-secondary:hover {
    background: var(--color-surface-300);
  }

  :global([data-mode="dark"]) .btn-secondary:hover {
    background: var(--color-surface-700);
  }

  .query-results {
    margin-top: 2rem;
    border-top: 1px solid var(--color-surface-300);
    padding-top: 2rem;
  }

  :global([data-mode="dark"]) .query-results {
    border-color: var(--color-surface-700);
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
    color: var(--color-surface-900);
    margin: 0;
  }

  :global([data-mode="dark"]) .results-header h3 {
    color: var(--color-surface-100);
  }

  .results-count {
    font-size: 0.875rem;
    color: var(--color-surface-600);
    background: var(--color-surface-200);
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
  }

  :global([data-mode="dark"]) .results-count {
    color: var(--color-surface-400);
    background: var(--color-surface-800);
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
