<script lang="ts">
	import { CircleCheck, Circle } from '@lucide/svelte';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{t(locale, 'programme_heading')}</h1>

{#if form?.registered}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'programme_company_registered')}</p>{/if}
{#if form?.reported}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'programme_reported')}</p>{/if}
{#if form?.booked}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'programme_booked')}</p>{/if}
{#if form?.cancelled}<p class="mt-4" role="status">{t(locale, 'programme_cancelled')}</p>{/if}
{#if form?.error}
	<p class="mt-4 preset-tonal-error rounded p-3" role="alert">
		{['company_missing', 'not_yours', 'file_type', 'file_size', 'report_empty', 'session_closed', 'session_full'].includes(String(form.error))
			? t(locale, `programme_error_${form.error}` as MessageKey)
			: `${t(locale, 'staff_error')} ${String(form.error)}`}
	</p>
{/if}

{#if data.programmes.length === 0}
	<p class="mt-4" data-testid="programme-none">{t(locale, 'programme_none')}</p>
{/if}

{#each data.programmes as p (p.id)}
	<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="programme-{p.id}">
		<h2 class="h3">{p.programme_name || p.programme_id}</h2>
		<dl class="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
			<dt>{t(locale, 'programme_startup')}</dt><dd>{p.startup_name}</dd>
			{#if p.call_title}<dt>{t(locale, 'application_call')}</dt><dd>{p.call_title}</dd>{/if}
			<dt>{t(locale, 'programme_stage')}</dt>
			<dd>
				{t(locale, `participant_stage_${p.stage}` as MessageKey)}
				{#if p.stage === 'graduated' || p.status === 'graduated'}
					· <a class="anchor" href="/programme/certificate/{p.id}" data-testid="programme-certificate-{p.id}">{t(locale, 'certificate_download')}</a>
				{/if}
			</dd>
			<dt>{t(locale, 'programme_joined')}</dt><dd>{p.joined_at.slice(0, 10)}</dd>
			{#if p.programme_starts_on || p.programme_ends_on}
				<dt>{t(locale, 'programme_dates')}</dt><dd>{p.programme_starts_on} – {p.programme_ends_on}</dd>
			{/if}
		</dl>

		<h3 class="h4 mt-6">{t(locale, 'programme_getting_started')}</h3>
		<ol class="mt-2 flex flex-col gap-3">
			<li class="flex gap-2">
				{#if p.customer_id}<CircleCheck class="size-5 shrink-0 text-success-600-400" aria-hidden="true" />{:else}<Circle class="size-5 shrink-0" aria-hidden="true" />{/if}
				<div class="flex-1">
					<strong>{t(locale, 'programme_step_company')}</strong>
					{#if p.customer_id}
						<p class="text-sm">{t(locale, 'programme_step_company_done')}</p>
					{:else}
						<p class="text-sm">{t(locale, 'programme_step_company_intro')}</p>
						<form method="POST" action="?/company" class="mt-2 flex max-w-md flex-col gap-2" data-testid="programme-company-form">
							<input type="hidden" name="participant_id" value={p.id} />
							<label class="label"><span class="label-text">{t(locale, 'programme_company_name')} *</span><input class="input" name="legal_name" required maxlength="255" value={p.startup_name} /></label>
							<label class="label"><span class="label-text">{t(locale, 'programme_company_email')} *</span><input class="input" name="email" type="email" required maxlength="255" /></label>
							<label class="label"><span class="label-text">{t(locale, 'programme_company_phone')} *</span><input class="input" name="mobile_phone_number" required maxlength="50" /></label>
							<button class="btn preset-filled-primary-500 self-start" data-testid="programme-company-submit">{t(locale, 'programme_company_submit')}</button>
						</form>
					{/if}
				</div>
			</li>
			<li class="flex gap-2">
				<Circle class="size-5 shrink-0" aria-hidden="true" />
				<div><strong>{t(locale, 'programme_step_opey')}</strong><p class="text-sm"><a class="anchor" href="/">{t(locale, 'programme_step_opey_intro')}</a></p></div>
			</li>
		</ol>

		<h3 class="h4 mt-6">{t(locale, 'sessions_heading')}</h3>
		{#if p.sessions.length === 0}<p class="mt-2 text-sm">{t(locale, 'programme_sessions_none')}</p>{/if}
		<ul class="mt-2 flex flex-col gap-2" data-testid="programme-sessions">
			{#each p.sessions as s (s.id)}
				<li class="card preset-outlined-surface-200-800 p-3" data-testid="programme-session-{s.id}">
					<div class="flex flex-wrap items-baseline gap-x-2">
						<strong>{s.title}</strong>
						<span class="text-sm">{t(locale, `session_kind_${s.kind}` as MessageKey)} · {s.starts_at.replace('T', ' ')} · {s.duration_minutes} {t(locale, 'sessions_minutes')}</span>
					</div>
					{#if s.mentor_name || s.location}<p class="mt-1 text-sm">{s.mentor_name}{#if s.mentor_name && s.location}{' '}·{' '}{/if}{s.location}</p>{/if}
					{#if s.upcoming}
						{#if s.booking_id}
							<form method="POST" action="?/cancel" class="mt-2 flex items-center gap-2">
								<span class="badge preset-tonal-success">{t(locale, 'programme_session_booked')}</span>
								<input type="hidden" name="booking_id" value={s.booking_id} />
								<button class="btn btn-sm preset-tonal" data-testid="programme-cancel-{s.id}">{t(locale, 'programme_session_cancel')}</button>
							</form>
						{:else if s.seats_left > 0}
							<form method="POST" action="?/book" class="mt-2 flex items-center gap-2">
								<input type="hidden" name="participant_id" value={p.id} />
								<input type="hidden" name="session_id" value={s.id} />
								<button class="btn btn-sm preset-filled-primary-500" data-testid="programme-book-{s.id}">{t(locale, 'programme_session_book')}</button>
								<span class="text-sm">{s.seats_left} {t(locale, 'programme_session_seats_left')}</span>
							</form>
						{:else}
							<p class="mt-2 text-sm">{t(locale, 'programme_session_full')}</p>
						{/if}
					{:else if s.attended !== null}
						<p class="mt-2 text-sm">{t(locale, s.attended ? 'programme_session_attended' : 'programme_session_missed')}</p>
					{/if}
				</li>
			{/each}
		</ul>

		{#if p.surveys.length}
			<h3 class="h4 mt-6">{t(locale, 'programme_surveys')}</h3>
			<ul class="mt-2 flex flex-col gap-2" data-testid="programme-surveys">
				{#each p.surveys as s (s.id)}
					<li class="flex flex-wrap items-center gap-2">
						<a class="anchor" href="/programme/surveys/{s.id}?participant={p.id}">{s.title}</a>
						{#if s.submitted_at}<span class="badge preset-tonal-success">{t(locale, 'programme_survey_answered')}</span>{:else}<span class="badge preset-tonal-warning">{t(locale, 'programme_survey_to_answer')}</span>{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<h3 class="h4 mt-6">{t(locale, 'programme_step_milestones')}</h3>
		{#if p.milestones.length === 0}<p class="mt-2 text-sm">{t(locale, 'programme_milestones_none')}</p>{/if}
		<ol class="mt-2 flex flex-col gap-3" data-testid="programme-milestones">
			{#each p.milestones as m (m.id)}
				<li class="card preset-outlined-surface-200-800 p-3" data-testid="programme-milestone-{m.id}">
					<div class="flex flex-wrap items-baseline gap-x-2">
						<strong>{m.title}</strong>
						<span class="badge {m.status === 'accepted' ? 'preset-tonal-success' : m.behind ? 'preset-tonal-error' : 'preset-tonal'}">{t(locale, `milestone_status_${m.status}` as MessageKey)}{#if m.behind}{' '}· {t(locale, 'milestones_behind_one')}{/if}</span>
						{#if m.due_on}<span class="text-sm">{t(locale, 'milestones_due')} {m.due_on}</span>{/if}
					</div>
					{#if m.description}<p class="mt-1 text-sm">{m.description}</p>{/if}
					{#if m.message}<p class="mt-2 preset-tonal-warning rounded p-2 text-sm">{m.message}</p>{/if}
					{#if m.status !== 'accepted'}
						<details class="mt-2">
							<summary class="btn btn-sm preset-tonal cursor-pointer">{t(locale, m.status === 'not_started' ? 'programme_report' : 'programme_report_again')}</summary>
							<form method="POST" action="?/report" enctype="multipart/form-data" class="mt-2 flex max-w-xl flex-col gap-2">
								<input type="hidden" name="participant_id" value={p.id} />
								<input type="hidden" name="milestone_id" value={m.id} />
								<label class="label"><span class="label-text">{t(locale, 'programme_report_note')}</span><textarea class="textarea" name="note" rows="3" maxlength="4000"></textarea></label>
								<label class="label"><span class="label-text">{t(locale, 'programme_report_file')}</span><input class="input" type="file" name="file" accept={data.uploadAccept} /></label>
								<button class="btn btn-sm preset-filled-primary-500 self-start" data-testid="programme-report-{m.id}">{t(locale, 'programme_report_submit')}</button>
							</form>
						</details>
					{/if}
				</li>
			{/each}
		</ol>
	</section>
{/each}
