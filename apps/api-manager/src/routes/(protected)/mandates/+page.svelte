<script lang="ts">
  import { page } from "$app/state";
  import { FileSignature, Loader2, Search, Landmark } from "@lucide/svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { pageDataSummary } from "$lib/stores/pageDataSummary.svelte";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";

  interface AccountListItem {
    id: string;
    label?: string;
  }
  interface CustomerListItem {
    customer_id: string;
    customer_number?: string;
    legal_name?: string;
  }

  let availableAccounts = $state<AccountListItem[]>([]);
  let availableCustomers = $state<CustomerListItem[]>([]);
  let accountsListError = $state<string | null>(null);
  let customersListError = $state<string | null>(null);
  let accountsListLoading = $state(false);
  let customersListLoading = $state(false);

  async function fetchAvailableAccounts(bankId: string) {
    if (!bankId) { availableAccounts = []; return; }
    accountsListLoading = true;
    accountsListError = null;
    try {
      const res = await trackedFetch(`/proxy/obp/v6.0.0/banks/${encodeURIComponent(bankId)}/accounts`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      availableAccounts = data.accounts || [];
    } catch (err) {
      accountsListError = err instanceof Error ? err.message : String(err);
      availableAccounts = [];
    } finally {
      accountsListLoading = false;
    }
  }

  async function fetchAvailableCustomers(bankId: string) {
    if (!bankId) { availableCustomers = []; return; }
    customersListLoading = true;
    customersListError = null;
    try {
      const res = await trackedFetch(`/proxy/obp/v6.0.0/banks/${encodeURIComponent(bankId)}/customers?limit=200`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      availableCustomers = data.customers || [];
    } catch (err) {
      customersListError = err instanceof Error ? err.message : String(err);
      availableCustomers = [];
    } finally {
      customersListLoading = false;
    }
  }

  function parseMissingRole(msg: string | null) {
    if (!msg) return null;
    const m = msg.match(/OBP-(\d+):.*missing one or more roles:\s*(.+)/i);
    if (!m) return null;
    return {
      code: m[1],
      roles: m[2].split(",").map((r) => r.trim()),
      message: msg,
    };
  }

  let accountsListMissingRole = $derived(parseMissingRole(accountsListError));
  let customersListMissingRole = $derived(parseMissingRole(customersListError));

  $effect(() => {
    const bankId = currentBank.bankId;
    fetchAvailableAccounts(bankId);
    fetchAvailableCustomers(bankId);
  });

  // Read query params for pre-population
  let qAccountId = $derived(page.url.searchParams.get("account_id") || "");
  let qCustomerId = $derived(page.url.searchParams.get("customer_id") || "");

  // Search inputs
  let accountIdInput = $state("");
  let customerIdInput = $state("");

  // Initialise from query params once
  let initialised = $state(false);
  $effect(() => {
    if (!initialised) {
      if (qAccountId) accountIdInput = qAccountId;
      if (qCustomerId) customerIdInput = qCustomerId;
      initialised = true;
    }
  });

  // Auto-search when query params are present and bank is selected
  $effect(() => {
    if (!initialised) return;
    const bankId = currentBank.bankId;
    if (!bankId) return;

    if (qAccountId && results.length === 0 && !loading) {
      searchByAccount(bankId, qAccountId);
    } else if (qCustomerId && results.length === 0 && !loading) {
      searchByCustomer(bankId, qCustomerId);
    }
  });

  interface MandateResult {
    mandate_id: string;
    bank_id: string;
    account_id: string;
    customer_id: string;
    mandate_name: string;
    mandate_reference: string;
    status: string;
    valid_from: string;
    valid_to: string;
  }

  let results = $state<MandateResult[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let searchDone = $state(false);
  let searchLabel = $state("");

  function formatDate(dateString: string): string {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return dateString;
    }
  }

  function statusClass(status: string): string {
    switch (status?.toUpperCase()) {
      case "ACTIVE": return "badge-active";
      case "SUSPENDED": return "badge-suspended";
      case "EXPIRED": return "badge-expired";
      case "DRAFT": return "badge-draft";
      default: return "badge-draft";
    }
  }

  async function searchByAccount(bankId: string, accountId: string) {
    loading = true;
    error = null;
    results = [];
    searchDone = false;
    searchLabel = `account ${accountId}`;
    try {
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/mandates`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      results = data.mandates || [];
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to search mandates";
    } finally {
      loading = false;
      searchDone = true;
    }
  }

  async function searchByCustomer(bankId: string, customerId: string) {
    loading = true;
    error = null;
    results = [];
    searchDone = false;
    searchLabel = `customer ${customerId}`;
    try {
      // First get accounts for this customer
      const accountsRes = await trackedFetch(
        `/proxy/obp/v4.0.0/customers/${encodeURIComponent(customerId)}/accounts-minimal`
      );
      if (!accountsRes.ok) {
        const data = await accountsRes.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${accountsRes.status}`);
      }
      const accountsData = await accountsRes.json();
      const accounts: Array<{ bank_id: string; account_id: string }> = accountsData.accounts || [];

      if (accounts.length === 0) {
        results = [];
        loading = false;
        searchDone = true;
        return;
      }

      // Fetch mandates for each account in parallel
      const settled = await Promise.allSettled(
        accounts.map(async (acct) => {
          const res = await trackedFetch(
            `/proxy/obp/v6.0.0/banks/${encodeURIComponent(acct.bank_id)}/accounts/${encodeURIComponent(acct.account_id)}/mandates`
          );
          if (!res.ok) return [];
          const data = await res.json();
          return (data.mandates || []) as MandateResult[];
        })
      );

      const allMandates: MandateResult[] = [];
      for (const r of settled) {
        if (r.status === "fulfilled") {
          allMandates.push(...r.value);
        }
      }
      results = allMandates;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to search mandates";
    } finally {
      loading = false;
      searchDone = true;
    }
  }

  function handleAccountSearch() {
    const bankId = currentBank.bankId;
    const accountId = accountIdInput.trim();
    if (!bankId || !accountId) return;
    customerIdInput = "";
    searchByAccount(bankId, accountId);
  }

  function handleCustomerSearch() {
    const bankId = currentBank.bankId;
    const customerId = customerIdInput.trim();
    if (!bankId || !customerId) return;
    accountIdInput = "";
    searchByCustomer(bankId, customerId);
  }

  $effect(() => {
    if (searchDone && results.length > 0) {
      const activeCount = results.filter((m) => m.status === "ACTIVE").length;
      pageDataSummary.set(`${results.length} mandate${results.length === 1 ? "" : "s"} found for ${searchLabel}. ${activeCount} active.`);
    }
  });
