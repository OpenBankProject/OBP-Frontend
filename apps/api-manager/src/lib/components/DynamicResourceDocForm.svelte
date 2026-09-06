<script module lang="ts">
  export interface DynamicResourceDocFormValues {
    bank_id?: string;
    dynamic_resource_doc_id?: string;
    partial_function_name: string;
    request_verb: string;
    request_url: string;
    summary: string;
    description: string;
    method_body: string;
    example_request_body: any;
    success_response_body: any;
    error_response_bodies: string;
    tags: string;
    roles: string;
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";

  interface Props {
    initial?: Partial<DynamicResourceDocFormValues>;
    submitLabel?: string;
    onSubmit: (values: DynamicResourceDocFormValues) => Promise<void>;
    cancel?: Snippet;
    /**
     * When the page hosts Opey, this sends a prompt into the chat and resolves true if it was
     * accepted (false while Opey is still streaming). Enables the Compile → Opey → Compile loop.
     */
    onFixWithOpey?: (prompt: string) => Promise<boolean>;
  }

  let { initial = {}, submitLabel = "Save", onSubmit, cancel, onFixWithOpey }: Props = $props();

  // method_body is URL-encoded Scala in OBP. The operator edits plain Scala;
  // we encode on submit and decode here on load.
  function decodeMethodBody(encoded: string): string {
    if (!encoded) return "";
    try {
      return decodeURIComponent(encoded);
    } catch {
      // If OBP sent us something not URL-encoded for some reason, show it raw.
      return encoded;
    }
  }

  let partial_function_name = $state(initial.partial_function_name ?? "");
  let request_verb = $state(initial.request_verb ?? "GET");
  let request_url = $state(initial.request_url ?? "");
  let summary = $state(initial.summary ?? "");
  let description = $state(initial.description ?? "");
  let method_body_text = $state(decodeMethodBody(initial.method_body ?? ""));
  let example_request_body_text = $state(
    initial.example_request_body !== undefined
      ? JSON.stringify(initial.example_request_body, null, 2)
      : "",
  );
  let success_response_body_text = $state(
    initial.success_response_body !== undefined
      ? JSON.stringify(initial.success_response_body, null, 2)
      : "",
  );
  let error_response_bodies = $state(initial.error_response_bodies ?? "");
  let tags = $state(initial.tags ?? "");
  let roles = $state(initial.roles ?? "");

  // ---- Draft support (Opey via formBridge) --------------------------------
  // Field registry: how an external draft (plain values, Scala un-encoded)
  // maps onto the form's state. Each entry can read and write its field.
  // NOTE: method_body arrives as PLAIN Scala; encoding happens on submit.
  type FieldAccess = { get: () => string; set: (v: unknown) => void };
  const draftFields: Record<string, FieldAccess> = {
    partial_function_name: { get: () => partial_function_name, set: (v) => (partial_function_name = asText(v)) },
    request_verb: {
      get: () => request_verb,
      set: (v) => {
        const verb = asText(v).trim().toUpperCase();
        if (VERBS.includes(verb)) request_verb = verb;
        else throw new Error(`request_verb must be one of ${VERBS.join(", ")}`);
      },
    },
    request_url: { get: () => request_url, set: (v) => (request_url = asText(v)) },
    summary: { get: () => summary, set: (v) => (summary = asText(v)) },
    description: { get: () => description, set: (v) => (description = asText(v)) },
    method_body: { get: () => method_body_text, set: (v) => (method_body_text = asText(v)) },
    example_request_body: { get: () => example_request_body_text, set: (v) => (example_request_body_text = asJsonText(v)) },
    success_response_body: { get: () => success_response_body_text, set: (v) => (success_response_body_text = asJsonText(v)) },
    error_response_bodies: { get: () => error_response_bodies, set: (v) => (error_response_bodies = asText(v)) },
    tags: { get: () => tags, set: (v) => (tags = asText(v)) },
    roles: { get: () => roles, set: (v) => (roles = asText(v)) },
  };

  function asText(v: unknown): string {
    return typeof v === "string" ? v : v == null ? "" : String(v);
  }
  /** Body fields are edited as JSON text; accept an object or a string. */
  function asJsonText(v: unknown): string {
    if (typeof v === "string") return v;
    if (v == null) return "";
    return JSON.stringify(v, null, 2);
  }

  // field name -> value before Opey touched it (also marks "filled by Opey")
  let opeyPrevious = $state<Record<string, string>>({});
  let opeyFilledFields = $derived(Object.keys(opeyPrevious));

  function applyDraft(fields: Record<string, unknown>): { applied: string[]; ignored: string[] } {
    const applied: string[] = [];
    const ignored: string[] = [];
    for (const [name, value] of Object.entries(fields ?? {})) {
      const access = draftFields[name];
      if (!access) {
        ignored.push(name);
        continue;
      }
      const before = access.get();
      try {
        access.set(value);
      } catch {
        ignored.push(name);
        continue;
      }
      // First touch wins: revert restores what the USER had, not Opey's own last draft.
      if (!(name in opeyPrevious)) opeyPrevious = { ...opeyPrevious, [name]: before };
      applied.push(name);
    }
    if (fixActive && applied.includes("method_body")) {
      // Let the field update settle, then run the next round of the loop.
      setTimeout(() => void continueFixLoop(), 0);
    }
    return { applied, ignored };
  }

  function revertField(name: string) {
    const access = draftFields[name];
    if (!access || !(name in opeyPrevious)) return;
    access.set(opeyPrevious[name]);
    const { [name]: _dropped, ...rest } = opeyPrevious;
    opeyPrevious = rest;
  }

  function acceptAll() {
    opeyPrevious = {};
  }

  /** Model-facing description of this form: fields, constraints, current values. */
  function describeForm(): string {
    const lines = [
      "Form: Dynamic Resource Doc (defines a new OBP endpoint).",
      "Fields settable via set_form_fields (values as plain text; method_body is PLAIN Scala, not URL-encoded):",
      `- partial_function_name (string, camelCase Scala identifier, required)`,
      `- request_verb (one of ${VERBS.join("/")}, required)`,
      `- request_url (string, must start with /, UPPER_CASE segments are path params, required)`,
      `- summary (string, one line)`,
      `- description (string, prose, max 2000 chars)`,
      `- method_body (Scala source, required; inlined into an http4s handler: in scope are callContext: CallContext, request: org.http4s.Request[IO], pathParams: Map[String, String], the generated RequestRootJsonClass/ResponseRootJsonClass, and errorResponse(message, code). The last expression must be Future.successful((responseValue, HttpCode.\`200\`(callContext))) or errorResponse(...). Do NOT return Lift Box/Full/JsonResponse values.)`,
      `- example_request_body (JSON object; required for POST/PUT)`,
      `- success_response_body (JSON object, required)`,
      `- error_response_bodies (comma-separated OBP error names, e.g. $UserNotLoggedIn,$UnknownError)`,
      `- tags (comma-separated)`,
      `- roles (comma-separated OBP role names that guard the endpoint)`,
      "Current values (empty means unset):",
    ];
    for (const [name, access] of Object.entries(draftFields)) {
      let value = access.get();
      if (name === "method_body" && value.length > 2000) {
        value = value.slice(0, 2000) + `\n... (${access.get().length} chars total)`;
      }
      lines.push(`  ${name}: ${value === "" ? "(empty)" : JSON.stringify(value)}`);
    }
    return lines.join("\n");
  }

  const bridgeTarget = {
    formName: "dynamic-resource-doc",
    applyDraft,
    describe: describeForm,
  };
  // ---- end draft support ---------------------------------------------------

  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);
  let fieldErrors = $state<Record<string, string>>({});
  let isGeneratingTemplate = $state(false);

  // ---- Dry-run compile (POST /obp/v7.0.0/management/dynamic-resource-docs/compile) ----
  interface CompileError { line: number; column: number; severity: string; message: string }
  type CompileStatus = "idle" | "compiling" | "ok" | "errors" | "failed";
  let compileStatus = $state<CompileStatus>("idle");
  let compileErrors = $state<CompileError[]>([]);
  let compileDependencyError = $state<string | null>(null);
  let compileMessage = $state<string | null>(null);
  let compileDurationMs = $state<number | null>(null);

  // Compile → Opey → Compile loop. Opey replaces method_body via set_form_fields; applyDraft
  // then recompiles automatically. Capped so a body Opey cannot fix does not spin forever.
  const FIX_MAX_ROUNDS = 3;
  let fixRound = $state(0);
  let fixActive = $state(false);
  let fixOutcome = $state<string | null>(null);

  function compilePayload() {
    return {
      request_verb: request_verb.trim().toUpperCase(),
      request_url: request_url.trim(),
      method_body: encodeURIComponent(method_body_text),
      example_request_body:
        methodHasBody && example_request_body_text.trim() ? safeParse(example_request_body_text) : undefined,
      success_response_body: success_response_body_text.trim() ? safeParse(success_response_body_text) : undefined,
    };
  }

  /** Runs one dry-run compile and updates the compile panel. Returns true when the body compiles. */
  async function compileNow(): Promise<boolean> {
    if (!method_body_text.trim()) {
      compileStatus = "failed";
      compileMessage = "Nothing to compile: the method body is empty.";
      return false;
    }
    compileStatus = "compiling";
    compileMessage = null;
    compileErrors = [];
    compileDependencyError = null;
    try {
      const response = await fetch("/proxy/obp/v7.0.0/management/dynamic-resource-docs/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(compilePayload()),
      });
      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(response, "Compile request failed");
        logErrorDetails("POST /dynamic-resource-docs/compile", errorDetails);
        compileStatus = "failed";
        compileMessage = formatErrorForDisplay(errorDetails);
        return false;
      }
      const data = await response.json();
      compileErrors = data.errors ?? [];
      compileDependencyError = data.dependency_error ?? null;
      compileDurationMs = typeof data.duration_ms === "number" ? data.duration_ms : null;
      compileStatus = data.compiles ? "ok" : "errors";
      return !!data.compiles;
    } catch (e) {
      compileStatus = "failed";
      compileMessage = e instanceof Error ? e.message : "Compile request failed";
      return false;
    }
  }

  function describeCompileErrors(): string {
    const lines = compileErrors.map((e) =>
      e.line > 0 ? `line ${e.line}, column ${e.column}: ${e.message}` : e.message,
    );
    if (compileDependencyError) lines.push(`dependency validator: ${compileDependencyError}`);
    return lines.join("\n");
  }

  function fixPrompt(): string {
    return [
      `The Dynamic Resource Doc method_body does not compile (round ${fixRound} of ${FIX_MAX_ROUNDS}). Fix it.`,
      "",
      "Compiler errors (line numbers are relative to method_body):",
      describeCompileErrors(),
      "",
      "Contract: the body is inlined into an http4s handler. In scope: callContext: CallContext, request: org.http4s.Request[IO], pathParams: Map[String, String], the generated RequestRootJsonClass / ResponseRootJsonClass, errorResponse(message, code), Future, HttpCode, and net.liftweb.common.{Box, Empty, Failure, Full} for matching on results. The last expression must be Future.successful((responseValue, HttpCode.`200`(callContext))) or errorResponse(...). Never return Lift Box/Full/JsonResponse values. Do not wrap the body in a method or class.",
      "",
      "Current method_body:",
      "```scala",
      method_body_text,
      "```",
      "",
      "Reply by calling set_form_fields with the complete corrected method_body only (no other fields), then one sentence on what you changed. Do not create the doc.",
    ].join("\n");
  }

  /** Sends the current errors to Opey. The recompile happens when Opey's set_form_fields lands. */
  async function requestFixFromOpey() {
    if (!onFixWithOpey) return;
    fixRound += 1;
    fixActive = true;
    fixOutcome = null;
    const accepted = await onFixWithOpey(fixPrompt());
    if (!accepted) {
      fixActive = false;
      fixRound -= 1;
      fixOutcome = "Opey is still answering; wait for it to finish, then try again.";
    }
  }

  function startFixLoop() {
    fixRound = 0;
    requestFixFromOpey();
  }

  function stopFixLoop(outcome: string | null) {
    fixActive = false;
    fixOutcome = outcome;
  }

  /** Called after Opey has written a new method_body while the loop is active. */
  async function continueFixLoop() {
    const ok = await compileNow();
    if (ok) {
      stopFixLoop(`Compiles after ${fixRound} Opey ${fixRound === 1 ? "round" : "rounds"}. Review the body, then submit.`);
    } else if (compileStatus === "failed") {
      stopFixLoop("The compile request itself failed; see the message above.");
    } else if (fixRound >= FIX_MAX_ROUNDS) {
      stopFixLoop(`Still failing after ${FIX_MAX_ROUNDS} rounds. Fix by hand or ask Opey in the chat with more detail.`);
    } else {
      await requestFixFromOpey();
    }
  }

  const VERBS = ["GET", "POST", "PUT", "DELETE"];

  onMount(() => {
    formBridge.register(bridgeTarget);
    return () => formBridge.unregister(bridgeTarget);
  });
  const methodHasBody = $derived(
    request_verb === "POST" || request_verb === "PUT",
  );

  async function generateTemplate() {
    // OBP's POST /management/dynamic-resource-docs/endpoint-code returns a
    // URL-encoded Scala skeleton we can drop into method_body.
    if (!request_verb || !request_url) {
      submitError = "Set request_verb and request_url first so the template can be generated.";
      return;
    }
    isGeneratingTemplate = true;
    submitError = null;
    try {
      const response = await fetch(
        "/proxy/obp/v4.0.0/management/dynamic-resource-docs/endpoint-code",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            partial_function_name: partial_function_name || "myEndpoint",
            request_verb,
            request_url,
            summary,
            description,
            example_request_body: methodHasBody && example_request_body_text.trim()
              ? safeParse(example_request_body_text)
              : undefined,
            success_response_body: success_response_body_text.trim()
              ? safeParse(success_response_body_text)
              : undefined,
          }),
        },
      );
      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to generate template",
        );
        logErrorDetails("POST /endpoint-code", errorDetails);
        submitError = formatErrorForDisplay(errorDetails);
        return;
      }
      const data = await response.json();
      method_body_text = decodeMethodBody(data.code ?? "");
    } catch (e) {
      submitError = e instanceof Error ? e.message : "Failed to generate template";
    } finally {
      isGeneratingTemplate = false;
    }
  }

  function safeParse(s: string): any {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  }

  function validate(): DynamicResourceDocFormValues | null {
    const errs: Record<string, string> = {};

    if (!partial_function_name.trim()) errs.partial_function_name = "Required";
    if (!request_verb.trim()) errs.request_verb = "Required";
    if (!request_url.trim()) errs.request_url = "Required";
    else if (!request_url.startsWith("/")) errs.request_url = "Must start with /";
    if (!method_body_text.trim()) errs.method_body = "Required — write Scala or click Generate template";

    let example_request_body: any = undefined;
    if (methodHasBody) {
      if (!example_request_body_text.trim()) {
        errs.example_request_body = "Required for POST/PUT";
      } else {
        try {
          example_request_body = JSON.parse(example_request_body_text);
        } catch (e) {
          errs.example_request_body =
            e instanceof Error ? e.message : "Invalid JSON";
        }
      }
    }

    let success_response_body: any = undefined;
    if (!success_response_body_text.trim()) {
      errs.success_response_body = "Required";
    } else {
      try {
        success_response_body = JSON.parse(success_response_body_text);
      } catch (e) {
        errs.success_response_body =
          e instanceof Error ? e.message : "Invalid JSON";
      }
    }

    fieldErrors = errs;
    if (Object.keys(errs).length > 0) return null;

    return {
      bank_id: initial.bank_id,
      dynamic_resource_doc_id: initial.dynamic_resource_doc_id,
      partial_function_name: partial_function_name.trim(),
      request_verb: request_verb.trim().toUpperCase(),
      request_url: request_url.trim(),
      summary: summary.trim(),
      description: description.trim(),
      method_body: encodeURIComponent(method_body_text),
      example_request_body,
      success_response_body,
      error_response_bodies: error_response_bodies.trim(),
      tags: tags.trim(),
      roles: roles.trim(),
    };
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    submitError = null;
    const values = validate();
    if (!values) return;
    isSubmitting = true;
    try {
      await onSubmit(values);
    } catch (err) {
      submitError = err instanceof Error ? err.message : "Submit failed";
    } finally {
      isSubmitting = false;
    }
  }
