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

  .groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .group-card {
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    background: var(--ui-card);
    border: 1px solid var(--ui-border);
    border-radius: 8px;
    transition: all 0.2s;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
  }

  .group-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
    border-color: var(--ui-link);
  }

  .group-card.disabled {
    opacity: 0.6;
  }

  .group-card.disabled:hover {
    transform: translateY(-1px);
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
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
    border-radius: 8px;
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
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .status-disabled {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
  }

  .group-card-body {
    flex: 1;
    margin-bottom: 1rem;
  }

  .group-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0 0 0.5rem 0;
  }

  .group-description {
    font-size: 0.875rem;
    color: var(--ui-muted);
    margin: 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .group-card-footer {
    border-top: 1px solid var(--ui-border);
    padding-top: 1rem;
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
    color: var(--ui-muted);
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
