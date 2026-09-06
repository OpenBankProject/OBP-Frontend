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
    import { Toast } from '@skeletonlabs/skeleton-svelte';
    import { toaster } from '$shared/utils/toastService';
</script>

<Toast.Group {toaster}>
    {#snippet children(toast)}
        <Toast {toast}>
            <Toast.Message>
                <Toast.Title>{toast.title}</Toast.Title>
                {#if toast.description}
                    <Toast.Description>{toast.description}</Toast.Description>
                {/if}
            </Toast.Message>
            {#if toast.action}
                <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
            {/if}
            {#if toast.closable !== false}
                <Toast.CloseTrigger />
            {/if}
        </Toast>
    {/snippet}
</Toast.Group>