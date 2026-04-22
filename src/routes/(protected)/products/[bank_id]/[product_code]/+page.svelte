<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  const bankId = $page.params.bank_id!;
  const productCode = $page.params.product_code!;

  const apiExplorerUrl =
    $page.data.externalLinks?.API_EXPLORER_URL ||
    "https://apiexplorer-ii-sandbox.openbankproject.com";

  const apiExplorerProductUrl = `${apiExplorerUrl}/resource-docs/OBPv6.0.0?operationid=OBPv6.0.0-getApiProduct`;

  let product = $state<any>(null);
  let isLoading = $state(true);
  let loadError = $state("");
  let isDeleting = $state(false);

  onMount(async () => {
    await loadProduct();
  });

  async function loadProduct() {
    isLoading = true;
    loadError = "";

    try {
      const response = await trackedFetch(`/proxy/obp/v6.0.0/banks/${bankId}/api-products/${encodeURIComponent(productCode)}`);

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to fetch product",
        );
        logErrorDetails("Fetch Product", errorDetails);
        loadError = formatErrorForDisplay(errorDetails);
        product = null;
        return;
      }

      product = await response.json();
    } catch (err) {
      console.error("Error loading product:", err);
      loadError = err instanceof Error ? err.message : "Failed to load product";
      product = null;
    } finally {
      isLoading = false;
    }
  }

  async function deleteProduct() {
    if (!confirm(`Are you sure you want to delete the API Product "${productCode}"? This action cannot be undone and will also delete all related attributes.`)) {
      return;
    }

    isDeleting = true;

    try {
      const response = await trackedFetch(`/proxy/obp/v6.0.0/banks/${bankId}/api-products/${encodeURIComponent(productCode)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to delete product",
        );
        logErrorDetails("Delete Product", errorDetails);
        alert(formatErrorForDisplay(errorDetails));
        return;
      }

      alert("Product deleted successfully");
      goto(`/products?bank_id=${bankId}`);
    } catch (err) {
      console.error("Error deleting product:", err);
      alert(err instanceof Error ? err.message : "Failed to delete product");
    } finally {
      isDeleting = false;
    }
  }
</script>

<svelte:head>
  <title>{productCode} - Product Details - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Back Link -->
  <div class="mb-6">
    <a
      href="/products"
      class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
    >
      ← Back to Products
    </a>
  </div>

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
            Error Loading Product
          </h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-400">
            {loadError}
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Loading State -->
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
      <p class="text-gray-600 dark:text-gray-400">Loading product details...</p>
    </div>
  {:else if product}
    <!-- Product Header -->
    <div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {product.name || "Unnamed Product"}
            </h1>
            <span class="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              {product.api_product_code || productCode}
            </span>
          </div>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Bank: <code class="rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-700">{bankId}</code>
          </p>
          {#if product.parent_api_product_code}
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Parent Product: <a href="/products/{bankId}/{product.parent_api_product_code}" class="text-blue-600 hover:underline dark:text-blue-400">{product.parent_api_product_code}</a>
            </p>
          {/if}
          {#if product.tags && product.tags.length > 0}
            <div class="mt-3 flex flex-wrap gap-1.5" data-testid="api-product-tags">
              {#each product.tags as tag}
                <span
                  class="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                  data-testid="api-product-tag-{tag}"
                >
                  {tag}
                </span>
              {/each}
            </div>
          {/if}
        </div>
        <div class="flex gap-2">
          <a
            href="/products/{bankId}/{productCode}/edit"
            class="inline-flex items-center rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
          >
            <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </a>
          <a
            href={apiExplorerProductUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center rounded-lg border border-purple-300 bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 dark:border-purple-600 dark:bg-purple-500 dark:hover:bg-purple-600"
            title="Open in API Explorer"
          >
            <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            API Explorer
          </a>
          <button
            onclick={deleteProduct}
            disabled={isDeleting}
            class="inline-flex items-center rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-600 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
          >
            {#if isDeleting}
              <svg class="mr-1.5 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Deleting...
            {:else}
              <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            {/if}
          </button>
        </div>
      </div>
    </div>

    <!-- Description -->
    {#if product.description}
      <div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Description</h2>
        <p class="text-gray-700 dark:text-gray-300">{product.description}</p>
      </div>
    {/if}

    <!-- Product Details Grid -->
    <div class="mb-6 grid gap-6 md:grid-cols-2">
      <!-- Subscription & Collection -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Subscription & Collection</h2>
        <dl class="space-y-3">
          {#if product.collection_id}
            <div>
              <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">API Collection</dt>
              <dd class="mt-1 flex items-center gap-3">
                <a
                  href="/api-collections/{product.collection_id}"
                  class="inline-flex items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400"
                >
                  <code class="rounded bg-blue-50 px-2 py-0.5 text-sm dark:bg-blue-900/30">{product.collection_id}</code>
                </a>
                <a
                  href="{apiExplorerUrl}/collections/{product.collection_id}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 rounded border border-purple-300 bg-purple-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-purple-700 dark:border-purple-600 dark:bg-purple-500 dark:hover:bg-purple-600"
                  title="View in API Explorer"
                >
                  <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  API Explorer
                </a>
              </dd>
            </div>
          {/if}
          {#if product.monthly_subscription_amount}
            <div>
              <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Subscription</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">{product.monthly_subscription_amount} {product.monthly_subscription_currency || ""}</dd>
            </div>
          {/if}
          {#if product.category}
            <div>
              <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">Category</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">{product.category}</dd>
            </div>
          {/if}
          {#if !product.collection_id && !product.monthly_subscription_amount && !product.category}
            <p class="text-sm text-gray-500 dark:text-gray-400">No subscription or collection configured</p>
          {/if}
        </dl>
      </div>

      <!-- Rate Limits -->
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Rate Limits</h2>
        {#if product.per_second_call_limit || product.per_minute_call_limit || product.per_hour_call_limit || product.per_day_call_limit || product.per_week_call_limit || product.per_month_call_limit}
          <div class="grid grid-cols-3 gap-3">
            {#if product.per_second_call_limit}
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center dark:border-gray-600 dark:bg-gray-700/50">
                <div class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Per Second</div>
                <div class="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{Number(product.per_second_call_limit).toLocaleString()}</div>
              </div>
            {/if}
            {#if product.per_minute_call_limit}
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center dark:border-gray-600 dark:bg-gray-700/50">
                <div class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Per Minute</div>
                <div class="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{Number(product.per_minute_call_limit).toLocaleString()}</div>
              </div>
            {/if}
            {#if product.per_hour_call_limit}
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center dark:border-gray-600 dark:bg-gray-700/50">
                <div class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Per Hour</div>
                <div class="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{Number(product.per_hour_call_limit).toLocaleString()}</div>
              </div>
            {/if}
            {#if product.per_day_call_limit}
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center dark:border-gray-600 dark:bg-gray-700/50">
                <div class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Per Day</div>
                <div class="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{Number(product.per_day_call_limit).toLocaleString()}</div>
              </div>
            {/if}
            {#if product.per_week_call_limit}
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center dark:border-gray-600 dark:bg-gray-700/50">
                <div class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Per Week</div>
                <div class="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{Number(product.per_week_call_limit).toLocaleString()}</div>
              </div>
            {/if}
            {#if product.per_month_call_limit}
              <div class="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center dark:border-gray-600 dark:bg-gray-700/50">
                <div class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Per Month</div>
                <div class="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{Number(product.per_month_call_limit).toLocaleString()}</div>
              </div>
            {/if}
          </div>
        {:else}
          <p class="text-sm text-gray-500 dark:text-gray-400">No rate limits configured</p>
        {/if}
      </div>
    </div>

    <!-- Links -->
    {#if product.more_info_url || product.terms_and_conditions_url}
      <div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Links</h2>
        <dl class="space-y-3">
          {#if product.more_info_url}
            <div>
              <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">More Information</dt>
              <dd class="mt-1">
                <a href={product.more_info_url} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline dark:text-blue-400 break-all">
                  {product.more_info_url}
                </a>
              </dd>
            </div>
          {/if}
          {#if product.terms_and_conditions_url}
            <div>
              <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">Terms & Conditions</dt>
              <dd class="mt-1">
                <a href={product.terms_and_conditions_url} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline dark:text-blue-400 break-all">
                  {product.terms_and_conditions_url}
                </a>
              </dd>
            </div>
          {/if}
        </dl>
      </div>
    {/if}

    <!-- Attributes -->
    {#if product.attributes && product.attributes.length > 0}
      <div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Attributes
          <span class="ml-2 text-sm font-normal text-gray-500">({product.attributes.length})</span>
        </h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Value</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {#each product.attributes as attr}
                <tr>
                  <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{attr.name}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{attr.type || "-"}</td>
                  <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{attr.value}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <!-- Fees -->
    {#if product.fees && product.fees.length > 0}
      <div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Fees
          <span class="ml-2 text-sm font-normal text-gray-500">({product.fees.length})</span>
        </h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Amount</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Currency</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Frequency</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {#each product.fees as fee}
                <tr>
                  <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{fee.name}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{fee.type || "-"}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{fee.amount || "-"}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{fee.currency || "-"}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{fee.frequency || "-"}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <!-- License Info -->
    {#if product.meta?.license}
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">License</h2>
        <dl class="space-y-3">
          {#if product.meta.license.id}
            <div>
              <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">License ID</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">{product.meta.license.id}</dd>
            </div>
          {/if}
          {#if product.meta.license.name}
            <div>
              <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">License Name</dt>
              <dd class="mt-1 text-gray-900 dark:text-gray-100">{product.meta.license.name}</dd>
            </div>
          {/if}
        </dl>
      </div>
    {/if}
  {/if}
</div>
