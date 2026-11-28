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
  import { Search } from "@lucide/svelte";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";

  interface Role {
    role: string;
    bank_id?: string;
    entitlement_count?: number;
  }

  let { data } = $props<{ data: PageData }>();

  let roles = $derived(data.roles || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);
  // Parse OBP error to extract missing role information
  let parsedError = $derived.by(() => {
    if (!error) return null;

    // Check if it's an OBP missing role error
    const missingRoleMatch = error.match(
      /OBP-(\d+):.*missing one or more roles:\s*(.+)/i,
    );
    if (missingRoleMatch) {
      const rolesString = missingRoleMatch[2];
      const roles = rolesString.split(",").map((r: string) => r.trim());

      // Try to detect bank_id from the error message or role name
      // Bank-level roles typically end with "AtOneBank" or "AtAnyBank"
      // or the error message might mention a specific bank
      let bankId: string | undefined = undefined;

      // Check if any role requires a bank (ends with AtOneBank)
      const requiresBank = roles.some(
        (role: string) =>
          role.includes("AtOneBank") && !role.includes("AtAnyBank"),
      );

      // Try to extract bank_id from error message if present
      const bankMatch = error.match(/bank[_\s]?id[:\s]+([a-zA-Z0-9._-]+)/i);
      if (bankMatch) {
        bankId = bankMatch[1];
      }

      return {
        type: "missing_role",
        code: missingRoleMatch[1],
        roles: roles,
        bankId: bankId,
        requiresBank: requiresBank,
        message: error,
      };
    }

    return {
      type: "general",
      message: error,
    };
  });

  // Search state
  let searchQuery = $state("");

  // Sort order state
  type SortOrder = "all" | "usage";
  let sortOrder = $state<SortOrder>("usage");

  // Filter and sort roles based on search query and sort order
  let filteredRoles = $derived.by(() => {
    let filtered = roles;

    // Apply search filter
    if (searchQuery.trim()) {
      // Remove spaces from the query for matching (role names never have spaces)
      const query = searchQuery.toLowerCase().replace(/\s+/g, "");
      filtered = roles.filter((role: Role) =>
        role.role.toLowerCase().includes(query),
      );
    }

    // Apply sort order
    if (sortOrder === "usage") {
      // Sort by entitlement_count descending (highest usage first)
      return [...filtered].sort((a, b) => {
        const countA = a.entitlement_count || 0;
        const countB = b.entitlement_count || 0;
        return countB - countA;
      });
    }

    // Default: return as is (normal order)
    return filtered;
  });

  // Group roles by bank_id
  let groupedRoles = $derived.by(() => {
    const grouped = new Map<string, Role[]>();

    filteredRoles.forEach((role: Role) => {
      const key = role.bank_id || "System-wide";
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(role);
    });

    return grouped;
  });
</script>

