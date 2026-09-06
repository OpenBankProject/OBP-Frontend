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
  import { goto, invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";
  import type { OBPWebUIProp } from "$lib/obp/types";

  let { data }: { data: PageData } = $props();

  let searchQuery = $state("");
  let currentFilter = $state(data.filter || "active");

  // Filter webui_props based on search query
  const filteredWebUIProps = $derived(
    (data.webui_props || []).filter((prop: OBPWebUIProp) => {
      if (searchQuery === "") return true;

      const query = searchQuery.toLowerCase();
      const name = (prop.name || "").toLowerCase();
      const value = (prop.value || "").toLowerCase();

      return name.includes(query) || value.includes(query);
    }),
  );

  function openCreateModal() {
    goto("/system/webui-props/create");
  }

  function openEditModal(prop: OBPWebUIProp) {
    if (!prop.name) {
      console.error("Cannot edit prop: missing name", prop);
      alert("Error: This property cannot be edited (missing name)");
      return;
    }
    goto(`/system/webui-props/${prop.name}/edit`);
  }

  function openDeleteModal(prop: OBPWebUIProp) {
    if (!prop.name) {
      console.error("Cannot delete prop: missing name", prop);
      alert("Error: This property cannot be deleted (missing name)");
      return;
    }
    goto(`/system/webui-props/${prop.name}/delete`);
  }

  async function switchFilter(filter: string) {
    currentFilter = filter;
    await goto(`/system/webui-props?what=${filter}`);
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>WebUI Props - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h1 class="text-gray-900 dark:text-gray-100">WebUI Props</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage configuration properties for the web interface ({filteredWebUIProps.length}
          props)
        </p>
      </div>
      <button
        onclick={openCreateModal}
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        Create New Prop
      </button>
    </div>

    <!-- Filter Buttons -->
    <div class="mb-4 flex gap-2">
      <button
        onclick={() => switchFilter("active")}
        class="rounded-lg px-4 py-2 text-sm font-medium transition-colors {currentFilter ===
        'active'
          ? 'bg-blue-600 text-white dark:bg-blue-500'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
      >
        Active
      </button>
      <button
        onclick={() => switchFilter("database")}
        class="rounded-lg px-4 py-2 text-sm font-medium transition-colors {currentFilter ===
        'database'
          ? 'bg-blue-600 text-white dark:bg-blue-500'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
      >
        Database
      </button>
      <button
        onclick={() => switchFilter("config")}
        class="rounded-lg px-4 py-2 text-sm font-medium transition-colors {currentFilter ===
        'config'
          ? 'bg-blue-600 text-white dark:bg-blue-500'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
      >
        Config
      </button>
    </div>

    <!-- Search Box -->
    <div class="mb-4">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search by name, value, or description..."
        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400"
      />
    </div>
  </div>

  <!-- WebUI Props List -->
  {#if filteredWebUIProps && filteredWebUIProps.length > 0}
    <div class="space-y-4">
      {#each filteredWebUIProps as prop, index (`${prop.name}-${index}`)}
        <div
          class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <!-- Header with Name -->
          <div class="mb-4">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {prop.name}
            </h2>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Source: {prop.source || "undefined"}
            </p>
          </div>

          <!-- Value -->
          <div class="mb-4">
            <div
              class="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400"
            >
              Value
            </div>
            <pre
              class="whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-4 text-sm text-gray-900 dark:bg-gray-900/50 dark:text-gray-100">{prop.value}</pre>
          </div>

          <!-- Action Buttons -->
          {#if prop.name && (prop.source === "database" || prop.source === "active" || prop.source === "config")}
            <div class="flex gap-2">
              <!-- Edit button for config, active and database -->
              <button
                onclick={() => openEditModal(prop)}
                class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                Edit
              </button>
              <!-- Delete button only for database -->
              {#if prop.source === "database"}
                <button
                  onclick={() => openDeleteModal(prop)}
                  class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-red-500 dark:hover:bg-red-600"
                >
                  Delete
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-800">
      <svg
        class="mx-auto mb-4 h-16 w-16 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
      <p class="mb-2 text-lg font-medium text-gray-700 dark:text-gray-300">
        No props found
      </p>
      <p class="text-gray-600 dark:text-gray-400">
        {searchQuery
          ? "Try adjusting your search query"
          : "Create your first prop to get started"}
      </p>
    </div>
  {/if}
</div>
