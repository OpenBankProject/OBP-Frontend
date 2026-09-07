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
  import { onMount } from "svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import { EXAMPLE_SCHEMA, type JsonSchemaValidationFormValues, type OperationChoice } from "$lib/services/jsonSchemaValidations";

  interface Props {
    initial?: JsonSchemaValidationFormValues;
    /** Endpoints to choose from; the operation_id is locked when editing. */
    operationChoices: OperationChoice[];
    lockOperationId?: boolean;
    submitLabel: string;
    cancelHref: string;
    onSubmit: (values: JsonSchemaValidationFormValues) => Promise<void>;
  }
  let { initial, operationChoices, lockOperationId = false, submitLabel, cancelHref, onSubmit }: Props = $props();

  let operation_id = $state(initial?.operation_id ?? "");
  let json_schema = $state(initial?.json_schema ?? "");
  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);

  let schemaError = $derived.by(() => {
    const text = json_schema.trim();
    if (!text) return "";
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "The schema must be a JSON object.";
      return "";
    } catch (e) {
      return `Not valid JSON: ${e instanceof Error ? e.message : String(e)}`;
    }
  });

  // ---- operation_id: type to search the resource docs ----
  // Typing keeps operation_id equal to the text (so a free value can be submitted) and shows matches;
  // picking from the list, or Opey setting the field, marks it chosen and hides the list.
  let search = $state(initial?.operation_id ?? "");
  let picked = $state(!!initial?.operation_id);
  const RESULTS_MAX = 25;
  let searchTerms = $derived(search.trim().toLowerCase().split(/\s+/).filter(Boolean));
  let matches = $derived.by(() => {
    if (lockOperationId || picked || searchTerms.length === 0) return [] as OperationChoice[];
    return operationChoices
      .filter((c) => searchTerms.every((t) => `${c.operation_id} ${c.request_verb} ${c.request_url} ${c.summary}`.toLowerCase().includes(t)))
      .slice(0, RESULTS_MAX);
  });
  let chosen = $derived(operationChoices.find((c) => c.operation_id === operation_id));
  function choose(c: OperationChoice) {
    operation_id = c.operation_id;
    search = c.operation_id;
    picked = true;
  }
  function onSearchInput() {
    operation_id = search.trim();
    picked = false;
  }

  function useExample() {
    json_schema = EXAMPLE_SCHEMA;
  }

  function prettify() {
    try {
      json_schema = JSON.stringify(JSON.parse(json_schema), null, 2);
    } catch {
      /* leave as typed; schemaError already explains */
    }
  }

  // ---- Draft support (Opey via formBridge) ----
  type FieldAccess = { get: () => string; set: (v: unknown) => void };
  const asText = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const draftFields: Record<string, FieldAccess> = {
    operation_id: {
      get: () => operation_id,
      set: (v) => {
        if (lockOperationId) throw new Error("operation_id is fixed while editing");
        operation_id = asText(v).trim();
        search = operation_id;
        picked = true;
      },
    },
    json_schema: {
      get: () => json_schema,
      set: (v) => (json_schema = typeof v === "string" ? v : v == null ? "" : JSON.stringify(v, null, 2)),
    },
  };
  let opeyPrevious = $state<Record<string, string>>({});
  let opeyFilledFields = $derived(Object.keys(opeyPrevious));

  function applyDraft(fields: Record<string, unknown>): { applied: string[]; ignored: string[] } {
    const applied: string[] = [];
    const ignored: string[] = [];
    for (const [name, value] of Object.entries(fields ?? {})) {
      const access = draftFields[name];
      if (!access) { ignored.push(name); continue; }
      const before = access.get();
      try { access.set(value); } catch { ignored.push(name); continue; }
      if (!(name in opeyPrevious)) opeyPrevious = { ...opeyPrevious, [name]: before };
      applied.push(name);
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
  function acceptAll() { opeyPrevious = {}; }

  function describeForm(): string {
    const withBody = operationChoices.filter((c) => c.request_verb === "POST" || c.request_verb === "PUT").length;
    const lines = [
      "Form: JSON Schema Validation (attaches a JSON Schema, draft-07, to the request body of one OBP endpoint).",
      "OBP rejects any POST/PUT to that endpoint whose body does not satisfy the schema, before the endpoint runs.",
      "Fields settable via set_form_fields:",
      lockOperationId
        ? "- operation_id (FIXED while editing; do not set it)"
        : "- operation_id (string, required; an OBP operation id such as OBPv6.0.0-createCustomer; the form offers a searchable list)",
      "- json_schema (a JSON Schema object; pass it as an object, not a string, e.g. {\"$schema\": \"http://json-schema.org/draft-07/schema\", \"type\": \"object\", \"required\": [...], \"properties\": {...}})",
      `Known endpoints: ${operationChoices.length} (${withBody} take a request body). Sample of POST/PUT operation ids: ${operationChoices.filter((c) => c.request_verb === "POST" || c.request_verb === "PUT").slice(0, 30).map((c) => c.operation_id).join(", ")}${withBody > 30 ? ", …" : ""}.`,
      chosen ? `Chosen endpoint: ${chosen.request_verb} ${chosen.request_url} — ${chosen.summary}` : "",
      "Current values (empty means unset):",
    ].filter(Boolean);
    for (const [name, access] of Object.entries(draftFields)) {
      const v = access.get();
      lines.push(`  ${name}: ${v === "" ? "(empty)" : v.length > 1500 ? v.slice(0, 1500) + "…" : JSON.stringify(v)}`);
    }
    return lines.join("\n");
  }

  const bridgeTarget = { formName: "json-schema-validation", applyDraft, describe: describeForm };
  onMount(() => {
    formBridge.register(bridgeTarget);
    return () => formBridge.unregister(bridgeTarget);
  });

  async function handleSubmit(event: Event) {
    event.preventDefault();
    submitError = null;
    if (!operation_id.trim()) { submitError = "operation_id is required."; return; }
    if (!json_schema.trim()) { submitError = "The JSON Schema is required."; return; }
    if (schemaError) { submitError = schemaError; return; }
    isSubmitting = true;
    try {
      await onSubmit({ operation_id: operation_id.trim(), json_schema: JSON.stringify(JSON.parse(json_schema)) });
    } catch (e) {
      submitError = e instanceof Error ? e.message : String(e);
    } finally {
      isSubmitting = false;
    }
  }

  const fieldLabels: Record<string, string> = { operation_id: "Operation id", json_schema: "JSON Schema" };
</script>

{#if opeyFilledFields.length > 0}
  <div class="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200" data-testid="opey-filled-banner">
    <span>Opey filled {opeyFilledFields.length} field{opeyFilledFields.length === 1 ? "" : "s"}:</span>
    {#each opeyFilledFields as name (name)}
      <span class="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs dark:bg-gray-800">
        {fieldLabels[name] ?? name}
        <button type="button" class="underline" onclick={() => revertField(name)} data-testid="opey-revert-{name}">revert</button>
      </span>
    {/each}
    <button type="button" class="ml-auto rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700" onclick={acceptAll} data-testid="opey-accept-all">Keep all</button>
  </div>
{/if}

<form onsubmit={handleSubmit} class="space-y-5" data-testid="json-schema-validation-form">
  <div>
    <label for="operation_id" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Operation id <span class="text-red-500">*</span></label>
    <input type="hidden" name="operation_id" value={operation_id} />
    {#if lockOperationId}
      <p class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100" data-testid="field-operation-id-locked">{operation_id}</p>
    {:else}
      <input
        id="operation_id"
        type="search"
        autocomplete="off"
        spellcheck="false"
        placeholder="Type part of the operation id, verb, path or summary, e.g. create customer"
        bind:value={search}
        oninput={onSearchInput}
        class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        data-testid="field-operation-id"
      />
      {#if !picked && searchTerms.length > 0 && matches.length === 0}
        <p class="mt-1 text-xs text-amber-700 dark:text-amber-400" data-testid="operation-id-no-matches">
          {#if operationChoices.length === 0}
            The operation id list could not be loaded from the resource docs, so nothing can be suggested. The value will be sent as typed.
          {:else}
            No operation id matches "{search.trim()}" among {operationChoices.length} known endpoints. Try a word from the path or summary.
          {/if}
        </p>
      {/if}
      {#if matches.length > 0}
        <ul class="mt-2 max-h-64 divide-y divide-gray-100 overflow-auto rounded-lg border border-gray-300 bg-white dark:divide-gray-700 dark:border-gray-600 dark:bg-gray-700" data-testid="operation-id-results">
          {#each matches as c (c.operation_id)}
            <li>
              <button type="button" class="block w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 dark:hover:bg-gray-600" onclick={() => choose(c)}>
                <span class="font-mono">{c.operation_id}</span>
                <span class="ml-2 text-xs text-gray-500 dark:text-gray-300">{c.request_verb} {c.request_url}</span>
                <span class="block text-xs text-gray-500 dark:text-gray-300">{c.summary}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
      {#if chosen}
        <span class="font-mono">{chosen.request_verb} {chosen.request_url}</span> — {chosen.summary}
        {#if chosen.request_verb !== "POST" && chosen.request_verb !== "PUT" && chosen.request_verb !== "PATCH"}
          <span class="text-amber-700 dark:text-amber-400">This endpoint takes no request body, so the schema will never be applied.</span>
        {/if}
      {:else if operation_id}
        <span class="font-mono">{operation_id}</span> is not in the {operationChoices.length} known operation ids; it will be sent as typed.
      {:else}
        {operationChoices.length} operation ids known from the resource docs. Endpoints with a request body are listed first.
      {/if}
    </p>
  </div>

  <div>
    <div class="flex items-baseline justify-between">
      <label for="json_schema" class="text-sm font-medium text-gray-700 dark:text-gray-300">JSON Schema (draft-07) <span class="text-red-500">*</span></label>
      <span class="flex gap-3">
        <button type="button" onclick={useExample} class="text-xs text-blue-600 hover:underline dark:text-blue-400" data-testid="use-example-schema">Insert example</button>
        <button type="button" onclick={prettify} disabled={!!schemaError || !json_schema.trim()} class="text-xs text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400" data-testid="prettify-schema">Format</button>
      </span>
    </div>
    <textarea id="json_schema" name="json_schema" bind:value={json_schema} rows="18" spellcheck="false" class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" data-testid="field-json-schema"></textarea>
    {#if schemaError}
      <p class="mt-1 text-xs text-red-600 dark:text-red-400">{schemaError}</p>
    {:else}
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Sent to OBP as the request body. Takes effect after OBP's validation cache refreshes, which can be a few minutes.</p>
    {/if}
  </div>

  {#if submitError}
    <div class="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200" data-testid="json-schema-validation-error">{submitError}</div>
  {/if}

  <div class="flex flex-wrap gap-3">
    <button type="submit" disabled={isSubmitting} class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" data-testid="json-schema-validation-submit">
      {isSubmitting ? "Saving…" : submitLabel}
    </button>
    <a href={cancelHref} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</a>
  </div>
</form>
