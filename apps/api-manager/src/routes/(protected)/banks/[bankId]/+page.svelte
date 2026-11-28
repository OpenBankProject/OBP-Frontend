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
      pageDataSummary.set(`Viewing bank ${bank.full_name}${attrs ? `, ${attrs} attributes` : ""}`);
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
      const response = await trackedFetch(`/proxy/obp/v5.1.0/banks/${bank.bank_id}/attribute`, {
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
        throw new Error(errorData.message);
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
        class="ui-link"
      >
        Banks
      </a>
      <span class="ui-muted">/</span>
      <span class="ui-muted">{bank.bank_id}</span>
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
        class="hidden h-16 w-16 rounded-lg p-3 ui-panel ui-muted"
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
        class="h-16 w-16 rounded-lg p-3 ui-panel ui-muted"
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
      <h1 class="text-3xl font-bold ui-text">
        {bank.full_name || bank.bank_id}
      </h1>
      <p class="mt-1 font-mono text-sm ui-muted">
        {bank.bank_id}
      </p>
      {#if bank.bank_code}
        <span
          class="mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ui-panel ui-text"
        >
          Code: {bank.bank_code}
        </span>
      {/if}
    </div>
  </div>

  <!-- Description -->
  <p class="mb-6 text-sm ui-muted">
    In the Open Bank Project, a Bank acts as a tenancy boundary. Many permissions, accounts, products, and other operations are scoped at the bank level.
  </p>

  <!-- Bank Details & Routings (side by side) -->
  <div class="mb-6 grid gap-6 lg:grid-cols-2">
    <!-- Details -->
    <div class="rounded-lg border ui-card ui-border">
      <div class="border-b px-6 py-3 ui-border">
        <h2 class="text-sm font-semibold uppercase tracking-wider ui-muted">
          Details
        </h2>
      </div>
      <div class="divide-y ui-border">
        <div class="flex gap-4 px-6 py-3">
          <dt class="w-24 flex-shrink-0 text-sm ui-muted">Bank ID</dt>
          <dd class="font-mono text-sm ui-text">{bank.bank_id || "-"}</dd>
        </div>
        <div class="flex gap-4 px-6 py-3">
          <dt class="w-24 flex-shrink-0 text-sm ui-muted">Full Name</dt>
          <dd class="text-sm ui-text">{bank.full_name || "-"}</dd>
        </div>
        <div class="flex gap-4 px-6 py-3">
          <dt class="w-24 flex-shrink-0 text-sm ui-muted">Bank Code</dt>
          <dd class="text-sm ui-text">{bank.bank_code || "-"}</dd>
        </div>
        <div class="flex gap-4 px-6 py-3">
          <dt class="w-24 flex-shrink-0 text-sm ui-muted">Website</dt>
          <dd class="text-sm">
            {#if bank.website}
              <a
                href={bank.website}
                target="_blank"
                rel="noopener noreferrer"
                class="hover:underline ui-link"
              >
                {bank.website}
              </a>
            {:else}
              <span class="ui-muted">-</span>
            {/if}
          </dd>
        </div>
      </div>
    </div>

    <!-- Routings -->
    <div class="rounded-lg border ui-card ui-border">
      <div class="border-b px-6 py-3 ui-border">
        <h2 class="text-sm font-semibold uppercase tracking-wider ui-muted">
          Bank Routings
          <span class="ml-1 font-normal">({bank.bank_routings?.length || 0})</span>
        </h2>
      </div>
      {#if bank.bank_routings && bank.bank_routings.length > 0}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y ui-border">
            <thead class="ui-card">
              <tr>
                <th class="px-6 py-2 text-left text-xs font-medium uppercase tracking-wider ui-muted">Scheme</th>
                <th class="px-6 py-2 text-left text-xs font-medium uppercase tracking-wider ui-muted">Address</th>
              </tr>
            </thead>
            <tbody class="divide-y ui-card ui-border">
              {#each bank.bank_routings as routing}
                <tr class="ui-hover">
                  <td class="whitespace-nowrap px-6 py-3 text-sm font-medium ui-text">{routing.scheme || "-"}</td>
                  <td class="px-6 py-3 font-mono text-sm ui-muted">{routing.address || "-"}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="px-6 py-8 text-center text-sm ui-muted">
          No bank routings available.
        </div>
      {/if}
    </div>
  </div>

  <!-- Related Pages & Attributes (side by side) -->
  <div class="mb-6 grid gap-6 lg:grid-cols-2">
    <!-- Related Pages -->
    <div class="rounded-lg border ui-card ui-border">
      <div class="border-b px-6 py-3 ui-border">
        <h2 class="text-sm font-semibold uppercase tracking-wider ui-muted">
          Related Pages
        </h2>
      </div>
      <div class="grid grid-cols-2 gap-3 p-4">
        <a
          href="/account-access/accounts?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ui-border ui-hover"
        >
          <svg class="h-4 w-4 flex-shrink-0 ui-link ui-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <span class="text-sm font-medium ui-link ui-text">Accounts</span>
        </a>

        <a
          href="/products?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ui-border ui-hover"
        >
          <svg class="h-4 w-4 flex-shrink-0 ui-link ui-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span class="text-sm font-medium ui-link ui-text">API Products</span>
        </a>

        <a
          href="/products/financial?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ui-border ui-hover"
        >
          <svg class="h-4 w-4 flex-shrink-0 ui-link ui-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span class="text-sm font-medium ui-link ui-text">Financial Products</span>
        </a>

        <a
          href="/dynamic-endpoints/bank?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ui-border ui-hover"
        >
          <svg class="h-4 w-4 flex-shrink-0 ui-link ui-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span class="text-sm font-medium ui-link ui-text">Dynamic Endpoints</span>
        </a>

        <a
          href="/rbac/entitlements?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ui-border ui-hover"
        >
          <svg class="h-4 w-4 flex-shrink-0 ui-link ui-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <span class="text-sm font-medium ui-link ui-text">Entitlements</span>
        </a>

        <a
          href="/account-access/system-views?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ui-border ui-hover"
        >
          <svg class="h-4 w-4 flex-shrink-0 ui-link ui-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span class="text-sm font-medium ui-link ui-text">System Views</span>
        </a>

        <a
          href="/account-access/account-directory?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ui-border ui-hover"
        >
          <svg class="h-4 w-4 flex-shrink-0 ui-link ui-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span class="text-sm font-medium ui-link ui-text">Account Directory</span>
        </a>

        <a
          href="/banks/fx-rates?bank_id={bank.bank_id}"
          class="group flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ui-border ui-hover"
        >
          <svg class="h-4 w-4 flex-shrink-0 ui-link ui-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          <span class="text-sm font-medium ui-link ui-text">FX Rates</span>
        </a>
      </div>
    </div>

    <!-- Attributes -->
    <div class="rounded-lg border ui-card ui-border">
      <div class="flex items-center justify-between border-b px-6 py-3 ui-border">
        <h2 class="text-sm font-semibold uppercase tracking-wider ui-muted">
          Attributes
          <span class="ml-1 font-normal">({bank.attributes?.length || 0})</span>
        </h2>
        <button
          type="button"
          onclick={() => (showAddAttribute = !showAddAttribute)}
          class="inline-flex items-center text-xs ui-link"
        >
          <svg class="mr-1 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {#if showAddAttribute}
        <form onsubmit={handleAddAttribute} class="border-b p-4 ui-card ui-border">
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label for="attr-name" class="block text-xs font-medium ui-muted">
                Name <span class="ui-text-error">*</span>
              </label>
              <input
                id="attr-name"
                type="text"
                bind:value={attrName}
                placeholder="e.g., ISIN"
                disabled={isSubmittingAttr}
                required
                class="mt-1 block w-full rounded border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-50 ui-card ui-text ui-border"
              />
            </div>
            <div>
              <label for="attr-type" class="block text-xs font-medium ui-muted">Type</label>
              <select
                id="attr-type"
                bind:value={attrType}
                disabled={isSubmittingAttr}
                class="mt-1 block w-full rounded border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-50 ui-card ui-text ui-border"
              >
                <option value="STRING">STRING</option>
                <option value="INTEGER">INTEGER</option>
                <option value="DOUBLE">DOUBLE</option>
                <option value="DATE_WITH_DAY">DATE_WITH_DAY</option>
              </select>
            </div>
            <div>
              <label for="attr-value" class="block text-xs font-medium ui-muted">Value</label>
              <input
                id="attr-value"
                type="text"
                bind:value={attrValue}
                placeholder="Attribute value"
                disabled={isSubmittingAttr}
                class="mt-1 block w-full rounded border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-50 ui-card ui-text ui-border"
              />
            </div>
            <div class="flex items-end gap-3">
              <label class="flex items-center gap-2 text-sm ui-muted">
                <input
                  type="checkbox"
                  bind:checked={attrIsActive}
                  disabled={isSubmittingAttr}
                  class="h-4 w-4 rounded ui-link ui-border"
                />
                Active
              </label>
              <div class="ml-auto flex gap-2">
                <button
                  type="button"
                  onclick={resetAttrForm}
                  disabled={isSubmittingAttr}
                  class="rounded border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ui-card ui-hover ui-muted ui-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAttr}
                  class="rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50 preset-filled-primary-500"
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
          <table class="min-w-full divide-y ui-border">
            <thead class="ui-card">
              <tr>
                <th class="px-6 py-2 text-left text-xs font-medium uppercase tracking-wider ui-muted">Name</th>
                <th class="px-6 py-2 text-left text-xs font-medium uppercase tracking-wider ui-muted">Value</th>
              </tr>
            </thead>
            <tbody class="divide-y ui-card ui-border">
              {#each bank.attributes as attribute}
                <tr class="ui-hover">
                  <td class="whitespace-nowrap px-6 py-3 text-sm font-medium ui-text">
                    {attribute.name || attribute.bank_attribute_name || "-"}
                  </td>
                  <td class="px-6 py-3 text-sm break-all ui-muted">
                    {attribute.value || attribute.bank_attribute_value || "-"}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else if !showAddAttribute}
        <div class="px-6 py-8 text-center text-sm ui-muted">
          No attributes available.
        </div>
      {/if}
    </div>
  </div>

  <!-- Back Link -->
  <div>
    <a
      href="/banks"
      class="inline-flex items-center text-sm ui-link"
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
