<script lang="ts">
  import type { PageData } from "./$types";
  import {
    Search,
    CheckCircle,
    XCircle,
    Clock,
    User,
    Calendar,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
  } from "@lucide/svelte";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import { goto, invalidateAll } from "$app/navigation";

  interface EntitlementRequest {
    entitlement_request_id: string;
    user: {
      user_id: string;
      username: string;
      email: string;
    };
    role_name: string;
    bank_id?: string;
    created: string;
  }

  let { data } = $props<{ data: PageData }>();

  let entitlementRequests = $derived(data.entitlementRequests || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);
  let limit = $derived(data.limit || 50);
  let offset = $derived(data.offset || 0);
  let hasNextPage = $derived(entitlementRequests.length >= limit);
  let hasPreviousPage = $derived(offset > 0);
  // Search state
  let searchQuery = $state("");

  // Sort state
  let sortOption = $state("newest");

  // Filter requests based on search query
  let filteredRequests = $derived.by(() => {
    let results = entitlementRequests;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().replace(/\s+/g, "");
      results = results.filter(
        (request: EntitlementRequest) =>
          request.role_name.toLowerCase().includes(query) ||
          request.user.username.toLowerCase().includes(query) ||
          request.user.email.toLowerCase().includes(query) ||
          (request.bank_id && request.bank_id.toLowerCase().includes(query)),
      );
    }

    // Sort
    const sorted = [...results];
    switch (sortOption) {
      case "newest":
        sorted.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
        break;
      case "oldest":
        sorted.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
        break;
      case "role_asc":
        sorted.sort((a, b) => a.role_name.localeCompare(b.role_name));
        break;
      case "username":
        sorted.sort((a, b) => a.user.username.localeCompare(b.user.username));
        break;
    }
    return sorted;
  });

  // Pagination
  function nextPage() {
    const newOffset = offset + limit;
    goto(`?limit=${limit}&offset=${newOffset}&sort_direction=DESC`);
  }

  function previousPage() {
    const newOffset = Math.max(0, offset - limit);
    goto(`?limit=${limit}&offset=${newOffset}&sort_direction=DESC`);
  }

  // Helper function to format date
  function formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    } catch {
      return dateString;
    }
  }

  let userId = $derived((data.userId as string) || "");

  // from_date for the per-user Metrics link: 10 years ago (a very wide span),
  // in the datetime-local format (yyyy-MM-ddTHH:mm) the metrics query form expects.
  const metricsFromDate = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  const GROUP_COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#ec4899','#06b6d4'];
  let requestColors = $derived.by(() => {
    const result: string[] = [];
    let colorIdx = -1;
    let prevId = '';
    for (const req of filteredRequests) {
      const id = req.user.user_id;
      if (id === userId) {
        result.push('');
      } else {
        if (id !== prevId) colorIdx++;
        result.push(GROUP_COLORS[colorIdx % GROUP_COLORS.length]);
        prevId = id;
      }
    }
    return result;
  });

  // Track processing state for each request
  let processingRequests = $state<Map<string, boolean>>(new Map());
  let processErrors = $state<Map<string, string>>(new Map());

  // Accept handler: 1) Create entitlement, 2) Delete request
  async function handleAccept(requestId: string) {
    console.log("handleAccept called with requestId:", requestId);
    const request = filteredRequests.find(
      (r: EntitlementRequest) => r.entitlement_request_id === requestId,
    );
    if (!request) {
      console.log("Request not found!");
      return;
    }

    console.log("Request found:", request);
    processingRequests = new Map(processingRequests).set(requestId, true);
    const newErrors = new Map(processErrors);
    newErrors.delete(requestId);
    processErrors = newErrors;

    try {
      console.log("Creating entitlement...");
      // Step 1: Create the entitlement
      const createResponse = await trackedFetch("/backend/rbac/entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: request.user.user_id,
          role_name: request.role_name,
          bank_id: request.bank_id || "",
        }),
      });

      console.log("Create response status:", createResponse.status);
      // Check if entitlement already exists (OBP-30216)
      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        console.log("Create failed with error:", errorData);
        console.log("Checking if OBP-30216...");
        console.log("errorData.code:", errorData.code);
        console.log("errorData.message:", errorData.message);

        // If entitlement already exists, treat as success - just delete the request
        if (errorData.message && errorData.message.includes("OBP-30216")) {
          console.log(
            "✅ OBP-30216 detected! Entitlement already exists. Attempting to delete request...",
          );
          const deleteResponse = await trackedFetch(
            `/proxy/obp/v6.0.0/entitlement-requests/${requestId}`,
            {
              method: "DELETE",
            },
          );

          console.log("Delete response status:", deleteResponse.status);

          if (!deleteResponse.ok) {
            console.log("❌ Failed to delete request");
            const deleteErrorData = await deleteResponse.json();
            console.log("Delete error data:", deleteErrorData);
            processErrors = new Map(processErrors).set(
              requestId,
              deleteErrorData.message,
            );
            return;
          }

          // Success - user already has entitlement, show success and reload
          console.log(
            "✅ Request deleted successfully! Showing success toast...",
          );
          toast.success(
            "Request Accepted",
            `${request.user.username} already has this entitlement`,
          );

          setTimeout(() => {
            invalidateAll();
          }, 1000);
          return;
        }

        console.log("❌ Not OBP-30216, displaying error inline");
        // Other error - display inline
        processErrors = new Map(processErrors).set(
          requestId,
          errorData.message,
        );
        return;
      }

      // Step 2: Delete the entitlement request
      const deleteResponse = await trackedFetch(
        `/proxy/obp/v6.0.0/entitlement-requests/${requestId}`,
        {
          method: "DELETE",
        },
      );

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        processErrors = new Map(processErrors).set(
          requestId,
          errorData.message,
        );
        return;
      }

      // Success - show success message and reload the page
      toast.success(
        "Request Accepted",
        `Entitlement granted to ${request.user.username}`,
      );

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Exception in handleAccept:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to accept request";
      processErrors = new Map(processErrors).set(requestId, errorMessage);
    } finally {
      processingRequests = new Map(processingRequests).set(requestId, false);
    }
  }

  // Decline handler: Delete the entitlement request
  async function handleDecline(requestId: string) {
    const request = filteredRequests.find(
      (r: EntitlementRequest) => r.entitlement_request_id === requestId,
    );
    if (!request) return;
    const newErrors = new Map(processErrors);
    newErrors.delete(requestId);
    processErrors = newErrors;
    processingRequests = new Map(processingRequests).set(requestId, true);

    try {
      const response = await trackedFetch(
        `/proxy/obp/v6.0.0/entitlement-requests/${requestId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        processErrors = new Map(processErrors).set(
          requestId,
          errorData.message,
        );
        return;
      }

      // Success - show success message and reload the page
      toast.success(
        "Request Declined",
        request
          ? `Request from ${request.user.username} has been declined`
          : "Request has been declined",
      );

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to decline request";
      processErrors = new Map(processErrors).set(requestId, errorMessage);
    } finally {
      processingRequests = new Map(processingRequests).set(requestId, false);
    }
  }
</script>

<svelte:head>
  <title>Entitlement Requests - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  {#if error}
    <div class="alert alert-error mb-6">
      <strong>Error:</strong>
      {error}
    </div>
  {/if}

  <div class="panel">
    <div class="panel-header">
      <div class="header-top">
        <div>
          <h1 class="panel-title">Entitlement Requests</h1>
          <div class="panel-subtitle">
            Review and manage entitlement requests for your organization
          </div>
        </div>
        <div class="request-count">
          <span class="count-number">{entitlementRequests.length}</span>
          <span class="count-label">Total Requests</span>
        </div>
      </div>

      <!-- Search and Sort -->
      <div class="search-container">
        <div class="search-sort-row">
          <div class="search-input-wrapper">
            <Search class="search-icon" size={20} />
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="Search by role, user, or bank..."
              class="search-input"
            />
            {#if searchQuery}
              <button
                class="clear-button"
                onclick={() => (searchQuery = "")}
                aria-label="Clear search"
              >
                ×
              </button>
            {/if}
          </div>
          <div class="sort-wrapper">
            <ArrowUpDown size={16} class="sort-icon" />
            <select bind:value={sortOption} class="sort-select">
              <option value="newest">Most Recent First</option>
              <option value="oldest">Oldest First</option>
              <option value="role_asc">Role Name (A–Z)</option>
              <option value="username">Username (A–Z)</option>
            </select>
          </div>
        </div>
        {#if searchQuery}
          <div class="search-results-info">
            Showing {filteredRequests.length} of {entitlementRequests.length} requests
          </div>
        {/if}
      </div>
    </div>

    <div class="panel-content">
      {#if !hasApiAccess}
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <h4 class="empty-title">No API Access</h4>
          <p class="empty-text">
            You need API access to view entitlement requests. Please contact
            your administrator.
          </p>
        </div>
      {:else if entitlementRequests.length === 0}
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h4 class="empty-title">No Entitlement Requests Found</h4>
          <p class="empty-text">
            There are currently no entitlement requests in the system.
          </p>
        </div>
      {:else if filteredRequests.length === 0}
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h4 class="empty-title">No Matching Requests</h4>
          <p class="empty-text">
            No entitlement requests match your search criteria. Try a different
            search term.
          </p>
        </div>
      {:else}
        <div class="requests-container">
          <div class="requests-list">
            {#each filteredRequests as request, i}
              <div class="request-card" style="border-left-color: {requestColors[i] || 'transparent'}">
                <!-- User row: prominent -->
                <div class="card-user-row">
                  <div class="user-info">
                    <div class="user-name">
                      <User size={15} class="user-icon" />
                      {request.user.username}
                      {#if request.user.user_id === userId}
                        <span class="you-badge">You</span>
                      {/if}
                      <span class="user-links">
                        <a
                          href="/users/{encodeURIComponent(request.user.user_id)}"
                          class="user-link"
                          data-testid="user-detail-link-{request.entitlement_request_id}"
                        >
                          User Details
                        </a>
                        <a
                          href="/metrics?user_id={encodeURIComponent(request.user.user_id)}&from_date={encodeURIComponent(metricsFromDate)}"
                          class="user-link"
                          data-testid="user-metrics-link-{request.entitlement_request_id}"
                        >
                          User Metrics
                        </a>
                      </span>
                    </div>
                    <div class="user-email">{request.user.email}</div>
                  </div>
                  <div class="request-actions">
                    {#if processErrors.get(request.entitlement_request_id)}
                      <div class="action-error">
                        {processErrors.get(request.entitlement_request_id)}
                      </div>
                    {/if}
                    <button
                      class="btn-accept"
                      onclick={() => handleAccept(request.entitlement_request_id)}
                      disabled={processingRequests.get(request.entitlement_request_id)}
                    >
                      {#if processingRequests.get(request.entitlement_request_id)}
                        ⏳ Processing...
                      {:else}
                        <CheckCircle size={16} />
                        Accept
                      {/if}
                    </button>
                    <button
                      class="btn-decline"
                      onclick={() => handleDecline(request.entitlement_request_id)}
                      disabled={processingRequests.get(request.entitlement_request_id)}
                    >
                      {#if processingRequests.get(request.entitlement_request_id)}
                        ⏳ Processing...
                      {:else}
                        <XCircle size={16} />
                        Decline
                      {/if}
                    </button>
                  </div>
                </div>

                <!-- Role + scope on same line, date + ID below -->
                <div class="card-meta-row">
                  <div class="role-scope">
                    <span class="role-name">{request.role_name}</span>
                    {#if request.bank_id}
                      <span class="scope-badge scope-bank">🏦 {request.bank_id}</span>
                    {:else}
                      <span class="scope-badge scope-system">🌐 System-wide</span>
                    {/if}
                  </div>
                  <div class="card-footer-meta">
                    <span class="created-date">
                      <Calendar size={13} class="meta-icon" />
                      {formatDate(request.created)}
                    </span>
                    <span class="request-id">{request.entitlement_request_id}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <!-- Pagination -->
          <div class="pagination">
            <div class="pagination-info">
              Showing {offset + 1}–{offset + entitlementRequests.length}
              {#if offset > 0}
                <span class="pagination-offset">(offset: {offset})</span>
              {/if}
            </div>
            <div class="pagination-buttons">
              <button
                class="btn-pagination"
                onclick={previousPage}
                disabled={!hasPreviousPage}
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <button
                class="btn-pagination"
                onclick={nextPage}
                disabled={!hasNextPage}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1600px;
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
    padding-bottom: 0;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
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

  .request-count {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem 1.5rem;
    background: #f3f4f6;
    border-radius: 8px;
  }

  :global([data-mode="dark"]) .request-count {
    background: rgb(var(--color-surface-700));
  }

  .count-number {
    font-size: 2rem;
    font-weight: 700;
    color: #3b82f6;
    line-height: 1;
  }

  :global([data-mode="dark"]) .count-number {
    color: rgb(var(--color-primary-400));
  }

  .count-label {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .count-label {
    color: var(--color-surface-400);
  }

  .search-container {
    padding: 0 1.5rem 1.5rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .search-container {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .search-sort-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    max-width: 33.333%;
    flex: 1;
  }

  .sort-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .sort-wrapper :global(.sort-icon) {
    position: absolute;
    left: 0.75rem;
    color: #6b7280;
    pointer-events: none;
  }

  :global([data-mode="dark"]) .sort-wrapper :global(.sort-icon) {
    color: var(--color-surface-400);
  }

  .sort-select {
    padding: 0.75rem 1rem 0.75rem 2.25rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.875rem;
    background: white;
    color: #111827;
    cursor: pointer;
    transition: all 0.2s;
    appearance: auto;
  }

  .sort-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  :global([data-mode="dark"]) .sort-select {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .sort-select:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .search-input-wrapper :global(.search-icon) {
    position: absolute;
    left: 1rem;
    color: #9ca3af;
    pointer-events: none;
  }

  :global([data-mode="dark"]) .search-input-wrapper :global(.search-icon) {
    color: var(--color-surface-400);
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 3rem 0.75rem 3rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.875rem;
    background: white;
    color: #111827;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  :global([data-mode="dark"]) .search-input {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .search-input:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .clear-button {
    position: absolute;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #9ca3af;
    cursor: pointer;
    padding: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .clear-button:hover {
    color: #4b5563;
  }

  :global([data-mode="dark"]) .clear-button {
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .clear-button:hover {
    color: var(--color-surface-200);
  }

  .search-results-info {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .search-results-info {
    color: var(--color-surface-400);
  }

  .panel-content {
    padding: 1.5rem;
  }

  .alert {
    padding: 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1.5rem;
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

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-title {
    color: #4a5568;
    margin-bottom: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .empty-title {
    color: var(--color-surface-300);
  }

  .empty-text {
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-text {
    color: var(--color-surface-400);
  }

  .requests-container {
    display: flex;
    flex-direction: column;
  }

  .requests-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .request-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-left: 3px solid transparent;
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.2s;
  }

  .request-card:hover {
    border-color: #d1d5db;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }

  :global([data-mode="dark"]) .request-card {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
  }

  :global([data-mode="dark"]) .request-card:hover {
    border-color: rgb(var(--color-surface-500));
  }

  /* User row — top section, prominent */
  .card-user-row {
    padding: 0.875rem 1rem;
    background: white;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  :global([data-mode="dark"]) .card-user-row {
    background: rgb(var(--color-surface-800));
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .user-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .user-name {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 1rem;
    font-weight: 700;
    color: #111827;
  }

  :global([data-mode="dark"]) .user-name {
    color: var(--color-surface-100);
  }

  .user-name :global(.user-icon) {
    color: #6b7280;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .user-name :global(.user-icon) {
    color: var(--color-surface-400);
  }

  .you-badge {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 9999px;
    background: #dcfce7;
    color: #15803d;
    letter-spacing: 0.03em;
  }

  :global([data-mode="dark"]) .you-badge {
    background: rgba(34, 197, 94, 0.2);
    color: rgb(var(--color-success-300));
  }

  .user-links {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: 0.5rem;
  }

  .user-link {
    font-size: 0.75rem;
    font-weight: 500;
    color: #3b82f6;
    text-decoration: none;
  }

  .user-link:hover {
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .user-link {
    color: rgb(var(--color-primary-400));
  }

  .user-email {
    font-size: 0.8rem;
    color: #6b7280;
    padding-left: 1.4rem;
  }

  :global([data-mode="dark"]) .user-email {
    color: var(--color-surface-400);
  }

  .request-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    flex-shrink: 0;
    align-items: center;
  }

  .action-error {
    width: 100%;
    padding: 0.375rem 0.5rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    color: #991b1b;
    font-size: 0.75rem;
  }

  :global([data-mode="dark"]) .action-error {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: rgb(var(--color-error-200));
  }

  /* Role + scope row — bottom section */
  .card-meta-row {
    padding: 0.625rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .role-scope {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-width: 0;
  }

  .role-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    font-family: monospace;
  }

  :global([data-mode="dark"]) .role-name {
    color: var(--color-surface-200);
  }

  .scope-badge {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .scope-badge.scope-bank {
    background: #dbeafe;
    color: #1e40af;
  }

  :global([data-mode="dark"]) .scope-badge.scope-bank {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-300));
  }

  .scope-badge.scope-system {
    background: #f3f4f6;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .scope-badge.scope-system {
    background: rgb(var(--color-surface-600));
    color: var(--color-surface-300);
  }

  .card-footer-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-shrink: 0;
  }

  .created-date {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: #9ca3af;
  }

  :global([data-mode="dark"]) .created-date {
    color: var(--color-surface-500);
  }

  .created-date :global(.meta-icon) {
    flex-shrink: 0;
  }

  .request-id {
    font-size: 0.7rem;
    color: #d1d5db;
    font-family: monospace;
  }

  :global([data-mode="dark"]) .request-id {
    color: var(--color-surface-600);
  }

  .btn-accept,
  .btn-decline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-accept:disabled,
  .btn-decline:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-accept {
    background: #10b981;
    color: white;
  }

  .btn-accept:hover {
    background: #059669;
  }

  :global([data-mode="dark"]) .btn-accept {
    background: rgb(var(--color-success-600));
  }

  :global([data-mode="dark"]) .btn-accept:hover {
    background: rgb(var(--color-success-700));
  }

  .btn-decline {
    background: #ef4444;
    color: white;
  }

  .btn-decline:hover {
    background: #dc2626;
  }

  :global([data-mode="dark"]) .btn-decline {
    background: rgb(var(--color-error-600));
  }

  :global([data-mode="dark"]) .btn-decline:hover {
    background: rgb(var(--color-error-700));
  }

  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .pagination {
    border-top-color: rgb(var(--color-surface-700));
  }

  .pagination-info {
    font-size: 0.875rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .pagination-info {
    color: var(--color-surface-400);
  }

  .pagination-offset {
    margin-left: 0.25rem;
    color: #9ca3af;
  }

  :global([data-mode="dark"]) .pagination-offset {
    color: var(--color-surface-500);
  }

  .pagination-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .btn-pagination {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    background: white;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-pagination:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .btn-pagination:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-pagination {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-200);
  }

  :global([data-mode="dark"]) .btn-pagination:hover:not(:disabled) {
    background: rgb(var(--color-surface-600));
    border-color: rgb(var(--color-surface-500));
  }

  @media (max-width: 768px) {
    .header-top {
      flex-direction: column;
      gap: 1rem;
    }

    .request-count {
      width: 100%;
    }

    .search-sort-row {
      flex-direction: column;
      align-items: stretch;
    }

    .search-input-wrapper {
      max-width: 100%;
    }

    .sort-select {
      width: 100%;
    }

    .card-user-row {
      flex-direction: column;
      align-items: flex-start;
    }

    .request-actions {
      width: 100%;
    }

    .btn-accept,
    .btn-decline {
      flex: 1;
      justify-content: center;
    }

    .card-footer-meta {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
  }
</style>
