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
    import { ConsentCard } from "@obp/shared/components";
    import { enhance } from "$app/forms";

    let { data, form } = $props();

    const TTL_OPTIONS: { seconds: number; label: string }[] = [
        { seconds: 3600, label: '1 hour' },
        { seconds: 86400, label: '1 day' },
        { seconds: 604800, label: '7 days' },
        { seconds: 2592000, label: '30 days' },
        { seconds: 7776000, label: '90 days' }
    ];

    let visibleTtlOptions = $derived(
        TTL_OPTIONS.filter((o) => o.seconds <= (data.maxConsentTtlSeconds ?? 7776000))
    );
    let selectedTtl = $state<number>(data.currentConsentTtlSeconds ?? 604800);
    let savingTtl = $state(false);
    let deletingAll = $state(false);
</script>

<div class="mb-6 flex items-center justify-between gap-4">
    <h1 class="text-2xl font-bold ui-text">My Consents</h1>
    <form
        method="post"
        action="?/deleteAll"
        use:enhance={() => {
            deletingAll = true;
            return async ({ update }) => {
                await update({ reset: false });
                deletingAll = false;
            };
        }}
    >
        <button
            type="submit"
            class="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 preset-filled-error-500"
            disabled={deletingAll}
            data-testid="delete-all-consents"
        >
            {deletingAll ? 'Deleting all consents…' : 'Delete all consents'}
        </button>
    </form>
</div>

{#if form?.success}
    <div class="mb-8 rounded-lg border p-4 text-center ui-tone-success">
        <p class="font-semibold ui-text-success">{form.message}</p>
    </div>
{:else if form?.message}
    <div class="mb-8 rounded-lg border p-4 text-center ui-tone-error">
        <p class="font-semibold ui-text-error">{form.message}</p>
    </div>
{/if}

<!-- Consent duration preference -->
<div class="mb-8 rounded-lg p-6 shadow-md ui-card">
    <h2 class="mb-2 text-xl font-semibold ui-text">Consent duration</h2>
    <p class="mb-4 text-sm ui-muted">
        How long new consents should last. Only affects consents created from now on —
        existing consents keep their original duration until they expire.
    </p>
    <form
        method="post"
        action="?/setConsentTtl"
        use:enhance={() => {
            savingTtl = true;
            return async ({ update }) => {
                await update({ reset: false });
                savingTtl = false;
            };
        }}
        class="flex items-center gap-3"
    >
        <label class="flex items-center gap-2 text-sm">
            <span class="font-medium ui-muted">Default duration</span>
            <select
                name="seconds"
                class="rounded-md border px-3 py-2 text-sm disabled:opacity-50 ui-card ui-text ui-border"
                bind:value={selectedTtl}
                disabled={savingTtl}
                onchange={(e) => e.currentTarget.form?.requestSubmit()}
                data-testid="consent-ttl-select"
            >
                {#each visibleTtlOptions as opt}
                    <option value={opt.seconds}>{opt.label}</option>
                {/each}
            </select>
        </label>
        {#if savingTtl}
            <span class="text-xs ui-muted">Saving…</span>
        {/if}
    </form>
</div>

<!-- Consents for Opey Section -->
<div class="mb-10">
    <h2 class="mb-4 text-xl font-semibold ui-text">Consents for Opey</h2>
    {#if data.opeyConsents && data.opeyConsents.length > 0}
        <div class="space-y-4">
            {#each data.opeyConsents as consent (consent.consent_id)}
                <ConsentCard {consent} showDeleteButton={true} />
            {/each}
        </div>
    {:else}
        <div class="rounded-lg p-6 text-center ui-panel">
            <p class="ui-muted">No Opey consents found.</p>
        </div>
    {/if}
</div>

<!-- Other Consents Section -->
<div>
    <h2 class="mb-4 text-xl font-semibold ui-text">Other Consents</h2>
    {#if data.otherConsents && data.otherConsents.length > 0}
        <div class="space-y-4">
            {#each data.otherConsents as consent (consent.consent_id)}
                <ConsentCard {consent} showDeleteButton={true} />
            {/each}
        </div>
    {:else}
        <div class="rounded-lg p-6 text-center ui-panel">
            <p class="ui-muted">No other consents found.</p>
        </div>
    {/if}
</div>
