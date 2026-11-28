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
  import { Search, User, UserCheck, X } from "@lucide/svelte";
  import { page } from "$app/state";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";

  interface UserResult {
    user_id: string;
    email: string;
    username: string;
    provider: string;
    provider_id: string;
  }

  // What the pages need from the chosen user. The logged-in user (from the session) has these but not
  // the provider fields, so "Me" passes this smaller shape.
  type SelectedUser = Pick<UserResult, "user_id" | "username" | "email">;

  interface Props {
    onSelect: (user: SelectedUser) => void;
    selectedUserId?: string;
    selectedUsername?: string;
    disabled?: boolean;
    initialUsername?: string;
  }

  let {
    onSelect,
    selectedUserId = $bindable(""),
    selectedUsername = $bindable(""),
    disabled = false,
    initialUsername = "",
  }: Props = $props();

  let searchQuery = $state(initialUsername);
  let isSearching = $state(false);
  let searchResults = $state<UserResult[]>([]);
  let showResults = $state(false);
  let searchError = $state("");
  let searchType = $state<"email" | "userid" | "username">("username");
  let debounceTimer: number | null = null;

  // Provider dropdown state
  let providers = $state<string[]>([]);
  let selectedProvider = $state("");
  let isLoadingProviders = $state(false);

  // Fetch providers on mount
  $effect(() => {
    fetchProviders();
  });

  async function fetchProviders() {
    isLoadingProviders = true;
    try {
      const response = await trackedFetch("/proxy/obp/v6.0.0/providers");
      if (response.ok) {
        const data = await response.json();
        providers = data.providers;
      }
    } catch (error) {
      console.error("Failed to fetch providers:", error);
    } finally {
      isLoadingProviders = false;
    }
  }

  // Detect search type based on input
  function detectSearchType(input: string): "email" | "userid" | "username" {
    if (input.includes("@") && input.includes(".")) {
      return "email";
    }
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(input)) {
      return "userid";
    }
    return "username";
  }

  const searchTypeLabels: Record<string, string> = {
    email: "Searching by email",
    userid: "Looking up User ID",
    username: "Searching by username",
  };

  // Trigger search on mount if initialUsername is provided
  $effect(() => {
    if (initialUsername && !selectedUserId) {
      searchUsers(initialUsername);
    }
  });

  async function searchUsers(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      searchResults = [];
      showResults = false;
      return;
    }

    const type = detectSearchType(trimmed);
    searchType = type;
    isSearching = true;
    searchError = "";

    try {
      let url: string;
      if (type === "email") {
        url = `/proxy/obp/v5.1.0/users/email/${encodeURIComponent(trimmed)}/terminator`;
      } else if (type === "userid") {
        url = `/proxy/obp/v6.0.0/users/user-id/${encodeURIComponent(trimmed)}`;
      } else {
        // Username search via /obp/v6.0.0/users with query-param filters
        const params = new URLSearchParams();
        params.set("username", trimmed);
        if (selectedProvider) {
          params.set("provider", selectedProvider);
        }
        url = `/proxy/obp/v6.0.0/users?${params.toString()}`;
      }

      const response = await trackedFetch(url);

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to search users",
        );
        logErrorDetails("Search Users", errorDetails);
        searchError = formatErrorForDisplay(errorDetails);
        searchResults = [];
        return;
      }

      const data = await response.json();

      // Normalize response: userid OBP endpoint returns the user object directly; others return {users: [...]}
      let users: UserResult[];
      if (type === "userid") {
        users = data.user_id ? [data] : [];
      } else {
        users = data.users;
      }

      // Filter out users without a username
      users = users.filter(
        (user: UserResult) => user.username && user.username.trim() !== "",
      );

      // For username searches, also filter by search query match
      if (type === "username") {
        const searchLower = trimmed.toLowerCase();
        users = users.filter((user: UserResult) => {
          const usernameMatch = user.username
            .toLowerCase()
            .includes(searchLower);
          const emailMatch = user.email?.toLowerCase().includes(searchLower);
          return usernameMatch || emailMatch;
        });
      }

      searchResults = users;

      // Auto-select if userid lookup returned exactly one result
      if (type === "userid" && users.length === 1) {
        handleSelectUser(users[0]);
      } else {
        showResults = true;
      }
    } catch (error) {
      console.error("User search error:", error);
      searchError =
        error instanceof Error ? error.message : "Failed to search users";
      searchResults = [];
    } finally {
      isSearching = false;
    }
  }

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchQuery = target.value;

    if (selectedUserId) {
      selectedUserId = "";
      selectedUsername = "";
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = window.setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
  }

  // The logged-in user, from the root layout. Lets an admin pick themselves, for example to grant
  // themselves a Role.
  let me = $derived<SelectedUser | null>(
    page.data.userId
      ? { user_id: page.data.userId, username: page.data.username, email: page.data.email }
      : null,
  );

  function handleSelectUser(user: SelectedUser) {
    selectedUserId = user.user_id;
    selectedUsername = user.username;
    searchQuery = `${user.username} (${user.email})`;
    showResults = false;
    onSelect(user);
  }

  function handleClear() {
    selectedUserId = "";
    selectedUsername = "";
    searchQuery = "";
    searchResults = [];
    showResults = false;
    searchError = "";
    selectedProvider = "";
  }

  function handleBlur() {
    // Delay hiding results to allow click events to fire
    setTimeout(() => {
      showResults = false;
    }, 200);
  }
