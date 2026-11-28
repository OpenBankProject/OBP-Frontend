<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import { MissingRoleAlert } from '@obp/shared/components';
	import FormProblems from '$lib/components/FormProblems.svelte';

	let { data, form } = $props();
	const values = $derived((form as { values?: Record<string, string> } | null)?.values ?? {});
</script>

<h1 class="h2">Requirements</h1>
<p class="mt-2 max-w-3xl">The clauses of the regulatory framework. Each test names the requirements it covers, so every result can be traced to a clause.</p>

{#if data.requirements.length === 0}
	<p class="mt-4">There are no requirements yet.</p>
{:else}
	<table class="table mt-4" data-testid="requirements">
		<thead><tr><th>Reference</th><th>Title</th><th>Source</th></tr></thead>
		<tbody>
			{#each data.requirements as req (req.conformator_requirement_id)}
				<tr>
					<td><code>{req.reference}</code></td>
					<td>{req.title}{#if req.wording}<p class="mt-1 text-sm opacity-80">{req.wording}</p>{/if}</td>
					<td>{req.source_document} {req.source_version}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<h2 class="h4 mt-8">Add a requirement</h2>
{#if form?.created}<p class="mt-2 ui-tone-success rounded p-3" role="status">Added {form.created}.</p>{/if}
{#if data.canCreate}
	<FormProblems problems={form?.problems} />
	<form method="POST" action="?/create" class="mt-2 grid max-w-3xl gap-3">
		<label class="label"><span>Reference, such as OBRF 4.2.1</span><input class="input" name="reference" required maxlength="64" value={values.reference ?? ''} /></label>
		<label class="label"><span>Title</span><input class="input" name="title" required maxlength="255" value={values.title ?? ''} /></label>
		<label class="label"><span>Wording</span><textarea class="textarea" name="wording" rows="4" maxlength="8000">{values.wording ?? ''}</textarea></label>
		<div class="grid gap-3 md:grid-cols-2">
			<label class="label"><span>Source document</span><input class="input" name="source_document" maxlength="255" value={values.source_document ?? ''} /></label>
			<label class="label"><span>Version of the source document</span><input class="input" name="source_version" maxlength="32" value={values.source_version ?? ''} /></label>
		</div>
		<div><button class="btn preset-filled-primary-500" data-testid="requirement-create">Add the requirement</button></div>
	</form>
{:else}
	<div class="mt-2"><MissingRoleAlert roles={[data.createRole]} bankId={data.space || undefined} /></div>
{/if}
