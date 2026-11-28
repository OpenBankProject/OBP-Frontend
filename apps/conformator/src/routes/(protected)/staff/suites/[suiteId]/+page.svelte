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
	import { page } from '$app/state';
	import Badge from '$lib/components/Badge.svelte';
	import FormProblems from '$lib/components/FormProblems.svelte';
	import { MissingRoleAlert, OpeyChat, ResizableSplit, type OpeyChatOptions, type SuggestedQuestion } from '@obp/shared/components';
	import { FilePlus2, HelpCircle, ListChecks } from '@lucide/svelte';
	import TestList from '$lib/components/TestList.svelte';
	import { describeForm, fillForm } from '$lib/formFill';
	import { nextTestId } from '$lib/catalogue';

	let { data, form } = $props();
	const values = $derived((form as { values?: Record<string, any> } | null)?.values ?? {});

	// The definition being written, and the endpoint chosen to add a step for.
	// Starts as the definition sent back with a problem, if any; then it follows the text box.
	let definition = $state(untrack(() => String((form as { values?: Record<string, any> } | null)?.values?.definition ?? '')));
	let chosenEndpoint = $state('');
	const tags = $derived([...new Set(data.endpoints.map((e) => e.tag))]);
	let addProblem = $state('');

	// The test ID and title start filled in, so staff need only check them: the next ID with the suite's code, and the
	// summary of the first endpoint chosen. A value sent back with a problem wins; one the User types is never replaced.
	let testId = $state(untrack(() => String(values.test_id ?? nextTestId(String(data.suite.code ?? ''), data.tests.map((t) => String(t.test_id))))));
	let title = $state(untrack(() => String(values.title ?? '')));
	let titleSuggested = $state(false);
	function suggestTitle() {
		const endpoint = data.endpoints.find((e) => e.operationId === chosenEndpoint);
		if (!endpoint || (title.trim() && !titleSuggested)) return;
		title = endpoint.summary || `${endpoint.method} ${endpoint.path}`;
		titleSuggested = true;
	}

	/** Add a step for the chosen endpoint at the end of the definition, starting one when it is empty. */
	function addStep() {
		addProblem = '';
		const endpoint = data.endpoints.find((e) => e.operationId === chosenEndpoint);
		if (!endpoint) return;
		let current: { steps: unknown[] };
		try {
			current = definition.trim() ? JSON.parse(definition) : { steps: [] };
			if (!Array.isArray(current.steps)) throw new Error('no steps');
		} catch {
			addProblem = 'The definition is not valid JSON with a list of steps, so a step cannot be added to it. Fix it first.';
			return;
		}
		current.steps.push(JSON.parse(endpoint.step));
		definition = JSON.stringify(current, null, 2);
	}
	const sourceWords: Record<string, string> = {
		obp_version: 'a standard OBP implements',
		openapi_dynamic: 'an OpenAPI file loaded into OBP as dynamic endpoints',
		openapi_url: 'an OpenAPI file at an address'
	};
	const chosen = $derived(new Set<string>((values.requirement_ids as string[] | undefined) ?? []));
	const tones: Record<string, 'success' | 'warning' | 'surface'> = { approved: 'success', draft: 'warning', retired: 'surface' };
	const example = JSON.stringify(
		{
			steps: [
				{ kind: 'request', name: 'Create a consent', method: 'POST', path: '/account-access-consents', credentials: 'client', body: { permissions: ['ReadAccountsBasic'] }, save: { consent_id: 'body:/data/consent_id' }, expect: [{ status: 201 }] },
				{ kind: 'request', name: 'Read the consent', method: 'GET', path: '/account-access-consents/{{consent_id}}', credentials: 'client', expect: [{ status: 200 }, { field: '/data/status', equals: 'AwaitingAuthorisation' }] }
			]
		},
		null,
		2
	);
	// Opey, beside the page: it helps write tests and can fill in the "Add a test" form, which the User then checks and
	// submits. It is told what the page shows with each message.
	let addTestForm = $state<HTMLFormElement | null>(null);
	const suggestedQuestions: SuggestedQuestion[] = [
		{ questionString: "Write an automated test for this suite's consent creation endpoint: create a consent, then read it back and check its status.", pillTitle: 'Draft a test', icon: FilePlus2 },
		{ questionString: 'Which requirements of this suite have no test yet? Suggest a test for each.', pillTitle: 'Find gaps', icon: ListChecks },
		{ questionString: 'Explain how a test definition works: the kinds of step, saving values and the expectations.', pillTitle: 'Explain definitions', icon: HelpCircle }
	];
	const clientTools = {
		set_form_fields: async (toolInput: Record<string, any>) => {
			if (!addTestForm) throw new Error('The "Add a test" form is not on the page: the suite is not a draft, or the User may not add tests.');
			return fillForm(addTestForm, toolInput?.fields ?? {});
		}
	};
	function clientContext(): string {
		const s = data.suite;
		const lines = [
			`The User is on the page of the suite "${s.name}" (id ${page.params.suiteId}, code ${s.code}, version ${s.version}, status ${s.status}), ` +
				`which tests the ${String(s.system_role).replaceAll('_', ' ')}, ${String(s.api_family).replaceAll('_', ' ')} APIs.`,
			`Its OpenAPI document: ${s.openapi_url || 'none'}.`,
			`Its tests: ${data.tests.length ? data.tests.map((t) => `${t.test_id} (${t.title})`).join('; ') : 'none yet'}.`
		];
		if (data.endpoints.length)
			lines.push(
				`The endpoints of its source (method, path, success status, response schema pointer):`,
				...data.endpoints.map((e) => `- ${e.method} ${e.path} ${e.successStatus} ${e.schemaPointer ?? 'no schema'}`)
			);
		lines.push(addTestForm ? describeForm(addTestForm, 'Add a test') : 'There is no "Add a test" form on the page: the suite is not a draft, or the User may not add tests.');
		return lines.join('\n');
	}
	const opeyChatOptions: Partial<OpeyChatOptions> = $derived({
		baseUrl: data.opey?.baseUrl ?? '',
		displayHeader: false,
		currentlyActiveUserName: page.data.user?.username ?? '',
		suggestedQuestions,
		displayConnectionPips: true,
		// Requests that name no bank are about the catalogue's space.
		currentBankId: data.space,
		// The tool serves no generic OBP proxy, so the chat skips the new-entitlements notice, and its consent label
		// links to the Portal's consents page.
		entitlementsUrl: '',
		consentsUrl: '',
		...(page.data.portalUrl ? { consentsPageHref: `${page.data.portalUrl}/user/consents` } : {}),
		initialAssistantMessage:
			"Tell me what a test should check, and I'll draft it from the suite's endpoints and requirements and fill in the form below. You check every value before adding the test."
	});