<svelte:head>
  <title>Roles - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Error Alert -->
  {#if error && parsedError}
    {#if parsedError.type === "missing_role"}
      <MissingRoleAlert
        roles={parsedError.roles}
        errorCode={parsedError.code}
        message={parsedError.message}
        bankId={parsedError.bankId}
      />
    {:else}
      <div class="alert alert-error mb-6">
        <strong>Error:</strong>
        {error}
      </div>
    {/if}
  {/if}

  <div class="panel">
    <div class="panel-header">
      <div class="header-top">
        <div>
          <h1 class="panel-title">Roles</h1>
          <div class="panel-subtitle">
            View and manage roles across all banks in your organization
          </div>
        </div>
        <div class="role-count">
          <span class="count-number">{roles.length}</span>
          <span class="count-label">Total Roles</span>
        </div>
      </div>

      <!-- Search Bar and Sort -->
      <div class="search-container">
        <div class="search-row">
          <div class="search-input-wrapper">
            <Search class="search-icon" size={20} />
            <input
              type="text"
              class="search-input"
              placeholder="Search roles..."
              bind:value={searchQuery}
            />
            {#if searchQuery}
              <button
                class="clear-button"
                onclick={() => (searchQuery = "")}
                aria-label="Clear search"
              >
                ✕
              </button>
            {/if}
          </div>

          <div class="sort-selector">
            <label for="sort-order" class="sort-label">Sort:</label>
            <select id="sort-order" class="sort-select" bind:value={sortOrder}>
              <option value="all">Alpha</option>
              <option value="usage">Usage</option>
            </select>
          </div>
        </div>

        {#if searchQuery}
          <div class="search-results-info">
            Showing {filteredRoles.length} of {roles.length} roles
          </div>
        {/if}
      </div>
    </div>

    <div class="panel-content">
      {#if !hasApiAccess}
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <h4 class="empty-title">No API Access</h4>
          <p class="empty-text">
            You need API access to view roles. Please contact your
            administrator.
          </p>
        </div>
      {:else if roles.length === 0}
        <div class="empty-state">
          <div class="empty-icon">🛡️</div>
          <h4 class="empty-title">No Roles Found</h4>
          <p class="empty-text">
            There are currently no roles defined in the system.
          </p>
        </div>
      {:else}
        <div class="roles-container">
          {#each Array.from(groupedRoles.entries()) as [bankId, bankRoles]}
            <div class="role-group">
              <div class="group-header">
                <h3 class="group-title">
                  {bankId === "System-wide"
                    ? "🌐 System-wide Roles"
                    : `🏦 ${bankId}`}
                </h3>
                <span class="group-count">{bankRoles.length} roles</span>
              </div>
              <div class="roles-grid">
                {#each bankRoles as role}
                  <a
                    href="/rbac/roles/{encodeURIComponent(role.role)}"
                    class="role-card"
                  >
                    <div class="role-icon">🛡️</div>
                    <div class="role-info">
                      <h4 class="role-name">{role.role}</h4>
                      {#if role.bank_id}
                        <span class="role-meta">Bank: {role.bank_id}</span>
                      {:else}
                        <span class="role-meta system">System Role</span>
                      {/if}
                      {#if role.entitlement_count !== undefined}
                        <span class="role-meta entitlement-count">
                          👥 {role.entitlement_count}
                          {role.entitlement_count === 1 ? "user" : "users"}
                        </span>
                      {/if}
                    </div>
                  </a>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1600px;
  }

  .panel {
    background: var(--ui-card);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .panel-header {
    padding: 1.5rem;
    padding-bottom: 0;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
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

  .role-count {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem 1.5rem;
    background: var(--ui-panel);
    border-radius: 8px;
  }

  .count-number {
    font-size: 2rem;
    font-weight: 700;
    color: var(--ui-link);
    line-height: 1;
  }

  .count-label {
    font-size: 0.75rem;
    color: var(--ui-muted);
    margin-top: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .search-container {
    margin-top: 1rem;
  }

  .search-row {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
  }

  .search-input-wrapper :global(.search-icon) {
    position: absolute;
    left: 1rem;
    color: var(--ui-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 3rem 0.75rem 3rem;
    border: 1px solid var(--ui-border);
    border-radius: 8px;
    font-size: 0.875rem;
    background: var(--ui-card);
    color: var(--ui-text);
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-link) 10%, transparent);
  }

  .clear-button {
    position: absolute;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--ui-muted);
    cursor: pointer;
    padding: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .clear-button:hover {
    color: var(--ui-muted);
  }

  .search-results-info {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--ui-muted);
  }

  .sort-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .sort-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--ui-muted);
  }

  .sort-select {
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    font-size: 0.875rem;
    background-color: var(--ui-card);
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 0.5rem center;
    background-repeat: no-repeat;
    background-size: 1.5em 1.5em;
    appearance: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .sort-select:hover {
    border-color: var(--ui-border);
  }

  .sort-select:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-link) 10%, transparent);
  }

  :global([data-mode="dark"]) .sort-select {
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  }

  .panel-content {
    padding: 1.5rem;
  }

  .alert {
    padding: 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1.5rem;
  }

  .alert-error {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
    border: 1px solid var(--ui-tone-error-border);
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--ui-muted);
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-title {
    color: var(--ui-muted);
    margin-bottom: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .empty-text {
    color: var(--ui-muted);
  }

  .roles-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .role-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid var(--ui-border);
  }

  .group-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0;
  }

  .group-count {
    font-size: 0.875rem;
    color: var(--ui-muted);
    background: var(--ui-panel);
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
  }

  .roles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .role-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--ui-card);
    border: 1px solid var(--ui-border);
    border-radius: 8px;
    transition: all 0.2s;
    cursor: pointer;
    text-decoration: none;
  }

  .role-card:hover {
    background: var(--ui-hover);
    border-color: var(--ui-border);
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }

  .role-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .role-info {
    flex: 1;
    min-width: 0;
  }

  .role-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .role-meta {
    font-size: 0.75rem;
    color: var(--ui-muted);
    display: block;
    margin-top: 0.25rem;
  }

  .role-meta.system {
    color: var(--ui-link);
    font-weight: 500;
  }

  .role-meta.entitlement-count {
    color: var(--ui-success);
    font-weight: 500;
  }

  @media (max-width: 768px) {
    .header-top {
      flex-direction: column;
      gap: 1rem;
    }

    .role-count {
      width: 100%;
    }

    .search-row {
      flex-direction: column;
      gap: 0.75rem;
    }

    .search-input-wrapper {
      width: 100%;
    }

    .sort-selector {
      width: 100%;
      justify-content: space-between;
    }

    .sort-select {
      flex: 1;
    }

    .roles-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
