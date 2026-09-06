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
  import { emptyMethodRouting, type MethodRoutingFormValues } from "$lib/services/methodRoutings";

  interface Props {
    initial?: MethodRoutingFormValues;
    methodNames: string[];
    connectorNames: string[];
    bankIds: string[];
    listsLoading?: boolean;
    submitLabel: string;
    cancelHref: string;
    onSubmit: (values: MethodRoutingFormValues) => Promise<void>;
  }
  let { initial, methodNames, connectorNames, bankIds, listsLoading = false, submitLabel, cancelHref, onSubmit }: Props = $props();

  const start = initial ?? emptyMethodRouting();
  let method_name = $state(start.method_name);
  let connector_name = $state(start.connector_name);
  let bank_id_pattern = $state(start.bank_id_pattern);
  let is_bank_id_exact_match = $state(start.is_bank_id_exact_match);
  let parameters = $state(start.parameters);

  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);
  let parametersError = $derived.by(() => {
    const text = parameters.trim();
    if (!text) return "";
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "Parameters must be a JSON object of string values.";
      return "";
    } catch {
      return "Parameters is not valid JSON.";
    }
  });

  // ---- Method name: type to search (there are hundreds of connector methods) ----
  let methodSearch = $state(start.method_name);
  const METHOD_RESULTS_MAX = 25;
  let methodMatches = $derived.by(() => {
    const terms = methodSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0 || method_name === methodSearch.trim()) return [] as string[];
    return methodNames.filter((m) => terms.every((t) => m.toLowerCase().includes(t))).slice(0, METHOD_RESULTS_MAX);
  });
  function chooseMethod(name: string) {
    method_name = name;
    methodSearch = name;
  }
  function onMethodSearchInput() {
    const text = methodSearch.trim();
    // A known name selects it; any other text is kept as a free value (older OBP builds list nothing).
    method_name = text;
  }

  // ---- Draft support (Opey via formBridge) --------------------------------
  type FieldAccess = { get: () => string; set: (v: unknown) => void };
  const asText = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const draftFields: Record<string, FieldAccess> = {
    method_name: { get: () => method_name, set: (v) => { method_name = asText(v).trim(); methodSearch = method_name; } },
    connector_name: { get: () => connector_name, set: (v) => (connector_name = asText(v).trim()) },
    bank_id_pattern: { get: () => bank_id_pattern, set: (v) => (bank_id_pattern = asText(v).trim()) },
    is_bank_id_exact_match: {
      get: () => String(is_bank_id_exact_match),
      set: (v) => (is_bank_id_exact_match = v === true || String(v).trim().toLowerCase() === "true"),
    },
    parameters: {
      get: () => parameters,
      set: (v) => (parameters = typeof v === "string" ? v : v == null ? "" : JSON.stringify(v, null, 2)),
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
    const lines = [
      "Form: Method Routing (tells OBP-API which connector serves one connector method, optionally for a bank pattern).",
      "A method routing says: when OBP needs to call connector method METHOD_NAME (e.g. getBank, getTransactions), for banks matching BANK_ID_PATTERN, use connector CONNECTOR_NAME with these parameters.",
      "Routings with a specific bank pattern take precedence over '.*'; 'mapped' is the built-in database connector; other connectors (rest_vMar2019, akka_vDec2018, rabbitmq_vOct2024, stored_procedure_vDec2019 …) reach adapters.",
      "Fields settable via set_form_fields:",
      "- method_name (string, required, must be one of the connector method names; the list is searchable in the form)",
      `- connector_name (string, required, one of: ${connectorNames.length ? connectorNames.join(", ") : "(list not loaded; ask the user)"})`,
      "- bank_id_pattern (string, regex; '.*' for all banks; a bank id for one bank)",
      "- is_bank_id_exact_match (true/false; true = bank_id_pattern is compared literally, false = as a regex)",
      "- parameters (JSON object of string values, e.g. {\"url\": \"https://adapter.example/obp\"}; empty if none)",
      `Known bank ids (first ${Math.min(bankIds.length, 40)} of ${bankIds.length}): ${bankIds.slice(0, 40).join(", ") || "(none loaded)"}`,
      `Connector method names: ${methodNames.length} known. Sample: ${methodNames.slice(0, 40).join(", ")}${methodNames.length > 40 ? ", …" : ""}. If the user names a method, use the exact name from this list (e.g. getBank, getBankAccountsForUser, getTransactions, makePaymentv210).`,
      "Current values (empty means unset):",
    ];
    for (const [name, access] of Object.entries(draftFields)) {
      const v = access.get();
      lines.push(`  ${name}: ${v === "" ? "(empty)" : JSON.stringify(v)}`);
    }
    return lines.join("\n");
  }

  const bridgeTarget = { formName: "method-routing", applyDraft, describe: describeForm };
  onMount(() => {
    formBridge.register(bridgeTarget);
    return () => formBridge.unregister(bridgeTarget);
  });

  async function handleSubmit(event: Event) {
    event.preventDefault();
    submitError = null;
    if (!method_name.trim()) { submitError = "Method name is required."; return; }
    if (!connector_name.trim()) { submitError = "Connector name is required."; return; }
    if (parametersError) { submitError = parametersError; return; }
    isSubmitting = true;
    try {
      await onSubmit({
        ...(start.method_routing_id ? { method_routing_id: start.method_routing_id } : {}),
        method_name: method_name.trim(),
        connector_name: connector_name.trim(),
        bank_id_pattern: bank_id_pattern.trim(),
        is_bank_id_exact_match,
        parameters: parameters.trim(),
      });
    } catch (e) {
      submitError = e instanceof Error ? e.message : String(e);
    } finally {
      isSubmitting = false;
    }
  }

  const fieldLabels: Record<string, string> = {
    method_name: "Method name",
    connector_name: "Connector",
    bank_id_pattern: "Bank ID pattern",
    is_bank_id_exact_match: "Exact match",
    parameters: "Parameters",
  };
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

<form onsubmit={handleSubmit} class="space-y-5" data-testid="method-routing-form">
  <div class="grid gap-5 md:grid-cols-2">
    <div class="md:col-span-2">
      <label for="method_name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Method name <span class="text-red-500">*</span></label>
      <input type="hidden" name="method_name" value={method_name} />
      <input
        id="method_name"
        type="search"
        autocomplete="off"
        spellcheck="false"
        placeholder={listsLoading ? "Loading connector method names…" : "Type part of the name, e.g. get bank, or transactions"}
        bind:value={methodSearch}
        oninput={onMethodSearchInput}
        class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        data-testid="field-method-name"
      />
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {#if method_name && methodNames.includes(method_name)}
          <code>{method_name}</code> is a known connector method.
        {:else if method_name}
          <code>{method_name}</code> is not in the list of {methodNames.length} known methods; it will be sent as typed.
        {:else}
          {methodNames.length} connector methods known. Words separated by spaces must all appear in the name.
        {/if}
      </p>
      {#if methodMatches.length > 0}
        <ul class="mt-2 max-h-56 divide-y divide-gray-100 overflow-auto rounded-lg border border-gray-300 bg-white dark:divide-gray-700 dark:border-gray-600 dark:bg-gray-700" data-testid="method-name-results">
          {#each methodMatches as name (name)}
            <li><button type="button" class="block w-full px-3 py-1.5 text-left font-mono text-sm hover:bg-blue-50 dark:hover:bg-gray-600" onclick={() => chooseMethod(name)}>{name}</button></li>
          {/each}
        </ul>
      {/if}
    </div>

    <div>
      <label for="connector_name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Connector <span class="text-red-500">*</span></label>
      {#if connectorNames.length > 0}
        <select id="connector_name" name="connector_name" bind:value={connector_name} required class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" data-testid="field-connector-name">
          <option value="">Select a connector</option>
          {#each connectorNames as c (c)}<option value={c}>{c}</option>{/each}
          {#if connector_name && !connectorNames.includes(connector_name)}<option value={connector_name}>{connector_name}</option>{/if}
        </select>
      {:else}
        <input id="connector_name" name="connector_name" type="text" bind:value={connector_name} required placeholder="e.g. rest_vMar2019" class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" data-testid="field-connector-name" />
      {/if}
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400"><code>mapped</code> is OBP's own database; the others call an adapter.</p>
    </div>

    <div>
      <label for="bank_id_pattern" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank ID pattern</label>
      <input id="bank_id_pattern" name="bank_id_pattern" type="text" bind:value={bank_id_pattern} list="bank-ids-list" placeholder="e.g. gh.29.uk, or .* for all banks" class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" data-testid="field-bank-id-pattern" />
      <datalist id="bank-ids-list">{#each bankIds as id (id)}<option value={id}></option>{/each}</datalist>
      <label class="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" name="is_bank_id_exact_match" bind:checked={is_bank_id_exact_match} class="h-4 w-4 rounded border-gray-300" data-testid="field-exact-match" />
        Exact match (compare the pattern literally, not as a regular expression)
      </label>
    </div>

    <div class="md:col-span-2">
      <label for="parameters" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Parameters (JSON object)</label>
      <textarea id="parameters" name="parameters" bind:value={parameters} rows="5" placeholder={'{"url": "https://adapter.example/obp"}'} spellcheck="false" class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" data-testid="field-parameters"></textarea>
      {#if parametersError}<p class="mt-1 text-xs text-red-600 dark:text-red-400">{parametersError}</p>{:else}<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Optional key-value settings the connector reads, stored as a list of key/value pairs.</p>{/if}
    </div>
  </div>

  {#if submitError}
    <div class="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200" data-testid="method-routing-error">{submitError}</div>
  {/if}

  <div class="flex flex-wrap gap-3">
    <button type="submit" disabled={isSubmitting} class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" data-testid="method-routing-submit">
      {isSubmitting ? "Saving…" : submitLabel}
    </button>
    <a href={cancelHref} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</a>
  </div>
</form>
