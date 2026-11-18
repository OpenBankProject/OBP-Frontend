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
	import { MissingRoleAlert } from '@obp/shared/components';
	import FormProblems from '$lib/components/FormProblems.svelte';
	import SystemFields from '$lib/components/SystemFields.svelte';

	let { data, form } = $props();
	const systemForm = $derived((form as { system?: { problems: string[]; values: Record<string, string> } } | null)?.system);
	const runForm = $derived((form as { run?: { problems: string[] } } | null)?.run);
	let chosenSystem = $state('');
	const chosenRole = $derived(data.systems?.find((s) => s.conformator_system_id === chosenSystem)?.system_role ?? null);
	const suitesForSystem = $derived(data.suites.filter((s) => chosenRole === null || s.system_role === chosenRole));
	const runTones: Record<string, 'surface' | 'primary' | 'success' | 'error'> = { queued: 'surface', running: 'primary', finished: 'success', harness_error: 'error' };
</script>

<p><a class="anchor" href="/spaces">Your organisation</a></p>
<h1 class="h2 mt-2">{data.name}</h1>
<p class="mt-1"><code>{data.space}</code></p>

{#if data.submissions && data.submissions.length > 0}
	<section class="mt-8" data-testid="space-submissions">
		<h2 class="h4">Submissions</h2>
		<table class="table mt-2">
			<thead><tr><th>Submitted</th><th>System</th><th>Suite</th><th>Status</th></tr></thead>
			<tbody>
				{#each data.submissions as sub (sub.id)}
					<tr>
						<td><a class="anchor" href="/spaces/{data.space}/submissions/{sub.id}">{sub.submitted_at || 'Not known'}</a></td>
						<td>{sub.system_name}</td>
						<td>{sub.suite_name}</td>
						<td><Badge value={String(sub.status)} tone={sub.status === 'approved' ? 'success' : sub.status === 'refused' ? 'error' : 'primary'} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}

<section class="mt-8" data-testid="space-runs">
	<h2 class="h4">Runs</h2>
	{#if data.runs === null}
		<div class="mt-2"><MissingRoleAlert roles={['CanGetDynamicEntityRecord_conformator_run']} bankId={data.space} /></div>
	{:else if data.runs.length === 0}
		<p class="mt-2">No runs yet.</p>
	{:else}
		<table class="table mt-2">
			<thead><tr><th>Started</th><th>System</th><th>Suite</th><th>Status</th></tr></thead>
			<tbody>
				{#each data.runs as run (run.conformator_run_id)}
					<tr>
						<td><a class="anchor" href="/spaces/{data.space}/runs/{run.conformator_run_id}">{run.created_at || 'Not known'}</a></td>
						<td>{run.system_name}</td>
						<td>{run.suite_name}</td>
						<td><Badge value={String(run.status)} tone={runTones[String(run.status)] ?? 'surface'} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	{#if data.can.startRun && data.systems && data.systems.length > 0}
		<h3 class="h5 mt-6">Start a run</h3>
		<FormProblems problems={runForm?.problems} />
		<form method="POST" action="?/startRun" class="mt-2 grid max-w-3xl gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
			<label class="label"><span>System</span>
				<select class="select" name="system_id" bind:value={chosenSystem} required>
					<option value="" disabled>Choose a system</option>
					{#each data.systems as s (s.conformator_system_id)}<option value={s.conformator_system_id}>{s.name}</option>{/each}
				</select>
			</label>
			<label class="label"><span>Suite</span>
				<select class="select" name="suite_id" required>
					{#each suitesForSystem as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
				</select>
			</label>
			<button class="btn preset-filled" disabled={suitesForSystem.length === 0} data-testid="run-start">Start</button>
		</form>
		{#if chosenRole && suitesForSystem.length === 0}<p class="mt-2 text-sm">There is no approved suite for this kind of system yet.</p>{/if}
	{/if}
</section>

<section class="mt-8" data-testid="space-systems">
	<h2 class="h4">Systems</h2>
	{#if data.systems === null}
		<div class="mt-2"><MissingRoleAlert roles={['CanGetDynamicEntityRecord_conformator_system']} bankId={data.space} /></div>
	{:else if data.systems.length === 0}
		<p class="mt-2">No systems yet. Add the non-production system you want tested.</p>
	{:else}
		<table class="table mt-2">
			<thead><tr><th>Name</th><th>What it is</th><th>Base URL</th></tr></thead>
			<tbody>
				{#each data.systems as s (s.conformator_system_id)}
					<tr>
						<td><a class="anchor" href="/spaces/{data.space}/systems/{s.conformator_system_id}">{s.name}</a></td>
						<td>{String(s.system_role).replaceAll('_', ' ')}</td>
						<td><code class="text-sm">{s.base_url}</code></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	{#if data.can.addSystem}
		<h3 class="h5 mt-6">Add a system</h3>
		{#if form?.systemAdded}<p class="mt-2 preset-tonal-success rounded p-3" role="status">Added {form.systemAdded}.</p>{/if}
		<p class="mt-1 max-w-3xl text-sm">Give the system's address only. Secrets (client secrets, certificates, test customer logins) never go here: send them to the regulator's runner administrators.</p>
		<FormProblems problems={systemForm?.problems} />
		<form method="POST" action="?/addSystem" class="mt-2 grid max-w-3xl gap-3">
			<SystemFields values={systemForm?.values ?? {}} systemRoles={data.systemRoles} />
			<div><button class="btn preset-filled" data-testid="system-add">Add the system</button></div>
		</form>
	{/if}
</section>
