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
		logoUrl = '',
		logoWidth = '150px',
		homeHref = '/',
		homeLabel = 'Portal',
		base = undefined
	}: Props = $props();

	let width = $state(300);
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
		<ul class="flex shrink-0 flex-wrap gap-1 px-3 pt-2">
			{#each sectionLinks as link (link.href)}
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

	<div class="min-h-0 flex-1">
		{#if mode === 'endpoints'}
			<ResourceDocSearchNav {index} {tags} {activeOperationId} {base} />
		{:else}
			<ExplorerListNav
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
