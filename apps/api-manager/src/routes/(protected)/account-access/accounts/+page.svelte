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
  import { Landmark, Loader2 } from "@lucide/svelte";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  let accounts = $state<any[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  async function fetchAccounts(bankId: string) {
    if (!bankId) {
      accounts = [];
      error = null;
      return;
    }
    loading = true;
    error = null;
    try {
      const res = await trackedFetch(`/proxy/obp/v6.0.0/banks/${encodeURIComponent(bankId)}/accounts`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || `HTTP ${res.status} Failed to fetch accounts`);
      }
      const data = await res.json();
      accounts = data.accounts || [];
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch accounts";
      accounts = [];
    } finally {
      loading = false;
    }
  }

  // Re-fetch when bank changes
  $effect(() => {
    const bankId = currentBank.bankId;
    fetchAccounts(bankId);
  });
</script>

<svelte:head>
  <title>Accounts - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <h1 class="panel-title">Accounts</h1>
      <div class="panel-subtitle">
        {#if currentBank.bankId}
          Accounts at bank <strong>{currentBank.bankId}</strong>
        {:else}
          Select a bank to view accounts
        {/if}
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
            Please <a href="/user">select a bank</a> to view accounts.
          </p>
        </div>
      {:else if loading}
        <div class="loading-state">
          <Loader2 size={32} class="spinner-icon" />
          <p>Loading accounts...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p class="error-message">{error}</p>
        </div>
      {:else}
        <div class="count-banner">
          <Landmark size={24} />
          <span class="count-number">{accounts.length}</span>
          <span class="count-label">account{accounts.length !== 1 ? "s" : ""} at {currentBank.bankId}</span>
        </div>

        {#if accounts.length > 0}
          <ul class="account-list">
            {#each accounts as account}
              {@const acctId = account.id || account.account_id}
              {@const firstViewObj = account.views_available?.[0]}
              {@const firstView = firstViewObj?.id || firstViewObj?.view_id || "owner"}
              <li class="account-item">
                <a href="/account-access/accounts/{encodeURIComponent(currentBank.bankId)}/{encodeURIComponent(acctId)}/{encodeURIComponent(firstView)}" class="account-link">
                  <span class="account-id">{acctId}</span>
                  {#if account.label}
                    <span class="account-label">{account.label}</span>
                  {/if}
                </a>
                {#if account.views_available?.length}
                  <span class="account-views">{account.views_available.length} view{account.views_available.length !== 1 ? "s" : ""}</span>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <div class="empty-state">
            <div class="empty-icon">
              <Landmark size={48} />
            </div>
            <h4 class="empty-title">No Accounts</h4>
            <p class="empty-description">
              No accounts found at this bank.
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

  /* Count banner */
  .count-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    color: #166534;
  }

  :global([data-mode="dark"]) .count-banner {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
    color: rgb(var(--color-success-300));
  }

  .count-number {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .count-label {
    font-size: 0.875rem;
  }

  /* Account list */
  .account-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .account-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .account-item:last-child {
    border-bottom: none;
  }

  :global([data-mode="dark"]) .account-item {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .account-link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    text-decoration: none;
    flex: 1;
  }

  .account-link:hover .account-id {
    color: #3b82f6;
  }

  :global([data-mode="dark"]) .account-link:hover .account-id {
    color: rgb(var(--color-primary-400));
  }

  .account-id {
    font-size: 0.8rem;
    font-family: monospace;
    color: #111827;
    font-weight: 500;
    transition: color 0.2s;
  }

  :global([data-mode="dark"]) .account-id {
    color: var(--color-surface-100);
  }

  .account-label {
    font-size: 0.8rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .account-label {
    color: var(--color-surface-400);
  }

  .account-views {
    margin-left: auto;
    font-size: 0.7rem;
    padding: 0.125rem 0.5rem;
    background: #f3f4f6;
    color: #6b7280;
    border-radius: 9999px;
  }

  :global([data-mode="dark"]) .account-views {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-300);
  }

  /* Loading */
  .loading-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  :global([data-mode="dark"]) .loading-state {
    color: var(--color-surface-400);
  }

  .loading-state :global(.spinner-icon) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Error */
  .error-state {
    padding: 1rem 1.5rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 8px;
    margin: 1rem 0;
  }

  :global([data-mode="dark"]) .error-state {
    background: rgba(220, 38, 38, 0.1);
    border-color: rgba(220, 38, 38, 0.3);
  }

  .error-message {
    color: #991b1b;
    font-size: 0.875rem;
    margin: 0;
  }

  :global([data-mode="dark"]) .error-message {
    color: rgb(var(--color-error-300));
  }
</style>
