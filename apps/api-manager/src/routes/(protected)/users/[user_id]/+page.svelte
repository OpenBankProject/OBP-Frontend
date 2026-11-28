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
  import { Trash2 } from "@lucide/svelte";

  import { pageDataSummary } from "$lib/stores/pageDataSummary.svelte";
  import { pageHeading } from "$lib/stores/pageHeading.svelte";

  let { data } = $props<{ data: PageData }>();

  let user = $derived(data.user);
  let hasApiAccess = $derived(data.hasApiAccess);
  let pageError = $derived(data.error);

  // from_date for the "View API Metrics" link: one week ago, in the
  // datetime-local format (yyyy-MM-ddTHH:mm) the metrics query form expects.
  const metricsFromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  $effect(() => {
    if (user) {
      const entitlements = user.entitlements?.length || 0;
      pageDataSummary.set(`Viewing user ${user.username || user.email} (${user.provider}), ${entitlements} entitlements`);
      pageHeading.set(user.username || user.email);
    }
  });

  function formatDate(dateString?: string): string {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  }
</script>

<svelte:head>
  <title>User Details - {user?.username || data.user_id} - API Manager II</title
  >
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb mb-6">
    <a href="/users" class="breadcrumb-link">Users</a>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">{user?.username || data.user_id}</span>
  </nav>

  <!-- Error Alert -->
  {#if pageError}
    <div class="alert alert-error mb-6">
      <strong>Error:</strong>
      {pageError}
    </div>
  {/if}

  {#if user}
    <!-- User Info Panel -->
    <div class="panel mb-6">
      <div class="panel-header">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold">{user.username || "Unknown User"}</h1>
            <div class="text-sm mt-1 ui-muted">
              {user.provider || "Unknown"} Provider
            </div>
          </div>
          <div class="flex items-center gap-2">
          {#if user.user_id && data.portalUrl}
            <a
              href="{data.portalUrl}/user/chat/dm/{encodeURIComponent(user.user_id)}"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium preset-filled-primary-500"
              data-testid="user-chat-link"
            >
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              Chat
            </a>
          {/if}
          {#if user.user_id}
            <a
              href="/metrics?user_id={encodeURIComponent(
                user.user_id,
              )}&from_date={encodeURIComponent(metricsFromDate)}"
              class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium preset-filled-primary-500"
              data-testid="user-metrics-link"
            >
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              View API Metrics
            </a>
          {/if}
          </div>
        </div>
      </div>
      <div class="panel-content">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">User ID</div>
            <div class="info-value">
              <span class="font-mono">{user.user_id || "N/A"}</span>
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">Email</div>
            <div class="info-value">
              {user.email || "N/A"}
              {#if user.email_validated === true && user.user_id}
                <a
                  href="/users/{encodeURIComponent(user.user_id)}/reset-password"
                  class="action-link"
                  data-testid="user-send-reset-password-link"
                >Send Password Reset Email</a>
              {/if}
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">Username</div>
            <div class="info-value">{user.username || "N/A"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Mobile Phone Number</div>
            <div class="info-value" data-testid="user-mobile-phone-number">
              {user.mobile_phone_number || "N/A"}
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">Mobile Phone Validated</div>
            <div class="info-value" data-testid="user-mobile-phone-validated">
              {#if user.mobile_phone_number_is_validated === true}
                <span class="badge badge-success">Yes</span>
              {:else if user.mobile_phone_number_is_validated === false}
                <span class="badge badge-error">No</span>
              {:else}
                <span class="badge badge-default">Unknown</span>
              {/if}
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">Mobile Phone Validated Date</div>
            <div class="info-value" data-testid="user-mobile-phone-validated-date">
              {formatDate(user.mobile_phone_number_validated_date)}
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">Provider</div>
            <div class="info-value">{user.provider || "N/A"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Created Date</div>
            <div class="info-value">{formatDate(user.created_date)}</div>
          </div>
          {#if user.last_login_date}
            <div class="info-item">
              <div class="info-label">Last Login</div>
              <div class="info-value">{formatDate(user.last_login_date)}</div>
            </div>
          {/if}
          <div class="info-item">
            <div class="info-label">Is Locked</div>
            <div class="info-value">
              {#if user.is_locked}
                <span class="badge badge-error">Yes</span>
                {#if user.provider && user.username}
                  <a href="/users/{encodeURIComponent(user.provider)}/{encodeURIComponent(user.username)}/unlock" class="action-link action-link-success">Unlock User</a>
                {/if}
              {:else}
                <span class="badge badge-success">No</span>
                {#if user.provider && user.username}
                  <a href="/users/{encodeURIComponent(user.provider)}/{encodeURIComponent(user.username)}/lock" class="action-link action-link-error">Lock User</a>
                {/if}
              {/if}
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">Is Deleted</div>
            <div class="info-value">
              {#if user.is_deleted}
                <span class="badge badge-error">Yes</span>
              {:else}
                <span class="badge badge-success">No</span>
              {/if}
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">Email Validated</div>
            <div class="info-value" data-testid="user-email-validated">
              {#if user.email_validated === true}
                <span class="badge badge-success">Yes</span>
              {:else if user.email_validated === false}
                <span class="badge badge-error">No</span>
                {#if user.user_id}
                  <a
                    href="/users/{encodeURIComponent(user.user_id)}/validate-email"
                    class="action-link action-link-success"
                    data-testid="user-send-validation-email-link">Send Validation Email</a>
                {/if}
              {:else}
                <span class="badge badge-default">Unknown</span>
              {/if}
            </div>
          </div>
          {#if user.last_activity_date}
            <div class="info-item">
              <div class="info-label">Last Activity</div>
              <div class="info-value">
                {formatDate(user.last_activity_date)}
              </div>
            </div>
          {/if}
          {#if user.recent_operation_ids && user.recent_operation_ids.length > 0}
            <div class="info-item">
              <div class="info-label">Recent Operations</div>
              <div class="info-value">
                <div class="operations-compact">
                  {#each user.recent_operation_ids.slice(0, 3) as operationId}
                    <div class="operation-id-compact font-mono">
                      {operationId}
                    </div>
                  {/each}
                  {#if user.recent_operation_ids.length > 3}
                    <div class="text-xs mt-1 ui-muted">
                      +{user.recent_operation_ids.length - 3} more
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Entitlements Panel -->
    <div class="panel mb-6">
      <div class="panel-header">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="panel-title">Entitlements</h2>
            <div class="panel-subtitle">
              Roles and permissions assigned to this user
            </div>
          </div>
          <a
            href="/rbac/entitlements/create?username={encodeURIComponent(
              user.username || '',
            )}"
            class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium preset-filled-primary-500"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create Entitlement
          </a>
        </div>
      </div>
      <div class="panel-content">
        {#if user.entitlements?.list && user.entitlements.list.length > 0}
          <div class="entitlements-grid">
            {#each user.entitlements.list as entitlement}
              <div class="entitlement-card">
                <div class="entitlement-header">
                  <div class="entitlement-name">
                    {entitlement.role_name ||
                      entitlement.entitlement_id ||
                      "Unknown"}
                  </div>
                  <a
                    href="/rbac/entitlements/{entitlement.entitlement_id}/delete"
                    class="delete-button"
                    title="Delete entitlement"
                  >
                    <Trash2 size={16} />
                  </a>
                </div>
                <div class="entitlement-detail">
                  <span class="detail-label">Scope:</span>
                  {#if entitlement.bank_id}
                    {entitlement.bank_id}
                  {:else}
                    <span class="system-wide-badge">System-wide</span>
                  {/if}
                </div>
                {#if entitlement.entitlement_request_process}
                  <div class="entitlement-detail">
                    <span class="detail-label">Process:</span>
                    {entitlement.entitlement_request_process}
                  </div>
                {/if}
                {#if entitlement.group_id}
                  <div class="entitlement-detail">
                    <span class="detail-label">Group:</span>
                    <span class="group-badge">{entitlement.group_id}</span>
                  </div>
                {/if}
                {#if entitlement.created_date}
                  <div class="entitlement-detail">
                    <span class="detail-label">Added:</span>
                    {formatDate(entitlement.created_date)}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-state">
            <p>No entitlements assigned to this user</p>
          </div>
        {/if}
      </div>
    </div>
  {:else if !hasApiAccess}
    <div class="empty-state">
      <p>Unable to load user details. Please check your API access.</p>
    </div>
  {:else}
    <div class="empty-state">
      <p>User not found</p>
    </div>
  {/if}
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
    color: var(--ui-link);
    text-decoration: none;
  }

  .breadcrumb-link:hover {
    text-decoration: underline;
  }

  .breadcrumb-separator {
    color: var(--ui-muted);
  }

  .breadcrumb-current {
    color: var(--ui-muted);
  }

  .panel {
    background: var(--ui-card);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .panel-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--ui-border);
  }

  .panel-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--ui-text);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: var(--ui-muted);
    margin-top: 0.25rem;
  }

  .panel-content {
    padding: 1.5rem;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    /* Grid items default to min-width auto; without this a long unbroken value
       forces the track wider and overlaps the neighbouring column. */
    min-width: 0;
  }

  .info-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--ui-muted);
    letter-spacing: 0.05em;
  }

  .info-value {
    font-size: 0.875rem;
    color: var(--ui-text);
    /* Long unbroken emails / usernames / ids wrap instead of overflowing. */
    overflow-wrap: anywhere;
  }

  .entitlements-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  @media (max-width: 768px) {
    .entitlements-grid {
      grid-template-columns: 1fr;
    }
  }

  .entitlement-card {
    padding: 1rem;
    background: var(--ui-card);
    border: 1px solid var(--ui-border);
    border-radius: 0.5rem;
  }

  .entitlement-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .entitlement-name {
    font-weight: 600;
    color: var(--ui-text);
    word-break: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
  }

  .delete-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    color: var(--ui-muted);
    border-radius: 0.25rem;
    transition: all 0.2s;
    text-decoration: none;
  }

  .delete-button:hover {
    color: var(--ui-tone-error-text);
    background: var(--ui-tone-error-bg);
  }

  .entitlement-detail {
    font-size: 0.875rem;
    color: var(--ui-muted);
    margin-top: 0.25rem;
  }

  .detail-label {
    font-weight: 500;
  }

  .operations-compact {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .operation-id-compact {
    font-size: 0.75rem;
    color: var(--ui-text);
    padding: 0.25rem 0.5rem;
    background: var(--ui-panel);
    border-radius: 0.25rem;
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .badge-success {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .badge-default {
    background: var(--ui-panel);
    color: var(--ui-text);
  }

  .badge-error {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
  }

  .action-link {
    margin-left: 0.5rem;
    font-size: 0.75rem;
    color: var(--ui-link);
    text-decoration: none;
  }

  .action-link:hover {
    text-decoration: underline;
  }

  .action-link-success {
    color: var(--ui-success);
  }

  .action-link-error {
    color: var(--ui-error);
  }

  .system-wide-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: var(--ui-panel);
    color: var(--ui-muted);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .group-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--ui-muted);
  }

  .empty-state-inline {
    text-align: center;
    padding: 1.5rem;
    color: var(--ui-muted);
    font-size: 0.875rem;
  }

  .empty-state-inline code {
    background: var(--ui-panel);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.8125rem;
  }

  .alert {
    padding: 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
  }

  .alert-error {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
    border: 1px solid var(--ui-tone-error-border);
  }

  .alert-success {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
    border: 1px solid var(--ui-tone-success-border);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--ui-panel);
    color: var(--ui-text);
    border: 1px solid var(--ui-border);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--ui-hover);
  }

  .btn-success {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .btn-success:hover:not(:disabled) {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .btn-danger {
    background: var(--ui-fill-danger-bg);
    color: var(--ui-fill-danger-text);
  }

  .btn-danger:hover:not(:disabled) {
    opacity: 0.85;
  }
</style>
