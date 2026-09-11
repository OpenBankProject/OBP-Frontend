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
	import { searchIndex, explorerEndpointUrl, type ResourceDocIndexEntry } from '../../explorer/index.js';

	/**
	 * The Explorer's left bar: search, tag filter, and every endpoint of the current
	 * catalogue grouped by tag. Search runs against the in-memory index, so filtering is
	 * immediate and needs no round trip.
	 */
	interface Props {
		index: ResourceDocIndexEntry[];
		tags: Array<{ tag: string; count: number }>;
		/** Highlighted while its page is open. */
		activeOperationId?: string;
		base?: string;
		query?: string;
		tag?: string;
	}

	let {
		index,
		tags,
		activeOperationId = '',
		base = undefined,
		query = $bindable(''),
		tag = $bindable('')
	}: Props = $props();

	const matches = $derived(searchIndex(index, query, { tag: tag || undefined }));

	/** Grouped by first tag, so the bar reads like the API's own table of contents. */
	const groups = $derived.by(() => {
		const byTag = new Map<string, ResourceDocIndexEntry[]>();
		for (const entry of matches) {
			const key = entry.tags[0] ?? 'Untagged';
			const list = byTag.get(key) ?? [];
			list.push(entry);
			byTag.set(key, list);
		}
		// Dynamic entities generate one underscore-prefixed tag each and there are hundreds
		// of them, so they sort after the API's own tags rather than burying Account and Bank.
		const generated = (name: string) => (name.startsWith('_') ? 1 : 0);
		return [...byTag.entries()]
			.map(([name, entries]) => ({ name, entries }))
			.sort((a, b) => generated(a.name) - generated(b.name) || a.name.localeCompare(b.name));
	});

	// A group opens when the user opens it, or while a search is narrowing things down.
	let opened = $state<Record<string, boolean>>({});
	const searching = $derived(query.trim().length > 0 || tag !== '');

	function isOpen(name: string, hasActive: boolean): boolean {
		return opened[name] ?? (searching || hasActive);
	}

	const verbClass: Record<string, string> = {
		GET: 'text-emerald-700 dark:text-emerald-400',
		POST: 'text-blue-700 dark:text-blue-400',
		PUT: 'text-amber-700 dark:text-amber-400',
		PATCH: 'text-amber-700 dark:text-amber-400',
		DELETE: 'text-red-700 dark:text-red-400'
	};
</script>

<div class="flex h-full min-h-0 flex-col gap-2 p-3">
	<input
		class="input"
		type="search"
		placeholder="Search endpoints"
		bind:value={query}
		aria-label="Search endpoints"
	/>

	<select class="select" bind:value={tag} aria-label="Filter by tag">
		<option value="">All tags ({index.length})</option>
		{#each tags as t (t.tag)}
			<option value={t.tag}>{t.tag} ({t.count})</option>
		{/each}
	</select>

	<p class="text-xs text-surface-600-400" aria-live="polite">
		{matches.length}
		{matches.length === 1 ? 'endpoint' : 'endpoints'}
	</p>

	<div class="min-h-0 flex-1 overflow-y-auto">
		{#each groups as group (group.name)}
			{@const hasActive = group.entries.some((e) => e.operationId === activeOperationId)}
			{@const open = isOpen(group.name, hasActive)}
			<div class="mb-1">
				<button
					type="button"
					class="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm font-semibold text-surface-900-50 hover:bg-surface-100-800"
					aria-expanded={open}
					onclick={() => (opened[group.name] = !open)}
				>
					<span class="truncate">{group.name}</span>
					<span class="shrink-0 text-xs font-normal text-surface-600-400">
						{group.entries.length}
						<span aria-hidden="true">{open ? '▾' : '▸'}</span>
					</span>
				</button>

				{#if open}
					<ul class="ml-2 border-l border-surface-300-600">
						{#each group.entries as entry (entry.operationId + entry.path)}
							<li>
								<a
									class="flex gap-2 py-1 pl-2 pr-1 text-xs hover:bg-surface-100-800 {entry.operationId ===
									activeOperationId
										? 'bg-surface-200-700 font-semibold'
										: ''}"
									href={explorerEndpointUrl(entry.verb, entry.path, { base })}
									aria-current={entry.operationId === activeOperationId ? 'page' : undefined}
								>
									<span class="w-11 shrink-0 font-mono {verbClass[entry.verb] ?? ''}">{entry.verb}</span>
									<span class="truncate text-surface-800-200">{entry.summary || entry.path}</span>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{:else}
			<p class="px-2 py-4 text-sm text-surface-600-400">No endpoints match.</p>
		{/each}
	</div>
</div>
