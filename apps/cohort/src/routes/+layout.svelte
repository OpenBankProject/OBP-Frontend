<script lang="ts">
	import '../app.css';
	import { t, type Locale } from '$lib/i18n';

	let { data, children } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<svelte:head>
	<title>{t(locale, 'app_name')}</title>
</svelte:head>

<a href="#content" class="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 btn preset-filled">{t(locale, 'skip_to_content')}</a>
{@render children()}
