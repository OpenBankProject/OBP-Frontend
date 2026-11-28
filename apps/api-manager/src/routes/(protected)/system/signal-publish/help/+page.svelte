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
  import { CircleHelp, ExternalLink } from "@lucide/svelte";
  import GlossaryEntry from "$lib/components/GlossaryEntry.svelte";
  import HelpReferences from "$lib/components/HelpReferences.svelte";

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
          html={data.glossary.html}
          testid="glossary-signal-channels"
        />
      </section>

      <HelpReferences
        sources={[{ title: data.glossary.title, explorerUrl: data.glossary.explorerUrl }]}
        links={[
          { label: "Publish", href: "/system/signal-publish" },
          { label: "Signal Channels", href: "/system/signal-channels" },
          { label: "Signal Stats", href: "/system/signal-channels-stats" },
          { label: `API Explorer: ${data.signalTag}`, href: explorerSignalTagUrl },
          { label: "API Explorer: AI-Agent", href: explorerAiAgentTagUrl },
          { label: "API Explorer: gRPC services", href: explorerGrpcServicesUrl, testid: "signal-help-grpc-services-link" },
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
