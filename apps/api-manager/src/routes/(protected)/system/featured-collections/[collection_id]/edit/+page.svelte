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
  import { Star, ArrowLeft, Save } from "@lucide/svelte";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  let { data } = $props<{ data: PageData }>();

  let featured = $derived(data.featured);
  let collection = $derived(data.collection);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);
  // Form state
  let sortOrder = $state(data.featured?.sort_order || 1);
  let isSubmitting = $state(false);

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!featured) return;

    if (sortOrder < 1) {
      toast.error("Validation Error", "Sort order must be at least 1");
      return;
    }

    isSubmitting = true;

    try {
      const requestBody = {
        sort_order: sortOrder,
      };

      const response = await trackedFetch(
        `/backend/featured-collections/${featured.api_collection_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      toast.success("Sort Order Updated", "Featured collection sort order updated");

      // Redirect to featured collections list after short delay
      setTimeout(() => {
        goto("/system/featured-collections");
      }, 1000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update sort order";
      toast.error("Error", errorMessage);
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    goto("/system/featured-collections");
  }
</script>

<svelte:head>
  <title>Edit Featured Collection - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb mb-6">
    <a href="/system/featured-collections" class="breadcrumb-link"
      >Featured Collections</a
    >
    <span class="breadcrumb-separator">></span>
    <span class="breadcrumb-current">Edit Sort Order</span>
  </nav>

  {#if error && !hasApiAccess}
    <div class="error-message">
      <p>{error}</p>
    </div>
  {:else if !featured}
    <div class="error-message">
      <p>Featured collection not found</p>
    </div>
  {:else}
    <div class="panel">
      <div class="panel-header">
        <div class="header-content">
          <div class="header-icon">
            <Star size={32} />
          </div>
          <div>
            <h1 class="panel-title">Edit Sort Order</h1>
            <div class="panel-subtitle">
              Update the display order for this featured collection
            </div>
          </div>
        </div>
      </div>

      <div class="panel-content">
        <!-- Collection Info -->
        <div class="info-section">
          <h2 class="section-title">Collection Details</h2>
          <div class="detail-card">
            <div class="detail-row">
              <div class="detail-label">Collection Name</div>
              <div class="detail-value">
                {collection?.api_collection_name || featured.api_collection_id}
              </div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Collection ID</div>
              <div class="detail-value code">{featured.api_collection_id}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Current Sort Order</div>
              <div class="detail-value">{featured.sort_order}</div>
            </div>
          </div>
        </div>

        <form onsubmit={handleSubmit} class="form">
          <!-- Sort Order -->
          <div class="form-group">
            <label for="sort-order" class="form-label">
              New Sort Order
              <span class="required">*</span>
            </label>
            <input
              id="sort-order"
              type="number"
              class="form-input"
              min="1"
              bind:value={sortOrder}
              disabled={isSubmitting}
              required
            />
            <div class="form-help">
              Lower numbers appear first in the featured list
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="form-actions">
            <button
              type="button"
              class="btn-secondary"
              onclick={handleCancel}
              disabled={isSubmitting}
            >
              <ArrowLeft size={16} />
              Cancel
            </button>
            <button type="submit" class="btn-primary" disabled={isSubmitting}>
              {#if isSubmitting}
                Saving...
              {:else}
                <Save size={16} />
                Save Changes
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 600px;
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

  .error-message {
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
    background: #fef3c7;
    color: #f59e0b;
    border-radius: 12px;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .header-icon {
    background: rgba(245, 158, 11, 0.2);
    color: rgb(var(--color-warning-400));
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

  .info-section {
    margin-bottom: 2rem;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .section-title {
    color: var(--color-surface-100);
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .detail-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  :global([data-mode="dark"]) .detail-card {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  .detail-row {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 1rem;
    align-items: flex-start;
  }

  .detail-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .detail-label {
    color: var(--color-surface-400);
  }

  .detail-value {
    font-size: 0.875rem;
    color: #111827;
    word-break: break-word;
  }

  :global([data-mode="dark"]) .detail-value {
    color: var(--color-surface-200);
  }

  .detail-value.code {
    font-family: monospace;
    background: #f3f4f6;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8125rem;
  }

  :global([data-mode="dark"]) .detail-value.code {
    background: rgb(var(--color-surface-800));
  }

  .form {
    display: flex;
    flex-direction: column;
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

  .form-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-input:disabled {
    background: #f9fafb;
    cursor: not-allowed;
    opacity: 0.6;
  }

  :global([data-mode="dark"]) .form-input {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .form-input:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  :global([data-mode="dark"]) .form-input:disabled {
    background: rgb(var(--color-surface-800));
  }

  .form-help {
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .form-help {
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

  @media (max-width: 640px) {
    .form-actions {
      flex-direction: column-reverse;
    }

    .btn-primary,
    .btn-secondary {
      width: 100%;
      justify-content: center;
    }

    .header-content {
      flex-direction: column;
      text-align: center;
    }

    .detail-row {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
  }
</style>
