<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { EVALUATION_DECISIONS } from '$lib/screening';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const missing = (key: keyof typeof data.lacking) => data.lacking[key];
	const statusLabel = (s: string) => t(locale, `review_status_${s}` as MessageKey);
</script>

{#snippet roleNeeded(key: keyof typeof data.lacking)}
	{#if missing(key)}
		<div class="mt-2"><MissingRole {locale} space={data.space} role={missing(key)!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>
	{/if}
{/snippet}

<p><a class="anchor" href="/staff/calls/{data.call.id}">{data.call.title}</a></p>
<h1 class="h2">{t(locale, 'eval_heading')}</h1>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}
	<p class="mt-4 preset-tonal-error rounded p-3" role="alert">
		{#if ['invalid', 'reviewer', 'already_assigned'].includes(String(form.error))}{t(locale, `eval_error_${form.error}` as MessageKey)}{:else}{t(locale, 'staff_error')} {String(form.error)}{/if}
	</p>
{/if}
{#if form?.form === 'criterion' && form?.added}<p class="mt-4" role="status">{t(locale, 'eval_criterion_added')}</p>{/if}
{#if form?.form === 'assign' && form?.assigned}<p class="mt-4" role="status">{t(locale, 'eval_assigned')}</p>{/if}
{#if form?.form === 'decide' && form?.decided}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'eval_decided')}{#if form.onboarded}{' '}{t(locale, 'eval_onboarded')}{/if}</p>{/if}
{#if form?.form === 'decide' && form?.onboarded === false}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{t(locale, 'eval_onboard_failed')} {String(form.onboardError ?? '')}</p>{/if}

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="eval-rubric">
	<h2 class="h4">{t(locale, 'eval_rubric')}</h2>
	{#if data.rubric.length === 0}<p class="mt-2">{t(locale, 'eval_rubric_none')}</p>{:else}
		<div class="table-wrap mt-2">
			<table class="table">
				<thead><tr><th>{t(locale, 'eval_criterion')}</th><th>{t(locale, 'eval_max_score')}</th><th>{t(locale, 'eval_weight')}</th></tr></thead>
				<tbody>
					{#each data.rubric as c (c.id)}
						<tr><td><strong>{c.name}</strong>{#if c.description}<br /><span class="text-sm">{c.description}</span>{/if}</td><td>{c.max_score}</td><td>{c.weight}</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	{#if missing('rubric')}{@render roleNeeded('rubric')}{:else}
		<details class="mt-3">
			<summary class="btn btn-sm preset-tonal cursor-pointer">{t(locale, 'eval_add_criterion')}</summary>
			<form method="POST" action="?/addCriterion" class="mt-2 flex max-w-xl flex-col gap-2">
				<label class="label"><span class="label-text">{t(locale, 'eval_criterion')} *</span><input class="input" name="name" required maxlength="255" /></label>
				<label class="label"><span class="label-text">{t(locale, 'staff_field_description')}</span><textarea class="textarea" name="description" rows="2" maxlength="2000"></textarea></label>
				<div class="flex gap-3">
					<label class="label"><span class="label-text">{t(locale, 'eval_max_score')} *</span><input class="input w-24" name="max_score" type="number" min="1" max="100" value="5" required /></label>
					<label class="label"><span class="label-text">{t(locale, 'eval_weight')}</span><input class="input w-24" name="weight" type="number" min="1" max="10" value="1" /></label>
				</div>
				<button class="btn preset-filled self-start" data-testid="eval-add-criterion">{t(locale, 'staff_create')}</button>
			</form>
		</details>
	{/if}
</section>

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="eval-ranking">
	<h2 class="h4">{t(locale, 'eval_ranking')}</h2>
	<p class="mt-1 text-sm">{t(locale, 'eval_ranking_intro')}</p>
	{@render roleNeeded('applications')}
	{@render roleNeeded('assignments')}
	{@render roleNeeded('reviews')}
	{#if data.errors.applications}<p class="mt-2 preset-tonal-error rounded p-3">{data.errors.applications}</p>{/if}
	{#if data.rows.length === 0}<p class="mt-2">{t(locale, 'eval_none_submitted')}</p>{:else}
		<div class="table-wrap mt-2">
			<table class="table">
				<thead>
					<tr><th>{t(locale, 'eval_rank')}</th><th>{t(locale, 'staff_applicant')}</th><th>{t(locale, 'eval_average')}</th><th>{t(locale, 'eval_reviewers')}</th><th>{t(locale, 'eval_assign')}</th><th>{t(locale, 'eval_decision')}</th></tr>
				</thead>
				<tbody>
					{#each data.rows as row (row.id)}
						<tr>
							<td>{row.rank ?? '–'}</td>
							<td><a class="anchor" href="/staff/applications/{row.id}">{row.startup_name || row.id}</a></td>
							<td>{row.average ?? '–'}</td>
							<td>
								{#if row.reviewers.length === 0}<span class="text-sm">{t(locale, 'eval_no_reviewers')}</span>{/if}
								<ul class="text-sm">
									{#each row.reviewers as r, i (i)}
										<li>{r.name}: {statusLabel(r.status)}{#if r.score !== null}{' '}({r.score}){/if}{#if r.due_on && r.status === 'to_do'}{' '}· {t(locale, 'eval_due')} {r.due_on}{/if}</li>
									{/each}
								</ul>
							</td>
							<td>
								{#if missing('assign') || missing('pool')}
									<span class="text-sm">{t(locale, 'eval_assign_needs_roles')}</span>
								{:else if data.pool.length === 0}
									<a class="anchor text-sm" href="/staff/reviewers">{t(locale, 'eval_pool_empty')}</a>
								{:else}
									<form method="POST" action="?/assign" class="flex flex-wrap items-center gap-2">
										<input type="hidden" name="application_id" value={row.id} />
										<select class="select select-sm w-auto" name="reviewer_user_id" aria-label={t(locale, 'eval_reviewer')}>
											{#each data.pool as p (p.user_id)}<option value={p.user_id}>{p.display_name}{p.expertise ? ` (${p.expertise})` : ''}</option>{/each}
										</select>
										<input class="input input-sm w-auto" type="date" name="due_on" aria-label={t(locale, 'eval_due')} />
										<button class="btn btn-sm preset-tonal" data-testid="eval-assign-{row.id}">{t(locale, 'eval_assign')}</button>
									</form>
								{/if}
							</td>
							<td data-testid="eval-decision-{row.id}">
								{#if row.decision}<Badge {locale} kind="decision" value={row.decision} />{/if}
								{#if missing('decide')}
									<span class="text-sm">{t(locale, 'eval_decide_needs_role')}</span>
								{:else}
									<details class="mt-1">
										<summary class="btn btn-sm preset-tonal cursor-pointer">{t(locale, 'eval_decide')}</summary>
										<form method="POST" action="?/decide" class="mt-2 flex min-w-64 flex-col gap-2">
											<input type="hidden" name="application_id" value={row.id} />
											<select class="select select-sm" name="decision" required aria-label={t(locale, 'eval_decision')}>
												{#each EVALUATION_DECISIONS as d (d)}<option value={d}>{t(locale, `decision_${d}` as MessageKey)}</option>{/each}
											</select>
											<label class="label"><span class="label-text text-sm">{t(locale, 'screening_message')}</span><textarea class="textarea" name="message_to_applicant" rows="2" maxlength="4000"></textarea></label>
											<label class="label"><span class="label-text text-sm">{t(locale, 'screening_reason')}</span><textarea class="textarea" name="reason" rows="2" maxlength="4000"></textarea></label>
											<button class="btn btn-sm preset-filled self-start" data-testid="eval-decide-{row.id}">{t(locale, 'screening_record')}</button>
										</form>
									</details>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	{#if missing('assign')}{@render roleNeeded('assign')}{/if}
	{#if missing('pool')}{@render roleNeeded('pool')}{/if}
	{#if missing('decide')}{@render roleNeeded('decide')}{/if}
	{#if missing('decisions')}{@render roleNeeded('decisions')}{/if}
	{#if missing('standing')}{@render roleNeeded('standing')}{/if}
	{#if missing('onboard')}{@render roleNeeded('onboard')}{/if}
	{#if missing('participants')}{@render roleNeeded('participants')}{/if}
</section>
