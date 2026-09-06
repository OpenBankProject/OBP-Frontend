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
  import { Search, User, Building2, Globe, Trash2 } from "@lucide/svelte";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import { currentBank } from "$lib/stores/currentBank.svelte";

  interface Entitlement {
    entitlement_id: string;
    role_name: string;
    bank_id: string;
    user_id: string;
    username: string;
  }

  let { data } = $props<{ data: PageData }>();

  let entitlements = $derived(data.entitlements || []);
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

  // Filter to only system-wide and current bank entitlements
  let relevantEntitlements = $derived.by(() => {
    return entitlements.filter(
      (ent: Entitlement) =>
        !ent.bank_id || ent.bank_id === currentBank.bankId,
    );
  });

  // Apply search filter on top
  let filteredEntitlements = $derived.by(() => {
    if (!searchQuery.trim()) {
      return relevantEntitlements;
    }
    const query = searchQuery.toLowerCase();
    return relevantEntitlements.filter(
      (ent: Entitlement) =>
        ent.role_name.toLowerCase().includes(query) ||
        ent.username.toLowerCase().includes(query) ||
        ent.user_id.toLowerCase().includes(query) ||
        (ent.bank_id && ent.bank_id.toLowerCase().includes(query)),
    );
  });

  // Split into system-wide and bank-level
  let systemEntitlements = $derived(
    filteredEntitlements.filter((ent: Entitlement) => !ent.bank_id),
  );
  let bankEntitlements = $derived(
    filteredEntitlements.filter(
      (ent: Entitlement) => ent.bank_id === currentBank.bankId,
    ),
  );

  // Count total entitlements
  let totalCount = $derived(relevantEntitlements.length);
  let filteredCount = $derived(filteredEntitlements.length);

  let userId = $derived((data.userId as string) || "");

  const GROUP_COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#ec4899','#06b6d4'];
  function computeGroupColors(items: Entitlement[]): string[] {
    const result: string[] = [];
    let colorIdx = -1;
    let prevId = '';
    for (const item of items) {
      if (item.user_id === userId) {
        result.push('');
      } else {
        if (item.user_id !== prevId) colorIdx++;
        result.push(GROUP_COLORS[colorIdx % GROUP_COLORS.length]);
        prevId = item.user_id;
      }
    }
    return result;
  }

  let systemColors = $derived(computeGroupColors(systemEntitlements));
  let bankColors = $derived(computeGroupColors(bankEntitlements));
</script>

