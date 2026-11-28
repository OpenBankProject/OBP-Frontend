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
<!--
  This component is the form that creates or changes a Dynamic Entity webhook: where OBP sends its requests,
  which record changes it sends them for, and, for updates, which field changes count. The entity is chosen
  outside the form; its fields and their types drive the condition editor, so a from or to value is entered
  as the type the field holds. OBP checks everything again and has the final say.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { Plus, Trash2 } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import {
    WEBHOOK_EVENTS,
    urlProblem,
    conditionValue,
    conditionInput,
    type WebhookEntity,
    type WebhookEvent,
    type WebhookFormValues,
  } from "$lib/services/dynamicEntityWebhooks";

  interface Props {
    entity: WebhookEntity;
    initial?: WebhookFormValues;
    submitLabel: string;
    cancelHref: string;
    onSubmit: (values: WebhookFormValues) => Promise<void>;
  }
  let { entity, initial, submitLabel, cancelHref, onSubmit }: Props = $props();

  /** A condition as the editor holds it: the from and to values as their inputs show them. */
  type ConditionRow = { field: string; from: string; to: string };

  let url = $state(initial?.url ?? "");
  let events = $state<WebhookEvent[]>(initial?.events ?? ["CREATED", "UPDATED", "DELETED"]);
  let conditions = $state<ConditionRow[]>(
    (initial?.field_conditions ?? []).map((c) => ({ field: c.field, from: conditionInput(c.from), to: conditionInput(c.to) })),
  );
  let isActive = $state(initial?.is_active ?? true);
  let description = $state(initial?.description ?? "");
  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);

  const fieldNames = $derived(Object.keys(entity.field_types).sort());
  const urlError = $derived(urlProblem(url.trim()));

  function toggleEvent(event: WebhookEvent, checked: boolean) {
    events = checked ? WEBHOOK_EVENTS.filter((e) => e === event || events.includes(e)) : events.filter((e) => e !== event);
  }

  function addCondition() {
    const unused = fieldNames.find((name) => !conditions.some((c) => c.field === name)) ?? "";
    conditions = [...conditions, { field: unused, from: "", to: "" }];
  }

  function removeCondition(index: number) {
    conditions = conditions.filter((_, i) => i !== index);
  }

  /** Why the conditions would be refused, or "". */
  function conditionsProblem(): string {
    if (conditions.length === 0) return "";
    if (!events.includes("UPDATED")) return "Field conditions apply to updates only, so UPDATED must be one of the events.";
    if (conditions.some((c) => !c.field)) return "Every condition needs a field.";
    if (new Set(conditions.map((c) => c.field)).size !== conditions.length) return "A field may be named by one condition only.";
    const same = conditions.find((c) => c.from !== "" && c.from === c.to);
    if (same) return `The from and to values of ${same.field} are the same, so no change could match.`;
    return "";
  }

  // ---- Draft support: Opey fills the form through formBridge; nothing is saved until the user submits ----
  type FieldAccess = { get: () => unknown; set: (v: unknown) => void };
  const asText = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []);
  const draftFields: Record<string, FieldAccess> = {
    url: { get: () => url, set: (v) => (url = asText(v).trim()) },
    events: {
      get: () => [...events],
      set: (v) => {
        const named = asList(v).map((e) => asText(e).trim().toUpperCase());
        events = WEBHOOK_EVENTS.filter((e) => named.includes(e));
      },
    },
    field_conditions: {
      get: () => conditions.map((c) => ({ ...c })),
      set: (v) => {
        conditions = asList(v)
          .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
          .map((c) => ({ field: asText(c.field), from: conditionInput(c.from), to: conditionInput(c.to) }));
      },
    },
    is_active: { get: () => isActive, set: (v) => (isActive = v === true || asText(v).toLowerCase() === "true") },
    description: { get: () => description, set: (v) => (description = asText(v)) },
  };
  let opeyPrevious = $state<Record<string, unknown>>({});
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
    if (!(name in opeyPrevious)) return;
    if (name === "field_conditions") conditions = (opeyPrevious[name] as ConditionRow[]).map((c) => ({ ...c }));
    else if (name === "events") events = [...(opeyPrevious[name] as WebhookEvent[])];
    else draftFields[name]?.set(opeyPrevious[name]);
    const { [name]: _dropped, ...rest } = opeyPrevious;
    opeyPrevious = rest;
  }
  function acceptAll() { opeyPrevious = {}; }

  function describeForm(): string {
    const fields = Object.entries(entity.field_types).map(([name, type]) => `${name} (${type})`);
    const lines = [
      `Form: Dynamic Entity webhook for the entity ${entity.entity_name} in the space ${entity.bank_id} (${entity.bank_id === "SYS" ? "SYS is the system space" : "the space is this bank id"}).`,
      "OBP sends a POST to the url when records of this entity are created, updated or deleted. The request carries identifiers only (event, bank, entity, record id), never record values.",
      "Fields settable via set_form_fields:",
      "- url (string, required; absolute https URL; OBP refuses its own host and loopback, private, link-local or cloud metadata addresses; one webhook per url per entity)",
      `- events (array of strings, required, at least one of ${WEBHOOK_EVENTS.join(", ")})`,
      "- field_conditions (array of {field, from?, to?}, optional; only for updates, so events must include UPDATED; an update is sent when at least one condition matches: the field changed, from `from` and to `to` where given; one condition per field; from and to must differ and must fit the field's type; an empty array means every update is sent)",
      "- is_active (boolean)",
      "- description (string, optional, max 2000 characters)",
      fields.length > 0 ? `The entity's fields and types: ${fields.join(", ")}.` : "The entity's fields are not known here.",
      "Current values:",
    ];
    lines.push(`  url: ${JSON.stringify(url)}`);
    lines.push(`  events: ${JSON.stringify(events)}`);
    lines.push(`  field_conditions: ${JSON.stringify(conditions.map((c) => ({ field: c.field, ...(c.from ? { from: c.from } : {}), ...(c.to ? { to: c.to } : {}) })))}`);
    lines.push(`  is_active: ${isActive}`);
    lines.push(`  description: ${JSON.stringify(description)}`);
    return lines.join("\n");
  }

  const bridgeTarget = { formName: "dynamic-entity-webhook", applyDraft, describe: describeForm };
  onMount(() => {
    formBridge.register(bridgeTarget);
    return () => formBridge.unregister(bridgeTarget);
  });

  const fieldLabels: Record<string, string> = { url: "URL", events: "Events", field_conditions: "Field conditions", is_active: "Active", description: "Description" };

  async function handleSubmit(event: Event) {
    event.preventDefault();
    submitError = null;
    if (!url.trim()) { submitError = "URL is required."; return; }
    if (urlError) { submitError = `URL: ${urlError}`; return; }
    if (events.length === 0) { submitError = "Choose at least one event."; return; }
    const problem = conditionsProblem();
    if (problem) { submitError = problem; return; }
    isSubmitting = true;
    try {
      await onSubmit({
        url: url.trim(),
        events,
        field_conditions: conditions.map((c) => {
          const type = entity.field_types[c.field];
          const from = conditionValue(c.from, type);
          const to = conditionValue(c.to, type);
          return { field: c.field, ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }) };
        }),
        is_active: isActive,
        description: description.trim(),
      });
    } catch (e) {
      submitError = e instanceof Error ? e.message : String(e);
    } finally {
      isSubmitting = false;
    }
  }

  const inputClass = "mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 ui-card ui-text ui-border";
  const smallInputClass = "block w-full rounded-lg border px-2 py-1.5 text-sm ui-card ui-text ui-border";
