<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import { PageRoleCheck } from '@obp/shared/components';

	let { data } = $props();
	const d = $derived(data.dashboard);
	const words = (s: string) => s.replaceAll('_', ' ');
</script>

<h1 class="h2">Dashboard</h1>

<div class="mt-4">
<PageRoleCheck userEntitlements={data.userEntitlements} required={data.required} requirementType="AND">
{#if data.problem}
	<p class="preset-tonal-error rounded p-3" role="alert">The dashboard could not be counted: {data.problem}</p>
{:else if d}
	<p class="mt-2 text-sm">
		Counted now from the records. Runs, results and submissions come from the {d.spacesReadable} of {d.spacesTotal} participant spaces you can read.
		Export: <a class="anchor" href="/staff/dashboard/participants.csv" download>participants (CSV)</a> ·
		<a class="anchor" href="/staff/dashboard/failed-tests.csv" download>most failed tests (CSV)</a> ·
		<a class="anchor" href="/staff/dashboard/dashboard.json" download>everything (JSON)</a>
	</p>

	<section class="mt-6 grid gap-4 md:grid-cols-3" data-testid="dashboard-counts">
		<div class="rounded border border-surface-500/30 p-4">
			<h2 class="h5">Participants by stage</h2>
			<dl class="mt-2 grid grid-cols-[1fr_max-content] gap-x-4 text-sm">
				{#each Object.entries(d.byStage) as [stage, n] (stage)}<dt>{words(stage)}</dt><dd class="text-end">{n}</dd>{/each}
			</dl>
		</div>
		<div class="rounded border border-surface-500/30 p-4">
			<h2 class="h5">Participants by kind</h2>
			<dl class="mt-2 grid grid-cols-[1fr_max-content] gap-x-4 text-sm">
				{#each Object.entries(d.byCategory) as [category, n] (category)}<dt>{words(category)}</dt><dd class="text-end">{n}</dd>{/each}
			</dl>
		</div>
		<div class="rounded border border-surface-500/30 p-4">
			<h2 class="h5">Reports</h2>
			<dl class="mt-2 grid grid-cols-[1fr_max-content] gap-x-4 text-sm">
				{#each Object.entries(d.reportsByStanding) as [standing, n] (standing)}<dt>{standing}</dt><dd class="text-end">{n}</dd>{/each}
			</dl>
			<h3 class="mt-3 text-sm font-semibold">Valid, by API family</h3>
			<dl class="grid grid-cols-[1fr_max-content] gap-x-4 text-sm">
				{#each Object.entries(d.validByFamily) as [family, n] (family)}<dt>{words(family)}</dt><dd class="text-end">{n}</dd>{:else}<dt>none yet</dt><dd></dd>{/each}
			</dl>
			<h3 class="mt-3 text-sm font-semibold">Valid, by kind of participant</h3>
			<dl class="grid grid-cols-[1fr_max-content] gap-x-4 text-sm">
				{#each Object.entries(d.validByCategory) as [category, n] (category)}<dt>{words(category)}</dt><dd class="text-end">{n}</dd>{:else}<dt>none yet</dt><dd></dd>{/each}
			</dl>
		</div>
	</section>

	<section class="mt-8" data-testid="dashboard-participants">
		<h2 class="h4">Participants</h2>
		<table class="table mt-2">
			<thead><tr><th>Organisation</th><th>Kind</th><th>Stage</th><th>Valid reports</th><th>Runs, last 30 days</th><th>Last run</th><th>Open submissions</th></tr></thead>
			<tbody>
				{#each d.participants as p (p.participant_id)}
					<tr>
						<td><a class="anchor" href="/staff/participants/{p.participant_id}">{p.legal_name}</a></td>
						<td>{words(p.category)}</td>
						<td><Badge value={p.stage} /></td>
						<td>{p.valid_reports.join(', ') || 'none'}</td>
						<td>{p.runs_last_30_days ?? 'not known'}</td>
						<td>{p.last_run_at ? p.last_run_at.slice(0, 10) : p.runs_last_30_days === null ? 'not known' : 'none'}</td>
						<td>{p.open_submissions ?? 'not known'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<section class="mt-8" data-testid="dashboard-failed">
		<h2 class="h4">Tests failed most</h2>
		{#if d.mostFailed.length === 0}
			<p class="mt-2">No failed tests in the spaces you can read.</p>
		{:else}
			<table class="table mt-2">
				<thead><tr><th>Test</th><th>Participants failing it</th><th>Failures</th></tr></thead>
				<tbody>
					{#each d.mostFailed as f (f.test_id)}<tr><td><code>{f.test_id}</code></td><td>{f.participants}</td><td>{f.failures}</td></tr>{/each}
				</tbody>
			</table>
		{/if}
	</section>
	<p class="mt-6 text-sm">API calls, latency and errors across the sandbox are in OBP-API's own metrics, which the API Manager shows.</p>
{/if}
</PageRoleCheck>
</div>
