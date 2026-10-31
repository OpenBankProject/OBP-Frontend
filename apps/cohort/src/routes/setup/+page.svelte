<script lang="ts">
	import { t, type Locale } from '$lib/i18n';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
	const missing = $derived(data.scopes.filter((s) => s.held === false));

	function yesNo(value: boolean | null): string {
		return value === null ? t(locale, 'setup_unknown') : value ? t(locale, 'setup_yes') : t(locale, 'setup_no');
	}
</script>

<h1 class="h2">{t(locale, 'setup_heading')}</h1>

<section class="mt-6" data-testid="setup-space">
	<h2 class="h4">{t(locale, 'setup_space')}</h2>
	<dl class="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
		<dt>{t(locale, 'setup_space_id')}</dt>
		<dd><code>{data.space}</code></dd>
		<dt>{t(locale, 'setup_space_exists')}</dt>
		<dd data-testid="setup-space-exists">{yesNo(data.spaceExists)}</dd>
	</dl>
	{#if data.createBankUrl}
		<p class="mt-2">{t(locale, 'setup_bank_missing')}</p>
		<a class="btn preset-filled mt-2" href={data.createBankUrl} data-testid="setup-create-bank-link"
			>{t(locale, 'setup_create_bank')}</a
		>
	{/if}
</section>

<section class="mt-6" data-testid="setup-platform-app">
	<h2 class="h4">{t(locale, 'setup_platform_app')}</h2>
	<dl class="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
		<dt>consumer_id</dt>
		<dd data-testid="setup-consumer-id"><code>{data.consumerId ?? t(locale, 'setup_unknown')}</code></dd>
		<dt>{t(locale, 'setup_declaration')}</dt>
		<dd data-testid="setup-declaration">{data.declaration}</dd>
		<dt>{t(locale, 'setup_checked_at')}</dt>
		<dd>{data.checkedAt ?? t(locale, 'setup_not_checked')}</dd>
	</dl>
	{#if data.problem}
		<p class="mt-2 preset-tonal-warning rounded p-3" role="alert" data-testid="setup-problem">{data.problem}</p>
	{/if}
	{#if data.platformAppsUrl}
		<a class="btn preset-filled mt-4" href={data.platformAppsUrl} data-testid="setup-platform-apps-link"
			>{t(locale, 'setup_open_platform_apps')}</a
		>
	{:else}
		<p class="mt-4" data-testid="setup-no-api-manager">{t(locale, 'setup_no_api_manager')}</p>
	{/if}
</section>

<section class="mt-6" data-testid="setup-scopes">
	<h2 class="h4">{t(locale, 'setup_scopes')}</h2>
	{#if data.state === 'ok'}
		<p class="mt-2">{t(locale, 'setup_scopes_ok')}</p>
	{:else if missing.length > 0}
		<p class="mt-2">{t(locale, 'setup_scopes_missing')}</p>
	{/if}
	<table class="table mt-2">
		<thead>
			<tr>
				<th>{t(locale, 'setup_role')}</th>
				<th>bank_id</th>
				<th>{t(locale, 'setup_needed_for')}</th>
				<th>{t(locale, 'setup_held')}</th>
			</tr>
		</thead>
		<tbody>
			{#each data.scopes as scope (scope.role_name + scope.bank_id)}
				<tr data-testid="setup-scope-{scope.role_name}">
					<td><code>{scope.role_name}</code></td>
					<td><code>{scope.bank_id}</code></td>
					<td>{scope.needed_for}</td>
					<td>
						{yesNo(scope.held)}
						{#if scope.held === false && data.platformAppsUrl}
							<a class="anchor ms-2 text-sm" href={data.platformAppsUrl} data-testid="setup-grant-{scope.role_name}"
								>{t(locale, 'setup_grant')}</a
							>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<section class="mt-6" data-testid="setup-entities">
	<h2 class="h4">{t(locale, 'setup_entities')}</h2>
	<p class="mt-2 text-sm">{t(locale, 'setup_checked_at')}: {data.entitiesCheckedAt ?? t(locale, 'setup_not_checked')}</p>
	<ul class="mt-2 list-inside list-disc">
		{#each data.entities as entity (entity.name)}
			<li data-testid="setup-entity-{entity.name}"><code>{entity.name}</code>: {yesNo(entity.ok)}</li>
		{/each}
	</ul>
</section>
