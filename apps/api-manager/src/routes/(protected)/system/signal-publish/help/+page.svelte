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
  import { CircleHelp, ExternalLink, Radio, BarChart3, Plus, RefreshCw } from "@lucide/svelte";
  import GlossaryEntry from "$lib/components/GlossaryEntry.svelte";

  let { data } = $props();

  const explorerSignalTagUrl = $derived(`${data.explorerUrl}/?tags=${data.signalTag}`);
  const explorerAiAgentTagUrl = $derived(`${data.explorerUrl}/?tags=AI-Agent`);
  // The API Explorer's gRPC discovery page lists every service the running OBP-API exposes via reflection.
  const explorerGrpcServicesUrl = $derived(`${data.explorerUrl}/grpc-services`);

  function resourceDocUrl(operationId: string): string {
    return `${data.explorerUrl}/resource-docs/OBPv6.0.0?operationid=${operationId}`;
  }

  // Which API Manager page exercises each endpoint, keyed by the tail of the operation_id.
  const usedBy: Record<string, { href: string; label: string }> = {
    publishSignalMessage: { href: "/system/signal-publish", label: "Publish" },
    getSignalMessages: { href: "/system/signal-channels", label: "Signal Channels" },
    getSignalChannels: { href: "/system/signal-channels", label: "Signal Channels" },
    getSignalStats: { href: "/system/signal-channels-stats", label: "Signal Stats" },
  };

  function pageFor(operationId: string) {
    return usedBy[operationId.split("-").pop() ?? ""];
  }

  function cacheAgeLabel(ageSeconds: number | null): string {
    if (ageSeconds === null) return "not cached";
    if (ageSeconds < 60) return `${ageSeconds}s ago`;
    return `${Math.round(ageSeconds / 60)} min ago`;
  }

  // The Publish page's endpoint, with its examples straight from the resource doc.
  const publishDoc = $derived(data.endpoints.find((e) => e.operation_id.endsWith("-publishSignalMessage")));

  function pretty(value: unknown): string {
    return value == null ? "" : JSON.stringify(value, null, 2);
  }
</script>

