<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import type { PageData } from "./$types";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
  } from "$lib/utils/errorHandler";
  import {
    validateDynamicEntityFields,
    convertDynamicEntityFormData,
    initialDynamicEntityFormData,
    dynamicEntityInputType,
    type DynamicEntityFieldDef,
  } from "@obp/shared/obp";

  let { data }: { data: PageData } = $props();

  // Make entity data reactive to prop changes
  let entity = $derived(data.entity);
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

  // Make all derived values reactive
  let schema = $derived(getSchema(entity));
  let entityName = $derived(getEntityName(entity));
  let properties = $derived<Record<string, DynamicEntityFieldDef>>(
    schema?.properties || {},
  );
  let requiredFields = $derived<string[]>(schema?.required || []);

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

  // Collapsible state for Required Roles section
  let rolesCollapsed = $state(true);

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

  // Helper function to extract data from record (handles potential nesting)
  function getRecordData(record: any): any {
    if (!record) return record;

    // Check if data is nested under the entity name
    // e.g., { "Guitar": { "name": "Fender", "price": 1000 }, "dynamic_entity_id": "123" }
    if (
      entityName &&
      record[entityName] &&
      typeof record[entityName] === "object"
    ) {
      return record[entityName];
    }

    // Otherwise return the record as-is (flat structure)
    return record;
  }

  // Helper function to find the ID field name (e.g., piano_id, guitar_id, etc.)
  function getRecordIdField(record: any): string | null {
    if (!record) return null;

    // First check for common ID field patterns
    const recordData = getRecordData(record);
    const keys = Object.keys(recordData);

    // Look for fields ending with _id
    const idField = keys.find((key) => key.endsWith("_id"));
    if (idField) return idField;

    // Fallback to 'id' if present
    if (keys.includes("id")) return "id";

    return null;
  }

  // Helper function to get the ID value from a record
  function getRecordId(record: any): string | null {
    const recordData = getRecordData(record);
    const idField = getRecordIdField(recordData);
    return idField ? recordData[idField] : null;
  }

  // Render a field value for display. Objects/arrays (json fields) are
  // stringified so they don't show as "[object Object]".
  function displayValue(value: any): string {
    if (value === undefined || value === null) return "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  let dataRecords = $state(data.dataRecords || []);
  let searchQuery = $state("");
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showViewModal = $state(false);
  let selectedRecord: any = $state(null);
  let isSubmitting = $state(false);

  // Form data for create/edit
  let formData: Record<string, any> = $state({});
  let validationErrors: Record<string, string> = $state({});

  // Reload data when entity changes (route parameter changes)
  $effect(() => {
    // Update dataRecords when data prop changes
    dataRecords = data.dataRecords || [];
    // Reset search and close modals when switching entities
    searchQuery = "";
    showCreateModal = false;
    showEditModal = false;
    showViewModal = false;
    selectedRecord = null;
  });

  // Filter records based on search
  let filteredRecords = $derived(
    dataRecords.filter((record: any) => {
      if (searchQuery === "") return true;
      const query = searchQuery.toLowerCase();
      const recordString = JSON.stringify(record).toLowerCase();
      return recordString.includes(query);
    }),
  );

  function initializeFormData(record?: any) {
    formData = initialDynamicEntityFormData(
      properties,
      record ? getRecordData(record) : null,
    );
    validationErrors = {};
  }

  function openCreateModal() {
    initializeFormData();
    showCreateModal = true;
  }

  function openEditModal(record: any) {
    selectedRecord = record;
    initializeFormData(record);
    showEditModal = true;
  }

  function openViewModal(record: any) {
    selectedRecord = record;
    showViewModal = true;
  }

  function closeModals() {
    showCreateModal = false;
    showEditModal = false;
    showViewModal = false;
    selectedRecord = null;
    formData = {};
    validationErrors = {};
  }

  function validateAllFields(): boolean {
    validationErrors = validateDynamicEntityFields(
      properties,
      requiredFields,
      formData,
    );
    return Object.keys(validationErrors).length === 0;
  }

  async function handleCreate() {
    if (!validateAllFields()) {
      alert("Please fix validation errors");
      return;
    }

    isSubmitting = true;

    try {
      const convertedData = convertDynamicEntityFormData(properties, formData);
      console.log("Original formData:", formData);
      console.log("Converted data being sent:", convertedData);
      console.log(
        "Converted data JSON:",
        JSON.stringify(convertedData, null, 2),
      );

      const response = await fetch(
        `/backend/dynamic-entities/${entity.dynamic_entity_id}/data`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(convertedData),
        },
      );

      if (!response.ok) {
        // Extract full error details - NEVER hide or simplify OBP error messages!
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to create record",
        );
        console.error("API Error Response:", errorDetails);
        throw new Error(formatErrorForDisplay(errorDetails));
      }

      await response.json();

      // Refetch all records to ensure correct data structure
      const refetchResponse = await fetch(
        `/backend/dynamic-entities/${entity.dynamic_entity_id}/data`,
        {
          credentials: "include",
        },
      );

      if (refetchResponse.ok) {
        const refetchData = await refetchResponse.json();
        // Handle the same data extraction logic as the server
        if (Array.isArray(refetchData)) {
          dataRecords = refetchData;
        } else {
          const snakeCaseKey = `${entityName.toLowerCase()}_list`;
          dataRecords =
            refetchData.data ||
            refetchData.records ||
            refetchData[entityName] ||
            refetchData[snakeCaseKey] ||
            [];
        }
      }

      alert("Record created successfully");
      closeModals();
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to create record";
      alert(`Error: ${errorMsg}`);
      console.error("Create error:", error);
    } finally {
      isSubmitting = false;
    }
  }

  async function handleUpdate() {
    if (!validateAllFields()) {
      alert("Please fix validation errors");
      return;
    }

    const recordId = getRecordId(selectedRecord);
    if (!recordId) {
      alert("No record ID found");
      return;
    }

    isSubmitting = true;

    try {
      const convertedData = convertDynamicEntityFormData(properties, formData);

      const response = await fetch(
        `/backend/dynamic-entities/${entity.dynamic_entity_id}/data/${recordId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(convertedData),
        },
      );

      if (!response.ok) {
        // Extract full error details - NEVER hide or simplify OBP error messages!
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to update record",
        );
        console.error("API Error Response:", errorDetails);
        throw new Error(formatErrorForDisplay(errorDetails));
      }

      await response.json();

      // Refetch all records to ensure correct data structure
      const refetchResponse = await fetch(
        `/backend/dynamic-entities/${entity.dynamic_entity_id}/data`,
        {
          credentials: "include",
        },
      );

      if (refetchResponse.ok) {
        const refetchData = await refetchResponse.json();
        // Handle the same data extraction logic as the server
        if (Array.isArray(refetchData)) {
          dataRecords = refetchData;
        } else {
          const snakeCaseKey = `${entityName.toLowerCase()}_list`;
          dataRecords =
            refetchData.data ||
            refetchData.records ||
            refetchData[entityName] ||
            refetchData[snakeCaseKey] ||
            [];
        }
      }

      alert("Record updated successfully");
      closeModals();
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to update record";
      alert(`Error: ${errorMsg}`);
      console.error("Update error:", error);
    } finally {
      isSubmitting = false;
    }
  }

  async function handleDelete(record: any) {
    if (!confirm("Are you sure you want to delete this record?")) {
      return;
    }

    const recordId = getRecordId(record);
    if (!recordId) {
      alert("No record ID found");
      return;
    }

    try {
      const response = await fetch(
        `/backend/dynamic-entities/${entity.dynamic_entity_id}/data/${recordId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!response.ok) {
        // Extract full error details - NEVER hide or simplify OBP error messages!
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to delete record",
        );
        console.error("API Error Response:", errorDetails);
        throw new Error(formatErrorForDisplay(errorDetails));
      }

      // Refetch all records to ensure correct data structure
      const refetchResponse = await fetch(
        `/backend/dynamic-entities/${entity.dynamic_entity_id}/data`,
        {
          credentials: "include",
        },
      );

      if (refetchResponse.ok) {
        const refetchData = await refetchResponse.json();
        // Handle the same data extraction logic as the server
        if (Array.isArray(refetchData)) {
          dataRecords = refetchData;
        } else {
          const snakeCaseKey = `${entityName.toLowerCase()}_list`;
          dataRecords =
            refetchData.data ||
            refetchData.records ||
            refetchData[entityName] ||
            refetchData[snakeCaseKey] ||
            [];
        }
      }

      alert("Record deleted successfully");
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to delete record";
      alert(`Error: ${errorMsg}`);
      console.error("Delete error:", error);
    }
  }

