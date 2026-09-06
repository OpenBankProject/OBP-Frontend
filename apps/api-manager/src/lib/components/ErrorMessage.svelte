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
  import { Copy, Check } from "@lucide/svelte";

  interface Props {
    message: string;
    title?: string;
    type?: "error" | "warning" | "info";
    showCopy?: boolean;
  }

  let { message, title, type = "error", showCopy = true }: Props = $props();

  let copied = $state(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(message);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  function getIcon(type: string): string {
    switch (type) {
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      case "info":
        return "ℹ️";
      default:
        return "❌";
    }
  }
</script>

<div class="error-message error-{type}">
  <div class="error-header">
    <span class="error-icon">{getIcon(type)}</span>
    {#if title}
      <strong>{title}</strong>
    {/if}
    {#if showCopy}
      <button
        class="copy-button"
        onclick={copyToClipboard}
        title="Copy error message"
        aria-label="Copy error message to clipboard"
      >
        {#if copied}
          <Check size={16} />
        {:else}
          <Copy size={16} />
        {/if}
      </button>
    {/if}
  </div>
  <p class="error-text">{message}</p>
</div>

<style>
  .error-message {
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    border: 1px solid;
  }

  .error-error {
    background: #fee2e2;
    border-color: #fecaca;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .error-error {
    background: rgb(var(--color-error-900));
    border-color: rgb(var(--color-error-700));
    color: rgb(var(--color-error-200));
  }

  .error-warning {
    background: #fef3c7;
    border-color: #fde047;
    color: #92400e;
  }

  :global([data-mode="dark"]) .error-warning {
    background: rgb(var(--color-warning-900));
    border-color: rgb(var(--color-warning-700));
    color: rgb(var(--color-warning-200));
  }

  .error-info {
    background: #dbeafe;
    border-color: #bfdbfe;
    color: #1e3a8a;
  }

  :global([data-mode="dark"]) .error-info {
    background: rgb(var(--color-primary-900));
    border-color: rgb(var(--color-primary-700));
    color: rgb(var(--color-primary-200));
  }

  .error-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-size: 1rem;
  }

  .error-icon {
    font-size: 1.25rem;
    line-height: 1;
  }

  .error-text {
    margin: 0;
    font-size: 0.875rem;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .copy-button {
    margin-left: auto;
    background: rgba(0, 0, 0, 0.1);
    border: none;
    border-radius: 4px;
    padding: 0.375rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    color: inherit;
  }

  .copy-button:hover {
    background: rgba(0, 0, 0, 0.2);
    transform: scale(1.1);
  }

  .copy-button:active {
    transform: scale(0.95);
  }

  :global([data-mode="dark"]) .copy-button {
    background: rgba(255, 255, 255, 0.1);
  }

  :global([data-mode="dark"]) .copy-button:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
