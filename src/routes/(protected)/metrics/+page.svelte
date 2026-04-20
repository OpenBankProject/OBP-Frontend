<script lang="ts">
  import { goto } from "$app/navigation";
  import { invalidate } from "$app/navigation";
  import { page } from "$app/stores";
  import type { PageData } from "./$types";
  import { configHelpers } from "$lib/config";
  import MetricsQueryForm from "$lib/components/metrics/MetricsQueryForm.svelte";
  import { toast } from "$lib/utils/toastService";

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.info(`${label} copied to clipboard`);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error(`Failed to copy ${label}`);
    }
  }

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

  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  // Transport: user explicitly chooses REST or gRPC.
  let transport = $state<"rest" | "grpc">("rest");
  let eventSource: EventSource | null = null;
  let streamConnected = $state(false);
  let transportReason = $state<string>("");
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let streamedMetrics = $state<any[]>([]);
  let pendingMetrics: any[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let frozen = $state(false);
  let nextMetricId = 0;

  let metrics = $derived(
    transport === "grpc"
      ? { count: streamedMetrics.length, metrics: streamedMetrics }
      : data.metrics,
  );

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

  // Mark results as fresh when new data arrives from the server load
  $effect(() => {
    if (data.lastUpdated) {
      queryStatus = "fresh";
    }
  });

  let refreshInterval: number | undefined = undefined;
  let countdownInterval: number | undefined = undefined;
  let timeUpdateInterval: number | undefined = undefined;
  let currentTime = $state(new Date().toLocaleString());
  let lastRefreshTime = $state(new Date().toLocaleString());
  const REFRESH_OPTIONS = [
    { value: 5, label: "5s" },
    { value: 10, label: "10s" },
    { value: 30, label: "30s" },
    { value: 60, label: "60s" },
    { value: 0, label: "Off" },
  ];
  let refreshSeconds = $state(5);
  let countdown = $state(5);
  let isCountingDown = $state(false);
  let timestampColorIndex = $state(0);
  let showUrl = $state(false);
  let filtersExpanded = $state(false);
  let queryStatus: "fresh" | "dirty" = $state("fresh");

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
    username: "",
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
        username: urlParams.get("username") || "",
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

      // Sync URL with form values
      submitQuery();

      // Default transport is REST with polling; user can switch to gRPC.
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
      closeStream();
    };
  });

  function buildQueryString(): string {
    const params = new URLSearchParams();

    if (queryForm.from_date && queryForm.from_date.trim() !== "") {
      params.set("from_date", formatDateForAPI(queryForm.from_date));
    }
    if (queryForm.to_date && queryForm.to_date.trim() !== "") {
      params.set("to_date", formatDateForAPI(queryForm.to_date));
    }
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
    if (queryForm.user_id && queryForm.user_id.trim() !== "") {
      params.set("user_id", queryForm.user_id);
    }
    if (
      queryForm.implemented_by_partial_function &&
      queryForm.implemented_by_partial_function.trim() !== ""
    ) {
      params.set(
        "implemented_by_partial_function",
        queryForm.implemented_by_partial_function,
      );
    }
    if (
      queryForm.implemented_in_version &&
      queryForm.implemented_in_version.trim() !== ""
    ) {
      params.set("implemented_in_version", queryForm.implemented_in_version);
    }
    if (queryForm.correlation_id && queryForm.correlation_id.trim() !== "") {
      params.set("correlation_id", queryForm.correlation_id);
    }

    params.set("limit", String(queryForm.limit));
    params.set("offset", String(queryForm.offset));
    params.set("sort_by", queryForm.sort_by);
    params.set("direction", queryForm.direction);

    return params.toString();
  }

  let currentQueryString = $state(buildQueryString());

  function submitQuery() {
    currentQueryString = buildQueryString();
    lastRefreshTime = new Date().toLocaleString();
    timestampColorIndex = (timestampColorIndex + 1) % 2;

    const newUrl = `/metrics?${currentQueryString}`;
    console.log("Query:", newUrl);
    goto(newUrl, { replaceState: true, noScroll: true, invalidateAll: true });
  }

  function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    if (countdownInterval) clearInterval(countdownInterval);

    // "Off" — keep the page, just don't auto-refresh.
    if (refreshSeconds <= 0) {
      isCountingDown = false;
      countdown = 0;
      return;
    }

    countdown = refreshSeconds;
    isCountingDown = true;

    countdownInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        lastRefreshTime = new Date().toLocaleString();
        timestampColorIndex = (timestampColorIndex + 1) % 2;
        invalidate("app:metrics");
        countdown = refreshSeconds;
      }
    }, 1000);
  }

  function handleRefreshIntervalChange() {
    if (transport === "rest") startAutoRefresh();
  }

  function stopAutoRefresh() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = undefined;
    }
    isCountingDown = false;
  }

  function flushPendingMetrics() {
    flushTimer = null;
    if (frozen) return;
    if (pendingMetrics.length === 0) return;
    const incoming = pendingMetrics;
    pendingMetrics = [];
    // Newest first, same as REST display.
    streamedMetrics = [...incoming.reverse(), ...streamedMetrics].slice(0, 500);
    lastRefreshTime = new Date().toLocaleString();
    timestampColorIndex = (timestampColorIndex + 1) % 2;
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flushPendingMetrics, 200);
  }

  function toggleFrozen() {
    frozen = !frozen;
    if (frozen) {
      // Freeze also halts REST polling so the table stays put.
      if (transport === "rest") stopAutoRefresh();
    } else {
      flushPendingMetrics();
      // Resume REST polling if the user had a refresh interval set.
      if (transport === "rest") startAutoRefresh();
    }
  }

  function buildStreamUrl(): string {
    const params = new URLSearchParams();
    if (queryForm.consumer_id) params.set("consumer_id", queryForm.consumer_id);
    if (queryForm.user_id) params.set("user_id", queryForm.user_id);
    if (queryForm.verb) params.set("verb", queryForm.verb);
    if (queryForm.url) params.set("url_substring", queryForm.url);
    if (queryForm.implemented_by_partial_function)
      params.set(
        "implemented_by_partial_function",
        queryForm.implemented_by_partial_function,
      );
    if (queryForm.app_name) params.set("app_name", queryForm.app_name);
    return `/backend/metrics/stream?${params.toString()}`;
  }

  function closeStream() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    streamConnected = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    pendingMetrics = [];
  }

  function connectStream() {
    closeStream();
    eventSource = new EventSource(buildStreamUrl());

    eventSource.onopen = () => {
      streamConnected = true;
      transportReason = "";
      streamedMetrics = [];
      stopAutoRefresh();
    };

    eventSource.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        // Client-side filters: gRPC StreamMetricsRequest doesn't accept these
        // server-side, so we apply them here to match REST semantics.
        // duration input is type="number", so Svelte may bind it as a number —
        // coerce to string before checking.
        const durationRaw = String(queryForm.duration ?? "").trim();
        if (durationRaw !== "") {
          const minDuration = parseInt(durationRaw, 10);
          // REST semantic: duration > threshold (strictly greater).
          if (!isNaN(minDuration) && entry.duration <= minDuration) return;
        }
        const codeRaw = String(queryForm.http_status_code ?? "").trim();
        if (codeRaw !== "") {
          const wantCode = parseInt(codeRaw, 10);
          if (!isNaN(wantCode) && entry.status_code !== wantCode) return;
        }
        entry.__id = nextMetricId++;
        pendingMetrics.push(entry);
        scheduleFlush();
      } catch (err) {
        console.error("gRPC event processing error:", err);
      }
    };

    eventSource.addEventListener("transport-error", (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        transportReason = payload.reason || "gRPC transport error";
      } catch {
        transportReason = "gRPC transport error";
      }
    });

    eventSource.onerror = () => {
      streamConnected = false;
      if (!transportReason) transportReason = "SSE connection to server failed";
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      // Respect the user's transport choice — only retry if still on gRPC.
      if (transport === "grpc") {
        reconnectTimer = setTimeout(connectStream, 10000);
      }
    };
  }

  function setTransport(next: "rest" | "grpc") {
    if (next === transport) return;
    transport = next;
    if (next === "grpc") {
      stopAutoRefresh();
      connectStream();
    } else {
      closeStream();
      streamedMetrics = [];
      startAutoRefresh();
      // Kick an immediate REST fetch so the table populates right away.
      invalidate("app:metrics");
    }
  }

  function handleFieldChange() {
    submitQuery();
    if (transport === "grpc") {
      connectStream();
    } else {
      startAutoRefresh();
    }
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
      username: "",
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
    <div class="panel-header-compact">
      <div class="panel-header-row">
        <h2 class="panel-title">Metrics Query</h2>
        <div class="panel-meta">
          <button
            class="header-btn query-btn"
            onclick={submitQuery}
            data-testid="query-btn"
          >
            <span class="status-dot" data-status={queryStatus}></span> Query
          </button>
        </div>
      </div>
    </div>

    <div class="panel-content" oninput={() => queryStatus = "dirty"}>
      <MetricsQueryForm
        bind:queryForm
        bind:filtersExpanded
        onFieldChange={handleFieldChange}
        onClear={clearQuery}
        onSubmit={submitQuery}
        showAutoRefresh={false}
        showClearButton={false}
        showRefreshButton={false}
        {transport}
      />
    </div>
  </div>

  <!-- Panel 2: Results -->
  <div class="panel full-width-panel">
    <div class="panel-header-compact">
      <div class="panel-header-row">
        <h2 class="panel-title">Results{#if metrics?.metrics && metrics.metrics.length > 0} <span class="panel-title-count">— {metrics.count} calls from {obpInfo.displayName}</span>{/if}</h2>
        <div class="panel-meta">
          {#if transport === "rest"}
            <button
              class="url-toggle"
              onclick={() => showUrl = !showUrl}
              title={showUrl ? "Hide URL" : "Show URL"}
            >
              {showUrl ? "▼" : "▶"} URL
            </button>
            <span class="meta-separator">•</span>
          {/if}
          <div class="transport-toggle" role="group" aria-label="Transport">
            <button
              type="button"
              class="transport-toggle-btn"
              data-active={transport === "rest"}
              onclick={() => setTransport("rest")}
              data-testid="transport-rest"
            >
              REST
            </button>
            <button
              type="button"
              class="transport-toggle-btn"
              data-active={transport === "grpc"}
              onclick={() => setTransport("grpc")}
              data-testid="transport-grpc"
            >
              gRPC
              {#if transport === "grpc"}
                <span
                  class="transport-dot {streamConnected ? 'transport-dot-on' : 'transport-dot-off'}"
                  title={streamConnected ? "Connected" : transportReason || "Connecting..."}
                ></span>
              {/if}
            </button>
          </div>
          <span class="meta-separator">•</span>
          <button
            class="freeze-btn"
            onclick={toggleFrozen}
            data-testid="freeze-btn"
            data-state={frozen ? "frozen" : "running"}
          >
            {frozen ? `Continue${pendingMetrics.length > 0 ? ` (+${pendingMetrics.length})` : ""}` : "Freeze"}
          </button>
          {#if transport === "rest"}
            <span class="meta-separator">•</span>
            <span class="timestamp-color-{timestampColorIndex}">{lastRefreshTime}</span>
            <span class="meta-separator">•</span>
            <label class="refresh-interval">
              <span>Every</span>
              <select
                bind:value={refreshSeconds}
                onchange={handleRefreshIntervalChange}
                data-testid="refresh-interval"
              >
                {#each REFRESH_OPTIONS as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </label>
            {#if refreshSeconds > 0}
              {#if isCountingDown}
                <span class="countdown">{countdown}s</span>
              {:else}
                <span class="countdown-idle">{countdown}s</span>
              {/if}
            {/if}
            <button
              class="refresh-btn-inline"
              onclick={submitQuery}
              title="Manual refresh"
            >
              🔄
            </button>
          {/if}
        </div>
      </div>
      {#if showUrl && transport === "rest"}
        <div class="url-display">
          <code>{obpInfo.baseUrl}/obp/v6.0.0/management/metrics?{currentQueryString}</code>
        </div>
      {/if}
    </div>

    <div class="panel-content">
      {#if metrics?.metrics && metrics.metrics.length > 0}
        <div class="table-wrapper">
          {#key data.lastUpdated}
            <table class="metrics-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Method</th>
                  <th>Status</th>
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
                      {metric.username || "Anonymous"}
                    </td>
                    <td class="method-cell">
                      <span
                        class="method-badge method-{metric.verb.toLowerCase()}"
                      >
                        {metric.verb}
                      </span>
                    </td>
                    <td class="status-cell">
                      {#if metric.status_code}
                        <span
                          class="status-badge"
                          class:status-2xx={metric.status_code >= 200 && metric.status_code < 300}
                          class:status-3xx={metric.status_code >= 300 && metric.status_code < 400}
                          class:status-4xx={metric.status_code >= 400 && metric.status_code < 500}
                          class:status-5xx={metric.status_code >= 500}
                        >
                          {metric.status_code}
                        </span>
                      {:else}
                        <span class="status-muted">—</span>
                      {/if}
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
                    <td colspan="6" class="endpoint-cell-full">
                      <code
                        class="api-instance-id"
                        title={`API Instance ID: ${metric.api_instance_id || "N/A"}`}
                        >{metric.api_instance_id ? metric.api_instance_id.slice(0, 8) : "N/A"}</code
                      >
                      {#if metric.consumer_id}
                        <a
                          href="/consumers/{metric.consumer_id}/edit"
                          title={`Consumer ID: ${metric.consumer_id} — click to open consumer details`}
                          data-testid="metric-consumer-id-link"
                          class="consumer-id-link"
                        >
                          <code class="consumer-id">{metric.consumer_id.slice(0, 8)}</code>
                          {#if metric.app_name}
                            <span class="app-name-inline">{metric.app_name}</span>
                          {/if}
                        </a>
                      {:else}
                        <code class="consumer-id consumer-id-missing" title="No consumer ID for this call">N/A</code>
                        {#if metric.app_name}
                          <span class="app-name-inline app-name-plain">{metric.app_name}</span>
                        {/if}
                      {/if}
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
                  </tr>
                  <tr class="metric-row-operation">
                    <td colspan="6" class="endpoint-cell-full">
                      <span class="endpoint-path">
                        <code class="endpoint-path-text">{metric.url}</code>
                        <button
                          type="button"
                          class="url-copy-btn"
                          aria-label="Copy URL"
                          title="Copy URL"
                          data-testid="copy-metric-url"
                          onclick={() => copyToClipboard(metric.url, "URL")}
                        >
                          <svg class="url-copy-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/key}
        </div>
      {:else if hasApiAccess && transport === "grpc"}
        <div class="empty-state">
          <div
            style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; text-align: center;"
          >
            🟢
          </div>
          <h4
            style="color: #4a5568; margin-bottom: 0.5rem; font-size: 1.125rem; text-align: center;"
          >
            {streamConnected ? "Listening for live metrics…" : "Connecting to gRPC stream…"}
          </h4>
          <p style="text-align: center; margin-bottom: 0;">
            {streamConnected
              ? "New API calls will appear here as they happen."
              : transportReason || "Establishing connection to the metrics stream."}
          </p>
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
            onclick={submitQuery}
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
    /* Allow shrinking below intrinsic min-width so the metrics table's
       min-width: 800px doesn't expand the outer grid track. */
    min-width: 0;
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
    /* overflow-x: clip prevents the metrics table from pushing a page-level
       horizontal scrollbar. overflow-y: visible lets position:sticky on the
       header work relative to the viewport. */
    overflow-x: clip;
    overflow-y: visible;
    margin-bottom: 1.5rem;
    width: 100%;
    min-width: 0;
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

  /* Results panel header stays pinned so Freeze / transport toggle are always reachable. */
  .full-width-panel > .panel-header-compact {
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
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
    flex-wrap: wrap;
    min-width: 0;
    font-size: 0.875rem;
    color: var(--color-surface-600);
  }

  :global([data-mode="dark"]) .panel-meta {
    color: var(--color-surface-400);
  }

  .header-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    background: transparent;
    border: 1px solid var(--color-surface-300);
    border-radius: 0.25rem;
    cursor: pointer;
    color: var(--color-surface-600);
    white-space: nowrap;
  }

  .header-btn:hover {
    background: var(--color-surface-200);
    color: var(--color-surface-800);
  }

  :global([data-mode="dark"]) .header-btn {
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .header-btn:hover {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
  }

  .query-btn {
    background: var(--color-primary-500);
    color: white;
    border-color: var(--color-primary-500);
    font-weight: 600;
  }

  .query-btn:hover {
    background: var(--color-primary-600);
    border-color: var(--color-primary-600);
    color: white;
  }

  :global([data-mode="dark"]) .query-btn {
    background: var(--color-primary-500);
    color: white;
    border-color: var(--color-primary-500);
  }

  :global([data-mode="dark"]) .query-btn:hover {
    background: var(--color-primary-400);
    border-color: var(--color-primary-400);
    color: white;
  }

  .status-dot {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    vertical-align: middle;
  }

  .status-dot[data-status="fresh"] {
    background: #22c55e;
  }

  .status-dot[data-status="dirty"] {
    background: #f97316;
  }

  .header-fields {
    flex-wrap: wrap;
  }

  .hf {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin: 0;
    cursor: default;
  }

  .hf span {
    color: var(--color-surface-500);
    font-size: 0.8rem;
    font-weight: 500;
    white-space: nowrap;
    user-select: none;
  }

  :global([data-mode="dark"]) .hf span {
    color: var(--color-surface-400);
  }

  .hf input,
  .hf select {
    padding: 0.2rem 0.3rem;
    border: 1px solid var(--color-surface-300);
    border-radius: 0.2rem;
    font-size: 0.8rem;
    background: white;
    color: var(--color-surface-900);
    line-height: 1.2;
  }

  :global([data-mode="dark"]) .hf input,
  :global([data-mode="dark"]) .hf select {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  .hf input:focus,
  .hf select:focus {
    outline: none;
    border-color: var(--color-primary-500);
  }

  .hf input[type="datetime-local"] {
    width: 11rem;
  }

  .hf input[type="number"] {
    width: 3.5rem;
  }

  .hf-tiny input[type="number"] {
    width: 3rem;
  }

  .hf-sm select {
    width: 4.5rem;
  }

  .hf-xs select {
    width: 3.5rem;
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
    font-size: 0.65rem;
    color: var(--color-surface-700);
    word-break: break-all;
  }

  :global([data-mode="dark"]) .url-display code {
    color: var(--color-surface-300);
  }

  .refresh-interval {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .refresh-interval select {
    padding: 0.125rem 0.25rem;
    font-size: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    background: white;
    color: #374151;
    cursor: pointer;
  }

  :global([data-mode="dark"]) .refresh-interval select {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-200);
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

  .freeze-btn {
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 0.375rem;
    border: 1px solid #d1d5db;
    background: white;
    color: #374151;
    cursor: pointer;
  }

  .freeze-btn:hover {
    background: #f9fafb;
  }

  .freeze-btn[data-state="frozen"] {
    background: #fef3c7;
    color: #92400e;
    border-color: #fde68a;
  }

  :global([data-mode="dark"]) .freeze-btn {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-200);
  }

  :global([data-mode="dark"]) .freeze-btn[data-state="frozen"] {
    background: rgba(251, 191, 36, 0.2);
    color: rgb(253, 224, 71);
    border-color: rgba(251, 191, 36, 0.4);
  }

  .transport-toggle {
    display: inline-flex;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    overflow: hidden;
  }

  :global([data-mode="dark"]) .transport-toggle {
    border-color: rgb(var(--color-surface-600));
  }

  .transport-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 500;
    background: white;
    color: #6b7280;
    border: none;
    cursor: pointer;
  }

  .transport-toggle-btn + .transport-toggle-btn {
    border-left: 1px solid #d1d5db;
  }

  :global([data-mode="dark"]) .transport-toggle-btn {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-300);
  }

  :global([data-mode="dark"]) .transport-toggle-btn + .transport-toggle-btn {
    border-left-color: rgb(var(--color-surface-600));
  }

  .transport-toggle-btn[data-active="true"] {
    background: #3b82f6;
    color: white;
  }

  :global([data-mode="dark"]) .transport-toggle-btn[data-active="true"] {
    background: rgb(var(--color-primary-600));
  }

  .transport-toggle-btn:hover:not([data-active="true"]) {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .transport-toggle-btn:hover:not([data-active="true"]) {
    background: rgb(var(--color-surface-600));
  }

  .transport-dot {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
  }

  .transport-dot-on {
    background: #22c55e;
  }

  .transport-dot-off {
    background: #f59e0b;
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

  .panel-title-count {
    font-weight: 400;
    font-size: 0.9rem;
    color: var(--color-surface-500);
  }

  :global([data-mode="dark"]) .panel-title-count {
    color: var(--color-surface-400);
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

  .metric-row-main td {
    border-bottom: none;
  }

  .metric-row-endpoint,
  .metric-row-operation {
    background: var(--color-surface-50);
  }

  :global([data-mode="dark"]) .metric-row-endpoint,
  :global([data-mode="dark"]) .metric-row-operation {
    background: var(--color-surface-900);
  }

  .metric-row-endpoint td {
    padding-top: 0;
    padding-bottom: 0.5rem;
    border-bottom: none;
  }

  .metric-row-operation td {
    padding-top: 0.375rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-surface-300);
  }

  :global([data-mode="dark"]) .metric-row-operation td {
    border-color: var(--color-surface-700);
  }

  .metric-row-main:hover,
  .metric-row-main:hover + .metric-row-endpoint,
  .metric-row-main:hover + .metric-row-endpoint + .metric-row-operation {
    background: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .metric-row-main:hover,
  :global([data-mode="dark"]) .metric-row-main:hover + .metric-row-endpoint,
  :global([data-mode="dark"]) .metric-row-main:hover + .metric-row-endpoint + .metric-row-operation {
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
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  :global([data-mode="dark"]) .endpoint-path {
    background: var(--color-surface-800);
  }

  .url-copy-btn {
    padding: 0.125rem;
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    color: var(--color-surface-500);
    line-height: 0;
  }

  .url-copy-btn:hover {
    background: var(--color-surface-300);
    color: var(--color-surface-800);
  }

  :global([data-mode="dark"]) .url-copy-btn {
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .url-copy-btn:hover {
    background: var(--color-surface-700);
    color: var(--color-surface-200);
  }

  .url-copy-icon {
    width: 0.875rem;
    height: 0.875rem;
  }

  .user-cell {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .app-name-inline {
    margin-right: 0.5rem;
    color: #9d174d;
    font-weight: 500;
    font-family: system-ui, sans-serif;
    font-size: 0.8125rem;
  }

  :global([data-mode="dark"]) .app-name-inline {
    color: rgb(249, 168, 212);
  }

  .consumer-id-link:hover .app-name-inline {
    text-decoration: underline;
  }

  .app-name-plain {
    opacity: 0.7;
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

  .status-cell {
    text-align: center;
    white-space: nowrap;
  }

  .status-badge {
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-family: monospace;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .status-badge.status-2xx {
    background: #d1fae5;
    color: #065f46;
  }

  .status-badge.status-3xx {
    background: #dbeafe;
    color: #1e40af;
  }

  .status-badge.status-4xx {
    background: #fef3c7;
    color: #92400e;
  }

  .status-badge.status-5xx {
    background: #fee2e2;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .status-badge.status-2xx {
    background: rgba(16, 185, 129, 0.2);
    color: rgb(110, 231, 183);
  }

  :global([data-mode="dark"]) .status-badge.status-3xx {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(147, 197, 253);
  }

  :global([data-mode="dark"]) .status-badge.status-4xx {
    background: rgba(251, 191, 36, 0.2);
    color: rgb(253, 224, 71);
  }

  :global([data-mode="dark"]) .status-badge.status-5xx {
    background: rgba(239, 68, 68, 0.2);
    color: rgb(252, 165, 165);
  }

  .status-muted {
    color: #9ca3af;
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

  .api-instance-id {
    margin-right: 0.5rem;
    background: var(--color-primary-100);
    color: var(--color-primary-800);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: help;
  }

  :global([data-mode="dark"]) .api-instance-id {
    background: var(--color-primary-900);
    color: var(--color-primary-200);
  }

  .consumer-id {
    margin-right: 0.5rem;
    background: #fce7f3;
    color: #9d174d;
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: help;
  }

  :global([data-mode="dark"]) .consumer-id {
    background: rgba(236, 72, 153, 0.18);
    color: rgb(249, 168, 212);
  }

  .consumer-id-link {
    text-decoration: none;
  }

  .consumer-id-link:hover .consumer-id {
    background: #fbcfe8;
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .consumer-id-link:hover .consumer-id {
    background: rgba(236, 72, 153, 0.3);
  }

  .consumer-id-missing {
    opacity: 0.6;
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
