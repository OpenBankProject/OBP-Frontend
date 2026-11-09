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
    import { MessageSquare, Plus, Archive, Settings, Copy, Check, LogIn, Globe, User, Users } from '@lucide/svelte';
    import { page } from '$app/state';
    import Avatar from '$shared/avatar/Avatar.svelte';
    import { roomAvatarSeed } from '$shared/avatar/generate';
    import { isDirectMessage, chatRoomDisplayName } from './room';
    import { CHAT_LABELS, chatMessage, type ChatLabels } from './labels';

    /** The User's chat rooms, newest activity first, with creating a room and a link to join one. */
    let {
        data,
        form,
        labels = CHAT_LABELS.en,
        basePath = '/user/chat'
    }: { data: any; form: any; labels?: ChatLabels; basePath?: string } = $props();
    let showCreateForm = $state(false);

    // Sort rooms: unread first (highest count first), then alphabetically
    // Sort rooms: unread first, then by most recent activity
    let sortedRooms = $derived(
        [...(data.chatRooms || [])].sort((a: any, b: any) => {
            const unreadA = data.unreadCounts?.[a.chat_room_id] || 0;
            const unreadB = data.unreadCounts?.[b.chat_room_id] || 0;
            // Rooms with unread messages first
            if (unreadA > 0 && unreadB === 0) return -1;
            if (unreadA === 0 && unreadB > 0) return 1;
            // Then by most recent message activity
            const timeA = new Date(a.last_message_at || a.created_at).getTime();
            const timeB = new Date(b.last_message_at || b.created_at).getTime();
            return timeB - timeA;
        })
    );
    let copiedJoinLink = $state(false);

    function joinLink(joiningKey: string): string {
        return `${page.url.origin}${basePath}/join?joining_key=${encodeURIComponent(joiningKey)}`;
    }

    async function copyJoinLink(joiningKey: string) {
        try {
            await navigator.clipboard.writeText(joinLink(joiningKey));
            copiedJoinLink = true;
            setTimeout(() => copiedJoinLink = false, 2000);
        } catch {
            // Fallback: select the text
        }
    }
</script>

