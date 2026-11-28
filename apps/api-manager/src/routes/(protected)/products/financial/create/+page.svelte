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
  import { goto } from "$app/navigation";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import { currentBank } from "$lib/stores/currentBank.svelte";

  const ATTRIBUTE_TYPES = ["STRING", "INTEGER", "DOUBLE", "DATE_WITH_DAY"] as const;

  interface CustomAttribute {
    name: string;
    type: string;
    value: string;
  }

  let selectedBankId = $state(currentBank.bankId);

  $effect(() => {
    selectedBankId = currentBank.bankId;
  });

  let productCode = $state("");
  let name = $state("");
  let parentProductCode = $state("");
  let description = $state("");
  let moreInfoUrl = $state("");
  let termsAndConditionsUrl = $state("");
  let attributes = $state<CustomAttribute[]>([]);
  let isSubmitting = $state(false);

  function addAttribute() {
    attributes = [...attributes, { name: "", type: "STRING", value: "" }];
  }

  function removeAttribute(index: number) {
    attributes = attributes.filter((_, i) => i !== index);
  }

  async function putProduct(bankId: string, code: string) {
    const response = await trackedFetch(
      `/proxy/obp/v5.1.0/banks/${bankId}/products/${encodeURIComponent(code)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          parent_product_code: parentProductCode.trim(),
          description: description.trim(),
          more_info_url: moreInfoUrl.trim(),
          terms_and_conditions_url: termsAndConditionsUrl.trim(),
        }),
      },
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
      const obpCode = body.code != null ? String(body.code) : "";
      throw new Error(obpCode ? `${obpCode}: ${body.message}` : body.message);
    }

    if (!body || typeof body.product_code !== "string" || !body.product_code) {
      throw new Error(
        `Unexpected success response from OBP (HTTP ${response.status}): ${bodyText}`,
      );
    }

    return body;
  }

  async function postAttribute(bankId: string, code: string, attr: CustomAttribute) {
    const response = await trackedFetch(
      `/proxy/obp/v5.1.0/banks/${bankId}/products/${encodeURIComponent(code)}/attribute`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: attr.name,
          type: attr.type,
          value: attr.value,
          is_active: true,
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      let parsed: any = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(
          `Unexpected non-JSON response from OBP (HTTP ${response.status}): ${text}`,
        );
      }
      if (!parsed || typeof parsed.message !== "string") {
        throw new Error(
          `Unexpected error format from OBP (HTTP ${response.status}): ${text}`,
        );
      }
      const obpCode = parsed.code != null ? String(parsed.code) : "";
      throw new Error(obpCode ? `${obpCode}: ${parsed.message}` : parsed.message);
    }
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!selectedBankId) {
      toast.error("Validation Error", "Please select a bank in My Account first");
      return;
    }

    if (!productCode.trim()) {
      toast.error("Validation Error", "Product Code is required");
      return;
    }

    if (!name.trim()) {
      toast.error("Validation Error", "Name is required");
      return;
    }

    isSubmitting = true;
    const code = productCode.trim();
    const bankId = selectedBankId;

    try {
      await putProduct(bankId, code);

      const failedAttributes: Array<{ name: string; error: string }> = [];
      for (const attr of attributes) {
        if (!attr.name.trim()) continue;
        try {
          await postAttribute(bankId, code, attr);
        } catch (err) {
          failedAttributes.push({
            name: attr.name,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (failedAttributes.length > 0) {
        const details = failedAttributes
          .map((f) => `${f.name}: ${f.error}`)
          .join("; ");
        toast.warning(
          "Product Created with Warnings",
          `Product created but these attributes failed — ${details}`,
        );
      } else {
        toast.success(
          "Financial Product Created",
          `Successfully created product "${code}"`,
        );
      }

      setTimeout(() => {
        goto("/products/financial");
      }, 1000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create financial product";
      toast.error("Error", errorMessage);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Create Financial Product - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-3xl px-4 py-8">
  <div class="mb-6">
    <div class="flex items-center gap-2 text-sm">
      <a
        href="/products/financial"
        class="ui-link"
      >
        Financial Products
      </a>
      <span class="ui-muted">/</span>
      <span class="ui-muted">Create</span>
    </div>
  </div>

  <div class="mb-8">
    <h1 class="text-3xl font-bold ui-text">
      Create Financial Product
    </h1>
    <p class="mt-1 ui-muted">
      Create a financial product for bank
      <code class="rounded px-1 ui-panel">{selectedBankId || "(none selected)"}</code>
    </p>
  </div>

  <div class="rounded-lg border ui-card ui-border">
    <form onsubmit={handleSubmit} class="p-6" data-testid="financial-product-create-form">
      <div class="space-y-6">
        <div>
          <label for="product-code" class="block text-sm font-medium ui-muted">
            Product Code <span class="ui-text-error">*</span>
          </label>
          <input
            id="product-code"
            name="product_code"
            type="text"
            bind:value={productCode}
            placeholder="e.g., 1234BW"
            disabled={isSubmitting}
            required
            data-testid="input-product-code"
            class="mt-2 block w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
          />
          <p class="mt-1 text-xs ui-muted">
            Unique code identifying this product within the bank
          </p>
        </div>

        <div>
          <label for="name" class="block text-sm font-medium ui-muted">
            Name <span class="ui-text-error">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            bind:value={name}
            placeholder="e.g., Deposit Account 1"
            disabled={isSubmitting}
            required
            data-testid="input-name"
            class="mt-2 block w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
          />
        </div>

        <div>
          <label for="parent-product-code" class="block text-sm font-medium ui-muted">
            Parent Product Code
          </label>
          <input
            id="parent-product-code"
            name="parent_product_code"
            type="text"
            bind:value={parentProductCode}
            placeholder="e.g., 787LOW"
            disabled={isSubmitting}
            data-testid="input-parent-product-code"
            class="mt-2 block w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
          />
        </div>

        <div>
          <label for="description" class="block text-sm font-medium ui-muted">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            bind:value={description}
            rows="3"
            disabled={isSubmitting}
            data-testid="input-description"
            class="mt-2 block w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
          ></textarea>
        </div>

        <div>
          <label for="more-info-url" class="block text-sm font-medium ui-muted">
            More Info URL
          </label>
          <input
            id="more-info-url"
            name="more_info_url"
            type="url"
            bind:value={moreInfoUrl}
            placeholder="https://www.example.com/abc"
            disabled={isSubmitting}
            data-testid="input-more-info-url"
            class="mt-2 block w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
          />
        </div>

        <div>
          <label for="terms-url" class="block text-sm font-medium ui-muted">
            Terms and Conditions URL
          </label>
          <input
            id="terms-url"
            name="terms_and_conditions_url"
            type="url"
            bind:value={termsAndConditionsUrl}
            placeholder="https://www.example.com/xyz"
            disabled={isSubmitting}
            data-testid="input-terms-url"
            class="mt-2 block w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
          />
        </div>

        <div>
          <div class="flex items-center justify-between">
            <label class="block text-sm font-medium ui-muted">
              Attributes
            </label>
            <button
              type="button"
              onclick={addAttribute}
              disabled={isSubmitting}
              data-testid="add-attribute"
              class="inline-flex items-center text-sm disabled:opacity-50 ui-link"
            >
              <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Attribute
            </button>
          </div>

          {#if attributes.length > 0}
            <div class="mt-2 space-y-3">
              {#each attributes as attr, index (index)}
                <div class="flex items-start gap-3" data-testid={`attribute-row-${index}`}>
                  <div class="flex-1">
                    <input
                      type="text"
                      bind:value={attr.name}
                      placeholder="Name (e.g., ISIN)"
                      disabled={isSubmitting}
                      data-testid={`attribute-name-${index}`}
                      class="block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
                    />
                  </div>
                  <div class="w-40">
                    <select
                      bind:value={attr.type}
                      disabled={isSubmitting}
                      data-testid={`attribute-type-${index}`}
                      class="block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
                    >
                      {#each ATTRIBUTE_TYPES as type}
                        <option value={type}>{type}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="flex-1">
                    <input
                      type="text"
                      bind:value={attr.value}
                      placeholder="Value"
                      disabled={isSubmitting}
                      data-testid={`attribute-value-${index}`}
                      class="block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-50 ui-card ui-text ui-border"
                    />
                  </div>
                  <button
                    type="button"
                    onclick={() => removeAttribute(index)}
                    disabled={isSubmitting}
                    data-testid={`remove-attribute-${index}`}
                    class="mt-1 disabled:opacity-50 ui-text-error"
                  >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <p class="mt-2 text-xs ui-muted">
              No attributes added. Click "Add Attribute" to attach typed key-value pairs (e.g., ISIN, MATURITY_DATE).
            </p>
          {/if}
        </div>
      </div>

      <div class="mt-8 flex justify-end gap-3 border-t pt-6 ui-border">
        <a
          href="/products/financial"
          data-testid="cancel"
          class="rounded-lg border px-4 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="submit"
          class="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 preset-filled-primary-500"
        >
          {isSubmitting ? "Creating..." : "Create Financial Product"}
        </button>
      </div>
    </form>
  </div>
</div>
