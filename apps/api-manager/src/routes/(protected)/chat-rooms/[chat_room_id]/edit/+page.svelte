<script lang="ts">
  import { page } from "$app/state";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import type { OBPChatRoom } from "$lib/obp/types";

  const chatRoomId = $derived(page.params.chat_room_id);
  const level = $derived(page.url.searchParams.get("level") || "system");
  const bankId = $derived(page.url.searchParams.get("bank_id") || "");

  let room = $state<OBPChatRoom | null>(null);
  let allUsers = $state(false);
  let loading = $state(false);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let successMessage = $state<string | null>(null);

  async function fetchRoom() {
    if (!chatRoomId) return;
    loading = true;
    error = null;
    try {
      const bankParam = bankId ? `?bank_id=${encodeURIComponent(bankId)}` : "";
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/chat-rooms/${encodeURIComponent(chatRoomId)}${bankParam}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      room = await res.json();
      allUsers = room?.is_open_room ?? false;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch chat room";
      room = null;
    } finally {
      loading = false;
    }
  }

  async function save() {
    if (!chatRoomId) return;
    saving = true;
    error = null;
    successMessage = null;
    try {
      const endpoint =
        level === "bank" && bankId
          ? `/proxy/obp/v6.0.0/banks/${encodeURIComponent(bankId)}/chat-rooms/${encodeURIComponent(chatRoomId)}/open-room`
          : `/proxy/obp/v6.0.0/chat-rooms/${encodeURIComponent(chatRoomId)}/open-room`;
      const res = await trackedFetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_open_room: allUsers }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      const updated = await res.json();
      room = updated;
      allUsers = updated?.is_open_room ?? allUsers;
      successMessage = "Chat room updated.";
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to update chat room";
    } finally {
      saving = false;
    }
  }

  $effect(() => {
    fetchRoom();
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

<div class="mb-4">
  <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
    Edit Chat Room
  </h1>
  <p class="text-sm text-gray-600 dark:text-gray-400 font-mono mt-1">{chatRoomId}</p>
  <p class="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
    Level: {level}{bankId ? ` | Bank: ${bankId}` : ""}
  </p>
</div>

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

{#if loading}
  <div class="flex items-center justify-center py-8">
    <div class="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
    <span class="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
  </div>
{:else if room}
  <div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
    <div class="mb-4">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{room.name}</h2>
      {#if room.description}
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{room.description}</p>
      {/if}
    </div>

    <div class="space-y-3">
      <div class="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_open_room"
          name="is_open_room"
          bind:checked={allUsers}
          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          data-testid="open-room-input"
        />
        <label for="is_open_room" class="text-sm font-medium text-gray-700 dark:text-gray-300">Open room</label>
      </div>
      <button
        onclick={save}
        disabled={saving}
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        data-testid="save-chat-room"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  </div>
{/if}
