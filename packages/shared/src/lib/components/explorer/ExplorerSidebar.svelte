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
	import ResourceDocSearchNav from './ResourceDocSearchNav.svelte';
	import ExplorerListNav from './ExplorerListNav.svelte';
	import type { ListNavGroup } from './ExplorerListNav.svelte';
	import PaneSplitter from './PaneSplitter.svelte';
	import { ArrowUpRight } from '@lucide/svelte';
	import type { ResourceDocIndexEntry } from '../../explorer/index.js';

	/**
	 * The Explorer's navigation, standing in for the app's own sidebar.
	 *
	 * Inside the Explorer the list of things *is* the navigation, so it takes the sidebar
	 * slot rather than becoming a third column beside it — that is how API Explorer II is
	 * laid out, and two navigation rails side by side would be one too many.
	 *
	 * Replacing the app's sidebar means replacing its way out, so the logo stays and links
	 * home.
	 */
	export interface ExplorerSectionLink {
		label: string;
		href: string;
		active: boolean;
		/** Leaves the Explorer. `lead` puts it before the sections, `away` after them; both are
		 *  separated from the section links by a divider, and open in a new tab when off-site. */
		lead?: boolean;
		away?: boolean;
		external?: boolean;
	}

	interface Props {
		/** Endpoints / Glossary / Message Docs / gRPC. */
		sectionLinks?: ExplorerSectionLink[];
		/** 'endpoints' uses the resource-doc nav; everything else is a plain list. */
		mode?: 'endpoints' | 'list';
		index?: ResourceDocIndexEntry[];
		tags?: Array<{ tag: string; count: number }>;
		activeOperationId?: string;
		listGroups?: ListNavGroup[];
		listActiveHref?: string;
		listPlaceholder?: string;
		/** Which half of the catalogue is shown, and how to link to another. */
		content?: string;
		contentHref?: (content: string) => string;
		/** The tag filter, when the URL owns it. */
		tag?: string;
		onTagChange?: (tag: string) => void;
		/** The search term, when the URL owns it. */
		query?: string;
		onQueryChange?: (query: string) => void;
		logoUrl?: string;
		logoWidth?: string;
		homeHref?: string;
		homeLabel?: string;
		base?: string;
	}

	let {
		sectionLinks = [],
		mode = 'endpoints',
		index = [],
		tags = [],
		activeOperationId = '',
		listGroups = [],
		listActiveHref = '',
		listPlaceholder = 'Search',
		content = 'all',
		contentHref = undefined,
		tag = '',
		onTagChange = undefined,
		query = '',
		onQueryChange = undefined,
		logoUrl = '',
		logoWidth = '150px',
		homeHref = '/',
		homeLabel = 'Portal',
		base = undefined
	}: Props = $props();

	// Endpoint names are long; 420px keeps most of them on one line. The splitter still lets a
	// reader take it down to 220 or out to 560.
	let width = $state(420);
</script>

<nav
	class="relative flex h-full min-h-0 flex-col overflow-hidden bg-primary-50 dark:bg-primary-950"
	style="width: {width}px"
	aria-label="API Explorer"
>
	<header class="flex shrink-0 items-center justify-between gap-2 px-3 pt-4 pb-1">
		{#if logoUrl}
			<a href={homeHref} class="flex items-center">
				<img class="block" style="width: {logoWidth};" src={logoUrl} alt="Logo" />
			</a>
		{/if}
		<a class="anchor shrink-0 text-xs" href={homeHref}>&larr; {homeLabel}</a>
	</header>

	{#if sectionLinks.length > 0}
		{@const awayLinks = [
			...sectionLinks.filter((l) => l.lead),
			...sectionLinks.filter((l) => l.away)
		]}
		{@const sections = sectionLinks.filter((l) => !l.lead && !l.away)}
		<!-- Two rows, because these are two kinds of link: where else you can go, then which
		     part of the Explorer you are in. Side by side they read as one list of peers. -->
		{#if awayLinks.length > 0}
			<ul class="flex shrink-0 flex-wrap items-center gap-1 px-3 pt-2">
				{#each awayLinks as link (link.href)}
					<li>
						<a
							class="flex items-center gap-1 rounded px-2 py-1 text-xs text-surface-700-300 hover:bg-surface-100-800"
							href={link.href}
							target={link.external ? '_blank' : undefined}
							rel={link.external ? 'noopener noreferrer' : undefined}
						>
							{link.label}
							{#if link.external}
								<ArrowUpRight class="size-3 shrink-0 opacity-60" />
								<span class="sr-only">(opens in a new tab)</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		{#if sections.length > 0}
			<ul class="flex shrink-0 flex-wrap items-center gap-1 px-3 pt-1">
				{#each sections as link (link.href)}
					<li>
						<a
							class="block rounded px-2 py-1 text-xs {link.active
								? 'bg-surface-200-700 font-semibold text-surface-900-50'
								: 'text-surface-700-300 hover:bg-surface-100-800'}"
							href={link.href}
							aria-current={link.active ? 'page' : undefined}
						>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	<div class="min-h-0 flex-1">
		{#if mode === 'endpoints'}
			<ResourceDocSearchNav
				{index}
				{tags}
				{activeOperationId}
				{base}
				{content}
				{contentHref}
				{tag}
				{onTagChange}
				{query}
				{onQueryChange}
			/>
		{:else}
			<ExplorerListNav
				{query}
				{onQueryChange}
				groups={listGroups}
				activeHref={listActiveHref}
				placeholder={listPlaceholder}
			/>
		{/if}
	</div>

	<div class="absolute inset-y-0 right-0 flex">
		<PaneSplitter
			bind:value={width}
			min={220}
			max={560}
			basis="viewport-px"
			label="Resize navigation"
		/>
	</div>
</nav>
