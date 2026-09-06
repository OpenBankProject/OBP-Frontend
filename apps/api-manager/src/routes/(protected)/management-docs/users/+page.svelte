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
    Users,
    Search,
    KeyRound,
    UserCheck,
    Shield,
  } from "@lucide/svelte";
</script>

<svelte:head>
  <title>Users Guide - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <nav class="breadcrumb mb-6">
    <a href="/management-docs/consumers" class="breadcrumb-link">Management Docs</a>
    <span class="breadcrumb-separator">&gt;</span>
    <span class="breadcrumb-current">Users</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-icon">
          <Users size={32} />
        </div>
        <div>
          <h1 class="panel-title">Users</h1>
          <div class="panel-subtitle">
            Understanding and managing OBP Users
          </div>
        </div>
      </div>
    </div>

    <div class="panel-content">
      <div class="intro-grid">
        <section class="section">
          <h2 class="section-title">What is a User?</h2>
          <p class="section-text">
            A User is a person (or system identity) that authenticates with the OBP API.
            Users log in via OAuth, OpenID Connect, or Direct Login. Each User is assigned a
            <strong>user_id</strong> (a UUID) that uniquely identifies them across the platform.
          </p>
          <p class="section-text" style="margin-top: 0.75rem;">
            The user_id is designed to not leak the username or any other identifier normally
            used by the customer or bank staff. A User can be granted
            <strong>Entitlements</strong> (Roles) that control what API endpoints they can access.
          </p>
        </section>

        <section class="section">
          <h2 class="section-title">Key Concepts</h2>
          <div class="concepts-list">
            <div class="concept-item">
              <h3 class="concept-title">User ID</h3>
              <p class="concept-text">
                A UUID that uniquely identifies the user. Example:
                <code>9ca9a7e4-6d02-40e3-a129-0b2bf89de9b1</code>
              </p>
            </div>
            <div class="concept-item">
              <h3 class="concept-title">Username</h3>
              <p class="concept-text">
                The login name used for authentication. Often an email address. Visible in API metrics
                to help identify who made a call.
              </p>
            </div>
            <div class="concept-item">
              <h3 class="concept-title">Provider</h3>
              <p class="concept-text">
                The authentication provider that issued the user identity (e.g. the OBP instance
                itself, or an external OIDC provider).
              </p>
            </div>
            <div class="concept-item">
              <h3 class="concept-title">Entitlements (Roles)</h3>
              <p class="concept-text">
                Roles granted to a User that control access to API endpoints. Can be system-wide
                or scoped to a specific bank.
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
                <Search size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">Find a User</h3>
              <p class="step-text">
                Search for users by username or email. You can also find a user's ID from
                API metrics if you know when they made calls.
              </p>
              <a href="/users" class="step-link">
                Go to User Search &rarr;
              </a>
            </div>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">2</div>
              <div class="step-icon">
                <UserCheck size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">View User Details</h3>
              <p class="step-text">
                See the user's ID, username, provider, and the list of Entitlements (Roles)
                they currently hold.
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
              <h3 class="step-title">Grant Entitlements</h3>
              <p class="step-text">
                Give a User the Roles they need. For example, grant <code>CanReadMetrics</code>
                to allow them to view API metrics, or <code>CanCreateEntitlementAtOneBank</code>
                to let them manage roles for a bank.
              </p>
              <a href="/rbac/entitlements/create" class="step-link">
                Create Entitlement &rarr;
              </a>
            </div>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">4</div>
              <div class="step-icon">
                <Shield size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">Review Entitlements</h3>
              <p class="step-text">
                Check what Roles a user has. Entitlements can be system-wide (no bank scope)
                or scoped to a specific bank ID.
              </p>
              <a href="/rbac/entitlements" class="step-link">
                View All Entitlements &rarr;
              </a>
            </div>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">5</div>
              <div class="step-icon">
                <Users size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">Manage Groups</h3>
              <p class="step-text">
                Organise users into Groups and assign Entitlements to the Group. All members
                inherit the Group's Roles via Memberships.
              </p>
              <a href="/rbac/groups" class="step-link">
                Go to Groups &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      <section class="section info-section">
        <h2 class="section-title">User vs Consumer</h2>
        <p class="section-text">
          A <strong>User</strong> is the person (or system) that logs in. A <strong>Consumer</strong>
          is the App they use. When an API call is made, both are identified: the User via their
          authentication token, and the Consumer via its key. Access is determined by checking both
          the User's Entitlements and the Consumer's scopes.
        </p>
      </section>
    </div>
  </div>
</div>

