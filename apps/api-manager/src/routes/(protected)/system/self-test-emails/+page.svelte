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
  interface TestEmailResult {
    to: string;
    from: string;
    subject: string;
    message_id: string;
  }

  let isSending = $state(false);
  let error = $state<string | null>(null);
  let result = $state<TestEmailResult | null>(null);

  async function sendTestEmail() {
    try {
      isSending = true;
      error = null;
      result = null;

      const response = await fetch(
        "/proxy/obp/v7.0.0/management/self-test-emails",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      result = data as TestEmailResult;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to send test email";
    } finally {
      isSending = false;
    }
  }
</script>

<svelte:head>
  <title>Send Self Test Email - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <h1 class="panel-title">Send Self Test Email</h1>
      <p class="panel-subtitle">
        Send a test email to your own address to verify SMTP delivery from this OBP server.
      </p>
    </div>

    <div class="panel-content">
      <p class="explainer">
        The recipient is always your authenticated user's email address. There are no
        parameters to set. On success, the API returns the recipient, sender, subject
        and the message-id assigned by the SMTP server.
      </p>

      {#if error}
        <div class="alert alert-error" data-testid="test-email-error">{error}</div>
      {/if}

      {#if result}
        <div class="alert alert-success" data-testid="test-email-success">
          <div class="result-line"><span class="result-label">To:</span> <span data-testid="result-to">{result.to}</span></div>
          <div class="result-line"><span class="result-label">From:</span> <span data-testid="result-from">{result.from}</span></div>
          <div class="result-line"><span class="result-label">Subject:</span> <span data-testid="result-subject">{result.subject}</span></div>
          <div class="result-line"><span class="result-label">Message ID:</span> <span data-testid="result-message-id">{result.message_id}</span></div>
        </div>
      {/if}

      <div class="form-actions">
        <button
          class="btn-send"
          name="send-test-email"
          data-testid="send-test-email-button"
          onclick={sendTestEmail}
          disabled={isSending}
        >
          {isSending ? "Sending..." : "Send Test Email"}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 800px;
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

  .panel-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.8125rem;
    color: #6b7280;
    margin: 0.25rem 0 0;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .panel-content {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .explainer {
    font-size: 0.875rem;
    color: #374151;
    margin: 0;
    line-height: 1.5;
  }

  :global([data-mode="dark"]) .explainer {
    color: var(--color-surface-300);
  }

  .form-actions {
    padding-top: 0.25rem;
  }

  .btn-send {
    padding: 0.5rem 1.5rem;
    background: #51b265;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .btn-send:hover:not(:disabled) {
    background: #3d9e52;
  }

  .btn-send:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .alert {
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
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
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  :global([data-mode="dark"]) .alert-success {
    background: rgb(var(--color-success-900));
    color: rgb(var(--color-success-200));
    border-color: rgb(var(--color-success-800));
  }

  .result-line {
    font-family: monospace;
    font-size: 0.8125rem;
  }

  .result-label {
    font-weight: 600;
    margin-right: 0.25rem;
  }
</style>
