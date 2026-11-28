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
  import { goto, invalidateAll } from "$app/navigation";
  import { ShieldCheck, Play } from "@lucide/svelte";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";
  import SpaceRoleAlerts from "$lib/components/SpaceRoleAlerts.svelte";
  import { checkEntityChain, startEntityChain, entityChainPageHref, ENTITY_CHAIN_ROLES, type EntityChainCheck } from "$lib/services/dynamicEntityAuditChains";

  let { data } = $props();

  let starting = $state(false);
  let checking = $state(false);
  let result = $state<EntityChainCheck | null>(null);
  let actionError = $state<string | null>(null);
  let recordFilter = $state("");
  // The record box follows the record in the URL, also when a record link in the table is followed.
  $effect(() => {
    recordFilter = data.recordId;
  });
  let expanded = $state<number | null>(null);

  const pageHref = $derived(entityChainPageHref(data.bankId, data.dynamicEntityId));
  const entityHref = $derived(`/dynamic-entities/system/${encodeURIComponent(data.dynamicEntityId)}?bank_id=${encodeURIComponent(data.bankId)}`);
  const lastShown = $derived(data.entries.length > 0 ? data.entries[data.entries.length - 1].sequence : -1);
  const hasMore = $derived(!data.recordId && data.chain !== null && lastShown < data.chain.last_sequence);

  async function start() {
    starting = true;
    actionError = null;
    try {
      await startEntityChain(data.bankId, data.dynamicEntityId);
      await invalidateAll();
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      starting = false;
    }
  }

  async function check() {
    checking = true;
    actionError = null;
    try {
      result = await checkEntityChain(data.bankId, data.dynamicEntityId);
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      checking = false;
    }
  }

  function showRecord(event: SubmitEvent) {
    event.preventDefault();
    const recordId = recordFilter.trim();
    goto(recordId ? `${pageHref}?record_id=${encodeURIComponent(recordId)}` : pageHref);
  }

  function whereOf(problem: EntityChainCheck["problems"][number]): string {
    const parts: string[] = [];
    if (problem.sequence !== undefined) parts.push(`entry ${problem.sequence}`);
    if (problem.record_id) parts.push(`record ${problem.record_id}`);
    return parts.length > 0 ? parts.join(", ") : "the chain";
  }

  // Who made a change: the user, and the user it was made for when an agent acted for someone.
  function whoOf(entry: { user_id: string; on_behalf_of_user_id: string }): string {
    if (!entry.user_id) return "";
    return entry.on_behalf_of_user_id && entry.on_behalf_of_user_id !== entry.user_id
      ? `${entry.user_id} for ${entry.on_behalf_of_user_id}`
      : entry.user_id;
  }
</script>

