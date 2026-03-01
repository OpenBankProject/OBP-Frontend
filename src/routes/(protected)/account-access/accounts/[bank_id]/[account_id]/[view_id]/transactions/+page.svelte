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
        `/api/obp/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/${encodeURIComponent(viewId)}/transactions?limit=50&offset=0&sort_direction=ASC`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch transactions");
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
    color: #3b82f6;
    text-decoration: none;
  }

  .breadcrumb-link:hover {
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .breadcrumb-link {
    color: rgb(var(--color-primary-400));
  }

  .breadcrumb-separator {
    color: #9ca3af;
  }

  :global([data-mode="dark"]) .breadcrumb-separator {
    color: var(--color-surface-500);
  }

  .breadcrumb-current {
    color: #6b7280;
  }

  :global([data-mode="dark"]) .breadcrumb-current {
    color: var(--color-surface-400);
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
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
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
    color: #111827;
    margin: 0 0 0.125rem 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.75rem;
    color: #6b7280;
    font-family: monospace;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    background: #f3f4f6;
    color: #374151;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
  }

  .btn-secondary:hover {
    background: #e5e7eb;
  }

  :global([data-mode="dark"]) .btn-secondary {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
  }

  :global([data-mode="dark"]) .btn-secondary:hover {
    background: rgb(var(--color-surface-600));
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
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.7rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .txn-header {
    background: rgb(var(--color-surface-900));
    border-bottom-color: rgb(var(--color-surface-700));
    color: var(--color-surface-400);
  }

  .txn-header > div {
    padding: 0.5rem 0.75rem;
  }

  .txn-row {
    display: grid;
    grid-template-columns: 100px 1fr 1fr 120px 120px;
    border-bottom: 1px solid #f3f4f6;
    font-size: 0.8rem;
  }

  .txn-row:last-child {
    border-bottom: none;
  }

  .txn-row:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .txn-row {
    border-bottom-color: rgb(var(--color-surface-800));
  }

  :global([data-mode="dark"]) .txn-row:hover {
    background: rgb(var(--color-surface-900));
  }

  .txn-row > div {
    padding: 0.5rem 0.75rem;
    display: flex;
    align-items: center;
  }

  .txn-date {
    color: #6b7280;
    font-size: 0.75rem;
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .txn-date {
    color: var(--color-surface-400);
  }

  .txn-description {
    color: #111827;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .txn-description {
    color: var(--color-surface-200);
  }

  .txn-counterparty {
    color: #374151;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .txn-counterparty {
    color: var(--color-surface-300);
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
    color: #dc2626;
  }

  :global([data-mode="dark"]) .txn-amount.negative {
    color: rgb(var(--color-error-400));
  }

  .txn-amount.positive {
    color: #166534;
  }

  :global([data-mode="dark"]) .txn-amount.positive {
    color: rgb(var(--color-success-400));
  }

  .txn-balance {
    font-family: monospace;
    font-size: 0.75rem;
    color: #6b7280;
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .txn-balance {
    color: var(--color-surface-400);
  }

  .txn-currency {
    font-size: 0.65rem;
    font-weight: 400;
    opacity: 0.7;
  }

  .txn-count {
    padding: 0.5rem 0.75rem;
    font-size: 0.7rem;
    color: #9ca3af;
    border-top: 1px solid #f3f4f6;
  }

  :global([data-mode="dark"]) .txn-count {
    color: var(--color-surface-500);
    border-top-color: rgb(var(--color-surface-800));
  }

  /* States */
  .loading-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
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

  .error-state {
    padding: 1.5rem;
    margin: 1rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
  }

  :global([data-mode="dark"]) .error-state {
    background: rgba(220, 38, 38, 0.1);
    border-color: rgba(220, 38, 38, 0.3);
  }

  .error-message {
    color: #991b1b;
    font-size: 0.8rem;
    margin: 0;
  }

  :global([data-mode="dark"]) .error-message {
    color: rgb(var(--color-error-300));
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
    font-size: 0.875rem;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
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
