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
  import type { Snippet } from "svelte";
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
  }

  let { initial = {}, submitLabel = "Save", onSubmit, cancel }: Props = $props();

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

  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);
  let fieldErrors = $state<Record<string, string>>({});
  let isGeneratingTemplate = $state(false);

  const VERBS = ["GET", "POST", "PUT", "DELETE"];
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
      <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
        Served at <code>/obp/dynamic-resource-doc{request_url || "/..."}</code>. UPPER_CASE segments are path parameters — read them in Scala via <code>pathParams("MY_USER_ID")</code>.
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
      <button
        type="button"
        onclick={generateTemplate}
        disabled={isGeneratingTemplate}
        data-testid="generate-template-btn"
        class="text-xs text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
      >
        {isGeneratingTemplate ? "Generating..." : "Generate template"}
      </button>
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

    <details class="mt-2 rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
      <summary class="cursor-pointer font-medium">What's in scope, what's allowed</summary>
      <div class="mt-2 space-y-3">
        <div>
          <div class="font-semibold">In-scope values at runtime</div>
          <ul class="mt-1 ml-4 list-disc space-y-0.5">
            <li><code>request: Req</code> — lift <code>Req</code>; has <code>.body</code>, <code>.json</code>, <code>.path</code>, headers etc.</li>
            <li><code>callContext: CallContext</code> — holds user, consumer, <code>resourceDocument</code>, <code>operationId</code>, etc.</li>
            <li><code>pathParams: Map[String, String]</code> — derived from UPPER_CASE segments in the Request URL.</li>
            <li><code>RequestRootJsonClass</code> / <code>ResponseRootJsonClass</code> — case classes auto-generated from the example/success-response JSON below. Use <code>request.json.extract[RequestRootJsonClass]</code> to parse the body.</li>
            <li>An implicit <code>formats = CustomJsonFormats.formats</code> and an implicit <code>scalaFutureToBoxedJsonResponse</code> so a <code>Future[(X, Some(cc))]</code> becomes a <code>Box[JsonResponse]</code>.</li>
          </ul>
        </div>
        <div>
          <div class="font-semibold">Imports already in scope</div>
          <p class="mt-1">A large set of OBP and Scala imports are injected at compile time — including <code>Box/Full/Empty</code>, <code>Future</code>, <code>scala.concurrent.ExecutionContext.Implicits.global</code>, <code>NewStyle.HttpCode</code>, <code>APIUtil.errorJsonResponse</code>, <code>net.liftweb.json._</code>, most OBP error messages/example values, Pekko HTTP + Akka HTTP client helpers, and OBP commons models/DTOs. You rarely need to write <code>import</code> lines yourself.</p>
        </div>
        <div>
          <div class="font-semibold">Restrictions</div>
          <ul class="mt-1 ml-4 list-disc space-y-0.5">
            <li><strong>Runtime sandbox</strong>: OBP runs your code with a Java <code>SecurityManager</code>. Allowed permissions come from the OBP prop <code>dynamic_code_sandbox_permissions</code>. A missing permission surfaces as <code>OBP-40047: DynamicResourceDoc method have no enough permissions. No permission of: ...</code> — ask an OBP admin to extend the prop.</li>
            <li><strong>Compile-time guard</strong> (only when the OBP prop <code>dynamic_code_compile_validate_enable=true</code>): references to OBP/Scala internals are checked against the allowlist in <code>dynamic_code_compile_validate_dependencies</code>. <code>scala.reflect.runtime.*</code>, <code>java.lang.reflect.*</code> and <code>scala.concurrent.ExecutionContext</code> are always restricted.</li>
            <li><strong>No wrapper</strong>: what you write is inlined into a generated <code>OBPEndpoint</code> function — don't wrap it in a method or class. The last expression is the response; typically a <code>Future.successful {"{ (responseBody, HttpCode.`200`(callContext.callContext)) }"}</code>.</li>
          </ul>
        </div>
        <p>Use <em>Generate template</em> above to fetch an OBP-blessed skeleton for the current verb + URL — quickest way to see the shape.</p>
      </div>
    </details>
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
