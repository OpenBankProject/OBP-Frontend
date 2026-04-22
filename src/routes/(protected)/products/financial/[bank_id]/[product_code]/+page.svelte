<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  const bankId = $page.params.bank_id!;
  const productCode = $page.params.product_code!;

  const apiExplorerUrl =
    $page.data.externalLinks?.API_EXPLORER_URL ||
    "https://apiexplorer-ii-sandbox.openbankproject.com";

  const apiExplorerProductUrl = `${apiExplorerUrl}/resource-docs/OBPv4.0.0?operationid=OBPv4.0.0-getProduct`;

  let product = $state<any>(null);
  let isLoading = $state(true);
  let loadError = $state("");

  onMount(async () => {
    await loadProduct();
  });

  async function loadProduct() {
    isLoading = true;
    loadError = "";

    try {
      const response = await trackedFetch(
        `/proxy/obp/v4.0.0/banks/${bankId}/products/${encodeURIComponent(productCode)}`,
      );

      const bodyText = await response.text();
      let body: any = null;
      try {
        body = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        throw new Error(
          `Unexpected non-JSON response from OBP (HTTP ${response.status}): ${bodyText}`,
        );
      }

      if (!response.ok) {
        if (!body || typeof body.message !== "string") {
          throw new Error(
            `Unexpected error format from OBP (HTTP ${response.status}): ${bodyText}`,
          );
        }
        const code = body.code != null ? String(body.code) : "";
        throw new Error(code ? `${code}: ${body.message}` : body.message);
      }

      product = body;
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Failed to load product";
      product = null;
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>{productCode} - Financial Product - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6">
    <a
      href="/products/financial"
      data-testid="back-to-list"
      class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
    >
      ← Back to Financial Products
    </a>
  </div>

  {#if loadError}
    <div
      class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
      data-testid="load-error"
    >
      <div class="flex items-start">
        <svg class="mr-3 h-5 w-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div>
          <h3 class="font-semibold text-red-800 dark:text-red-300">Error Loading Product</h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-400">{loadError}</p>
        </div>
      </div>
    </div>
  {/if}

  {#if isLoading}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <svg class="mb-4 h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <p class="text-gray-600 dark:text-gray-400">Loading product details...</p>
    </div>
  {:else if product}
    <div
      class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      data-testid="product-header"
    >
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="product-name">
              {product.name || "Unnamed Product"}
            </h1>
            <span
              class="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
              data-testid="product-code"
            >
              {product.product_code || productCode}
            </span>
          </div>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Bank: <code class="rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-700">{bankId}</code>
          </p>
          {#if product.parent_product_code}
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Parent Product:
              <a
                href="/products/financial/{bankId}/{product.parent_product_code}"
                class="text-blue-600 hover:underline dark:text-blue-400"
              >{product.parent_product_code}</a>
            </p>
          {/if}
        </div>
        <div class="flex gap-2">
          <a
            href="/products/financial/{bankId}/{productCode}/edit"
            data-testid="edit"
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
          >
            <svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            API Explorer
          </a>
        </div>
      </div>
    </div>

    {#if product.description}
      <div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Description</h2>
        <p class="text-gray-700 dark:text-gray-300" data-testid="product-description">{product.description}</p>
      </div>
    {/if}

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
              <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">Terms &amp; Conditions</dt>
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

    {#if product.attributes && product.attributes.length > 0}
      <div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Attributes
          <span class="ml-2 text-sm font-normal text-gray-500">({product.attributes.length})</span>
        </h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700" data-testid="attributes-table">
            <thead class="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Value</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {#each product.attributes as attr}
                <tr data-testid={`attribute-row-${attr.name}`}>
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

    {#if product.fees && product.fees.length > 0}
      <div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Fees
          <span class="ml-2 text-sm font-normal text-gray-500">({product.fees.length})</span>
        </h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700" data-testid="fees-table">
            <thead class="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Amount</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Currency</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Frequency</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Active</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {#each product.fees as fee}
                <tr data-testid={`fee-row-${fee.product_fee_id ?? fee.name}`}>
                  <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{fee.name}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{fee.value?.amount ?? "-"}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{fee.value?.currency ?? "-"}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{fee.value?.frequency ?? "-"}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{fee.is_active ? "Yes" : "No"}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

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
