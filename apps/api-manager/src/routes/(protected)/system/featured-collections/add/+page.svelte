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

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
  }

  .empty-icon {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
    color: #d1d5db;
  }

  :global([data-mode="dark"]) .empty-icon {
    color: var(--color-surface-600);
  }

  .empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #4a5568;
    margin: 0 0 0.5rem 0;
  }

  :global([data-mode="dark"]) .empty-title {
    color: var(--color-surface-300);
  }

  .empty-description {
    margin: 0 0 1.5rem 0;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-description {
    color: var(--color-surface-400);
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

  .search-bar {
    position: relative;
  }

  .search-bar :global(.search-icon) {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    pointer-events: none;
  }

  :global([data-mode="dark"]) .search-bar :global(.search-icon) {
    color: var(--color-surface-400);
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 3rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  :global([data-mode="dark"]) .search-input {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .search-input:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .collection-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
  }

  :global([data-mode="dark"]) .collection-list {
    border-color: rgb(var(--color-surface-700));
  }

  .collection-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 1rem;
    border: none;
    border-bottom: 1px solid #e5e7eb;
    background: white;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
  }

  .collection-item:last-child {
    border-bottom: none;
  }

  .collection-item:hover {
    background: #f9fafb;
  }

  .collection-item.selected {
    background: #eff6ff;
    border-color: #3b82f6;
  }

  :global([data-mode="dark"]) .collection-item {
    background: rgb(var(--color-surface-800));
    border-bottom-color: rgb(var(--color-surface-700));
  }

  :global([data-mode="dark"]) .collection-item:hover {
    background: rgb(var(--color-surface-700));
  }

  :global([data-mode="dark"]) .collection-item.selected {
    background: rgba(59, 130, 246, 0.2);
  }

  .collection-info {
    flex: 1;
  }

  .collection-name {
    font-weight: 500;
    color: #111827;
    margin-bottom: 0.25rem;
  }

  :global([data-mode="dark"]) .collection-name {
    color: var(--color-surface-100);
  }

  .collection-description {
    font-size: 0.875rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .collection-description {
    color: var(--color-surface-400);
  }

  .selected-indicator {
    padding: 0.25rem 0.75rem;
    background: #3b82f6;
    color: white;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .empty-state-small {
    padding: 2rem;
    text-align: center;
    color: #9ca3af;
  }

  :global([data-mode="dark"]) .empty-state-small {
    color: var(--color-surface-500);
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
    text-decoration: none;
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
  }
</style>
