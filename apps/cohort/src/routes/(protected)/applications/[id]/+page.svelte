<script lang="ts">
	import { enhance } from '$app/forms';
	import { APPLICATION_FIELDS } from '$lib/applications';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const application = $derived(data.application as Record<string, unknown>);
	const submitted = $derived(application.status === 'submitted');
	const label = (key: string) => t(locale, `field_${key}` as MessageKey);
	const value = (key: string) => (application[key] ?? '') as string;
</script>

<h1 class="h2">{t(locale, 'application_heading')}</h1>
<p class="mt-1">{t(locale, 'application_call')}: {data.callTitle}</p>
<p>{t(locale, 'application_status')}: {t(locale, `status_${String(application.status)}` as MessageKey)}</p>

{#if form?.saved}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'application_saved')}</p>{/if}
{#if form?.missing}
	<div class="mt-4 preset-tonal-warning rounded p-3" role="alert" data-testid="application-missing">
		{t(locale, 'application_missing')}
		<ul class="list-inside list-disc">
			{#each form.missing as key (key)}<li>{label(key)}</li>{/each}
		</ul>
	</div>
{/if}

{#if submitted}
	<p class="mt-4 preset-tonal-success rounded p-3" data-testid="application-submitted">{t(locale, 'application_submitted_notice')}</p>
	<dl class="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
		{#each APPLICATION_FIELDS as field (field.key)}
			<dt>{label(field.key)}</dt>
			<dd class="whitespace-pre-line">
				{#if field.kind === 'checkbox'}{application[field.key] ? '✓' : '—'}{:else if field.kind === 'select' && application[field.key]}{t(locale, `stage_${value(field.key)}` as MessageKey)}{:else}{value(field.key)}{/if}
			</dd>
		{/each}
		<dt>{t(locale, 'application_eligibility')}</dt>
		<dd>{t(locale, `eligibility_${String(application.eligibility)}` as MessageKey)}</dd>
		<dt>{t(locale, 'application_submitted_at')}</dt>
		<dd>{value('submitted_at')}</dd>
	</dl>
{:else}
	<form method="POST" class="mt-6 flex max-w-2xl flex-col gap-4" use:enhance={() => async ({ update }) => update({ reset: false })}>
		{#each APPLICATION_FIELDS as field (field.key)}
			{#if field.kind === 'checkbox'}
				<label class="flex items-center gap-2">
					<input type="checkbox" class="checkbox" name={field.key} checked={application[field.key] === true} />
					{label(field.key)}
				</label>
			{:else}
				<label class="label">
					<span class="label-text">{label(field.key)}{field.requiredToSubmit ? ' *' : ''}</span>
					{#if field.kind === 'textarea'}
						<textarea class="textarea" name={field.key} rows="4" maxlength="4000">{value(field.key)}</textarea>
					{:else if field.kind === 'select'}
						<select class="select" name={field.key} value={value(field.key)}>
							<option value=""></option>
							{#each field.options ?? [] as option (option)}
								<option value={option}>{t(locale, `stage_${option}` as MessageKey)}</option>
							{/each}
						</select>
					{:else if field.kind === 'integer'}
						<input class="input" type="number" min="0" name={field.key} value={value(field.key)} />
					{:else}
						<input class="input" type="text" name={field.key} value={value(field.key)} maxlength="255" />
					{/if}
				</label>
			{/if}
		{/each}
		<div class="flex gap-3">
			<button type="submit" formaction="?/save" class="btn preset-tonal" data-testid="application-save">{t(locale, 'application_save')}</button>
			<button type="submit" formaction="?/submit" class="btn preset-filled" data-testid="application-submit">{t(locale, 'application_submit')}</button>
		</div>
	</form>
{/if}
