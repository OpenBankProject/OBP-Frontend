<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Badge from '$lib/components/Badge.svelte';
	import { MissingRoleAlert } from '@obp/shared/components';

	let { data, form } = $props();

	// While the run is queued or running, read it again every three seconds.
	$effect(() => {
		if (!data.live) return;
		const timer = setInterval(() => invalidateAll(), 3000);
		return () => clearInterval(timer);
	});

	const outcomeTone: Record<string, 'success' | 'error' | 'warning' | 'surface'> = { pass: 'success', fail: 'error', blocked: 'warning', not_executed: 'surface', not_applicable: 'surface' };
	const runTone: Record<string, 'surface' | 'primary' | 'success' | 'error'> = { queued: 'surface', running: 'primary', finished: 'success', harness_error: 'error' };
	const s = $derived(data.summary);
</script>

<p><a class="anchor" href="/spaces/{data.space}">{data.name}</a></p>
<h1 class="h2 mt-2">Run of {data.suite ? `${data.suite.name} ${data.suite.version}` : 'a suite no longer listed'}</h1>
<p class="mt-2">
	against {data.system?.name ?? 'a system no longer listed'}
	<Badge value={String(data.run.status)} tone={runTone[String(data.run.status)] ?? 'surface'} />
	{#if data.run.started_at}<span class="text-sm">started {data.run.started_at}</span>{/if}
	{#if data.run.finished_at}<span class="text-sm">, ended {data.run.finished_at}</span>{/if}
</p>
{#if data.run.status === 'queued'}<p class="mt-2 text-sm" role="status">Waiting for the runner. This page updates itself.</p>{/if}
{#if data.run.status === 'harness_error'}
	<p class="mt-4 preset-tonal-warning rounded p-3" role="alert">
		The run could not be completed because of a problem on the test platform's side, not yours: {data.run.problem}
	</p>
{/if}

{#if data.submissions.length}
	<p class="mt-4">Submitted for review: {#each data.submissions as sub, i (sub.id)}{i ? ', ' : ''}<a class="anchor" href="/spaces/{data.space}/submissions/{sub.id}">{sub.submitted_at || 'see the submission'}</a>{/each}</p>
{:else if data.canSubmit}
	<form method="POST" action="?/submit" class="mt-4 grid max-w-3xl gap-2 rounded border border-surface-500/30 p-4" data-testid="run-submit">
		<p class="font-semibold">Submit this run for the regulator's review</p>
		<p class="text-sm">You can add evidence for the evidence and control tests, ask for waivers and appeal results on the submission's page.</p>
		<label class="label"><span>A note for the reviewer (optional)</span><textarea class="textarea" name="note" rows="2" maxlength="4000"></textarea></label>
		<div><button class="btn preset-filled">Submit for review</button></div>
		{#if form?.problem}<p class="preset-tonal-error rounded p-2" role="alert">{form.problem}</p>{/if}
	</form>
{/if}

{#if !data.resultsReadable}
	<div class="mt-4"><MissingRoleAlert roles={['CanGetDynamicEntityRecord_conformator_result']} bankId={data.space} /></div>
{:else}
	<section class="mt-6 rounded border border-surface-500/30 p-4" data-testid="run-summary">
		<p class="font-semibold" class:text-error-500={s.mandatoryFailed.length > 0}>{s.headline}</p>
		{#if s.mandatoryFailed.length}<p class="mt-1">Failed: {#each s.mandatoryFailed as id, i (id)}{i ? ', ' : ''}<a class="anchor" href="#{id}">{id}</a>{/each}</p>{/if}
		<p class="mt-2 text-sm">
			{s.counts.pass} passed, {s.counts.fail} failed, {s.counts.blocked} blocked, {s.counts.not_executed} not executed, {s.counts.not_applicable} not applicable.
			{#if s.percentPassed !== null}{s.percentPassed}% of the tests that apply passed.{/if}
		</p>
		<p class="mt-2 text-sm opacity-80">These results evidence the technical tests listed only. They are not a licence, and give no access to live data or payments.</p>
	</section>

	<ol class="mt-6 flex flex-col gap-4" data-testid="run-results">
		{#each data.rows as row (row.test_id)}
			<li id={row.test_id} class="rounded border border-surface-500/30 p-4" data-testid="result-{row.test_id}">
				<div class="flex flex-wrap items-center gap-2">
					<code>{row.test_id}</code>
					<span class="font-semibold">{row.title}</span>
					{#if row.mandatory}<Badge value="mandatory" tone="primary" />{/if}
					{#if row.result}
						<Badge value={row.result.outcome} tone={outcomeTone[row.result.outcome] ?? 'surface'} />
						{#if row.result.outcome === 'blocked'}<span class="text-sm">{row.result.blocked_by === 'harness' ? "on the test platform's side" : 'on your side'}</span>{/if}
					{:else}
						<Badge value={data.live ? 'waiting' : 'no result'} />
					{/if}
				</div>
				{#if row.requirements.length}
					<p class="mt-1 text-sm">Requirements: {#each row.requirements as req, i (req.id)}{i ? '; ' : ''}<code>{req.reference}</code> {req.title}{/each}</p>
				{/if}
				{#if row.result}
					{#if row.result.expected}<p class="mt-2 text-sm"><span class="font-semibold">Expected:</span> {row.result.expected}</p>{/if}
					<p class="mt-1 text-sm"><span class="font-semibold">What happened:</span> {row.result.actual}</p>
					{#if row.result.outcome === 'fail' && row.suggested_fix}<p class="mt-1 text-sm"><span class="font-semibold">Suggested fix:</span> {row.suggested_fix}</p>{/if}
					{#if row.result.correlation_ids.length}<p class="mt-1 text-sm">Correlation ids: {#each row.result.correlation_ids as id, i (i)}{i ? ', ' : ''}<code>{id}</code>{/each}</p>{/if}
					{#if row.result.exchanges !== '[]'}
						<details class="mt-2">
							<summary class="cursor-pointer text-sm">Requests and responses (tokens hidden)</summary>
							<pre class="mt-2 max-h-96 overflow-auto rounded bg-surface-100-900 p-2 text-xs">{row.result.exchanges}</pre>
						</details>
					{/if}
				{/if}
			</li>
		{/each}
	</ol>
{/if}
