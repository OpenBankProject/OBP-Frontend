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
  <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
    Bank Chat Rooms
    {#if currentBank.bankId}
      <span class="text-lg font-normal text-gray-500 dark:text-gray-400">({currentBank.bankId})</span>
    {/if}
  </h1>
  <div class="flex items-center gap-3">
    {#if chatRooms.length > 0}
      <span class="text-sm text-gray-600 dark:text-gray-400">Total: {chatRooms.length}</span>
    {/if}
    {#if currentBank.bankId}
      <button
        onclick={() => (showCreateForm = !showCreateForm)}
        class="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        data-testid="create-chat-room-btn"
      >
        {showCreateForm ? "Cancel" : "Create Chat Room"}
      </button>
    {/if}
  </div>
</div>

{#if !currentBank.bankId}
  <div class="rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-800">
    <p class="text-lg font-medium text-gray-700 dark:text-gray-300">
      Select a bank to view chat rooms
    </p>
  </div>
{:else}

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

  {#if showCreateForm}
    <div class="mb-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800" data-testid="create-chat-room-form">
      <h2 class="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Create Bank Chat Room</h2>
      <div class="space-y-3">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
          <input
            type="text"
            id="name"
            bind:value={createName}
            class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            data-testid="chat-room-name-input"
          />
        </div>
        <div>
          <label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea
            id="description"
            bind:value={createDescription}
            rows="2"
            class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            data-testid="chat-room-description-input"
          ></textarea>
        </div>
        <button
          onclick={createChatRoom}
          disabled={!createName.trim()}
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          data-testid="submit-create-chat-room"
        >
          Create
        </button>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-8">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
      <span class="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
    </div>
  {:else if chatRooms.length > 0}
    <div class="mb-3">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search chat rooms by name, description, or ID..."
        name="search"
        class="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-3 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
        data-testid="search-chat-rooms"
      />
      {#if searchQuery}
        <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
          Showing {filteredChatRooms.length} of {chatRooms.length} chat rooms
        </p>
      {/if}
    </div>

    <div class="space-y-2">
      {#each filteredChatRooms as room (room.chat_room_id)}
        <div
          class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          data-testid="chat-room-card-{room.chat_room_id}"
        >
          <div class="mb-2 flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                {room.name}
              </h2>
              {#if room.description}
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{room.description}</p>
              {/if}
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0 ml-2">
              <a
                href="/chat-rooms/{room.chat_room_id}?level=bank&bank_id={currentBank.bankId}"
                class="inline-flex items-center rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                data-testid="view-chat-room-{room.chat_room_id}"
              >
                Details
              </a>
              <a
                href="/chat-rooms/{room.chat_room_id}/edit?level=bank&bank_id={currentBank.bankId}"
                class="inline-flex items-center rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                data-testid="edit-chat-room-{room.chat_room_id}"
              >
                Edit
              </a>
              <button
                onclick={() => deleteChatRoom(room.chat_room_id)}
                class="inline-flex items-center rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-600 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                data-testid="delete-chat-room-{room.chat_room_id}"
              >
                Delete
              </button>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium {room.is_archived
                  ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'}"
              >
                {room.is_archived ? "Archived" : "Active"}
              </span>
            </div>
          </div>

          <div class="mt-2 space-y-1 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span class="font-medium text-gray-600 dark:text-gray-400">Chat Room ID:</span>
              <span class="sm:col-span-2 text-gray-900 dark:text-gray-100 font-mono">{room.chat_room_id}</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span class="font-medium text-gray-600 dark:text-gray-400">Created by:</span>
              <span class="sm:col-span-2 text-gray-900 dark:text-gray-100">
                {room.created_by_username || room.created_by}
                {#if room.created_by_provider}
                  <span class="text-gray-500 dark:text-gray-500">({room.created_by_provider})</span>
                {/if}
              </span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span class="font-medium text-gray-600 dark:text-gray-400">Created:</span>
              <span class="sm:col-span-2 text-gray-900 dark:text-gray-100">{formatDate(room.created_at)}</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span class="font-medium text-gray-600 dark:text-gray-400">Open room:</span>
              <span class="sm:col-span-2 text-gray-900 dark:text-gray-100">{room.is_open_room ? "Yes" : "No"}</span>
            </div>
            {#if room.joining_key}
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <span class="font-medium text-gray-600 dark:text-gray-400">Joining Key:</span>
                <span class="sm:col-span-2 text-gray-900 dark:text-gray-100 font-mono">{room.joining_key}</span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else if !error}
    <div class="rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-800">
      <p class="text-lg font-medium text-gray-700 dark:text-gray-300">
        No chat rooms found for {currentBank.bankId}
      </p>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        Create a chat room to get started.
      </p>
    </div>
  {/if}
{/if}
