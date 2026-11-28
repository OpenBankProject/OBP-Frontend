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
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import ApiProductSubscriptionsPanel from "$lib/components/ApiProductSubscriptionsPanel.svelte";
  import { productIsSelfSubscribe } from "$lib/utils/apiProductSubscriptions";

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
      class="text-sm ui-link"
    >
      ← Back to Products
    </a>
  </div>

  <!-- Error Message -->
  {#if loadError}
    <div
      class="mb-6 rounded-lg border p-4 ui-tone-error"
    >
      <div class="flex items-start">
        <svg
          class="mr-3 h-5 w-5 ui-text-error"
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
          <h3 class="font-semibold ui-text-error">
            Error Loading Product
          </h3>
          <p class="mt-1 text-sm ui-text-error">
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
      <p class="ui-muted">Loading product details...</p>
    </div>
  {:else if product}
    <!-- Product Header -->
    <div class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border">
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold ui-text">
              {product.name || "Unnamed Product"}
            </h1>
            <span class="rounded-full px-3 py-1 text-sm font-medium ui-tone-info">
              {product.api_product_code || productCode}
            </span>
          </div>
          <p class="mt-2 text-sm ui-muted">
            Bank: <code class="rounded px-2 py-0.5 ui-panel">{bankId}</code>
          </p>
          {#if product.parent_api_product_code}
            <p class="mt-1 text-sm ui-muted">
              Parent Product: <a href="/products/{bankId}/{product.parent_api_product_code}" class="hover:underline ui-link">{product.parent_api_product_code}</a>
            </p>
          {/if}
          {#if product.tags && product.tags.length > 0}
            <div class="mt-3 flex flex-wrap gap-1.5" data-testid="api-product-tags">
              {#each product.tags as tag}
                <span
                  class="rounded-full px-2.5 py-0.5 text-xs font-medium ui-tone-accent"
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
            class="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium ui-tone-info"
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
            class="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium preset-filled-primary-500"
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
            class="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50 ui-tone-error"
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
      <div class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border">
        <h2 class="mb-3 text-lg font-semibold ui-text">Description</h2>
        <p class="ui-muted">{product.description}</p>
      </div>
    {/if}

    <!-- Product Details Grid -->
    <div class="mb-6 grid gap-6 md:grid-cols-2">
      <!-- Subscription & Collection -->
      <div class="rounded-lg border p-6 shadow-sm ui-card ui-border">
        <h2 class="mb-4 text-lg font-semibold ui-text">Subscription & Collection</h2>
        <dl class="space-y-3">
          {#if product.collection_id}
            <div>
              <dt class="text-sm font-medium ui-muted">API Collection</dt>
              <dd class="mt-1 flex items-center gap-3">
                <a
                  href="/api-collections/{product.collection_id}"
                  class="inline-flex items-center gap-1.5 hover:underline ui-link"
                >
                  <code class="rounded px-2 py-0.5 text-sm ui-tone-info">{product.collection_id}</code>
                </a>
                <a
                  href="{apiExplorerUrl}/collections/{product.collection_id}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium preset-filled-primary-500"
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
              <dt class="text-sm font-medium ui-muted">Monthly Subscription</dt>
              <dd class="mt-1 ui-text">{product.monthly_subscription_amount} {product.monthly_subscription_currency || ""}</dd>
            </div>
          {/if}
          {#if product.category}
            <div>
              <dt class="text-sm font-medium ui-muted">Category</dt>
              <dd class="mt-1 ui-text">{product.category}</dd>
            </div>
          {/if}
          {#if !product.collection_id && !product.monthly_subscription_amount && !product.category}
            <p class="text-sm ui-muted">No subscription or collection configured</p>
          {/if}
        </dl>
      </div>

      <!-- Rate Limits -->
      <div class="rounded-lg border p-6 shadow-sm ui-card ui-border">
        <h2 class="mb-4 text-lg font-semibold ui-text">Rate Limits</h2>
        {#if product.per_second_call_limit || product.per_minute_call_limit || product.per_hour_call_limit || product.per_day_call_limit || product.per_week_call_limit || product.per_month_call_limit}
          <div class="grid grid-cols-3 gap-3">
            {#if product.per_second_call_limit}
              <div class="rounded-lg border p-3 text-center ui-card ui-border">
                <div class="text-xs font-medium uppercase tracking-wider ui-muted">Per Second</div>
                <div class="mt-1 text-lg font-bold ui-text">{Number(product.per_second_call_limit).toLocaleString()}</div>
              </div>
            {/if}
            {#if product.per_minute_call_limit}
              <div class="rounded-lg border p-3 text-center ui-card ui-border">
                <div class="text-xs font-medium uppercase tracking-wider ui-muted">Per Minute</div>
                <div class="mt-1 text-lg font-bold ui-text">{Number(product.per_minute_call_limit).toLocaleString()}</div>
              </div>
            {/if}
            {#if product.per_hour_call_limit}
              <div class="rounded-lg border p-3 text-center ui-card ui-border">
                <div class="text-xs font-medium uppercase tracking-wider ui-muted">Per Hour</div>
                <div class="mt-1 text-lg font-bold ui-text">{Number(product.per_hour_call_limit).toLocaleString()}</div>
              </div>
            {/if}
            {#if product.per_day_call_limit}
              <div class="rounded-lg border p-3 text-center ui-card ui-border">
                <div class="text-xs font-medium uppercase tracking-wider ui-muted">Per Day</div>
                <div class="mt-1 text-lg font-bold ui-text">{Number(product.per_day_call_limit).toLocaleString()}</div>
              </div>
            {/if}
            {#if product.per_week_call_limit}
              <div class="rounded-lg border p-3 text-center ui-card ui-border">
                <div class="text-xs font-medium uppercase tracking-wider ui-muted">Per Week</div>
                <div class="mt-1 text-lg font-bold ui-text">{Number(product.per_week_call_limit).toLocaleString()}</div>
              </div>
            {/if}
            {#if product.per_month_call_limit}
              <div class="rounded-lg border p-3 text-center ui-card ui-border">
                <div class="text-xs font-medium uppercase tracking-wider ui-muted">Per Month</div>
                <div class="mt-1 text-lg font-bold ui-text">{Number(product.per_month_call_limit).toLocaleString()}</div>
              </div>
            {/if}
          </div>
        {:else}
          <p class="text-sm ui-muted">No rate limits configured</p>
        {/if}
      </div>
    </div>

    <!-- Links -->
    {#if product.more_info_url || product.terms_and_conditions_url}
      <div class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border">
        <h2 class="mb-4 text-lg font-semibold ui-text">Links</h2>
        <dl class="space-y-3">
          {#if product.more_info_url}
            <div>
              <dt class="text-sm font-medium ui-muted">More Information</dt>
              <dd class="mt-1">
                <a href={product.more_info_url} target="_blank" rel="noopener noreferrer" class="hover:underline break-all ui-link">
                  {product.more_info_url}
                </a>
              </dd>
            </div>
          {/if}
          {#if product.terms_and_conditions_url}
            <div>
              <dt class="text-sm font-medium ui-muted">Terms & Conditions</dt>
              <dd class="mt-1">
                <a href={product.terms_and_conditions_url} target="_blank" rel="noopener noreferrer" class="hover:underline break-all ui-link">
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
      <div class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border">
        <h2 class="mb-4 text-lg font-semibold ui-text">
          Attributes
          <span class="ml-2 text-sm font-normal ui-muted">({product.attributes.length})</span>
        </h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y ui-border">
            <thead class="ui-card">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Name</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Type</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Value</th>
              </tr>
            </thead>
            <tbody class="divide-y ui-card ui-border">
              {#each product.attributes as attr}
                <tr>
                  <td class="whitespace-nowrap px-4 py-3 text-sm font-medium ui-text">{attr.name}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm ui-muted">{attr.type || "-"}</td>
                  <td class="px-4 py-3 text-sm ui-text">{attr.value}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <ApiProductSubscriptionsPanel
      {bankId}
      {productCode}
      selfSubscribe={productIsSelfSubscribe(product.attributes)}
    />

    <!-- Fees -->
    {#if product.fees && product.fees.length > 0}
      <div class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border">
        <h2 class="mb-4 text-lg font-semibold ui-text">
          Fees
          <span class="ml-2 text-sm font-normal ui-muted">({product.fees.length})</span>
        </h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y ui-border">
            <thead class="ui-card">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Name</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Type</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Amount</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Currency</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Frequency</th>
              </tr>
            </thead>
            <tbody class="divide-y ui-card ui-border">
              {#each product.fees as fee}
                <tr>
                  <td class="whitespace-nowrap px-4 py-3 text-sm font-medium ui-text">{fee.name}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm ui-muted">{fee.type || "-"}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm ui-text">{fee.amount || "-"}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm ui-muted">{fee.currency || "-"}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm ui-muted">{fee.frequency || "-"}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <!-- License Info -->
    {#if product.meta?.license}
      <div class="rounded-lg border p-6 shadow-sm ui-card ui-border">
        <h2 class="mb-4 text-lg font-semibold ui-text">License</h2>
        <dl class="space-y-3">
          {#if product.meta.license.id}
            <div>
              <dt class="text-sm font-medium ui-muted">License ID</dt>
              <dd class="mt-1 ui-text">{product.meta.license.id}</dd>
            </div>
          {/if}
          {#if product.meta.license.name}
            <div>
              <dt class="text-sm font-medium ui-muted">License Name</dt>
              <dd class="mt-1 ui-text">{product.meta.license.name}</dd>
            </div>
          {/if}
        </dl>
      </div>
    {/if}
  {/if}
</div>
