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
  import { basePathProblem, versionProblem, majorOf, type DomainApiFormValues } from "$lib/services/domainApis";

  interface Props {
    initial?: DomainApiFormValues;
    /** The space the Domain API publishes: a bank id or SYS. Chosen outside the form. */
    bankId: string;
    /** Dynamic Entity names in the space, for Opey's context. */
    entityNames?: string[];
    submitLabel: string;
    cancelHref: string;
    onSubmit: (values: DomainApiFormValues) => Promise<void>;
  }
  let { initial, bankId, entityNames = [], submitLabel, cancelHref, onSubmit }: Props = $props();

  let base_path = $state(initial?.base_path ?? "");
  let version = $state(initial?.version ?? "");
  let title = $state(initial?.title ?? "");
  let description = $state(initial?.description ?? "");
  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);

  let basePathError = $derived(base_path.trim() ? basePathProblem(base_path.trim()) : "");
  let versionError = $derived(version.trim() ? versionProblem(version.trim(), base_path.trim()) : "");

  // A new base path ending vN suggests N.0.0 while the version is still empty.
  function onBasePathInput() {
    const major = majorOf(base_path.trim());
    if (!version.trim() && major !== null) version = `${major}.0.0`;
  }

  // ---- Draft support (Opey via formBridge) ----
  type FieldAccess = { get: () => string; set: (v: unknown) => void };
  const asText = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const draftFields: Record<string, FieldAccess> = {
    base_path: { get: () => base_path, set: (v) => (base_path = asText(v).trim().replace(/^\/+|\/+$/g, "")) },
    version: { get: () => version, set: (v) => (version = asText(v).trim()) },
    title: { get: () => title, set: (v) => (title = asText(v)) },
    description: { get: () => description, set: (v) => (description = asText(v)) },
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
    const { [name]: _dropped, ...rest } = opeyPrevious;
    opeyPrevious = rest;
  }
  function acceptAll() { opeyPrevious = {}; }

  function describeForm(): string {
    const lines = [
      `Form: Domain API (publishes the Dynamic Entities and Dynamic Resource Docs of the space ${bankId} under a base path of its own; ${bankId === "SYS" ? "SYS is the system space" : "the space is this bank id"}).`,
      "With base_path carbon-registry/v1, /carbon-registry/v1/ENTITY answers what /obp/v7.0.0/banks/SPACE/dynamic-entities/ENTITY answers; /carbon-registry/v1/openapi.yaml is its OpenAPI document.",
      "Fields settable via set_form_fields:",
      "- base_path (string, required; two to five segments of lowercase letters, digits, hyphens and dots, no leading slash, ending with the major version vN; the first segment must not be one OBP serves such as obp, banks, my, oauth)",
      "- version (string, required; MAJOR.MINOR.PATCH whose MAJOR equals the N of the base path's vN)",
      "- title (string, required, max 255 characters; the OpenAPI title)",
      "- description (string, optional, max 2000 characters; the OpenAPI description)",
      entityNames.length > 0 ? `Dynamic Entities in this space: ${entityNames.join(", ")}.` : "",
      "Current values (empty means unset):",
    ].filter(Boolean);
    for (const [name, access] of Object.entries(draftFields)) {
      const v = access.get();
      lines.push(`  ${name}: ${v === "" ? "(empty)" : JSON.stringify(v)}`);
    }
    return lines.join("\n");
  }

  const bridgeTarget = { formName: "domain-api", applyDraft, describe: describeForm };
  onMount(() => {
    formBridge.register(bridgeTarget);
    return () => formBridge.unregister(bridgeTarget);
  });

  async function handleSubmit(event: Event) {
    event.preventDefault();
    submitError = null;
    if (!base_path.trim()) { submitError = "Base path is required."; return; }
    if (!version.trim()) { submitError = "Version is required."; return; }
    if (!title.trim()) { submitError = "Title is required."; return; }
    if (basePathError) { submitError = `Base path: ${basePathError}`; return; }
    if (versionError) { submitError = `Version: ${versionError}`; return; }
    isSubmitting = true;
    try {
      await onSubmit({ base_path: base_path.trim(), version: version.trim(), title: title.trim(), description: description.trim() });
    } catch (e) {
      submitError = e instanceof Error ? e.message : String(e);
    } finally {
      isSubmitting = false;
    }
  }

  const fieldLabels: Record<string, string> = { base_path: "Base path", version: "Version", title: "Title", description: "Description" };
  const inputClass = "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100";
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

<form onsubmit={handleSubmit} class="space-y-5" data-testid="domain-api-form">
  <div>
    <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Space</span>
    <p class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100" data-testid="field-bank-id">{bankId}</p>
  </div>

  <div class="grid gap-5 sm:grid-cols-3">
    <div class="sm:col-span-2">
      <label for="base_path" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Base path <span class="text-red-500">*</span></label>
      <div class="mt-1 flex items-center">
        <span class="rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">/</span>
        <input id="base_path" name="base_path" type="text" autocomplete="off" spellcheck="false" placeholder="carbon-registry/v1" bind:value={base_path} oninput={onBasePathInput} class="{inputClass} mt-0 rounded-l-none font-mono" data-testid="field-base-path" />
      </div>
      {#if basePathError}
        <p class="mt-1 text-xs text-red-600 dark:text-red-400" data-testid="base-path-error">{basePathError}</p>
      {/if}
    </div>
    <div>
      <label for="version" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Version <span class="text-red-500">*</span></label>
      <input id="version" name="version" type="text" autocomplete="off" spellcheck="false" placeholder="1.0.0" bind:value={version} class="{inputClass} font-mono" data-testid="field-version" />
      {#if versionError}
        <p class="mt-1 text-xs text-red-600 dark:text-red-400" data-testid="version-error">{versionError}</p>
      {/if}
    </div>
  </div>

  <div>
    <label for="title" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Title <span class="text-red-500">*</span></label>
    <input id="title" name="title" type="text" maxlength="255" bind:value={title} class={inputClass} data-testid="field-title" />
  </div>

  <div>
    <label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
    <textarea id="description" name="description" rows="4" maxlength="2000" bind:value={description} class={inputClass} data-testid="field-description"></textarea>
  </div>

  {#if submitError}
    <div class="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200" data-testid="domain-api-error">{submitError}</div>
  {/if}

  <div class="flex flex-wrap gap-3">
    <button type="submit" disabled={isSubmitting} class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" data-testid="domain-api-submit">
      {isSubmitting ? "Saving…" : submitLabel}
    </button>
    <a href={cancelHref} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</a>
  </div>
</form>
