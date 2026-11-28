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
		GET: 'ui-text-success',
		POST: 'ui-link',
		PUT: 'ui-text-warning',
		PATCH: 'ui-text-warning',
		DELETE: 'ui-text-error'
	};
</script>

<svelte:head>
	<title>{endpoint.verb} {endpoint.path} - API Explorer</title>
	<meta name="description" content={endpoint.summary} />
</svelte:head>

<article class="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
	<nav class="text-xs ui-muted">
		<a class="anchor" href={catalogueUrl}>&larr; {data.version.fullyQualifiedVersion}</a>
	</nav>

	<header class="flex flex-col gap-2">
		<h1 class="text-2xl font-semibold ui-text">{endpoint.summary}</h1>
		<p class="flex flex-wrap items-baseline gap-2 font-mono text-sm">
			<span class="font-semibold {verbClass[endpoint.verb] ?? ''}">{endpoint.verb}</span>
			<span class="break-all ui-text">{endpoint.path}</span>
		</p>
	</header>

	<!-- One quiet line for everything that identifies rather than explains. -->
	<p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ui-muted">
		<span class="font-mono">{endpoint.operationId}</span>
		{#if endpoint.roles.length > 0}
			<span>
				Roles:
				{#each endpoint.roles as role, i (role.role)}<span class="font-mono ui-muted"
						>{role.role}{#if role.requires_bank_id}<span class="font-sans"> (per bank)</span
							>{/if}</span
					>{#if i < endpoint.roles.length - 1}, {/if}{/each}
			</span>
		{:else}
			<span>No role required</span>
		{/if}
		{#each endpoint.tags as tag (tag)}
			<a
				class="rounded border px-1.5 py-0.5 ui-hover ui-border"
				href={explorerCatalogueUrl(data.version.urlPrefix, data.version.shortVersion, { tag })}
			>
				{tag}
			</a>
		{/each}
	</p>

	{#if endpoint.descriptionHtml}
		<section class="prose prose-sm max-w-prose dark:prose-invert">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- OBP's own endpoint documentation -->
			{@html endpoint.descriptionHtml}
		</section>
	{/if}

	{#if endpoint.specialInstructions}
		<aside class="rounded border p-3 text-sm ui-text ui-border">
			{endpoint.specialInstructions}
		</aside>
	{/if}

	<!--
		The reference material below is long and rarely the reason someone opened the page,
		so it is folded away. Native <details>: keyboard-operable and findable, no script.
	-->
	{#each endpoint.sections as section (section.title)}
		<details class="border-t pt-3 ui-border">
			<summary class="cursor-pointer text-sm font-semibold ui-muted">
				{section.title}
				<span class="font-normal ui-muted">({section.fields.length})</span>
			</summary>
			<dl class="mt-3 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1.5 text-xs">
				{#each section.fields as field (field.name)}
					<!-- A glossary link marks the term, it should not dim it: same colour, dotted rule. -->
					<dt class="font-mono ui-text">
						{#if field.href}
							<a
								class="underline decoration-dotted underline-offset-2 hover:decoration-solid"
								href={field.href}
								target="_blank"
								rel="noopener noreferrer"
							>
								{field.name}
							</a>
						{:else}
							{field.name}
						{/if}
					</dt>
					<dd class="break-words ui-muted">{field.text}</dd>
				{/each}
			</dl>
			{#if section.extraHtml}
				<div class="prose prose-sm mt-3 max-w-prose dark:prose-invert">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- OBP's own endpoint documentation -->
					{@html section.extraHtml}
				</div>
			{/if}
		</details>
	{/each}

	{#if endpoint.exampleRequestBody}
		<details class="border-t pt-3 ui-border">
			<summary class="cursor-pointer text-sm font-semibold ui-muted">
				Example request body
			</summary>
			<pre class="mt-2 max-w-full overflow-x-auto rounded p-3 text-xs ui-panel"><code
					>{pretty(endpoint.exampleRequestBody)}</code
				></pre>
		</details>
	{/if}

	{#if endpoint.successResponseBody}
		<details class="border-t pt-3 ui-border">
			<summary class="cursor-pointer text-sm font-semibold ui-muted">
				Example success response
			</summary>
			<pre class="mt-2 max-w-full overflow-x-auto rounded p-3 text-xs ui-panel"><code
					>{pretty(endpoint.successResponseBody)}</code
				></pre>
		</details>
	{/if}

	{#if endpoint.errorResponseBodies.length > 0}
		<details class="border-t pt-3 ui-border">
			<summary class="cursor-pointer text-sm font-semibold ui-muted">
				Possible errors
				<span class="font-normal ui-muted">({endpoint.errorResponseBodies.length})</span>
			</summary>
			<ul class="mt-2 flex flex-col gap-1 font-mono text-xs ui-muted">
				{#each endpoint.errorResponseBodies as err, i (i)}
					<li>{err}</li>
				{/each}
			</ul>
		</details>
	{/if}

	<footer class="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs ui-muted ui-border">
		{#if endpoint.implementedBy}
			<span>
				Implemented by <span class="font-mono">{endpoint.implementedBy.version}</span>
				<span class="font-mono">{endpoint.implementedBy.function}</span>
			</span>
		{/if}
		{#if endpoint.requestUrl && endpoint.requestUrl !== endpoint.path}
			<span>Originally <span class="font-mono">{endpoint.requestUrl}</span></span>
		{/if}
		{#if endpoint.connectorMethods.length > 0}
			<span>Connector: <span class="font-mono">{endpoint.connectorMethods.join(', ')}</span></span>
		{/if}
	</footer>
</article>
