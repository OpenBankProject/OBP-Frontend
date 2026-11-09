<script lang="ts">
	import { t, type Locale, type MessageKey } from '$lib/i18n';
	import type { Update } from '$lib/updates';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
	const outcomeLabel = (u: Update) =>
		u.kind === 'decision' ? t(locale, `decision_${u.outcome}` as MessageKey) : u.kind === 'milestone_review' ? t(locale, `milestone_status_${u.outcome}` as MessageKey) : '';
	const when = (at: string) => at.replace('T', ' ').replace('Z', '').slice(0, 16);
</script>

{#snippet list(updates: Update[], testid: string)}
	<ul class="mt-2 flex flex-col gap-3" data-testid={testid}>
		{#each updates as u (u.key)}
			<li class="border-surface-200-800 border-b pb-3" data-testid="update-{u.kind}">
				<p class="flex flex-wrap items-center gap-2">
					{#if u.new}<span class="badge preset-filled-primary-500">{t(locale, 'updates_new')}</span>{/if}
					<span class="badge preset-tonal">{t(locale, `updates_kind_${u.kind}` as MessageKey)}</span>
					{#if u.href}<a class="anchor font-bold" href={u.href}>{u.title}</a>{:else}<strong>{u.title}</strong>{/if}
					{#if outcomeLabel(u)}<span>· {outcomeLabel(u)}</span>{/if}
					<span class="text-sm">{when(u.at)}</span>
				</p>
				{#if u.detail}<p class="mt-1 whitespace-pre-line">{u.detail}</p>{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<h1 class="h2">{t(locale, 'updates_heading')}</h1>
<p class="mt-2">{t(locale, 'updates_intro')}</p>

<section class="card preset-outlined-surface-200-800 mt-6 p-4">
	<h2 class="h4">{t(locale, 'updates_upcoming')}</h2>
	{#if data.upcoming.length === 0}<p class="mt-2">{t(locale, 'updates_upcoming_none')}</p>{:else}{@render list(data.upcoming, 'updates-upcoming')}{/if}
</section>

<section class="card preset-outlined-surface-200-800 mt-6 p-4">
	<h2 class="h4">{t(locale, 'updates_recent')}</h2>
	{#if data.recent.length === 0}<p class="mt-2">{t(locale, 'updates_recent_none')}</p>{:else}{@render list(data.recent, 'updates-recent')}{/if}
</section>
