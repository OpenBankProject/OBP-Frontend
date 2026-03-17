<script lang="ts">
  import type { PageData } from "./$types";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import { invalidateAll } from "$app/navigation";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { pageDataSummary } from "$lib/stores/pageDataSummary.svelte";
  import { pageHeading } from "$lib/stores/pageHeading.svelte";

  let { data }: { data: PageData } = $props();

  let bank = $derived(data.bank);

  $effect(() => {
    if (bank) {
      const attrs = bank.bank_attributes?.length || 0;
      pageDataSummary.set(`Viewing bank ${bank.full_name} (${bank.bank_id}, code: ${bank.bank_code})${attrs ? `, ${attrs} attributes` : ""}`);
      pageHeading.set(bank.full_name);
    }
  });

  // Set current bank if not already this bank
  $effect(() => {
    if (bank && bank.bank_id !== currentBank.bankId) {
      currentBank.select(bank);
    }
  });

  // Add attribute form state
  let showAddAttribute = $state(false);
  let attrName = $state("");
  let attrType = $state("STRING");
  let attrValue = $state("");
  let attrIsActive = $state(true);
  let isSubmittingAttr = $state(false);

  function resetAttrForm() {
    attrName = "";
    attrType = "STRING";
    attrValue = "";
    attrIsActive = true;
    showAddAttribute = false;
  }

  async function handleAddAttribute(event: Event) {
    event.preventDefault();

    if (!attrName.trim()) {
      toast.error("Validation Error", "Attribute name is required");
      return;
    }

    isSubmittingAttr = true;

    try {
      const response = await trackedFetch(`/api/banks/${bank.bank_id}/attributes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: attrName.trim(),
          type: attrType,
          value: attrValue.trim(),
          is_active: attrIsActive,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create attribute");
      }

      toast.success("Attribute Created", `Successfully created attribute "${attrName}"`);
      resetAttrForm();
      await invalidateAll();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create attribute";
      toast.error("Error", errorMessage);
    } finally {
      isSubmittingAttr = false;
    }
  }
</script>

<svelte:head>
  <title>{bank.full_name || bank.bank_id} - Banks - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <!-- Breadcrumb -->
  <div class="mb-6">
    <div class="flex items-center gap-2 text-sm">
      <a
        href="/banks"
        class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Banks
      </a>
      <span class="text-gray-400">/</span>
      <span class="text-gray-600 dark:text-gray-400">{bank.bank_id}</span>
    </div>
  </div>

  <!-- Header -->
  <div class="mb-6 flex items-start gap-6">
    {#if bank.logo && !bank.logo.includes('example.com')}
      <img
        src={bank.logo}
        alt="{bank.full_name} logo"
        class="h-16 w-16 rounded-lg object-contain"
        onerror={(e) => {
          const target = e.currentTarget as HTMLImageElement;
          target.style.display = 'none';
          target.nextElementSibling?.classList.remove('hidden');
        }}
      />
      <svg
        class="hidden h-16 w-16 rounded-lg bg-gray-100 p-3 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    {:else}
      <svg
        class="h-16 w-16 rounded-lg bg-gray-100 p-3 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    {/if}
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        {bank.full_name || bank.bank_id}
      </h1>
      <p class="mt-1 font-mono text-sm text-gray-500 dark:text-gray-400">
        {bank.bank_id}
      </p>
      {#if bank.bank_code}
        <span
          class="mt-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
        >
          Code: {bank.bank_code}
        </span>
      {/if}
    </div>
  </div>

  <!-- Description -->
  <p class="mb-6 text-sm text-gray-600 dark:text-gray-400">
    In the Open Bank Project, a Bank acts as a tenancy boundary. Many permissions, accounts, products, and other operations are scoped at the bank level.
  </p>

  <!-- Bank Details & Routings (side by side) -->
  <div class="mb-6 grid gap-6 lg:grid-cols-2">
    <!-- Details -->
    <div class="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div class="border-b border-gray-200 px-6 py-3 dark:border-gray-700">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Details
        </h2>
      </div>
      <div class="divide-y divide-gray-200 dark:divide-gray-700">
        <div class="flex gap-4 px-6 py-3">
          <dt class="w-24 flex-shrink-0 text-sm text-gray-500 dark:text-gray-400">Bank ID</dt>
          <dd class="font-mono text-sm text-gray-900 dark:text-gray-100">{bank.bank_id || "-"}</dd>
        </div>
        <div class="flex gap-4 px-6 py-3">
          <dt class="w-24 flex-shrink-0 text-sm text-gray-500 dark:text-gray-400">Full Name</dt>
          <dd class="text-sm text-gray-900 dark:text-gray-100">{bank.full_name || "-"}</dd>
        </div>
        <div class="flex gap-4 px-6 py-3">
          <dt class="w-24 flex-shrink-0 text-sm text-gray-500 dark:text-gray-400">Bank Code</dt>
          <dd class="text-sm text-gray-900 dark:text-gray-100">{bank.bank_code || "-"}</dd>
        </div>
        <div class="flex gap-4 px-6 py-3">
          <dt class="w-24 flex-shrink-0 text-sm text-gray-500 dark:text-gray-400">Website</dt>
          <dd class="text-sm">
            {#if bank.website}
              <a
                href={bank.website}
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                {bank.website}
              </a>
            {:else}
              <span class="text-gray-400">-</span>
            {/if}
          </dd>
        </div>
      </div>
    </div>

    <!-- Routings -->
    <div class="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div class="border-b border-gray-200 px-6 py-3 dark:border-gray-700">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Bank Routings
          <span class="ml-1 font-normal">({bank.bank_routings?.length || 0})</span>
        </h2>
      </div>
      {#if bank.bank_routings && bank.bank_routings.length > 0}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th class="px-6 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Scheme</th>
                <th class="px-6 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Address</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {#each bank.bank_routings as routing}
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td class="whitespace-nowrap px-6 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{routing.scheme || "-"}</td>
                  <td class="px-6 py-3 font-mono text-sm text-gray-700 dark:text-gray-300">{routing.address || "-"}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No bank routings available.
        </div>
      {/if}
    </div>
  </div>

  <!-- Related Pages & Attributes (side by side) -->
  <div class="mb-6 grid gap-6 lg:grid-cols-2">
    <!-- Related Pages -->
    <div class="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div class="border-b border-gray-200 px-6 py-3 dark:border-gray-700">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Related Pages
        </h2>
      </div>
      <div class="grid grid-cols-2 gap-3 p-4">
        <a
          href="/account-access/accounts?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
        >
          <svg class="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <span class="text-sm font-medium text-gray-900 group-hover:text-blue-700 dark:text-gray-100 dark:group-hover:text-blue-300">Accounts</span>
        </a>

        <a
          href="/products?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
        >
          <svg class="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span class="text-sm font-medium text-gray-900 group-hover:text-blue-700 dark:text-gray-100 dark:group-hover:text-blue-300">API Products</span>
        </a>

        <a
          href="/products/financial?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
        >
          <svg class="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span class="text-sm font-medium text-gray-900 group-hover:text-blue-700 dark:text-gray-100 dark:group-hover:text-blue-300">Financial Products</span>
        </a>

        <a
          href="/dynamic-endpoints/bank?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
        >
          <svg class="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span class="text-sm font-medium text-gray-900 group-hover:text-blue-700 dark:text-gray-100 dark:group-hover:text-blue-300">Dynamic Endpoints</span>
        </a>

        <a
          href="/rbac/entitlements?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
        >
          <svg class="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <span class="text-sm font-medium text-gray-900 group-hover:text-blue-700 dark:text-gray-100 dark:group-hover:text-blue-300">Entitlements</span>
        </a>

        <a
          href="/account-access/system-views?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
        >
          <svg class="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span class="text-sm font-medium text-gray-900 group-hover:text-blue-700 dark:text-gray-100 dark:group-hover:text-blue-300">System Views</span>
        </a>

        <a
          href="/account-access/account-directory?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
        >
          <svg class="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span class="text-sm font-medium text-gray-900 group-hover:text-blue-700 dark:text-gray-100 dark:group-hover:text-blue-300">Account Directory</span>
        </a>

        <a
          href="/banks/fx-rates?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
        >
          <svg class="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          <span class="text-sm font-medium text-gray-900 group-hover:text-blue-700 dark:text-gray-100 dark:group-hover:text-blue-300">FX Rates</span>
        </a>
      </div>
    </div>

    <!-- Attributes -->
    <div class="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div class="flex items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-gray-700">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Attributes
          <span class="ml-1 font-normal">({bank.attributes?.length || 0})</span>
        </h2>
        <button
          type="button"
          onclick={() => (showAddAttribute = !showAddAttribute)}
          class="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <svg class="mr-1 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {#if showAddAttribute}
        <form onsubmit={handleAddAttribute} class="border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label for="attr-name" class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Name <span class="text-red-600">*</span>
              </label>
              <input
                id="attr-name"
                type="text"
                bind:value={attrName}
                placeholder="e.g., ISIN"
                disabled={isSubmittingAttr}
                required
                class="mt-1 block w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
              />
            </div>
            <div>
              <label for="attr-type" class="block text-xs font-medium text-gray-700 dark:text-gray-300">Type</label>
              <select
                id="attr-type"
                bind:value={attrType}
                disabled={isSubmittingAttr}
                class="mt-1 block w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50"
              >
                <option value="STRING">STRING</option>
                <option value="INTEGER">INTEGER</option>
                <option value="DOUBLE">DOUBLE</option>
                <option value="DATE_WITH_DAY">DATE_WITH_DAY</option>
              </select>
            </div>
            <div>
              <label for="attr-value" class="block text-xs font-medium text-gray-700 dark:text-gray-300">Value</label>
              <input
                id="attr-value"
                type="text"
                bind:value={attrValue}
                placeholder="Attribute value"
                disabled={isSubmittingAttr}
                class="mt-1 block w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
              />
            </div>
            <div class="flex items-end gap-3">
              <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  bind:checked={attrIsActive}
                  disabled={isSubmittingAttr}
                  class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Active
              </label>
              <div class="ml-auto flex gap-2">
                <button
                  type="button"
                  onclick={resetAttrForm}
                  disabled={isSubmittingAttr}
                  class="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAttr}
                  class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {isSubmittingAttr ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </div>
        </form>
      {/if}

      {#if bank.attributes && bank.attributes.length > 0}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th class="px-6 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</th>
                <th class="px-6 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Value</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {#each bank.attributes as attribute}
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td class="whitespace-nowrap px-6 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {attribute.name || attribute.bank_attribute_name || "-"}
                  </td>
                  <td class="px-6 py-3 text-sm text-gray-700 dark:text-gray-300 break-all">
                    {attribute.value || attribute.bank_attribute_value || "-"}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else if !showAddAttribute}
        <div class="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No attributes available.
        </div>
      {/if}
    </div>
  </div>

  <!-- Back Link -->
  <div>
    <a
      href="/banks"
      class="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
    >
      <svg
        class="mr-1 h-4 w-4"
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
      Back to Banks
    </a>
  </div>
</div>
