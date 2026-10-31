<script lang="ts">
	import CallFields from '$lib/components/CallFields.svelte';
	import MissingRole from '$lib/components/MissingRole.svelte';
	import ProgrammeFields from '$lib/components/ProgrammeFields.svelte';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const status = (s: string) => (s ? t(locale, `status_${s}` as MessageKey) : '');
	const formError = (which: string) => (form?.form === which && form?.error ? String(form.error) : null);
	/** The staff Role, when the User does not hold it; undefined when they do or it is unknown. */
	const lacking = (roleName: string) => {
		const role = data.roles[roleName];
		return role && !role.held ? role : undefined;
	};
	const PROGRAMME_ROLE = 'CanCreateDynamicEntityRecord_cohort_programme';
	const CALL_ROLE = 'CanCreateDynamicEntityRecord_cohort_call';
	const APPLICATIONS_ROLE = 'CanGetDynamicEntityRecord_cohort_application';
</script>

<h1 class="h2">{t(locale, 'staff_heading')}</h1>
<p class="mt-1"><a class="anchor" href="/staff/access" data-testid="staff-access-link">{t(locale, 'nav_access')}</a></p>
{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.form === 'role' && form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{t(locale, 'staff_error')} {form.error}</p>{/if}

<section class="mt-6" data-testid="staff-programmes">
	<h2 class="h4">{t(locale, 'staff_programmes')}</h2>
	{#if data.errors.programmes}<p class="preset-tonal-error rounded p-3">{data.errors.programmes}</p>{/if}
	{#if data.programmes.length === 0}<p>{t(locale, 'staff_none')}</p>{:else}
		<ul class="list-inside list-disc">
			{#each data.programmes as p (p.id)}<li><a class="anchor" href="/staff/programmes/{p.id}">{p.name}</a> ({status(p.status)})</li>{/each}
		</ul>
	{/if}
	{#if lacking(PROGRAMME_ROLE)}
		<div class="mt-2"><MissingRole {locale} space={data.space} role={lacking(PROGRAMME_ROLE)!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>
	{:else}
	<details class="mt-2">
		<summary class="anchor cursor-pointer">{t(locale, 'staff_create_programme')}</summary>
		<form method="POST" action="?/createProgramme" class="mt-2 flex max-w-xl flex-col gap-2">
			<ProgrammeFields {locale} />
			<button class="btn preset-filled self-start" data-testid="staff-create-programme">{t(locale, 'staff_create')}</button>
		</form>
	</details>
	{/if}
	{#if formError('programme')}<p class="mt-2 preset-tonal-error rounded p-3" role="alert">{t(locale, 'staff_error')} {formError('programme')}</p>{/if}
	{#if form?.form === 'programme' && form?.created}<p class="mt-2" role="status">{t(locale, 'staff_created')}</p>{/if}
</section>

<section class="mt-8" data-testid="staff-calls">
	<h2 class="h4">{t(locale, 'staff_calls')}</h2>
	{#if data.errors.calls}<p class="preset-tonal-error rounded p-3">{data.errors.calls}</p>{/if}
	{#if data.calls.length === 0}<p>{t(locale, 'staff_none')}</p>{:else}
		<ul class="list-inside list-disc">
			{#each data.calls as c (c.id)}<li><a class="anchor" href="/staff/calls/{c.id}">{c.title}</a> · {c.programme} ({status(c.status)})</li>{/each}
		</ul>
	{/if}
	{#if data.programmes.length === 0}
		<p class="mt-2">{t(locale, 'staff_create_programme_first')}</p>
	{:else}
		{#if lacking(CALL_ROLE)}
			<div class="mt-2"><MissingRole {locale} space={data.space} role={lacking(CALL_ROLE)!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>
		{:else}
		<details class="mt-2">
			<summary class="anchor cursor-pointer">{t(locale, 'staff_create_call')}</summary>
			<form method="POST" action="?/createCall" class="mt-2 flex max-w-xl flex-col gap-2">
				<CallFields {locale} programmes={data.programmes} />
				<button class="btn preset-filled self-start" data-testid="staff-create-call">{t(locale, 'staff_create')}</button>
			</form>
		</details>
		{/if}
	{/if}
	{#if formError('call')}<p class="mt-2 preset-tonal-error rounded p-3" role="alert">{t(locale, 'staff_error')} {formError('call')}</p>{/if}
	{#if form?.form === 'call' && form?.created}<p class="mt-2" role="status">{t(locale, 'staff_created')}</p>{/if}
</section>

<section class="mt-8" data-testid="staff-applications">
	<h2 class="h4">{t(locale, 'staff_applications')}</h2>
	{#if lacking(APPLICATIONS_ROLE)}
		<MissingRole {locale} space={data.space} role={lacking(APPLICATIONS_ROLE)!} entitlementRequestsUrl={data.entitlementRequestsUrl} />
	{:else if data.errors.applications}
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
					<th>{t(locale, 'screening_decision')}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.applications as a (a.id)}
					<tr>
						<td>{a.call}</td>
						<td><a class="anchor" href="/staff/applications/{a.id}">{a.startup_name || a.id}</a></td>
						<td>{status(a.status)}</td>
						<td>{a.eligibility ? t(locale, `eligibility_${a.eligibility}` as MessageKey) : ''}</td>
						<td>{a.submitted_at}</td>
						<td>{a.decision ? t(locale, `decision_${a.decision}` as MessageKey) : ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>
