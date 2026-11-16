<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import Badge from '$lib/components/Badge.svelte';
	import FormProblems from '$lib/components/FormProblems.svelte';
	import { MissingRoleAlert } from '@obp/shared/components';
	import type { ObpApiVersion } from '$lib/server/sources';
	import { parseOpenApiText } from '@obp/shared/conformator';
	import { suggestSuite, type SuiteSourceHint } from '$lib/catalogue';

	let { data, form } = $props();
	const values = $derived((form as { values?: Record<string, string> } | null)?.values ?? {});
	// Starts as the choice sent back with a problem, if any; then it follows the radio buttons.
	let source = $state(untrack(() => (form as { values?: Record<string, string> } | null)?.values?.source ?? 'obp_version'));
	// One group of versions per standard, in the order the server gives them (OBP, UK Open Banking, Berlin Group, others).
	const versionGroups = $derived(
		data.versions.reduce<Array<{ name: string; list: ObpApiVersion[] }>>((groups, v) => {
			const last = groups.at(-1);
			if (last && last.list[0].standard === v.standard) last.list.push(v);
			else groups.push({ name: v.standardName, list: [v] });
			return groups;
		}, [])
	);
	const tones: Record<string, 'success' | 'warning' | 'surface'> = { approved: 'success', draft: 'warning', retired: 'surface' };

	// The code and name start filled in from where the endpoints come from, and follow it as the choice changes, so
	// staff can try a suite without inventing either. Once the User types in one, it is theirs and is not replaced.
	let obpVersion = $state(untrack(() => String(values.obp_api_version ?? data.versions[0]?.version ?? '')));
	let openapiUrl = $state(untrack(() => String(values.openapi_url ?? '')));
	let file = $state<{ title?: string; fileName?: string }>({});
	let codeEdited = $state(untrack(() => Boolean(values.code)));
	let nameEdited = $state(untrack(() => Boolean(values.name)));
	let code = $state(untrack(() => String(values.code ?? '')));
	let name = $state(untrack(() => String(values.name ?? '')));
	const hint = $derived.by((): SuiteSourceHint => {
		if (source === 'obp_version') {
			const v = data.versions.find((x) => x.version === obpVersion);
			return v ? { kind: 'obp_version', standard: v.standard, shortVersion: v.shortVersion, label: v.label } : { kind: '' };
		}
		if (source === 'openapi_dynamic') return { kind: 'openapi_dynamic', ...file };
		if (source === 'openapi_url') return { kind: 'openapi_url', fileName: openapiUrl };
		return { kind: '' };
	});
	$effect(() => {
		const suggested = suggestSuite(hint, data.suites.map((suite) => String(suite.code)));
		if (!untrack(() => codeEdited)) code = suggested.code;
		if (!untrack(() => nameEdited)) name = suggested.name;
	});

	/** Read the chosen file's title, so the suggestion can use it; the file name is enough when it cannot be read. */
	async function readFile(event: Event) {
		const chosen = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!chosen) return (file = {});
		let title: string | undefined;
		try {
			const info = (parseOpenApiText(await chosen.text()) as { info?: { title?: unknown } })?.info;
			title = typeof info?.title === 'string' ? info.title : undefined;
		} catch {
			// Not readable here: the server says why when the form is sent.
		}
		file = { title, fileName: chosen.name };
	}
</script>

<h1 class="h2">Suites and tests</h1>

