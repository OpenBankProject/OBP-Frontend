<script lang="ts">
	import AppSidebar from '$lib/components/AppSidebar.svelte';
	import type { Locale } from '$lib/i18n';

	/** The logged-in pages: the sidebar on the start side, the page beside it. */
	let { data, children } = $props();
</script>

<div class="min-h-screen md:grid md:grid-cols-[16rem_1fr]">
	<AppSidebar locale={data.locale as Locale} path={data.path} username={data.user?.username ?? ''} />
	<main id="content" class="min-w-0 px-4 py-8 md:px-8">
		<div class="max-w-5xl">{@render children()}</div>
	</main>
</div>
