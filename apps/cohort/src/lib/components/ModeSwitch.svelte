<script lang="ts">
	import { Moon, Sun } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { t, type Locale } from '$lib/i18n';

	/** Dark or light, remembered in the browser under the same key as the Portal ('mode'). Dark by default. */
	let { locale, mode = $bindable('dark') }: { locale: Locale; mode?: 'dark' | 'light' } = $props();

	onMount(() => {
		try {
			mode = localStorage.getItem('mode') === 'light' ? 'light' : 'dark';
		} catch {
			mode = 'dark';
		}
	});

	function toggle() {
		mode = mode === 'dark' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-mode', mode);
		try {
			localStorage.setItem('mode', mode);
		} catch {
			// Not remembered, e.g. in a private window.
		}
	}
</script>

<svelte:head>
	<script>
		try {
			document.documentElement.setAttribute('data-mode', localStorage.getItem('mode') === 'light' ? 'light' : 'dark');
		} catch (e) {}
	</script>
</svelte:head>

<button
	type="button"
	class="btn-icon btn-icon-sm preset-tonal"
	aria-label={t(locale, mode === 'dark' ? 'mode_light' : 'mode_dark')}
	onclick={toggle}
	data-testid="mode-switch"
>
	{#if mode === 'dark'}<Sun class="size-4" aria-hidden="true" />{:else}<Moon class="size-4" aria-hidden="true" />{/if}
</button>
