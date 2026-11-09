<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import FormQuestions from '$lib/components/FormQuestions.svelte';
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { formTitle, inLocale, optionsText, QUESTION_KINDS, questionLabel, type Question } from '$lib/forms';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const f = $derived(data.form);
	const missing = (key: keyof typeof data.lacking) => data.lacking[key];
	/** Changing questions needs the edit Role, and on a published form the Role that adds them to its dynamic entity. */
	const mayEdit = $derived(f.status !== 'closed' && !missing('edit') && (f.status === 'draft' || !missing('grow')));
	const kindLabel = (kind: string) => t(locale, `forms_kind_${kind}` as MessageKey);
	const errorText = (e: string) => {
		if (e.startsWith('removed:') || e.startsWith('retyped:')) return t(locale, 'forms_error_growth');
		const known = ['invalid', 'invalid_question', 'closed', 'no_questions'];
		return known.includes(e) ? t(locale, `forms_error_${e}` as MessageKey) : `${t(locale, 'staff_error')} ${e}`;
	};
	let addKind = $state('text');
	const summaryOf = (q: Question) => data.summary.find((s) => s.key === q.key);
</script>

{#snippet roleNeeded(key: keyof typeof data.lacking)}
	{#if missing(key)}
		<div class="mt-2"><MissingRole {locale} space={data.space} role={missing(key)!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>
	{/if}
{/snippet}

{#snippet questionFields(q: Question | null)}
	{#if !q?.published}
		<label class="label"><span class="label-text">{t(locale, 'forms_kind')}</span>
			{#if q}
				<select class="select" name="kind" value={q.kind}>{#each QUESTION_KINDS as k (k)}<option value={k}>{kindLabel(k)}</option>{/each}</select>
			{:else}
				<select class="select" name="kind" bind:value={addKind}>{#each QUESTION_KINDS as k (k)}<option value={k}>{kindLabel(k)}</option>{/each}</select>
			{/if}
		</label>
	{/if}
	<label class="label"><span class="label-text">{t(locale, 'forms_label_en')}</span><input class="input" name="label" maxlength="500" value={q?.label ?? ''} /></label>
	<label class="label"><span class="label-text">{t(locale, 'forms_label_ar')}</span><input class="input" name="label_ar" maxlength="500" dir="rtl" lang="ar" value={q?.label_ar ?? ''} /></label>
	<label class="label"><span class="label-text">{t(locale, 'forms_help_en')}</span><input class="input" name="help" maxlength="1000" value={q?.help ?? ''} /></label>
	<label class="label"><span class="label-text">{t(locale, 'forms_help_ar')}</span><input class="input" name="help_ar" maxlength="1000" dir="rtl" lang="ar" value={q?.help_ar ?? ''} /></label>
	{#if (q ? q.kind : addKind) === 'select'}
		<label class="label"><span class="label-text">{t(locale, 'forms_options')}</span>
			<textarea class="textarea" name="options" rows="4">{optionsText(q?.options)}</textarea>
			<span class="block text-sm">{t(locale, 'forms_options_hint')}</span>
		</label>
	{/if}
	<label class="flex items-center gap-2"><input class="checkbox" type="checkbox" name="required" checked={q?.required ?? false} />{t(locale, 'forms_required')}</label>
{/snippet}

<p><a class="anchor" href="/staff/forms">{t(locale, 'forms_heading')}</a></p>
<h1 class="h2">{formTitle(f, locale)}</h1>
<p class="mt-1 flex flex-wrap items-center gap-2">
	<Badge {locale} kind="status" value={f.status} />
	<span>{t(locale, f.purpose === 'survey' ? 'forms_purpose_survey' : 'forms_purpose_application')} · {t(locale, 'forms_version')} {f.version}</span>
	{#if data.target}
		<span>· <a class="anchor" href={f.purpose === 'survey' ? `/staff/programmes/${data.target.id}` : `/staff/calls/${data.target.id}`}>{data.target.name}</a></span>
	{/if}
</p>
{#if data.otherVersions.length}
	<p class="mt-1 text-sm">{t(locale, 'forms_other_versions')}:
		{#each data.otherVersions as v, i (v.id)}{i ? ', ' : ' '}<a class="anchor" href="/staff/forms/{v.id}">{t(locale, 'forms_version')} {v.version}</a> ({t(locale, `status_${v.status}` as MessageKey)}){/each}
	</p>
{/if}
{#if f.entity_name && f.status !== 'draft'}<p class="mt-1 text-sm">{t(locale, 'forms_entity')} <code>{f.entity_name}</code></p>{/if}

{#if form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{errorText(String(form.error))}</p>{/if}
{#if form?.saved}<p class="mt-4" role="status">{t(locale, 'forms_saved')}</p>{/if}
{#if form?.published}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'forms_published_notice')}</p>{/if}
{#if form?.closed}<p class="mt-4" role="status">{t(locale, 'forms_closed_notice')}</p>{/if}
{#if form?.reopened}<p class="mt-4" role="status">{t(locale, 'forms_reopened_notice')}</p>{/if}
{#if form?.newVersion}
	<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'forms_new_version_notice')} <a class="anchor" href="/staff/forms/{form.newVersion}">{t(locale, 'forms_open_new_version')}</a></p>
{/if}

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="form-status">
	{#if f.status === 'draft'}
		<p>{t(locale, 'forms_draft_text')}</p>
		{@render roleNeeded('publish')}
		{#if !missing('publish') && !missing('edit')}
			<form method="POST" action="?/publish" class="mt-2"><button class="btn preset-filled-primary-500" disabled={f.questions.length === 0} data-testid="form-publish">{t(locale, 'forms_publish')}</button></form>
		{/if}
	{:else}
		<p>{t(locale, f.status === 'published' ? 'forms_published_text' : 'forms_closed_text')}</p>
		{@render roleNeeded('edit')}
		{#if !missing('edit')}
			<div class="mt-2 flex flex-wrap gap-2">
				{#if f.status === 'published'}
					<form method="POST" action="?/close"><button class="btn btn-sm preset-tonal" data-testid="form-close">{t(locale, 'forms_close')}</button></form>
				{:else}
					<form method="POST" action="?/reopen"><button class="btn btn-sm preset-tonal" data-testid="form-reopen">{t(locale, 'forms_reopen')}</button></form>
				{/if}
				{#if !missing('create')}
					<form method="POST" action="?/newVersion"><button class="btn btn-sm preset-tonal" data-testid="form-new-version">{t(locale, 'forms_new_version')}</button></form>
				{/if}
			</div>
		{/if}
	{/if}
</section>

{#if f.status !== 'closed' && !missing('edit')}
	<details class="mt-4">
		<summary class="btn btn-sm preset-tonal cursor-pointer">{t(locale, 'forms_edit_details')}</summary>
		<form method="POST" action="?/details" class="mt-2 flex max-w-xl flex-col gap-2">
			<label class="label"><span class="label-text">{t(locale, 'forms_title_en')} *</span><input class="input" name="title" required maxlength="255" value={f.title} /></label>
			<label class="label"><span class="label-text">{t(locale, 'forms_title_ar')}</span><input class="input" name="title_ar" maxlength="255" dir="rtl" lang="ar" value={f.title_ar} /></label>
			<label class="label"><span class="label-text">{t(locale, 'forms_description_en')}</span><textarea class="textarea" name="description" rows="3" maxlength="4000">{f.description}</textarea></label>
			<label class="label"><span class="label-text">{t(locale, 'forms_description_ar')}</span><textarea class="textarea" name="description_ar" rows="3" maxlength="4000" dir="rtl" lang="ar">{f.description_ar}</textarea></label>
			<button class="btn btn-sm preset-filled self-start">{t(locale, 'staff_save')}</button>
		</form>
	</details>
{/if}

<section class="mt-6" data-testid="form-questions">
	<h2 class="h3">{t(locale, 'forms_questions')}</h2>
	{#if f.status !== 'draft' && f.status !== 'closed'}<p class="mt-1 text-sm">{t(locale, 'forms_grow_text')}</p>{@render roleNeeded('grow')}{/if}
	{#if f.status === 'draft'}{@render roleNeeded('edit')}{/if}
	{#if f.questions.length === 0}<p class="mt-2">{t(locale, 'forms_no_questions')}</p>{/if}
	<ol class="mt-2 flex flex-col gap-3">
		{#each f.questions as q, i (q.key)}
			<li class="card preset-outlined-surface-200-800 p-3" data-testid="form-question-{q.key}">
				<div class="flex flex-wrap items-baseline gap-x-2">
					<strong>{q.label || '—'}</strong>
					{#if q.label_ar}<span dir="rtl" lang="ar">{q.label_ar}</span>{/if}
					<span class="badge preset-tonal">{kindLabel(q.kind)}</span>
					{#if q.required}<span class="badge preset-tonal">{t(locale, 'forms_required')}</span>{/if}
					{#if q.hidden}<span class="badge preset-tonal-warning">{t(locale, 'forms_hidden')}</span>{/if}
					<code class="text-sm">{q.key}</code>
				</div>
				{#if q.kind === 'select'}<p class="mt-1 text-sm">{(q.options ?? []).map((o) => inLocale(locale, o.en, o.ar)).join(' · ')}</p>{/if}
				{#if mayEdit}
					<div class="mt-2 flex flex-wrap items-start gap-2">
						<form method="POST" action="?/moveQuestion"><input type="hidden" name="key" value={q.key} /><input type="hidden" name="direction" value="up" /><button class="btn btn-sm preset-tonal" disabled={i === 0}>{t(locale, 'forms_move_up')}</button></form>
						<form method="POST" action="?/moveQuestion"><input type="hidden" name="key" value={q.key} /><input type="hidden" name="direction" value="down" /><button class="btn btn-sm preset-tonal" disabled={i === f.questions.length - 1}>{t(locale, 'forms_move_down')}</button></form>
						<form method="POST" action="?/removeQuestion"><input type="hidden" name="key" value={q.key} /><button class="btn btn-sm preset-tonal" data-testid="form-remove-{q.key}">{t(locale, !q.published ? 'forms_remove' : q.hidden ? 'forms_show' : 'forms_hide')}</button></form>
						<details>
							<summary class="btn btn-sm preset-tonal cursor-pointer">{t(locale, 'staff_edit')}</summary>
							<form method="POST" action="?/updateQuestion" class="mt-2 flex max-w-xl flex-col gap-2">
								<input type="hidden" name="key" value={q.key} />
								{@render questionFields(q)}
								<button class="btn btn-sm preset-filled self-start">{t(locale, 'staff_save')}</button>
							</form>
						</details>
					</div>
				{/if}
			</li>
		{/each}
	</ol>
	{#if mayEdit}
		<details class="card preset-outlined-surface-200-800 mt-4 p-4" open={f.questions.length === 0}>
			<summary class="btn btn-sm preset-tonal cursor-pointer">{t(locale, 'forms_add_question')}</summary>
			<form method="POST" action="?/addQuestion" class="mt-2 flex max-w-xl flex-col gap-2" data-testid="form-add-question">
				{@render questionFields(null)}
				<button class="btn preset-filled self-start">{t(locale, 'forms_add')}</button>
			</form>
		</details>
	{/if}
</section>

{#if f.questions.length}
	<section class="mt-8 max-w-2xl" data-testid="form-preview">
		<h2 class="h3">{t(locale, 'forms_preview')}</h2>
		<p class="mt-1 text-sm">{t(locale, 'forms_preview_text')}</p>
		<fieldset disabled class="card preset-outlined-surface-200-800 mt-2 flex flex-col gap-4 p-4">
			<FormQuestions {locale} questions={f.questions} />
		</fieldset>
	</section>
{/if}

{#if f.status !== 'draft'}
	<section class="mt-8" data-testid="form-answers">
		<h2 class="h3">{t(locale, 'forms_answers')}</h2>
		{@render roleNeeded('answers')}
		{#if data.answersError}<p class="mt-2 preset-tonal-error rounded p-3">{data.answersError}</p>{/if}
		{#if !missing('answers') && !data.answersError}
			<p class="mt-1">
				{data.responses.length} {t(locale, 'forms_answers_submitted')}{#if data.drafts}{' '}· {data.drafts} {t(locale, 'forms_answers_drafts')}{/if}
				{#if data.responses.length}{' '}· <a class="anchor" href="/staff/forms/{f.id}/answers.csv" download data-testid="form-answers-csv">{t(locale, 'dashboard_csv')}</a> · <a class="anchor" href="/staff/forms/{f.id}/answers.pdf" download data-testid="form-answers-pdf">{t(locale, 'dashboard_pdf')}</a>{/if}
			</p>
			{#if data.responses.length}
				<ol class="mt-3 flex flex-col gap-3">
					{#each f.questions as q (q.key)}
						{@const s = summaryOf(q)}
						{#if s && (s.answered || !q.hidden)}
							<li class="card preset-outlined-surface-200-800 p-3">
								<strong>{questionLabel(q, locale)}</strong> <span class="text-sm">({s.answered} {t(locale, 'forms_answered')})</span>
								{#if 'counts' in s}
									<ul class="mt-1">{#each s.counts as c (c.label)}<li>{c.label}: {c.count}</li>{/each}</ul>
								{:else if 'average' in s}
									{#if s.average !== null}<p class="mt-1">{t(locale, 'forms_average')} {s.average} · {t(locale, 'forms_range')} {s.min}–{s.max}</p>{/if}
								{:else if 'answers' in s && s.answers.length}
									<ul class="mt-1 list-inside list-disc">{#each s.answers.slice(0, 50) as a, i (i)}<li class="whitespace-pre-line">{a}</li>{/each}</ul>
								{/if}
							</li>
						{/if}
					{/each}
				</ol>
				<div class="table-wrap mt-4">
					<table class="table">
						<thead><tr><th>{t(locale, f.purpose === 'survey' ? 'forms_startup' : 'forms_application')}</th><th>{t(locale, 'application_submitted_at')}</th></tr></thead>
						<tbody>
							{#each data.responses as r (r.subject_id)}
								<tr>
									<td>{#if f.purpose === 'application'}<a class="anchor" href="/staff/applications/{r.subject_id}">{r.startup_name || r.subject_id}</a>{:else}{r.startup_name || r.subject_id}{/if}</td>
									<td>{String(r.submitted_at ?? '').slice(0, 10)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	</section>
{/if}