<svelte:head>
  <title>Entitlements - API Manager II</title>
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
          <h1 class="panel-title">Entitlements</h1>
          <div class="panel-subtitle">
            View and manage user entitlements and role assignments across your
            organization
          </div>
        </div>
        <div class="header-actions">
          <div class="entitlement-count">
            <span class="count-number">{totalCount}</span>
            <span class="count-label">Total Entitlements</span>
          </div>
          <a href="/rbac/entitlements/create" class="btn-create">
            ➕ Create Entitlement
          </a>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="search-container">
        <div class="search-input-wrapper">
          <Search class="search-icon" size={20} />
          <input
            type="text"
            class="search-input"
            placeholder="Search by role, username, user ID, or bank ID..."
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
        {#if searchQuery}
          <div class="search-results-info">
            Showing {filteredCount} of {totalCount} entitlements
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
            You need to authenticate with the API to view entitlements.
            <br />
            Please ensure you have valid OAuth credentials.
          </p>
        </div>
      {:else if entitlements.length === 0}
        <div class="empty-state">
          <div class="empty-icon">🔐</div>
          <h4 class="empty-title">No Entitlements Found</h4>
          <p class="empty-text">
            There are currently no entitlements in the system.
          </p>
        </div>
      {:else if filteredEntitlements.length === 0}
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h4 class="empty-title">No Results Found</h4>
          <p class="empty-text">
            No entitlements match your search query "{searchQuery}".
            <br />
            Try adjusting your search terms.
          </p>
        </div>
      {:else}
        <div class="two-column-layout">
          <!-- System-wide entitlements (left) -->
          <div class="column">
            <div class="bank-group">
              <div class="bank-header">
                <Globe size={20} class="bank-icon" />
                <h3 class="bank-name">System Entitlements</h3>
                <span class="bank-count">{systemEntitlements.length}</span>
              </div>

              {#if systemEntitlements.length > 0}
                <div class="entitlements-list">
                  {#each systemEntitlements as entitlement, i}
                    {@render entitlementCard(entitlement, systemColors[i])}
                  {/each}
                </div>
              {:else}
                <div class="column-empty">No system entitlements{searchQuery ? " matching search" : ""}</div>
              {/if}
            </div>
          </div>

          <!-- Bank-level entitlements (right) -->
          <div class="column">
            <div class="bank-group">
              <div class="bank-header">
                <Building2 size={20} class="bank-icon" />
                <h3 class="bank-name">
                  {#if currentBank.bankId}
                    Bank: {currentBank.bankId}
                  {:else}
                    Bank Entitlements
                  {/if}
                </h3>
                <span class="bank-count">{bankEntitlements.length}</span>
              </div>

              {#if !currentBank.bankId}
                <div class="column-empty">Select a bank to view bank-level entitlements</div>
              {:else if bankEntitlements.length > 0}
                <div class="entitlements-list">
                  {#each bankEntitlements as entitlement, i}
                    {@render entitlementCard(entitlement, bankColors[i])}
                  {/each}
                </div>
              {:else}
                <div class="column-empty">No entitlements for {currentBank.bankId}{searchQuery ? " matching search" : ""}</div>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>

    {#snippet entitlementCard(entitlement: Entitlement, color: string)}
      <div class="entitlement-card" style="border-left-color: {color || 'transparent'}">
        <div class="entitlement-header">
          <div class="entitlement-role">
            <h4 class="role-name">
              <a href="/rbac/roles/{entitlement.role_name}" class="role-link">
                {entitlement.role_name}
              </a>
              <a
                href="/rbac/entitlements/{entitlement.entitlement_id}/delete"
                class="delete-button"
                title="Delete entitlement"
              >
                <Trash2 size={16} />
              </a>
            </h4>
          </div>
        </div>

        <div class="entitlement-body">
          <div class="entitlement-info">
            <User size={16} class="info-icon" />
            <div class="info-content">
              <span class="info-label">User:</span>
              <a href="/users/{entitlement.user_id}" class="user-link">
                {entitlement.username}
              </a>
              {#if entitlement.user_id === userId}
                <span class="you-badge">You</span>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/snippet}
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

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .entitlement-count {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    padding: 0.75rem 1.25rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(102, 126, 234, 0.2);
  }

  :global([data-mode="dark"]) .entitlement-count {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .btn-create {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: #51b265;
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-create:hover {
    background: #3d9e52;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(81, 178, 101, 0.3);
  }

  :global([data-mode="dark"]) .btn-create {
    background: #51b265;
  }

  :global([data-mode="dark"]) .btn-create:hover {
    background: #3d9e52;
  }

  .count-number {
    font-size: 2rem;
    font-weight: 700;
    color: white;
    line-height: 1;
  }

  :global([data-mode="dark"]) .count-number {
    color: white;
  }

  .count-label {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.9);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .count-label {
    color: rgba(255, 255, 255, 0.9);
  }

  .search-container {
    margin-top: 1rem;
  }

  :global([data-mode="dark"]) .search-container {
    border-top-color: rgb(var(--color-surface-700));
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input-wrapper :global(.search-icon) {
    position: absolute;
    left: 1rem;
    color: #9ca3af;
    pointer-events: none;
  }

  :global([data-mode="dark"]) .search-input-wrapper :global(.search-icon) {
    color: var(--color-surface-400);
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 3rem 0.75rem 3rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  :global([data-mode="dark"]) .search-input {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .search-input:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .clear-button {
    position: absolute;
    right: 1rem;
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
    transition: color 0.2s;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clear-button:hover {
    color: #4b5563;
  }

  :global([data-mode="dark"]) .clear-button {
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .clear-button:hover {
    color: var(--color-surface-200);
  }

  .search-results-info {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .search-results-info {
    color: var(--color-surface-400);
  }

  .panel-content {
    padding: 1.5rem;
  }

  .alert {
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .alert-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .alert-error {
    background: rgb(var(--color-error-900));
    border-color: rgb(var(--color-error-700));
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
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #4a5568;
    margin-bottom: 0.5rem;
  }

  :global([data-mode="dark"]) .empty-title {
    color: var(--color-surface-200);
  }

  .empty-text {
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-text {
    color: var(--color-surface-400);
  }

  .two-column-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    align-items: start;
  }

  .column {
    min-width: 0;
  }

  .column-empty {
    padding: 2rem;
    text-align: center;
    color: #6b7280;
    font-size: 0.875rem;
  }

  :global([data-mode="dark"]) .column-empty {
    color: var(--color-surface-400);
  }

  .bank-group {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }

  :global([data-mode="dark"]) .bank-group {
    border-color: rgb(var(--color-surface-700));
  }

  .bank-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .bank-header {
    background: rgb(var(--color-surface-700));
    border-bottom-color: rgb(var(--color-surface-600));
  }

  .bank-header :global(.bank-icon) {
    color: #667eea;
  }

  :global([data-mode="dark"]) .bank-header :global(.bank-icon) {
    color: rgb(var(--color-primary-400));
  }

  .bank-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
    flex: 1;
  }

  :global([data-mode="dark"]) .bank-name {
    color: var(--color-surface-100);
  }

  .bank-count {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
    background: white;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
  }

  :global([data-mode="dark"]) .bank-count {
    background: rgb(var(--color-surface-600));
    color: var(--color-surface-300);
  }

  .entitlements-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
  }

  .entitlement-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-left: 3px solid transparent;
    border-radius: 8px;
    padding: 1rem;
    transition: all 0.2s;
  }

  .entitlement-card:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    border-color: #667eea;
  }

  :global([data-mode="dark"]) .entitlement-card {
    background: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-700));
  }

  :global([data-mode="dark"]) .entitlement-card:hover {
    border-color: rgb(var(--color-primary-500));
  }

  .entitlement-header {
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
  }

  :global([data-mode="dark"]) .entitlement-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .entitlement-role {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .role-name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
    word-break: break-word;
  }

  :global([data-mode="dark"]) .role-name {
    color: var(--color-surface-100);
  }

  .role-link {
    color: #3b82f6;
    text-decoration: none;
    transition: color 0.2s;
  }

  .role-link:hover {
    color: #2563eb;
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .role-link {
    color: rgb(var(--color-primary-400));
  }

  :global([data-mode="dark"]) .role-link:hover {
    color: rgb(var(--color-primary-300));
  }

  .delete-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem;
    color: #6b7280;
    border-radius: 0.25rem;
    transition: all 0.2s;
    text-decoration: none;
  }

  .delete-button:hover {
    color: #dc2626;
    background: #fee2e2;
  }

  :global([data-mode="dark"]) .delete-button {
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .delete-button:hover {
    color: rgb(var(--color-error-400));
    background: rgb(var(--color-error-900));
  }

  .entitlement-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .entitlement-info {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .entitlement-info :global(.info-icon) {
    margin-top: 0.125rem;
    color: #6b7280;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .entitlement-info :global(.info-icon) {
    color: var(--color-surface-400);
  }

  .info-content {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: baseline;
    min-width: 0;
  }

  .info-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .info-label {
    color: var(--color-surface-400);
  }

  .info-value {
    font-size: 0.75rem;
    color: #111827;
    word-break: break-all;
  }

  :global([data-mode="dark"]) .info-value {
    color: var(--color-surface-200);
  }

  .user-link {
    color: #667eea;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }

  .user-link:hover {
    color: #5568d3;
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .user-link {
    color: rgb(var(--color-primary-400));
  }

  :global([data-mode="dark"]) .user-link:hover {
    color: rgb(var(--color-primary-300));
  }

  .you-badge {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 9999px;
    background: #dcfce7;
    color: #15803d;
    letter-spacing: 0.03em;
  }

  :global([data-mode="dark"]) .you-badge {
    background: rgba(34, 197, 94, 0.2);
    color: rgb(var(--color-success-300));
  }

  .info-detail {
    font-size: 0.7rem;
    color: #9ca3af;
    font-family: monospace;
  }

  :global([data-mode="dark"]) .info-detail {
    color: var(--color-surface-500);
  }

  @media (max-width: 768px) {
    .header-top {
      flex-direction: column;
      gap: 1rem;
    }

    .header-actions {
      flex-direction: column;
      width: 100%;
    }

    .entitlement-count {
      width: 100%;
      align-items: center;
    }

    .btn-create {
      width: 100%;
      justify-content: center;
    }

    .search-input-wrapper {
      font-size: 0.875rem;
    }

    .two-column-layout {
      grid-template-columns: 1fr;
    }

    .bank-header {
      padding: 0.75rem 1rem;
    }

    .entitlement-card {
      padding: 0.875rem;
    }
  }
</style>
