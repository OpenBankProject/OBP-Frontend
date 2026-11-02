<script lang="ts">
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const missing = (key: keyof typeof data.lacking) => data.lacking[key];
	const statusLabel = (s: string) => t(locale, `milestone_status_${s}` as MessageKey);
</script>

{#snippet roleNeeded(key: keyof typeof data.lacking)}
	{#if missing(key)}
		<div class="mt-2"><MissingRole {locale} space={data.space} role={missing(key)!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>
	{/if}
{/snippet}

<p><a class="anchor" href="/staff/programmes/{data.programme.id}">{data.programme.name}</a></p>
<h1 class="h2">{t(locale, 'milestones_heading')}</h1>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}
	<p class="mt-4 preset-tonal-error rounded p-3" role="alert">
		{#if ['invalid', 'message_needed'].includes(String(form.error))}{t(locale, `milestones_error_${form.error}` as MessageKey)}{:else}{t(locale, 'staff_error')} {String(form.error)}{/if}
	</p>
{/if}
{#if form?.form === 'milestone' && form?.added}<p class="mt-4" role="status">{t(locale, 'milestones_added')}</p>{/if}
{#if form?.form === 'review' && form?.reviewed}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, `milestones_reviewed_${form.reviewed}` as MessageKey)}</p>{/if}

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="milestones-list">
	<h2 class="h4">{t(locale, 'milestones_list')}</h2>
	{#if data.milestones.length === 0}<p class="mt-2">{t(locale, 'milestones_none')}</p>{:else}
		<ol class="mt-2 list-inside list-decimal">
			{#each data.milestones as m (m.id)}
				<li><strong>{m.title}</strong>{#if m.due_on}{' '}· {t(locale, 'milestones_due')} {m.due_on}{/if}{#if m.description}<br /><span class="text-sm">{m.description}</span>{/if}</li>
			{/each}
		</ol>
	{/if}
	{#if missing('define')}{@render roleNeeded('define')}{:else}
		<details class="mt-3">
			<summary class="btn btn-sm preset-tonal cursor-pointer">{t(locale, 'milestones_add')}</summary>
			<form method="POST" action="?/addMilestone" class="mt-2 flex max-w-xl flex-col gap-2">
				<label class="label"><span class="label-text">{t(locale, 'milestones_title')} *</span><input class="input" name="title" required maxlength="255" /></label>
				<label class="label"><span class="label-text">{t(locale, 'milestones_description')}</span><textarea class="textarea" name="description" rows="2" maxlength="4000"></textarea></label>
				<label class="label"><span class="label-text">{t(locale, 'milestones_due')}</span><input class="input w-auto" type="date" name="due_on" /></label>
				<button class="btn preset-filled self-start" data-testid="milestones-add-submit">{t(locale, 'staff_create')}</button>
			</form>
		</details>
	{/if}
</section>

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="milestones-progress">
	<h2 class="h4">{t(locale, 'milestones_progress')}</h2>
	<p class="mt-1 text-sm">{t(locale, 'milestones_progress_intro')}</p>
	{@render roleNeeded('participants')}
	{@render roleNeeded('reports')}
	{@render roleNeeded('reviews')}
	{#if data.errors.participants}<p class="mt-2 preset-tonal-error rounded p-3">{data.errors.participants}</p>{/if}
	{#if data.rows.length === 0}<p class="mt-2">{t(locale, 'milestones_no_participants')}</p>{:else if data.milestones.length > 0}
		<div class="table-wrap mt-2">
			<table class="table">
				<thead>
					<tr>
						<th>{t(locale, 'programme_startup')}</th>
						{#each data.milestones as m (m.id)}<th>{m.title}</th>{/each}
						<th>{t(locale, 'milestones_behind')}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.rows as row (row.id)}
						<tr data-testid="milestones-row-{row.id}">
							<td><a class="anchor" href="/staff/applications/{row.application_id}">{row.startup_name}</a></td>
							{#each row.cells as c (c.milestone_id)}
								<td class={c.behind ? 'preset-tonal-error' : c.status === 'accepted' ? 'preset-tonal-success' : ''}>
									{statusLabel(c.status)}{#if c.behind}{' '}({t(locale, 'milestones_behind_one')}){/if}
								</td>
							{/each}
							<td><strong>{row.behind}</strong></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="milestones-pending">
	<h2 class="h4">{t(locale, 'milestones_pending')}</h2>
	{@render roleNeeded('review')}
	{@render roleNeeded('files')}
	{#if data.errors.reports}<p class="mt-2 preset-tonal-error rounded p-3">{data.errors.reports}</p>{/if}
	{#if data.pending.length === 0}<p class="mt-2">{t(locale, 'milestones_pending_none')}</p>{/if}
	{#each data.pending as p (p.report.id)}
		<article class="card preset-outlined-surface-200-800 mt-3 p-3" data-testid="milestones-pending-{p.report.id}">
			<p><strong>{p.startup_name}</strong> · {p.milestone} · {p.report.submitted_at.slice(0, 10)}</p>
			{#if p.report.note}<p class="mt-1 whitespace-pre-wrap">{p.report.note}</p>{/if}
			{#if p.files.length}
				<ul class="mt-1 text-sm">
					{#each p.files as f (f.file_id)}<li><a class="anchor" href="/files/{f.file_id}/download">{f.file_name}</a> ({f.scan_status})</li>{/each}
				</ul>
			{/if}
			{#if !missing('review')}
				<form method="POST" action="?/review" class="mt-2 flex max-w-xl flex-col gap-2">
					<input type="hidden" name="report_id" value={p.report.id} />
					<label class="label"><span class="label-text text-sm">{t(locale, 'milestones_message')}</span><textarea class="textarea" name="message_to_startup" rows="2" maxlength="4000"></textarea></label>
					<div class="flex gap-2">
						<button class="btn btn-sm preset-filled-primary-500" name="decision" value="accepted" data-testid="milestones-accept-{p.report.id}">{t(locale, 'milestones_accept')}</button>
						<button class="btn btn-sm preset-tonal" name="decision" value="returned" data-testid="milestones-return-{p.report.id}">{t(locale, 'milestones_return')}</button>
					</div>
				</form>
			{/if}
		</article>
	{/each}
</section>
