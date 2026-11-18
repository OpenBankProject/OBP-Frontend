<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import '../app.css';
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { NavigationSidebar } from '@obp/shared/components';
	import type { NavigationItem, NavigationSection } from '@obp/shared/config';
	import { setRoleRequests } from '@obp/shared/roles';
	import { setOpeyStatusLinks } from '@obp/shared/opey';
	import {
		BookOpen,
		Building2,
		ClipboardCheck,
		FileCheck2,
		FlaskConical,
		Footprints,
		Gauge,
		House,
		KeyRound,
		ListChecks,
		ScrollText,
		Settings,
		ShieldCheck,
		SquareTerminal,
		Users
	} from '@lucide/svelte';

	/**
	 * Every page, in the Portal's and the API Manager's design: the shared sidebar on the left, a bar with the User
	 * and Log out above the page.
	 */
	let { data, children } = $props();

	// The shared role widgets send requests to this app's backend; administrators accept them in the API Manager.
	// Set once: the API Manager's address does not change while the app runs.
	const apiManager = untrack(() => data.apiManagerUrl);
	setRoleRequests({
		requestUrl: '/backend/rbac/entitlement-requests',
		requestsPageUrl: apiManager ? `${apiManager}/rbac/entitlement-requests` : '/setup',
		selectBankUrl: '/setup'
	});

	// The tool has no status or consents page of its own: Opey's lights link to the Portal's.
	setOpeyStatusLinks({
		get status() {
			return data.portalUrl ? `${data.portalUrl}/status` : null;
		},
		get consents() {
			return data.portalUrl ? `${data.portalUrl}/user/consents` : null;
		}
	});

	let displayMode: 'dark' | 'light' = $state('dark');
	// The Portal's logos: the light one on a light background, the dark one on a dark background.
	const logoUrl = $derived(displayMode === 'dark' ? '/obp_logo.png' : '/logo2x-1.png');

	const loginHref = $derived(
		page.url.pathname === '/' || page.url.pathname.startsWith('/login') ? '/login' : `/login?return_to=${encodeURIComponent(page.url.pathname + page.url.search)}`
	);

	/** The flat list at the top: what anyone can use, then what a logged-in User can. */
	const menuItems: NavigationItem[] = $derived([
		{ href: '/', label: 'Home', iconComponent: House },
		{ href: '/start', label: 'Getting started', iconComponent: Footprints },
		...((data.content.suites ?? 0) > 0 ? [{ href: '/catalogue', label: 'Test catalogue', iconComponent: BookOpen }] : []),
		...((data.content.reports ?? 0) > 0 ? [{ href: '/reports', label: 'Check a report', iconComponent: FileCheck2 }] : []),
		...(data.user ? [{ href: '/spaces', label: 'Your organisation', iconComponent: Building2 }] : []),
		...(data.isReviewer ? [{ href: '/reviews', label: 'Reviews', iconComponent: ClipboardCheck }] : []),
		...(data.user ? [{ href: '/setup', label: 'Setup', iconComponent: Settings }] : [])
	]);

	/** The regulator's staff pages, for Users who hold a staff Role; then the API Manager, as in the Portal. */
	const sections: NavigationSection[] = $derived([
		...(data.isStaff
			? [
					{
						id: 'staff',
						label: 'Staff',
						iconComponent: ShieldCheck,
						requiresAuth: true,
						defaultExpanded: true,
						basePaths: ['/staff'],
						items: [
							{ href: '/staff/dashboard', label: 'Dashboard', iconComponent: Gauge },
							{ href: '/staff/participants', label: 'Participants', iconComponent: Users },
							{ href: '/staff/suites', label: 'Suites and tests', iconComponent: ListChecks },
							{ href: '/staff/requirements', label: 'Requirements', iconComponent: ScrollText },
							{ href: '/staff/example-data', label: 'Example data', iconComponent: FlaskConical },
							{ href: '/staff/access', label: 'Your Roles', iconComponent: KeyRound }
						]
					}
				]
			: []),
		...(data.apiManagerUrl
			? [{ id: 'api-manager', label: 'API Manager', iconComponent: SquareTerminal, href: data.apiManagerUrl, external: true, items: [], basePaths: [] }]
			: [])
	]);

	const footerLinks = [{ href: 'https://github.com/OpenBankProject', label: 'GitHub', iconLight: '/github-mark.svg', iconDark: '/github-mark-white.svg' }];
</script>

<svelte:head>
	<title>Conformator</title>
</svelte:head>

<div class="grid h-screen w-full grid-cols-[auto_1fr] grid-rows-[minmax(0,1fr)] divide-x divide-solid divide-surface-100-900 overflow-hidden">
	<NavigationSidebar
		{menuItems}
		{sections}
		{logoUrl}
		logoWidth="70%"
		collapsedLogoUrl="/obp_logo_symbol_only.svg"
		isAuthenticated={data.user !== null}
		currentPathname={page.url.pathname}
		bind:displayMode
		{footerLinks}
		copyrightHolder="TESOBE"
		copyrightStartYear={2011}
	/>
	<div class="h-full min-w-0 bg-conic-250 from-30% via-40% to-50% dark:from-primary-950 dark:via-secondary-500/70 dark:to-primary-950">
		<div class="flex h-full flex-col backdrop-blur-2xl">
			<div class="z-10 flex shrink-0 items-center justify-end gap-4 px-4 py-2 shadow-md" style="height: 48px;">
				{#if data.user}
					<span class="hover:text-tertiary-400" data-testid="header-username">{data.user.username}</span>
					<form method="POST" action="/logout">
						<button type="submit" class="btn preset-outlined-primary-500" data-testid="logout">Logout</button>
					</form>
				{:else}
					<a href={loginHref} class="btn preset-filled-surface-950-50" data-testid="login">Login</a>
				{/if}
			</div>
			<main id="content" class="min-h-0 flex-1 overflow-auto px-4 py-8 md:px-8">
				<div class="max-w-5xl">{@render children()}</div>
			</main>
		</div>
	</div>
</div>
