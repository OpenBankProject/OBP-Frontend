<script lang="ts">
  import { page } from "$app/state";
  import { Landmark, ArrowLeft, Loader2, User, Tag, Route, Copy, Check, Plus, FileSignature } from "@lucide/svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";

  import { pageDataSummary } from "$lib/stores/pageDataSummary.svelte";
  import { pageHeading } from "$lib/stores/pageHeading.svelte";

  let { data }: { data: any } = $props();

  function toTitleCase(s: string): string {
    return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Handle v6.0.0 views_available using view_id instead of id */
  function viewId_(view: any): string {
    return view.id || view.view_id || "";
  }

  let userId = $derived(data.userId || "");
  let copied = $state(false);

  async function copyDebugInfo() {
    const text = [
      `User ID: ${userId || "—"}`,
      `Bank ID: ${bankId || "—"}`,
      `Account ID: ${accountId || "—"}`,
      `View ID: ${viewId || "—"}`,
      `Access Check Done: ${accessCheckDone}`,
      `Has Account Access: ${String(hasAccountAccess)}`,
      `Access Source: ${accessSource || "—"}`,
      `ABAC Rule ID: ${abacRuleId || "—"}`,
      `Has CanExecuteAbacRule: ${hasAbacRole}`,
      `Account Loading: ${loading}`,
      `Account Loaded: ${!!account}`,
      `Error: ${error || "none"}`,
      `User Entitlements: ${userEntitlements.length}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => { copied = false; }, 1500);
  }

  let account = $state<any>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (account) {
      const views = account.views_available?.length || 0;
      const label = account.label || account.account_id || "";
      pageDataSummary.set(`Viewing account ${label} at ${account.bank_id}, ${views} views available`);
      pageHeading.set(label);
    }
  });
  let hasAccountAccess = $state<boolean | null>(null);
  let accessSource = $state<string>("");
  let abacRuleId = $state<string>("");
  let accessCheckDone = $state(false);

  let usersWithAccess = $state<any>(null);
  let usersWithAccessLoading = $state(false);
  let usersWithAccessError = $state<string | null>(null);

  let usersWithAccessParsedError = $derived.by(() => {
    if (!usersWithAccessError) return null;
    const missingRoleMatch = usersWithAccessError.match(
      /OBP-(\d+):.*missing one or more roles:\s*(.+)/i,
    );
    if (missingRoleMatch) {
      const roles = missingRoleMatch[2].split(",").map((r: string) => r.trim());
      return { type: "missing_role" as const, code: missingRoleMatch[1], roles, message: usersWithAccessError };
    }
    return { type: "general" as const, message: usersWithAccessError };
  });

  // Users grouped by view_id for display in Views Available
  let usersByView = $state(new Map<string, { direct: string[]; abac: string[] }>());
  let viewErrors = $state(new Map<string, string>());

  let bankId = $derived(page.params.bank_id || "");
  let accountId = $derived(page.params.account_id || "");
  let viewId = $derived(page.params.view_id || "");

  let userEntitlements = $derived(data.userEntitlements || []);
  let hasAbacRole = $derived(
    userEntitlements.some((e: any) => e.role_name === "CanExecuteAbacRule")
  );

  async function checkAccountAccess(bankId: string, accountId: string, viewId: string) {
    accessCheckDone = false;
    try {
      const res = await trackedFetch(
        `/api/obp/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/views/${encodeURIComponent(viewId)}/has-account-access`
      );
      if (res.ok) {
        const data = await res.json();
        hasAccountAccess = data.has_account_access === true;
        accessSource = data.access_source || "";
        abacRuleId = data.abac_rule_id || "";
      } else {
        hasAccountAccess = false;
        accessSource = "";
        abacRuleId = "";
      }
    } catch {
      hasAccountAccess = false;
      accessSource = "";
      abacRuleId = "";
    } finally {
      accessCheckDone = true;
    }
  }

  async function fetchAccount(bankId: string, accountId: string, viewId: string) {
    loading = true;
    error = null;
    try {
      const res = await trackedFetch(
        `/api/obp/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/${encodeURIComponent(viewId)}/account`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch account");
      }
      account = await res.json();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch account";
      account = null;
    } finally {
      loading = false;
    }
  }

  async function fetchUsersWithAccess(bankId: string, accountId: string, views: any[]) {
    usersWithAccessLoading = true;
    usersWithAccessError = null;
    usersByView = new Map();
    viewErrors = new Map();

    const settled = await Promise.allSettled(
      views.map(async (view) => {
        const vid = viewId_(view);
        const res = await trackedFetch(
          `/api/obp/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/views/${encodeURIComponent(vid)}/users-with-access`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to fetch users with access for view ${vid}`);
        }
        const data = await res.json();
        return { viewId: vid, users: data.users || [] };
      })
    );

    const map = new Map<string, { direct: string[]; abac: string[] }>();
    const errors = new Map<string, string>();
    let anySuccess = false;

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      const viewId = viewId_(views[i]);
      if (result.status === "fulfilled") {
        anySuccess = true;
        const entry = { direct: [] as string[], abac: [] as string[] };
        for (const user of result.value.users) {
          const name = user.username || user.user_id || "Unknown";
          if (user.access_source === "ABAC") {
            entry.abac.push(name);
          } else {
            entry.direct.push(name);
          }
        }
        map.set(viewId, entry);
      } else {
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        errors.set(viewId, msg);
      }
    }

    usersByView = map;
    viewErrors = errors;
    usersWithAccess = anySuccess ? { users: [] } : null;
    if (errors.size > 0 && !anySuccess) {
      usersWithAccessError = "Failed to fetch users with access for all views";
    }
    usersWithAccessLoading = false;
  }

  async function loadPage(bankId: string, accountId: string, viewId: string) {
    account = null;
    error = null;
    usersWithAccess = null;
    usersByView = new Map();
    viewErrors = new Map();
    // Run access check and account fetch in parallel — access check is informational only
    await Promise.all([
      checkAccountAccess(bankId, accountId, viewId),
      fetchAccount(bankId, accountId, viewId),
    ]);
    if (account?.views_available?.length) {
      await fetchUsersWithAccess(bankId, accountId, account.views_available);
    }
  }

  // Add Account Attribute
  let showAddAttribute = $state(false);
  let newAttrName = $state("");
  let newAttrType = $state("STRING");
  let newAttrValue = $state("");
  let addingAttribute = $state(false);
  let addAttributeError = $state<string | null>(null);

  async function addAccountAttribute() {
    if (!newAttrName.trim() || !newAttrValue.trim()) return;

    const productCode = account?.product_code || "NONE";
    addingAttribute = true;
    addAttributeError = null;

    try {
      const res = await trackedFetch(
        `/api/obp/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/products/${encodeURIComponent(productCode)}/attribute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newAttrName.trim(),
            type: newAttrType,
            value: newAttrValue.trim(),
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create account attribute");
      }

      const created = await res.json();

      // Add to existing attributes list
      if (!account.account_attributes) {
        account.account_attributes = [];
      }
      account.account_attributes = [...account.account_attributes, created];

      // Reset form
      newAttrName = "";
      newAttrType = "STRING";
      newAttrValue = "";
      showAddAttribute = false;
    } catch (err) {
      addAttributeError = err instanceof Error ? err.message : "Failed to create account attribute";
    } finally {
      addingAttribute = false;
    }
  }

  $effect(() => {
    if (bankId && accountId && viewId) {
      loadPage(bankId, accountId, viewId);
    }
  });
</script>

<svelte:head>
  <title>{account?.label || "Account Detail"} - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb -->
  <nav class="breadcrumb mb-6">
    <a href="/account-access/accounts" class="breadcrumb-link">Accounts</a>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">{account?.label || accountId}</span>
  </nav>

  {#if loading}
    <div class="loading-state">
      <Loader2 size={32} class="spinner-icon" />
      <p>Loading account...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p class="error-message">{error}</p>
      <a href="/account-access/accounts" class="btn-secondary mt-4">
        <ArrowLeft size={16} />
        Back to Accounts
      </a>
    </div>
  {:else if account}
    <div class="panel">
      <!-- Header -->
      <div class="panel-header">
        <div class="header-content">
          <div class="header-left">
            <div class="header-icon">
              <Landmark size={24} />
            </div>
            <div>
              <h1 class="panel-title">{account.label || "Unnamed Account"}</h1>
              <div class="panel-subtitle">
                {bankId} / {accountId} / {viewId}
              </div>
            </div>
          </div>
          <div class="header-actions">
            <a href="/mandates/{encodeURIComponent(bankId)}/{encodeURIComponent(accountId)}" class="btn-secondary" data-testid="view-mandates">
              <FileSignature size={16} />
              Mandates
            </a>
            <a href="/account-access/accounts" class="btn-secondary">
              <ArrowLeft size={16} />
              Back
            </a>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="panel-content">
        {#if accessCheckDone && hasAccountAccess === false}
          <div class="access-warning">
            You may need further ABAC Access in order to access this account.
          </div>
        {/if}
        <!-- Account Info + Owners row -->
        <div class="info-owners-row">
          <!-- Basic Info -->
          <section class="info-section info-main">
            <h2 class="section-title">Account Information</h2>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Account ID</div>
                <div class="info-value code">{account.id}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Bank ID</div>
                <div class="info-value code">{account.bank_id}</div>
              </div>
              <div class="info-item">
                <div class="info-label">View ID</div>
                <div class="info-value code">{viewId}</div>
              </div>
              {#if account.number}
                <div class="info-item">
                  <div class="info-label">Account Number</div>
                  <div class="info-value code">{account.number}</div>
                </div>
              {/if}
              {#if account.label}
                <div class="info-item">
                  <div class="info-label">Label</div>
                  <div class="info-value">{account.label}</div>
                </div>
              {/if}
              {#if account.product_code}
                <div class="info-item">
                  <div class="info-label">Product Code</div>
                  <div class="info-value code">{account.product_code}</div>
                </div>
              {/if}
              {#if account.type}
                <div class="info-item">
                  <div class="info-label">Type</div>
                  <div class="info-value">{account.type}</div>
                </div>
              {/if}
              {#if account.balance}
                <div class="info-item">
                  <div class="info-label">Balance</div>
                  <div class="info-value balance-inline">
                    <span class="balance-amount">{account.balance.amount}</span>
                    <span class="balance-currency">{account.balance.currency}</span>
                  </div>
                </div>
              {/if}
            </div>
          </section>

          <!-- Owners -->
          {#if account.owners && account.owners.length > 0}
            <section class="info-section info-sidebar">
              <h2 class="section-title">
                <User size={16} />
                Owners
              </h2>
              <div class="owners-list">
                {#each account.owners as owner}
                  <div class="owner-chip">{owner.display_name || "Unknown"}{#if owner.provider} <span class="owner-provider">({owner.provider})</span>{/if}</div>
                {/each}
              </div>
            </section>
          {/if}
        </div>

        <!-- Account Routings -->
        {#if account.account_routings && account.account_routings.length > 0}
          <section class="info-section">
            <h2 class="section-title">
              <Route size={16} />
              Account Routings ({account.account_routings.length})
            </h2>
            <div class="routings-list">
              {#each account.account_routings as routing}
                <div class="routing-item">
                  <span class="routing-scheme">{routing.scheme}</span>
                  <span class="routing-address code">{routing.address}</span>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Account Attributes -->
        <section class="info-section">
          <div class="section-header-row">
            <h2 class="section-title" style="margin-bottom: 0; border-bottom: none; padding-bottom: 0;">
              <Tag size={16} />
              Account Attributes ({account.account_attributes?.length || 0})
            </h2>
            <button
              type="button"
              class="btn-add"
              data-testid="add-account-attribute"
              onclick={() => { showAddAttribute = !showAddAttribute; addAttributeError = null; }}
            >
              <Plus size={14} />
              Add
            </button>
          </div>

          {#if showAddAttribute}
            <div class="add-attribute-form" data-testid="add-attribute-form">
              {#if addAttributeError}
                <div class="attr-error">{addAttributeError}</div>
              {/if}
              <div class="attr-form-row">
                <div class="attr-form-field">
                  <label for="attr-name" class="attr-form-label">Name</label>
                  <input
                    type="text"
                    id="attr-name"
                    name="attr-name"
                    class="attr-form-input"
                    data-testid="attr-name"
                    placeholder="e.g. LOAN_ID, REQUIRED_CHALLENGE_ANSWERS"
                    bind:value={newAttrName}
                  />
                </div>
                <div class="attr-form-field">
                  <label for="attr-type" class="attr-form-label">Type</label>
                  <select
                    id="attr-type"
                    name="attr-type"
                    class="attr-form-input"
                    data-testid="attr-type"
                    bind:value={newAttrType}
                  >
                    <option value="STRING">STRING</option>
                    <option value="INTEGER">INTEGER</option>
                    <option value="DOUBLE">DOUBLE</option>
                    <option value="DATE_WITH_DAY">DATE_WITH_DAY</option>
                  </select>
                </div>
                <div class="attr-form-field attr-form-field-grow">
                  <label for="attr-value" class="attr-form-label">Value</label>
                  <input
                    type="text"
                    id="attr-value"
                    name="attr-value"
                    class="attr-form-input"
                    data-testid="attr-value"
                    placeholder="Attribute value"
                    bind:value={newAttrValue}
                  />
                </div>
                <div class="attr-form-actions">
                  <button
                    type="button"
                    class="btn-attr-save"
                    data-testid="save-attribute"
                    disabled={!newAttrName.trim() || !newAttrValue.trim() || addingAttribute}
                    onclick={addAccountAttribute}
                  >
                    {#if addingAttribute}
                      <Loader2 size={14} class="spinner-icon" />
                    {:else}
                      Save
                    {/if}
                  </button>
                  <button
                    type="button"
                    class="btn-attr-cancel"
                    data-testid="cancel-attribute"
                    onclick={() => { showAddAttribute = false; addAttributeError = null; }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <p class="attr-form-hint">REQUIRED_CHALLENGE_ANSWERS can be used to enforce multi-signature by SCA.</p>
            </div>
          {/if}

          {#if account.account_attributes && account.account_attributes.length > 0}
            <div class="attributes-list">
              {#each account.account_attributes as attr}
                <div class="attribute-item" data-testid="attribute-{attr.name}">
                  <span class="attribute-name">{attr.name || attr.product_code}</span>
                  <span class="attribute-value">{attr.value}</span>
                  {#if attr.type}
                    <span class="attribute-type">{attr.type}</span>
                  {/if}
                </div>
              {/each}
            </div>
          {:else if !showAddAttribute}
            <p class="no-attributes">No account attributes</p>
          {/if}
        </section>

        <!-- Tags -->
        {#if account.tags && account.tags.length > 0}
          <section class="info-section">
            <h2 class="section-title">
              <Tag size={16} />
              Tags ({account.tags.length})
            </h2>
            <div class="tags-list">
              {#each account.tags as tag}
                <span class="tag-badge">{tag.value || tag}</span>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Views Available -->
        {#if account.views_available && account.views_available.length > 0}
          <section class="info-section">
            <h2 class="section-title">
              Views Available ({account.views_available.length})
            </h2>
            {#if usersWithAccessError}
              {#if usersWithAccessParsedError && usersWithAccessParsedError.type === "missing_role"}
                <MissingRoleAlert
                  roles={usersWithAccessParsedError.roles}
                  errorCode={usersWithAccessParsedError.code}
                  message={usersWithAccessParsedError.message}
                  bankId={bankId}
                />
              {:else}
                <div class="users-access-error">
                  {usersWithAccessError}
                </div>
              {/if}
            {/if}
            <div class="views-table">
              <div class="views-table-header">
                <div class="views-col-name">View</div>
                <div class="views-col-link">Transactions</div>
                <div class="views-col-link">Counterparties</div>
                <div class="views-col-users">Direct Access</div>
                <div class="views-col-users">ABAC Access</div>
              </div>
              {#each account.views_available as view}
                {@const vid = viewId_(view)}
                {@const viewUsers = usersByView.get(vid)}
                {@const viewError = viewErrors.get(vid)}
                <div class="views-table-row">
                  <div class="views-col-name">
                    <a href="/account-access/{view.is_system ? 'system-views' : 'custom-views'}/{encodeURIComponent(vid)}" class="view-name-link">{toTitleCase(vid)}</a>
                    {#if view.is_public}
                      <span class="view-badge public">PUBLIC</span>
                    {/if}
                  </div>
                  <div class="views-col-link">
                    <a href="/account-access/accounts/{encodeURIComponent(bankId)}/{encodeURIComponent(accountId)}/{encodeURIComponent(vid)}/transactions" class="view-name-link">Transactions</a>
                  </div>
                  <div class="views-col-link">
                    <a href="/account-access/accounts/{encodeURIComponent(bankId)}/{encodeURIComponent(accountId)}/{encodeURIComponent(vid)}/counterparties" class="view-name-link">Counterparties</a>
                  </div>
                  {#if viewError}
                    <div class="views-col-users view-error" style="grid-column: span 2;">
                      {viewError}
                    </div>
                  {:else}
                    <div class="views-col-users">
                      {#if usersWithAccessLoading}
                        <Loader2 size={14} class="spinner-icon" />
                      {:else if viewUsers?.direct?.length}
                        {#each viewUsers.direct as username}
                          <span class="user-chip direct">{username}</span>
                        {/each}
                      {:else}
                        <span class="no-users">—</span>
                      {/if}
                    </div>
                    <div class="views-col-users">
                      {#if usersWithAccessLoading}
                        <Loader2 size={14} class="spinner-icon" />
                      {:else if viewUsers?.abac?.length}
                        {#each viewUsers.abac as username}
                          <span class="user-chip abac">{username}</span>
                        {/each}
                      {:else}
                        <span class="no-users">—</span>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </section>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1200px;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
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

  /* Debug panel */
  .debug-panel {
    margin-bottom: 1rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.75rem;
  }

  :global([data-mode="dark"]) .debug-panel {
    border-color: rgb(var(--color-surface-600));
  }

  .debug-summary {
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    font-weight: 600;
    color: #6b7280;
    background: #f9fafb;
    border-radius: 6px;
    user-select: none;
  }

  .debug-panel[open] .debug-summary {
    border-radius: 6px 6px 0 0;
    border-bottom: 1px solid #d1d5db;
  }

  :global([data-mode="dark"]) .debug-summary {
    color: var(--color-surface-400);
    background: rgb(var(--color-surface-900));
  }

  :global([data-mode="dark"]) .debug-panel[open] .debug-summary {
    border-bottom-color: rgb(var(--color-surface-600));
  }

  .debug-content {
    padding: 0.75rem;
    background: #f9fafb;
    border-radius: 0 0 6px 6px;
  }

  :global([data-mode="dark"]) .debug-content {
    background: rgb(var(--color-surface-900));
  }

  .debug-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 1rem;
    align-items: baseline;
  }

  .debug-label {
    font-weight: 600;
    color: #6b7280;
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .debug-label {
    color: var(--color-surface-400);
  }

  .debug-value {
    font-family: monospace;
    color: #374151;
    word-break: break-all;
  }

  :global([data-mode="dark"]) .debug-value {
    color: var(--color-surface-200);
  }

  .debug-true {
    color: #16a34a;
  }

  :global([data-mode="dark"]) .debug-true {
    color: rgb(var(--color-success-400));
  }

  .debug-false {
    color: #dc2626;
  }

  :global([data-mode="dark"]) .debug-false {
    color: rgb(var(--color-error-400));
  }

  .copy-btn {
    display: inline-flex;
    align-items: center;
    background: none;
    border: none;
    padding: 0.125rem;
    margin-left: 0.375rem;
    cursor: pointer;
    color: #9ca3af;
    border-radius: 3px;
    vertical-align: middle;
  }

  .copy-btn:hover {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
  }

  :global([data-mode="dark"]) .copy-btn {
    color: var(--color-surface-500);
  }

  :global([data-mode="dark"]) .copy-btn:hover {
    color: rgb(var(--color-primary-400));
    background: rgba(59, 130, 246, 0.15);
  }

  .access-warning {
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    background: #fff7ed;
    border: 1px solid #f97316;
    border-radius: 8px;
    color: #ea580c;
    font-size: 0.875rem;
    font-weight: 500;
  }

  :global([data-mode="dark"]) .access-warning {
    background: rgba(249, 115, 22, 0.15);
    border-color: rgba(249, 115, 22, 0.4);
    color: #fb923c;
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
    align-items: flex-start;
    gap: 2rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: #eff6ff;
    color: #3b82f6;
    border-radius: 10px;
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

  .header-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
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
    transition: all 0.2s;
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
    padding: 1.25rem 1.5rem;
  }

  .info-section {
    margin-bottom: 1.5rem;
  }

  .info-section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.75rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .section-title {
    color: var(--color-surface-100);
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.75rem 1.5rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .info-label {
    color: var(--color-surface-400);
  }

  .info-value {
    font-size: 0.875rem;
    color: #111827;
    font-weight: 500;
  }

  :global([data-mode="dark"]) .info-value {
    color: var(--color-surface-200);
  }

  .info-value.code {
    font-family: monospace;
    background: #f3f4f6;
    padding: 0.25rem 0.375rem;
    border-radius: 4px;
    word-break: break-all;
    overflow: hidden;
    font-size: 0.8rem;
  }

  :global([data-mode="dark"]) .info-value.code {
    background: rgb(var(--color-surface-900));
  }

  /* Balance */
  .balance-inline {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
  }

  .balance-amount {
    font-size: 0.875rem;
    font-weight: 700;
    color: #166534;
    font-family: monospace;
  }

  :global([data-mode="dark"]) .balance-amount {
    color: rgb(var(--color-success-300));
  }

  .balance-currency {
    font-size: 0.75rem;
    font-weight: 600;
    color: #166534;
  }

  :global([data-mode="dark"]) .balance-currency {
    color: rgb(var(--color-success-400));
  }

  /* Info + Owners side-by-side */
  .info-owners-row {
    display: grid;
    grid-template-columns: 3fr 1fr;
    gap: 1.5rem;
    align-items: start;
  }

  .info-main {
    min-width: 0;
  }

  .info-sidebar {
    min-width: 0;
  }

  /* Owners */
  .owners-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .owner-chip {
    font-size: 0.8rem;
    font-weight: 500;
    padding: 0.2rem 0;
    color: #111827;
  }

  :global([data-mode="dark"]) .owner-chip {
    color: var(--color-surface-200);
  }

  .owner-provider {
    font-size: 0.7rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .owner-provider {
    color: var(--color-surface-400);
  }

  @media (max-width: 768px) {
    .info-owners-row {
      grid-template-columns: 1fr;
    }
  }

  /* Users with access error */
  .users-access-error {
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    color: #991b1b;
    font-size: 0.875rem;
  }

  :global([data-mode="dark"]) .users-access-error {
    background: rgba(220, 38, 38, 0.1);
    border-color: rgba(220, 38, 38, 0.3);
    color: rgb(var(--color-error-300));
  }

  /* Routings */
  .routings-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .routing-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
  }

  :global([data-mode="dark"]) .routing-item {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  .routing-scheme {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 4px;
    text-transform: uppercase;
  }

  :global([data-mode="dark"]) .routing-scheme {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-300));
  }

  .routing-address {
    font-size: 0.8rem;
    font-family: monospace;
    color: #111827;
    word-break: break-all;
  }

  :global([data-mode="dark"]) .routing-address {
    color: var(--color-surface-200);
  }

  /* Attributes */
  .attributes-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .attribute-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
  }

  :global([data-mode="dark"]) .attribute-item {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  .attribute-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  :global([data-mode="dark"]) .attribute-name {
    color: var(--color-surface-300);
  }

  .attribute-value {
    font-size: 0.875rem;
    font-family: monospace;
    color: #111827;
  }

  :global([data-mode="dark"]) .attribute-value {
    color: var(--color-surface-200);
  }

  .attribute-type {
    margin-left: auto;
    font-size: 0.7rem;
    padding: 0.125rem 0.5rem;
    background: #e5e7eb;
    color: #6b7280;
    border-radius: 9999px;
  }

  :global([data-mode="dark"]) .attribute-type {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-400);
  }

  .no-attributes {
    font-size: 0.813rem;
    color: #9ca3af;
    margin: 0.5rem 0 0 0;
  }

  :global([data-mode="dark"]) .no-attributes {
    color: var(--color-surface-500);
  }

  /* Add attribute */
  .section-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .section-header-row {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .btn-add {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3rem 0.625rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 5px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }

  .btn-add:hover {
    background: #2563eb;
  }

  :global([data-mode="dark"]) .btn-add {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-add:hover {
    background: rgb(var(--color-primary-500));
  }

  .add-attribute-form {
    margin-bottom: 0.75rem;
    padding: 0.75rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
  }

  :global([data-mode="dark"]) .add-attribute-form {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  .attr-error {
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 4px;
    color: #991b1b;
    font-size: 0.8rem;
  }

  :global([data-mode="dark"]) .attr-error {
    background: rgba(220, 38, 38, 0.1);
    border-color: rgba(220, 38, 38, 0.3);
    color: rgb(var(--color-error-300));
  }

  .attr-form-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .attr-form-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 120px;
  }

  .attr-form-field-grow {
    flex: 1;
  }

  .attr-form-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .attr-form-label {
    color: var(--color-surface-400);
  }

  .attr-form-input {
    padding: 0.375rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 0.813rem;
    background: white;
    color: #111827;
  }

  .attr-form-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  :global([data-mode="dark"]) .attr-form-input {
    background: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .attr-form-input:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .attr-form-actions {
    display: flex;
    gap: 0.375rem;
    align-items: center;
  }

  .btn-attr-save {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.75rem;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.813rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-attr-save:hover:not(:disabled) {
    background: #059669;
  }

  .btn-attr-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-attr-save :global(.spinner-icon) {
    animation: spin 1s linear infinite;
  }

  .btn-attr-cancel {
    padding: 0.375rem 0.75rem;
    background: none;
    color: #6b7280;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 0.813rem;
    cursor: pointer;
  }

  .btn-attr-cancel:hover {
    background: #f3f4f6;
  }

  :global([data-mode="dark"]) .btn-attr-cancel {
    color: var(--color-surface-400);
    border-color: rgb(var(--color-surface-600));
  }

  :global([data-mode="dark"]) .btn-attr-cancel:hover {
    background: rgb(var(--color-surface-800));
  }

  .attr-form-hint {
    margin: 0.5rem 0 0 0;
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .attr-form-hint {
    color: var(--color-surface-400);
  }

  /* Tags */
  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tag-badge {
    font-size: 0.8rem;
    padding: 0.25rem 0.75rem;
    background: #fef3c7;
    color: #92400e;
    border-radius: 9999px;
    font-weight: 500;
  }

  :global([data-mode="dark"]) .tag-badge {
    background: rgba(245, 158, 11, 0.2);
    color: rgb(var(--color-warning-300));
  }

  /* Views table */
  .views-table {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
  }

  :global([data-mode="dark"]) .views-table {
    border-color: rgb(var(--color-surface-700));
  }

  .views-table-header {
    display: grid;
    grid-template-columns: 1fr auto auto 1fr 1fr;
    gap: 0;
    background: #f3f4f6;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .views-table-header {
    background: rgb(var(--color-surface-900));
    border-bottom-color: rgb(var(--color-surface-700));
    color: var(--color-surface-400);
  }

  .views-table-header > div {
    padding: 0.5rem 0.75rem;
  }

  .views-table-row {
    display: grid;
    grid-template-columns: 1fr auto auto 1fr 1fr;
    gap: 0;
    border-bottom: 1px solid #e5e7eb;
  }

  .views-table-row:last-child {
    border-bottom: none;
  }

  :global([data-mode="dark"]) .views-table-row {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .views-col-name {
    padding: 0.5rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .views-col-link {
    padding: 0.5rem 0.75rem;
    display: flex;
    align-items: center;
  }

  .views-col-users {
    padding: 0.5rem 0.75rem;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .views-col-users :global(.spinner-icon) {
    animation: spin 1s linear infinite;
    color: #9ca3af;
  }

  :global([data-mode="dark"]) .views-col-users :global(.spinner-icon) {
    color: var(--color-surface-500);
  }

  .view-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
  }

  :global([data-mode="dark"]) .view-name {
    color: var(--color-surface-100);
  }

  .view-name-link {
    font-size: 0.875rem;
    font-weight: 600;
    color: #3b82f6;
    text-decoration: none;
  }

  .view-name-link:hover {
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .view-name-link {
    color: rgb(var(--color-primary-400));
  }


  .view-badge {
    font-size: 0.7rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-weight: 600;
  }

  .view-badge.public {
    background: #d1fae5;
    color: #065f46;
  }

  :global([data-mode="dark"]) .view-badge.public {
    background: rgba(34, 197, 94, 0.2);
    color: rgb(var(--color-success-300));
  }

  .user-chip {
    display: inline-block;
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .user-chip.direct {
    background: #dbeafe;
    color: #1e40af;
  }

  :global([data-mode="dark"]) .user-chip.direct {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-300));
  }

  .user-chip.abac {
    background: #fef3c7;
    color: #92400e;
  }

  :global([data-mode="dark"]) .user-chip.abac {
    background: rgba(245, 158, 11, 0.2);
    color: rgb(var(--color-warning-300));
  }

  .view-error {
    font-size: 0.75rem;
    color: #dc2626;
    padding: 0.5rem 0.75rem;
  }

  :global([data-mode="dark"]) .view-error {
    color: rgb(var(--color-error-400));
  }

  .no-users {
    color: #d1d5db;
    font-size: 0.875rem;
  }

  :global([data-mode="dark"]) .no-users {
    color: var(--color-surface-600);
  }

  /* Empty / Loading / Error states */
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-state {
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
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .error-state {
    padding: 1.5rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 8px;
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

  .mt-4 {
    margin-top: 1rem;
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
    }

    .header-left {
      flex-direction: column;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
