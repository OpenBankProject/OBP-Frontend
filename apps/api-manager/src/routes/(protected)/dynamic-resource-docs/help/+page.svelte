<script lang="ts">
  import { CircleHelp, ExternalLink, ShieldCheck, ShieldOff, ShieldQuestion, ShieldAlert, FileText, Plus, RefreshCw } from "@lucide/svelte";
  import GlossaryEntry from "$lib/components/GlossaryEntry.svelte";

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
          <a class="link" href="?refresh=1"><RefreshCw size={12} /> Refresh from OBP</a>
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
          <GlossaryEntry title={s.title} html={s.html} explorerUrl={s.explorerUrl} testid="glossary-{anchor(s.title)}" />
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
        <div class="page-links">
          <a class="page-link" href="/dynamic-resource-docs/system"><FileText size={16} /> System Dynamic Resource Docs</a>
          <a class="page-link" href="/dynamic-resource-docs/system/create"><Plus size={16} /> Create</a>
          <a class="page-link" href="{data.explorerUrl}/?tags={data.changeRequestTag}" target="_blank" rel="noopener noreferrer">
            API Explorer: {data.changeRequestTag} <ExternalLink size={12} />
          </a>
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
