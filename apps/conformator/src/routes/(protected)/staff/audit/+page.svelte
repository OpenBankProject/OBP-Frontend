<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import { formatDate, formatNumber } from '@obp/shared/i18n';

	let { data, form } = $props();

	function when(value: string | null | undefined): string {
		return value ? formatDate(new Date(value), { dateStyle: 'medium', timeStyle: 'medium' }) : '';
	}
</script>

<h1 class="h2">Audit chains</h1>
<p class="mt-2 max-w-3xl">
	Every change to a participant's lifecycle, a report, a submission or a review decision adds an entry to a hash chain in OBP-API. Each entry holds the record as it was saved, who saved it and when, and the hash of the entry before it. Changing or removing an entry afterwards, or changing a record without going through OBP-API, breaks the chain, and the check below finds it.
</p>

{#if form?.error}<p class="mt-4 ui-tone-error rounded p-3" role="alert">{form.error}</p>{/if}

{#if !data.canRead}
	<p class="mt-4 ui-tone-warning rounded p-3" role="status" data-testid="audit-no-role">
		Seeing and checking the audit chains needs the system Role <code>CanGetDynamicEntityAuditRootChain</code>. Ask for it on <a class="anchor" href="/staff/access">Your Roles</a>.
	</p>
{:else if data.problem}
	<p class="mt-4 ui-tone-error rounded p-3" role="alert">The audit chains could not be read: {data.problem}</p>
{:else if !data.root}
	<p class="mt-4" data-testid="audit-none">No audit chain has been started yet. The app starts the central ones once it holds its Scopes (see <a class="anchor" href="/setup#entities">Setup</a>), and each participant's space gets its own when it is set up.</p>
{:else}
	<section class="mt-6" data-testid="audit-root">
		<h2 class="h4">Root chain</h2>
		<p class="mt-2 max-w-3xl text-sm">The root chain ties every chain together. Sealing it records where each chain has got to. Its last hash then covers them all, so keeping that one hash outside OBP-API, for example in the regulator's own records, shows later whether anything recorded up to then was rewritten.</p>
		<dl class="mt-2 grid max-w-3xl grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			<dt>Entries</dt>
			<dd>{formatNumber(data.root.last_sequence + 1)}</dd>
			<dt>Last hash</dt>
			<dd><code class="break-all" data-testid="audit-root-hash">{data.root.last_hash}</code></dd>
		</dl>
		<div class="mt-4 flex flex-wrap gap-2">
			<form method="POST" action="?/check">
				<button class="btn preset-filled-primary-500" data-testid="audit-check">Check every chain</button>
			</form>
			{#if data.canSeal}
				<form method="POST" action="?/seal">
					<button class="btn preset-tonal" data-testid="audit-seal">Seal now</button>
				</form>
			{:else}
				<p class="text-sm self-center">Sealing needs the system Role <code>CanSealDynamicEntityAuditRootChain</code>.</p>
			{/if}
		</div>
		<p class="mt-2 text-sm">The check reads every entry and every record, so it takes longer as they grow.</p>
	</section>

	{#if form?.check}
		<section class="mt-6" data-testid="audit-check-result">
			{#if form.check.is_intact}
				<p class="ui-tone-success rounded p-3" role="status">
					Intact. {formatNumber(form.check.chains_checked)} chains and {formatNumber(form.check.entries_checked)} root entries checked at {when(form.check.checked_at)}. Nothing was changed outside OBP-API. To compare with a hash you kept, the root chain's last hash is <code class="break-all">{form.check.last_hash}</code> at entry {formatNumber(form.check.last_sequence)}.
				</p>
			{:else}
				<p class="ui-tone-error rounded p-3" role="alert">The check found {formatNumber(form.check.problem_count)} problems at {when(form.check.checked_at)}.</p>
				<table class="table mt-2">
					<thead><tr><th>Chain</th><th>Entry</th><th>Record</th><th>Problem</th></tr></thead>
					<tbody>
						{#each form.check.problems as problem, index (index)}
							<tr>
								<td>{problem.chain ?? 'root'}</td>
								<td>{problem.sequence ?? ''}</td>
								<td>{#if problem.record_id}<code>{problem.record_id}</code>{/if}</td>
								<td>{problem.problem}</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if form.check.problem_count > form.check.problems.length}<p class="mt-2 text-sm">Only the first {formatNumber(form.check.problems.length)} are listed.</p>{/if}
			{/if}
		</section>
	{/if}

	{#if form?.sealed}
		<section class="mt-6 ui-tone-success rounded p-3" role="status" data-testid="audit-sealed">
			<p>Sealed at {when(form.sealed.sealed_at)}: {formatNumber(form.sealed.chains_sealed)} chains had changed since the last seal.</p>
			<p class="mt-2">Keep this hash outside OBP-API, with the time and entry number:</p>
			<p class="mt-1"><code class="break-all" data-testid="audit-sealed-hash">{form.sealed.last_hash}</code> (entry {formatNumber(form.sealed.last_sequence)})</p>
		</section>
	{/if}

	<section class="mt-8" data-testid="audit-spaces">
		<h2 class="h4">Chains by space</h2>
		<p class="mt-2 max-w-3xl text-sm">A participant's space appears here once its chains are started. A space set up before audit chains were added gets them when it is set up again from the participant's page.</p>
		{#each data.spaces as space (space.space)}
			<h3 class="h5 mt-4"><code>{space.space}</code>{#if space.central} (central space){/if}</h3>
			{#if space.missing.length}
				<p class="mt-1 ui-tone-warning rounded p-2 text-sm" data-testid="audit-missing-{space.space}">No chain yet for: {space.missing.join(', ')}.</p>
			{/if}
			{#if space.chains.length}
				<table class="table mt-2">
					<thead><tr><th>Entity</th><th>Started</th></tr></thead>
					<tbody>
						{#each space.chains as chain (chain.chain_id)}
							<tr><td><code>{chain.entity_name}</code></td><td>{when(chain.started_at)}</td></tr>
						{/each}
					</tbody>
				</table>
			{/if}
		{/each}
	</section>
{/if}
