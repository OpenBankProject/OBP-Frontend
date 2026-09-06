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

  let migrations = $state<any[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let lastUpdated = $state<string>("");
  let refreshInterval: number | undefined = undefined;
  let countdownInterval: number | undefined = undefined;
  let initialized = $state(false);
  let secondsUntilRefresh = $state(600); // 10 minutes in seconds

  const REFRESH_INTERVAL_MS = 600000; // 10 minutes in milliseconds

  async function fetchMigrations() {
    try {
      isLoading = true;
      error = null;

      const response = await fetch("/proxy/obp/v6.0.0/system/migrations");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message;
        throw new Error(
          `Failed to fetch migrations (${response.status}): ${errorMsg}`,
        );
      }

      const data = await response.json();

      console.log("=== MIGRATIONS DATA RECEIVED ===");
      console.log("Data type:", typeof data);
      console.log("Is array:", Array.isArray(data));
      console.log("Data keys:", data ? Object.keys(data) : "null");
      console.log("Full data:", data);

      if (data.message) {
        throw new Error(data.message);
      }

      // Handle both array response and object with migrations/entries property
      migrations = Array.isArray(data)
        ? data
        : data.migrations ||
          data.entries ||
          data.migration_script_logs ||
          data.logs ||
          [];
      console.log("Parsed migrations count:", migrations.length);
      console.log("First migration entry:", migrations[0]);

      lastUpdated = new Date().toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch migrations";
      console.error("Error fetching migrations:", err);
      console.error("Full error details:", {
        url: "/proxy/obp/v6.0.0/system/migrations",
        timestamp: new Date().toISOString(),
      });
    } finally {
      isLoading = false;
    }
  }

  function startCountdown() {
    // Clear any existing countdown interval
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }

    // Reset countdown to 10 minutes
    secondsUntilRefresh = 600;

    // Update countdown every second
    countdownInterval = setInterval(() => {
      secondsUntilRefresh--;
      if (secondsUntilRefresh <= 0) {
        secondsUntilRefresh = 600;
      }
    }, 1000);
  }

  function stopCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = undefined;
    }
  }

  function startAutoRefresh() {
    // Clear any existing interval first
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    // Initial fetch
    fetchMigrations();

    // Start countdown
    startCountdown();

    // Set up 10-minute interval
    refreshInterval = setInterval(() => {
      fetchMigrations();
      startCountdown(); // Reset countdown on each refresh
    }, REFRESH_INTERVAL_MS);
  }

  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = undefined;
    }
    stopCountdown();
  }

  async function handleManualRefresh() {
    await fetchMigrations();
    // Reset the auto-refresh cycle
    stopAutoRefresh();
    startAutoRefresh();
  }

  function formatCountdown(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function formatTimestamp(timestamp: string | number): string {
    if (!timestamp) return "N/A";
    try {
      // Handle Unix timestamps (milliseconds) and ISO strings
      const date =
        typeof timestamp === "number"
          ? new Date(timestamp)
          : new Date(timestamp);
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
      return String(timestamp);
    }
  }

  function getStatusClass(status: string | boolean): string {
    if (typeof status === "boolean") {
      return status ? "status-success" : "status-error";
    }
    switch (status?.toUpperCase()) {
      case "COMPLETED":
      case "SUCCESS":
        return "status-success";
      case "PENDING":
      case "IN_PROGRESS":
        return "status-pending";
      case "FAILED":
      case "ERROR":
        return "status-error";
      default:
        return "status-default";
    }
  }

  // Initialize on mount - run only once
  $effect(() => {
    if (typeof window !== "undefined" && !initialized) {
      initialized = true;
      startAutoRefresh();
    }
  });

  // Cleanup effect
  $effect(() => {
    return () => {
      stopAutoRefresh();
    };
  });
</script>

<svelte:head>
  <title>Migrations - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
    <div class="panel">
      <div class="panel-header">
        <div class="header-content">
          <div>
            <h1 class="panel-title">Migrations</h1>
            <div class="panel-subtitle">
              Monitor database migrations and schema updates
            </div>
          </div>
          <div class="header-controls">
            <button
              class="refresh-button"
              onclick={handleManualRefresh}
              disabled={isLoading}
              aria-label="Refresh migrations now"
            >
              <svg
                class="refresh-icon"
                class:spinning={isLoading}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"
                />
              </svg>
              Refresh Now
            </button>
            <div class="refresh-info">
              {#if lastUpdated}
                <div class="last-updated">
                  Last updated: <span class="timestamp">{lastUpdated}</span>
                </div>
              {/if}
              <div class="next-refresh">
                Next refresh in: <span class="countdown"
                  >{formatCountdown(secondsUntilRefresh)}</span
                >
              </div>
            </div>
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

        {#if isLoading && migrations.length === 0}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading migrations...</p>
          </div>
        {:else if migrations.length > 0}
          <div class="migrations-container">
            <div class="table-wrapper">
<table class="migrations-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {#each migrations as migration}
                    <tr class="migration-main-row">
                      <td class="name-cell">
                        {migration.name || "N/A"}
                      </td>
                      <td>
                        <span
                          class="status-badge {getStatusClass(
                            migration.is_successful ? 'SUCCESS' : 'FAILED',
                          )}"
                        >
                          {migration.is_successful ? "SUCCESS" : "FAILED"}
                        </span>
                      </td>
                    </tr>
                    <tr class="migration-meta-row">
                      <td colspan="2">
                        <div class="meta-cell">
                          <span class="id-cell">{migration.migration_script_log_id || migration.id || "N/A"}</span>
                          <span class="timestamp-cell">{formatTimestamp(migration.created_at || migration.start_date)}</span>
                        </div>
                      </td>
                    </tr>
                    <tr class="migration-desc-row">
                      <td colspan="2" class="description-cell">
                        <span class="description-label">Description:</span>
                        {migration.remark || migration.description || "N/A"}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            <div class="migrations-count">
              Showing {migrations.length} migration{migrations.length !== 1
                ? "s"
                : ""}
            </div>
          </div>
        {:else}
          <div class="empty-state">
            <p>No migrations found</p>
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

  .refresh-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .refresh-button:hover:not(:disabled) {
    background: #2563eb;
  }

  .refresh-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .refresh-button {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .refresh-button:hover:not(:disabled) {
    background: rgb(var(--color-primary-500));
  }

  .refresh-icon {
    width: 16px;
    height: 16px;
  }

  .refresh-icon.spinning {
    animation: spin 1s linear infinite;
  }

  .refresh-info {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    align-items: flex-end;
  }

  .last-updated,
  .next-refresh {
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .last-updated,
  :global([data-mode="dark"]) .next-refresh {
    color: var(--color-surface-400);
  }

  .timestamp,
  .countdown {
    font-family: monospace;
    font-weight: 500;
    color: #374151;
  }

  :global([data-mode="dark"]) .timestamp,
  :global([data-mode="dark"]) .countdown {
    color: var(--color-surface-300);
  }

  .countdown {
    color: #3b82f6;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .countdown {
    color: rgb(var(--color-primary-400));
  }

  .panel-content {
    padding: 1.5rem;
  }

  .migrations-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .table-wrapper {
    overflow-x: auto;
    max-width: 100%;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
  }

  :global([data-mode="dark"]) .table-wrapper {
    border-color: rgb(var(--color-surface-700));
  }

  .migrations-table {
    width: 100%;
    border-collapse: collapse;
  }

  .migrations-table th {
    text-align: left;
    padding: 0.75rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
    background: #f9fafb;
    border-bottom: 2px solid #e5e7eb;
  }


  :global([data-mode="dark"]) .migrations-table th {
    color: var(--color-surface-300);
    background: rgb(var(--color-surface-700));
    border-bottom-color: rgb(var(--color-surface-600));
  }

  .migrations-table td {
    padding: 0.75rem;
    font-size: 0.875rem;
    color: #111827;
  }

  :global([data-mode="dark"]) .migrations-table td {
    color: var(--color-surface-100);
  }

  .migration-main-row td {
    padding-bottom: 0.25rem;
  }

  .migration-main-row td:last-child {
    text-align: right;
  }

  .migrations-table thead th:last-child {
    text-align: right;
  }

  .migration-meta-row td {
    padding-top: 0;
    padding-bottom: 0.25rem;
  }

  .meta-cell {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.75rem;
    width: 100%;
  }

  .migration-desc-row td {
    padding-top: 0;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .migration-desc-row td {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .migrations-table tbody tr.migration-main-row:hover,
  .migrations-table tbody tr.migration-main-row:hover + tr.migration-meta-row,
  .migrations-table tbody tr.migration-main-row:hover + tr.migration-meta-row + tr.migration-desc-row {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .migrations-table tbody tr.migration-main-row:hover,
  :global([data-mode="dark"]) .migrations-table tbody tr.migration-main-row:hover + tr.migration-meta-row,
  :global([data-mode="dark"]) .migrations-table tbody tr.migration-main-row:hover + tr.migration-meta-row + tr.migration-desc-row {
    background: rgb(var(--color-surface-700));
  }

  .migrations-table tbody tr:last-child td {
    border-bottom: none;
  }

  .description-label {
    font-weight: 600;
    color: #6b7280;
    margin-right: 0.5rem;
  }

  :global([data-mode="dark"]) .description-label {
    color: var(--color-surface-400);
  }

  .id-cell {
    font-family: monospace;
    font-size: 0.625rem;
    color: #6b7280;
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .id-cell {
    color: var(--color-surface-400);
  }

  .name-cell {
    font-weight: 500;
    white-space: nowrap;
  }

  .timestamp-cell {
    font-family: monospace;
    font-size: 0.75rem;
    color: #6b7280;
    white-space: nowrap;
    margin-left: auto;
    text-align: right;
  }

  :global([data-mode="dark"]) .timestamp-cell {
    color: var(--color-surface-400);
  }

  .description-cell {
    font-size: 0.8125rem;
    color: #6b7280;
    word-break: break-word;
  }

  :global([data-mode="dark"]) .description-cell {
    color: var(--color-surface-400);
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  :global(.status-success) {
    background: #d1fae5;
    color: #065f46;
  }

  :global([data-mode="dark"] .status-success) {
    background: rgba(16, 185, 129, 0.2);
    color: rgb(110, 231, 183);
  }

  :global(.status-pending) {
    background: #dbeafe;
    color: #1e40af;
  }

  :global([data-mode="dark"] .status-pending) {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(147, 197, 253);
  }

  :global(.status-error) {
    background: #fee2e2;
    color: #991b1b;
  }

  :global([data-mode="dark"] .status-error) {
    background: rgba(239, 68, 68, 0.2);
    color: rgb(252, 165, 165);
  }

  :global(.status-default) {
    background: #e5e7eb;
    color: #374151;
  }

  :global([data-mode="dark"] .status-default) {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-300);
  }

  .migrations-count {
    font-size: 0.875rem;
    color: #6b7280;
    text-align: right;
  }

  :global([data-mode="dark"]) .migrations-count {
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

    .refresh-button {
      justify-content: center;
    }

    .refresh-info {
      align-items: center;
    }

    .last-updated,
    .next-refresh {
      text-align: center;
    }
  }
</style>
