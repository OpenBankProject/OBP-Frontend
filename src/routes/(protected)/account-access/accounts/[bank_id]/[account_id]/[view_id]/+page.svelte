<script lang="ts">
  import { page } from "$app/state";
  import { Landmark, ArrowLeft, Loader2, User, Tag, Route, Copy, Check } from "@lucide/svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";

  let { data }: { data: any } = $props();

  function toTitleCase(s: string): string {
    return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

  // Group users by view_id and access_source for display in Views Available
  let usersByView = $derived.by(() => {
    if (!usersWithAccess?.users) return new Map<string, { direct: string[]; abac: string[] }>();
    const map = new Map<string, { direct: string[]; abac: string[] }>();
    for (const user of usersWithAccess.users) {
      if (!user.views) continue;
      for (const view of user.views) {
        if (!map.has(view.view_id)) {
          map.set(view.view_id, { direct: [], abac: [] });
        }
        const entry = map.get(view.view_id)!;
        const name = user.username || user.user_id || "Unknown";
        if (view.access_source === "ABAC") {
          entry.abac.push(name);
        } else {
          entry.direct.push(name);
        }
      }
    }
    return map;
  });

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

  async function fetchUsersWithAccess(bankId: string, accountId: string) {
    usersWithAccessLoading = true;
    usersWithAccessError = null;
    try {
      const res = await trackedFetch(
        `/api/obp/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/users-with-access`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch users with account access");
      }
      usersWithAccess = await res.json();
    } catch (err) {
      usersWithAccessError = err instanceof Error ? err.message : "Failed to fetch users with account access";
      usersWithAccess = null;
    } finally {
      usersWithAccessLoading = false;
    }
  }

  async function loadPage(bankId: string, accountId: string, viewId: string) {
    account = null;
    error = null;
    usersWithAccess = null;
    await checkAccountAccess(bankId, accountId, viewId);
    if (hasAccountAccess) {
      await Promise.all([
        fetchAccount(bankId, accountId, viewId),
        fetchUsersWithAccess(bankId, accountId)
      ]);
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

  {#if !accessCheckDone}
    <div class="loading-state">
      <Loader2 size={32} class="spinner-icon" />
      <p>Checking account access...</p>
    </div>
  {:else if hasAccountAccess === false}
    <div class="access-warning">
      You may need further ABAC Access in order to access this account.
    </div>
    <details class="debug-panel">
      <summary class="debug-summary">
        Debug Status
        <button class="copy-btn" onclick={(e) => { e.stopPropagation(); copyDebugInfo(); }} title="Copy all debug info">
          {#if copied}<Check size={14} />{:else}<Copy size={14} />{/if}
        </button>
      </summary>
      <div class="debug-content">
        <div class="debug-grid">
          <span class="debug-label">User ID</span>
          <span class="debug-value">{userId || "—"}</span>
          <span class="debug-label">Bank ID</span>
          <span class="debug-value">{bankId || "—"}</span>
          <span class="debug-label">Account ID</span>
          <span class="debug-value">{accountId || "—"}</span>
          <span class="debug-label">View ID</span>
          <span class="debug-value">{viewId || "—"}</span>
          <span class="debug-label">Access Check Done</span>
          <span class="debug-value">{accessCheckDone}</span>
          <span class="debug-label">Has Account Access</span>
          <span class="debug-value debug-false">{String(hasAccountAccess)}</span>
          <span class="debug-label">Access Source</span>
          <span class="debug-value">{accessSource || "—"}</span>
          <span class="debug-label">ABAC Rule ID</span>
          <span class="debug-value">{abacRuleId || "—"}</span>
          <span class="debug-label">Has CanExecuteAbacRule</span>
          <span class="debug-value" class:debug-true={hasAbacRole} class:debug-false={!hasAbacRole}>{hasAbacRole}</span>
          <span class="debug-label">Account Loading</span>
          <span class="debug-value">{loading}</span>
          <span class="debug-label">Account Loaded</span>
          <span class="debug-value" class:debug-true={!!account} class:debug-false={!account && accessCheckDone && hasAccountAccess}>{!!account}</span>
          <span class="debug-label">Error</span>
          <span class="debug-value" class:debug-false={!!error}>{error || "none"}</span>
          <span class="debug-label">User Entitlements</span>
          <span class="debug-value">{userEntitlements.length} entitlement{userEntitlements.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </details>
    {#if !hasAbacRole}
      <MissingRoleAlert
        roles={["CanExecuteAbacRule"]}
        message="You may need this role to gain ABAC access to accounts."
      />
    {/if}
  {:else if loading}
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
            <a href="/account-access/accounts" class="btn-secondary">
              <ArrowLeft size={16} />
              Back
            </a>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="panel-content">
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
        {#if account.account_attributes && account.account_attributes.length > 0}
          <section class="info-section">
            <h2 class="section-title">
              <Tag size={16} />
              Account Attributes ({account.account_attributes.length})
            </h2>
            <div class="attributes-list">
              {#each account.account_attributes as attr}
                <div class="attribute-item">
                  <span class="attribute-name">{attr.name || attr.product_code}</span>
                  <span class="attribute-value">{attr.value}</span>
                  {#if attr.type}
                    <span class="attribute-type">{attr.type}</span>
                  {/if}
                </div>
              {/each}
            </div>
          </section>
        {/if}

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
                <div class="views-col-users">Direct Access</div>
                <div class="views-col-users">ABAC Access</div>
              </div>
              {#each account.views_available as view}
                {@const viewUsers = usersByView.get(view.id)}
                <div class="views-table-row">
                  <div class="views-col-name">
                    <a href="/account-access/accounts/{encodeURIComponent(bankId)}/{encodeURIComponent(accountId)}/{encodeURIComponent(view.id)}/transactions" class="view-name-link">{toTitleCase(view.id)}</a>
                    {#if view.is_public}
                      <span class="view-badge public">PUBLIC</span>
                    {/if}
                  </div>
                  <div class="views-col-users">
                    {#if usersWithAccessLoading}
                      <Loader2 size={14} class="spinner-icon" />
                    {:else if viewUsers?.direct?.length}
                      {#each viewUsers.direct as username}
                        <span class="user-chip direct">{username}</span>
                      {/each}
                    {:else if !usersWithAccessError}
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
                    {:else if !usersWithAccessError}
                      <span class="no-users">—</span>
                    {/if}
                  </div>
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
    grid-template-columns: 1fr 1fr 1fr;
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
    grid-template-columns: 1fr 1fr 1fr;
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
