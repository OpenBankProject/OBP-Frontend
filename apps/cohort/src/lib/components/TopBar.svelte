<script lang="ts">
	import { LogIn, LogOut } from '@lucide/svelte';
	import LanguageSwitch from '$lib/components/LanguageSwitch.svelte';
	import ModeSwitch from '$lib/components/ModeSwitch.svelte';
	import { t, type Locale } from '$lib/i18n';

	/** The bar above every page: the app's title at the start; the User, Log out (or Log in), language and mode at the end. */
	let {
		locale,
		appName,
		path,
		username,
		mode = $bindable('dark')
	}: { locale: Locale; appName: string; path: string; username: string | null; mode?: 'dark' | 'light' } = $props();
</script>

<header class="z-10 flex min-h-12 shrink-0 flex-wrap items-center gap-3 px-4 py-2 shadow-md md:px-8">
	<span class="me-auto text-lg font-semibold" data-testid="app-title">{appName}</span>
	{#if username}
		<span class="text-sm" data-testid="header-username">{username}</span>
		<form method="POST" action="/logout">
			<button type="submit" class="btn btn-sm preset-outlined-primary-500 gap-2" data-testid="logout">
				<LogOut class="size-4 rtl:rotate-180" aria-hidden="true" />{t(locale, 'logout')}
			</button>
		</form>
	{:else}
		<a href="/login" class="btn btn-sm preset-filled-surface-950-50 gap-2" data-testid="login">
			<LogIn class="size-4 rtl:rotate-180" aria-hidden="true" />{t(locale, 'login')}
		</a>
	{/if}
	<LanguageSwitch {locale} {path} />
	<ModeSwitch {locale} bind:mode />
</header>