</script>

{#snippet valueInput(row: ConditionRow, which: "from" | "to")}
  {@const type = entity.field_types[row.field]}
  {#if type === "boolean"}
    <select bind:value={row[which]} class={smallInputClass} data-testid="condition-{which}-{row.field}">
      <option value="">any</option>
      <option value="true">true</option>
      <option value="false">false</option>
    </select>
  {:else if type === "number" || type === "integer"}
    <input type="text" inputmode={type === "integer" ? "numeric" : "decimal"} placeholder="any" bind:value={row[which]} class="{smallInputClass} font-mono" data-testid="condition-{which}-{row.field}" />
  {:else}
    <input type="text" placeholder="any" bind:value={row[which]} class="{smallInputClass} font-mono" data-testid="condition-{which}-{row.field}" />
  {/if}
{/snippet}

{#if opeyFilledFields.length > 0}
  <div class="mb-4 flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm ui-tone-info" data-testid="opey-filled-banner">
    <span>Opey filled {opeyFilledFields.length} field{opeyFilledFields.length === 1 ? "" : "s"}:</span>
    {#each opeyFilledFields as name (name)}
      <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ui-card">
        {fieldLabels[name] ?? name}
        <button type="button" class="underline" onclick={() => revertField(name)} data-testid="opey-revert-{name}">revert</button>
      </span>
    {/each}
    <button type="button" class="ml-auto rounded-md px-3 py-1 text-xs font-medium preset-filled-primary-500" onclick={acceptAll} data-testid="opey-accept-all">Keep all</button>
  </div>
{/if}

<form onsubmit={handleSubmit} class="space-y-6" data-testid="webhook-form">
  <div class="grid gap-4 sm:grid-cols-2">
    <div>
      <span class="block text-sm font-medium ui-muted">Space</span>
      <p class="mt-1 font-mono text-sm ui-text" data-testid="field-bank-id">{entity.bank_id}</p>
    </div>
    <div>
      <span class="block text-sm font-medium ui-muted">Dynamic Entity</span>
      <p class="mt-1 font-mono text-sm ui-text" data-testid="field-entity">{entity.entity_name}</p>
    </div>
  </div>

  <div>
    <label for="url" class="block text-sm font-medium ui-muted">URL <span class="ui-text-error">*</span></label>
    <input id="url" name="url" type="url" autocomplete="off" spellcheck="false" placeholder="https://receiver.example.com/hooks/obp" bind:value={url} class="{inputClass} font-mono" data-testid="field-url" />
    {#if urlError}
      <p class="mt-1 text-xs ui-text-error" data-testid="url-error">{urlError}</p>
    {:else}
      <p class="mt-1 text-xs ui-muted">OBP refuses a URL that points at itself or at a loopback, private or cloud metadata address. An entity has one webhook per URL.</p>
    {/if}
  </div>

  <fieldset>
    <legend class="block text-sm font-medium ui-muted">Events <span class="ui-text-error">*</span></legend>
    <div class="mt-2 flex flex-wrap gap-4">
      {#each WEBHOOK_EVENTS as e (e)}
        <label class="inline-flex items-center gap-2 text-sm ui-text">
          <input type="checkbox" checked={events.includes(e)} onchange={(ev) => toggleEvent(e, (ev.currentTarget as HTMLInputElement).checked)} data-testid="event-{e}" />
          {e}
        </label>
      {/each}
    </div>
  </fieldset>

  <fieldset>
    <legend class="block text-sm font-medium ui-muted">Field conditions</legend>
    <p class="mt-1 text-xs ui-muted">
      Leave empty to send every update. With conditions, an update is sent only when at least one matches: the field changed,
      from the "from" value and to the "to" value where they are given. Creates and deletes are not affected.
    </p>
    {#if conditions.length > 0}
      <div class="mt-3 space-y-2" data-testid="conditions">
        <div class="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 text-xs font-medium uppercase tracking-wider ui-muted">
          <span>Field</span><span>From</span><span>To</span><span></span>
        </div>
        {#each conditions as row, index (index)}
          <div class="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-2" data-testid="condition-row">
            <select bind:value={row.field} onchange={() => { row.from = ""; row.to = ""; }} class="{smallInputClass} font-mono" data-testid="condition-field">
              {#if !fieldNames.includes(row.field)}
                <option value={row.field}>{row.field || "choose a field"}{row.field ? " (not in the entity)" : ""}</option>
              {/if}
              {#each fieldNames as name (name)}
                <option value={name}>{name} ({entity.field_types[name]})</option>
              {/each}
            </select>
            {@render valueInput(row, "from")}
            {@render valueInput(row, "to")}
            <button type="button" onclick={() => removeCondition(index)} aria-label="Remove condition" class="rounded border p-1.5 ui-hover ui-muted ui-border" data-testid="condition-remove">
              <Trash2 size={14} />
            </button>
          </div>
        {/each}
      </div>
    {/if}
    <button type="button" onclick={addCondition} disabled={fieldNames.length === 0} class="mt-3 inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 ui-card ui-hover ui-muted ui-border" data-testid="condition-add">
      <Plus size={14} /> Add condition
    </button>
  </fieldset>

  <div class="flex items-center gap-2">
    <input id="is_active" type="checkbox" bind:checked={isActive} data-testid="field-is-active" />
    <label for="is_active" class="text-sm ui-text">Active</label>
  </div>

  <div>
    <label for="description" class="block text-sm font-medium ui-muted">Description</label>
    <textarea id="description" name="description" rows="3" maxlength="2000" bind:value={description} class={inputClass} data-testid="field-description"></textarea>
  </div>

  {#if submitError}
    <div class="rounded-lg border px-4 py-3 text-sm ui-tone-error" data-testid="webhook-error">{submitError}</div>
  {/if}

  <div class="flex flex-wrap gap-3">
    <button type="submit" disabled={isSubmitting} class="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 preset-filled-primary-500" data-testid="webhook-submit">
      {isSubmitting ? "Saving…" : submitLabel}
    </button>
    <a href={cancelHref} class="rounded-lg border px-4 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border">Cancel</a>
  </div>
</form>
