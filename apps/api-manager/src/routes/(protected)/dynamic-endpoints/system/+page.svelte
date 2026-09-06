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
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";
  import { page } from "$app/stores";

  let { data }: { data: PageData } = $props();

  const apiExplorerUrl =
    $page.data.externalLinks?.API_EXPLORER_URL ||
    "https://apiexplorer-ii-sandbox.openbankproject.com";

  const apiExplorerDynamicEndpointUrl = `${apiExplorerUrl}/resource-docs/OBPv6.0.0?operationid=OBPv4.0.0-getDynamicEndpoints`;

  let searchQuery = $state("");

  function getSwaggerSummary(endpoint: any): string {
    try {
      const swagger = endpoint.swagger_string;
      if (!swagger || !swagger.paths) return "No paths defined";

      const paths = Object.keys(swagger.paths);
      if (paths.length === 0) return "No paths defined";

      const firstPath = paths[0];
      const methods = Object.keys(swagger.paths[firstPath]);
      const firstMethod = methods[0];
      const operation = swagger.paths[firstPath][firstMethod];

      return operation?.summary || operation?.operationId || `${firstMethod.toUpperCase()} ${firstPath}`;
    } catch (e) {
      return "Unable to parse swagger";
    }
  }

  function getSwaggerPaths(endpoint: any): string[] {
    try {
      const swagger = endpoint.swagger_string;
      if (!swagger || !swagger.paths) return [];
      return Object.keys(swagger.paths);
    } catch (e) {
      return [];
    }
  }

  function getSwaggerMethods(endpoint: any, path: string): string[] {
    try {
      const swagger = endpoint.swagger_string;
      if (!swagger || !swagger.paths || !swagger.paths[path]) return [];
      return Object.keys(swagger.paths[path]).map((m) => m.toUpperCase());
    } catch (e) {
      return [];
    }
  }

  const filteredEndpoints = $derived(
    (data.endpoints || []).filter((endpoint: any) => {
      if (searchQuery === "") return true;

      const query = searchQuery.toLowerCase();
      const endpointId = (endpoint.dynamic_endpoint_id || "").toLowerCase();
      const userId = (endpoint.user_id || "").toLowerCase();
      const summary = getSwaggerSummary(endpoint).toLowerCase();
      const paths = getSwaggerPaths(endpoint).join(" ").toLowerCase();

      return (
        endpointId.includes(query) ||
        userId.includes(query) ||
        summary.includes(query) ||
        paths.includes(query)
      );
    }),
  );

  async function deleteEndpoint(endpointId: string) {
    const confirmMessage = `Are you sure you want to delete this dynamic endpoint?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(`/proxy/obp/v6.0.0/management/dynamic-endpoints/${endpointId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to delete endpoint",
        );
        logErrorDetails("Delete System Dynamic Endpoint", errorDetails);
        const errorMessage = formatErrorForDisplay(errorDetails);
        throw new Error(errorMessage);
      }

      alert("System dynamic endpoint deleted successfully");
      window.location.reload();
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to delete system dynamic endpoint";
      alert(`Error: ${errorMsg}`);
      console.error("Delete error:", error);
    }
  }
</script>

