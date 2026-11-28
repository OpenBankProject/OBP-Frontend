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
  import { apiActivity } from "$lib/stores/apiActivity";
</script>

{#if $apiActivity.isActive}
  <div class="api-indicator" class:pulsing={$apiActivity.isActive}></div>
{/if}

<style>
  .api-indicator {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    width: 12px;
    height: 12px;
    background: var(--ui-success);
    border-radius: 50%;
    z-index: 9999;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--ui-success) 40%, transparent);
    animation: pulse-and-fade 3s ease-in-out infinite;
  }

  @keyframes pulse-and-fade {
    0% {
      opacity: 1;
      transform: scale(1);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--ui-success) 40%, transparent);
    }
    50% {
      opacity: 0.4;
      transform: scale(1.3);
      box-shadow: 0 2px 16px color-mix(in srgb, var(--ui-success) 60%, transparent);
    }
    100% {
      opacity: 0.1;
      transform: scale(1);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--ui-success) 10%, transparent);
    }
  }

  :global([data-mode="dark"]) .api-indicator {
    background: var(--ui-link);
    box-shadow: 0 2px 8px color-mix(in srgb, var(--ui-link) 40%, transparent);
  }

  :global([data-mode="dark"]) .api-indicator {
    animation: pulse-and-fade-dark 3s ease-in-out infinite;
  }

  @keyframes pulse-and-fade-dark {
    0% {
      opacity: 1;
      transform: scale(1);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--ui-link) 40%, transparent);
    }
    50% {
      opacity: 0.4;
      transform: scale(1.3);
      box-shadow: 0 2px 16px color-mix(in srgb, var(--ui-link) 60%, transparent);
    }
    100% {
      opacity: 0.1;
      transform: scale(1);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--ui-link) 10%, transparent);
    }
  }
</style>
