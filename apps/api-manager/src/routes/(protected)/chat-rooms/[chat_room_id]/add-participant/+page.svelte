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
    class="text-sm ui-link"
    data-testid="back-link"
  >
    &larr; Back to Chat Room
  </a>
</div>

<p class="text-sm mb-4 ui-muted">
  <span class="font-mono">{chatRoomId}</span> &middot; Level: {level}{bankId ? ` · Bank: ${bankId}` : ""}
</p>

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

{#if room?.is_open_room}
  <div class="rounded-lg p-4 text-sm ui-panel ui-muted" data-testid="open-room-notice">
    This room is Open — every user is an implicit participant and no joining key is needed.
  </div>
{:else if room}
  <section class="mb-6">
    <h2 class="text-lg font-semibold mb-2 ui-text">Share joining key</h2>
    <div class="rounded-lg border p-3 ui-card ui-border" data-testid="joining-key-panel">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-sm font-medium w-32 ui-muted">Joining Key</span>
        <code class="flex-1 min-w-0 truncate rounded px-2 py-1 font-mono text-sm ui-panel ui-text" data-testid="joining-key-value">{room.joining_key}</code>
        <button
          onclick={copyJoiningKey}
          class="inline-flex items-center rounded border px-2 py-1 text-xs font-medium ui-card ui-hover ui-muted ui-border"
          data-testid="copy-joining-key-btn"
        >
          Copy
        </button>
        <button
          onclick={refreshJoiningKey}
          class="inline-flex items-center rounded border px-2 py-1 text-xs font-medium ui-card ui-hover ui-muted ui-border"
          data-testid="refresh-joining-key-btn"
        >
          Refresh
        </button>
      </div>

      {#if portalJoinUrl}
        <div class="flex flex-wrap items-center gap-3 mt-2">
          <span class="text-sm font-medium w-32 ui-muted">Portal join URL</span>
          <a
            href={portalJoinUrl}
            target="_blank"
            rel="noopener"
            class="flex-1 min-w-0 truncate rounded px-2 py-1 font-mono text-sm hover:underline ui-link ui-panel"
            data-testid="portal-join-url"
          >{portalJoinUrl}</a>
          <button
            onclick={copyPortalJoinUrl}
            class="inline-flex items-center rounded border px-2 py-1 text-xs font-medium ui-card ui-hover ui-muted ui-border"
            data-testid="copy-portal-join-url-btn"
          >
            Copy
          </button>
        </div>
        <p class="text-xs mt-1 ml-32 ui-muted">
          Send this link to a user — they'll sign in to the Portal and join the room using the embedded key.
        </p>
      {/if}

      {#if apiExplorerJoinUrl}
        <div class="flex flex-wrap items-center gap-3 mt-2">
          <span class="text-sm font-medium w-32 ui-muted">API Explorer</span>
          <a
            href={apiExplorerJoinUrl}
            target="_blank"
            rel="noopener"
            class="text-sm hover:underline ui-link"
            data-testid="api-explorer-join-url"
          >
            {level === "bank" ? "Join Bank Chat Room" : "Join System Chat Room"} endpoint
          </a>
        </div>
      {/if}
    </div>
  </section>

  <section>
    <h2 class="text-lg font-semibold mb-2 ui-text">Add directly by user ID</h2>
    <div class="rounded-lg border p-4 ui-card ui-border" data-testid="add-participant-form">
      <div class="space-y-3">
        <div>
          <label for="user_id" class="block text-sm font-medium ui-muted">User ID</label>
          <input
            type="text"
            id="user_id"
            bind:value={addUserId}
            class="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ui-card ui-text ui-border"
            data-testid="participant-user-id-input"
          />
        </div>
        <div>
          <label for="permissions" class="block text-sm font-medium ui-muted">Permissions (comma-separated)</label>
          <input
            type="text"
            id="permissions"
            bind:value={addPermissions}
            placeholder="can_send_message, can_delete_message, can_update_room"
            class="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ui-card ui-text ui-border"
            data-testid="participant-permissions-input"
          />
        </div>
        <button
          onclick={addParticipant}
          disabled={!addUserId.trim()}
          class="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 preset-filled-primary-500"
          data-testid="submit-add-participant"
        >
          Add
        </button>
      </div>
    </div>
  </section>
{/if}
