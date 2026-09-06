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
  import { goto } from "$app/navigation";
  import { Package } from "@lucide/svelte";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import ProductForm from "$lib/components/ProductForm.svelte";

  let { data } = $props<{ data: PageData }>();

  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);
  let collections = $derived(data.collections || []);

  let selectedBankId = $state(currentBank.bankId);

  $effect(() => {
    selectedBankId = currentBank.bankId;
  });

  async function handleSubmit(formData: {
    name: string;
    description: string;
    productCode: string;
    parentProductCode: string;
    category: string;
    moreInfoUrl: string;
    termsAndConditionsUrl: string;
    collectionId: string;
    monthlySubscription: string;
    monthlySubscriptionCurrency: string;
    rateLimits: { perSecond: string; perMinute: string; perHour: string; perDay: string; perWeek: string; perMonth: string };
    customAttributes: Array<{ name: string; type: string; value: string }>;
    tags: string[];
  }) {
    if (!selectedBankId) {
      toast.error("Validation Error", "Please select a bank in My Account first");
      return;
    }

    if (!formData.productCode) {
      toast.error("Validation Error", "Product code is required");
      return;
    }

    if (!formData.collectionId) {
      toast.error("Validation Error", "API Collection is required");
      return;
    }

    try {
      // Create the product with all core fields in the PUT body
      const productResponse = await trackedFetch(
        `/proxy/obp/v6.0.0/banks/${selectedBankId}/api-products/${formData.productCode}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            parent_api_product_code: formData.parentProductCode,
            category: formData.category,
            more_info_url: formData.moreInfoUrl,
            terms_and_conditions_url: formData.termsAndConditionsUrl,
            collection_id: formData.collectionId,
            monthly_subscription_amount: formData.monthlySubscription,
            monthly_subscription_currency: formData.monthlySubscriptionCurrency,
            per_second_call_limit: Number(formData.rateLimits.perSecond) || -1,
            per_minute_call_limit: Number(formData.rateLimits.perMinute) || -1,
            per_hour_call_limit: Number(formData.rateLimits.perHour) || -1,
            per_day_call_limit: Number(formData.rateLimits.perDay) || -1,
            per_week_call_limit: Number(formData.rateLimits.perWeek) || -1,
            per_month_call_limit: Number(formData.rateLimits.perMonth) || -1,
            tags: formData.tags,
          }),
        },
      );

      if (!productResponse.ok) {
        const errorData = await productResponse.json();
        throw new Error(errorData.message);
      }

      // Create custom attributes (if any)
      const failedAttributes: string[] = [];

      for (const attr of formData.customAttributes) {
        try {
          const attrResponse = await trackedFetch(
            `/proxy/obp/v6.0.0/banks/${selectedBankId}/api-products/${formData.productCode}/attribute`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: attr.name, type: attr.type, value: attr.value, is_active: true }),
            },
          );

          if (!attrResponse.ok) {
            failedAttributes.push(attr.name);
          }
        } catch {
          failedAttributes.push(attr.name);
        }
      }

      if (failedAttributes.length > 0) {
        toast.warning(
          "Product Created with Warnings",
          `Product created but these attributes failed: ${failedAttributes.join(", ")}`,
        );
      } else {
        toast.success(
          "Product Created",
          `Successfully created API Product "${formData.productCode}"`,
        );
      }

      setTimeout(() => {
        goto("/products");
      }, 1000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create product";
      toast.error("Error", errorMessage);
    }
  }

  function handleCancel() {
    goto("/products");
  }
</script>

<svelte:head>
  <title>Create API Product - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <nav class="breadcrumb mb-6">
    <a href="/products" class="breadcrumb-link">API Products</a>
    <span class="breadcrumb-separator">></span>
    <span class="breadcrumb-current">Create API Product</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-icon">
          <Package size={32} />
        </div>
        <div>
          <h1 class="panel-title">Create API Product</h1>
          <div class="panel-subtitle">
            Create a new API product and link it to an API Collection
          </div>
        </div>
      </div>
    </div>

    <div class="panel-content">
      {#if error && !hasApiAccess}
        <div class="error-message">
          <p>{error}</p>
        </div>
      {/if}

      <ProductForm
        mode="create"
        {collections}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1000px;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .breadcrumb-link {
    color: #3b82f6;
    text-decoration: none;
  }

  .breadcrumb-link:hover {
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .breadcrumb-link {
    color: rgb(var(--color-primary-400));
  }

  .breadcrumb-separator {
    color: #9ca3af;
  }

  :global([data-mode="dark"]) .breadcrumb-separator {
    color: var(--color-surface-500);
  }

  .breadcrumb-current {
    color: #6b7280;
  }

  :global([data-mode="dark"]) .breadcrumb-current {
    color: var(--color-surface-400);
  }

  .panel {
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  :global([data-mode="dark"]) .panel {
    background: rgb(var(--color-surface-800));
  }

  .panel-header {
    padding: 2rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: #eff6ff;
    color: #3b82f6;
    border-radius: 12px;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .header-icon {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-400));
  }

  .panel-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .panel-content {
    padding: 2rem;
  }

  .error-message {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #991b1b;
    font-size: 0.875rem;
  }

  :global([data-mode="dark"]) .error-message {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: rgb(var(--color-error-200));
  }

  @media (max-width: 640px) {
    .header-content {
      flex-direction: column;
      text-align: center;
    }
  }
</style>
