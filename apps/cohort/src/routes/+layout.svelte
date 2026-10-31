<script lang="ts">
	import '../app.css';
	import AppSidebar from '$lib/components/AppSidebar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import { t, type Locale } from '$lib/i18n';

	/** Every page: the sidebar on the start side; beside it the top bar and the page. */
	let { data, children } = $props();

	const locale = $derived(data.locale as Locale);
	const appName = $derived(data.branding.name || t(locale, 'app_name'));
	let mode = $state<'dark' | 'light'>('dark');
</script>

<svelte:head>
	<title>{appName}</title>
	{#if data.branding.stylesheetUrl}<link rel="stylesheet" href={data.branding.stylesheetUrl} />{/if}
</svelte:head>

<a href="#content" class="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 btn preset-filled">{t(locale, 'skip_to_content')}</a>
<div class="min-h-screen md:grid md:h-screen md:grid-cols-[16rem_1fr] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
	<AppSidebar {locale} path={data.path} username={data.user?.username ?? null} {mode} logoUrl={data.branding.logoUrl} darkLogoUrl={data.branding.darkLogoUrl} />
	<!-- The Portal's background: a conic gradient seen through a blur. -->
	<div class="min-w-0 bg-conic-250 from-30% via-40% to-50% dark:from-primary-950 dark:via-secondary-500/70 dark:to-primary-950">
		<div class="flex h-full flex-col backdrop-blur-2xl">
			<TopBar {locale} {appName} path={data.path} username={data.user?.username ?? null} bind:mode />
			<main id="content" class="min-h-0 flex-1 overflow-auto px-4 py-8 md:px-8">
				<div class="max-w-5xl">{@render children()}</div>
			</main>
		</div>
	</div>
</div>
