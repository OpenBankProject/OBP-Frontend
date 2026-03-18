<script lang="ts">
	let { data } = $props();

	function getMethodColor(method: string): string {
		switch (method.toUpperCase()) {
			case 'GET':
				return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
			case 'POST':
				return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
			case 'PUT':
				return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
			case 'DELETE':
				return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
			case 'PATCH':
				return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
			default:
				return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
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
		<h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
			{data.collection.api_collection_name}
		</h1>

		{#if data.collection.description}
			<p class="mb-4 text-gray-600 dark:text-gray-400">{data.collection.description}</p>
		{/if}

		<div class="mb-8 flex flex-wrap items-center gap-3">
			<span class="text-xs text-gray-500 font-mono">
				Collection ID: {data.collection.api_collection_id}
			</span>
			{#if data.apiExplorerUrl}
				<a
					href="{data.apiExplorerUrl}/resource-docs?api-collection-id={data.collection.api_collection_id}"
					target="_blank"
					rel="noopener noreferrer"
					class="text-xs text-primary-500 dark:text-primary-200 hover:underline"
				>
					View in API Explorer
				</a>
			{/if}
		</div>

		{#if data.endpoints && data.endpoints.length > 0}
			<h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
				Endpoints ({data.endpoints.length})
			</h2>

			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each data.endpoints as endpoint (endpoint.api_collection_endpoint_id)}
					<div class="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
						<!-- Title -->
						<h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
							{endpoint.summary || endpoint.operation_id}
						</h3>

						<!-- Verb and Path -->
						{#if endpoint.request_verb}
							<div class="mt-2 flex flex-wrap items-center gap-2">
								<span class={`inline-flex rounded px-2 py-1 text-xs font-bold uppercase ${getMethodColor(endpoint.request_verb)}`}>
									{endpoint.request_verb}
								</span>
								<code class="text-xs font-medium text-gray-600 dark:text-gray-400 break-all">
									{endpoint.request_url}
								</code>
							</div>
						{/if}

						<!-- Tags -->
						{#if endpoint.tags && endpoint.tags.length > 0}
							<div class="mt-3 flex flex-wrap gap-1">
								{#each endpoint.tags.slice(0, 3) as tag}
									<span class="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
										{tag}
									</span>
								{/each}
								{#if endpoint.tags.length > 3}
									<span class="text-xs text-gray-400">+{endpoint.tags.length - 3}</span>
								{/if}
							</div>
						{/if}

						<!-- Links -->
						<div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-col items-end gap-1">
							<a
								href={buildTellMeMoreUrl(endpoint.operation_id)}
								class="text-xs text-secondary-500 dark:text-secondary-300 hover:underline"
								title="Ask Opey about this endpoint"
							>
								Tell Me More
							</a>
							<a
								href={buildApiExplorerUrl(endpoint.operation_id)}
								target="_blank"
								rel="noopener noreferrer"
								class="text-xs text-primary-500 dark:text-primary-200 hover:underline"
								title="View in API Explorer"
							>
								Explore: <span class="font-mono">{endpoint.operation_id}</span>
							</a>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-800">
				<p class="text-gray-600 dark:text-gray-400">
					No endpoints in this collection.
				</p>
			</div>
		{/if}
	{:else}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-900/20">
			<p class="text-red-600 dark:text-red-400">Collection not found or not sharable.</p>
		</div>
	{/if}
</div>
