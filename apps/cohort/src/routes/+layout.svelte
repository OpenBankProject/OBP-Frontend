<script lang="ts">
	import '../app.css';
	import { t, type Locale } from '$lib/i18n';

	let { data, children } = $props();

	const locale = $derived(data.locale as Locale);
	const otherLocale = $derived<Locale>(locale === 'ar' ? 'en' : 'ar');
</script>

<svelte:head>
	<title>{t(locale, 'app_name')}</title>
</svelte:head>

<header class="flex items-center justify-between gap-4 px-6 py-3">
	<nav class="flex items-center gap-4">
		<a href="/" class="font-semibold">{t(locale, 'app_name')}</a>
		<a href="/" class="anchor" data-testid="nav-calls">{t(locale, 'nav_calls')}</a>
		{#if data.user}
			<a href="/applications" class="anchor" data-testid="nav-my-applications">{t(locale, 'nav_my_applications')}</a>
			<a href="/staff" class="anchor" data-testid="nav-staff">{t(locale, 'nav_staff')}</a>
		{/if}
		<a href="/setup" class="anchor" data-testid="nav-setup">{t(locale, 'nav_setup')}</a>
	</nav>
	<div class="flex items-center gap-3">
		{#if data.user}
			<span data-testid="header-username">{data.user.username}</span>
			<form method="POST" action="/logout">
				<button type="submit" class="btn preset-tonal" data-testid="logout"
					>{t(locale, 'logout')}</button
				>
			</form>
		{:else}
			<a href="/login" class="btn preset-filled" data-testid="login">{t(locale, 'login')}</a>
		{/if}
		<form method="POST" action="/locale">
			<input type="hidden" name="locale" value={otherLocale} />
			<input type="hidden" name="redirect_to" value={data.path} />
			<button
				type="submit"
				class="btn preset-tonal"
				lang={otherLocale}
				aria-label={t(locale, 'switch_language_label')}
				data-testid="switch-language">{t(locale, 'switch_language')}</button
			>
		</form>
	</div>
</header>

<main class="px-6 py-4">
	{@render children()}
</main>
