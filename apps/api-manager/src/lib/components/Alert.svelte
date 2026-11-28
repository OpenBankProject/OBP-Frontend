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
  interface Props {
    type?: "error" | "warning" | "info" | "success" | "missing-role";
    title?: string;
    message?: string;
    children?: any;
  }

  let { type = "info", title, message, children }: Props = $props();

  // Get icon based on type
  function getIcon(type: string): string {
    switch (type) {
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      case "success":
        return "✅";
      case "missing-role":
        return "🔒";
      case "info":
      default:
        return "ℹ️";
    }
  }
</script>

<div class="alert alert-{type}">
  <div class="alert-header">
    <span class="alert-icon">{getIcon(type)}</span>
    {#if title}
      <strong>{title}</strong>
    {/if}
  </div>
  {#if message}
    <p class="alert-message">{message}</p>
  {/if}
  {#if children}
    <div class="alert-content">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    border: 1px solid;
  }

  .alert-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
  }

  .alert-icon {
    font-size: 1.25rem;
    line-height: 1;
  }

  .alert-message {
    margin: 0.5rem 0 0 0;
    font-size: 0.875rem;
  }

  .alert-content {
    margin-top: 0.75rem;
  }

  /* Error Alert */
  .alert-error {
    background: var(--ui-tone-error-bg);
    border-color: var(--ui-tone-error-border);
    color: var(--ui-tone-error-text);
  }

  /* Warning Alert */
  .alert-warning {
    background: var(--ui-tone-warning-bg);
    border-color: var(--ui-tone-warning-border);
    color: var(--ui-tone-warning-text);
  }

  /* Success Alert */
  .alert-success {
    background: var(--ui-tone-success-bg);
    border-color: var(--ui-tone-success-border);
    color: var(--ui-tone-success-text);
  }

  /* Info Alert */
  .alert-info {
    background: var(--ui-tone-info-bg);
    border-color: var(--ui-tone-info-border);
    color: var(--ui-tone-info-text);
  }

  /* Missing Role Alert */
  .alert-missing-role {
    background: var(--ui-tone-warning-bg);
    border: 2px solid var(--ui-tone-warning-border);
    color: var(--ui-tone-warning-text);
    padding: 1.5rem;
  }
</style>
