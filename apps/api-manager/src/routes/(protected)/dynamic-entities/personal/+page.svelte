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
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let searchQuery = $state("");

  // Helper function to get schema object
  function getSchema(entity: any): any {
    return entity.schema || null;
  }

  function getPropertyCount(entity: any): number {
    const schema = getSchema(entity);
    return schema?.properties ? Object.keys(schema.properties).length : 0;
  }

  const filteredEntities = $derived(
    (data.entities || []).filter((entity: any) => {
      if (searchQuery === "") return true;

      const query = searchQuery.toLowerCase();
      const entityName = (entity.entity_name || "").toLowerCase();
      const description = (getSchema(entity)?.description || "").toLowerCase();
      const bankId = (entity.bank_id || "").toLowerCase();

      return (
        entityName.includes(query) ||
        description.includes(query) ||
        bankId.includes(query)
      );
    }),
  );
</script>

<svelte:head>
  <title>Personal Dynamic Entities - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="mb-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        Personal Dynamic Entities
      </h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        Discover entities with personal data scopes. Manage your own records, view community records, and browse public data.
      </p>
    </div>
  </div>

  <!-- Stats -->
  <div class="mb-6 flex items-center gap-4">
    <div
      class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="text-sm text-gray-600 dark:text-gray-400">Available Entities</div>
      <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {data.entities?.length || 0}
      </div>
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
            Error Loading Entities
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
          placeholder="Search by entity name, description, or bank ID..."
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

  <!-- Entities List -->
  <div>
    {#if filteredEntities.length === 0}
      <div class="flex flex-col items-center justify-center py-12 text-center">
        {#if !data.entities || data.entities.length === 0}
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
            No Personal Dynamic Entities Found
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            There are currently no dynamic entities with personal data scopes available to you.
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
            No Matching Entities
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            No entities match your search criteria. Try adjusting your filters.
          </p>
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Entity Name
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Description
              </th>
              <th
                class="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Scopes
              </th>
              <th
                class="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                System / Bank
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Dynamic Entity ID
              </th>
              <th
                class="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Props
              </th>
            </tr>
          </thead>
          <tbody
            class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800"
          >
            {#each filteredEntities as entity}
              {@const schema = getSchema(entity)}
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="whitespace-nowrap px-3 py-3 text-sm font-medium">
                  <a
                    href="/dynamic-entities/personal/{entity.entity_name}"
                    class="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {entity.entity_name || "Unknown"}
                  </a>
                </td>
                <td
                  class="max-w-xs truncate px-3 py-3 text-sm text-gray-700 dark:text-gray-300"
                  title={schema?.description || ""}
                >
                  {schema?.description || "No description"}
                </td>
                <td class="whitespace-nowrap px-3 py-3 text-center text-sm">
                  <div class="flex justify-center gap-1">
                    <span
                      class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
                    >
                      My
                    </span>
                    {#if entity.has_community_access}
                      <span
                        class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      >
                        Community
                      </span>
                    {/if}
                    {#if entity.has_public_access}
                      <span
                        class="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      >
                        Public
                      </span>
                    {/if}
                  </div>
                </td>
                <td
                  class="whitespace-nowrap px-3 py-3 text-center text-sm text-gray-700 dark:text-gray-300"
                >
                  {#if entity.bank_id}
                    <span
                      class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    >
                      {entity.bank_id}
                    </span>
                  {:else}
                    <span class="text-gray-400">System</span>
                  {/if}
                </td>
                <td
                  class="whitespace-nowrap px-3 py-3 text-left text-sm text-gray-500 dark:text-gray-400 font-mono text-xs"
                >
                  {entity.dynamic_entity_id || ""}
                </td>
                <td
                  class="whitespace-nowrap px-3 py-3 text-center text-sm text-gray-700 dark:text-gray-300"
                >
                  {getPropertyCount(entity)}
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
          Showing <span class="font-medium">{filteredEntities.length}</span>
          of
          <span class="font-medium">{data.entities?.length || 0}</span>
          entities
        </div>
      </div>
    {/if}
  </div>
</div>
