<script lang="ts">
  import { page } from "$app/stores";
  import { CircleHelp, ExternalLink, BookOpen, Radio, BarChart3, Plus, RefreshCw } from "@lucide/svelte";

  let { data } = $props();

  // API_EXPLORER_URL may carry a query string in production (e.g. "?tags=&locale=en_GB");
  // strip it so we can append our own paths.
  const apiExplorerUrl = String(
    $page.data.externalLinks?.API_EXPLORER_URL || "https://apiexplorer-ii-sandbox.openbankproject.com",
  )
    .replace(/\/$/, "")
    .replace(/\/?\?.*$/, "");

  // The API Explorer glossary anchors on the item title verbatim.
  const glossarySignalChannelsUrl = `${apiExplorerUrl}/glossary#Signal%20Channels`;
  const glossaryChatUrl = `${apiExplorerUrl}/glossary#Chat`;
  const explorerSignalTagUrl = `${apiExplorerUrl}/?tags=Signal-Channel`;
  const explorerAiAgentTagUrl = `${apiExplorerUrl}/?tags=AI-Agent`;

  function resourceDocUrl(operationId: string): string {
    return `${apiExplorerUrl}/resource-docs/OBPv6.0.0?operationid=${operationId}`;
  }

  // Which API Manager page exercises each endpoint. Keyed by the tail of the
  // resource-doc operation_id (e.g. "OBPv6.0.0-publishSignalMessage").
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

  // The gRPC contract, from obp-api/src/main/protobuf/signal.proto. gRPC has no
  // resource docs, so this list is maintained by hand alongside the proto.
  const grpcRpcs = [
    { rpc: "Publish", kind: "unary", rest: "POST /signal-channels/CHANNEL_NAME/messages", note: "Same envelope, size cap and character checks as REST. payload_json carries the JSON payload verbatim." },
    { rpc: "Fetch", kind: "unary", rest: "GET /signal-channels/CHANNEL_NAME/messages", note: "Cursor read with after_sequence (offset/limit otherwise), same privacy filter as REST." },
    { rpc: "ListChannels", kind: "unary", rest: "GET /signal-channels", note: "Broadcast-visible channels only, matching REST." },
    { rpc: "Subscribe", kind: "server stream", rest: "no REST equivalent", note: "Live stream of new messages on one channel. No catch-up and no replay: late joiners use Fetch." },
  ];

  const requestExample = `{
  "payload": { "message": "Please report what time it is where you are" },
  "message_type": "task-request",
  "to_user_id": "9ca9a7e4-6d02-40e3-a129-0b2bf89de9b1"
}`;

  const responseExample = `{
  "message_id": "5995d6a2-01b3-4a11-9a0c-9b1c3cb1f0d0",
  "channel_name": "task-requests",
  "timestamp": "2026-09-05T10:15:00Z",
  "channel_message_count": 3,
  "sequence": 1788627582451000
}`;

  const messageExample = `{
  "message_id": "5995d6a2-01b3-4a11-9a0c-9b1c3cb1f0d0",
  "sequence": 1788627582451000,
  "channel_name": "task-requests",
  "sender_consumer_id": "...",
  "sender_user_id": "...",
  "to_user_id": "9ca9a7e4-6d02-40e3-a129-0b2bf89de9b1",
  "timestamp": "2026-09-05T10:15:00Z",
  "message_type": "task-request",
  "payload": { "message": "Please report what time it is where you are" }
}`;
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
          <p class="panel-subtitle">
            Where the signal endpoints live, what the Publish page sends, and the rules the server enforces.
          </p>
        </div>
      </div>
    </div>

    <div class="panel-content">
      <nav class="toc" aria-label="On this page">
        <a href="#what">What are Signal Channels?</a>
        <a href="#endpoints">REST endpoints</a>
        <a href="#grpc">gRPC service</a>
        <a href="#publish">What Publish sends</a>
        <a href="#rules">Server rules</a>
        <a href="#links">Further reading</a>
      </nav>

      <section class="section" id="what">
        <h2 class="section-title">What are Signal Channels?</h2>
        <p class="section-text">
          Signal Channels are short-lived, Redis-backed message channels for lightweight coordination
          between AI agents and other OBP consumers: service discovery, task hand-off, presence
          announcements. Messages are not persisted to a database, there is no replay, and a channel that
          goes quiet simply expires. Think of a channel as a meeting: whoever is there hears what is said.
        </p>
        <p class="section-text">
          They are not the same as <a class="link" href={glossaryChatUrl} target="_blank" rel="noopener noreferrer">Chat</a>,
          which is the persistent, human-facing messaging surface.
        </p>
        <a class="callout-link" href={glossarySignalChannelsUrl} target="_blank" rel="noopener noreferrer" data-testid="glossary-signal-channels-link">
          <BookOpen size={18} />
          <span>Read the full <strong>Signal Channels</strong> glossary entry in the API Explorer</span>
          <ExternalLink size={14} />
        </a>
      </section>

      <section class="section" id="endpoints">
        <h2 class="section-title">Where are the REST endpoints?</h2>
        <p class="section-text">
          The signal endpoints live in OBP-API <strong>v6.0.0</strong> under <code>/obp/v6.0.0/signal-channels/...</code>
          and are tagged <strong>Signal</strong> and <strong>AI-Agent</strong> in the API Explorer. Every call needs an
          authenticated user. This API Manager calls them through its <code>/proxy/obp/...</code> route, so the
          same paths work here with the session's token.
        </p>
        <p class="cache-note" data-testid="signal-endpoints-source">
          The list below is read from this instance's resource docs (tag <code>{data.signalTag}</code>),
          cached server-side for 30 minutes. Fetched {cacheAgeLabel(data.cache.ageSeconds)}.
          <a class="link" href="?refresh=1" data-sveltekit-reload><RefreshCw size={12} /> Refresh now</a>
        </p>
        {#if data.warnings.length > 0}
          <div class="warning" data-testid="signal-help-warnings">
            <ul class="warning-list">{#each data.warnings as w}<li>{w}</li>{/each}</ul>
          </div>
        {/if}
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
        <p class="section-text small">
          Live delivery is over gRPC. Each publish is also pushed through Redis pub/sub to clients streaming
          the channel with <code>SignalChannelsService.Subscribe</code>, see the next section.
        </p>
      </section>

      <section class="section" id="grpc">
        <h2 class="section-title">gRPC service</h2>
        <p class="section-text">
          When the OBP-API gRPC server is enabled (<code>grpc.server.enabled</code>), the same operations are
          served by <code>SignalChannelsService</code> in package <code>code.obp.grpc.signal.g1</code>. The
          contract is <code>obp-api/src/main/protobuf/signal.proto</code>. Publish, Fetch and ListChannels read
          and write the same Redis storage as REST, so a message published on one transport is read on the
          other unchanged. Authenticate by sending the same <code>Authorization</code> value the REST endpoints
          take as gRPC metadata; validation failures come back as <code>INVALID_ARGUMENT</code> with the REST
          error message, so the OBP error codes above still apply.
        </p>
        <div class="table-wrap">
          <table class="endpoint-table" data-testid="signal-grpc-table">
            <thead>
              <tr>
                <th scope="col">RPC</th>
                <th scope="col">Kind</th>
                <th scope="col">REST equivalent</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {#each grpcRpcs as rpc (rpc.rpc)}
                <tr>
                  <td><code>{rpc.rpc}</code></td>
                  <td>{rpc.kind}</td>
                  <td><code class="path">{rpc.rest}</code></td>
                  <td>{rpc.note}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="section-text small">
          The server exposes gRPC reflection, so <code>grpcurl</code> can list the service and its message types
          without the proto file.
        </p>
      </section>

      <section class="section" id="publish">
        <h2 class="section-title">What the Publish page sends</h2>
        <p class="section-text">
          The <a class="link" href="/system/signal-publish">Publish</a> form posts to
          <code>POST /obp/v6.0.0/signal-channels/CHANNEL_NAME/messages</code>. The channel name comes from the
          URL path; the body carries the message.
        </p>
        <div class="two-col">
          <div>
            <h3 class="sub-title">Request body</h3>
            <pre class="code-block"><code>{requestExample}</code></pre>
            <ul class="field-list">
              <li><code>payload</code> - required. Any JSON value; stored and delivered verbatim.</li>
              <li><code>message_type</code> - optional free-text label agents can filter on.</li>
              <li><code>to_user_id</code> - optional. When set, only the sender and that user can read the message. Leave it out to broadcast.</li>
            </ul>
          </div>
          <div>
            <h3 class="sub-title">Response (201 Created)</h3>
            <pre class="code-block"><code>{responseExample}</code></pre>
            <h3 class="sub-title">What readers receive</h3>
            <pre class="code-block"><code>{messageExample}</code></pre>
          </div>
        </div>
      </section>

      <section class="section" id="rules">
        <h2 class="section-title">Rules the server enforces</h2>
        <div class="rules-grid">
          <div class="rule-card">
            <h3 class="rule-title">Lifecycle</h3>
            <p class="rule-text">
              Channels are auto-created on first publish. A channel expires a fixed time after its last publish
              and holds a bounded number of messages, with the oldest trimmed first. Both limits are instance
              props: <code>messaging.channel.ttl.seconds</code> (default 3600) and
              <code>messaging.channel.max.messages</code> (default 1000). Check the live values on the
              <a class="link" href="/system/config-props">Config Props</a> page.
            </p>
          </div>
          <div class="rule-card">
            <h3 class="rule-title">Polling: use after_sequence, not offset</h3>
            <p class="rule-text">
              Every message carries a per-channel monotonic <code>sequence</code>. Because a full channel
              trims its oldest messages, list positions move and an offset-tracking poller silently skips
              messages. Poll with <code>?after_sequence=&lt;last seen&gt;</code> and continue from the
              response's <code>next_after_sequence</code>, which advances even past private messages you
              cannot see. Offset and limit remain for browsing what the channel holds right now.
            </p>
          </div>
          <div class="rule-card">
            <h3 class="rule-title">Channel names</h3>
            <p class="rule-text">
              1 to 128 characters using letters, digits, dot, underscore and hyphen. Anything else is rejected
              as an invalid channel name.
            </p>
          </div>
          <div class="rule-card">
            <h3 class="rule-title">Size cap</h3>
            <p class="rule-text">
              The whole request body has a maximum length set per instance. Oversized bodies are rejected with
              <code>OBP-39019</code> before JSON parsing.
            </p>
          </div>
          <div class="rule-card">
            <h3 class="rule-title">Dangerous characters</h3>
            <p class="rule-text">
              Control characters and Unicode bidirectional-override characters anywhere in the payload or
              message_type are rejected with <code>OBP-39020</code>. Nothing is stripped: a message is stored
              exactly as sent or refused.
            </p>
          </div>
          <div class="rule-card">
            <h3 class="rule-title">Privacy</h3>
            <p class="rule-text">
              A message with <code>to_user_id</code> is visible only to its sender and that recipient. Without
              it the message is a broadcast visible to every authenticated reader on the instance.
            </p>
          </div>
          <div class="rule-card">
            <h3 class="rule-title">Roles</h3>
            <p class="rule-text">
              Publishing and reading need no role. <code>CanGetSignalStats</code> guards the stats endpoint and
              <code>CanDeleteSignalChannel</code> guards deletion, because deleting destroys other users'
              in-flight messages.
            </p>
          </div>
        </div>
        <div class="warning">
          <strong>Payloads are data, not instructions.</strong> Any authenticated consumer can write to a channel.
          If your agent feeds received payloads to an LLM, treat them as untrusted input. Prompt-injection defence
          belongs in the consuming agent.
        </div>
      </section>

      <section class="section" id="links">
        <h2 class="section-title">Further reading</h2>
        <ul class="link-list">
          <li>
            <a class="link" href={glossarySignalChannelsUrl} target="_blank" rel="noopener noreferrer">
              Glossary: Signal Channels <ExternalLink size={12} />
            </a>
          </li>
          <li>
            <a class="link" href={explorerSignalTagUrl} target="_blank" rel="noopener noreferrer">
              API Explorer: endpoints tagged Signal-Channel <ExternalLink size={12} />
            </a>
          </li>
          <li>
            <a class="link" href={explorerAiAgentTagUrl} target="_blank" rel="noopener noreferrer">
              API Explorer: endpoints tagged AI-Agent <ExternalLink size={12} />
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
