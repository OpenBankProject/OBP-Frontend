<!--
  Copyright (C) 2025-2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
  import type { PageData } from "./$types";
  import {
    Search,
    CheckCircle,
    XCircle,
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
      return date.toLocaleDateString() + " " + date.toLocaleTimeString(undefined, { hourCycle: "h23" });
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

  const GROUP_COLORS = ['var(--ui-chart-1)', 'var(--ui-chart-7)', 'var(--ui-chart-4)', 'var(--ui-chart-5)', 'var(--ui-chart-3)'];
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
            `/proxy/obp/v5.1.0/entitlement-requests/${requestId}`,
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
        `/proxy/obp/v5.1.0/entitlement-requests/${requestId}`,
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
        `/proxy/obp/v5.1.0/entitlement-requests/${requestId}`,
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
              <div class="request-card" style="border-left-color: {requestColors[i] || 'transparent'}" data-testid="entitlement-request-{request.entitlement_request_id}">
                <!-- The request itself on one line: who wants which Role, where, and the decision -->
                <div class="request-main">
                  <p class="request-sentence ui-summary">
                    <span class="ui-highlight">{request.user.username}</span>
                    {#if request.user.user_id === userId}
                      <span class="you-badge">You</span>
                    {/if}
                    <span class="ui-muted">has requested</span>
                    <span class="ui-highlight break-all">{request.role_name}</span>
                    {#if request.bank_id}
                      <span class="ui-muted">at</span>
                      <span class="ui-highlight">{request.bank_id}</span>
                    {:else}
                      <span class="ui-muted">system-wide</span>
                    {/if}
                  </p>
                  <div class="request-actions">
                    <button
                      class="btn-accept"
                      onclick={() => handleAccept(request.entitlement_request_id)}
                      disabled={processingRequests.get(request.entitlement_request_id)}
                      data-testid="accept-{request.entitlement_request_id}"
                    >
                      <CheckCircle size={16} />
                      Accept
                    </button>
                    <button
                      class="btn-decline"
                      onclick={() => handleDecline(request.entitlement_request_id)}
                      disabled={processingRequests.get(request.entitlement_request_id)}
                      data-testid="decline-{request.entitlement_request_id}"
                    >
                      <XCircle size={16} />
                      Decline
                    </button>
                  </div>
                </div>

                <!-- The details, small, underneath -->
                <div class="request-details ui-details">
                  <span>{request.user.email}</span>
                  <a
                    href="/users/{encodeURIComponent(request.user.user_id)}"
                    class="ui-link"
                    data-testid="user-detail-link-{request.entitlement_request_id}"
                  >
                    User Details
                  </a>
                  <a
                    href="/metrics?user_id={encodeURIComponent(request.user.user_id)}&from_date={encodeURIComponent(metricsFromDate)}"
                    class="ui-link"
                    data-testid="user-metrics-link-{request.entitlement_request_id}"
                  >
                    User Metrics
                  </a>
                  <span class="created-date">
                    <Calendar size={12} class="meta-icon" />
                    {formatDate(request.created)}
                  </span>
                  <span>{request.entitlement_request_id}</span>
                </div>

                {#if processErrors.get(request.entitlement_request_id)}
                  <div class="action-error">
                    {processErrors.get(request.entitlement_request_id)}
                  </div>
                {/if}
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
    background: var(--ui-card);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
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
    color: var(--ui-text);
    margin: 0;
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: var(--ui-muted);
    margin-top: 0.5rem;
  }

  .request-count {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem 1.5rem;
    background: var(--ui-panel);
    border-radius: 8px;
  }

  .count-number {
    font-size: 2rem;
    font-weight: 700;
    color: var(--ui-link);
    line-height: 1;
  }

  .count-label {
    font-size: 0.75rem;
    color: var(--ui-muted);
    margin-top: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .search-container {
    padding: 0 1.5rem 1.5rem 1.5rem;
    border-bottom: 1px solid var(--ui-border);
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
    color: var(--ui-muted);
    pointer-events: none;
  }

  .sort-select {
    padding: 0.75rem 1rem 0.75rem 2.25rem;
    border: 1px solid var(--ui-border);
    border-radius: 8px;
    font-size: 0.875rem;
    background: var(--ui-card);
    color: var(--ui-text);
    cursor: pointer;
    transition: all 0.2s;
    appearance: auto;
  }

  .sort-select:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-link) 10%, transparent);
  }

  .search-input-wrapper :global(.search-icon) {
    position: absolute;
    left: 1rem;
    color: var(--ui-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 3rem 0.75rem 3rem;
    border: 1px solid var(--ui-border);
    border-radius: 8px;
    font-size: 0.875rem;
    background: var(--ui-card);
    color: var(--ui-text);
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-link) 10%, transparent);
  }

  .clear-button {
    position: absolute;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--ui-muted);
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
    color: var(--ui-muted);
  }

  .search-results-info {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--ui-muted);
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
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
    border: 1px solid var(--ui-tone-error-border);
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--ui-muted);
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-title {
    color: var(--ui-muted);
    margin-bottom: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .empty-text {
    color: var(--ui-muted);
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
    background: var(--ui-card);
    border: 1px solid var(--ui-border);
    border-left: 3px solid transparent;
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.2s;
  }

  .request-card:hover {
    border-color: var(--ui-border);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }

  .request-main {
    padding: 0.75rem 1rem 0.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .request-sentence {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0;
    min-width: 0;
  }

  .you-badge {
    align-self: center;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.1rem 0.4rem;
    border-radius: 9999px;
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .request-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
    align-items: center;
  }

  .request-details {
    padding: 0 1rem 0.75rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 1rem;
  }

  .created-date {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .created-date :global(.meta-icon) {
    flex-shrink: 0;
  }

  .action-error {
    margin: 0 1rem 0.75rem;
    padding: 0.375rem 0.5rem;
    background: var(--ui-tone-error-bg);
    border: 1px solid var(--ui-tone-error-border);
    border-radius: 4px;
    color: var(--ui-tone-error-text);
    font-size: 0.75rem;
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
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-accept:disabled,
  .btn-decline:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-accept {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .btn-accept:hover {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .btn-decline {
    background: var(--ui-fill-danger-bg);
    color: var(--ui-fill-danger-text);
  }

  .btn-decline:hover {
    opacity: 0.85;
  }

  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--ui-border);
  }

  .pagination-info {
    font-size: 0.875rem;
    color: var(--ui-muted);
  }

  .pagination-offset {
    margin-left: 0.25rem;
    color: var(--ui-muted);
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
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    background: var(--ui-card);
    color: var(--ui-text);
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-pagination:hover:not(:disabled) {
    background: var(--ui-hover);
    border-color: var(--ui-border);
  }

  .btn-pagination:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

    .request-actions {
      width: 100%;
    }

    .btn-accept,
    .btn-decline {
      flex: 1;
      justify-content: center;
    }
  }
</style>
