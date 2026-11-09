<script lang="ts">
	import MissingRole from '$lib/components/MissingRole.svelte';
	import RetentionPolicyFields from '$lib/components/RetentionPolicyFields.svelte';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const missing = (key: keyof typeof data.lacking) => data.lacking[key];
	const what = (p: { resource_type: string; entity_name: string; condition: string }) =>
		`${p.entity_name || t(locale, `retention_resource_${p.resource_type}` as MessageKey)}${p.condition ? ` (${p.condition})` : ''}`;
	const count = (preview: Record<string, unknown>, key: string) => (typeof preview[key] === 'number' ? (preview[key] as number) : null);
</script>

{#snippet role(key: keyof typeof data.lacking)}
	{#if missing(key)}<div class="mt-2"><MissingRole {locale} space={data.space} role={missing(key)!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>{/if}
{/snippet}

<h1 class="h2">{t(locale, 'retention_heading')}</h1>
<p class="mt-2">{t(locale, 'retention_intro')}</p>
<p class="mt-2 text-sm">{t(locale, 'retention_safety')}</p>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{String(form.error) === 'retention_invalid' ? t(locale, 'retention_invalid') : `${t(locale, 'staff_error')} ${String(form.error)}`}</p>{/if}
{#if form?.saved || form?.removed || form?.started || form?.decided}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'retention_done')}</p>{/if}
{#if data.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{data.error}</p>{/if}

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="retention-policies">
	<h2 class="h4">{t(locale, 'retention_policies')}</h2>
	{@render role('read')}
	{#if !missing('read')}
		{#if data.policies.length === 0}<p class="mt-2">{t(locale, 'retention_none')}</p>{/if}
		<ul class="mt-2 flex flex-col gap-4">
			{#each data.policies as p (p.retention_policy_id)}
				{@const pv = p.preview as Record<string, unknown>}
				<li class="border-surface-200-800 border-b pb-3" data-testid="retention-policy-{p.retention_policy_id}">
					<p class="flex flex-wrap items-center gap-2">
						<strong>{what(p)}</strong>
						<span class="badge preset-tonal">{t(locale, `retention_action_${p.action}` as MessageKey)}</span>
						{#if !p.enabled}<span class="badge preset-tonal-warning">{t(locale, 'retention_off')}</span>{/if}
						{#if p.requires_approval}<span class="badge preset-tonal">{t(locale, 'retention_requires_approval')}</span>{/if}
					</p>
					<p class="mt-1 text-sm">
						{t(locale, 'retention_keeps')} {p.retain_days} {t(locale, 'retention_days_from')} {p.date_basis}{#if p.action === 'archive' && p.archive_days}; {t(locale, 'retention_then_archive')} {p.archive_days} {t(locale, 'retention_days_then_delete')}{/if}{#if p.cascade}; {t(locale, 'retention_cascade')}{/if}
					</p>
					<p class="mt-1 text-sm" data-testid="retention-preview-{p.retention_policy_id}">
						{#if typeof pv.error === 'string'}{t(locale, 'retention_preview_failed')} {pv.error}
						{:else}{t(locale, 'retention_preview')}: {count(pv, 'due_count') ?? '–'} · {t(locale, 'retention_held')}: {count(pv, 'held_count') ?? 0}{#if pv.oldest_trigger_date} · {t(locale, 'retention_oldest')} {String(pv.oldest_trigger_date).slice(0, 10)}{/if}{#if pv.can_execute === false} · {t(locale, 'retention_switched_off_in_api')}{/if}{/if}
					</p>
					<div class="mt-2 flex flex-wrap gap-2">
						{#if !missing('run')}
							<form method="POST" action="?/run"><input type="hidden" name="retention_policy_id" value={p.retention_policy_id} /><button class="btn btn-sm preset-filled-primary-500" data-testid="retention-run-{p.retention_policy_id}">{t(locale, p.requires_approval ? 'retention_run_request' : 'retention_run')}</button></form>
						{/if}
						{#if !missing('manage')}
							<form method="POST" action="?/remove"><input type="hidden" name="retention_policy_id" value={p.retention_policy_id} /><button class="btn btn-sm preset-tonal-error">{t(locale, 'retention_remove')}</button></form>
						{/if}
					</div>
					{#if !missing('manage')}
						<details class="mt-2">
							<summary class="anchor cursor-pointer text-sm">{t(locale, 'retention_change')}</summary>
							<form method="POST" action="?/save" class="mt-2 grid gap-2 md:grid-cols-3">
								<input type="hidden" name="retention_policy_id" value={p.retention_policy_id} />
								<RetentionPolicyFields {locale} entityNames={data.entityNames} values={p} />
								<button class="btn btn-sm preset-filled-primary-500 self-start">{t(locale, 'emails_save')}</button>
							</form>
						</details>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
	{@render role('run')}
</section>

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="retention-new">
	<h2 class="h4">{t(locale, 'retention_new')}</h2>
	{@render role('manage')}
	{#if !missing('manage')}
		<p class="mt-1 text-sm">{t(locale, 'retention_suggestions')}</p>
		<ul class="mt-2 flex flex-col gap-1 text-sm">
			{#each data.suggestions as s (s.key)}
				<li class="flex flex-wrap items-center gap-2">
					<form method="POST" action="?/save">
						{#each Object.entries(s) as [k, v] (k)}{#if k !== 'key' && v !== null && k !== 'cascade'}<input type="hidden" name={k} value={String(v)} />{/if}{/each}
						{#if s.cascade}<input type="hidden" name="cascade" value="on" />{/if}
						<input type="hidden" name="requires_approval" value="on" />
						<button class="btn btn-sm preset-tonal">{t(locale, 'retention_add')}</button>
					</form>
					<span>{t(locale, `retention_suggest_${s.key}` as MessageKey)}: {s.retain_days} {t(locale, 'retention_days')}, {t(locale, `retention_action_${s.action}` as MessageKey)}{#if s.archive_days}{' '}({s.archive_days} {t(locale, 'retention_days')}){/if}</span>
				</li>
			{/each}
		</ul>
		<details class="mt-3">
			<summary class="anchor cursor-pointer text-sm">{t(locale, 'retention_custom')}</summary>
			<form method="POST" action="?/save" class="mt-2 grid gap-2 md:grid-cols-3">
				<RetentionPolicyFields {locale} entityNames={data.entityNames} />
				<button class="btn btn-sm preset-filled-primary-500 self-start">{t(locale, 'retention_add')}</button>
			</form>
		</details>
	{/if}
</section>

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="retention-runs">
	<h2 class="h4">{t(locale, 'retention_runs')}</h2>
	{@render role('runs')}
	{@render role('approve')}
	{#if !missing('runs')}
		{#if data.runs.length === 0}<p class="mt-2">{t(locale, 'retention_runs_none')}</p>{/if}
		<ul class="mt-2 flex flex-col gap-2">
			{#each data.runs as r (r.retention_run_id)}
				{@const policy = data.policies.find((p) => p.retention_policy_id === r.retention_policy_id)}
				<li class="flex flex-wrap items-center gap-2 text-sm">
					<span class="badge {r.status === 'pending' ? 'preset-tonal-warning' : r.status === 'failed' || r.status === 'refused' ? 'preset-tonal-error' : 'preset-tonal'}">{r.status}</span>
					<span>{r.created_at.replace('T', ' ').slice(0, 16)}</span>
					<span>{policy ? what(policy) : r.retention_policy_id}</span>
					{#if Object.keys(r.counts).length}<span>· {Object.entries(r.counts).map(([k, v]) => `${k} ${v}`).join(', ')}</span>{/if}
					{#if r.message}<span>· {r.message}</span>{/if}
					{#if r.status === 'pending' && !missing('approve')}
						<form method="POST" action="?/decide" class="flex gap-1">
							<input type="hidden" name="retention_run_id" value={r.retention_run_id} />
							<button class="btn btn-sm preset-filled-primary-500" name="decision" value="approve">{t(locale, 'retention_approve')}</button>
							<button class="btn btn-sm preset-tonal-error" name="decision" value="reject">{t(locale, 'retention_reject')}</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
