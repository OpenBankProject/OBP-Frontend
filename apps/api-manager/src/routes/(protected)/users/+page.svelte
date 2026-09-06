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
  import { Mail } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import type { PageData } from "./$types";

  let { data } = $props<{ data: PageData }>();

  let roleFilter = $state(page.url.searchParams.get("role_name") ?? "");
  let bankIdFilter = $state(page.url.searchParams.get("bank_id") ?? "");
  let roles = $state<string[]>([]);
  let banks = $state<string[]>([]);

  // Fetch roles and banks on mount
  $effect(() => {
    async function fetchRoles() {
      try {
        const response = await fetch("/proxy/obp/v6.0.0/roles");
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
        const response = await fetch("/proxy/obp/v6.0.0/banks");
        const result = await response.json();
        if (result.banks) {
          banks = result.banks.map((b: any) => b.bank_id).sort();
        }
      } catch (err) {
        console.error("Error fetching banks:", err);
      }
    }
    fetchRoles();
    fetchBanks();
  });

  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  let providers = $state<string[]>([]);
  let selectedProvider = $state("");
  let searchQuery = $state("");
  let lastSearchedQuery = $state("");
  let searchResults = $state<any[]>([]);
  let searchError = $state<string | null>(null);
  let isSearching = $state(false);
  let searchType = $state<"email" | "userid" | "username" | "">("");
  let sortBy = $state("");
  let sortDirection = $state<"asc" | "desc">("desc");
  let lastSearchCall = $state<{ proxyUrl: string; obpPath: string; status?: number; responseBody?: string } | null>(null);

  // Fetch providers on mount
  $effect(() => {
    async function fetchProviders() {
      try {
        const response = await fetch("/proxy/obp/v6.0.0/providers");
        const result = await response.json();
        if (result.providers) {
          providers = result.providers;
        }
      } catch (err) {
        console.error("Error fetching providers:", err);
      }
    }
    fetchProviders();
  });

  // Auto-run search on mount (URL filters if present, else empty search)
  onMount(() => {
    handleSearch();
  });

  function handleClear() {
    searchQuery = "";
    selectedProvider = "";
    roleFilter = "";
    bankIdFilter = "";
    sortBy = "";
    sortDirection = "desc";
    history.replaceState(null, "", "/users");
    handleSearch();
  }

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
    const query = searchQuery.trim();
    isSearching = true;
    searchError = null;
    lastSearchedQuery = query;

    const params = new URLSearchParams();
    params.set("limit", "100");
    if (query) {
      const type = detectSearchType(query);
      searchType = type;
      if (type === "email") {
        params.set("email", query);
      } else if (type === "userid") {
        params.set("user_id", query);
      } else {
        params.set("username", query);
      }
    } else {
      searchType = "";
    }
    if (selectedProvider) {
      params.set("provider", selectedProvider);
    }
    if (roleFilter) {
      params.set("role_name", roleFilter);
    }
    if (bankIdFilter) {
      params.set("bank_id", bankIdFilter);
    }
    if (sortBy) {
      params.set("sort_by", sortBy);
      params.set("sort_direction", sortDirection);
    }
    const proxyUrl = `/proxy/obp/v6.0.0/users?${params.toString()}`;

    const obpPath = proxyUrl.replace(/^\/proxy/, "");
    lastSearchCall = { proxyUrl, obpPath };

    try {
      const response = await fetch(proxyUrl);
      const responseText = await response.text();
      lastSearchCall = { proxyUrl, obpPath, status: response.status, responseBody: responseText };

      const result = responseText ? JSON.parse(responseText) : {};

      if (!response.ok) {
        if (typeof result.message !== "string") {
          throw new Error(
            `OBP error response missing 'message' field (HTTP ${response.status})`,
          );
        }
        searchError = result.message;
        searchResults = [];
        return;
      }

      searchResults = result.users;
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
    <h1 class="text-3xl font-bold">Search Users</h1>
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
    <div class="panel-content">
      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        class="flex gap-4 items-end flex-wrap"
      >
        <div class="flex-1" style="min-width: 240px;">
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
        <div style="flex: 0 0 220px;">
          <label for="provider-select" class="block text-sm font-medium mb-2"
            >Provider</label
          >
          <select
            id="provider-select"
            bind:value={selectedProvider}
            class="form-input w-full"
          >
            <option value="">Any</option>
            {#each providers as provider}
              <option value={provider}>{provider}</option>
            {/each}
          </select>
        </div>
        <div style="flex: 0 0 220px;">
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
        <div style="flex: 0 0 220px;">
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
        <div style="flex: 0 0 180px;">
          <label for="sort-by-input" class="block text-sm font-medium mb-2"
            >Sort by</label
          >
          <select
            id="sort-by-input"
            bind:value={sortBy}
            data-testid="sort-by-input"
            class="form-input w-full"
          >
            <option value="">Default</option>
            <option value="created_date">Created date</option>
            <option value="updated_date">Updated date</option>
            <option value="username">Username</option>
            <option value="email">Email</option>
            <option value="user_id">User ID</option>
            <option value="provider">Provider</option>
          </select>
        </div>
        <div style="flex: 0 0 140px;">
          <label for="sort-direction-input" class="block text-sm font-medium mb-2"
            >Direction</label
          >
          <select
            id="sort-direction-input"
            bind:value={sortDirection}
            data-testid="sort-direction-input"
            class="form-input w-full"
            disabled={!sortBy}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={isSearching}
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          onclick={handleClear}
          disabled={isSearching}
          data-testid="clear-search"
        >
          Clear
        </button>
      </form>

      {#snippet technicalDetails()}
        {#if lastSearchCall}
          <details class="search-call-details" data-testid="last-search-call">
            <summary class="search-call-summary" data-testid="last-search-call-toggle">Debug</summary>
            <div class="search-call-info">
              <div class="search-call-field">
                <label for="last-search-proxy-url" class="search-call-label">Proxy URL</label>
                <input
                  id="last-search-proxy-url"
                  type="text"
                  readonly
                  value={lastSearchCall.proxyUrl}
                  data-testid="last-search-proxy-url"
                  class="search-call-input"
                  onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
                />
              </div>
              <div class="search-call-field">
                <label for="last-search-obp-path" class="search-call-label">OBP path</label>
                <input
                  id="last-search-obp-path"
                  type="text"
                  readonly
                  value={lastSearchCall.obpPath}
                  data-testid="last-search-obp-path"
                  class="search-call-input"
                  onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
                />
              </div>
              {#if lastSearchCall.status !== undefined}
                <div class="search-call-field">
                  <span class="search-call-label">Status</span>
                  <span class="search-call-status" data-testid="last-search-status">{lastSearchCall.status}</span>
                </div>
              {/if}
              {#if lastSearchCall.responseBody}
                <div class="search-call-field">
                  <label for="last-search-response-body" class="search-call-label">Response</label>
                  <textarea
                    id="last-search-response-body"
                    readonly
                    data-testid="last-search-response-body"
                    class="search-call-textarea"
                    onclick={(e) => (e.currentTarget as HTMLTextAreaElement).select()}
                    rows="6"
                  >{lastSearchCall.responseBody}</textarea>
                </div>
              {/if}
            </div>
          </details>
        {/if}
      {/snippet}

      {#if searchResults.length > 0}
        <div class="mt-6">
          <div class="search-results-header mb-4">
            <h3 class="text-lg font-semibold">
              {searchResults.length === 1
                ? "Result"
                : `Results (${searchResults.length})`}
            </h3>
            {@render technicalDetails()}
          </div>
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
        <div class="mt-6">
          <div class="search-results-header mb-3">
            <strong class="text-error">Search error</strong>
            {@render technicalDetails()}
          </div>
          <div class="alert alert-error">{searchError}</div>
        </div>
      {:else if lastSearchCall && !isSearching}
        <div class="mt-6">
          <div class="search-results-header mb-3">
            <span class="text-gray-500">
              No users found{lastSearchedQuery ? ` matching "${lastSearchedQuery}"` : ""}
            </span>
            {@render technicalDetails()}
          </div>
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

  .search-results-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .search-call-details {
    font-size: 0.8125rem;
  }

  .search-call-details[open] {
    flex-basis: 100%;
  }

  .search-call-summary {
    padding: 0.25rem 0;
    cursor: pointer;
    font-weight: 600;
    color: #6b7280;
    user-select: none;
  }

  :global([data-mode="dark"]) .search-call-summary {
    color: var(--color-surface-400);
  }

  .search-call-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }

  .search-call-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .search-call-label {
    color: #6b7280;
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  :global([data-mode="dark"]) .search-call-label {
    color: var(--color-surface-400);
  }

  .search-call-input,
  .search-call-textarea {
    width: 100%;
    padding: 0.375rem 0.5rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.8125rem;
    color: #111827;
  }

  :global([data-mode="dark"]) .search-call-input,
  :global([data-mode="dark"]) .search-call-textarea {
    background: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  .search-call-textarea {
    resize: vertical;
    min-height: 4rem;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .search-call-status {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.8125rem;
  }
</style>
