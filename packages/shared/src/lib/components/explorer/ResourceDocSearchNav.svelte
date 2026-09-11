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
		/** Which half of the catalogue the API returned: 'all' | 'static' | 'dynamic'. */
		content?: string;
		/** Where the Static/Dynamic/All control should link, given a content value. */
		contentHref?: (content: string) => string;
		/** Given, the tag filter is the URL's: selecting one navigates rather than setting state. */
		onTagChange?: (tag: string) => void;
		/** Given, the search term is the URL's too, so a ?q= link arrives filtered. */
		onQueryChange?: (query: string) => void;
	}

	let {
		index,
		tags,
		activeOperationId = '',
		base = undefined,
		query = $bindable(''),
		tag = $bindable(''),
		content = 'all',
		contentHref,
		onTagChange,
		onQueryChange
	}: Props = $props();

	// Typing stays local so the list filters on every keystroke, but the URL is the source of
	// truth: when it changes — a documentation link, Back, a shared URL — the box follows it.
	let typed = $state(query);
	$effect(() => {
		typed = query;
	});


	// Plain links, not a JS toggle: the filter is applied by the API, so it belongs in the URL
	// where it can be shared, bookmarked and reloaded.
	const contentChoices = [
		{ value: 'all', label: 'All' },
		{ value: 'static', label: 'Static' },
		{ value: 'dynamic', label: 'Dynamic' }
	];

	const matches = $derived(searchIndex(index, typed, { tag: tag || undefined }));

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
	const searching = $derived(typed.trim().length > 0 || tag !== '');

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
	{#if contentHref}
		<div class="flex gap-1" role="group" aria-label="Endpoint catalogue">
			{#each contentChoices as choice (choice.value)}
				<a
					href={contentHref(choice.value)}
					class="flex-1 rounded px-2 py-1 text-center text-xs {content === choice.value
						? 'bg-surface-200-700 font-semibold text-surface-900-50'
						: 'text-surface-700-300 hover:bg-surface-100-800'}"
					aria-current={content === choice.value ? 'true' : undefined}
				>
					{choice.label}
				</a>
			{/each}
		</div>
	{/if}

	<input
		class="input"
		type="search"
		placeholder="Search endpoints"
		bind:value={typed}
		oninput={() => onQueryChange?.(typed)}
		aria-label="Search endpoints"
	/>

	{#if onTagChange}
		<select
			class="select"
			value={tag}
			onchange={(e) => onTagChange((e.currentTarget as HTMLSelectElement).value)}
			aria-label="Filter by tag"
		>
			<option value="">All tags ({index.length})</option>
			{#each tags as t (t.tag)}
				<option value={t.tag}>{t.tag} ({t.count})</option>
			{/each}
		</select>
	{:else}
		<select class="select" bind:value={tag} aria-label="Filter by tag">
			<option value="">All tags ({index.length})</option>
			{#each tags as t (t.tag)}
				<option value={t.tag}>{t.tag} ({t.count})</option>
			{/each}
		</select>
	{/if}

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
			<div class="flex flex-col items-start gap-2 px-2 py-4">
				<p class="text-sm text-surface-600-400">
					No endpoints match{tag ? ` the ${tag} tag` : ''}{content !== 'all'
						? ` in the ${content} catalogue`
						: ''}.
				</p>
				<!-- The likeliest reason for an empty list is a tag carried over from another
				     catalogue, so offer the way out rather than leaving a dead end. -->
				{#if tag && onTagChange}
					<button
						type="button"
						class="rounded border border-surface-300-600 px-2 py-1 text-xs text-surface-700-300 hover:bg-surface-100-800"
						onclick={() => onTagChange('')}
					>
						Clear tag
					</button>
				{/if}
			</div>
		{/each}
	</div>
</div>
