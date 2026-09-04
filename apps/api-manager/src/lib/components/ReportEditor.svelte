<script lang="ts">
  import { onMount } from "svelte";
  import { AppStudioPreview, appStudioPathToProxyPath } from "@obp/shared/components";
  import type { AppStudioProxyResult } from "@obp/shared/components";
  import { Play, Download, Save, Trash2, Copy } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import {
    parseParameters, defaultParameterValues, coerceParameterValues, buildRunnerDocument, resultToTable, tableToCsv,
    type ReportFormValues, type ReportResult,
  } from "$lib/services/reports";

  interface Props {
    initial: ReportFormValues;
    bankIds: string[];
    saving?: boolean;
    canDelete?: boolean;
    onSave: (values: ReportFormValues) => Promise<void>;
    onDelete?: () => Promise<void>;
    /** Create a separate copy of what is in the editor right now. */
    onDuplicate?: (values: ReportFormValues) => Promise<void>;
  }
  let { initial, bankIds, saving = false, canDelete = false, onSave, onDelete, onDuplicate }: Props = $props();

  // ---- Definition fields (initial values are read once; the editor owns them afterwards) ----
  const start = initial;
  let title = $state(start.title);
  let slug = $state(start.slug);
  let description = $state(start.description);
  let parameters = $state(start.parameters);
  let definition = $state(start.definition);
  let saveError = $state("");

  // The slug follows the title (lower-case, hyphens) until the author edits the slug by hand.
  const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  let slugTouched = $state(start.slug !== "" && start.slug !== slugify(start.title));
  $effect(() => {
    if (!slugTouched) slug = slugify(title);
  });

  const parsedParams = $derived(parseParameters(parameters));
  let paramValues = $state<Record<string, string>>(defaultParameterValues(parseParameters(start.parameters).params));
  // Keep the run form in step with the declared parameters (new ones get their default).
  $effect(() => {
    const next = { ...paramValues };
    let changed = false;
    for (const p of parsedParams.params) {
      if (!(p.name in next)) { next[p.name] = p.default === undefined || p.default === null ? "" : String(p.default); changed = true; }
    }
    if (changed) paramValues = next;
  });

  // ---- Running ----
  interface LogEntry { level: "log" | "warn" | "error"; message: string }
  interface NetworkEntry { method: string; path: string; status: number; ms: number; error?: string }
  let runnerSource = $state("");
  let runId = $state(0);
  let running = $state(false);
  let runError = $state("");
  let result = $state<ReportResult | null>(null);
  let logs = $state<LogEntry[]>([]);
  let network = $state<NetworkEntry[]>([]);
  let lastRunMs = $state(0);
  let runStarted = 0;

  const table = $derived(result ? resultToTable(result) : { columns: [], rows: [] });

  function runReport() {
    const missing = parsedParams.params.filter((p) => p.required && !(paramValues[p.name] ?? "").trim());
    if (missing.length) { runError = `Missing: ${missing.map((p) => p.label || p.name).join(", ")}`; return; }
    runError = ""; result = null; logs = []; network = [];
    running = true; runStarted = performance.now();
    runnerSource = buildRunnerDocument(definition, coerceParameterValues(parsedParams.params, paramValues));
    runId += 1;
  }

  function handleEmit(name: string, data: unknown) {
    if (name === "report:result") {
      result = (data && typeof data === "object" ? data : { items: [] }) as ReportResult;
      running = false; lastRunMs = Math.round(performance.now() - runStarted);
    } else if (name === "report:error") {
      const e = data as { message?: string; stack?: string };
      runError = e?.message ?? "The report failed";
      if (e?.stack) logs = [...logs, { level: "error", message: e.stack }];
      running = false; lastRunMs = Math.round(performance.now() - runStarted);
    }
  }

  async function handleAppRequest(req: { method: string; path: string; body?: unknown }): Promise<AppStudioProxyResult> {
    const started = performance.now();
    const proxyPath = appStudioPathToProxyPath(req.path);
    if (!proxyPath) {
      const error = `Path must start with /obp/ (got ${JSON.stringify(req.path)})`;
      network = [...network, { method: req.method, path: req.path, status: 0, ms: 0, error }];
      return { ok: false, status: 400, error };
    }
    const method = req.method.toUpperCase();
    // A report reads. A write is unusual and is the author's deliberate choice: ask.
    if (method !== "GET" && method !== "HEAD" && !confirm(`The report wants to ${method} ${req.path}.\n\nAllow it?`)) {
      const error = `${method} ${req.path} blocked by the user`;
      network = [...network, { method, path: req.path, status: 0, ms: 0, error }];
      return { ok: false, status: 403, error };
    }
    try {
      const response = await fetch(proxyPath, {
        method, headers: { "Content-Type": "application/json" }, credentials: "include",
        body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(req.body ?? {}),
      });
      const text = await response.text();
      let body: unknown = text;
      try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
      const error = response.ok ? undefined : ((body as any)?.message ?? `HTTP ${response.status}`);
      network = [...network.slice(-49), { method, path: req.path, status: response.status, ms: Math.round(performance.now() - started), error }];
      return { ok: response.ok, status: response.status, body, error };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      network = [...network, { method, path: req.path, status: 0, ms: Math.round(performance.now() - started), error }];
      return { ok: false, status: 0, error };
    }
  }

  function downloadCsv() {
    const csv = tableToCsv(table.columns, table.rows);
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `${slug || "report"}.csv`;
    a.click();
  }

  // ---- Opey (formBridge) ----
  type FieldAccess = { get: () => string; set: (v: unknown) => void };
  const asText = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const draftFields: Record<string, FieldAccess> = {
    title: { get: () => title, set: (v) => (title = asText(v)) },
    slug: { get: () => slug, set: (v) => (slug = asText(v)) },
    description: { get: () => description, set: (v) => (description = asText(v)) },
    parameters: { get: () => parameters, set: (v) => (parameters = typeof v === "string" ? v : JSON.stringify(v ?? [], null, 2)) },
    definition: { get: () => definition, set: (v) => (definition = asText(v)) },
  };
  let opeyPrevious = $state<Record<string, string>>({});
  const opeyFilled = $derived(Object.keys(opeyPrevious));
  function applyDraft(fields: Record<string, unknown>) {
    const applied: string[] = []; const ignored: string[] = [];
    for (const [name, value] of Object.entries(fields ?? {})) {
      const access = draftFields[name];
      if (!access) { ignored.push(name); continue; }
      const before = access.get();
      access.set(value);
      if (!(name in opeyPrevious)) opeyPrevious = { ...opeyPrevious, [name]: before };
      applied.push(name);
    }
    return { applied, ignored };
  }
  function revertField(name: string) {
    const access = draftFields[name];
    if (!access || !(name in opeyPrevious)) return;
    access.set(opeyPrevious[name]);
    const { [name]: _d, ...rest } = opeyPrevious; opeyPrevious = rest;
  }
  function describeForm(): string {
    const def = definition.length > 12000 ? definition.slice(0, 12000) + `\n// … truncated, ${definition.length} chars` : definition;
    const lines = [
      "Form: Report (a saved report definition on the API Manager; runs in the viewer's browser with the viewer's own OBP access).",
      "Fields settable via set_form_fields:",
      "- title (string), slug (string, lower-case-with-hyphens), description (string)",
      "- parameters (JSON array of { name, label?, type?: string|number|date|bank_id|boolean, default?, required?, description? }; the viewer fills these in before a run)",
      "- definition (JavaScript source, REQUIRED. Always send the COMPLETE source. It must declare `async function run(params, obp)` and return { title?, columns: string[], rows: any[][] } or { items: object[] }.)",
      "",
      "Runtime for the definition:",
      "- It runs in a sandboxed iframe: no DOM of the host, no cookies, no imports; plain modern JavaScript only.",
      "- obp.get(path) -> parsed JSON (throws Error with .status on non-2xx); obp.post/put/delete(path, body). Paths MUST start with /obp/ and include the version, e.g. /obp/v6.0.0/banks. GET runs unattended; writes prompt the viewer.",
      "- params holds the parameter values, coerced to the declared types (number -> Number, boolean -> true/false, others strings).",
      "- console.log/warn/error are relayed and shown to you below. Prefer few, targeted calls: metrics endpoints under /obp/v6.0.0/management/… need roles the viewer may lack; account data needs views.",
      "- Use your OBP endpoint tools (get_endpoint_schema, list_endpoints_by_tag) to confirm paths and response shapes before writing calls.",
      `Known bank ids (first 30 of ${bankIds.length}): ${bankIds.slice(0, 30).join(", ") || "(none loaded)"}`,
      "",
      `Current title: ${JSON.stringify(title)}; slug: ${JSON.stringify(slug)}; description: ${JSON.stringify(description)}`,
      "Current parameters:", parameters || "[]",
      "Current definition:", def,
      "",
      result
        ? `Last run: OK in ${lastRunMs}ms, ${table.rows.length} row(s), columns: ${table.columns.join(", ")}. First row: ${JSON.stringify(table.rows[0] ?? [])}`
        : runError ? `Last run FAILED after ${lastRunMs}ms: ${runError}` : "Last run: none yet.",
      network.length ? "OBP calls in the last run:" : "OBP calls in the last run: none.",
      ...network.slice(-15).map((n) => `  ${n.method} ${n.path} -> ${n.status || "no response"}${n.error ? ` (${n.error})` : ""} ${n.ms}ms`),
      logs.length ? "Console output (most recent last):" : "Console output: none.",
      ...logs.slice(-20).map((l) => `  [${l.level}] ${l.message.slice(0, 500)}`),
    ];
    return lines.join("\n");
  }
  const bridgeTarget = { formName: "report", applyDraft, describe: describeForm };
  onMount(() => {
    formBridge.register(bridgeTarget);
    return () => formBridge.unregister(bridgeTarget);
  });

  function currentValues(): ReportFormValues {
    return { slug: slug.trim(), title: title.trim(), description: description.trim(), parameters: parameters.trim() || "[]", definition };
  }

  async function handleSave() {
    saveError = "";
    if (!title.trim()) { saveError = "Give the report a title."; return; }
    if (parsedParams.error) { saveError = parsedParams.error; return; }
    try {
      await onSave(currentValues());
    } catch (e) {
      saveError = e instanceof Error ? e.message : String(e);
    }
  }

  let duplicating = $state(false);
  async function handleDuplicate() {
    if (!onDuplicate) return;
    saveError = "";
    if (!title.trim()) { saveError = "Give the report a title before duplicating it."; return; }
    if (parsedParams.error) { saveError = parsedParams.error; return; }
    duplicating = true;
    try {
      await onDuplicate(currentValues());
    } catch (e) {
      saveError = e instanceof Error ? e.message : String(e);
    } finally {
      duplicating = false;
    }
  }

  function inputType(p: { type?: string }): string {
    return p.type === "number" ? "number" : p.type === "date" ? "date" : "text";
  }
