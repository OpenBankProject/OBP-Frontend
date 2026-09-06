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
  import { page } from "$app/stores";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import { currentBank } from "$lib/stores/currentBank.svelte";

  const apiExplorerUrl =
    $page.data.externalLinks?.API_EXPLORER_URL ||
    "https://apiexplorer-ii-sandbox.openbankproject.com";

  const apiExplorerCollectionsUrl = `${apiExplorerUrl}/resource-docs/OBPv6.0.0?operationid=OBPv3.1.0-getProductCollection`;

  let selectedBankId = $state(currentBank.bankId);
  let collectionCode = $state("");

  $effect(() => {
    selectedBankId = currentBank.bankId;
  });
  let collection = $state<any>(null);
  let isLoading = $state(false);
  let loadError = $state("");
  let searchQuery = $state("");

  async function loadCollection() {
    if (!selectedBankId || !collectionCode.trim()) {
      collection = null;
      return;
    }

    isLoading = true;
    loadError = "";

    try {
      const response = await trackedFetch(`/proxy/obp/v6.0.0/banks/${selectedBankId}/product-collections/${encodeURIComponent(collectionCode.trim())}`);

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to fetch product collection",
        );
        logErrorDetails("Fetch Product Collection", errorDetails);
        loadError = formatErrorForDisplay(errorDetails);
        collection = null;
        return;
      }

      const data = await response.json();
      collection = data;
    } catch (err) {
      console.error("Error loading product collection:", err);
      loadError = err instanceof Error ? err.message : "Failed to load product collection";
      collection = null;
    } finally {
      isLoading = false;
    }
  }

  const filteredProducts = $derived(
    collection?.products?.filter((product: any) => {
      if (searchQuery === "") return true;

      const query = searchQuery.toLowerCase();
      const code = (product.code || product.product_code || "").toLowerCase();
      const name = (product.name || "").toLowerCase();
      const description = (product.description || "").toLowerCase();

      return (
        code.includes(query) ||
        name.includes(query) ||
        description.includes(query)
      );
    }) || [],
  );
</script>

<svelte:head>
  <title>Product Collections - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="mb-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Product Collections
        </h1>
        <p class="mt-1 text-gray-600 dark:text-gray-400">
          View and manage product collections (baskets/buckets of products)
        </p>
      </div>
      <div class="flex gap-2">
        <a
          href={apiExplorerCollectionsUrl}
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
      </div>
    </div>
  </div>

  <!-- Info Banner -->
  <div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
    <div class="flex items-start">
      <svg class="mr-3 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
      </svg>
      <div>
        <h3 class="text-sm font-medium text-blue-900 dark:text-blue-100">About Product Collections</h3>
        <p class="mt-1 text-sm text-blue-800 dark:text-blue-200">
          Product Collections allow you to group related products together into baskets or buckets.
          Unlike product hierarchy (parent/child relationships), collections provide a flexible way to organize products
          that may span different categories or families.
        </p>
      </div>
    </div>
  </div>

  <!-- Collection Code Input -->
  {#if selectedBankId}
    <div class="mb-6">
      <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
        Collection Code
      </label>
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={collectionCode}
          placeholder="Enter collection code (e.g., PREMIUM_ACCOUNTS)"
          class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
          onkeydown={(e) => e.key === 'Enter' && loadCollection()}
        />
        <button
          onclick={loadCollection}
          disabled={!collectionCode.trim() || isLoading}
          class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {#if isLoading}
            <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading...
          {:else}
            <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Load Collection
          {/if}
        </button>
      </div>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Enter the collection code and click "Load Collection" to view its products
      </p>
    </div>
  {/if}

  <!-- Error Message -->
  {#if loadError}
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
            Error Loading Product Collection
          </h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-400">
            {loadError}
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Content -->
  {#if !selectedBankId}
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
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
      <h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        No Bank Selected
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        Please select a bank in <a href="/user" class="text-blue-600 hover:underline dark:text-blue-400">My Account</a> to search for product collections.
      </p>
    </div>
  {:else if !collection && !loadError}
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
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
      <h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Enter a Collection Code
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        Enter a collection code above to view the products in that collection.
      </p>
    </div>
  {:else if collection}
    <!-- Collection Header -->
    <div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="flex items-start justify-between">
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
            Collection: {collection.collection_code || collectionCode}
          </h2>
          {#if collection.products}
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {collection.products.length} product{collection.products.length !== 1 ? 's' : ''} in this collection
            </p>
          {/if}
        </div>
        <a
          href="/products/collections/create?bank_id={selectedBankId}&code={collectionCode}"
          class="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Collection
        </a>
      </div>
    </div>

    <!-- Search Products in Collection -->
    {#if collection.products && collection.products.length > 0}
      <div class="mb-6">
        <div class="relative">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search products in this collection..."
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

      <!-- Products List -->
      <div class="space-y-3">
        {#each filteredProducts as product (product.code || product.product_code)}
          <div
            class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {product.name || "Unnamed Product"}
                  </h3>
                  <span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {product.code || product.product_code}
                  </span>
                </div>
                {#if product.description}
                  <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {product.description}
                  </p>
                {/if}
              </div>
              <a
                href="/products/{selectedBankId}/{product.code || product.product_code}"
                class="inline-flex items-center rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
              >
                View Details
              </a>
            </div>

            <!-- Product Attributes Preview -->
            {#if product.product_attributes && product.product_attributes.length > 0}
              <div class="mt-3 flex flex-wrap gap-2">
                {#each product.product_attributes.slice(0, 4) as attr}
                  <span class="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                    <span class="font-medium">{attr.name}:</span>
                    <span class="ml-1">{attr.value}</span>
                  </span>
                {/each}
                {#if product.product_attributes.length > 4}
                  <span class="text-xs text-gray-500">+{product.product_attributes.length - 4} more</span>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Results Summary -->
      <div class="mt-4 flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
        <div class="text-sm text-gray-700 dark:text-gray-300">
          Showing <span class="font-medium">{filteredProducts.length}</span>
          of
          <span class="font-medium">{collection.products.length}</span>
          products
        </div>
      </div>
    {:else}
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
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
        <h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Empty Collection
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          This collection does not contain any products yet.
        </p>
      </div>
    {/if}
  {/if}
</div>
