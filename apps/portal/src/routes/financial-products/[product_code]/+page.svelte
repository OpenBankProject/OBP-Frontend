<script lang="ts">
	import { ArrowLeft, ExternalLink } from '@lucide/svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.product.name} - Financial Products</title>
	<meta name="description" content={data.product.description || `Details for ${data.product.name}`} />
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<!-- Back link -->
	<a
		href="/financial-products"
		class="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-300 mb-6"
	>
		<ArrowLeft class="h-4 w-4" />
		Back to Financial Products
	</a>

	<!-- Product Header -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
			{data.product.name}
		</h1>
		{#if data.product.description}
			<p class="mt-4 text-gray-600 dark:text-gray-400">
				{data.product.description}
			</p>
		{/if}
		<div class="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
			<span class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-700">Bank: {data.product.bank_id}</span>
			<span class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-700">Code: {data.product.product_code}</span>
		</div>
	</div>

	<!-- Attributes -->
	{#if data.product.product_attributes && data.product.product_attributes.length > 0}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
				Product Attributes
			</h2>
			<div class="divide-y dark:divide-gray-700">
				{#each data.product.product_attributes as attr}
					<div class="flex items-center justify-between py-3">
						<span class="text-gray-700 dark:text-gray-300">{attr.name}</span>
						<span class="font-medium text-gray-900 dark:text-gray-100">{attr.value}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Terms and More Info Links -->
	{#if data.product.terms_and_conditions_url || data.product.more_info_url}
		<div class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
			{#if data.product.terms_and_conditions_url}
				<a
					href={data.product.terms_and_conditions_url}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1 hover:text-primary-500 dark:hover:text-primary-300"
				>
					Terms and Conditions
					<ExternalLink class="h-3 w-3" />
				</a>
			{/if}
			{#if data.product.more_info_url}
				<a
					href={data.product.more_info_url}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1 hover:text-primary-500 dark:hover:text-primary-300"
				>
					More Information
					<ExternalLink class="h-3 w-3" />
				</a>
			{/if}
		</div>
	{/if}
</div>
