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
    padding-inline-end: 2.5rem;
    border-radius: 4px;
    border: 1px solid;
    font-size: 0.75rem;
    word-break: break-word;
  }

  /* Error type */
  .message-error {
    background: var(--ui-tone-error-bg);
    border-color: var(--ui-tone-error-border);
    color: var(--ui-tone-error-text);
  }

  /* Warning type */
  .message-warning {
    background: var(--ui-tone-warning-bg);
    border-color: var(--ui-tone-warning-border);
    color: var(--ui-tone-warning-text);
  }

  /* Info type */
  .message-info {
    background: var(--ui-tone-info-bg);
    border-color: var(--ui-tone-info-border);
    color: var(--ui-tone-info-text);
  }

  /* Success type */
  .message-success {
    background: var(--ui-tone-success-bg);
    border-color: var(--ui-tone-success-border);
    color: var(--ui-tone-success-text);
  }

  .message-text {
    margin: 0;
    line-height: 1.5;
  }

  .copy-button {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: var(--ui-panel);
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
    background: var(--ui-hover);
    transform: scale(1.1);
  }

  .copy-button:active {
    transform: scale(0.95);
  }
</style>
