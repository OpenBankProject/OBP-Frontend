<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  const AUTO_REFRESH_INTERVAL = 15_000;
  const AUTO_REFRESH_SECONDS = AUTO_REFRESH_INTERVAL / 1000;
  let autoRefreshTimer: ReturnType<typeof setInterval>;
  let countdownTimer: ReturnType<typeof setInterval>;
  let secondsUntilRefresh = $state(AUTO_REFRESH_SECONDS);

  interface Channel {
    channel_name: string;
    message_count: number;
    ttl_seconds: number;
  }

  interface SignalMessage {
    message_id: string;
    sender_user_id: string;
    sender_consumer_id: string;
    message_type: string;
    payload: any;
    timestamp: string;
    to_user_id?: string;
  }

  interface MessageNode {
    message: SignalMessage;
    children: MessageNode[];
    depth: number;
  }

  let channels = $state<Channel[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let lastUpdated = $state<string>("");
  let searchQuery = $state("");

  // Channel detail view
  let selectedChannel = $state<string | null>(null);
  let channelMessages = $state<SignalMessage[]>([]);
  let isLoadingMessages = $state(false);
  let messagesError = $state<string | null>(null);
  let messagesTotalCount = $state(0);
  let messagesHasMore = $state(false);

  // Delete state
  let deletingChannel = $state<string | null>(null);
  let deleteError = $state<string | null>(null);
  let deleteSuccess = $state<string | null>(null);

  let filteredChannels = $derived.by(() => {
    if (!channels.length) return [];
    if (!searchQuery.trim()) return channels;
    const q = searchQuery.toLowerCase();
    return channels.filter((ch) =>
      ch.channel_name.toLowerCase().includes(q),
    );
  });

  async function fetchChannels() {
    try {
      isLoading = true;
      error = null;
      secondsUntilRefresh = AUTO_REFRESH_SECONDS;

      const response = await fetch("/proxy/obp/v6.0.0/signal-channels");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message;
        throw new Error(
          `Failed to fetch signal channels (${response.status}): ${errorMsg}`,
        );
      }

      const data = await response.json();

      if (data.message) {
        throw new Error(data.message);
      }

      channels = data.channels || [];
      lastUpdated = new Date().toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to fetch signal channels";
    } finally {
      isLoading = false;
    }
  }

  async function fetchMessages(channelName: string) {
    try {
      isLoadingMessages = true;
      messagesError = null;

      const response = await fetch(
        `/proxy/obp/v6.0.0/signal-channels/${encodeURIComponent(channelName)}/messages?limit=50`,
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message;
        throw new Error(
          `Failed to fetch messages (${response.status}): ${errorMsg}`,
        );
      }

      const data = await response.json();

      if (data.message) {
        throw new Error(data.message);
      }

      channelMessages = data.messages || [];
      messagesTotalCount = data.total_count || 0;
      messagesHasMore = data.has_more || false;
    } catch (err) {
      messagesError =
        err instanceof Error ? err.message : "Failed to fetch messages";
    } finally {
      isLoadingMessages = false;
    }
  }

  async function deleteChannel(channelName: string) {
    if (
      !confirm(
        `Are you sure you want to delete channel "${channelName}" and all its messages?`,
      )
    ) {
      return;
    }

    try {
      deletingChannel = channelName;
      deleteError = null;
      deleteSuccess = null;

      const response = await fetch(
        `/proxy/obp/v6.0.0/signal-channels/${encodeURIComponent(channelName)}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message;
        throw new Error(
          `Failed to delete channel (${response.status}): ${errorMsg}`,
        );
      }

      deleteSuccess = `Successfully deleted channel: ${channelName}`;

      if (selectedChannel === channelName) {
        selectedChannel = null;
        channelMessages = [];
      }

      await fetchChannels();
    } catch (err) {
      deleteError =
        err instanceof Error ? err.message : "Failed to delete channel";
    } finally {
      deletingChannel = null;
    }
  }

  function selectChannel(channelName: string) {
    if (selectedChannel === channelName) {
      selectedChannel = null;
      channelMessages = [];
      return;
    }
    selectedChannel = channelName;
    fetchMessages(channelName);
  }

  function formatTTL(seconds: number): string {
    if (seconds <= 0) return "Expired";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }

  function formatTimestamp(timestamp: string): string {
    if (!timestamp) return "N/A";
    try {
      const date = new Date(timestamp);
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return String(timestamp);
    }
  }

  function formatPayload(payload: any): string {
    if (payload === null || payload === undefined) return "N/A";
    if (typeof payload === "string") return payload;
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }

  // Build a tree from flat messages using payload.reply_to for threading
  function buildMessageTree(messages: SignalMessage[]): MessageNode[] {
    const byId = new Map<string, MessageNode>();
    const roots: MessageNode[] = [];

    // Create nodes for all messages
    for (const msg of messages) {
      byId.set(msg.message_id, { message: msg, children: [], depth: 0 });
    }

    // Link children to parents
    for (const msg of messages) {
      const replyTo = msg.payload?.in_reply_to;
      const node = byId.get(msg.message_id)!;

      if (replyTo && byId.has(replyTo)) {
        const parent = byId.get(replyTo)!;
        node.depth = parent.depth + 1;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Sort roots: most recent first
    roots.sort((a, b) =>
      new Date(b.message.timestamp).getTime() - new Date(a.message.timestamp).getTime()
    );

    // Sort children within each node: oldest first (chronological thread order)
    function sortChildren(node: MessageNode) {
      node.children.sort((a, b) =>
        new Date(a.message.timestamp).getTime() - new Date(b.message.timestamp).getTime()
      );
      for (const child of node.children) {
        sortChildren(child);
      }
    }

    for (const root of roots) {
      sortChildren(root);
    }

    return roots;
  }

  // Flatten tree into an ordered list for rendering
  function flattenTree(nodes: MessageNode[]): MessageNode[] {
    const result: MessageNode[] = [];
    function walk(node: MessageNode) {
      result.push(node);
      for (const child of node.children) {
        walk(child);
      }
    }
    for (const root of nodes) {
      walk(root);
    }
    return result;
  }

  let messageTree = $derived.by(() => {
    if (!channelMessages.length) return [];
    return flattenTree(buildMessageTree(channelMessages));
  });

  onMount(() => {
    fetchChannels();
    autoRefreshTimer = setInterval(() => {
      if (!isLoading) {
        fetchChannels();
        secondsUntilRefresh = AUTO_REFRESH_SECONDS;
      }
    }, AUTO_REFRESH_INTERVAL);
    countdownTimer = setInterval(() => {
      if (secondsUntilRefresh > 0) secondsUntilRefresh--;
    }, 1000);
  });

  onDestroy(() => {
    clearInterval(autoRefreshTimer);
    clearInterval(countdownTimer);
  });
</script>

<svelte:head>
  <title>Signal Channels - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div>
          <h1 class="panel-title">Signal Channels</h1>
          <div class="panel-subtitle">
            Discover active signal channels and browse messages as an agent would see them
          </div>
        </div>
        <div class="header-controls">
          <div class="header-actions">
            <a
              href="/system/signal-publish"
              class="publish-link"
              data-testid="signal-publish-link"
            >
              + Publish signal
            </a>
            <button
              class="refresh-button"
              onclick={fetchChannels}
              disabled={isLoading}
              aria-label="Refresh signal channels"
              data-testid="signal-channels-refresh"
            >
            <svg
              class="refresh-icon"
              class:spinning={isLoading}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"
              />
            </svg>
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {#if lastUpdated}
            <div class="last-updated">
              Last updated: <span class="timestamp">{lastUpdated}</span>
              — next refresh in {String(secondsUntilRefresh).padStart(2, "0")}s
            </div>
          {/if}
        </div>
      </div>
    </div>
    <div class="panel-content">
      <!-- Status Messages -->
      {#if deleteSuccess}
        <div class="alert alert-success">
          {deleteSuccess}
        </div>
      {/if}
      {#if deleteError}
        <div class="alert alert-error">
          <strong>Error:</strong>
          {deleteError}
        </div>
      {/if}
      {#if error}
        <div class="alert alert-error">
          <strong>Error:</strong>
          {error}
        </div>
      {/if}

      {#if isLoading && !channels.length}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading signal channels...</p>
        </div>
      {:else if channels.length > 0}
        <!-- Search -->
        <div class="search-bar">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search channels..."
            class="search-input"
          />
          <span class="search-count">
            {filteredChannels.length} channel{filteredChannels.length !== 1 ? "s" : ""}
          </span>
        </div>

        <!-- Channels List -->
        {#if filteredChannels.length > 0}
          <div class="channels-list">
            {#each filteredChannels as channel}
              <div
                class="channel-card"
                class:selected={selectedChannel === channel.channel_name}
              >
                <div class="channel-header">
                  <button
                    class="channel-name-button"
                    onclick={() => selectChannel(channel.channel_name)}
                    title="Click to view messages"
                  >
                    {channel.channel_name}
                  </button>
                  <div class="channel-meta">
                    <span class="channel-count">
                      {channel.message_count?.toLocaleString() ?? "0"} message{channel.message_count !== 1 ? "s" : ""}
                    </span>
                    <span
                      class="ttl-badge"
                      class:ttl-low={channel.ttl_seconds < 300}
                      class:ttl-ok={channel.ttl_seconds >= 300}
                    >
                      TTL: {formatTTL(channel.ttl_seconds)}
                    </span>
                    <button
                      class="btn-delete"
                      onclick={() => deleteChannel(channel.channel_name)}
                      disabled={deletingChannel === channel.channel_name}
                      title="Delete channel"
                    >
                      {deletingChannel === channel.channel_name
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </div>

                <!-- Expanded message view -->
                {#if selectedChannel === channel.channel_name}
                  <div class="messages-panel">
                    <div class="messages-header">
                      <h3>Messages</h3>
                      {#if messagesTotalCount > 0}
                        <span class="messages-count">
                          {messagesTotalCount} total
                          {#if messagesHasMore}(showing first 50){/if}
                        </span>
                      {/if}
                    </div>

                    {#if isLoadingMessages}
                      <div class="loading-state small">
                        <div class="spinner small"></div>
                        <p>Loading messages...</p>
                      </div>
                    {:else if messagesError}
                      <div class="alert alert-error">
                        {messagesError}
                      </div>
                    {:else if messageTree.length > 0}
                      <div class="messages-list">
                        {#each messageTree as node}
                          <div
                            class="message-card"
                            class:is-reply={node.depth > 0}
                            style="margin-left: {node.depth * 1.5}rem;"
                          >
                            {#if node.depth > 0}
                              <div class="reply-indicator">
                                <span class="reply-line"></span>
                                <span class="reply-label">reply to {node.message.payload?.in_reply_to}</span>
                              </div>
                            {/if}
                            <div class="message-meta">
                              <span class="message-id" title={node.message.message_id}>
                                {node.message.message_id}
                              </span>
                              {#if node.message.message_type}
                                <span class="message-type-badge">
                                  {node.message.message_type}
                                </span>
                              {/if}
                              {#if node.message.to_user_id}
                                <span class="private-badge">Private</span>
                              {/if}
                              {#if node.children.length > 0}
                                <span class="replies-count">{node.children.length} {node.children.length === 1 ? "reply" : "replies"}</span>
                              {/if}
                              <span class="message-timestamp">
                                {formatTimestamp(node.message.timestamp)}
                              </span>
                            </div>
                            <div class="message-sender">
                              User: <span class="mono"
                                >{node.message.sender_user_id || "N/A"}</span
                              >
                              {#if node.message.sender_consumer_id}
                                | Consumer: <span class="mono"
                                  >{node.message.sender_consumer_id}</span
                                >
                              {/if}
                            </div>
                            <div class="message-payload">
                              <pre>{formatPayload(node.message.payload)}</pre>
                            </div>
                          </div>
                        {/each}
                      </div>
                    {:else}
                      <div class="empty-state small">
                        <p>No messages in this channel</p>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-state">
            <p>No channels match "{searchQuery}"</p>
          </div>
        {/if}
      {:else}
        <div class="empty-state">
          <p>No discoverable signal channels</p>
          <p class="empty-hint">
            Channels appear here when they contain at least one broadcast message.
            Private-only channels are not shown.
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1600px;
  }

  .panel {
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  :global([data-mode="dark"]) .panel {
    background: rgb(var(--color-surface-800));
  }

  .panel-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
  }

  .panel-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.5rem;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .header-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-end;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .publish-link {
    display: inline-flex;
    align-items: center;
    padding: 0.5rem 1rem;
    background: #16a34a;
    color: white;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: background-color 0.2s;
  }

  .publish-link:hover {
    background: #15803d;
  }

  :global([data-mode="dark"]) .publish-link {
    background: rgb(var(--color-success-600));
  }

  :global([data-mode="dark"]) .publish-link:hover {
    background: rgb(var(--color-success-500));
  }

  .refresh-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .refresh-button:hover:not(:disabled) {
    background: #2563eb;
  }

  .refresh-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .refresh-button {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .refresh-button:hover:not(:disabled) {
    background: rgb(var(--color-primary-500));
  }

  .refresh-icon {
    width: 16px;
    height: 16px;
  }

  .refresh-icon.spinning {
    animation: spin 1s linear infinite;
  }

  .last-updated {
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .last-updated {
    color: var(--color-surface-400);
  }

  .timestamp {
    font-family: monospace;
    font-weight: 500;
    color: #374151;
  }

  :global([data-mode="dark"]) .timestamp {
    color: var(--color-surface-300);
  }

  .panel-content {
    padding: 1.5rem;
  }

  /* Search */
  .search-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .search-input {
    flex: 1;
    max-width: 400px;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background: white;
    color: #111827;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  :global([data-mode="dark"]) .search-input {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  .search-count {
    font-size: 0.8125rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .search-count {
    color: var(--color-surface-400);
  }

  /* Channels List */
  .channels-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .channel-card {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
    transition: border-color 0.2s;
  }

  .channel-card:hover {
    border-color: #d1d5db;
  }

  .channel-card.selected {
    border-color: #93c5fd;
  }

  :global([data-mode="dark"]) .channel-card {
    border-color: rgb(var(--color-surface-700));
  }

  :global([data-mode="dark"]) .channel-card:hover {
    border-color: rgb(var(--color-surface-600));
  }

  :global([data-mode="dark"]) .channel-card.selected {
    border-color: rgb(var(--color-primary-700));
  }

  .channel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: white;
  }

  :global([data-mode="dark"]) .channel-header {
    background: rgb(var(--color-surface-800));
  }

  .channel-name-button {
    background: none;
    border: none;
    cursor: pointer;
    color: #2563eb;
    font-weight: 600;
    font-size: 0.9375rem;
    font-family: monospace;
    padding: 0;
  }

  .channel-name-button:hover {
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .channel-name-button {
    color: rgb(var(--color-primary-400));
  }

  .channel-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .channel-count {
    font-size: 0.8125rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .channel-count {
    color: var(--color-surface-400);
  }

  .ttl-badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: monospace;
  }

  .ttl-ok {
    background: #d1fae5;
    color: #065f46;
  }

  :global([data-mode="dark"]) .ttl-ok {
    background: rgb(var(--color-success-900));
    color: rgb(var(--color-success-200));
  }

  .ttl-low {
    background: #fef3c7;
    color: #92400e;
  }

  :global([data-mode="dark"]) .ttl-low {
    background: rgba(245, 158, 11, 0.2);
    color: rgb(252, 211, 77);
  }

  .btn-delete {
    padding: 0.25rem 0.75rem;
    border: none;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    background: #fee2e2;
    color: #991b1b;
  }

  .btn-delete:hover:not(:disabled) {
    background: #fecaca;
  }

  .btn-delete:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-delete {
    background: rgba(239, 68, 68, 0.2);
    color: rgb(252, 165, 165);
  }

  :global([data-mode="dark"]) .btn-delete:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.3);
  }

  /* Messages Panel */
  .messages-panel {
    padding: 1rem 1.25rem;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .messages-panel {
    background: rgb(var(--color-surface-900));
    border-top-color: rgb(var(--color-surface-700));
  }

  .messages-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .messages-header h3 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  :global([data-mode="dark"]) .messages-header h3 {
    color: var(--color-surface-200);
  }

  .messages-count {
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .messages-count {
    color: var(--color-surface-400);
  }

  .messages-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 500px;
    overflow-y: auto;
  }

  .message-card {
    padding: 0.75rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    transition: margin-left 0.2s;
  }

  .message-card.is-reply {
    border-left: 3px solid #93c5fd;
    background: #f8fafc;
  }

  :global([data-mode="dark"]) .message-card {
    background: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-700));
  }

  :global([data-mode="dark"]) .message-card.is-reply {
    border-left-color: rgb(var(--color-primary-700));
    background: rgb(var(--color-surface-850, var(--color-surface-800)));
  }

  .reply-indicator {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.375rem;
  }

  .reply-line {
    width: 12px;
    height: 1px;
    background: #93c5fd;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .reply-line {
    background: rgb(var(--color-primary-700));
  }

  .reply-label {
    font-size: 0.6875rem;
    color: #93c5fd;
    font-family: monospace;
  }

  :global([data-mode="dark"]) .reply-label {
    color: rgb(var(--color-primary-500));
  }

  .replies-count {
    font-size: 0.6875rem;
    color: #6b7280;
    font-style: italic;
  }

  :global([data-mode="dark"]) .replies-count {
    color: var(--color-surface-400);
  }

  .message-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
    flex-wrap: wrap;
  }

  .message-id {
    font-family: monospace;
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .message-id {
    color: var(--color-surface-400);
  }

  .message-type-badge {
    display: inline-block;
    padding: 0.0625rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    background: #dbeafe;
    color: #1e40af;
    text-transform: uppercase;
  }

  :global([data-mode="dark"]) .message-type-badge {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(147, 197, 253);
  }

  .private-badge {
    display: inline-block;
    padding: 0.0625rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    background: #fef3c7;
    color: #92400e;
  }

  :global([data-mode="dark"]) .private-badge {
    background: rgba(245, 158, 11, 0.2);
    color: rgb(252, 211, 77);
  }

  .message-timestamp {
    font-size: 0.75rem;
    color: #9ca3af;
    margin-left: auto;
  }

  :global([data-mode="dark"]) .message-timestamp {
    color: var(--color-surface-500);
  }

  .message-sender {
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 0.375rem;
  }

  :global([data-mode="dark"]) .message-sender {
    color: var(--color-surface-400);
  }

  .mono {
    font-family: monospace;
  }

  .message-payload {
    background: #f3f4f6;
    border-radius: 0.25rem;
    padding: 0.5rem;
    overflow-x: auto;
  }

  :global([data-mode="dark"]) .message-payload {
    background: rgb(var(--color-surface-900));
  }

  .message-payload pre {
    margin: 0;
    font-size: 0.75rem;
    font-family: monospace;
    white-space: pre-wrap;
    word-break: break-word;
    color: #374151;
  }

  :global([data-mode="dark"]) .message-payload pre {
    color: var(--color-surface-200);
  }

  /* Loading & Empty States */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
  }

  .loading-state.small {
    padding: 1.5rem;
    gap: 0.5rem;
  }

  .loading-state p {
    color: #6b7280;
  }

  :global([data-mode="dark"]) .loading-state p {
    color: var(--color-surface-400);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner.small {
    width: 24px;
    height: 24px;
    border-width: 3px;
  }

  :global([data-mode="dark"]) .spinner {
    border-color: rgb(var(--color-surface-700));
    border-top-color: rgb(var(--color-primary-400));
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  .empty-state.small {
    padding: 1.5rem;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
  }

  .empty-hint {
    font-size: 0.8125rem;
    margin-top: 0.5rem;
    color: #9ca3af;
  }

  :global([data-mode="dark"]) .empty-hint {
    color: var(--color-surface-500);
  }

  /* Alerts */
  .alert {
    padding: 0.75rem 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .alert-error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  :global([data-mode="dark"]) .alert-error {
    background: rgb(var(--color-error-900));
    color: rgb(var(--color-error-200));
    border-color: rgb(var(--color-error-800));
  }

  .alert-success {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }

  :global([data-mode="dark"]) .alert-success {
    background: rgb(var(--color-success-900));
    color: rgb(var(--color-success-200));
    border-color: rgb(var(--color-success-800));
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: stretch;
    }

    .header-controls {
      align-items: stretch;
    }

    .refresh-button {
      justify-content: center;
    }

    .channel-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .channel-meta {
      flex-wrap: wrap;
    }
  }
</style>
