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
  import { CircleHelp, ShieldCheck, ShieldOff, ShieldQuestion, ShieldAlert } from "@lucide/svelte";
  import GlossaryEntry from "$lib/components/GlossaryEntry.svelte";
  import HelpReferences from "$lib/components/HelpReferences.svelte";

  let { data } = $props();
  const approval = $derived(data.approval);

  // Structured, live values only. All explanatory text comes from the OBP glossary (data.sections).
  const settings = $derived([
    { name: "allow_user_generated_scala_code", value: approval.known ? String(approval.executionEnabled) : "unknown" },
    { name: "dynamic_code_requires_approval", value: approval.known ? String(approval.targetTypes.length > 0) : "unknown" },
    { name: "dynamic_code_approval_target_types", value: approval.known ? (approval.targetTypes.join(", ") || "none") : "unknown" },
    { name: "dynamic_code_delete_requires_approval", value: approval.known ? String(approval.deleteRequiresApproval) : "unknown" },
    { name: "dynamic_code_approval_request_ttl_hours", value: approval.known ? String(approval.requestTtlHours) : "unknown" },
  ]);

  function anchor(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }
</script>

<svelte:head>
  <title>Dynamic Resource Docs Help - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a class="breadcrumb-link" href="/dynamic-resource-docs/system">System Dynamic Resource Docs</a>
    <span class="breadcrumb-separator">/</span>
    <span class="breadcrumb-current">Help</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-icon"><CircleHelp size={32} /></div>
        <div>
          <h1 class="panel-title">Dynamic Resource Docs Help</h1>
          <p class="panel-subtitle">From the OBP glossary, with this instance's live settings.</p>
        </div>
      </div>
    </div>

    <div class="panel-content">
      <nav class="toc" aria-label="On this page">
        <a href="#status">This instance</a>
        {#each data.sections as s (s.title)}
          <a href="#{anchor(s.title)}">{s.title}</a>
        {/each}
        <a href="#endpoints">Change request endpoints</a>
      </nav>

      {#if data.warnings.length > 0}
        <div class="warning" data-testid="help-warnings">
          <ul class="warning-list">
            {#each data.warnings as w}<li>{w}</li>{/each}
          </ul>
        </div>
      {/if}

      <section class="section" id="status">
        <h2 class="section-title">This instance</h2>

        {#if !approval.known}
          <div class="warning" data-testid="approval-status-unknown">
            <ShieldQuestion size={18} />
            <span><strong>Could not read the approval config from OBP</strong>{#if approval.error}: {approval.error}{/if}.</span>
          </div>
        {:else if !approval.executionEnabled}
          <div class="warning" data-testid="dynamic-code-disabled-status">
            <ShieldAlert size={18} />
            <span><strong>Dynamic code is disabled.</strong> Creating a Resource Doc fails with <code>OBP-50020</code>.</span>
          </div>
        {:else if approval.requiresApproval}
          <div class="callout-link" data-testid="approval-status-on">
            <ShieldCheck size={18} />
            <span><strong>Approval is on</strong> for Dynamic Resource Docs. Checker role: <code>{approval.approvalRole}</code>.</span>
          </div>
        {:else}
          <div class="cache-note" data-testid="approval-status-off">
            <ShieldOff size={16} />
            <span><strong>Approval is off.</strong> Resource Docs go live as soon as they are created.</span>
          </div>
        {/if}

        <div class="table-wrap">
          <table class="endpoint-table" data-testid="approval-props">
            <thead><tr><th>OBP-API prop</th><th class="nowrap">Value</th></tr></thead>
            <tbody>
              {#each settings as s (s.name)}
                <tr><td><code>{s.name}</code></td><td class="nowrap"><code>{s.value}</code></td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      {#each data.sections as s (s.title)}
        <section class="section" id={anchor(s.title)}>
          <h2 class="section-title">{s.title}</h2>
          <GlossaryEntry html={s.html} testid="glossary-{anchor(s.title)}" />
        </section>
      {/each}

      <section class="section" id="endpoints">
        <h2 class="section-title">Change request endpoints</h2>
        <p class="section-text small">
          v7.0.0 resource docs tagged <code>{data.changeRequestTag}</code> on this instance.
        </p>
        {#if data.endpoints.length > 0}
          <div class="table-wrap">
            <table class="endpoint-table" data-testid="change-request-endpoints">
              <thead><tr><th>Verb</th><th>Path</th><th>Summary</th><th>Roles</th></tr></thead>
              <tbody>
                {#each data.endpoints as e (e.operation_id)}
                  <tr>
                    <td><span class="method method-{e.request_verb.toLowerCase()}">{e.request_verb}</span></td>
                    <td><a class="link path" href={e.explorerUrl} target="_blank" rel="noopener noreferrer">{e.request_url}</a></td>
                    <td>{e.summary}</td>
                    <td>
                      {#if e.roles.length === 0}<span class="muted">none</span>{/if}
                      {#each e.roles as r}<span class="role">{r}</span>{/each}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="section-text muted">None found.</p>
        {/if}
      </section>

      <HelpReferences
        sources={data.sections}
        links={[
          { label: "System Dynamic Resource Docs", href: "/dynamic-resource-docs/system" },
          { label: `API Explorer: ${data.changeRequestTag}`, href: `${data.explorerUrl}/?tags=${data.changeRequestTag}` },
        ]}
      />
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1100px;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .breadcrumb-link {
    color: var(--ui-link);
    text-decoration: none;
  }

  .breadcrumb-link:hover {
    text-decoration: underline;
  }

  .breadcrumb-separator {
    color: var(--ui-muted);
  }

  .breadcrumb-current {
    color: var(--ui-muted);
  }

  .panel {
    background: var(--ui-card);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .panel-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--ui-border);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-icon {
    color: var(--ui-link);
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0;
  }

  .panel-subtitle {
    font-size: 0.8125rem;
    color: var(--ui-muted);
    margin: 0.25rem 0 0;
  }

  .panel-content {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .toc {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.875rem;
  }

  .toc a,
  .link {
    color: var(--ui-link);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .nowrap {
    white-space: nowrap;
  }

  .section {
    scroll-margin-top: 1rem;
  }

  .section-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0 0 0.75rem;
  }

  .sub-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0.75rem 0 0.375rem;
  }

  .section-text {
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--ui-text);
    margin: 0 0 0.75rem;
  }

  .section-text.small {
    font-size: 0.8125rem;
    color: var(--ui-muted);
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8125rem;
    background: var(--ui-panel);
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
  }

  .callout-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--ui-tone-info-border);
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
    border-radius: 6px;
    font-size: 0.875rem;
    text-decoration: none;
  }

  .callout-link:hover {
    background: var(--ui-tone-info-bg);
    text-decoration: underline;
  }

  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
  }

  .endpoint-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }

  .endpoint-table th,
  .endpoint-table td {
    text-align: left;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--ui-border);
    vertical-align: top;
  }

  .endpoint-table th {
    background: var(--ui-card);
    font-weight: 600;
    color: var(--ui-text);
  }

  .endpoint-table tbody tr:last-child td {
    border-bottom: none;
  }

  .path {
    white-space: nowrap;
  }

  .method {
    display: inline-block;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-weight: 700;
    font-size: 0.75rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }

  .method-get {
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
  }

  .method-post {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .method-delete {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
  }

  .muted {
    color: var(--ui-muted);
  }

  .role {
    display: inline-block;
    margin: 0 0.25rem 0.25rem 0;
  }

  .cache-note {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--ui-muted);
    margin: 0 0 0.75rem;
  }

  .warning-list {
    margin: 0;
    padding-left: 1.25rem;
  }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  .code-block {
    margin: 0;
    padding: 0.75rem 1rem;
    background: var(--ui-panel);
    color: var(--ui-text);
    border-radius: 6px;
    font-size: 0.8rem;
    line-height: 1.5;
    overflow-x: auto;
  }

  .field-list {
    margin: 0.75rem 0 0;
    padding-left: 1.25rem;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--ui-text);
  }

  .rules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .rule-card {
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    padding: 0.875rem 1rem;
  }

  .rule-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0 0 0.375rem;
  }

  .rule-text {
    font-size: 0.8375rem;
    line-height: 1.55;
    color: var(--ui-muted);
    margin: 0;
  }

  .warning {
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    background: var(--ui-tone-warning-bg);
    border: 1px solid var(--ui-tone-warning-border);
    color: var(--ui-tone-warning-text);
    font-size: 0.875rem;
    line-height: 1.5;
  }

  @media (max-width: 768px) {
    .two-col {
      grid-template-columns: 1fr;
    }
  }
</style>
