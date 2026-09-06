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
  import { page } from "$app/stores";
  import { configHelpers } from "$lib/config";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  interface ConfigProp {
    name: string;
    value: string;
  }

  let { data } = $props();

  const apiExplorerUrl =
    $page.data.externalLinks?.API_EXPLORER_URL ||
    "https://apiexplorer-ii-sandbox.openbankproject.com";

  const apiExplorerConfigPropsUrl = `${apiExplorerUrl}/resource-docs/OBPv6.0.0?operationid=OBPv6.0.0-getConfigProps`;

  let obpInfo = $derived(configHelpers.getObpConnectionInfo());

  // State
  let configProps = $state<ConfigProp[]>([]);
  let rawResponse = $state<any>(null);
  let isLoading = $state(false);
  let loadError = $state("");
  let loadErrorCode = $state("");
  let showRawJson = $state(false);

  // Search filter
  let searchQuery = $state("");

  const filteredProps = $derived(
    configProps.filter((prop) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        prop.name?.toLowerCase().includes(query) ||
        prop.value?.toLowerCase().includes(query)
      );
    })
  );

  async function loadConfigProps() {
    isLoading = true;

    try {
      const response = await trackedFetch(`/proxy/obp/v6.0.0/management/config-props`);
      const responseData = await response.json();

      rawResponse = responseData;

      if (responseData.message) {
        loadError = responseData.message;
        loadErrorCode = responseData.code || "";
        configProps = [];
      } else {
        loadError = "";
        loadErrorCode = "";
        configProps = (responseData.config_props || []).sort(
          (a: ConfigProp, b: ConfigProp) => a.name.localeCompare(b.name)
        );
      }
    } catch (err) {
      console.error("Error fetching config props:", err);
      loadError = err instanceof Error ? err.message : "Failed to fetch config props";
      loadErrorCode = "";
      rawResponse = { error: loadError, type: "NetworkError", timestamp: new Date().toISOString() };
      configProps = [];
    } finally {
      isLoading = false;
    }
  }

  // Initialize
  let initialized = $state(false);

  $effect(() => {
    if (typeof window !== "undefined" && !initialized) {
      initialized = true;
      loadConfigProps();
    }
  });
</script>

<svelte:head>
  <title>Config Props - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        Config Props
      </h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        Configuration properties and their runtime values (non-WebUI). Sensitive values are masked.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <button
        onclick={loadConfigProps}
        disabled={isLoading}
        class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        {#if isLoading}
          <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        {/if}
        Refresh
      </button>
      <a
        href={apiExplorerConfigPropsUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center rounded-lg border border-purple-300 bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 dark:border-purple-600 dark:bg-purple-500 dark:hover:bg-purple-600"
        title="Open in API Explorer"
      >
        <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        API Explorer
      </a>
    </div>
  </div>

  <!-- Error Message -->
  {#if loadError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <div class="flex items-start">
        <svg class="mr-3 h-5 w-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="font-semibold text-red-800 dark:text-red-300">
            Error Loading Config Props
            {#if loadErrorCode}
              <span class="ml-2 rounded bg-red-200 px-2 py-0.5 font-mono text-xs dark:bg-red-800/40">{loadErrorCode}</span>
            {/if}
          </h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-400">{loadError}</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Raw JSON Response Toggle -->
  {#if rawResponse !== null}
    <div class="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <button
        type="button"
        onclick={() => showRawJson = !showRawJson}
        class="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
      >
        <div class="flex items-center gap-2">
          <svg class="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span class="font-medium text-gray-900 dark:text-gray-100">Raw OBP API Response</span>
          {#if loadError}
            <span class="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">Error</span>
          {:else}
            <span class="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">Success</span>
          {/if}
        </div>
        <svg
          class="h-5 w-5 text-gray-500 transition-transform {showRawJson ? 'rotate-180' : ''}"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {#if showRawJson}
        <div class="border-t border-gray-200 p-4 dark:border-gray-700">
          <pre class="max-h-96 overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-green-400 dark:bg-gray-950">{JSON.stringify(rawResponse, null, 2)}</pre>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Results Panel -->
  <div class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div class="border-b border-gray-200 p-4 dark:border-gray-700">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Configuration Properties
            {#if configProps.length > 0}
              <span class="ml-2 text-sm font-normal text-gray-500">({filteredProps.length} of {configProps.length})</span>
            {/if}
          </h2>
          <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            <strong>URL:</strong> {obpInfo.baseUrl}/obp/v6.0.0/management/config-props
          </div>
        </div>

        <!-- Search -->
        <div class="relative">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Filter properties..."
            class="w-64 rounded-lg border border-gray-300 px-4 py-2 pl-10 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
    </div>

    <div class="p-4">
      {#if isLoading && configProps.length === 0}
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <svg class="mb-4 h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p class="text-gray-600 dark:text-gray-400">Loading configuration properties...</p>
        </div>
      {:else if filteredProps.length === 0}
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <svg class="mb-4 h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">No Config Props Found</h3>
          <p class="text-gray-600 dark:text-gray-400">
            {#if searchQuery}
              No properties match your filter. Try adjusting your search.
            {:else}
              No configuration properties were returned.
            {/if}
          </p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th class="w-1/3 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Value</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {#each filteredProps as prop}
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td class="w-1/3 px-4 py-3 text-sm font-mono font-medium text-gray-900 dark:text-gray-100 break-all">
                    {prop.name}
                  </td>
                  <td class="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">
                    {#if prop.value === "****"}
                      <span class="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">masked</span>
                    {:else if prop.value === ""}
                      <span class="text-gray-400 italic">empty</span>
                    {:else}
                      <span class="break-all">{prop.value}</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Results Summary -->
        <div class="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
          <div class="text-sm text-gray-700 dark:text-gray-300">
            Showing <span class="font-medium">{filteredProps.length}</span>
            of
            <span class="font-medium">{configProps.length}</span>
            configuration properties from <span class="font-medium">{obpInfo.displayName}</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
