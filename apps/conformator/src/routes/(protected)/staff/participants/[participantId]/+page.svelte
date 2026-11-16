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
	const ps = $derived(data.participantSpace);
	const ready = $derived(ps.exists === true && ps.entities.every((e) => e.ok === true));

	function yesNo(value: boolean | null): string {
		return value === null ? 'Not known' : value ? 'Yes' : 'No';
	}
</script>

<p><a class="anchor" href="/staff/participants">Participants</a></p>
<h1 class="h2 mt-2">{data.participant.legal_name}</h1>
<p class="mt-2">
	{String(data.participant.category).replaceAll('_', ' ')}
	{#if data.stage}<Badge value={data.stage} tone="primary" />{:else if data.can.readDecisions}<Badge value="not admitted" />{/if}
</p>

<section class="mt-8" data-testid="participant-lifecycle">
	<h2 class="h4">Lifecycle</h2>
	{#if !data.can.readDecisions}
		<div class="mt-2"><MissingRoleAlert roles={[data.roles.readDecisions]} bankId={data.space || undefined} /></div>
	{:else}
		{#if form?.decided}<p class="mt-2 preset-tonal-success rounded p-3" role="status">Recorded: {form.decided}.</p>{/if}
		{#if data.decisions && data.decisions.length > 0}
			<table class="table mt-2">
				<thead><tr><th>When</th><th>Stage</th><th>Why</th></tr></thead>
				<tbody>
					{#each data.decisions as d, i (i)}
						<tr><td>{d.decided_at || d.created_at}</td><td>{String(d.stage).replaceAll('_', ' ')}</td><td>{d.reason}</td></tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="mt-2">No decisions yet.</p>
		{/if}

		{#if data.nextStages.length > 0}
			{#if data.can.decide}
				<FormProblems problems={form?.problems} />
				<form method="POST" action="?/decide" class="mt-4 grid max-w-3xl gap-3">
					<label class="label"><span>Move to</span>
						<select class="select" name="stage">
							{#each data.nextStages as s (s)}<option value={s} selected={values.stage === s}>{s.replaceAll('_', ' ')}</option>{/each}
						</select>
					</label>
					<label class="label"><span>Why</span><textarea class="textarea" name="reason" rows="2" required maxlength="4000">{values.reason ?? ''}</textarea></label>
					<div><button class="btn preset-filled" data-testid="participant-decide">Record the decision</button></div>
				</form>
			{:else}
				<div class="mt-4"><MissingRoleAlert roles={[data.roles.decide]} bankId={data.space || undefined} /></div>
			{/if}
		{/if}
	{/if}
</section>

<section class="mt-8" data-testid="participant-space">
	<h2 class="h4">Participant's own space</h2>
	<p class="mt-1 max-w-3xl">The participant's systems, runs, results, evidence and the regulator's decisions on them are kept in a space of their own, so OBP-API keeps them apart from every other participant's.</p>
	<dl class="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
		<dt>bank_id</dt>
		<dd><code>{ps.id}</code></dd>
		<dt>Exists</dt>
		<dd data-testid="participant-space-exists">{yesNo(ps.exists)}</dd>
	</dl>
	<ul class="mt-2 list-inside list-disc text-sm">
		{#each ps.entities as e (e.name)}<li><code>{e.name}</code>: {yesNo(e.ok)}</li>{/each}
	</ul>
	{#if ps.entities.every((e) => e.ok === null) && ps.exists}
		<p class="mt-2 text-sm">Setting the space up gives you this Role there; or ask for it:</p>
		<div class="mt-2"><MissingRoleAlert roles={['CanGetDynamicEntityDefinitions']} bankId={ps.id} /></div>
	{/if}

	{#if form?.steps}
		<ol class="mt-4 list-inside list-decimal" data-testid="space-steps">
			{#each form.steps as s, i (i)}<li class={s.ok ? '' : 'text-error-500'}>{s.step}: {s.ok ? 'done' : 'failed'}{s.detail ? `. ${s.detail}` : ''}</li>{/each}
		</ol>
	{/if}
	{#if ready}<p class="mt-4"><a class="anchor" href="/spaces/{ps.id}">Open the participant's space</a></p>{/if}
	{#if !ready}
		{#if ps.exists === false && !data.can.createBank}
			<div class="mt-4"><MissingRoleAlert roles={["CanCreateBank"]} bankId={undefined} /></div>
		{:else}
			<form method="POST" action="?/setUpSpace" class="mt-4"><button class="btn preset-filled" data-testid="participant-set-up-space">Set up the space</button></form>
		{/if}
	{/if}
</section>

{#if ready}
	<section class="mt-8" data-testid="participant-members">
		<h2 class="h4">People</h2>
		<p class="mt-1 max-w-3xl">Give someone Roles at this participant's space. The organisation's people add systems, start runs, submit them and give evidence. Reviewers assess tests and decide waivers and appeals. Approvers make the final decision, and cannot also assess. Everyone needs an account on this OBP first.</p>
		{#if form?.memberSteps}
			<ol class="mt-2 list-inside list-decimal" data-testid="member-steps">
				{#each form.memberSteps as s, i (i)}<li class={s.ok ? '' : 'text-error-500'}>{s.step}: {s.ok ? 'done' : 'failed'}{s.detail ? `. ${s.detail}` : ''}</li>{/each}
			</ol>
		{/if}
		<FormProblems problems={form?.memberProblems} />
		{#if data.can.addMembers}
			<form method="POST" action="?/addMember" class="mt-2 flex max-w-3xl flex-wrap items-end gap-3">
				<label class="label flex-1"><span>Username</span><input class="input" name="username" required maxlength="100" /></label>
				<label class="label"><span>As</span>
					<select class="select" name="role_set">
						{#each data.roleSets as rs (rs.key)}<option value={rs.key}>{rs.label}</option>{/each}
					</select>
				</label>
				<button class="btn preset-filled" data-testid="member-add">Add</button>
			</form>
		{:else}
			<p class="mt-2 text-sm">Adding people needs CanCreateEntitlementAtOneBank at <code>{ps.id}</code> (whoever set the space up holds it) and the system Role CanGetAnyUser.</p>
		{/if}
	</section>
{/if}