<style>
  .container { max-width: 1200px; }
  .breadcrumb { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
  .breadcrumb-link { color: #3b82f6; text-decoration: none; }
  .breadcrumb-link:hover { text-decoration: underline; }
  :global([data-mode="dark"]) .breadcrumb-link { color: rgb(var(--color-primary-400)); }
  .breadcrumb-separator { color: #9ca3af; }
  :global([data-mode="dark"]) .breadcrumb-separator { color: var(--color-surface-500); }
  .breadcrumb-current { color: #6b7280; }
  :global([data-mode="dark"]) .breadcrumb-current { color: var(--color-surface-400); }

  .panel { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
  :global([data-mode="dark"]) .panel { background: rgb(var(--color-surface-800)); }
  .panel-header { padding: 2rem; border-bottom: 1px solid #e5e7eb; }
  :global([data-mode="dark"]) .panel-header { border-bottom-color: rgb(var(--color-surface-700)); }
  .header-content { display: flex; align-items: center; gap: 1rem; }
  .header-icon { display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: #eff6ff; color: #3b82f6; border-radius: 12px; flex-shrink: 0; }
  :global([data-mode="dark"]) .header-icon { background: rgba(59,130,246,0.2); color: rgb(var(--color-primary-400)); }
  .panel-title { font-size: 1.5rem; font-weight: 700; color: #111827; margin: 0; }
  :global([data-mode="dark"]) .panel-title { color: var(--color-surface-100); }
  .panel-subtitle { font-size: 0.875rem; color: #6b7280; margin-top: 0.25rem; }
  :global([data-mode="dark"]) .panel-subtitle { color: var(--color-surface-400); }
  .panel-content { padding: 2rem; }

  .intro-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
  .section { margin-bottom: 0; }
  .workflow-section, .info-section { padding-top: 1.5rem; border-top: 1px solid #e5e7eb; }
  :global([data-mode="dark"]) .workflow-section, :global([data-mode="dark"]) .info-section { border-top-color: rgb(var(--color-surface-700)); }
  .info-section { margin-top: 1.5rem; }
  .section-title { font-size: 1.125rem; font-weight: 700; color: #111827; margin: 0 0 0.75rem 0; }
  :global([data-mode="dark"]) .section-title { color: var(--color-surface-100); }
  .section-text { font-size: 0.875rem; color: #4b5563; line-height: 1.6; margin: 0; }
  :global([data-mode="dark"]) .section-text { color: var(--color-surface-300); }
  .section-text code { background: #f3f4f6; padding: 0.125rem 0.375rem; border-radius: 4px; font-size: 0.8125rem; }
  :global([data-mode="dark"]) .section-text code { background: rgb(var(--color-surface-700)); color: var(--color-surface-200); }

  .concepts-list { display: flex; flex-direction: column; gap: 0.75rem; }
  .concept-item { padding: 0.75rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; }
  :global([data-mode="dark"]) .concept-item { background: rgb(var(--color-surface-700)); border-color: rgb(var(--color-surface-600)); }
  .concept-title { font-size: 0.8125rem; font-weight: 600; color: #111827; margin: 0 0 0.25rem 0; }
  :global([data-mode="dark"]) .concept-title { color: var(--color-surface-100); }
  .concept-text { font-size: 0.75rem; color: #4b5563; line-height: 1.4; margin: 0; }
  :global([data-mode="dark"]) .concept-text { color: var(--color-surface-300); }
  .concept-text code { background: #e5e7eb; padding: 0.0625rem 0.25rem; border-radius: 3px; font-size: 0.6875rem; }
  :global([data-mode="dark"]) .concept-text code { background: rgb(var(--color-surface-600)); color: var(--color-surface-200); }

  .steps-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; }
  .step-card { display: flex; flex-direction: column; padding: 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; }
  :global([data-mode="dark"]) .step-card { background: rgb(var(--color-surface-700)); border-color: rgb(var(--color-surface-600)); }
  .step-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
  .step-number { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #3b82f6; color: white; border-radius: 50%; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
  .step-icon { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: #eff6ff; color: #3b82f6; border-radius: 6px; flex-shrink: 0; }
  :global([data-mode="dark"]) .step-icon { background: rgba(59,130,246,0.2); color: rgb(var(--color-primary-400)); }
  .step-body { flex: 1; display: flex; flex-direction: column; }
  .step-title { font-size: 0.875rem; font-weight: 600; color: #111827; margin: 0 0 0.375rem 0; }
  :global([data-mode="dark"]) .step-title { color: var(--color-surface-100); }
  .step-text { font-size: 0.75rem; color: #4b5563; line-height: 1.5; margin: 0; flex: 1; }
  :global([data-mode="dark"]) .step-text { color: var(--color-surface-300); }
  .step-text code { background: #e5e7eb; padding: 0.0625rem 0.25rem; border-radius: 3px; font-size: 0.6875rem; }
  :global([data-mode="dark"]) .step-text code { background: rgb(var(--color-surface-600)); color: var(--color-surface-200); }
  .step-link { display: inline-block; margin-top: 0.5rem; font-size: 0.75rem; font-weight: 600; color: #3b82f6; text-decoration: none; }
  .step-link:hover { text-decoration: underline; }
  :global([data-mode="dark"]) .step-link { color: rgb(var(--color-primary-400)); }

  @media (max-width: 1024px) { .steps-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 768px) { .intro-grid { grid-template-columns: 1fr; gap: 1.5rem; } .steps-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 640px) { .header-content { flex-direction: column; text-align: center; } .steps-grid { grid-template-columns: 1fr; } }
</style>
