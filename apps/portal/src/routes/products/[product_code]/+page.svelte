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
	import { Zap, Check, ArrowLeft, ExternalLink } from '@lucide/svelte';
	import { EndpointCard } from '@obp/shared/components';

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
				badge: 'ui-tone-accent',
				badgeText: 'Enterprise'
			};
		}
		if (code.includes('pro') || code.includes('professional')) {
			return {
				badge: 'ui-tone-info',
				badgeText: 'Pro'
			};
		}
		if (code.includes('starter') || code.includes('basic') || code.includes('free')) {
			return {
				badge: 'ui-tone-success',
				badgeText: 'Starter'
			};
		}
		return {
			badge: 'ui-panel ui-muted',
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
		class="inline-flex items-center gap-2 text-sm mb-6 ui-text-brand ui-muted"
	>
		<ArrowLeft class="h-4 w-4" />
		Back to Products
	</a>

	<!-- Product Header -->
	<div class="rounded-lg shadow-lg p-8 mb-8 ui-card">
		<div class="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
			<div class="flex-1">
				<span class="inline-flex rounded-full px-3 py-1 text-sm font-medium {tierStyle.badge}">
					{tierStyle.badgeText}
				</span>
				<h1 class="mt-3 text-3xl font-bold ui-text">
					{data.product.product.name}
				</h1>
				{#if data.product.product.description}
					<p class="mt-4 ui-muted">
						{data.product.product.description}
					</p>
				{/if}
				{#if data.apiExplorerUrl && data.product.apiCollectionId}
					<a
						href="{data.apiExplorerUrl}/collections/{data.product.apiCollectionId}"
						target="_blank"
						rel="noopener noreferrer"
						class="mt-4 inline-flex items-center gap-1 text-sm hover:underline ui-text-brand"
					>
						View API Collection in API Explorer
						<ExternalLink class="h-3 w-3" />
					</a>
				{/if}
			</div>

			<div class="md:text-right">
				<div class="text-4xl font-bold ui-text">
					{formatPrice(data.product.priceMonthly, data.product.priceCurrency)}
				</div>
				{#if data.product.priceMonthly && data.product.priceMonthly > 0}
					<div class="ui-muted">per month</div>
				{/if}

				<div class="mt-4">
					{#if data.isLoggedIn}
						<a
							href={`/subscriptions?bank_id=${encodeURIComponent(data.product.product.bank_id)}&api_product_code=${encodeURIComponent(data.product.product.product_code)}`}
							class="btn preset-filled-primary-500 px-8"
						>
							Subscribe Now
						</a>
					{:else}
						<a
							href={`/login?redirect=${encodeURIComponent(`/subscriptions?bank_id=${encodeURIComponent(data.product.product.bank_id)}&api_product_code=${encodeURIComponent(data.product.product.product_code)}`)}`}
							class="btn preset-outlined-surface-500 px-8"
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
			<div class="rounded-lg shadow p-6 ui-card">
				<h2 class="text-lg font-semibold mb-4 ui-text">
					Rate Limits
				</h2>
				<div class="space-y-3">
					{#if data.product.rateLimitPerMinute}
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Zap class="h-5 w-5 ui-text-warning" />
								<span class="ui-muted">Requests per minute</span>
							</div>
							<span class="font-semibold ui-text">
								{formatRateLimit(data.product.rateLimitPerMinute)}
							</span>
						</div>
					{/if}
					{#if data.product.rateLimitPerDay}
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Zap class="h-5 w-5 ui-text-warning" />
								<span class="ui-muted">Requests per day</span>
							</div>
							<span class="font-semibold ui-text">
								{formatRateLimit(data.product.rateLimitPerDay)}
							</span>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Features Card -->
		{#if data.product.features && data.product.features.length > 0}
			<div class="rounded-lg shadow p-6 ui-card">
				<h2 class="text-lg font-semibold mb-4 ui-text">
					Features
				</h2>
				<ul class="space-y-2">
					{#each data.product.features as feature}
						<li class="flex items-start gap-2">
							<Check class="h-5 w-5 mt-0.5 flex-shrink-0 ui-text-success" />
							<span class="ui-muted">{feature}</span>
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
				<h2 class="text-lg font-semibold ui-text">
					Included API Endpoints
				</h2>
				<span class="text-sm ui-muted">
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
						class="text-sm hover:underline inline-flex items-center gap-1 ui-text-brand"
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
		<div class="mt-6 text-center text-sm space-x-4 ui-muted">
			{#if data.product.product.terms_and_conditions_url}
				<a
					href={data.product.product.terms_and_conditions_url}
					target="_blank"
					rel="noopener noreferrer"
					class="ui-text-brand"
				>
					Terms and Conditions
				</a>
			{/if}
			{#if data.product.product.more_info_url}
				<a
					href={data.product.product.more_info_url}
					target="_blank"
					rel="noopener noreferrer"
					class="ui-text-brand"
				>
					More Information
				</a>
			{/if}
		</div>
	{/if}
</div>
