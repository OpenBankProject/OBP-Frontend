<script lang="ts">
  import { page } from "$app/state";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import type { OBPChatRoom, OBPChatRoomParticipant } from "$lib/obp/types";

  const chatRoomId = $derived(page.params.chat_room_id);
  const level = $derived(page.url.searchParams.get("level") || "system");
  const bankId = $derived(page.url.searchParams.get("bank_id") || "");

  let room = $state<OBPChatRoom | null>(null);
  let participants = $state<OBPChatRoomParticipant[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let successMessage = $state<string | null>(null);

  let showAddForm = $state(false);
  let addUserId = $state("");
  let addPermissions = $state("can_send_message");

  async function fetchRoom() {
    if (!chatRoomId) return;
    try {
      const bankParam = bankId ? `?bank_id=${encodeURIComponent(bankId)}` : "";
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/chat-rooms/${encodeURIComponent(chatRoomId)}${bankParam}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch chat room");
      }
      room = await res.json();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch chat room";
      room = null;
    }
  }

  async function fetchParticipants() {
    if (!chatRoomId) return;
    loading = true;
    error = null;
    try {
      const bankParam = bankId ? `&bank_id=${encodeURIComponent(bankId)}` : "";
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/chat-rooms/${encodeURIComponent(chatRoomId)}/participants?level=${level}${bankParam}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch participants");
      }
      const data = await res.json();
      participants = data.participants || [];
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch participants";
      participants = [];
    } finally {
      loading = false;
    }
  }

  async function addParticipant() {
    if (!addUserId.trim() || !chatRoomId) return;
    error = null;
    successMessage = null;
    try {
      const bankParam = bankId ? `&bank_id=${encodeURIComponent(bankId)}` : "";
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/chat-rooms/${encodeURIComponent(chatRoomId)}/participants?level=${level}${bankParam}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: addUserId,
            permissions: addPermissions.split(",").map((p) => p.trim()).filter(Boolean),
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add participant");
      }
      successMessage = "Participant added.";
      addUserId = "";
      showAddForm = false;
      fetchParticipants();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to add participant";
    }
  }

  async function refreshJoiningKey() {
    if (!chatRoomId) return;
    error = null;
    successMessage = null;
    try {
      const endpoint =
        level === "bank" && bankId
          ? `/proxy/obp/v6.0.0/banks/${encodeURIComponent(bankId)}/chat-rooms/${encodeURIComponent(chatRoomId)}/joining-key`
          : `/proxy/obp/v6.0.0/chat-rooms/${encodeURIComponent(chatRoomId)}/joining-key`;
      const res = await trackedFetch(endpoint, { method: "PUT" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to refresh joining key");
      }
      successMessage = "Joining key refreshed.";
      fetchRoom();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to refresh joining key";
    }
  }

  async function copyJoiningKey() {
    if (!room?.joining_key) return;
    try {
      await navigator.clipboard.writeText(room.joining_key);
      successMessage = "Joining key copied.";
    } catch {
      error = "Could not copy to clipboard.";
    }
  }

  async function removeParticipant(userId: string) {
    if (!chatRoomId) return;
    error = null;
    successMessage = null;
    try {
      const bankParam = bankId ? `&bank_id=${encodeURIComponent(bankId)}` : "";
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/chat-rooms/${encodeURIComponent(chatRoomId)}/participants?user_id=${encodeURIComponent(userId)}&level=${level}${bankParam}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove participant");
      }
      successMessage = "Participant removed.";
      fetchParticipants();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to remove participant";
    }
  }

  function formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Unknown";
    }
  }

  $effect(() => {
    fetchRoom();
    fetchParticipants();
  });
</script>

<div class="mb-4">
  <a
    href="/chat-rooms/{level}"
    class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
    data-testid="back-link"
  >
    &larr; Back to {level === "bank" ? "Bank" : "System"} Chat Rooms
  </a>
</div>

