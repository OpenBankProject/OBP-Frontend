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
  import { onMount } from "svelte";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  interface ProductWithBank {
    bank_id: string;
    product_code?: string;
    code?: string;
    name?: string;
    description?: string;
    parent_product_code?: string;
    category?: string;
    family?: string;
    super_family?: string;
    more_info_url?: string;
    tags?: string[];
    attributes?: Array<{ name: string; value: string }>;
  }

  let products = $state<ProductWithBank[]>([]);
  let isLoading = $state(true);
  let loadError = $state("");
  let searchQuery = $state("");
  let featuredOnly = $state(false);

  onMount(async () => {
    await loadAll();
  });

  async function loadAll() {
    isLoading = true;
    loadError = "";
    products = [];

    try {
      const tagQuery = featuredOnly ? "?tag=featured" : "";
      const response = await trackedFetch(`/proxy/obp/v6.0.0/products${tagQuery}`);
      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to fetch financial products",
        );
        logErrorDetails("Fetch All Products", errorDetails);
        loadError = formatErrorForDisplay(errorDetails);
        return;
      }
      const body = await response.json();
      products = body.products || [];
    } catch (err) {
      console.error("Error loading financial products across banks:", err);
      loadError =
        err instanceof Error
          ? err.message
          : "Failed to load financial products across banks";
    } finally {
      isLoading = false;
    }
  }

  async function toggleFeatured() {
    featuredOnly = !featuredOnly;
    await loadAll();
  }

  const bankCount = $derived(
    new Set(products.map((p) => p.bank_id)).size,
  );

  const filteredProducts = $derived(
    products.filter((product) => {
      if (searchQuery === "") return true;
      const query = searchQuery.toLowerCase();
      const code = (product.product_code || product.code || "").toLowerCase();
      const name = (product.name || "").toLowerCase();
      const description = (product.description || "").toLowerCase();
      const bankId = (product.bank_id || "").toLowerCase();
      const parentCode = (product.parent_product_code || "").toLowerCase();
      const category = (product.category || "").toLowerCase();
      const family = (product.family || "").toLowerCase();
      const superFamily = (product.super_family || "").toLowerCase();
      return (
        code.includes(query) ||
        name.includes(query) ||
        description.includes(query) ||
        bankId.includes(query) ||
        parentCode.includes(query) ||
        category.includes(query) ||
        family.includes(query) ||
        superFamily.includes(query)
      );
    }),
  );
</script>

<svelte:head>
  <title>Financial Products at All Banks - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1
        class="text-3xl font-bold text-gray-900 dark:text-gray-100"
        data-testid="page-title"
      >
        Financial Products at All Banks
      </h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        Aggregated view of financial products across every bank this instance
        knows about.
      </p>
    </div>
    <a
      href="/products/financial"
      class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      ← Single-bank view
    </a>
  </div>

  {#if loadError}
    <div
      class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
      data-testid="load-error"
    >
      <h3 class="font-semibold text-red-800 dark:text-red-300">
        Error Loading
      </h3>
      <p class="mt-1 text-sm text-red-700 dark:text-red-400">{loadError}</p>
    </div>
  {/if}

  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
    <div class="flex-1">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search by bank id, code, name, description, category, or family..."
        data-testid="search-input"
        class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
      />
    </div>
    <button
      type="button"
      onclick={toggleFeatured}
      disabled={isLoading}
      data-testid="toggle-featured"
      data-state={featuredOnly ? "on" : "off"}
      class="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 {featuredOnly
        ? 'border-purple-300 bg-purple-100 text-purple-800 dark:border-purple-600 dark:bg-purple-900/30 dark:text-purple-300'
        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
    >
      {featuredOnly ? "✓ Featured only" : "Show all tags"}
    </button>
  </div>

  {#if isLoading}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <svg
        class="mb-4 h-8 w-8 animate-spin text-blue-600"
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
      <p class="text-gray-600 dark:text-gray-400">
        Loading products from all banks...
      </p>
    </div>
  {:else if filteredProducts.length === 0}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {products.length === 0
          ? featuredOnly
            ? "No featured financial products found"
            : "No financial products found"
          : "No matching products"}
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        {products.length === 0
          ? "No products were returned from any bank."
          : "Try adjusting your search criteria."}
      </p>
    </div>
  {:else}
    <div class="space-y-3" data-testid="product-list">
      {#each filteredProducts as product, i (`${product.bank_id}-${product.product_code || product.code}-${i}`)}
        {@const code = product.product_code || product.code || ""}
        <div
          class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          data-testid="product-card-{product.bank_id}-{code}"
        >
          <div class="mb-3 flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2
                  class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                  {product.name || "Unnamed Product"}
                </h2>
                <span
                  class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                  data-testid="product-code"
                >
                  {code}
                </span>
                <span
                  class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                  data-testid="product-bank"
                >
                  Bank: {product.bank_id}
                </span>
              </div>
              {#if product.parent_product_code}
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Parent:
                  <code class="rounded bg-gray-100 px-1 dark:bg-gray-700"
                    >{product.parent_product_code}</code
                  >
                </p>
              {/if}
              {#if product.tags && product.tags.length > 0}
                <div
                  class="mt-2 flex flex-wrap gap-1"
                  data-testid="financial-product-tags"
                >
                  {#each product.tags as tag}
                    <span
                      class="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                      data-testid="financial-product-tag-{tag}"
                    >
                      {tag}
                    </span>
                  {/each}
                </div>
              {/if}
            </div>
            <div class="flex items-center gap-2">
              <a
                href="/products/financial/{product.bank_id}/{encodeURIComponent(code)}"
                data-testid="detail-{product.bank_id}-{code}"
                class="inline-flex items-center rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
              >
                Detail
              </a>
            </div>
          </div>

          {#if product.description}
            <p class="mb-3 text-sm text-gray-700 dark:text-gray-300">
              {product.description}
            </p>
          {/if}

          <div class="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            {#if product.category}
              <div>
                <div class="font-medium text-gray-600 dark:text-gray-400">
                  Category
                </div>
                <div class="text-gray-900 dark:text-gray-100">
                  {product.category}
                </div>
              </div>
            {/if}
            {#if product.family}
              <div>
                <div class="font-medium text-gray-600 dark:text-gray-400">
                  Family
                </div>
                <div class="text-gray-900 dark:text-gray-100">
                  {product.family}
                </div>
              </div>
            {/if}
            {#if product.super_family}
              <div>
                <div class="font-medium text-gray-600 dark:text-gray-400">
                  Super Family
                </div>
                <div class="text-gray-900 dark:text-gray-100">
                  {product.super_family}
                </div>
              </div>
            {/if}
            {#if product.more_info_url}
              <div>
                <div class="font-medium text-gray-600 dark:text-gray-400">
                  More Info
                </div>
                <a
                  href={product.more_info_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Link
                </a>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <div
      class="mt-4 flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700"
    >
      <div class="text-sm text-gray-700 dark:text-gray-300">
        Showing <span class="font-medium">{filteredProducts.length}</span> of
        <span class="font-medium">{products.length}</span>
        products across
        <span class="font-medium">{bankCount}</span>
        {bankCount === 1 ? "bank" : "banks"}
      </div>
    </div>
  {/if}
</div>
