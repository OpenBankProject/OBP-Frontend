<script lang="ts">
    import type { OBPConsent } from "$shared/obp/types";
    import { toast } from "$shared/utils/toastService";

    interface Props {
        consent: OBPConsent;
        showDeleteButton?: boolean;
    }

    let { consent, showDeleteButton = false }: Props = $props();

    interface NormalisedPayload {
        entitlements: any[];
        views: any[];
        exp?: number;
        [k: string]: any;
    }

    /**
     * OBP returns `jwt_payload` as a JSON string in some responses and as a
     * parsed object in others. Some call sites pass it through untouched.
     * Normalise it here so the component never depends on the consumer:
     *   - string  -> JSON.parse
     *   - object  -> use as-is
     *   - missing/unparseable -> decode the JWT payload segment browser-side
     * Always returns an object with `entitlements` and `views` arrays.
     */
    function decodeJwtPayload(jwt: string | undefined): any {
        if (!jwt) return undefined;
        try {
            const segment = jwt.split('.')[1];
            if (!segment) return undefined;
            const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(atob(base64));
        } catch {
            return undefined;
        }
    }

    function normalisePayload(): NormalisedPayload {
        let payload: any;

        const raw = consent.jwt_payload;
        if (typeof raw === 'string') {
            try {
                payload = JSON.parse(raw);
            } catch {
                payload = undefined;
            }
        } else if (raw && typeof raw === 'object') {
            payload = raw;
        }

        if (!payload || typeof payload !== 'object') {
            payload = decodeJwtPayload(consent.jwt);
        }

        if (!payload || typeof payload !== 'object') {
            payload = {};
        }

        return {
            ...payload,
            entitlements: Array.isArray(payload.entitlements) ? payload.entitlements : [],
            views: Array.isArray(payload.views) ? payload.views : []
        };
    }

    const payload = $derived(normalisePayload());

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

    /** Human phrase for a duration, rounded to hours: "5 hours", "less than an hour". */
    function formatDuration(totalSeconds: number): string {
        const totalHours = totalSeconds / 3600;
        if (totalHours < 1) {
            return 'less than an hour';
        }
        if (totalHours < 24) {
            const hours = Math.round(totalHours);
            return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
        }
        const days = Math.round(totalHours / 24);
        return `${days} ${days === 1 ? 'day' : 'days'}`;
    }

    function formatJwtExpiration(): {
        formatted: string;
        relative: string;
        isExpired: boolean;
    } {
        if (!payload.exp) {
            return { formatted: 'Not available', relative: '', isExpired: true };
        }

        const expMs = payload.exp * 1000;
        const expDate = new Date(expMs);
        // Computed once at render — no ticking timer. Accuracy is hour-level.
        const diffSeconds = Math.round((expMs - Date.now()) / 1000);
        const isExpired = diffSeconds <= 0;

        return {
            formatted: expDate.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
            }),
            relative: isExpired
                ? `expired ${formatDuration(-diffSeconds)} ago`
                : `expires in ${formatDuration(diffSeconds)}`,
            isExpired
        };
    }

    function getStatusColor(status: string): string {
        switch (status.toUpperCase()) {
            case 'ACCEPTED':
                return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400';
            case 'PENDING':
                return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400';
            case 'REJECTED':
            case 'REVOKED':
                return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400';
            case 'EXPIRED':
                return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400';
            default:
                return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400';
        }
    }

    const isRevoked = $derived(consent.status?.toUpperCase() === 'REVOKED');

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
                {#if isRevoked}
                    <!-- consent.status already shows REVOKED in red; a JWT-active badge here would contradict it -->
                {:else if jwtExpInfo.isExpired}
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
        <div class="flex items-start justify-between">
            <span class="font-medium text-gray-700 dark:text-gray-300">JWT Expires:</span>
            <span class="flex flex-col items-end text-right">
                <span class={isRevoked
                    ? 'text-gray-500 line-through dark:text-gray-400'
                    : jwtExpInfo.isExpired
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-green-400'}>
                    {jwtExpInfo.formatted}
                </span>
                {#if jwtExpInfo.relative}
                    <span
                        class="text-xs text-gray-500 dark:text-gray-400"
                        data-testid="consent-jwt-expires-relative"
                    >
                        {jwtExpInfo.relative}
                    </span>
                {/if}
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
    {#if consent.everything || payload.entitlements.length || payload.views.length}
        <div class="mt-4 border-t pt-4 dark:border-gray-700">
            <h4 class="mb-2 font-medium text-gray-900 dark:text-gray-100">Permissions</h4>

            {#if consent.everything}
                <p class="mb-3 text-sm text-gray-600 dark:text-gray-400">
                    Full access — this consent grants <strong>everything</strong>.
                </p>
            {/if}

            <!-- Roles / Entitlements -->
            <div class="mb-3">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Roles</span>
                {#if payload.entitlements.length}
                    <div class="mt-1 flex flex-wrap gap-1">
                        {#each payload.entitlements as ent}
                            <span class="inline-flex items-center gap-1 rounded-full bg-tertiary-100 px-2 py-0.5 text-xs font-medium dark:bg-tertiary-800">
                                {typeof ent === 'string' ? ent : (ent.role_name ?? 'Unknown role')}
                                {#if ent?.bank_id}
                                    <span class="font-mono opacity-60">@ {ent.bank_id}</span>
                                {/if}
                            </span>
                        {/each}
                    </div>
                {:else}
                    <span class="ml-2 text-sm text-gray-500">None</span>
                {/if}
            </div>

            <!-- Views -->
            <div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Views</span>
                {#if payload.views.length}
                    <div class="mt-1 flex flex-wrap gap-1">
                        {#each payload.views as view}
                            <span class="inline-flex items-center gap-1 rounded-full bg-tertiary-100 px-2 py-0.5 text-xs font-medium dark:bg-tertiary-800">
                                {typeof view === 'string' ? view : (view.view_id ?? view.id ?? 'Unknown view')}
                                {#if view?.account_id}
                                    <span class="font-mono opacity-60">on {view.account_id}</span>
                                {/if}
                            </span>
                        {/each}
                    </div>
                {:else}
                    <span class="ml-2 text-sm text-gray-500">None</span>
                {/if}
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
    {#if showDeleteButton && !isRevoked}
        <div class="mt-4 border-t pt-4 dark:border-gray-700">
            <form method="post" action="?/delete">
                <input type="hidden" name="consent_id" value={consent.consent_id} />
                <button
                    type="submit"
                    class="btn preset-filled-error-500 text-sm hover:preset-filled-error-600"
                    data-testid="consent-delete-button"
                >
                    Delete Consent
                </button>
            </form>
        </div>
    {/if}
</div>
