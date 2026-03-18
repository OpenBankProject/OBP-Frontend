<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { myAccountItems } from '$lib/config/navigation';
	import Toast from '$lib/components/Toast.svelte';
	import WelcomeBubble from '$lib/components/WelcomeBubble.svelte';
	import NavigationSidebar from '$lib/components/NavigationSidebar.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';

	// Lucide Icons (used for building menuItems)
	import {
		Compass,
		KeyRound,
		Star,
		SquareTerminal,
		ShoppingBag,
		Landmark,
		DatabaseZap,
		CreditCard
	} from '@lucide/svelte';

	import { env } from '$env/dynamic/public';
	let { data, children } = $props();

	// Undocumented feature flag - accepts string values (env vars are always strings in SvelteKit)
	let hideFooterExtras = $state(
		env.PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED === 'true' ||
		env.PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED === '1' ||
		env.PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED === 'TRUE' ||
		env.PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED === 'True'
	);
	let isAuthenticated = $state(!!data.userId);
	let displayMode: 'dark' | 'light' = $state('dark');

	// Some items in the menu are rendered conditionally based on the presence of URLs set in the environment variables.
	// This is to ensure no broken links
	let menuItems = $state([
		...(data.externalLinks.API_EXPLORER_URL
			? [
					{
						href: data.externalLinks.API_EXPLORER_URL,
						label: 'API Explorer',
						iconComponent: Compass,
						external: true
					}
				]
			: []),
		{
			label: 'Featured',
			href: '/featured',
			iconComponent: Star
		},
		{
			label: 'API Products',
			href: '/products',
			iconComponent: ShoppingBag
		},
		{
			label: 'Financial Products',
			href: '/financial-products',
			iconComponent: Landmark
		},
		{
			label: 'Get API Key',
			href: '/consumers/register',
			iconComponent: KeyRound
		},
		{
			label: 'Subscriptions',
			href: '/subscriptions',
			iconComponent: CreditCard
		},
		...(data.externalLinks.API_MANAGER_URL
			? [
					{
						href: data.externalLinks.API_MANAGER_URL,
						label: 'API Manager',
						iconComponent: SquareTerminal,
						external: true
					}
				]
			: []),
		...(data.externalLinks.SANDBOX_POPULATOR_URL
			? [
					{
						href: data.externalLinks.SANDBOX_POPULATOR_URL,
						label: 'Sandbox Populator',
						iconComponent: DatabaseZap,
						external: true
					}
				]
			: [])
	]);

	let footerLinks = $state([
		{
			href: 'https://github.com/OpenBankProject',
			label: 'GitHub',
			iconLight: '/github-mark.svg',
			iconDark: '/github-mark-white.svg'
		}
	]);

	// Default logo URL, can be overridden by PUBLIC_LOGO_URL in .env
	const defaultLogoUrl = '/logo2x-1.png';
	const defaultDarkLogoUrl = '/obp_logo.png';
	let lightLogoUrl = $state(env.PUBLIC_LOGO_URL || defaultLogoUrl);

	if (!env.PUBLIC_DARK_LOGO_URL) {
		// If no dark logo URL is provided, use the same as light logo
		env.PUBLIC_DARK_LOGO_URL = env.PUBLIC_LOGO_URL || defaultLogoUrl;
	}

	let darkLogoUrl = $state(env.PUBLIC_DARK_LOGO_URL || defaultDarkLogoUrl);

	let logoUrl = $derived.by(() => {
		return displayMode === 'dark' ? darkLogoUrl : lightLogoUrl;
	});

	// Logo width from environment variable (e.g., "200px", "50%", "10rem")
	// Defaults to "100%" (full width) if not set
	let logoWidth = $state(env.PUBLIC_LOGO_WIDTH || '100%');

	// Sponsor image URL - supports light/dark mode
	let sponsorImageUrl = $derived.by(() => {
		if (displayMode === 'dark' && env.PUBLIC_SPONSOR_DARK_IMAGE) {
			return env.PUBLIC_SPONSOR_DARK_IMAGE;
		}
		return env.PUBLIC_SPONSOR_IMAGE;
	});
</script>

<div
	class="grid h-screen w-full grid-cols-[auto_1fr] divide-x divide-solid divide-surface-100-900 overflow-hidden"
>
	<NavigationSidebar
		{menuItems}
		{myAccountItems}
		{logoUrl}
		{logoWidth}
		{isAuthenticated}
		currentPathname={page.url.pathname}
		bind:displayMode
		{footerLinks}
		copyrightHolder="TESOBE"
		copyrightStartYear={2011}
		{sponsorImageUrl}
		sponsorInfoUrl={env.PUBLIC_SPONSOR_INFO_URL}
		sponsorNote={env.PUBLIC_SPONSOR_NOTE}
		legacyPortalUrl={data.externalLinks.LEGACY_PORTAL_URL}
		hideFooterExtras={hideFooterExtras}
		collapsedLogoUrl={env.PUBLIC_MINIMAL_LOGO_URL || env.PUBLIC_DARK_LOGO_URL}
	/>
	<div
		class="h-full bg-conic-250 from-30% via-40% to-50% dark:from-primary-950 dark:via-secondary-500/70 dark:to-primary-950"
	>
		<div class="flex flex-col backdrop-blur-2xl" style="height: calc(100vh - 48px);">
			<div
				class="bg-opacity-0 flex items-center justify-end px-4 py-2 shadow-md z-10"
				style="height: 48px; flex-shrink: 0;"
			>
				{#if isAuthenticated}
					<span class="mx-4 hover:text-tertiary-400"><a href="/user">{data.username}</a></span>
					<button type="button" class="btn preset-outlined-primary-500"
						><a href="/logout">Logout</a></button
					>
				{:else}
					<span class="mx-4 hover:text-tertiary-400"><a href="/register">Register</a> </span>
					<button type="button" class="btn preset-filled-surface-950-50"
						><a href="/login">Login</a></button
					>
				{/if}
			</div>

			<main class="flex flex-col overflow-auto" style="height: calc(100vh - 48px);">
				{@render children()}
			</main>
		</div>
	</div>
</div>

<!-- Global Toast Component -->
<Toast />

<!-- Welcome Bubble Component (appears once on first visit) -->
<WelcomeBubble />
