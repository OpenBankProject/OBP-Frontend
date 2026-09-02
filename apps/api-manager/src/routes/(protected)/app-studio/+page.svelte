<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import { OpeyChat, AppStudioPreview } from "@obp/shared/components";
  import { appStudioPathToProxyPath } from "@obp/shared/components";
  import type { OpeyChatOptions, SuggestedQuestion, AppStudioProxyResult } from "@obp/shared/components";
  import { Smartphone, Play, Copy, Download, RotateCcw, Landmark, ListOrdered, Wand2 } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";

  // ---- App source -----------------------------------------------------------
  const STARTER_TITLE = "My OBP App";
  const STARTER_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My OBP App</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #f4f5f7; color: #111; }
    header { padding: 20px 16px 12px; background: #1d4ed8; color: #fff; }
    h1 { margin: 0; font-size: 20px; }
    main { padding: 16px; }
    .card { background: #fff; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
    .muted { color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <header><h1>Banks</h1><div class="muted" style="color:#dbeafe">Loaded from OBP</div></header>
  <main id="app"><p class="muted">Loading…</p></main>
  <script>
    (async () => {
      const app = document.getElementById('app');
      try {
        const data = await obp.get('/obp/v6.0.0/banks');
        app.innerHTML = data.banks.map(b =>
          '<div class="card"><strong>' + b.full_name + '</strong><div class="muted">' + b.id + '</div></div>'
        ).join('') || '<p class="muted">No banks.</p>';
      } catch (e) {
        app.innerHTML = '<p style="color:#b91c1c">' + e.message + '</p>';
      }
    })();
  <\/script>
</body>
</html>
`;

  let title = $state(STARTER_TITLE);
  let source = $state(STARTER_HTML);
  let runId = $state(1);
  let opeyPreviousSource = $state<string | null>(null);
  let opeyPreviousTitle = $state<string | null>(null);

  function run() {
    runId += 1;
    logs = [];
    network = [];
  }

  function resetToStarter() {
    if (!confirm("Replace the current app with the starter template?")) return;
    source = STARTER_HTML;
    title = STARTER_TITLE;
    opeyPreviousSource = null;
    opeyPreviousTitle = null;
    run();
  }

  async function copySource() {
    try {
      await navigator.clipboard.writeText(source);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      copied = false;
    }
  }
  let copied = $state(false);

  const downloadHref = $derived(
    "data:text/html;charset=utf-8," + encodeURIComponent(source)
  );
  const downloadName = $derived(
    (title || "app").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".html"
  );

  // ---- Preview bridge: the app's OBP calls -----------------------------------
  interface NetworkEntry { method: string; path: string; status: number; ms: number; error?: string }
  interface LogEntry { level: "log" | "warn" | "error"; message: string }
  let network = $state<NetworkEntry[]>([]);
  let logs = $state<LogEntry[]>([]);
  const MAX_ENTRIES = 40;

  function pushNetwork(entry: NetworkEntry) {
    network = [...network.slice(-(MAX_ENTRIES - 1)), entry];
  }
  function pushLog(entry: LogEntry) {
    logs = [...logs.slice(-(MAX_ENTRIES - 1)), entry];
  }

  async function handleAppRequest(req: { method: string; path: string; body?: unknown }): Promise<AppStudioProxyResult> {
    const started = performance.now();
    const proxyPath = appStudioPathToProxyPath(req.path);
    if (!proxyPath) {
      const error = `Path must start with /obp/ (got ${JSON.stringify(req.path)})`;
      pushNetwork({ method: req.method, path: req.path, status: 0, ms: 0, error });
      return { ok: false, status: 400, error };
    }
    const method = req.method.toUpperCase();
    // Only reads run unattended. Anything that writes needs a human click, because the
    // code making the call was written by the model and runs with the user's own access.
    if (method !== "GET" && method !== "HEAD") {
      const allowed = confirm(`The app wants to ${method} ${req.path}.\n\nAllow this call?`);
      if (!allowed) {
        const error = `${method} ${req.path} blocked by the user`;
        pushNetwork({ method, path: req.path, status: 0, ms: 0, error });
        return { ok: false, status: 403, error };
      }
    }
    try {
      const response = await fetch(proxyPath, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(req.body ?? {}),
      });
      const text = await response.text();
      let body: unknown = text;
      try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
      const error = response.ok ? undefined : ((body as any)?.message ?? `HTTP ${response.status}`);
      pushNetwork({ method, path: req.path, status: response.status, ms: Math.round(performance.now() - started), error });
      return { ok: response.ok, status: response.status, body, error };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      pushNetwork({ method, path: req.path, status: 0, ms: Math.round(performance.now() - started), error });
      return { ok: false, status: 0, error };
    }
  }

  // ---- Opey: the app is a one-field form Opey fills via set_form_fields -----
  const MAX_SOURCE_IN_CONTEXT = 14000;

  function applyDraft(fields: Record<string, unknown>): { applied: string[]; ignored: string[] } {
    const applied: string[] = [];
    const ignored: string[] = [];
    let changed = false;
    for (const [name, value] of Object.entries(fields ?? {})) {
      if (name === "html") {
        if (typeof value !== "string" || !value.trim()) { ignored.push(name); continue; }
        if (opeyPreviousSource === null) opeyPreviousSource = source;
        source = value;
        applied.push(name);
        changed = true;
      } else if (name === "title") {
        if (opeyPreviousTitle === null) opeyPreviousTitle = title;
        title = String(value ?? "");
        applied.push(name);
      } else {
        ignored.push(name);
      }
    }
    if (changed) run();
    return { applied, ignored };
  }

  function revertOpey() {
    if (opeyPreviousSource !== null) source = opeyPreviousSource;
    if (opeyPreviousTitle !== null) title = opeyPreviousTitle;
    opeyPreviousSource = null;
    opeyPreviousTitle = null;
    run();
  }
  function keepOpey() {
    opeyPreviousSource = null;
    opeyPreviousTitle = null;
  }

  function describeStudio(): string {
    const src = source.length > MAX_SOURCE_IN_CONTEXT
      ? source.slice(0, MAX_SOURCE_IN_CONTEXT) + `\n<!-- … truncated, ${source.length} chars total -->`
      : source;
    const lines = [
      "Form: App Studio (a single-page mobile web app that calls the OBP API).",
      "Fields settable via set_form_fields:",
      "- html (string, REQUIRED: the COMPLETE HTML document — doctype, head, styles, body and scripts. Always send the whole document, never a fragment or a diff.)",
      "- title (string, short app name)",
      "",
      "Runtime the app runs in:",
      `- A ${390}x${780} phone-sized sandboxed iframe. No cookies, no localStorage across runs, no access to the host page.`,
      "- A global `obp` object is injected before the app's scripts:",
      "    await obp.get('/obp/v6.0.0/banks')            -> parsed JSON, throws Error(message) with .status on non-2xx",
      "    await obp.post(path, bodyObject) / obp.put(path, bodyObject) / obp.delete(path)",
      "    await obp.request(method, path, body)        -> { ok, status, body, error } (never throws)",
      "- Paths MUST start with /obp/ and include the version, e.g. /obp/v6.0.0/my/accounts. Query strings are allowed.",
      "- The host proxies calls with the current user's OBP access. GET runs unattended; POST/PUT/DELETE prompt the user to allow each call.",
      "- Do NOT use fetch()/XMLHttpRequest for OBP; only `obp.*`. External CSS/JS via CDN <link>/<script src> is allowed but plain HTML/CSS/JS is preferred.",
      "- console.log/warn/error and uncaught errors are relayed to the host and shown to you below, so check them after each change.",
      "- Use your OBP endpoint tools (get_endpoint_schema, list_endpoints_by_tag) to confirm paths and response shapes before writing calls.",
      "- Design for a phone: mobile-first, touch-sized targets, no horizontal scrolling. Keep it self-contained and readable.",
      "",
      `Current title: ${JSON.stringify(title)}`,
      "Current html:",
      src,
      "",
      network.length ? "Recent OBP calls from the app (most recent last):" : "Recent OBP calls from the app: none yet.",
      ...network.slice(-15).map((n) => `  ${n.method} ${n.path} -> ${n.status || "no response"}${n.error ? ` (${n.error})` : ""} ${n.ms}ms`),
      logs.length ? "Recent console output / errors (most recent last):" : "Console output: none.",
      ...logs.slice(-20).map((l) => `  [${l.level}] ${l.message.slice(0, 500)}`),
    ];
    return lines.join("\n");
  }

  const bridgeTarget = { formName: "app-studio", applyDraft, describe: describeStudio };
  onMount(() => {
    formBridge.register(bridgeTarget);
    return () => formBridge.unregister(bridgeTarget);
  });

  const clientTools = {
    set_form_fields: async (toolInput: Record<string, any>) => formBridge.apply(toolInput?.fields ?? {}),
  };
  const clientContext = () => formBridge.describe();

  const suggestedQuestions: SuggestedQuestion[] = [
    {
      questionString: "Build a mobile banking home screen that lists my accounts with their balances, grouped by bank.",
      pillTitle: "My accounts screen",
      icon: Landmark,
    },
    {
      questionString: "Add a transactions screen: tapping an account shows its latest transactions with amounts and descriptions, and a back button.",
      pillTitle: "Add transactions",
      icon: ListOrdered,
    },
    {
      questionString: "Restyle the app with a dark theme, larger touch targets and a bottom tab bar.",
      pillTitle: "Restyle it",
      icon: Wand2,
    },
  ];

  const opeyChatOptions: Partial<OpeyChatOptions> = {
    baseUrl: env.PUBLIC_OPEY_BASE_URL,
    displayHeader: false,
    currentlyActiveUserName: page.data.username || "Guest",
    suggestedQuestions,
    currentConsentInfo: page.data.opeyConsentInfo || undefined,
    displayConnectionPips: true,
    consentMetricsHref: "/metrics",
    initialAssistantMessage:
      "Describe the app you want and I'll write it as a phone-sized web page that calls the OBP API through `obp.get(...)`. It runs in the preview straight away, and I can see its console and API calls, so tell me what to change.",
  };

  function handleEditorKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    }
  }
</script>

<svelte:head>
  <title>App Studio - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-[110rem] px-4 py-8">
  <div class="mb-6">
    <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
      <Smartphone class="h-7 w-7" />
      App Studio
    </h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">
      Ask Opey for a phone-sized web app. It runs in the sandboxed preview and calls the OBP API through the host,
      using your access. Reads run unattended; writes ask you first.
    </p>
  </div>

  {#if opeyPreviousSource !== null || opeyPreviousTitle !== null}
    <div
      class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
      data-testid="app-studio-opey-banner"
    >
      <span>Opey updated the app. Review the preview, then keep or revert.</span>
      <div class="flex gap-2">
        <button type="button" class="rounded-md border border-blue-300 px-3 py-1 font-medium hover:bg-blue-100 dark:border-blue-700 dark:hover:bg-blue-900/40" onclick={revertOpey} data-testid="app-studio-revert">
          Revert
        </button>
        <button type="button" class="rounded-md bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700" onclick={keepOpey} data-testid="app-studio-keep">
          Keep
        </button>
      </div>
    </div>
  {/if}

  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto_minmax(20rem,26rem)]">
    <!-- Source -->
    <section class="flex min-h-[36rem] flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="app-studio-source">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-2 text-sm">
          <span class="font-medium text-gray-700 dark:text-gray-300">Title</span>
          <input type="text" name="title" class="input w-48 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900" bind:value={title} data-testid="app-studio-title" />
        </label>
        <div class="ml-auto flex flex-wrap gap-2">
          <button type="button" class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700" onclick={run} data-testid="app-studio-run">
            <Play class="h-4 w-4" /> Run
          </button>
          <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" onclick={copySource} data-testid="app-studio-copy">
            <Copy class="h-4 w-4" /> {copied ? "Copied" : "Copy"}
          </button>
          <a href={downloadHref} download={downloadName} class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" data-testid="app-studio-download">
            <Download class="h-4 w-4" /> Download
          </a>
          <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" onclick={resetToStarter} data-testid="app-studio-reset">
            <RotateCcw class="h-4 w-4" /> Starter
          </button>
        </div>
      </div>
      <textarea
        name="html"
        class="min-h-[24rem] flex-1 resize-y rounded-md border border-gray-300 bg-gray-50 p-3 font-mono text-xs leading-5 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        spellcheck="false"
        bind:value={source}
        onkeydown={handleEditorKeydown}
        data-testid="app-studio-html"
      ></textarea>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Ctrl+Enter runs the app. The app calls OBP with <code>obp.get('/obp/v6.0.0/…')</code>.</p>

      <!-- Console + network -->
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <div class="rounded-md border border-gray-200 dark:border-gray-700">
          <div class="border-b border-gray-200 px-3 py-1.5 text-xs font-semibold uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">OBP calls</div>
          <ul class="max-h-40 overflow-auto p-2 font-mono text-xs" data-testid="app-studio-network">
            {#if network.length === 0}
              <li class="text-gray-400">None yet.</li>
            {/if}
            {#each network as n, i (i)}
              <li class={n.error ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}>
                {n.method} {n.path} → {n.status || "—"} {n.ms}ms{n.error ? ` · ${n.error}` : ""}
              </li>
            {/each}
          </ul>
        </div>
        <div class="rounded-md border border-gray-200 dark:border-gray-700">
          <div class="border-b border-gray-200 px-3 py-1.5 text-xs font-semibold uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">Console</div>
          <ul class="max-h-40 overflow-auto p-2 font-mono text-xs" data-testid="app-studio-console">
            {#if logs.length === 0}
              <li class="text-gray-400">Nothing logged.</li>
            {/if}
            {#each logs as l, i (i)}
              <li class={l.level === "error" ? "text-red-600 dark:text-red-400" : l.level === "warn" ? "text-yellow-700 dark:text-yellow-300" : "text-gray-700 dark:text-gray-300"}>
                [{l.level}] {l.message}
              </li>
            {/each}
          </ul>
        </div>
      </div>
    </section>

    <!-- Phone preview -->
    <section class="xl:sticky xl:top-4 xl:self-start" data-testid="app-studio-preview">
      <AppStudioPreview {source} {runId} onRequest={handleAppRequest} onLog={pushLog} />
      <p class="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">{title || "Untitled app"} · run {runId}</p>
    </section>

    <!-- Opey pane: OpeyChat requires a definite height all the way down -->
    <aside class="xl:sticky xl:top-4" data-testid="opey-form-pane">
      <div class="h-[36rem] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm xl:h-[calc(100vh-8rem)] dark:border-gray-700">
        <OpeyChat {opeyChatOptions} userAuthenticated={!!page.data.userId} {clientTools} {clientContext} />
      </div>
    </aside>
  </div>
</div>
