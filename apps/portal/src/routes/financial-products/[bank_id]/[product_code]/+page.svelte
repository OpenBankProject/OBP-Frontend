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
		class="inline-flex items-center gap-2 text-sm mb-6 ui-text-brand ui-muted"
	>
		<ArrowLeft class="h-4 w-4" />
		Back to Financial Products
	</a>

	<!-- Product Header -->
	<div class="rounded-lg shadow-lg p-8 mb-8 ui-card">
		<h1 class="text-3xl font-bold ui-text">
			{data.product.name}
		</h1>
		{#if data.product.description}
			<p class="mt-4 ui-muted">
				{data.product.description}
			</p>
		{/if}
		<div class="mt-4 flex items-center gap-2 text-sm ui-muted">
			<span class="rounded px-2 py-1 ui-panel">Bank: {data.product.bank_id}</span>
			<span class="rounded px-2 py-1 ui-panel">Code: {data.product.product_code}</span>
		</div>
	</div>

	<!-- Attributes -->
	{#if data.product.product_attributes && data.product.product_attributes.length > 0}
		<div class="rounded-lg shadow p-6 mb-8 ui-card">
			<h2 class="text-lg font-semibold mb-4 ui-text">
				Product Attributes
			</h2>
			<div class="divide-y ui-border">
				{#each data.product.product_attributes as attr}
					<div class="flex items-center justify-between py-3">
						<span class="ui-muted">{attr.name}</span>
						<span class="font-medium ui-text">{attr.value}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Terms and More Info Links -->
	{#if data.product.terms_and_conditions_url || data.product.more_info_url}
		<div class="mt-6 text-center text-sm space-x-4 ui-muted">
			{#if data.product.terms_and_conditions_url}
				<a
					href={data.product.terms_and_conditions_url}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1 ui-text-brand"
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
					class="inline-flex items-center gap-1 ui-text-brand"
				>
					More Information
					<ExternalLink class="h-3 w-3" />
				</a>
			{/if}
		</div>
	{/if}
</div>
