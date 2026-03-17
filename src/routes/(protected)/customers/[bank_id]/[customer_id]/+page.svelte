<script lang="ts">
  import { page } from "$app/state";
  import { ArrowLeft, UserRound, Loader2, FileSignature, Plus } from "@lucide/svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";

  interface CustomerDetail {
    bank_id: string;
    customer_id: string;
    customer_number: string;
    legal_name: string;
    mobile_phone_number: string;
    email: string;
    face_image: { url: string; date: string };
    date_of_birth: string;
    relationship_status: string;
    dependants: number;
    dob_of_dependants: string[];
    credit_rating: { rating: string; source: string };
    credit_limit: { currency: string; amount: string };
    highest_education_attained: string;
    employment_status: string;
    kyc_status: boolean;
    last_ok_date: string;
    title: string;
    branch_id: string;
    name_suffix: string;
    customer_type: string;
    parent_customer_id: string;
    customer_attributes: Array<{
      customer_attribute_id: string;
      name: string;
      type: string;
      value: string;
    }>;
  }

  import { pageDataSummary } from "$lib/stores/pageDataSummary.svelte";
  import { pageHeading } from "$lib/stores/pageHeading.svelte";

  let customer = $state<CustomerDetail | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (customer) {
      const kyc = customer.kyc_status ? "KYC complete" : "KYC incomplete";
      const attrs = customer.customer_attributes?.length || 0;
      pageDataSummary.set(`Viewing customer ${customer.legal_name} at ${customer.bank_id}, ${kyc}, ${attrs} attributes`);
      pageHeading.set(customer.legal_name);
    }
  });

  let bankId = $derived(page.params.bank_id || "");
  let customerId = $derived(page.params.customer_id || "");

  let isCorporate = $derived(
    customer?.customer_type?.toLowerCase() === "corporate" ||
    customer?.customer_type?.toLowerCase() === "business"
  );

  let parsedError = $derived.by(() => {
    if (!error) return null;
    const match = error.match(/OBP-(\d+):.*missing one or more roles:\s*(.+)/i);
    if (match) {
      const roles = match[2].split(",").map((r: string) => r.trim());
      return { type: "missing_role" as const, code: match[1], roles, message: error };
    }
    return { type: "general" as const, message: error };
  });

  async function fetchCustomer(bankId: string, customerId: string) {
    loading = true;
    error = null;
    try {
      const res = await trackedFetch(
        `/api/obp/banks/${encodeURIComponent(bankId)}/customers/${encodeURIComponent(customerId)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch customer details");
      }
      customer = await res.json();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch customer details";
      customer = null;
    } finally {
      loading = false;
    }
  }

  // Add Customer Attribute
  let showAddAttribute = $state(false);
  let newAttrName = $state("");
  let newAttrType = $state("STRING");
  let newAttrValue = $state("");
  let addingAttribute = $state(false);
  let addAttributeError = $state<string | null>(null);

  async function addCustomerAttribute() {
    if (!newAttrName.trim() || !newAttrValue.trim()) return;

    addingAttribute = true;
    addAttributeError = null;

    try {
      const res = await trackedFetch(
        `/api/obp/banks/${encodeURIComponent(bankId)}/customers/${encodeURIComponent(customerId)}/attribute`,
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
        throw new Error(data.error || "Failed to create customer attribute");
      }

      const created = await res.json();

      if (!customer!.customer_attributes) {
        customer!.customer_attributes = [];
      }
      customer!.customer_attributes = [...customer!.customer_attributes, created];

      newAttrName = "";
      newAttrType = "STRING";
      newAttrValue = "";
      showAddAttribute = false;
    } catch (err) {
      addAttributeError = err instanceof Error ? err.message : "Failed to create customer attribute";
    } finally {
      addingAttribute = false;
    }
  }

  $effect(() => {
    if (bankId && customerId) {
      fetchCustomer(bankId, customerId);
    }
  });
</script>

<svelte:head>
  <title>{customer?.legal_name || "Customer Detail"} - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb -->
  <nav class="breadcrumb mb-4" aria-label="Breadcrumb">
    <a href="/customers/{isCorporate ? 'corporate' : 'individual'}" class="breadcrumb-link">Customers</a>
    <span class="breadcrumb-separator">&rsaquo;</span>
    <span class="breadcrumb-current">{customer?.legal_name || customerId}</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-icon">
          <UserRound size={28} />
        </div>
        <div>
          <h1 class="panel-title" data-testid="customer-name">
            {#if customer}
              {customer.title ? `${customer.title} ` : ""}{customer.legal_name || "Unnamed Customer"}{customer.name_suffix ? ` ${customer.name_suffix}` : ""}
            {:else}
              Customer Detail
            {/if}
          </h1>
          <div class="panel-subtitle">{bankId} / {customerId}</div>
        </div>
        <a href="/mandates?customer_id={encodeURIComponent(customerId)}" class="btn-secondary" data-testid="view-mandates">
          <FileSignature size={16} />
          Mandates
        </a>
        <a href="/customers/{isCorporate ? 'corporate' : 'individual'}" class="btn-secondary" data-testid="back-button">
          <ArrowLeft size={16} />
          Back
        </a>
      </div>
    </div>

    <div class="panel-content">
      {#if loading}
        <div class="loading-state">
          <Loader2 size={32} class="spinner-icon" />
          <p>Loading customer details...</p>
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
      {:else if customer}
        <!-- Customer Info -->
        <section class="detail-section">
          <h2 class="section-title">Customer Information</h2>
          <div class="info-grid" data-testid="customer-info">
            <div class="info-item">
              <span class="info-label">Customer ID</span>
              <span class="info-value mono">{customer.customer_id}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Customer Number</span>
              <span class="info-value">{customer.customer_number || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Customer Type</span>
              <span class="info-value">
                {#if customer.customer_type}
                  <span class="badge">{customer.customer_type}</span>
                {:else}
                  —
                {/if}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Legal Name</span>
              <span class="info-value">{customer.legal_name || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Email</span>
              <span class="info-value">{customer.email || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Phone</span>
              <span class="info-value">{customer.mobile_phone_number || "—"}</span>
            </div>
            {#if !isCorporate}
              <div class="info-item">
                <span class="info-label">Date of Birth</span>
                <span class="info-value">{customer.date_of_birth || "—"}</span>
              </div>
            {/if}
            <div class="info-item">
              <span class="info-label">Bank ID</span>
              <span class="info-value mono">{customer.bank_id || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Branch ID</span>
              <span class="info-value">{customer.branch_id || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">KYC Status</span>
              <span class="info-value">
                {#if customer.kyc_status === true}
                  <span class="badge badge-success">Verified</span>
                {:else if customer.kyc_status === false}
                  <span class="badge badge-warning">Pending</span>
                {:else}
                  —
                {/if}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Last OK Date</span>
              <span class="info-value">{customer.last_ok_date || "—"}</span>
            </div>
            {#if isCorporate || customer.parent_customer_id}
              <div class="info-item" data-testid="parent-customer">
                <span class="info-label">Parent Customer</span>
                <span class="info-value">
                  {#if customer.parent_customer_id}
                    <a href="/customers/{encodeURIComponent(bankId)}/{encodeURIComponent(customer.parent_customer_id)}" class="info-link">
                      {customer.parent_customer_id}
                    </a>
                  {:else}
                    —
                  {/if}
                </span>
              </div>
            {/if}
          </div>
        </section>

        {#if !isCorporate}
          <!-- Personal Details (Individual customers only) -->
          <section class="detail-section">
            <h2 class="section-title">Personal Details</h2>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Relationship Status</span>
                <span class="info-value">{customer.relationship_status || "—"}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Dependants</span>
                <span class="info-value">{customer.dependants ?? "—"}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Highest Education</span>
                <span class="info-value">{customer.highest_education_attained || "—"}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Employment Status</span>
                <span class="info-value">{customer.employment_status || "—"}</span>
              </div>
            </div>
            {#if customer.dob_of_dependants && customer.dob_of_dependants.length > 0}
              <div class="sub-detail">
                <span class="info-label">Dependants DOB</span>
                <span class="info-value">{customer.dob_of_dependants.join(", ")}</span>
              </div>
            {/if}
          </section>
        {/if}

        <!-- Credit Info -->
        <section class="detail-section">
          <h2 class="section-title">Credit Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Credit Rating</span>
              <span class="info-value">{customer.credit_rating?.rating || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Rating Source</span>
              <span class="info-value">{customer.credit_rating?.source || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Credit Limit</span>
              <span class="info-value">
                {#if customer.credit_limit?.amount}
                  {customer.credit_limit.amount} {customer.credit_limit.currency || ""}
                {:else}
                  —
                {/if}
              </span>
            </div>
          </div>
        </section>

        <!-- Customer Attributes -->
        <section class="detail-section">
          <div class="section-header-row">
            <h2 class="section-title" style="margin:0">
              Customer Attributes ({customer.customer_attributes?.length || 0})
            </h2>
            <button
              type="button"
              class="btn-add"
              data-testid="add-customer-attribute"
              onclick={() => { showAddAttribute = !showAddAttribute; addAttributeError = null; }}
            >
              <Plus size={14} />
              Add
            </button>
          </div>

          {#if showAddAttribute}
            <div class="add-attribute-form" data-testid="add-customer-attribute-form">
              {#if addAttributeError}
                <div class="attr-error">{addAttributeError}</div>
              {/if}
              <div class="attr-form-row">
                <div class="attr-form-field">
                  <label for="cust-attr-name" class="attr-form-label">Name</label>
                  <input
                    type="text"
                    id="cust-attr-name"
                    name="cust-attr-name"
                    class="attr-form-input"
                    data-testid="cust-attr-name"
                    placeholder="e.g. SPECIAL_TAX_NUMBER"
                    bind:value={newAttrName}
                  />
                </div>
                <div class="attr-form-field">
                  <label for="cust-attr-type" class="attr-form-label">Type</label>
                  <select
                    id="cust-attr-type"
                    name="cust-attr-type"
                    class="attr-form-input"
                    data-testid="cust-attr-type"
                    bind:value={newAttrType}
                  >
                    <option value="STRING">STRING</option>
                    <option value="INTEGER">INTEGER</option>
                    <option value="DOUBLE">DOUBLE</option>
                    <option value="DATE_WITH_DAY">DATE_WITH_DAY</option>
                  </select>
                </div>
                <div class="attr-form-field attr-form-field-grow">
                  <label for="cust-attr-value" class="attr-form-label">Value</label>
                  <input
                    type="text"
                    id="cust-attr-value"
                    name="cust-attr-value"
                    class="attr-form-input"
                    data-testid="cust-attr-value"
                    placeholder="Attribute value"
                    bind:value={newAttrValue}
                  />
                </div>
                <div class="attr-form-actions">
                  <button
                    type="button"
                    class="btn-attr-save"
                    data-testid="save-customer-attribute"
                    disabled={!newAttrName.trim() || !newAttrValue.trim() || addingAttribute}
                    onclick={addCustomerAttribute}
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
                    data-testid="cancel-customer-attribute"
                    onclick={() => { showAddAttribute = false; addAttributeError = null; }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          {/if}

          {#if customer.customer_attributes && customer.customer_attributes.length > 0}
            <div class="attributes-list">
              {#each customer.customer_attributes as attr (attr.customer_attribute_id)}
                <div class="attribute-item" data-testid="attribute-{attr.name}">
                  <span class="attribute-name">{attr.name}</span>
                  <span class="attribute-value">{attr.value}</span>
                  {#if attr.type}
                    <span class="attribute-type">{attr.type}</span>
                  {/if}
                </div>
              {/each}
            </div>
          {:else if !showAddAttribute}
            <p class="no-attributes">No customer attributes</p>
          {/if}
        </section>
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
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: #eff6ff;
    color: #3b82f6;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .header-icon {
    background: rgba(59, 130, 246, 0.15);
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
    font-size: 0.75rem;
    color: #6b7280;
    font-family: monospace;
    margin-top: 0.25rem;
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
    margin-left: auto;
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
    padding: 1.5rem;
  }

  /* Sections */
  .detail-section {
    margin-bottom: 2rem;
  }

  .detail-section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: #374151;
    margin: 0 0 1rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .section-title {
    color: var(--color-surface-300);
  }

  /* Info grid */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-label {
    font-size: 0.7rem;
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
  }

  :global([data-mode="dark"]) .info-value {
    color: var(--color-surface-200);
  }

  .info-link {
    color: #3b82f6;
    text-decoration: none;
    font-family: monospace;
    font-size: 0.8rem;
  }

  .info-link:hover {
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .info-link {
    color: rgb(var(--color-primary-400));
  }

  .mono {
    font-family: monospace;
    font-size: 0.8rem;
  }

  .sub-detail {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  /* Badge */
  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 500;
    background: #eff6ff;
    color: #1e40af;
  }

  :global([data-mode="dark"]) .badge {
    background: rgba(59, 130, 246, 0.15);
    color: rgb(var(--color-primary-300));
  }

  .badge-success {
    background: #f0fdf4;
    color: #166534;
  }

  :global([data-mode="dark"]) .badge-success {
    background: rgba(34, 197, 94, 0.15);
    color: rgb(var(--color-success-300));
  }

  .badge-warning {
    background: #fffbeb;
    color: #92400e;
  }

  :global([data-mode="dark"]) .badge-warning {
    background: rgba(245, 158, 11, 0.15);
    color: rgb(var(--color-warning-300));
  }

  /* Table */
  .table-container {
    overflow-x: auto;
  }

  .detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }

  .detail-table th {
    text-align: left;
    padding: 0.625rem 0.75rem;
    font-weight: 600;
    color: #6b7280;
    border-bottom: 2px solid #e5e7eb;
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .detail-table th {
    color: var(--color-surface-400);
    border-bottom-color: rgb(var(--color-surface-600));
  }

  .detail-table td {
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    vertical-align: top;
  }

  :global([data-mode="dark"]) .detail-table td {
    border-bottom-color: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
  }

  .detail-table tbody tr:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .detail-table tbody tr:hover {
    background: rgb(var(--color-surface-700));
  }

  .cell-label {
    font-weight: 500;
    color: #111827;
  }

  :global([data-mode="dark"]) .cell-label {
    color: var(--color-surface-100);
  }

  .cell-mono {
    font-family: monospace;
    font-size: 0.75rem;
  }

  /* States */
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
    padding: 1rem 1.5rem;
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

  /* Attributes */
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

  @media (max-width: 768px) {
    .panel-content {
      padding: 1rem;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .header-content {
      flex-wrap: wrap;
    }
  }
</style>
