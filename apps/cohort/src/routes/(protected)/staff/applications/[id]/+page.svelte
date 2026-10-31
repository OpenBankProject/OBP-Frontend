<script lang="ts">
	import { APPLICATION_FIELDS } from '$lib/applications';
	import MissingRole from '$lib/components/MissingRole.svelte';
	import FileList from '$lib/components/FileList.svelte';
	import { DECISIONS } from '$lib/screening';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const application = $derived(data.application as Record<string, unknown>);
	const label = (key: string) => t(locale, `field_${key}` as MessageKey);
	const decisionLabel = (d: unknown) => (d ? t(locale, `decision_${String(d)}` as MessageKey) : '');
	const value = (key: string) => String(application[key] ?? '');
</script>

<p><a class="anchor" href="/staff">{t(locale, 'staff_heading')}</a></p>
<h1 class="h2">{value('startup_name') || t(locale, 'application_heading')}</h1>
<p class="mt-1">{t(locale, 'application_call')}: {data.callTitle}</p>
<p>
	{t(locale, 'application_status')}: {t(locale, `status_${value('status') || 'draft'}` as MessageKey)}
	{#if application.eligibility} · {t(locale, 'application_eligibility')}: {t(locale, `eligibility_${value('eligibility')}` as MessageKey)}{/if}
	{#if application.submitted_at} · {t(locale, 'application_submitted_at')}: {value('submitted_at')}{/if}
</p>

<dl class="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2" data-testid="staff-application-fields">
	{#each APPLICATION_FIELDS as field (field.key)}
		<dt>{label(field.key)}</dt>
		<dd class="whitespace-pre-line">
			{#if field.kind === 'checkbox'}{application[field.key] ? '✓' : '—'}{:else if field.kind === 'select' && application[field.key]}{t(locale, `stage_${value(field.key)}` as MessageKey)}{:else}{value(field.key)}{/if}
		</dd>
	{/each}
</dl>

<section class="mt-8" data-testid="staff-files">
	<h2 class="h4">{t(locale, 'files_heading')}</h2>
	{#if form?.fileStatus}<p class="mb-2 preset-tonal-success rounded p-3" role="status">{t(locale, 'files_status_saved')}</p>{/if}
	{#if form?.fileError}<p class="mb-2 preset-tonal-error rounded p-3" role="alert">{t(locale, 'staff_error')} {form.fileError}</p>{/if}
	{#if data.lackingReadFiles}
		<MissingRole {locale} space={data.space} role={data.lackingReadFiles} entitlementRequestsUrl={data.entitlementRequestsUrl} />
	{:else if data.filesError}
		<p class="preset-tonal-error rounded p-3">{data.filesError}</p>
	{:else if data.files.length === 0}
		<p>{t(locale, 'files_none')}</p>
	{:else}
		<FileList {locale} files={data.files} canSetScanStatus={data.canSetScanStatus} />
		<p class="mt-2 text-sm">{t(locale, 'files_staff_hint')}</p>
	{/if}
</section>

<section class="mt-8" data-testid="staff-decisions">
	<h2 class="h4">{t(locale, 'screening_heading')}</h2>
	{#if form?.requested}<p class="mb-2 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
	{#if data.lackingReadDecisions}
		<MissingRole {locale} space={data.space} role={data.lackingReadDecisions} entitlementRequestsUrl={data.entitlementRequestsUrl} />
	{:else if data.decisionsError}
		<p class="preset-tonal-error rounded p-3">{data.decisionsError}</p>
	{:else if data.decisions.length === 0}
		<p>{t(locale, 'screening_none')}</p>
	{:else}
		<ol class="flex flex-col gap-2">
			{#each data.decisions as d (String(d.cohort_screening_decision_id))}
				<li class="card preset-outlined-surface-200-800 p-3">
					<strong>{decisionLabel(d.decision)}</strong> · {String(d.decided_at ?? '')} · {String(d.decided_by_username ?? '')}
					{#if d.reason}<p class="mt-1 whitespace-pre-line">{t(locale, 'screening_reason')}: {String(d.reason)}</p>{/if}
					{#if d.message_to_applicant}<p class="mt-1 whitespace-pre-line">{t(locale, 'screening_message')}: {String(d.message_to_applicant)}</p>{/if}
				</li>
			{/each}
		</ol>
	{/if}

	{#if form?.decided}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'screening_saved')}</p>{/if}
	{#if form?.error}
		<p class="mt-4 preset-tonal-error rounded p-3" role="alert">
			{form.error === 'not_submitted' ? t(locale, 'screening_not_submitted') : `${t(locale, 'staff_error')} ${form.error}`}
		</p>
	{/if}

	{#if application.status === 'submitted' && data.lackingDecide}
		<div class="mt-4"><MissingRole {locale} space={data.space} role={data.lackingDecide} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>
	{:else if application.status === 'submitted'}
		<form method="POST" action="?/decide" class="mt-4 flex max-w-xl flex-col gap-2" data-testid="staff-decide">
			<fieldset class="flex flex-wrap gap-4">
				<legend class="label-text">{t(locale, 'screening_decision')}</legend>
				{#each DECISIONS as d (d)}
					<label class="flex items-center gap-2"><input class="radio" type="radio" name="decision" value={d} required />{decisionLabel(d)}</label>
				{/each}
			</fieldset>
			<label class="label"><span class="label-text">{t(locale, 'screening_reason')}</span><textarea class="textarea" name="reason" rows="3" maxlength="4000"></textarea></label>
			<label class="label"><span class="label-text">{t(locale, 'screening_message')}</span><textarea class="textarea" name="message_to_applicant" rows="3" maxlength="4000"></textarea></label>
			<button class="btn preset-filled self-start" data-testid="staff-decide-submit">{t(locale, 'screening_record')}</button>
		</form>
	{:else}
		<p class="mt-4">{t(locale, 'screening_not_submitted')}</p>
	{/if}
</section>
