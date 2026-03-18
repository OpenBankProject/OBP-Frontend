<script lang="ts">
	import { Zap, Check, ArrowLeft, ExternalLink } from '@lucide/svelte';
	import EndpointCard from '$lib/components/EndpointCard.svelte';

	let { data } = $props();

	function formatPrice(price: number | undefined, currency: string = 'USD'): string {
		if (price === undefined || price === null) return '';
		if (price === 0) return 'Free';
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 2
		}).format(price);
	}

	function formatRateLimit(limit: number | undefined): string {
		if (limit === undefined || limit === null) return 'Not set';
		if (limit === 0) return 'Unlimited';
		if (limit >= 1000) return `${(limit / 1000).toFixed(0)}k`;
		return limit.toString();
	}

	// Determine tier styling
	function getTierStyle(productCode: string): { badge: string; badgeText: string } {
		const code = productCode.toLowerCase();
		if (code.includes('enterprise') || code.includes('premium')) {
			return {
				badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
				badgeText: 'Enterprise'
			};
		}
		if (code.includes('pro') || code.includes('professional')) {
			return {
				badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
				badgeText: 'Pro'
			};
		}
		if (code.includes('starter') || code.includes('basic') || code.includes('free')) {
			return {
				badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
				badgeText: 'Starter'
			};
		}
		return {
			badge: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
			badgeText: 'Standard'
		};
	}

	let tierStyle = $derived(getTierStyle(data.product.product.product_code));
</script>

<svelte:head>
	<title>{data.product.product.name} - API Products</title>
	<meta name="description" content={data.product.product.description || `Details for ${data.product.product.name}`} />
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<!-- Back link -->
	<a
		href="/products"
		class="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-300 mb-6"
	>
		<ArrowLeft class="h-4 w-4" />
		Back to Products
	</a>

	<!-- Product Header -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
		<div class="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
			<div class="flex-1">
				<span class="inline-flex rounded-full px-3 py-1 text-sm font-medium {tierStyle.badge}">
					{tierStyle.badgeText}
				</span>
				<h1 class="mt-3 text-3xl font-bold text-gray-900 dark:text-gray-100">
					{data.product.product.name}
				</h1>
				{#if data.product.product.description}
					<p class="mt-4 text-gray-600 dark:text-gray-400">
						{data.product.product.description}
					</p>
				{/if}
				{#if data.apiExplorerUrl && data.product.apiCollectionId}
					<a
						href="{data.apiExplorerUrl}/collections/{data.product.apiCollectionId}"
						target="_blank"
						rel="noopener noreferrer"
						class="mt-4 inline-flex items-center gap-1 text-sm text-primary-500 dark:text-primary-200 hover:underline"
					>
						View API Collection in API Explorer
						<ExternalLink class="h-3 w-3" />
					</a>
				{/if}
			</div>

			<div class="md:text-right">
				<div class="text-4xl font-bold text-gray-900 dark:text-gray-100">
					{formatPrice(data.product.priceMonthly, data.product.priceCurrency)}
				</div>
				{#if data.product.priceMonthly && data.product.priceMonthly > 0}
					<div class="text-gray-500 dark:text-gray-400">per month</div>
				{/if}

				<div class="mt-4">
					{#if data.isLoggedIn}
						<a
							href="/subscriptions?api_product_code={data.product.product.product_code}"
							class="btn preset-filled-primary-500 px-8"
						>
							Subscribe Now
						</a>
					{:else}
						<a
							href="/login?redirect=/subscriptions?api_product_code={data.product.product.product_code}"
							class="btn preset-outlined-primary-500 px-8"
						>
							Sign in to Subscribe
						</a>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Rate Limits & Features Grid -->
	<div class="grid gap-6 md:grid-cols-2 mb-8">
		<!-- Rate Limits Card -->
		{#if data.product.rateLimitPerMinute || data.product.rateLimitPerDay}
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
					Rate Limits
				</h2>
				<div class="space-y-3">
					{#if data.product.rateLimitPerMinute}
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Zap class="h-5 w-5 text-yellow-500" />
								<span class="text-gray-700 dark:text-gray-300">Requests per minute</span>
							</div>
							<span class="font-semibold text-gray-900 dark:text-gray-100">
								{formatRateLimit(data.product.rateLimitPerMinute)}
							</span>
						</div>
					{/if}
					{#if data.product.rateLimitPerDay}
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Zap class="h-5 w-5 text-yellow-500" />
								<span class="text-gray-700 dark:text-gray-300">Requests per day</span>
							</div>
							<span class="font-semibold text-gray-900 dark:text-gray-100">
								{formatRateLimit(data.product.rateLimitPerDay)}
							</span>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Features Card -->
		{#if data.product.features && data.product.features.length > 0}
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
					Features
				</h2>
				<ul class="space-y-2">
					{#each data.product.features as feature}
						<li class="flex items-start gap-2">
							<Check class="h-5 w-5 mt-0.5 text-green-500 flex-shrink-0" />
							<span class="text-gray-700 dark:text-gray-300">{feature}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<!-- Included Endpoints -->
	{#if data.endpoints.length > 0}
		<div class="mb-8">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
					Included API Endpoints
				</h2>
				<span class="text-sm text-gray-500 dark:text-gray-400">
					{data.endpointCount} endpoint{data.endpointCount === 1 ? '' : 's'}
				</span>
			</div>

			<div class="grid gap-4 md:grid-cols-2">
				{#each data.endpoints as endpoint (endpoint.operation_id)}
					<EndpointCard {endpoint} apiExplorerUrl={data.apiExplorerUrl} />
				{/each}
			</div>

			{#if data.apiExplorerUrl && data.product.apiCollectionId}
				<div class="mt-4 text-center">
					<a
						href="{data.apiExplorerUrl}/collections/{data.product.apiCollectionId}"
						target="_blank"
						rel="noopener noreferrer"
						class="text-sm text-primary-500 dark:text-primary-200 hover:underline inline-flex items-center gap-1"
					>
						View all endpoints in API Explorer
						<ExternalLink class="h-3 w-3" />
					</a>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Terms and More Info Links -->
	{#if data.product.product.terms_and_conditions_url || data.product.product.more_info_url}
		<div class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
			{#if data.product.product.terms_and_conditions_url}
				<a
					href={data.product.product.terms_and_conditions_url}
					target="_blank"
					rel="noopener noreferrer"
					class="hover:text-primary-500 dark:hover:text-primary-300"
				>
					Terms and Conditions
				</a>
			{/if}
			{#if data.product.product.more_info_url}
				<a
					href={data.product.product.more_info_url}
					target="_blank"
					rel="noopener noreferrer"
					class="hover:text-primary-500 dark:hover:text-primary-300"
				>
					More Information
				</a>
			{/if}
		</div>
	{/if}
</div>
