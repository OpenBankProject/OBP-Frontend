<script lang="ts">
	import {
		ChevronLeft,
		ChevronRight,
		User,
		ChevronDown
	} from '@lucide/svelte';
	import LightSwitch from '$lib/components/LightSwitch.svelte';
	import type { NavigationItem, NavigationSection } from '$lib/config/navigation';

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

	function isSectionActive(section: NavigationSection): boolean {
		return section.basePaths.some(
			(bp) => currentPathname === bp || currentPathname.startsWith(bp + '/')
		);
	}

	function isSubItemActive(href: string): boolean {
		const fullPath = currentPathname + (currentSearch ? currentSearch : '');
		return fullPath === href || currentPathname === href;
	}

	function tooltip(href: string, label: string): string {
		return getTooltip ? getTooltip(href, label) : label;
	}

	$effect(() => {
		if (isMyAccountActive) {
			isMyAccountExpanded = true;
		}
	});

	$effect(() => {
		for (const section of sections) {
			if (isSectionActive(section)) {
				expandedSections[section.id] = true;
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

<div class="relative h-full overflow-hidden">
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
		style="width: {isNavExpanded ? '256px' : '64px'}"
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
							{/if}
						</a>
					</li>
				{/each}
			</ul>

			{#if isAuthenticated}
				<!-- My Account -->
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

				<!-- Expandable Sections -->
				{#each sections as section (section.id)}
					{@const SectionIcon = section.iconComponent}
					<div class="mt-2 px-3">
						{#if isNavExpanded}
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
								<ul class="mt-1 ml-4 flex flex-col gap-1">
									{#each section.items as subItem (subItem.href)}
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
											</a>
										</li>
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
			{/if}
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
