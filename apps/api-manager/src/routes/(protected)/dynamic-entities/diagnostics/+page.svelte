<script lang="ts">
  import type { PageData } from "./$types";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";

  let { data } = $props();

  let userEntitlements = $derived(data.userEntitlements || []);

  let hasSystemReadRole = $derived(
    userEntitlements.some((ent: any) => ent.role_name === "CanGetSystemLevelDynamicEntities")
  );
  let hasBankReadRole = $derived(
    userEntitlements.some((ent: any) =>
      ent.role_name === "CanGetBankLevelDynamicEntities" && ent.bank_id === currentBank.bankId
    )
  );

  // Level selector - default based on which role the user has
  let diagnosticLevel = $state<"system" | "bank">("system");
  let initialLevelSet = false;
  $effect(() => {
    if (!initialLevelSet && userEntitlements.length > 0) {
      if (hasSystemReadRole) diagnosticLevel = "system";
      else if (hasBankReadRole) diagnosticLevel = "bank";
      initialLevelSet = true;
    }
  });

  // System diagnostics from server (already filtered by role on server)
  const systemDiagnostics = $derived(
    diagnosticLevel === "system"
      ? (data.diagnostics || []).map((d: any) => ({ ...d, _level: "System" }))
      : []
  );

  const orphanedEntities = $derived(diagnosticLevel === "system" ? (data.orphanedEntities || []) : []);

  // Bank-level dynamic entities (fetched client-side based on current bank)
  let bankDiagnostics = $state<any[]>([]);
  let bankLoading = $state(false);
  let bankError = $state<string | null>(null);

  $effect(() => {
    const bankId = currentBank.bankId;
    if (diagnosticLevel === "bank" && bankId && hasBankReadRole) {
      fetchBankEntities(bankId);
    } else {
      bankDiagnostics = [];
      bankError = null;
    }
  });

  async function fetchBankEntities(bankId: string) {
    bankLoading = true;
    bankError = null;
    try {
      const response = await trackedFetch(`/proxy/obp/v6.0.0/management/banks/${bankId}/dynamic-entities`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch bank-level dynamic entities");
      }
      const entities = (result.dynamic_entities || []).sort((a: any, b: any) => {
        const nameA = (a.entity_name || "").toLowerCase();
        const nameB = (b.entity_name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
      // Transform bank entities into diagnostics format
      bankDiagnostics = entities.map((entity: any) => ({
        dynamic_entity_id: entity.dynamic_entity_id,
        entityName: entity.entity_name || "Unknown",
        recordCount: entity.record_count ?? 0,
        schema: entity.schema || null,
        responseKeys: [],
        triedKeys: [],
        rawResponse: undefined,
        _level: "Bank",
      }));
    } catch (err) {
      bankError = err instanceof Error ? err.message : "Failed to fetch bank entities";
      bankDiagnostics = [];
    } finally {
      bankLoading = false;
    }
  }

  // Diagnostics for selected level
  const activeDiagnostics = $derived(
    diagnosticLevel === "system" ? systemDiagnostics : bankDiagnostics
  );

  const totalEntities = $derived(activeDiagnostics.length);
  const totalRecords = $derived(activeDiagnostics.reduce((sum: number, d: any) => sum + d.recordCount, 0));

  let searchQuery = $state("");
  let copiedId = $state<string | null>(null);
  let cleaningUp = $state(false);
  let cleanupResult = $state<{ deleted_orphaned_entities: any[]; total_records_deleted: number } | null>(null);
  let cleanupError = $state<string | null>(null);
  let showCleanupConfirm = $state(false);

  async function handleCleanup() {
    showCleanupConfirm = false;
    cleaningUp = true;
    cleanupError = null;
    cleanupResult = null;

    try {
      const response = await fetch("/proxy/obp/v6.0.0/management/diagnostics/dynamic-entities/orphaned-records", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        cleanupError = data.message ?? `HTTP ${response.status}`;
        return;
      }

      cleanupResult = data;
    } catch (err: any) {
      cleanupError = err?.message || "Failed to clean up orphaned records";
    } finally {
      cleaningUp = false;
    }
  }

  const filteredDiagnostics = $derived(
    activeDiagnostics.filter((diag: any) => {
      if (searchQuery === "") return true;

      const query = searchQuery.toLowerCase();
      return (
        diag.entityName.toLowerCase().includes(query) ||
        diag.dynamic_entity_id.toLowerCase().includes(query)
      );
    }),
  );

  function getStatusColor(diag: any): string {
    if (diag.error) return "text-red-600 dark:text-red-400";
    if (diag.recordCount === 0) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  }

  function getStatusBadgeColor(diag: any): string {
    if (diag.error)
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    if (diag.recordCount === 0)
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  }

  function getStatusText(diag: any): string {
    if (diag.error) return "Error";
    if (diag.recordCount === 0) return "No Records";
    return "Has Data";
  }

  function getPropertyCount(schema: any): number {
    return schema?.properties ? Object.keys(schema.properties).length : 0;
  }

  async function copyDiagnostic(diag: any) {
    const diagnosticText = `
Entity: ${diag.entityName}
Level: ${diagnosticLevel === "system" ? "System" : "Bank"}
ID: ${diag.dynamic_entity_id}
Record Count: ${diag.error ? "Unknown" : diag.recordCount}
${diag.error ? `Error: ${diag.error}` : ""}
${diag.responseKeys?.length ? `Response Keys: ${diag.responseKeys.join(", ")}` : ""}
${diag.triedKeys?.length ? `Tried Keys: ${diag.triedKeys.join(", ")}` : ""}
`.trim();

    try {
      await navigator.clipboard.writeText(diagnosticText);
      copiedId = diag.dynamic_entity_id;
      setTimeout(() => {
        copiedId = null;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }
</script>

<svelte:head>
  <title>Dynamic Entity Diagnostics - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
      Dynamic Entity Diagnostics
    </h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">
      {#if diagnosticLevel === "system"}
        Diagnostics for system-wide dynamic entities
      {:else}
        Diagnostics for bank-level dynamic entities{#if currentBank.bank} at {currentBank.bank.full_name || currentBank.bankId}{/if}
      {/if}
    </p>
  </div>

<!-- Level Selector -->
<div class="mb-6">
  <fieldset>
    <legend class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Level</legend>
    <div class="flex items-center gap-6">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="diagnosticLevel"
          value="system"
          bind:group={diagnosticLevel}
          class="h-4 w-4 text-blue-600 focus:ring-blue-500"
        />
        <span class="text-sm text-gray-900 dark:text-gray-100">System</span>
      </label>
      <label class="flex items-center gap-2 {currentBank.bankId ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}">
        <input
          type="radio"
          name="diagnosticLevel"
          value="bank"
          bind:group={diagnosticLevel}
          disabled={!currentBank.bankId}
          class="h-4 w-4 text-blue-600 focus:ring-blue-500"
        />
        <span class="text-sm text-gray-900 dark:text-gray-100">
          Bank{#if currentBank.bank} ({currentBank.bank.full_name || currentBank.bank.short_name || currentBank.bankId}){/if}
        </span>
      </label>
    </div>
  </fieldset>
</div>

<!-- Role Check -->
{#if diagnosticLevel === "system" && !hasSystemReadRole}
  <MissingRoleAlert
    roles={["CanGetSystemLevelDynamicEntities"]}
    message="You need this role to view system-level dynamic entity diagnostics"
  />
{/if}
{#if diagnosticLevel === "bank" && currentBank.bankId && !hasBankReadRole}
  <MissingRoleAlert
    roles={["CanGetBankLevelDynamicEntities"]}
    bankId={currentBank.bankId}
    message="You need this role to view bank-level dynamic entity diagnostics for {currentBank.bank?.full_name || currentBank.bankId}"
  />
{/if}

<!-- Summary Cards -->
<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
  <!-- Total Entities -->
  <div
    class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
          Total Entities
        </p>
        <p class="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">
          {#if diagnosticLevel === "bank" && bankLoading}
            <span class="text-sm text-gray-400">...</span>
          {:else}
            {totalEntities}
          {/if}
        </p>
      </div>
      <svg
        class="h-12 w-12 text-blue-500"
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
    </div>
  </div>

  <!-- Total Records -->
  <div
    class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
          Total Records
        </p>
        <p class="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">
          {#if diagnosticLevel === "bank" && bankLoading}
            <span class="text-sm text-gray-400">...</span>
          {:else}
            {totalRecords}
          {/if}
        </p>
      </div>
      <svg
        class="h-12 w-12 text-green-500"
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
    </div>
  </div>

  <!-- Entities with Data -->
  <div
    class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
          With Data
        </p>
        <p class="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">
          {#if diagnosticLevel === "bank" && bankLoading}
            <span class="text-sm text-gray-400">...</span>
          {:else}
            {activeDiagnostics.filter((d: any) => d.recordCount > 0 && !d.error).length}
          {/if}
        </p>
      </div>
      <svg
        class="h-12 w-12 text-green-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </div>
  </div>
</div>

<!-- Bank loading indicator -->
{#if diagnosticLevel === "bank" && bankLoading}
  <div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
    <p class="text-sm text-blue-700 dark:text-blue-400">
      Loading bank-level entities for {currentBank.bank?.full_name || currentBank.bankId}...
    </p>
  </div>
{/if}

<!-- Orphaned Entities -->
{#if orphanedEntities.length > 0}
  <div class="mb-6 rounded-lg border-2 border-yellow-400 bg-yellow-50 shadow-sm dark:border-yellow-600 dark:bg-yellow-900/20">
    <div class="border-b border-yellow-300 p-4 dark:border-yellow-700">
      <div class="flex items-center gap-2">
        <svg class="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h2 class="text-lg font-semibold text-yellow-800 dark:text-yellow-200">
          Orphaned Entities ({orphanedEntities.length})
        </h2>
      </div>
      <p class="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
        Data records whose Dynamic Entity definition has been deleted. These records still exist in the database but have no schema and cannot be accessed via the API.
      </p>
    </div>
    <div class="p-4">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-yellow-300 dark:divide-yellow-700">
          <thead>
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-yellow-700 dark:text-yellow-300">Entity Name</th>
              <th class="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-yellow-700 dark:text-yellow-300">Bank ID</th>
              <th class="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-yellow-700 dark:text-yellow-300">Record Count</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-yellow-200 dark:divide-yellow-800">
            {#each orphanedEntities as orphan}
              <tr class="hover:bg-yellow-100 dark:hover:bg-yellow-900/30">
                <td class="whitespace-nowrap px-4 py-3 text-sm font-mono font-semibold text-yellow-900 dark:text-yellow-100">
                  {orphan.entity_name}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-sm font-mono text-yellow-800 dark:text-yellow-200">
                  {orphan.bank_id || ""}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-right text-sm font-mono font-semibold text-yellow-900 dark:text-yellow-100">
                  {orphan.record_count}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Cleanup Button -->
      <div class="border-t border-yellow-300 p-4 dark:border-yellow-700">
        {#if showCleanupConfirm}
          <div class="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-900/20">
            <p class="mb-3 text-sm font-medium text-red-800 dark:text-red-200">
              Are you sure you want to delete all orphaned records? This will permanently remove {orphanedEntities.reduce((sum: number, o: any) => sum + (o.record_count || 0), 0)} record(s) across {orphanedEntities.length} orphaned entit{orphanedEntities.length === 1 ? 'y' : 'ies'}.
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                onclick={handleCleanup}
                class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Yes, Delete Orphaned Records
              </button>
              <button
                type="button"
                onclick={() => showCleanupConfirm = false}
                class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        {:else}
          <button
            type="button"
            onclick={() => showCleanupConfirm = true}
            disabled={cleaningUp}
            class="inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
          >
            {#if cleaningUp}
              <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Cleaning up...
            {:else}
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clean Up Orphaned Records
            {/if}
          </button>
        {/if}

        <!-- Cleanup Result -->
        {#if cleanupResult}
          <div class="mt-4 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-900/20">
            <div class="flex items-center gap-2 mb-2">
              <svg class="h-5 w-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-sm font-semibold text-green-800 dark:text-green-200">
                Cleanup complete: {cleanupResult.total_records_deleted} record(s) deleted
              </p>
            </div>
            {#if cleanupResult.deleted_orphaned_entities && cleanupResult.deleted_orphaned_entities.length > 0}
              <div class="mt-2 overflow-x-auto">
                <table class="min-w-full divide-y divide-green-300 dark:divide-green-700">
                  <thead>
                    <tr>
                      <th class="px-3 py-1.5 text-left text-xs font-medium uppercase text-green-700 dark:text-green-300">Entity Name</th>
                      <th class="px-3 py-1.5 text-right text-xs font-medium uppercase text-green-700 dark:text-green-300">Records Deleted</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-green-200 dark:divide-green-800">
                    {#each cleanupResult.deleted_orphaned_entities as deleted}
                      <tr>
                        <td class="whitespace-nowrap px-3 py-2 text-sm font-mono text-green-900 dark:text-green-100">{deleted.entity_name}</td>
                        <td class="whitespace-nowrap px-3 py-2 text-right text-sm font-mono text-green-900 dark:text-green-100">{deleted.records_deleted}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Cleanup Error -->
        {#if cleanupError}
          <div class="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-900/20">
            <div class="flex items-center gap-2">
              <svg class="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-sm font-medium text-red-800 dark:text-red-200">{cleanupError}</p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{:else}
  <div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
    <div class="flex items-center gap-2">
      <svg class="h-5 w-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-sm font-medium text-green-800 dark:text-green-200">No orphaned entities detected.</p>
    </div>
  </div>
{/if}

<!-- Search -->
<div class="mb-6">
  <input
    type="text"
    bind:value={searchQuery}
    placeholder="Search by entity name, ID, or level..."
    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400"
  />
</div>

<!-- Entity List -->
{#if filteredDiagnostics && filteredDiagnostics.length > 0}
  <div class="space-y-4">
    {#each filteredDiagnostics as diag (diag._level + '-' + diag.dynamic_entity_id)}
      <div
        class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <!-- Header -->
        <div class="mb-4 flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-3">
              <h2
                class="text-xl font-semibold text-gray-900 dark:text-gray-100"
              >
                {diag.entityName}
              </h2>
              <span
                class="rounded-full px-3 py-1 text-xs font-medium {getStatusBadgeColor(
                  diag,
                )}"
              >
                {getStatusText(diag)}
              </span>
            </div>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              ID: {diag.dynamic_entity_id}
            </p>
          </div>
          <div class="flex items-start gap-4">
            <button
              type="button"
              onclick={() => copyDiagnostic(diag)}
              class="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Copy diagnostic info"
            >
              {#if copiedId === diag.dynamic_entity_id}
                <svg
                  class="h-5 w-5 text-green-600 dark:text-green-400"
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
              {:else}
                <svg
                  class="h-5 w-5 text-gray-600 dark:text-gray-400"
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
            <div class="text-right">
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
                Record Count
              </p>
              <p class="text-3xl font-bold {getStatusColor(diag)}">
                {diag.error ? "Unknown" : diag.recordCount}
              </p>
            </div>
          </div>
        </div>

        <!-- Details -->
        <div
          class="grid grid-cols-1 gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50 sm:grid-cols-2"
        >
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              Schema Properties
            </p>
            <p
              class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              {getPropertyCount(diag.schema)}
            </p>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              Status
            </p>
            <div class="mt-1">
              {#if diag.error}
                <p class="text-sm font-semibold {getStatusColor(diag)}">
                  {diag.error}
                </p>
                {#if diag.responseKeys && diag.responseKeys.length > 0}
                  <p class="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    <strong>Response keys:</strong>
                    {diag.responseKeys.join(", ")}
                  </p>
                {/if}
                {#if diag.triedKeys && diag.triedKeys.length > 0}
                  <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    <strong>Tried keys:</strong>
                    {diag.triedKeys.join(", ")}
                  </p>
                {/if}
              {:else if diag.recordCount === 0}
                <p class="text-sm font-semibold {getStatusColor(diag)}">
                  No records found
                </p>
              {:else}
                <p class="text-lg font-semibold {getStatusColor(diag)}">
                  {diag.recordCount} record{diag.recordCount !== 1 ? "s" : ""}
                </p>
              {/if}
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="mt-4 flex gap-2">
          <a
            href="/dynamic-entities/system/{diag.dynamic_entity_id}/crud"
            class="rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
          >
            View CRUD
          </a>
          <a
            href="/dynamic-entities/system/{diag.dynamic_entity_id}"
            class="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            View Definition
          </a>
        </div>

        <!-- Raw API Response -->
        {#if diag.rawResponse}
          <div class="mt-4">
            <details class="group">
              <summary
                class="list-none cursor-pointer rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                <span class="inline-flex items-center gap-2">
                  <svg
                    class="h-4 w-4 transition-transform group-open:rotate-90"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  Show Raw API Response
                </span>
              </summary>
              <div
                class="mt-2 overflow-auto max-h-96 rounded-lg bg-gray-50 p-4 dark:bg-gray-900"
              >
                <pre class="whitespace-pre-wrap break-words text-xs"><code
                    class="text-gray-900 dark:text-gray-100"
                    >{JSON.stringify(diag.rawResponse, null, 2)}</code
                  ></pre>
              </div>
            </details>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{:else if searchQuery}
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
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
    <p class="mb-2 text-lg font-medium text-gray-700 dark:text-gray-300">
      No results found
    </p>
    <p class="text-gray-600 dark:text-gray-400">
      No entities match your search criteria.
    </p>
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
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
      />
    </svg>
    <p class="mb-2 text-lg font-medium text-gray-700 dark:text-gray-300">
      No dynamic entities found
    </p>
    <p class="text-gray-600 dark:text-gray-400">
      No dynamic entities available. Check that you have the required roles.
    </p>
  </div>
{/if}

<!-- Raw Data View -->
<div
  class="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
>
  <div class="border-b border-gray-200 p-6 dark:border-gray-700">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
      Raw Diagnostics Data
    </h2>
    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
      Complete diagnostics data in JSON format for debugging
    </p>
  </div>
  <div class="p-6">
    <div class="overflow-auto max-h-[600px]">
      <pre
        class="whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-4 text-xs dark:bg-gray-900"><code
          class="text-gray-900 dark:text-gray-100"
          >{JSON.stringify(
            { level: diagnosticLevel, diagnostics: activeDiagnostics, totalEntities, totalRecords, orphanedEntities },
            null,
            2,
          )}</code
        ></pre>
    </div>
  </div>
</div>
</div>

<style>
  summary::-webkit-details-marker {
    display: none;
  }
  summary::marker {
    display: none;
  }
</style>
