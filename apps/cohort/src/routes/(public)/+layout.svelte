<script lang="ts">
	import LanguageSwitch from '$lib/components/LanguageSwitch.svelte';
	import { t, type Locale } from '$lib/i18n';

	/** The public website: open calls, a call, login and setup. Anyone can read these pages. */
	let { data, children } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<header class="bg-primary-50 dark:bg-primary-950">
	<div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
		<a href="/" class="text-lg font-semibold" data-testid="brand">{t(locale, 'app_name')}</a>
		<nav aria-label={t(locale, 'nav_main')} class="flex flex-wrap items-center gap-4">
			<a href="/" class="anchor" data-testid="nav-calls">{t(locale, 'nav_calls')}</a>
			{#if data.user}
				<a href="/applications" class="anchor" data-testid="nav-my-applications">{t(locale, 'nav_my_applications')}</a>
			{/if}
		</nav>
		<div class="flex items-center gap-2">
			{#if data.user}
				<a href="/applications" class="btn btn-sm preset-tonal" data-testid="header-username">{data.user.username}</a>
			{:else}
				<a href="/login" class="btn btn-sm preset-filled-primary-500" data-testid="login">{t(locale, 'login')}</a>
			{/if}
			<LanguageSwitch {locale} path={data.path} />
		</div>
	</div>
</header>

<main id="content" class="mx-auto max-w-5xl px-4 py-8">
	{@render children()}
</main>

<footer class="mx-auto max-w-5xl px-4 py-6 text-sm text-surface-600-400">
	<a href="/setup" class="anchor" data-testid="nav-setup">{t(locale, 'nav_setup')}</a>
</footer>