</script>

<form onsubmit={handleSubmit} class="space-y-6" data-testid="dynamic-resource-doc-form">
  {#if submitError}
    <div
      class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
      data-testid="form-error"
    >
      {submitError}
    </div>
  {/if}

  {#if opeyFilledFields.length > 0}
    <div
      class="rounded-lg border border-teal-300 bg-teal-50 p-3 text-sm dark:border-teal-700 dark:bg-teal-900/20"
      data-testid="opey-filled-banner"
    >
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-medium text-teal-800 dark:text-teal-200">
          Opey filled {opeyFilledFields.length}
          {opeyFilledFields.length === 1 ? "field" : "fields"} — review before submitting.
        </span>
        {#each opeyFilledFields as name (name)}
          <button
            type="button"
            onclick={() => revertField(name)}
            class="rounded-full border border-teal-400 px-2 py-0.5 text-xs text-teal-800 hover:bg-teal-100 dark:border-teal-600 dark:text-teal-200 dark:hover:bg-teal-800/40"
            data-testid="opey-revert-{name}"
            aria-label="Revert {name} to your previous value"
          >{name} ×</button>
        {/each}
        <button
          type="button"
          onclick={acceptAll}
          class="ml-auto text-xs text-teal-700 underline hover:text-teal-900 dark:text-teal-300"
          data-testid="opey-accept-all"
        >
          Accept all
        </button>
      </div>
      <p class="mt-1 text-xs text-teal-700 dark:text-teal-300">
        Click a field name to restore your previous value.
      </p>
    </div>
  {/if}

  <!-- Basic info -->
  <div class="grid gap-4 md:grid-cols-3">
    <label class="block md:col-span-1">
      <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Partial Function Name <span class="text-red-600">*</span>
      </span>
      <input
        type="text"
        name="partial_function_name"
        bind:value={partial_function_name}
        placeholder="createUser"
        data-testid="field-partial-function-name"
        class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      />
      <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
        A camelCase Scala-safe identifier. OBP uses it (plus a hash of verb+url) to name the compiled function internally.
      </span>
      {#if fieldErrors.partial_function_name}
        <p class="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.partial_function_name}</p>
      {/if}
    </label>

    <label class="block">
      <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Request Verb <span class="text-red-600">*</span>
      </span>
      <select
        name="request_verb"
        bind:value={request_verb}
        data-testid="field-request-verb"
        class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      >
        {#each VERBS as verb}
          <option value={verb}>{verb}</option>
        {/each}
      </select>
      <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
        GET and DELETE must not carry a request body.
      </span>
    </label>

    <label class="block md:col-span-1">
      <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Request URL <span class="text-red-600">*</span>
      </span>
      <input
        type="text"
        name="request_url"
        bind:value={request_url}
        placeholder="/my_user/MY_USER_ID"
        data-testid="field-request-url"
        class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      />
      <span class="mt-1 block min-w-0 break-words text-xs text-gray-500 dark:text-gray-400">
        Served at <code class="break-all">/obp/dynamic-resource-doc{request_url || "/..."}</code>. UPPER_CASE segments are path parameters — read them in Scala via <code>pathParams("MY_USER_ID")</code>.
      </span>
      {#if fieldErrors.request_url}
        <p class="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.request_url}</p>
      {/if}
    </label>
  </div>

  <label class="block">
    <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Summary</span>
    <input
      type="text"
      name="summary"
      bind:value={summary}
      placeholder="Create My User"
      data-testid="field-summary"
      class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
    />
    <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
      One-line title shown in API Explorer and resource-doc listings.
    </span>
  </label>

  <label class="block">
    <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</span>
    <textarea
      name="description"
      bind:value={description}
      rows="2"
      data-testid="field-description"
      class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
    ></textarea>
    <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
      Longer prose shown in API Explorer. OBP truncates to 2000 characters.
    </span>
  </label>

  <!-- Method body (Scala) -->
  <div>
    <div class="flex items-baseline justify-between">
      <label for="method-body" class="text-sm font-medium text-gray-700 dark:text-gray-300">
        Method Body (Scala) <span class="text-red-600">*</span>
      </label>
      <div class="flex items-center gap-3">
        <button
          type="button"
          onclick={generateTemplate}
          disabled={isGeneratingTemplate}
          data-testid="generate-template-btn"
          class="text-xs text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
        >
          {isGeneratingTemplate ? "Generating..." : "Generate template"}
        </button>
        <button
          type="button"
          onclick={() => { fixActive = false; fixOutcome = null; void compileNow(); }}
          disabled={compileStatus === "compiling" || fixActive}
          data-testid="compile-btn"
          class="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {compileStatus === "compiling" ? "Compiling..." : "Compile"}
        </button>
        {#if onFixWithOpey && (compileStatus === "errors" || fixActive)}
          <button
            type="button"
            onclick={startFixLoop}
            disabled={fixActive || compileStatus === "compiling"}
            data-testid="fix-with-opey-btn"
            class="rounded border border-violet-300 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-200"
          >
            {fixActive ? `Opey fixing, round ${fixRound} of ${FIX_MAX_ROUNDS}...` : "Fix with Opey"}
          </button>
        {/if}
      </div>
    </div>
    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
      OBP compiles this Scala the first time the endpoint is hit (result is cached) and runs it inside a security-manager sandbox. Stored URL-encoded server-side — you edit and read plain Scala here.
    </p>
    <textarea
      id="method-body"
      name="method_body"
      bind:value={method_body_text}
      rows="16"
      spellcheck="false"
      data-testid="field-method-body"
      class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
    ></textarea>
    {#if fieldErrors.method_body}
      <p class="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.method_body}</p>
    {/if}

    {#if compileStatus === "ok"}
      <p class="mt-2 rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300" role="status" data-testid="compile-ok">
        Compiles{#if compileDurationMs !== null} ({compileDurationMs} ms){/if}. Nothing was stored.
      </p>
    {:else if compileStatus === "errors"}
      <div class="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100" role="status" data-testid="compile-errors">
        <p class="font-semibold">Does not compile ({compileErrors.length + (compileDependencyError ? 1 : 0)}):</p>
        <ul class="mt-1 ml-4 list-disc space-y-0.5 font-mono">
          {#each compileErrors as err, i (i)}
            <li>{#if err.line > 0}<span class="font-semibold">line {err.line}, col {err.column}:</span> {/if}{err.message}</li>
          {/each}
          {#if compileDependencyError}
            <li><span class="font-semibold">dependency validator:</span> {compileDependencyError}</li>
          {/if}
        </ul>
      </div>
    {:else if compileStatus === "failed" && compileMessage}
      <p class="mt-2 rounded border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-200" role="status" data-testid="compile-failed">
        {compileMessage}
      </p>
    {/if}
    {#if fixOutcome}
      <p class="mt-1 text-xs text-gray-600 dark:text-gray-400" data-testid="fix-outcome">{fixOutcome}</p>
    {/if}

    <p class="mt-2 text-xs text-gray-600 dark:text-gray-400" data-testid="method-body-help">
      <em>Generate template</em> fetches a working skeleton for the current verb and URL. What is in scope
      and what the body must return is in the
      <a class="text-blue-600 underline hover:no-underline dark:text-blue-400" href="/dynamic-resource-docs/help#dynamic-resource-doc">Dynamic Resource Doc</a>
      glossary entry on the Help page.
    </p>
  </div>

  <!-- Example request + success response -->
  <div class="grid gap-4 md:grid-cols-2">
    <div>
      <label for="example-request-body" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Example Request Body (JSON)
        {#if methodHasBody}
          <span class="text-red-600">*</span>
        {/if}
      </label>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {#if methodHasBody}
          OBP generates a <code>RequestRootJsonClass</code> case class from this shape; parse the incoming body in Scala with <code>request.json.extract[RequestRootJsonClass]</code>.
        {:else}
          Leave empty for {request_verb} — OBP rejects a body on this verb.
        {/if}
      </p>
      <textarea
        id="example-request-body"
        name="example_request_body"
        bind:value={example_request_body_text}
        rows="8"
        disabled={!methodHasBody}
        spellcheck="false"
        data-testid="field-example-request-body"
        class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:disabled:bg-gray-800"
      ></textarea>
      {#if fieldErrors.example_request_body}
        <p class="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.example_request_body}</p>
      {/if}
    </div>
    <div>
      <label for="success-response-body" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Success Response Body (JSON) <span class="text-red-600">*</span>
      </label>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        OBP generates a <code>ResponseRootJsonClass</code> from this shape. Construct an instance of it in your Scala and return via <code>Future.successful {"{ (responseBody, HttpCode.`200`(callContext.callContext)) }"}</code>.
      </p>
      <textarea
        id="success-response-body"
        name="success_response_body"
        bind:value={success_response_body_text}
        rows="8"
        spellcheck="false"
        data-testid="field-success-response-body"
        class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      ></textarea>
      {#if fieldErrors.success_response_body}
        <p class="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.success_response_body}</p>
      {/if}
    </div>
  </div>

  <!-- CSV fields -->
  <div class="grid gap-4 md:grid-cols-3">
    <label class="block">
      <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tags</span>
      <input
        type="text"
        name="tags"
        bind:value={tags}
        placeholder="Create-My-User, Admin"
        data-testid="field-tags"
        class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      />
      <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
        Comma-separated. Used to group the endpoint under a category in API Explorer.
      </span>
    </label>

    <label class="block">
      <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Roles</span>
      <input
        type="text"
        name="roles"
        bind:value={roles}
        placeholder="CanCreateMyUser"
        data-testid="field-roles"
        class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      />
      <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
        Comma-separated role names required to call this endpoint. OBP auto-creates roles that don't exist yet; grant them via <a class="text-blue-600 hover:underline dark:text-blue-400" href="/rbac/entitlements" target="_blank" rel="noopener noreferrer">Entitlements</a>.
      </span>
    </label>

    <label class="block">
      <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Error Response Bodies</span>
      <input
        type="text"
        name="error_response_bodies"
        bind:value={error_response_bodies}
        placeholder="OBP-50000: Unknown Error."
        data-testid="field-error-response-bodies"
        class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      />
      <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
        Comma-separated <code>OBP-xxxxx: ...</code> strings documented for this endpoint (shown in API Explorer). This is documentation only — it doesn't control what your Scala actually returns.
      </span>
    </label>
  </div>

  <div class="flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
    {#if cancel}{@render cancel()}{/if}
    <button
      type="submit"
      disabled={isSubmitting}
      data-testid="submit-btn"
      class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
    >
      {isSubmitting ? "Saving..." : submitLabel}
    </button>
  </div>
</form>
