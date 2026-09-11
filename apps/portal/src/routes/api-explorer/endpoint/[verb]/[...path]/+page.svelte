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
	import { explorerCatalogueUrl } from '@obp/shared/explorer';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const endpoint = $derived(data.endpoint);
	const catalogueUrl = $derived(
		explorerCatalogueUrl(data.version.urlPrefix, data.version.shortVersion)
	);

	function pretty(value: unknown): string {
		return JSON.stringify(value, null, 2);
	}

	const verbClass: Record<string, string> = {
		GET: 'text-emerald-700 dark:text-emerald-400',
		POST: 'text-blue-700 dark:text-blue-400',
		PUT: 'text-amber-700 dark:text-amber-400',
		PATCH: 'text-amber-700 dark:text-amber-400',
		DELETE: 'text-red-700 dark:text-red-400'
	};
</script>

<svelte:head>
	<title>{endpoint.verb} {endpoint.path} - API Explorer</title>
	<meta name="description" content={endpoint.summary} />
</svelte:head>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
	<nav class="text-sm">
		<a class="anchor" href={catalogueUrl}>
			&larr; {data.version.fullyQualifiedVersion} catalogue
		</a>
	</nav>

	<header class="flex flex-col gap-2">
		<div class="flex flex-wrap items-baseline gap-3">
			<span class="font-mono text-sm font-semibold {verbClass[endpoint.verb] ?? ''}">
				{endpoint.verb}
			</span>
			<span class="font-mono text-lg break-all text-surface-900-50">{endpoint.path}</span>
		</div>
		<h1 class="text-xl font-semibold text-surface-900-50">{endpoint.summary}</h1>
		<p class="font-mono text-xs text-surface-600-400">{endpoint.operationId}</p>
	</header>

	<div class="flex flex-wrap items-center gap-2">
		{#each endpoint.tags as tag (tag)}
			<a
				class="rounded border border-surface-300-600 px-2 py-0.5 text-xs text-surface-700-300 hover:bg-surface-100-800"
				href={explorerCatalogueUrl(data.version.urlPrefix, data.version.shortVersion, { tag })}
			>
				{tag}
			</a>
		{/each}
	</div>

	{#if endpoint.roles.length > 0}
		<section class="flex flex-col gap-2">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-surface-600-400">Roles</h2>
			<ul class="flex flex-col gap-1 text-sm">
				{#each endpoint.roles as role (role.role)}
					<li class="font-mono text-surface-900-50">
						{role.role}
						{#if role.requires_bank_id}
							<span class="ml-2 font-sans text-xs text-surface-600-400">requires a bank id</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<p class="text-sm text-surface-600-400">No role is required to call this endpoint.</p>
	{/if}

	{#if endpoint.descriptionHtml}
		<section class="prose max-w-none dark:prose-invert">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- OBP's own endpoint documentation -->
			{@html endpoint.descriptionHtml}
		</section>
	{/if}

	{#if endpoint.specialInstructions}
		<section class="flex flex-col gap-2">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-surface-600-400">
				Special instructions
			</h2>
			<p class="text-sm text-surface-900-50">{endpoint.specialInstructions}</p>
		</section>
	{/if}

	{#if endpoint.exampleRequestBody}
		<section class="flex flex-col gap-2">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-surface-600-400">
				Example request body
			</h2>
			<pre class="overflow-x-auto rounded bg-surface-100-800 p-4 text-xs"><code
					>{pretty(endpoint.exampleRequestBody)}</code
				></pre>
		</section>
	{/if}

	{#if endpoint.successResponseBody}
		<section class="flex flex-col gap-2">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-surface-600-400">
				Success response body
			</h2>
			<pre class="overflow-x-auto rounded bg-surface-100-800 p-4 text-xs"><code
					>{pretty(endpoint.successResponseBody)}</code
				></pre>
		</section>
	{/if}

	{#if endpoint.errorResponseBodies.length > 0}
		<section class="flex flex-col gap-2">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-surface-600-400">
				Possible errors
			</h2>
			<ul class="flex flex-col gap-1 font-mono text-xs text-surface-900-50">
				{#each endpoint.errorResponseBodies as err, i (i)}
					<li>{err}</li>
				{/each}
			</ul>
		</section>
	{/if}

	<footer class="flex flex-col gap-1 border-t border-surface-300-600 pt-4 text-xs text-surface-600-400">
		{#if endpoint.implementedBy}
			<p>
				Implemented by
				<span class="font-mono">{endpoint.implementedBy.version}</span>
				<span class="font-mono">{endpoint.implementedBy.function}</span>
			</p>
		{/if}
		{#if endpoint.requestUrl && endpoint.requestUrl !== endpoint.path}
			<p>Originally served at <span class="font-mono">{endpoint.requestUrl}</span></p>
		{/if}
		{#if endpoint.connectorMethods.length > 0}
			<p>Connector methods: <span class="font-mono">{endpoint.connectorMethods.join(', ')}</span></p>
		{/if}
	</footer>
</div>
