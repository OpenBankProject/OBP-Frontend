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
  import { renderMarkdown } from "@obp/shared/markdown";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import {
    EXAMPLE_DESCRIPTION,
    GLOSSARY_ITEM_MAX_TITLE_LENGTH,
    titleProblem,
    type GlossaryItemFormValues,
  } from "$lib/services/glossaryItems";

  interface Props {
    initial?: GlossaryItemFormValues;
    /** Titles of the static Glossary Items, so the form can say when one would be shadowed. */
    staticTitles?: string[];
    /** Titles of the Dynamic Glossary Items that already exist; creating a duplicate returns 409. */
    existingTitles?: string[];
    /**
     * Whether a static Glossary Item of this title exists, as OBP reports it
     * (`shadows_static_glossary_item`). The create page has no item yet, so it infers this from
     * `staticTitles` instead.
     */
    shadowsStatic?: boolean;
    /** Title is the resource key: it is fixed once the item exists. */
    lockTitle?: boolean;
    submitLabel: string;
    cancelHref: string;
    onSubmit: (values: GlossaryItemFormValues) => Promise<void>;
  }
  let {
    initial,
    staticTitles = [],
    existingTitles = [],
    shadowsStatic,
    lockTitle = false,
    submitLabel,
    cancelHref,
    onSubmit,
  }: Props = $props();

  let title = $state(initial?.title ?? "");
  let description = $state(initial?.description ?? "");
  let overridesStaticItem = $state(initial?.overrides_static_item ?? false);
  let showPreview = $state(true);
  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);

  let trimmedTitle = $derived(title.trim());
  let titleError = $derived(trimmedTitle ? titleProblem(title) : "");

  /** The static entry this title would shadow, if any — matched the way OBP matches it. */
  let shadowedStaticTitle = $derived(
    trimmedTitle ? staticTitles.find((t) => t.toLowerCase() === trimmedTitle.toLowerCase()) : undefined,
  );
  /** OBP's answer wins where we have it; otherwise fall back to the static-title list. */
  let collidesWithStatic = $derived(shadowsStatic ?? !!shadowedStaticTitle);
  /** The name to show in the messages: the static title we matched, else the title as typed. */
  let shadowedStatic = $derived(collidesWithStatic ? (shadowedStaticTitle ?? trimmedTitle) : undefined);
  let duplicateDynamic = $derived(
    !lockTitle && trimmedTitle
      ? existingTitles.find((t) => t.toLowerCase() === trimmedTitle.toLowerCase())
      : undefined,
  );

  let previewHtml = $derived(description.trim() ? renderMarkdown(description) : "");

  function useExample() {
    description = EXAMPLE_DESCRIPTION;
  }

  // ---- Draft support (Opey via formBridge) ----
  type FieldAccess = { get: () => string; set: (v: unknown) => void };
  const asText = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const draftFields: Record<string, FieldAccess> = {
    title: {
      get: () => title,
      set: (v) => {
        if (lockTitle) throw new Error("title is fixed while editing");
        title = asText(v).trim();
      },
    },
    description: {
      get: () => description,
      set: (v) => (description = asText(v)),
    },
    overrides_static_item: {
      get: () => String(overridesStaticItem),
      set: (v) => (overridesStaticItem = v === true || v === "true"),
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
      "Form: Dynamic Glossary Item (a Glossary entry stored in the OBP database and served by GET /obp/v4.0.0/api/glossary alongside the static ones).",
      "A Dynamic Item whose title matches a static Glossary Item replaces that static text everywhere the Glossary is listed. Deleting it restores the static text.",
      "Fields settable via set_form_fields:",
      lockTitle
        ? "- title (FIXED while editing; do not set it)"
        : `- title (string, required, max ${GLOSSARY_ITEM_MAX_TITLE_LENGTH} chars, no slash; the Glossary key, e.g. "Bank.bank_id" or "Transaction Request". Unique case insensitively.)`,
      "- description (markdown string, required; the same flavour the static Glossary uses. Headings, lists, code fences and links all work. Links to other Glossary entries are written as [Bank](/glossary#Bank).)",
      "- overrides_static_item (boolean; declares that this item is meant to displace the static Glossary Item of the same title. OBP refuses a colliding title with OBP-30577 unless this is true, so it must be set deliberately — never set it just to make a create succeed.)",
      shadowedStatic
        ? `Note: the current title matches the static Glossary Item "${shadowedStatic}", so saving needs overrides_static_item true and will shadow the shipped text.`
        : "",
      duplicateDynamic ? `Note: a Dynamic Glossary Item titled "${duplicateDynamic}" already exists; creating it again returns 409, so it should be edited instead.` : "",
      `Static Glossary titles on this instance: ${staticTitles.length}. Dynamic ones: ${existingTitles.length}.`,
      "Current values (empty means unset):",
    ].filter(Boolean);
    for (const [name, access] of Object.entries(draftFields)) {
      const v = access.get();
      lines.push(`  ${name}: ${v === "" ? "(empty)" : v.length > 2000 ? v.slice(0, 2000) + "…" : JSON.stringify(v)}`);
    }
    return lines.join("\n");
  }

  const bridgeTarget = { formName: "glossary-item", applyDraft, describe: describeForm };
  onMount(() => {
    formBridge.register(bridgeTarget);
    return () => formBridge.unregister(bridgeTarget);
  });

  async function handleSubmit(event: Event) {
    event.preventDefault();
    submitError = null;
    const problem = titleProblem(title);
    if (problem) { submitError = problem; return; }
    if (!description.trim()) { submitError = "A description is required."; return; }
    if (shadowedStatic && !overridesStaticItem) {
      submitError = `"${shadowedStatic}" is a static Glossary Item. Tick "Override the static Glossary Item" to displace it deliberately, or choose another title — OBP refuses this with OBP-30577 otherwise.`;
      return;
    }
    isSubmitting = true;
    try {
      await onSubmit({ title: trimmedTitle, description, overrides_static_item: overridesStaticItem });
    } catch (e) {
      submitError = e instanceof Error ? e.message : String(e);
    } finally {
      isSubmitting = false;
    }
  }

  const fieldLabels: Record<string, string> = { title: "Title", description: "Description", overrides_static_item: "Override static item" };
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

