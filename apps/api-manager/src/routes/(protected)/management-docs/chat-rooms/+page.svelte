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
  import {
    MessageSquare,
    KeyRound,
    Users,
    UserPlus,
    RefreshCw,
    Globe,
    Lock,
  } from "@lucide/svelte";
</script>

<svelte:head>
  <title>Chat Rooms Guide - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <nav class="breadcrumb mb-6">
    <a href="/management-docs/consumers" class="breadcrumb-link">Management Docs</a>
    <span class="breadcrumb-separator">&gt;</span>
    <span class="breadcrumb-current">Chat Rooms</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-icon">
          <MessageSquare size={32} />
        </div>
        <div>
          <h1 class="panel-title">Chat Rooms</h1>
          <div class="panel-subtitle">
            Understanding and managing OBP Chat Rooms
          </div>
        </div>
      </div>
    </div>

    <div class="panel-content">
      <div class="intro-grid">
        <section class="section">
          <h2 class="section-title">What is a Chat Room?</h2>
          <p class="section-text">
            A Chat Room is a named space where Users and Consumers (apps or bots) exchange
            messages. Each room is either <strong>system-level</strong> (no bank scope) or
            scoped to a specific <strong>bank_id</strong>.
          </p>
          <p class="section-text" style="margin-top: 0.75rem;">
            The auto-created system room <code>general</code> is open to every authenticated
            user. Other rooms default to closed (invite-only via the joining key).
          </p>
        </section>

        <section class="section">
          <h2 class="section-title">Key Concepts</h2>
          <div class="concepts-list">
            <div class="concept-item">
              <h3 class="concept-title">Open vs Closed Room</h3>
              <p class="concept-text">
                <code>is_open_room = true</code> means every authenticated user is an
                <em>implicit participant</em> — they can read and post without being added.
                Closed rooms require an explicit Participant record.
              </p>
            </div>
            <div class="concept-item">
              <h3 class="concept-title">Joining Key</h3>
              <p class="concept-text">
                A UUID that identifies the room when joining. New members POST the key to
                <code>/chat-room-participants</code> to join. Only existing participants can
                read the key.
              </p>
            </div>
            <div class="concept-item">
              <h3 class="concept-title">Participant</h3>
              <p class="concept-text">
                A User or Consumer with an explicit record in the room. Stores permissions,
                mute state, and last read marker. The room creator gets all permissions.
              </p>
            </div>
            <div class="concept-item">
              <h3 class="concept-title">Permissions</h3>
              <p class="concept-text">
                Per-participant: <code>can_delete_message</code>,
                <code>can_remove_participant</code>,
                <code>can_refresh_joining_key</code>,
                <code>can_update_room</code>,
                <code>can_manage_permissions</code>.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section class="section workflow-section">
        <h2 class="section-title">Common Tasks</h2>

        <div class="steps-grid">
          <div class="step-card">
            <div class="step-header">
              <div class="step-number">1</div>
              <div class="step-icon">
                <Globe size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">Browse Rooms</h3>
              <p class="step-text">
                See all system-level chat rooms you can access, plus every open room. Bank-scoped
                rooms are listed separately under each bank.
              </p>
              <a href="/chat-rooms/system" class="step-link">
                System Chat Rooms &rarr;
              </a>
            </div>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">2</div>
              <div class="step-icon">
                <Lock size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">Open or Close a Room</h3>
              <p class="step-text">
                Toggle <code>is_open_room</code> on the room's edit page. Open rooms admit
                everyone; closed rooms require the joining key.
              </p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">3</div>
              <div class="step-icon">
                <KeyRound size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">Share the Joining Key</h3>
              <p class="step-text">
                On the room's participants page, copy the joining key and send it to the new
                member out-of-band. They use it to join.
              </p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">4</div>
              <div class="step-icon">
                <RefreshCw size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">Refresh the Key</h3>
              <p class="step-text">
                If a key leaks, hit Refresh on the participants page. The old key stops
                working immediately. Requires <code>can_refresh_joining_key</code>.
              </p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">5</div>
              <div class="step-icon">
                <UserPlus size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">Add or Remove Participants</h3>
              <p class="step-text">
                Add by user_id with a chosen permission set. Remove takes effect immediately;
                the user keeps message history but loses access.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="section info-section">
        <h2 class="section-title">How Joining Works</h2>
        <p class="section-text">
          Joining is by key, not invite. A user calls
          <code>POST /obp/v6.0.0/chat-room-participants</code> with
          <code>{`{ "joining_key": "..." }`}</code> — the key alone identifies the room.
          Open rooms don't strictly need a join (the user is already an implicit participant)
          but joining explicitly creates a Participant record so they can be granted
          permissions, mute the room, or track unread state.
        </p>
        <p class="section-text" style="margin-top: 0.75rem;">
          Beyond room-level permissions, OBP-level Roles
          (<code>CanDeleteSystemChatRoom</code>, <code>CanArchiveBankChatRoom</code>, etc.)
          give platform moderators unconditional control regardless of participant permissions.
        </p>
      </section>
    </div>
  </div>
