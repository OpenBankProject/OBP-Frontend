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
  import { onMount } from "svelte";

  interface DatabasePoolInfo {
    pool_name: string;
    active_connections: number;
    idle_connections: number;
    total_connections: number;
    threads_awaiting_connection: number;
    maximum_pool_size: number;
    minimum_idle: number;
    connection_timeout_ms: number;
    idle_timeout_ms: number;
    max_lifetime_ms: number;
    keepalive_time_ms: number;
  }

  let { data } = $props();

  let poolInfo = $state<DatabasePoolInfo | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let lastUpdated = $state<string>("");
  let copiedPoolInfo = $state(false);

  async function fetchPoolInfo() {
    try {
      isLoading = true;
      error = null;

      const response = await fetch("/proxy/obp/v6.0.0/system/database/pool");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message;
        throw new Error(
          `Failed to fetch database pool info (${response.status}): ${errorMsg}`,
        );
      }

      const responseData = await response.json();

      if (responseData.message) {
        throw new Error(responseData.message);
      }

      poolInfo = responseData;
      lastUpdated = new Date().toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to fetch database pool info";
    } finally {
      isLoading = false;
    }
  }

  async function copyPoolInfo() {
    if (!poolInfo) return;

    try {
      const info = `Database Pool Information
Pool Name: ${poolInfo.pool_name}

Connection Stats:
  Active Connections: ${poolInfo.active_connections}
  Idle Connections: ${poolInfo.idle_connections}
  Total Connections: ${poolInfo.total_connections}
  Threads Awaiting Connection: ${poolInfo.threads_awaiting_connection}

Pool Configuration:
  Maximum Pool Size: ${poolInfo.maximum_pool_size}
  Minimum Idle: ${poolInfo.minimum_idle}

Timeouts:
  Connection Timeout: ${formatMs(poolInfo.connection_timeout_ms)}
  Idle Timeout: ${formatMs(poolInfo.idle_timeout_ms)}
  Max Lifetime: ${formatMs(poolInfo.max_lifetime_ms)}
  Keepalive Time: ${formatMs(poolInfo.keepalive_time_ms)}`;

      await navigator.clipboard.writeText(info);
      copiedPoolInfo = true;

      setTimeout(() => {
        copiedPoolInfo = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy pool info:", err);
    }
  }

  function formatMs(ms: number): string {
    if (ms === 0) return "0 (disabled)";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  }

  // Calculate pool utilization percentage
  let poolUtilization = $derived.by(() => {
    if (!poolInfo || poolInfo.maximum_pool_size === 0) return 0;
    return Math.round((poolInfo.active_connections / poolInfo.maximum_pool_size) * 100);
  });

  // Determine status color based on utilization
  let utilizationColor = $derived.by(() => {
    if (poolUtilization < 50) return "text-green-600 dark:text-green-400";
    if (poolUtilization < 80) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  });

  onMount(() => {
    fetchPoolInfo();
  });
</script>

<svelte:head>
  <title>Database Pool - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Database Pool
          </h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Monitor database connection pool status and configuration
          </p>
        </div>
        <button
          onclick={fetchPoolInfo}
          disabled={isLoading}
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>

    {#if error}
      <div
        class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
      >
        <strong>Error:</strong>
        {error}
      </div>
    {:else if isLoading}
      <div
        class="flex items-center justify-center rounded-lg bg-gray-100 p-8 dark:bg-gray-800"
      >
        <div
          class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
        ></div>
        <p class="ml-3 text-gray-700 dark:text-gray-300">
          Loading database pool information...
        </p>
      </div>
    {:else if poolInfo}
      <div class="space-y-6">
        <!-- Pool Header with Copy Button -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {poolInfo.pool_name}
            </h2>
            {#if lastUpdated}
              <span class="text-sm text-gray-500 dark:text-gray-400">
                Last updated: {lastUpdated}
              </span>
            {/if}
          </div>
          <button
            onclick={copyPoolInfo}
            class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            title="Copy pool information"
            aria-label="Copy pool information"
          >
            {#if copiedPoolInfo}
              <svg
                class="h-5 w-5 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <polyline
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  points="20 6 9 17 4 12"
                />
              </svg>
            {:else}
              <svg
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect
                  x="9"
                  y="9"
                  width="13"
                  height="13"
                  rx="2"
                  ry="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
                <path
                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            {/if}
          </button>
        </div>

        <!-- Connection Stats Cards -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div
            class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
              Active Connections
            </div>
            <div
              class="mt-2 text-3xl font-bold {utilizationColor}"
            >
              {poolInfo.active_connections}
            </div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {poolUtilization}% of max
            </div>
          </div>
          <div
            class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
              Idle Connections
            </div>
            <div
              class="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100"
            >
              {poolInfo.idle_connections}
            </div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Available for use
            </div>
          </div>
          <div
            class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Connections
            </div>
            <div
              class="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100"
            >
              {poolInfo.total_connections}
            </div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Active + Idle
            </div>
          </div>
          <div
            class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
              Threads Awaiting
            </div>
            <div
              class="mt-2 text-3xl font-bold {poolInfo.threads_awaiting_connection > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}"
            >
              {poolInfo.threads_awaiting_connection}
            </div>
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Waiting for connection
            </div>
          </div>
        </div>

        <!-- Pool Configuration -->
        <div
          class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Pool Configuration
          </h3>
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
                Maximum Pool Size
              </div>
              <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {poolInfo.maximum_pool_size}
              </div>
            </div>
            <div>
              <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
                Minimum Idle
              </div>
              <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {poolInfo.minimum_idle}
              </div>
            </div>
          </div>
        </div>

        <!-- Timeout Configuration -->
        <div
          class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Timeout Configuration
          </h3>
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
                Connection Timeout
              </div>
              <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatMs(poolInfo.connection_timeout_ms)}
              </div>
              <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {poolInfo.connection_timeout_ms.toLocaleString()}ms
              </div>
            </div>
            <div>
              <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
                Idle Timeout
              </div>
              <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatMs(poolInfo.idle_timeout_ms)}
              </div>
              <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {poolInfo.idle_timeout_ms.toLocaleString()}ms
              </div>
            </div>
            <div>
              <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
                Max Lifetime
              </div>
              <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatMs(poolInfo.max_lifetime_ms)}
              </div>
              <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {poolInfo.max_lifetime_ms.toLocaleString()}ms
              </div>
            </div>
            <div>
              <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
                Keepalive Time
              </div>
              <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatMs(poolInfo.keepalive_time_ms)}
              </div>
              <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {poolInfo.keepalive_time_ms.toLocaleString()}ms
              </div>
            </div>
          </div>
        </div>

        <!-- Visual Pool Usage -->
        <div
          class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Pool Usage
          </h3>
          <div class="space-y-4">
            <div>
              <div class="mb-2 flex justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">Pool Utilization</span>
                <span class="font-medium {utilizationColor}">{poolUtilization}%</span>
              </div>
              <div class="h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  class="h-full transition-all duration-300 {poolUtilization < 50 ? 'bg-green-500' : poolUtilization < 80 ? 'bg-yellow-500' : 'bg-red-500'}"
                  style="width: {poolUtilization}%"
                ></div>
              </div>
            </div>
            <div class="flex gap-6 text-sm">
              <div class="flex items-center gap-2">
                <div class="h-3 w-3 rounded-full bg-blue-500"></div>
                <span class="text-gray-600 dark:text-gray-400">Active: {poolInfo.active_connections}</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="h-3 w-3 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                <span class="text-gray-600 dark:text-gray-400">Idle: {poolInfo.idle_connections}</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="h-3 w-3 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600"></div>
                <span class="text-gray-600 dark:text-gray-400">Available: {poolInfo.maximum_pool_size - poolInfo.total_connections}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
