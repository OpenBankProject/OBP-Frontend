<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Pages</title>
	<meta name="description" content="Pages and apps published on this Portal" />
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100">Pages</h1>
	<p class="mb-6 text-gray-600 dark:text-gray-400">Pages and apps published by this bank.</p>

	{#if data.unavailable}
		<p class="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200" data-testid="pages-unavailable">
			{data.unavailable}
		</p>
	{:else if data.pages.length === 0}
		<p class="text-gray-500 dark:text-gray-400" data-testid="pages-empty">Nothing has been published yet.</p>
	{:else}
		<ul class="space-y-3" data-testid="pages-list">
			{#each data.pages as page (page.slug)}
				<li class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800" data-testid="pages-item" data-kind={page.kind}>
					<a href="/pages/{page.slug}" class="text-lg font-semibold text-gray-900 hover:underline dark:text-gray-100">{page.title}</a>
					<span class="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">{page.kind === 'app' ? 'App' : 'Page'}</span>
					{#if page.summary}<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{page.summary}</p>{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
