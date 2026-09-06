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
    KeyRound,
    Shield,
    Plus,
    Building2,
    Zap,
    Search,
  } from "@lucide/svelte";
</script>

<svelte:head>
  <title>Entitlements Guide - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <nav class="breadcrumb mb-6">
    <a href="/management-docs/consumers" class="breadcrumb-link">Management Docs</a>
    <span class="breadcrumb-separator">&gt;</span>
    <span class="breadcrumb-current">Entitlements</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-icon">
          <KeyRound size={32} />
        </div>
        <div>
          <h1 class="panel-title">Entitlements</h1>
          <div class="panel-subtitle">
            Understanding and granting Roles to Users
          </div>
        </div>
      </div>
    </div>

    <div class="panel-content">
      <div class="intro-grid">
        <section class="section">
          <h2 class="section-title">What is an Entitlement?</h2>
          <p class="section-text">
            An Entitlement grants a <strong>Role</strong> to a <strong>User</strong>. Roles control
            which API endpoints a User can access. For example, the Role <code>CanReadMetrics</code>
            allows a User to call the Get Metrics endpoint.
          </p>
          <p class="section-text" style="margin-top: 0.75rem;">
            Entitlements can be <strong>system-wide</strong> (no bank scope, meaning access across
            all banks) or <strong>bank-scoped</strong> (limited to a specific bank ID). Some Roles
            only make sense at the bank level (e.g. <code>CanCreateAccount</code>) while others
            are system-level only (e.g. <code>CanReadMetrics</code>).
          </p>
        </section>

        <section class="section">
          <h2 class="section-title">Key Concepts</h2>
          <div class="concepts-list">
            <div class="concept-item">
              <h3 class="concept-title">Role</h3>
              <p class="concept-text">
                A named permission such as <code>CanReadMetrics</code> or
                <code>CanCreateEntitlementAtOneBank</code>. The full list of Roles is defined
                by the OBP API.
              </p>
            </div>
            <div class="concept-item">
              <h3 class="concept-title">Bank Scope</h3>
              <p class="concept-text">
                An Entitlement can optionally be scoped to a bank ID. A bank-scoped Entitlement
                only grants access to resources at that bank.
              </p>
            </div>
            <div class="concept-item">
              <h3 class="concept-title">Entitlement Request</h3>
              <p class="concept-text">
                Users can request Entitlements they need. An admin reviews and approves or
                rejects the request.
              </p>
            </div>
            <div class="concept-item">
              <h3 class="concept-title">Just-In-Time Entitlements</h3>
              <p class="concept-text">
                When enabled, OBP auto-grants Roles if the User already holds
                <code>CanCreateEntitlementAtOneBank</code> or
                <code>CanCreateEntitlementAtAnyBank</code>. This speeds up role assignment
                for trusted users.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section class="section workflow-section">
        <h2 class="section-title">How to Grant a Role</h2>

        <div class="steps-grid">
          <div class="step-card">
            <div class="step-header">
              <div class="step-number">1</div>
              <div class="step-icon">
                <Search size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">Find the User</h3>
              <p class="step-text">
                Search for the User by username or email. You will need their <code>user_id</code>
                to grant them an Entitlement.
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
                <Shield size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">Choose the Role</h3>
              <p class="step-text">
                Identify the Role the User needs. Browse the full list of available Roles. Common
                examples: <code>CanReadMetrics</code>, <code>CanCreateAccount</code>,
                <code>CanGetAnyUser</code>.
              </p>
              <a href="/rbac/roles" class="step-link">
                Browse Roles &rarr;
              </a>
            </div>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">3</div>
              <div class="step-icon">
                <Building2 size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">Decide the Scope</h3>
              <p class="step-text">
                Should this Role apply system-wide or only at a specific bank? If bank-scoped,
                you will need the bank ID.
              </p>
              <a href="/rbac/banks" class="step-link">
                Browse Banks &rarr;
              </a>
            </div>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">4</div>
              <div class="step-icon">
                <Plus size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">Create the Entitlement</h3>
              <p class="step-text">
                Use the Create Entitlement form. Provide the User ID, select the Role, and
                optionally specify a bank ID for bank-scoped access.
              </p>
              <a href="/rbac/entitlements/create" class="step-link">
                Create Entitlement &rarr;
              </a>
            </div>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">5</div>
              <div class="step-icon">
                <KeyRound size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">Verify</h3>
              <p class="step-text">
                Check the Entitlements list to confirm the Role was granted. The User can
                now access the endpoints protected by that Role.
              </p>
              <a href="/rbac/entitlements" class="step-link">
                View Entitlements &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      <section class="section info-section">
        <h2 class="section-title">Important Roles for Managers</h2>
        <div class="roles-grid">
          <div class="role-item">
            <code>CanCreateEntitlementAtAnyBank</code>
            <p>Grant any Role at any bank. This is the "super admin" for role management.</p>
          </div>
          <div class="role-item">
            <code>CanCreateEntitlementAtOneBank</code>
            <p>Grant Roles scoped to a specific bank. Useful for delegating bank-level admin.</p>
          </div>
          <div class="role-item">
            <code>CanReadMetrics</code>
            <p>View API metrics. Required to access the Metrics pages.</p>
          </div>
          <div class="role-item">
            <code>CanGetAnyUser</code>
            <p>Search and view any user on the platform.</p>
          </div>
          <div class="role-item">
            <code>CanGetEntitlementsForAnyUserAtAnyBank</code>
            <p>View what Roles any user holds. Useful for auditing.</p>
          </div>
          <div class="role-item">
            <code>CanCreateAccount</code>
            <p>Create bank accounts. Typically bank-scoped.</p>
          </div>
        </div>
      </section>

      <section class="section info-section">
        <h2 class="section-title">Entitlement Requests</h2>
        <p class="section-text">
          Users who lack a required Role can submit an <strong>Entitlement Request</strong>.
          As a manager, you can review pending requests and approve or reject them. This provides
          an audit trail of who requested what and when it was granted.
        </p>
        <a href="/rbac/entitlement-requests" class="step-link" style="display: inline-block; margin-top: 0.5rem;">
          View Entitlement Requests &rarr;
        </a>
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

  .roles-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
  .role-item { padding: 0.75rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; }
  :global([data-mode="dark"]) .role-item { background: rgb(var(--color-surface-700)); border-color: rgb(var(--color-surface-600)); }
  .role-item code { display: block; font-size: 0.75rem; font-weight: 600; color: #111827; margin-bottom: 0.25rem; background: none; padding: 0; }
  :global([data-mode="dark"]) .role-item code { color: var(--color-surface-100); }
  .role-item p { font-size: 0.7rem; color: #4b5563; line-height: 1.4; margin: 0; }
  :global([data-mode="dark"]) .role-item p { color: var(--color-surface-300); }

  @media (max-width: 1024px) { .steps-grid { grid-template-columns: repeat(3, 1fr); } .roles-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 768px) { .intro-grid { grid-template-columns: 1fr; gap: 1.5rem; } .steps-grid { grid-template-columns: repeat(2, 1fr); } .roles-grid { grid-template-columns: 1fr; } }
  @media (max-width: 640px) { .header-content { flex-direction: column; text-align: center; } .steps-grid { grid-template-columns: 1fr; } }
</style>
