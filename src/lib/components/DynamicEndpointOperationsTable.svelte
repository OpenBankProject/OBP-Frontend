<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";

  interface Operation {
    path: string;
    method: string;
    operationId: string;
    summary: string;
  }

  interface Validation {
    operation_id: string;
    json_schema: any;
  }

  interface Mapping {
    endpoint_mapping_id: string;
    operation_id: string;
    request_mapping: any;
    response_mapping: any;
  }

  interface Props {
    swagger: any;
    validations?: Validation[];
    mappings?: Mapping[];
    /** Pass a bank_id to target bank-level endpoint-mapping CRUD; omit for system-level. */
    bankId?: string;
  }

  let { swagger, validations = [], mappings = [], bankId }: Props = $props();

  // Only `dynamic_entity` hosts use Endpoint Mapping; hide the column otherwise.
  const showMapping = $derived((swagger?.host || "") === "dynamic_entity");

  // Column count is 7 by default, 8 when the Endpoint Mapping column is visible.
  // Used for colspan on the full-width editor rows.
  const columnCount = $derived(showMapping ? 8 : 7);

  // Endpoint-mapping CRUD base: bank-level when bankId is set, otherwise system.
  const mappingsBase = $derived(
    bankId
      ? `/proxy/obp/v4.0.0/management/banks/${encodeURIComponent(bankId)}/endpoint-mappings`
      : `/proxy/obp/v4.0.0/management/endpoint-mappings`,
  );

  // Dynamic endpoints are served under /obp/dynamic-endpoint/ (no API version, no /banks/ segment
  // even for bank-scoped endpoints — bank scoping is enforced at the record level).
  // An optional `dynamic_endpoints_url_prefix` OBP prop may insert a prefix before the swagger path.
  const DYNAMIC_ENDPOINT_BASE = "/obp/dynamic-endpoint";

  const host: string = swagger?.host || "";
  const basePath: string = swagger?.basePath || "";

  function getOperations(): Operation[] {
    if (!swagger?.paths) return [];
    const ops: Operation[] = [];
    for (const [path, pathObj] of Object.entries(swagger.paths)) {
      for (const [method, methodObj] of Object.entries((pathObj as any) || {})) {
        const m = methodObj as any;
        ops.push({
          path,
          method: method.toUpperCase(),
          operationId: m?.operationId || "",
          summary: m?.summary || m?.description || "",
        });
      }
    }
    return ops;
  }

  const operations = getOperations();

  let validationsByOpId = $derived(
    new Map(validations.map((v) => [v.operation_id, v])),
  );

  let mappingsByOpId = $derived(
    new Map(mappings.map((m) => [m.operation_id, m])),
  );

  function isUrlHost(h: string): boolean {
    return /^https?:\/\//i.test(h);
  }

  function resolveUrl(op: Operation): { kind: "mock" | "entity" | "url" | "unknown"; text: string } {
    if (host === "obp_mock") {
      return { kind: "mock", text: "Mock response (from Swagger example)" };
    }
    if (host === "dynamic_entity") {
      return { kind: "entity", text: "Dynamic Entity (requires Endpoint Mapping)" };
    }
    if (isUrlHost(host)) {
      const base = host.endsWith("/") ? host.slice(0, -1) : host;
      const bp = !basePath || basePath === "/" ? "" : basePath;
      return { kind: "url", text: `${base}${bp}${op.path}` };
    }
    return { kind: "unknown", text: host ? `${host}${basePath}${op.path}` : "Host not configured" };
  }

  function methodBadge(method: string): string {
    const map: Record<string, string> = {
      GET: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      POST: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      PUT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      PATCH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return map[method] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }

  function seedSchema(op: Operation): string {
    const existing = validationsByOpId.get(op.operationId);
    if (existing) {
      return JSON.stringify(existing.json_schema, null, 2);
    }
    // Seed from swagger response/body schema if available
    const swaggerOp = swagger?.paths?.[op.path]?.[op.method.toLowerCase()];
    const bodyParam = (swaggerOp?.parameters || []).find((p: any) => p.in === "body");
    const bodySchema = bodyParam?.schema || swaggerOp?.requestBody?.content?.["application/json"]?.schema;
    if (bodySchema) {
      return JSON.stringify(
        {
          $schema: "http://json-schema.org/draft-07/schema",
          title: op.summary || op.operationId || "Request body schema",
          ...bodySchema,
        },
        null,
        2,
      );
    }
    return JSON.stringify(
      {
        $schema: "http://json-schema.org/draft-07/schema",
        title: op.summary || op.operationId || "Request body schema",
        type: "object",
        properties: {},
        required: [],
      },
      null,
      2,
    );
  }

  // Editor state — one panel open at a time.
  type EditorMode =
    | { kind: "none" }
    | { kind: "schema"; opKey: string }
    | { kind: "mapping"; opKey: string }
    | { kind: "try"; opKey: string };
  let editor = $state<EditorMode>({ kind: "none" });
  let editorJson = $state("");
  let editorError = $state("");
  let editorSaving = $state(false);

  // Endpoint-mapping editor state (two JSON docs: request and response mapping).
  let requestMappingJson = $state("");
  let responseMappingJson = $state("");

  // Try-it state
  let tryUrl = $state("");
  let tryBody = $state("");
  let tryResponseStatus = $state<number | null>(null);
  let tryResponseText = $state<string>("");
  let tryError = $state("");
  let trySending = $state(false);

  function opKey(op: Operation): string {
    return `${op.method}-${op.path}`;
  }

  function openSchemaEditor(op: Operation) {
    editor = { kind: "schema", opKey: opKey(op) };
    editorJson = seedSchema(op);
    editorError = "";
  }

  function defaultTryUrl(op: Operation): string {
    return `${DYNAMIC_ENDPOINT_BASE}${op.path}`;
  }

  function openTryPanel(op: Operation) {
    editor = { kind: "try", opKey: opKey(op) };
    tryUrl = defaultTryUrl(op);
    tryBody = needsBody(op.method) ? "{\n  \n}" : "";
    tryResponseStatus = null;
    tryResponseText = "";
    tryError = "";
  }

  function closeEditor() {
    editor = { kind: "none" };
    editorJson = "";
    editorError = "";
    requestMappingJson = "";
    responseMappingJson = "";
    tryUrl = "";
    tryBody = "";
    tryResponseStatus = null;
    tryResponseText = "";
    tryError = "";
  }

  function resolveRef(schema: any): any {
    if (schema?.$ref && typeof schema.$ref === "string") {
      const refName = schema.$ref
        .replace(/^#\/definitions\//, "")
        .replace(/^#\/components\/schemas\//, "");
      return swagger?.definitions?.[refName] || swagger?.components?.schemas?.[refName];
    }
    return schema;
  }

  function mappingFromSchema(schema: any): string {
    // Turn a schema's `properties` into a starter mapping object. Placeholder
    // values (<EntityName>, <queryKey>) flag what the operator still needs to fill in.
    const resolved = resolveRef(schema);
    const properties = resolved?.properties;
    if (!properties || typeof properties !== "object") {
      return "{}";
    }
    const obj: Record<string, any> = {};
    for (const fieldName of Object.keys(properties)) {
      obj[fieldName] = {
        entity: "<EntityName>",
        field: fieldName,
        query: "<queryKey>",
      };
    }
    return JSON.stringify(obj, null, 2);
  }

  function seedRequestMapping(op: Operation): string {
    // Swagger 2.0: body parameter with `in: body` + schema. OpenAPI 3.x: requestBody.
    const swaggerOp = swagger?.paths?.[op.path]?.[op.method.toLowerCase()];
    const bodyParam = (swaggerOp?.parameters || []).find((p: any) => p.in === "body");
    const bodySchema =
      bodyParam?.schema || swaggerOp?.requestBody?.content?.["application/json"]?.schema;
    return mappingFromSchema(bodySchema);
  }

  function seedResponseMapping(op: Operation): string {
    // Pick a 2xx response schema (200 / 201 preferred, else first 2xx).
    const swaggerOp = swagger?.paths?.[op.path]?.[op.method.toLowerCase()];
    const responses = swaggerOp?.responses || {};
    const successCode =
      ["200", "201"].find((c) => responses[c]) ||
      Object.keys(responses).find((c) => /^2\d\d$/.test(c));
    const schema = successCode ? responses[successCode]?.schema : undefined;
    return mappingFromSchema(schema);
  }

  function openMappingEditor(op: Operation) {
    editor = { kind: "mapping", opKey: opKey(op) };
    editorError = "";
    const existing = mappingsByOpId.get(op.operationId);
    requestMappingJson = existing
      ? JSON.stringify(existing.request_mapping, null, 2)
      : seedRequestMapping(op);
    responseMappingJson = existing
      ? JSON.stringify(existing.response_mapping, null, 2)
      : seedResponseMapping(op);
  }

  async function saveMapping(op: Operation) {
    if (!op.operationId) {
      editorError = "This operation has no operationId in its Swagger spec. Add one to the Swagger doc first.";
      return;
    }

    let requestParsed: any;
    let responseParsed: any;
    try {
      requestParsed = JSON.parse(requestMappingJson || "{}");
    } catch (e) {
      editorError = `Request mapping is not valid JSON: ${e instanceof Error ? e.message : "parse error"}`;
      return;
    }
    try {
      responseParsed = JSON.parse(responseMappingJson || "{}");
    } catch (e) {
      editorError = `Response mapping is not valid JSON: ${e instanceof Error ? e.message : "parse error"}`;
      return;
    }

    editorSaving = true;
    editorError = "";

    const existing = mappingsByOpId.get(op.operationId);
    const url = existing
      ? `${mappingsBase}/${encodeURIComponent(existing.endpoint_mapping_id)}`
      : mappingsBase;
    const method = existing ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          operation_id: op.operationId,
          request_mapping: requestParsed,
          response_mapping: responseParsed,
        }),
      });

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          `Failed to ${existing ? "update" : "create"} endpoint mapping`,
        );
        logErrorDetails(`${method} Endpoint Mapping`, errorDetails);
        editorError = formatErrorForDisplay(errorDetails);
        return;
      }

      closeEditor();
      await invalidateAll();
    } catch (e) {
      editorError = e instanceof Error ? e.message : "Failed to save endpoint mapping";
    } finally {
      editorSaving = false;
    }
  }

  async function deleteMapping(op: Operation) {
    const existing = mappingsByOpId.get(op.operationId);
    if (!existing) return;

    try {
      const response = await fetch(
        `${mappingsBase}/${encodeURIComponent(existing.endpoint_mapping_id)}`,
        { method: "DELETE", credentials: "include" },
      );

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to delete endpoint mapping",
        );
        logErrorDetails("DELETE Endpoint Mapping", errorDetails);
        alert(`Error: ${formatErrorForDisplay(errorDetails)}`);
        return;
      }

      await invalidateAll();
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : "Failed to delete endpoint mapping"}`);
    }
  }

  function needsBody(method: string): boolean {
    return ["POST", "PUT", "PATCH"].includes(method.toUpperCase());
  }

  async function sendTry(op: Operation) {
    tryError = "";
    tryResponseStatus = null;
    tryResponseText = "";

    const url = tryUrl.trim();
    if (!url.startsWith("/obp/")) {
      tryError = "URL must start with /obp/... so the /proxy passthrough can forward it to the OBP API.";
      return;
    }

    let bodyToSend: string | undefined = undefined;
    if (needsBody(op.method)) {
      const raw = tryBody.trim();
      if (raw) {
        try {
          // Re-serialize so it's compact and we've validated it parses.
          bodyToSend = JSON.stringify(JSON.parse(raw));
        } catch (e) {
          tryError = `Request body is not valid JSON: ${e instanceof Error ? e.message : "parse error"}`;
          return;
        }
      }
    }

    trySending = true;
    try {
      const proxied = `/proxy${url}`;
      const response = await fetch(proxied, {
        method: op.method,
        headers: bodyToSend ? { "Content-Type": "application/json" } : undefined,
        credentials: "include",
        body: bodyToSend,
      });
      tryResponseStatus = response.status;
      const text = await response.text();
      try {
        tryResponseText = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        tryResponseText = text;
      }
    } catch (e) {
      tryError = e instanceof Error ? e.message : "Request failed";
    } finally {
      trySending = false;
    }
  }

  async function saveSchema(op: Operation) {
    if (!op.operationId) {
      editorError = "This operation has no operationId in its Swagger spec. Add one to the Swagger doc first.";
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(editorJson);
    } catch (e) {
      editorError = e instanceof Error ? e.message : "Invalid JSON";
      return;
    }

    editorSaving = true;
    editorError = "";

    const exists = validationsByOpId.has(op.operationId);
    const method = exists ? "PUT" : "POST";

    try {
      const response = await fetch(
        `/proxy/obp/v4.0.0/management/json-schema-validations/${encodeURIComponent(op.operationId)}`,
        {
          method,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(parsed),
        },
      );

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          `Failed to ${exists ? "update" : "create"} JSON schema validation`,
        );
        logErrorDetails(`${method} JSON Schema Validation`, errorDetails);
        editorError = formatErrorForDisplay(errorDetails);
        return;
      }

      closeEditor();
      await invalidateAll();
    } catch (e) {
      editorError = e instanceof Error ? e.message : "Failed to save validation";
    } finally {
      editorSaving = false;
    }
  }

  async function deleteValidation(op: Operation) {
    if (!op.operationId) return;
    if (!confirm(`Delete the JSON schema validation for ${op.operationId}?`)) return;

    try {
      const response = await fetch(
        `/proxy/obp/v4.0.0/management/json-schema-validations/${encodeURIComponent(op.operationId)}`,
        { method: "DELETE", credentials: "include" },
      );

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to delete JSON schema validation",
        );
        logErrorDetails("DELETE JSON Schema Validation", errorDetails);
        alert(`Error: ${formatErrorForDisplay(errorDetails)}`);
        return;
      }

      await invalidateAll();
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : "Failed to delete validation"}`);
    }
  }
