<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  const AUTO_REFRESH_INTERVAL = 15_000;
  const AUTO_REFRESH_SECONDS = AUTO_REFRESH_INTERVAL / 1000;
  let autoRefreshTimer: ReturnType<typeof setInterval>;
  let countdownTimer: ReturnType<typeof setInterval>;
  let secondsUntilRefresh = $state(AUTO_REFRESH_SECONDS);

  interface ChannelStat {
    channel_name: string;
    message_count: number;
    ttl_seconds: number;
  }

  interface SignalStats {
    total_channels: number;
    total_messages: number;
    channels: ChannelStat[];
  }

  let stats = $state<SignalStats | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let lastUpdated = $state<string>("");
  let searchQuery = $state("");

  let filteredChannels = $derived.by(() => {
    if (!stats?.channels) return [];
    if (!searchQuery.trim()) return stats.channels;
    const q = searchQuery.toLowerCase();
    return stats.channels.filter((ch) =>
      ch.channel_name.toLowerCase().includes(q),
    );
  });

  async function fetchStats() {
    try {
      isLoading = true;
      error = null;
      secondsUntilRefresh = AUTO_REFRESH_SECONDS;

      const response = await fetch("/proxy/obp/v6.0.0/signal-channels/stats");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message;
        throw new Error(
          `Failed to fetch signal stats (${response.status}): ${errorMsg}`,
        );
      }

      const data = await response.json();

      if (data.message) {
        throw new Error(data.message);
      }

      stats = data;
      lastUpdated = new Date().toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to fetch signal stats";
    } finally {
      isLoading = false;
    }
  }

  function formatTTL(seconds: number): string {
    if (seconds <= 0) return "Expired";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }

  onMount(() => {
    fetchStats();
    autoRefreshTimer = setInterval(() => {
      if (!isLoading) {
        fetchStats();
        secondsUntilRefresh = AUTO_REFRESH_SECONDS;
      }
    }, AUTO_REFRESH_INTERVAL);
    countdownTimer = setInterval(() => {
      if (secondsUntilRefresh > 0) secondsUntilRefresh--;
    }, 1000);
  });

  onDestroy(() => {
    clearInterval(autoRefreshTimer);
    clearInterval(countdownTimer);
  });
</script>

<svelte:head>
  <title>Signal Stats - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div>
          <h1 class="panel-title">Signal Channel Stats</h1>
          <div class="panel-subtitle">
            Overview of all signal channels including private-only channels
          </div>
        </div>
        <div class="header-controls">
          <button
            class="refresh-button"
            onclick={fetchStats}
            disabled={isLoading}
            aria-label="Refresh signal stats"
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
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
          {#if lastUpdated}
            <div class="last-updated">
              Last updated: <span class="timestamp">{lastUpdated}</span>
              — next refresh in {String(secondsUntilRefresh).padStart(2, "0")}s
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

      {#if isLoading && !stats}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading signal channel stats...</p>
        </div>
      {:else if stats}
        <!-- Summary Stats -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Channels</div>
            <div class="stat-value">
              {stats.total_channels?.toLocaleString() ?? "0"}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Messages</div>
            <div class="stat-value">
              {stats.total_messages?.toLocaleString() ?? "0"}
            </div>
          </div>
        </div>

        <!-- Search -->
        {#if stats.channels && stats.channels.length > 0}
          <div class="search-bar">
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="Search channels..."
              class="search-input"
            />
          </div>
        {/if}

        <!-- Channels Table -->
        {#if filteredChannels.length > 0}
          <div class="table-wrapper">
            <table class="channels-table">
              <thead>
                <tr>
                  <th>Channel Name</th>
                  <th>Messages</th>
                  <th>TTL</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredChannels as channel}
                  <tr>
                    <td class="channel-name-cell">
                      {channel.channel_name}
                    </td>
                    <td class="count-cell">
                      {channel.message_count?.toLocaleString() ?? "0"}
                    </td>
                    <td class="ttl-cell">
                      <span
                        class="ttl-badge"
                        class:ttl-low={channel.ttl_seconds < 300}
                        class:ttl-ok={channel.ttl_seconds >= 300}
                      >
                        {formatTTL(channel.ttl_seconds)}
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <div class="channels-count">
            Showing {filteredChannels.length} of {stats.channels.length} channel{stats.channels.length !==
            1
              ? "s"
              : ""}
          </div>
        {:else if stats.channels && stats.channels.length > 0}
          <div class="empty-state">
            <p>No channels match "{searchQuery}"</p>
          </div>
        {:else}
          <div class="empty-state">
            <p>No active signal channels</p>
          </div>
        {/if}
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
    gap: 0.5rem;
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

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-card {
    padding: 1.25rem;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
    background: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  :global([data-mode="dark"]) .stat-card {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
  }

  .stat-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .stat-label {
    color: var(--color-surface-400);
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .stat-value {
    color: var(--color-surface-100);
  }

  /* Search */
  .search-bar {
    margin-bottom: 1rem;
  }

  .search-input {
    width: 100%;
    max-width: 400px;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background: white;
    color: #111827;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  :global([data-mode="dark"]) .search-input {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  /* Table */
  .table-wrapper {
    overflow-x: auto;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
  }

  :global([data-mode="dark"]) .table-wrapper {
    border-color: rgb(var(--color-surface-700));
  }

  .channels-table {
    width: 100%;
    border-collapse: collapse;
  }

  .channels-table th {
    text-align: left;
    padding: 0.75rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
    background: #f9fafb;
    border-bottom: 2px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .channels-table th {
    color: var(--color-surface-300);
    background: rgb(var(--color-surface-700));
    border-bottom-color: rgb(var(--color-surface-600));
  }

  .channels-table td {
    padding: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.875rem;
    color: #111827;
  }

  :global([data-mode="dark"]) .channels-table td {
    border-bottom-color: rgb(var(--color-surface-700));
    color: var(--color-surface-100);
  }

  .channels-table tbody tr:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .channels-table tbody tr:hover {
    background: rgb(var(--color-surface-700));
  }

  .channels-table tbody tr:last-child td {
    border-bottom: none;
  }

  .channel-name-cell {
    font-weight: 500;
    font-family: monospace;
  }

  .count-cell {
    font-family: monospace;
    font-weight: 600;
  }

  .ttl-cell {
    white-space: nowrap;
  }

  .ttl-badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: monospace;
  }

  .ttl-ok {
    background: #d1fae5;
    color: #065f46;
  }

  :global([data-mode="dark"]) .ttl-ok {
    background: rgb(var(--color-success-900));
    color: rgb(var(--color-success-200));
  }

  .ttl-low {
    background: #fef3c7;
    color: #92400e;
  }

  :global([data-mode="dark"]) .ttl-low {
    background: rgba(245, 158, 11, 0.2);
    color: rgb(252, 211, 77);
  }

  /* Channels count */
  .channels-count {
    font-size: 0.875rem;
    color: #6b7280;
    text-align: right;
    margin-top: 0.75rem;
  }

  :global([data-mode="dark"]) .channels-count {
    color: var(--color-surface-400);
  }

  /* Loading & Empty States */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
  }

  .loading-state p {
    color: #6b7280;
  }

  :global([data-mode="dark"]) .loading-state p {
    color: var(--color-surface-400);
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

  /* Alerts */
  .alert {
    padding: 0.75rem 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
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
  }
</style>
