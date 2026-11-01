<script lang="ts">
	import { t, type Locale } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{t(locale, 'details_heading')}</h1>
<p class="mt-2">{t(locale, 'details_intro')} <strong>{data.callTitle}</strong>.</p>

{#if form?.missing}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{t(locale, 'details_missing')}</p>{/if}
{#if form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{t(locale, 'staff_error')} {form.error}</p>{/if}

<form method="POST" class="card preset-outlined-surface-200-800 mt-6 flex max-w-xl flex-col gap-3 p-4" data-testid="details-form">
	<label class="label">
		<span class="label-text">{t(locale, 'details_legal_name')} *</span>
		<input class="input" name="legal_name" required maxlength="255" autocomplete="name" value={form?.legal_name ?? ''} />
	</label>
	<label class="label">
		<span class="label-text">{t(locale, 'details_mobile')} *</span>
		<input class="input" name="mobile_phone_number" type="tel" required maxlength="50" autocomplete="tel" value={form?.mobile_phone_number ?? ''} />
	</label>
	<label class="label">
		<span class="label-text">{t(locale, 'details_email')} *</span>
		<input class="input" name="email" type="email" required maxlength="254" autocomplete="email" value={form?.email ?? data.email} />
	</label>
	<p class="text-sm text-surface-700-300">{t(locale, 'details_why')}</p>
	<button class="btn preset-filled-primary-500 self-start" data-testid="details-continue">{t(locale, 'details_continue')}</button>
</form>
