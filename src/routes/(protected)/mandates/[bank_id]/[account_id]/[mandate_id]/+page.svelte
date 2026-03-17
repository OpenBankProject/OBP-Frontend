<script lang="ts">
  import { page } from "$app/state";
  import { FileSignature, ArrowLeft, Loader2, Plus, Users, ScrollText, ExternalLink } from "@lucide/svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import { pageDataSummary } from "$lib/stores/pageDataSummary.svelte";
  import { pageHeading } from "$lib/stores/pageHeading.svelte";

  let bankId = $derived(page.params.bank_id || "");
  let accountId = $derived(page.params.account_id || "");
  let mandateId = $derived(page.params.mandate_id || "");

  // Mandate state
  let mandate = $state<any>(null);
  let mandateLoading = $state(false);
  let mandateError = $state<string | null>(null);

  // Signatory panels state
  let signatoryPanels = $state<any[]>([]);
  let panelsLoading = $state(false);
  let panelsError = $state<string | null>(null);
  let showAddPanel = $state(false);
  let addingPanel = $state(false);
  let addPanelError = $state<string | null>(null);
  let newPanelName = $state("");
  let newPanelDescription = $state("");
  let newPanelUserIds = $state("");

  // Provisions state
  let provisions = $state<any[]>([]);
  let provisionsLoading = $state(false);
  let provisionsError = $state<string | null>(null);
  let showAddProvision = $state(false);
  let addingProvision = $state(false);
  let addProvisionError = $state<string | null>(null);
  let newProvisionName = $state("");
  let newProvisionDescription = $state("");
  let newProvisionLegalRef = $state("");
  let newProvisionType = $state("SIGNATORY_RULE");
  let newProvisionConditions = $state("");
  let newProvisionIsActive = $state(true);
  let newProvisionSortOrder = $state(0);

  function statusBadgeClass(status: string): string {
    if (status === "ACTIVE") return "badge-green";
    return "badge-gray";
  }

  function provisionTypeBadgeClass(type: string): string {
    switch (type) {
      case "SIGNATORY_RULE": return "badge-blue";
      case "VIEW_ASSIGNMENT": return "badge-purple";
      case "ABAC_CONDITION": return "badge-amber";
      case "RESTRICTION": return "badge-red";
      case "NOTIFICATION": return "badge-gray";
      default: return "badge-gray";
    }
  }

  async function loadMandate(bId: string, aId: string, mId: string) {
    mandateLoading = true;
    mandateError = null;
    try {
      const res = await trackedFetch(
        `/api/obp/banks/${encodeURIComponent(bId)}/accounts/${encodeURIComponent(aId)}/mandates/${encodeURIComponent(mId)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load mandate (${res.status})`);
      }
      mandate = await res.json();
      pageDataSummary.set(`Mandate ${mandate.mandate_name} (${mandate.status}) for account ${aId} at bank ${bId}`);
      pageHeading.set(mandate.mandate_name);
    } catch (err) {
      mandateError = err instanceof Error ? err.message : "Failed to load mandate";
    } finally {
      mandateLoading = false;
    }
  }

  async function loadSignatoryPanels(bId: string, mId: string) {
    panelsLoading = true;
    panelsError = null;
    try {
      const res = await trackedFetch(
        `/api/obp/banks/${encodeURIComponent(bId)}/mandates/${encodeURIComponent(mId)}/signatory-panels`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load signatory panels (${res.status})`);
      }
      const json = await res.json();
      signatoryPanels = json.signatory_panels;
    } catch (err) {
      panelsError = err instanceof Error ? err.message : "Failed to load signatory panels";
    } finally {
      panelsLoading = false;
    }
  }

  async function loadProvisions(bId: string, mId: string) {
    provisionsLoading = true;
    provisionsError = null;
    try {
      const res = await trackedFetch(
        `/api/obp/banks/${encodeURIComponent(bId)}/mandates/${encodeURIComponent(mId)}/provisions`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load provisions (${res.status})`);
      }
      const json = await res.json();
      provisions = json.provisions;
    } catch (err) {
      provisionsError = err instanceof Error ? err.message : "Failed to load provisions";
    } finally {
      provisionsLoading = false;
    }
  }

  async function addSignatoryPanel() {
    addingPanel = true;
    addPanelError = null;
    try {
      const userIds = newPanelUserIds.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await trackedFetch(
        `/api/obp/banks/${encodeURIComponent(bankId)}/mandates/${encodeURIComponent(mandateId)}/signatory-panels`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            panel_name: newPanelName.trim(),
            description: newPanelDescription.trim(),
            user_ids: userIds,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create signatory panel");
      }
      const created = await res.json();
      signatoryPanels = [...signatoryPanels, created];
      newPanelName = "";
      newPanelDescription = "";
      newPanelUserIds = "";
      showAddPanel = false;
    } catch (err) {
      addPanelError = err instanceof Error ? err.message : "Failed to create signatory panel";
    } finally {
      addingPanel = false;
    }
  }

  async function addProvision() {
    addingProvision = true;
    addProvisionError = null;
    try {
      const res = await trackedFetch(
        `/api/obp/banks/${encodeURIComponent(bankId)}/mandates/${encodeURIComponent(mandateId)}/provisions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provision_name: newProvisionName.trim(),
            provision_description: newProvisionDescription.trim(),
            legal_reference: newProvisionLegalRef.trim(),
            provision_type: newProvisionType,
            conditions: newProvisionConditions.trim(),
            is_active: newProvisionIsActive,
            sort_order: newProvisionSortOrder,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create provision");
      }
      const created = await res.json();
      provisions = [...provisions, created];
      newProvisionName = "";
      newProvisionDescription = "";
      newProvisionLegalRef = "";
      newProvisionType = "SIGNATORY_RULE";
      newProvisionConditions = "";
      newProvisionIsActive = true;
      newProvisionSortOrder = 0;
      showAddProvision = false;
    } catch (err) {
      addProvisionError = err instanceof Error ? err.message : "Failed to create provision";
    } finally {
      addingProvision = false;
    }
  }

  $effect(() => {
    if (bankId && accountId && mandateId) {
      loadMandate(bankId, accountId, mandateId);
      loadSignatoryPanels(bankId, mandateId);
      loadProvisions(bankId, mandateId);
    }
  });
</script>

<svelte:head>
  <title>{mandate?.mandate_name || "Mandate Detail"} - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb -->
  <nav class="breadcrumb mb-6" data-testid="breadcrumb">
    <a href="/mandates" class="breadcrumb-link">Mandates</a>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">{bankId} / {accountId}</span>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">{mandate?.mandate_name || mandateId}</span>
  </nav>

  {#if mandateLoading}
    <div class="loading-state" data-testid="mandate-loading">
      <Loader2 size={32} class="spinner-icon" />
      <p>Loading mandate...</p>
    </div>
  {:else if mandateError}
    <div class="error-state" data-testid="mandate-error">
      <p class="error-message">{mandateError}</p>
      <a href="/mandates" class="btn-secondary mt-4">
        <ArrowLeft size={16} />
        Back to Mandates
      </a>
    </div>
  {:else if mandate}
    <div class="panel">
      <!-- Header -->
      <div class="panel-header">
        <div class="header-content">
          <div class="header-left">
            <div class="header-icon">
              <FileSignature size={24} />
            </div>
            <div>
              <h1 class="panel-title" data-testid="mandate-title">{mandate.mandate_name}</h1>
              <div class="panel-subtitle">
                {bankId} / {accountId} / {mandateId}
              </div>
            </div>
          </div>
          <div class="header-actions">
            <a
              href="/account-access/accounts/{encodeURIComponent(bankId)}/{encodeURIComponent(accountId)}/owner"
              class="btn-secondary"
              data-testid="view-account-link"
            >
              <ExternalLink size={16} />
              View Account
            </a>
            <a href="/mandates" class="btn-secondary">
              <ArrowLeft size={16} />
              Back
            </a>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="panel-content">
        <!-- Mandate Info -->
        <section class="info-section" data-testid="mandate-info">
          <h2 class="section-title">Mandate Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Mandate Name</div>
              <div class="info-value" data-testid="mandate-name">{mandate.mandate_name}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Mandate Reference</div>
              <div class="info-value code" data-testid="mandate-reference">{mandate.mandate_reference}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Status</div>
              <div class="info-value">
                <span class="status-badge {statusBadgeClass(mandate.status)}" data-testid="mandate-status">{mandate.status}</span>
              </div>
            </div>
            <div class="info-item">
              <div class="info-label">Customer ID</div>
              <div class="info-value code" data-testid="mandate-customer-id">{mandate.customer_id}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Valid From</div>
              <div class="info-value" data-testid="mandate-valid-from">{mandate.valid_from}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Valid To</div>
              <div class="info-value" data-testid="mandate-valid-to">{mandate.valid_to}</div>
            </div>
            {#if mandate.description}
              <div class="info-item info-item-wide">
                <div class="info-label">Description</div>
                <div class="info-value" data-testid="mandate-description">{mandate.description}</div>
              </div>
            {/if}
            {#if mandate.legal_text}
              <div class="info-item info-item-wide">
                <div class="info-label">Legal Text</div>
                <div class="info-value" data-testid="mandate-legal-text">{mandate.legal_text}</div>
              </div>
            {/if}
          </div>
        </section>

        <!-- Signatory Panels -->
        <section class="info-section" data-testid="signatory-panels-section">
          <div class="section-header-row">
            <h2 class="section-title" style="margin-bottom: 0; border-bottom: none; padding-bottom: 0;">
              <Users size={16} />
              Signatory Panels ({signatoryPanels.length})
            </h2>
            <button
              type="button"
              class="btn-add"
              data-testid="add-signatory-panel"
              onclick={() => { showAddPanel = !showAddPanel; addPanelError = null; }}
            >
              <Plus size={14} />
              Add Panel
            </button>
          </div>

          {#if showAddPanel}
            <div class="add-attribute-form" data-testid="add-panel-form">
              {#if addPanelError}
                <div class="attr-error" data-testid="add-panel-error">{addPanelError}</div>
              {/if}
              <div class="form-stack">
                <div class="attr-form-field">
                  <label for="panel-name" class="attr-form-label">Panel Name</label>
                  <input
                    type="text"
                    id="panel-name"
                    name="panel-name"
                    class="attr-form-input"
                    data-testid="panel-name-input"
                    placeholder="e.g. Board Directors"
                    bind:value={newPanelName}
                  />
                </div>
                <div class="attr-form-field">
                  <label for="panel-description" class="attr-form-label">Description</label>
                  <input
                    type="text"
                    id="panel-description"
                    name="panel-description"
                    class="attr-form-input"
                    data-testid="panel-description-input"
                    placeholder="Panel description"
                    bind:value={newPanelDescription}
                  />
                </div>
                <div class="attr-form-field">
                  <label for="panel-user-ids" class="attr-form-label">User IDs (comma-separated)</label>
                  <input
                    type="text"
                    id="panel-user-ids"
                    name="panel-user-ids"
                    class="attr-form-input"
                    data-testid="panel-user-ids-input"
                    placeholder="user-1, user-2, user-3"
                    bind:value={newPanelUserIds}
                  />
                </div>
                <div class="attr-form-actions">
                  <button
                    type="button"
                    class="btn-attr-save"
                    data-testid="save-panel"
                    disabled={!newPanelName.trim() || addingPanel}
                    onclick={addSignatoryPanel}
                  >
                    {#if addingPanel}
                      <Loader2 size={14} class="spinner-icon" />
                    {:else}
                      Save
                    {/if}
                  </button>
                  <button
                    type="button"
                    class="btn-attr-cancel"
                    data-testid="cancel-panel"
                    onclick={() => { showAddPanel = false; addPanelError = null; }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          {/if}

          {#if panelsLoading}
            <div class="loading-state-inline" data-testid="panels-loading">
              <Loader2 size={18} class="spinner-icon" />
              <span>Loading panels...</span>
            </div>
          {:else if panelsError}
            <div class="attr-error" data-testid="panels-error">{panelsError}</div>
          {:else if signatoryPanels.length > 0}
            <div class="cards-list">
              {#each signatoryPanels as panel}
                <div class="card" data-testid="signatory-panel-{panel.panel_id}">
                  <div class="card-header">
                    <h3 class="card-title" data-testid="panel-name-{panel.panel_id}">{panel.panel_name}</h3>
                  </div>
                  {#if panel.description}
                    <p class="card-description" data-testid="panel-description-{panel.panel_id}">{panel.description}</p>
                  {/if}
                  {#if panel.user_ids && panel.user_ids.length > 0}
                    <div class="chips-list">
                      {#each panel.user_ids as userId}
                        <span class="user-chip direct" data-testid="panel-user-{panel.panel_id}-{userId}">{userId}</span>
                      {/each}
                    </div>
                  {:else}
                    <p class="no-attributes">No users assigned</p>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <p class="no-attributes">No signatory panels</p>
          {/if}
        </section>

        <!-- Provisions -->
        <section class="info-section" data-testid="provisions-section">
          <div class="section-header-row">
            <h2 class="section-title" style="margin-bottom: 0; border-bottom: none; padding-bottom: 0;">
              <ScrollText size={16} />
              Provisions ({provisions.length})
            </h2>
            <button
              type="button"
              class="btn-add"
              data-testid="add-provision"
              onclick={() => { showAddProvision = !showAddProvision; addProvisionError = null; }}
            >
              <Plus size={14} />
              Add Provision
            </button>
          </div>

          {#if showAddProvision}
            <div class="add-attribute-form" data-testid="add-provision-form">
              {#if addProvisionError}
                <div class="attr-error" data-testid="add-provision-error">{addProvisionError}</div>
              {/if}
              <div class="form-stack">
                <div class="attr-form-row">
                  <div class="attr-form-field attr-form-field-grow">
                    <label for="provision-name" class="attr-form-label">Provision Name</label>
                    <input
                      type="text"
                      id="provision-name"
                      name="provision-name"
                      class="attr-form-input"
                      data-testid="provision-name-input"
                      placeholder="e.g. Dual Signature Required"
                      bind:value={newProvisionName}
                    />
                  </div>
                  <div class="attr-form-field">
                    <label for="provision-type" class="attr-form-label">Type</label>
                    <select
                      id="provision-type"
                      name="provision-type"
                      class="attr-form-input"
                      data-testid="provision-type-input"
                      bind:value={newProvisionType}
                    >
                      <option value="SIGNATORY_RULE">SIGNATORY_RULE</option>
                      <option value="VIEW_ASSIGNMENT">VIEW_ASSIGNMENT</option>
                      <option value="ABAC_CONDITION">ABAC_CONDITION</option>
                      <option value="RESTRICTION">RESTRICTION</option>
                      <option value="NOTIFICATION">NOTIFICATION</option>
                    </select>
                  </div>
                </div>
                <div class="attr-form-field">
                  <label for="provision-description" class="attr-form-label">Description</label>
                  <input
                    type="text"
                    id="provision-description"
                    name="provision-description"
                    class="attr-form-input"
                    data-testid="provision-description-input"
                    placeholder="Provision description"
                    bind:value={newProvisionDescription}
                  />
                </div>
                <div class="attr-form-field">
                  <label for="provision-legal-ref" class="attr-form-label">Legal Reference</label>
                  <input
                    type="text"
                    id="provision-legal-ref"
                    name="provision-legal-ref"
                    class="attr-form-input"
                    data-testid="provision-legal-ref-input"
                    placeholder="e.g. Section 4.2"
                    bind:value={newProvisionLegalRef}
                  />
                </div>
                <div class="attr-form-field">
                  <label for="provision-conditions" class="attr-form-label">Conditions</label>
                  <input
                    type="text"
                    id="provision-conditions"
                    name="provision-conditions"
                    class="attr-form-input"
                    data-testid="provision-conditions-input"
                    placeholder="Conditions text"
                    bind:value={newProvisionConditions}
                  />
                </div>
                <div class="attr-form-row">
                  <div class="attr-form-field">
                    <label for="provision-sort-order" class="attr-form-label">Sort Order</label>
                    <input
                      type="number"
                      id="provision-sort-order"
                      name="provision-sort-order"
                      class="attr-form-input"
                      data-testid="provision-sort-order-input"
                      bind:value={newProvisionSortOrder}
                    />
                  </div>
                  <div class="attr-form-field">
                    <label class="checkbox-label">
                      <input
                        type="checkbox"
                        name="provision-is-active"
                        data-testid="provision-is-active-input"
                        bind:checked={newProvisionIsActive}
                      />
                      Active
                    </label>
                  </div>
                </div>
                <div class="attr-form-actions">
                  <button
                    type="button"
                    class="btn-attr-save"
                    data-testid="save-provision"
                    disabled={!newProvisionName.trim() || addingProvision}
                    onclick={addProvision}
                  >
                    {#if addingProvision}
                      <Loader2 size={14} class="spinner-icon" />
                    {:else}
                      Save
                    {/if}
                  </button>
                  <button
                    type="button"
                    class="btn-attr-cancel"
                    data-testid="cancel-provision"
                    onclick={() => { showAddProvision = false; addProvisionError = null; }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          {/if}

          {#if provisionsLoading}
            <div class="loading-state-inline" data-testid="provisions-loading">
              <Loader2 size={18} class="spinner-icon" />
              <span>Loading provisions...</span>
            </div>
          {:else if provisionsError}
            <div class="attr-error" data-testid="provisions-error">{provisionsError}</div>
          {:else if provisions.length > 0}
            <div class="cards-list">
              {#each provisions as provision}
                <div class="card" data-testid="provision-{provision.provision_id}">
                  <div class="card-header">
                    <h3 class="card-title" data-testid="provision-name-{provision.provision_id}">{provision.provision_name}</h3>
                    <span class="status-badge {provisionTypeBadgeClass(provision.provision_type)}" data-testid="provision-type-{provision.provision_id}">{provision.provision_type}</span>
                    {#if provision.is_active}
                      <span class="status-badge badge-green" data-testid="provision-active-{provision.provision_id}">ACTIVE</span>
                    {/if}
                  </div>
                  {#if provision.provision_description}
                    <p class="card-description" data-testid="provision-desc-{provision.provision_id}">{provision.provision_description}</p>
                  {/if}
                  <div class="provision-details">
                    {#if provision.legal_reference}
                      <div class="provision-detail">
                        <span class="provision-detail-label">Legal Reference:</span>
                        <span class="provision-detail-value">{provision.legal_reference}</span>
                      </div>
                    {/if}
                    {#if provision.conditions}
                      <div class="provision-detail">
                        <span class="provision-detail-label">Conditions:</span>
                        <span class="provision-detail-value">{provision.conditions}</span>
                      </div>
                    {/if}
                    {#if provision.signatory_requirements && provision.signatory_requirements.length > 0}
                      <div class="provision-detail">
                        <span class="provision-detail-label">Signatory Requirements:</span>
                        <div class="chips-list">
                          {#each provision.signatory_requirements as req}
                            <span class="user-chip direct">Panel {req.panel_id}: {req.required_count} required</span>
                          {/each}
                        </div>
                      </div>
                    {/if}
                    {#if provision.linked_view_id}
                      <div class="provision-detail">
                        <span class="provision-detail-label">Linked View:</span>
                        <span class="provision-detail-value code">{provision.linked_view_id}</span>
                      </div>
                    {/if}
                    {#if provision.linked_abac_rule_id}
                      <div class="provision-detail">
                        <span class="provision-detail-label">Linked ABAC Rule:</span>
                        <span class="provision-detail-value code">{provision.linked_abac_rule_id}</span>
                      </div>
                    {/if}
                    {#if provision.linked_challenge_type}
                      <div class="provision-detail">
                        <span class="provision-detail-label">Challenge Type:</span>
                        <span class="provision-detail-value code">{provision.linked_challenge_type}</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="no-attributes">No provisions</p>
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

  .info-item-wide {
    grid-column: 1 / -1;
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

  .info-value.code,
  .provision-detail-value.code {
    font-family: monospace;
    background: #f3f4f6;
    padding: 0.25rem 0.375rem;
    border-radius: 4px;
    word-break: break-all;
    overflow: hidden;
    font-size: 0.8rem;
  }

  :global([data-mode="dark"]) .info-value.code,
  :global([data-mode="dark"]) .provision-detail-value.code {
    background: rgb(var(--color-surface-900));
  }

  /* Status badges */
  .status-badge {
    display: inline-block;
    font-size: 0.7rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-weight: 600;
  }

  .badge-green {
    background: #d1fae5;
    color: #065f46;
  }

  :global([data-mode="dark"]) .badge-green {
    background: rgba(34, 197, 94, 0.2);
    color: rgb(var(--color-success-300));
  }

  .badge-blue {
    background: #dbeafe;
    color: #1e40af;
  }

  :global([data-mode="dark"]) .badge-blue {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-300));
  }

  .badge-purple {
    background: #ede9fe;
    color: #5b21b6;
  }

  :global([data-mode="dark"]) .badge-purple {
    background: rgba(139, 92, 246, 0.2);
    color: #c4b5fd;
  }

  .badge-amber {
    background: #fef3c7;
    color: #92400e;
  }

  :global([data-mode="dark"]) .badge-amber {
    background: rgba(245, 158, 11, 0.2);
    color: rgb(var(--color-warning-300));
  }

  .badge-red {
    background: #fee2e2;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .badge-red {
    background: rgba(220, 38, 38, 0.2);
    color: rgb(var(--color-error-300));
  }

  .badge-gray {
    background: #e5e7eb;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .badge-gray {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-400);
  }

  /* Cards */
  .cards-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .card {
    padding: 0.75rem 1rem;
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
  }

  :global([data-mode="dark"]) .card {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .card-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .card-title {
    color: var(--color-surface-100);
  }

  .card-description {
    font-size: 0.813rem;
    color: #6b7280;
    margin: 0.375rem 0 0 0;
  }

  :global([data-mode="dark"]) .card-description {
    color: var(--color-surface-400);
  }

  .chips-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.5rem;
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

  /* Provision details */
  .provision-details {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin-top: 0.5rem;
  }

  .provision-detail {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.813rem;
  }

  .provision-detail-label {
    font-weight: 600;
    color: #6b7280;
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .provision-detail-label {
    color: var(--color-surface-400);
  }

  .provision-detail-value {
    color: #111827;
  }

  :global([data-mode="dark"]) .provision-detail-value {
    color: var(--color-surface-200);
  }

  /* Button styles */
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

  /* Form styles */
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

  .form-stack {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.813rem;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    padding-top: 1.25rem;
  }

  :global([data-mode="dark"]) .checkbox-label {
    color: var(--color-surface-200);
  }

  .no-attributes {
    font-size: 0.813rem;
    color: #9ca3af;
    margin: 0.5rem 0 0 0;
  }

  :global([data-mode="dark"]) .no-attributes {
    color: var(--color-surface-500);
  }

  /* Loading / Error states */
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

  .loading-state-inline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 0;
    color: #6b7280;
    font-size: 0.813rem;
  }

  :global([data-mode="dark"]) .loading-state-inline {
    color: var(--color-surface-400);
  }

  .loading-state-inline :global(.spinner-icon) {
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

    .attr-form-row {
      flex-direction: column;
    }
  }
</style>
