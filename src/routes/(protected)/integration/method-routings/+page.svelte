<script lang="ts">
  import { onMount, tick } from "svelte";

  interface MethodRouting {
    method_routing_id?: string;
    method_name: string;
    connector_name: string;
    is_bank_id_exact_match: boolean;
    bank_id_pattern?: string;
    parameters?: string;
  }

  let methodRoutings = $state<MethodRouting[]>([]);
  let methodNames = $state<string[]>([]);
  let connectorNames = $state<string[]>([]);
  let bankIds = $state<string[]>([]);
  let viewMode = $state<"active" | "configured">("active");
  let isLoading = $state(false);
  let isLoadingMethodNames = $state(false);
  let isLoadingConnectors = $state(false);
  let error = $state<string | null>(null);
  let successMessage = $state<string | null>(null);
  let showCreateForm = $state(false);
  let editingRouting = $state<MethodRouting | null>(null);
  let formPanel = $state<HTMLElement | null>(null);

  const jsonPlaceholder = '{"param1": "value1", "param2": "value2"}';

  async function scrollToForm() {
    await tick();
    formPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Form state
  let formData = $state<MethodRouting>({
    method_name: "",
    connector_name: "",
    is_bank_id_exact_match: false,
    bank_id_pattern: "",
    parameters: "",
  });

  async function fetchMethodRoutings() {
    try {
      isLoading = true;
      error = null;

      const queryParams = viewMode === "active" ? "?active=true" : "";
      const response = await fetch(`/backend/integration/method-routings${queryParams}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message;
        throw new Error(
          `Failed to fetch method routings (${response.status}): ${errorMsg}`,
        );
      }

      const data = await response.json();

      console.log("=== METHOD ROUTINGS DATA ===");
      console.log("Data:", data);

      methodRoutings = Array.isArray(data)
        ? data
        : data.method_routings || data.items || [];
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to fetch method routings";
      console.error("Error fetching method routings:", err);
    } finally {
      isLoading = false;
    }
  }

  async function fetchMethodNames() {
    try {
      isLoadingMethodNames = true;

      const response = await fetch("/proxy/obp/v6.0.0/system/connector-method-names");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message;
        throw new Error(
          `Failed to fetch method names (${response.status}): ${errorMsg}`,
        );
      }

      const data = await response.json();

      methodNames = Array.isArray(data)
        ? data
        : data.method_names || data.connector_method_names || [];
    } catch (err) {
      console.error("Error fetching method names:", err);
    } finally {
      isLoadingMethodNames = false;
    }
  }

  async function fetchConnectorNames() {
    try {
      isLoadingConnectors = true;

      const response = await fetch("/backend/system/connectors");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message;
        console.error(`Failed to fetch connectors (${response.status}): ${errorMsg}`);
        return;
      }

      const data = await response.json();

      connectorNames = Array.isArray(data)
        ? data
        : data.connector_names || [];
    } catch (err) {
      console.error("Error fetching connector names:", err);
    } finally {
      isLoadingConnectors = false;
    }
  }

  async function fetchBankIds() {
    try {
      const response = await fetch("/proxy/obp/v6.0.0/banks");

      if (!response.ok) {
        console.error(`Failed to fetch banks (${response.status})`);
        return;
      }

      const data = await response.json();
      const banks = Array.isArray(data) ? data : data.banks || [];

      // Extract just the bank_id values
      bankIds = banks
        .map((b: { bank_id?: string }) => b.bank_id)
        .filter((id: string | undefined): id is string => !!id)
        .sort();
    } catch (err) {
      console.error("Error fetching bank IDs:", err);
    }
  }

  async function createMethodRouting() {
    try {
      isLoading = true;
      error = null;
      successMessage = null;

      const response = await fetch("/backend/integration/method-routings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message);
      }

      successMessage = "Method routing created successfully";
      showCreateForm = false;
      resetForm();
      await fetchMethodRoutings();
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to create method routing";
      console.error("Error creating method routing:", err);
    } finally {
      isLoading = false;
    }
  }

  async function updateMethodRouting() {
    try {
      isLoading = true;
      error = null;
      successMessage = null;

      const response = await fetch("/backend/integration/method-routings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message);
      }

      successMessage = "Method routing updated successfully";
      editingRouting = null;
      resetForm();
      await fetchMethodRoutings();
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to update method routing";
      console.error("Error updating method routing:", err);
    } finally {
      isLoading = false;
    }
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    if (editingRouting) {
      updateMethodRouting();
    } else {
      createMethodRouting();
    }
  }

  function startEdit(routing: MethodRouting) {
    editingRouting = routing;
    // Convert parameters from OBP array format [{key, value}] back to JSON object string for the form
    let parametersStr = "";
    const params = routing.parameters as unknown;
    if (Array.isArray(params) && params.length > 0) {
      const obj: Record<string, string> = {};
      for (const p of params) {
        if (p && typeof p === "object" && "key" in p && "value" in p) {
          obj[p.key] = p.value;
        }
      }
      parametersStr = JSON.stringify(obj, null, 2);
    } else if (typeof params === "string" && params.trim()) {
      parametersStr = params;
    }
    formData = { ...routing, parameters: parametersStr };
    showCreateForm = true;
    if (methodNames.length === 0) {
      fetchMethodNames();
    }
    scrollToForm();
  }

  function startOverride(routing: MethodRouting) {
    // Pre-fill the create form with the default routing's values (no method_routing_id — this will be a new custom routing)
    editingRouting = null;
    let parametersStr = "";
    const params = routing.parameters as unknown;
    if (Array.isArray(params) && params.length > 0) {
      const obj: Record<string, string> = {};
      for (const p of params) {
        if (p && typeof p === "object" && "key" in p && "value" in p) {
          obj[p.key] = p.value;
        }
      }
      parametersStr = JSON.stringify(obj, null, 2);
    } else if (typeof params === "string" && params.trim()) {
      parametersStr = params;
    }
    formData = {
      method_name: routing.method_name,
      connector_name: routing.connector_name,
      is_bank_id_exact_match: routing.is_bank_id_exact_match,
      bank_id_pattern: routing.bank_id_pattern,
      parameters: parametersStr,
    };
    showCreateForm = true;
    clearMessages();
    if (methodNames.length === 0) {
      fetchMethodNames();
    }
    scrollToForm();
  }

  function startCreate() {
    showCreateForm = true;
    clearMessages();
    if (methodNames.length === 0) {
      fetchMethodNames();
    }
  }

  function cancelForm() {
    showCreateForm = false;
    editingRouting = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      method_name: "",
      connector_name: "",
      is_bank_id_exact_match: false,
      bank_id_pattern: "",
      parameters: "",
    };
  }

  function clearMessages() {
    error = null;
    successMessage = null;
  }

  function switchViewMode(mode: "active" | "configured") {
    viewMode = mode;
    fetchMethodRoutings();
  }

  function isDefaultRouting(routing: MethodRouting): boolean {
    return !routing.method_routing_id || routing.method_routing_id === "";
  }

  onMount(() => {
    fetchMethodRoutings();
    fetchMethodNames();
    fetchConnectorNames();
    fetchBankIds();
  });
</script>

<svelte:head>
  <title>Method Routings - Integration - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="header mb-6">
    <div>
      <h1 class="text-2xl font-bold">Method Routings</h1>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Manage method routing configurations for the OBP API
      </p>
    </div>
    {#if !showCreateForm}
      <button
        onclick={startCreate}
        class="btn btn-primary"
        disabled={isLoading}
      >
        Create Method Routing
      </button>
    {/if}
  </div>

  <!-- Messages -->
  {#if error}
    <div class="alert alert-error mb-6">
      <strong>Error:</strong>
      {error}
      <button onclick={clearMessages} class="alert-close">×</button>
    </div>
  {/if}

  {#if successMessage}
    <div class="alert alert-success mb-6">
      <strong>Success:</strong>
      {successMessage}
      <button onclick={clearMessages} class="alert-close">×</button>
    </div>
  {/if}

  <!-- Create/Edit Form -->
  {#if showCreateForm}
    <div class="panel mb-6" bind:this={formPanel}>
      <div class="panel-header">
        <h2 class="panel-title">
          {editingRouting ? "Edit Method Routing" : formData.method_name ? "Override Method Routing" : "Create Method Routing"}
        </h2>
      </div>
      <div class="panel-content">
        <form onsubmit={handleSubmit}>
          <div class="form-grid">
            <div class="form-group">
              <label for="method_name" class="form-label">
                Method Name <span class="required">*</span>
              </label>
              {#if isLoadingMethodNames}
                <div class="loading-text">Loading method names...</div>
              {:else if methodNames.length > 0}
                <select
                  id="method_name"
                  bind:value={formData.method_name}
                  class="form-input"
                  required
                >
                  <option value="">Select a method name</option>
                  {#each methodNames as methodName}
                    <option value={methodName}>{methodName}</option>
                  {/each}
                </select>
              {:else}
                <input
                  type="text"
                  id="method_name"
                  bind:value={formData.method_name}
                  class="form-input"
                  placeholder="e.g., getBank"
                  required
                />
              {/if}
            </div>

            <div class="form-group">
              <label for="connector_name" class="form-label">
                Connector Name <span class="required">*</span>
              </label>
              {#if isLoadingConnectors}
                <div class="loading-text">Loading connectors...</div>
              {:else if connectorNames.length > 0}
                <select
                  id="connector_name"
                  bind:value={formData.connector_name}
                  class="form-input"
                  required
                >
                  <option value="">Select a connector</option>
                  {#each connectorNames as connectorName}
                    <option value={connectorName}>{connectorName}</option>
                  {/each}
                </select>
              {:else}
                <input
                  type="text"
                  id="connector_name"
                  bind:value={formData.connector_name}
                  class="form-input"
                  placeholder="e.g., rest_vMar2019"
                  required
                />
              {/if}
            </div>

            <div class="form-group">
              <label for="bank_id_pattern" class="form-label">
                Bank ID Pattern
              </label>
              <input
                type="text"
                id="bank_id_pattern"
                bind:value={formData.bank_id_pattern}
                class="form-input"
                placeholder="e.g., gh.29.uk or .* for all"
                list="bank-ids-list"
              />
              <datalist id="bank-ids-list">
                {#each bankIds as bankId}
                  <option value={bankId}></option>
                {/each}
              </datalist>
              <div class="form-hint">Type a bank ID or pattern (e.g., .* for all banks)</div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <input
                  type="checkbox"
                  bind:checked={formData.is_bank_id_exact_match}
                  class="form-checkbox"
                />
                Is Bank ID Exact Match
              </label>
            </div>

            <div class="form-group full-width">
              <label for="parameters" class="form-label"
                >Parameters (JSON)</label
              >
              <textarea
                id="parameters"
                bind:value={formData.parameters}
                class="form-textarea"
                rows="4"
                placeholder={jsonPlaceholder}
              ></textarea>
              <div class="form-hint">Optional key-value pairs as JSON object, e.g., {"{"}"key1": "value1", "key2": "value2"{"}"}</div>
            </div>
          </div>

          <div class="form-actions">
            <button
              type="button"
              onclick={cancelForm}
              class="btn btn-secondary"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" disabled={isLoading}>
              {isLoading ? "Saving..." : editingRouting ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Method Routings List -->
  <div class="panel">
    <div class="panel-header panel-header-with-actions">
      <h2 class="panel-title">Method Routings List</h2>
      <div class="view-toggle">
        <button
          onclick={() => switchViewMode("active")}
          class="btn {viewMode === 'active' ? 'btn-toggle-active' : 'btn-toggle-inactive'}"
          disabled={isLoading}
        >
          Active
        </button>
        <button
          onclick={() => switchViewMode("configured")}
          class="btn {viewMode === 'configured' ? 'btn-toggle-active' : 'btn-toggle-inactive'}"
          disabled={isLoading}
        >
          Configured
        </button>
      </div>
    </div>
    <div class="panel-content">
      {#if isLoading && methodRoutings.length === 0}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading method routings...</p>
        </div>
      {:else if methodRoutings.length > 0}
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Method Name</th>
                <th>Connector Name</th>
                <th>Bank ID Pattern</th>
                <th>Exact Match</th>
                {#if viewMode === "active"}
                  <th>Source</th>
                {/if}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each methodRoutings as routing}
                <tr class={isDefaultRouting(routing) ? "row-default" : ""}>
                  <td class="font-mono text-sm {isDefaultRouting(routing) ? '' : 'method-name-custom'}">{routing.method_name}</td>
                  <td>
                    <span class="badge {routing.connector_name === 'mapped' ? 'badge-connector-mapped' : 'badge-connector-custom'}">
                      {routing.connector_name}
                    </span>
                  </td>
                  <td class="font-mono text-sm">
                    {routing.bank_id_pattern || "N/A"}
                  </td>
                  <td>
                    <span
                      class="badge {routing.is_bank_id_exact_match
                        ? 'badge-success'
                        : 'badge-default'}"
                    >
                      {routing.is_bank_id_exact_match ? "Yes" : "No"}
                    </span>
                  </td>
                  {#if viewMode === "active"}
                    <td>
                      <span class="badge {isDefaultRouting(routing) ? 'badge-default' : 'badge-custom'}">
                        {isDefaultRouting(routing) ? "Default" : "Custom"}
                      </span>
                    </td>
                  {/if}
                  <td>
                    {#if isDefaultRouting(routing)}
                      <button
                        onclick={() => startOverride(routing)}
                        class="btn-icon"
                        data-testid="override-{routing.method_name}"
                        disabled={isLoading}
                      >
                        Override
                      </button>
                    {:else}
                      <button
                        onclick={() => startEdit(routing)}
                        class="btn-icon"
                        data-testid="edit-{routing.method_name}"
                        disabled={isLoading}
                      >
                        Edit
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          {#if viewMode === "active"}
            {@const customCount = methodRoutings.filter((r) => !isDefaultRouting(r)).length}
            {@const defaultCount = methodRoutings.filter((r) => isDefaultRouting(r)).length}
            Showing {methodRoutings.length} active method routing{methodRoutings.length !== 1 ? "s" : ""} ({customCount} custom, {defaultCount} default)
          {:else}
            Showing {methodRoutings.length} method routing{methodRoutings.length !== 1 ? "s" : ""}
          {/if}
        </div>
      {:else}
        <div class="empty-state">
          <p>No method routings found</p>
          <button onclick={startCreate} class="btn btn-primary mt-4">
            Create Your First Method Routing
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1600px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
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

  .panel-header-with-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .view-toggle {
    display: flex;
    gap: 0;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    overflow: hidden;
  }

  .btn-toggle-active {
    background: #3b82f6;
    color: white;
    border-radius: 0;
  }

  .btn-toggle-inactive {
    background: white;
    color: #374151;
    border-radius: 0;
  }

  .btn-toggle-inactive:hover:not(:disabled) {
    background: #f3f4f6;
  }

  :global([data-mode="dark"]) .view-toggle {
    border-color: rgb(var(--color-surface-600));
  }

  :global([data-mode="dark"]) .btn-toggle-active {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-toggle-inactive {
    background: rgb(var(--color-surface-800));
    color: var(--color-surface-300);
  }

  :global([data-mode="dark"]) .btn-toggle-inactive:hover:not(:disabled) {
    background: rgb(var(--color-surface-700));
  }

  .panel-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-content {
    padding: 1.5rem;
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
    font-weight: 500;
    color: #374151;
  }

  :global([data-mode="dark"]) .form-label {
    color: var(--color-surface-300);
  }

  .required {
    color: #ef4444;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background: white;
    color: #111827;
  }

  :global([data-mode="dark"]) .form-input,
  :global([data-mode="dark"]) .form-textarea {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    ring: 2px;
    ring-color: rgba(59, 130, 246, 0.2);
  }

  .form-checkbox {
    width: 1rem;
    height: 1rem;
    margin-right: 0.5rem;
  }

  .form-input option,
  .form-select option {
    background: white;
    color: #111827;
  }

  :global([data-mode="dark"]) .form-input option,
  :global([data-mode="dark"]) .form-select option {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-100);
  }

  .loading-text {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: #6b7280;
    font-style: italic;
  }

  :global([data-mode="dark"]) .loading-text {
    color: var(--color-surface-400);
  }

  .form-hint {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .form-hint {
    color: var(--color-surface-400);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  :global([data-mode="dark"]) .btn-primary {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-primary:hover:not(:disabled) {
    background: rgb(var(--color-primary-500));
  }

  .btn-secondary {
    background: #6b7280;
    color: white;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #4b5563;
  }

  .btn-icon {
    padding: 0.625rem 1.5rem;
    font-size: 0.8125rem;
    background: transparent;
    color: #3b82f6;
    border: 1px solid #3b82f6;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-icon:hover:not(:disabled) {
    background: #3b82f6;
    color: white;
  }

  :global([data-mode="dark"]) .btn-icon {
    color: rgb(var(--color-primary-400));
    border-color: rgb(var(--color-primary-400));
  }

  :global([data-mode="dark"]) .btn-icon:hover:not(:disabled) {
    background: rgb(var(--color-primary-400));
    color: rgb(var(--color-surface-900));
  }

  .table-wrapper {
    overflow-x: auto;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
  }

  :global([data-mode="dark"]) .table-wrapper {
    border-color: rgb(var(--color-surface-700));
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
  }

  .data-table th {
    text-align: left;
    padding: 0.75rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
    background: #f9fafb;
    border-bottom: 2px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .data-table th {
    color: var(--color-surface-300);
    background: rgb(var(--color-surface-700));
    border-bottom-color: rgb(var(--color-surface-600));
  }

  .data-table td {
    padding: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.875rem;
    color: #111827;
  }

  :global([data-mode="dark"]) .data-table td {
    border-bottom-color: rgb(var(--color-surface-700));
    color: var(--color-surface-100);
  }

  .data-table tbody tr:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .data-table tbody tr:hover {
    background: rgb(var(--color-surface-700));
  }

  .data-table tbody tr:last-child td {
    border-bottom: none;
  }

  .table-footer {
    padding: 0.75rem;
    font-size: 0.875rem;
    color: #6b7280;
    text-align: right;
  }

  :global([data-mode="dark"]) .table-footer {
    color: var(--color-surface-400);
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .badge-success {
    background: #d1fae5;
    color: #065f46;
  }

  :global([data-mode="dark"]) .badge-success {
    background: rgb(var(--color-success-900));
    color: rgb(var(--color-success-200));
  }

  .badge-default {
    background: #e5e7eb;
    color: #374151;
  }

  :global([data-mode="dark"]) .badge-default {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-300);
  }

  .badge-custom {
    background: #fff7ed;
    color: #9a3412;
    border: 1px solid #fdba74;
  }

  :global([data-mode="dark"]) .badge-custom {
    background: #431407;
    color: #fed7aa;
    border-color: #9a3412;
  }

  .badge-connector-mapped {
    background: #e5e7eb;
    color: #374151;
  }

  :global([data-mode="dark"]) .badge-connector-mapped {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-300);
  }

  .badge-connector-custom {
    background: #f3e8ff;
    color: #6b21a8;
    border: 1px solid #c084fc;
  }

  :global([data-mode="dark"]) .badge-connector-custom {
    background: #3b0764;
    color: #e9d5ff;
    border-color: #7e22ce;
  }

  .method-name-custom {
    color: #2563eb;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .method-name-custom {
    color: rgb(var(--color-primary-400));
  }

  .row-default {
    opacity: 0.75;
  }

  .alert {
    padding: 1rem;
    border-radius: 0.375rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .alert-error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  :global([data-mode="dark"]) .alert-error {
    background: rgb(var(--color-error-900));
    color: rgb(var(--color-error-200));
    border-color: rgb(var(--color-error-800));
  }

  .alert-success {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }

  :global([data-mode="dark"]) .alert-success {
    background: rgb(var(--color-success-900));
    color: rgb(var(--color-success-200));
    border-color: rgb(var(--color-success-800));
  }

  .alert-info {
    background: #dbeafe;
    color: #1e40af;
    border: 1px solid #bfdbfe;
  }

  :global([data-mode="dark"]) .alert-info {
    background: rgba(59, 130, 246, 0.15);
    color: #93c5fd;
    border-color: rgba(59, 130, 246, 0.3);
  }

  .alert-close {
    background: transparent;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
  }

  .alert-close:hover {
    opacity: 1;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  :global([data-mode="dark"]) .spinner {
    border-color: rgb(var(--color-surface-700));
    border-top-color: rgb(var(--color-primary-400));
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
  }

  @media (max-width: 768px) {
    .header {
      flex-direction: column;
      align-items: stretch;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
