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
  import { Star, Plus, Search, Edit, Trash2, ArrowUpDown } from "@lucide/svelte";

  let { data } = $props<{ data: PageData }>();

  let featuredCollections = $derived(data.featuredCollections || []);
  let collectionsMap = $derived(data.collectionsMap || {});
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);
  // Search functionality
  let searchQuery = $state("");

  // Sort featured collections by sort_order
  let sortedCollections = $derived.by(() => {
    return [...featuredCollections].sort((a, b) => a.sort_order - b.sort_order);
  });

  let filteredCollections = $derived.by(() => {
    if (!searchQuery.trim()) {
      return sortedCollections;
    }
    const query = searchQuery.toLowerCase();
    return sortedCollections.filter((featured: any) => {
      const collection = collectionsMap[featured.api_collection_id];
      if (!collection) return false;
      return (
        collection.api_collection_name.toLowerCase().includes(query) ||
        (collection.description &&
          collection.description.toLowerCase().includes(query))
      );
    });
  });

  function getCollectionName(collectionId: string): string {
    const collection = collectionsMap[collectionId];
    return collection?.api_collection_name || collectionId;
  }

  function getCollectionDescription(collectionId: string): string {
    const collection = collectionsMap[collectionId];
    return collection?.description || "No description";
  }
</script>

<svelte:head>
  <title>Featured Collections - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div>
          <h1 class="panel-title">Featured Collections</h1>
          <div class="panel-subtitle">
            Manage featured API collections that are highlighted to all users
          </div>
        </div>
        <a href="/system/featured-collections/add" class="btn-primary">
          <Plus size={16} />
          Add Featured
        </a>
      </div>
    </div>

    <div class="panel-content">
      {#if error && !hasApiAccess}
        <div class="error-message">
          <p>{error}</p>
        </div>
      {:else if featuredCollections.length === 0}
        <div class="empty-state">
          <div class="empty-icon">
            <Star size={48} />
          </div>
          <h4 class="empty-title">No featured collections yet</h4>
          <p class="empty-description">
            Add collections to the featured list to highlight them to all users
          </p>
          <a href="/system/featured-collections/add" class="btn-primary">
            <Plus size={16} />
            Add First Featured Collection
          </a>
        </div>
      {:else}
        <!-- Search Bar -->
        <div class="search-bar">
          <Search class="search-icon" size={18} />
          <input
            type="text"
            class="search-input"
            placeholder="Search featured collections..."
            bind:value={searchQuery}
          />
        </div>

        <!-- Stats -->
        <div class="stats">
          <div class="stat-item">
            <div class="stat-label">Total Featured</div>
            <div class="stat-value">{featuredCollections.length}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Showing</div>
            <div class="stat-value">{filteredCollections.length}</div>
          </div>
        </div>

        <!-- Featured Collections Table -->
        {#if filteredCollections.length === 0}
          <div class="empty-state">
            <div class="empty-icon">
              <Search size={48} />
            </div>
            <h4 class="empty-title">No collections found</h4>
            <p class="empty-description">Try adjusting your search query</p>
          </div>
        {:else}
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="th-order">
                    <ArrowUpDown size={14} />
                    Order
                  </th>
                  <th class="th-name">Collection Name</th>
                  <th class="th-description">Description</th>
                  <th class="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredCollections as featured}
                  <tr>
                    <td class="td-order">
                      <span class="order-badge">{featured.sort_order}</span>
                    </td>
                    <td class="td-name">
                      {getCollectionName(featured.api_collection_id)}
                    </td>
                    <td class="td-description">
                      {getCollectionDescription(featured.api_collection_id)}
                    </td>
                    <td class="td-actions">
                      <a
                        href="/system/featured-collections/{featured.api_collection_id}/edit"
                        class="btn-icon"
                        title="Edit sort order"
                      >
                        <Edit size={16} />
                      </a>
                      <a
                        href="/system/featured-collections/{featured.api_collection_id}/delete"
                        class="btn-icon danger"
                        title="Remove from featured"
                      >
                        <Trash2 size={16} />
                      </a>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1200px;
  }

  .panel {
    background: var(--ui-card);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .panel-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--ui-border);
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .panel-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0;
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: var(--ui-muted);
    margin-top: 0.5rem;
  }

  .panel-content {
    padding: 2rem;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--ui-fill-main-bg);
    color: var(--ui-fill-main-text);
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    white-space: nowrap;
  }

  .btn-primary:hover {
    opacity: 0.85;
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

  .search-bar {
    position: relative;
    margin-bottom: 1.5rem;
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

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-item {
    padding: 1rem;
    background: var(--ui-card);
    border-radius: 6px;
    border: 1px solid var(--ui-border);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--ui-muted);
    margin-bottom: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--ui-text);
  }

  .table-container {
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
  }

  .data-table th,
  .data-table td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid var(--ui-border);
  }

  .data-table th {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ui-muted);
    background: var(--ui-card);
  }

  .data-table tr:hover {
    background: var(--ui-hover);
  }

  .th-order {
    width: 100px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .th-name {
    min-width: 200px;
  }

  .th-description {
    min-width: 200px;
  }

  .th-actions {
    width: 120px;
    text-align: center;
  }

  .td-order {
    text-align: center;
  }

  .order-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
    border-radius: 50%;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .td-name {
    font-weight: 500;
    color: var(--ui-text);
  }

  .td-description {
    color: var(--ui-muted);
    font-size: 0.875rem;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .td-actions {
    text-align: center;
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    background: var(--ui-panel);
    color: var(--ui-text);
    margin: 0 0.25rem;
  }

  .btn-icon:hover {
    background: var(--ui-hover);
  }

  .btn-icon.danger {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
  }

  .btn-icon.danger:hover {
    background: var(--ui-tone-error-bg);
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .btn-primary {
      width: 100%;
      justify-content: center;
    }

    .stats {
      grid-template-columns: 1fr;
    }
  }
</style>
