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
  import { FileSignature, ArrowLeft, Save } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  let bank_id = $derived(page.params.bank_id || "");
  let account_id = $derived(page.params.account_id || "");

  // Form state
  let formData = $state({
    mandate_name: "",
    mandate_reference: "",
    customer_id: "",
    description: "",
    legal_text: "",
    status: "DRAFT",
    valid_from: "",
    valid_to: "",
  });

  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);
  let submitSuccess = $state(false);
  let submitAttempted = $state(false);

  // Validation
  let validationErrors = $derived.by(() => {
    const errors: string[] = [];
    if (!formData.mandate_name || formData.mandate_name.trim().length === 0)
      errors.push("Mandate name is required");
    if (!formData.mandate_reference || formData.mandate_reference.trim().length === 0)
      errors.push("Mandate reference is required");
    if (!formData.description || formData.description.trim().length === 0)
      errors.push("Description is required");
    return errors;
  });

  let isValid = $derived(validationErrors.length === 0);

  async function handleSubmit(e: Event) {
    e.preventDefault();

    submitAttempted = true;
    if (!isValid || isSubmitting) return;

    isSubmitting = true;
    submitError = null;
    submitSuccess = false;

    try {
      const payload: Record<string, string> = {
        mandate_name: formData.mandate_name.trim(),
        mandate_reference: formData.mandate_reference.trim(),
        description: formData.description.trim(),
        status: formData.status,
      };

      if (formData.customer_id.trim()) {
        payload.customer_id = formData.customer_id.trim();
      }
      if (formData.legal_text.trim()) {
        payload.legal_text = formData.legal_text.trim();
      }
      if (formData.valid_from) {
        payload.valid_from = new Date(formData.valid_from).toISOString();
      }
      if (formData.valid_to) {
        payload.valid_to = new Date(formData.valid_to).toISOString();
      }

      const response = await trackedFetch(
        `/proxy/obp/v6.0.0/banks/${encodeURIComponent(bank_id)}/accounts/${encodeURIComponent(account_id)}/mandates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      const result = await response.json();
      submitSuccess = true;

      setTimeout(() => {
        goto(`/mandates/${encodeURIComponent(bank_id)}/${encodeURIComponent(account_id)}/${result.mandate_id}`);
      }, 2500);
    } catch (err) {
      submitError =
        err instanceof Error ? err.message : "Failed to create mandate";
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Create Mandate - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb -->
  <nav class="breadcrumb mb-6" data-testid="breadcrumb">
    <a href="/mandates" class="breadcrumb-link">Mandates</a>
    <span class="breadcrumb-separator">&rsaquo;</span>
    <a href="/mandates/{bank_id}/{account_id}" class="breadcrumb-link">{bank_id} / {account_id}</a>
    <span class="breadcrumb-separator">&rsaquo;</span>
    <span class="breadcrumb-current">Create</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <FileSignature size={32} />
          </div>
          <div>
            <h1 class="panel-title">Create Mandate</h1>
            <div class="panel-subtitle">
              Create a new mandate for account {account_id}
            </div>
          </div>
        </div>
        <div class="header-actions">
          <a href="/mandates/{bank_id}/{account_id}" class="btn-secondary" data-testid="back-button">
            <ArrowLeft size={16} />
            Back
          </a>
        </div>
      </div>
    </div>

    <div class="panel-content">
      {#if submitError}
        <div class="error-message" data-testid="submit-error">
          <p>{submitError}</p>
        </div>
      {/if}

      {#if submitSuccess}
        <div class="success-message" data-testid="submit-success">
          <div style="display: flex; align-items: center; gap: 0.75rem; font-size: 1.1rem;">
            <svg
              style="width: 24px; height: 24px; color: #10b981;"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <span><strong>Success!</strong> Mandate created successfully. Redirecting to mandate details...</span>
          </div>
        </div>
      {/if}

      <form onsubmit={handleSubmit} class="form" data-testid="create-mandate-form">
        <!-- Basic Information Section -->
        <section class="form-section">
          <h2 class="section-title">
            <FileSignature size={20} />
            Mandate Details
          </h2>

          <div class="form-grid">
            <div class="form-group">
              <label for="mandate_name" class="form-label">
                Mandate Name <span class="required">*</span>
              </label>
              <input
                type="text"
                id="mandate_name"
                class="form-input"
                name="mandate_name"
                data-testid="mandate-name-input"
                bind:value={formData.mandate_name}
                placeholder="e.g., ACME Corp Operating Account Authority"
                required
              />
            </div>

            <div class="form-group">
              <label for="mandate_reference" class="form-label">
                Mandate Reference <span class="required">*</span>
              </label>
              <input
                type="text"
                id="mandate_reference"
                class="form-input"
                name="mandate_reference"
                data-testid="mandate-reference-input"
                bind:value={formData.mandate_reference}
                placeholder="e.g., MND-2026-00042"
                required
              />
            </div>

            <div class="form-group">
              <label for="customer_id" class="form-label">
                Customer ID
              </label>
              <input
                type="text"
                id="customer_id"
                class="form-input"
                name="customer_id"
                data-testid="customer-id-input"
                bind:value={formData.customer_id}
                placeholder="e.g., customer-id-123"
              />
            </div>

            <div class="form-group">
              <label for="status" class="form-label">
                Status
              </label>
              <select
                id="status"
                class="form-select"
                name="status"
                data-testid="status-select"
                bind:value={formData.status}
              >
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>
            </div>

            <div class="form-group full-width">
              <label for="description" class="form-label">
                Description <span class="required">*</span>
              </label>
              <textarea
                id="description"
                class="form-textarea"
                name="description"
                data-testid="description-input"
                bind:value={formData.description}
                placeholder="Describe the purpose of this mandate..."
                rows="3"
                required
              ></textarea>
            </div>

            <div class="form-group full-width">
              <label for="legal_text" class="form-label">
                Legal Text
              </label>
              <textarea
                id="legal_text"
                class="form-textarea"
                name="legal_text"
                data-testid="legal-text-input"
                bind:value={formData.legal_text}
                placeholder="The following persons are authorised..."
                rows="5"
              ></textarea>
            </div>

            <div class="form-group">
              <label for="valid_from" class="form-label">
                Valid From
              </label>
              <input
                type="date"
                id="valid_from"
                class="form-input"
                name="valid_from"
                data-testid="valid-from-input"
                bind:value={formData.valid_from}
              />
            </div>

            <div class="form-group">
              <label for="valid_to" class="form-label">
                Valid To
              </label>
              <input
                type="date"
                id="valid_to"
                class="form-input"
                name="valid_to"
                data-testid="valid-to-input"
                bind:value={formData.valid_to}
              />
            </div>
          </div>
        </section>

        <!-- Validation Errors -->
        {#if submitAttempted && validationErrors.length > 0}
          <div class="validation-errors" data-testid="validation-errors">
            <h3>Please fix the following errors:</h3>
            <ul>
              {#each validationErrors as error}
                <li>{error}</li>
              {/each}
            </ul>
          </div>
        {/if}

        <!-- Form Actions -->
        <div class="form-actions">
          {#if submitAttempted && !isValid && validationErrors.length > 0}
            <div class="form-status" data-testid="form-status">
              Missing: {validationErrors.join(", ")}
            </div>
          {/if}
          <button
            type="submit"
            class="btn-primary"
            data-testid="submit-create-mandate"
            disabled={!isValid || isSubmitting}
          >
            {#if isSubmitting}
              <span class="spinner">&#8987;</span>
              Creating Mandate...
            {:else if submitSuccess}
              <svg
                style="width: 18px; height: 18px;"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              Created Successfully
            {:else}
              <Save size={18} />
              Create Mandate
            {/if}
          </button>
          <a href="/mandates/{bank_id}/{account_id}" class="btn-secondary" data-testid="cancel-button">
            Cancel
          </a>
        </div>
      </form>
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1400px;
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
    transition: color 0.2s;
  }

  .breadcrumb-link:hover {
    color: #2563eb;
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
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
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
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.5rem;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.2s;
    cursor: pointer;
  }

  .btn-secondary:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  :global([data-mode="dark"]) .btn-secondary {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
    border-color: rgb(var(--color-surface-600));
  }

  :global([data-mode="dark"]) .btn-secondary:hover {
    background: rgb(var(--color-surface-600));
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

  .success-message {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #d1fae5;
    border: 1px solid #a7f3d0;
    border-radius: 6px;
    color: #065f46;
    font-size: 0.875rem;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .success-message {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.4);
    color: rgb(var(--color-success-200));
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .form-section {
    padding-bottom: 2rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .form-section:last-child {
    border-bottom: none;
  }

  :global([data-mode="dark"]) .form-section {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  :global([data-mode="dark"]) .section-title {
    color: var(--color-surface-100);
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group.full-width {
    grid-column: 1 / -1;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  :global([data-mode="dark"]) .form-label {
    color: var(--color-surface-200);
  }

  .required {
    color: #ef4444;
  }

  .form-input,
  .form-select,
  .form-textarea {
    padding: 0.625rem 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
    background: white;
    color: #111827;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  :global([data-mode="dark"]) .form-input,
  :global([data-mode="dark"]) .form-select,
  :global([data-mode="dark"]) .form-textarea {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .form-input:focus,
  :global([data-mode="dark"]) .form-select:focus,
  :global([data-mode="dark"]) .form-textarea:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .form-textarea {
    resize: vertical;
    font-family: inherit;
  }

  .validation-errors {
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .validation-errors {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: rgb(var(--color-error-200));
  }

  .validation-errors h3 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .validation-errors ul {
    margin: 0;
    padding-left: 1.5rem;
    font-size: 0.875rem;
  }

  .validation-errors li {
    margin: 0.25rem 0;
  }

  .form-status {
    font-size: 0.813rem;
    color: #b45309;
    padding: 0.5rem 0;
  }

  :global([data-mode="dark"]) .form-status {
    color: #fbbf24;
  }

  .form-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .form-actions {
    border-top-color: rgb(var(--color-surface-700));
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .btn-primary:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-primary {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-primary:hover:not(:disabled) {
    background: rgb(var(--color-primary-500));
  }

  .spinner {
    display: inline-block;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .header-left {
      width: 100%;
    }

    .header-actions {
      width: 100%;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
