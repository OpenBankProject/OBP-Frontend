<script lang="ts">
	import { t, type Locale } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const locale = $derived(data.locale as Locale);
	const missing = $derived(data.scopes.filter((s) => s.held === false));

	function yesNo(value: boolean | null): string {
		return value === null ? t(locale, 'setup_unknown') : value ? t(locale, 'setup_yes') : t(locale, 'setup_no');
	}
</script>

<h1 class="h2">{t(locale, 'setup_heading')}</h1>
<p class="mt-2 max-w-3xl">{t(locale, 'platform_setup_intro')}</p>

{#if !data.apiManagerUrl}
	<section class="mt-6 max-w-3xl rounded-lg border-2 border-error-500 preset-tonal-error p-5" role="alert" data-testid="setup-no-api-manager">
		<h2 class="h3">{t(locale, 'platform_setup_no_manager_heading')}</h2>
		<p class="mt-2">{t(locale, 'platform_setup_no_manager_text')}</p>
		<pre class="mt-3 rounded bg-surface-50-950 p-3 text-sm"><code>public_obp_api_manager_url=https://apimanager.example.com</code></pre>
		<p class="mt-3">{t(locale, 'platform_setup_no_manager_after')}</p>
	</section>
{/if}

<section class="mt-6" data-testid="setup-platform-app">
	<h2 class="h4">{t(locale, 'setup_platform_app')}</h2>
	<dl class="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
		<dt>consumer_id</dt>
		<dd data-testid="setup-consumer-id"><code>{data.consumerId ?? t(locale, 'setup_unknown')}</code></dd>
		<dt>{t(locale, 'setup_declaration')}</dt>
		<dd data-testid="setup-declaration">{data.declaration}</dd>
		<dt>{t(locale, 'setup_checked_at')}</dt>
		<dd>{data.checkedAt ?? t(locale, 'setup_not_checked')}</dd>
		<dt>API Manager</dt>
		<dd data-testid="setup-api-manager-url">
			{#if data.apiManagerUrl}<code>{data.apiManagerUrl}</code>{:else}<strong class="text-error-600-400">{t(locale, 'platform_setup_not_set')}</strong>{/if}
		</dd>
	</dl>
	{#if data.problem}
		<p class="mt-2 preset-tonal-warning rounded p-3" role="alert" data-testid="setup-problem">{data.problem}</p>
	{/if}
	{#if data.platformAppsUrl}
		<p class="mt-4">{t(locale, 'platform_setup_mark_text')}</p>
		<a class="btn preset-filled mt-2" href={data.platformAppsUrl} data-testid="setup-platform-apps-link">{t(locale, 'setup_open_platform_apps')}</a>
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
							<a class="anchor ms-2 text-sm" href={data.platformAppsUrl} data-testid="setup-grant-{scope.role_name}">{t(locale, 'setup_grant')}</a>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<section class="mt-6" data-testid="setup-staff">
	<h2 class="h4">{t(locale, 'platform_setup_staff_heading')}</h2>
	<p class="mt-1 max-w-3xl">{t(locale, 'platform_setup_staff_text')}</p>
	<a class="btn preset-tonal mt-2" href="/staff/setup" data-testid="setup-staff-setup-link">{t(locale, 'platform_setup_staff_link')}</a>
</section>
