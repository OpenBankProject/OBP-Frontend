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

  .role-count {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem 1.5rem;
    background: #f3f4f6;
    border-radius: 8px;
  }

  :global([data-mode="dark"]) .role-count {
    background: rgb(var(--color-surface-700));
  }

  .count-number {
    font-size: 2rem;
    font-weight: 700;
    color: #3b82f6;
    line-height: 1;
  }

  :global([data-mode="dark"]) .count-number {
    color: rgb(var(--color-primary-400));
  }

  .count-label {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .count-label {
    color: var(--color-surface-400);
  }

  .search-container {
    margin-top: 1rem;
  }

  :global([data-mode="dark"]) .search-container {
    border-top-color: rgb(var(--color-surface-700));
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
    background: white;
    color: #111827;
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

  .clear-button {
    position: absolute;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #9ca3af;
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

  .sort-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .sort-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .sort-label {
    color: var(--color-surface-400);
  }

  .sort-select {
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    background-color: white;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 0.5rem center;
    background-repeat: no-repeat;
    background-size: 1.5em 1.5em;
    appearance: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .sort-select:hover {
    border-color: #9ca3af;
  }

  .sort-select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  :global([data-mode="dark"]) .sort-select {
    background-color: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  }

  :global([data-mode="dark"]) .sort-select:hover {
    border-color: rgb(var(--color-surface-500));
  }

  :global([data-mode="dark"]) .sort-select:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
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
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  :global([data-mode="dark"]) .alert-error {
    background: rgb(var(--color-error-900));
    color: rgb(var(--color-error-200));
    border-color: rgb(var(--color-error-800));
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
    color: #4a5568;
    margin-bottom: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .empty-title {
    color: var(--color-surface-300);
  }

  .empty-text {
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-text {
    color: var(--color-surface-400);
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
    border-bottom: 2px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .group-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .group-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .group-title {
    color: var(--color-surface-100);
  }

  .group-count {
    font-size: 0.875rem;
    color: #6b7280;
    background: #f3f4f6;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
  }

  :global([data-mode="dark"]) .group-count {
    color: var(--color-surface-400);
    background: rgb(var(--color-surface-700));
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
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    transition: all 0.2s;
    cursor: pointer;
    text-decoration: none;
  }

  .role-card:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }

  :global([data-mode="dark"]) .role-card {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
  }

  :global([data-mode="dark"]) .role-card:hover {
    background: rgb(var(--color-surface-600));
    border-color: rgb(var(--color-surface-500));
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
    color: #111827;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .role-name {
    color: var(--color-surface-100);
  }

  .role-meta {
    font-size: 0.75rem;
    color: #6b7280;
    display: block;
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .role-meta {
    color: var(--color-surface-400);
  }

  .role-meta.system {
    color: #3b82f6;
    font-weight: 500;
  }

  :global([data-mode="dark"]) .role-meta.system {
    color: rgb(var(--color-primary-400));
  }

  .role-meta.entitlement-count {
    color: #10b981;
    font-weight: 500;
  }

  :global([data-mode="dark"]) .role-meta.entitlement-count {
    color: rgb(var(--color-success-400));
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
