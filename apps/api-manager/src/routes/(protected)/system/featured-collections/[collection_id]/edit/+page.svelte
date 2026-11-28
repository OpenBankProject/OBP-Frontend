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
    color: var(--ui-link);
    text-decoration: none;
  }

  .breadcrumb-link:hover {
    text-decoration: underline;
  }

  .breadcrumb-separator {
    color: var(--ui-muted);
  }

  .breadcrumb-current {
    color: var(--ui-muted);
  }

  .error-message {
    padding: 1rem;
    background: var(--ui-tone-error-bg);
    border: 1px solid var(--ui-tone-error-border);
    border-radius: 6px;
    color: var(--ui-tone-error-text);
    font-size: 0.875rem;
  }

  .panel {
    background: var(--ui-card);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .panel-header {
    padding: 2rem;
    border-bottom: 1px solid var(--ui-border);
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
    background: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
    border-radius: 12px;
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--ui-text);
    margin: 0;
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: var(--ui-muted);
    margin-top: 0.25rem;
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
    color: var(--ui-text);
    margin: 0 0 1rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid var(--ui-border);
  }

  .detail-card {
    background: var(--ui-card);
    border: 1px solid var(--ui-border);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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
    color: var(--ui-muted);
  }

  .detail-value {
    font-size: 0.875rem;
    color: var(--ui-text);
    word-break: break-word;
  }

  .detail-value.code {
    font-family: monospace;
    background: var(--ui-panel);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8125rem;
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
    color: var(--ui-text);
  }

  .required {
    color: var(--ui-error);
  }

  .form-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-link) 10%, transparent);
  }

  .form-input:disabled {
    background: var(--ui-card);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .form-help {
    font-size: 0.75rem;
    color: var(--ui-muted);
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid var(--ui-border);
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
    background: var(--ui-fill-main-bg);
    color: var(--ui-fill-main-text);
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.85;
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--ui-panel);
    color: var(--ui-text);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--ui-hover);
  }

  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
