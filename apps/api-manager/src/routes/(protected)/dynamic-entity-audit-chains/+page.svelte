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
  import { invalidateAll } from "$app/navigation";
  import { ShieldCheck, Stamp } from "@lucide/svelte";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import { checkRootChain, sealRootChain, ROOT_CHAIN_ROLES, type RootChainCheck } from "$lib/services/dynamicEntityAuditChains";

  let { data } = $props();

  let includeChains = $state(true);
  let checking = $state(false);
  let sealing = $state(false);
  let result = $state<RootChainCheck | null>(null);
  let checkedWithChains = $state(false);
  let message = $state<string | null>(null);
  let actionError = $state<string | null>(null);

  async function check() {
    checking = true;
    actionError = null;
    message = null;
    try {
      result = await checkRootChain(includeChains);
      checkedWithChains = includeChains;
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      checking = false;
    }
  }

  async function seal() {
    sealing = true;
    actionError = null;
    message = null;
    try {
      const sealed = await sealRootChain();
      message = sealed.chains_sealed === 0
        ? "Sealed: no chain had changed since the last seal."
        : `Sealed ${sealed.chains_sealed} chain${sealed.chains_sealed === 1 ? "" : "s"}. The root chain's last hash is now ${sealed.root_chain.last_hash}.`;
      result = null;
      await invalidateAll();
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      sealing = false;
    }
  }

  // Where a problem is: in the root chain, or in an entity's chain, and at which entry and record.
  function whereOf(problem: RootChainCheck["problems"][number]): string {
    const parts: string[] = [];
    if (problem.chain_id) parts.push(`chain ${problem.chain_id}`);
    if (problem.sequence !== undefined) parts.push(`entry ${problem.sequence}`);
    if (problem.record_id && problem.record_id !== problem.chain_id) parts.push(`record ${problem.record_id}`);
    return parts.length > 0 ? parts.join(", ") : "the root chain";
  }
</script>

<svelte:head>
  <title>Dynamic Entity Audit Chains - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6">
    <h1 class="text-3xl font-bold ui-text">Dynamic Entity Audit Chains</h1>
    <p class="mt-1 text-sm ui-muted">
      An audit chain records every change to the records of one Dynamic Entity, so that changes made behind OBP-API's back can be found.
      The root chain ties every entity's chain together. Sealing it records where each chain ends now, and its last hash then covers them all.
    </p>
  </div>

  <div class="mb-4"><ApiExplorerEndpoints endpoints={data.endpoints} /></div>

  {#if !data.canGet}
    <MissingRoleAlert roles={[ROOT_CHAIN_ROLES.get]} message="You need this role to see and check the root audit chain" />
  {/if}
  {#if !data.canSeal}
    <MissingRoleAlert roles={[ROOT_CHAIN_ROLES.seal]} message="You need this role to seal the root audit chain" />
  {/if}

  {#if data.loadError}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error" data-testid="load-error">{data.loadError}</div>
  {/if}
  {#if actionError}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error" data-testid="action-error">{actionError}</div>
  {/if}
  {#if message}
    <div class="mb-6 break-all rounded-lg border p-4 text-sm ui-tone-success" role="status" data-testid="message">{message}</div>
  {/if}

  {#if data.canGet}
    <div class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border" data-testid="root-chain">
      <h2 class="mb-4 text-lg font-semibold ui-text">Root chain</h2>
      {#if data.rootChain}
        <dl class="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
          <div>
            <dt class="text-xs uppercase tracking-wider ui-muted">Created</dt>
            <dd class="mt-1 ui-text" data-testid="root-started-at">{new Date(data.rootChain.started_at).toLocaleString(undefined, { hourCycle: "h23" })}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wider ui-muted">Last entry</dt>
            <dd class="mt-1 ui-text" data-testid="root-last-sequence">{data.rootChain.last_sequence}</dd>
          </div>
          <div class="md:col-span-3">
            <dt class="text-xs uppercase tracking-wider ui-muted">Last hash, to keep outside OBP</dt>
            <dd class="mt-1 break-all font-mono text-xs ui-text" data-testid="root-last-hash">{data.rootChain.last_hash}</dd>
          </div>
        </dl>
      {:else}
        <p class="text-sm ui-muted" data-testid="no-root-chain">
          There is no root chain yet. It is created when the first Dynamic Entity's audit chain is started, or by sealing.
        </p>
      {/if}

      <div class="mt-6 flex flex-wrap items-center gap-4 border-t pt-4 ui-border">
        <label class="inline-flex items-center gap-2 text-sm ui-muted">
          <input type="checkbox" name="include_chains" bind:checked={includeChains} data-testid="include-chains" class="rounded ui-border" />
          Include every entity's chain, records included (<code class="font-mono text-xs">include_chains</code>)
        </label>
        <button type="button" onclick={check} disabled={checking || !data.rootChain} data-testid="check-button" class="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 preset-filled-primary-500">
          <ShieldCheck size={16} /> {checking ? "Checking…" : "Check"}
        </button>
        {#if data.canSeal}
          <button type="button" onclick={seal} disabled={sealing} data-testid="seal-button" class="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 ui-card ui-hover ui-muted ui-border">
            <Stamp size={16} /> {sealing ? "Sealing…" : "Seal"}
          </button>
        {/if}
      </div>
    </div>

    {#if result}
      <div class="rounded-lg border shadow-sm ui-card ui-border" data-testid="check-result" data-state={result.is_intact ? "intact" : "broken"}>
        <div class="flex flex-wrap items-center gap-3 border-b p-4 ui-border">
          {#if result.is_intact}
            <span class="rounded-full px-3 py-1 text-sm font-medium ui-tone-success" data-testid="intact">Intact</span>
          {:else}
            <span class="rounded-full px-3 py-1 text-sm font-medium ui-tone-error" data-testid="broken">{result.problem_count} problem{result.problem_count === 1 ? "" : "s"} found</span>
          {/if}
          <span class="text-sm ui-muted">
            Checked {result.entries_checked} root chain entr{result.entries_checked === 1 ? "y" : "ies"} and {result.chains_checked} entity chain{result.chains_checked === 1 ? "" : "s"}
            {checkedWithChains ? "in full" : "against the root chain only"}, at {new Date(result.checked_at).toLocaleString(undefined, { hourCycle: "h23" })}.
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
        <div class="border-t px-4 py-2 text-xs ui-muted ui-border">
          Last hash checked: <span class="break-all font-mono" data-testid="checked-last-hash">{result.last_hash}</span>
        </div>
      </div>
    {/if}
  {/if}
</div>
