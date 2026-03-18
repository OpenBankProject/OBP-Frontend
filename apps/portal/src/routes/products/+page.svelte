<script lang="ts">
	import ProductCard from '$lib/components/ProductCard.svelte';
	import { currentBank } from '$lib/stores/currentBank.svelte';

	let { data } = $props();

	let sortedProducts = $derived(
		[...(data.products || [])].sort((a, b) => {
			const currentBankId = currentBank.bankId;
			const aIsCurrent = currentBankId && a.product.bank_id === currentBankId ? 0 : 1;
			const bIsCurrent = currentBankId && b.product.bank_id === currentBankId ? 0 : 1;
			if (aIsCurrent !== bIsCurrent) return aIsCurrent - bIsCurrent;
			const priceA = a.priceMonthly ?? 0;
			const priceB = b.priceMonthly ?? 0;
			return priceA - priceB;
		})
	);
</script>

<svelte:head>
	<title>API Products</title>
	<meta name="description" content="Browse and subscribe to API products and access tiers" />
</svelte:head>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8 text-center">
		<h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100">API Products</h1>
		<p class="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
			Choose the right API access tier for your needs. Each product includes different rate limits
			and access to specific API endpoints.
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
			{#each sortedProducts as product, i (`${product.product.bank_id}-${product.product.product_code}`)}
				<ProductCard
					{product}
					showSubscribeButton={true}
					isLoggedIn={data.isLoggedIn}
				/>
			{/each}
		</div>

		<p class="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
			{sortedProducts.length} product{sortedProducts.length === 1 ? '' : 's'} available
		</p>

		<!-- FAQ Section -->
		<div class="mt-16 border-t pt-8 dark:border-gray-700">
			<h2 class="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">
				Frequently Asked Questions
			</h2>
			<div class="grid gap-6 md:grid-cols-2">
				<div class="rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
					<h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">
						What are rate limits?
					</h3>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Rate limits control how many API requests you can make within a given time period.
						Higher tier products include more generous rate limits for production applications.
					</p>
				</div>
				<div class="rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
					<h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">
						Can I upgrade or downgrade?
					</h3>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Yes, you can change your subscription tier at any time. Changes take effect
						at the start of your next billing cycle.
					</p>
				</div>
				<div class="rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
					<h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">
						What endpoints are included?
					</h3>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Each product tier grants access to different API Collections. View the product
						details page to see which endpoints are included.
					</p>
				</div>
				<div class="rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
					<h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">
						How do I get started?
					</h3>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Sign in, choose a product tier, and complete the checkout process. You'll receive
						API credentials and access immediately after payment confirmation.
					</p>
				</div>
			</div>
		</div>
	{:else}
		<div class="rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-800">
			<p class="text-gray-600 dark:text-gray-400">
				No API products are available at this time.
			</p>
			<p class="mt-2 text-sm text-gray-500 dark:text-gray-500">
				Please check back later or contact support for more information.
			</p>
		</div>
	{/if}

</div>
