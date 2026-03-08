<script lang="ts">
  import { page } from "$app/state";
  import { ArrowLeft, Loader2 } from "@lucide/svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";

  let counterparties = $state<any[]>([]);
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

  async function fetchCounterparties(bankId: string, accountId: string, viewId: string) {
    loading = true;
    error = null;
    try {
      const res = await trackedFetch(
        `/api/obp/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/${encodeURIComponent(viewId)}/counterparties`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch counterparties");
      }
      const data = await res.json();
      counterparties = data.counterparties || [];
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch counterparties";
      counterparties = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (bankId && accountId && viewId) {
      fetchCounterparties(bankId, accountId, viewId);
    }
  });
</script>

<svelte:head>
  <title>Counterparties - {viewId} - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb -->
  <nav class="breadcrumb mb-4">
    <a href="/account-access/accounts" class="breadcrumb-link">Accounts</a>
    <span class="breadcrumb-separator">›</span>
    <a href="/account-access/accounts/{encodeURIComponent(bankId)}/{encodeURIComponent(accountId)}/{encodeURIComponent(viewId)}" class="breadcrumb-link">{accountId}</a>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">Counterparties ({viewId})</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div>
          <h1 class="panel-title">Counterparties</h1>
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
          <p>Loading counterparties...</p>
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
      {:else if counterparties.length === 0}
        <div class="empty-state">No counterparties found for this account and view.</div>
      {:else}
        <div class="cp-table">
          <div class="cp-header">
            <div class="cp-col-name">Name</div>
            <div class="cp-col-routing">Account Routing</div>
            <div class="cp-col-bank">Bank Routing</div>
            <div class="cp-col-currency">Currency</div>
            <div class="cp-col-beneficiary">Beneficiary</div>
          </div>
          {#each counterparties as cp}
            <div class="cp-row" data-testid="counterparty-row-{cp.counterparty_id}">
              <div class="cp-col-name">
                {#if cp.counterparty_id}
                  <a href="/account-access/accounts/{encodeURIComponent(bankId)}/{encodeURIComponent(accountId)}/{encodeURIComponent(viewId)}/counterparties/{encodeURIComponent(cp.counterparty_id)}" class="cp-name cp-link" data-testid="counterparty-detail-link">{cp.name || "—"}</a>
                {:else}
                  <span class="cp-name">{cp.name || "—"}</span>
                {/if}
                {#if cp.description}
                  <span class="cp-description">{cp.description}</span>
                {/if}
              </div>
              <div class="cp-col-routing">
                {#if cp.other_account_routing_scheme || cp.other_account_routing_address}
                  <span class="routing-scheme">{cp.other_account_routing_scheme || "—"}</span>
                  <span class="routing-address">{cp.other_account_routing_address || "—"}</span>
                {:else}
                  <span class="no-data">—</span>
                {/if}
              </div>
              <div class="cp-col-bank">
                {#if cp.other_bank_routing_scheme || cp.other_bank_routing_address}
                  <span class="routing-scheme">{cp.other_bank_routing_scheme || "—"}</span>
                  <span class="routing-address">{cp.other_bank_routing_address || "—"}</span>
                {:else}
                  <span class="no-data">—</span>
                {/if}
              </div>
              <div class="cp-col-currency">
                <span class="cp-currency">{cp.currency || "—"}</span>
              </div>
              <div class="cp-col-beneficiary">
                {#if cp.is_beneficiary === true}
                  <span class="badge beneficiary">Yes</span>
                {:else if cp.is_beneficiary === false}
                  <span class="badge not-beneficiary">No</span>
                {:else}
                  <span class="no-data">—</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
        <div class="cp-count">{counterparties.length} counterpart{counterparties.length !== 1 ? "ies" : "y"}</div>
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

  /* Counterparty table */
  .cp-table {
    width: 100%;
  }

  .cp-header {
    display: grid;
    grid-template-columns: 1.5fr 1.5fr 1fr 80px 90px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.7rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .cp-header {
    background: rgb(var(--color-surface-900));
    border-bottom-color: rgb(var(--color-surface-700));
    color: var(--color-surface-400);
  }

  .cp-header > div {
    padding: 0.5rem 0.75rem;
  }

  .cp-row {
    display: grid;
    grid-template-columns: 1.5fr 1.5fr 1fr 80px 90px;
    border-bottom: 1px solid #f3f4f6;
    font-size: 0.8rem;
  }

  .cp-row:last-child {
    border-bottom: none;
  }

  .cp-row:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .cp-row {
    border-bottom-color: rgb(var(--color-surface-800));
  }

  :global([data-mode="dark"]) .cp-row:hover {
    background: rgb(var(--color-surface-900));
  }

  .cp-row > div {
    padding: 0.5rem 0.75rem;
    display: flex;
    align-items: center;
  }

  .cp-col-name {
    flex-direction: column;
    align-items: flex-start !important;
    gap: 0.125rem;
  }

  .cp-name {
    color: #111827;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  :global([data-mode="dark"]) .cp-name {
    color: var(--color-surface-200);
  }

  .cp-link {
    color: #3b82f6;
    text-decoration: none;
  }

  .cp-link:hover {
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .cp-link {
    color: rgb(var(--color-primary-400));
  }

  .cp-description {
    color: #6b7280;
    font-size: 0.7rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  :global([data-mode="dark"]) .cp-description {
    color: var(--color-surface-400);
  }

  .cp-col-routing,
  .cp-col-bank {
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .routing-scheme {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 0.125rem 0.375rem;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 3px;
    text-transform: uppercase;
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .routing-scheme {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-300));
  }

  .routing-address {
    font-family: monospace;
    font-size: 0.75rem;
    color: #374151;
    word-break: break-all;
  }

  :global([data-mode="dark"]) .routing-address {
    color: var(--color-surface-300);
  }

  .cp-currency {
    font-weight: 600;
    color: #374151;
    font-size: 0.75rem;
  }

  :global([data-mode="dark"]) .cp-currency {
    color: var(--color-surface-300);
  }

  .badge {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
  }

  .badge.beneficiary {
    background: #d1fae5;
    color: #065f46;
  }

  :global([data-mode="dark"]) .badge.beneficiary {
    background: rgba(34, 197, 94, 0.2);
    color: rgb(var(--color-success-300));
  }

  .badge.not-beneficiary {
    background: #f3f4f6;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .badge.not-beneficiary {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-400);
  }

  .no-data {
    color: #d1d5db;
  }

  :global([data-mode="dark"]) .no-data {
    color: var(--color-surface-600);
  }

  .cp-count {
    padding: 0.5rem 0.75rem;
    font-size: 0.7rem;
    color: #9ca3af;
    border-top: 1px solid #f3f4f6;
  }

  :global([data-mode="dark"]) .cp-count {
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
    .cp-header,
    .cp-row {
      grid-template-columns: 1fr 1fr 80px;
    }

    .cp-col-bank,
    .cp-col-beneficiary {
      display: none;
    }
  }
</style>
