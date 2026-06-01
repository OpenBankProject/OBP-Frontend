<script lang="ts">
  import { page } from "$app/state";
  import { Landmark, ArrowLeft, Loader2, User, Tag, Route, Copy, Check, Plus, FileSignature, Link } from "@lucide/svelte";
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
      pageDataSummary.set(`Viewing account ${label}, ${views} views available`);
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

  // TEMP DEBUG — raw users-with-access response per view, shown on the page
  let debugUsersByView = $state(new Map<string, any[]>());

  // Reverse lookup: viewId+username -> user_id (from raw users-with-access response)
  let usernameToUserId = $derived.by(() => {
    const m = new Map<string, string>();
    for (const [vid, users] of debugUsersByView.entries()) {
      for (const u of users) {
        const name = u.username || u.user_id;
        if (name && u.user_id) m.set(`${vid}::${name}`, u.user_id);
      }
    }
    return m;
  });

  function explainUser(vid: string, username: string) {
    const userId = usernameToUserId.get(`${vid}::${username}`);
    if (!userId) return;
    explainViewId = vid;
    explainUserId = userId;
    fetchAccessExplanation();
    document.querySelector('[data-testid="account-access-trace-panel"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
        `/proxy/obp/v6.0.0/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/views/${encodeURIComponent(viewId)}/has-account-access`
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
        `/proxy/obp/v6.0.0/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/${encodeURIComponent(viewId)}/account`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.message || data.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      account = await res.json();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
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
          `/proxy/obp/v6.0.0/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/views/${encodeURIComponent(vid)}/users-with-access`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || `Failed to fetch users with access for view ${vid}`);        }
        const data = await res.json();
        return { viewId: vid, users: data.users || [] };
      })
    );

    const map = new Map<string, { direct: string[]; abac: string[] }>();
    const errors = new Map<string, string>();
    const debugMap = new Map<string, any[]>();
    let anySuccess = false;

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      const viewId = viewId_(views[i]);
      if (result.status === "fulfilled") {
        anySuccess = true;
        const entry = { direct: [] as string[], abac: [] as string[] };
        for (const user of result.value.users) {
          const name = user.username || user.user_id || "Unknown";
          const source = String(user.access_source ?? "").toUpperCase();
          if (source.includes("ABAC")) {
            entry.abac.push(name);
          } else {
            entry.direct.push(name);
          }
        }
        debugMap.set(viewId, result.value.users);
        map.set(viewId, entry);
      } else {
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        errors.set(viewId, msg);
      }
    }

    usersByView = map;
    viewErrors = errors;
    debugUsersByView = debugMap;
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
    customerAccountLinks = [];
    customerAccountLinksError = null;
    // Run access check, account fetch, customer links fetch, and ABAC rules fetch in parallel
    await Promise.all([
      checkAccountAccess(bankId, accountId, viewId),
      fetchAccount(bankId, accountId, viewId),
      fetchCustomerAccountLinks(bankId, accountId),
      fetchAbacRules(),
    ]);
    if (account?.views_available?.length) {
      await fetchUsersWithAccess(bankId, accountId, account.views_available);
    }
  }

  // Customer Account Links
  let customerAccountLinks = $state<any[]>([]);
  let customerAccountLinksLoading = $state(false);
  let customerAccountLinksError = $state<string | null>(null);

  // ABAC rules (system-wide — diagnostic panel for ABAC visibility)
  interface AbacRule {
    abac_rule_id: string;
    rule_name: string;
    rule_code: string;
    is_active: boolean;
    description?: string;
    policy?: string;
    created_by_user_id?: string;
    updated_by_user_id?: string;
  }
  let abacRules = $state<AbacRule[]>([]);
  let abacRulesLoading = $state(false);
  let abacRulesError = $state<string | null>(null);
  let abacRulesShowInactive = $state(false);
  let abacRulesFilter = $state("");

  async function fetchAbacRules() {
    abacRulesLoading = true;
    abacRulesError = null;
    try {
      const res = await trackedFetch("/proxy/obp/v6.0.0/management/abac-rules");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      abacRules = data.abac_rules || [];
    } catch (err) {
      abacRulesError = err instanceof Error ? err.message : String(err);
      abacRules = [];
    } finally {
      abacRulesLoading = false;
    }
  }

  let abacRulesParsedError = $derived.by(() => {
    if (!abacRulesError) return null;
    const m = abacRulesError.match(/OBP-(\d+):.*missing one or more roles:\s*(.+)/i);
    if (m) {
      return { type: "missing_role" as const, code: m[1], roles: m[2].split(",").map((r) => r.trim()), message: abacRulesError };
    }
    return { type: "general" as const, message: abacRulesError };
  });

  // Account Access Trace (v7) — diagnostic for "why does/doesn't this user have access"
  let explainViewId = $state("");
  let explainUserId = $state("");
  let explainLoading = $state(false);
  let explainResult = $state<any>(null);
  let explainError = $state<string | null>(null);
  let explainHttpStatus = $state<number | null>(null);
  let traceJsonCopied = $state(false);

  async function copyTraceJson() {
    const targetView = explainViewId.trim();
    const targetUser = explainUserId.trim();
    const traceEndpoint = targetView && targetUser
      ? `/obp/v7.0.0/banks/${bankId}/accounts/${accountId}/views/${targetView}/users/${targetUser}/account-access-trace`
      : null;
    const payload = {
      generated_at: new Date().toISOString(),
      source: "OBP-Frontend api-manager / account-access page",
      context: {
        bank_id: bankId,
        account_id: accountId,
        page_view_id: viewId,
        target_view_id: targetView || null,
        target_user_id: targetUser || null,
      },
      api: {
        endpoint: traceEndpoint,
        required_role: "CanGetAccountAccessTrace",
        http_status: explainHttpStatus,
        error: explainError,
      },
      views_available: account?.views_available ?? [],
      account_access_trace_response: explainResult,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      traceJsonCopied = true;
      setTimeout(() => (traceJsonCopied = false), 1500);
    } catch {
      traceJsonCopied = false;
    }
  }

  $effect(() => {
    if (!explainViewId && viewId) explainViewId = viewId;
  });

  async function fetchAccessExplanation() {
    const targetView = explainViewId.trim();
    const targetUser = explainUserId.trim();
    if (!targetView || !targetUser || !bankId || !accountId) return;
    explainLoading = true;
    explainError = null;
    explainResult = null;
    explainHttpStatus = null;
    try {
      const res = await trackedFetch(
        `/proxy/obp/v7.0.0/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/views/${encodeURIComponent(targetView)}/users/${encodeURIComponent(targetUser)}/account-access-trace`,
      );
      explainHttpStatus = res.status;
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      explainResult = body;
    } catch (err) {
      explainError = err instanceof Error ? err.message : String(err);
    } finally {
      explainLoading = false;
    }
  }

  let explainParsedError = $derived.by(() => {
    if (!explainError) return null;
    const m = explainError.match(/OBP-(\d+):.*missing one or more roles:\s*(.+)/i);
    if (m) {
      return { type: "missing_role" as const, code: m[1], roles: m[2].split(",").map((r) => r.trim()), message: explainError };
    }
    return { type: "general" as const, message: explainError };
  });

  let abacRulesFiltered = $derived.by(() => {
    const q = abacRulesFilter.trim().toLowerCase();
    return abacRules.filter((r) => {
      if (!abacRulesShowInactive && !r.is_active) return false;
      if (!q) return true;
      return (
        r.rule_name?.toLowerCase().includes(q) ||
        r.rule_code?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.policy?.toLowerCase().includes(q) ||
        r.abac_rule_id?.toLowerCase().includes(q)
      );
    });
  });

  async function fetchCustomerAccountLinks(bankId: string, accountId: string) {
    customerAccountLinksLoading = true;
    customerAccountLinksError = null;
    try {
      const res = await trackedFetch(
        `/backend/obp/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/customer-account-links`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || `HTTP ${res.status} Failed to fetch customer account links`);
      }
      const data = await res.json();
      customerAccountLinks = data.links || [];
    } catch (err) {
      customerAccountLinksError = err instanceof Error ? err.message : "Failed to fetch customer account links";
      customerAccountLinks = [];
    } finally {
      customerAccountLinksLoading = false;
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
        `/proxy/obp/v3.1.0/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/products/${encodeURIComponent(productCode)}/attribute`,
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
        throw new Error(data.message || data.error || `HTTP ${res.status} Failed to create account attribute`);
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

        <!-- Customer Account Links -->
        <section class="info-section">
          <h2 class="section-title">
            <Link size={16} />
            Customer Account Links
            {#if !customerAccountLinksLoading && !customerAccountLinksError}
              ({customerAccountLinks.length})
            {/if}
          </h2>
          {#if customerAccountLinksLoading}
            <div class="cal-loading">
              <Loader2 size={16} class="spinner-icon" />
              <span>Loading customer links...</span>
            </div>
          {:else if customerAccountLinksError}
            <p class="no-attributes">{customerAccountLinksError}</p>
          {:else if customerAccountLinks.length > 0}
            <div class="cal-list">
              {#each customerAccountLinks as cal}
                <div class="cal-item" data-testid="cal-{cal.customer_account_link_id}">
                  <a
                    href="/customers/{encodeURIComponent(cal.bank_id)}/{encodeURIComponent(cal.customer_id)}"
                    class="cal-customer-link"
                    data-testid="cal-customer-detail-link"
                  >
                    {cal.legal_name || cal.customer_id}
                  </a>
                  <span class="cal-relationship">{cal.relationship_type}</span>
                </div>
              {/each}
            </div>
          {:else}
            <p class="no-attributes">No customer account links</p>
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

        <!-- TEMP DEBUG: raw users-with-access responses per view -->
        {#if debugUsersByView.size > 0}
          <section class="info-section">
            <details class="debug-section-details">
              <summary class="section-title debug-section-summary">DEBUG: users-with-access raw responses ({debugUsersByView.size})</summary>
              {#each [...debugUsersByView.entries()] as [vid, users]}
                <div class="debug-block">
                  <div class="debug-block-header">view: <code>{vid}</code> — {users.length} user{users.length === 1 ? "" : "s"}</div>
                  <pre class="debug-block-body">{JSON.stringify(users, null, 2)}</pre>
                </div>
              {/each}
            </details>
          </section>
        {/if}

        <!-- Views Available -->
        {#if account.views_available && account.views_available.length > 0}
          <section class="info-section">
            <h2 class="section-title">
              Views Available ({account.views_available.length})
            </h2>
            <p class="abac-rules-hint">
              <strong>Direct Access</strong>: users with a row in <code>AccountAccess</code> for this view (<code>access_source: ACCOUNT_ACCESS</code>).
              <br />
              <strong>ABAC Access</strong>: users who <em>don't</em> have Direct Access, <em>do</em> hold the <code>CanExecuteAbacRule</code> entitlement, and match at least one active rule under the <code>account-access</code> policy. Users granted by both are reported only under Direct. Users matched by a rule but lacking <code>CanExecuteAbacRule</code> are not enumerated here.
            </p>
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
                <div
                  class="views-col-users"
                  title="Users with a row in AccountAccess for this view (access_source: ACCOUNT_ACCESS)."
                >Direct Access</div>
                <div
                  class="views-col-users"
                  title="Users without Direct Access who hold CanExecuteAbacRule and match an active rule under the account-access policy. Direct Access wins precedence — users with both are listed only as Direct. Rule-matching users without CanExecuteAbacRule are not enumerated."
                >ABAC Access</div>
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
                          <button type="button" class="user-chip direct chip-button" title="Explain access for {username}" onclick={() => explainUser(vid, username)}>{username}</button>
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
                          <button type="button" class="user-chip abac chip-button" title="Explain access for {username}" onclick={() => explainUser(vid, username)}>{username}</button>
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

        <!-- Account Access Trace diagnostic panel (v7) -->
        <section class="info-section" data-testid="account-access-trace-panel">
          <h2 class="section-title">
            <span>Account Access Trace</span>
            <button
              type="button"
              class="trace-copy-btn"
              onclick={copyTraceJson}
              title="Copy Views Available + Account Access Trace as JSON"
              data-testid="trace-copy-json"
            >
              {#if traceJsonCopied}
                <Check size={14} />
                Copied
              {:else}
                <Copy size={14} />
                Copy JSON
              {/if}
            </button>
          </h2>
          <p class="abac-rules-hint">
            Calls <code>/obp/v7.0.0/banks/{bankId}/accounts/{accountId}/views/{`{target_view_id}`}/users/{`{target_user_id}`}/account-access-trace</code>
            to show why a specific user has (or doesn't have) access.
          </p>
          <div class="explain-form">
            <div class="explain-field">
              <label for="explain-view" class="search-label">View</label>
              {#if account?.views_available?.length}
                <select
                  id="explain-view"
                  class="explain-input"
                  bind:value={explainViewId}
                  data-testid="explain-view-select"
                >
                  {#each account.views_available as v}
                    {@const vid = viewId_(v)}
                    <option value={vid}>{vid}</option>
                  {/each}
                </select>
              {:else}
                <input
                  id="explain-view"
                  type="text"
                  class="explain-input"
                  bind:value={explainViewId}
                  data-testid="explain-view-input"
                />
              {/if}
            </div>
            <div class="explain-field explain-field-grow">
              <label for="explain-user" class="search-label">User ID</label>
              <input
                id="explain-user"
                type="text"
                class="explain-input"
                placeholder="Paste a user_id (UUID)"
                bind:value={explainUserId}
                data-testid="explain-user-input"
              />
            </div>
            <button
              type="button"
              class="btn-add"
              onclick={fetchAccessExplanation}
              disabled={!explainViewId.trim() || !explainUserId.trim() || explainLoading}
              data-testid="explain-submit"
            >
              {#if explainLoading}
                <Loader2 size={14} class="spinner-icon" />
              {:else}
                Trace
              {/if}
            </button>
          </div>

          {#if explainParsedError && explainParsedError.type === "missing_role"}
            <MissingRoleAlert
              roles={explainParsedError.roles}
              errorCode={explainParsedError.code}
              message={explainParsedError.message}
              bankId={bankId}
            />
          {:else if explainError}
            <div class="users-access-error" data-testid="explain-error">
              {explainError}{explainHttpStatus ? ` (HTTP ${explainHttpStatus})` : ""}
            </div>
          {/if}

          {#if explainResult}
            {@const accessTrace = explainResult.account_access_trace ?? {}}
            {@const entTrace = explainResult.entitlement_trace ?? {}}
            {@const abacTrace = explainResult.abac_trace ?? {}}
            {@const rules = abacTrace.rules_evaluated ?? []}
            <div class="explain-summary" data-testid="explain-summary">
              <span class="explain-badge {explainResult.has_access ? 'success' : 'fail'}">
                has_access: {String(explainResult.has_access)}
              </span>
              {#if explainResult.access_source}
                <span class="explain-badge neutral">access_source: {explainResult.access_source}</span>
              {/if}
            </div>

            <div class="explain-trace">
              <div class="explain-trace-section explain-trace-section-primary {accessTrace.has_account_access_for_view ? 'is-grant' : 'is-deny'}">
                <h3 class="explain-trace-title">AccountAccess</h3>
                <div class="explain-trace-row explain-trace-row-primary">
                  <span class="explain-trace-label">has_account_access_for_view</span>
                  <span class="explain-badge explain-badge-lg {accessTrace.has_account_access_for_view ? 'success' : 'fail'}">{String(accessTrace.has_account_access_for_view)}</span>
                </div>
                <div class="explain-trace-hint">
                  Decisive when <code>true</code>: AccountAccess wins outright and <code>has_access</code> is <code>true</code> regardless of ABAC. When <code>false</code>, the final decision falls back to ABAC.
                </div>
                {#if accessTrace.account_access_view_ids?.length}
                  <div class="explain-trace-row">
                    <span class="explain-trace-label">account_access_view_ids</span>
                    <span class="explain-trace-value code">{accessTrace.account_access_view_ids.join(", ")}</span>
                  </div>
                {/if}
              </div>

              <div class="explain-trace-section">
                <h3 class="explain-trace-title">Entitlement</h3>
                <div class="explain-trace-row">
                  <span class="explain-trace-label">has_can_execute_abac_rule</span>
                  <span class="explain-badge {entTrace.has_can_execute_abac_rule ? 'success' : 'fail'}">{String(entTrace.has_can_execute_abac_rule)}</span>
                </div>
              </div>

              <div class="explain-trace-section">
                <h3 class="explain-trace-title">ABAC</h3>
                <div class="explain-trace-row">
                  <span class="explain-trace-label">policy</span>
                  <span class="explain-trace-value code">{abacTrace.policy ?? "—"}</span>
                </div>
                <div class="explain-trace-row">
                  <span class="explain-trace-label">allow_abac_account_access</span>
                  <span class="explain-badge {abacTrace.allow_abac_account_access ? 'success' : 'fail'}">{String(abacTrace.allow_abac_account_access)}</span>
                </div>
                <div class="explain-trace-hint">
                  Value of the API <code>allow_abac_account_access</code> system Prop. When <code>false</code>, ABAC can never grant account access on this deployment, regardless of rules or entitlements.
                </div>
                <div class="explain-trace-row">
                  <span class="explain-trace-label">standalone_abac_result</span>
                  <span class="explain-badge {abacTrace.standalone_abac_result ? 'success' : 'fail'}">{String(abacTrace.standalone_abac_result)}</span>
                </div>
                <div class="explain-trace-hint">
                  What ABAC would decide on its own. <code>true</code> only when all three hold: (1) <code>allow_abac_account_access</code> is <code>true</code>, (2) the target user has the <code>CanExecuteAbacRule</code> entitlement, and (3) at least one active rule under the <code>account-access</code> policy returns <code>PASS</code> (logical OR across rules). The final <code>has_access</code> is <code>has_account_access_for_view</code> OR <code>standalone_abac_result</code>.
                </div>
                <div class="explain-trace-row">
                  <span class="explain-trace-label">rules_evaluated ({rules.length})</span>
                </div>
                {#if rules.length > 0}
                  <div class="explain-rules-list">
                    {#each rules as rule, i}
                      <details class="abac-rule">
                        <summary class="abac-rule-summary">
                          <span class="abac-rule-name">{rule.rule_name ?? `rule[${i}]`}</span>
                          {#if rule.result}
                            <span class="explain-badge {rule.result === 'PASS' ? 'success' : rule.result === 'FAIL' ? 'fail' : 'neutral'}">{rule.result}</span>
                          {/if}
                          {#if rule.is_active === false}
                            <span class="explain-badge neutral">inactive</span>
                          {/if}
                          {#if rule.error_message}
                            <span class="explain-badge fail" title={rule.error_message}>error</span>
                          {/if}
                        </summary>
                        <pre class="abac-rule-code">{JSON.stringify(rule, null, 2)}</pre>
                      </details>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>

            <details class="explain-raw-toggle">
              <summary>Raw JSON response</summary>
              <pre class="abac-rule-code" data-testid="explain-json">{JSON.stringify(explainResult, null, 2)}</pre>
            </details>
          {/if}
        </section>

        <!-- ABAC Rules diagnostic panel -->
        <section class="info-section">
          <h2 class="section-title">
            ABAC Rules
            {#if !abacRulesLoading && !abacRulesError}
              ({abacRulesFiltered.length}{abacRulesShowInactive ? "" : ` of ${abacRules.length} active`})
            {/if}
          </h2>
          <p class="abac-rules-hint">
            System-wide rules. Filter by rule name, code, policy, description, or id to find rules referencing this account ({accountId}) or view ({viewId}).
          </p>
          {#if abacRulesLoading}
            <div class="cal-loading">
              <Loader2 size={16} class="spinner-icon" />
              <span>Loading ABAC rules...</span>
            </div>
          {:else if abacRulesParsedError && abacRulesParsedError.type === "missing_role"}
            <MissingRoleAlert
              roles={abacRulesParsedError.roles}
              errorCode={abacRulesParsedError.code}
              message={abacRulesParsedError.message}
              bankId={bankId}
            />
          {:else if abacRulesError}
            <div class="users-access-error">{abacRulesError}</div>
          {:else}
            <div class="abac-controls">
              <input
                type="text"
                class="abac-filter-input"
                name="abac-rules-filter"
                placeholder={`Filter (try "${accountId}" or "${viewId}")`}
                bind:value={abacRulesFilter}
                data-testid="abac-rules-filter"
              />
              <label class="abac-toggle">
                <input type="checkbox" bind:checked={abacRulesShowInactive} data-testid="abac-show-inactive" />
                Show inactive
              </label>
            </div>
            {#if abacRulesFiltered.length === 0}
              <p class="no-attributes">No matching ABAC rules.</p>
            {:else}
              <div class="abac-rules-list">
                {#each abacRulesFiltered as rule (rule.abac_rule_id)}
                  <details class="abac-rule" data-testid="abac-rule-{rule.abac_rule_id}">
                    <summary class="abac-rule-summary">
                      <span class="abac-rule-name">{rule.rule_name}</span>
                      {#if rule.policy}
                        <span class="abac-rule-policy">{rule.policy}</span>
                      {/if}
                      {#if rule.is_active}
                        <span class="abac-rule-state active">active</span>
                      {:else}
                        <span class="abac-rule-state inactive">inactive</span>
                      {/if}
                    </summary>
                    <div class="abac-rule-body">
                      {#if rule.description}
                        <div class="abac-rule-row">
                          <span class="abac-rule-label">Description</span>
                          <span class="abac-rule-value">{rule.description}</span>
                        </div>
                      {/if}
                      <div class="abac-rule-row">
                        <span class="abac-rule-label">Rule ID</span>
                        <span class="abac-rule-value code">{rule.abac_rule_id}</span>
                      </div>
                      <div class="abac-rule-row">
                        <span class="abac-rule-label">Code</span>
                        <pre class="abac-rule-code">{rule.rule_code}</pre>
                      </div>
                    </div>
                  </details>
                {/each}
              </div>
            {/if}
          {/if}
        </section>
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

  /* Account Access Trace panel */
  .trace-copy-btn {
    margin-inline-start: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #374151;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
  }

  .trace-copy-btn:hover {
    background: #e5e7eb;
  }

  :global([data-mode="dark"]) .trace-copy-btn {
    color: var(--color-surface-200);
    background: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-600));
  }

  :global([data-mode="dark"]) .trace-copy-btn:hover {
    background: rgb(var(--color-surface-700));
  }

  .explain-form {
    display: flex;
    align-items: flex-end;
    gap: 0.625rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }

  .explain-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 180px;
  }

  .explain-field-grow {
    flex: 1;
    min-width: 280px;
  }

  .explain-input {
    padding: 0.375rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 0.813rem;
    background: white;
    color: #111827;
  }

  .explain-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  :global([data-mode="dark"]) .explain-input {
    background: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  .explain-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin: 0.625rem 0;
  }

  .explain-badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-family: monospace;
  }

  .explain-badge.success {
    background: #dcfce7;
    color: #166534;
  }

  .explain-badge.fail {
    background: #fee2e2;
    color: #991b1b;
  }

  .explain-badge.neutral {
    background: #e5e7eb;
    color: #374151;
  }

  :global([data-mode="dark"]) .explain-badge.success {
    background: rgba(22, 163, 74, 0.2);
    color: rgb(var(--color-success-400));
  }

  :global([data-mode="dark"]) .explain-badge.fail {
    background: rgba(220, 38, 38, 0.2);
    color: rgb(var(--color-error-400));
  }

  :global([data-mode="dark"]) .explain-badge.neutral {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
  }

  .explain-trace {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 0.75rem;
    margin: 0.625rem 0;
  }

  .explain-trace-section {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.625rem 0.75rem;
    background: #fafafa;
  }

  :global([data-mode="dark"]) .explain-trace-section {
    border-color: rgb(var(--color-surface-700));
    background: rgb(var(--color-surface-900));
  }

  .explain-trace-section-primary {
    border-width: 2px;
  }

  .explain-trace-section-primary.is-grant {
    border-color: #16a34a;
    background: #f0fdf4;
  }

  .explain-trace-section-primary.is-deny {
    border-color: #d1d5db;
    background: #fafafa;
  }

  :global([data-mode="dark"]) .explain-trace-section-primary.is-grant {
    border-color: rgb(var(--color-success-500));
    background: rgba(22, 163, 74, 0.08);
  }

  :global([data-mode="dark"]) .explain-trace-section-primary.is-deny {
    border-color: rgb(var(--color-surface-700));
    background: rgb(var(--color-surface-900));
  }

  .explain-trace-row-primary {
    margin-bottom: 0.5rem;
  }

  .explain-trace-row-primary .explain-trace-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
  }

  :global([data-mode="dark"]) .explain-trace-row-primary .explain-trace-label {
    color: var(--color-surface-100);
  }

  .explain-badge-lg {
    font-size: 0.875rem;
    padding: 0.3125rem 0.75rem;
  }

  .explain-trace-title {
    margin: 0 0 0.5rem 0;
    font-size: 0.75rem;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .explain-trace-title {
    color: var(--color-surface-400);
  }

  .explain-trace-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
    font-size: 0.813rem;
    flex-wrap: wrap;
  }

  .explain-trace-row:last-child {
    margin-bottom: 0;
  }

  .explain-trace-label {
    font-family: monospace;
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .explain-trace-label {
    color: var(--color-surface-400);
  }

  .explain-trace-value {
    color: #111827;
    word-break: break-all;
  }

  :global([data-mode="dark"]) .explain-trace-value {
    color: var(--color-surface-200);
  }

  .explain-trace-value.code {
    font-family: monospace;
    font-size: 0.75rem;
    background: #f3f4f6;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
  }

  .explain-trace-hint {
    font-size: 0.7rem;
    line-height: 1.45;
    color: #6b7280;
    margin: -0.125rem 0 0.5rem 0;
  }

  .explain-trace-hint code {
    font-family: monospace;
    font-size: 0.7rem;
    background: #f3f4f6;
    padding: 0.05rem 0.25rem;
    border-radius: 3px;
    color: #374151;
  }

  :global([data-mode="dark"]) .explain-trace-hint {
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .explain-trace-hint code {
    background: rgb(var(--color-surface-800));
    color: var(--color-surface-200);
  }

  :global([data-mode="dark"]) .explain-trace-value.code {
    background: rgb(var(--color-surface-800));
  }

  .explain-rules-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.375rem;
  }

  .explain-raw-toggle {
    margin-top: 0.625rem;
  }

  .explain-raw-toggle summary {
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .explain-raw-toggle summary {
    color: var(--color-surface-400);
  }

  /* Chip-as-button styling */
  .chip-button {
    cursor: pointer;
    border: none;
    font-family: inherit;
  }

  .chip-button:hover {
    filter: brightness(0.95);
    text-decoration: underline;
  }

  /* ABAC rules panel */
  .abac-rules-hint {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0 0 0.625rem 0;
  }

  :global([data-mode="dark"]) .abac-rules-hint {
    color: var(--color-surface-400);
  }

  .abac-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.625rem;
  }

  .abac-filter-input {
    flex: 1;
    max-width: 480px;
    padding: 0.375rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 0.813rem;
    background: white;
    color: #111827;
  }

  .abac-filter-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  :global([data-mode="dark"]) .abac-filter-input {
    background: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  .abac-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #6b7280;
    cursor: pointer;
  }

  :global([data-mode="dark"]) .abac-toggle {
    color: var(--color-surface-400);
  }

  .abac-rules-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .abac-rule {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #fafafa;
    overflow: hidden;
  }

  :global([data-mode="dark"]) .abac-rule {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  .abac-rule-summary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    user-select: none;
    list-style: none;
    font-size: 0.813rem;
  }

  .abac-rule-summary::-webkit-details-marker { display: none; }

  .abac-rule-summary::before {
    content: "▶";
    font-size: 0.6rem;
    color: #9ca3af;
    transition: transform 0.15s;
  }

  .abac-rule[open] .abac-rule-summary::before {
    transform: rotate(90deg);
    display: inline-block;
  }

  .abac-rule-name {
    font-weight: 600;
    color: #111827;
  }

  :global([data-mode="dark"]) .abac-rule-name {
    color: var(--color-surface-100);
  }

  .abac-rule-policy {
    font-family: monospace;
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 4px;
  }

  :global([data-mode="dark"]) .abac-rule-policy {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-300));
  }

  .abac-rule-state {
    margin-left: auto;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .abac-rule-state.active {
    background: #dcfce7;
    color: #166534;
  }

  :global([data-mode="dark"]) .abac-rule-state.active {
    background: rgba(22, 163, 74, 0.2);
    color: rgb(var(--color-success-400));
  }

  .abac-rule-state.inactive {
    background: #f3f4f6;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .abac-rule-state.inactive {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-400);
  }

  .abac-rule-body {
    padding: 0.5rem 0.75rem 0.75rem;
    border-top: 1px solid #e5e7eb;
    background: white;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  :global([data-mode="dark"]) .abac-rule-body {
    background: rgb(var(--color-surface-800));
    border-top-color: rgb(var(--color-surface-700));
  }

  .abac-rule-row {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .abac-rule-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .abac-rule-label {
    color: var(--color-surface-400);
  }

  .abac-rule-value {
    font-size: 0.813rem;
    color: #111827;
  }

  :global([data-mode="dark"]) .abac-rule-value {
    color: var(--color-surface-200);
  }

  .abac-rule-value.code {
    font-family: monospace;
    font-size: 0.75rem;
  }

  .abac-rule-code {
    margin: 0;
    padding: 0.5rem 0.625rem;
    background: #1f2937;
    color: #f9fafb;
    border-radius: 4px;
    font-size: 0.75rem;
    font-family: monospace;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 280px;
    overflow: auto;
  }

  :global([data-mode="dark"]) .abac-rule-code {
    background: rgb(var(--color-surface-950, var(--color-surface-900)));
  }

  /* TEMP DEBUG */
  .debug-section-details {
    margin: 0;
  }

  .debug-section-summary {
    cursor: pointer;
    list-style: none;
    user-select: none;
  }

  .debug-section-summary::-webkit-details-marker {
    display: none;
  }

  .debug-section-summary::before {
    content: "▶";
    display: inline-block;
    margin-right: 0.5rem;
    font-size: 0.625rem;
    transition: transform 0.15s ease;
  }

  .debug-section-details[open] > .debug-section-summary::before {
    transform: rotate(90deg);
  }

  .debug-section-details[open] > .debug-section-summary {
    margin-bottom: 0.75rem;
  }

  .debug-block {
    margin-bottom: 0.75rem;
    border: 1px solid #fbbf24;
    border-radius: 6px;
    background: #fffbeb;
    overflow: hidden;
  }

  :global([data-mode="dark"]) .debug-block {
    background: rgba(245, 158, 11, 0.08);
    border-color: rgba(245, 158, 11, 0.4);
  }

  .debug-block-header {
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #92400e;
    background: #fef3c7;
    border-bottom: 1px solid #fbbf24;
  }

  :global([data-mode="dark"]) .debug-block-header {
    background: rgba(245, 158, 11, 0.15);
    border-bottom-color: rgba(245, 158, 11, 0.4);
    color: rgb(var(--color-warning-300));
  }

  .debug-block-body {
    margin: 0;
    padding: 0.5rem 0.625rem;
    font-size: 0.75rem;
    font-family: monospace;
    color: #374151;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 320px;
    overflow: auto;
  }

  :global([data-mode="dark"]) .debug-block-body {
    color: var(--color-surface-200);
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

  /* Customer Account Links */
  .cal-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.813rem;
    color: #6b7280;
    padding: 0.5rem 0;
  }

  :global([data-mode="dark"]) .cal-loading {
    color: var(--color-surface-400);
  }

  .cal-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .cal-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.375rem 0.5rem;
    border-radius: 4px;
    font-size: 0.813rem;
  }

  .cal-item:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .cal-item:hover {
    background: rgb(var(--color-surface-700));
  }

  .cal-customer-link {
    color: #3b82f6;
    text-decoration: none;
    font-size: 0.813rem;
    font-weight: 500;
  }

  .cal-customer-link:hover {
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .cal-customer-link {
    color: rgb(var(--color-primary-400));
  }

  .cal-relationship {
    display: inline-block;
    padding: 0.0625rem 0.375rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 500;
    background: #eff6ff;
    color: #1e40af;
  }

  :global([data-mode="dark"]) .cal-relationship {
    background: rgba(59, 130, 246, 0.15);
    color: rgb(var(--color-primary-300));
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
