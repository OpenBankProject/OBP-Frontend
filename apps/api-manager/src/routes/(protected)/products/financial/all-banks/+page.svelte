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
        class="text-3xl font-bold ui-text"
        data-testid="page-title"
      >
        Financial Products at All Banks
      </h1>
      <p class="mt-1 ui-muted">
        Aggregated view of financial products across every bank this instance
        knows about.
      </p>
    </div>
    <a
      href="/products/financial"
      class="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border"
    >
      ← Single-bank view
    </a>
  </div>

  {#if loadError}
    <div
      class="mb-6 rounded-lg border p-4 ui-tone-error"
      data-testid="load-error"
    >
      <h3 class="font-semibold ui-text-error">
        Error Loading
      </h3>
      <p class="mt-1 text-sm ui-text-error">{loadError}</p>
    </div>
  {/if}

  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
    <div class="flex-1">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search by bank id, code, name, description, category, or family..."
        data-testid="search-input"
        class="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ui-card ui-text ui-border"
      />
    </div>
    <button
      type="button"
      onclick={toggleFeatured}
      disabled={isLoading}
      data-testid="toggle-featured"
      data-state={featuredOnly ? "on" : "off"}
      class="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 {featuredOnly
        ? 'ui-tone-accent'
        : 'ui-card ui-hover ui-muted ui-border'}"
    >
      {featuredOnly ? "✓ Featured only" : "Show all tags"}
    </button>
  </div>

  {#if isLoading}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <svg
        class="mb-4 h-8 w-8 animate-spin ui-link"
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
      <p class="ui-muted">
        Loading products from all banks...
      </p>
    </div>
  {:else if filteredProducts.length === 0}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <h3 class="mb-2 text-lg font-semibold ui-text">
        {products.length === 0
          ? featuredOnly
            ? "No featured financial products found"
            : "No financial products found"
          : "No matching products"}
      </h3>
      <p class="ui-muted">
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
          class="rounded-lg border p-4 shadow-sm ui-card ui-border"
          data-testid="product-card-{product.bank_id}-{code}"
        >
          <div class="mb-3 flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2
                  class="text-lg font-semibold ui-text"
                >
                  {product.name || "Unnamed Product"}
                </h2>
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium ui-tone-info"
                  data-testid="product-code"
                >
                  {code}
                </span>
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium ui-tone-success"
                  data-testid="product-bank"
                >
                  Bank: {product.bank_id}
                </span>
              </div>
              {#if product.parent_product_code}
                <p class="mt-1 text-xs ui-muted">
                  Parent:
                  <code class="rounded px-1 ui-panel"
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
                      class="rounded-full px-2 py-0.5 text-xs font-medium ui-tone-accent"
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
                class="inline-flex items-center rounded border px-2 py-1 text-xs font-medium ui-tone-info"
              >
                Detail
              </a>
            </div>
          </div>

          {#if product.description}
            <p class="mb-3 text-sm ui-muted">
              {product.description}
            </p>
          {/if}

          <div class="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            {#if product.category}
              <div>
                <div class="font-medium ui-muted">
                  Category
                </div>
                <div class="ui-text">
                  {product.category}
                </div>
              </div>
            {/if}
            {#if product.family}
              <div>
                <div class="font-medium ui-muted">
                  Family
                </div>
                <div class="ui-text">
                  {product.family}
                </div>
              </div>
            {/if}
            {#if product.super_family}
              <div>
                <div class="font-medium ui-muted">
                  Super Family
                </div>
                <div class="ui-text">
                  {product.super_family}
                </div>
              </div>
            {/if}
            {#if product.more_info_url}
              <div>
                <div class="font-medium ui-muted">
                  More Info
                </div>
                <a
                  href={product.more_info_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hover:underline ui-link"
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
      class="mt-4 flex items-center justify-between border-t px-4 py-3 ui-border"
    >
      <div class="text-sm ui-muted">
        Showing <span class="font-medium">{filteredProducts.length}</span> of
        <span class="font-medium">{products.length}</span>
        products across
        <span class="font-medium">{bankCount}</span>
        {bankCount === 1 ? "bank" : "banks"}
      </div>
    </div>
  {/if}
</div>
