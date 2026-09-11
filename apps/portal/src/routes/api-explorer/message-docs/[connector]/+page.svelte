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
	import { explorerMessageDocsUrl } from '@obp/shared/explorer';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	/** The group an adapter author works through together; ungrouped messages come last. */
	const groups = $derived.by(() => {
		const byGroup = new Map<string, typeof data.rows>();
		for (const row of data.rows) {
			const key = row.group || 'Other';
			byGroup.set(key, [...(byGroup.get(key) ?? []), row]);
		}
		return [...byGroup.entries()]
			.map(([name, rows]) => ({ name, rows }))
			.sort((a, b) => (a.name === 'Other' ? 1 : b.name === 'Other' ? -1 : a.name.localeCompare(b.name)));
	});
</script>

<svelte:head>
	<title>{data.connectorLabel} message docs - API Explorer</title>
	<meta name="description" content="The messages OBP sends to a {data.connectorLabel} adapter." />
</svelte:head>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
	<header class="flex flex-col gap-2">
		<h1 class="text-2xl font-semibold text-surface-900-50">{data.connectorLabel}</h1>
		<p class="text-sm text-surface-600-400">
			{data.rows.length}
			{data.rows.length === 1 ? 'message' : 'messages'} OBP sends outwards to a
			<span class="font-mono">{data.connector}</span> adapter — the other half of the API.
		</p>
	</header>

	{#if data.loadError}
		<p class="text-sm text-red-700 dark:text-red-400" role="alert">{data.loadError}</p>
	{:else if data.rows.length === 0}
		<p class="text-sm text-surface-600-400">
			This OBP instance publishes no message docs for this connector.
		</p>
	{/if}

	{#if data.duplicateProcesses.length > 0}
		<p class="text-xs text-surface-600-400">
			{data.duplicateProcesses.length} duplicate {data.duplicateProcesses.length === 1
				? 'process is'
				: 'processes are'} served; the first of each is shown.
		</p>
	{/if}

	{#each groups as group (group.name)}
		<section class="flex flex-col gap-2">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-surface-600-400">{group.name}</h2>
			<ul class="flex flex-col divide-y divide-surface-300-600 border-y border-surface-300-600">
				{#each group.rows as row (row.process)}
					<li>
						<a
							class="flex flex-col gap-1 px-2 py-2 hover:bg-surface-100-800"
							href={explorerMessageDocsUrl(data.connector, row.process)}
						>
							<span class="flex flex-wrap items-baseline gap-2">
								{#if row.suggested_order !== null}
									<span class="w-8 shrink-0 text-xs text-surface-600-400">{row.suggested_order}</span>
								{/if}
								<span class="font-mono text-sm text-surface-900-50">{row.process}</span>
							</span>
							{#if row.description}
								<span class="text-sm text-surface-600-400">{row.description}</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>
