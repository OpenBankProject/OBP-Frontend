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
      <h1 class="text-3xl font-bold ui-text">
        Personal Dynamic Entities
      </h1>
      <p class="mt-1 ui-muted">
        Discover entities with personal data scopes. Manage your own records, view community records, and browse public data.
      </p>
    </div>
  </div>

  <!-- Stats -->
  <div class="mb-6 flex items-center gap-4">
    <div
      class="rounded-lg border p-4 ui-card ui-border"
    >
      <div class="text-sm ui-muted">Available Entities</div>
      <div class="mt-1 text-2xl font-bold ui-text">
        {data.entities?.length || 0}
      </div>
    </div>
  </div>

  <!-- Error Message -->
  {#if data.error}
    <div
      class="mb-6 rounded-lg border p-4 ui-tone-error"
    >
      <div class="flex items-start">
        <svg
          class="mr-3 h-5 w-5 ui-text-error"
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
          <h3 class="font-semibold ui-text-error">
            Error Loading Entities
          </h3>
          <p class="mt-1 text-sm ui-text-error">
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
          class="w-full rounded-lg border px-4 py-2 pl-10 focus:outline-none focus:ring-2 ui-card ui-text ui-border"
        />
        <svg
          class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 ui-muted"
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
            class="mb-4 h-16 w-16 ui-muted"
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
            class="mb-2 text-lg font-semibold ui-text"
          >
            No Personal Dynamic Entities Found
          </h3>
          <p class="ui-muted">
            There are currently no dynamic entities with personal data scopes available to you.
          </p>
        {:else}
          <svg
            class="mb-4 h-16 w-16 ui-muted"
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
            class="mb-2 text-lg font-semibold ui-text"
          >
            No Matching Entities
          </h3>
          <p class="ui-muted">
            No entities match your search criteria. Try adjusting your filters.
          </p>
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y ui-border">
          <thead class="ui-card">
            <tr>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted"
              >
                Entity Name
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted"
              >
                Description
              </th>
              <th
                class="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider ui-muted"
              >
                Scopes
              </th>
              <th
                class="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider ui-muted"
              >
                System / Bank
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted"
              >
                Dynamic Entity ID
              </th>
              <th
                class="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider ui-muted"
              >
                Props
              </th>
            </tr>
          </thead>
          <tbody
            class="divide-y ui-card ui-border"
          >
            {#each filteredEntities as entity}
              {@const schema = getSchema(entity)}
              <tr class="ui-hover">
                <td class="whitespace-nowrap px-3 py-3 text-sm font-medium">
                  <a
                    href="/dynamic-entities/personal/{entity.entity_name}"
                    class="hover:underline ui-link"
                  >
                    {entity.entity_name || "Unknown"}
                  </a>
                </td>
                <td
                  class="max-w-xs truncate px-3 py-3 text-sm ui-muted"
                  title={schema?.description || ""}
                >
                  {schema?.description || "No description"}
                </td>
                <td class="whitespace-nowrap px-3 py-3 text-center text-sm">
                  <div class="flex justify-center gap-1">
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ui-tone-success"
                    >
                      My
                    </span>
                    {#if entity.has_community_access}
                      <span
                        class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ui-tone-info"
                      >
                        Community
                      </span>
                    {/if}
                    {#if entity.has_public_access}
                      <span
                        class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ui-tone-accent"
                      >
                        Public
                      </span>
                    {/if}
                  </div>
                </td>
                <td
                  class="whitespace-nowrap px-3 py-3 text-center text-sm ui-muted"
                >
                  {#if entity.bank_id}
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ui-panel ui-text"
                    >
                      {entity.bank_id}
                    </span>
                  {:else}
                    <span class="ui-muted">System</span>
                  {/if}
                </td>
                <td
                  class="whitespace-nowrap px-3 py-3 text-left text-sm font-mono text-xs ui-muted"
                >
                  {entity.dynamic_entity_id || ""}
                </td>
                <td
                  class="whitespace-nowrap px-3 py-3 text-center text-sm ui-muted"
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
        class="mt-4 flex items-center justify-between border-t px-4 py-3 ui-border"
      >
        <div class="text-sm ui-muted">
          Showing <span class="font-medium">{filteredEntities.length}</span>
          of
          <span class="font-medium">{data.entities?.length || 0}</span>
          entities
        </div>
      </div>
    {/if}
  </div>
</div>
