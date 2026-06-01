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
      timestamp: new Date().toLocaleTimeString(),
    });
  });

  let refreshInterval: number | undefined = undefined;
  let countdownInterval: number | undefined = undefined;
  let timeUpdateInterval: number | undefined = undefined;
  let currentTime = $state(new Date().toLocaleString());
  let currentTimeUTC = $state(
    new Date().toISOString().replace("T", " ").slice(0, 19),
  );
  let lastRefreshTime = $state(new Date().toLocaleString());
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
        currentTime = new Date().toLocaleString();
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
    console.log("refreshMetrics called at", new Date().toLocaleTimeString());
    console.log("Current queryForm.limit:", queryForm.limit);

    // Update dates if Auto Refresh is active
    if (autoRefresh !== "none") {
      updateToDate();
    }

    // Update last refresh timestamp and alternate color
    lastRefreshTime = new Date().toLocaleString();
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
        return response.json().then((result) => ({ result, correlationId }));
      })
      .then(({ result, correlationId }) => {
        if (result.error) {
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
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
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
                    ? "#10b981"
                    : metric.minimum_response_time < 150
                      ? "#f59e0b"
                      : "#ef4444"}
                {@const maxPercent =
                  (metric.maximum_response_time / maxInHistory) * 100}
                {@const maxColor =
                  metric.maximum_response_time < 50
                    ? "#10b981"
                    : metric.maximum_response_time < 150
                      ? "#f59e0b"
                      : "#ef4444"}
                {@const avgPercent =
                  (metric.average_response_time / maxInHistory) * 100}
                {@const avgColor =
                  metric.average_response_time < 50
                    ? "#10b981"
                    : metric.average_response_time < 150
                      ? "#f59e0b"
                      : "#ef4444"}
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
          <h4
            style="color: #4a5568; margin-bottom: 0.5rem; font-size: 1.125rem; text-align: center;"
          >
            No Aggregate Metrics Found
          </h4>
          <p style="text-align: center; margin-bottom: 1.5rem;">
            No aggregate metrics found for <strong>{obpInfo.displayName}</strong
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

  .metrics-table tr:hover {
    background: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .metrics-table tr:hover {
    background: var(--color-surface-800);
  }

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

  .endpoint-cell {
    font-family: monospace;
    font-size: 0.8125rem;
    max-width: 400px;
    word-break: break-all;
  }

  .endpoint-path {
    background: var(--color-surface-200);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.75rem;
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
    color: var(--color-surface-200);
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
