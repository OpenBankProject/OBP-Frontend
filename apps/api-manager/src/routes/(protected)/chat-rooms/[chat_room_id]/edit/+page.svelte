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
    class="text-sm ui-link"
    data-testid="back-link"
  >
    &larr; Back to {level === "bank" ? "Bank" : "System"} Chat Rooms
  </a>
</div>

<div class="mb-4">
  <h1 class="text-2xl font-bold ui-text">
    Edit Chat Room
  </h1>
  <p class="text-sm font-mono mt-1 ui-muted">{chatRoomId}</p>
  <p class="text-xs mt-0.5 ui-muted">
    Level: {level}{bankId ? ` | Bank: ${bankId}` : ""}
  </p>
</div>

{#if successMessage}
  <div class="mb-4 rounded-lg border p-3 text-sm ui-tone-success" data-testid="success-message">
    {successMessage}
  </div>
{/if}

{#if error}
  <div class="mb-4 rounded-lg border p-3 text-sm ui-tone-error" data-testid="error-message">
    {error}
  </div>
{/if}

{#if loading}
  <div class="flex items-center justify-center py-8">
    <div class="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent border-current ui-text-brand"></div>
    <span class="ml-2 ui-muted">Loading...</span>
  </div>
{:else if room}
  <div class="rounded-lg border p-4 ui-card ui-border">
    <div class="mb-4">
      <h2 class="text-lg font-semibold ui-text">{room.name}</h2>
      {#if room.description}
        <p class="text-sm mt-0.5 ui-muted">{room.description}</p>
      {/if}
    </div>

    <div class="space-y-3">
      <div class="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_open_room"
          name="is_open_room"
          bind:checked={allUsers}
          class="h-4 w-4 rounded ui-link ui-panel ui-border"
          data-testid="open-room-input"
        />
        <label for="is_open_room" class="text-sm font-medium ui-muted">Open room</label>
      </div>
      <button
        onclick={save}
        disabled={saving}
        class="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 preset-filled-primary-500"
        data-testid="save-chat-room"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  </div>
{/if}
