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
    Lock,
    AppWindow,
    UserCheck,
    Search,
  } from "@lucide/svelte";
</script>

<svelte:head>
  <title>Consumers Guide - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <nav class="breadcrumb mb-6">
    <a href="/management-docs/consumers" class="breadcrumb-link">Management Docs</a>
    <span class="breadcrumb-separator">&gt;</span>
    <span class="breadcrumb-current">Consumers</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-icon">
          <AppWindow size={32} />
        </div>
        <div>
          <h1 class="panel-title">Consumers</h1>
          <div class="panel-subtitle">
            Understanding and managing API Consumers (Apps)
          </div>
        </div>
      </div>
    </div>

    <div class="panel-content">
      <div class="intro-grid">
        <section class="section">
          <h2 class="section-title">What is a Consumer?</h2>
          <p class="section-text">
            A Consumer is the "App" that calls the OBP API on behalf of an end user or system.
            It can be a web application, mobile app, or server-side service. Each Consumer has a
            <strong>consumer key</strong> and <strong>secret</strong> which allows it to authenticate
            securely with the API server.
          </p>
          <p class="section-text" style="margin-top: 0.75rem;">
            Every Consumer is assigned a <strong>Consumer ID</strong> (a UUID) which appears in
            API metrics, logs, and messages to the backend. This makes it possible to track which
            application is making which API calls.
          </p>
        </section>

        <section class="section">
          <h2 class="section-title">Key Concepts</h2>
          <div class="concepts-list">
            <div class="concept-item">
              <h3 class="concept-title">Consumer Key &amp; Secret</h3>
              <p class="concept-text">
                Credentials used by the App to authenticate with OBP via OAuth or Direct Login.
                The secret must be kept confidential.
              </p>
            </div>
            <div class="concept-item">
              <h3 class="concept-title">Consumer ID</h3>
              <p class="concept-text">
                A UUID that uniquely identifies the Consumer. Appears in metrics and can be used
                to filter API call logs.
              </p>
            </div>
            <div class="concept-item">
              <h3 class="concept-title">mTLS Certificate Pinning</h3>
              <p class="concept-text">
                A Consumer can be pinned to an mTLS certificate. After pinning, the App must
                present the certificate in all communication with the server.
              </p>
            </div>
            <div class="concept-item">
              <h3 class="concept-title">Scopes &amp; Rate Limits</h3>
              <p class="concept-text">
                Consumers can have scopes (controlling which endpoints they can access) and
                rate limits (controlling how many calls they can make).
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
              <h3 class="step-title">Find a Consumer</h3>
              <p class="step-text">
                Use the API Metrics page to identify a Consumer ID from API call logs.
                Filter by <code>consumer_id</code> to see all calls from a specific App.
              </p>
              <a href="/metrics" class="step-link">
                Go to Metrics &rarr;
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
              <h3 class="step-title">Review Consumer Details</h3>
              <p class="step-text">
                Check who registered the Consumer (developer email), what App name was given,
                and whether it has been enabled or is still pending approval.
              </p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">3</div>
              <div class="step-icon">
                <Shield size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">Manage Scopes</h3>
              <p class="step-text">
                Control which API endpoints a Consumer can access by managing its scopes.
                This is separate from the user's Entitlements (Roles).
              </p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">4</div>
              <div class="step-icon">
                <Lock size={20} />
              </div>
            </div>
            <div class="step-body">
              <h3 class="step-title">Certificate Pinning</h3>
              <p class="step-text">
                For PSD2 or high-security scenarios, pin the Consumer to an mTLS certificate.
                The certificate has a one-to-one relationship with the Consumer.
              </p>
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
              <h3 class="step-title">Certificate Renewal</h3>
              <p class="step-text">
                When a certificate expires, the TPP must register a new Consumer with the new certificate.
                Copy rate limits and scopes from the old Consumer to the new one.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="section info-section">
        <h2 class="section-title">Consumer vs User vs Entitlement</h2>
        <p class="section-text">
          A <strong>Consumer</strong> represents the App. A <strong>User</strong> is the person
          using the App. An <strong>Entitlement</strong> is a Role granted to a User (optionally
          scoped to a specific bank). When an API call is made, OBP checks both the Consumer's
          scopes and the User's Entitlements to determine access.
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
