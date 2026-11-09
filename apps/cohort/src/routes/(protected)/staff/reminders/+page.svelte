<script lang="ts">
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { EMAIL_SWITCHES } from '$lib/emailSettings';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{t(locale, 'reminders_heading')}</h1>
<p class="mt-2">{t(locale, 'reminders_intro')}</p>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}

{#if form?.form === 'emails' && form?.saved}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'emails_saved')}</p>{/if}
{#if form?.form === 'emails' && form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{String(form.error) === 'email_days_invalid' ? t(locale, 'email_days_invalid') : `${t(locale, 'staff_error')} ${String(form.error)}`}</p>{/if}

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="email-settings">
	<h2 class="h4">{t(locale, 'emails_heading')}</h2>
	<p class="mt-1 text-sm">{t(locale, 'emails_intro')}</p>
	{#if data.lackingSettings}<div class="mt-2"><MissingRole {locale} space={data.space} role={data.lackingSettings} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>{/if}
	<form method="POST" action="?/emails" class="mt-3 flex flex-col gap-2">
		{#each EMAIL_SWITCHES as k (k)}
			<label class="flex items-center gap-2"><input class="checkbox" type="checkbox" name={k} checked={data.settings[k]} disabled={!!data.lackingSettings} />{t(locale, `emails_${k}` as MessageKey)}</label>
		{/each}
		<label class="label max-w-sm"><span class="label-text">{t(locale, 'emails_due_soon_days')}</span><input class="input" type="number" min="0" max="90" name="due_soon_days" value={data.settings.due_soon_days} disabled={!!data.lackingSettings} /></label>
		<label class="label max-w-sm"><span class="label-text">{t(locale, 'emails_closing_soon_days')}</span><input class="input" type="number" min="0" max="90" name="closing_soon_days" value={data.settings.closing_soon_days} disabled={!!data.lackingSettings} /></label>
		{#if !data.lackingSettings}<button class="btn preset-filled-primary-500 self-start" data-testid="email-settings-save">{t(locale, 'emails_save')}</button>{/if}
	</form>
</section>

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
