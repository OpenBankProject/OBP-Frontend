<script lang="ts">
  import type { PageData } from "./$types";
  import { Eye, ArrowLeft, Shield, Save } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import { currentBank } from "$lib/stores/currentBank.svelte";

  let { data } = $props<{ data: PageData }>();

  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  // Form state
  let formData = $state({
    account_id: "",
    name: "",
    description: "",
    metadata_view: "",
    is_public: false,
    which_alias_to_use: "",
    hide_metadata_if_alias_used: false,
    allowed_actions: [] as string[],
  });

  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);
  let submitSuccess = $state(false);
  let submitAttempted = $state(false);

  // Account search via Account Directory
  let accountSearchQuery = $state("");
  let accountResults = $state<any[]>([]);
  let loadingAccounts = $state(false);
  let showAccountDropdown = $state(false);
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  // Debounced search against account directory
  $effect(() => {
    const query = accountSearchQuery.trim();
    const bankId = currentBank.bankId;

    if (searchTimeout) clearTimeout(searchTimeout);

    if (!bankId || query.length < 2) {
      accountResults = [];
      return;
    }

    searchTimeout = setTimeout(() => {
      searchAccountDirectory(bankId, query);
    }, 300);
  });

  async function searchAccountDirectory(bankId: string, query: string) {
    loadingAccounts = true;
    try {
      const res = await fetch(
        `/api/obp/banks/${encodeURIComponent(bankId)}/account-directory?limit=20`,
      );
      if (res.ok) {
        const data = await res.json();
        const all = data.accounts || [];
        const q = query.toLowerCase();
        accountResults = all.filter(
          (a: any) =>
            a.account_id?.toLowerCase().includes(q) ||
            a.label?.toLowerCase().includes(q) ||
            a.account_number?.toLowerCase().includes(q),
        );
      } else {
        accountResults = [];
      }
    } catch {
      accountResults = [];
    } finally {
      loadingAccounts = false;
    }
  }

  function selectAccount(account: any) {
    formData.account_id = account.account_id;
    accountSearchQuery = account.account_id;
    showAccountDropdown = false;
  }

  function clearAccountSelection() {
    formData.account_id = "";
    accountSearchQuery = "";
    accountResults = [];
  }

  // Permission checkboxes state - driven by API response
  let permissionsByCategory = $derived(data.permissionsByCategory || []);

  // Track which permissions are selected: permission name -> boolean
  let selectedPermissions = $state<Record<string, boolean>>({});

  // Helper functions for bulk selection
  function selectAllInCategory(permissions: string[]) {
    for (const p of permissions) {
      selectedPermissions[p] = true;
    }
  }

  function deselectAllInCategory(permissions: string[]) {
    for (const p of permissions) {
      selectedPermissions[p] = false;
    }
  }

  // Validation
  let validationErrors = $derived.by(() => {
    const errors: string[] = [];
    if (!currentBank.bankId) errors.push("No bank selected — use the bank selector");
    if (!formData.account_id) errors.push("Account is required");
    if (!formData.name || formData.name.trim().length === 0)
      errors.push("Name is required");
    if (!formData.description || formData.description.trim().length === 0)
      errors.push("Description is required");
    return errors;
  });

  let isValid = $derived(validationErrors.length === 0);

  async function handleSubmit(e: Event) {
    e.preventDefault();

    submitAttempted = true;
    if (!isValid || isSubmitting) return;

    isSubmitting = true;
    submitError = null;
    submitSuccess = false;

    try {
      // Build the list of enabled permissions
      const enabledPermissions = Object.entries(selectedPermissions)
        .filter(([, value]) => value)
        .map(([key]) => key);

      // Build the request payload
      const payload: any = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        is_public: formData.is_public,
        metadata_view: formData.metadata_view.trim() || "_0",
        which_alias_to_use: formData.which_alias_to_use.trim(),
        hide_metadata_if_alias_used: formData.hide_metadata_if_alias_used,
        allowed_actions: enabledPermissions,
      };

      // Make the API call
      const response = await fetch(
        `/api/obp/banks/${currentBank.bankId}/accounts/${formData.account_id}/views`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create custom view");
      }

      const result = await response.json();
      submitSuccess = true;

      // Redirect to the new view's detail page after showing success message
      setTimeout(() => {
        goto(`/account-access/custom-views/${result.view_id}`);
      }, 2500);
    } catch (err) {
      submitError =
        err instanceof Error ? err.message : "Failed to create custom view";
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Create Custom View - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb -->
  <nav class="breadcrumb mb-6">
    <a href="/account-access/custom-views" class="breadcrumb-link"
      >Custom Views</a
    >
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">Create</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <Eye size={32} />
          </div>
          <div>
            <h1 class="panel-title">Create Custom View</h1>
            <div class="panel-subtitle">
              Define a new custom view with specific permissions
            </div>
          </div>
        </div>
        <div class="header-actions">
          <a href="/account-access/custom-views" class="btn-secondary">
            <ArrowLeft size={16} />
            Back
          </a>
        </div>
      </div>
    </div>

    <div class="panel-content">
      {#if error}
        <div class="error-message">
          <p>⚠️ {error}</p>
        </div>
      {/if}

      {#if submitError}
        <div class="error-message">
          <p>⚠️ {submitError}</p>
        </div>
      {/if}

      {#if submitSuccess}
        <div class="success-message">
          <div
            style="display: flex; align-items: center; gap: 0.75rem; font-size: 1.1rem;"
          >
            <svg
              style="width: 24px; height: 24px; color: #10b981;"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <span
              ><strong>Success!</strong> Custom view created successfully. Redirecting
              to view details...</span
            >
          </div>
        </div>
      {/if}

      {#if !hasApiAccess}
        <div class="error-message">
          <p>⚠️ No API access available. Please authenticate first.</p>
        </div>
      {:else}
        <form onsubmit={handleSubmit} class="form">
          <!-- Basic Information Section -->
          <section class="form-section">
            <h2 class="section-title">
              <Shield size={20} />
              Basic Information
            </h2>

            <div class="form-grid">
              <div class="form-group">
                <label for="account_search" class="form-label">
                  Account <span class="required">*</span>
                </label>
                {#if formData.account_id}
                  <div class="selected-account" data-testid="selected-account">
                    <span class="selected-account-id">{formData.account_id}</span>
                    <button type="button" class="clear-btn" onclick={clearAccountSelection} data-testid="clear-account">
                      &times;
                    </button>
                  </div>
                {:else}
                  <div class="account-search-wrapper">
                    <input
                      type="text"
                      id="account_search"
                      class="form-input"
                      name="account_search"
                      data-testid="account-search"
                      placeholder={currentBank.bankId ? "Type to search accounts..." : "Select a bank first"}
                      disabled={!currentBank.bankId}
                      bind:value={accountSearchQuery}
                      onfocus={() => showAccountDropdown = true}
                      onblur={() => setTimeout(() => showAccountDropdown = false, 200)}
                    />
                    {#if loadingAccounts}
                      <span class="search-spinner">...</span>
                    {/if}
                    {#if showAccountDropdown && accountResults.length > 0}
                      <ul class="account-results" data-testid="account-results">
                        {#each accountResults as account}
                          <li>
                            <button
                              type="button"
                              class="account-result-item"
                              data-testid="account-option-{account.account_id}"
                              onmousedown={() => selectAccount(account)}
                            >
                              <span class="result-id">{account.account_id}</span>
                              {#if account.label}
                                <span class="result-label">{account.label}</span>
                              {/if}
                            </button>
                          </li>
                        {/each}
                      </ul>
                    {:else if showAccountDropdown && accountSearchQuery.length >= 2 && !loadingAccounts}
                      <div class="account-results no-results-msg">No accounts found</div>
                    {/if}
                  </div>
                {/if}
              </div>

              <div class="form-group">
                <label for="metadata_view" class="form-label">
                  Metadata View
                </label>
                <input
                  type="text"
                  id="metadata_view"
                  class="form-input"
                  bind:value={formData.metadata_view}
                  placeholder="_0 (default)"
                />
                <p class="form-help">
                  Leave empty for default metadata view (_0)
                </p>
              </div>

              <div class="form-group full-width">
                <label for="name" class="form-label">
                  Name <span class="required">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  class="form-input"
                  bind:value={formData.name}
                  placeholder="e.g., Customer View, Auditor View"
                  required
                />
              </div>

              <div class="form-group full-width">
                <label for="description" class="form-label">
                  Description <span class="required">*</span>
                </label>
                <textarea
                  id="description"
                  class="form-textarea"
                  bind:value={formData.description}
                  placeholder="Describe the purpose of this custom view..."
                  rows="3"
                  required
                ></textarea>
              </div>

              <div class="form-group">
                <label for="which_alias_to_use" class="form-label">
                  Which Alias to Use
                </label>
                <input
                  type="text"
                  id="which_alias_to_use"
                  class="form-input"
                  bind:value={formData.which_alias_to_use}
                  placeholder="e.g., public, private"
                />
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    class="form-checkbox"
                    bind:checked={formData.is_public}
                  />
                  <span>Public View</span>
                </label>
                <p class="form-help">Make this view accessible to all users</p>
              </div>

              <div class="form-group full-width">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    class="form-checkbox"
                    bind:checked={formData.hide_metadata_if_alias_used}
                  />
                  <span>Hide Metadata if Alias Used</span>
                </label>
              </div>
            </div>
          </section>

          <!-- Permissions Sections (from API) -->
          {#each permissionsByCategory as group}
            <section class="form-section">
              <div class="section-header">
                <h2 class="section-title">
                  <Shield size={20} />
                  {group.category} Permissions
                </h2>
                <div class="section-actions">
                  <button
                    type="button"
                    class="btn-link"
                    onclick={() => selectAllInCategory(group.permissions)}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    class="btn-link"
                    onclick={() => deselectAllInCategory(group.permissions)}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div class="permissions-grid">
                {#each group.permissions as permission}
                  <label class="permission-checkbox">
                    <input
                      type="checkbox"
                      bind:checked={selectedPermissions[permission]}
                    />
                    <span>{permission}</span>
                  </label>
                {/each}
              </div>
            </section>
          {/each}

          {#if permissionsByCategory.length === 0}
            <div class="error-message">
              <p>Could not load available permissions from the API.</p>
            </div>
          {/if}

          <!-- Validation Errors -->
          {#if submitAttempted && validationErrors.length > 0}
            <div class="validation-errors">
              <h3>Please fix the following errors:</h3>
              <ul>
                {#each validationErrors as error}
                  <li>{error}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <!-- Form Actions -->
          <div class="form-actions">
            {#if !isValid && validationErrors.length > 0}
              <div class="form-status" data-testid="form-status">
                Missing: {validationErrors.join(", ")}
              </div>
            {/if}
            <button
              type="submit"
              class="btn-primary"
              data-testid="submit-create-view"
              disabled={!isValid || isSubmitting}
            >
              {#if isSubmitting}
                <span class="spinner">⏳</span>
                Creating View...
              {:else if submitSuccess}
                <svg
                  style="width: 18px; height: 18px;"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
                Created Successfully
              {:else}
                <Save size={18} />
                Create Custom View
              {/if}
            </button>
            <a href="/account-access/custom-views" class="btn-secondary">
              Cancel
            </a>
          </div>
        </form>
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1400px;
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
    transition: color 0.2s;
  }

  .breadcrumb-link:hover {
    color: #2563eb;
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
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
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
    width: 64px;
    height: 64px;
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

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.2s;
    cursor: pointer;
  }

  .btn-secondary:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  :global([data-mode="dark"]) .btn-secondary {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
    border-color: rgb(var(--color-surface-600));
  }

  :global([data-mode="dark"]) .btn-secondary:hover {
    background: rgb(var(--color-surface-600));
  }

  .panel-content {
    padding: 2rem;
  }

  .error-message {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #991b1b;
    font-size: 0.875rem;
  }

  :global([data-mode="dark"]) .error-message {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: rgb(var(--color-error-200));
  }

  .success-message {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #d1fae5;
    border: 1px solid #a7f3d0;
    border-radius: 6px;
    color: #065f46;
    font-size: 0.875rem;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .success-message {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.4);
    color: rgb(var(--color-success-200));
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .form-section {
    padding-bottom: 2rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .form-section:last-child {
    border-bottom: none;
  }

  :global([data-mode="dark"]) .form-section {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  :global([data-mode="dark"]) .section-title {
    color: var(--color-surface-100);
  }

  .section-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-link {
    background: none;
    border: none;
    color: #3b82f6;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    transition: color 0.2s;
  }

  .btn-link:hover {
    color: #2563eb;
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .btn-link {
    color: rgb(var(--color-primary-400));
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group.full-width {
    grid-column: 1 / -1;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  :global([data-mode="dark"]) .form-label {
    color: var(--color-surface-200);
  }

  .required {
    color: #ef4444;
  }

  .form-input,
  .form-select,
  .form-textarea {
    padding: 0.625rem 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
    background: white;
    color: #111827;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  :global([data-mode="dark"]) .form-input,
  :global([data-mode="dark"]) .form-select,
  :global([data-mode="dark"]) .form-textarea {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .form-input:focus,
  :global([data-mode="dark"]) .form-select:focus,
  :global([data-mode="dark"]) .form-textarea:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .form-textarea {
    resize: vertical;
    font-family: inherit;
  }

  .form-help {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0;
  }

  :global([data-mode="dark"]) .form-help {
    color: var(--color-surface-400);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
  }

  :global([data-mode="dark"]) .checkbox-label {
    color: var(--color-surface-200);
  }

  .form-checkbox {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
  }

  .permissions-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .permission-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .permission-checkbox:hover {
    background: #f3f4f6;
    border-color: #3b82f6;
  }

  :global([data-mode="dark"]) .permission-checkbox {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
  }

  :global([data-mode="dark"]) .permission-checkbox:hover {
    background: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-primary-500));
  }

  .permission-checkbox input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
  }

  .alert-warning {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #fef3c7;
    border: 1px solid #fbbf24;
    border-radius: 6px;
    color: #92400e;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  :global([data-mode="dark"]) .alert-warning {
    background: rgba(251, 191, 36, 0.2);
    border-color: rgba(251, 191, 36, 0.4);
    color: rgb(var(--color-warning-200));
  }

  .validation-errors {
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .validation-errors {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: rgb(var(--color-error-200));
  }

  .validation-errors h3 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .validation-errors ul {
    margin: 0;
    padding-left: 1.5rem;
    font-size: 0.875rem;
  }

  .validation-errors li {
    margin: 0.25rem 0;
  }

  .form-status {
    font-size: 0.813rem;
    color: #b45309;
    padding: 0.5rem 0;
  }

  :global([data-mode="dark"]) .form-status {
    color: #fbbf24;
  }

  .account-search-wrapper {
    position: relative;
  }

  .search-spinner {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    font-size: 0.75rem;
  }

  .account-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 10;
    background: white;
    border: 1px solid #d1d5db;
    border-top: none;
    border-radius: 0 0 6px 6px;
    max-height: 240px;
    overflow-y: auto;
    list-style: none;
    margin: 0;
    padding: 0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  :global([data-mode="dark"]) .account-results {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
  }

  .account-results.no-results-msg {
    padding: 0.75rem;
    font-size: 0.813rem;
    color: #6b7280;
    text-align: center;
  }

  .account-result-item {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    text-align: left;
    background: none;
    border: none;
    border-bottom: 1px solid #f3f4f6;
    cursor: pointer;
    font-size: 0.813rem;
  }

  .account-result-item:hover {
    background: #f3f4f6;
  }

  :global([data-mode="dark"]) .account-result-item {
    border-bottom-color: rgb(var(--color-surface-600));
  }

  :global([data-mode="dark"]) .account-result-item:hover {
    background: rgb(var(--color-surface-600));
  }

  .result-id {
    font-family: monospace;
    font-weight: 500;
    color: #111827;
  }

  :global([data-mode="dark"]) .result-id {
    color: var(--color-surface-100);
  }

  .result-label {
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .result-label {
    color: var(--color-surface-400);
  }

  .selected-account {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 6px;
  }

  :global([data-mode="dark"]) .selected-account {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
  }

  .selected-account-id {
    font-family: monospace;
    font-weight: 500;
    font-size: 0.875rem;
    color: #111827;
    flex: 1;
  }

  :global([data-mode="dark"]) .selected-account-id {
    color: var(--color-surface-100);
  }

  .clear-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    line-height: 1;
    color: #6b7280;
    cursor: pointer;
    padding: 0 0.25rem;
  }

  .clear-btn:hover {
    color: #111827;
  }

  :global([data-mode="dark"]) .clear-btn:hover {
    color: var(--color-surface-100);
  }

  .form-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .form-actions {
    border-top-color: rgb(var(--color-surface-700));
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .btn-primary:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-primary {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-primary:hover:not(:disabled) {
    background: rgb(var(--color-primary-500));
  }

  .spinner {
    display: inline-block;
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

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .header-left {
      width: 100%;
    }

    .header-actions {
      width: 100%;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }

    .permissions-grid {
      grid-template-columns: 1fr;
    }

    .section-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
  }
</style>
