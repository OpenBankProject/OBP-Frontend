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
  import { Package, ArrowLeft, Plus, Trash2 } from "@lucide/svelte";

  const ATTRIBUTE_TYPES = ["STRING", "INTEGER", "DOUBLE", "DATE_WITH_DAY"] as const;

  interface CustomAttribute {
    name: string;
    type: string;
    value: string;
  }

  interface ProductFormData {
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
    rateLimits: {
      perSecond: string;
      perMinute: string;
      perHour: string;
      perDay: string;
      perWeek: string;
      perMonth: string;
    };
    customAttributes: CustomAttribute[];
    tags: string[];
  }

  let {
    mode,
    collections,
    initialName = "",
    initialDescription = "",
    initialProductCode = "",
    initialParentProductCode = "",
    initialCategory = "",
    initialMoreInfoUrl = "",
    initialTermsAndConditionsUrl = "",
    initialCollectionId = "",
    initialSubscription = "",
    initialSubscriptionCurrency = "EUR",
    initialRateLimits = { perSecond: "", perMinute: "", perHour: "", perDay: "", perWeek: "", perMonth: "" },
    initialCustomAttributes = [],
    initialTags = [],
    onSubmit,
    onCancel,
    submitLabel = mode === "create" ? "Create API Product" : "Save Changes",
    submittingLabel = mode === "create" ? "Creating..." : "Saving...",
  }: {
    mode: "create" | "edit";
    collections: Array<{ api_collection_id: string; api_collection_name: string }>;
    initialName?: string;
    initialDescription?: string;
    initialProductCode?: string;
    initialParentProductCode?: string;
    initialCategory?: string;
    initialMoreInfoUrl?: string;
    initialTermsAndConditionsUrl?: string;
    initialCollectionId?: string;
    initialSubscription?: string;
    initialSubscriptionCurrency?: string;
    initialRateLimits?: { perSecond: string; perMinute: string; perHour: string; perDay: string; perWeek: string; perMonth: string };
    initialCustomAttributes?: CustomAttribute[];
    initialTags?: string[];
    onSubmit: (data: ProductFormData) => Promise<void>;
    onCancel: () => void;
    submitLabel?: string;
    submittingLabel?: string;
  } = $props();

  // Form state
  let name = $state(initialName);
  let description = $state(initialDescription);
  let productCode = $state(initialProductCode);
  let parentProductCode = $state(initialParentProductCode);
  let selectedCollectionId = $state(initialCollectionId);
  let monthlySubscriptionAmount = $state(initialSubscription);
  let monthlySubscriptionCurrency = $state(initialSubscriptionCurrency);
  let category = $state(initialCategory);
  let moreInfoUrl = $state(initialMoreInfoUrl);
  let termsAndConditionsUrl = $state(initialTermsAndConditionsUrl);
  let isSubmitting = $state(false);

  // Rate limits
  let callsPerSecond = $state(initialRateLimits.perSecond);
  let callsPerMinute = $state(initialRateLimits.perMinute);
  let callsPerHour = $state(initialRateLimits.perHour);
  let callsPerDay = $state(initialRateLimits.perDay);
  let callsPerWeek = $state(initialRateLimits.perWeek);
  let callsPerMonth = $state(initialRateLimits.perMonth);

  // Custom attributes (edit mode only)
  let customAttributes = $state<CustomAttribute[]>([...initialCustomAttributes]);

  // Tags — bound as a comma-separated string in the UI, converted to/from string[] on the wire.
  let tagsInput = $state(initialTags.join(", "));

  // Auto-generate product code from name (create mode only)
  let productCodeEdited = $state(false);

  $effect(() => {
    if (mode === "create" && !productCodeEdited) {
      productCode = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    }
  });

  function handlePerSecondChange() {
    const perSecond = parseInt(String(callsPerSecond || ""), 10);

    if (!isNaN(perSecond) && perSecond > 0) {
      callsPerMinute = String(perSecond * 60);
      callsPerHour = String(perSecond * 3600);
      callsPerDay = String(perSecond * 86400);
      callsPerWeek = String(perSecond * 604800);
      callsPerMonth = String(perSecond * 2592000);
    }
  }

  function addAttribute() {
    customAttributes = [...customAttributes, { name: "", type: "STRING", value: "" }];
  }

  function removeAttribute(index: number) {
    customAttributes = customAttributes.filter((_, i) => i !== index);
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    isSubmitting = true;

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        productCode: productCode.trim(),
        parentProductCode: parentProductCode.trim(),
        category: category.trim(),
        moreInfoUrl: moreInfoUrl.trim(),
        termsAndConditionsUrl: termsAndConditionsUrl.trim(),
        collectionId: selectedCollectionId.trim(),
        monthlySubscription: String(monthlySubscriptionAmount || "").trim(),
        monthlySubscriptionCurrency: String(monthlySubscriptionCurrency || "").trim(),
        rateLimits: {
          perSecond: String(callsPerSecond || "").trim(),
          perMinute: String(callsPerMinute || "").trim(),
          perHour: String(callsPerHour || "").trim(),
          perDay: String(callsPerDay || "").trim(),
          perWeek: String(callsPerWeek || "").trim(),
          perMonth: String(callsPerMonth || "").trim(),
        },
        customAttributes: customAttributes
          .filter((a) => a.name.trim() && a.value.trim())
          .map((a) => ({ name: a.name.trim(), type: a.type, value: a.value.trim() })),
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
      });
    } finally {
      isSubmitting = false;
    }
  }
