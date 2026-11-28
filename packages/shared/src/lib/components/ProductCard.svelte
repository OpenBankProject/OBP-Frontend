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
    import type { APIProductDetails } from "$shared/obp/types";
    import { Zap, Check } from '@lucide/svelte';

    interface Props {
        product: APIProductDetails;
        showSubscribeButton?: boolean;
        isLoggedIn?: boolean;
    }

    let { product, showSubscribeButton = true, isLoggedIn = false }: Props = $props();

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

    // Determine tier styling based on product code
    function getTierStyle(productCode: string): { border: string; badge: string; badgeText: string } {
        const code = productCode.toLowerCase();
        if (code.includes('enterprise') || code.includes('premium')) {
            return {
                border: 'ui-border',
                badge: 'ui-tone-accent',
                badgeText: 'Enterprise'
            };
        }
        if (code.includes('pro') || code.includes('professional')) {
            return {
                border: 'ui-border',
                badge: 'ui-tone-info',
                badgeText: 'Pro'
            };
        }
        if (code.includes('starter') || code.includes('basic') || code.includes('free')) {
            return {
                border: 'ui-border',
                badge: 'ui-tone-success',
                badgeText: 'Starter'
            };
        }
        return {
            border: 'ui-border',
            badge: 'ui-tone-neutral',
            badgeText: 'Standard'
        };
    }

    let tierStyle = $derived(getTierStyle(product.product.product_code));
</script>

<div class="flex flex-col rounded-lg border-2 {tierStyle.border} p-6 shadow-sm transition-shadow hover:shadow-lg ui-card">
    <!-- Header with tier badge -->
    <div class="mb-4 flex items-start justify-between">
        <div class="flex-1">
            <span class="inline-flex rounded-full px-2 py-1 text-xs font-medium {tierStyle.badge}">
                {tierStyle.badgeText}
            </span>
            <h3 class="mt-2 text-xl font-bold ui-text">
                {product.product.name}
            </h3>
        </div>
    </div>

    <!-- Price -->
    <div class="mb-4">
        <span class="text-3xl font-bold ui-text">
            {formatPrice(product.priceMonthly, product.priceCurrency)}
        </span>
        {#if product.priceMonthly && product.priceMonthly > 0}
            <span class="ui-muted">/month</span>
        {/if}
    </div>

    <!-- Description -->
    {#if product.product.description}
        <p class="mb-4 text-sm flex-grow ui-muted">
            {product.product.description}
        </p>
    {/if}

    <!-- Rate Limits -->
    {#if product.rateLimitPerMinute || product.rateLimitPerDay}
        <div class="mb-4 space-y-2 text-sm">
            {#if product.rateLimitPerMinute}
                <div class="flex items-center gap-2">
                    <Zap class="h-4 w-4 ui-text-warning" />
                    <span class="ui-muted">
                        {formatRateLimit(product.rateLimitPerMinute)} requests/min
                    </span>
                </div>
            {/if}
            {#if product.rateLimitPerDay}
                <div class="flex items-center gap-2">
                    <Zap class="h-4 w-4 ui-text-warning" />
                    <span class="ui-muted">
                        {formatRateLimit(product.rateLimitPerDay)} requests/day
                    </span>
                </div>
            {/if}
        </div>
    {/if}

    <!-- Features -->
    {#if product.features && product.features.length > 0}
        <ul class="mb-6 space-y-2">
            {#each product.features as feature}
                <li class="flex items-start gap-2 text-sm ui-muted">
                    <Check class="h-4 w-4 mt-0.5 flex-shrink-0 ui-text-success" />
                    <span>{feature}</span>
                </li>
            {/each}
        </ul>
    {/if}

    <!-- Collection info -->
    {#if product.apiCollectionId}
        <div class="mb-4 text-xs ui-muted">
            <span>Collection: {product.apiCollectionId}</span>
            {#if product.endpointCount !== undefined}
                <span class="ms-2">&middot; {product.endpointCount} endpoint{product.endpointCount === 1 ? '' : 's'}</span>
            {/if}
        </div>
    {/if}

    <!-- Actions -->
    <div class="mt-auto pt-4 border-t space-y-2 ui-border">
        <a
            href="/products/{product.product.product_code}"
            class="block text-center text-sm hover:underline ui-text-brand"
        >
            View Details
        </a>
        {#if showSubscribeButton}
            {#if isLoggedIn}
                <a
                    href={`/subscriptions?bank_id=${encodeURIComponent(product.product.bank_id)}&api_product_code=${encodeURIComponent(product.product.product_code)}`}
                    class="btn preset-filled-primary-500 w-full text-center"
                >
                    Subscribe
                </a>
            {:else}
                <a
                    href={`/login?redirect=${encodeURIComponent(`/subscriptions?bank_id=${encodeURIComponent(product.product.bank_id)}&api_product_code=${encodeURIComponent(product.product.product_code)}`)}`}
                    class="btn preset-outlined-surface-500 w-full text-center"
                >
                    Sign in to Subscribe
                </a>
            {/if}
        {/if}
    </div>
</div>
