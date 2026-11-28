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
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import type { OBPChatRoom } from "$lib/obp/types";

  let chatRooms = $state<OBPChatRoom[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let successMessage = $state<string | null>(null);
  let searchQuery = $state("");
  let showCreateForm = $state(false);
  let createName = $state("");
  let createDescription = $state("");

  let filteredChatRooms = $derived.by(() => {
    if (!searchQuery.trim()) return chatRooms;
    const q = searchQuery.toLowerCase();
    return chatRooms.filter(
      (room) =>
        room.name?.toLowerCase().includes(q) ||
        room.description?.toLowerCase().includes(q) ||
        room.chat_room_id?.toLowerCase().includes(q) ||
        room.created_by?.toLowerCase().includes(q),
    );
  });

  async function fetchChatRooms(bankId: string) {
    if (!bankId) {
      chatRooms = [];
      error = null;
      return;
    }
    loading = true;
    error = null;
    try {
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/banks/${encodeURIComponent(bankId)}/chat-rooms`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      chatRooms = (data.chat_rooms || []).sort(
        (a: OBPChatRoom, b: OBPChatRoom) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch chat rooms";
      chatRooms = [];
    } finally {
      loading = false;
    }
  }

  async function createChatRoom() {
    if (!createName.trim() || !currentBank.bankId) return;
    error = null;
    successMessage = null;
    try {
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/banks/${encodeURIComponent(currentBank.bankId)}/chat-rooms`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: createName, description: createDescription }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      successMessage = "Chat room created successfully.";
      createName = "";
      createDescription = "";
      showCreateForm = false;
      fetchChatRooms(currentBank.bankId);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to create chat room";
    }
  }

  async function deleteChatRoom(chatRoomId: string) {
    if (!currentBank.bankId) return;
    error = null;
    successMessage = null;
    try {
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/banks/${encodeURIComponent(currentBank.bankId)}/chat-rooms/${encodeURIComponent(chatRoomId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      successMessage = "Chat room deleted.";
      fetchChatRooms(currentBank.bankId);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to delete chat room";
    }
  }

  function formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
      });
    } catch {
      return "Unknown";
    }
  }

  $effect(() => {
    const bankId = currentBank.bankId;
    fetchChatRooms(bankId);
  });
</script>

