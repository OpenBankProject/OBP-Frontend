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
  import {
    Users,
    Building2,
    Shield,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Plus,
  } from "@lucide/svelte";

  let { data } = $props<{ data: PageData }>();

  let groupsWithEntitlements = $state(data.groupsWithEntitlements || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  // Debug logging
  $effect(() => {
    console.log("=== MEMBERSHIPS PAGE DEBUG ===");
    console.log("groupsWithEntitlements:", groupsWithEntitlements);
    console.log(
      "groupsWithEntitlements.length:",
      groupsWithEntitlements.length,
    );
    console.log("hasApiAccess:", hasApiAccess);
    console.log("error:", error);
    if (groupsWithEntitlements.length > 0) {
      console.log("First group:", groupsWithEntitlements[0]);
      console.log(
        "First group entitlements:",
        groupsWithEntitlements[0].entitlements,
      );
    }
  });

  // Track expanded groups
  let expandedGroups = $state<Set<string>>(new Set());

  function toggleGroup(groupId: string) {
    if (expandedGroups.has(groupId)) {
      expandedGroups.delete(groupId);
    } else {
      expandedGroups.add(groupId);
    }
    expandedGroups = new Set(expandedGroups); // Trigger reactivity
  }

  function isExpanded(groupId: string): boolean {
    return expandedGroups.has(groupId);
  }

  // Calculate total entitlements across all groups
  let totalEntitlements = $derived(
    groupsWithEntitlements.reduce(
      (sum: number, group: any) => sum + (group.entitlements?.length || 0),
      0,
    ),
  );
</script>

<svelte:head>
  <title>Group Memberships - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Users size={32} />
          </div>
          <div>
            <h1 class="panel-title">Group Memberships</h1>
            <div class="panel-subtitle">
              View groups and their assigned entitlements
            </div>
          </div>
        </div>
        <a href="/rbac/memberships/create" class="btn-create">
          <Plus size={16} />
          Create Membership
        </a>
      </div>
    </div>

    <div class="panel-content">
      {#if error && !hasApiAccess}
        <div class="error-message">
          <p>⚠️ {error}</p>
        </div>
      {:else if groupsWithEntitlements.length === 0}
        <div class="empty-state">
          <div class="empty-icon">
            <Users size={48} />
          </div>
          <h4 class="empty-title">No groups found</h4>
          <p class="empty-description">
            There are no groups available in the system.
          </p>
        </div>
      {:else}
        <!-- Stats -->
        <div class="stats">
          <div class="stat-item">
            <div class="stat-label">Total Groups</div>
            <div class="stat-value">{groupsWithEntitlements.length}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Total Entitlements</div>
            <div class="stat-value">{totalEntitlements}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Enabled Groups</div>
            <div class="stat-value">
              {groupsWithEntitlements.filter((g: any) => g.is_enabled).length}
            </div>
          </div>
        </div>

        <!-- Groups List -->
        <div class="groups-list">
          {#each groupsWithEntitlements as group}
            <div class="group-card">
              <button
                class="group-header"
                onclick={() => toggleGroup(group.group_id)}
              >
                <div class="group-header-content">
                  <div class="group-info">
                    <div class="group-title-row">
                      <h3 class="group-name">{group.group_name}</h3>
                      {#if !group.is_enabled}
                        <span class="disabled-badge">Disabled</span>
                      {/if}
                    </div>
                    <div class="group-meta">
                      <span class="meta-item">
                        <Building2 size={14} />
                        {group.bank_id}
                      </span>
                      <span class="meta-item">
                        <Shield size={14} />
                        {group.entitlements?.length || 0} entitlements
                      </span>
                      <span class="meta-item-id">{group.group_id}</span>
                    </div>
                    {#if group.group_description}
                      <p class="group-description">{group.group_description}</p>
                    {/if}
                  </div>
                  <div class="expand-icon">
                    {#if isExpanded(group.group_id)}
                      <ChevronUp size={20} />
                    {:else}
                      <ChevronDown size={20} />
                    {/if}
                  </div>
                </div>
              </button>

              {#if isExpanded(group.group_id)}
                <div class="group-content">
                  {#if group.entitlements && group.entitlements.length > 0}
                    <div class="entitlements-section">
                      <h4 class="section-title">Entitlements</h4>
                      <div class="entitlements-grid">
                        {#each group.entitlements as entitlement}
                          <div class="entitlement-card">
                            <div class="entitlement-name">
                              {entitlement.role_name}
                            </div>
                            <div class="entitlement-details">
                              {#if entitlement.bank_id}
                                <span class="entitlement-detail">
                                  <Building2 size={12} />
                                  {entitlement.bank_id}
                                </span>
                              {/if}
                              {#if entitlement.user_id}
                                <span class="entitlement-detail">
                                  User: {entitlement.username ||
                                    entitlement.user_id}
                                </span>
                              {/if}
                            </div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {:else}
                    <div class="empty-state-small">
                      <AlertCircle size={24} />
                      <p>No entitlements assigned to this group</p>
                    </div>
                  {/if}

                  {#if group.list_of_roles && group.list_of_roles.length > 0}
                    <div class="roles-section">
                      <h4 class="section-title">Target Roles</h4>
                      <div class="roles-list">
                        {#each group.list_of_roles as role}
                          <span class="role-badge">{role}</span>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
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
    align-items: flex-start;
    gap: 2rem;
  }

  .header-left {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    flex: 1;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 12px;
    flex-shrink: 0;
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
    margin: 0;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-description {
    color: var(--color-surface-400);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-item {
    padding: 1.25rem;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .stat-item {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  .stat-label {
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .stat-label {
    color: var(--color-surface-400);
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
  }

  :global([data-mode="dark"]) .stat-value {
    color: var(--color-surface-100);
  }

  .groups-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .group-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.2s;
  }

  .group-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  :global([data-mode="dark"]) .group-card {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  .group-header {
    width: 100%;
    padding: 1.25rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s;
  }

  .group-header:hover {
    background: rgba(0, 0, 0, 0.02);
  }

  :global([data-mode="dark"]) .group-header:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .group-header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .group-info {
    flex: 1;
  }

  .group-title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .group-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .group-name {
    color: var(--color-surface-100);
  }

  .disabled-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: #fee2e2;
    color: #dc2626;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  :global([data-mode="dark"]) .disabled-badge {
    background: rgba(239, 68, 68, 0.2);
    color: rgb(var(--color-error-400));
  }

  .group-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 500;
  }

  :global([data-mode="dark"]) .meta-item {
    color: var(--color-surface-400);
  }

  .meta-item-id {
    font-size: 0.7rem;
    color: #9ca3af;
    font-family: monospace;
  }

  :global([data-mode="dark"]) .meta-item-id {
    color: var(--color-surface-500);
  }

  .group-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0.5rem 0 0 0;
    line-height: 1.5;
  }

  :global([data-mode="dark"]) .group-description {
    color: var(--color-surface-400);
  }

  .expand-icon {
    display: flex;
    align-items: center;
    color: #9ca3af;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .expand-icon {
    color: var(--color-surface-400);
  }

  .group-content {
    padding: 1.25rem;
    background: white;
    border-top: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .group-content {
    background: rgb(var(--color-surface-800));
    border-top-color: rgb(var(--color-surface-700));
  }

  .section-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: #374151;
    margin: 0 0 1rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .section-title {
    color: var(--color-surface-300);
  }

  .entitlements-section {
    margin-bottom: 1.5rem;
  }

  .entitlements-section:last-child {
    margin-bottom: 0;
  }

  .entitlements-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
  }

  .entitlement-card {
    padding: 0.875rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    min-width: 0;
  }

  :global([data-mode="dark"]) .entitlement-card {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  .entitlement-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.5rem;
    overflow-wrap: anywhere;
  }

  :global([data-mode="dark"]) .entitlement-name {
    color: var(--color-surface-100);
  }

  .entitlement-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .entitlement-detail {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .entitlement-detail {
    color: var(--color-surface-400);
  }

  .empty-state-small {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem;
    color: #9ca3af;
    font-size: 0.875rem;
  }

  :global([data-mode="dark"]) .empty-state-small {
    color: var(--color-surface-500);
  }

  .roles-section {
    margin-top: 1.5rem;
  }

  .roles-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .role-badge {
    display: inline-block;
    padding: 0.375rem 0.75rem;
    background: #ede9fe;
    color: #6b21a8;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    overflow-wrap: anywhere;
    max-width: 100%;
  }

  :global([data-mode="dark"]) .role-badge {
    background: rgba(139, 92, 246, 0.2);
    color: rgb(var(--color-primary-300));
  }

  .btn-create {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #22c55e;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .btn-create:hover {
    background: #16a34a;
  }

  :global([data-mode="dark"]) .btn-create {
    background: #22c55e;
  }

  :global([data-mode="dark"]) .btn-create:hover {
    background: #16a34a;
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: stretch;
    }

    .header-left {
      width: 100%;
    }

    .btn-create {
      width: 100%;
      justify-content: center;
    }

    .stats {
      grid-template-columns: 1fr;
    }

    .entitlements-grid {
      grid-template-columns: 1fr;
    }

    .group-meta {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>
