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
    import type { OBPConsent } from "$shared/obp/types";
    import { toast } from "$shared/utils/toastService";

    interface Props {
        consent: OBPConsent;
        showDeleteButton?: boolean;
        // Optional base path for the consuming app's metrics search page.
        // When set, the Consent Reference ID renders as a link to
        // `${metricsHref}?consent_reference_id=<value>` so users can jump
        // straight to metrics filtered by this consent.
        metricsHref?: string;
    }

    let { consent, showDeleteButton = false, metricsHref }: Props = $props();

    interface NormalisedPayload {
        entitlements: any[];
        views: any[];
        myResources: any[];
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
            views: Array.isArray(payload.views) ? payload.views : [],
            myResources: Array.isArray(payload.my_resources?.personal_dynamic_entities)
                ? payload.my_resources.personal_dynamic_entities
                : []
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
            hourCycle: 'h23',
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
                hourCycle: 'h23',
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
                return 'ui-tone-success';
            case 'PENDING':
                return 'ui-tone-warning';
            case 'REJECTED':
            case 'REVOKED':
                return 'ui-tone-error';
            case 'EXPIRED':
                return 'ui-panel ui-muted';
            default:
                return 'ui-panel ui-muted';
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


<div class="rounded-lg p-6 shadow-md ui-card">
    <!-- Header -->
    <div class="mb-4 flex items-start justify-between">
        <div class="flex-1">
            <h3 class="text-lg font-semibold ui-text">
                {consent.consent_id}
            </h3>
            <div class="mt-1 flex items-center gap-2">
                <span class={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(consent.status)}`}>
                    {consent.status}
                </span>
                {#if isRevoked}
                    <!-- consent.status already shows REVOKED in red; a JWT-active badge here would contradict it -->
                {:else if jwtExpInfo.isExpired}
                    <span class="inline-flex rounded-full px-2 py-1 text-xs font-medium ui-tone-error">
                        JWT Expired
                    </span>
                {:else}
                    <span class="inline-flex rounded-full px-2 py-1 text-xs font-medium ui-tone-success">
                        JWT Active
                    </span>
                {/if}
            </div>
        </div>

        <!-- Copy button for consent ID -->
        <button
            class="btn-icon btn-sm preset-tonal ms-2"
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
            <span class="font-medium ui-muted">Consumer ID:</span>
            <div class="flex items-center gap-2">
                <span class="ui-text">{consent.consumer_id}</span>
                <button
                    class="btn-icon btn-sm preset-tonal"
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

        <!-- Consent Reference ID -->
        {#if consent.consent_reference_id}
            <div class="flex items-center justify-between">
                <span class="font-medium ui-muted">Consent Reference ID:</span>
                <div class="flex items-center gap-2">
                    {#if metricsHref}
                        <a
                            href={`${metricsHref}?consent_reference_id=${encodeURIComponent(consent.consent_reference_id)}`}
                            class="underline-offset-2 hover:underline ui-link"
                            title="Search metrics for this consent reference"
                            data-testid="consent-reference-id-metrics-link"
                        >
                            {consent.consent_reference_id}
                        </a>
                    {:else}
                        <span
                            class="ui-text"
                            data-testid="consent-reference-id"
                        >{consent.consent_reference_id}</span>
                    {/if}
                    <button
                        class="btn-icon btn-sm preset-tonal"
                        onclick={() => copyToClipboard(consent.consent_reference_id!, 'Consent Reference ID')}
                        title="Copy consent reference ID"
                        aria-label="Copy consent reference ID"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                            <path d="M4 16c-1.1 0-2-.9-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                    </button>
                </div>
            </div>
        {/if}

        <!-- Created Date -->
        {#if consent.created_date}
            <div class="flex items-center justify-between">
                <span class="font-medium ui-muted">Created:</span>
                <span class="ui-text">{formatDate(consent.created_date)}</span>
            </div>
        {/if}

        <!-- Last Action Date NOT WORKING AT OBP SIDE -->
        <!-- <div class="flex items-center justify-between">
            <span class="font-medium ui-muted">Last Action:</span>
            <span class="ui-text">{formatDate(consent.last_action_date)}</span>
        </div> -->

        <!-- Last Usage Date -->
        {#if consent.last_usage_date}
            <div class="flex items-center justify-between">
                <span class="font-medium ui-muted">Last Usage:</span>
                <span class="ui-text">{formatDate(consent.last_usage_date)}</span>
            </div>
        {/if}

        <!-- JWT Expiration -->
        <div class="flex items-start justify-between">
            <span class="font-medium ui-muted">JWT Expires:</span>
            <span class="flex flex-col items-end text-end">
                <span class={isRevoked
                    ? 'line-through ui-muted'
                    : jwtExpInfo.isExpired
                        ? 'ui-text-error'
                        : 'ui-text-success'}>
                    {jwtExpInfo.formatted}
                </span>
                {#if jwtExpInfo.relative}
                    <span
                        class="text-xs ui-muted"
                        data-testid="consent-jwt-expires-relative"
                    >
                        {jwtExpInfo.relative}
                    </span>
                {/if}
            </span>
        </div>

    </div>

    <!-- Permissions Section -->
    <div class="mt-4 border-t pt-4 ui-border">
        <h4 class="mb-2 font-medium ui-text">Permissions</h4>

        <!-- Everything -->
        <div class="mb-3 flex items-center gap-2">
            <span class="text-sm font-medium ui-muted">Everything:</span>
            <span class={`text-sm font-medium ${consent.everything ? 'ui-text-success' : 'ui-muted'}`}>
                {consent.everything ? 'True' : 'False'}
            </span>
            {#if consent.everything}
                <span class="text-xs ui-muted">
                    — this consent grants full access
                </span>
            {/if}
        </div>

        <!-- Roles / Entitlements -->
        <div class="mb-3">
            <span class="text-sm font-medium ui-muted">Roles</span>
            {#if payload.entitlements.length}
                <div class="mt-1 flex flex-wrap gap-1">
                    {#each payload.entitlements as ent}
                        <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ui-tone-info">
                            {typeof ent === 'string' ? ent : (ent.role_name ?? 'Unknown role')}
                            {#if ent?.bank_id}
                                <span class="font-mono opacity-60">@ {ent.bank_id}</span>
                            {/if}
                        </span>
                    {/each}
                </div>
            {:else}
                <span class="ms-2 text-sm ui-muted">None</span>
            {/if}
        </div>

        <!-- My resources: the user's own personal dynamic entities the consent may act on -->
        {#if payload.myResources.length}
            <div class="mb-3">
                <span class="text-sm font-medium ui-muted">My resources</span>
                <div class="mt-1 flex flex-wrap gap-1">
                    {#each payload.myResources as r}
                        <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ui-tone-info" data-testid="consent-my-resource-row">
                            {Array.isArray(r?.actions) ? r.actions.join(' and ') : ''} {r?.entity_name ?? 'Unknown entity'}
                            {#if r?.bank_id}
                                <span class="font-mono opacity-60">@ {r.bank_id}</span>
                            {/if}
                        </span>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Views -->
        <div>
            <span class="text-sm font-medium ui-muted">Views</span>
            {#if payload.views.length}
                <div class="mt-1 flex flex-col gap-1">
                    {#each payload.views as view}
                        <div
                            class="rounded px-2 py-1 text-xs ui-tone-info"
                            data-testid="consent-view-row"
                        >
                            {#if typeof view === 'string'}
                                <code class="font-mono">{view}</code>
                            {:else}
                                <div><span class="opacity-70">bank_id:</span> <code class="font-mono">{view.bank_id ?? '—'}</code></div>
                                <div><span class="opacity-70">account_id:</span> <code class="font-mono">{view.account_id ?? '—'}</code></div>
                                <div><span class="opacity-70">view_id:</span> <code class="font-mono">{view.view_id ?? view.id ?? '—'}</code></div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {:else}
                <span class="ms-2 text-sm ui-muted">None</span>
            {/if}
        </div>
    </div>

    <!-- JWT Section -->
    <div class="mt-4 border-t pt-4 ui-border">
        <div class="flex items-center justify-between">
            <span class="text-sm font-medium ui-muted">JWT Token:</span>
            <button
                class="btn preset-outlined-surface-500 text-xs"
                onclick={() => copyToClipboard(consent.jwt, 'JWT')}
            >
                Copy JWT
            </button>
        </div>
        <div class="mt-2 rounded p-2 ui-panel">
            <code class="text-xs ui-muted">
                {consent.jwt.substring(0, 50)}...
            </code>
        </div>
    </div>

    <!-- Delete Action -->
    {#if showDeleteButton && !isRevoked}
        <div class="mt-4 border-t pt-4 ui-border">
            <form method="post" action="?/delete">
                <input type="hidden" name="consent_id" value={consent.consent_id} />
                <button
                    type="submit"
                    class="btn preset-filled-error-500 text-sm hover:preset-filled-error-500"
                    data-testid="consent-delete-button"
                >
                    Delete Consent
                </button>
            </form>
        </div>
    {/if}
</div>
