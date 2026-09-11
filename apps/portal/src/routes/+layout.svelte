<!--
  Copyright (C) 2025-2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { navigationSections } from '$lib/config/navigation';
	import Toast from '$lib/components/Toast.svelte';
	import WelcomeBubble from '$lib/components/WelcomeBubble.svelte';
	import { NavigationSidebar, ExplorerSidebar } from '@obp/shared/components';
	import type { NavigationSection } from '@obp/shared/config';
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
		MessageSquare,
		Code,
		Plug,
		GraduationCap, FileText, CircleHelp } from '@lucide/svelte';

	import { env } from '$env/dynamic/public';
	import { onMount } from 'svelte';
	import { unreadCount } from '$lib/stores/unreadCount.svelte';
	import { currentBank } from '$lib/stores/currentBank.svelte';
	let { data, children } = $props();

	/**
	 * The API Explorer brings its own navigation — the endpoint list is the navigation —
	 * so it takes the sidebar slot instead of appearing as another column beside it.
	 * Its data comes from the Explorer's own layout load, via page.data.
	 */
	const isExplorer = $derived(page.url.pathname.startsWith('/api-explorer'));

	/** Debounce handle for mirroring the search box into the URL. */
	let queryUrlTimer: ReturnType<typeof setTimeout>;

	/**
	 * API Manager sits in the domain order rather than in the list above it: it is a place
	 * you go, like the domains, and it belongs next to Support at the foot rather than
	 * competing with the shop window at the top. It renders as a plain link, not a group.
	 */
	const apiManagerLink: NavigationSection | null = $derived(
		data.externalLinks.API_MANAGER_URL
		? {
				id: 'api-manager',
				label: 'API Manager',
				iconComponent: SquareTerminal,
				href: data.externalLinks.API_MANAGER_URL,
				external: true,
				items: [],
				basePaths: []
			}
		: null
	);

	/** Inserts the API Manager link immediately before the Support domain. */
	function withApiManager(list: NavigationSection[]): NavigationSection[] {
		if (!apiManagerLink) return list;
		const at = list.findIndex((s) => s.id === 'support');
		const out = [...list];
		out.splice(at === -1 ? out.length : at, 0, apiManagerLink);
		return out;
	}

	/**
	 * Two links in Developing come from runtime config rather than the static structure: the MCP
	 * server, offered only when the API advertises one, and the standalone Explorer, whose URL is
	 * deployment-specific. The standalone app is API Explorer II; it goes above API Explorer III
	 * so the generations read in order.
	 */
	const sections: NavigationSection[] = $derived(
		withApiManager(navigationSections).map((section) => {
		if (section.id !== 'develop') return section;

		const subsections = (section.subsections ?? []).map((group) => {
			if (group.label === 'AI' && data.publicObpMcpUrl) {
				const mcp = {
					href: data.publicObpMcpUrl,
					label: 'MCP',
					iconComponent: Plug,
					external: true,
					description: 'Model Context Protocol server for OBP.'
				};
				return { ...group, items: [...group.items, mcp] };
			}
			if (group.label === 'Explore' && data.externalLinks.API_EXPLORER_URL) {
				const explorerII = {
					href: data.externalLinks.API_EXPLORER_URL,
					label: 'API Explorer II',
					iconComponent: Compass,
					external: true,
					description: 'The standalone Explorer app, usually just called the API Explorer.'
				};
				const at = group.items.findIndex((i) => i.href === '/api-explorer');
				const items = [...group.items];
				items.splice(at === -1 ? items.length : at, 0, explorerII);
				return { ...group, items };
			}
			return group;
		});
		return { ...section, subsections, items: subsections.flatMap((g) => g.items) };
		})
	);

	// Initialize unread count store from server data
	$effect(() => {
		unreadCount.set(data.totalUnreadCount || 0);
	});

	onMount(() => {
		if (data.userId) {
			currentBank.loadFromOBP();
		}
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
	/**
	 * The flat list above the domains: the other OBP apps, not pages of this one. Every
	 * Portal page now lives in a domain, so anything added here should be a link that
	 * leaves the Portal.
	 */
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
	class="grid h-screen w-full grid-cols-[auto_1fr] grid-rows-[minmax(0,1fr)] divide-x divide-solid divide-surface-100-900 overflow-hidden"
>
	{#if isExplorer}
		<ExplorerSidebar
			content={page.data.content ?? 'all'}
			tag={page.url.searchParams.get('tag') ?? ''}
			query={page.url.searchParams.get('q') ?? ''}
			onQueryChange={(value) => {
				// Debounced: the URL is the state, but not once per keystroke.
				clearTimeout(queryUrlTimer);
				queryUrlTimer = setTimeout(() => {
					const next = new URL(page.url);
					if (value) next.searchParams.set('q', value);
					else next.searchParams.delete('q');
					goto(next.pathname + next.search, {
						replaceState: true,
						keepFocus: true,
						noScroll: true
					});
				}, 300);
			}}
			onTagChange={(value) => {
				// The tag lives in the URL, so the chips on the catalogue page and this filter
				// are the same control seen twice. replaceState keeps Back meaning "the page
				// before", not "the tag before".
				const next = new URL(page.url);
				if (value) next.searchParams.set('tag', value);
				else next.searchParams.delete('tag');
				goto(next.pathname + next.search, { replaceState: true, keepFocus: true, noScroll: true });
			}}
			contentHref={(value) => {
				// Keep the rest of the query (a tag, a search) and only move `content`.
				const next = new URL(page.url);
				if (value === 'all') next.searchParams.delete('content');
				else next.searchParams.set('content', value);
				return next.pathname + next.search;
			}}
			sectionLinks={[
				// The apps this one sits between, first: the Explorer has taken the Portal's
				// sidebar, so its own way back belongs at the head of the bar.
				{ label: 'Portal', href: '/', active: false, lead: true },
				...(data.externalLinks.API_MANAGER_URL
					? [
							{
								label: 'Manager',
								href: data.externalLinks.API_MANAGER_URL,
								active: false,
								lead: true,
								external: true
							}
						]
					: []),
				{ label: 'Endpoints', href: '/api-explorer', active: page.data.section === 'endpoints' },
				{ label: 'Glossary', href: '/api-explorer/glossary', active: page.data.section === 'glossary' },
				{ label: 'Message Docs', href: '/api-explorer/message-docs', active: page.data.section === 'message-docs' },
				{ label: 'gRPC', href: '/api-explorer/grpc', active: page.data.section === 'grpc' },
				{ label: 'API Status', href: '/status', active: false, away: true }
			]}
			mode={page.data.section === 'endpoints' ? 'endpoints' : 'list'}
			index={page.data.index ?? []}
			tags={page.data.tags ?? []}
			activeOperationId={page.data.endpoint?.operationId ?? ''}
			listGroups={page.data.listGroups ?? []}
			listActiveHref={page.url.pathname}
			listPlaceholder={page.data.listPlaceholder ?? 'Search'}
			{logoUrl}
			{logoWidth}
		/>
	{:else}
	<NavigationSidebar
		{menuItems}
		{sections}
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
	{/if}
	<!-- min-w-0: a 1fr grid column still has min-width:auto, so a wide child (the
	     Explorer's panes) would otherwise push this column past the viewport. -->
	<div
		class={page.url.pathname.startsWith('/user/accounts')
			? 'h-full min-w-0 bg-surface-50-950'
			: 'h-full min-w-0 bg-conic-250 from-30% via-40% to-50% dark:from-primary-950 dark:via-secondary-500/70 dark:to-primary-950'}
		data-plain-bg={page.url.pathname.startsWith('/user/accounts')}
	>
		<div class="flex flex-col backdrop-blur-2xl" style="height: calc(100vh - 48px);">
			<div
				class="bg-opacity-0 flex items-center justify-end px-4 py-2 shadow-md z-10"
				style="height: 48px; flex-shrink: 0;"
			>
				{#if isAuthenticated}
					<a href="/user/chat" class="relative mr-2" title="Chat" data-testid="chat-nav-icon">
						<MessageSquare class="size-5 text-surface-300 hover:text-tertiary-400 transition-colors" />
						{#if unreadCount.total > 0}
							<span
								class="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full bg-primary-500 text-white text-[10px] font-bold min-w-[1rem] h-4 px-1"
								data-testid="chat-unread-badge"
							>
								{unreadCount.total > 99 ? '99+' : unreadCount.total}
							</span>
						{/if}
					</a>
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
