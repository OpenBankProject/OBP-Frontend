<script lang="ts">
  import { Mail } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { PageData } from "./$types";

  let { data } = $props<{ data: PageData }>();

  let roleFilter = $state(page.url.searchParams.get("role_name") || "");
  let bankIdFilter = $state(page.url.searchParams.get("bank_id") || "");
  let roles = $state<string[]>([]);
  let banks = $state<string[]>([]);

  // Fetch roles and banks on mount
  $effect(() => {
    async function fetchRoles() {
      try {
        const response = await fetch("/api/rbac/roles-metadata");
        const result = await response.json();
        if (result.roles) {
          roles = result.roles.map((r: any) => r.role).sort();
        }
      } catch (err) {
        console.error("Error fetching roles:", err);
      }
    }
    async function fetchBanks() {
      try {
        const response = await fetch("/api/banks");
        const result = await response.json();
        if (result.banks) {
          banks = result.banks.map((b: any) => b.id).sort();
        }
      } catch (err) {
        console.error("Error fetching banks:", err);
      }
    }
    fetchRoles();
    fetchBanks();
  });

  let users = $derived(data.users || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  let providers = $state<string[]>([]);
  let selectedProvider = $state("");
  let searchQuery = $state("");
  let searchResults = $state<any[]>([]);
  let searchError = $state<string | null>(null);
  let isSearching = $state(false);
  let searchType = $state<"email" | "userid" | "username" | "">("");

  // Fetch providers on mount
  $effect(() => {
    async function fetchProviders() {
      try {
        const response = await fetch("/api/users/providers");
        const result = await response.json();
        if (result.providers) {
          providers = result.providers;
          if (providers.length > 0) {
            selectedProvider = providers[0];
          }
        }
      } catch (err) {
        console.error("Error fetching providers:", err);
      }
    }
    fetchProviders();
  });

  // Detect search type based on input
  function detectSearchType(input: string): "email" | "userid" | "username" {
    // Check if it's an email
    if (input.includes("@") && input.includes(".")) {
      return "email";
    }
    // Check if it's a UUID (user_id)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(input)) {
      return "userid";
    }
    // Otherwise, it's a username
    return "username";
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      searchResults = [];
      searchError = null;
      searchType = "";
      return;
    }

    const type = detectSearchType(searchQuery.trim());
    searchType = type;
    isSearching = true;
    searchError = null;

    try {
      let response;

      if (type === "email") {
        // Search by email (OBPv4.0.0)
        response = await fetch(
          `/api/users/search-by-email?email=${encodeURIComponent(searchQuery)}`,
        );
      } else if (type === "userid") {
        // Search by user ID (OBPv4.0.0)
        response = await fetch(
          `/api/users/search-by-userid?user_id=${encodeURIComponent(searchQuery)}`,
        );
      } else {
        // Search by provider and username (OBPv5.1.0)
        if (!selectedProvider) {
          console.error("Provider is required for username search");
          searchResults = [];
          isSearching = false;
          return;
        }
        response = await fetch(
          `/api/users/search-by-provider-username?provider=${encodeURIComponent(selectedProvider)}&username=${encodeURIComponent(searchQuery)}`,
        );
      }

      const result = await response.json();

      if (!response.ok) {
        searchError = result.error || `Search failed (HTTP ${response.status})`;
        searchResults = [];
        return;
      }

      if (result.users) {
        // Multiple results (email search)
        searchResults = result.users;
      } else if (result.user) {
        // Single result (user ID or username search)
        searchResults = [result.user];
      } else {
        searchResults = [];
      }
    } catch (err) {
      console.error("Search error:", err);
      searchError = err instanceof Error ? err.message : "Search failed — the API may be unavailable";
      searchResults = [];
    } finally {
      isSearching = false;
    }
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  }
</script>

