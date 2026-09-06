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
  import { configHelpers } from "$lib/config";

  // Props
  export let hasApiAccess: boolean = false;
  export let size: "small" | "medium" | "large" = "medium";
  export let showDetails: boolean = false;
  export let inline: boolean = false;

  // Configuration
  $: obpInfo = configHelpers.getObpConnectionInfo();
  $: connectionStatus = hasApiAccess ? "connected" : "disconnected";
  $: statusColor = hasApiAccess ? "#10b981" : "#ef4444";
  $: statusIcon = hasApiAccess ? "🟢" : "🔴";
  $: statusText = hasApiAccess ? "Connected" : "Disconnected";

  // Size configurations
  $: sizeClasses = {
    small: {
      container: "status-container-small",
      dot: "status-dot-small",
      text: "status-text-small",
      details: "status-details-small"
    },
    medium: {
      container: "status-container-medium",
      dot: "status-dot-medium",
      text: "status-text-medium",
      details: "status-details-medium"
    },
    large: {
      container: "status-container-large",
      dot: "status-dot-large",
      text: "status-text-large",
      details: "status-details-large"
    }
  };

  $: currentSize = sizeClasses[size];

  // Animation for the status dot
  let pulseAnimation = hasApiAccess;
  $: pulseAnimation = hasApiAccess;
</script>

<div
  class="status-indicator {currentSize.container}"
  class:inline={inline}
  title="OBP Server: {obpInfo.displayName} - {statusText}"
>
  <!-- Status Dot with Animation -->
  <div
    class="status-dot {currentSize.dot}"
    class:pulse={pulseAnimation}
    style="background-color: {statusColor};"
  >
    <div class="status-dot-inner"></div>
  </div>

  <!-- Status Text -->
  <div class="status-content">
    <span class="status-text {currentSize.text}">
      {statusText}
    </span>

    {#if showDetails}
      <div class="status-details {currentSize.details}">
        <div class="detail-row">
          <span class="detail-label">Host:</span>
          <span class="detail-value">{obpInfo.displayName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="detail-value" style="color: {statusColor};">
            {statusIcon} {statusText}
          </span>
        </div>
        {#if hasApiAccess}
          <div class="detail-row">
            <span class="detail-label">API:</span>
            <span class="detail-value">Available</span>
          </div>
        {:else}
          <div class="detail-row">
            <span class="detail-label">Issue:</span>
            <span class="detail-value">Cannot reach server</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Base Status Indicator */
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-indicator.inline {
    display: inline-flex;
  }

  /* Status Dot Animations and Styles */
  .status-dot {
    position: relative;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .status-dot-inner {
    width: 50%;
    height: 50%;
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
  }

  .status-dot.pulse {
    animation: pulse-animation 2s infinite;
  }

  @keyframes pulse-animation {
    0% {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
    }
  }

  /* Size Variations */

  /* Small Size */
  .status-container-small {
    font-size: 0.75rem;
  }

  .status-dot-small {
    width: 8px;
    height: 8px;
  }

  .status-text-small {
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-details-small {
    font-size: 0.625rem;
  }

  /* Medium Size */
  .status-container-medium {
    font-size: 0.875rem;
  }

  .status-dot-medium {
    width: 12px;
    height: 12px;
  }

  .status-text-medium {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-details-medium {
    font-size: 0.75rem;
  }

  /* Large Size */
  .status-container-large {
    font-size: 1rem;
  }

  .status-dot-large {
    width: 16px;
    height: 16px;
  }

  .status-text-large {
    font-size: 1rem;
    font-weight: 600;
  }

  .status-details-large {
    font-size: 0.875rem;
  }

  /* Content Styles */
  .status-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .status-text {
    color: #374151;
    line-height: 1.2;
  }

  .status-details {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  .detail-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .detail-label {
    font-weight: 500;
    min-width: 2.5rem;
  }

  .detail-value {
    font-family: monospace;
    color: #374151;
  }

  /* Responsive Design */
  @media (max-width: 640px) {
    .status-indicator:not(.inline) {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }

    .status-details {
      width: 100%;
    }

    .detail-row {
      justify-content: space-between;
    }
  }

  /* Hover Effects */
  .status-indicator:hover .status-dot {
    transform: scale(1.1);
    transition: transform 0.2s ease-in-out;
  }

  .status-indicator:hover .status-text {
    color: #1f2937;
    transition: color 0.2s ease-in-out;
  }

  /* Dark Mode Support (if needed) */
  @media (prefers-color-scheme: dark) {
    .status-text {
      color: #e5e7eb;
    }

    .status-details {
      color: #9ca3af;
    }

    .detail-value {
      color: #e5e7eb;
    }

    .status-indicator:hover .status-text {
      color: #f9fafb;
    }
  }
</style>