{#if form?.message && !form?.success}
    <div class="bg-error-500/10 border-error-500 mb-6 rounded-lg border p-4 text-center" data-testid="chat-room-error">
        <p class="text-error-500 font-semibold">{chatMessage(labels, form)}</p>
    </div>
{/if}

{#if form?.success && form?.createdRoom}
    <div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20" data-testid="created-room-info">
        <p class="mb-3 font-semibold text-green-600 dark:text-green-400">{chatMessage(labels, form)}</p>
        <div class="rounded-md bg-white/50 p-3 dark:bg-black/20">
            <p class="mb-1 text-sm font-medium text-surface-700-300">{labels.join_link_for} "{form.createdRoom.name}":</p>
            <div class="flex items-center gap-2">
                <code class="flex-1 break-all rounded bg-surface-200-700 px-2 py-1 text-xs" data-testid="join-link-text">
                    {joinLink(form.createdRoom.joining_key)}
                </code>
                <button
                    type="button"
                    class="btn btn-sm preset-outlined-surface-500 gap-1"
                    onclick={() => copyJoinLink(form.createdRoom.joining_key)}
                    data-testid="copy-join-link"
                >
                    {#if copiedJoinLink}
                        <Check class="size-4 text-green-500" />
                        {labels.copied}
                    {:else}
                        <Copy class="size-4" />
                        {labels.copy}
                    {/if}
                </button>
            </div>
            <p class="mt-2 text-xs text-surface-500">{labels.share_link}</p>
        </div>
        <a href="{basePath}/{form.createdRoom.chat_room_id}" class="btn btn-sm preset-filled-primary-500 mt-3 gap-1" data-testid="go-to-created-room">
            {labels.open_room}
        </a>
    </div>
{:else if form?.success}
    <div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20">
        <p class="font-semibold text-green-600 dark:text-green-400">{chatMessage(labels, form)}</p>
    </div>
{/if}

<!-- Actions -->
<div class="mb-6 flex gap-3 flex-wrap">
    <button
        type="button"
        class="btn preset-filled-primary-500 gap-2"
        onclick={() => showCreateForm = !showCreateForm}
        data-testid="create-chat-room-toggle"
    >
        <Plus class="size-4" />
        {labels.new_room}
    </button>
    <a
        href="{basePath}/join"
        class="btn preset-outlined-primary-500 gap-2"
        data-testid="join-chat-room-link"
    >
        <LogIn class="size-4 rtl:rotate-180" />
        {labels.join_room}
    </a>
</div>

<div class="mb-6">

    {#if showCreateForm}
        <form method="POST" action="?/create" class="mt-4 max-w-lg rounded-lg border border-surface-300-600 bg-surface-50-900 p-4" data-testid="create-chat-room-form">
            <div class="mb-4">
                <label for="chat-room-name" class="mb-1 block text-sm font-medium">{labels.name}</label>
                <input
                    id="chat-room-name"
                    name="name"
                    type="text"
                    required
                    class="input w-full rounded-md border border-surface-300-600 px-3 py-2"
                    placeholder={labels.name_placeholder}
                    data-testid="chat-room-name-input"
                />
            </div>
            <div class="mb-4">
                <label for="chat-room-description" class="mb-1 block text-sm font-medium">{labels.description}</label>
                <textarea
                    id="chat-room-description"
                    name="description"
                    class="textarea w-full rounded-md border border-surface-300-600 px-3 py-2"
                    rows="2"
                    placeholder={labels.description_placeholder}
                    data-testid="chat-room-description-input"
                ></textarea>
            </div>
            <div class="flex gap-2">
                <button type="submit" class="btn preset-filled-primary-500" data-testid="create-chat-room-submit">
                    {labels.create}
                </button>
                <button type="button" class="btn preset-outlined-surface-500" onclick={() => showCreateForm = false}>
                    {labels.cancel}
                </button>
            </div>
        </form>
    {/if}
</div>

<!-- Chat Rooms List -->
{#if data.chatRooms && data.chatRooms.length > 0}
    <div class="space-y-3">
        {#each sortedRooms as room (room.chat_room_id)}
            {@const unread = data.unreadCounts?.[room.chat_room_id] || 0}
            {@const isDm = isDirectMessage(room)}
            <div
                class="rounded-lg border border-surface-300-600 bg-surface-50-900 p-4"
                data-testid="chat-room-{room.chat_room_id}"
            >
                <div class="flex items-start justify-between gap-3">
                    <a href="{basePath}/{room.chat_room_id}" class="flex items-start gap-3 min-w-0 flex-1">
                        <Avatar
                            seed={roomAvatarSeed(room.chat_room_id)}
                            size={36}
                            shape="square"
                            title={chatRoomDisplayName(room)}
                        />
                        <div class="min-w-0">
                            <h3 class="font-semibold text-surface-900-50 truncate flex items-center gap-2">
                                <span class="truncate" dir="auto">{chatRoomDisplayName(room)}</span>
                                {#if isDm}
                                    <span class="inline-flex items-center gap-1 rounded-full bg-tertiary-500/10 px-2 py-0.5 text-xs font-normal text-tertiary-600 dark:text-tertiary-400 shrink-0" data-testid="dm-badge-{room.chat_room_id}">
                                        <User class="size-3" />
                                        {labels.dm}
                                    </span>
                                {/if}
                            </h3>
                            {#if room.last_message_preview}
                                <p class="mt-1 text-sm text-surface-600-400 truncate">
                                    <span class="font-medium">{room.last_message_sender_username || room.last_message_sender || labels.someone}:</span> <bdi>{room.last_message_preview}</bdi>
                                </p>
                            {:else if room.description}
                                <p class="mt-1 text-sm text-surface-600-400 line-clamp-2" dir="auto">
                                    {room.description}
                                </p>
                            {/if}
                            <p class="mt-2 flex items-center gap-2 text-xs text-surface-500">
                                {#if !isDm}
                                    <span class="inline-flex items-center gap-1" data-testid="participant-count-{room.chat_room_id}">
                                        <Users class="size-3" />
                                        {room.participant_count}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                {/if}
                                {#if room.last_message_at}
                                    <span>
                                        {new Date(room.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                        {new Date(room.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                {:else}
                                    <span>
                                        {labels.created} {new Date(room.created_at).toLocaleDateString()}{#if room.created_by_username} {labels.by} {room.created_by_username}{/if}
                                    </span>
                                {/if}
                            </p>
                        </div>
                    </a>
                    <div class="flex items-center gap-2 shrink-0">
                        {#if unread > 0}
                            <span
                                class="flex items-center justify-center rounded-full bg-primary-500 text-white text-xs font-bold min-w-[1.25rem] h-5 px-1.5"
                                data-testid="unread-badge-{room.chat_room_id}"
                            >
                                {unread > 99 ? '99+' : unread}
                            </span>
                        {/if}
                        {#if room.is_open_room}
                            <span class="flex items-center gap-1 rounded-full bg-primary-500/10 px-2 py-0.5 text-xs text-primary-600 dark:text-primary-400" data-testid="open-room-badge-{room.chat_room_id}">
                                <Globe class="size-3" />
                                {labels.open}
                            </span>
                        {/if}
                        {#if room.is_archived}
                            <span class="flex items-center gap-1 rounded-full bg-surface-200-700 px-2 py-0.5 text-xs text-surface-600-400">
                                <Archive class="size-3" />
                                {labels.archived}
                            </span>
                        {/if}
                        <a
                            href="{basePath}/{room.chat_room_id}/settings"
                            class="btn btn-sm preset-outlined-surface-500 gap-1"
                            aria-label={labels.room_settings}
                            data-testid="chat-room-settings-{room.chat_room_id}"
                        >
                            <Settings class="size-4" />
                        </a>
                    </div>
                </div>
            </div>
        {/each}
    </div>
{:else}
    <div class="rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-800">
        <MessageSquare class="mx-auto mb-3 size-10 text-gray-400" />
        <p class="text-gray-700 dark:text-gray-300">{labels.no_rooms}</p>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{labels.no_rooms_hint}</p>
    </div>
{/if}
