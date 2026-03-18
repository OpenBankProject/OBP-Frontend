<script lang="ts">
    import type { OBPConsent } from "$lib/obp/types";
    import { toast } from "$lib/utils/toastService";

    interface Props {
        consent: OBPConsent;
        showDeleteButton?: boolean;
    }

    let { consent, showDeleteButton = false }: Props = $props();

    function formatDate(dateString: string): string {
        if (!dateString) return 'Not available';
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });
    }

    function formatJwtExpiration(): { formatted: string; isExpired: boolean } {
        if (!consent.jwt_payload?.exp) {
            return { formatted: 'Not available', isExpired: true };
        }
        
        const expDate = new Date(consent.jwt_payload.exp * 1000);
        const isExpired = expDate < new Date();
        
        return {
            formatted: expDate.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
            }),
            isExpired
        };
    }

    function formatRoles(entitlements: any[]): string {
        if (!entitlements || entitlements.length === 0) {
            return 'None';
        }
        
        return entitlements
            .map((entitlement) => {
                if (typeof entitlement === 'string') {
                    return entitlement;
                } else if (entitlement.role_name) {
                    return entitlement.role_name;
                }
                return 'Unknown role';
            })
            .join(', ');
    }

    function formatViews(views: any[]): string {
        if (!views || views.length === 0) {
            return 'None';
        }
        
        return views
            .map((view) => {
                if (typeof view === 'string') {
                    return view;
                } else if (view.view_id) {
                    return view.view_id;
                } else if (view.id) {
                    return view.id;
                }
                return 'Unknown view';
            })
            .join(', ');
    }

    function getStatusColor(status: string): string {
        switch (status.toUpperCase()) {
            case 'ACCEPTED':
                return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400';
            case 'PENDING':
                return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400';
            case 'REJECTED':
                return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400';
            case 'EXPIRED':
                return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400';
            default:
                return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400';
        }
    }

    async function copyToClipboard(text: string, label: string) {
        try {
            await navigator.clipboard.writeText(text);
            toast.info(`${label} copied to clipboard!`);
        } catch (err) {
            console.error('Failed to copy: ', err);
            toast.error('Failed to copy to clipboard.');
        }
    }

    const jwtExpInfo = $derived(formatJwtExpiration());
</script>


<div class="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
    <!-- Header -->
    <div class="mb-4 flex items-start justify-between">
        <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {consent.consent_id}
            </h3>
            <div class="mt-1 flex items-center gap-2">
                <span class={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(consent.status)}`}>
                    {consent.status}
                </span>
                {#if jwtExpInfo.isExpired}
                    <span class="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        JWT Expired
                    </span>
                {:else}
                    <span class="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-600 dark:bg-green-900/20 dark:text-green-400">
                        JWT Active
                    </span>
                {/if}
            </div>
        </div>
        
        <!-- Copy button for consent ID -->
        <button
            class="btn-icon btn-sm preset-filled-tertiary ml-2"
            onclick={() => copyToClipboard(consent.consent_id, 'Consent ID')}
            title="Copy consent ID"
            aria-label="Copy consent ID"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
        </button>
    </div>

    <!-- Details Grid -->
    <div class="grid gap-3 text-sm  mx-auto">
        <!-- Consumer ID -->
        <div class="flex items-center justify-between">
            <span class="font-medium text-gray-700 dark:text-gray-300">Consumer ID:</span>
            <div class="flex items-center gap-2">
                <span class="text-gray-900 dark:text-gray-100">{consent.consumer_id}</span>
                <button
                    class="btn-icon btn-sm preset-filled-tertiary"
                    onclick={() => copyToClipboard(consent.consumer_id, 'Consumer ID')}
                    title="Copy consumer ID"
                    aria-label="Copy consumer ID"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                        <path d="M4 16c-1.1 0-2-.9-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                </button>
            </div>
        </div>

        <!-- Created Date -->
        {#if consent.created_date}
            <div class="flex items-center justify-between">
                <span class="font-medium text-gray-700 dark:text-gray-300">Created:</span>
                <span class="text-gray-900 dark:text-gray-100">{formatDate(consent.created_date)}</span>
            </div>
        {/if}

        <!-- Last Action Date NOT WORKING AT OBP SIDE -->
        <!-- <div class="flex items-center justify-between">
            <span class="font-medium text-gray-700 dark:text-gray-300">Last Action:</span>
            <span class="text-gray-900 dark:text-gray-100">{formatDate(consent.last_action_date)}</span>
        </div> -->

        <!-- Last Usage Date -->
        {#if consent.last_usage_date}
            <div class="flex items-center justify-between">
                <span class="font-medium text-gray-700 dark:text-gray-300">Last Usage:</span>
                <span class="text-gray-900 dark:text-gray-100">{formatDate(consent.last_usage_date)}</span>
            </div>
        {/if}

        <!-- JWT Expiration -->
        <div class="flex items-center justify-between">
            <span class="font-medium text-gray-700 dark:text-gray-300">JWT Expires:</span>
            <span class={jwtExpInfo.isExpired ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                {jwtExpInfo.formatted}
            </span>
        </div>

        <!-- Everything Access -->
        {#if consent.everything !== undefined}
            <div class="flex items-center justify-between">
                <span class="font-medium text-gray-700 dark:text-gray-300">Everything Access:</span>
                <span class={consent.everything ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
                    {consent.everything ? 'Yes' : 'No'}
                </span>
            </div>
        {/if}
    </div>

    <!-- Permissions Section -->
    {#if consent.jwt_payload?.entitlements?.length || consent.jwt_payload?.views?.length}
        <div class="mt-4 border-t pt-4 dark:border-gray-700">
            <h4 class="mb-2 font-medium text-gray-900 dark:text-gray-100">Permissions</h4>
            
            <!-- Roles/Entitlements -->
            <div class="mb-2">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Roles:</span>
                <span class="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    {formatRoles(consent.jwt_payload?.entitlements || [])}
                </span>
            </div>
            
            <!-- Views -->
            <div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Views:</span>
                <span class="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    {formatViews(consent.jwt_payload?.views || [])}
                </span>
            </div>
        </div>
    {/if}

    <!-- JWT Section -->
    <div class="mt-4 border-t pt-4 dark:border-gray-700">
        <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">JWT Token:</span>
            <button
                class="btn preset-outlined-tertiary-500 text-xs"
                onclick={() => copyToClipboard(consent.jwt, 'JWT')}
            >
                Copy JWT
            </button>
        </div>
        <div class="mt-2 rounded bg-gray-100 p-2 dark:bg-gray-900">
            <code class="text-xs text-gray-600 dark:text-gray-400">
                {consent.jwt.substring(0, 50)}...
            </code>
        </div>
    </div>

    <!-- Delete Action -->
    {#if showDeleteButton}
        <div class="mt-4 border-t pt-4 dark:border-gray-700">
            <form method="post" action="?/delete">
                <input type="hidden" name="consent_id" value={consent.consent_id} />
                <button 
                    type="submit"
                    class="btn preset-filled-error-500 text-sm hover:preset-filled-error-600"
                >
                    Delete Consent
                </button>
            </form>
        </div>
    {/if}
</div>