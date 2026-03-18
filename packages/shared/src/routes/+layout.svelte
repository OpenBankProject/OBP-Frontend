<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { buildMyAccountItems } from '$lib/config/navigation';
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
		CreditCard,
		Server,
		Radio,
		BarChart3,
		ShieldCheck,
		Settings,
		Globe,
		FileCode,
		Database,
		Users,
		Bell,
		Workflow,
		MonitorCheck,
		Lock,
		Layers
	} from '@lucide/svelte';
	import type { NavigationSection } from '$lib/config/navigation';

	import { env } from '$env/dynamic/public';
	let { data, children } = $props();

	// Build my account items using factory function
	const myAccountItems = buildMyAccountItems({
		subscriptionsUrl: env.PUBLIC_SUBSCRIPTIONS_URL
	});

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

	const sections: NavigationSection[] = [
		{
			id: 'system',
			label: 'System',
			iconComponent: Server,
			basePaths: ['/system'],
			items: [
				{ href: '/system/banks', label: 'Banks', iconComponent: Landmark },
				{ href: '/system/hosts', label: 'API Hosts', iconComponent: Globe },
				{ href: '/system/configuration', label: 'Configuration', iconComponent: Settings }
			]
		},
		{
			id: 'signals',
			label: 'Signals',
			iconComponent: Radio,
			basePaths: ['/signals'],
			items: [
				{ href: '/signals/webhooks', label: 'Webhooks', iconComponent: Workflow },
				{ href: '/signals/alerts', label: 'Alerts', iconComponent: Bell },
				{ href: '/signals/notifications', label: 'Notifications', iconComponent: MonitorCheck }
			]
		},
		{
			id: 'metrics',
			label: 'Metrics',
			iconComponent: BarChart3,
			basePaths: ['/metrics'],
			items: [
				{ href: '/metrics/api-calls', label: 'API Calls', iconComponent: BarChart3 },
				{ href: '/metrics/performance', label: 'Performance', iconComponent: MonitorCheck },
				{ href: '/metrics/usage', label: 'Usage Reports', iconComponent: FileCode }
			]
		},
		{
			id: 'rbac',
			label: 'RBAC',
			iconComponent: ShieldCheck,
			basePaths: ['/rbac'],
			items: [
				{ href: '/rbac/roles', label: 'Roles', iconComponent: Lock },
				{ href: '/rbac/permissions', label: 'Permissions', iconComponent: ShieldCheck },
				{ href: '/rbac/users', label: 'Users', iconComponent: Users }
			]
		},
		{
			id: 'dynamic-entities',
			label: 'Dynamic Entities',
			iconComponent: Database,
			basePaths: ['/dynamic-entities'],
			items: [
				{ href: '/dynamic-entities/system?level=system', label: 'System Entities', iconComponent: Server },
				{ href: '/dynamic-entities/bank?level=bank', label: 'Bank Entities', iconComponent: Landmark },
				{ href: '/dynamic-entities/manage', label: 'Manage', iconComponent: Settings }
			]
		},
		{
			id: 'connectors',
			label: 'Connectors',
			iconComponent: Workflow,
			basePaths: ['/connectors'],
			items: [
				{ href: '/connectors/list', label: 'All Connectors', iconComponent: Layers },
				{ href: '/connectors/methods', label: 'Methods', iconComponent: FileCode },
				{ href: '/connectors/config', label: 'Configuration', iconComponent: Settings }
			]
		},
		{
			id: 'api-config',
			label: 'API Configuration',
			iconComponent: Settings,
			basePaths: ['/api-config'],
			items: [
				{ href: '/api-config/endpoints', label: 'Endpoints', iconComponent: Globe },
				{ href: '/api-config/collections', label: 'Collections', iconComponent: Layers },
				{ href: '/api-config/versioning', label: 'Versioning', iconComponent: FileCode }
			]
		}
	];

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
		{sections}
		{logoUrl}
		{logoWidth}
		{isAuthenticated}
		currentPathname={page.url.pathname}
		currentSearch={page.url.search}
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
			<PageHeader {isAuthenticated} username={data.username} />

			<main class="flex flex-col overflow-auto" style="height: calc(100vh - 48px);">
				{@render children()}
			</main>
		</div>
	</div>
</div>

<!-- Global Toast Component -->
<Toast />

<!-- Welcome Bubble Component (appears once on first visit) -->
<WelcomeBubble welcomeMessage={env.PUBLIC_WELCOME_MESSAGE || ''} />
