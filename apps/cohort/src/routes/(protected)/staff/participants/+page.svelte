<script lang="ts">
	import MissingRole from '$lib/components/MissingRole.svelte';
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
		{#if ['invalid', 'gate'].includes(String(form.error))}{t(locale, `stage_error_${form.error}` as MessageKey)}{:else}{t(locale, 'staff_error')} {String(form.error)}{/if}
	</p>
{/if}
{#if form?.form === 'advance' && form?.advanced}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'stage_advanced')} {t(locale, `participant_stage_${form.advanced}` as MessageKey)}.</p>{/if}

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="participants">
	{#each ['reports', 'reviews', 'advance', 'history'] as const as key (key)}
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
						<th>{t(locale, 'application_call')}</th>
						<th>{t(locale, 'programme_stage')}</th>
						<th>{t(locale, 'participants_company')}</th>
						<th>{t(locale, 'milestones_heading')}</th>
						<th>{t(locale, 'programme_joined')}</th>
						<th>{t(locale, 'stage_next')}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.participants as p (p.id)}
						<tr>
							<td><a class="anchor" href="/staff/applications/{p.application_id}">{p.startup_name || p.application_id}</a></td>
							<td>{p.programme}</td>
							<td>{p.call}</td>
							<td>{t(locale, `participant_stage_${p.stage}` as MessageKey)}</td>
							<td>{t(locale, p.customer_id ? 'participants_company_yes' : 'participants_company_no')}</td>
							<td>{p.milestones_accepted} / {p.milestones_total}</td>
							<td>{p.joined_at.slice(0, 10)}</td>
							<td data-testid="participant-next-{p.id}">
								{#if !p.next.to}
									<span class="text-sm">–</span>
								{:else if p.next.missing}
									<span class="text-sm">{t(locale, `participant_stage_${p.next.to}` as MessageKey)}: {t(locale, `stage_missing_${p.next.missing}` as MessageKey)}</span>
								{:else if missing('advance') || missing('history')}
									<span class="text-sm">{t(locale, 'stage_needs_roles')}</span>
								{:else}
									<form method="POST" action="?/advance" class="flex flex-col gap-1">
										<input type="hidden" name="participant_id" value={p.id} />
										<input class="input input-sm" name="note" maxlength="4000" aria-label={t(locale, 'stage_note')} placeholder={t(locale, 'stage_note')} />
										<button class="btn btn-sm preset-filled-primary-500 self-start" data-testid="participant-advance-{p.id}">{t(locale, `stage_move_to_${p.next.to}` as MessageKey)}</button>
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
