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
  import { trackedFetch } from "$lib/utils/trackedFetch";

  let { data }: { data: PageData } = $props();

  const entity = data.entity;
  let userEntitlements = $derived(data.userEntitlements || []);
  const apiExplorerUrl =
    $page.data.externalLinks?.API_EXPLORER_URL ||
    "https://apiexplorer-ii-sandbox.openbankproject.com";

  // Helper function to get the entity name (in v6.0.0, this is in the entity_name field)
  function getEntityName(entity: any): string {
    return entity.entity_name || "Unknown";
  }

  // Helper function to get schema object
  function getSchema(entity: any): any {
    // In v6.0.0, the schema is in the schema field
    return entity.schema || null;
  }

  const schema = getSchema(entity);
  const entityName: string = getEntityName(entity);
  const properties = schema?.properties || {};
  const requiredFields = schema?.required || [];
  const description = schema?.description || "No description available";

  // Define required roles for CRUD operations on this dynamic entity
  let requiredRoles = $derived.by(() => {
    if (!entityName || entityName === "Unknown") return [];
    return [
      {
        operation: "Create",
        role: `CanCreateDynamicEntity_System${entityName}`,
        description: `Create new ${entityName} records`,
        endpoint: `POST /obp/dynamic-entity/${entityName}`,
        explorerUrl: `${apiExplorerUrl}/resource-docs/OBPdynamic-entity?operationid=OBPv4.0.0-dynamicEntity_create${entityName}_`,
      },
      {
        operation: "Read (list)",
        role: `CanGetDynamicEntity_System${entityName}`,
        description: `List all ${entityName} records`,
        endpoint: `GET /obp/dynamic-entity/${entityName}`,
        explorerUrl: `${apiExplorerUrl}/resource-docs/OBPdynamic-entity?operationid=OBPv4.0.0-dynamicEntity_get${entityName}List_`,
      },
      {
        operation: "Read (single)",
        role: `CanGetDynamicEntity_System${entityName}`,
        description: `View a single ${entityName} record by ID`,
        endpoint: `GET /obp/dynamic-entity/${entityName}/{RECORD_ID}`,
        explorerUrl: `${apiExplorerUrl}/resource-docs/OBPdynamic-entity?operationid=OBPv4.0.0-dynamicEntity_getSingle${entityName}_`,
      },
      {
        operation: "Update",
        role: `CanUpdateDynamicEntity_System${entityName}`,
        description: `Update existing ${entityName} records`,
        endpoint: `PUT /obp/dynamic-entity/${entityName}/{RECORD_ID}`,
        explorerUrl: `${apiExplorerUrl}/resource-docs/OBPdynamic-entity?operationid=OBPv4.0.0-dynamicEntity_update${entityName}_`,
      },
      {
        operation: "Delete",
        role: `CanDeleteDynamicEntity_System${entityName}`,
        description: `Delete ${entityName} records`,
        endpoint: `DELETE /obp/dynamic-entity/${entityName}/{RECORD_ID}`,
        explorerUrl: `${apiExplorerUrl}/resource-docs/OBPdynamic-entity?operationid=OBPv4.0.0-dynamicEntity_delete${entityName}_`,
      },
    ];
  });

  // Check if user has a specific role
  function userHasRole(roleName: string): boolean {
    return userEntitlements.some((ent: any) => ent.role_name === roleName);
  }

  // Track request status for each role
  let requestingRoles = $state<Record<string, boolean>>({});
  let requestSuccess = $state<Record<string, boolean>>({});
  let requestErrors = $state<Record<string, string>>({});

  async function handleRequestEntitlement(roleName: string) {
    if (requestingRoles[roleName]) return;

    requestingRoles[roleName] = true;
    requestErrors[roleName] = "";
    requestSuccess[roleName] = false;

    try {
      const requestBody = {
        role_name: roleName,
        bank_id: "", // System-wide roles use empty string
      };

      const response = await trackedFetch("/backend/rbac/entitlement-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message,
        );
      }

      requestSuccess[roleName] = true;
    } catch (error) {
      requestErrors[roleName] =
        error instanceof Error ? error.message : "Failed to submit request";
      requestingRoles[roleName] = false;
    }
  }

  // Construct API Explorer URL for this dynamic entity
  // Format: /resource-docs/OBPdynamic-entity?operationid=OBPv4.0.0-dynamicEntity_create<ENTITY_NAME>_
  const apiExplorerEntityUrl = `${apiExplorerUrl}/resource-docs/OBPdynamic-entity?operationid=OBPv4.0.0-dynamicEntity_create${entityName}_`;

  async function handleDelete() {
    if (
      !confirm(
        `Are you sure you want to delete the system dynamic entity "${entityName}"?`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/backend/dynamic-entities/${entity.dynamic_entity_id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to delete entity",
        );
        logErrorDetails("Delete Dynamic Entity", errorDetails);
        const errorMessage = formatErrorForDisplay(errorDetails);
        throw new Error(errorMessage);
      }

      alert("System dynamic entity deleted successfully");
      goto("/dynamic-entities/system");
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to delete entity";
      alert(`Error: ${errorMsg}`);
      console.error("Delete error:", error);
    }
  }

  function getTypeDisplayName(type: string): string {
    const typeMap: Record<string, string> = {
      string: "Text",
      integer: "Integer",
      number: "Number",
      boolean: "Boolean",
      DATE_WITH_DAY: "Date",
    };
    return typeMap[type] || type;
  }

  function getTypeBadgeColor(type: string): string {
    const colorMap: Record<string, string> = {
      string: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      integer:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      number:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      boolean:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      DATE_WITH_DAY:
        "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    };
    return (
      colorMap[type] ||
      "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    );
  }

  let isBackingUp = $state(false);

  async function handleBackup() {
    if (isBackingUp) return;

    isBackingUp = true;

    try {
      const response = await fetch(
        `/backend/dynamic-entities/${entity.dynamic_entity_id}/backup`,
        { method: "POST" },
      );

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message);
      }

      alert(`Backup created: ${responseData.entity_name}`);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to backup entity";
      alert(`Error: ${errorMsg}`);
      console.error("Backup error:", error);
    } finally {
      isBackingUp = false;
    }
  }

  let exportCopied = $state(false);

  function createExportDefinition(): any {
    // Create the request body needed to recreate this entity (v6.0.0 format)
    return {
      entity_name: entityName,
      schema: schema,
      has_personal_entity: entity.has_personal_entity || false,
      has_public_access: entity.has_public_access || false,
      has_community_access: entity.has_community_access || false,
      personal_requires_role: entity.personal_requires_role || false,
      auth_mode: entity.auth_mode ?? "UserOnly",
    };
  }

  async function exportDefinition() {
    const exportDef = createExportDefinition();
    const exportJson = JSON.stringify(exportDef, null, 2);

    try {
      await navigator.clipboard.writeText(exportJson);
      exportCopied = true;
      setTimeout(() => {
        exportCopied = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      alert("Failed to copy to clipboard");
    }
  }

  async function downloadDefinition() {
    const exportDef = createExportDefinition();
    const exportJson = JSON.stringify(exportDef, null, 2);

    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entityName}_definition.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<svelte:head>
  <title>{entityName} - System Dynamic Entity - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-8">
  <!-- Breadcrumb -->
  <div class="mb-6">
    <a
      href="/dynamic-entities/system"
      class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
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
          d="M15 19l-7-7 7-7"
        />
      </svg>
      Back to System Dynamic Entities
    </a>

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {entityName}
        </h1>
        <p class="mt-1 text-gray-600 dark:text-gray-400">
          System Dynamic Entity Details
        </p>
      </div>
      <div class="flex gap-2">
        <a
          href={apiExplorerEntityUrl}
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
        <a
          href="/dynamic-entities/system/{entity.dynamic_entity_id}/crud"
          class="inline-flex items-center rounded-lg border border-blue-300 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:border-blue-600 dark:bg-blue-500 dark:hover:bg-blue-600"
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
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
            />
          </svg>
          Manage Data (CRUD)
        </a>
        <!-- Note: By default OBP adds a leading _ to the tags so they don't conflict with tags of OBP static entities -->
        <!-- Commented out - not working properly
        <a
          href="/dynamic-entities/system/openapi-json?tags=_{entityName}"
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
          href="/dynamic-entities/system/openapi-yaml?tags=_{entityName}"
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
        -->
      </div>
    </div>
  </div>

  <!-- Entity Information Card -->
  <div
    class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
      Entity Information
    </h2>
    <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Entity Name
        </dt>
        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
          {entityName}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Entity ID
        </dt>
        <dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
          {entity.dynamic_entity_id}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          User ID
        </dt>
        <dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
          {entity.user_id}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Has Personal Entity
        </dt>
        <dd class="mt-1 text-sm">
          {#if entity.has_personal_entity}
            <span
              class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
            >
              Yes
            </span>
          {:else}
            <span
              class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            >
              No
            </span>
          {/if}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Who may hold the roles
        </dt>
        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100" data-testid="dynamic-entity-auth-mode">
          {entity.auth_mode ?? "UserOnly"}
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {#if entity.auth_mode === "ApplicationOnly"}
              Consumers with the Scope; no User needed.
            {:else if entity.auth_mode === "UserOrApplication"}
              A User's Entitlement or a Consumer's Scope.
            {:else if entity.auth_mode === "UserAndApplication"}
              Both a User's Entitlement and a Consumer's Scope.
            {:else}
              Users with the Entitlement.
            {/if}
          </p>
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Has Public Access
        </dt>
        <dd class="mt-1 text-sm">
          {#if entity.has_public_access}
            <span
              class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
            >
              Yes
            </span>
            <p class="mt-1 font-mono text-xs text-blue-600 dark:text-blue-400">
              GET /obp/dynamic-entity/public/{entityName}
            </p>
          {:else}
            <span
              class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            >
              No
            </span>
          {/if}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Has Community Access
        </dt>
        <dd class="mt-1 text-sm">
          {#if entity.has_community_access}
            <span
              class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
            >
              Yes
            </span>
            <p class="mt-1 font-mono text-xs text-blue-600 dark:text-blue-400">
              GET /obp/dynamic-entity/community/{entityName}
            </p>
          {:else}
            <span
              class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            >
              No
            </span>
          {/if}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Personal Requires Role
        </dt>
        <dd class="mt-1 text-sm">
          {#if entity.personal_requires_role}
            <span
              class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
            >
              Yes
            </span>
          {:else}
            <span
              class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            >
              No
            </span>
          {/if}
        </dd>
      </div>
      <div class="sm:col-span-2">
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Description
        </dt>
        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
          {description}
        </dd>
      </div>
    </dl>
  </div>

  <!-- Schema Properties -->
  <div
    class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    <div class="border-b border-gray-200 p-6 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Schema Properties
      </h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {Object.keys(properties).length} properties defined
        {#if requiredFields.length > 0}
          ({requiredFields.length} required)
        {/if}
      </p>
    </div>

    {#if Object.keys(properties).length === 0}
      <div class="flex flex-col items-center justify-center py-12 text-center">
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          No Properties Defined
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          This entity has no schema properties defined.
        </p>
      </div>
    {:else}
      <div class="divide-y divide-gray-200 dark:divide-gray-700">
        {#each Object.entries(properties) as [fieldName, fieldDef]}
          {@const fieldDefTyped = fieldDef as any}
          {@const isRequired = requiredFields.includes(fieldName)}
          <div class="p-6">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h3
                    class="font-mono text-base font-semibold text-gray-900 dark:text-gray-100"
                  >
                    {fieldName}
                  </h3>
                  {#if isRequired}
                    <span
                      class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200"
                    >
                      Required
                    </span>
                  {/if}
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {getTypeBadgeColor(
                      fieldDefTyped.type,
                    )}"
                  >
                    {getTypeDisplayName(fieldDefTyped.type)}
                  </span>
                  {#if fieldDefTyped.writeRoleRequired || fieldDefTyped.writeRole}
                    <span
                      class="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                      title={fieldDefTyped.writeRole
                        ? `Write-restricted — requires role: ${fieldDefTyped.writeRole}`
                        : "Write-restricted — set only via PATCH by a holder of the auto-generated field write role"}
                    >
                      Write-restricted
                    </span>
                  {/if}
                  {#if fieldDefTyped.readRoleRequired || fieldDefTyped.readRole}
                    <span
                      class="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      title={fieldDefTyped.readRole
                        ? `Read-restricted — requires role: ${fieldDefTyped.readRole}`
                        : "Read-restricted — omitted from GET unless the caller holds the auto-generated field read role"}
                    >
                      Read-restricted
                    </span>
                  {/if}
                </div>
                {#if fieldDefTyped.description}
                  <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {fieldDefTyped.description}
                  </p>
                {/if}
                <dl class="mt-3 space-y-1">
                  {#if fieldDefTyped.example !== undefined}
                    <div class="flex gap-2">
                      <dt
                        class="text-sm font-medium text-gray-500 dark:text-gray-400"
                      >
                        Example:
                      </dt>
                      <dd
                        class="font-mono text-sm text-gray-900 dark:text-gray-100"
                      >
                        {typeof fieldDefTyped.example === "boolean"
                          ? fieldDefTyped.example.toString()
                          : fieldDefTyped.example}
                      </dd>
                    </div>
                  {/if}
                  {#if fieldDefTyped.minLength !== undefined}
                    <div class="flex gap-2">
                      <dt
                        class="text-sm font-medium text-gray-500 dark:text-gray-400"
                      >
                        Min Length:
                      </dt>
                      <dd class="text-sm text-gray-900 dark:text-gray-100">
                        {fieldDefTyped.minLength}
                      </dd>
                    </div>
                  {/if}
                  {#if fieldDefTyped.maxLength !== undefined}
                    <div class="flex gap-2">
                      <dt
                        class="text-sm font-medium text-gray-500 dark:text-gray-400"
                      >
                        Max Length:
                      </dt>
                      <dd class="text-sm text-gray-900 dark:text-gray-100">
                        {fieldDefTyped.maxLength}
                      </dd>
                    </div>
                  {/if}
                </dl>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if entity.has_personal_entity}
    <!-- Allowed Operations Section (for Personal Entities) -->
    <div
      class="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Allowed Operations
      </h2>
      <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
        This is a personal entity. Any authenticated user can perform CRUD
        operations on their own {entityName} records without requiring specific
        roles.
      </p>
      <div class="space-y-3">
        {#each ["Create", "Read", "Update", "Delete"] as operation}
          <div
            class="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
          >
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span
                  class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                >
                  {operation}
                </span>
                <span
                  class="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300"
                >
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  No role required
                </span>
              </div>
              <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {operation} your own personal {entityName} records
              </p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <!-- Required Roles Section (for System-only Entities) -->
    <div
      class="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Required Roles for CRUD Operations
      </h2>
      <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
        These roles are required to perform operations on {entityName} records:
      </p>
      <div class="space-y-3">
        {#each requiredRoles as roleReq}
          <div
            class="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
          >
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span
                  class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                >
                  {roleReq.operation}
                </span>
                {#if userHasRole(roleReq.role)}
                  <span
                    class="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  >
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    You have this role
                  </span>
                {/if}
              </div>
              <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {roleReq.description}
              </p>
              <p class="mt-1 font-mono text-xs text-gray-500 dark:text-gray-500">
                {roleReq.role}
              </p>
              <p class="mt-1 flex items-center gap-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                <span>{roleReq.endpoint}</span>
                <a
                  href={roleReq.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 no-underline hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
                  title="Open in API Explorer"
                >
                  <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  API Explorer
                </a>
              </p>
            </div>
            {#if !userHasRole(roleReq.role)}
              <div class="ml-4 flex flex-col items-end gap-1">
                {#if requestSuccess[roleReq.role]}
                  <div
                    class="rounded-lg bg-green-100 px-3 py-2 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  >
                    Thanks, request generated. Ask your admin to accept it on the <a href="/rbac/entitlement-requests" class="font-semibold underline hover:text-green-900 dark:hover:text-green-200">Entitlement Requests page</a>.
                  </div>
                {:else}
                  <button
                    onclick={() => handleRequestEntitlement(roleReq.role)}
                    disabled={requestingRoles[roleReq.role]}
                    class="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    {#if requestingRoles[roleReq.role]}
                      <svg
                        class="h-3 w-3 animate-spin"
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
                      Requesting...
                    {:else}
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
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Request Entitlement
                    {/if}
                  </button>
                {/if}
                {#if requestErrors[roleReq.role]}
                  <div class="max-w-xs text-xs text-red-600 dark:text-red-400">
                    {requestErrors[roleReq.role]}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Raw JSON View -->
  <div
    class="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    <div class="border-b border-gray-200 p-6 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Raw Schema Definition
      </h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Complete schema definition in JSON format
      </p>
    </div>
    <div class="p-6">
      <pre
        class="overflow-x-auto rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-900"><code
          class="text-gray-900 dark:text-gray-100"
          >{JSON.stringify(schema, null, 2)}</code
        ></pre>
    </div>
  </div>

  <!-- Action Buttons -->
  <div class="mt-6 flex justify-end gap-2">
    <button
      type="button"
      onclick={exportDefinition}
      class="inline-flex items-center rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 dark:border-green-600 dark:bg-gray-800 dark:text-green-400 dark:hover:bg-green-900/20"
      title="Copy definition to clipboard"
    >
      {#if exportCopied}
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
            d="M5 13l4 4L19 7"
          />
        </svg>
        Copied!
      {:else}
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
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        Copy Definition
      {/if}
    </button>
    <button
      type="button"
      onclick={downloadDefinition}
      class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      title="Download definition as JSON file"
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
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      Download
    </button>
    <button
      type="button"
      onclick={handleBackup}
      disabled={isBackingUp}
      class="inline-flex items-center rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-600 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
      title="Backup entity definition and all data"
    >
      {#if isBackingUp}
        <svg
          class="mr-2 h-4 w-4 animate-spin"
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
        Backing up...
      {:else}
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
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        Backup
      {/if}
    </button>
    <button
      type="button"
      onclick={handleDelete}
      data-testid="delete-entity"
      class="inline-flex items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-600 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
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
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
      Delete Entity
    </button>
  </div>
</div>
