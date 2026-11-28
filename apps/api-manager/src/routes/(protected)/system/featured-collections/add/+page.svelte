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
  import { Star, ArrowLeft, Search } from "@lucide/svelte";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  let { data } = $props<{ data: PageData }>();

  let collections = $derived(data.collections || []);
  let featuredIds = $derived(data.featuredIds || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);
  // Filter out already featured collections
  let availableCollections = $derived(
    collections.filter((c: any) => !featuredIds.includes(c.api_collection_id)),
  );

  // Search and form state
  let searchQuery = $state("");
  let selectedCollectionId = $state("");
  let sortOrder = $state(1);
  let isSubmitting = $state(false);

  let filteredCollections = $derived.by(() => {
    if (!searchQuery.trim()) {
      return availableCollections;
    }
    const query = searchQuery.toLowerCase();
    return availableCollections.filter(
      (collection: any) =>
        collection.api_collection_name.toLowerCase().includes(query) ||
        (collection.description &&
          collection.description.toLowerCase().includes(query)),
    );
  });

  function selectCollection(collectionId: string) {
    selectedCollectionId = collectionId;
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!selectedCollectionId) {
      toast.error("Validation Error", "Please select a collection");
      return;
    }

    if (sortOrder < 1) {
      toast.error("Validation Error", "Sort order must be at least 1");
      return;
    }

    isSubmitting = true;

    try {
      const requestBody = {
        api_collection_id: selectedCollectionId,
        sort_order: sortOrder,
      };

      const response = await trackedFetch("/backend/featured-collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message,
        );
      }

      toast.success("Featured Added", "Collection added to featured list");

      // Redirect to featured collections list after short delay
      setTimeout(() => {
        goto("/system/featured-collections");
      }, 1000);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to add collection to featured";
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
  <title>Add Featured Collection - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb mb-6">
    <a href="/system/featured-collections" class="breadcrumb-link"
      >Featured Collections</a
    >
    <span class="breadcrumb-separator">></span>
    <span class="breadcrumb-current">Add Featured</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-icon">
          <Star size={32} />
        </div>
        <div>
          <h1 class="panel-title">Add Featured Collection</h1>
          <div class="panel-subtitle">
            Select a collection to add to the featured list
          </div>
        </div>
      </div>
    </div>

    <div class="panel-content">
      {#if error && !hasApiAccess}
        <div class="error-message">
          <p>{error}</p>
        </div>
      {:else if availableCollections.length === 0}
        <div class="empty-state">
          <div class="empty-icon">
            <Star size={48} />
          </div>
          <h4 class="empty-title">No collections available</h4>
          <p class="empty-description">
            All collections are already featured, or no collections exist
          </p>
          <a href="/system/featured-collections" class="btn-secondary">
            <ArrowLeft size={16} />
            Back to Featured Collections
          </a>
        </div>
      {:else}
        <form onsubmit={handleSubmit} class="form">
          <!-- Search Collections -->
          <div class="form-group">
            <label class="form-label">
              Select Collection
              <span class="required">*</span>
            </label>
            <div class="search-bar">
              <Search class="search-icon" size={18} />
              <input
                type="text"
                class="search-input"
                placeholder="Search collections..."
                bind:value={searchQuery}
              />
            </div>
          </div>

          <!-- Collection List -->
          <div class="collection-list">
            {#if filteredCollections.length === 0}
              <div class="empty-state-small">
                <p>No collections match your search</p>
              </div>
            {:else}
              {#each filteredCollections as collection}
                <button
                  type="button"
                  class="collection-item"
                  class:selected={selectedCollectionId ===
                    collection.api_collection_id}
                  onclick={() => selectCollection(collection.api_collection_id)}
                >
                  <div class="collection-info">
                    <div class="collection-name">
                      {collection.api_collection_name}
                    </div>
                    <div class="collection-description">
                      {collection.description || "No description"}
                    </div>
                  </div>
                  {#if selectedCollectionId === collection.api_collection_id}
                    <div class="selected-indicator">Selected</div>
                  {/if}
                </button>
              {/each}
            {/if}
          </div>

          <!-- Sort Order -->
          <div class="form-group">
            <label for="sort-order" class="form-label">
              Sort Order
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
            <button
              type="submit"
              class="btn-primary"
              disabled={isSubmitting || !selectedCollectionId}
            >
              {#if isSubmitting}
                Adding...
              {:else}
                <Star size={16} />
                Add to Featured
              {/if}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 800px;
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

  .error-message {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--ui-tone-error-bg);
    border: 1px solid var(--ui-tone-error-border);
    border-radius: 6px;
    color: var(--ui-tone-error-text);
    font-size: 0.875rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--ui-muted);
  }

  .empty-icon {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
    color: var(--ui-muted);
  }

  .empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--ui-muted);
    margin: 0 0 0.5rem 0;
  }

  .empty-description {
    margin: 0 0 1.5rem 0;
    color: var(--ui-muted);
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

  .search-bar {
    position: relative;
  }

  .search-bar :global(.search-icon) {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--ui-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 3rem;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-link) 10%, transparent);
  }

  .collection-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
  }

  .collection-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 1rem;
    border: none;
    border-bottom: 1px solid var(--ui-border);
    background: var(--ui-card);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
  }

  .collection-item:last-child {
    border-bottom: none;
  }

  .collection-item:hover {
    background: var(--ui-hover);
  }

  .collection-item.selected {
    background: var(--ui-tone-info-bg);
    border-color: var(--ui-tone-info-border);
  }

  .collection-info {
    flex: 1;
  }

  .collection-name {
    font-weight: 500;
    color: var(--ui-text);
    margin-bottom: 0.25rem;
  }

  .collection-description {
    font-size: 0.875rem;
    color: var(--ui-muted);
  }

  .selected-indicator {
    padding: 0.25rem 0.75rem;
    background: var(--ui-fill-main-bg);
    color: var(--ui-fill-main-text);
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .empty-state-small {
    padding: 2rem;
    text-align: center;
    color: var(--ui-muted);
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
    text-decoration: none;
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
  }
</style>
