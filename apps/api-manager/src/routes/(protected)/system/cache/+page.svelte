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
  let { data } = $props();

  let cacheConfig = $state<any>(null);
  let cacheInfo = $state<any>(null);
  let isLoadingConfig = $state(false);
  let isLoadingInfo = $state(false);
  let isInvalidating = $state(false);
  let errorConfig = $state<string | null>(null);
  let errorInfo = $state<string | null>(null);
  let errorInvalidate = $state<string | null>(null);
  let successMessage = $state<string | null>(null);
  let lastUpdated = $state<string>("");
  let copiedNamespaceId = $state<string | null>(null);
  let invalidatingNamespaceId = $state<string | null>(null);
  let copiedCacheConfig = $state(false);

  async function fetchCacheConfig() {
    try {
      isLoadingConfig = true;
      errorConfig = null;

      const response = await fetch("/proxy/obp/v6.0.0/system/cache/config");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message;
        throw new Error(
          `Failed to fetch cache config (${response.status}): ${errorMsg}`,
        );
      }

      const data = await response.json();

      if (data.message) {
        throw new Error(data.message);
      }

      cacheConfig = data;
    } catch (err) {
      errorConfig =
        err instanceof Error ? err.message : "Failed to fetch cache config";
    } finally {
      isLoadingConfig = false;
    }
  }

  async function fetchCacheInfo() {
    try {
      isLoadingInfo = true;
      errorInfo = null;

      const response = await fetch("/proxy/obp/v6.0.0/system/cache/info");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message;
        throw new Error(
          `Failed to fetch cache info (${response.status}): ${errorMsg}`,
        );
      }

      const data = await response.json();

      if (data.message) {
        throw new Error(data.message);
      }

      cacheInfo = data;
      lastUpdated = new Date().toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch (err) {
      errorInfo =
        err instanceof Error ? err.message : "Failed to fetch cache info";
    } finally {
      isLoadingInfo = false;
    }
  }

  async function invalidateCache(namespaceId: string) {
    try {
      invalidatingNamespaceId = namespaceId;
      errorInvalidate = null;
      successMessage = null;

      const response = await fetch("/backend/cache/invalidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ namespace_id: namespaceId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message;
        throw new Error(
          `Failed to invalidate cache (${response.status}): ${errorMsg}`,
        );
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      successMessage = `Successfully invalidated namespace: ${namespaceId} (version ${data.old_version} → ${data.new_version})`;

      // Refresh cache info after invalidation
      await fetchCacheInfo();
    } catch (err) {
      errorInvalidate =
        err instanceof Error ? err.message : "Failed to invalidate cache";
    } finally {
      invalidatingNamespaceId = null;
    }
  }

  async function refreshAll() {
    await Promise.all([fetchCacheConfig(), fetchCacheInfo()]);
  }

  async function copyNamespaceInfo(namespace: any) {
    try {
      const info = `Namespace: ${namespace.namespace_id}
Description: ${namespace.description || "N/A"}
Key Count: ${namespace.key_count?.toLocaleString() ?? "N/A"}
Prefix: ${namespace.prefix || "N/A"}
Current Version: ${namespace.current_version ?? "N/A"}
Category: ${namespace.category || "N/A"}
Storage Location: ${namespace.storage_location || "N/A"}
TTL Info: ${namespace.ttl_info || "TTL info NOT FOUND"}`;

      await navigator.clipboard.writeText(info);
      copiedNamespaceId = namespace.namespace_id;

      // Reset after 2 seconds
      setTimeout(() => {
        copiedNamespaceId = null;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy namespace info:", err);
    }
  }

  async function copyCacheConfig() {
    try {
      const info = `Cache Configuration
Instance ID: ${cacheConfig.instance_id || "N/A"}
Environment: ${cacheConfig.environment || "N/A"}
Global Prefix: ${cacheConfig.global_prefix || "N/A"}

Redis Status:
  Available: ${cacheConfig.redis_status?.available ? "Yes" : "No"}
  URL: ${cacheConfig.redis_status?.url || "N/A"}
  Port: ${cacheConfig.redis_status?.port ?? "N/A"}
  Use SSL: ${cacheConfig.redis_status?.use_ssl !== undefined ? (cacheConfig.redis_status.use_ssl ? "Yes" : "No") : "N/A"}

In-Memory Status:
  Available: ${cacheConfig.in_memory_status?.available ? "Yes" : "No"}
  Current Size: ${cacheConfig.in_memory_status?.current_size ?? "N/A"}`;

      await navigator.clipboard.writeText(info);
      copiedCacheConfig = true;

      // Reset after 2 seconds
      setTimeout(() => {
        copiedCacheConfig = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy cache config:", err);
    }
  }

  // Compute storage location statistics
  let storageStats = $derived.by(() => {
    if (!cacheInfo?.namespaces) return null;

    const stats = {
      redis: 0,
      memory: 0,
      both: 0,
      unknown: 0,
    };

    for (const ns of cacheInfo.namespaces) {
      const location = ns.storage_location?.toLowerCase();
      if (location === "redis") stats.redis++;
      else if (location === "memory") stats.memory++;
      else if (location === "both") stats.both++;
      else stats.unknown++;
    }

    return stats;
  });

  onMount(() => {
    refreshAll();
  });
</script>

<svelte:head>
  <title>Cache - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Cache Management
          </h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Monitor cache configuration and manage cache namespaces
          </p>
        </div>
        <button
          onclick={refreshAll}
          disabled={isLoadingConfig || isLoadingInfo}
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {isLoadingConfig || isLoadingInfo ? "Refreshing..." : "Refresh All"}
        </button>
      </div>
    </div>

    <!-- Cache Configuration Section -->
    <div class="mb-8">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Cache Configuration
        </h2>
        <button
          onclick={copyCacheConfig}
          class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          title="Copy cache configuration"
          aria-label="Copy cache configuration"
        >
          {#if copiedCacheConfig}
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
      {#if errorConfig}
        <div
          class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
        >
          <strong>Error:</strong>
          {errorConfig}
        </div>
      {:else if isLoadingConfig}
        <div
          class="flex items-center justify-center rounded-lg bg-gray-100 p-8 dark:bg-gray-800"
        >
          <div
            class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
          ></div>
          <p class="ml-3 text-gray-700 dark:text-gray-300">
            Loading configuration...
          </p>
        </div>
      {:else if cacheConfig}
        <div
          class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <div class="space-y-6">
            <!-- Instance Information -->
            <div>
              <h3
                class="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300"
              >
                Instance Information
              </h3>
              <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <div
                    class="text-sm font-medium text-gray-600 dark:text-gray-400"
                  >
                    Instance ID
                  </div>
                  <div
                    class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    {cacheConfig.instance_id || "N/A"}
                  </div>
                </div>
                <div>
                  <div
                    class="text-sm font-medium text-gray-600 dark:text-gray-400"
                  >
                    Environment
                  </div>
                  <div
                    class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    {cacheConfig.environment || "N/A"}
                  </div>
                </div>
                <div>
                  <div
                    class="text-sm font-medium text-gray-600 dark:text-gray-400"
                  >
                    Global Prefix
                  </div>
                  <div
                    class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    {cacheConfig.global_prefix || "N/A"}
                  </div>
                </div>
              </div>
            </div>

            <!-- Redis Status -->
            {#if cacheConfig.redis_status}
              <div>
                <h3
                  class="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  Redis Status
                </h3>
                <div
                  class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
                >
                  <div>
                    <div
                      class="text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      Available
                    </div>
                    <div
                      class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {cacheConfig.redis_status.available ? "Yes" : "No"}
                    </div>
                  </div>
                  <div>
                    <div
                      class="text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      URL
                    </div>
                    <div
                      class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {cacheConfig.redis_status.url || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div
                      class="text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      Port
                    </div>
                    <div
                      class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {cacheConfig.redis_status.port ?? "N/A"}
                    </div>
                  </div>
                  <div>
                    <div
                      class="text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      Use SSL
                    </div>
                    <div
                      class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {cacheConfig.redis_status.use_ssl !== undefined
                        ? cacheConfig.redis_status.use_ssl
                          ? "Yes"
                          : "No"
                        : "N/A"}
                    </div>
                  </div>
                </div>
              </div>
            {/if}

            <!-- In-Memory Status -->
            {#if cacheConfig.in_memory_status}
              <div>
                <h3
                  class="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  In-Memory Status
                </h3>
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <div
                      class="text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      Available
                    </div>
                    <div
                      class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {cacheConfig.in_memory_status.available ? "Yes" : "No"}
                    </div>
                  </div>
                  <div>
                    <div
                      class="text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      Current Size
                    </div>
                    <div
                      class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {cacheConfig.in_memory_status.current_size ?? "N/A"}
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- Status Messages -->
    <div class="mb-8">
      {#if successMessage}
        <div
          class="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200"
        >
          {successMessage}
        </div>
      {/if}

      {#if errorInvalidate}
        <div
          class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
        >
          <strong>Error:</strong>
          {errorInvalidate}
        </div>
      {/if}
    </div>

    <!-- Cache Information Section -->
    <div>
      <div class="mb-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Cache Information
          </h2>
          {#if lastUpdated}
            <div class="text-sm text-gray-600 dark:text-gray-400">
              Last updated: <span class="font-medium">{lastUpdated}</span>
            </div>
          {/if}
        </div>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <strong>Note:</strong> Invalidating a cache namespace works by incrementing
          its version counter which forms part of the namespace key prefix, thus
          hiding old keys which will expire in due course based on their TTL. Key
          counts shown below reflect only the latest version of each namespace.
        </p>
      </div>

      {#if errorInfo}
        <div
          class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
        >
          <strong>Error:</strong>
          {errorInfo}
        </div>
      {:else if isLoadingInfo}
        <div
          class="flex items-center justify-center rounded-lg bg-gray-100 p-8 dark:bg-gray-800"
        >
          <div
            class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
          ></div>
          <p class="ml-3 text-gray-700 dark:text-gray-300">
            Loading cache information...
          </p>
        </div>
      {:else if cacheInfo}
        <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div
            class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Keys
            </div>
            <div
              class="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100"
            >
              {cacheInfo.total_keys?.toLocaleString() ?? "—"}
            </div>
          </div>
          <div
            class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Namespaces
            </div>
            <div
              class="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100"
            >
              {cacheInfo.namespaces?.length ?? "—"}
            </div>
          </div>
          <div
            class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
              Redis Available
            </div>
            <div
              class="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100"
            >
              {cacheInfo.redis_available ? "Yes" : "No"}
            </div>
          </div>
          {#if storageStats}
            <div
              class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
                Storage Locations
              </div>
              <div class="mt-2 space-y-1 text-sm">
                {#if storageStats.redis > 0}
                  <div class="flex items-center justify-between">
                    <span class="text-gray-700 dark:text-gray-300"
                      >{storageStats.redis} Namespace{storageStats.redis !== 1
                        ? "s"
                        : ""} in Redis</span
                    >
                  </div>
                {/if}
                {#if storageStats.memory > 0}
                  <div class="flex items-center justify-between">
                    <span class="text-gray-700 dark:text-gray-300"
                      >{storageStats.memory} Namespace{storageStats.memory !== 1
                        ? "s"
                        : ""} in Memory</span
                    >
                  </div>
                {/if}
                {#if storageStats.both > 0}
                  <div class="flex items-center justify-between">
                    <span class="text-gray-700 dark:text-gray-300"
                      >{storageStats.both} Namespace{storageStats.both !== 1
                        ? "s"
                        : ""} in Both</span
                    >
                  </div>
                {/if}
                {#if storageStats.unknown > 0}
                  <div class="flex items-center justify-between">
                    <span class="text-gray-700 dark:text-gray-300"
                      >{storageStats.unknown} Namespace{storageStats.unknown !==
                      1
                        ? "s"
                        : ""} with Unknown Location</span
                    >
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>

        {#if cacheInfo.namespaces && cacheInfo.namespaces.length > 0}
          <div class="space-y-4">
            {#each cacheInfo.namespaces as namespace}
              <div
                class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div class="mb-4 flex items-start justify-between">
                  <div class="flex-1">
                    <h3
                      class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {namespace.namespace_id}
                    </h3>
                    {#if namespace.description}
                      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {namespace.description}
                      </p>
                    {/if}
                  </div>
                  <div class="flex items-start gap-2">
                    <button
                      onclick={() => copyNamespaceInfo(namespace)}
                      class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                      title="Copy namespace information"
                      aria-label="Copy namespace information"
                    >
                      {#if copiedNamespaceId === namespace.namespace_id}
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
                    <div class="text-right">
                      <div
                        class="text-2xl font-bold text-blue-600 dark:text-blue-400"
                      >
                        {namespace.key_count?.toLocaleString() ?? "—"}
                      </div>
                      <div class="text-xs text-gray-600 dark:text-gray-400">
                        keys
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5"
                >
                  <div>
                    <div
                      class="text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      Prefix
                    </div>
                    <div
                      class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100"
                    >
                      {namespace.prefix || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div
                      class="text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      Current Version
                    </div>
                    <div
                      class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100"
                    >
                      {namespace.current_version || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div
                      class="text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      Category
                    </div>
                    <div
                      class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100"
                    >
                      {namespace.category || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div
                      class="text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      Storage Location
                    </div>
                    <div class="mt-1">
                      {#if namespace.storage_location}
                        <span
                          class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium {namespace.storage_location.toLowerCase() ===
                          'redis'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                            : namespace.storage_location.toLowerCase() ===
                                'memory'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                              : namespace.storage_location.toLowerCase() ===
                                  'both'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}"
                        >
                          {#if namespace.storage_location.toLowerCase() === "redis"}
                            <svg
                              class="h-3 w-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                              />
                            </svg>
                          {:else if namespace.storage_location.toLowerCase() === "memory"}
                            <svg
                              class="h-3 w-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                              />
                            </svg>
                          {:else if namespace.storage_location.toLowerCase() === "both"}
                            <svg
                              class="h-3 w-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                              />
                            </svg>
                          {/if}
                          {namespace.storage_location}
                        </span>
                      {:else}
                        <span class="text-sm text-gray-500 dark:text-gray-400"
                          >N/A</span
                        >
                      {/if}
                    </div>
                  </div>
                  <div>
                    <div
                      class="text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      TTL Info
                    </div>
                    <div
                      class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100"
                    >
                      {namespace.ttl_info || "TTL info NOT FOUND"}
                    </div>
                  </div>
                </div>
                <div class="mt-4 flex justify-end">
                  <button
                    onclick={() => invalidateCache(namespace.namespace_id)}
                    disabled={invalidatingNamespaceId ===
                      namespace.namespace_id}
                    class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
                    title="Invalidate namespace cache"
                    aria-label="Invalidate namespace cache"
                  >
                    {invalidatingNamespaceId === namespace.namespace_id
                      ? "Invalidating..."
                      : "Invalidate"}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-800">
            <p class="text-lg font-medium text-gray-700 dark:text-gray-300">
              No cache namespaces found
            </p>
          </div>
        {/if}
      {/if}
    </div>
  </div>