<div class="flex items-center justify-between mb-4">
  <div>
    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
      Chat Room Participants
    </h1>
    <p class="text-sm text-gray-600 dark:text-gray-400 font-mono mt-1">{chatRoomId}</p>
    <p class="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
      Level: {level}{bankId ? ` | Bank: ${bankId}` : ""}
    </p>
  </div>
  <div class="flex items-center gap-3">
    {#if participants.length > 0}
      <span class="text-sm text-gray-600 dark:text-gray-400">
        Participants: {participants.length}
      </span>
    {/if}
    {#if !room?.is_open_room}
      <button
        onclick={() => (showAddForm = !showAddForm)}
        class="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        data-testid="add-participant-btn"
      >
        {showAddForm ? "Cancel" : "Add Participant"}
      </button>
    {/if}
  </div>
</div>

{#if room && !room.is_open_room && room.joining_key}
  <div class="mb-4 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800" data-testid="joining-key-panel">
    <div class="flex flex-wrap items-center gap-3">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Joining Key:</span>
      <code class="flex-1 min-w-0 truncate rounded bg-gray-100 px-2 py-1 font-mono text-sm text-gray-900 dark:bg-gray-900 dark:text-gray-100" data-testid="joining-key-value">{room.joining_key}</code>
      <button
        onclick={copyJoiningKey}
        class="inline-flex items-center rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        data-testid="copy-joining-key-btn"
      >
        Copy
      </button>
      <button
        onclick={refreshJoiningKey}
        class="inline-flex items-center rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        data-testid="refresh-joining-key-btn"
      >
        Refresh
      </button>
    </div>
  </div>
{/if}

{#if successMessage}
  <div class="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200" data-testid="success-message">
    {successMessage}
  </div>
{/if}

{#if error}
  <div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200" data-testid="error-message">
    {error}
  </div>
{/if}

{#if showAddForm}
  <div class="mb-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800" data-testid="add-participant-form">
    <h2 class="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Add Participant</h2>
    <div class="space-y-3">
      <div>
        <label for="user_id" class="block text-sm font-medium text-gray-700 dark:text-gray-300">User ID</label>
        <input
          type="text"
          id="user_id"
          bind:value={addUserId}
          class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          data-testid="participant-user-id-input"
        />
      </div>
      <div>
        <label for="permissions" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Permissions (comma-separated)</label>
        <input
          type="text"
          id="permissions"
          bind:value={addPermissions}
          placeholder="can_send_message, can_delete_message, can_update_room"
          class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          data-testid="participant-permissions-input"
        />
      </div>
      <button
        onclick={addParticipant}
        disabled={!addUserId.trim()}
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        data-testid="submit-add-participant"
      >
        Add
      </button>
    </div>
  </div>
{/if}

{#if loading}
  <div class="flex items-center justify-center py-8">
    <div class="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
    <span class="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
  </div>
{:else if participants.length > 0}
  <div class="overflow-x-auto">
    <table class="w-full border-collapse" data-testid="participants-table">
      <thead>
        <tr class="border-b-2 border-gray-200 dark:border-gray-700">
          <th class="text-left px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400">User ID</th>
          <th class="text-left px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400">Permissions</th>
          <th class="text-left px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400">Joined</th>
          <th class="text-left px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400">Muted</th>
          <th class="text-right px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each participants as participant (participant.participant_id)}
          <tr class="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50" data-testid="participant-row-{participant.user_id}">
            <td class="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
              <span class="font-medium">{participant.username || participant.user_id}</span>
              {#if participant.provider}
                <br /><span class="text-gray-500 dark:text-gray-500">{participant.provider}</span>
              {/if}
              {#if participant.username}
                <br /><span class="font-mono text-gray-500 dark:text-gray-500">{participant.user_id}</span>
              {/if}
              {#if participant.consumer_id}
                <br /><span class="text-gray-500">Consumer: {participant.consumer_name || participant.consumer_id}</span>
              {/if}
            </td>
            <td class="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
              <div class="flex flex-wrap gap-1">
                {#each participant.permissions as perm}
                  <span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {perm}
                  </span>
                {/each}
              </div>
            </td>
            <td class="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{formatDate(participant.joined_at)}</td>
            <td class="px-3 py-2 text-xs">
              <span class="rounded-full px-2 py-0.5 text-xs font-medium {participant.is_muted
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'}">
                {participant.is_muted ? "Muted" : "Active"}
              </span>
            </td>
            <td class="px-3 py-2 text-right">
              <button
                onclick={() => removeParticipant(participant.user_id)}
                class="inline-flex items-center rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-600 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                data-testid="remove-participant-{participant.user_id}"
              >
                Remove
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else if !error}
  <div class="rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-800" data-testid="empty-participants">
    {#if room?.is_open_room}
      <p class="text-lg font-medium text-gray-700 dark:text-gray-300" data-testid="everyone-label">
        This room is Open. Everyone can join.
      </p>
    {:else}
      <p class="text-lg font-medium text-gray-700 dark:text-gray-300">
        No participants found
      </p>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        Add a participant to this chat room.
      </p>
    {/if}
  </div>
{/if}
