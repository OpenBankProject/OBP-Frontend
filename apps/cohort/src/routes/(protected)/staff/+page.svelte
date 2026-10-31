<script lang="ts">
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const statuses = ['draft', 'open', 'closed'];
	const status = (s: string) => (s ? t(locale, `status_${s}` as MessageKey) : '');
	const formError = (which: string) => (form?.form === which && form?.error ? String(form.error) : null);
</script>

<h1 class="h2">{t(locale, 'staff_heading')}</h1>

<section class="mt-6" data-testid="staff-programmes">
	<h2 class="h4">{t(locale, 'staff_programmes')}</h2>
	{#if data.errors.programmes}<p class="preset-tonal-error rounded p-3">{data.errors.programmes}</p>{/if}
	{#if data.programmes.length === 0}<p>{t(locale, 'staff_none')}</p>{:else}
		<ul class="list-inside list-disc">
			{#each data.programmes as p (p.id)}<li>{p.name} ({status(p.status)})</li>{/each}
		</ul>
	{/if}
	<details class="mt-2">
		<summary class="anchor cursor-pointer">{t(locale, 'staff_create_programme')}</summary>
		<form method="POST" action="?/createProgramme" class="mt-2 flex max-w-xl flex-col gap-2">
			<label class="label"><span class="label-text">{t(locale, 'staff_field_name')} *</span><input class="input" name="name" required maxlength="255" /></label>
			<label class="label"><span class="label-text">{t(locale, 'staff_field_description')}</span><textarea class="textarea" name="description" rows="3" maxlength="4000"></textarea></label>
			<label class="label"><span class="label-text">{t(locale, 'staff_field_status')}</span>
				<select class="select" name="status">{#each statuses as s (s)}<option value={s}>{status(s)}</option>{/each}</select></label>
			<label class="label"><span class="label-text">{t(locale, 'staff_field_starts_on')}</span><input class="input" type="date" name="starts_on" /></label>
			<label class="label"><span class="label-text">{t(locale, 'staff_field_ends_on')}</span><input class="input" type="date" name="ends_on" /></label>
			<button class="btn preset-filled self-start" data-testid="staff-create-programme">{t(locale, 'staff_create')}</button>
		</form>
	</details>
	{#if formError('programme')}<p class="mt-2 preset-tonal-error rounded p-3" role="alert">{t(locale, 'staff_error')} {formError('programme')}</p>{/if}
	{#if form?.form === 'programme' && form?.created}<p class="mt-2" role="status">{t(locale, 'staff_created')}</p>{/if}
</section>

<section class="mt-8" data-testid="staff-calls">
	<h2 class="h4">{t(locale, 'staff_calls')}</h2>
	{#if data.errors.calls}<p class="preset-tonal-error rounded p-3">{data.errors.calls}</p>{/if}
	{#if data.calls.length === 0}<p>{t(locale, 'staff_none')}</p>{:else}
		<ul class="list-inside list-disc">
			{#each data.calls as c (c.id)}<li><a class="anchor" href="/calls/{c.id}">{c.title}</a> · {c.programme} ({status(c.status)})</li>{/each}
		</ul>
	{/if}
	{#if data.programmes.length === 0}
		<p class="mt-2">{t(locale, 'staff_create_programme_first')}</p>
	{:else}
		<details class="mt-2">
			<summary class="anchor cursor-pointer">{t(locale, 'staff_create_call')}</summary>
			<form method="POST" action="?/createCall" class="mt-2 flex max-w-xl flex-col gap-2">
				<label class="label"><span class="label-text">{t(locale, 'staff_field_programme')} *</span>
					<select class="select" name="programme_id" required>{#each data.programmes as p (p.id)}<option value={p.id}>{p.name}</option>{/each}</select></label>
				<label class="label"><span class="label-text">{t(locale, 'staff_field_title')} *</span><input class="input" name="title" required maxlength="255" /></label>
				<label class="label"><span class="label-text">{t(locale, 'staff_field_description')}</span><textarea class="textarea" name="description" rows="3" maxlength="4000"></textarea></label>
				<label class="label"><span class="label-text">{t(locale, 'staff_field_status')}</span>
					<select class="select" name="status">{#each statuses as s (s)}<option value={s}>{status(s)}</option>{/each}</select></label>
				<label class="label"><span class="label-text">{t(locale, 'staff_field_opens_at')}</span><input class="input" type="date" name="opens_at" /></label>
				<label class="label"><span class="label-text">{t(locale, 'staff_field_closes_at')}</span><input class="input" type="date" name="closes_at" /></label>
				<button class="btn preset-filled self-start" data-testid="staff-create-call">{t(locale, 'staff_create')}</button>
			</form>
		</details>
	{/if}
	{#if formError('call')}<p class="mt-2 preset-tonal-error rounded p-3" role="alert">{t(locale, 'staff_error')} {formError('call')}</p>{/if}
	{#if form?.form === 'call' && form?.created}<p class="mt-2" role="status">{t(locale, 'staff_created')}</p>{/if}
</section>

<section class="mt-8" data-testid="staff-applications">
	<h2 class="h4">{t(locale, 'staff_applications')}</h2>
	{#if data.errors.applications}
		<p class="preset-tonal-error rounded p-3">{data.errors.applications}</p>
	{:else if data.applications.length === 0}
		<p>{t(locale, 'staff_none')}</p>
	{:else}
		<table class="table">
			<thead>
				<tr>
					<th>{t(locale, 'application_call')}</th>
					<th>{t(locale, 'staff_applicant')}</th>
					<th>{t(locale, 'application_status')}</th>
					<th>{t(locale, 'application_eligibility')}</th>
					<th>{t(locale, 'application_submitted_at')}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.applications as a (a.id)}
					<tr>
						<td>{a.call}</td>
						<td>{a.startup_name}</td>
						<td>{status(a.status)}</td>
						<td>{a.eligibility ? t(locale, `eligibility_${a.eligibility}` as MessageKey) : ''}</td>
						<td>{a.submitted_at}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>
