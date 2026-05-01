<script lang="ts">
  import { Link, Search, X, Loader2, Landmark, Users } from "@lucide/svelte";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  interface Customer {
    customer_id: string;
    customer_number: string;
    legal_name: string;
    bank_id: string;
  }

  interface CustomerAccountLink {
    customer_account_link_id: string;
    customer_id: string;
    bank_id: string;
    account_id: string;
    relationship_type: string;
  }

  let customers = $state<Customer[]>([]);
  let customersLoading = $state(false);
  let customersError = $state<string | null>(null);

  let selectedCustomerId = $state("");
  let links = $state<CustomerAccountLink[]>([]);
  let linksLoading = $state(false);
  let linksError = $state<string | null>(null);

  let searchQuery = $state("");

  let selectedCustomerName = $derived(
    customers.find((c) => c.customer_id === selectedCustomerId)?.legal_name || ""
  );

  let filteredLinks = $derived.by(() => {
    if (!searchQuery.trim()) return links;
    const q = searchQuery.toLowerCase();
    return links.filter(
      (l) =>
        l.account_id?.toLowerCase().includes(q) ||
        l.relationship_type?.toLowerCase().includes(q),
    );
  });

  async function fetchCustomers(bankId: string) {
    if (!bankId) {
      customers = [];
      customersError = null;
      return;
    }
    customersLoading = true;
    customersError = null;
    selectedCustomerId = "";
    links = [];
    try {
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/banks/${encodeURIComponent(bankId)}/retail-customers?limit=200`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      customers = data.customers || [];
    } catch (err) {
      customersError = err instanceof Error ? err.message : "Failed to fetch customers";
      customers = [];
    } finally {
      customersLoading = false;
    }
  }

  async function fetchLinks(bankId: string, customerId: string) {
    if (!bankId || !customerId) {
      links = [];
      linksError = null;
      return;
    }
    linksLoading = true;
    linksError = null;
    searchQuery = "";
    try {
      const res = await trackedFetch(
        `/backend/obp/banks/${encodeURIComponent(bankId)}/customers/${encodeURIComponent(customerId)}/customer-account-links`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      links = data.links || [];
    } catch (err) {
      linksError = err instanceof Error ? err.message : "Failed to fetch customer account links";
      links = [];
    } finally {
      linksLoading = false;
    }
  }

  $effect(() => {
    const bankId = currentBank.bankId;
    fetchCustomers(bankId);
  });

  $effect(() => {
    if (selectedCustomerId && currentBank.bankId) {
      fetchLinks(currentBank.bankId, selectedCustomerId);
    }
  });
</script>

<svelte:head>
  <title>Customer Account Links - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div>
          <h1 class="panel-title">Customer Account Links</h1>
          <div class="panel-subtitle">
            {#if currentBank.bankId}
              Account links at bank <strong>{currentBank.bankId}</strong>
            {:else}
              Select a bank to view customer account links
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
            Please <a href="/user">select a bank</a> to view customer account links.
          </p>
        </div>
      {:else if customersLoading}
        <div class="loading-state">
          <Loader2 size={32} class="spinner-icon" />
          <p>Loading customers...</p>
        </div>
      {:else if customersError}
        <div class="error-state">
          <p class="error-message">{customersError}</p>
        </div>
      {:else}
        <!-- Customer selector -->
        <div class="customer-selector">
          <label for="customer-select" class="selector-label">Customer</label>
          <select
            id="customer-select"
            name="customer_id"
            data-testid="customer-select"
            class="selector-input"
            bind:value={selectedCustomerId}
          >
            <option value="">Select a customer...</option>
            {#each customers as customer}
              <option value={customer.customer_id}>
                {customer.legal_name || customer.customer_number || customer.customer_id}
              </option>
            {/each}
          </select>
        </div>

        {#if !selectedCustomerId}
          <div class="empty-state">
            <div class="empty-icon">
              <Users size={48} />
            </div>
            <h4 class="empty-title">Select a Customer</h4>
            <p class="empty-description">
              Choose a customer above to view their account links.
            </p>
          </div>
        {:else if linksLoading}
          <div class="loading-state">
            <Loader2 size={32} class="spinner-icon" />
            <p>Loading account links...</p>
          </div>
        {:else if linksError}
          <div class="error-state">
            <p class="error-message">{linksError}</p>
          </div>
        {:else}
          <div class="count-banner">
            <Link size={24} />
            <span class="count-number">{filteredLinks.length}</span>
            <span class="count-label">
              {#if searchQuery.trim()}
                of {links.length} account link{links.length !== 1 ? "s" : ""}
              {:else}
                account link{links.length !== 1 ? "s" : ""} for {selectedCustomerName}
              {/if}
            </span>
          </div>

          {#if links.length > 0}
            <div class="search-wrapper">
              <Search class="search-icon" size={18} />
              <input
                type="text"
                name="search"
                class="search-input"
                placeholder="Filter by account ID or relationship type..."
                bind:value={searchQuery}
                data-testid="search-input"
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

          {#if filteredLinks.length > 0}
            <div class="table-container">
              <table class="directory-table">
                <thead>
                  <tr>
                    <th>Account ID</th>
                    <th>Relationship Type</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredLinks as link}
                    <tr data-testid="link-row-{link.customer_account_link_id}">
                      <td class="cell-mono">
                        <a
                          href="/account-access/accounts/{encodeURIComponent(link.bank_id)}/{encodeURIComponent(link.account_id)}/owner"
                          class="account-link"
                          data-testid="account-detail-link"
                        >
                          {link.account_id}
                        </a>
                      </td>
                      <td>
                        <span class="badge badge-info">{link.relationship_type}</span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else if searchQuery.trim()}
            <div class="empty-state">
              <h4 class="empty-title">No Matching Links</h4>
              <p class="empty-description">
                No account links match "{searchQuery}".
              </p>
            </div>
          {:else}
            <div class="empty-state">
              <div class="empty-icon">
                <Link size={48} />
              </div>
              <h4 class="empty-title">No Account Links</h4>
              <p class="empty-description">
                No account links found for this customer.
              </p>
            </div>
          {/if}
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

  .header-content {
    display: flex;
    align-items: center;
    gap: 1.5rem;
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

  /* Customer selector */
  .customer-selector {
    margin-bottom: 1.5rem;
  }

  .selector-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  :global([data-mode="dark"]) .selector-label {
    color: var(--color-surface-300);
  }

  .selector-input {
    width: 100%;
    max-width: 400px;
    padding: 0.625rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .selector-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  :global([data-mode="dark"]) .selector-input {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .selector-input:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
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
    color: #9ca3af;
    pointer-events: none;
  }

  :global([data-mode="dark"]) .search-wrapper :global(.search-icon) {
    color: var(--color-surface-400);
  }

  .search-input {
    width: 100%;
    padding: 0.625rem 2.5rem 0.625rem 2.5rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
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
    right: 0.75rem;
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    border-radius: 4px;
  }

  .clear-button:hover {
    color: #4b5563;
    background: #f3f4f6;
  }

  :global([data-mode="dark"]) .clear-button {
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .clear-button:hover {
    color: var(--color-surface-200);
    background: rgb(var(--color-surface-600));
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
    color: #6b7280;
    border-bottom: 2px solid #e5e7eb;
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .directory-table th {
    color: var(--color-surface-400);
    border-bottom-color: rgb(var(--color-surface-600));
  }

  .directory-table td {
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    vertical-align: top;
  }

  :global([data-mode="dark"]) .directory-table td {
    border-bottom-color: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
  }

  .directory-table tbody tr:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .directory-table tbody tr:hover {
    background: rgb(var(--color-surface-700));
  }

  .cell-mono {
    font-family: monospace;
    font-size: 0.75rem;
  }

  .cell-mono :global(.account-link) {
    color: #3b82f6;
    text-decoration: none;
    font-weight: 500;
  }

  .cell-mono :global(.account-link:hover) {
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .cell-mono :global(.account-link) {
    color: rgb(var(--color-primary-400));
  }

  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .badge-info {
    background: #eff6ff;
    color: #1e40af;
  }

  :global([data-mode="dark"]) .badge-info {
    background: rgba(59, 130, 246, 0.15);
    color: rgb(var(--color-primary-300));
  }

  /* Empty/Loading/Error states */
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
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

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
