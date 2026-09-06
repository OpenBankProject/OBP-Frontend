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
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";

  let { data }: { data: PageData } = $props();

  // Read level from query param: system, bank, or both (default)
  let level = $derived<"system" | "bank" | "both">(
    (() => {
      const param = $page.url.searchParams.get("level");
      if (param === "system" || param === "bank") return param;
      return "both";
    })()
  );

  let showSystem = $derived(level === "system" || level === "both");
  let showBank = $derived(level === "bank" || level === "both");

  let userEntitlements = $derived(data.userEntitlements || []);

  let hasSystemReadRole = $derived(
    userEntitlements.some((ent: any) => ent.role_name === "CanGetSystemLevelDynamicEntities")
  );
  let hasBankReadRole = $derived(
    userEntitlements.some((ent: any) =>
      ent.role_name === "CanGetBankLevelDynamicEntities" && ent.bank_id === currentBank.bankId
    )
  );

  const apiExplorerUrl =
    $page.data.externalLinks?.API_EXPLORER_URL ||
    "https://apiexplorer-ii-sandbox.openbankproject.com";

  // Construct API Explorer URLs for dynamic entities
  const apiExplorerDynamicEntityUrl = `${apiExplorerUrl}/resource-docs/OBPdynamic-entity`;
  const apiExplorerResourceDocsUrl = `${apiExplorerUrl}/resource-docs/OBPv6.0.0?operationid=OBPv1.4.0-getResourceDocsObp`;

  let searchQuery = $state("");

  // Bank-level dynamic entities (fetched client-side based on current bank)
  let bankEntities = $state<any[]>([]);
  let bankEntitiesLoading = $state(false);
  let bankEntitiesError = $state<string | null>(null);

  $effect(() => {
    const bankId = currentBank.bankId;
    if (bankId && showBank && hasBankReadRole) {
      fetchBankEntities(bankId);
    } else {
      bankEntities = [];
      bankEntitiesError = null;
    }
  });

  async function fetchBankEntities(bankId: string) {
    bankEntitiesLoading = true;
    bankEntitiesError = null;
    try {
      const response = await trackedFetch(`/proxy/obp/v6.0.0/management/banks/${bankId}/dynamic-entities`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch bank-level dynamic entities");
      }
      bankEntities = (result.dynamic_entities || []).sort((a: any, b: any) => {
        const nameA = (a.entity_name || "").toLowerCase();
        const nameB = (b.entity_name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
    } catch (err) {
      bankEntitiesError = err instanceof Error ? err.message : "Failed to fetch bank entities";
      bankEntities = [];
    } finally {
      bankEntitiesLoading = false;
    }
  }

  // Helper function to extract entity name from the entity object
  function getEntityName(entity: any): string {
    // In v6.0.0, the entity name is in the entity_name field
    return entity.entity_name || "Unknown";
  }

  // Helper function to get schema object
  function getSchema(entity: any): any {
    // In v6.0.0, the schema is in the schema field
    return entity.schema || null;
  }

  // Combine system and bank entities with a level marker, filtered by query param
  const allEntities = $derived([
    ...(showSystem ? (data.entities || []).map((e: any) => ({ ...e, _level: "System" })) : []),
    ...(showBank ? bankEntities.map((e: any) => ({ ...e, _level: "Bank" })) : []),
  ]);

  const filteredEntities = $derived(
    allEntities.filter((entity: any) => {
      if (searchQuery === "") return true;

      const query = searchQuery.toLowerCase();
      const entityName = getEntityName(entity).toLowerCase();
      const entityId = (entity.dynamic_entity_id || "").toLowerCase();
      const schema = getSchema(entity);
      const description = schema?.description?.toLowerCase() || "";
      const level = entity._level.toLowerCase();

      return (
        entityName.includes(query) ||
        entityId.includes(query) ||
        description.includes(query) ||
        level.includes(query)
      );
    }),
  );

  async function deleteEntity(
    entityId: string,
    entityName: string,
    cascade: boolean = false,
  ) {
    const confirmMessage = cascade
      ? `Are you sure you want to delete the system dynamic entity "${entityName}" AND ALL ITS DATA (cascade)? This cannot be undone!`
      : `Are you sure you want to delete the system dynamic entity "${entityName}"?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const url = cascade
        ? `/backend/dynamic-entities/${entityId}?cascade=true`
        : `/backend/dynamic-entities/${entityId}`;

      const response = await fetch(url, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to delete entity",
        );
        logErrorDetails("Delete System Dynamic Entity", errorDetails);
        const errorMessage = formatErrorForDisplay(errorDetails);
        throw new Error(errorMessage);
      }

      alert("System dynamic entity deleted successfully");
      window.location.reload();
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to delete system dynamic entity";
      alert(`Error: ${errorMsg}`);
      console.error("Delete error:", error);
    }
  }

  let backingUp = $state<Record<string, boolean>>({});

  async function backupEntity(entityId: string, entityName: string) {
    if (backingUp[entityId]) return;

    backingUp[entityId] = true;

    try {
      const response = await fetch(`/backend/dynamic-entities/${entityId}/backup`, {
        method: "POST",
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message);
      }

      alert(`Backup created: ${responseData.entity_name}`);
      window.location.reload();
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to backup entity";
      alert(`Error: ${errorMsg}`);
      console.error("Backup error:", error);
    } finally {
      backingUp[entityId] = false;
    }
  }

  function getPropertyCount(entity: any): number {
    const schema = getSchema(entity);
    return schema?.properties ? Object.keys(schema.properties).length : 0;
  }

  function getRequiredFieldsCount(entity: any): number {
    const schema = getSchema(entity);
    return schema?.required ? schema.required.length : 0;
  }
</script>

<svelte:head>
  <title>{level === "system" ? "System" : level === "bank" ? "Bank" : ""} Dynamic Entities - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        {level === "system" ? "System" : level === "bank" ? "Bank" : ""} Dynamic Entities
      </h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        {#if level === "system"}
          System-wide dynamic data entities
        {:else if level === "bank"}
          Bank-level dynamic data entities{#if currentBank.bank} for {currentBank.bank.full_name || currentBank.bankId}{/if}
        {:else}
          System-wide and bank-level dynamic data entities
        {/if}
      </p>
    </div>
    <a
      href="/dynamic-entities/system/create"
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
      Create Dynamic Entity
    </a>
  </div>

  <!-- Stats -->
  <div class="mb-6 flex items-center gap-4">
    {#if showSystem}
      <div
        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="text-sm text-gray-600 dark:text-gray-400">System</div>
        <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
          {data.entities?.length || 0}
        </div>
      </div>
    {/if}
    {#if showBank}
      <div
        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Bank {#if currentBank.bank}({currentBank.bank.full_name || currentBank.bank.short_name || currentBank.bankId}){/if}
        </div>
        <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
          {#if bankEntitiesLoading}
            <span class="text-sm text-gray-400">...</span>
          {:else if currentBank.bankId}
            {bankEntities.length}
          {:else}
            <span class="text-sm text-gray-400">-</span>
          {/if}
        </div>
      </div>
    {/if}
    <div class="flex gap-2">
      <a
        href={apiExplorerDynamicEntityUrl}
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
        API Explorer CRUD
      </a>
      <a
        href="/dynamic-entities/system/openapi-json"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        title="View OpenAPI JSON"
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        OpenAPI JSON
      </a>
      <a
        href="/dynamic-entities/system/openapi-yaml"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        title="View OpenAPI YAML"
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        OpenAPI YAML
      </a>
      <a
        href={apiExplorerResourceDocsUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center rounded-lg border border-purple-300 bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 dark:border-purple-600 dark:bg-purple-500 dark:hover:bg-purple-600"
        title="Open API Explorer Resource Docs"
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
        API Explorer Resource Docs
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
            Error Loading Entities
          </h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-400">
            {data.error}
          </p>
        </div>
      </div>
    </div>
  {/if}

  {#if showBank && bankEntitiesError}
    <div
      class="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
    >
      <p class="text-sm text-amber-700 dark:text-amber-400">
        Could not load bank-level entities for {currentBank.bank?.full_name || currentBank.bank?.short_name || currentBank.bankId || "selected bank"}: {bankEntitiesError}
      </p>
    </div>
  {/if}

  <!-- Role Checks -->
  {#if showSystem && !hasSystemReadRole}
    <MissingRoleAlert
      roles={["CanGetSystemLevelDynamicEntities"]}
      message="You need this role to list system-level dynamic entities"
    />
  {/if}
  {#if showBank && currentBank.bankId && !hasBankReadRole}
    <MissingRoleAlert
      roles={["CanGetBankLevelDynamicEntities"]}
      bankId={currentBank.bankId}
      message="You need this role to list bank-level dynamic entities for {currentBank.bank?.full_name || currentBank.bankId}"
    />
  {/if}

  <!-- Search and Filters -->
  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
    <div class="flex-1">
      <div class="relative">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search by entity name, ID, or description..."
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
            No System Dynamic Entities Found
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            There are currently no system dynamic entities defined.
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
              {#if level === "both"}
                <th
                  class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Level
                </th>
              {/if}
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Name
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Description
              </th>
              <th
                class="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Props
              </th>
              <th
                class="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Req
              </th>
              <th
                class="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Records
              </th>
              <th
                class="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody
            class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800"
          >
            {#each filteredEntities as entity}
              {@const schema = getSchema(entity)}
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                {#if level === "both"}
                  <td class="whitespace-nowrap px-3 py-3 text-sm">
                    {#if entity._level === "System"}
                      <span class="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">System</span>
                    {:else}
                      <span class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Bank</span>
                    {/if}
                  </td>
                {/if}
                <td class="whitespace-nowrap px-3 py-3 text-sm font-medium">
                  <a
                    href="/dynamic-entities/system/{entity.dynamic_entity_id}"
                    class="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {getEntityName(entity)}
                  </a>
                </td>
                <td
                  class="max-w-xs truncate px-3 py-3 text-sm text-gray-700 dark:text-gray-300"
                  title={schema?.description || ""}
                >
                  {schema?.description || "No description"}
                </td>
                <td
                  class="whitespace-nowrap px-3 py-3 text-center text-sm text-gray-700 dark:text-gray-300"
                >
                  {getPropertyCount(entity)}
                </td>
                <td
                  class="whitespace-nowrap px-3 py-3 text-center text-sm text-gray-700 dark:text-gray-300"
                >
                  {getRequiredFieldsCount(entity)}
                </td>
                <td class="whitespace-nowrap px-3 py-3 text-center text-sm">
                  <span class="font-medium text-gray-900 dark:text-gray-100">
                    {entity.record_count}
                  </span>
                </td>
                <td class="whitespace-nowrap px-3 py-3 text-right text-sm">
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      onclick={() =>
                        goto(
                          `/dynamic-entities/system/${entity.dynamic_entity_id}`,
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
                      onclick={() =>
                        backupEntity(
                          entity.dynamic_entity_id,
                          getEntityName(entity),
                        )}
                      disabled={backingUp[entity.dynamic_entity_id]}
                      class="text-green-600 hover:text-green-900 disabled:opacity-50 dark:text-green-400 dark:hover:text-green-300"
                      title="Backup Entity (definition + data)"
                    >
                      {#if backingUp[entity.dynamic_entity_id]}
                        <svg
                          class="h-5 w-5 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          />
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      {:else}
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
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      {/if}
                    </button>
                    <button
                      type="button"
                      onclick={() =>
                        deleteEntity(
                          entity.dynamic_entity_id,
                          getEntityName(entity),
                          false,
                        )}
                      class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete Entity Definition"
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
                    <button
                      type="button"
                      onclick={() =>
                        deleteEntity(
                          entity.dynamic_entity_id,
                          getEntityName(entity),
                          true,
                        )}
                      class="text-red-800 hover:text-red-950 dark:text-red-500 dark:hover:text-red-400"
                      title="Delete Entity + All Data (CASCADE)"
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
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
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
          Showing <span class="font-medium">{filteredEntities.length}</span>
          of
          <span class="font-medium">{allEntities.length}</span>
          entities
        </div>
      </div>
    {/if}
  </div>
</div>
