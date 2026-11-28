<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	let { data, form } = $props();

	const missingScopes = $derived(data.scopes.filter((s) => s.held === false));
	const missingRoles = $derived(data.roles.filter((r) => !r.held));

	function yesNo(value: boolean | null): string {
		return value === null ? 'Not known' : value ? 'Yes' : 'No';
	}
</script>

<h1 class="h2">Setup</h1>
<p class="mt-2 max-w-3xl">What Conformator needs before it can be used. An administrator does most of it in the API Manager; each missing piece links to the page that fixes it.</p>

{#if !data.apiManagerUrl}
	<section class="mt-6 max-w-3xl rounded-lg border-2 ui-tone-error p-5" role="alert" data-testid="setup-no-api-manager">
		<h2 class="h4">The API Manager's address is not known</h2>
		<p class="mt-2">OBP-API's app directory has no entry for the API Manager, so this page cannot link to it. An administrator sets it as a webui_prop:</p>
		<pre class="mt-3 rounded ui-card p-3 text-sm"><code>public_obp_api_manager_url=https://apimanager.example.com</code></pre>
	</section>
{/if}

<section id="space" class="mt-6 scroll-mt-4" data-testid="setup-space">
	<h2 class="h4">1. Central space</h2>
	<dl class="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
		<dt>bank_id</dt>
		<dd><code>{data.space}</code></dd>
		<dt>Exists</dt>
		<dd data-testid="setup-space-exists">{yesNo(data.spaceExists)}</dd>
	</dl>
	{#if data.createBankUrl}
		<p class="mt-2">The bank for the central space does not exist yet.</p>
		<a class="btn preset-filled-primary-500 mt-2" href={data.createBankUrl} data-testid="setup-create-bank-link">Create it in the API Manager</a>
	{/if}
</section>

<section id="platform-app" class="mt-8 scroll-mt-4" data-testid="setup-platform-app">
	<h2 class="h4">2. Conformator as a Platform App</h2>
	<dl class="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
		<dt>consumer_id</dt>
		<dd data-testid="setup-consumer-id"><code>{data.consumerId ?? 'Not known'}</code></dd>
		<dt>Declaration</dt>
		<dd data-testid="setup-declaration">{data.declaration}</dd>
		<dt>Last checked</dt>
		<dd>{data.checkedAt ?? 'Not checked yet'}</dd>
	</dl>
	{#if data.problem}<p class="mt-2 ui-tone-warning rounded p-3" role="alert" data-testid="setup-problem">{data.problem}</p>{/if}
	{#if data.state === 'ok'}
		<p class="mt-2">Its Consumer holds every Scope it needs.</p>
	{:else if missingScopes.length > 0}
		<p class="mt-2">Mark its Consumer as a Platform App in the API Manager, then grant the Scopes it is missing there.</p>
	{/if}
	<table class="table mt-2">
		<thead><tr><th>Scope</th><th>bank_id</th><th>Needed for</th><th>Held</th></tr></thead>
		<tbody>
			{#each data.scopes as scope (scope.role_name + scope.bank_id)}
				<tr data-testid="setup-scope-{scope.role_name}">
					<td><code>{scope.role_name}</code></td>
					<td><code>{scope.bank_id}</code></td>
					<td>{scope.needed_for}</td>
					<td>
						{yesNo(scope.held)}
						{#if scope.held !== true && data.platformAppsUrl}<a class="anchor ms-2 text-sm" href={data.platformAppsUrl} data-testid="setup-grant-{scope.role_name}">Grant in the API Manager</a>{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	{#if data.platformAppsUrl}<a class="btn preset-tonal mt-3" href={data.platformAppsUrl} data-testid="setup-platform-apps-link">Open Platform Apps in the API Manager</a>{/if}
	{#if data.excessScopes && data.excessScopes.length > 0}
		<p class="mt-3 text-sm">It also holds Scopes it no longer asks for, which can be removed there:
			{#each data.excessScopes as scope, i (scope.role_name + scope.bank_id)}{i ? ', ' : ''}<code>{scope.role_name}</code> at <code>{scope.bank_id || 'system level'}</code>{/each}.
		</p>
	{/if}
</section>

<section id="runner" class="mt-8 scroll-mt-4" data-testid="setup-runner">
	<h2 class="h4">3. The runner as a Platform App</h2>
	{#if data.runner.consumerId}
		<p class="mt-2">The runner's consumer_id is <code>{data.runner.consumerId}</code>. Mark it as a Platform App and grant it this Scope in the central space. Setting up each participant's space gives it the Scopes it needs there.</p>
		<table class="table mt-2">
			<thead><tr><th>Scope</th><th>bank_id</th><th>Needed for</th></tr></thead>
			<tbody>
				{#each data.runner.scopes as scope (scope.role_name)}
					<tr><td><code>{scope.role_name}</code></td><td><code>{scope.bank_id}</code></td><td>{scope.needed_for}</td></tr>
				{/each}
			</tbody>
		</table>
		{#if data.runner.platformAppsUrl}<a class="btn preset-tonal mt-3" href={data.runner.platformAppsUrl} data-testid="setup-runner-platform-apps-link">Open the runner in Platform Apps</a>{/if}
	{:else}
		<p class="mt-2 ui-tone-warning rounded p-3" role="alert">CONFORMATOR_RUNNER_CONSUMER_ID is not set in this app's settings. The runner writes its consumer_id to its log when it starts; set it here, then restart this app.</p>
	{/if}
</section>

<section id="signing" class="mt-8 scroll-mt-4" data-testid="setup-signing">
	<h2 class="h4">4. Report signing key</h2>
	{#if data.signing.ready}
		<p class="mt-2">Reports are signed with key <code>{data.signing.keyId}</code>. Its public key is at <a class="anchor" href="/reports/signing-key">/reports/signing-key</a>.</p>
	{:else}
		<div class="mt-2 ui-tone-warning rounded p-3 max-w-3xl" role="alert">
			<p>{data.signing.problem}</p>
			<p class="mt-2">Conformator signs each report, so anyone can check that it came from you and has not been changed. To set up the key:</p>
			<ol class="mt-2 list-decimal pl-6 space-y-1">
				<li>On the machine this app runs on, make the key: <code>openssl genpkey -algorithm ed25519 -out report-signing.pem</code></li>
				<li>Keep the file secret. Do not put it in a repository or send it to anyone, because whoever has it can sign reports as you.</li>
				<li>Keep a backup. Reports you have issued can only be checked with this key, so do not replace it.</li>
				<li>In this app's settings, set <code>REPORT_SIGNING_KEY_FILE</code> to the file's full path, such as <code>/etc/conformator/report-signing.pem</code>.</li>
				<li>Restart this app. This section then shows the key.</li>
			</ol>
		</div>
	{/if}
</section>

<section id="roles" class="mt-8 scroll-mt-4" data-testid="setup-roles">
	<h2 class="h4">5. Your staff Roles</h2>
	{#if form?.error}<p class="mt-2 ui-tone-error rounded p-3" role="alert">{form.error}</p>{/if}
	{#if form?.requested}<p class="mt-2 ui-tone-success rounded p-3" role="status">Your request for {form.requested} is waiting for an administrator.</p>{/if}
	{#if missingRoles.length === 0}
		<p class="mt-2">You hold every staff Role.</p>
	{:else}
		<p class="mt-2 max-w-3xl">
			An administrator grants these to you in the API Manager: each link opens its Grant Role page with your username, the Role and the bank filled in.
			Or ask for a Role here, and an administrator accepts the request{#if data.entitlementRequestsUrl} on <a class="anchor" href={data.entitlementRequestsUrl}>the API Manager's requests page</a>{/if}.
		</p>
	{/if}
	<table class="table mt-2">
		<thead><tr><th>Role</th><th>Where</th><th>Needed for</th><th>Held</th></tr></thead>
		<tbody>
			{#each data.roles as role (role.role_name)}
				<tr data-testid="setup-role-{role.role_name}">
					<td><code>{role.role_name}</code></td>
					<td>{#if role.bank_id}<code>{role.bank_id}</code>{:else}system level{/if}</td>
					<td>{role.purpose}</td>
					<td>
						{#if role.held}
							Yes
						{:else}
							<div class="flex flex-wrap items-center gap-2">
								{#if role.grantUrl}<a class="anchor text-sm" href={role.grantUrl} data-testid="setup-grant-role-{role.role_name}">Grant in the API Manager</a>{/if}
								{#if role.requested}
									<span class="text-sm">Requested</span>
								{:else}
									<form method="POST" action="?/request">
										<input type="hidden" name="role_name" value={role.role_name} />
										<button class="btn btn-sm preset-tonal">Ask for it</button>
									</form>
								{/if}
							</div>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<section id="entities" class="mt-8 scroll-mt-4" data-testid="setup-entities">
	<h2 class="h4">6. Dynamic entities in the central space</h2>
	<p class="mt-2 text-sm">The app creates these itself once it holds its Scopes. Last checked: {data.entitiesCheckedAt ?? 'not checked yet'}.</p>
	<ul class="mt-2 list-inside list-disc">
		{#each data.entities as entity (entity.name)}
			<li data-testid="setup-entity-{entity.name}"><code>{entity.name}</code>: {yesNo(entity.ok)}</li>
		{/each}
	</ul>
	<p class="mt-2 text-sm">Each participant's own dynamic entities are set up from the participant's page.</p>
	<h3 class="h5 mt-4">Audit chains</h3>
	<p class="mt-2 text-sm">Once the entities exist, the app starts an audit chain on each entity that records a decision. Every change to those records then adds an entry to a hash chain in OBP-API, so a decision changed afterwards shows up when the chains are checked. This needs the Scope CanCreateDynamicEntityAuditChain above. A chain cannot be stopped, and its entity can no longer be deleted or renamed.</p>
	<ul class="mt-2 list-inside list-disc">
		{#each data.auditChains as chain (chain.name)}
			<li data-testid="setup-audit-chain-{chain.name}"><code>{chain.name}</code>: {yesNo(chain.ok)}</li>
		{/each}
	</ul>
	<p class="mt-2 text-sm">Each participant's space gets its own chains when it is set up from the participant's page. Staff check every chain on <a class="anchor" href="/staff/audit">Audit chains</a>.</p>
</section>
