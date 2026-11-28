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
        hourCycle: "h23",
        minute: "2-digit",
        second: "2-digit",
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
    background: var(--ui-card);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .panel-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--ui-border);
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
    color: var(--ui-text);
    margin: 0;
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: var(--ui-muted);
    margin-top: 0.5rem;
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
    background: var(--ui-fill-main-bg);
    color: var(--ui-fill-main-text);
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .refresh-button:hover:not(:disabled) {
    opacity: 0.85;
  }

  .refresh-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
    color: var(--ui-muted);
  }

  .timestamp {
    font-family: monospace;
    font-weight: 500;
    color: var(--ui-text);
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
    border: 1px solid var(--ui-border);
    background: var(--ui-card);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .stat-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--ui-muted);
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--ui-text);
    margin-top: 0.25rem;
  }

  /* Search */
  .search-bar {
    margin-bottom: 1rem;
  }

  .search-input {
    width: 100%;
    max-width: 400px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--ui-border);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background: var(--ui-card);
    color: var(--ui-text);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ui-link) 20%, transparent);
  }

  /* Table */
  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--ui-border);
    border-radius: 0.5rem;
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
    color: var(--ui-text);
    background: var(--ui-card);
    border-bottom: 2px solid var(--ui-border);
  }

  .channels-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--ui-border);
    font-size: 0.875rem;
    color: var(--ui-text);
  }

  .channels-table tbody tr:hover {
    background: var(--ui-hover);
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
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .ttl-low {
    background: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
  }

  /* Channels count */
  .channels-count {
    font-size: 0.875rem;
    color: var(--ui-muted);
    text-align: right;
    margin-top: 0.75rem;
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
    color: var(--ui-muted);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--ui-border);
    border-top-color: var(--ui-link);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--ui-muted);
  }

  /* Alerts */
  .alert {
    padding: 0.75rem 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .alert-error {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
    border: 1px solid var(--ui-tone-error-border);
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
