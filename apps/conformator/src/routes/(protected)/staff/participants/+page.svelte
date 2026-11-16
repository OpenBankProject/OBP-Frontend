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
	import FormProblems from '$lib/components/FormProblems.svelte';
	import { MissingRoleAlert } from '@obp/shared/components';

	let { data, form } = $props();
	const values = $derived((form as { values?: Record<string, string> } | null)?.values ?? {});
</script>

<h1 class="h2">Participants</h1>

{#if !data.can.read}
	<div class="mt-4"><MissingRoleAlert roles={[data.roles.read]} bankId={data.space || undefined} /></div>
{:else if data.problem}
	<p class="mt-4 preset-tonal-error rounded p-3" role="alert">The participants could not be read: {data.problem}</p>
{:else if data.participants.length === 0}
	<p class="mt-4">No participants are registered yet.</p>
{:else}
	<table class="table mt-4" data-testid="participants">
		<thead><tr><th>Organisation</th><th>Kind</th><th>Space</th><th>Stage</th></tr></thead>
		<tbody>
			{#each data.participants as p (p.conformator_participant_id)}
				<tr>
					<td><a class="anchor" href="/staff/participants/{p.conformator_participant_id}">{p.legal_name}</a>{#if p.is_reference} <Badge value="reference" tone="primary" />{/if}</td>
					<td>{String(p.category).replaceAll('_', ' ')}</td>
					<td><code>{p.space_id}</code></td>
					<td>{#if p.stage}<Badge value={String(p.stage)} />{:else if data.can.readStages}not admitted{/if}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	{#if !data.can.readStages}<div class="mt-2"><MissingRoleAlert roles={[data.roles.readStages]} bankId={data.space || undefined} /></div>{/if}
{/if}

<h2 class="h4 mt-8">Register a participant</h2>
<p class="mt-1 max-w-3xl">Registering records the organisation. Admitting it and setting up its own space happen on its page.</p>
{#if data.can.create}
	<FormProblems problems={form?.problems} />
	<form method="POST" action="?/register" class="mt-2 grid max-w-3xl gap-3">
		<label class="label"><span>Legal name</span><input class="input" name="legal_name" required maxlength="255" value={values.legal_name ?? ''} /></label>
		<div class="grid gap-3 md:grid-cols-2">
			<label class="label"><span>Kind of organisation</span>
				<select class="select" name="category" required>
					{#each data.categories as c (c)}<option value={c} selected={values.category === c}>{c.replaceAll('_', ' ')}</option>{/each}
				</select>
			</label>
			<label class="label"><span>Space id (leave empty to make one from the name)</span><input class="input" name="space_id" maxlength="36" value={values.space_id ?? ''} placeholder="{data.space}-example-bank" /></label>
		</div>
		<label class="flex items-start gap-2 text-sm"><input class="checkbox mt-0.5" type="checkbox" name="is_reference" checked={values.is_reference === 'on'} /> <span>This is the OBP sandbox itself: the reference that suites are run against before participants use them.</span></label>
		<div><button class="btn preset-filled" data-testid="participant-register">Register</button></div>
	</form>
{:else}
	<div class="mt-2"><MissingRoleAlert roles={[data.roles.create]} bankId={data.space || undefined} /></div>
{/if}