<svelte:head>
  <title>Signal Publish Help - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/system/signal-publish" class="breadcrumb-link">Publish Signal</a>
    <span class="breadcrumb-separator" aria-hidden="true">&gt;</span>
    <span class="breadcrumb-current">Help</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-icon"><CircleHelp size={32} /></div>
        <div>
          <h1 class="panel-title">Signal Channels Help</h1>
          <p class="panel-subtitle">From the OBP glossary, with this instance's endpoints.</p>
        </div>
      </div>
    </div>

    <div class="panel-content">
      <nav class="toc" aria-label="On this page">
        <a href="#endpoints">REST endpoints</a>
        <a href="#publish">What Publish sends</a>
        <a href="#glossary">{data.glossary.title}</a>
        <a href="#links">Further reading</a>
      </nav>

      {#if data.warnings.length > 0}
        <div class="warning" data-testid="signal-help-warnings">
          <ul class="warning-list">{#each data.warnings as w}<li>{w}</li>{/each}</ul>
        </div>
      {/if}

      <section class="section" id="endpoints">
        <h2 class="section-title">REST endpoints</h2>
        <p class="cache-note" data-testid="signal-endpoints-source">
          v6.0.0 resource docs tagged <code>{data.signalTag}</code> on this instance, cached for 30 minutes.
          Fetched {cacheAgeLabel(data.cache.ageSeconds)}.
          <a class="link" href="?refresh=1" data-sveltekit-reload><RefreshCw size={12} /> Refresh now</a>
        </p>
        <div class="table-wrap">
          <table class="endpoint-table" data-testid="signal-endpoints-table">
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col">Path</th>
                <th scope="col">Summary</th>
                <th scope="col">Roles</th>
                <th scope="col">Used by</th>
                <th scope="col">Docs</th>
              </tr>
            </thead>
            <tbody>
              {#each data.endpoints as ep (ep.operation_id)}
                {@const page = pageFor(ep.operation_id)}
                <tr>
                  <td><span class="method method-{ep.request_verb.toLowerCase()}">{ep.request_verb}</span></td>
                  <td><code class="path">/obp/v6.0.0{ep.request_url}</code></td>
                  <td>{ep.summary}</td>
                  <td>
                    {#if ep.roles.length > 0}
                      {#each ep.roles as role}<code class="role">{role}</code>{/each}
                    {:else}
                      <span class="muted">none</span>
                    {/if}
                  </td>
                  <td>
                    {#if page}
                      <a class="link" href={page.href}>{page.label}</a>
                    {:else}
                      <span class="muted">-</span>
                    {/if}
                  </td>
                  <td>
                    <a class="link nowrap" href={resourceDocUrl(ep.operation_id)} target="_blank" rel="noopener noreferrer">
                      {ep.operation_id.split("-").pop()} <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              {:else}
                <tr><td colspan="6" class="muted">No signal endpoints were returned by the resource docs.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <section class="section" id="publish">
        <h2 class="section-title">What Publish sends</h2>
        {#if publishDoc}
          <p class="section-text small">
            The <a class="link" href="/system/signal-publish">Publish</a> form posts to
            <code>{publishDoc.request_verb} /obp/v6.0.0{publishDoc.request_url}</code>. Examples from the resource doc:
          </p>
          <div class="two-col">
            <div>
              <h3 class="sub-title">Request body</h3>
              <pre class="code-block"><code>{pretty(publishDoc.example_request_body)}</code></pre>
            </div>
            <div>
              <h3 class="sub-title">Response</h3>
              <pre class="code-block"><code>{pretty(publishDoc.success_response_body)}</code></pre>
            </div>
          </div>
        {:else}
          <p class="section-text muted">The publish endpoint was not found in the resource docs.</p>
        {/if}
      </section>

      <section class="section" id="glossary">
        <h2 class="section-title">{data.glossary.title}</h2>
        <GlossaryEntry
          title={data.glossary.title}
          html={data.glossary.html}
          explorerUrl={data.glossary.explorerUrl}
          testid="glossary-signal-channels"
        />
      </section>

      <section class="section" id="links">
        <h2 class="section-title">Further reading</h2>
        <ul class="link-list">
          <li>
            <a class="link" href={explorerSignalTagUrl} target="_blank" rel="noopener noreferrer">
              API Explorer: endpoints tagged {data.signalTag} <ExternalLink size={12} />
            </a>
          </li>
          <li>
            <a class="link" href={explorerAiAgentTagUrl} target="_blank" rel="noopener noreferrer">
              API Explorer: endpoints tagged AI-Agent <ExternalLink size={12} />
            </a>
          </li>
          <li>
            <a class="link" href={explorerGrpcServicesUrl} target="_blank" rel="noopener noreferrer" data-testid="signal-help-grpc-services-link">
              API Explorer: gRPC services discovery <ExternalLink size={12} />
            </a>
          </li>
        </ul>
        <div class="page-links">
          <a class="page-link" href="/system/signal-publish"><Plus size={16} /> Publish</a>
          <a class="page-link" href="/system/signal-channels"><Radio size={16} /> Signal Channels</a>
          <a class="page-link" href="/system/signal-channels-stats"><BarChart3 size={16} /> Signal Stats</a>
        </div>
      </section>
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
    color: #2563eb;
    text-decoration: none;
  }

  .breadcrumb-link:hover {
    text-decoration: underline;
  }

  .breadcrumb-separator {
    color: #9ca3af;
  }

  .breadcrumb-current {
    color: #6b7280;
  }

  :global([data-mode="dark"]) .breadcrumb-link {
    color: #60a5fa;
  }

  :global([data-mode="dark"]) .breadcrumb-current {
    color: var(--color-surface-400);
  }

  .panel {
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  :global([data-mode="dark"]) .panel {
    background: rgb(var(--color-surface-800));
  }

  .panel-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-icon {
    color: #667eea;
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.8125rem;
    color: #6b7280;
    margin: 0.25rem 0 0;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
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
    color: #2563eb;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  :global([data-mode="dark"]) .toc a,
  :global([data-mode="dark"]) .link {
    color: #60a5fa;
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
    color: #111827;
    margin: 0 0 0.75rem;
  }

  :global([data-mode="dark"]) .section-title {
    color: var(--color-surface-100);
  }

  .sub-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin: 0.75rem 0 0.375rem;
  }

  :global([data-mode="dark"]) .sub-title {
    color: var(--color-surface-300);
  }

  .section-text {
    font-size: 0.9rem;
    line-height: 1.6;
    color: #374151;
    margin: 0 0 0.75rem;
  }

  .section-text.small {
    font-size: 0.8125rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .section-text {
    color: var(--color-surface-300);
  }

  :global([data-mode="dark"]) .section-text.small {
    color: var(--color-surface-400);
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8125rem;
    background: #f3f4f6;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
  }

  :global([data-mode="dark"]) code {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-100);
  }

  .callout-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: 1px solid #c7d2fe;
    background: #eef2ff;
    color: #3730a3;
    border-radius: 6px;
    font-size: 0.875rem;
    text-decoration: none;
  }

  .callout-link:hover {
    background: #e0e7ff;
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .callout-link {
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.4);
    color: #c7d2fe;
  }

  .table-wrap {
    overflow-x: auto;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
  }

  :global([data-mode="dark"]) .table-wrap {
    border-color: rgb(var(--color-surface-700));
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
    border-bottom: 1px solid #e5e7eb;
    vertical-align: top;
  }

  .endpoint-table th {
    background: #f9fafb;
    font-weight: 600;
    color: #374151;
  }

  .endpoint-table tbody tr:last-child td {
    border-bottom: none;
  }

  :global([data-mode="dark"]) .endpoint-table th {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
  }

  :global([data-mode="dark"]) .endpoint-table td {
    border-bottom-color: rgb(var(--color-surface-700));
    color: var(--color-surface-300);
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
    background: #dbeafe;
    color: #1e40af;
  }

  .method-post {
    background: #d1fae5;
    color: #065f46;
  }

  .method-delete {
    background: #fee2e2;
    color: #991b1b;
  }

  .muted {
    color: #9ca3af;
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
    color: #6b7280;
    margin: 0 0 0.75rem;
  }

  :global([data-mode="dark"]) .cache-note {
    color: var(--color-surface-400);
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
    background: #1f2937;
    color: #e5e7eb;
    border-radius: 6px;
    font-size: 0.8rem;
    line-height: 1.5;
    overflow-x: auto;
  }

  .code-block code {
    background: transparent;
    padding: 0;
    color: inherit;
  }

  .field-list {
    margin: 0.75rem 0 0;
    padding-left: 1.25rem;
    font-size: 0.875rem;
    line-height: 1.6;
    color: #374151;
  }

  :global([data-mode="dark"]) .field-list {
    color: var(--color-surface-300);
  }

  .rules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .rule-card {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.875rem 1rem;
  }

  :global([data-mode="dark"]) .rule-card {
    border-color: rgb(var(--color-surface-700));
  }

  .rule-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.375rem;
  }

  :global([data-mode="dark"]) .rule-title {
    color: var(--color-surface-100);
  }

  .rule-text {
    font-size: 0.8375rem;
    line-height: 1.55;
    color: #4b5563;
    margin: 0;
  }

  :global([data-mode="dark"]) .rule-text {
    color: var(--color-surface-300);
  }

  .warning {
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    background: #fef3c7;
    border: 1px solid #fcd34d;
    color: #92400e;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  :global([data-mode="dark"]) .warning {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.4);
    color: #fde68a;
  }

  .link-list {
    margin: 0 0 1rem;
    padding-left: 1.25rem;
    font-size: 0.875rem;
    line-height: 1.8;
  }

  .page-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .page-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.8125rem;
    color: #374151;
    text-decoration: none;
  }

  .page-link:hover {
    background: #f3f4f6;
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .page-link {
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-200);
  }

  :global([data-mode="dark"]) .page-link:hover {
    background: rgb(var(--color-surface-700));
  }

  @media (max-width: 768px) {
    .two-col {
      grid-template-columns: 1fr;
    }
  }
</style>
