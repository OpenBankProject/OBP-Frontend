<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { formTitle } from '$lib/forms';
	import { t, type Locale } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	let purpose = $state('application');
</script>

<h1 class="h2">{t(locale, 'forms_heading')}</h1>
<p class="mt-1 max-w-3xl">{t(locale, 'forms_intro')}</p>

{#if form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}
	<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{form.error === 'invalid' ? t(locale, 'forms_error_invalid') : `${t(locale, 'staff_error')} ${form.error}`}</p>
{/if}

<section class="card preset-outlined-surface-200-800 mt-6 p-4">
	{#if data.lackingCreate}
		<MissingRole {locale} space={data.space} role={data.lackingCreate} entitlementRequestsUrl={data.entitlementRequestsUrl} />
	{:else}
		<details>
			<summary class="btn btn-sm preset-tonal cursor-pointer">{t(locale, 'forms_new')}</summary>
			<form method="POST" action="?/create" class="mt-2 flex max-w-xl flex-col gap-2" data-testid="forms-new">
				<fieldset class="flex flex-wrap gap-4">
					<legend class="label-text">{t(locale, 'forms_purpose')}</legend>
					<label class="flex items-center gap-2"><input class="radio" type="radio" name="purpose" value="application" bind:group={purpose} />{t(locale, 'forms_purpose_application')}</label>
					<label class="flex items-center gap-2"><input class="radio" type="radio" name="purpose" value="survey" bind:group={purpose} />{t(locale, 'forms_purpose_survey')}</label>
				</fieldset>
				{#if purpose === 'survey'}
					<label class="label"><span class="label-text">{t(locale, 'staff_field_programme')} *</span>
						<select class="select" name="programme_id" required>{#each data.programmes as p (p.id)}<option value={p.id}>{p.name}</option>{/each}</select>
					</label>
				{:else}
					<label class="label"><span class="label-text">{t(locale, 'forms_call')} *</span>
						<select class="select" name="call_id" required>{#each data.calls as c (c.id)}<option value={c.id}>{c.title}</option>{/each}</select>
					</label>
				{/if}
				<label class="label"><span class="label-text">{t(locale, 'forms_title_en')} *</span><input class="input" name="title" required maxlength="255" /></label>
				<label class="label"><span class="label-text">{t(locale, 'forms_title_ar')}</span><input class="input" name="title_ar" maxlength="255" dir="rtl" lang="ar" /></label>
				<button class="btn preset-filled self-start">{t(locale, 'staff_create')}</button>
			</form>
		</details>
	{/if}
</section>

{#if data.error}<p class="mt-4 preset-tonal-error rounded p-3">{data.error}</p>{/if}
{#if data.forms.length === 0}
	<p class="mt-6">{t(locale, 'forms_none')}</p>
{:else}
	<div class="table-wrap mt-6">
		<table class="table" data-testid="forms-list">
			<thead><tr><th>{t(locale, 'forms_title')}</th><th>{t(locale, 'forms_purpose')}</th><th>{t(locale, 'forms_for')}</th><th>{t(locale, 'forms_version')}</th><th>{t(locale, 'staff_field_status')}</th><th>{t(locale, 'forms_questions')}</th></tr></thead>
			<tbody>
				{#each data.forms as f (f.id)}
					<tr>
						<td><a class="anchor" href="/staff/forms/{f.id}">{formTitle(f, locale)}</a></td>
						<td>{t(locale, f.purpose === 'survey' ? 'forms_purpose_survey' : 'forms_purpose_application')}</td>
						<td>{f.target}</td>
						<td>{f.version}</td>
						<td><Badge {locale} kind="status" value={f.status} /></td>
						<td>{f.questions.filter((q) => !q.hidden).length}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
