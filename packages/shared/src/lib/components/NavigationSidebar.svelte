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
	import {
		ChevronLeft,
		ChevronRight,
		User,
		ChevronDown,
		ArrowUpRight
	} from '@lucide/svelte';
	import LightSwitch from '$shared/components/LightSwitch.svelte';
	import type { NavigationItem, NavigationSection } from '$shared/config/navigation';

	interface FooterLink {
		href: string;
		label: string;
		iconLight?: string;
		iconDark?: string;
	}

	interface NavigationSidebarProps {
		menuItems: NavigationItem[];
		myAccountItems?: NavigationItem[];
		logoUrl: string;
		logoWidth?: string;
		collapsedLogoUrl?: string;
		isAuthenticated?: boolean;
		currentPathname: string;
		displayMode?: 'dark' | 'light';
		footerLinks?: FooterLink[];
		copyrightHolder?: string;
		copyrightStartYear?: number;
		sponsorImageUrl?: string;
		sponsorInfoUrl?: string;
		sponsorNote?: string;
		legacyPortalUrl?: string;
		hideFooterExtras?: boolean;
		sections?: NavigationSection[];
		currentSearch?: string;
		getTooltip?: (href: string, label: string) => string;
	}

	let {
		menuItems,
		myAccountItems = [],
		logoUrl,
		logoWidth = '100%',
		collapsedLogoUrl,
		isAuthenticated = false,
		currentPathname,
		displayMode = $bindable('dark'),
		footerLinks = [],
		copyrightHolder,
		copyrightStartYear,
		sponsorImageUrl,
		sponsorInfoUrl,
		sponsorNote,
		legacyPortalUrl,
		hideFooterExtras = false,
		sections = [],
		currentSearch = '',
		getTooltip
	}: NavigationSidebarProps = $props();

	let isNavExpanded = $state(true);
	let isMyAccountExpanded = $state(false);
	let expandedSections = $state<Record<string, boolean>>({});

	let isMyAccountActive = $derived(currentPathname.startsWith('/user'));

	let visibleSections = $derived(sections.filter((s) => isAuthenticated || !s.requiresAuth));

	/**
	 * How specifically a section claims the current path: the length of its longest matching
	 * basePath, or -1 for no match. A section that owns a whole route tree ('/user') and one
	 * that owns a branch of it ('/user/accounts') both match the branch, and the branch should
	 * win — otherwise two sections highlight and both expand.
	 */
	function matchStrength(section: NavigationSection): number {
		return section.basePaths.reduce(
			(best, bp) =>
				currentPathname === bp || currentPathname.startsWith(bp + '/')
					? Math.max(best, bp.length)
					: best,
			-1
		);
	}

	let activeSectionId = $derived(
		visibleSections.reduce<{ id: string | null; strength: number }>(
			(best, section) => {
				const strength = matchStrength(section);
				return strength > best.strength ? { id: section.id, strength } : best;
			},
			{ id: null, strength: -1 }
		).id
	);

	function isSectionActive(section: NavigationSection): boolean {
		return section.id === activeSectionId;
	}

	function isSubItemActive(href: string): boolean {
		const fullPath = currentPathname + (currentSearch ? currentSearch : '');
		return fullPath === href || currentPathname === href;
	}


	/** The site an off-site link leads to, e.g. 'obp-mcp.example.com', or '' if it is not a URL. */
	function externalHost(href: string): string {
		try {
			return new URL(href).host;
		} catch {
			return '';
		}
	}

	function tooltip(href: string, label: string): string {
		const base = getTooltip ? getTooltip(href, label) : label;
		const host = externalHost(href);
		return host ? `${base} — ${host} (opens in a new tab)` : base;
	}

	$effect(() => {
		if (isMyAccountActive) {
			isMyAccountExpanded = true;
		}
	});

	// Open on arrival: the section the current path belongs to, and any section that asks to
	// start open. Only ever opens — a section the visitor closed stays closed.
	let openedOnce = $state<Record<string, boolean>>({});
	$effect(() => {
		for (const section of sections) {
			if (isSectionActive(section)) {
				expandedSections[section.id] = true;
			} else if (section.defaultExpanded && !openedOnce[section.id]) {
				expandedSections[section.id] = true;
				openedOnce[section.id] = true;
			}
		}
	});

	function toggleMyAccount() {
		isMyAccountExpanded = !isMyAccountExpanded;
	}

	function toggleSection(id: string) {
		expandedSections[id] = !expandedSections[id];
	}

	function toggleNav() {
		isNavExpanded = !isNavExpanded;
	}
