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
  import { onMount } from "svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  const bankId = $page.params.bank_id!;
  const productCode = $page.params.product_code!;

  const apiExplorerUrl =
    $page.data.externalLinks?.API_EXPLORER_URL ||
    "https://apiexplorer-ii-sandbox.openbankproject.com";

  const apiExplorerProductUrl = `${apiExplorerUrl}/resource-docs/OBPv4.0.0?operationid=OBPv4.0.0-getProduct`;

  let product = $state<any>(null);
  let tags = $state<string[]>([]);
  let isLoading = $state(true);
  let loadError = $state("");

  onMount(async () => {
    await loadProduct();
  });

  async function parseOrThrow(response: Response) {
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
    return body;
  }

  async function loadProduct() {
    isLoading = true;
    loadError = "";

    try {
      const [productResponse, tagsResponse] = await Promise.all([
        trackedFetch(
          `/proxy/obp/v5.1.0/banks/${bankId}/products/${encodeURIComponent(productCode)}`,
        ),
        trackedFetch(
          `/proxy/obp/v6.0.0/banks/${bankId}/products/${encodeURIComponent(productCode)}/tags`,
        ),
      ]);

      product = await parseOrThrow(productResponse);
      const tagsBody = await parseOrThrow(tagsResponse);
      tags = tagsBody.tags ?? [];
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Failed to load product";
      product = null;
      tags = [];
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
      class="text-sm ui-link"
    >
      ← Back to Financial Products
    </a>
  </div>

  {#if loadError}
    <div
      class="mb-6 rounded-lg border p-4 ui-tone-error"
      data-testid="load-error"
    >
      <div class="flex items-start">
        <svg class="mr-3 h-5 w-5 ui-text-error" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div>
          <h3 class="font-semibold ui-text-error">Error Loading Product</h3>
          <p class="mt-1 text-sm ui-text-error">{loadError}</p>
        </div>
      </div>
    </div>
  {/if}

  {#if isLoading}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <svg class="mb-4 h-8 w-8 animate-spin ui-link" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <p class="ui-muted">Loading product details...</p>
    </div>
  {:else if product}
    <div
      class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border"
      data-testid="product-header"
    >
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold ui-text" data-testid="product-name">
              {product.name || "Unnamed Product"}
            </h1>
            <span
              class="rounded-full px-3 py-1 text-sm font-medium ui-tone-info"
              data-testid="product-code"
            >
              {product.product_code || productCode}
            </span>
          </div>
          <p class="mt-2 text-sm ui-muted">
            Bank: <code class="rounded px-2 py-0.5 ui-panel">{bankId}</code>
          </p>
          {#if product.parent_product_code}
            <p class="mt-1 text-sm ui-muted">
              Parent Product:
              <a
                href="/products/financial/{bankId}/{product.parent_product_code}"
                class="hover:underline ui-link"
              >{product.parent_product_code}</a>
            </p>
          {/if}
          {#if tags.length > 0}
            <div class="mt-3 flex flex-wrap gap-1.5" data-testid="financial-product-tags">
              {#each tags as tag}
                <span
                  class="rounded-full px-2.5 py-0.5 text-xs font-medium ui-tone-accent"
                  data-testid="financial-product-tag-{tag}"
                >
                  {tag}
                </span>
              {/each}
            </div>
          {/if}
        </div>
        <div class="flex gap-2">
          <a
            href="/products/financial/{bankId}/{productCode}/edit"
            data-testid="edit"
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
      <div class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border">
        <h2 class="mb-3 text-lg font-semibold ui-text">Description</h2>
        <p class="ui-muted" data-testid="product-description">{product.description}</p>
      </div>
    {/if}

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
              <dt class="text-sm font-medium ui-muted">Terms &amp; Conditions</dt>
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

    {#if product.attributes && product.attributes.length > 0}
      <div class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border">
        <h2 class="mb-4 text-lg font-semibold ui-text">
          Attributes
          <span class="ml-2 text-sm font-normal ui-muted">({product.attributes.length})</span>
        </h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y ui-border" data-testid="attributes-table">
            <thead class="ui-card">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Name</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Type</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Value</th>
              </tr>
            </thead>
            <tbody class="divide-y ui-card ui-border">
              {#each product.attributes as attr}
                <tr data-testid={`attribute-row-${attr.name}`}>
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

    {#if product.fees && product.fees.length > 0}
      <div class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border">
        <h2 class="mb-4 text-lg font-semibold ui-text">
          Fees
          <span class="ml-2 text-sm font-normal ui-muted">({product.fees.length})</span>
        </h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y ui-border" data-testid="fees-table">
            <thead class="ui-card">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Name</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Amount</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Currency</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Frequency</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Active</th>
              </tr>
            </thead>
            <tbody class="divide-y ui-card ui-border">
              {#each product.fees as fee}
                <tr data-testid={`fee-row-${fee.product_fee_id ?? fee.name}`}>
                  <td class="whitespace-nowrap px-4 py-3 text-sm font-medium ui-text">{fee.name}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm ui-text">{fee.value?.amount ?? "-"}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm ui-muted">{fee.value?.currency ?? "-"}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm ui-muted">{fee.value?.frequency ?? "-"}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm ui-muted">{fee.is_active ? "Yes" : "No"}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

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
