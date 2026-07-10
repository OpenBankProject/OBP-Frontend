<script lang="ts">
  import type { PageData } from "./$types";
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

  let entity = $derived(data.entity);

  function getSchema(entity: any): any {
    return entity.schema || null;
  }

  let schema = $derived(getSchema(entity));
  let entityName = $derived(entity.entity_name || "Unknown");

  let properties = $derived<Record<string, DynamicEntityFieldDef>>(
    schema?.properties || {},
  );
  let requiredFields = $derived<string[]>(schema?.required || []);
  let description = $derived(schema?.description || "No description available");

  // Tab state
  let activeTab = $state<"my" | "community" | "public">("my");

  // Records state (mutable for client-side refresh)
  let myRecords = $state(data.myRecords || []);
  let communityRecords = $state(data.communityRecords || []);
  let publicRecords = $state(data.publicRecords || []);

  // Reload data when entity changes (route parameter changes)
  $effect(() => {
    myRecords = data.myRecords || [];
    communityRecords = data.communityRecords || [];
    publicRecords = data.publicRecords || [];
    activeTab = "my";
    searchQuery = "";
    closeModals();
  });

  let isReadOnly = $derived(activeTab !== "my");

  let displayedRecords = $derived.by(() => {
    switch (activeTab) {
      case "my":
        return myRecords;
      case "community":
        return communityRecords;
      case "public":
        return publicRecords;
      default:
        return myRecords;
    }
  });

  let searchQuery = $state("");

  let filteredRecords = $derived(
    displayedRecords.filter((record: any) => {
      if (searchQuery === "") return true;
      const query = searchQuery.toLowerCase();
      const recordString = JSON.stringify(record).toLowerCase();
      return recordString.includes(query);
    }),
  );

  // Record data helpers (same pattern as system CRUD page)
  function getRecordData(record: any): any {
    if (!record) return record;
    if (
      entityName &&
      record[entityName] &&
      typeof record[entityName] === "object"
    ) {
      return record[entityName];
    }
    return record;
  }

  function getRecordIdField(record: any): string | null {
    if (!record) return null;
    const recordData = getRecordData(record);
    const keys = Object.keys(recordData);
    const idField = keys.find((key) => key.endsWith("_id"));
    if (idField) return idField;
    if (keys.includes("id")) return "id";
    return null;
  }

  function getRecordId(record: any): string | null {
    const recordData = getRecordData(record);
    const idField = getRecordIdField(recordData);
    return idField ? recordData[idField] : null;
  }

  // Modal state
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showViewModal = $state(false);
  let selectedRecord: any = $state(null);
  let isSubmitting = $state(false);

  // Form data
  let formData: Record<string, any> = $state({});
  let validationErrors: Record<string, string> = $state({});

  // Schema info collapsible
  let schemaCollapsed = $state(true);

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

  // Extract records from response (client-side refetch)
  function extractRecords(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }
    const snakeCaseKey = `${entityName.toLowerCase()}_list`;
    return (
      response.data ||
      response.records ||
      response[entityName] ||
      response[snakeCaseKey] ||
      []
    );
  }

  async function refetchMyRecords() {
    try {
      const response = await fetch(
        `/proxy/obp/dynamic-entity/my/${entityName}`,
        { credentials: "include" },
      );
      if (response.ok) {
        const refetchData = await response.json();
        myRecords = extractRecords(refetchData);
      }
    } catch (err) {
      console.error("Error refetching my records:", err);
    }
  }

  async function handleCreate() {
    if (!validateAllFields()) {
      alert("Please fix validation errors");
      return;
    }

    isSubmitting = true;

    try {
      const convertedData = convertDynamicEntityFormData(properties, formData);

      const response = await fetch(
        `/proxy/obp/dynamic-entity/my/${entityName}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(convertedData),
        },
      );

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to create record",
        );
        throw new Error(formatErrorForDisplay(errorDetails));
      }

      await response.json();
      await refetchMyRecords();

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
        `/proxy/obp/dynamic-entity/my/${entityName}/${recordId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(convertedData),
        },
      );

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to update record",
        );
        throw new Error(formatErrorForDisplay(errorDetails));
      }

      await response.json();
      await refetchMyRecords();

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
        `/proxy/obp/dynamic-entity/my/${entityName}/${recordId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to delete record",
        );
        throw new Error(formatErrorForDisplay(errorDetails));
      }

      await refetchMyRecords();

      alert("Record deleted successfully");
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to delete record";
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
</script>

<svelte:head>
  <title>{entityName} - Personal Dynamic Entity - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <!-- Breadcrumb -->
  <div class="mb-6">
    <div class="flex items-center gap-2 text-sm">
      <a
        href="/dynamic-entities/personal"
        class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Personal Dynamic Entities
      </a>
      <span class="text-gray-400">/</span>
      <span class="text-gray-600 dark:text-gray-400">{entityName}</span>
    </div>
  </div>

  <!-- Header -->
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        {entityName}
      </h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        {description}
      </p>
      {#if entity.bank_id}
        <span
          class="mt-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
        >
          Bank: {entity.bank_id}
        </span>
      {:else}
        <span
          class="mt-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400"
        >
          System-level
        </span>
      {/if}
    </div>
    {#if activeTab === "my"}
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
    {/if}
  </div>

  <!-- Tab Bar -->
  <div class="mb-4 border-b border-gray-200 dark:border-gray-700">
    <nav class="-mb-px flex gap-4" aria-label="Scope tabs">
      <button
        type="button"
        onclick={() => (activeTab = "my")}
        class="flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors {activeTab === 'my'
          ? 'border-green-500 text-green-600 dark:text-green-400'
          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
      >
        My Records
        <span
          class="rounded-full px-2 py-0.5 text-xs font-medium {activeTab === 'my'
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}"
        >
          {myRecords.length}
        </span>
      </button>

      <button
        type="button"
        onclick={() => (activeTab = "community")}
        class="flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors {activeTab === 'community'
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
      >
        Community Records
        <span
          class="rounded-full px-2 py-0.5 text-xs font-medium {activeTab === 'community'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}"
        >
          {communityRecords.length}
        </span>
      </button>

      <button
        type="button"
        onclick={() => (activeTab = "public")}
        class="flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors {activeTab === 'public'
          ? 'border-purple-500 text-purple-600 dark:text-purple-400'
          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
      >
        Public Records
        <span
          class="rounded-full px-2 py-0.5 text-xs font-medium {activeTab === 'public'
            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}"
        >
          {publicRecords.length}
        </span>
      </button>
    </nav>
  </div>

  <!-- Scope Banner -->
  <div class="mb-4">
    {#if activeTab === "my"}
      <div
        class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-900/20"
      >
        <p class="text-sm text-green-800 dark:text-green-300">
          Showing your personal records. You can create, edit, and delete.
        </p>
      </div>
    {:else if activeTab === "community"}
      <div
        class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-900/20"
      >
        <p class="text-sm text-blue-800 dark:text-blue-300">
          Showing all users' records (read-only). Requires community access role.
        </p>
      </div>
    {:else if activeTab === "public"}
      <div
        class="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-800 dark:bg-purple-900/20"
      >
        <p class="text-sm text-purple-800 dark:text-purple-300">
          Showing publicly accessible records (read-only). No authentication required.
        </p>
      </div>
    {/if}
  </div>

  <!-- Scope Errors -->
  {#if activeTab === "my" && data.myError}
    <div
      class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
    >
      <p class="text-sm text-red-700 dark:text-red-400">{data.myError}</p>
    </div>
  {/if}
  {#if activeTab === "community" && data.communityError}
    <div
      class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
    >
      <p class="text-sm text-red-700 dark:text-red-400">{data.communityError}</p>
    </div>
  {/if}
  {#if activeTab === "public" && data.publicError}
    <div
      class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
    >
      <p class="text-sm text-red-700 dark:text-red-400">{data.publicError}</p>
    </div>
  {/if}

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
          {displayedRecords.length === 0
            ? "No Records"
            : "No Matching Records"}
        </h3>
        <p class="mb-4 text-gray-600 dark:text-gray-400">
          {displayedRecords.length === 0
            ? activeTab === "my"
              ? "Get started by creating your first record"
              : "No records available in this scope"
            : "Try adjusting your search criteria"}
        </p>
        {#if displayedRecords.length === 0 && activeTab === "my"}
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
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                ID
              </th>
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
            {#each filteredRecords as record}
              {@const recordData = getRecordData(record)}
              {@const recordId = getRecordId(record)}
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td
                  class="max-w-xs truncate px-6 py-4 font-mono text-sm text-gray-600 dark:text-gray-400"
                >
                  {recordId || "-"}
                </td>
                {#each Object.keys(properties).slice(0, 4) as fieldName}
                  <td
                    class="max-w-xs truncate px-6 py-4 text-sm text-gray-900 dark:text-gray-100"
                  >
                    {recordData[fieldName] !== undefined &&
                    recordData[fieldName] !== null
                      ? String(recordData[fieldName])
                      : "-"}
                  </td>
                {/each}
                <td class="whitespace-nowrap px-6 py-4 text-right text-sm">
                  <div class="flex justify-end gap-2">
                    <!-- View button (all tabs) -->
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
                    {#if !isReadOnly}
                      <!-- Edit button (My tab only) -->
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
                      <!-- Delete button (My tab only) -->
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Schema Info (Collapsible) -->
  <div class="mt-6">
    <div
      class="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      <button
        onclick={() => (schemaCollapsed = !schemaCollapsed)}
        class="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
      >
        <div>
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
        <svg
          class="h-5 w-5 text-gray-500 transition-transform dark:text-gray-400"
          class:rotate-180={!schemaCollapsed}
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
      {#if !schemaCollapsed}
        <div class="border-t border-gray-200 dark:border-gray-700">
          <div class="divide-y divide-gray-200 dark:divide-gray-700">
            {#each Object.entries(properties) as [fieldName, fieldDef]}
              {@const fieldDefTyped = fieldDef as any}
              {@const isRequired = requiredFields.includes(fieldName)}
              <div class="px-6 py-4">
                <div class="flex items-center gap-2">
                  <span
                    class="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    {fieldName}
                  </span>
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
                </div>
                {#if fieldDefTyped.description}
                  <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {fieldDefTyped.description}
                  </p>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
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
          Create New Record
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
          {#if isReadOnly}
            <span class="ml-2 text-sm font-normal text-gray-500">(read-only)</span>
          {/if}
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
          <div>
            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
              ID
            </dt>
            <dd class="mt-1 font-mono text-sm text-gray-600 dark:text-gray-400">
              {getRecordId(selectedRecord) || "-"}
            </dd>
          </div>
          {#each Object.entries(properties) as [fieldName, fieldDef]}
            {@const recordData = getRecordData(selectedRecord)}
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
                {fieldName}
                {#if requiredFields.includes(fieldName)}
                  <span class="ml-1 text-xs text-red-600">(Required)</span>
                {/if}
              </dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {recordData[fieldName] !== undefined &&
                recordData[fieldName] !== null
                  ? String(recordData[fieldName])
                  : "-"}
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
