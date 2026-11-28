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
  import type { User, AuthInfo } from "$lib/types";

  export let user: User | null;
  export let authInfo: AuthInfo | null;

  $: isAuthenticated = !!user && authInfo?.authenticated;
  $: userInitials =
    user?.username?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    "?";
  $: displayName = user?.username || user?.email || "User";
</script>

<div class="auth-status-container">
  <div class="auth-info">
    {#if isAuthenticated}
      <div class="user-info">
        <div class="user-avatar">
          <span class="user-initials">{userInitials}</span>
        </div>
        <div class="user-details">
          <span class="user-name">{displayName}</span>
          <span class="user-status">Authenticated</span>
        </div>
      </div>
      <div class="status-badge status-success">
        <svg class="status-icon" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clip-rule="evenodd"
          />
        </svg>
        <span class="status-text">Connected</span>
      </div>
    {:else}
      <div class="status-badge status-error">
        <svg class="status-icon" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <span class="status-text">Not Authenticated</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .auth-status-container {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--ui-panel);
    border-radius: 0.5rem;
    border: 1px solid var(--ui-border);
  }

  .auth-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  .user-avatar {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background: var(--ui-fill-main-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: var(--ui-fill-main-text);
  }

  .user-initials {
    font-size: 1rem;
    line-height: 1;
  }

  .user-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .user-name {
    font-weight: 600;
    color: var(--ui-text);
    font-size: 0.95rem;
  }

  .user-status {
    font-size: 0.8rem;
    color: var(--ui-muted);
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-success {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
    border: 1px solid var(--ui-tone-success-border);
  }

  .status-error {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
    border: 1px solid var(--ui-tone-error-border);
  }

  .status-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .status-text {
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .auth-status-container {
      padding: 0.5rem;
    }

    .user-details {
      display: none;
    }

    .status-text {
      display: none;
    }
  }
</style>
