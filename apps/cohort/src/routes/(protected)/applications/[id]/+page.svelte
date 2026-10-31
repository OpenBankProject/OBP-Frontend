<script lang="ts">
	import { enhance } from '$app/forms';
	import { APPLICATION_FIELDS } from '$lib/applications';
	import FileList from '$lib/components/FileList.svelte';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const application = $derived(data.application as Record<string, unknown>);
	const submitted = $derived(!data.editable);
	const label = (key: string) => t(locale, `field_${key}` as MessageKey);
	const value = (key: string) => (application[key] ?? '') as string;
</script>

<h1 class="h2">{t(locale, 'application_heading')}</h1>
<p class="mt-1">{t(locale, 'application_call')}: {data.callTitle}</p>
<p>{t(locale, 'application_status')}: {t(locale, `status_${String(application.status)}` as MessageKey)}</p>

{#if data.outcome}
	<div class="mt-4 preset-tonal-primary rounded p-3" role="status" data-testid="application-outcome">
		<strong>{t(locale, 'screening_outcome')}: {t(locale, `decision_${data.outcome.decision}` as MessageKey)}</strong>
		{#if data.outcome.message}<p class="mt-1 whitespace-pre-line">{data.outcome.message}</p>{/if}
		{#if data.editable}<p class="mt-1">{t(locale, 'screening_reopened')}</p>{/if}
	</div>
{/if}

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
	{#if !data.outcome}<p class="mt-4 preset-tonal-success rounded p-3" data-testid="application-submitted">{t(locale, 'application_submitted_notice')}</p>{/if}
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

<section class="mt-8 max-w-2xl" data-testid="application-files">
	<h2 class="h4">{t(locale, 'files_heading')}</h2>
	{#if data.files.length > 0}
		<FileList {locale} files={data.files} />
	{:else}
		<p>{t(locale, 'files_none')}</p>
	{/if}
	{#if form?.uploaded}<p class="mt-2 preset-tonal-success rounded p-3" role="status">{t(locale, 'files_uploaded')}</p>{/if}
	{#if form?.uploadError}
		<p class="mt-2 preset-tonal-error rounded p-3" role="alert">
			{form.uploadError === 'type' ? t(locale, 'files_error_type') : form.uploadError === 'size' ? t(locale, 'files_error_size') : form.uploadError === 'empty' ? t(locale, 'files_error_empty') : `${t(locale, 'staff_error')} ${form.uploadError}`}
		</p>
	{/if}
	{#if !submitted}
		<form method="POST" action="?/upload" enctype="multipart/form-data" class="mt-4 flex flex-wrap items-center gap-3">
			<input class="input max-w-sm" type="file" name="file" accept={data.uploadAccept} required data-testid="file-input" />
			<button class="btn preset-tonal" data-testid="file-upload">{t(locale, 'files_upload')}</button>
		</form>
		<p class="mt-2 text-sm">{t(locale, 'files_hint')}</p>
	{/if}
</section>
