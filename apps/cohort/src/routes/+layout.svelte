<script lang="ts">
	import '../app.css';
	import AppSidebar from '$lib/components/AppSidebar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import { t, type Locale } from '$lib/i18n';

	/** Every page: the sidebar on the start side; beside it the top bar and the page. */
	let { data, children } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<svelte:head>
	<title>{t(locale, 'app_name')}</title>
</svelte:head>

<a href="#content" class="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 btn preset-filled">{t(locale, 'skip_to_content')}</a>
<div class="min-h-screen md:grid md:grid-cols-[16rem_1fr]">
	<AppSidebar {locale} path={data.path} username={data.user?.username ?? null} />
	<div class="min-w-0">
		<TopBar {locale} path={data.path} username={data.user?.username ?? null} />
		<main id="content" class="px-4 py-8 md:px-8">
			<div class="max-w-5xl">{@render children()}</div>
		</main>
	</div>
</div>
