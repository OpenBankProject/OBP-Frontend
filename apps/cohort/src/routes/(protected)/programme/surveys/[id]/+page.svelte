<script lang="ts">
	import { enhance } from '$app/forms';
	import FormAnswers from '$lib/components/FormAnswers.svelte';
	import FormQuestions from '$lib/components/FormQuestions.svelte';
	import { formTitle, inLocale, questionLabel } from '$lib/forms';
	import { t, type Locale } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const f = $derived(data.form);
	const description = $derived(inLocale(locale, f.description, f.description_ar));
</script>

<p><a class="anchor" href="/programme">{t(locale, 'nav_my_programme')}</a></p>
<h1 class="h2">{formTitle(f, locale)}</h1>
<p class="mt-1">{data.participant.startup_name}</p>
{#if description}<p class="mt-2 max-w-2xl whitespace-pre-line">{description}</p>{/if}

{#if form?.saved}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'application_saved')}</p>{/if}
{#if form?.submittedNow}<p class="mt-4 preset-tonal-success rounded p-3" role="status" data-testid="survey-submitted">{t(locale, 'survey_thanks')}</p>{/if}
{#if form?.missing}
	<div class="mt-4 preset-tonal-warning rounded p-3" role="alert" data-testid="survey-missing">
		{t(locale, 'application_missing')}
		<ul class="list-inside list-disc">{#each f.questions.filter((q) => form.missing.includes(q.key)) as q (q.key)}<li>{questionLabel(q, locale)}</li>{/each}</ul>
	</div>
{/if}
{#if form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{form.error === 'closed' ? t(locale, 'survey_closed') : `${t(locale, 'staff_error')} ${form.error}`}</p>{/if}

{#if data.submitted_at}<p class="mt-4 text-sm">{t(locale, 'survey_submitted_at')} {String(data.submitted_at).slice(0, 10)}</p>{/if}

{#if data.open}
	<form method="POST" class="mt-6 flex max-w-2xl flex-col gap-4" use:enhance={() => async ({ update }) => update({ reset: false })} data-testid="survey-form">
		<FormQuestions {locale} questions={f.questions} answers={data.answers} />
		<div class="flex gap-3">
			<button type="submit" formaction="?/save&participant={data.participant.id}" class="btn preset-tonal">{t(locale, 'application_save')}</button>
			<button type="submit" formaction="?/submit&participant={data.participant.id}" class="btn preset-filled" data-testid="survey-submit">{t(locale, data.submitted_at ? 'survey_submit_again' : 'survey_submit')}</button>
		</div>
	</form>
{:else}
	<p class="mt-4">{t(locale, 'survey_closed')}</p>
	<dl class="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2"><FormAnswers {locale} questions={f.questions} answers={data.answers} /></dl>
{/if}
