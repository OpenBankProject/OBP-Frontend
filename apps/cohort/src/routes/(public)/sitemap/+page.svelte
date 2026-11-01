<script lang="ts">
	import { ClipboardCheck, FileText, Globe, Users } from '@lucide/svelte';
	import { t, type Locale, type MessageKey } from '$lib/i18n';
	import { AUDIENCES, PAGES, type Audience, type MapPage } from '$lib/sitemap';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
	const icons: Record<Audience, typeof Globe> = { everyone: Globe, applicants: FileText, reviewers: ClipboardCheck, staff: Users };
	const count = (pages: MapPage[]): number => pages.reduce((n, p) => n + 1 + count(p.children), 0);
</script>

{#snippet tree(pages: MapPage[])}
	<ul class="flex flex-col gap-2">
		{#each pages as page (page.route)}
			{@const info = PAGES[page.route]}
			<li>
				<div class="card preset-outlined-surface-200-800 bg-surface-50-950 p-3" data-testid="map-{page.route}">
					<div class="flex flex-wrap items-baseline gap-x-2">
						{#if page.dynamic}
							<strong>{info ? t(locale, info.title) : page.route}</strong>
						{:else}
							<a class="anchor font-bold" href={page.route}>{info ? t(locale, info.title) : page.route}</a>
						{/if}
						<code class="text-xs" dir="ltr">{page.route}</code>
					</div>
					{#if info}<p class="mt-1 text-sm">{t(locale, info.about)}</p>{/if}
					<div class="mt-2 flex flex-wrap gap-1 text-xs">
						<span class="badge {page.login ? 'preset-tonal-warning' : 'preset-tonal-success'}">{t(locale, page.login ? 'map_needs_login' : 'map_open_to_all')}</span>
						{#if page.dynamic}<span class="badge preset-tonal">{t(locale, 'map_from_list')}</span>{/if}
					</div>
				</div>
				{#if page.children.length}
					<div class="ms-4 mt-2 border-s-2 border-surface-300-700 ps-3">{@render tree(page.children)}</div>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<h1 class="h2">{t(locale, 'map_heading')}</h1>
<p class="mt-1">{t(locale, 'map_intro')}</p>

<div class="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
	{#each AUDIENCES as audience (audience)}
		{@const Icon = icons[audience]}
		<section class="card preset-filled-surface-100-900 p-4" data-testid="map-section-{audience}">
			<h2 class="h4 flex items-center gap-2">
				<Icon class="size-5" aria-hidden="true" />
				{t(locale, `map_audience_${audience}` as MessageKey)}
				<span class="badge preset-tonal text-xs">{count(data.sitemap[audience])}</span>
			</h2>
			<p class="mb-3 mt-1 text-sm">{t(locale, `map_audience_${audience}_about` as MessageKey)}</p>
			{@render tree(data.sitemap[audience])}
		</section>
	{/each}
</div>