</script>

<div class="relative h-full overflow-visible">
	{#if isNavExpanded}
		<button
			type="button"
			onclick={toggleNav}
			class="absolute -right-6 top-6 z-10 flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
			title="Collapse navigation"
			aria-label="Collapse navigation"
		>
			<ChevronLeft class="size-5" />
		</button>
	{/if}

	<nav
		class="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-primary-50 dark:bg-primary-950
		       transition-[width] duration-200 ease-[cubic-bezier(0.165,0.85,0.45,1)]"
		style="width: {isNavExpanded ? '358px' : '64px'}"
	>
		<!-- Header -->
		<header class="shrink-0 relative px-3 pt-4 pb-2">
			<a
				href="/"
				class="flex w-full items-center justify-center transition-opacity duration-200"
				class:opacity-0={!isNavExpanded}
				class:pointer-events-none={!isNavExpanded}
			>
				<img class="block" style="width: {logoWidth};" src={logoUrl} alt="Logo" />
			</a>
			<button
				type="button"
				onclick={toggleNav}
				class="btn absolute top-1/2 left-0 right-0 -translate-y-1/2 w-full justify-start gap-3 px-3 hover:preset-tonal transition-opacity duration-200"
				class:opacity-0={isNavExpanded}
				class:pointer-events-none={isNavExpanded}
				title="Expand navigation"
				aria-label="Expand navigation"
			>
				<ChevronRight class="size-5" />
			</button>
		</header>

		<!-- Content -->
		<div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
			<!-- Main Menu -->
			<ul class="flex flex-col gap-2 px-3">
				{#each menuItems as item (item.href)}
					{@const Icon = item.iconComponent}
					<li>
						<a
							href={item.href}
							class="btn w-full justify-start gap-3 px-3 py-2 whitespace-nowrap overflow-hidden hover:preset-tonal"
							class:preset-filled-primary-50-950={currentPathname === item.href}
							class:border={currentPathname === item.href}
							class:border-solid-secondary-500={currentPathname === item.href}
							title={tooltip(item.href, item.label)}
							aria-label={item.label}
							target={item.external ? '_blank' : undefined}
							rel={item.external ? 'noopener noreferrer' : undefined}
						>
							<Icon class="size-5 shrink-0" />
							{#if isNavExpanded}
								<span class="overflow-hidden">{item.label}</span>
								{#if item.external}
									<ArrowUpRight class="size-3.5 shrink-0 opacity-60" />
									<span class="sr-only">(opens {externalHost(item.href)} in a new tab)</span>
								{/if}
							{/if}
						</a>
					</li>
				{/each}
			</ul>

			<!-- My Account. An app that puts these pages in a section of their own passes no
			     myAccountItems, and then this block has nothing to show rather than showing
			     an empty heading. -->
			{#if isAuthenticated && myAccountItems.length > 0}
				<div class="mt-2 px-3">
					{#if isNavExpanded}
						<button
							type="button"
							class="hover:bg-surface-100-800 flex w-full items-center justify-between rounded-md p-3 text-left transition-colors"
							class:bg-primary-100-800={isMyAccountActive}
							onclick={toggleMyAccount}
						>
							<div class="flex items-center gap-3 whitespace-nowrap overflow-hidden">
								<User class="h-5 w-5 shrink-0" />
								<span>My Account</span>
							</div>
							{#if isMyAccountExpanded}
								<ChevronDown class="h-4 w-4 shrink-0" />
							{:else}
								<ChevronRight class="h-4 w-4 shrink-0" />
							{/if}
						</button>

						{#if isMyAccountExpanded}
							<ul class="mt-1 ml-4 flex flex-col gap-1">
								{#each myAccountItems as subItem (subItem.href)}
									{@const Icon = subItem.iconComponent}
									<li>
										<a
											href={subItem.href}
											class="btn w-full justify-start gap-3 px-2 pl-6 text-sm whitespace-nowrap overflow-hidden hover:preset-tonal"
											class:preset-filled-secondary-50-950={currentPathname === subItem.href}
											class:border-l-2={currentPathname === subItem.href}
											class:border-primary-500={currentPathname === subItem.href}
											title={tooltip(subItem.href, subItem.label)}
											aria-label={subItem.label}
											target={subItem.external ? '_blank' : undefined}
											rel={subItem.external ? 'noopener noreferrer' : undefined}
										>
											<Icon class="size-4 shrink-0" />
											<span>{subItem.label}</span>
											{#if subItem.external}
												<ArrowUpRight class="size-3 shrink-0 opacity-60" />
												<span class="sr-only">(opens {externalHost(subItem.href)} in a new tab)</span>
											{/if}
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					{:else}
						<a
							href="/user"
							class="btn w-full justify-start gap-3 px-3 py-2 hover:preset-tonal"
							class:preset-filled-primary-50-950={isMyAccountActive}
							title="My Account"
							aria-label="My Account"
						>
							<User class="size-5" />
						</a>
					{/if}
				</div>

			{/if}

			<!-- Expandable Sections. A section marked requiresAuth is for signed-in visitors;
			     the rest (documentation, catalogue, support) are part of the public site. -->
			{#each visibleSections as section (section.id)}
					{@const SectionIcon = section.iconComponent}
					<div class="mt-2 px-3">
						{#if section.href}
							<a
								href={section.href}
								class="btn w-full justify-start gap-3 p-3 whitespace-nowrap overflow-hidden hover:preset-tonal"
								class:preset-filled-primary-50-950={currentPathname === section.href}
								title={tooltip(section.href, section.label)}
								aria-label={section.label}
								target={section.external ? '_blank' : undefined}
								rel={section.external ? 'noopener noreferrer' : undefined}
							>
								<SectionIcon class="size-5 shrink-0" />
								{#if isNavExpanded}
									<span>{section.label}</span>
									{#if section.external}
										<ArrowUpRight class="size-3.5 shrink-0 opacity-60" />
										<span class="sr-only">(opens {externalHost(section.href ?? '')} in a new tab)</span>
									{/if}
								{/if}
							</a>
						{:else if isNavExpanded}
							<button
								type="button"
								class="hover:bg-surface-100-800 flex w-full items-center justify-between rounded-md p-3 text-left transition-colors"
								class:bg-primary-100-800={isSectionActive(section)}
								onclick={() => toggleSection(section.id)}
							>
								<div class="flex items-center gap-3 whitespace-nowrap overflow-hidden">
									<SectionIcon class="h-5 w-5 shrink-0" />
									<span>{section.label}</span>
								</div>
								{#if expandedSections[section.id]}
									<ChevronDown class="h-4 w-4 shrink-0" />
								{:else}
									<ChevronRight class="h-4 w-4 shrink-0" />
								{/if}
							</button>

							{#if expandedSections[section.id]}
								{@const subsections = (section.subsections ?? [{ label: '', items: section.items }])
									.map((g) => ({
										...g,
										items: g.items.filter((i) => isAuthenticated || !i.requiresAuth)
									}))
									.filter((g) => g.items.length > 0)}
								<ul class="mt-1 ml-4 flex flex-col gap-1">
									{#each subsections as group (group.label)}
										{#if group.label}
											<li
												class="text-surface-500 mt-2 px-2 pl-6 text-[11px] font-semibold tracking-wider uppercase"
												data-testid="nav-subsection-{group.label}"
											>
												{group.label}
											</li>
										{/if}
										{#each group.items as subItem (subItem.href)}
										{@const SubIcon = subItem.iconComponent}
										<li>
											<a
												href={subItem.href}
												class="btn w-full justify-start gap-3 px-2 pl-6 text-sm whitespace-nowrap overflow-hidden hover:preset-tonal"
												class:preset-filled-secondary-50-950={isSubItemActive(subItem.href)}
												class:border-l-2={isSubItemActive(subItem.href)}
												class:border-primary-500={isSubItemActive(subItem.href)}
												title={tooltip(subItem.href, subItem.label)}
												aria-label={subItem.label}
												target={subItem.external ? '_blank' : undefined}
												rel={subItem.external ? 'noopener noreferrer' : undefined}
											>
												<SubIcon class="size-4 shrink-0" />
												<span>{subItem.label}</span>
												{#if subItem.external}
													<ArrowUpRight class="size-3 shrink-0 opacity-60" />
													<span class="sr-only">(opens {externalHost(subItem.href)} in a new tab)</span>
												{/if}
											</a>
										</li>
										{/each}
									{/each}
								</ul>
							{/if}
						{:else}
							<a
								href={section.basePaths[0]}
								class="btn w-full justify-start gap-3 px-3 py-2 hover:preset-tonal"
								class:preset-filled-primary-50-950={isSectionActive(section)}
								title={tooltip(section.basePaths[0], section.label)}
								aria-label={section.label}
							>
								<SectionIcon class="size-5" />
							</a>
						{/if}
					</div>
				{/each}
		</div>

		<!-- Footer -->
		<footer class="shrink-0 px-3 pt-2 pb-4">
			{#if !isNavExpanded && collapsedLogoUrl}
				<div class="flex justify-center">
					<a href="/" title="Home">
						<img src={collapsedLogoUrl} alt="Logo" class="max-w-10 max-h-10 object-contain" />
					</a>
				</div>
			{:else if isNavExpanded}
				<div class="flex flex-wrap items-center gap-3 text-xs text-surface-800-200">
					<LightSwitch bind:mode={displayMode} />
					{#each footerLinks as link (link.href)}
						<a href={link.href} class="flex items-center gap-2 hover:text-tertiary-400">
							{#if link.iconLight && link.iconDark}
								<img
									class="h-4"
									alt="{link.label} logo"
									src={displayMode === 'dark' ? link.iconDark : link.iconLight}
								/>
							{/if}
							{link.label}
						</a>
					{/each}
					<a href="/about" class="hover:text-tertiary-400">About</a>
					{#if !hideFooterExtras && copyrightHolder && copyrightStartYear}
						<span> © {copyrightHolder} {copyrightStartYear}-{Math.max(new Date().getFullYear(), 2026)} </span>
					{/if}
					{#if sponsorNote}
						<span class="text-surface-800-200">{sponsorNote}</span>
					{/if}
					{#if sponsorImageUrl}
						{#if sponsorInfoUrl}
							<a href={sponsorInfoUrl} target="_blank" rel="noopener noreferrer">
								<img src={sponsorImageUrl} alt="Sponsor" class="h-6" />
							</a>
						{:else}
							<img src={sponsorImageUrl} alt="Sponsor" class="h-6" />
						{/if}
					{/if}
					{#if legacyPortalUrl}
						<a
							href={legacyPortalUrl}
							class="w-full justify-start text-xs text-tertiary-700-300 hover:underline"
							aria-label="Switch to Legacy Portal"
						>
							<span>Switch to Legacy Portal</span>
						</a>
					{/if}
				</div>
			{/if}
		</footer>
	</nav>
</div>