</script>

<svelte:head>
  <title>Mandates - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <FileSignature size={32} />
          </div>
          <div>
            <h1 class="panel-title">Mandates</h1>
            <div class="panel-subtitle">
              Search mandates by account or customer
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel-content">
      {#if !currentBank.bankId}
        <div class="info-box">
          <p>Select a bank using the bank selector to search for mandates.</p>
        </div>
      {:else}
        {#if accountsListMissingRole}
          <MissingRoleAlert
            roles={accountsListMissingRole.roles}
            errorCode={accountsListMissingRole.code}
            message={accountsListMissingRole.message}
            bankId={currentBank.bankId}
          />
        {:else if accountsListError}
          <div class="list-warning" data-testid="accounts-list-error">
            Could not load accounts list: {accountsListError}
          </div>
        {/if}
        {#if customersListMissingRole}
          <MissingRoleAlert
            roles={customersListMissingRole.roles}
            errorCode={customersListMissingRole.code}
            message={customersListMissingRole.message}
            bankId={currentBank.bankId}
          />
        {:else if customersListError}
          <div class="list-warning" data-testid="customers-list-error">
            Could not load customers list: {customersListError}
          </div>
        {/if}

        <!-- Search forms -->
        <div class="search-forms">
          <form class="search-row" onsubmit={(e) => { e.preventDefault(); handleAccountSearch(); }} data-testid="account-search-form">
            <div class="search-field">
              <label for="account-id-search" class="search-label">
                Account
                {#if accountsListLoading}
                  <Loader2 size={12} class="spinner-icon" />
                {:else if availableAccounts.length > 0}
                  <span class="list-count">({availableAccounts.length} at bank)</span>
                {/if}
              </label>
              <input
                type="text"
                id="account-id-search"
                name="account_id"
                class="search-input"
                data-testid="account-id-input"
                list="account-list"
                placeholder={availableAccounts.length > 0 ? "Pick or type an account ID" : "Enter account ID"}
                bind:value={accountIdInput}
              />
              <datalist id="account-list">
                {#each availableAccounts as a}
                  <option value={a.id}>{a.label ? `${a.label} (${a.id})` : a.id}</option>
                {/each}
              </datalist>
            </div>
            <button type="submit" class="btn-search" data-testid="search-by-account" disabled={!accountIdInput.trim() || loading}>
              <Search size={14} />
              Search by Account
            </button>
          </form>

          <div class="search-divider">
            <span class="divider-text">or</span>
          </div>

          <form class="search-row" onsubmit={(e) => { e.preventDefault(); handleCustomerSearch(); }} data-testid="customer-search-form">
            <div class="search-field">
              <label for="customer-id-search" class="search-label">
                Customer
                {#if customersListLoading}
                  <Loader2 size={12} class="spinner-icon" />
                {:else if availableCustomers.length > 0}
                  <span class="list-count">({availableCustomers.length} at bank)</span>
                {/if}
              </label>
              <input
                type="text"
                id="customer-id-search"
                name="customer_id"
                class="search-input"
                data-testid="customer-id-input"
                list="customer-list"
                placeholder={availableCustomers.length > 0 ? "Pick or type a customer ID" : "Enter customer ID"}
                bind:value={customerIdInput}
              />
              <datalist id="customer-list">
                {#each availableCustomers as c}
                  <option value={c.customer_id}>
                    {(c.legal_name || c.customer_number || c.customer_id) + (c.legal_name ? ` (${c.customer_id})` : "")}
                  </option>
                {/each}
              </datalist>
            </div>
            <button type="submit" class="btn-search" data-testid="search-by-customer" disabled={!customerIdInput.trim() || loading}>
              <Search size={14} />
              Search by Customer
            </button>
          </form>
        </div>

        <!-- Results -->
        {#if loading}
          <div class="loading-state" data-testid="loading-state">
            <Loader2 size={24} class="spinner-icon" />
            <p>Searching mandates...</p>
          </div>
        {:else if error}
          <div class="error-box" data-testid="error-state">
            <p>{error}</p>
          </div>
        {:else if searchDone && results.length === 0}
          <div class="empty-state" data-testid="empty-state">
            <p>No mandates found for {searchLabel}.</p>
          </div>
        {:else if results.length > 0}
          <div class="results-header" data-testid="results-header">
            {results.length} mandate{results.length === 1 ? "" : "s"} found
          </div>
          <div class="table-wrapper" data-testid="mandates-table">
            <table class="mandates-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Reference</th>
                  <th>Account</th>
                  <th>Status</th>
                  <th>Valid From</th>
                  <th>Valid To</th>
                </tr>
              </thead>
              <tbody>
                {#each results as mandate (mandate.mandate_id)}
                  <tr data-testid="mandate-row-{mandate.mandate_id}">
                    <td>
                      <a
                        href="/mandates/{encodeURIComponent(mandate.bank_id)}/{encodeURIComponent(mandate.account_id)}/{encodeURIComponent(mandate.mandate_id)}"
                        class="mandate-link"
                        data-testid="mandate-link-{mandate.mandate_id}"
                      >
                        {mandate.mandate_name}
                      </a>
                    </td>
                    <td class="code">{mandate.mandate_reference}</td>
                    <td>
                      <a
                        href="/account-access/accounts/{encodeURIComponent(mandate.bank_id)}/{encodeURIComponent(mandate.account_id)}/owner"
                        class="account-link"
                        data-testid="account-link-{mandate.account_id}"
                      >
                        <Landmark size={12} />
                        {mandate.account_id}
                      </a>
                    </td>
                    <td>
                      <span class="status-badge {statusClass(mandate.status)}" data-testid="mandate-status-{mandate.mandate_id}">
                        {mandate.status}
                      </span>
                    </td>
                    <td>{formatDate(mandate.valid_from)}</td>
                    <td>{formatDate(mandate.valid_to)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1200px;
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
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    background: #eff6ff;
    color: #3b82f6;
    border-radius: 12px;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .header-icon {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-400));
  }

  .panel-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .panel-content {
    padding: 1.5rem;
  }

  .info-box {
    padding: 1.25rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 0.875rem;
    color: #374151;
  }

  :global([data-mode="dark"]) .info-box {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
    color: var(--color-surface-300);
  }

  .info-box p {
    margin: 0;
  }

  /* Search forms */
  .search-forms {
    margin-bottom: 1.5rem;
  }

  .search-row {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
  }

  .search-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    max-width: 500px;
  }

  .search-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  :global([data-mode="dark"]) .search-label {
    color: var(--color-surface-400);
  }

  .search-label :global(.spinner-icon) {
    animation: spin 1s linear infinite;
  }

  .list-count {
    font-weight: 400;
    font-size: 0.7rem;
    color: #9ca3af;
    text-transform: none;
    letter-spacing: 0;
  }

  :global([data-mode="dark"]) .list-count {
    color: var(--color-surface-500);
  }

  .list-warning {
    padding: 0.625rem 0.875rem;
    margin-bottom: 0.75rem;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 6px;
    color: #92400e;
    font-size: 0.813rem;
  }

  :global([data-mode="dark"]) .list-warning {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.3);
    color: rgb(var(--color-warning-300));
  }

  .search-input {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    background: white;
    color: #111827;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  :global([data-mode="dark"]) .search-input {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .search-input:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .btn-search {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.813rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }

  .btn-search:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-search:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-search {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-search:hover:not(:disabled) {
    background: rgb(var(--color-primary-500));
  }

  .search-divider {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 0.75rem 0;
  }

  .search-divider::before,
  .search-divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: #e5e7eb;
    max-width: 200px;
  }

  :global([data-mode="dark"]) .search-divider::before,
  :global([data-mode="dark"]) .search-divider::after {
    background: rgb(var(--color-surface-700));
  }

  .divider-text {
    font-size: 0.75rem;
    color: #9ca3af;
    text-transform: uppercase;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .divider-text {
    color: var(--color-surface-500);
  }

  /* Results */
  .results-header {
    font-size: 0.813rem;
    font-weight: 600;
    color: #6b7280;
    margin-bottom: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .results-header {
    color: var(--color-surface-400);
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .mandates-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .mandates-table th {
    text-align: left;
    padding: 0.625rem 0.75rem;
    font-weight: 600;
    color: #6b7280;
    border-bottom: 2px solid #e5e7eb;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .mandates-table th {
    color: var(--color-surface-400);
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .mandates-table td {
    padding: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
  }

  :global([data-mode="dark"]) .mandates-table td {
    border-bottom-color: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
  }

  .mandates-table tbody tr:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .mandates-table tbody tr:hover {
    background: rgb(var(--color-surface-700));
  }

  .mandate-link {
    color: #3b82f6;
    text-decoration: none;
    font-weight: 500;
  }

  .mandate-link:hover {
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .mandate-link {
    color: rgb(var(--color-primary-400));
  }

  .account-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: #6b7280;
    text-decoration: none;
    font-size: 0.75rem;
    font-family: monospace;
  }

  .account-link:hover {
    color: #3b82f6;
  }

  :global([data-mode="dark"]) .account-link {
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .account-link:hover {
    color: rgb(var(--color-primary-400));
  }

  .code {
    font-family: monospace;
    font-size: 0.8rem;
  }

  .status-badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .badge-active {
    background: #dcfce7;
    color: #166534;
  }

  :global([data-mode="dark"]) .badge-active {
    background: rgba(22, 163, 74, 0.2);
    color: rgb(var(--color-success-400));
  }

  .badge-suspended {
    background: #fef3c7;
    color: #92400e;
  }

  :global([data-mode="dark"]) .badge-suspended {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
  }

  .badge-expired {
    background: #fee2e2;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .badge-expired {
    background: rgba(220, 38, 38, 0.2);
    color: rgb(var(--color-error-400));
  }

  .badge-draft {
    background: #f3f4f6;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .badge-draft {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-400);
  }

  .loading-state {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
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

  .loading-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  .error-box {
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    color: #991b1b;
    font-size: 0.875rem;
    margin-top: 1rem;
  }

  .error-box p {
    margin: 0;
  }

  :global([data-mode="dark"]) .error-box {
    background: rgba(220, 38, 38, 0.1);
    border-color: rgba(220, 38, 38, 0.3);
    color: rgb(var(--color-error-300));
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .empty-state p {
    margin: 0;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
  }

  @media (max-width: 640px) {
    .search-row {
      flex-direction: column;
      align-items: stretch;
    }

    .search-field {
      max-width: none;
    }
  }
</style>
