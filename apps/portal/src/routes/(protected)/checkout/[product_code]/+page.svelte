<script lang="ts">
	import { page } from '$app/stores';
	import { Zap, Check, ShieldCheck, CreditCard, ArrowLeft } from '@lucide/svelte';

	let { data, form } = $props();

	// Check for cancelled checkout
	let wasCancelled = $derived($page.url.searchParams.get('cancelled') === 'true');

	function formatRateLimit(limit: number | undefined): string {
		if (!limit) return 'Unlimited';
		if (limit >= 1000) return `${(limit / 1000).toFixed(0)}k`;
		return limit.toString();
	}
</script>

<svelte:head>
	<title>Checkout - {data.product.product.name}</title>
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<!-- Back link -->
	<a
		href="/products/{data.product.product.product_code}"
		class="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-300 mb-6"
	>
		<ArrowLeft class="h-4 w-4" />
		Back to Product
	</a>

	<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
		Complete Your Order
	</h1>

	<!-- Cancelled Notice -->
	{#if wasCancelled}
		<div class="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
			<p class="text-yellow-700 dark:text-yellow-400">
				Your checkout was cancelled. You can try again when you're ready.
			</p>
		</div>
	{/if}

	<!-- Error Message -->
	{#if form?.error}
		<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
			<p class="text-red-600 dark:text-red-400 font-semibold">{form.error}</p>
		</div>
	{/if}

	<div class="grid gap-6 md:grid-cols-5">
		<!-- Order Summary -->
		<div class="md:col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
				Order Summary
			</h2>

			<div class="border-b dark:border-gray-700 pb-4 mb-4">
				<h3 class="font-medium text-gray-900 dark:text-gray-100">
					{data.product.product.name}
				</h3>
				{#if data.product.product.description}
					<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
						{data.product.product.description}
					</p>
				{/if}
			</div>

			<!-- What's Included -->
			<div class="space-y-3 mb-6">
				<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
					What's included:
				</h4>

				<div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
					<Zap class="h-4 w-4 text-yellow-500" />
					<span>{formatRateLimit(data.product.rateLimitPerMinute)} requests/min</span>
				</div>

				{#if data.product.rateLimitPerDay}
					<div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
						<Zap class="h-4 w-4 text-yellow-500" />
						<span>{formatRateLimit(data.product.rateLimitPerDay)} requests/day</span>
					</div>
				{/if}

				{#if data.product.features}
					{#each data.product.features as feature}
						<div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
							<Check class="h-4 w-4 text-green-500" />
							<span>{feature}</span>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Total -->
			<div class="border-t dark:border-gray-700 pt-4">
				<div class="flex justify-between items-center">
					<span class="text-gray-700 dark:text-gray-300">Total</span>
					<div class="text-right">
						<span class="text-2xl font-bold text-gray-900 dark:text-gray-100">
							{data.priceFormatted}
						</span>
						{#if data.product.priceMonthly && data.product.priceMonthly > 0}
							<span class="text-gray-500 dark:text-gray-400">/month</span>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Checkout Form -->
		<div class="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
				Account Details
			</h2>

			<div class="space-y-3 mb-6">
				<div>
					<label class="text-sm text-gray-600 dark:text-gray-400">Email</label>
					<p class="text-gray-900 dark:text-gray-100">{data.user.email}</p>
				</div>
				<div>
					<label class="text-sm text-gray-600 dark:text-gray-400">Username</label>
					<p class="text-gray-900 dark:text-gray-100">{data.user.username}</p>
				</div>
			</div>

			<form method="POST" action="?/checkout">
				{#if data.hasStripeIntegration && data.product.priceMonthly && data.product.priceMonthly > 0}
					<button
						type="submit"
						class="btn preset-filled-primary-500 w-full flex items-center justify-center gap-2"
					>
						<CreditCard class="h-5 w-5" />
						Pay with Stripe
					</button>
					<p class="mt-3 text-xs text-center text-gray-500 dark:text-gray-400">
						You'll be redirected to Stripe's secure payment page
					</p>
				{:else if !data.product.priceMonthly || data.product.priceMonthly === 0}
					<button
						type="submit"
						class="btn preset-filled-primary-500 w-full flex items-center justify-center gap-2"
					>
						<Check class="h-5 w-5" />
						Get Started Free
					</button>
				{:else}
					<button
						type="submit"
						class="btn preset-filled-primary-500 w-full flex items-center justify-center gap-2"
					>
						<ShieldCheck class="h-5 w-5" />
						Subscribe
					</button>
					<p class="mt-3 text-xs text-center text-gray-500 dark:text-gray-400">
						Your order will be processed and you'll receive access details by email
					</p>
				{/if}
			</form>

			<!-- Trust Badges -->
			<div class="mt-6 pt-4 border-t dark:border-gray-700">
				<div class="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
					<ShieldCheck class="h-4 w-4" />
					<span>Secure checkout</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Terms -->
	<p class="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
		By completing this purchase, you agree to our
		{#if data.product.product.terms_and_conditions_url}
			<a
				href={data.product.product.terms_and_conditions_url}
				target="_blank"
				rel="noopener noreferrer"
				class="text-primary-500 dark:text-primary-200 hover:underline"
			>
				Terms of Service
			</a>
		{:else}
			<span>Terms of Service</span>
		{/if}
		and
		<a href="/privacy" class="text-primary-500 dark:text-primary-200 hover:underline">
			Privacy Policy
		</a>.
	</p>
</div>