</script>

<form onsubmit={handleSubmit} class="form">
  <!-- Row 1: Name + API Collection + Monthly Subscription -->
  <div class="form-row-3">
    <div class="form-group">
      <label for="product-name" class="form-label">
        Name
      </label>
      <input
        id="product-name"
        type="text"
        class="form-input"
        placeholder="e.g., Payments API"
        bind:value={name}
        disabled={isSubmitting}
      />
      <div class="form-help">A display name for this product</div>
    </div>

    <div class="form-group">
      <label for="api-collection" class="form-label">
        API Collection
        <span class="required">*</span>
      </label>
      {#if collections.length > 0}
        <select
          id="api-collection"
          class="form-input"
          bind:value={selectedCollectionId}
          disabled={isSubmitting}
          required
        >
          <option value="">Select an API Collection...</option>
          {#each collections as collection}
            <option value={collection.api_collection_id}>
              {collection.api_collection_name}
            </option>
          {/each}
        </select>
      {:else}
        <input
          id="api-collection"
          type="text"
          class="form-input"
          placeholder="Enter API Collection ID"
          bind:value={selectedCollectionId}
          disabled={isSubmitting}
          required
        />
      {/if}
      <div class="form-help">
        The API Collection linked to this product
      </div>
    </div>

    <div class="form-group">
      <label for="monthly-subscription" class="form-label">
        Monthly Subscription
      </label>
      <div class="subscription-row">
        <div class="input-with-prefix subscription-amount">
          <span class="input-prefix">$</span>
          <input
            id="monthly-subscription"
            type="number"
            step="0.01"
            min="0"
            class="form-input with-prefix"
            placeholder="e.g., 99.99"
            bind:value={monthlySubscriptionAmount}
            disabled={isSubmitting}
          />
        </div>
        <select
          id="monthly-subscription-currency"
          class="form-input currency-select"
          bind:value={monthlySubscriptionCurrency}
          disabled={isSubmitting}
        >
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
          <option value="GBP">GBP</option>
          <option value="CHF">CHF</option>
          <option value="JPY">JPY</option>
          <option value="CAD">CAD</option>
          <option value="AUD">AUD</option>
        </select>
      </div>
      <div class="form-help">Monthly subscription fee and currency</div>
    </div>
  </div>

  <!-- Description (full width) -->
  <div class="form-group">
    <label for="product-description" class="form-label">
      Description
    </label>
    <textarea
      id="product-description"
      class="form-textarea"
      placeholder="e.g., API product bundling payment initiation and status endpoints"
      bind:value={description}
      disabled={isSubmitting}
      rows="2"
    ></textarea>
    <div class="form-help">
      Optional description of this product
    </div>
  </div>

  <!-- Row 2: Product Code + Parent Product Code -->
  <div class="form-row-3">
    <div class="form-group">
      {#if mode === "create"}
        <label for="product-code" class="form-label">
          Product Code
          <span class="required">*</span>
        </label>
        <input
          id="product-code"
          type="text"
          class="form-input"
          placeholder="e.g., payments-api-v2"
          bind:value={productCode}
          oninput={() => (productCodeEdited = true)}
          disabled={isSubmitting}
          required
        />
        <div class="form-help">
          A unique code to identify this product
        </div>
      {:else}
        <label class="form-label">Product Code</label>
        <div class="readonly-value">{productCode}</div>
        <div class="form-help">Product code cannot be changed</div>
      {/if}
    </div>

    <div class="form-group">
      <label for="parent-product-code" class="form-label">
        Parent Product Code
      </label>
      <input
        id="parent-product-code"
        type="text"
        class="form-input"
        placeholder="e.g., banking-apis"
        bind:value={parentProductCode}
        disabled={isSubmitting}
      />
      <div class="form-help">
        Optional parent product code for hierarchy
      </div>
    </div>

    <div class="form-group">
      <label for="product-category" class="form-label">
        Category
      </label>
      <input
        id="product-category"
        type="text"
        class="form-input"
        placeholder="e.g., Payments, Accounts"
        bind:value={category}
        disabled={isSubmitting}
      />
      <div class="form-help">
        Optional category for this product
      </div>
    </div>
  </div>

  <!-- Tags -->
  <div class="form-group">
    <label for="product-tags" class="form-label">
      Tags
    </label>
    <input
      id="product-tags"
      name="tags"
      type="text"
      class="form-input"
      placeholder="e.g., featured, beta, new"
      bind:value={tagsInput}
      disabled={isSubmitting}
      data-testid="product-tags"
    />
    <div class="form-help">
      Comma-separated list. <strong>Add <code>featured</code> to surface this product in the portal.</strong>
    </div>
  </div>

  <!-- Row 3: More Info URL + Terms and Conditions URL -->
  <div class="form-row-2">
    <div class="form-group">
      <label for="more-info-url" class="form-label">
        More Info URL
      </label>
      <input
        id="more-info-url"
        type="url"
        class="form-input"
        placeholder="https://example.com/docs"
        bind:value={moreInfoUrl}
        disabled={isSubmitting}
      />
      <div class="form-help">
        Link to additional product information
      </div>
    </div>

    <div class="form-group">
      <label for="terms-url" class="form-label">
        Terms and Conditions URL
      </label>
      <input
        id="terms-url"
        type="url"
        class="form-input"
        placeholder="https://example.com/terms"
        bind:value={termsAndConditionsUrl}
        disabled={isSubmitting}
      />
      <div class="form-help">
        Link to terms and conditions
      </div>
    </div>
  </div>

  <!-- Rate Limits -->
  <div class="rate-limits-section">
    <div class="section-header">
      <div class="section-title">Rate Limits</div>
      <div class="form-help">Enter Per Second to auto-fill others, then adjust as needed</div>
    </div>
    <div class="rate-limits-grid">
      <div class="form-group">
        <label for="calls-per-second" class="form-label">Per Second</label>
        <input
          id="calls-per-second"
          type="number"
          min="0"
          class="form-input primary-input"
          placeholder="Enter"
          bind:value={callsPerSecond}
          onchange={handlePerSecondChange}
          disabled={isSubmitting}
        />
      </div>

      <div class="form-group">
        <label for="calls-per-minute" class="form-label">Per Minute</label>
        <input
          id="calls-per-minute"
          type="number"
          min="0"
          class="form-input"
          placeholder="Auto"
          bind:value={callsPerMinute}
          disabled={isSubmitting}
        />
      </div>

      <div class="form-group">
        <label for="calls-per-hour" class="form-label">Per Hour</label>
        <input
          id="calls-per-hour"
          type="number"
          min="0"
          class="form-input"
          placeholder="Auto"
          bind:value={callsPerHour}
          disabled={isSubmitting}
        />
      </div>

      <div class="form-group">
        <label for="calls-per-day" class="form-label">Per Day</label>
        <input
          id="calls-per-day"
          type="number"
          min="0"
          class="form-input"
          placeholder="Auto"
          bind:value={callsPerDay}
          disabled={isSubmitting}
        />
      </div>

      <div class="form-group">
        <label for="calls-per-week" class="form-label">Per Week</label>
        <input
          id="calls-per-week"
          type="number"
          min="0"
          class="form-input"
          placeholder="Auto"
          bind:value={callsPerWeek}
          disabled={isSubmitting}
        />
      </div>

      <div class="form-group">
        <label for="calls-per-month" class="form-label">Per Month</label>
        <input
          id="calls-per-month"
          type="number"
          min="0"
          class="form-input"
          placeholder="Auto"
          bind:value={callsPerMonth}
          disabled={isSubmitting}
        />
      </div>
    </div>
  </div>

  <!-- Additional Attributes (edit mode only) -->
  {#if mode === "edit"}
    <div class="attributes-section">
      <div class="section-header">
        <div class="section-title">Additional Attributes</div>
        <button
          type="button"
          class="btn-add-attribute"
          onclick={addAttribute}
          disabled={isSubmitting}
        >
          <Plus size={14} />
          Add Attribute
        </button>
      </div>

      {#if customAttributes.length > 0}
        <div class="attributes-list">
          {#each customAttributes as attr, index}
            <div class="attribute-row">
              <div class="form-group">
                <label for="attr-name-{index}" class="form-label">Name</label>
                <input
                  id="attr-name-{index}"
                  type="text"
                  class="form-input"
                  placeholder="Attribute name"
                  bind:value={attr.name}
                  disabled={isSubmitting}
                />
              </div>
              <div class="form-group">
                <label for="attr-type-{index}" class="form-label">Type</label>
                <select
                  id="attr-type-{index}"
                  class="form-input"
                  bind:value={attr.type}
                  disabled={isSubmitting}
                >
                  {#each ATTRIBUTE_TYPES as attrType}
                    <option value={attrType}>{attrType}</option>
                  {/each}
                </select>
              </div>
              <div class="form-group">
                <label for="attr-value-{index}" class="form-label">Value</label>
                <input
                  id="attr-value-{index}"
                  type="text"
                  class="form-input"
                  placeholder="Attribute value"
                  bind:value={attr.value}
                  disabled={isSubmitting}
                />
              </div>
              <button
                type="button"
                class="btn-remove-attribute"
                onclick={() => removeAttribute(index)}
                disabled={isSubmitting}
                title="Remove attribute"
              >
                <Trash2 size={16} />
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="no-attributes">No additional attributes. Click "Add Attribute" to add one.</p>
      {/if}
    </div>
  {/if}

  <!-- Action Buttons -->
  <div class="form-actions">
    <button
      type="button"
      class="btn-secondary"
      onclick={onCancel}
      disabled={isSubmitting}
    >
      <ArrowLeft size={16} />
      Cancel
    </button>
    <button type="submit" class="btn-primary" disabled={isSubmitting}>
      {#if isSubmitting}
        {submittingLabel}
      {:else}
        <Package size={16} />
        {submitLabel}
      {/if}
    </button>
  </div>
</form>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  .form-row-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  :global([data-mode="dark"]) .form-label {
    color: var(--color-surface-200);
  }

  .required {
    color: #dc2626;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-input:disabled,
  .form-textarea:disabled {
    background: #f9fafb;
    cursor: not-allowed;
    opacity: 0.6;
  }

  :global([data-mode="dark"]) .form-input,
  :global([data-mode="dark"]) .form-textarea {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .form-input:focus,
  :global([data-mode="dark"]) .form-textarea:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  :global([data-mode="dark"]) .form-input:disabled,
  :global([data-mode="dark"]) .form-textarea:disabled {
    background: rgb(var(--color-surface-800));
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
  }

  .form-help {
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .form-help {
    color: var(--color-surface-400);
  }

  .readonly-value {
    padding: 0.75rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #6b7280;
    font-family: ui-monospace, monospace;
  }

  :global([data-mode="dark"]) .readonly-value {
    background: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-400);
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .form-actions {
    border-top-color: rgb(var(--color-surface-700));
  }

  .btn-primary,
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-primary {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-primary:hover:not(:disabled) {
    background: rgb(var(--color-primary-700));
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-secondary {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
  }

  :global([data-mode="dark"]) .btn-secondary:hover:not(:disabled) {
    background: rgb(var(--color-surface-600));
  }

  .section-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #374151;
  }

  :global([data-mode="dark"]) .section-title {
    color: var(--color-surface-200);
  }

  .input-with-prefix {
    display: flex;
    align-items: center;
    position: relative;
  }

  .input-prefix {
    position: absolute;
    left: 0.75rem;
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 500;
    z-index: 1;
  }

  :global([data-mode="dark"]) .input-prefix {
    color: var(--color-surface-400);
  }

  .form-input.with-prefix {
    padding-left: 1.75rem;
  }

  .subscription-row {
    display: flex;
    gap: 0.5rem;
  }

  .subscription-amount {
    flex: 1;
  }

  .currency-select {
    width: 5rem;
    flex-shrink: 0;
  }

  .rate-limits-section {
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .rate-limits-section {
    border-top-color: rgb(var(--color-surface-700));
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .section-header .form-help {
    margin: 0;
  }

  .rate-limits-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.75rem;
  }

  .rate-limits-grid .form-group {
    gap: 0.25rem;
  }

  .rate-limits-grid .form-label {
    font-size: 0.75rem;
    font-weight: 500;
  }

  .rate-limits-grid .form-input {
    padding: 0.5rem 0.5rem;
    font-size: 0.8125rem;
  }

  .rate-limits-grid .form-input.primary-input {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  :global([data-mode="dark"]) .rate-limits-grid .form-input.primary-input {
    border-color: rgb(var(--color-primary-500));
    background: rgba(59, 130, 246, 0.15);
  }

  /* Attributes section (edit mode) */
  .attributes-section {
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .attributes-section {
    border-top-color: rgb(var(--color-surface-700));
  }

  .btn-add-attribute {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.75rem;
    background: #eff6ff;
    color: #3b82f6;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-add-attribute:hover:not(:disabled) {
    background: #dbeafe;
  }

  .btn-add-attribute:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-add-attribute {
    background: rgba(59, 130, 246, 0.15);
    color: rgb(var(--color-primary-400));
    border-color: rgba(59, 130, 246, 0.3);
  }

  :global([data-mode="dark"]) .btn-add-attribute:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.25);
  }

  .attributes-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .attribute-row {
    display: grid;
    grid-template-columns: 1fr 0.6fr 1fr auto;
    gap: 0.75rem;
    align-items: end;
  }

  .attribute-row .form-group {
    gap: 0.25rem;
  }

  .attribute-row .form-label {
    font-size: 0.75rem;
    font-weight: 500;
  }

  .btn-remove-attribute {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 0.5rem;
  }

  .btn-remove-attribute:hover:not(:disabled) {
    background: #fee2e2;
  }

  .btn-remove-attribute:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-remove-attribute {
    background: rgba(239, 68, 68, 0.1);
    color: rgb(var(--color-error-400));
    border-color: rgba(239, 68, 68, 0.3);
  }

  :global([data-mode="dark"]) .btn-remove-attribute:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
  }

  .no-attributes {
    font-size: 0.8125rem;
    color: #9ca3af;
    font-style: italic;
    padding: 0.5rem 0;
  }

  :global([data-mode="dark"]) .no-attributes {
    color: var(--color-surface-500);
  }

  @media (max-width: 768px) {
    .form-row-2,
    .form-row-3 {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .rate-limits-grid {
      grid-template-columns: repeat(3, 1fr);
    }

    .attribute-row {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .form-actions {
      flex-direction: column-reverse;
    }

    .btn-primary,
    .btn-secondary {
      width: 100%;
      justify-content: center;
    }

    .rate-limits-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
