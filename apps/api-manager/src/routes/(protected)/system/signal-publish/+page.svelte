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
  import { CircleHelp } from "@lucide/svelte";

  let channelName = $state("task-requests");
  let messageType = $state("");
  let toUserId = $state("");
  let payload = $state('{"message": "Please report what time it is where you are"}');
  let isPublishing = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);

  async function publishMessage() {
    if (!channelName.trim()) return;

    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      error = "Invalid JSON payload";
      return;
    }

    try {
      isPublishing = true;
      error = null;
      success = null;

      const body: any = { payload: parsedPayload };
      if (messageType.trim()) {
        body.message_type = messageType.trim();
      }
      if (toUserId.trim()) {
        body.to_user_id = toUserId.trim();
      }

      const response = await fetch(
        `/proxy/obp/v6.0.0/signal-channels/${encodeURIComponent(channelName.trim())}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message);
      }

      const result = await response.json();
      const target = toUserId.trim()
        ? `private to ${toUserId.trim().substring(0, 8)}...`
        : "broadcast";
      success = `Message published to "${channelName.trim()}" (${target}, ID: ${result.message_id?.substring(0, 8)}...)`;
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to publish message";
    } finally {
      isPublishing = false;
    }
  }
</script>

<svelte:head>
  <title>Publish Signal - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <div class="header-row">
        <div>
          <h1 class="panel-title">Publish Signal</h1>
          <p class="panel-subtitle">Broadcast a message to a signal channel, or privately address one recipient</p>
        </div>
        <a href="/system/signal-publish/help" class="help-link" data-testid="signal-publish-help-link">
          <CircleHelp size={16} />
          Help
        </a>
      </div>
    </div>

    <div class="panel-content">
      <div class="form">
        <div class="form-row">
          <div class="field">
            <label class="field-label" for="pub-channel">Channel</label>
            <input
              id="pub-channel"
              type="text"
              class="field-input"
              bind:value={channelName}
              disabled={isPublishing}
            />
          </div>
          <div class="field">
            <label class="field-label" for="pub-type">Type <span class="optional">(optional)</span></label>
            <input
              id="pub-type"
              type="text"
              class="field-input"
              placeholder="e.g. task-request"
              bind:value={messageType}
              disabled={isPublishing}
            />
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="pub-to-user">
            To User ID <span class="optional">(optional — leave empty for broadcast)</span>
          </label>
          <input
            id="pub-to-user"
            type="text"
            class="field-input"
            placeholder="recipient OBP user_id (UUID)"
            bind:value={toUserId}
            disabled={isPublishing}
          />
        </div>

        <div class="field">
          <label class="field-label" for="pub-payload">Payload (JSON)</label>
          <textarea
            id="pub-payload"
            class="field-textarea"
            bind:value={payload}
            disabled={isPublishing}
            rows="6"
          ></textarea>
        </div>

        {#if error}
          <div class="alert alert-error">{error}</div>
        {/if}
        {#if success}
          <div class="alert alert-success">{success}</div>
        {/if}

        <div class="form-actions">
          <button
            class="btn-publish"
            onclick={publishMessage}
            disabled={isPublishing || !channelName.trim()}
          >
            {isPublishing ? "Publishing..." : "Publish"}
          </button>
        </div>
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

  .header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .help-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.8125rem;
    color: #374151;
    text-decoration: none;
    white-space: nowrap;
  }

  .help-link:hover {
    background: #f3f4f6;
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .help-link {
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-200);
  }

  :global([data-mode="dark"]) .help-link:hover {
    background: rgb(var(--color-surface-700));
  }

  .panel-content {
    padding: 1.5rem;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-row {
    display: flex;
    gap: 0.75rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }

  .field-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
  }

  :global([data-mode="dark"]) .field-label {
    color: var(--color-surface-300);
  }

  .field-label .optional {
    font-weight: 400;
    color: #9ca3af;
  }

  .field-input,
  .field-textarea {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: monospace;
  }

  .field-input:focus,
  .field-textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .field-input:disabled,
  .field-textarea:disabled {
    background: #f9fafb;
    cursor: not-allowed;
    opacity: 0.6;
  }

  :global([data-mode="dark"]) .field-input,
  :global([data-mode="dark"]) .field-textarea {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .field-input:focus,
  :global([data-mode="dark"]) .field-textarea:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .field-textarea {
    resize: vertical;
    min-height: 100px;
  }

  .form-actions {
    padding-top: 0.5rem;
  }

  .btn-publish {
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

  .btn-publish:hover:not(:disabled) {
    background: #3d9e52;
  }

  .btn-publish:disabled {
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
  }

  :global([data-mode="dark"]) .alert-success {
    background: rgb(var(--color-success-900));
    color: rgb(var(--color-success-200));
    border-color: rgb(var(--color-success-800));
  }

  @media (max-width: 768px) {
    .form-row {
      flex-direction: column;
    }
  }
</style>