</script>

<div class="user-search-widget">
  <div class="search-container">
    <div class="search-row">
      <select
        id="provider-select"
        class="provider-select"
        bind:value={selectedProvider}
        {disabled}
        onchange={() => {
          if (searchQuery.trim()) {
            searchUsers(searchQuery);
          }
        }}
      >
        <option value="">Any provider</option>
        {#each providers as provider}
          <option value={provider}>{provider}</option>
        {/each}
      </select>

      <div class="search-input-wrapper">
      <Search class="search-icon" size={18} />
      <input
        type="text"
        name="user-search"
        data-testid="user-search-input"
        data-state={selectedUserId ? "selected" : searchQuery.trim() ? "unselected" : "empty"}
        class="search-input"
        class:search-input--unselected={!selectedUserId && !!searchQuery.trim()}
        class:search-input--selected={!!selectedUserId}
        placeholder="Enter username, email, or user ID..."
        value={searchQuery}
        oninput={handleSearchInput}
        onfocus={() => {
          if (searchResults.length > 0) showResults = true;
        }}
        onblur={handleBlur}
        {disabled}
      />
      {#if searchQuery && !disabled}
        <button
          type="button"
          class="clear-button"
          onclick={handleClear}
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      {/if}
      {#if isSearching}
        <div class="loading-spinner">⏳</div>
      {/if}
    </div>
      {#if me}
        <button
          type="button"
          class="me-button"
          data-testid="user-search-me"
          data-state={selectedUserId === me.user_id ? "selected" : "unselected"}
          onclick={() => me && handleSelectUser(me)}
          title="Select yourself ({me.username})"
          {disabled}
        >
          <UserCheck size={16} />
          <span>Me</span>
        </button>
      {/if}
    </div>

    {#if searchQuery.trim() && !selectedUserId}
      <div class="search-type-indicator" data-testid="user-search-hint">
        {#if showResults && searchResults.length > 0}
          Click a user below to select.
        {:else if selectedProvider && searchType === "username"}
          Searching by provider ({selectedProvider}) + username
        {:else}
          {searchTypeLabels[searchType]}
        {/if}
      </div>
    {/if}

    {#if showResults && searchResults.length > 0}
      <div class="search-results">
        {#each searchResults as user}
          <button
            type="button"
            class="user-result"
            onclick={() => handleSelectUser(user)}
          >
            <div class="user-result-icon">
              <User size={16} />
            </div>
            <div class="user-result-content">
              <div class="user-result-name">{user.username}</div>
              <div class="user-result-email">{user.email}</div>
              <div class="user-result-meta">
                {user.provider} • {user.user_id}
              </div>
            </div>
          </button>
        {/each}
      </div>
    {/if}

    {#if showResults && !isSearching && searchResults.length === 0 && searchQuery}
      <div class="search-results">
        <div class="no-results">No users found matching "{searchQuery}"</div>
      </div>
    {/if}

    {#if searchError}
      <div class="search-error">{searchError}</div>
    {/if}
  </div>

  {#if selectedUserId}
    <div class="selected-user">
      <User size={14} />
      <span class="selected-user-text">
        Selected: <strong>{selectedUsername}</strong> ({selectedUserId})
      </span>
    </div>
  {/if}
</div>

<style>
  .user-search-widget {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .search-container {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .search-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .me-button {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    background: var(--ui-card);
    color: var(--ui-text);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .me-button:hover:not(:disabled) {
    background: var(--ui-hover);
    border-color: var(--ui-link);
  }

  .me-button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .provider-select {
    width: auto;
    min-width: 0;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    font-size: 0.8rem;
    background: var(--ui-card);
    color: var(--ui-text);
    transition: all 0.2s;
    cursor: pointer;
  }

  .provider-select:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-link) 10%, transparent);
  }

  .provider-select:disabled {
    background: var(--ui-card);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 400px;
  }

  .search-input-wrapper :global(.search-icon) {
    position: absolute;
    left: 0.75rem;
    color: var(--ui-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 2.5rem 0.75rem 2.5rem;
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

  .search-input--unselected {
    border-color: var(--ui-tone-warning-border);
    background: var(--ui-tone-warning-bg);
  }

  .search-input--unselected:focus {
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-warning) 15%, transparent);
  }

  .search-input--selected {
    border-color: var(--ui-tone-success-border);
    background: var(--ui-tone-success-bg);
  }

  .search-input--selected:focus {
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-success) 15%, transparent);
  }

  .search-input:disabled {
    background: var(--ui-card);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .clear-button {
    position: absolute;
    right: 0.75rem;
    background: none;
    border: none;
    color: var(--ui-muted);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
    border-radius: 4px;
  }

  .clear-button:hover {
    color: var(--ui-muted);
    background: var(--ui-hover);
  }

  .loading-spinner {
    position: absolute;
    right: 0.75rem;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .search-type-indicator {
    font-size: 0.7rem;
    color: var(--ui-muted);
    padding: 0.25rem 0;
    font-style: italic;
  }

  .search-results {
    width: 100%;
    max-height: 300px;
    overflow-y: auto;
    background: var(--ui-card);
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    margin-top: 0.25rem;
  }

  .user-result {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s;
    border-bottom: 1px solid var(--ui-border);
  }

  .user-result:last-child {
    border-bottom: none;
  }

  .user-result:hover {
    background: var(--ui-hover);
  }

  .user-result-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    background: var(--ui-panel);
    border-radius: 50%;
    color: var(--ui-muted);
    flex-shrink: 0;
  }

  .user-result-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .user-result-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--ui-text);
  }

  .user-result-email {
    font-size: 0.75rem;
    color: var(--ui-muted);
  }

  .user-result-meta {
    font-size: 0.7rem;
    color: var(--ui-muted);
    font-family: monospace;
  }

  .no-results {
    padding: 1.5rem;
    text-align: center;
    color: var(--ui-muted);
    font-size: 0.875rem;
  }

  .search-error {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: var(--ui-tone-error-bg);
    border: 1px solid var(--ui-tone-error-border);
    border-radius: 4px;
    color: var(--ui-tone-error-text);
    font-size: 0.75rem;
  }

  .selected-user {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--ui-tone-success-bg);
    border: 1px solid var(--ui-tone-success-border);
    border-radius: 4px;
    font-size: 0.75rem;
    color: var(--ui-tone-success-text);
  }

  .selected-user :global(svg) {
    flex-shrink: 0;
  }

  .selected-user-text {
    flex: 1;
  }
</style>
