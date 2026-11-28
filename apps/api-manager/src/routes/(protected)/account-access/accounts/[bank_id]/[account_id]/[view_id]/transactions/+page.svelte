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
  import { page } from "$app/state";
  import { ArrowLeft, Loader2 } from "@lucide/svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import { userPreferences } from "$lib/stores/userPreferences.svelte";

  let transactions = $state<any[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  let bankId = $derived(page.params.bank_id || "");
  let accountId = $derived(page.params.account_id || "");
  let viewId = $derived(page.params.view_id || "");

  let parsedError = $derived.by(() => {
    if (!error) return null;
    const match = error.match(/OBP-(\d+):.*missing one or more roles:\s*(.+)/i);
    if (match) {
      const roles = match[2].split(",").map((r: string) => r.trim());
      return { type: "missing_role" as const, code: match[1], roles, message: error };
    }
    return { type: "general" as const, message: error };
  });

  async function fetchTransactions(bankId: string, accountId: string, viewId: string) {
    loading = true;
    error = null;
    try {
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/${encodeURIComponent(viewId)}/transactions?limit=50&offset=0&sort_direction=ASC`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || `HTTP ${res.status} Failed to fetch transactions`);
      }
      const data = await res.json();
      transactions = data.transactions || [];
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch transactions";
      transactions = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (bankId && accountId && viewId) {
      fetchTransactions(bankId, accountId, viewId);
    }
  });
</script>

<svelte:head>
  <title>Transactions - {viewId} - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb -->
  <nav class="breadcrumb mb-4">
    <a href="/account-access/accounts" class="breadcrumb-link">Accounts</a>
    <span class="breadcrumb-separator">›</span>
    <a href="/account-access/accounts/{encodeURIComponent(bankId)}/{encodeURIComponent(accountId)}/{encodeURIComponent(viewId)}" class="breadcrumb-link">{accountId}</a>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">Transactions ({viewId})</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div>
          <h1 class="panel-title">Transactions</h1>
          <div class="panel-subtitle">{bankId} / {accountId} / {viewId}</div>
        </div>
        <a href="/account-access/accounts/{encodeURIComponent(bankId)}/{encodeURIComponent(accountId)}/{encodeURIComponent(viewId)}" class="btn-secondary">
          <ArrowLeft size={16} />
          Back
        </a>
      </div>
    </div>

    <div class="panel-content">
      {#if loading}
        <div class="loading-state">
          <Loader2 size={24} class="spinner-icon" />
          <p>Loading transactions...</p>
        </div>
      {:else if error}
        {#if parsedError && parsedError.type === "missing_role"}
          <MissingRoleAlert
            roles={parsedError.roles}
            errorCode={parsedError.code}
            message={parsedError.message}
            bankId={bankId}
          />
        {:else}
          <div class="error-state">
            <p class="error-message">{error}</p>
          </div>
        {/if}
      {:else if transactions.length === 0}
        <div class="empty-state">No transactions found.</div>
      {:else}
        <div class="txn-table">
          <div class="txn-header">
            <div class="txn-col-date">Date</div>
            <div class="txn-col-desc">Description</div>
            <div class="txn-col-counterparty">Counterparty</div>
            <div class="txn-col-amount">Amount</div>
            <div class="txn-col-balance">Balance</div>
          </div>
          {#each transactions as txn}
            {@const amount = txn.details?.value?.amount}
            {@const currency = txn.details?.value?.currency}
            {@const newBalance = txn.details?.new_balance?.amount}
            {@const balanceCurrency = txn.details?.new_balance?.currency}
            {@const isNegative = amount && parseFloat(amount) < 0}
            {@const counterparty = txn.other_account?.holder?.name || txn.other_account?.metadata?.public_alias || "—"}
            <div class="txn-row">
              <div class="txn-col-date">
                <span class="txn-date">{userPreferences.formatDate(txn.details?.completed)}</span>
              </div>
              <div class="txn-col-desc">
                <span class="txn-description">{txn.details?.description || "—"}</span>
              </div>
              <div class="txn-col-counterparty">
                <span class="txn-counterparty">{counterparty}</span>
              </div>
              <div class="txn-col-amount">
                <span class="txn-amount" class:negative={isNegative} class:positive={!isNegative}>
                  {amount || "—"}{#if currency} <span class="txn-currency">{currency}</span>{/if}
                </span>
              </div>
              <div class="txn-col-balance">
                <span class="txn-balance">
                  {newBalance || "—"}{#if balanceCurrency} <span class="txn-currency">{balanceCurrency}</span>{/if}
                </span>
              </div>
            </div>
          {/each}
        </div>
        <div class="txn-count">{transactions.length} transaction{transactions.length !== 1 ? "s" : ""}</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1200px;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
  }

  .breadcrumb-link {
    color: var(--ui-link);
    text-decoration: none;
  }

  .breadcrumb-link:hover {
    text-decoration: underline;
  }

  .breadcrumb-separator {
    color: var(--ui-muted);
  }

  .breadcrumb-current {
    color: var(--ui-muted);
  }

  .panel {
    background: var(--ui-card);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .panel-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--ui-border);
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .panel-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--ui-text);
    margin: 0 0 0.125rem 0;
  }

  .panel-subtitle {
    font-size: 0.75rem;
    color: var(--ui-muted);
    font-family: monospace;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    background: var(--ui-panel);
    color: var(--ui-text);
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
  }

  .btn-secondary:hover {
    background: var(--ui-hover);
  }

  .panel-content {
    padding: 0;
  }

  /* Transaction table */
  .txn-table {
    width: 100%;
  }

  .txn-header {
    display: grid;
    grid-template-columns: 100px 1fr 1fr 120px 120px;
    background: var(--ui-card);
    border-bottom: 1px solid var(--ui-border);
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--ui-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .txn-header > div {
    padding: 0.5rem 0.75rem;
  }

  .txn-row {
    display: grid;
    grid-template-columns: 100px 1fr 1fr 120px 120px;
    border-bottom: 1px solid var(--ui-border);
    font-size: 0.8rem;
  }

  .txn-row:last-child {
    border-bottom: none;
  }

  .txn-row:hover {
    background: var(--ui-hover);
  }

  .txn-row > div {
    padding: 0.5rem 0.75rem;
    display: flex;
    align-items: center;
  }

  .txn-date {
    color: var(--ui-muted);
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .txn-description {
    color: var(--ui-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .txn-counterparty {
    color: var(--ui-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .txn-col-amount,
  .txn-col-balance {
    justify-content: flex-end;
    text-align: right;
  }

  .txn-amount {
    font-family: monospace;
    font-weight: 600;
    white-space: nowrap;
  }

  .txn-amount.negative {
    color: var(--ui-error);
  }

  .txn-amount.positive {
    color: var(--ui-success);
  }

  .txn-balance {
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--ui-muted);
    white-space: nowrap;
  }

  .txn-currency {
    font-size: 0.65rem;
    font-weight: 400;
    opacity: 0.7;
  }

  .txn-count {
    padding: 0.5rem 0.75rem;
    font-size: 0.7rem;
    color: var(--ui-muted);
    border-top: 1px solid var(--ui-border);
  }

  /* States */
  .loading-state {
    text-align: center;
    padding: 3rem;
    color: var(--ui-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .loading-state :global(.spinner-icon) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .error-state {
    padding: 1.5rem;
    margin: 1rem;
    background: var(--ui-tone-error-bg);
    border: 1px solid var(--ui-tone-error-border);
    border-radius: 6px;
  }

  .error-message {
    color: var(--ui-error);
    font-size: 0.8rem;
    margin: 0;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--ui-muted);
    font-size: 0.875rem;
  }

  @media (max-width: 768px) {
    .txn-header,
    .txn-row {
      grid-template-columns: 80px 1fr 100px;
    }

    .txn-col-counterparty,
    .txn-col-balance {
      display: none;
    }
  }
</style>
