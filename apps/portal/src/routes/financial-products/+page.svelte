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
		<h1 class="mb-2 text-3xl font-bold ui-text">Financial Products</h1>
		<p class="max-w-2xl mx-auto ui-muted">
			Browse banking products such as savings accounts, loans, and other financial services
			available across participating banks.
		</p>
	</div>

	{#if data.warnings && data.warnings.length > 0}
		<div class="mb-6 rounded-lg border p-4 ui-tone-warning">
			{#each data.warnings as warning}
				<p class="text-sm ui-text-warning">{warning}</p>
			{/each}
		</div>
	{/if}

	{#if data.message}
		<div class="rounded-lg border p-4 text-center ui-tone-error">
			<p class="ui-text-error">{data.message}</p>
		</div>
	{:else if sortedProducts.length > 0}
		<!-- Products Grid -->
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each sortedProducts as product (product.bank_id + '/' + product.product_code)}
				<a
					href="/financial-products/{encodeURIComponent(product.bank_id)}/{encodeURIComponent(product.product_code)}"
					class="block rounded-lg p-6 shadow transition-shadow hover:shadow-lg ui-card"
				>
					<h2 class="text-lg font-semibold ui-text">
						{product.name}
					</h2>
					{#if product.description}
						<p class="mt-2 text-sm line-clamp-3 ui-muted">
							{product.description}
						</p>
					{/if}
					<div class="mt-4 flex items-center gap-2 text-xs ui-muted">
						<span class="rounded px-2 py-0.5 ui-panel">{product.bank_id}</span>
						<span class="rounded px-2 py-0.5 ui-panel">{product.product_code}</span>
					</div>
				</a>
			{/each}
		</div>

		<p class="mt-8 text-center text-sm ui-muted">
			{sortedProducts.length} product{sortedProducts.length === 1 ? '' : 's'} available
		</p>
	{:else}
		<div class="rounded-lg p-8 text-center ui-panel">
			<p class="ui-muted">
				No Products Defined.
			</p>
		</div>
	{/if}
</div>