<svelte:head>
  <title>Audit Chain of {data.entityName} - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6">
    <a href={entityHref} class="text-sm hover:underline ui-link" data-testid="entity-link">← {data.entityName}</a>
    <h1 class="mt-2 text-3xl font-bold ui-text">Audit Chain of <span class="font-mono">{data.entityName}</span></h1>
    <p class="mt-1 text-sm ui-muted">
      Once started, every change to this entity's records adds an entry, linked to the one before by its hash.
      The check finds records or entries changed without going through OBP-API.
      A chain cannot be stopped, and an entity with a chain cannot be deleted or renamed.
      See also the <a href="/dynamic-entity-audit-chains" class="hover:underline ui-link">root chain</a>, which ties every chain together.
    </p>
  </div>

  <div class="mb-4"><ApiExplorerEndpoints endpoints={data.endpoints} /></div>

  <SpaceRoleAlerts bankId={data.bankId} roles={[
    { role: ENTITY_CHAIN_ROLES.get, purpose: "to see and check its audit chains" },
    { role: ENTITY_CHAIN_ROLES.create, purpose: "to start an audit chain" },
  ]} />

  {#if data.loadError}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error" data-testid="load-error">{data.loadError}</div>
  {/if}
  {#if actionError}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error" data-testid="action-error">{actionError}</div>
  {/if}

  {#if !data.chain}
    {#if !data.loadError}
      <div class="rounded-lg border p-6 shadow-sm ui-card ui-border" data-testid="no-chain">
        <p class="text-sm ui-muted">
          This entity has no audit chain. Starting one records each record it already holds, then every change from now on.
        </p>
        <button type="button" onclick={start} disabled={starting} data-testid="start-button" class="mt-4 inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 preset-filled-primary-500">
          <Play size={16} /> {starting ? "Starting…" : "Start audit chain"}
        </button>
      </div>
    {/if}
  {:else}
    <div class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border" data-testid="chain">
      <dl class="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
        <div>
          <dt class="text-xs uppercase tracking-wider ui-muted">Started</dt>
          <dd class="mt-1 ui-text" data-testid="chain-started-at">{new Date(data.chain.started_at).toLocaleString(undefined, { hourCycle: "h23" })}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wider ui-muted">Started by</dt>
          <dd class="mt-1 break-all font-mono text-xs ui-text" data-testid="chain-started-by">{whoOf({ user_id: data.chain.started_by_user_id, on_behalf_of_user_id: data.chain.started_by_on_behalf_of_user_id })}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wider ui-muted">Last entry</dt>
          <dd class="mt-1 ui-text" data-testid="chain-last-sequence">{data.chain.last_sequence}</dd>
        </div>
        <div class="md:col-span-3">
          <dt class="text-xs uppercase tracking-wider ui-muted">Last hash</dt>
          <dd class="mt-1 break-all font-mono text-xs ui-text" data-testid="chain-last-hash">{data.chain.last_hash}</dd>
        </div>
      </dl>
      <div class="mt-6 border-t pt-4 ui-border">
        <button type="button" onclick={check} disabled={checking} data-testid="check-button" class="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 preset-filled-primary-500">
          <ShieldCheck size={16} /> {checking ? "Checking…" : "Check"}
        </button>
      </div>
    </div>

    {#if result}
      <div class="mb-6 rounded-lg border shadow-sm ui-card ui-border" data-testid="check-result" data-state={result.is_intact ? "intact" : "broken"}>
        <div class="flex flex-wrap items-center gap-3 border-b p-4 ui-border">
          {#if result.is_intact}
            <span class="rounded-full px-3 py-1 text-sm font-medium ui-tone-success" data-testid="intact">Intact</span>
          {:else}
            <span class="rounded-full px-3 py-1 text-sm font-medium ui-tone-error" data-testid="broken">{result.problem_count} problem{result.problem_count === 1 ? "" : "s"} found</span>
          {/if}
          <span class="text-sm ui-muted">
            Checked {result.entries_checked} entr{result.entries_checked === 1 ? "y" : "ies"} and {result.records_checked} record{result.records_checked === 1 ? "" : "s"} at {new Date(result.checked_at).toLocaleString(undefined, { hourCycle: "h23" })}.
          </span>
        </div>
        {#if result.problems.length > 0}
          <div class="overflow-x-auto">
            <table class="w-full text-sm" data-testid="problems-table">
              <thead class="ui-card">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Where</th>
                  <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Problem</th>
                </tr>
              </thead>
              <tbody class="divide-y ui-border">
                {#each result.problems as problem, index (index)}
                  <tr data-testid="problem-{index}">
                    <td class="px-4 py-3 font-mono text-xs ui-text">{whereOf(problem)}</td>
                    <td class="px-4 py-3 ui-muted">{problem.problem}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if result.problem_count > result.problems.length}
            <div class="border-t px-4 py-2 text-xs ui-muted ui-border" data-testid="problems-truncated">
              Showing the first {result.problems.length} of {result.problem_count} problems.
            </div>
          {/if}
        {/if}
      </div>
    {/if}

    <div class="rounded-lg border shadow-sm ui-card ui-border" data-testid="entries">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b p-4 ui-border">
        <h2 class="text-lg font-semibold ui-text">
          {data.recordId ? "History of one record" : "Entries"}
        </h2>
        <form onsubmit={showRecord} class="flex items-center gap-2">
          <label for="record-id" class="text-sm ui-muted">Record id</label>
          <input id="record-id" name="record_id" bind:value={recordFilter} data-testid="record-id-input" class="rounded-lg border px-3 py-1.5 font-mono text-xs ui-card ui-text ui-border" />
          <button type="submit" data-testid="record-id-submit" class="rounded-lg border px-3 py-1.5 text-sm ui-hover ui-muted ui-border">Show history</button>
          {#if data.recordId}
            <a href={pageHref} class="text-sm hover:underline ui-link" data-testid="all-entries-link">All entries</a>
          {/if}
        </form>
      </div>
      {#if data.entries.length === 0}
        <div class="p-8 text-center text-sm ui-muted" data-testid="no-entries">No entries.</div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm" data-testid="entries-table">
            <thead class="ui-card">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">#</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Operation</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Record</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">By</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">At</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Hash</th>
              </tr>
            </thead>
            <tbody class="divide-y ui-border">
              {#each data.entries as entry (entry.sequence)}
                <tr data-testid="entry-{entry.sequence}" data-state={expanded === entry.sequence ? "expanded" : "collapsed"}>
                  <td class="px-4 py-3 font-mono text-xs ui-text">{entry.sequence}</td>
                  <td class="px-4 py-3 text-xs">
                    <button type="button" onclick={() => (expanded = expanded === entry.sequence ? null : entry.sequence)} class="font-mono hover:underline ui-link" data-testid="expand-{entry.sequence}" aria-expanded={expanded === entry.sequence}>{entry.operation}</button>
                  </td>
                  <td class="px-4 py-3 font-mono text-xs">
                    {#if entry.record_id}
                      <a href="{pageHref}?record_id={encodeURIComponent(entry.record_id)}" class="hover:underline ui-link">{entry.record_id}</a>
                    {/if}
                  </td>
                  <td class="px-4 py-3 break-all font-mono text-xs ui-muted">{whoOf(entry)}</td>
                  <td class="px-4 py-3 whitespace-nowrap text-xs ui-muted">{new Date(entry.recorded_at).toLocaleString(undefined, { hourCycle: "h23" })}</td>
                  <td class="px-4 py-3 font-mono text-xs ui-muted" title={entry.hash}>{entry.hash.slice(0, 12)}…</td>
                </tr>
                {#if expanded === entry.sequence}
                  <tr data-testid="entry-detail-{entry.sequence}">
                    <td colspan="6" class="px-4 py-3 ui-card">
                      <dl class="grid grid-cols-1 gap-2 text-xs md:grid-cols-[10rem_1fr]">
                        <dt class="ui-muted">hash</dt><dd class="break-all font-mono ui-text">{entry.hash}</dd>
                        <dt class="ui-muted">previous_hash</dt><dd class="break-all font-mono ui-text">{entry.previous_hash}</dd>
                        <dt class="ui-muted">data_hash</dt><dd class="break-all font-mono ui-text">{entry.data_hash}</dd>
                        {#if entry.owner_user_id}
                          <dt class="ui-muted">owner_user_id</dt><dd class="break-all font-mono ui-text">{entry.owner_user_id}</dd>
                        {/if}
                        {#if entry.data_json}
                          <dt class="ui-muted">data</dt><dd><pre class="overflow-x-auto whitespace-pre-wrap break-all font-mono ui-text">{JSON.stringify(entry.data, null, 2)}</pre></dd>
                        {/if}
                      </dl>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between border-t px-4 py-2 text-xs ui-muted ui-border">
          <span>{data.recordId ? `${data.entries.length} entries for this record` : `Entries ${data.entries[0].sequence} to ${lastShown} of ${data.chain.last_sequence + 1}`}</span>
          <span class="flex gap-3">
            {#if !data.recordId && data.fromSequence > 0}
              <a href="{pageHref}?from_sequence={Math.max(0, data.fromSequence - data.pageSize)}" class="hover:underline ui-link" data-testid="previous-page">Previous</a>
            {/if}
            {#if hasMore}
              <a href="{pageHref}?from_sequence={lastShown + 1}" class="hover:underline ui-link" data-testid="next-page">Next</a>
            {/if}
          </span>
        </div>
      {/if}
    </div>
  {/if}
</div>
