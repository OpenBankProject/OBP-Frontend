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
	/**
	 * A searchable list of links for the Explorer's left bar — glossary entries, message
	 * processes, gRPC services. The endpoint list has its own component because verbs carry
	 * colour and meaning; everything else is a name and a link.
	 */
	export interface ListNavItem {
		label: string;
		href: string;
		/** Shown quietly after the label: a count, a format, a group. */
		note?: string;
	}

	export interface ListNavGroup {
		name: string;
		items: ListNavItem[];
	}

	interface Props {
		groups: ListNavGroup[];
		activeHref?: string;
		placeholder?: string;
		/** Rendered above the search box: a connector picker, a source filter. */
		header?: import('svelte').Snippet;
		/** True when the caller filters server-side and the box should submit rather than filter. */
		emptyMessage?: string;
	}

	let {
		groups,
		activeHref = '',
		placeholder = 'Search',
		header,
		emptyMessage = 'Nothing matches.'
	}: Props = $props();

	let query = $state('');

	const filtered = $derived.by(() => {
		const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
		if (terms.length === 0) return groups;
		return groups
			.map((group) => ({
				name: group.name,
				items: group.items.filter((item) =>
					terms.every((t) => `${item.label} ${item.note ?? ''}`.toLowerCase().includes(t))
				)
			}))
			.filter((group) => group.items.length > 0);
	});

	const total = $derived(filtered.reduce((n, g) => n + g.items.length, 0));
</script>

<div class="flex h-full min-h-0 flex-col gap-2 p-3">
	{#if header}{@render header()}{/if}

	<input class="input" type="search" {placeholder} bind:value={query} aria-label={placeholder} />

	<p class="text-xs text-surface-600-400" aria-live="polite">{total}</p>

	<div class="min-h-0 flex-1 overflow-y-auto">
		{#each filtered as group (group.name)}
			{#if group.name}
				<h2 class="px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-surface-600-400">
					{group.name}
				</h2>
			{/if}
			<ul>
				{#each group.items as item (item.href)}
					<li>
						<a
							class="flex items-baseline justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-surface-100-800 {item.href ===
							activeHref
								? 'bg-surface-200-700 font-semibold'
								: ''}"
							href={item.href}
							aria-current={item.href === activeHref ? 'page' : undefined}
						>
							<span class="truncate text-surface-800-200">{item.label}</span>
							{#if item.note}
								<span class="shrink-0 text-surface-600-400">{item.note}</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="px-2 py-4 text-sm text-surface-600-400">{emptyMessage}</p>
		{/each}
	</div>
</div>