<svelte:head>
  <title>Users - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Error Alert -->
  {#if error && !hasApiAccess}
    <div class="alert alert-error mb-6">
      <strong>Error:</strong>
      {error} - Unable to fetch users data.
    </div>
  {/if}

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-3xl font-bold">Users</h1>
    <a
      href="/user-invitations"
      class="btn btn-secondary flex items-center gap-2"
    >
      <Mail size={18} />
      <span>User Invitations</span>
    </a>
  </div>

  <!-- Smart Search Panel -->
  <div class="panel mb-6">
    <div class="panel-header">
      <h2 class="panel-title">Search Users</h2>
      <div class="panel-subtitle">
        Smart search: Enter email, user ID (UUID), or username
        {#if searchType === "email"}
          <span class="text-blue-600"> (Detected: Email)</span>
        {:else if searchType === "userid"}
          <span class="text-blue-600"> (Detected: User ID)</span>
        {:else if searchType === "username"}
          <span class="text-blue-600"> (Detected: Username)</span>
        {/if}
      </div>
    </div>
    <div class="panel-content">
      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        class="flex gap-4 items-end flex-wrap"
      >
        <div style="flex: 0 0 300px;">
          <label for="provider-select" class="block text-sm font-medium mb-2"
            >Provider</label
          >
          <select
            id="provider-select"
            bind:value={selectedProvider}
            class="form-input w-full"
          >
            {#if providers.length === 0}
              <option value="">Loading providers...</option>
            {:else}
              {#each providers as provider}
                <option value={provider}>{provider}</option>
              {/each}
            {/if}
          </select>
        </div>
        <div class="flex-1">
          <label for="search-input" class="block text-sm font-medium mb-2"
            >Search</label
          >
          <input
            type="text"
            id="search-input"
            bind:value={searchQuery}
            placeholder="Enter email, user ID (UUID), or username"
            class="form-input w-full"
          />
        </div>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={isSearching || !searchQuery.trim()}
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </form>

      <form
        onsubmit={(e) => {
          e.preventDefault();
          const params = new URLSearchParams();
          if (roleFilter.trim()) {
            params.set("role_name", roleFilter.trim());
          }
          if (bankIdFilter.trim()) {
            params.set("bank_id", bankIdFilter.trim());
          }
          const qs = params.toString();
          goto(qs ? `?${qs}` : "/users", { invalidateAll: true });
        }}
        class="flex gap-4 items-end mt-4"
      >
        <div class="flex-1">
          <label for="role-input" class="block text-sm font-medium mb-2"
            >Role</label
          >
          <select
            id="role-input"
            bind:value={roleFilter}
            class="form-input w-full"
          >
            <option value="">All roles</option>
            {#each roles as role}
              <option value={role}>{role}</option>
            {/each}
          </select>
        </div>
        <div style="flex: 0 0 300px;">
          <label for="bank-id-input" class="block text-sm font-medium mb-2"
            >Bank ID</label
          >
          <select
            id="bank-id-input"
            bind:value={bankIdFilter}
            class="form-input w-full"
          >
            <option value="">All banks</option>
            {#each banks as bank}
              <option value={bank}>{bank}</option>
            {/each}
          </select>
        </div>
        <button
          type="submit"
          class="btn btn-primary"
        >
          Filter
        </button>
        {#if page.url.searchParams.has("role_name") || page.url.searchParams.has("bank_id")}
          <a href="/users" class="btn btn-secondary">Clear</a>
        {/if}
      </form>

      {#if searchResults.length > 0}
        <div class="mt-6">
          <h3 class="text-lg font-semibold mb-4">
            {searchResults.length === 1
              ? "Result"
              : `Results (${searchResults.length})`}
          </h3>
          <div class="table-wrapper">
            <table class="users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>User ID</th>
                  <th>Provider</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each searchResults as user}
                  <tr>
                    <td>{user.username || "N/A"}</td>
                    <td>{user.email || "N/A"}</td>
                    <td class="font-mono text-sm">{user.user_id || "N/A"}</td>
                    <td>{user.provider || "N/A"}</td>
                    <td>
                      {#if user.user_id}
                        <a
                          href="/users/{encodeURIComponent(user.user_id)}"
                          class="text-blue-600 hover:text-blue-800 underline"
                        >
                          Details
                        </a>
                      {:else}
                        <span class="text-gray-400">N/A</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {:else if searchError}
        <div class="mt-6 alert alert-error">
          <strong>Search error:</strong> {searchError}
        </div>
      {:else if searchQuery.trim() && !isSearching}
        <div class="mt-6 text-center text-gray-500">
          No users found matching "{searchQuery}"
        </div>
      {/if}
    </div>
  </div>

  <!-- Users List Panel -->
  <div class="panel">
    <div class="panel-header">
      <h2 class="panel-title">{page.url.searchParams.has("role_name") || page.url.searchParams.has("bank_id") ? `Users${page.url.searchParams.has("role_name") ? ` with Role: ${page.url.searchParams.get("role_name")}` : ""}${page.url.searchParams.has("bank_id") ? ` at Bank: ${page.url.searchParams.get("bank_id")}` : ""}` : "Recent Users"}</h2>
      <div class="panel-subtitle">{page.url.searchParams.has("role_name") || page.url.searchParams.has("bank_id") ? "Filtered results" : "Most recently created users"} (up to 100)</div>
    </div>
    <div class="panel-content">
      {#if users && users.length > 0}
        <div class="table-wrapper">
          <table class="users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>User ID</th>
                <th>Provider</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each users as user}
                <tr>
                  <td class="font-medium">{user.username || "N/A"}</td>
                  <td>{user.email || "N/A"}</td>
                  <td class="font-mono text-sm">{user.user_id || "N/A"}</td>
                  <td>{user.provider || "N/A"}</td>
                  <td>
                    {#if user.user_id}
                      <a
                        href="/users/{encodeURIComponent(user.user_id)}"
                        class="text-blue-600 hover:text-blue-800 underline"
                      >
                        Details
                      </a>
                    {:else}
                      <span class="text-gray-400">N/A</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else if hasApiAccess}
        <div class="empty-state">
          <p>No users found</p>
        </div>
      {:else}
        <div class="empty-state">
          <p>Unable to load users. Please check your API access.</p>
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

  .panel-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.25rem;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .panel-content {
    padding: 1.5rem;
  }

  .form-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  :global([data-mode="dark"]) .form-input {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
    border: none;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: white;
    color: #3b82f6;
    border: 1px solid #3b82f6;
  }

  .btn-secondary:hover {
    background: #eff6ff;
  }

  :global([data-mode="dark"]) .btn-secondary {
    background: rgb(var(--color-surface-700));
    color: rgb(var(--color-primary-400));
    border-color: rgb(var(--color-primary-400));
  }

  :global([data-mode="dark"]) .btn-secondary:hover {
    background: rgb(var(--color-surface-600));
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .users-table {
    width: 100%;
    border-collapse: collapse;
  }

  .users-table th {
    text-align: left;
    padding: 0.75rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
    border-bottom: 2px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .users-table th {
    color: var(--color-surface-300);
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .users-table td {
    padding: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.875rem;
  }

  :global([data-mode="dark"]) .users-table td {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .users-table tbody tr:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .users-table tbody tr:hover {
    background: rgb(var(--color-surface-700));
  }

  .users-table a {
    color: #2563eb;
    text-decoration: underline;
    font-weight: 500;
  }

  .users-table a:hover {
    color: #1d4ed8;
  }

  :global([data-mode="dark"]) .users-table a {
    color: rgb(var(--color-primary-400));
  }

  :global([data-mode="dark"]) .users-table a:hover {
    color: rgb(var(--color-primary-300));
  }

  .entitlement-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  :global([data-mode="dark"]) .entitlement-badge {
    background: rgb(var(--color-primary-900));
    color: rgb(var(--color-primary-200));
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  .alert {
    padding: 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
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
</style>