<svelte:head>
  <title>System Dynamic Endpoints - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        System Dynamic Endpoints
      </h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        Manage system-wide dynamic API endpoints
      </p>
    </div>
    <a
      href="/dynamic-endpoints/system/create"
      class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
    >
      <svg
        class="mr-2 h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4v16m8-8H4"
        />
      </svg>
      Create Dynamic Endpoint
    </a>
  </div>

  <!-- Stats -->
  <div class="mb-6 flex items-center gap-4">
    <div
      class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="text-sm text-gray-600 dark:text-gray-400">Total Endpoints</div>
      <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {data.endpoints?.length || 0}
      </div>
    </div>
    <div class="flex gap-2">
      <a
        href={apiExplorerDynamicEndpointUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center rounded-lg border border-purple-300 bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 dark:border-purple-600 dark:bg-purple-500 dark:hover:bg-purple-600"
        title="Open in API Explorer"
      >
        <svg
          class="mr-2 h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        API Explorer
      </a>
    </div>
  </div>

  <!-- Error Message -->
  {#if data.error}
    <div
      class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
    >
      <div class="flex items-start">
        <svg
          class="mr-3 h-5 w-5 text-red-600 dark:text-red-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <div>
          <h3 class="font-semibold text-red-800 dark:text-red-300">
            Error Loading Endpoints
          </h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-400">
            {data.error}
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Search -->
  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
    <div class="flex-1">
      <div class="relative">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search by endpoint ID, user ID, path, or summary..."
          class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pl-10 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
        />
        <svg
          class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
    </div>
  </div>

  <!-- Endpoints List -->
  <div>
    {#if filteredEndpoints.length === 0}
      <div class="flex flex-col items-center justify-center py-12 text-center">
        {#if !data.endpoints || data.endpoints.length === 0}
          <svg
            class="mb-4 h-16 w-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h3
            class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            No System Dynamic Endpoints Found
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            There are currently no system dynamic endpoints defined.
          </p>
        {:else}
          <svg
            class="mb-4 h-16 w-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <h3
            class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            No Matching Endpoints
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            No endpoints match your search criteria. Try adjusting your filters.
          </p>
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Endpoint ID
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Summary
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Paths
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                User ID
              </th>
              <th
                class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody
            class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800"
          >
            {#each filteredEndpoints as endpoint}
              {@const paths = getSwaggerPaths(endpoint)}
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="whitespace-nowrap px-6 py-4 text-sm font-medium">
                  <a
                    href="/dynamic-endpoints/system/{endpoint.dynamic_endpoint_id}"
                    class="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {endpoint.dynamic_endpoint_id?.substring(0, 8)}...
                  </a>
                </td>
                <td
                  class="max-w-md px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                >
                  {getSwaggerSummary(endpoint)}
                </td>
                <td class="px-6 py-4 text-sm">
                  <div class="flex flex-wrap gap-1">
                    {#each paths.slice(0, 3) as path}
                      {@const methods = getSwaggerMethods(endpoint, path)}
                      <div class="flex items-center gap-1">
                        {#each methods as method}
                          <span
                            class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium
                              {method === 'GET' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}
                              {method === 'POST' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : ''}
                              {method === 'PUT' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : ''}
                              {method === 'DELETE' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : ''}
                              {!['GET', 'POST', 'PUT', 'DELETE'].includes(method) ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' : ''}"
                          >
                            {method}
                          </span>
                        {/each}
                        <span class="font-mono text-xs text-gray-600 dark:text-gray-400">
                          {path}
                        </span>
                      </div>
                    {/each}
                    {#if paths.length > 3}
                      <span class="text-xs text-gray-500">+{paths.length - 3} more</span>
                    {/if}
                  </div>
                </td>
                <td
                  class="whitespace-nowrap px-6 py-4 text-sm text-gray-700 dark:text-gray-300"
                >
                  <span class="font-mono text-xs">
                    {endpoint.user_id?.substring(0, 8)}...
                  </span>
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-right text-sm">
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      onclick={() =>
                        goto(
                          `/dynamic-endpoints/system/${endpoint.dynamic_endpoint_id}`,
                        )}
                      class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      title="View Details"
                    >
                      <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onclick={() => deleteEndpoint(endpoint.dynamic_endpoint_id)}
                      class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete Endpoint"
                    >
                      <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Results Summary -->
      <div
        class="mt-4 flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700"
      >
        <div class="text-sm text-gray-700 dark:text-gray-300">
          Showing <span class="font-medium">{filteredEndpoints.length}</span>
          of
          <span class="font-medium">{data.endpoints?.length || 0}</span>
          endpoints
        </div>
      </div>
    {/if}
  </div>
</div>
