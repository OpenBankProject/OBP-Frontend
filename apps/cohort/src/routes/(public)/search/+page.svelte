<script lang="ts">
	import { SEARCH_KINDS } from '$lib/search';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
	/** A stage's or status's name: Cohort's own where it has one. */
	const stageLabel = (s: string) => {
		const key = (['draft', 'submitted'].includes(s) ? `status_${s}` : `participant_stage_${s}`) as MessageKey;
		return t(locale, key) || s;
	};
</script>

<h1 class="h2">{t(locale, 'search_heading')}</h1>

<form method="GET" class="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]" role="search" data-testid="search-form">
	<label class="label"><span class="label-text">{t(locale, 'search_query')}</span><input class="input" type="search" name="q" value={data.q} maxlength="200" /></label>
	<label class="label"><span class="label-text">{t(locale, 'search_kind')}</span>
		<select class="select" name="kind">
			<option value="">{t(locale, 'search_kind_all')}</option>
			{#each SEARCH_KINDS as k (k)}<option value={k} selected={k === data.kind}>{t(locale, `search_kind_${k}` as MessageKey)}</option>{/each}
		</select>
	</label>
	<label class="label"><span class="label-text">{t(locale, 'search_stage')}</span>
		<select class="select" name="stage">
			<option value="">{t(locale, 'search_stage_all')}</option>
			{#each data.stages as s (s)}<option value={s} selected={s === data.stage}>{stageLabel(s)}</option>{/each}
		</select>
	</label>
	<label class="label"><span class="label-text">{t(locale, 'search_sort')}</span>
		<select class="select" name="sort">
			<option value="relevance" selected={data.sort === 'relevance'}>{t(locale, 'search_sort_relevance')}</option>
			<option value="date" selected={data.sort === 'date'}>{t(locale, 'search_sort_date')}</option>
		</select>
	</label>
	<button class="btn preset-filled-primary-500 self-end" data-testid="search-submit">{t(locale, 'search_go')}</button>
</form>

{#if data.q}
	<section class="mt-6" data-testid="search-results">
		<p class="text-sm">{data.hits.length} {t(locale, 'search_results')}</p>
		{#if data.hits.length === 0}
			<p class="mt-2">{t(locale, 'search_none')}</p>
		{:else}
			<ul class="mt-2 flex flex-col gap-3">
				{#each data.hits as h (`${h.kind}:${h.id}`)}
					<li class="card preset-outlined-surface-200-800 p-3">
						<p class="flex flex-wrap items-center gap-2">
							<span class="badge preset-tonal">{t(locale, `search_kind_${h.kind}` as MessageKey)}</span>
							<a class="anchor font-bold" href={h.href}>{h.title}</a>
							{#if h.stage}<span class="text-sm">· {stageLabel(h.stage)}</span>{/if}
							{#if h.date}<span class="text-sm">· {h.date.slice(0, 10)}</span>{/if}
						</p>
						{#if h.text}<p class="mt-1 line-clamp-2 text-sm">{h.text}</p>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
