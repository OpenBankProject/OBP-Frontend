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
  import { ACTIONS, DATE_BASES, RESOURCE_LABELS, RESOURCE_TYPES, type RetentionPolicy, type ResourceType } from "$lib/services/retention";

  /**
   * The fields of a retention policy. For a new one everything can be chosen; for a change (`policy` given), what the
   * policy is about (resource type, Dynamic Entity) is fixed, as OBP-API keeps it.
   */
  interface Props {
    entityNames: string[];
    policy?: RetentionPolicy;
    submitLabel: string;
  }
  let { entityNames, policy, submitLabel }: Props = $props();

  // Started from the policy being changed; the form owns the values after that.
  // svelte-ignore state_referenced_locally
  let type = $state<ResourceType>(policy?.resource_type ?? "dynamic_entity_record");
  // svelte-ignore state_referenced_locally
  let action = $state<string>(policy?.action ?? "archive");
  // svelte-ignore state_referenced_locally
  let dateBasis = $state<string>(policy?.date_basis?.startsWith("field:") ? "field:" : (policy?.date_basis ?? DATE_BASES[policy?.resource_type ?? "dynamic_entity_record"][0]));
  const bases = $derived(DATE_BASES[type]);
  const input = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100";
  const label = "block text-sm font-medium text-gray-700 dark:text-gray-300";

  function chooseType(e: Event) {
    type = (e.currentTarget as HTMLSelectElement).value as ResourceType;
    if (!DATE_BASES[type].includes(dateBasis)) dateBasis = DATE_BASES[type][0];
    if (action === "anonymise" && type !== "customer") action = "delete";
  }
</script>

<div class="grid gap-4 md:grid-cols-2">
  <div>
    <label class={label} for="name">Name</label>
    <input id="name" name="name" class={input} maxlength="255" value={policy?.name ?? ""} />
  </div>
  <div>
    <label class={label} for="description">Description</label>
    <input id="description" name="description" class={input} maxlength="1000" value={policy?.description ?? ""} />
  </div>
  <div>
    <label class={label} for="resource_type">Resources</label>
    {#if policy}
      <p class="py-2 text-sm text-gray-900 dark:text-gray-100">{RESOURCE_LABELS[policy.resource_type]}{policy.entity_name ? `: ${policy.entity_name}` : ""}</p>
    {:else}
      <select id="resource_type" name="resource_type" class={input} value={type} onchange={chooseType} data-testid="resource-type">
        {#each RESOURCE_TYPES as r (r)}<option value={r}>{RESOURCE_LABELS[r]}</option>{/each}
      </select>
    {/if}
  </div>
  {#if !policy && type === "dynamic_entity_record"}
    <div>
      <label class={label} for="entity_name">Dynamic Entity</label>
      <select id="entity_name" name="entity_name" class={input} required data-testid="entity-name">
        <option value="">Choose…</option>
        {#each entityNames as n (n)}<option value={n}>{n}</option>{/each}
      </select>
    </div>
  {/if}
  <div>
    <label class={label} for="date_basis">Counted from</label>
    <select id="date_basis" name="date_basis" class={input} bind:value={dateBasis}>
      {#each bases as b (b)}<option value={b}>{b === "field:" ? "a date field of the record" : b}</option>{/each}
    </select>
  </div>
  {#if dateBasis === "field:"}
    <div>
      <label class={label} for="date_field">Date field (ISO 8601 in the record)</label>
      <input id="date_field" name="date_field" class={input} placeholder="submitted_at" value={policy?.date_basis?.startsWith("field:") ? policy.date_basis.slice(6) : ""} />
    </div>
  {/if}
  <div>
    <label class={label} for="condition_field">Only where field (optional)</label>
    <input id="condition_field" name="condition_field" class={input} placeholder="status" value={policy?.condition?.field ?? ""} />
  </div>
  <div>
    <label class={label} for="condition_value">equals</label>
    <input id="condition_value" name="condition_value" class={input} placeholder="draft" value={policy?.condition?.value ?? ""} />
  </div>
  <div>
    <label class={label} for="retain_days">Days kept live</label>
    <input id="retain_days" name="retain_days" type="number" min="1" required class={input} value={policy?.retain_days ?? ""} />
  </div>
  <div>
    <label class={label} for="action">Then</label>
    <select id="action" name="action" class={input} bind:value={action} data-testid="action">
      {#each ACTIONS.filter((a) => a !== "anonymise" || type === "customer") as a (a)}<option value={a}>{a}</option>{/each}
    </select>
  </div>
  {#if action === "archive"}
    <div>
      <label class={label} for="archive_days">Days in the archive, then deleted</label>
      <input id="archive_days" name="archive_days" type="number" min="1" required class={input} value={policy?.archive_days ?? ""} />
    </div>
  {/if}
</div>
<div class="mt-4 flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-300">
  <label class="flex items-center gap-2"><input type="checkbox" name="cascade" checked={policy?.cascade ?? false} /> With attached files and links (each takes the same action)</label>
  <label class="flex items-center gap-2"><input type="checkbox" name="requires_approval" checked={policy?.requires_approval ?? true} /> A run needs approval by a second person</label>
  <label class="flex items-center gap-2"><input type="checkbox" name="enabled" checked={policy?.enabled ?? false} /> The scheduler runs it (a manual run is always possible)</label>
</div>
<button type="submit" class="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white dark:bg-blue-500" data-testid="policy-submit">{submitLabel}</button>