</div>

<style>
  .container { max-width: 1200px; }
  .breadcrumb { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
  .breadcrumb-link { color: var(--ui-link); text-decoration: none; }
  .breadcrumb-link:hover { text-decoration: underline; }
  .breadcrumb-separator { color: var(--ui-muted); }
  .breadcrumb-current { color: var(--ui-muted); }

  .panel { background: var(--ui-card); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
  .panel-header { padding: 2rem; border-bottom: 1px solid var(--ui-border); }
  .header-content { display: flex; align-items: center; gap: 1rem; }
  .header-icon { display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: var(--ui-tone-info-bg); color: var(--ui-tone-info-text); border-radius: 12px; flex-shrink: 0; }
  .panel-title { font-size: 1.5rem; font-weight: 700; color: var(--ui-text); margin: 0; }
  .panel-subtitle { font-size: 0.875rem; color: var(--ui-muted); margin-top: 0.25rem; }
  .panel-content { padding: 2rem; }

  .intro-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
  .section { margin-bottom: 0; }
  .workflow-section, .info-section { padding-top: 1.5rem; border-top: 1px solid var(--ui-border); }
  .info-section { margin-top: 1.5rem; }
  .section-title { font-size: 1.125rem; font-weight: 700; color: var(--ui-text); margin: 0 0 0.75rem 0; }
  .section-text { font-size: 0.875rem; color: var(--ui-muted); line-height: 1.6; margin: 0; }
  .section-text code { background: var(--ui-panel); padding: 0.125rem 0.375rem; border-radius: 4px; font-size: 0.8125rem; }

  .concepts-list { display: flex; flex-direction: column; gap: 0.75rem; }
  .concept-item { padding: 0.75rem; background: var(--ui-card); border: 1px solid var(--ui-border); border-radius: 6px; }
  .concept-title { font-size: 0.8125rem; font-weight: 600; color: var(--ui-text); margin: 0 0 0.25rem 0; }
  .concept-text { font-size: 0.75rem; color: var(--ui-muted); line-height: 1.4; margin: 0; }
  .concept-text code { background: var(--ui-panel); padding: 0.0625rem 0.25rem; border-radius: 3px; font-size: 0.6875rem; }

  .steps-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; }
  .step-card { display: flex; flex-direction: column; padding: 1rem; background: var(--ui-card); border: 1px solid var(--ui-border); border-radius: 8px; }
  .step-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
  .step-number { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: var(--ui-fill-main-bg); color: var(--ui-fill-main-text); border-radius: 50%; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
  .step-icon { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: var(--ui-tone-info-bg); color: var(--ui-tone-info-text); border-radius: 6px; flex-shrink: 0; }
  .step-body { flex: 1; display: flex; flex-direction: column; }
  .step-title { font-size: 0.875rem; font-weight: 600; color: var(--ui-text); margin: 0 0 0.375rem 0; }
  .step-text { font-size: 0.75rem; color: var(--ui-muted); line-height: 1.5; margin: 0; flex: 1; }
  .step-text code { background: var(--ui-panel); padding: 0.0625rem 0.25rem; border-radius: 3px; font-size: 0.6875rem; }
  .step-link { display: inline-block; margin-top: 0.5rem; font-size: 0.75rem; font-weight: 600; color: var(--ui-link); text-decoration: none; }
  .step-link:hover { text-decoration: underline; }

  @media (max-width: 1024px) { .steps-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 768px) { .intro-grid { grid-template-columns: 1fr; gap: 1.5rem; } .steps-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 640px) { .header-content { flex-direction: column; text-align: center; } .steps-grid { grid-template-columns: 1fr; } }
</style>
