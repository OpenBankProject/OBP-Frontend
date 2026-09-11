<script lang="ts">
	import { explorerCatalogueUrl } from '@obp/shared/explorer';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const topTags = $derived(data.tags.slice(0, 24));
</script>

<svelte:head>
	<title>{data.current.fullyQualifiedVersion} - API Explorer</title>
	<meta name="description" content="Browse the {data.current.fullyQualifiedVersion} API catalogue." />
</svelte:head>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
	<header class="flex flex-col gap-2">
		<h1 class="text-2xl font-semibold text-surface-900-50">
			{data.current.fullyQualifiedVersion}
		</h1>
		<p class="text-surface-600-400">
			{data.index.length} endpoints, served under
			<span class="font-mono">/{data.current.urlPrefix}/{data.current.shortVersion}</span>.
			Pick one from the left, or search it.
		</p>
	</header>

	<section class="flex flex-col gap-3">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-surface-600-400">Tags</h2>
		<div class="flex flex-wrap gap-2">
			{#each topTags as t (t.tag)}
				<a
					class="rounded border border-surface-300-600 px-2 py-1 text-xs text-surface-700-300 hover:bg-surface-100-800"
					href={explorerCatalogueUrl(data.current.urlPrefix, data.current.shortVersion, {
						tag: t.tag
					})}
				>
					{t.tag}
					<span class="text-surface-600-400">{t.count}</span>
				</a>
			{/each}
		</div>
	</section>

	<section class="flex flex-col gap-2 border-t border-surface-300-600 pt-4 text-sm">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-surface-600-400">
			Reading an endpoint
		</h2>
		<p class="text-surface-700-300">
			Every endpoint page shows its roles, description, example request and success response.
			The right-hand pane composes the call itself — URL parameters, body and a copyable curl
			command.
		</p>
	</section>
</div>
