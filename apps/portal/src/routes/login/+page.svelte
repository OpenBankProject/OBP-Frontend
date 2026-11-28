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

    // Clear success message after displaying it
    function clearSuccess() {
        goto('/login', { replaceState: true });
    }

    // Copy error message to clipboard
    async function copyError() {
        if (data.errorMessage) {
            await navigator.clipboard.writeText(data.errorMessage);
        }
    }

    // Copy provider error to clipboard
    async function copyProviderError(errorText: string) {
        if (errorText) {
            await navigator.clipboard.writeText(errorText);
        }
    }

    let refreshInterval: NodeJS.Timeout | undefined;

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
        // Auto-refresh every 60 seconds to show provider status changes.
        // Skipped whenever exactly one provider is available: that's precisely the
        // condition +page.server.ts's load() uses to auto-redirect straight into
        // `/login/{provider}` (which mints a fresh OAuth state cookie as a side
        // effect). This page only renders with a single available provider when an
        // error/success message is suppressing that auto-redirect (e.g. the user
        // landed here after a failed login and is about to retry) — invalidateAll()
        // racing a real click on the provider link here would silently overwrite the
        // state cookie the click's own request just set, causing an intermittent
        // "Security validation failed" state mismatch on the callback.
        if (data.availableProviders.length === 1) {
            return;
        }
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
    <div class="rounded-xl mx-auto w-auto sm:w-sm md:w-lg h-xl bg-white/10 p-4 max-w-xl backdrop-blur-xs align-middle ui-border divide-y">
        <div class="flex justify-between items-center">
            <h1 class="h2">Login</h1>
        </div>

        {#if 'invitationAccepted' in data && data.invitationAccepted === 'true'}
            <div class="mt-4 p-4 rounded-lg border flex items-start justify-between ui-tone-success">
                <div class="flex items-start gap-3">
                    <span class="text-xl ui-text-success">✓</span>
                    <div>
                        <p class="font-semibold ui-text-success">Account Created Successfully</p>
                        <p class="text-sm mt-1 ui-text-success">Your account has been created. You can now log in with your username and password.</p>
                    </div>
                </div>
                <button 
                    type="button" 
                    onclick={clearSuccess}
                    class="ml-2 ui-text-success"
                    aria-label="Close success message"
                >
                    ✕
                </button>
            </div>
        {:else if 'successMessage' in data && data.successMessage === 'success'}
            <div class="mt-4 p-4 rounded-lg border flex items-start justify-between ui-tone-success">
                <div class="flex items-start gap-3">
                    <span class="text-xl ui-text-success">✓</span>
                    <div>
                        <p class="font-semibold ui-text-success">Password Reset Successful</p>
                        <p class="text-sm mt-1 ui-text-success">Your password has been reset. You can now log in with your new password.</p>
                    </div>
                </div>
                <button 
                    type="button" 
                    onclick={clearSuccess}
                    class="ml-2 ui-text-success"
                    aria-label="Close success message"
                >
                    ✕
                </button>
            </div>
        {/if}

        {#if data.errorMessage}
            <div class="mt-4 p-4 rounded-lg border ui-tone-error" data-testid="login-error">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex items-start gap-3 flex-1 min-w-0">
                        <span class="text-xl flex-shrink-0 ui-text-error">⚠</span>
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold ui-text-error">Authentication Failed</p>
                            <div class="text-sm mt-1 max-h-32 overflow-y-auto break-words whitespace-pre-wrap ui-text-error">{data.errorMessage}</div>
                        </div>
                    </div>
                    <div class="flex gap-2 flex-shrink-0">
                        <button 
                            type="button" 
                            onclick={copyError}
                            class="ui-text-error"
                            aria-label="Copy error message"
                            title="Copy error"
                        >
                            📋
                        </button>
                        <button 
                            type="button" 
                            onclick={clearError}
                            class="ui-text-error"
                            aria-label="Close error message"
                        >
                            ✕
                        </button>
                    </div>
                </div>
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
                                    <div class="mt-1 ml-5 flex items-start gap-2">
                                        <div class="text-xs max-h-20 overflow-y-auto break-words whitespace-pre-wrap flex-1 ui-muted">
                                            {provider.error}
                                        </div>
                                        <button 
                                            type="button" 
                                            onclick={() => copyProviderError(provider.error || '')}
                                            class="text-xs flex-shrink-0 ui-muted"
                                            aria-label="Copy error message"
                                            title="Copy error"
                                        >
                                            📋
                                        </button>
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
                    <button type="button" class="btn preset-filled-primary-500 mx-auto w-full" data-testid="provider-{provider.provider}">
                        <a href="/login/{provider.provider}" data-sveltekit-preload-data="off" class="w-full flex items-center justify-between">
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
                                    <div class="mt-1 ml-5 flex items-start gap-2">
                                        <div class="text-xs max-h-20 overflow-y-auto break-words whitespace-pre-wrap flex-1 ui-muted">
                                            {provider.error}
                                        </div>
                                        <button 
                                            type="button" 
                                            onclick={() => copyProviderError(provider.error || '')}
                                            class="text-xs flex-shrink-0 ui-muted"
                                            aria-label="Copy error message"
                                            title="Copy error"
                                        >
                                            📋
                                        </button>
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
