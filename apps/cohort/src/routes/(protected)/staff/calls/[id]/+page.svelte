<script lang="ts">
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { page } from '$app/state';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
	const call = $derived(data.call as Record<string, unknown>);
	const value = (key: string) => String(call[key] ?? '');
	const status = (s: string) => (s ? t(locale, `status_${s}` as MessageKey) : '');
</script>

<p><a class="anchor" href="/staff">{t(locale, 'staff_heading')}</a></p>
<h1 class="h2">{value('title')}</h1>
<p class="mt-1"><a class="btn btn-sm preset-tonal" href="/staff/calls/{page.params.id}/edit" data-testid="staff-edit">{t(locale, 'staff_edit')}</a></p>

<dl class="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2" data-testid="staff-call-fields">
	<dt>{t(locale, 'staff_field_programme')}</dt>
	<dd>{#if data.programme}<a class="anchor" href="/staff/programmes/{data.programme.id}">{data.programme.name}</a>{:else}{value('programme_id')}{/if}</dd>
	<dt>{t(locale, 'staff_field_status')}</dt><dd>{status(value('status'))}</dd>
	<dt>{t(locale, 'staff_field_opens_at')}</dt><dd>{value('opens_at')}</dd>
	<dt>{t(locale, 'staff_field_closes_at')}</dt><dd>{value('closes_at')}</dd>
	<dt>{t(locale, 'staff_field_description')}</dt><dd class="whitespace-pre-line">{value('description')}</dd>
</dl>
<p class="mt-2"><a class="anchor" href="/calls/{page.params.id}">{t(locale, 'staff_public_page')}</a></p>


<section class="mt-8" data-testid="staff-call-applications">
	<h2 class="h4">{t(locale, 'staff_applications')}</h2>
	{#if data.lackingApplications}
		<MissingRole {locale} space={data.space} role={data.lackingApplications} entitlementRequestsUrl={data.entitlementRequestsUrl} />
	{:else if data.applicationsError}
		<p class="preset-tonal-error rounded p-3">{data.applicationsError}</p>
	{:else if data.applications.length === 0}
		<p>{t(locale, 'staff_none')}</p>
	{:else}
		<table class="table">
			<thead>
				<tr>
					<th>{t(locale, 'staff_applicant')}</th>
					<th>{t(locale, 'application_status')}</th>
					<th>{t(locale, 'application_submitted_at')}</th>
					<th>{t(locale, 'screening_decision')}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.applications as a (a.id)}
					<tr>
						<td><a class="anchor" href="/staff/applications/{a.id}">{a.startup_name || a.id}</a></td>
						<td>{status(a.status)}</td>
						<td>{a.submitted_at}</td>
						<td>{a.decision ? t(locale, `decision_${a.decision}` as MessageKey) : ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>
