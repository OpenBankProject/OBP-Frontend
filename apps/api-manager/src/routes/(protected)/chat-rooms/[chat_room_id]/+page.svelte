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
  import { chatApiPaths } from "@obp/shared/chat";
  import type { OBPChatRoom, OBPChatRoomParticipant } from "$lib/obp/types";

  const chatRoomId = $derived(page.params.chat_room_id);
  const level = $derived(page.url.searchParams.get("level") || "system");
  const bankId = $derived(page.url.searchParams.get("bank_id") || "");

  const addParticipantLink = $derived(
    chatRoomId
      ? `/chat-rooms/${encodeURIComponent(chatRoomId)}/add-participant?level=${encodeURIComponent(level)}${bankId ? `&bank_id=${encodeURIComponent(bankId)}` : ""}`
      : "",
  );

  let room = $state<OBPChatRoom | null>(null);
  let participants = $state<OBPChatRoomParticipant[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let successMessage = $state<string | null>(null);

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
        const data = await res.json();
        if (typeof data.message !== "string") {
          throw new Error(
            `OBP error response missing 'message' field (HTTP ${res.status})`,
          );
        }
        throw new Error(data.message);
      }
      const data = await res.json();
      participants = data.participants;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      participants = [];
    } finally {
      loading = false;
    }
  }

  async function removeParticipant(userId: string) {
    if (!chatRoomId) return;
    error = null;
    successMessage = null;
    try {
      // The user id is in the path, and a bank's room is under its bank: OBP-API serves
      // DELETE .../participants/{user_id}, not DELETE .../participants?user_id=.
      const paths = chatApiPaths(bankId ? { kind: "bank", bankId } : { kind: "system" });
      const res = await trackedFetch(
        `/proxy${paths.participant(chatRoomId, userId)}`,
        { method: "DELETE" },
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
      successMessage = "Participant removed.";
      fetchParticipants();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
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
    fetchRoom();
    fetchParticipants();
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

<div class="flex items-center justify-between mb-4">
  <p class="text-sm ui-muted">
    <span class="font-mono">{chatRoomId}</span> &middot; Level: {level}{bankId ? ` · Bank: ${bankId}` : ""}
    {#if participants.length > 0}
      &middot; Participants: {participants.length}
    {/if}
  </p>
  {#if !room?.is_open_room}
    <a
      href={addParticipantLink}
      class="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium preset-filled-primary-500"
      data-testid="add-participant-btn"
    >
      Add Participant
    </a>
  {/if}
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
    <span class="ml-2 text-sm ui-muted">Loading...</span>
  </div>
{:else if participants.length > 0}
  <div class="overflow-x-auto">
    <table class="w-full border-collapse" data-testid="participants-table">
      <thead>
        <tr class="border-b-2 ui-border">
          <th class="text-left px-3 py-2 text-sm font-medium ui-muted">User ID</th>
          <th class="text-left px-3 py-2 text-sm font-medium ui-muted">Permissions</th>
          <th class="text-left px-3 py-2 text-sm font-medium ui-muted">Joined</th>
          <th class="text-left px-3 py-2 text-sm font-medium ui-muted">Muted</th>
          <th class="text-right px-3 py-2 text-sm font-medium ui-muted">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each participants as participant (participant.participant_id)}
          <tr class="border-b ui-hover ui-border" data-testid="participant-row-{participant.user_id}">
            <td class="px-3 py-2 text-sm ui-text">
              <span class="font-medium">{participant.username || participant.user_id}</span>
              {#if participant.provider}
                <br /><span class="text-xs ui-muted">{participant.provider}</span>
              {/if}
              {#if participant.username}
                <br /><span class="text-xs font-mono ui-muted">{participant.user_id}</span>
              {/if}
              {#if participant.consumer_id}
                <br /><span class="text-xs ui-muted">Consumer: {participant.consumer_name || participant.consumer_id}</span>
              {/if}
            </td>
            <td class="px-3 py-2 text-sm ui-text">
              <div class="flex flex-wrap gap-1">
                {#each participant.permissions as perm}
                  <span class="rounded-full px-2 py-0.5 text-xs ui-tone-info">
                    {perm}
                  </span>
                {/each}
              </div>
            </td>
            <td class="px-3 py-2 text-sm ui-text">{formatDate(participant.joined_at)}</td>
            <td class="px-3 py-2 text-sm">
              <span class="rounded-full px-2 py-0.5 text-xs font-medium {participant.is_muted
                ? 'ui-tone-warning'
                : 'ui-tone-success'}">
                {participant.is_muted ? "Muted" : "Active"}
              </span>
            </td>
            <td class="px-3 py-2 text-right">
              <button
                onclick={() => removeParticipant(participant.user_id)}
                class="inline-flex items-center rounded border px-2 py-1 text-xs font-medium ui-tone-error"
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
  <div class="rounded-lg p-8 text-center ui-panel" data-testid="empty-participants">
    {#if room?.is_open_room}
      <p class="text-sm font-medium ui-muted" data-testid="everyone-label">
        This room is Open. Everyone can join.
      </p>
    {:else}
      <p class="text-sm font-medium ui-muted">
        No participants found
      </p>
      <p class="mt-1 text-sm ui-muted">
        Add a participant to this chat room.
      </p>
    {/if}
  </div>
{/if}
