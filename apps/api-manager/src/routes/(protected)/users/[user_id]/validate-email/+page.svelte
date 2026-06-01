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
  <title>Send Validation Email - {user?.username || data.user_id} - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <nav class="breadcrumb mb-6">
    <a href="/users" class="breadcrumb-link">Users</a>
    <span class="breadcrumb-separator">›</span>
    <a href="/users/{data.user_id}" class="breadcrumb-link">{user?.username || data.user_id}</a>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">Send Validation Email</span>
  </nav>

  {#if pageError}
    <div class="alert alert-error mb-6">
      <strong>Error:</strong> {pageError}
    </div>
  {/if}

  {#if lastResponse?.error || form?.error}
    <div class="alert alert-error mb-6" data-testid="validation-email-error">
      <strong>Error:</strong> {lastResponse?.error || form?.error}
    </div>
  {/if}

  {#if form?.success && form?.action === "resendValidationEmail"}
    <div class="alert alert-success mb-6" data-testid="validation-email-success">
      <strong>Request submitted</strong> for
      <span class="font-mono">{form.username}</span> &lt;<span class="font-mono">{form.sentTo}</span>&gt;.
      <div class="text-sm mt-2">
        If the account exists and is not yet validated, a validation link has been
        sent by email. Limit: 3 attempts per email per hour.
      </div>
    </div>
  {/if}

  {#if user}
    <div class="panel mb-6">
      <div class="panel-header">
        <h1 class="text-2xl font-bold">Send Validation Email</h1>
        <div class="panel-subtitle">{user.username} ({user.provider})</div>
      </div>
      <div class="panel-content">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Username</div>
            <div class="info-value font-mono">{user.username}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Email</div>
            <div class="info-value font-mono">{user.email}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Provider</div>
            <div class="info-value">{user.provider}</div>
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
            <h2 class="panel-title">Resend Validation Email</h2>
            <div class="panel-subtitle">
              Send {user.username} an email with a link they can click to validate their
              email address and complete registration.
            </div>
          </div>
          <form method="POST" action="?/resendValidationEmail" use:enhance={handleEnhance}>
            <button
              type="submit"
              class="btn btn-success"
              disabled={isSubmitting}
              data-testid="resend-validation-email-button"
            >
              {isSubmitting ? "Sending..." : "Send Validation Email"}
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

  .breadcrumb-current {
    color: #6b7280;
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

  .panel-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
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
    color: #6b7280;
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
    color: var(--color-surface-100);
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .badge-success {
    background: #d1fae5;
    color: #065f46;
  }

  :global([data-mode="dark"]) .badge-success {
    background: rgb(var(--color-success-900));
    color: rgb(var(--color-success-200));
  }

  .badge-error {
    background: #fee2e2;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .badge-error {
    background: rgb(var(--color-error-900));
    color: rgb(var(--color-error-200));
  }

  .badge-default {
    background: #f3f4f6;
    color: #374151;
  }

  :global([data-mode="dark"]) .badge-default {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-300);
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  .alert {
    padding: 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
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

  .btn-success {
    background: #059669;
    color: white;
  }

  .btn-success:hover:not(:disabled) {
    background: #047857;
  }
</style>
