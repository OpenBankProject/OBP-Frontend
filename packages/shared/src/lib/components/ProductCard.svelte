<script lang="ts">
    import type { APIProductDetails } from "$lib/obp/types";
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
                border: 'border-purple-200 dark:border-purple-700',
                badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                badgeText: 'Enterprise'
            };
        }
        if (code.includes('pro') || code.includes('professional')) {
            return {
                border: 'border-blue-200 dark:border-blue-700',
                badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                badgeText: 'Pro'
            };
        }
        if (code.includes('starter') || code.includes('basic') || code.includes('free')) {
            return {
                border: 'border-green-200 dark:border-green-700',
                badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                badgeText: 'Starter'
            };
        }
        return {
            border: 'border-gray-200 dark:border-gray-700',
            badge: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
            badgeText: 'Standard'
        };
    }

    let tierStyle = $derived(getTierStyle(product.product.product_code));
</script>

<div class="flex flex-col rounded-lg border-2 {tierStyle.border} bg-white p-6 shadow-sm transition-shadow hover:shadow-lg dark:bg-gray-800">
    <!-- Header with tier badge -->
    <div class="mb-4 flex items-start justify-between">
        <div class="flex-1">
            <span class="inline-flex rounded-full px-2 py-1 text-xs font-medium {tierStyle.badge}">
                {tierStyle.badgeText}
            </span>
            <h3 class="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
                {product.product.name}
            </h3>
        </div>
    </div>

    <!-- Price -->
    <div class="mb-4">
        <span class="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {formatPrice(product.priceMonthly, product.priceCurrency)}
        </span>
        {#if product.priceMonthly && product.priceMonthly > 0}
            <span class="text-gray-500 dark:text-gray-400">/month</span>
        {/if}
    </div>

    <!-- Description -->
    {#if product.product.description}
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400 flex-grow">
            {product.product.description}
        </p>
    {/if}

    <!-- Rate Limits -->
    {#if product.rateLimitPerMinute || product.rateLimitPerDay}
        <div class="mb-4 space-y-2 text-sm">
            {#if product.rateLimitPerMinute}
                <div class="flex items-center gap-2">
                    <Zap class="h-4 w-4 text-yellow-500" />
                    <span class="text-gray-700 dark:text-gray-300">
                        {formatRateLimit(product.rateLimitPerMinute)} requests/min
                    </span>
                </div>
            {/if}
            {#if product.rateLimitPerDay}
                <div class="flex items-center gap-2">
                    <Zap class="h-4 w-4 text-yellow-500" />
                    <span class="text-gray-700 dark:text-gray-300">
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
                <li class="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check class="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                </li>
            {/each}
        </ul>
    {/if}

    <!-- Collection info -->
    {#if product.apiCollectionId}
        <div class="mb-4 text-xs text-gray-400 dark:text-gray-500">
            <span>Collection: {product.apiCollectionId}</span>
            {#if product.endpointCount !== undefined}
                <span class="ml-2">&middot; {product.endpointCount} endpoint{product.endpointCount === 1 ? '' : 's'}</span>
            {/if}
        </div>
    {/if}

    <!-- Actions -->
    <div class="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
        <a
            href="/products/{product.product.product_code}"
            class="block text-center text-sm text-primary-500 dark:text-primary-200 hover:underline"
        >
            View Details
        </a>
        {#if showSubscribeButton}
            {#if isLoggedIn}
                <a
                    href="/subscriptions?api_product_code={product.product.product_code}"
                    class="btn preset-filled-primary-500 w-full text-center"
                >
                    Subscribe
                </a>
            {:else}
                <a
                    href="/login?redirect=/subscriptions?api_product_code={product.product.product_code}"
                    class="btn preset-outlined-primary-500 w-full text-center"
                >
                    Sign in to Subscribe
                </a>
            {/if}
        {/if}
    </div>
</div>
