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
  let { data } = $props();

  let logs = $state<any[]>([]);
  let logLevel = $state<string>("");
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let lastUpdated = $state<string>("");
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let copiedMessageIndex = $state<number | null>(null);

  let eventSource: EventSource | null = null;
  let streamConnected = $state(false);
  let transportReason = $state<string>("");
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Performance: cap rendered rows and batch incoming events.
  const ROW_LIMIT_OPTIONS = [5, 7, 10, 25, 50, 100, 250, 500, 1000];
  let maxRows = $state(25);
  let pendingLogs: any[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let nextLogId = 0;
  let frozen = $state(false);
  let tableWrapper: HTMLDivElement | null = $state(null);

  // Trim existing logs when maxRows is reduced.
  $effect(() => {
    if (logs.length > maxRows) {
      logs = logs.slice(logs.length - maxRows);
    }
  });

  function isAtBottom(el: HTMLElement): boolean {
    return el.scrollHeight - el.scrollTop - el.clientHeight < 32;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (tableWrapper) {
        tableWrapper.scrollTop = tableWrapper.scrollHeight;
      }
    });
  }

  function flushPending() {
    flushTimer = null;
    if (frozen) return;
    if (pendingLogs.length === 0) return;
    const incoming = pendingLogs;
    pendingLogs = [];
    const wasAtBottom = tableWrapper ? isAtBottom(tableWrapper) : true;
    // Append newest at the bottom (tail -f order), trim from the top.
    const next = [...logs, ...incoming];
    logs = next.length > maxRows ? next.slice(next.length - maxRows) : next;
    lastUpdated = new Date().toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    if (wasAtBottom) scrollToBottom();
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flushPending, 200);
  }

  function toggleFrozen() {
    frozen = !frozen;
    if (!frozen) {
      // Resume — flush any queued events immediately.
      flushPending();
    }
  }

  const logLevels = [
    { value: "", label: "ALL" },
    { value: "ERROR", label: "ERROR" },
    { value: "WARNING", label: "WARNING" },
    { value: "INFO", label: "INFO" },
    { value: "DEBUG", label: "DEBUG" },
  ];

  function getLogTimestamp(log: any): string {
    if (log.timestamp) return log.timestamp;
    const parsed = parseLogMessage(log.message || "");
    return parsed.timestamp;
  }

  async function fetchLogs() {
    try {
      isLoading = true;
      error = null;

      const level = encodeURIComponent((logLevel || "ALL").toLowerCase());
      const url = `/proxy/obp/v6.0.0/system/log-cache/${level}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message;
        throw new Error(
          `Failed to fetch logs (${response.status}): ${errorMsg}`,
        );
      }

      const data = await response.json();

      if (data.message) {
        throw new Error(data.message);
      }

      if (frozen) return;

      // Sort ascending by embedded timestamp so newest lands at the bottom.
      const raw = Array.isArray(data) ? data : data.entries || [];
      const sorted = [...raw].sort((a, b) =>
        getLogTimestamp(a).localeCompare(getLogTimestamp(b)),
      );
      const trimmed =
        sorted.length > maxRows ? sorted.slice(sorted.length - maxRows) : sorted;

      const wasAtBottom = tableWrapper ? isAtBottom(tableWrapper) : true;
      logs = trimmed.map((e) => ({ ...e, __id: nextLogId++ }));
      lastUpdated = new Date().toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      if (wasAtBottom) scrollToBottom();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch logs";
    } finally {
      isLoading = false;
    }
  }

  function startPolling() {
    if (refreshInterval) return;
    // Initial fetch only if we have nothing yet
    if (logs.length === 0) fetchLogs();
    refreshInterval = setInterval(() => {
      fetchLogs();
    }, 5000);
  }

  function stopPolling() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  function mapLevelForStream(level: string): string {
    const upper = (level || "").toUpperCase();
    if (!upper) return "ALL";
    if (upper === "WARNING") return "WARNING";
    return upper;
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
    pendingLogs = [];
  }

  function connectStream() {
    closeStream();
    const url = `/backend/log-cache/stream?level=${encodeURIComponent(mapLevelForStream(logLevel))}`;
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      streamConnected = true;
      transportReason = "";
      // gRPC connected — stop polling
      stopPolling();
      // Fetch current buffered entries once so the table isn't empty
      if (logs.length === 0) fetchLogs();
    };

    eventSource.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        entry.__id = nextLogId++;
        pendingLogs.push(entry);
        scheduleFlush();
      } catch {
        // ignore parse errors
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
      if (!transportReason) {
        transportReason = "SSE connection to server failed";
      }
      closeStream();
      startPolling();
      // Retry gRPC after 10s
      reconnectTimer = setTimeout(connectStream, 10000);
    };
  }

  function handleLogLevelChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    logLevel = target.value;
    // Reset and re-subscribe with new level
    logs = [];
    connectStream();
  }

  function parseLogMessage(message: string): {
    timestamp: string;
    source: string;
    cleanMessage: string;
  } {
    // Parse format: [2025-11-23 16:37:53Z] [thread-name] [Source] message
    const pattern = /^\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)$/;
    const match = message.match(pattern);

    if (match) {
      return {
        timestamp: match[1],
        source: match[3],
        cleanMessage: match[4],
      };
    }

    return {
      timestamp: "",
      source: "",
      cleanMessage: message,
    };
  }

  function formatTimestamp(timestamp: string): string {
    if (!timestamp) return "N/A";
    try {
      const date = new Date(timestamp);
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return timestamp;
    }
  }

  function getLogLevelClass(level: string): string {
    switch (level?.toUpperCase()) {
      case "ERROR":
        return "log-level-error";
      case "WARN":
      case "WARNING":
        return "log-level-warn";
      case "INFO":
        return "log-level-info";
      case "DEBUG":
        return "log-level-debug";
      default:
        return "";
    }
  }

  // Initialize on mount - run only once
  let initialized = $state(false);

  $effect(() => {
    if (typeof window !== "undefined" && !initialized) {
      initialized = true;
      connectStream();
    }
  });

  // Cleanup effect
  $effect(() => {
    return () => {
      stopPolling();
      closeStream();
    };
  });

  async function copyMessage(log: any, index: number) {
    try {
      const parsed = parseLogMessage(log.message || "");
      const timestamp = formatTimestamp(parsed.timestamp);
      const level = log.level || log.log_level || "N/A";
      const message = parsed.cleanMessage || "N/A";
      const source = parsed.source || "N/A";

      const rowData = `${timestamp},${level},${message},${source}`;
      await navigator.clipboard.writeText(rowData);
      copiedMessageIndex = index;
      setTimeout(() => {
        copiedMessageIndex = null;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  }
</script>

<svelte:head>
  <title>Log Cache - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
    <div class="panel">
      <div class="panel-header">
        <div class="header-content">
          <div>
            <h1 class="panel-title">LogCache</h1>
            <div class="panel-subtitle">
              View and monitor cached logs from the OBP API
            </div>
          </div>
          <div class="header-controls">
            <div class="header-row">
              <div class="filter-group">
                <label for="logLevel" class="filter-label">Log Level:</label>
                <select
                  id="logLevel"
                  value={logLevel}
                  onchange={handleLogLevelChange}
                  class="filter-select"
                >
                  {#each logLevels as level}
                    <option value={level.value}>{level.label}</option>
                  {/each}
                </select>
              </div>
              <div class="filter-group">
                <label for="rowLimit" class="filter-label">Rows:</label>
                <select
                  id="rowLimit"
                  bind:value={maxRows}
                  class="filter-select"
                  data-testid="row-limit-select"
                >
                  {#each ROW_LIMIT_OPTIONS as opt}
                    <option value={opt}>{opt}</option>
                  {/each}
                </select>
              </div>
              <button
                class="freeze-btn"
                onclick={toggleFrozen}
                data-testid="freeze-btn"
                data-state={frozen ? "frozen" : "running"}
              >
                {frozen ? `Continue${pendingLogs.length > 0 ? ` (+${pendingLogs.length})` : ""}` : "Freeze"}
              </button>
              <div
                class="transport-indicator"
                data-transport={streamConnected ? "grpc" : "rest"}
                title={streamConnected
                  ? "gRPC live stream"
                  : transportReason
                    ? `Polling (fallback): ${transportReason}`
                    : "Polling fallback"}
              >
                <span
                  class="transport-dot {streamConnected ? 'transport-dot-on' : 'transport-dot-off'}"
                ></span>
                {streamConnected ? "gRPC live" : "Polling"}
              </div>
            </div>
            {#if lastUpdated}
              <div class="last-updated">
                Last updated: <span class="timestamp">{lastUpdated}</span>
              </div>
            {/if}
          </div>
        </div>
      </div>
      <div class="panel-content">
        {#if error}
          <div class="alert alert-error">
            <strong>Error:</strong>
            {error}
          </div>
        {/if}

        {#if isLoading && logs.length === 0}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading logs...</p>
          </div>
        {:else if logs.length > 0}
          <div class="logs-container">
            <div class="table-wrapper" bind:this={tableWrapper}>
              <table class="logs-table">
                <tbody>
                  {#each logs as log, i (log.__id ?? i)}
                    {@const parsed = parseLogMessage(log.message || "")}
                    {@const displayTimestamp = parsed.timestamp ? parsed.timestamp : log.timestamp}
                    {@const displayMessage = parsed.cleanMessage ? parsed.cleanMessage : log.message}
                    {@const displaySource = parsed.source ? parsed.source : "gRPC"}
                    <tr class="log-main-row">
                      <td class="timestamp-cell">
                        {formatTimestamp(displayTimestamp)}
                      </td>
                      <td>
                        <span
                          class="log-level-badge {getLogLevelClass(
                            log.level || log.log_level,
                          )}"
                        >
                          {log.level || log.log_level || "N/A"}
                        </span>
                      </td>
                      <td class="source-cell">{displaySource}</td>
                      <td class="copy-cell">
                        <button
                          class="copy-btn"
                          onclick={() => copyMessage(log, i)}
                          title="Copy row"
                          aria-label="Copy row"
                        >
                          {#if copiedMessageIndex === i}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          {:else}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2"
                                ry="2"
                              ></rect>
                              <path
                                d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                              ></path>
                            </svg>
                          {/if}
                        </button>
                      </td>
                    </tr>
                    <tr class="log-message-row">
                      <td class="message-cell" colspan="4">
                        {displayMessage || "N/A"}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            <div class="logs-count">Showing {logs.length} log entries</div>
          </div>
        {:else}
          <div class="empty-state">
            <p>No logs found</p>
            {#if logLevel}
              <p class="text-sm">Try selecting a different log level</p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>

<style>
  .container {
    max-width: 1600px;
  }

  .panel {
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  :global([data-mode="dark"]) .panel {
    background: rgb(var(--color-surface-800));
  }

  .panel-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
  }

  .panel-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.5rem;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .header-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-end;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  :global([data-mode="dark"]) .filter-label {
    color: var(--color-surface-300);
  }

  .filter-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background: white;
    color: #111827;
    cursor: pointer;
  }

  .filter-select option {
    background: white;
    color: #111827;
  }

  :global([data-mode="dark"]) .filter-select {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .filter-select option {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-100);
  }

  .filter-select:focus {
    outline: none;
    border-color: #3b82f6;
    ring: 2px;
    ring-color: rgba(59, 130, 246, 0.2);
  }

  .header-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .freeze-btn {
    padding: 0.375rem 0.75rem;
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

  .transport-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .transport-indicator {
    color: var(--color-surface-400);
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

  .last-updated {
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .last-updated {
    color: var(--color-surface-400);
  }

  .timestamp {
    font-family: monospace;
    font-weight: 500;
    color: #374151;
  }

  :global([data-mode="dark"]) .timestamp {
    color: var(--color-surface-300);
  }

  .panel-content {
    padding: 1.5rem;
  }

  .logs-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .table-wrapper {
    overflow-x: auto;
    overflow-y: auto;
    max-width: 100%;
    max-height: 70vh;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
  }

  .logs-table thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: #f9fafb;
    box-shadow: inset 0 -2px 0 #e5e7eb;
  }

  :global([data-mode="dark"]) .logs-table thead th {
    background: rgb(var(--color-surface-700));
    box-shadow: inset 0 -2px 0 rgb(var(--color-surface-600));
  }

  :global([data-mode="dark"]) .table-wrapper {
    border-color: rgb(var(--color-surface-700));
  }

  .logs-table {
    width: 100%;
    border-collapse: collapse;
  }

  .logs-table th {
    text-align: left;
    padding: 0.75rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
    background: #f9fafb;
    border-bottom: 2px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .logs-table th {
    color: var(--color-surface-300);
    background: rgb(var(--color-surface-700));
    border-bottom-color: rgb(var(--color-surface-600));
  }

  .logs-table td {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: #111827;
  }

  :global([data-mode="dark"]) .logs-table td {
    color: var(--color-surface-100);
  }

  .log-main-row td {
    padding-bottom: 0.25rem;
  }

  .log-message-row td {
    padding-top: 0;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .log-message-row td {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .logs-table tbody tr.log-main-row:hover,
  .logs-table tbody tr.log-main-row:hover + tr.log-message-row {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .logs-table tbody tr.log-main-row:hover,
  :global([data-mode="dark"]) .logs-table tbody tr.log-main-row:hover + tr.log-message-row {
    background: rgb(var(--color-surface-700));
  }

  .logs-table tbody tr:last-child td {
    border-bottom: none;
  }

  .logs-table td.timestamp-cell {
    font-family: monospace;
    white-space: nowrap;
  }

  .message-cell {
    max-width: 600px;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .copy-cell {
    width: 40px;
    text-align: center;
    padding: 0.5rem;
  }

  .copy-btn {
    padding: 0.25rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: #6b7280;
    border-radius: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .copy-btn:hover {
    background: #f3f4f6;
    color: #3b82f6;
  }

  :global([data-mode="dark"]) .copy-btn {
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .copy-btn:hover {
    background: rgb(var(--color-surface-700));
    color: rgb(var(--color-primary-400));
  }

  .copy-btn:active {
    transform: scale(0.95);
  }

  .copy-btn svg {
    width: 16px;
    height: 16px;
  }

  .source-cell {
    font-family: monospace;
    font-size: 0.8125rem;
    color: #6b7280;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  :global([data-mode="dark"]) .source-cell {
    color: var(--color-surface-400);
  }

  .log-level-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .log-level-error {
    background: #fee2e2;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .log-level-error {
    background: rgb(var(--color-error-900));
    color: rgb(var(--color-error-200));
  }

  .log-level-warn {
    background: #fef3c7;
    color: #92400e;
  }

  :global([data-mode="dark"]) .log-level-warn {
    background: rgba(251, 191, 36, 0.2);
    color: rgb(253, 224, 71);
  }

  .log-level-info {
    background: #dbeafe;
    color: #1e40af;
  }

  :global([data-mode="dark"]) .log-level-info {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(147, 197, 253);
  }

  .log-level-debug {
    background: #e5e7eb;
    color: #374151;
  }

  :global([data-mode="dark"]) .log-level-debug {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-300);
  }

  .logs-count {
    font-size: 0.875rem;
    color: #6b7280;
    text-align: right;
  }

  :global([data-mode="dark"]) .logs-count {
    color: var(--color-surface-400);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  :global([data-mode="dark"]) .spinner {
    border-color: rgb(var(--color-surface-700));
    border-top-color: rgb(var(--color-primary-400));
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
  }

  .empty-state .text-sm {
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }

  .alert {
    padding: 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
  }

  .alert-error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  :global([data-mode="dark"]) .alert-error {
    background: rgb(var(--color-error-900));
    color: rgb(var(--color-error-200));
    border-color: rgb(var(--color-error-800));
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: stretch;
    }

    .header-controls {
      align-items: stretch;
    }

    .filter-group {
      flex-direction: column;
      align-items: stretch;
      gap: 0.25rem;
    }

    .filter-select {
      width: 100%;
    }

    .last-updated {
      text-align: center;
    }
  }
</style>
