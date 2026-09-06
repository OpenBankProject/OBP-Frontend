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
    type?: "error" | "warning" | "info" | "success";
    showCopy?: boolean;
  }

  let { message, type = "info", showCopy = true }: Props = $props();

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
</script>

<div class="message-box message-{type}">
  <p class="message-text">{message}</p>
  {#if showCopy}
    <button
      class="copy-button"
      onclick={copyToClipboard}
      title="Copy message"
      aria-label="Copy message to clipboard"
    >
      {#if copied}
        <Check size={14} />
      {:else}
        <Copy size={14} />
      {/if}
    </button>
  {/if}
</div>

<style>
  .message-box {
    position: relative;
    margin: 0.75rem 0;
    padding: 0.75rem;
    padding-right: 2.5rem;
    border-radius: 4px;
    border: 1px solid;
    font-size: 0.75rem;
    word-break: break-word;
  }

  /* Error type */
  .message-error {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #991b1b;
  }

  :global([data-mode="dark"]) .message-error {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: rgb(var(--color-error-200));
  }

  /* Warning type */
  .message-warning {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.3);
    color: #92400e;
  }

  :global([data-mode="dark"]) .message-warning {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.4);
    color: rgb(var(--color-warning-200));
  }

  /* Info type */
  .message-info {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
    color: #1e40af;
  }

  :global([data-mode="dark"]) .message-info {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.4);
    color: rgb(var(--color-primary-200));
  }

  /* Success type */
  .message-success {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
    color: #065f46;
  }

  :global([data-mode="dark"]) .message-success {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.4);
    color: rgb(var(--color-success-200));
  }

  .message-text {
    margin: 0;
    line-height: 1.5;
  }

  .copy-button {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
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