</script>

{#snippet suitePage()}

	<p><a class="anchor" href="/staff/suites">Suites and tests</a></p>
	<h1 class="h2 mt-2">{data.suite.name}</h1>
	<p class="mt-2">
		<code>{data.suite.code}</code> version {data.suite.version}
		<Badge value={String(data.suite.status)} tone={tones[String(data.suite.status)] ?? 'surface'} />
		tests the {String(data.suite.system_role).replaceAll('_', ' ')}, {String(data.suite.api_family).replaceAll('_', ' ')} APIs
	</p>
	{#if data.suite.description}<p class="mt-4 max-w-3xl">{data.suite.description}</p>{/if}
	<p class="mt-2 text-sm">
		Endpoints from: {#if data.suite.source_kind}{sourceWords[String(data.suite.source_kind)]}{#if data.suite.obp_api_version}, <code>{data.suite.obp_api_version}</code>{/if}{#if data.suite.dynamic_endpoint_id}, dynamic endpoint set <code>{data.suite.dynamic_endpoint_id}</code>{/if}{:else}none{/if}.
		OpenAPI document: {#if data.suite.openapi_url}<a class="anchor" href={data.suite.openapi_url}>{data.suite.openapi_url}</a>{:else}none{/if}
	</p>
	{#if data.editable && data.can.updateSuite}
		<form method="POST" action="?/setOpenapi" class="mt-2 flex max-w-3xl items-end gap-2">
			<label class="label flex-1"><span>OpenAPI 3.0 or 3.1 document (JSON or YAML) the tests check responses against</span><input class="input" name="openapi_url" maxlength="500" value={data.suite.openapi_url ?? ''} /></label>
			<button class="btn btn-sm preset-tonal">Save</button>
		</form>
	{/if}
	{#if data.suite.replaces_suite_id}<p class="mt-2 text-sm">Replaces <a class="anchor" href="/staff/suites/{data.suite.replaces_suite_id}">an earlier version</a>.</p>{/if}

	{#if form?.statusChanged}<p class="mt-4 ui-tone-success rounded p-3" role="status">The suite is now {form.statusChanged}.</p>{/if}
	{#if form?.added}
		<p class="mt-4 ui-tone-success rounded p-3" role="status">Added {form.added}.</p>
		{#if form.advice?.length}
			<div class="mt-2 ui-tone-warning rounded p-3" role="status"><p>Check the order of its steps:</p><ul class="list-inside list-disc">{#each form.advice as line, i (i)}<li>{line}</li>{/each}</ul></div>
		{/if}
	{/if}

	<TestList tests={data.tests} />

	<section class="mt-8 rounded border ui-border/30 p-4" data-testid="suite-reference">
		<h2 class="h4">Reference run</h2>
		<p class="mt-1 text-sm">Run the suite against the reference, the OBP sandbox or the mock of the suite's file, before participants use it. A test that fails there is more likely wrong than the reference.</p>
		{#if data.reference.missing}
			<p class="mt-2 text-sm">{data.reference.missing}</p>
		{:else}
			<p class="mt-2 text-sm">Against <strong>{data.reference.system?.name}</strong>, <code>{data.reference.system?.base_url}</code>, in <code>{data.reference.space}</code>.</p>
			{#if data.reference.latest}
				<p class="mt-1 text-sm">Latest: <a class="anchor" href="/spaces/{data.reference.space}/runs/{data.reference.latest.id}">{data.reference.latest.status.replaceAll('_', ' ')}, {data.reference.latest.created_at.slice(0, 16).replace('T', ' ')}</a></p>
			{/if}
			{#if data.reference.canStart}
				<form method="POST" action="?/runReference" class="mt-3"><button class="btn preset-tonal" data-testid="suite-run-reference">Run against the reference</button></form>
			{:else}
				<div class="mt-3"><MissingRoleAlert roles={[data.reference.startRole]} bankId={data.reference.space ?? undefined} /></div>
			{/if}
		{/if}
	</section>

	<section class="mt-8 flex flex-wrap gap-3" data-testid="suite-actions">
		{#if data.can.updateSuite}
			{#if data.editable}
				<form method="POST" action="?/approve"><button class="btn preset-filled-primary-500" disabled={data.approvalProblems.length > 0} data-testid="suite-approve">Approve this version</button></form>
			{:else if data.suite.status === 'approved'}
				<form method="POST" action="?/retire"><button class="btn preset-tonal" data-testid="suite-retire">Retire this version</button></form>
			{/if}
		{/if}
		{#if data.can.createSuite && !data.editable}
			<form method="POST" action="?/newVersion"><button class="btn preset-tonal" data-testid="suite-new-version">Make a new version</button></form>
		{/if}
	</section>
	{#if data.editable && data.approvalProblems.length > 0}
		<div class="mt-2 text-sm"><p>Before it can be approved:</p><ul class="list-inside list-disc">{#each data.approvalProblems as p, i (i)}<li>{p}</li>{/each}</ul></div>
	{/if}
	{#if !data.can.updateSuite}<div class="mt-2"><MissingRoleAlert roles={[data.roles.updateSuite]} bankId={data.space || undefined} /></div>{/if}
	{#if !(form?.added) && !(form?.statusChanged)}<FormProblems problems={form?.problems} />{/if}

	{#if data.editable}
		<h2 class="h4 mt-8">Add a test</h2>
		{#if data.can.addTest}
			<form method="POST" action="?/addTest" class="mt-2 grid max-w-3xl gap-3" bind:this={addTestForm}>
				<div class="grid gap-3 md:grid-cols-3">
					<label class="label"><span>Test ID, such as PIS-IDEM-004</span><input class="input" name="test_id" required maxlength="64" bind:value={testId} /></label>
					<label class="label md:col-span-2"><span>Title</span><input class="input" name="title" required maxlength="255" bind:value={title} oninput={() => (titleSuggested = false)} /></label>
				</div>
				<div class="grid gap-3 md:grid-cols-3">
					<label class="label"><span>Kind</span>
						<select class="select" name="kind">
							<option value="automated" selected={values.kind === 'automated'}>Automated</option>
							<option value="evidence" selected={values.kind === 'evidence'}>Evidence review</option>
							<option value="control" selected={values.kind === 'control'}>Organisational control</option>
						</select>
					</label>
					<label class="label"><span>Severity</span>
						<select class="select" name="severity">
							{#each data.severities as s (s)}<option value={s} selected={(values.severity ?? 'high') === s}>{s}</option>{/each}
						</select>
					</label>
					<label class="flex items-center gap-2 pt-6"><input class="checkbox" type="checkbox" name="mandatory" checked={values.mandatory ?? true} /> Mandatory</label>
				</div>
				<fieldset>
					<legend class="label">Requirements it covers</legend>
					{#if data.requirements.length === 0}
						<p class="text-sm">There are no requirements yet. <a class="anchor" href="/staff/requirements">Add them first</a>.</p>
					{:else}
						<div class="mt-1 grid gap-1 md:grid-cols-2">
							{#each data.requirements as req (req.id)}
								<label class="flex items-center gap-2 text-sm"><input class="checkbox" type="checkbox" name="requirement_ids" value={req.id} checked={chosen.has(req.id)} /><code>{req.reference}</code> {req.title}</label>
							{/each}
						</div>
					{/if}
				</fieldset>
				<label class="label"><span>What a pass looks like</span><textarea class="textarea" name="expected_result" rows="2" maxlength="4000">{values.expected_result ?? ''}</textarea></label>
				<label class="label"><span>Evidence required (evidence and control tests)</span><textarea class="textarea" name="evidence_required" rows="2" maxlength="4000">{values.evidence_required ?? ''}</textarea></label>
				<label class="label"><span>Suggested fix when it fails</span><textarea class="textarea" name="suggested_fix" rows="2" maxlength="4000">{values.suggested_fix ?? ''}</textarea></label>
				{#if data.endpoints.length}
					<div class="grid gap-2 rounded border ui-border/30 p-3" data-testid="endpoint-picker">
						<span class="label">Add a step for an endpoint of the suite's source ({data.endpoints.length} endpoints)</span>
						<div class="flex flex-wrap gap-2">
							<select class="select flex-1" bind:value={chosenEndpoint} onchange={suggestTitle} aria-label="Endpoint">
								<option value="" disabled>Choose an endpoint</option>
								{#each tags as tag (tag)}
									<optgroup label={tag}>
										{#each data.endpoints.filter((e) => e.tag === tag) as e (e.operationId)}<option value={e.operationId}>{e.method} {e.path}{e.summary ? ` (${e.summary})` : ''}</option>{/each}
									</optgroup>
								{/each}
							</select>
							<button type="button" class="btn preset-tonal" onclick={addStep} disabled={!chosenEndpoint}>Add the step</button>
						</div>
						<p class="text-sm opacity-80">The step calls the endpoint as the runner's own client and expects its success status{data.endpoints.some((e) => e.schemaPointer) ? ' and response schema' : ''}. Change the credentials, the body and what to keep as the test needs; a path parameter such as {'{{accountid}}'} must be kept by an earlier step.</p>
						{#if addProblem}<p class="ui-tone-error rounded p-2 text-sm" role="alert">{addProblem}</p>{/if}
					</div>
				{:else if data.endpointsProblem}
					<p class="ui-tone-warning rounded p-2 text-sm" role="alert">{data.endpointsProblem}</p>
				{/if}
				<label class="label"><span>Definition (automated tests): the steps, as JSON</span>
					<textarea class="textarea font-mono text-sm" name="definition" rows="12" maxlength="20000" placeholder={example} bind:value={definition}></textarea>
				</label>
				<div><button class="btn preset-filled-primary-500" data-testid="test-add">Add the test</button></div>
			</form>
		{:else}
			<div class="mt-2"><MissingRoleAlert roles={[data.roles.addTest]} bankId={data.space || undefined} /></div>
		{/if}
	{/if}
{/snippet}

{#if data.opey}
	<ResizableSplit breakpoint="xl" storageKey="conformator-opey-width">
		{#snippet main()}{@render suitePage()}{/snippet}
		{#snippet side()}
			<div class="h-[36rem] w-full overflow-hidden rounded border ui-border/30 xl:sticky xl:top-4 xl:h-[calc(100vh-8rem)]">
				<OpeyChat {opeyChatOptions} userAuthenticated={!!page.data.user} {clientTools} {clientContext} />
			</div>
		{/snippet}
	</ResizableSplit>
{:else}
	{@render suitePage()}
{/if}
