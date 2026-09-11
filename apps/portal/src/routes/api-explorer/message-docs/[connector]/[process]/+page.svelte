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
	const doc = $derived(data.doc);

	function pretty(value: unknown): string {
		return JSON.stringify(value, null, 2);
	}
</script>

<svelte:head>
	<title>{doc.process} - {data.connectorLabel} - API Explorer</title>
	<meta name="description" content={doc.description} />
</svelte:head>

<article class="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
	<nav class="text-xs text-surface-600-400">
		<a class="anchor" href={explorerMessageDocsUrl(data.connector)}>&larr; {data.connectorLabel}</a>
	</nav>

	<header class="flex flex-col gap-2">
		<h1 class="font-mono text-xl font-semibold text-surface-900-50">{doc.process}</h1>
		{#if doc.description}
			<p class="text-sm text-surface-700-300">{doc.description}</p>
		{/if}
	</header>

	<p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-600-400">
		{#if doc.messageFormat}<span>Format <span class="font-mono">{doc.messageFormat}</span></span>{/if}
		{#if doc.group}<span>Group {doc.group}</span>{/if}
		{#if doc.suggestedOrder !== null}<span>Suggested order {doc.suggestedOrder}</span>{/if}
	</p>

	{#if doc.requiredFields.length > 0}
		<details class="border-t border-surface-300-600 pt-3">
			<summary class="cursor-pointer text-sm font-semibold text-surface-700-300">
				Required fields
				<span class="font-normal text-surface-600-400">({doc.requiredFields.length})</span>
			</summary>
			<dl class="mt-3 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1.5 text-xs">
				{#each doc.requiredFields as field (field.name)}
					<dt class="font-mono text-surface-800-200">{field.name}</dt>
					<dd class="break-words text-surface-600-400">
						{typeof field.value === 'string' ? field.value : pretty(field.value)}
					</dd>
				{/each}
			</dl>
		</details>
	{/if}

	{#if doc.exampleOutboundMessage}
		<details open class="border-t border-surface-300-600 pt-3">
			<summary class="cursor-pointer text-sm font-semibold text-surface-700-300">
				Outbound message <span class="font-normal text-surface-600-400">(OBP to adapter)</span>
			</summary>
			<pre class="mt-2 max-w-full overflow-x-auto rounded bg-surface-100-800 p-3 text-xs"><code
					>{pretty(doc.exampleOutboundMessage)}</code
				></pre>
		</details>
	{/if}

	{#if doc.exampleInboundMessage}
		<details open class="border-t border-surface-300-600 pt-3">
			<summary class="cursor-pointer text-sm font-semibold text-surface-700-300">
				Inbound message <span class="font-normal text-surface-600-400">(adapter to OBP)</span>
			</summary>
			<pre class="mt-2 max-w-full overflow-x-auto rounded bg-surface-100-800 p-3 text-xs"><code
					>{pretty(doc.exampleInboundMessage)}</code
				></pre>
		</details>
	{/if}
</article>
