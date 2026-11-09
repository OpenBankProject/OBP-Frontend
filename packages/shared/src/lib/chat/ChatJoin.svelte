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
    import { ArrowLeft, LogIn, MessageSquare } from '@lucide/svelte';

    import { CHAT_LABELS, chatMessage, type ChatLabels } from './labels';

    /** Joining a chat room with a join link or key. */
    let {
        data,
        form,
        labels = CHAT_LABELS.en,
        basePath = '/user/chat'
    }: { data: any; form: any; labels?: ChatLabels; basePath?: string } = $props();
</script>

<div class="max-w-lg">
    <div class="mb-6">
        <a
            href={basePath}
            class="btn btn-sm preset-outlined-surface-500 gap-1"
            data-testid="back-to-chat-rooms"
        >
            <ArrowLeft class="size-4 rtl:rotate-180" />
            {labels.back_to_rooms}
        </a>
    </div>

    <div class="rounded-lg border border-surface-300-600 bg-surface-50-900 p-6" data-testid="join-room-section">
        <div class="mb-4 flex items-center gap-3">
            <MessageSquare class="size-6 text-primary-500" />
            <h2 class="text-lg font-semibold text-surface-900-50">{labels.join_heading}</h2>
        </div>

        <p class="mb-4 text-sm text-surface-600-400">
            {labels.join_intro}
        </p>

        {#if form?.message}
            <div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-3 text-center">
                <p class="text-error-500 text-sm font-semibold">{chatMessage(labels, form)}</p>
            </div>
        {/if}

        {#if data.errorMessage}
            <div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-3 text-center">
                <p class="text-error-500 text-sm font-semibold">{chatMessage(labels, { code: data.errorCode, message: data.errorMessage })}</p>
            </div>
        {/if}

        {#if data.alreadyJoined}
            <div class="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-center dark:border-blue-800 dark:bg-blue-900/20">
                <p class="text-sm text-blue-600 dark:text-blue-400">{labels.already_member}</p>
                <a href={basePath} class="btn btn-sm preset-filled-primary-500 mt-2" data-testid="go-to-chat-rooms">
                    {labels.go_to_rooms}
                </a>
            </div>
        {/if}

        <form method="POST" action="?/join" data-testid="join-room-form">
            <div class="mb-4">
                <label for="joining-key" class="mb-1 block text-sm font-medium">{labels.join_key}</label>
                <input
                    id="joining-key"
                    name="joining_key"
                    type="text"
                    required
                    class="input w-full rounded-md border border-surface-300-600 px-3 py-2 font-mono"
                    placeholder={labels.join_placeholder}
                    data-testid="joining-key-input"
                />
            </div>
            <button type="submit" class="btn preset-filled-primary-500 gap-2" data-testid="join-room-submit">
                <LogIn class="size-4 rtl:rotate-180" />
                {labels.join_submit}
            </button>
        </form>
    </div>
</div>
