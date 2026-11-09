<script lang="ts">
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const missing = (key: keyof typeof data.lacking) => data.lacking[key];
	const behind = $derived(data.startups.filter((s) => s.behind > 0));
	const flagged = $derived(data.startups.filter((s) => s.risk !== 'none').sort((a, b) => (a.risk === b.risk ? 0 : a.risk === 'at_risk' ? -1 : 1)));
</script>

{#snippet roleNeeded(key: keyof typeof data.lacking)}
	{#if missing(key)}
		<div class="mt-2"><MissingRole {locale} space={data.space} role={missing(key)!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>
	{/if}
{/snippet}

<h1 class="h2">{t(locale, 'dashboard_staff_heading')}</h1>
<p class="mt-2">{t(locale, 'dashboard_staff_intro')}</p>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="dashboard-funnel">
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<h2 class="h4">{t(locale, 'dashboard_funnel')}</h2>
		<span class="flex gap-3 text-sm"><a class="anchor" href="/staff/dashboard/funnel.csv" download data-testid="dashboard-funnel-csv">{t(locale, 'dashboard_csv')}</a><a class="anchor" href="/staff/dashboard/funnel.pdf" download data-testid="dashboard-funnel-pdf">{t(locale, 'dashboard_pdf')}</a></span>
	</div>
	{@render roleNeeded('applications')}
	{@render roleNeeded('decisions')}
	{#if data.errors.applications}<p class="mt-2 preset-tonal-error rounded p-3">{data.errors.applications}</p>{/if}
	{#if data.funnel.length === 0}<p class="mt-2">{t(locale, 'dashboard_funnel_none')}</p>{:else}
		<div class="table-wrap mt-2">
			<table class="table">
				<thead>
					<tr>
						<th>{t(locale, 'application_call')}</th>
						<th>{t(locale, 'dashboard_started')}</th>
						<th>{t(locale, 'dashboard_submitted')}</th>
						<th>{t(locale, 'dashboard_eligible')}</th>
						<th>{t(locale, 'decision_shortlisted')}</th>
						<th>{t(locale, 'decision_accepted')}</th>
						<th>{t(locale, 'decision_waitlisted')}</th>
						<th>{t(locale, 'decision_rejected')}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.funnel as r (r.call_id)}
						<tr>
							<td><a class="anchor" href="/staff/calls/{r.call_id}/evaluation">{r.call}</a></td>
							<td>{r.started}</td><td>{r.submitted}</td><td>{r.eligible}</td><td>{r.shortlisted}</td>
							<td><strong>{r.accepted}</strong></td><td>{r.waitlisted}</td><td>{r.rejected}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="dashboard-programmes">
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<h2 class="h4">{t(locale, 'dashboard_programmes')}</h2>
		<span class="flex gap-3 text-sm"><a class="anchor" href="/staff/dashboard/startups.csv" download data-testid="dashboard-startups-csv">{t(locale, 'dashboard_csv_startups')}</a><a class="anchor" href="/staff/dashboard/startups.pdf" download data-testid="dashboard-startups-pdf">{t(locale, 'dashboard_pdf_startups')}</a></span>
	</div>
	{@render roleNeeded('participants')}
	{@render roleNeeded('reports')}
	{@render roleNeeded('reviews')}
	{@render roleNeeded('attendance')}
	{#if data.errors.participants}<p class="mt-2 preset-tonal-error rounded p-3">{data.errors.participants}</p>{/if}
	{#if data.programmes.length === 0}<p class="mt-2">{t(locale, 'dashboard_programmes_none')}</p>{:else}
		<div class="table-wrap mt-2">
			<table class="table">
				<thead>
					<tr>
						<th>{t(locale, 'participants_programme')}</th>
						<th>{t(locale, 'dashboard_startups')}</th>
						<th>{t(locale, 'participant_stage_onboarded')}</th>
						<th>{t(locale, 'participant_stage_in_programme')}</th>
						<th>{t(locale, 'participant_stage_graduated')}</th>
						<th>{t(locale, 'participants_company')}</th>
						<th>{t(locale, 'dashboard_completion')}</th>
						<th>{t(locale, 'dashboard_behind')}</th>
						<th>{t(locale, 'dashboard_flagged')}</th>
						<th>{t(locale, 'dashboard_sessions_attended')}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.programmes as r (r.programme_id)}
						<tr>
							<td><a class="anchor" href="/staff/programmes/{r.programme_id}/milestones">{r.programme}</a></td>
							<td>{r.participants}</td><td>{r.onboarded}</td><td>{r.in_programme}</td><td>{r.graduated}</td>
							<td>{r.companies_registered} / {r.participants}</td>
							<td>{r.completion === null ? '–' : `${r.completion}%`} <span class="text-sm">({r.milestones_accepted} / {r.milestones_due})</span></td>
							<td class={r.behind_startups > 0 ? 'preset-tonal-error' : ''}><strong>{r.behind_startups}</strong></td>
							<td class={r.flagged_startups > 0 ? 'preset-tonal-warning' : ''}><strong>{r.flagged_startups}</strong></td>
							<td>{r.sessions_attended}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="dashboard-flagged">
	<h2 class="h4">{t(locale, 'dashboard_flagged_list')}</h2>
	{#if flagged.length === 0}<p class="mt-2">{t(locale, 'dashboard_flagged_none')}</p>{:else}
		<ul class="mt-2 flex flex-col gap-1">
			{#each flagged as s (s.participant_id)}
				<li>
					<span class="badge {s.risk === 'at_risk' ? 'preset-tonal-error' : 'preset-tonal-warning'}">{t(locale, `risk_${s.risk}` as MessageKey)}</span>
					<strong>{s.startup_name}</strong> ({s.programme}){#if s.risk_note}: {s.risk_note}{/if}
				</li>
			{/each}
		</ul>
	{/if}
	<p class="mt-2 text-sm"><a class="anchor" href="/staff/participants">{t(locale, 'dashboard_flagged_manage')}</a></p>
</section>

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="dashboard-behind">
	<h2 class="h4">{t(locale, 'dashboard_behind_list')}</h2>
	{#if behind.length === 0}<p class="mt-2">{t(locale, 'dashboard_behind_none')}</p>{:else}
		<ul class="mt-2 list-inside list-disc">
			{#each behind as s (s.participant_id)}
				<li><strong>{s.startup_name}</strong> ({s.programme}): {s.behind} {t(locale, 'dashboard_behind_count')}, {s.milestones_accepted} / {s.milestones_total} {t(locale, 'dashboard_accepted_count')}</li>
			{/each}
		</ul>
	{/if}
</section>
