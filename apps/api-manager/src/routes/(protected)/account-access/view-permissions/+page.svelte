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
  import { Shield, Search } from "@lucide/svelte";

  let { data } = $props<{ data: PageData }>();

  let permissionsByCategory = $derived(data.permissionsByCategory || []);
  let totalCount = $derived(data.totalCount || 0);
  let error = $derived(data.error);

  let searchQuery = $state("");

  let filteredCategories = $derived.by(() => {
    if (!searchQuery.trim()) {
      return permissionsByCategory;
    }
    const query = searchQuery.toLowerCase();
    return permissionsByCategory
      .map((group: any) => ({
        ...group,
        permissions: group.permissions.filter((p: string) =>
          p.toLowerCase().includes(query),
        ),
      }))
      .filter((group: any) => group.permissions.length > 0);
  });

  let filteredCount = $derived(
    filteredCategories.reduce(
      (sum: number, g: any) => sum + g.permissions.length,
      0,
    ),
  );
</script>

<svelte:head>
  <title>View Permissions - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Shield size={32} />
          </div>
          <div>
            <h1 class="panel-title">View Permissions</h1>
            <div class="panel-subtitle">
              All available permissions that can be assigned to views ({totalCount}
              total)
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel-content">
      {#if error}
        <div class="error-message">
          <p>{error}</p>
        </div>
      {:else}
        <!-- Search -->
        <div class="search-bar">
          <Search class="search-icon" size={18} />
          <input
            type="text"
            class="search-input"
            name="search"
            data-testid="permission-search"
            placeholder="Search permissions..."
            bind:value={searchQuery}
          />
        </div>

        <!-- Stats -->
        <div class="stats">
          <div class="stat-item">
            <div class="stat-label">Total Permissions</div>
            <div class="stat-value">{totalCount}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Categories</div>
            <div class="stat-value">{permissionsByCategory.length}</div>
          </div>
          {#if searchQuery.trim()}
            <div class="stat-item">
              <div class="stat-label">Matching</div>
              <div class="stat-value">{filteredCount}</div>
            </div>
          {/if}
        </div>

        <!-- Grouped Permissions -->
        {#if filteredCategories.length === 0}
          <div class="empty-state">
            <Search size={48} />
            <p>No permissions match your search</p>
          </div>
        {:else}
          <div class="permission-groups">
            {#each filteredCategories as group}
              <div class="permission-group" data-testid="category-{group.category}">
                <div class="group-header">
                  <span class="group-label">{group.category}</span>
                  <span class="group-count">{group.permissions.length}</span>
                </div>
                <div class="permissions-grid">
                  {#each group.permissions as permission}
                    <div
                      class="permission-item"
                      data-testid="perm-{permission}"
                    >
                      <span class="permission-label">{permission}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
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
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  :global([data-mode="dark"]) .panel {
    background: rgb(var(--color-surface-800));
  }

  .panel-header {
    padding: 1.5rem 2rem;
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
    gap: 1.5rem;
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
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .panel-content {
    padding: 2rem;
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

  .search-bar {
    position: relative;
    margin-bottom: 1.5rem;
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

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-item {
    padding: 1rem;
    background: #f9fafb;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .stat-item {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  .stat-label {
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .stat-label {
    color: var(--color-surface-400);
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
  }

  :global([data-mode="dark"]) .stat-value {
    color: var(--color-surface-100);
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #9ca3af;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-500);
  }

  .permission-groups {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .permission-group {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }

  :global([data-mode="dark"]) .permission-group {
    border-color: rgb(var(--color-surface-700));
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.625rem 1rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .group-header {
    background: rgb(var(--color-surface-900));
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .group-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  :global([data-mode="dark"]) .group-label {
    color: var(--color-surface-200);
  }

  .group-count {
    font-size: 0.75rem;
    color: #6b7280;
    background: #e5e7eb;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .group-count {
    color: var(--color-surface-300);
    background: rgb(var(--color-surface-700));
  }

  .permissions-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.25rem;
    padding: 0.5rem;
  }

  .permission-item {
    display: flex;
    align-items: center;
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
  }

  .permission-label {
    font-size: 0.813rem;
    color: #374151;
    font-weight: 500;
  }

  :global([data-mode="dark"]) .permission-label {
    color: var(--color-surface-300);
  }

  @media (max-width: 768px) {
    .header-left {
      flex-direction: column;
      align-items: flex-start;
    }

    .permissions-grid {
      grid-template-columns: 1fr;
    }

    .stats {
      grid-template-columns: 1fr;
    }
  }
</style>