</script>

<svelte:head>
  <title>Manage {entityName} Data - CRUD - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <!-- Breadcrumb -->
  <div class="mb-6">
    <div class="flex items-center gap-2 text-sm">
      <a
        href="/dynamic-entities/system"
        class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        System Dynamic Entities
      </a>
      <span class="text-gray-400">/</span>
      <a
        href="/dynamic-entities/system/{entity.dynamic_entity_id}"
        class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        {entityName}
      </a>
      <span class="text-gray-400">/</span>
      <span class="text-gray-600 dark:text-gray-400">Data Management</span>
    </div>
  </div>

  <!-- Header -->
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        Manage {entityName} Data
      </h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        Create, read, update, and delete records for this entity
      </p>
    </div>
    <button
      type="button"
      onclick={openCreateModal}
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
      Create Record
    </button>
  </div>

  <!-- Stats -->
  <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
    <div
      class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="text-sm text-gray-600 dark:text-gray-400">Total Records</div>
      <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {dataRecords.length}
      </div>
    </div>
    <div
      class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="text-sm text-gray-600 dark:text-gray-400">
        Filtered Results
      </div>
      <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {filteredRecords.length}
      </div>
    </div>
    <div
      class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="text-sm text-gray-600 dark:text-gray-400">Properties</div>
      <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {Object.keys(properties).length}
      </div>
    </div>
  </div>

  <!-- Required Roles Section -->
  <div class="mb-6">
    <div
      class="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      <button
        onclick={() => (rolesCollapsed = !rolesCollapsed)}
        class="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
      >
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Required Roles for CRUD Operations
          </h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            These roles are required to perform operations on {entityName} records
          </p>
        </div>
        <svg
          class="h-5 w-5 text-gray-500 transition-transform dark:text-gray-400"
          class:rotate-180={!rolesCollapsed}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {#if !rolesCollapsed}
        <div class="border-t border-gray-200 p-6 dark:border-gray-700">
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
                  <p
                    class="mt-1 font-mono text-xs text-gray-500 dark:text-gray-500"
                  >
                    {roleReq.role}
                  </p>
                  <p
                    class="mt-1 flex items-center gap-2 font-mono text-xs text-blue-600 dark:text-blue-400"
                  >
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
                      <div
                        class="max-w-xs text-xs text-red-600 dark:text-red-400"
                      >
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
    </div>
  </div>

  <!-- Search -->
  <div class="mb-6">
    <div class="relative">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search records..."
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

  <!-- Records Table -->
  <div
    class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    {#if filteredRecords.length === 0}
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
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {dataRecords.length === 0 ? "No Records Yet" : "No Matching Records"}
        </h3>
        <p class="mb-4 text-gray-600 dark:text-gray-400">
          {dataRecords.length === 0
            ? "Get started by creating your first record"
            : "Try adjusting your search criteria"}
        </p>
        {#if dataRecords.length === 0}
          <button
            type="button"
            onclick={openCreateModal}
            class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
            Create First Record
          </button>
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900">
            <tr>
              {#each Object.keys(properties).slice(0, 4) as fieldName}
                <th
                  class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  {fieldName}
                </th>
              {/each}
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
            {#each filteredRecords as record, index}
              {@const recordData = getRecordData(record)}
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                {#each Object.keys(properties).slice(0, 4) as fieldName}
                  <td
                    class="max-w-xs truncate px-6 py-4 text-sm text-gray-900 dark:text-gray-100"
                  >
                    {displayValue(recordData[fieldName])}
                  </td>
                {/each}
                <td class="whitespace-nowrap px-6 py-4 text-right text-sm">
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      onclick={() => openViewModal(record)}
                      class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      title="View"
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
                      onclick={() => openEditModal(record)}
                      class="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                      title="Edit"
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onclick={() => handleDelete(record)}
                      class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete"
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
                          d="M19 7l-.867 12.142A2 1 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
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
    {/if}
  </div>
</div>

<!-- Create Modal -->
{#if showCreateModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
  >
    <div
      class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white dark:bg-gray-800"
    >
      <div
        class="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Create New {entityName} Record
        </h2>
        <button
          type="button"
          onclick={closeModals}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg
            class="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleCreate();
        }}
        class="bg-white p-6 dark:bg-gray-800"
      >
        <div class="space-y-4">
          {#each Object.entries(properties) as [fieldName, fieldDef]}
            {@const isRequired = requiredFields.includes(fieldName)}
            {@const inputType = dynamicEntityInputType(fieldDef)}
            <div>
              <label
                for="create-{fieldName}"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {fieldName}
                {#if isRequired}
                  <span class="text-red-600">*</span>
                {/if}
              </label>
              {#if fieldDef.description}
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {fieldDef.description}
                </p>
              {/if}
              {#if fieldDef.type === "DATE_WITH_DAY"}
                <p class="mt-1 text-xs text-blue-600 dark:text-blue-400">
                  Format: YYYY-MM-DD (e.g., 2023-06-15)
                </p>
              {/if}
              {#if inputType === "checkbox"}
                <div class="mt-2">
                  <input
                    type="checkbox"
                    id="create-{fieldName}"
                    bind:checked={formData[fieldName]}
                    class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
              {:else if inputType === "textarea"}
                <textarea
                  id="create-{fieldName}"
                  bind:value={formData[fieldName]}
                  rows="8"
                  placeholder={fieldDef.example
                    ? JSON.stringify(fieldDef.example, null, 2)
                    : '{ }'}
                  class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                ></textarea>
              {:else}
                <input
                  type={inputType}
                  id="create-{fieldName}"
                  bind:value={formData[fieldName]}
                  placeholder={fieldDef.type === "DATE_WITH_DAY"
                    ? "YYYY-MM-DD"
                    : fieldDef.example
                      ? String(fieldDef.example)
                      : ""}
                  pattern={fieldDef.type === "DATE_WITH_DAY"
                    ? "\\d{4}-\\d{2}-\\d{2}"
                    : undefined}
                  step={fieldDef.type === "integer"
                    ? "1"
                    : fieldDef.type === "number"
                      ? "any"
                      : undefined}
                  min={fieldDef.minimum !== undefined
                    ? fieldDef.minimum
                    : undefined}
                  max={fieldDef.maximum !== undefined
                    ? fieldDef.maximum
                    : undefined}
                  class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              {/if}
              {#if validationErrors[fieldName]}
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">
                  {validationErrors[fieldName]}
                </p>
              {/if}
            </div>
          {/each}
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onclick={closeModals}
            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {isSubmitting ? "Creating..." : "Create Record"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal && selectedRecord}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
  >
    <div
      class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white dark:bg-gray-800"
    >
      <div
        class="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Edit Record
        </h2>
        <button
          type="button"
          onclick={closeModals}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg
            class="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleUpdate();
        }}
        class="bg-white p-6 dark:bg-gray-800"
      >
        <div class="space-y-4">
          {#each Object.entries(properties) as [fieldName, fieldDef]}
            {@const isRequired = requiredFields.includes(fieldName)}
            {@const inputType = dynamicEntityInputType(fieldDef)}
            <div>
              <label
                for="edit-{fieldName}"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {fieldName}
                {#if isRequired}
                  <span class="text-red-600">*</span>
                {/if}
              </label>
              {#if fieldDef.description}
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {fieldDef.description}
                </p>
              {/if}
              {#if fieldDef.type === "DATE_WITH_DAY"}
                <p class="mt-1 text-xs text-blue-600 dark:text-blue-400">
                  Format: YYYY-MM-DD (e.g., 2023-06-15)
                </p>
              {/if}
              {#if inputType === "checkbox"}
                <div class="mt-2">
                  <input
                    type="checkbox"
                    id="edit-{fieldName}"
                    bind:checked={formData[fieldName]}
                    class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
              {:else if inputType === "textarea"}
                <textarea
                  id="edit-{fieldName}"
                  bind:value={formData[fieldName]}
                  rows="8"
                  placeholder={fieldDef.example
                    ? JSON.stringify(fieldDef.example, null, 2)
                    : '{ }'}
                  class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                ></textarea>
              {:else}
                <input
                  type={inputType}
                  id="edit-{fieldName}"
                  bind:value={formData[fieldName]}
                  placeholder={fieldDef.type === "DATE_WITH_DAY"
                    ? "YYYY-MM-DD"
                    : fieldDef.example
                      ? String(fieldDef.example)
                      : ""}
                  pattern={fieldDef.type === "DATE_WITH_DAY"
                    ? "\\d{4}-\\d{2}-\\d{2}"
                    : undefined}
                  step={fieldDef.type === "integer"
                    ? "1"
                    : fieldDef.type === "number"
                      ? "any"
                      : undefined}
                  min={fieldDef.minimum !== undefined
                    ? fieldDef.minimum
                    : undefined}
                  max={fieldDef.maximum !== undefined
                    ? fieldDef.maximum
                    : undefined}
                  class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              {/if}
              {#if validationErrors[fieldName]}
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">
                  {validationErrors[fieldName]}
                </p>
              {/if}
            </div>
          {/each}
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onclick={closeModals}
            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {isSubmitting ? "Updating..." : "Update Record"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- View Modal -->
{#if showViewModal && selectedRecord}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
  >
    <div
      class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white dark:bg-gray-800"
    >
      <div
        class="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
          View Record
        </h2>
        <button
          type="button"
          onclick={closeModals}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg
            class="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="bg-white p-6 dark:bg-gray-800">
        <dl class="space-y-4">
          {#each Object.entries(properties) as [fieldName, fieldDef]}
            {@const recordData = getRecordData(selectedRecord)}
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                {fieldName}
                {#if requiredFields.includes(fieldName)}
                  <span class="ml-1 text-xs text-red-600">(Required)</span>
                {/if}
              </dt>
              <dd class="mt-1 whitespace-pre-wrap break-words font-mono text-sm text-gray-900 dark:text-gray-100">
                {properties[fieldName].type === "json" &&
                recordData[fieldName] &&
                typeof recordData[fieldName] === "object"
                  ? JSON.stringify(recordData[fieldName], null, 2)
                  : displayValue(recordData[fieldName])}
              </dd>
            </div>
          {/each}
        </dl>

        <div class="mt-6 flex justify-end">
          <button
            type="button"
            onclick={closeModals}
            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
