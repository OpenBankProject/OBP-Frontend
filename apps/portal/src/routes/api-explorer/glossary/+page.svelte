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
	import { explorerGlossaryTitleUrl } from '@obp/shared/explorer';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Glossary - API Explorer</title>
	<meta name="description" content="OBP terminology, concepts and error codes." />
</svelte:head>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
	<header class="flex flex-col gap-2">
		<h1 class="text-2xl font-semibold text-surface-900-50">Glossary</h1>
		<p class="text-sm text-surface-600-400">
			{data.rows.length}
			{data.rows.length === 1 ? 'entry' : 'entries'}{#if data.query}
				matching “{data.query}” of {data.total}{/if}. Searching covers entry bodies, not just
			titles.
		</p>
	</header>

	<form class="flex flex-wrap gap-2" data-testid="glossary-search">
		<input
			class="input min-w-64 flex-1"
			type="search"
			name="q"
			value={data.query}
			placeholder="Search titles and bodies"
			aria-label="Search the glossary"
		/>
		<button type="submit" class="btn preset-filled">Search</button>
		{#if data.query}
			<a class="btn preset-tonal" href="/api-explorer/glossary">Clear</a>
		{/if}
	</form>

	{#if data.loadError}
		<p class="text-sm text-red-700 dark:text-red-400" role="alert">{data.loadError}</p>
	{/if}

	{#if data.duplicateTitles.length > 0}
		<!-- Reported rather than hidden: two static items can legitimately share a title. -->
		<p class="text-xs text-surface-600-400">
			{data.duplicateTitles.length} duplicate {data.duplicateTitles.length === 1
				? 'title is'
				: 'titles are'} served by this glossary; the first of each is shown.
		</p>
	{/if}

	<ul class="flex flex-col divide-y divide-surface-300-600 border-y border-surface-300-600">
		{#each data.rows as row (row.title)}
			<li>
				<a class="flex flex-col gap-1 px-2 py-3 hover:bg-surface-100-800" href={explorerGlossaryTitleUrl(row.title)}>
					<span class="flex flex-wrap items-baseline gap-2">
						<span class="font-semibold text-surface-900-50">{row.title}</span>
						{#if row.is_dynamic}
							<span class="rounded border border-surface-300-600 px-1.5 text-xs text-surface-600-400">
								dynamic
							</span>
						{/if}
						{#if row.overrides_static_item}
							<span class="rounded border border-surface-300-600 px-1.5 text-xs text-surface-600-400">
								overrides a static item
							</span>
						{/if}
					</span>
					{#if row.excerpt}
						<span class="text-sm text-surface-600-400">{row.excerpt}</span>
					{/if}
				</a>
			</li>
		{:else}
			<li class="px-2 py-6 text-sm text-surface-600-400">No entry matches.</li>
		{/each}
	</ul>
</div>
