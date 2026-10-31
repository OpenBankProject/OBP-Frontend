<script lang="ts">
	import { LogIn, LogOut } from '@lucide/svelte';
	import LanguageSwitch from '$lib/components/LanguageSwitch.svelte';
	import { t, type Locale } from '$lib/i18n';

	/** The bar above every page: the User and Log out (or Log in), and the language, at the end side (top right). */
	let { locale, path, username }: { locale: Locale; path: string; username: string | null } = $props();
</script>

<header class="flex flex-wrap items-center justify-end gap-3 px-4 py-2 shadow-sm md:px-8">
	{#if username}
		<span class="text-sm" data-testid="header-username">{username}</span>
		<form method="POST" action="/logout">
			<button type="submit" class="btn btn-sm preset-tonal gap-2" data-testid="logout">
				<LogOut class="size-4 rtl:rotate-180" aria-hidden="true" />{t(locale, 'logout')}
			</button>
		</form>
	{:else}
		<a href="/login" class="btn btn-sm preset-filled-primary-500 gap-2" data-testid="login">
			<LogIn class="size-4 rtl:rotate-180" aria-hidden="true" />{t(locale, 'login')}
		</a>
	{/if}
	<LanguageSwitch {locale} {path} />
</header>
