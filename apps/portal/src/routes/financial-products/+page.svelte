<script lang="ts">
	import { currentBank } from '$lib/stores/currentBank.svelte';

	let { data } = $props();

	let sortedProducts = $derived(
		[...(data.products || [])].sort((a, b) => {
			const currentBankId = currentBank.bankId;
			const aIsCurrent = currentBankId && a.bank_id === currentBankId ? 0 : 1;
			const bIsCurrent = currentBankId && b.bank_id === currentBankId ? 0 : 1;
			if (aIsCurrent !== bIsCurrent) return aIsCurrent - bIsCurrent;
			return (a.name || '').localeCompare(b.name || '');
		})
	);
</script>

<svelte:head>
	<title>Financial Products</title>
	<meta name="description" content="Browse financial products available across banks" />
</svelte:head>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8 text-center">
		<h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100">Financial Products</h1>
		<p class="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
			Browse banking products such as savings accounts, loans, and other financial services
			available across participating banks.
		</p>
	</div>

	{#if data.warnings && data.warnings.length > 0}
		<div class="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-900/20">
			{#each data.warnings as warning}
				<p class="text-sm text-yellow-700 dark:text-yellow-300">{warning}</p>
			{/each}
		</div>
	{/if}

	{#if data.error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-900/20">
			<p class="text-red-600 dark:text-red-400">{data.error}</p>
		</div>
	{:else if sortedProducts.length > 0}
		<!-- Products Grid -->
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each sortedProducts as product (product.bank_id + '/' + product.product_code)}
				<a
					href="/financial-products/{product.product_code}"
					class="block rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-lg dark:bg-gray-800"
				>
					<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
						{product.name}
					</h2>
					{#if product.description}
						<p class="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
							{product.description}
						</p>
					{/if}
					<div class="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
						<span class="rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-700">{product.bank_id}</span>
						<span class="rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-700">{product.product_code}</span>
					</div>
				</a>
			{/each}
		</div>

		<p class="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
			{sortedProducts.length} product{sortedProducts.length === 1 ? '' : 's'} available
		</p>
	{:else}
		<div class="rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-800">
			<p class="text-gray-600 dark:text-gray-400">
				No financial products are available at this time.
			</p>
			<p class="mt-2 text-sm text-gray-500 dark:text-gray-500">
				Please check back later or contact support for more information.
			</p>
		</div>
	{/if}
</div>