<div class="flex items-center justify-between mb-4">
  <h1 class="text-2xl font-bold ui-text">
    Bank Chat Rooms
    {#if currentBank.bankId}
      <span class="text-lg font-normal ui-muted">({currentBank.bankId})</span>
    {/if}
  </h1>
  <div class="flex items-center gap-3">
    {#if chatRooms.length > 0}
      <span class="text-sm ui-muted">Total: {chatRooms.length}</span>
    {/if}
    {#if currentBank.bankId}
      <button
        onclick={() => (showCreateForm = !showCreateForm)}
        class="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium preset-filled-primary-500"
        data-testid="create-chat-room-btn"
      >
        {showCreateForm ? "Cancel" : "Create Chat Room"}
      </button>
    {/if}
  </div>
</div>

{#if !currentBank.bankId}
  <div class="rounded-lg p-8 text-center ui-panel">
    <p class="text-lg font-medium ui-muted">
      Select a bank to view chat rooms
    </p>
  </div>
{:else}

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

  {#if showCreateForm}
    <div class="mb-4 rounded-lg border p-4 ui-card ui-border" data-testid="create-chat-room-form">
      <h2 class="mb-3 text-lg font-semibold ui-text">Create Bank Chat Room</h2>
      <div class="space-y-3">
        <div>
          <label for="name" class="block text-sm font-medium ui-muted">Name</label>
          <input
            type="text"
            id="name"
            bind:value={createName}
            class="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ui-card ui-text ui-border"
            data-testid="chat-room-name-input"
          />
        </div>
        <div>
          <label for="description" class="block text-sm font-medium ui-muted">Description</label>
          <textarea
            id="description"
            bind:value={createDescription}
            rows="2"
            class="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ui-card ui-text ui-border"
            data-testid="chat-room-description-input"
          ></textarea>
        </div>
        <button
          onclick={createChatRoom}
          disabled={!createName.trim()}
          class="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 preset-filled-primary-500"
          data-testid="submit-create-chat-room"
        >
          Create
        </button>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-8">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent border-current ui-text-brand"></div>
      <span class="ml-2 ui-muted">Loading...</span>
    </div>
  {:else if chatRooms.length > 0}
    <div class="mb-3">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search chat rooms by name, description, or ID..."
        name="search"
        class="block w-full rounded-lg border py-2 pl-3 pr-3 text-sm focus:outline-none focus:ring-1 ui-card ui-text ui-border"
        data-testid="search-chat-rooms"
      />
      {#if searchQuery}
        <p class="mt-1 text-xs ui-muted">
          Showing {filteredChatRooms.length} of {chatRooms.length} chat rooms
        </p>
      {/if}
    </div>

    <div class="space-y-2">
      {#each filteredChatRooms as room (room.chat_room_id)}
        <div
          class="rounded-lg border p-3 shadow-sm ui-card ui-border"
          data-testid="chat-room-card-{room.chat_room_id}"
        >
          <div class="mb-2 flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <h2 class="text-base font-semibold truncate ui-text">
                {room.name}
              </h2>
              {#if room.description}
                <p class="text-xs mt-0.5 ui-muted">{room.description}</p>
              {/if}
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0 ml-2">
              <a
                href="/chat-rooms/{room.chat_room_id}?level=bank&bank_id={currentBank.bankId}"
                class="inline-flex items-center rounded border px-2 py-1 text-xs font-medium ui-tone-info"
                data-testid="view-chat-room-{room.chat_room_id}"
              >
                Details
              </a>
              <a
                href="/chat-rooms/{room.chat_room_id}/edit?level=bank&bank_id={currentBank.bankId}"
                class="inline-flex items-center rounded border px-2 py-1 text-xs font-medium ui-card ui-hover ui-muted ui-border"
                data-testid="edit-chat-room-{room.chat_room_id}"
              >
                Edit
              </a>
              <button
                onclick={() => deleteChatRoom(room.chat_room_id)}
                class="inline-flex items-center rounded border px-2 py-1 text-xs font-medium ui-tone-error"
                data-testid="delete-chat-room-{room.chat_room_id}"
              >
                Delete
              </button>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium {room.is_archived
                  ? 'ui-panel ui-text'
                  : 'ui-tone-success'}"
              >
                {room.is_archived ? "Archived" : "Active"}
              </span>
            </div>
          </div>

          <div class="mt-2 space-y-1 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span class="font-medium ui-muted">Chat Room ID:</span>
              <span class="sm:col-span-2 font-mono ui-text">{room.chat_room_id}</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span class="font-medium ui-muted">Created by:</span>
              <span class="sm:col-span-2 ui-text">
                {room.created_by_username || room.created_by}
                {#if room.created_by_provider}
                  <span class="ui-muted">({room.created_by_provider})</span>
                {/if}
              </span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span class="font-medium ui-muted">Created:</span>
              <span class="sm:col-span-2 ui-text">{formatDate(room.created_at)}</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span class="font-medium ui-muted">Open room:</span>
              <span class="sm:col-span-2 ui-text">{room.is_open_room ? "Yes" : "No"}</span>
            </div>
            {#if room.joining_key}
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <span class="font-medium ui-muted">Joining Key:</span>
                <span class="sm:col-span-2 font-mono ui-text">{room.joining_key}</span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else if !error}
    <div class="rounded-lg p-8 text-center ui-panel">
      <p class="text-lg font-medium ui-muted">
        No chat rooms found for {currentBank.bankId}
      </p>
      <p class="mt-1 ui-muted">
        Create a chat room to get started.
      </p>
    </div>
  {/if}
{/if}