</script>

<div
  data-testid="dynamic-endpoint-operations"
  class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
>
  <div class="border-b border-gray-200 p-6 dark:border-gray-700">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Operations</h2>
    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
      {operations.length} operation{operations.length === 1 ? "" : "s"} defined across
      {Object.keys(swagger?.paths || {}).length} path{Object.keys(swagger?.paths || {}).length === 1 ? "" : "s"}.
      {#if host}
        Host: <code class="rounded bg-gray-100 px-1 dark:bg-gray-900">{host}</code>
        {#if basePath && basePath !== "/"}
          • base path: <code class="rounded bg-gray-100 px-1 dark:bg-gray-900">{basePath}</code>
        {/if}
      {/if}
    </p>
  </div>

  {#if operations.length === 0}
    <div class="p-8 text-center text-sm text-gray-600 dark:text-gray-400">
      No operations defined in this endpoint's Swagger specification.
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Method</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Path</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Summary</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Operation ID</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Resolves to</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">JSON Schema</th>
            {#if showMapping}
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Endpoint Mapping</th>
            {/if}
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Try it</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
          {#each operations as op (opKey(op))}
            {@const resolved = resolveUrl(op)}
            {@const validation = op.operationId ? validationsByOpId.get(op.operationId) : undefined}
            {@const mapping = op.operationId ? mappingsByOpId.get(op.operationId) : undefined}
            {@const isSchemaOpen = editor.kind === "schema" && editor.opKey === opKey(op)}
            {@const isMappingOpen = editor.kind === "mapping" && editor.opKey === opKey(op)}
            {@const isTryOpen = editor.kind === "try" && editor.opKey === opKey(op)}
            <tr data-testid="operation-row" data-method={op.method} data-path={op.path}>
              <td class="whitespace-nowrap px-4 py-3 align-top">
                <span class="inline-flex w-16 items-center justify-center rounded px-2 py-0.5 text-xs font-medium {methodBadge(op.method)}">
                  {op.method}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 align-top font-mono text-sm text-gray-900 dark:text-gray-100">
                {op.path}
              </td>
              <td class="px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-300">
                {op.summary || "—"}
              </td>
              <td class="whitespace-nowrap px-4 py-3 align-top font-mono text-xs text-gray-600 dark:text-gray-400">
                {op.operationId || "—"}
              </td>
              <td class="px-4 py-3 align-top text-xs">
                {#if resolved.kind === "url"}
                  <a
                    href={resolved.text}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="break-all font-mono text-blue-600 hover:underline dark:text-blue-400"
                    data-testid="resolved-url"
                  >{resolved.text}</a>
                {:else if resolved.kind === "mock"}
                  <span class="italic text-gray-500 dark:text-gray-400" data-testid="resolved-mock">{resolved.text}</span>
                {:else if resolved.kind === "entity"}
                  <span class="italic text-amber-700 dark:text-amber-400" data-testid="resolved-entity">{resolved.text}</span>
                {:else}
                  <span class="break-all font-mono text-gray-500 dark:text-gray-400" data-testid="resolved-unknown">{resolved.text}</span>
                {/if}
              </td>
              <td class="whitespace-nowrap px-4 py-3 align-top text-xs">
                {#if validation}
                  <span
                    class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
                    data-testid="validation-status-configured"
                  >Configured</span>
                  <div class="mt-1 flex gap-2">
                    <button
                      type="button"
                      class="text-blue-600 hover:underline dark:text-blue-400"
                      data-testid="validation-edit-btn"
                      onclick={() => openSchemaEditor(op)}
                    >Edit</button>
                    <button
                      type="button"
                      class="text-red-600 hover:underline dark:text-red-400"
                      data-testid="validation-delete-btn"
                      onclick={() => deleteValidation(op)}
                    >Delete</button>
                  </div>
                {:else}
                  <span class="text-gray-400 dark:text-gray-500" data-testid="validation-status-none">None</span>
                  {#if op.operationId}
                    <div class="mt-1">
                      <button
                        type="button"
                        class="text-blue-600 hover:underline dark:text-blue-400"
                        data-testid="validation-add-btn"
                        onclick={() => openSchemaEditor(op)}
                      >Add validation</button>
                    </div>
                  {/if}
                {/if}
              </td>
              {#if showMapping}
                <td class="whitespace-nowrap px-4 py-3 align-top text-xs">
                  {#if mapping}
                    <span
                      class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
                      data-testid="mapping-status-configured"
                    >Configured</span>
                    <div class="mt-1 flex gap-2">
                      <button
                        type="button"
                        class="text-blue-600 hover:underline dark:text-blue-400"
                        data-testid="mapping-edit-btn"
                        onclick={() => openMappingEditor(op)}
                      >Edit</button>
                      <button
                        type="button"
                        class="text-red-600 hover:underline dark:text-red-400"
                        data-testid="mapping-delete-btn"
                        onclick={() => deleteMapping(op)}
                      >Delete</button>
                    </div>
                  {:else}
                    <span class="text-gray-400 dark:text-gray-500" data-testid="mapping-status-none">None</span>
                    {#if op.operationId}
                      <div class="mt-1">
                        <button
                          type="button"
                          class="text-blue-600 hover:underline dark:text-blue-400"
                          data-testid="mapping-add-btn"
                          onclick={() => openMappingEditor(op)}
                        >Add mapping</button>
                      </div>
                    {/if}
                  {/if}
                </td>
              {/if}
              <td class="whitespace-nowrap px-4 py-3 align-top text-xs">
                <button
                  type="button"
                  class="inline-flex items-center rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                  data-testid="try-it-btn"
                  onclick={() => openTryPanel(op)}
                >Try it</button>
              </td>
            </tr>
            {#if isSchemaOpen}
              <tr data-testid="validation-editor-row">
                <td colspan={columnCount} class="px-4 py-4 bg-gray-50 dark:bg-gray-900/40">
                  <div class="space-y-3">
                    <div class="flex items-baseline justify-between">
                      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {validation ? "Edit" : "Add"} JSON Schema Validation
                      </h3>
                      <span class="font-mono text-xs text-gray-600 dark:text-gray-400">
                        operation_id: {op.operationId}
                      </span>
                    </div>
                    <p class="text-xs text-gray-600 dark:text-gray-400">
                      The schema below will constrain the request body for this operation.
                      See <a class="text-blue-600 hover:underline dark:text-blue-400" href="https://json-schema.org/" target="_blank" rel="noopener noreferrer">json-schema.org</a> for reference.
                    </p>
                    <textarea
                      bind:value={editorJson}
                      rows="14"
                      data-testid="validation-editor-textarea"
                      class="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    ></textarea>
                    {#if editorError}
                      <div class="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300" data-testid="validation-editor-error">
                        {editorError}
                      </div>
                    {/if}
                    <div class="flex gap-2">
                      <button
                        type="button"
                        disabled={editorSaving}
                        data-testid="validation-save-btn"
                        onclick={() => saveSchema(op)}
                        class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                      >
                        {editorSaving ? "Saving..." : validation ? "Save changes" : "Create validation"}
                      </button>
                      <button
                        type="button"
                        disabled={editorSaving}
                        data-testid="validation-cancel-btn"
                        onclick={closeEditor}
                        class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            {/if}
            {#if isMappingOpen}
              <tr data-testid="mapping-editor-row">
                <td colspan={columnCount} class="px-4 py-4 bg-gray-50 dark:bg-gray-900/40">
                  <div class="space-y-3">
                    <div class="flex items-baseline justify-between">
                      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {mapping ? "Edit" : "Add"} Endpoint Mapping
                      </h3>
                      <span class="font-mono text-xs text-gray-600 dark:text-gray-400">
                        operation_id: {op.operationId}
                      </span>
                    </div>
                    <div class="rounded border border-gray-200 bg-white p-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                      <p>
                        Each entry is keyed by a JSON field name in the Dynamic Endpoint payload and maps to a Dynamic Entity field via <code>{"{ entity, field, query }"}</code>:
                      </p>
                      <ul class="mt-1 ml-4 list-disc space-y-0.5">
                        <li><code>entity</code> — the Dynamic Entity name. Only one entity per mapping is supported (OBP uses the first).</li>
                        <li><code>field</code> — the entity field whose value populates this JSON key in the output (and the filter field when URL query strings like <code>?status=available</code> are used).</li>
                        <li><code>query</code> — the entity field used as the lookup key when the URL has a path parameter containing "id" (e.g. <code>{"/pet/{petId}"}</code>). Only the first <code>query</code> value in the mapping is used, so by convention repeat the same value across entries.</li>
                      </ul>
                      <p class="mt-1">
                        See the <a class="text-blue-600 hover:underline dark:text-blue-400" href="/dynamic-entities/system" target="_blank" rel="noopener noreferrer">Dynamic Entities</a> page for available entities and their fields, or the <a class="text-blue-600 hover:underline dark:text-blue-400" href="/glossary#Endpoint-Mapping" target="_blank" rel="noopener noreferrer">Endpoint Mapping glossary entry</a> for the full spec.
                      </p>
                    </div>
                    <label class="block">
                      <span class="block text-xs font-medium text-gray-700 dark:text-gray-300">request_mapping (JSON)</span>
                      <textarea
                        bind:value={requestMappingJson}
                        rows="8"
                        name="request_mapping"
                        data-testid="mapping-request-textarea"
                        class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      ></textarea>
                    </label>
                    <label class="block">
                      <span class="block text-xs font-medium text-gray-700 dark:text-gray-300">response_mapping (JSON)</span>
                      <textarea
                        bind:value={responseMappingJson}
                        rows="10"
                        name="response_mapping"
                        data-testid="mapping-response-textarea"
                        class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      ></textarea>
                    </label>
                    {#if editorError}
                      <div class="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300" data-testid="mapping-editor-error">
                        {editorError}
                      </div>
                    {/if}
                    <div class="flex gap-2">
                      <button
                        type="button"
                        disabled={editorSaving}
                        data-testid="mapping-save-btn"
                        onclick={() => saveMapping(op)}
                        class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                      >
                        {editorSaving ? "Saving..." : mapping ? "Save changes" : "Create mapping"}
                      </button>
                      <button
                        type="button"
                        disabled={editorSaving}
                        data-testid="mapping-cancel-btn"
                        onclick={closeEditor}
                        class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            {/if}
            {#if isTryOpen}
              <tr data-testid="try-it-row">
                <td colspan={columnCount} class="px-4 py-4 bg-gray-50 dark:bg-gray-900/40">
                  <div class="space-y-3">
                    <div class="flex items-baseline justify-between">
                      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Send test request
                      </h3>
                      <span class="text-xs text-gray-600 dark:text-gray-400">
                        Sent via <code class="rounded bg-gray-100 px-1 dark:bg-gray-900">/proxy</code> with your session credentials.
                      </span>
                    </div>

                    <div class="flex items-center gap-2">
                      <span class="inline-flex w-16 items-center justify-center rounded px-2 py-0.5 text-xs font-medium {methodBadge(op.method)}">
                        {op.method}
                      </span>
                      <input
                        type="text"
                        bind:value={tryUrl}
                        data-testid="try-it-url"
                        spellcheck="false"
                        class="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>
                    <p class="text-[11px] text-gray-500 dark:text-gray-400">
                      Edit any <code>{"{path_params}"}</code> placeholders in the URL before sending. Dynamic endpoints are served under
                      <code>/obp/dynamic-endpoint</code> — if your OBP instance configures a
                      <code>dynamic_endpoints_url_prefix</code> prop, insert it between the base and the swagger path.
                    </p>

                    {#if needsBody(op.method)}
                      <div>
                        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Request body (JSON)</label>
                        <textarea
                          bind:value={tryBody}
                          rows="8"
                          data-testid="try-it-body"
                          class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        ></textarea>
                      </div>
                    {/if}

                    {#if tryError}
                      <div class="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300" data-testid="try-it-error">
                        {tryError}
                      </div>
                    {/if}

                    <div class="flex gap-2">
                      <button
                        type="button"
                        disabled={trySending}
                        data-testid="try-it-send-btn"
                        onclick={() => sendTry(op)}
                        class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                      >
                        {trySending ? "Sending..." : "Send request"}
                      </button>
                      <button
                        type="button"
                        disabled={trySending}
                        data-testid="try-it-cancel-btn"
                        onclick={closeEditor}
                        class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      >
                        Close
                      </button>
                    </div>

                    {#if tryResponseStatus !== null}
                      <div class="rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                        <div class="mb-2 flex items-center gap-2 text-xs">
                          <span class="font-medium text-gray-600 dark:text-gray-400">Status:</span>
                          <span
                            class="rounded px-2 py-0.5 font-mono text-xs font-semibold"
                            class:bg-green-100={tryResponseStatus >= 200 && tryResponseStatus < 300}
                            class:text-green-800={tryResponseStatus >= 200 && tryResponseStatus < 300}
                            class:bg-yellow-100={tryResponseStatus >= 300 && tryResponseStatus < 400}
                            class:text-yellow-800={tryResponseStatus >= 300 && tryResponseStatus < 400}
                            class:bg-red-100={tryResponseStatus >= 400}
                            class:text-red-800={tryResponseStatus >= 400}
                            data-testid="try-it-response-status"
                          >
                            {tryResponseStatus}
                          </span>
                        </div>
                        <pre
                          class="max-h-96 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-900 dark:bg-gray-900 dark:text-gray-100"
                          data-testid="try-it-response-body"
                        >{tryResponseText || "(empty response body)"}</pre>
                      </div>
                    {/if}
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
