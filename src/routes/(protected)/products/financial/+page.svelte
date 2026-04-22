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

  const apiExplorerProductsUrl = `${apiExplorerUrl}/resource-docs/OBPv6.0.0?operationid=OBPv6.0.0-getProducts`;

  let selectedBankId = $state(currentBank.bankId);

  // Sync with global current bank
  $effect(() => {
    selectedBankId = currentBank.bankId;
  });
  let products = $state<any[]>([]);
  let isLoading = $state(false);
  let loadError = $state("");
  let searchQuery = $state("");

  async function loadProducts(bankId: string) {
    if (!bankId) {
      products = [];
      return;
    }

    isLoading = true;
    loadError = "";

    try {
      const response = await trackedFetch(`/proxy/obp/v6.0.0/banks/${bankId}/products`);

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to fetch financial products",
        );
        logErrorDetails("Fetch Financial Products", errorDetails);
        loadError = formatErrorForDisplay(errorDetails);
        products = [];
        return;
      }

      const data = await response.json();
      products = data.products || [];
    } catch (err) {
      console.error("Error loading financial products:", err);
      loadError = err instanceof Error ? err.message : "Failed to load financial products";
      products = [];
    } finally {
      isLoading = false;
    }
  }

  // Watch for bank selection changes
  $effect(() => {
    if (selectedBankId) {
      loadProducts(selectedBankId);
    } else {
      products = [];
    }
  });

  const filteredProducts = $derived(
    products.filter((product: any) => {
      if (searchQuery === "") return true;

      const query = searchQuery.toLowerCase();
      const code = (product.code || product.product_code || "").toLowerCase();
      const name = (product.name || "").toLowerCase();
      const description = (product.description || "").toLowerCase();
      const parentCode = (product.parent_product_code || "").toLowerCase();
      const category = (product.category || "").toLowerCase();
      const family = (product.family || "").toLowerCase();
      const superFamily = (product.super_family || "").toLowerCase();

      return (
        code.includes(query) ||
        name.includes(query) ||
        description.includes(query) ||
        parentCode.includes(query) ||
        category.includes(query) ||
        family.includes(query) ||
        superFamily.includes(query)
      );
    }),
  );
</script>

<svelte:head>
  <title>Financial Products - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        Financial Products
      </h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        View financial products offered by the bank
      </p>
    </div>
    <a
      href="/products/financial/create"
      data-testid="create-financial-product"
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
      Create a Financial Product
    </a>
  </div>

  <!-- Stats -->
  {#if selectedBankId}
    <div class="mb-6 flex items-center gap-4">
      <div
        class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="text-sm text-gray-600 dark:text-gray-400">Total Products</div>
        <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
          {products.length}
        </div>
      </div>
      <div class="flex gap-2">
        <a
          href={apiExplorerProductsUrl}
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
            Error Loading Financial Products
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
        Please select a bank in <a href="/user" class="text-blue-600 hover:underline dark:text-blue-400">My Account</a> to view its financial products.
      </p>
    </div>
  {:else if isLoading}
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
      <p class="text-gray-600 dark:text-gray-400">Loading financial products...</p>
    </div>
  {:else}
    <!-- Search -->
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
      <div class="flex-1">
        <div class="relative">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search by code, name, description, category, or family..."
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

    <!-- Products List -->
    {#if filteredProducts.length === 0}
      <div class="flex flex-col items-center justify-center py-12 text-center">
        {#if products.length === 0}
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
            No Financial Products Found
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            There are currently no financial products defined for this bank.
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
          <h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            No Matching Products
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            No products match your search criteria. Try adjusting your filters.
          </p>
        {/if}
      </div>
    {:else}
      <div class="space-y-3">
        {#each filteredProducts as product, i (`${product.code || product.product_code}-${i}`)}
          <div
            class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <!-- Header with Product Name and Code -->
            <div class="mb-3 flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {product.name || "Unnamed Product"}
                  </h2>
                  <span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {product.code || product.product_code}
                  </span>
                </div>
                {#if product.parent_product_code}
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Parent: <code class="rounded bg-gray-100 px-1 dark:bg-gray-700">{product.parent_product_code}</code>
                  </p>
                {/if}
              </div>
              <div class="flex items-center gap-2">
                <a
                  href="/products/financial/{selectedBankId}/{encodeURIComponent(product.code || product.product_code)}"
                  data-testid={`detail-${product.code || product.product_code}`}
                  class="inline-flex items-center rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                >
                  <svg class="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Detail
                </a>
              </div>
            </div>

            <!-- Description -->
            {#if product.description}
              <p class="mb-3 text-sm text-gray-700 dark:text-gray-300">
                {product.description}
              </p>
            {/if}

            <!-- Product Details Grid -->
            <div class="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              {#if product.category}
                <div>
                  <div class="font-medium text-gray-600 dark:text-gray-400">Category</div>
                  <div class="text-gray-900 dark:text-gray-100">{product.category}</div>
                </div>
              {/if}
              {#if product.family}
                <div>
                  <div class="font-medium text-gray-600 dark:text-gray-400">Family</div>
                  <div class="text-gray-900 dark:text-gray-100">{product.family}</div>
                </div>
              {/if}
              {#if product.super_family}
                <div>
                  <div class="font-medium text-gray-600 dark:text-gray-400">Super Family</div>
                  <div class="text-gray-900 dark:text-gray-100">{product.super_family}</div>
                </div>
              {/if}
              {#if product.more_info_url}
                <div>
                  <div class="font-medium text-gray-600 dark:text-gray-400">More Info</div>
                  <a href={product.more_info_url} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline dark:text-blue-400">
                    Link
                  </a>
                </div>
              {/if}
            </div>

            <!-- Attributes -->
            {#if product.attributes && product.attributes.length > 0}
              <div class="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                <div class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Attributes</div>
                <div class="flex flex-wrap gap-2">
                  {#each product.attributes.slice(0, 5) as attr}
                    <span class="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      <span class="font-medium">{attr.name}:</span>
                      <span class="ml-1">{attr.value}</span>
                    </span>
                  {/each}
                  {#if product.attributes.length > 5}
                    <span class="text-xs text-gray-500">+{product.attributes.length - 5} more</span>
                  {/if}
                </div>
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
          <span class="font-medium">{products.length}</span>
          products
        </div>
      </div>
    {/if}
  {/if}
</div>
