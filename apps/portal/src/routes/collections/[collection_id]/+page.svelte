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
	let { data } = $props();

	function getMethodColor(method: string): string {
		switch (method.toUpperCase()) {
			case 'GET':
				return 'ui-tone-success';
			case 'POST':
				return 'ui-tone-info';
			case 'PUT':
				return 'ui-tone-warning';
			case 'DELETE':
				return 'ui-tone-error';
			case 'PATCH':
				return 'ui-tone-accent';
			default:
				return 'ui-panel ui-muted';
		}
	}

	function buildApiExplorerUrl(operationId: string): string {
		if (!data.apiExplorerUrl) return '#';
		const hyphenIndex = operationId.indexOf('-');
		const version = hyphenIndex > 0 ? operationId.substring(0, hyphenIndex) : operationId;
		const baseUrl = data.apiExplorerUrl.replace(/\/$/, '');
		return `${baseUrl}/resource-docs/${version}?operationid=${operationId}`;
	}

	function buildTellMeMoreUrl(operationId: string): string {
		const question = `Tell me more about the API endpoint with operation ID: ${operationId}`;
		return `/?ask=${encodeURIComponent(question)}`;
	}
</script>

<svelte:head>
	<title>{data.collection?.api_collection_name || 'Collection'} - API Collection</title>
</svelte:head>

<div class="container mx-auto max-w-6xl px-4 py-8">
	{#if data.collection}
		<h1 class="mb-2 text-3xl font-bold ui-text">
			{data.collection.api_collection_name}
		</h1>

		{#if data.collection.description}
			<p class="mb-4 ui-muted">{data.collection.description}</p>
		{/if}

		<div class="mb-8 flex flex-wrap items-center gap-3">
			<span class="text-xs font-mono ui-muted">
				Collection ID: {data.collection.api_collection_id}
			</span>
			{#if data.apiExplorerUrl}
				<a
					href="{data.apiExplorerUrl}/resource-docs?api-collection-id={data.collection.api_collection_id}"
					target="_blank"
					rel="noopener noreferrer"
					class="text-xs hover:underline ui-text-brand"
				>
					View in API Explorer
				</a>
			{/if}
		</div>

		{#if data.endpoints && data.endpoints.length > 0}
			<h2 class="mb-4 text-xl font-semibold ui-text">
				Endpoints ({data.endpoints.length})
			</h2>

			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each data.endpoints as endpoint (endpoint.api_collection_endpoint_id)}
					<div class="flex flex-col rounded-lg border p-4 shadow-sm ui-card ui-border">
						<!-- Title -->
						<h3 class="text-base font-semibold ui-text">
							{endpoint.summary || endpoint.operation_id}
						</h3>

						<!-- Verb and Path -->
						{#if endpoint.request_verb}
							<div class="mt-2 flex flex-wrap items-center gap-2">
								<span class={`inline-flex rounded px-2 py-1 text-xs font-bold uppercase ${getMethodColor(endpoint.request_verb)}`}>
									{endpoint.request_verb}
								</span>
								<code class="text-xs font-medium break-all ui-muted">
									{endpoint.request_url}
								</code>
							</div>
						{/if}

						<!-- Tags -->
						{#if endpoint.tags && endpoint.tags.length > 0}
							<div class="mt-3 flex flex-wrap gap-1">
								{#each endpoint.tags.slice(0, 3) as tag}
									<span class="inline-flex rounded-full px-2 py-0.5 text-xs ui-panel ui-muted">
										{tag}
									</span>
								{/each}
								{#if endpoint.tags.length > 3}
									<span class="text-xs ui-muted">+{endpoint.tags.length - 3}</span>
								{/if}
							</div>
						{/if}

						<!-- Links -->
						<div class="mt-3 pt-3 border-t flex flex-col items-end gap-1 ui-border">
							<a
								href={buildTellMeMoreUrl(endpoint.operation_id)}
								class="text-xs hover:underline ui-text-brand"
								title="Ask Opey about this endpoint"
							>
								Tell Me More
							</a>
							<a
								href={buildApiExplorerUrl(endpoint.operation_id)}
								target="_blank"
								rel="noopener noreferrer"
								class="text-xs hover:underline ui-text-brand"
								title="View in API Explorer"
							>
								Explore: <span class="font-mono">{endpoint.operation_id}</span>
							</a>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="rounded-lg p-8 text-center ui-panel">
				<p class="ui-muted">
					No endpoints in this collection.
				</p>
			</div>
		{/if}
	{:else}
		<div class="rounded-lg border p-4 text-center ui-tone-error">
			<p class="ui-text-error">Collection not found or not sharable.</p>
		</div>
	{/if}
</div>