<form onsubmit={handleSubmit} class="space-y-5" data-testid="glossary-item-form">
  <div>
    <label for="glossary-item-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Title <span class="text-red-500">*</span></label>
    {#if lockTitle}
      <p class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100" data-testid="field-title-locked">{title}</p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">The title is the Glossary key and cannot be changed. To rename an entry, delete it and create a new one.</p>
    {:else}
      <input
        id="glossary-item-title"
        name="title"
        type="text"
        autocomplete="off"
        spellcheck="false"
        maxlength={GLOSSARY_ITEM_MAX_TITLE_LENGTH}
        placeholder="e.g. Bank.bank_id"
        bind:value={title}
        class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        data-testid="field-title"
      />
      {#if titleError}
        <p class="mt-1 text-xs text-red-600 dark:text-red-400" data-testid="title-error">{titleError}</p>
      {:else if duplicateDynamic}
        <p class="mt-1 text-xs text-amber-700 dark:text-amber-400" data-testid="title-duplicate">
          A Dynamic Glossary Item titled <span class="font-mono">{duplicateDynamic}</span> already exists — creating it again returns 409.
          <a class="underline" href="/glossary-items/{encodeURIComponent(duplicateDynamic)}">Edit it instead</a>.
        </p>
      {:else if collidesWithStatic}
        <p class="mt-1 text-xs text-amber-700 dark:text-amber-400" data-testid="title-shadows-static">
          This matches the static Glossary Item <span class="font-mono">{shadowedStatic}</span> — see the override box below.
        </p>
      {:else}
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">The Glossary key, unique case insensitively. Dots and spaces are fine; a slash is not.</p>
      {/if}
    {/if}
  </div>

  <div class="rounded-lg border {collidesWithStatic ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20' : 'border-gray-200 dark:border-gray-700'} p-4">
    <label class="flex items-start gap-3">
      <input
        type="checkbox"
        bind:checked={overridesStaticItem}
        class="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
        data-testid="field-overrides-static-item"
      />
      <span class="text-sm">
        <span class="font-medium text-gray-900 dark:text-gray-100">Override the static Glossary Item of this title</span>
        {#if collidesWithStatic}
          <span class="mt-1 block text-amber-800 dark:text-amber-200" data-testid="override-required">
            <span class="font-mono">{shadowedStatic}</span> ships with the API. This has to be ticked to displace it — OBP refuses the write with <span class="font-mono">OBP-30577</span> otherwise. Deleting this item restores the shipped text.
          </span>
        {:else}
          <span class="mt-1 block text-gray-500 dark:text-gray-400">
            Nothing static uses this title, so this changes nothing today. Tick it only to record that displacing shipped documentation of this title is intended.
          </span>
        {/if}
      </span>
    </label>
  </div>

  <div>
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <label for="glossary-item-description" class="text-sm font-medium text-gray-700 dark:text-gray-300">Description (markdown) <span class="text-red-500">*</span></label>
      <span class="flex gap-3">
        <button type="button" onclick={useExample} class="text-xs text-blue-600 hover:underline dark:text-blue-400" data-testid="use-example-description">Insert example</button>
        <button type="button" onclick={() => (showPreview = !showPreview)} class="text-xs text-blue-600 hover:underline dark:text-blue-400" data-testid="toggle-preview" aria-pressed={showPreview}>
          {showPreview ? "Hide preview" : "Show preview"}
        </button>
      </span>
    </div>
    <textarea
      id="glossary-item-description"
      name="description"
      bind:value={description}
      rows="16"
      placeholder="What this term means, in markdown."
      class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      data-testid="field-description"
    ></textarea>
    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
      Link to another Glossary entry with <span class="font-mono">[Bank](/glossary#Bank)</span>. OBP returns both the markdown and rendered HTML.
    </p>
  </div>

  {#if showPreview}
    <div>
      <h2 class="text-sm font-medium text-gray-700 dark:text-gray-300">Preview</h2>
      <div class="mt-1 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
        {#if previewHtml}
          <!-- markdown-it runs with html:false, so raw HTML in the source is escaped, not executed. -->
          <div class="glossary-preview" data-testid="description-preview">{@html previewHtml}</div>
        {:else}
          <p class="text-sm text-gray-500 dark:text-gray-400" data-testid="description-preview-empty">Nothing to preview yet.</p>
        {/if}
      </div>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Rendered here by the Manager; OBP renders the stored markdown itself when it serves the Glossary, so small differences are possible.</p>
    </div>
  {/if}

  {#if submitError}
    <div class="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200" data-testid="glossary-item-error">{submitError}</div>
  {/if}

  <div class="flex flex-wrap gap-3">
    <button type="submit" disabled={isSubmitting} class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" data-testid="glossary-item-submit">
      {isSubmitting ? "Saving…" : submitLabel}
    </button>
    <a href={cancelHref} class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</a>
  </div>
</form>

<style>
  .glossary-preview {
    font-size: 0.9375rem;
    line-height: 1.6;
    color: #374151;
  }
  .glossary-preview :global(h1),
  .glossary-preview :global(h2) {
    font-size: 1.0625rem;
    font-weight: 600;
    margin: 1.25rem 0 0.5rem;
    color: #111827;
  }
  .glossary-preview :global(h3) {
    font-size: 0.9375rem;
    font-weight: 600;
    margin: 1rem 0 0.375rem;
    color: #111827;
  }
  .glossary-preview :global(p) {
    margin: 0 0 0.75rem;
  }
  .glossary-preview :global(ul),
  .glossary-preview :global(ol) {
    margin: 0 0 0.75rem 1.25rem;
    padding: 0;
    list-style: revert;
  }
  .glossary-preview :global(li) {
    margin-bottom: 0.25rem;
  }
  .glossary-preview :global(a) {
    color: #2563eb;
    text-decoration: underline;
  }
  .glossary-preview :global(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.8125rem;
    background: rgba(0, 0, 0, 0.06);
    border-radius: 0.25rem;
    padding: 0.05rem 0.25rem;
  }
  .glossary-preview :global(pre) {
    overflow-x: auto;
    background: rgba(0, 0, 0, 0.06);
    border-radius: 0.375rem;
    padding: 0.75rem;
    margin: 0 0 0.75rem;
  }
  .glossary-preview :global(table) {
    display: block;
    overflow-x: auto;
    border-collapse: collapse;
    margin: 0 0 0.75rem;
  }
  .glossary-preview :global(th),
  .glossary-preview :global(td) {
    border: 1px solid #e5e7eb;
    padding: 0.25rem 0.5rem;
    text-align: left;
  }

  :global([data-mode="dark"]) .glossary-preview {
    color: #d1d5db;
  }
  :global([data-mode="dark"]) .glossary-preview :global(h1),
  :global([data-mode="dark"]) .glossary-preview :global(h2),
  :global([data-mode="dark"]) .glossary-preview :global(h3) {
    color: #f3f4f6;
  }
  :global([data-mode="dark"]) .glossary-preview :global(a) {
    color: #60a5fa;
  }
  :global([data-mode="dark"]) .glossary-preview :global(code),
  :global([data-mode="dark"]) .glossary-preview :global(pre) {
    background: rgba(255, 255, 255, 0.08);
  }
  :global([data-mode="dark"]) .glossary-preview :global(th),
  :global([data-mode="dark"]) .glossary-preview :global(td) {
    border-color: #374151;
  }
</style>
