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
    import { ArrowLeft, Copy, Check, RefreshCw } from '@lucide/svelte';
    import { page } from '$app/state';

    let { data, form } = $props();

    let copiedJoinLink = $state(false);

    // Use the refreshed key if available, otherwise the one from the room data
    let joiningKey = $derived(form?.newJoiningKey || data.chatRoom.joining_key);

    function joinLink(joiningKey: string): string {
        return `${page.url.origin}/user/chat/join?joining_key=${encodeURIComponent(joiningKey)}`;
    }

    async function copyJoinLink() {
        try {
            await navigator.clipboard.writeText(joinLink(joiningKey));
            copiedJoinLink = true;
            setTimeout(() => copiedJoinLink = false, 2000);
        } catch {
            // Fallback
        }
    }
</script>

<div class="max-w-2xl">
    <!-- Header -->
    <div class="mb-6 flex items-center gap-3">
        <a
            href="/user/chat/{data.chatRoom.chat_room_id}"
            class="btn btn-sm preset-outlined-surface-500 gap-1"
            data-testid="back-to-chat-room"
        >
            <ArrowLeft class="size-4" />
            Back to Chat
        </a>
        <h2 class="text-lg font-semibold text-surface-900-50" data-testid="settings-title">
            Room Settings
        </h2>
    </div>

    {#if form?.message}
        <div class="bg-error-500/10 border-error-500 mb-6 rounded-lg border p-4 text-center">
            <p class="text-error-500 font-semibold">{form.message}</p>
        </div>
    {/if}

    {#if form?.success}
        <div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20">
            <p class="font-semibold text-green-600 dark:text-green-400">{form.message}</p>
        </div>
    {/if}

    <!-- Join Link Section -->
    <div class="mb-8 rounded-lg border border-surface-300-600 bg-surface-50-900 p-5" data-testid="join-link-section">
        <h3 class="mb-3 text-sm font-semibold text-surface-900-50">Join Link</h3>
        <p class="mb-3 text-sm text-surface-600-400">Share this link with others so they can join the room.</p>
        <div class="flex items-center gap-2 mb-3">
            <code class="flex-1 break-all rounded bg-surface-200-700 px-3 py-2 text-xs" data-testid="join-link-text">
                {joinLink(joiningKey)}
            </code>
            <button
                type="button"
                class="btn btn-sm preset-outlined-surface-500 gap-1"
                onclick={copyJoinLink}
                data-testid="copy-join-link"
            >
                {#if copiedJoinLink}
                    <Check class="size-4 text-green-500" />
                    Copied
                {:else}
                    <Copy class="size-4" />
                    Copy
                {/if}
            </button>
        </div>
        <form method="POST" action="?/refreshKey" class="inline">
            <button
                type="submit"
                class="btn btn-sm preset-outlined-surface-500 gap-1"
                data-testid="refresh-joining-key"
            >
                <RefreshCw class="size-4" />
                Refresh Key
            </button>
        </form>
        <p class="mt-2 text-xs text-surface-500">Refreshing the key invalidates the previous join link.</p>
    </div>

    <!-- Edit Room Section -->
    <div class="rounded-lg border border-surface-300-600 bg-surface-50-900 p-5" data-testid="edit-room-section">
        <h3 class="mb-3 text-sm font-semibold text-surface-900-50">Edit Room</h3>
        <form method="POST" action="?/update" data-testid="edit-room-form">
            <div class="mb-4">
                <label for="room-name" class="mb-1 block text-sm font-medium">Name</label>
                <input
                    id="room-name"
                    name="name"
                    type="text"
                    required
                    value={data.chatRoom.name}
                    class="input w-full rounded-md border border-surface-300-600 px-3 py-2"
                    data-testid="edit-room-name"
                />
            </div>
            <div class="mb-4">
                <label for="room-description" class="mb-1 block text-sm font-medium">Description</label>
                <textarea
                    id="room-description"
                    name="description"
                    class="textarea w-full rounded-md border border-surface-300-600 px-3 py-2"
                    rows="3"
                    data-testid="edit-room-description"
                >{data.chatRoom.description}</textarea>
            </div>
            <button type="submit" class="btn preset-filled-primary-500" data-testid="save-room-changes">
                Save Changes
            </button>
        </form>
    </div>
</div>
