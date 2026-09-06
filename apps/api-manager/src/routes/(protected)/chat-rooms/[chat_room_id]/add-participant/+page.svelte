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
  const roomQuery = $derived(
    `?level=${encodeURIComponent(level)}${bankId ? `&bank_id=${encodeURIComponent(bankId)}` : ""}`,
  );
  const roomLink = $derived(
    chatRoomId ? `/chat-rooms/${encodeURIComponent(chatRoomId)}${roomQuery}` : "",
  );

  let room = $state<OBPChatRoom | null>(null);
  let error = $state<string | null>(null);
  let successMessage = $state<string | null>(null);

  let addUserId = $state("");
  let addPermissions = $state("can_send_message");

  const portalUrl = $derived(page.data.externalLinks?.PORTAL_URL || "");
  const apiExplorerUrl = $derived(page.data.externalLinks?.API_EXPLORER_URL || "");

  const portalJoinUrl = $derived(
    room?.joining_key && portalUrl
      ? `${portalUrl}/user/chat/join?joining_key=${encodeURIComponent(room.joining_key)}`
      : "",
  );

  const joinOperationId = $derived(
    level === "bank" ? "OBPv6.0.0-joinBankChatRoom" : "OBPv6.0.0-joinSystemChatRoom",
  );
  const apiExplorerJoinUrl = $derived(
    apiExplorerUrl
      ? `${apiExplorerUrl}/resource-docs/OBPv6.0.0?operationid=${joinOperationId}`
      : "",
  );

  async function fetchRoom() {
    if (!chatRoomId) return;
    try {
      const bankParam = bankId ? `?bank_id=${encodeURIComponent(bankId)}` : "";
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/chat-rooms/${encodeURIComponent(chatRoomId)}${bankParam}`,
      );
      if (!res.ok) {
        const data = await res.json();
        if (typeof data.message !== "string") {
          throw new Error(
            `OBP error response missing 'message' field (HTTP ${res.status})`,
          );
        }
        throw new Error(data.message);
      }
      room = await res.json();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      room = null;
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
        const data = await res.json();
        if (typeof data.message !== "string") {
          throw new Error(
            `OBP error response missing 'message' field (HTTP ${res.status})`,
          );
        }
        throw new Error(data.message);
      }
      successMessage = "Participant added.";
      addUserId = "";
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
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
      const res = await trackedFetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json();
        if (typeof data.message !== "string") {
          throw new Error(
            `OBP error response missing 'message' field (HTTP ${res.status})`,
          );
        }
        throw new Error(data.message);
      }
      successMessage = "Joining key refreshed.";
      fetchRoom();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
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

  async function copyPortalJoinUrl() {
    if (!portalJoinUrl) return;
    try {
      await navigator.clipboard.writeText(portalJoinUrl);
      successMessage = "Portal join URL copied.";
    } catch {
      error = "Could not copy to clipboard.";
    }
  }

  $effect(() => {
    fetchRoom();
  });
</script>

<div class="mb-4">
  <a
    href={roomLink}
    class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
    data-testid="back-link"
  >
    &larr; Back to Chat Room
  </a>
</div>

<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
  <span class="font-mono">{chatRoomId}</span> &middot; Level: {level}{bankId ? ` · Bank: ${bankId}` : ""}
</p>

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

{#if room?.is_open_room}
  <div class="rounded-lg bg-gray-100 p-4 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300" data-testid="open-room-notice">
    This room is Open — every user is an implicit participant and no joining key is needed.
  </div>
{:else if room}
  <section class="mb-6">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Share joining key</h2>
    <div class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800" data-testid="joining-key-panel">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">Joining Key</span>
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

      {#if portalJoinUrl}
        <div class="flex flex-wrap items-center gap-3 mt-2">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">Portal join URL</span>
          <a
            href={portalJoinUrl}
            target="_blank"
            rel="noopener"
            class="flex-1 min-w-0 truncate rounded bg-gray-100 px-2 py-1 font-mono text-sm text-blue-700 hover:underline dark:bg-gray-900 dark:text-blue-400"
            data-testid="portal-join-url"
          >{portalJoinUrl}</a>
          <button
            onclick={copyPortalJoinUrl}
            class="inline-flex items-center rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            data-testid="copy-portal-join-url-btn"
          >
            Copy
          </button>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-32">
          Send this link to a user — they'll sign in to the Portal and join the room using the embedded key.
        </p>
      {/if}

      {#if apiExplorerJoinUrl}
        <div class="flex flex-wrap items-center gap-3 mt-2">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">API Explorer</span>
          <a
            href={apiExplorerJoinUrl}
            target="_blank"
            rel="noopener"
            class="text-sm text-blue-700 hover:underline dark:text-blue-400"
            data-testid="api-explorer-join-url"
          >
            {level === "bank" ? "Join Bank Chat Room" : "Join System Chat Room"} endpoint
          </a>
        </div>
      {/if}
    </div>
  </section>

  <section>
    <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Add directly by user ID</h2>
    <div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800" data-testid="add-participant-form">
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
  </section>
{/if}
