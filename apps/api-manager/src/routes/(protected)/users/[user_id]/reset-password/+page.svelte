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
  import { enhance } from "$app/forms";

  let { data, form } = $props<{ data: PageData; form: any }>();

  let user = $derived(data.user);
  let hasApiAccess = $derived(data.hasApiAccess);
  let pageError = $derived(data.error);
  let isSubmitting = $state(false);
  let lastResponse = $state<any>(null);

  function handleEnhance() {
    isSubmitting = true;
    lastResponse = null;
    return async ({ result, update }: any) => {
      if (result.type === "failure") {
        lastResponse = result.data;
      }
      isSubmitting = false;
      await update();
    };
  }
</script>

<svelte:head>
  <title>Send Password Reset - {user?.username || data.user_id} - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <nav class="breadcrumb mb-6">
    <a href="/users" class="breadcrumb-link">Users</a>
    <span class="breadcrumb-separator">›</span>
    <a href="/users/{data.user_id}" class="breadcrumb-link">{user?.username || data.user_id}</a>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">Send Password Reset</span>
  </nav>

  {#if pageError}
    <div class="alert alert-error mb-6">
      <strong>Error:</strong> {pageError}
    </div>
  {/if}

  {#if lastResponse?.error || form?.error}
    <div class="alert alert-error mb-6" data-testid="reset-password-error">
      <strong>Error:</strong> {lastResponse?.error || form?.error}
    </div>
  {/if}

  {#if form?.success && form?.action === "sendResetPasswordEmail"}
    <div class="alert alert-success mb-6" data-testid="reset-password-success">
      <strong>Reset email sent</strong> to
      <span class="font-mono">{form.username}</span> &lt;<span class="font-mono">{form.sentTo}</span>&gt;.
      <div class="text-sm mt-2">
        The reset link is delivered by email. It is not shown here.
      </div>
    </div>
  {/if}

  {#if user}
    <div class="panel mb-6">
      <div class="panel-header">
        <h1 class="text-2xl font-bold">Send Password Reset</h1>
        <div class="panel-subtitle">{user.username} ({user.provider})</div>
      </div>
      <div class="panel-content">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">User ID</div>
            <div class="info-value font-mono">{user.user_id}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Username</div>
            <div class="info-value font-mono">{user.username}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Email</div>
            <div class="info-value font-mono">{user.email}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Email Validated</div>
            <div class="info-value">
              {#if user.email_validated === true}
                <span class="badge badge-success">Yes</span>
              {:else if user.email_validated === false}
                <span class="badge badge-error">No</span>
              {:else}
                <span class="badge badge-default">Unknown</span>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel mb-6">
      <div class="panel-header">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="panel-title">Send Password Reset Email</h2>
            <div class="panel-subtitle">
              Send {user.username} an email with a link they can click to set a new password.
              Their email address must already be validated for this to work.
            </div>
          </div>
          <form method="POST" action="?/sendResetPasswordEmail" use:enhance={handleEnhance}>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={isSubmitting}
              data-testid="send-reset-password-button"
            >
              {isSubmitting ? "Sending..." : "Send Password Reset Email"}
            </button>
          </form>
        </div>
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

  .badge-error {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
  }

  .badge-default {
    background: var(--ui-panel);
    color: var(--ui-text);
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--ui-muted);
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

  .btn-primary {
    background: var(--ui-fill-main-bg);
    color: var(--ui-fill-main-text);
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.85;
  }
</style>
