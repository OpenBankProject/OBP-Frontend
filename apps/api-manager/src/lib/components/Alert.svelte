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
    background: #fee2e2;
    border-color: #fecaca;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .alert-error {
    background: rgb(var(--color-error-900));
    border-color: rgb(var(--color-error-700));
    color: rgb(var(--color-error-200));
  }

  /* Warning Alert */
  .alert-warning {
    background: #fef3c7;
    border-color: #fde047;
    color: #92400e;
  }

  :global([data-mode="dark"]) .alert-warning {
    background: rgb(var(--color-warning-900));
    border-color: rgb(var(--color-warning-700));
    color: rgb(var(--color-warning-200));
  }

  /* Success Alert */
  .alert-success {
    background: #d1fae5;
    border-color: #a7f3d0;
    color: #065f46;
  }

  :global([data-mode="dark"]) .alert-success {
    background: rgb(var(--color-success-900));
    border-color: rgb(var(--color-success-700));
    color: rgb(var(--color-success-200));
  }

  /* Info Alert */
  .alert-info {
    background: #dbeafe;
    border-color: #bfdbfe;
    color: #1e3a8a;
  }

  :global([data-mode="dark"]) .alert-info {
    background: rgb(var(--color-primary-900));
    border-color: rgb(var(--color-primary-700));
    color: rgb(var(--color-primary-200));
  }

  /* Missing Role Alert */
  .alert-missing-role {
    background: #fef3c7;
    border: 2px solid #f59e0b;
    color: #92400e;
    padding: 1.5rem;
  }

  :global([data-mode="dark"]) .alert-missing-role {
    background: rgb(var(--color-warning-900));
    border-color: rgb(var(--color-warning-600));
    color: rgb(var(--color-warning-200));
  }
</style>
