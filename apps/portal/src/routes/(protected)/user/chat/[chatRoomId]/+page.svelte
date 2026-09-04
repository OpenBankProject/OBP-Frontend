<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { ArrowLeft, Send, Users, Settings, Pencil, Check, X, SmilePlus, Reply, Bold, Italic, Code, Link, List, SquareCode } from '@lucide/svelte';
    import { unreadCount } from '$lib/stores/unreadCount.svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import Avatar from '$lib/components/Avatar.svelte';
    import { userAvatarSeed, roomAvatarSeed } from '$lib/avatar/generate';
    import { messageSenderName } from '$lib/chat/sender';
    import { isDirectMessage } from '$lib/chat/room';
    import { chatRoomDisplayName } from '$lib/chat/room';
    import { filterLinksByHost, stripDangerousCharacters } from '@obp/shared/markdown';

    // Both renderMarkdown (Prism) and DOMPurify require browser globals — lazy-load them
    let renderMarkdown: ((content: string) => string) | null = $state(null);
    let DOMPurify: any = $state(null);
    if (browser) {
        Promise.all([
            import('@obp/shared/markdown'),
            import('dompurify')
        ]).then(([mdModule, dpModule]) => {
            // linkify: bare URLs become links; the link-host policy applied in
            // renderChatMessage keeps disallowed hosts from being clickable.
            renderMarkdown = (content: string) => mdModule.renderMarkdown(content, { linkify: true });
            DOMPurify = dpModule.default;
        });
    }

    const EMOJI_CHOICES = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

    let { data } = $props();

    let messages: any[] = $state([...data.messages]);
    let messageContent = $state('');
    let sending = $state(false);
    let errorMessage = $state('');
    let showParticipants = $state(false);
    let messagesContainer: HTMLDivElement | undefined = $state();
    let streamConnected = $state(false);
    let transportReason = $state('connecting…');
    let editingMessageId: string | null = $state(null);
    let editContent = $state('');

    // Reactions state: { [messageId]: [{emoji, user_id, username}] }
    let reactions: Record<string, Array<{emoji: string, user_id: string, username: string}>> = $state({});
    let emojiPickerMessageId: string | null = $state(null);

    // Reply state
    let replyingTo: any | null = $state(null);

    // Mention state
    let showMentionDropdown = $state(false);
    let mentionFilter = $state('');
    let mentionStartIndex = $state(0);
    let selectedMentionIndex = $state(0);
    let mentionedUserIds: string[] = $state([]);
    let messageInputEl: HTMLTextAreaElement | undefined = $state();

    let filteredParticipants = $derived(
        data.participants.filter((p: any) => {
            const name = (p.username || p.user_id).toLowerCase();
            return name.includes(mentionFilter.toLowerCase());
        })
    );

    function scrollToBottom() {
        if (messagesContainer) {
            setTimeout(() => {
                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }, 0);
        }
    }

    // Scroll to bottom on initial load
    $effect(() => {
        if (messagesContainer && messages.length > 0) {
            scrollToBottom();
        }
    });

    function appendMessage(msg: any) {
        const existingIds = new Set(messages.map(m => m.chat_message_id));
        if (!existingIds.has(msg.chat_message_id)) {
            messages = [...messages, msg];
            scrollToBottom();
            // If mouse is in the messages area, mark as read
            if (mouseInMessages) markAsReadIfNeeded();
        }
    }

    function handleMessageEvent(event: any) {
        if (event.event_type === 'deleted') {
            messages = messages.map(m =>
                m.chat_message_id === event.chat_message_id
                    ? { ...m, is_deleted: true, content: '' }
                    : m
            );
        } else if (event.event_type === 'updated') {
            const existing = messages.find(m => m.chat_message_id === event.chat_message_id);
            if (existing) {
                messages = messages.map(m =>
                    m.chat_message_id === event.chat_message_id
                        ? { ...m, content: event.content, updated_at: event.updated_at }
                        : m
                );
            } else {
                appendMessage(event);
            }
        } else if (event.event_type === 'reacted') {
            const msgId = event.chat_message_id;
            const existing = reactions[msgId] || [];
            // Deduplicate: don't add if this user already has this emoji
            const alreadyExists = existing.some(
                r => r.emoji === event.content && r.user_id === event.sender_user_id
            );
            if (!alreadyExists) {
                reactions[msgId] = [...existing, {
                    emoji: event.content,
                    user_id: event.sender_user_id,
                    username: event.sender_username
                }];
            }
        } else if (event.event_type === 'unreacted') {
            const msgId = event.chat_message_id;
            const existing = reactions[msgId] || [];
            reactions[msgId] = existing.filter(
                r => !(r.emoji === event.content && r.user_id === event.sender_user_id)
            );
        } else {
            appendMessage(event);
        }
    }

    // Group reactions by emoji for display
    function groupedReactions(messageId: string): Array<{emoji: string, count: number, userIds: string[], reactedByMe: boolean}> {
        const list = reactions[messageId] || [];
        const groups: Record<string, {emoji: string, userIds: string[]}> = {};
        for (const r of list) {
            if (!groups[r.emoji]) {
                groups[r.emoji] = { emoji: r.emoji, userIds: [] };
            }
            groups[r.emoji].userIds.push(r.user_id);
        }
        return Object.values(groups).map(g => ({
            emoji: g.emoji,
            count: g.userIds.length,
            userIds: g.userIds,
            reactedByMe: g.userIds.includes(data.currentUserId)
        }));
    }

    // Fetch reactions for all loaded messages on mount
    /**
     * Populate the reactions state from the reaction summaries already
     * embedded in the messages response (no extra API calls needed).
     */
    function loadReactionsFromMessages() {
        for (const msg of messages) {
            if (msg.reactions && msg.reactions.length > 0) {
                const flat: Array<{emoji: string, user_id: string, username: string}> = [];
                for (const r of msg.reactions) {
                    for (const uid of r.user_ids || []) {
                        flat.push({ emoji: r.emoji, user_id: uid, username: '' });
                    }
                }
                reactions[msg.chat_message_id] = flat;
            }
        }
    }

    async function toggleReaction(messageId: string, emoji: string) {
        const existing = reactions[messageId] || [];
        const myReaction = existing.find(r => r.emoji === emoji && r.user_id === data.currentUserId);

        if (myReaction) {
            // Optimistic remove
            reactions[messageId] = existing.filter(r => !(r.emoji === emoji && r.user_id === data.currentUserId));
            try {
                // The emoji is the last path segment on DELETE, not a body field -- the API
                // serves .../reactions/{emoji}, and .../reactions is only POST and GET.
                const res = await fetch(`/proxy/obp/v6.0.0/chat-rooms/${data.chatRoom.chat_room_id}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {
                    method: 'DELETE'
                });
                if (!res.ok) {
                    // Revert on failure. fetch only rejects on a network error, so without
                    // this check a 4xx left the reaction gone from the UI, still in the
                    // database, and back again on reload -- with nothing logged anywhere.
                    reactions[messageId] = [...(reactions[messageId] || []), myReaction];
                }
            } catch {
                // Revert on failure
                reactions[messageId] = [...(reactions[messageId] || []), myReaction];
            }
        } else {
            // Optimistic add
            const newReaction = { emoji, user_id: data.currentUserId, username: '' };
            reactions[messageId] = [...existing, newReaction];
            try {
                const res = await fetch(`/proxy/obp/v6.0.0/chat-rooms/${data.chatRoom.chat_room_id}/messages/${messageId}/reactions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ emoji })
                });
                if (!res.ok) {
                    // Revert on failure
                    reactions[messageId] = (reactions[messageId] || []).filter(r => r !== newReaction);
                }
            } catch {
                reactions[messageId] = (reactions[messageId] || []).filter(r => r !== newReaction);
            }
        }
    }

    function addReactionFromPicker(messageId: string, emoji: string) {
        emojiPickerMessageId = null;
        toggleReaction(messageId, emoji);
    }

    function scrollToMessage(messageId: string) {
        const el = messagesContainer?.querySelector(`[data-testid="message-${messageId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-primary-500/50');
            setTimeout(() => el.classList.remove('ring-2', 'ring-primary-500/50'), 1500);
        }
    }

    // --- SSE stream with polling fallback ---
    let eventSource: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    function connectSSE() {
        eventSource = new EventSource(`/backend/chat/${data.chatRoom.chat_room_id}/stream`);

        eventSource.onopen = () => {
            streamConnected = true;
            if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
        };

        eventSource.onmessage = (event) => {
            transportReason = '';
            try {
                const msg = JSON.parse(event.data);
                handleMessageEvent(msg);
            } catch {
                // Ignore parse errors
            }
        };

        eventSource.addEventListener('transport-error', (event: MessageEvent) => {
            try {
                const payload = JSON.parse(event.data);
                transportReason = payload.reason || 'gRPC transport error';
            } catch {
                transportReason = 'gRPC transport error';
            }
        });

        eventSource.onerror = () => {
            streamConnected = false;
            if (!transportReason || transportReason === 'connecting…') {
                transportReason = 'SSE connection to server failed';
            }
            eventSource?.close();
            eventSource = null;
            startPolling();
            setTimeout(connectSSE, 10000);
        };
    }

    let latestTimestamp = $derived.by(() => {
        if (messages.length === 0) return '';
        return messages.reduce((latest, msg) => {
            return msg.created_at > latest ? msg.created_at : latest;
        }, messages[0].created_at);
    });

    function startPolling() {
        if (pollInterval) return;
        pollInterval = setInterval(async () => {
            try {
                let url = `/proxy/obp/v6.0.0/chat-rooms/${data.chatRoom.chat_room_id}/messages`;
                if (latestTimestamp) {
                    url += `?from_date=${encodeURIComponent(latestTimestamp)}`;
                }
                const res = await fetch(url);
                if (!res.ok) return;

                const result = await res.json();
                if (result.messages && result.messages.length > 0) {
                    const existingIds = new Set(messages.map(m => m.chat_message_id));
                    const newMessages = result.messages.filter(
                        (m: any) => !existingIds.has(m.chat_message_id)
                    );
                    if (newMessages.length > 0) {
                        messages = [...messages, ...newMessages];
                        scrollToBottom();
                    }
                }
            } catch {
                // Silently ignore polling errors
            }
        }, 4000);
    }

    onMount(() => {
        connectSSE();
        loadReactionsFromMessages();
        // Mark as read on initial load (mouse is likely already in the area)
        markAsReadIfNeeded();
        window.addEventListener('focus', handleWindowFocus);
    });

    onDestroy(() => {
        eventSource?.close();
        if (pollInterval) clearInterval(pollInterval);
        if (readMarkerTimeout) clearTimeout(readMarkerTimeout);
        if (typeof window !== 'undefined') {
            window.removeEventListener('focus', handleWindowFocus);
        }
    });

    async function sendMessage(event: SubmitEvent) {
        event.preventDefault();
        const content = messageContent.trim();
        if (!content || sending) return;

        sending = true;
        errorMessage = '';

        try {
            const body: any = { content, mentioned_user_ids: mentionedUserIds };
            if (replyingTo) {
                body.reply_to_message_id = replyingTo.chat_message_id;
                body.thread_id = replyingTo.chat_message_id;
            }

            const res = await fetch(`/proxy/obp/v6.0.0/chat-rooms/${data.chatRoom.chat_room_id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const result = await res.json();

            if (!res.ok) {
                errorMessage = result.message;
                return;
            }

            appendMessage(result);
            messageContent = '';
            replyingTo = null;
            if (messageInputEl) messageInputEl.style.height = 'auto';
            mentionedUserIds = [];
        } catch {
            errorMessage = 'Failed to send message. Please try again.';
        } finally {
            sending = false;
        }
    }

    function startEdit(message: any) {
        editingMessageId = message.chat_message_id;
        editContent = message.content;
    }

    let startingDm = $state(false);
    let dmStatus = $state('');
    async function startDm(targetUserId: string) {
        if (!targetUserId || startingDm) return;
        startingDm = true;
        dmStatus = 'Opening chat…';
        try {
            const res = await fetch('/backend/chat/start-dm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: targetUserId })
            });
            const result = await res.json();
            if (!res.ok) {
                errorMessage = result.message || 'Failed to start chat';
                dmStatus = '';
                return;
            }
            if (result.chat_room_id === data.chatRoom.chat_room_id) {
                dmStatus = 'You are already in this chat.';
                setTimeout(() => { dmStatus = ''; }, 2500);
                return;
            }
            await goto(`/user/chat/${result.chat_room_id}`);
            dmStatus = '';
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : 'Failed to start chat';
            dmStatus = '';
        } finally {
            startingDm = false;
        }
    }

    function cancelEdit() {
        editingMessageId = null;
        editContent = '';
    }

    async function saveEdit() {
        if (!editingMessageId || !editContent.trim()) return;

        const originalMessage = messages.find(m => m.chat_message_id === editingMessageId);
        if (!originalMessage || originalMessage.content === editContent.trim()) {
            cancelEdit();
            return;
        }

        try {
            const res = await fetch(`/proxy/obp/v6.0.0/chat-rooms/${data.chatRoom.chat_room_id}/messages`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_message_id: editingMessageId,
                    content: editContent.trim()
                })
            });

            const result = await res.json();

            if (!res.ok) {
                errorMessage = result.message;
                return;
            }

            messages = messages.map(m =>
                m.chat_message_id === editingMessageId
                    ? { ...m, content: editContent.trim(), updated_at: result.updated_at || new Date().toISOString() }
                    : m
            );
            cancelEdit();
        } catch {
            errorMessage = 'Failed to edit message. Please try again.';
        }
    }

    function handleEditKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            saveEdit();
        } else if (event.key === 'Escape') {
            cancelEdit();
        }
    }

    // --- Mention autocomplete ---
    function handleMessageInput() {
        if (!messageInputEl) return;
        const pos = messageInputEl.selectionStart || 0;
        const text = messageContent.slice(0, pos);

        // Only show mention autocomplete for rooms with a curated participant list.
        // is_open_room = "open room" (planned rename to is_open_room)
        if (data.chatRoom.is_open_room) {
            showMentionDropdown = false;
            return;
        }

        // Find the last @ that starts a mention (preceded by whitespace or start of string)
        const match = text.match(/(?:^|[\s])@([^\s]*)$/);
        if (match) {
            mentionFilter = match[1];
            mentionStartIndex = pos - match[1].length - 1; // position of the @
            selectedMentionIndex = 0;
            showMentionDropdown = true;
        } else {
            showMentionDropdown = false;
        }
    }

    function insertMention(participant: any) {
        const username = participant.username || participant.user_id;
        const before = messageContent.slice(0, mentionStartIndex);
        const after = messageContent.slice(mentionStartIndex + 1 + mentionFilter.length);
        messageContent = `${before}@${username} ${after}`;
        if (!mentionedUserIds.includes(participant.user_id)) {
            mentionedUserIds = [...mentionedUserIds, participant.user_id];
        }
        showMentionDropdown = false;
        // Restore focus and cursor position
        setTimeout(() => {
            if (messageInputEl) {
                messageInputEl.focus();
                const newPos = before.length + 1 + username.length + 1;
                messageInputEl.setSelectionRange(newPos, newPos);
            }
        }, 0);
    }

    function handleInputKeydown(event: KeyboardEvent) {
        // Mention dropdown takes priority when open
        if (showMentionDropdown && filteredParticipants.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                selectedMentionIndex = (selectedMentionIndex + 1) % filteredParticipants.length;
                return;
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                selectedMentionIndex = (selectedMentionIndex - 1 + filteredParticipants.length) % filteredParticipants.length;
                return;
            } else if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                insertMention(filteredParticipants[selectedMentionIndex]);
                return;
            } else if (event.key === 'Escape') {
                showMentionDropdown = false;
                return;
            }
        }

        // Enter sends, Shift+Enter inserts newline
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (messageContent.trim() && !sending) {
                messageInputEl?.form?.requestSubmit();
            }
        }
    }

    // Auto-resize textarea to fit content
    function autoResize() {
        if (messageInputEl) {
            messageInputEl.style.height = 'auto';
            messageInputEl.style.height = Math.min(messageInputEl.scrollHeight, 150) + 'px';
        }
    }

    // Parse message content into segments for rendering mentions
    /**
     * Render a chat message as sanitized HTML with markdown and @mention highlighting.
     * Markdown is rendered first, then @mentions are highlighted in the HTML text nodes.
     */
    function renderChatMessage(message: any): string {
        // The API strips control/bidi-override characters on input; stripping
        // here too covers messages stored before that policy existed.
        const content = stripDangerousCharacters(message.content || '');
        if (!content) return '';

        // Before markdown/DOMPurify are loaded, show plain text (escaped)
        if (!renderMarkdown || !DOMPurify) {
            const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<p>${escaped}</p>`;
        }

        // Render markdown to HTML, then make links open in new tabs
        let html = renderMarkdown(content)
            .replace(/<a href="/g, '<a target="_blank" rel="noopener noreferrer" href="');

        // Highlight @mentions in the rendered HTML
        const mentionIds: string[] = message.mentioned_user_ids || [];
        if (mentionIds.length > 0) {
            const mentionedUsernames = new Set<string>();
            for (const uid of mentionIds) {
                const p = data.participants.find((p: any) => p.user_id === uid);
                if (p) mentionedUsernames.add(p.username || p.user_id);
            }
            if (mentionedUsernames.size > 0) {
                const escaped = [...mentionedUsernames].map(u => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                const mentionRegex = new RegExp(`(@(?:${escaped.join('|')}))(?=\\s|[<&]|$)`, 'g');
                html = html.replace(mentionRegex, `<span class="font-semibold bg-primary-500/20 rounded px-0.5">$1</span>`);
            }
        }

        // Sanitize to prevent XSS — allow class attributes for styling
        const sanitized = DOMPurify.sanitize(html, {
            ADD_ATTR: ['class'],
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'a', 'ul', 'ol', 'li',
                           'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'span', 'del', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
        });
        // Anti-phishing: links to hosts outside this deployment's own services
        // stay as inert text (the author's words are kept, just not clickable).
        return filterLinksByHost(sanitized, data.allowedLinkHosts);
    }

    // --- Read marker logic ---
    // Track when we last marked the room as read, to avoid redundant PUTs.
    let lastMarkedReadAt: string = $state('');
    let readMarkerTimeout: ReturnType<typeof setTimeout> | null = null;
    let mouseInMessages = $state(false);
    let roomCountCleared = false;

    function markAsReadIfNeeded() {
        if (!latestTimestamp || latestTimestamp === lastMarkedReadAt) return;
        if (!document.hasFocus()) return;

        // Debounce: wait 1s of inactivity before sending
        if (readMarkerTimeout) clearTimeout(readMarkerTimeout);
        readMarkerTimeout = setTimeout(() => {
            lastMarkedReadAt = latestTimestamp;
            if (!roomCountCleared) {
                // First read in this room — subtract this room's unread from the header badge
                unreadCount.clearRoom(data.chatRoom.unread_count || 0);
                roomCountCleared = true;
            }
            fetch(`/proxy/obp/v6.0.0/users/current/chat-rooms/${data.chatRoom.chat_room_id}/read-marker`, { method: 'PUT' });
        }, 1000);
    }

    function handleMessagesMouseEnter() {
        mouseInMessages = true;
        markAsReadIfNeeded();
    }

    function handleMessagesMouseLeave() {
        mouseInMessages = false;
    }

    function handleWindowFocus() {
        if (mouseInMessages) {
            markAsReadIfNeeded();
        }
    }

    // Auto-resize edit textarea on mount to fit existing content
    function autoResizeEdit(node: HTMLTextAreaElement) {
        setTimeout(() => {
            node.style.height = 'auto';
            node.style.height = Math.min(node.scrollHeight, 300) + 'px';
            node.focus();
            node.setSelectionRange(node.value.length, node.value.length);
        }, 0);
    }

    // --- Markdown formatting toolbar ---
    function insertFormatting(before: string, after: string, placeholder: string) {
        if (!messageInputEl) return;
        const start = messageInputEl.selectionStart || 0;
        const end = messageInputEl.selectionEnd || 0;
        const selected = messageContent.slice(start, end);
        const text = selected || placeholder;
        const newContent = messageContent.slice(0, start) + before + text + after + messageContent.slice(end);
        messageContent = newContent;
        // Place cursor after inserted text (or select the placeholder)
        setTimeout(() => {
            if (messageInputEl) {
                messageInputEl.focus();
                if (selected) {
                    const pos = start + before.length + text.length + after.length;
                    messageInputEl.setSelectionRange(pos, pos);
                } else {
                    messageInputEl.setSelectionRange(start + before.length, start + before.length + text.length);
                }
                // Programmatic value changes don't fire oninput, so grow the
                // textarea here too (e.g. a code block spans three lines).
                autoResize();
            }
        }, 0);
    }

    // Close emoji picker when clicking outside
    function handleWindowClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (emojiPickerMessageId) {
            if (!target.closest('[data-testid^="emoji-picker-"]') && !target.closest('[data-testid^="emoji-button-"]')) {
                emojiPickerMessageId = null;
            }
        }
        if (showMentionDropdown) {
            if (!target.closest('[data-testid="mention-dropdown"]') && !target.closest('[data-testid="message-input"]')) {
                showMentionDropdown = false;
            }
        }
    }
</script>

<svelte:window onclick={handleWindowClick} />

<!-- Chat Room Header -->
<div class="mb-4 flex items-center justify-between gap-3">
    <div class="flex items-center gap-3 min-w-0">
        <a
            href="/user/chat"
            class="btn btn-sm preset-outlined-surface-500 gap-1"
            data-testid="back-to-chat-rooms"
        >
            <ArrowLeft class="size-4" />
            Back
        </a>
        <Avatar
            seed={roomAvatarSeed(data.chatRoom.chat_room_id)}
            size={40}
            shape="square"
            title="Icon for {chatRoomDisplayName(data.chatRoom, data.participants, data.currentUserId)}"
        />
        <div class="min-w-0">
            <h2 class="text-lg font-semibold text-surface-900-50 truncate flex items-center gap-2" data-testid="chat-room-name">
                {chatRoomDisplayName(data.chatRoom, data.participants, data.currentUserId)}
                {#if isDirectMessage(data.chatRoom)}
                    <span class="inline-flex items-center rounded-full bg-tertiary-500/10 px-2 py-0.5 text-xs font-normal text-tertiary-600 dark:text-tertiary-400" data-testid="dm-badge">
                        DM
                    </span>
                {:else}
                    <span class="inline-flex items-center gap-1 text-xs font-normal text-surface-500" data-testid="participant-count">
                        <Users class="size-3" />
                        {data.chatRoom.participant_count}
                    </span>
                {/if}
            </h2>
            {#if data.chatRoom.description}
                <p class="text-sm text-surface-600-400 truncate">{data.chatRoom.description}</p>
            {/if}
        </div>
    </div>
    <div class="flex items-center gap-2">
        <span
            class="flex items-center"
            title={streamConnected
                ? 'gRPC live stream'
                : transportReason === 'connecting…'
                    ? 'Connecting to gRPC stream…'
                    : `REST polling — fell back because: ${transportReason || 'unknown reason'}`}
            data-testid="connection-status"
            data-transport={streamConnected ? 'grpc' : 'rest'}
        >
            <span
                class="inline-block size-2 rounded-full {streamConnected ? 'bg-green-500' : 'bg-orange-500'}"
                aria-hidden="true"
            ></span>
        </span>
        <button
            type="button"
            class="btn btn-sm preset-outlined-surface-500 gap-1"
            onclick={() => showParticipants = !showParticipants}
            data-testid="toggle-participants"
        >
            <Users class="size-4" />
            {data.participants.length}
        </button>
        <a
            href="/user/chat/{data.chatRoom.chat_room_id}/settings"
            class="btn btn-sm preset-outlined-surface-500 gap-1"
            title="Room settings"
            data-testid="chat-room-settings"
        >
            <Settings class="size-4" />
        </a>
    </div>
</div>

{#if showParticipants}
    <div class="mb-4 rounded-lg border border-surface-300-600 bg-surface-50-900 p-4" data-testid="participants-list">
        <h3 class="mb-2 text-sm font-semibold">Participants</h3>
        <ul class="space-y-1">
            {#each data.participants as participant (participant.participant_id)}
                <li class="text-sm text-surface-700-300" data-testid="participant-{participant.user_id}">
                    {participant.username || participant.user_id}
                    {#if participant.user_id === data.currentUserId}
                        <span class="text-xs text-primary-500">(you)</span>
                    {/if}
                </li>
            {/each}
        </ul>
    </div>
{/if}

{#if errorMessage}
    <div class="bg-error-500/10 border-error-500 mb-4 rounded-lg border p-3 text-center">
        <p class="text-error-500 text-sm font-semibold">{errorMessage}</p>
    </div>
{/if}

{#if dmStatus}
    <div class="bg-primary-500/10 border-primary-500 mb-4 rounded-lg border p-3 text-center" data-testid="dm-status">
        <p class="text-surface-900-50 text-sm font-semibold">{dmStatus}</p>
    </div>
{/if}

<!-- Messages -->
<div
    bind:this={messagesContainer}
    class="mb-4 space-y-3 rounded-lg border border-surface-300-600 bg-surface-50-900 p-4"
    style="min-height: 300px; max-height: 60vh; overflow-y: auto;"
    data-testid="messages-container"
    onmouseenter={handleMessagesMouseEnter}
    onmouseleave={handleMessagesMouseLeave}
>
    {#if messages.length > 0}
        {#each messages as message (message.chat_message_id)}
            {@const isOwn = message.sender_user_id === data.currentUserId}
            {@const msgReactions = groupedReactions(message.chat_message_id)}
            {@const senderName = messageSenderName(message)}
            <div
                class="group flex gap-2"
                data-testid="message-{message.chat_message_id}"
            >
                <div class="shrink-0 mt-1">
                    {#if isOwn}
                        <Avatar
                            seed={userAvatarSeed(senderName)}
                            size={32}
                            shape="circle"
                            title="Avatar for {senderName}"
                        />
                    {:else}
                        <button
                            type="button"
                            class="block rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-wait"
                            onclick={() => startDm(message.sender_user_id)}
                            disabled={startingDm}
                            title="Start a chat with {senderName}"
                            data-testid="avatar-start-dm-{message.chat_message_id}"
                        >
                            <Avatar
                                seed={userAvatarSeed(senderName)}
                                size={32}
                                shape="circle"
                                title="Avatar for {senderName}"
                            />
                        </button>
                    {/if}
                </div>
                <div class="relative flex-1 min-w-0">
                    <!-- Emoji picker popup -->
                    {#if emojiPickerMessageId === message.chat_message_id}
                        <div
                            class="absolute right-0 bottom-full mb-1 z-10 flex gap-1 rounded-lg border border-surface-300-600 bg-surface-50-900 p-2 shadow-lg"
                            data-testid="emoji-picker-{message.chat_message_id}"
                        >
                            {#each EMOJI_CHOICES as emoji}
                                <button
                                    type="button"
                                    class="rounded p-1 text-lg hover:bg-surface-200-700 transition-colors"
                                    onclick={() => addReactionFromPicker(message.chat_message_id, emoji)}
                                    data-testid="emoji-choice-{emoji}"
                                >
                                    {emoji}
                                </button>
                            {/each}
                        </div>
                    {/if}
                    <div class="rounded-lg px-4 py-2 bg-surface-100-800 text-surface-900-50 border-l-2 {isOwn ? 'border-primary-500' : 'border-transparent'}">
                        <p class="mb-1 text-xs font-semibold opacity-70" data-testid="message-sender">
                            {#if isOwn}
                                {senderName}
                            {:else}
                                <button
                                    type="button"
                                    class="hover:underline focus:underline focus:outline-none disabled:cursor-wait"
                                    onclick={() => startDm(message.sender_user_id)}
                                    disabled={startingDm}
                                    title="Start a chat with {senderName}"
                                    data-testid="sender-start-dm-{message.chat_message_id}"
                                >
                                    {senderName}
                                </button>
                            {/if}
                        </p>
                        {#if message.reply_to_message_id}
                            {@const parent = messages.find(m => m.chat_message_id === message.reply_to_message_id)}
                            <button
                                type="button"
                                class="mb-1 block w-full text-left border-l-2 border-surface-400 pl-2 text-xs opacity-60 truncate"
                                onclick={() => parent && scrollToMessage(parent.chat_message_id)}
                                data-testid="reply-ref-{message.chat_message_id}"
                            >
                                {#if parent}
                                    {messageSenderName(parent)}: {parent.content?.slice(0, 80)}{parent.content?.length > 80 ? '...' : ''}
                                {:else}
                                    Reply to a message
                                {/if}
                            </button>
                        {/if}
                        {#if message.is_deleted}
                            <p class="italic opacity-50">This message was deleted.</p>
                        {:else if editingMessageId === message.chat_message_id}
                            <div class="flex flex-col gap-1" data-testid="edit-message-form">
                                <textarea
                                    bind:value={editContent}
                                    onkeydown={handleEditKeydown}
                                    oninput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 300) + 'px'; }}
                                    use:autoResizeEdit
                                    class="w-full rounded border border-surface-400 bg-surface-50-900 px-2 py-1 text-sm text-inherit focus:outline-none focus:ring-1 focus:ring-primary-500 resize overflow-auto"
                                    rows="3"
                                    maxlength={data.maxMessageLength}
                                    data-testid="edit-message-input"
                                ></textarea>
                                <div class="flex justify-end gap-1">
                                    <button
                                        type="button"
                                        onclick={cancelEdit}
                                        class="rounded p-1 hover:bg-surface-200-700"
                                        title="Cancel (Esc)"
                                        data-testid="edit-cancel-button"
                                    >
                                        <X class="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onclick={saveEdit}
                                        class="rounded p-1 hover:bg-surface-200-700"
                                        title="Save (Enter)"
                                        data-testid="edit-save-button"
                                    >
                                        <Check class="size-3.5" />
                                    </button>
                                </div>
                            </div>
                        {:else}
                            <div class="chat-markdown break-words">{@html renderChatMessage(message)}</div>
                        {/if}
                        <p class="mt-1 text-xs opacity-50">
                            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {#if message.updated_at && message.updated_at !== message.created_at}
                                <span data-testid="message-edited-indicator">(edited)</span>
                            {/if}
                        </p>
                    </div>
                    <!-- Reaction badges -->
                    {#if msgReactions.length > 0}
                        <div class="flex flex-wrap gap-1 mt-1 justify-start" data-testid="reactions-{message.chat_message_id}">
                            {#each msgReactions as reaction}
                                <button
                                    type="button"
                                    class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors
                                        {reaction.reactedByMe
                                            ? 'border-primary-500 bg-primary-500/10 text-primary-700'
                                            : 'border-surface-300-600 bg-surface-100-800 text-surface-700-300 hover:border-surface-400'}"
                                    onclick={() => toggleReaction(message.chat_message_id, reaction.emoji)}
                                    title={reaction.reactedByMe ? 'Remove your reaction' : 'Add reaction'}
                                    data-testid="reaction-badge-{message.chat_message_id}-{reaction.emoji}"
                                >
                                    <span>{reaction.emoji}</span>
                                    <span>{reaction.count}</span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
                {#if !message.is_deleted && editingMessageId !== message.chat_message_id}
                    <div class="flex items-center gap-0.5 self-start mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {#if isOwn}
                            <button
                                type="button"
                                onclick={() => startEdit(message)}
                                title="Edit message"
                                data-testid="edit-message-{message.chat_message_id}"
                            >
                                <Pencil class="size-3.5 text-surface-500 hover:text-surface-700" />
                            </button>
                        {/if}
                        <button
                            type="button"
                            onclick={() => emojiPickerMessageId = emojiPickerMessageId === message.chat_message_id ? null : message.chat_message_id}
                            title="Add reaction"
                            data-testid="emoji-button-{message.chat_message_id}"
                        >
                            <SmilePlus class="size-3.5 text-surface-500 hover:text-surface-700" />
                        </button>
                        <button
                            type="button"
                            onclick={() => { replyingTo = message; }}
                            title="Reply"
                            data-testid="reply-button-{message.chat_message_id}"
                        >
                            <Reply class="size-3.5 text-surface-500 hover:text-surface-700" />
                        </button>
                    </div>
                {/if}
            </div>
        {/each}
    {:else}
        <div class="flex items-center justify-center py-12 text-surface-500">
            <p>No messages yet. Start the conversation!</p>
        </div>
    {/if}
</div>

<!-- Send Message -->
{#if !data.chatRoom.is_archived}
    {#if replyingTo}
        <div class="flex items-center gap-2 mb-2 rounded-lg border border-surface-300-600 bg-surface-100-800 px-3 py-2" data-testid="reply-preview">
            <div class="flex-1 min-w-0">
                <p class="text-xs text-surface-500">Replying to <span class="font-semibold">{messageSenderName(replyingTo)}</span></p>
                <p class="text-sm text-surface-700-300 truncate">{replyingTo.content}</p>
            </div>
            <button
                type="button"
                onclick={() => replyingTo = null}
                class="shrink-0"
                title="Cancel reply"
                data-testid="cancel-reply-button"
            >
                <X class="size-4 text-surface-500 hover:text-surface-700" />
            </button>
        </div>
    {/if}
    <form onsubmit={sendMessage} class="flex gap-2" data-testid="send-message-form">
        <div class="relative flex-1">
            {#if showMentionDropdown && filteredParticipants.length > 0}
                <div
                    class="absolute bottom-full mb-1 left-0 z-10 w-full max-h-40 overflow-y-auto rounded-lg border border-surface-300-600 bg-surface-50-900 shadow-lg"
                    data-testid="mention-dropdown"
                >
                    {#each filteredParticipants as participant, i (participant.user_id)}
                        <button
                            type="button"
                            class="block w-full text-left px-3 py-1.5 text-sm transition-colors
                                {i === selectedMentionIndex ? 'bg-primary-500/10 text-primary-700' : 'text-surface-700-300 hover:bg-surface-200-700'}"
                            onclick={() => insertMention(participant)}
                            data-testid="mention-option-{participant.user_id}"
                        >
                            @{participant.username || participant.user_id}
                        </button>
                    {/each}
                </div>
            {/if}
            <textarea
                bind:this={messageInputEl}
                name="content"
                bind:value={messageContent}
                oninput={() => { handleMessageInput(); autoResize(); }}
                onkeydown={handleInputKeydown}
                class="input w-full rounded-md border border-surface-300-600 px-3 py-2 resize-none overflow-hidden"
                placeholder={replyingTo ? 'Type your reply... (Shift+Enter for new line)' : 'Type a message... (Shift+Enter for new line)'}
                disabled={sending}
                autocomplete="off"
                rows="1"
                maxlength={data.maxMessageLength}
                data-testid="message-input"
            ></textarea>
            {#if messageContent.length > data.maxMessageLength - 500}
                <div class="text-xs text-surface-500 text-right" data-testid="message-length-counter">
                    {messageContent.length}/{data.maxMessageLength}
                </div>
            {/if}
            <div class="flex gap-0.5 mt-1" data-testid="formatting-toolbar">
                <button type="button" onclick={() => insertFormatting('**', '**', 'bold')} title="Bold" class="p-1 rounded text-surface-500 hover:text-surface-700 hover:bg-surface-200-700 transition-colors">
                    <Bold class="size-3.5" />
                </button>
                <button type="button" onclick={() => insertFormatting('*', '*', 'italic')} title="Italic" class="p-1 rounded text-surface-500 hover:text-surface-700 hover:bg-surface-200-700 transition-colors">
                    <Italic class="size-3.5" />
                </button>
                <button type="button" onclick={() => insertFormatting('`', '`', 'code')} title="Inline code" class="p-1 rounded text-surface-500 hover:text-surface-700 hover:bg-surface-200-700 transition-colors">
                    <Code class="size-3.5" />
                </button>
                <button type="button" onclick={() => insertFormatting('```\n', '\n```', 'code block')} title="Code block" class="p-1 rounded text-surface-500 hover:text-surface-700 hover:bg-surface-200-700 transition-colors">
                    <SquareCode class="size-3.5" />
                </button>
                <button type="button" onclick={() => insertFormatting('[', '](url)', 'link text')} title="Link" class="p-1 rounded text-surface-500 hover:text-surface-700 hover:bg-surface-200-700 transition-colors">
                    <Link class="size-3.5" />
                </button>
                <button type="button" onclick={() => insertFormatting('- ', '', 'list item')} title="List" class="p-1 rounded text-surface-500 hover:text-surface-700 hover:bg-surface-200-700 transition-colors">
                    <List class="size-3.5" />
                </button>
            </div>
        </div>
        <button
            type="submit"
            class="btn preset-filled-primary-500 gap-2"
            disabled={!messageContent.trim() || sending}
            data-testid="send-message-button"
        >
            <Send class="size-4" />
            {sending ? 'Sending...' : 'Send'}
        </button>
    </form>
{:else}
    <div class="rounded-lg bg-surface-200-700 p-3 text-center text-sm text-surface-600-400">
        This chat room is archived. No new messages can be sent.
    </div>
{/if}
