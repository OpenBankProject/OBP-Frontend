<script lang="ts">
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { RISK_LEVELS } from '$lib/dashboard';
	import { missingText, stageName } from '$lib/stages';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const missing = (key: keyof typeof data.lacking) => data.lacking[key];
</script>

<h1 class="h2">{t(locale, 'participants_heading')}</h1>
<p class="mt-2">{t(locale, 'participants_intro')}</p>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}
	<p class="mt-4 preset-tonal-error rounded p-3" role="alert">
		{#if ['invalid', 'gate'].includes(String(form.error))}{t(locale, `stage_error_${form.error}` as MessageKey)}{:else if form.error === 'team_unknown'}{t(locale, 'team_error_unknown')}{:else}{t(locale, 'staff_error')} {String(form.error)}{/if}
	</p>
{/if}
{#if form?.form === 'team' && form?.teamSet}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'team_saved')}</p>{/if}
{#if form?.form === 'flag' && form?.flagged}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'risk_saved')}</p>{/if}
{#if form?.form === 'advance' && form?.advanced}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'stage_advanced')} {form.advanced}.</p>{/if}

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="participants">
	{#each ['reports', 'reviews', 'advance', 'history', 'team'] as const as key (key)}
		{#if missing(key)}<div class="mb-2"><MissingRole {locale} space={data.space} role={missing(key)!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>{/if}
	{/each}
	{#if missing('read')}
		<MissingRole {locale} space={data.space} role={missing('read')!} entitlementRequestsUrl={data.entitlementRequestsUrl} />
	{:else if data.error}
		<p class="preset-tonal-error rounded p-3" role="alert">{data.error}</p>
	{:else if data.participants.length === 0}
		<p>{t(locale, 'participants_none')}</p>
	{:else}
		<div class="table-wrap">
			<table class="table">
				<thead>
					<tr>
						<th>{t(locale, 'programme_startup')}</th>
						<th>{t(locale, 'participants_programme')}</th>
						<th>{t(locale, 'team_heading')}</th>
						<th>{t(locale, 'programme_stage')}</th>
						<th>{t(locale, 'participants_company')}</th>
						<th>{t(locale, 'milestones_heading')}</th>
						<th>{t(locale, 'programme_joined')}</th>
						<th>{t(locale, 'stage_next')}</th>
						<th>{t(locale, 'risk_heading')}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.participants as p (p.id)}
						<tr>
							<td><a class="anchor" href="/staff/applications/{p.application_id}">{p.startup_name || p.application_id}</a></td>
							<td>{p.programme}{#if p.call}<span class="block text-sm">{t(locale, 'application_call')}: {p.call}</span>{/if}</td>
							<td class="min-w-44" data-testid="participant-team-{p.id}">
								{#if !p.organisation_id}
									<span class="text-sm">{t(locale, 'team_none_yet')}</span>
								{:else if !p.team}
									<code class="text-xs">{p.organisation_id}</code>
								{:else}
									{p.team.name || p.organisation_id}
									{#if p.team.members}
										<ul class="text-sm">
											{#each p.team.members as member (member.user_id)}
												<li>{member.username || member.user_id}{#if member.member_role === 'admin'}{' '}({t(locale, 'team_role_admin')}){/if}</li>
											{/each}
										</ul>
									{/if}
								{/if}
								{#if !missing('advance') && !missing('team')}
									<details class="mt-1">
										<summary class="btn btn-sm preset-tonal cursor-pointer">{t(locale, p.organisation_id ? 'team_change' : 'team_set')}</summary>
										<form method="POST" action="?/team" class="mt-1 flex flex-col gap-1">
											<input type="hidden" name="participant_id" value={p.id} />
											<select class="select select-sm" name="organisation_id" aria-label={t(locale, 'team_heading')} value={p.organisation_id}>
												<option value="">{t(locale, 'team_none')}</option>
												{#each data.teamChoices as team (team.organisation_id)}<option value={team.organisation_id}>{team.name || team.organisation_id}</option>{/each}
											</select>
											<input class="input input-sm" name="organisation_id_typed" maxlength="36" aria-label={t(locale, 'team_paste_id')} placeholder={t(locale, 'team_paste_id')} />
											<button class="btn btn-sm preset-tonal self-start" data-testid="participant-team-save-{p.id}">{t(locale, 'team_save')}</button>
										</form>
									</details>
								{/if}
							</td>
							<td>{stageName(locale, p.stage, p.stages)}</td>
							<td>{t(locale, p.customer_id ? 'participants_company_yes' : 'participants_company_no')}</td>
							<td>{p.milestones_accepted} / {p.milestones_total}</td>
							<td>{p.joined_at.slice(0, 10)}</td>
							<td class="min-w-44" data-testid="participant-next-{p.id}">
								{#if !p.next.to}
									<span class="text-sm">–</span>
								{:else if p.next.missing.length}
									<span class="text-sm">{stageName(locale, p.next.to, p.stages)}: {p.next.missing.map((m) => missingText(locale, m)).join('; ')}</span>
								{:else if missing('advance') || missing('history')}
									<span class="text-sm">{t(locale, 'stage_needs_roles')}</span>
								{:else}
									<form method="POST" action="?/advance" class="flex flex-col gap-1">
										<input type="hidden" name="participant_id" value={p.id} />
										<input class="input input-sm" name="note" maxlength="4000" aria-label={t(locale, 'stage_note')} placeholder={t(locale, 'stage_note')} />
										<button class="btn btn-sm preset-filled-primary-500 self-start" data-testid="participant-advance-{p.id}">{t(locale, 'stage_move_to')} {stageName(locale, p.next.to, p.stages)}</button>
									</form>
								{/if}
							</td>
							<td class="min-w-44" data-testid="participant-risk-{p.id}">
								{#if missing('advance')}
									<span class="text-sm">{t(locale, `risk_${p.risk}` as MessageKey)}{#if p.risk_note}: {p.risk_note}{/if}</span>
								{:else}
									<form method="POST" action="?/flag" class="flex flex-col gap-1">
										<input type="hidden" name="participant_id" value={p.id} />
										<select class="select select-sm" name="risk" aria-label={t(locale, 'risk_heading')} value={p.risk}>
											{#each RISK_LEVELS as level (level)}<option value={level}>{t(locale, `risk_${level}` as MessageKey)}</option>{/each}
										</select>
										<input class="input input-sm" name="risk_note" maxlength="1000" value={p.risk_note} aria-label={t(locale, 'risk_note')} placeholder={t(locale, 'risk_note')} />
										<button class="btn btn-sm preset-tonal self-start" data-testid="participant-flag-{p.id}">{t(locale, 'risk_save')}</button>
									</form>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
