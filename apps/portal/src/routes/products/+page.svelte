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

	{#if data.message}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-900/20">
			<p class="text-red-600 dark:text-red-400">{data.message}</p>
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

		<div class="mt-16 border-t pt-8 text-center dark:border-gray-700">
			<p class="text-gray-600 dark:text-gray-400">
				Questions about rate limits, tiers or getting started? See the <a href="/faq" class="underline hover:text-gray-900 dark:hover:text-gray-100" data-testid="products-faq-link">FAQ</a>.
			</p>
		</div>
	{:else}
		<div class="rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-800">
			<p class="text-gray-600 dark:text-gray-400">
				No Products Defined.
			</p>
		</div>
	{/if}

</div>
