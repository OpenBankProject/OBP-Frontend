<script lang="ts">
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{t(locale, 'reminders_heading')}</h1>
<p class="mt-2">{t(locale, 'reminders_intro')}</p>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="reminders">
	{#if data.lacking}
		<MissingRole {locale} space={data.space} role={data.lacking} entitlementRequestsUrl={data.entitlementRequestsUrl} />
	{:else if data.error}
		<p class="preset-tonal-error rounded p-3" role="alert">{data.error}</p>
	{:else if data.reminders.length === 0}
		<p>{t(locale, 'reminders_none')}</p>
	{:else}
		<div class="table-wrap">
			<table class="table">
				<thead><tr><th>{t(locale, 'reminders_sent')}</th><th>{t(locale, 'reminders_kind')}</th><th>{t(locale, 'programme_startup')}</th><th>{t(locale, 'reminders_about')}</th></tr></thead>
				<tbody>
					{#each data.reminders as r (r.key)}
						<tr><td>{r.sent_at.replace('T', ' ').slice(0, 16)}</td><td>{t(locale, `reminders_kind_${r.kind}` as MessageKey)}</td><td>{r.startup_name}</td><td>{r.about}</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
