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
    import type { PageData } from './$types';
    import { onMount, onDestroy } from 'svelte';
    import { invalidateAll, goto } from '$app/navigation';

    let { data }: { data: PageData } = $props();

    // Clear error message after displaying it
    function clearError() {
        goto('/login', { replaceState: true });
    }

    let refreshInterval: ReturnType<typeof setTimeout> | undefined;

    function providerLoginUrl(provider: string): string {
        const base = `/login/${provider}`;
        if (data.redirectTo) {
            return `${base}?redirect_to=${encodeURIComponent(data.redirectTo)}`;
        }
        return base;
    }

    function formatProviderName(provider: string): string {
        switch (provider) {
            case 'obp-oidc':
                return 'OBP OpenID Connect';
            case 'keycloak':
                return 'Keycloak';
            default:
                return provider.charAt(0).toUpperCase() + provider.slice(1);
        }
    }



    onMount(() => {
        // Auto-refresh every 60 seconds to show provider status changes
        refreshInterval = setInterval(() => {
            invalidateAll();
        }, 60000);
    });

    onDestroy(() => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    });
</script>

<div class="flex h-full w-full items-center justify-center">
    <div class="rounded-xl mx-auto w-auto sm:w-sm md:w-lg h-xl bg-white/10 p-4 max-w-xl backdrop-blur-xs align-middle divide-y ui-border">
        <div class="flex justify-between items-center">
            <h1 class="h2">Login</h1>
        </div>

        {#if data.errorMessage}
            <div class="mt-4 p-4 rounded-lg border flex items-start justify-between ui-tone-error">
                <div class="flex items-start gap-3">
                    <span class="text-xl ui-text-error">⚠</span>
                    <div>
                        <p class="font-semibold ui-text-error">Authentication Failed</p>
                        <p class="text-sm mt-1 ui-text-error">{data.errorMessage}</p>
                    </div>
                </div>
                <button 
                    type="button" 
                    onclick={clearError}
                    class="ml-2 ui-text-error"
                    aria-label="Close error message"
                >
                    ✕
                </button>
            </div>
        {/if}

        {#if data.availableProviders.length === 0}
            <div class="text-center my-4">
                <p class="ui-text-error">No authentication providers available. Please contact your administrator.</p>

                <!-- Show unavailable providers even when no available providers -->
                {#if data.unavailableProviders.length > 0}
                    <div class="mt-6 pt-4 border-t ui-border">
                        <p class="text-center text-sm mb-3 ui-muted">Currently unavailable:</p>
                        {#each data.unavailableProviders as provider}
                            <div class="w-full p-3 rounded-lg border opacity-60 ui-panel ui-border">
                                <div class="flex items-center justify-between">
                                    <span class="flex items-center gap-2">
                                        <span class="ui-text-error">●</span>
                                        <span class="ui-muted">{formatProviderName(provider.provider)}</span>
                                    </span>
                                    <span class="text-xs ui-text-error">Unavailable</span>
                                </div>
                                {#if provider.error}
                                    <div class="text-xs mt-1 ml-5 ui-muted">
                                        {provider.error}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {:else}
            <!-- Available providers -->
            <div class="space-y-3 mt-4">
                <p class="text-center text-sm ui-muted">Choose your authentication provider:</p>
                {#each data.availableProviders as provider}
                    <button type="button" class="btn preset-filled-primary-500 mx-auto w-full">
                        <a href={providerLoginUrl(provider.provider)} class="w-full flex items-center justify-between">
                            <span class="flex items-center gap-2">
                                <span class="ui-text-success">●</span>
                                {formatProviderName(provider.provider)}
                            </span>
                        </a>
                    </button>
                {/each}

                <!-- Unavailable providers -->
                {#if data.unavailableProviders.length > 0}
                    <div class="mt-6 pt-4 border-t ui-border">
                        <p class="text-center text-sm mb-3 ui-muted">Currently unavailable:</p>
                        {#each data.unavailableProviders as provider}
                            <div class="w-full p-3 rounded-lg border opacity-60 ui-panel ui-border">
                                <div class="flex items-center justify-between">
                                    <span class="flex items-center gap-2">
                                        <span class="ui-text-error">●</span>
                                        <span class="ui-muted">{formatProviderName(provider.provider)}</span>
                                    </span>
                                    <span class="text-xs ui-text-error">Unavailable</span>
                                </div>
                                {#if provider.error}
                                    <div class="text-xs mt-1 ml-5 ui-muted">
                                        {provider.error}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>
