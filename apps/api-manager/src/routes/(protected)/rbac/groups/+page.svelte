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
  import { Users, Building2, Shield, Plus, Search } from "@lucide/svelte";

  let { data } = $props<{ data: PageData }>();

  let groups = $derived(data.groups || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  // Search functionality
  let searchQuery = $state("");

  let filteredGroups = $derived.by(() => {
    if (!searchQuery.trim()) {
      return groups;
    }
    const query = searchQuery.toLowerCase();
    return groups.filter(
      (group: any) =>
        group.group_name.toLowerCase().includes(query) ||
        group.group_description.toLowerCase().includes(query) ||
        group.bank_id.toLowerCase().includes(query),
    );
  });
</script>

<svelte:head>
  <title>Groups - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div>
          <h1 class="panel-title">Groups</h1>
          <div class="panel-subtitle">
            Manage user groups and group-based access control for your
            organization
          </div>
        </div>
        <a href="/rbac/groups/create" class="btn-primary">
          <Plus size={16} />
          Create Group
        </a>
      </div>
    </div>

    <div class="panel-content">
      {#if error && !hasApiAccess}
        <div class="error-message">
          <p>⚠️ {error}</p>
        </div>
      {:else if groups.length === 0}
        <div class="empty-state">
          <div class="empty-icon">
            <Users size={48} />
          </div>
          <h4 class="empty-title">No groups yet</h4>
          <p class="empty-description">
            Create your first group to organize users and manage access control
          </p>
          <a href="/rbac/groups/create" class="btn-primary">
            <Plus size={16} />
            Create Your First Group
          </a>
        </div>
      {:else}
        <!-- Search Bar -->
        <div class="search-bar">
          <Search class="search-icon" size={18} />
          <input
            type="text"
            class="search-input"
            placeholder="Search groups by name, description, or bank..."
            bind:value={searchQuery}
          />
        </div>

        <!-- Groups Stats -->
        <div class="stats">
          <div class="stat-item">
            <div class="stat-label">Total Groups</div>
            <div class="stat-value">{groups.length}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Active Groups</div>
            <div class="stat-value">
              {groups.filter((g: any) => g.is_enabled).length}
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Showing</div>
            <div class="stat-value">{filteredGroups.length}</div>
          </div>
        </div>

        <!-- Groups Grid -->
        {#if filteredGroups.length === 0}
          <div class="empty-state">
            <div class="empty-icon">
              <Search size={48} />
            </div>
            <h4 class="empty-title">No groups found</h4>
            <p class="empty-description">Try adjusting your search query</p>
          </div>
        {:else}
          <div class="groups-grid">
            {#each filteredGroups as group}
              <a
                href="/rbac/groups/{group.group_id}"
                class="group-card"
                class:disabled={!group.is_enabled}
              >
                <div class="group-card-header">
                  <div class="group-icon">
                    <Users size={24} />
                  </div>
                  <div class="group-status">
                    {#if group.is_enabled}
                      <span class="status-badge status-enabled">Active</span>
                    {:else}
                      <span class="status-badge status-disabled">Disabled</span>
                    {/if}
                  </div>
                </div>
                <div class="group-card-body">
                  <h3 class="group-name">{group.group_name}</h3>
                  <p class="group-description">{group.group_description}</p>
                </div>
                <div class="group-card-footer">
                  <div class="group-meta">
                    <div class="meta-item">
                      <Building2 size={14} />
                      <span>{group.bank_id}</span>
                    </div>
                    {#if group.list_of_roles && group.list_of_roles.length > 0}
                      <div class="meta-item">
                        <Shield size={14} />
                        <span
                          >{group.list_of_roles.length} role{group.list_of_roles
                            .length !== 1
                            ? "s"
                            : ""}</span
                        >
                      </div>
                    {/if}
                  </div>
                </div>
              </a>
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

  .panel-content {
    padding: 2rem;
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
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    white-space: nowrap;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  :global([data-mode="dark"]) .btn-primary {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-primary:hover {
    background: rgb(var(--color-primary-700));
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

  .groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .group-card {
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    transition: all 0.2s;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
  }

  .group-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
    border-color: #3b82f6;
  }

  .group-card.disabled {
    opacity: 0.6;
  }

  .group-card.disabled:hover {
    transform: translateY(-1px);
  }

  :global([data-mode="dark"]) .group-card {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  :global([data-mode="dark"]) .group-card:hover {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .group-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .group-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: #eff6ff;
    color: #3b82f6;
    border-radius: 8px;
  }

  :global([data-mode="dark"]) .group-icon {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-400));
  }

  .group-status {
    flex-shrink: 0;
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .status-enabled {
    background: #d1fae5;
    color: #065f46;
  }

  :global([data-mode="dark"]) .status-enabled {
    background: rgba(16, 185, 129, 0.2);
    color: rgb(var(--color-success-300));
  }

  .status-disabled {
    background: #fee2e2;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .status-disabled {
    background: rgba(239, 68, 68, 0.2);
    color: rgb(var(--color-error-300));
  }

  .group-card-body {
    flex: 1;
    margin-bottom: 1rem;
  }

  .group-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.5rem 0;
  }

  :global([data-mode="dark"]) .group-name {
    color: var(--color-surface-100);
  }

  .group-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  :global([data-mode="dark"]) .group-description {
    color: var(--color-surface-400);
  }

  .group-card-footer {
    border-top: 1px solid #e5e7eb;
    padding-top: 1rem;
  }

  :global([data-mode="dark"]) .group-card-footer {
    border-top-color: rgb(var(--color-surface-700));
  }

  .group-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .meta-item {
    color: var(--color-surface-400);
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

    .groups-grid {
      grid-template-columns: 1fr;
    }

    .stats {
      grid-template-columns: 1fr;
    }
  }
</style>
