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
  export let type: 'success' | 'warning' | 'error' | 'info' = 'info';
  export let title: string;
  export let message: string;
  export let dismissible: boolean = true;
  export let autoClose: boolean = false;
  export let duration: number = 5000;

  let visible = true;

  function dismiss() {
    visible = false;
  }

  // Auto close functionality
  if (autoClose) {
    setTimeout(() => {
      visible = false;
    }, duration);
  }

  $: iconPath = {
    success: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
    warning: "M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z",
    error: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z",
    info: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
  }[type];

  $: colorClasses = {
    success: 'notification-success',
    warning: 'notification-warning',
    error: 'notification-error',
    info: 'notification-info'
  }[type];
</script>

{#if visible}
  <div class="notification {colorClasses}" role="alert">
    <div class="notification-content">
      <div class="notification-icon">
        <svg fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d={iconPath} clip-rule="evenodd" />
        </svg>
      </div>

      <div class="notification-text">
        <div class="notification-title">{title}</div>
        <div class="notification-message">{message}</div>
      </div>

      {#if dismissible}
        <button
          class="notification-dismiss"
          on:click={dismiss}
          aria-label="Dismiss notification"
        >
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      {/if}
    </div>

    {#if autoClose}
      <div class="notification-progress">
        <div class="notification-progress-bar" style="animation-duration: {duration}ms;"></div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .notification {
    max-width: 28rem;
    margin: 1rem auto;
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    position: relative;
    overflow: hidden;
  }

  .notification-success {
    background-color: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
  }

  .notification-warning {
    background-color: #fffbeb;
    border: 1px solid #fed7aa;
    color: #92400e;
  }

  .notification-error {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
  }

  .notification-info {
    background-color: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1d4ed8;
  }

  .notification-content {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .notification-icon {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    margin-top: 0.125rem;
  }

  .notification-icon svg {
    width: 100%;
    height: 100%;
  }

  .notification-text {
    flex: 1;
    min-width: 0;
  }

  .notification-title {
    font-weight: 600;
    font-size: 0.875rem;
    line-height: 1.25;
    margin-bottom: 0.25rem;
  }

  .notification-message {
    font-size: 0.875rem;
    line-height: 1.4;
    opacity: 0.9;
  }

  .notification-dismiss {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
    margin-top: 0.125rem;
  }

  .notification-dismiss:hover {
    opacity: 1;
  }

  .notification-dismiss svg {
    width: 100%;
    height: 100%;
  }

  .notification-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 0.25rem;
    background-color: rgba(0, 0, 0, 0.1);
  }

  .notification-progress-bar {
    height: 100%;
    background-color: currentColor;
    opacity: 0.6;
    animation: progress-countdown linear;
    transform-origin: left;
  }

  @keyframes progress-countdown {
    from {
      transform: scaleX(1);
    }
    to {
      transform: scaleX(0);
    }
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .notification {
      margin: 0.5rem;
      padding: 0.875rem;
    }

    .notification-content {
      gap: 0.5rem;
    }

    .notification-title {
      font-size: 0.8125rem;
    }

    .notification-message {
      font-size: 0.8125rem;
    }
  }

  /* Animation for showing/hiding */
  .notification {
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      transform: translateY(-1rem);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>
