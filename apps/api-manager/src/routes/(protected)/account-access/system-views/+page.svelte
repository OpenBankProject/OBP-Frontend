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
  import type { PageData } from "./$types";
  import { Search } from "@lucide/svelte";

  let { data } = $props<{ data: PageData }>();

  let views = $derived(data.views || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  // Search functionality
  let searchQuery = $state("");

  let filteredViews = $derived.by(() => {
    if (!searchQuery.trim()) {
      return views;
    }
    const query = searchQuery.toLowerCase();
    return views.filter(
      (view: any) =>
        view.short_name.toLowerCase().includes(query) ||
        view.description.toLowerCase().includes(query) ||
        view.view_id.toLowerCase().includes(query),
    );
  });

  function handleCreateView() {
    goto("/account-access/system-views/create");
  }
</script>

<svelte:head>
  <title>System Views - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div>
          <h1 class="panel-title">System Views</h1>
          <div class="panel-subtitle">
            System-defined views that control account data visibility
            ({views.length} total, {views.filter((v: any) => v.is_public).length} public)
          </div>
        </div>
        <div class="header-controls">
          <button
            onclick={handleCreateView}
            data-testid="create-system-view-btn"
            class="rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 preset-filled-primary-500"
          >
            Create System View
          </button>
        </div>
      </div>
    </div>

    <div class="panel-content">
      {#if error}
        <div class="error-message">
          <p>{error}</p>
        </div>
      {/if}

      {#if views.length === 0}
        <div class="empty-state">
          <h4 class="empty-title">No Views Found</h4>
          <p class="empty-description">
            No views available. You may need to create views or have specific permissions.
          </p>
        </div>
      {:else}
        <!-- Search Bar -->
        <div class="search-bar">
          <Search class="search-icon" size={16} />
          <input
            type="text"
            class="search-input"
            name="search-views"
            data-testid="search-views"
            placeholder="Search views..."
            bind:value={searchQuery}
          />
          {#if searchQuery}
            <span class="search-count">{filteredViews.length} of {views.length}</span>
          {/if}
        </div>

        <!-- Views Table -->
        {#if filteredViews.length === 0}
          <p class="no-results">No views match your search.</p>
        {:else}
          <table class="views-table" data-testid="system-views-table">
            <thead>
              <tr>
                <th>View ID</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredViews as view}
                <tr data-testid="view-row-{view.view_id}">
                  <td class="cell-mono">
                    <a href="/account-access/system-views/{view.view_id}" class="view-link" data-testid="view-link-{view.view_id}">
                      {view.view_id}
                    </a>
                  </td>
                  <td class="cell-description">{view.description}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1400px;
  }

  .panel {
    background: var(--ui-card);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .panel-header {
    padding: 1rem 1.5rem;
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
    font-size: 0.813rem;
    color: var(--ui-muted);
    margin-top: 0.25rem;
  }

  .panel-content {
    padding: 1rem 1.5rem;
  }

  .error-message {
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    background: var(--ui-tone-error-bg);
    border: 1px solid var(--ui-tone-error-border);
    border-radius: 6px;
    color: var(--ui-tone-error-text);
    font-size: 0.875rem;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--ui-muted);
  }

  .empty-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--ui-muted);
    margin: 0 0 0.5rem 0;
  }

  .empty-description {
    margin: 0;
    color: var(--ui-muted);
    font-size: 0.875rem;
  }

  .search-bar {
    position: relative;
    margin-bottom: 1rem;
  }

  .search-bar :global(.search-icon) {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--ui-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.5rem 0.75rem 0.5rem 2.25rem;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    font-size: 0.813rem;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-link) 10%, transparent);
  }

  .search-count {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.75rem;
    color: var(--ui-muted);
  }

  .no-results {
    text-align: center;
    color: var(--ui-muted);
    font-size: 0.875rem;
    padding: 1rem 0;
  }

  .views-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.813rem;
  }

  .views-table thead {
    border-bottom: 2px solid var(--ui-border);
  }

  .views-table th {
    text-align: left;
    padding: 0.5rem 0.75rem;
    font-weight: 600;
    color: var(--ui-muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .views-table td {
    padding: 0.5rem 0.75rem;
    color: var(--ui-text);
    border-bottom: 1px solid var(--ui-border);
    vertical-align: top;
  }

  .views-table tbody tr:hover {
    background: var(--ui-hover);
  }

  .view-link {
    color: var(--ui-link);
    text-decoration: none;
    font-weight: 500;
    white-space: nowrap;
  }

  .view-link:hover {
    text-decoration: underline;
  }

  .cell-mono {
    font-family: monospace;
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .cell-description {
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cell-center {
    text-align: center;
  }

  :global(.icon-public) {
    color: var(--ui-success);
  }

  .text-muted {
    color: var(--ui-muted);
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .views-table {
      display: block;
      overflow-x: auto;
    }

    .cell-description {
      max-width: 200px;
    }
  }
</style>
