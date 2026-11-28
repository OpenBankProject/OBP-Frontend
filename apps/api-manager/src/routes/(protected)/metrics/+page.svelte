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
  import { goto, replaceState } from "$app/navigation";
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

  // Why the list may be empty: check_api_metrics from Deployment Checks, read by the server load
  // only when no metrics came back and the user has CanGetConfig. Shown unless it is OK, because
  // with recording working an empty list just means nothing matched the filters.
  let metricsRecordingCheck = $derived(data.metricsRecordingCheck);
  let showMetricsRecordingNotice = $derived(
    !!metricsRecordingCheck && metricsRecordingCheck.status !== "OK",
  );

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
        timestamp: new Date().toLocaleTimeString(undefined, { hourCycle: "h23" }),
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

  let refreshInterval: ReturnType<typeof setInterval> | undefined = undefined;
  let countdownInterval: ReturnType<typeof setInterval> | undefined = undefined;
  let timeUpdateInterval: ReturnType<typeof setInterval> | undefined = undefined;
  let currentTime = $state(new Date().toLocaleString(undefined, { hourCycle: "h23" }));
  let lastRefreshTime = $state(new Date().toLocaleString(undefined, { hourCycle: "h23" }));
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
    sort_direction: "desc",
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
    consent_reference_id: "",
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
        sort_direction: urlParams.get("sort_direction") || "desc",
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
        consent_reference_id: urlParams.get("consent_reference_id") || "",
      };

      // Transport: an explicit ?transport= param wins; otherwise default to
      // gRPC when the 'OBP API (gRPC)' health check reported healthy at load.
      // Decided before submitQuery so the URL it writes carries the right value.
      const urlTransport = urlParams.get("transport");
      if (urlTransport === "grpc" || (urlTransport !== "rest" && data.grpcAvailable)) {
        setTransport("grpc");
      } else {
        // REST with polling; user can switch to gRPC.
        startAutoRefresh();
      }

      // Sync URL with form values
      submitQuery();

      // Update current time every second
      timeUpdateInterval = setInterval(() => {
        currentTime = new Date().toLocaleString(undefined, { hourCycle: "h23" });
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
    if (
      queryForm.consent_reference_id &&
      queryForm.consent_reference_id.trim() !== ""
    ) {
      params.set("consent_reference_id", queryForm.consent_reference_id);
    }

    params.set("limit", String(queryForm.limit));
    params.set("offset", String(queryForm.offset));
    params.set("sort_by", queryForm.sort_by);
    params.set("sort_direction", queryForm.sort_direction);

    return params.toString();
  }

  let currentQueryString = $state(buildQueryString());

  function submitQuery() {
    currentQueryString = buildQueryString();
    lastRefreshTime = new Date().toLocaleString(undefined, { hourCycle: "h23" });
    timestampColorIndex = (timestampColorIndex + 1) % 2;

    // transport rides on the page URL only — currentQueryString is also shown
    // as (and forwarded to) the OBP API call, which knows no such parameter.
    const newUrl = `/metrics?${currentQueryString}&transport=${transport}`;
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
        lastRefreshTime = new Date().toLocaleString(undefined, { hourCycle: "h23" });
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
    lastRefreshTime = new Date().toLocaleString(undefined, { hourCycle: "h23" });
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
    if (queryForm.consent_reference_id)
      params.set("consent_reference_id", queryForm.consent_reference_id);
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

    eventSource.addEventListener("session-ended", () => {
      // The server ended the stream because the session is gone (logout in another
      // tab, or expiry). Never keep privileged data on screen past that point.
      streamConnected = false;
      closeStream();
      window.location.href = `/login?redirect_to=${encodeURIComponent(
        window.location.pathname + window.location.search,
      )}`;
    });

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
    // Keep the choice in the page URL so reloads and shared links preserve it.
    const pageUrl = new URL(window.location.href);
    pageUrl.searchParams.set("transport", next);
    replaceState(pageUrl, {});
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
      sort_direction: "desc",
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
      consent_reference_id: "",
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
      hourCycle: "h23",
      minute: "2-digit",
      second: "2-digit",
    });
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
        <div class="panel-title-group">
          <h2 class="panel-title">Metrics Query</h2>
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
        </div>
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
                  <th>Correlation ID / Consent Ref ID</th>
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
                      <code
                        class="consent-reference-id"
                        data-testid="metric-consent-reference-id"
                        >{metric.consent_reference_id || "---"}</code
                      >
                    </td>
                  </tr>
                  <tr class="metric-row-endpoint">
                    <td colspan="6" class="endpoint-cell-full">
                      <code
                        class="api-instance-id"
                        >{metric.api_instance_id ? metric.api_instance_id.slice(0, 8) : "N/A"}</code
                      >
                      {#if metric.consumer_id}
                        <a
                          href="/consumers/{metric.consumer_id}/edit"
                          data-testid="metric-consumer-id-link"
                          class="consumer-id-link"
                        >
                          <code class="consumer-id">{metric.consumer_id.slice(0, 8)}</code>
                          {#if metric.app_name}
                            <span class="app-name-inline">{metric.app_name}</span>
                          {/if}
                        </a>
                      {:else}
                        <code class="consumer-id consumer-id-missing">N/A</code>
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
                        >
                          <code class="operation-id">{getOperationId(metric)}</code>
                        </a>
                      {:else}
                        <code class="operation-id">{getOperationId(metric)}</code>
                      {/if}
                      <span
                        class="client-address"
                        data-testid="metric-source-ip"
                      >
                        <span class="address-label">Client IP address</span>
                        <code>{metric.source_ip || "---"}</code>
                      </span>
                      <span
                        class="forwarded-for"
                        data-testid="metric-forwarded-for"
                      >
                        <span class="address-label">Forwarded for (hops)</span>
                        <code>{metric.forwarded_for || "---"}</code>
                      </span>
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
          <h4 class="ui-muted"
            style="margin-bottom: 0.5rem; font-size: 1.125rem; text-align: center;"
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
          <h4 class="ui-muted"
            style="margin-bottom: 0.5rem; font-size: 1.125rem; text-align: center;"
          >
            No API Metrics Found
          </h4>
          <p style="text-align: center; margin-bottom: 1.5rem;">
            No recent API requests found for <strong
              >{obpInfo.displayName}</strong
            >.
          </p>
          {#if showMetricsRecordingNotice && metricsRecordingCheck}
            <div
              class="metrics-recording-notice"
              class:metrics-recording-notice-warning={metricsRecordingCheck.status === "WARNING"}
              data-testid="metrics-recording-notice"
            >
              <p class="metrics-recording-notice-message">{metricsRecordingCheck.message}</p>
              {#if metricsRecordingCheck.evidence.length > 0}
                <ul class="metrics-recording-notice-evidence">
                  {#each metricsRecordingCheck.evidence as item (item.name)}
                    <li><span>{item.name}:</span> <code>{item.value}</code></li>
                  {/each}
                </ul>
              {/if}
              <a href="/deployment-checks" class="metrics-recording-notice-link">See Deployment Checks</a>
            </div>
          {/if}
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
    background: var(--ui-panel);
    border-bottom: 1px solid var(--ui-border);
    padding: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .panel-header-compact {
    background: var(--ui-panel);
    border-bottom: 1px solid var(--ui-border);
    padding: 0.75rem 1.5rem;
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

  .panel-title-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .panel-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-width: 0;
    font-size: 0.875rem;
    color: var(--ui-muted);
  }

  .header-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    background: transparent;
    border: 1px solid var(--ui-border);
    border-radius: 0.25rem;
    cursor: pointer;
    color: var(--ui-muted);
    white-space: nowrap;
  }

  .header-btn:hover {
    background: var(--ui-hover);
    color: var(--ui-text);
  }

  .query-btn {
    background: var(--ui-fill-main-bg);
    color: var(--ui-fill-main-text);
    border-color: var(--ui-border-brand);
    font-weight: 600;
  }

  .query-btn:hover {
    opacity: 0.85;
    border-color: var(--ui-border-brand);
    color: var(--ui-fill-main-text);
  }

  .status-dot {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    vertical-align: middle;
  }

  .status-dot[data-status="fresh"] {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .status-dot[data-status="dirty"] {
    background: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
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
    color: var(--ui-muted);
    font-size: 0.8rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .hf input,
  .hf select {
    padding: 0.2rem 0.3rem;
    border: 1px solid var(--ui-border);
    border-radius: 0.2rem;
    font-size: 0.8rem;
    background: var(--ui-card);
    color: var(--ui-text);
    line-height: 1.2;
  }

  .hf input:focus,
  .hf select:focus {
    outline: none;
    border-color: var(--ui-link);
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
    color: var(--ui-muted);
  }

  .url-toggle {
    background: none;
    border: 1px solid var(--ui-border);
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--ui-muted);
    transition: all 0.2s;
  }

  .url-toggle:hover {
    background: var(--ui-hover);
    color: var(--ui-text);
  }

  .url-display {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: var(--ui-panel);
    border-radius: 4px;
    overflow-x: auto;
  }

  .url-display code {
    font-size: 0.65rem;
    color: var(--ui-text);
    word-break: break-all;
  }

  .refresh-interval {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--ui-muted);
  }

  .refresh-interval select {
    padding: 0.125rem 0.25rem;
    font-size: 0.75rem;
    border: 1px solid var(--ui-border);
    border-radius: 0.25rem;
    background: var(--ui-card);
    color: var(--ui-text);
    cursor: pointer;
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
    border: 1px solid var(--ui-border);
    background: var(--ui-card);
    color: var(--ui-text);
    cursor: pointer;
  }

  .freeze-btn:hover {
    background: var(--ui-hover);
  }

  .freeze-btn[data-state="frozen"] {
    background: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
    border-color: var(--ui-tone-warning-border);
  }

  .transport-toggle {
    display: inline-flex;
    border: 1px solid var(--ui-border);
    border-radius: 0.375rem;
    overflow: hidden;
  }

  .transport-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--ui-card);
    color: var(--ui-muted);
    border: none;
    cursor: pointer;
  }

  .transport-toggle-btn + .transport-toggle-btn {
    border-left: 1px solid var(--ui-border);
  }

  .transport-toggle-btn[data-active="true"] {
    background: var(--ui-fill-main-bg);
    color: var(--ui-fill-main-text);
  }

  .transport-toggle-btn:hover:not([data-active="true"]) {
    background: var(--ui-hover);
  }

  .transport-dot {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
  }

  .transport-dot-on {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .transport-dot-off {
    background: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
  }

  .panel-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0;
  }

  .panel-title-count {
    font-weight: 400;
    font-size: 0.9rem;
    color: var(--ui-muted);
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

  .metric-row-main td {
    border-bottom: none;
  }

  .metric-row-endpoint,
  .metric-row-operation {
    background: var(--ui-card);
  }

  .metric-row-endpoint td {
    padding-top: 0;
    padding-bottom: 0.5rem;
    border-bottom: none;
  }

  .metric-row-operation td {
    padding-top: 0.375rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--ui-border);
  }

  .metric-row-main:hover,
  .metric-row-main:hover + .metric-row-endpoint,
  .metric-row-main:hover + .metric-row-endpoint + .metric-row-operation {
    background: var(--ui-hover);
  }

  .date-cell {
    font-family: monospace;
    font-size: 0.8125rem;
    color: var(--ui-muted);
    white-space: nowrap;
    min-width: 120px;
  }

  .endpoint-cell-full {
    font-family: monospace;
    font-size: 0.8125rem;
    word-break: break-all;
  }

  .endpoint-path {
    background: var(--ui-panel);
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.75rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .url-copy-btn {
    padding: 0.125rem;
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    color: var(--ui-muted);
    line-height: 0;
  }

  .url-copy-btn:hover {
    background: var(--ui-hover);
    color: var(--ui-text);
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
    color: var(--ui-error);
    font-weight: 500;
    font-family: system-ui, sans-serif;
    font-size: 0.8125rem;
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
    background: var(--ui-tone-accent-bg);
    color: var(--ui-tone-accent-text);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.75rem;
  }

  .operation-id-link {
    text-decoration: none;
  }

  .operation-id-link:hover .operation-id {
    background: var(--ui-tone-accent-bg);
    text-decoration: underline;
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
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .status-badge.status-3xx {
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
  }

  .status-badge.status-4xx {
    background: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
  }

  .status-badge.status-5xx {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
  }

  .status-muted {
    color: var(--ui-muted);
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
  }

  .correlation-cell .correlation-id,
  .correlation-cell .consent-reference-id {
    display: block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .correlation-cell .consent-reference-id {
    margin-top: 0.25rem;
    margin-left: 0;
  }

  .correlation-id {
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .api-instance-id {
    margin-right: 0.5rem;
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .client-address,
  .forwarded-for {
    display: inline-flex;
    align-items: baseline;
    gap: 0.25rem;
    margin-right: 0.5rem;
    font-size: 0.75rem;
  }

  /* The list of hops can hold several addresses: let it wrap rather than widen the table. */
  .forwarded-for code {
    white-space: normal;
    word-break: break-all;
  }

  .address-label {
    color: var(--ui-muted);
    font-family: sans-serif;
  }

  .consumer-id {
    margin-right: 0.5rem;
    background: var(--ui-tone-accent-bg);
    color: var(--ui-error);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .consumer-id-link {
    text-decoration: none;
  }

  .consumer-id-link:hover .consumer-id {
    background: var(--ui-tone-accent-bg);
    text-decoration: underline;
  }

  .consumer-id-missing {
    opacity: 0.6;
  }

  .consent-reference-id {
    margin-left: 0.5rem;
    background: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
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

  .metrics-recording-notice {
    margin: 0 auto 1.5rem;
    max-width: 36rem;
    padding: 0.875rem 1rem;
    border-radius: 6px;
    border: 1px solid var(--ui-tone-info-border);
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
    text-align: left;
    font-size: 0.875rem;
  }

  .metrics-recording-notice-warning {
    border-color: var(--ui-tone-warning-border);
    background: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
  }

  .metrics-recording-notice-message {
    margin: 0 0 0.5rem;
    font-weight: 600;
  }

  .metrics-recording-notice-evidence {
    margin: 0 0 0.5rem;
    padding-left: 1.25rem;
    list-style: disc;
  }

  .metrics-recording-notice-link {
    color: inherit;
    text-decoration: underline;
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
    color: var(--ui-text);
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--ui-border);
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
    color: var(--ui-text);
    margin-bottom: 0.25rem;
  }

  .form-input {
    padding: 0.5rem;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    font-size: 0.875rem;
    transition: border-color 0.2s;
    background: var(--ui-card);
    color: var(--ui-text);
  }

  .form-input:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-link) 100%, transparent);
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