</script>

{#if opeyFilled.length > 0}
  <div class="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200" data-testid="opey-filled-banner">
    <span>Opey filled {opeyFilled.length} field{opeyFilled.length === 1 ? "" : "s"}:</span>
    {#each opeyFilled as name (name)}
      <span class="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs dark:bg-gray-800">{name} <button type="button" class="underline" onclick={() => revertField(name)} data-testid="opey-revert-{name}">revert</button></span>
    {/each}
    <button type="button" class="ml-auto rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700" onclick={() => (opeyPrevious = {})} data-testid="opey-accept-all">Keep all</button>
  </div>
{/if}

<div class="space-y-6" data-testid="report-editor">
  <!-- Definition -->
  <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div class="grid gap-4 md:grid-cols-2">
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-gray-700 dark:text-gray-300">Title</span>
        <input type="text" name="title" bind:value={title} class="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900" data-testid="report-title" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-gray-700 dark:text-gray-300">Slug</span>
        <input type="text" name="slug" bind:value={slug} oninput={() => (slugTouched = true)} placeholder="follows the title" class="rounded-md border border-gray-300 px-2 py-1.5 font-mono text-sm dark:border-gray-600 dark:bg-gray-900" data-testid="report-slug" />
      </label>
      <label class="flex flex-col gap-1 text-sm md:col-span-2">
        <span class="font-medium text-gray-700 dark:text-gray-300">Description</span>
        <input type="text" name="description" bind:value={description} class="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900" data-testid="report-description" />
      </label>
      <label class="flex flex-col gap-1 text-sm md:col-span-2">
        <span class="font-medium text-gray-700 dark:text-gray-300">Parameters (JSON array)</span>
        <textarea name="parameters" bind:value={parameters} rows="4" spellcheck="false" class="rounded-md border border-gray-300 px-2 py-1.5 font-mono text-xs dark:border-gray-600 dark:bg-gray-900" data-testid="report-parameters"></textarea>
        {#if parsedParams.error}<span class="text-xs text-red-600 dark:text-red-400">{parsedParams.error}</span>{:else}<span class="text-xs text-gray-500 dark:text-gray-400">Each item: name, label, type (string, number, date, bank_id, boolean), default, required.</span>{/if}
      </label>
      <label class="flex flex-col gap-1 text-sm md:col-span-2">
        <span class="font-medium text-gray-700 dark:text-gray-300">Definition (JavaScript: <code>async function run(params, obp)</code>)</span>
        <textarea name="definition" bind:value={definition} rows="16" spellcheck="false" class="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs leading-5 dark:border-gray-600 dark:bg-gray-900" data-testid="report-definition"></textarea>
      </label>
    </div>
    <div class="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={saving} onclick={handleSave} data-testid="report-save"><Save class="h-4 w-4" /> {saving ? "Saving…" : "Save report"}</button>
      {#if onDuplicate}
        <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" disabled={saving || duplicating} onclick={handleDuplicate} data-testid="report-duplicate"><Copy class="h-4 w-4" /> {duplicating ? "Duplicating…" : "Duplicate"}</button>
      {/if}
      {#if canDelete && onDelete}
        <button type="button" class="inline-flex items-center gap-1 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20" onclick={onDelete} data-testid="report-delete"><Trash2 class="h-4 w-4" /> Delete</button>
      {/if}
      {#if saveError}<span class="text-sm text-red-700 dark:text-red-300" data-testid="report-save-error">{saveError}</span>{/if}
    </div>
  </section>

  <!-- Run -->
  <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="report-run" data-state={running ? "running" : runError ? "error" : result ? "done" : "idle"}>
    <div class="flex flex-wrap items-end gap-3">
      {#each parsedParams.params as p (p.name)}
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-gray-700 dark:text-gray-300">{p.label || p.name}{p.required ? " *" : ""}</span>
          {#if p.type === "boolean"}
            <select name="param_{p.name}" bind:value={paramValues[p.name]} class="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900" data-testid="report-param-{p.name}"><option value="false">false</option><option value="true">true</option></select>
          {:else if p.type === "bank_id"}
            <input type="text" name="param_{p.name}" list="report-bank-ids" bind:value={paramValues[p.name]} class="rounded-md border border-gray-300 px-2 py-1.5 font-mono text-sm dark:border-gray-600 dark:bg-gray-900" data-testid="report-param-{p.name}" />
          {:else}
            <input type={inputType(p)} name="param_{p.name}" bind:value={paramValues[p.name]} class="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900" data-testid="report-param-{p.name}" />
          {/if}
          {#if p.description}<span class="text-xs text-gray-500 dark:text-gray-400">{p.description}</span>{/if}
        </label>
      {/each}
      <datalist id="report-bank-ids">{#each bankIds as id (id)}<option value={id}></option>{/each}</datalist>
      <button type="button" class="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60" disabled={running || !definition.trim()} onclick={runReport} data-testid="report-run-button"><Play class="h-4 w-4" /> {running ? "Running…" : "Run"}</button>
      {#if result}
        <button type="button" class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" onclick={downloadCsv} data-testid="report-csv"><Download class="h-4 w-4" /> CSV</button>
        <span class="text-xs text-gray-500 dark:text-gray-400">{table.rows.length} row{table.rows.length === 1 ? "" : "s"} · {lastRunMs}ms · {network.length} OBP call{network.length === 1 ? "" : "s"}</span>
      {/if}
    </div>

    {#if runError}<p class="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200" data-testid="report-run-error">{runError}</p>{/if}

    {#if result}
      {#if result.title}<h3 class="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{result.title}</h3>{/if}
      {#if result.note}<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{result.note}</p>{/if}
      <div class="mt-3 overflow-x-auto">
        <table class="w-full text-left text-sm" data-testid="report-table">
          <thead class="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <tr>{#each table.columns as c (c)}<th class="py-2 pr-4">{c}</th>{/each}</tr>
          </thead>
          <tbody>
            {#each table.rows as row, i (i)}
              <tr class="border-b border-gray-100 dark:border-gray-700/60">{#each row as v, j (j)}<td class="py-1.5 pr-4 align-top font-mono text-xs text-gray-800 dark:text-gray-200">{v}</td>{/each}</tr>
            {/each}
          </tbody>
        </table>
        {#if table.rows.length === 0}<p class="py-3 text-sm text-gray-500 dark:text-gray-400">No rows.</p>{/if}
      </div>
    {/if}

    {#if logs.length > 0 || network.length > 0}
      <details class="mt-3 text-xs">
        <summary class="cursor-pointer text-gray-600 dark:text-gray-400">Console and OBP calls</summary>
        <ul class="mt-2 max-h-48 overflow-auto rounded-md border border-gray-200 p-2 font-mono dark:border-gray-700" data-testid="report-console">
          {#each network as n, i (i)}<li class={n.error ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}>{n.method} {n.path} → {n.status || "—"} {n.ms}ms{n.error ? ` · ${n.error}` : ""}</li>{/each}
          {#each logs as l, i (i)}<li class={l.level === "error" ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}>[{l.level}] {l.message}</li>{/each}
        </ul>
      </details>
    {/if}

    <!-- The runner: an invisible sandboxed frame that executes the definition. -->
    {#if runnerSource}
      <div class="h-px w-px overflow-hidden opacity-0" aria-hidden="true">
        <AppStudioPreview source={runnerSource} {runId} layout="fill" minHeight={1} maxHeight={1} onRequest={handleAppRequest} onLog={(e) => (logs = [...logs.slice(-49), e])} onEmit={handleEmit} />
      </div>
    {/if}
  </section>
</div>