{#if data.suites.length === 0}
	<p class="mt-4">There are no suites yet.</p>
{:else}
	<table class="table mt-4" data-testid="suites">
		<thead><tr><th>Suite</th><th>Version</th><th>Tests the</th><th>APIs</th><th>Status</th></tr></thead>
		<tbody>
			{#each data.suites as suite (suite.conformator_suite_id)}
				<tr>
					<td><a class="anchor" href="/staff/suites/{suite.conformator_suite_id}">{suite.name}</a> <code class="text-sm">{suite.code}</code></td>
					<td>{suite.version}</td>
					<td>{String(suite.system_role).replaceAll('_', ' ')}</td>
					<td>{String(suite.api_family).replaceAll('_', ' ')}</td>
					<td><Badge value={String(suite.status)} tone={tones[String(suite.status)] ?? 'surface'} /></td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<h2 class="h4 mt-8">Create a suite</h2>
<p class="mt-1 max-w-3xl">A new suite starts as a draft. Add its tests, then approve it. An approved suite never changes; a change is a new version.</p>
<p class="mt-1 max-w-3xl text-sm opacity-80">The code and name are filled in from where the endpoints come from, so you can choose a source and create the suite straight away. Change them if you like.</p>
{#if data.canCreate}
	<FormProblems problems={form?.problems} />
	<form method="POST" action="?/create" enctype="multipart/form-data" class="mt-2 grid max-w-3xl gap-3">
		<div class="grid gap-3 md:grid-cols-3">
			<label class="label"><span>Code, such as AIS-PROVIDER</span><input class="input" name="code" required maxlength="32" bind:value={code} oninput={() => (codeEdited = true)} /></label>
			<label class="label md:col-span-2"><span>Name</span><input class="input" name="name" required maxlength="255" bind:value={name} oninput={() => (nameEdited = true)} /></label>
		</div>
		<div class="grid gap-3 md:grid-cols-3">
			<label class="label"><span>Version</span><input class="input" name="version" required maxlength="32" value={values.version ?? '1.0.0'} /></label>
			<label class="label"><span>Tests the</span>
				<select class="select" name="system_role" required>
					{#each data.systemRoles as role (role)}<option value={role} selected={values.system_role === role}>{role.replaceAll('_', ' ')}</option>{/each}
				</select>
			</label>
			<label class="label"><span>APIs</span>
				<select class="select" name="api_family" required>
					{#each data.apiFamilies as family (family)}<option value={family} selected={values.api_family === family}>{family.replaceAll('_', ' ')}</option>{/each}
				</select>
			</label>
		</div>
		<label class="label"><span>Description</span><textarea class="textarea" name="description" rows="3" maxlength="4000">{values.description ?? ''}</textarea></label>
		<fieldset class="grid gap-2 rounded border border-surface-500/30 p-3">
			<legend class="px-1 font-semibold">Where its endpoints come from</legend>
			<p class="text-sm">The endpoints are offered when writing a test, and their schemas check the answers. The source can also be the reference the suite is run against before participants use it.</p>
			<label class="flex items-start gap-2"><input class="radio mt-1" type="radio" name="source" value="obp_version" bind:group={source} />
				<span><strong>A standard OBP implements</strong>, such as UK Open Banking or Berlin Group. The OBP sandbox is the reference.</span></label>
			{#if source === 'obp_version'}
				<!-- Radio buttons rather than a drop-down: the list is long, and a drop-down closes at a stray click. -->
				<div class="ms-6 grid gap-3" role="radiogroup" aria-label="API version">
					{#each versionGroups as group (group.name)}
						<div>
							<p class="text-sm font-semibold">{group.name}</p>
							<div class="mt-1 grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-x-4 gap-y-1">
								{#each group.list as v (v.version)}
									<label class="flex items-center gap-2 text-sm">
										<input class="radio" type="radio" name="obp_api_version" value={v.version} bind:group={obpVersion} />
										<span>{v.shortVersion}</span>
									</label>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
			<label class="flex items-start gap-2"><input class="radio mt-1" type="radio" name="source" value="openapi_dynamic" bind:group={source} />
				<span><strong>An OpenAPI file, loaded into OBP</strong> as dynamic endpoints, such as a national standard or a bank's own profile. OpenAPI 3.0 or 3.1, in JSON or YAML.</span></label>
			{#if source === 'openapi_dynamic'}
				{#if data.canLoad}
					<div class="ms-6 grid gap-2">
						<input class="input" type="file" name="openapi_file" accept="application/json,.json,application/yaml,.yaml,.yml" onchange={readFile} />
						<label class="flex items-center gap-2 text-sm"><input class="checkbox" type="checkbox" name="mock" checked /> Answer with the file's examples, so the sandbox has a mock of it to run the suite against</label>
					</div>
				{:else}
					<div class="ms-6"><MissingRoleAlert roles={data.loadRoles} bankId={data.space} /></div>
				{/if}
			{/if}
			<label class="flex items-start gap-2"><input class="radio mt-1" type="radio" name="source" value="openapi_url" bind:group={source} />
				<span><strong>An OpenAPI file at an address</strong>, read as it is. OpenAPI 3.0 or 3.1, in JSON or YAML. Pin the address to a release, so the suite does not change when the publisher updates the file.</span></label>
			{#if source === 'openapi_url'}
				<input class="input ms-6" name="openapi_url" maxlength="500" placeholder="https://regulator.example/open-banking/ais-1.0.json" bind:value={openapiUrl} />
			{/if}
			<label class="flex items-start gap-2"><input class="radio mt-1" type="radio" name="source" value="" bind:group={source} /><span>None: the steps are written by hand.</span></label>
		</fieldset>
		<div><button class="btn preset-filled" data-testid="suite-create">Create the suite</button></div>
	</form>
{:else}
	<div class="mt-2"><MissingRoleAlert roles={[data.createRole]} bankId={data.space || undefined} /></div>
{/if}
