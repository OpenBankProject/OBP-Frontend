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
      <h1 class="text-3xl font-bold ui-text">
        Config Props
      </h1>
      <p class="mt-1 ui-muted">
        Configuration properties and their runtime values (non-WebUI). Sensitive values are masked.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <button
        onclick={loadConfigProps}
        disabled={isLoading}
        class="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 preset-filled-primary-500"
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
        class="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium preset-filled-primary-500"
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
    <div class="mb-6 rounded-lg border p-4 ui-tone-error">
      <div class="flex items-start">
        <svg class="mr-3 h-5 w-5 ui-text-error" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="font-semibold ui-text-error">
            Error Loading Config Props
            {#if loadErrorCode}
              <span class="ml-2 rounded px-2 py-0.5 font-mono text-xs ui-tone-error">{loadErrorCode}</span>
            {/if}
          </h3>
          <p class="mt-1 text-sm ui-text-error">{loadError}</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Raw JSON Response Toggle -->
  {#if rawResponse !== null}
    <div class="mb-6 rounded-lg border shadow-sm ui-card ui-border">
      <button
        type="button"
        onclick={() => showRawJson = !showRawJson}
        class="flex w-full items-center justify-between p-4 text-left ui-hover"
      >
        <div class="flex items-center gap-2">
          <svg class="h-5 w-5 ui-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span class="font-medium ui-text">Raw OBP API Response</span>
          {#if loadError}
            <span class="rounded px-2 py-0.5 text-xs font-medium ui-tone-error">Error</span>
          {:else}
            <span class="rounded px-2 py-0.5 text-xs font-medium ui-tone-success">Success</span>
          {/if}
        </div>
        <svg
          class="h-5 w-5 transition-transform ui-muted {showRawJson ? 'rotate-180' : ''}"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {#if showRawJson}
        <div class="border-t p-4 ui-border">
          <pre class="max-h-96 overflow-auto rounded-lg p-4 text-xs ui-text-success ui-panel">{JSON.stringify(rawResponse, null, 2)}</pre>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Results Panel -->
  <div class="rounded-lg border shadow-sm ui-card ui-border">
    <div class="border-b p-4 ui-border">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold ui-text">
            Configuration Properties
            {#if configProps.length > 0}
              <span class="ml-2 text-sm font-normal ui-muted">({filteredProps.length} of {configProps.length})</span>
            {/if}
          </h2>
          <div class="mt-1 text-xs ui-muted">
            <strong>URL:</strong> {obpInfo.baseUrl}/obp/v6.0.0/management/config-props
          </div>
        </div>

        <!-- Search -->
        <div class="relative">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Filter properties..."
            class="w-64 rounded-lg border px-4 py-2 pl-10 text-sm ui-panel ui-text ui-border"
          />
          <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ui-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
    </div>

    <div class="p-4">
      {#if isLoading && configProps.length === 0}
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <svg class="mb-4 h-8 w-8 animate-spin ui-link" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p class="ui-muted">Loading configuration properties...</p>
        </div>
      {:else if filteredProps.length === 0}
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <svg class="mb-4 h-16 w-16 ui-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 class="mb-2 text-lg font-semibold ui-text">No Config Props Found</h3>
          <p class="ui-muted">
            {#if searchQuery}
              No properties match your filter. Try adjusting your search.
            {:else}
              No configuration properties were returned.
            {/if}
          </p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full table-fixed divide-y ui-border">
            <thead class="ui-card">
              <tr>
                <th class="w-1/3 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Name</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Value</th>
              </tr>
            </thead>
            <tbody class="divide-y ui-card ui-border">
              {#each filteredProps as prop}
                <tr class="ui-hover">
                  <td class="w-1/3 px-4 py-3 text-sm font-mono font-medium break-all ui-text">
                    {prop.name}
                  </td>
                  <td class="px-4 py-3 text-sm font-mono ui-muted">
                    {#if prop.value === "****"}
                      <span class="rounded px-2 py-0.5 text-xs font-medium ui-tone-warning">masked</span>
                    {:else if prop.value === ""}
                      <span class="italic ui-muted">empty</span>
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
        <div class="mt-4 flex items-center justify-between border-t pt-4 ui-border">
          <div class="text-sm ui-muted">
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
