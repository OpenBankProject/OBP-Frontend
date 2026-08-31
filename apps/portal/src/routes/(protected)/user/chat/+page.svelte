<script lang="ts">
    import { MessageSquare, Plus, Archive, Settings, Copy, Check, LogIn, Globe, User, Users } from '@lucide/svelte';
    import { page } from '$app/state';
    import Avatar from '$lib/components/Avatar.svelte';
    import { roomAvatarSeed } from '$lib/avatar/generate';
    import { isDirectMessage, chatRoomDisplayName } from '$lib/chat/room';

    let { data, form } = $props();
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
        return `${page.url.origin}/user/chat/join?joining_key=${encodeURIComponent(joiningKey)}`;
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
        <p class="text-error-500 font-semibold">{form.message}</p>
    </div>
{/if}

{#if form?.success && form?.createdRoom}
    <div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20" data-testid="created-room-info">
        <p class="mb-3 font-semibold text-green-600 dark:text-green-400">{form.message}</p>
        <div class="rounded-md bg-white/50 p-3 dark:bg-black/20">
            <p class="mb-1 text-sm font-medium text-surface-700-300">Join link for "{form.createdRoom.name}":</p>
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
                        Copied
                    {:else}
                        <Copy class="size-4" />
                        Copy
                    {/if}
                </button>
            </div>
            <p class="mt-2 text-xs text-surface-500">Share this link with others so they can join the room.</p>
        </div>
        <a href="/user/chat/{form.createdRoom.chat_room_id}" class="btn btn-sm preset-filled-primary-500 mt-3 gap-1" data-testid="go-to-created-room">
            Open Chat Room
        </a>
    </div>
{:else if form?.success}
    <div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20">
        <p class="font-semibold text-green-600 dark:text-green-400">{form.message}</p>
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
        New Chat Room
    </button>
    <a
        href="/user/chat/join"
        class="btn preset-outlined-primary-500 gap-2"
        data-testid="join-chat-room-link"
    >
        <LogIn class="size-4" />
        Join a Room
    </a>
</div>

<div class="mb-6">

    {#if showCreateForm}
        <form method="POST" action="?/create" class="mt-4 max-w-lg rounded-lg border border-surface-300-600 bg-surface-50-900 p-4" data-testid="create-chat-room-form">
            <div class="mb-4">
                <label for="chat-room-name" class="mb-1 block text-sm font-medium">Name</label>
                <input
                    id="chat-room-name"
                    name="name"
                    type="text"
                    required
                    class="input w-full rounded-md border border-surface-300-600 px-3 py-2"
                    placeholder="e.g. General Discussion"
                    data-testid="chat-room-name-input"
                />
            </div>
            <div class="mb-4">
                <label for="chat-room-description" class="mb-1 block text-sm font-medium">Description</label>
                <textarea
                    id="chat-room-description"
                    name="description"
                    class="textarea w-full rounded-md border border-surface-300-600 px-3 py-2"
                    rows="2"
                    placeholder="Optional description"
                    data-testid="chat-room-description-input"
                ></textarea>
            </div>
            <div class="flex gap-2">
                <button type="submit" class="btn preset-filled-primary-500" data-testid="create-chat-room-submit">
                    Create
                </button>
                <button type="button" class="btn preset-outlined-surface-500" onclick={() => showCreateForm = false}>
                    Cancel
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
                class="rounded-lg border border-surface-300-600 bg-surface-50-900 p-4 transition-colors hover:bg-surface-100-800"
                data-testid="chat-room-{room.chat_room_id}"
            >
                <div class="flex items-start justify-between gap-3">
                    <a href="/user/chat/{room.chat_room_id}" class="flex items-start gap-3 min-w-0 flex-1">
                        <Avatar
                            seed={roomAvatarSeed(room.chat_room_id)}
                            size={36}
                            shape="square"
                            title="Icon for {chatRoomDisplayName(room)}"
                        />
                        <div class="min-w-0">
                            <h3 class="font-semibold text-surface-900-50 truncate flex items-center gap-2">
                                <span class="truncate">{chatRoomDisplayName(room)}</span>
                                {#if isDm}
                                    <span class="inline-flex items-center gap-1 rounded-full bg-tertiary-500/10 px-2 py-0.5 text-xs font-normal text-tertiary-600 dark:text-tertiary-400 shrink-0" data-testid="dm-badge-{room.chat_room_id}">
                                        <User class="size-3" />
                                        DM
                                    </span>
                                {/if}
                            </h3>
                            {#if room.last_message_preview}
                                <p class="mt-1 text-sm text-surface-600-400 truncate">
                                    <span class="font-medium">{room.last_message_sender || 'Someone'}:</span> {room.last_message_preview}
                                </p>
                            {:else if room.description}
                                <p class="mt-1 text-sm text-surface-600-400 line-clamp-2">
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
                                        Created {new Date(room.created_at).toLocaleDateString()}{#if room.created_by_username} by {room.created_by_username}{/if}
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
                                Open
                            </span>
                        {/if}
                        {#if room.is_archived}
                            <span class="flex items-center gap-1 rounded-full bg-surface-200-700 px-2 py-0.5 text-xs text-surface-600-400">
                                <Archive class="size-3" />
                                Archived
                            </span>
                        {/if}
                        <a
                            href="/user/chat/{room.chat_room_id}/settings"
                            class="btn btn-sm preset-outlined-surface-500 gap-1"
                            title="Room settings"
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
        <p class="text-gray-700 dark:text-gray-300">No chat rooms found.</p>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Create a new chat room to get started.</p>
    </div>
{/if}
