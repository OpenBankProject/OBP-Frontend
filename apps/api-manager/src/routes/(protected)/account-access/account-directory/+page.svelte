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
  import { FolderOpen, Search, X, Loader2, Landmark } from "@lucide/svelte";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  interface DirectoryAccount {
    account_id: string;
    bank_id: string;
    label: string;
    account_number: string;
    account_type: string;
    branch_id: string;
    account_routings: { scheme: string; address: string }[];
    account_attributes: { type: string; code: string; value: string }[];
  }

  let accounts = $state<DirectoryAccount[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let searchQuery = $state("");

  let filteredAccounts = $derived.by(() => {
    if (!searchQuery.trim()) return accounts;
    const q = searchQuery.toLowerCase();
    return accounts.filter(
      (a) =>
        a.account_id?.toLowerCase().includes(q) ||
        a.label?.toLowerCase().includes(q) ||
        a.account_number?.toLowerCase().includes(q) ||
        a.account_type?.toLowerCase().includes(q) ||
        a.branch_id?.toLowerCase().includes(q),
    );
  });

  async function fetchAccountDirectory(bankId: string) {
    if (!bankId) {
      accounts = [];
      error = null;
      return;
    }
    loading = true;
    error = null;
    try {
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/banks/${encodeURIComponent(bankId)}/account-directory?limit=200`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      accounts = data.accounts || [];
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to fetch account directory";
      accounts = [];
    } finally {
      loading = false;
    }
  }

  // Re-fetch when bank changes
  $effect(() => {
    const bankId = currentBank.bankId;
    fetchAccountDirectory(bankId);
  });
</script>

<svelte:head>
  <title>Account Directory - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div>
          <h1 class="panel-title">Account Directory</h1>
          <div class="panel-subtitle">
            {#if currentBank.bankId}
              Account directory at bank <strong>{currentBank.bankId}</strong>
            {:else}
              Select a bank to view the account directory
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="panel-content">
      {#if !currentBank.bankId}
        <div class="empty-state">
          <div class="empty-icon">
            <Landmark size={48} />
          </div>
          <h4 class="empty-title">No Bank Selected</h4>
          <p class="empty-description">
            Please <a href="/user">select a bank</a> to view the account
            directory.
          </p>
        </div>
      {:else if loading}
        <div class="loading-state">
          <Loader2 size={32} class="spinner-icon" />
          <p>Loading account directory...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p class="error-message">{error}</p>
        </div>
      {:else}
        <div class="count-banner">
          <FolderOpen size={24} />
          <span class="count-number">{filteredAccounts.length}</span>
          <span class="count-label">
            {#if searchQuery.trim()}
              of {accounts.length} account{accounts.length !== 1 ? "s" : ""}
            {:else}
              account{accounts.length !== 1 ? "s" : ""} at {currentBank.bankId}
            {/if}
          </span>
        </div>

        {#if accounts.length > 0}
          <!-- Search -->
          <div class="search-wrapper">
            <Search class="search-icon" size={18} />
            <input
              type="text"
              class="search-input"
              placeholder="Filter by ID, label, account number, type, or branch..."
              bind:value={searchQuery}
            />
            {#if searchQuery}
              <button
                type="button"
                class="clear-button"
                onclick={() => (searchQuery = "")}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            {/if}
          </div>
        {/if}

        {#if filteredAccounts.length > 0}
          <div class="table-container">
            <table class="directory-table">
              <thead>
                <tr>
                  <th>Account ID</th>
                  <th>Type</th>
                  <th>Label</th>
                  <th>Account Number</th>
                  <th>Branch</th>
                  <th>Routings</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredAccounts as account}
                  {@const nonEmptyRoutings = (account.account_routings ?? []).filter(
                    (r) => (r.scheme && r.scheme.trim()) || (r.address && r.address.trim())
                  )}
                  <tr>
                    <td class="cell-mono cell-id">
                      <a href="/account-access/accounts/{encodeURIComponent(account.bank_id)}/{encodeURIComponent(account.account_id)}/public" class="account-link">
                        {account.account_id}
                      </a>
                    </td>
                    <td>
                      {#if account.account_type}
                        <span class="badge">{account.account_type}</span>
                      {:else}
                        —
                      {/if}
                    </td>
                    <td class="cell-label">{account.label || "—"}</td>
                    <td class="cell-mono">{account.account_number || "—"}</td>
                    <td>{account.branch_id || "—"}</td>
                    <td>
                      {#if nonEmptyRoutings.length}
                        <div class="routings">
                          {#each nonEmptyRoutings as routing}
                            <span class="routing-tag">
                              {routing.scheme}: {routing.address}
                            </span>
                          {/each}
                        </div>
                      {:else}
                        —
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else if searchQuery.trim()}
          <div class="empty-state">
            <h4 class="empty-title">No Matching Accounts</h4>
            <p class="empty-description">
              No accounts match "{searchQuery}".
            </p>
          </div>
        {:else}
          <div class="empty-state">
            <div class="empty-icon">
              <FolderOpen size={48} />
            </div>
            <h4 class="empty-title">No Accounts</h4>
            <p class="empty-description">
              No accounts found in the directory for this bank.
            </p>
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
    align-items: center;
    gap: 1.5rem;
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

  /* Count banner */
  .count-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    background: var(--ui-tone-success-bg);
    border: 1px solid var(--ui-tone-success-border);
    border-radius: 8px;
    margin-bottom: 1.5rem;
    color: var(--ui-tone-success-text);
  }

  .count-number {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .count-label {
    font-size: 0.875rem;
  }

  /* Search */
  .search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .search-wrapper :global(.search-icon) {
    position: absolute;
    left: 0.75rem;
    color: var(--ui-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.625rem 2.5rem 0.625rem 2.5rem;
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
    border-radius: 4px;
  }

  .clear-button:hover {
    color: var(--ui-muted);
    background: var(--ui-hover);
  }

  /* Table */
  .table-container {
    overflow-x: auto;
  }

  .directory-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }

  .directory-table th {
    text-align: left;
    padding: 0.625rem 0.75rem;
    font-weight: 600;
    color: var(--ui-muted);
    border-bottom: 2px solid var(--ui-border);
    white-space: nowrap;
  }

  .directory-table td {
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--ui-border);
    color: var(--ui-text);
    vertical-align: top;
  }

  .directory-table tbody tr:hover {
    background: var(--ui-hover);
  }

  .cell-label {
    font-weight: 500;
    color: var(--ui-text);
  }

  .cell-mono {
    font-family: monospace;
    font-size: 0.75rem;
  }

  .cell-id {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-link {
    color: var(--ui-link);
    text-decoration: none;
  }

  .account-link:hover {
    text-decoration: underline;
  }

  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .routings {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .routing-tag {
    font-size: 0.7rem;
    font-family: monospace;
    color: var(--ui-muted);
  }

  /* Empty/Loading/Error states */
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
    margin: 0;
    color: var(--ui-muted);
  }

  .loading-state {
    text-align: center;
    padding: 3rem;
    color: var(--ui-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .loading-state :global(.spinner-icon) {
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

  .error-state {
    padding: 1rem 1.5rem;
    background: var(--ui-tone-error-bg);
    border: 1px solid var(--ui-tone-error-border);
    border-radius: 8px;
    margin: 1rem 0;
  }

  .error-message {
    color: var(--ui-error);
    font-size: 0.875rem;
    margin: 0;
  }

  @media (max-width: 768px) {
    .panel-content {
      padding: 1rem;
    }

    .directory-table th,
    .directory-table td {
      padding: 0.5rem;
    }
  }
</style>
