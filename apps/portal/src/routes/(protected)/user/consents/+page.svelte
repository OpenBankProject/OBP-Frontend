<script lang="ts">
    import { ConsentCard } from "@obp/shared/components";

    let { data, form } = $props();
</script>

{#if form?.message}
    <div class="bg-error-500/10 border-error-500 mb-8 rounded-lg border p-4 text-center">
        <p class="text-error-500 font-semibold">{form.message}</p>
    </div>
{/if}

{#if form?.success}
    <div class="mb-8 rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20">
        <p class="font-semibold text-green-600 dark:text-green-400">{form.message}</p>
    </div>
{/if}

<!-- Consents for Opey Section -->
<div class="mb-10">
    <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Consents for Opey</h2>
    {#if data.opeyConsents && data.opeyConsents.length > 0}
        <div class="space-y-4">
            {#each data.opeyConsents as consent (consent.consent_id)}
                <ConsentCard {consent} showDeleteButton={true} />
            {/each}
        </div>
    {:else}
        <div class="rounded-lg bg-gray-100 p-6 text-center dark:bg-gray-800">
            <p class="text-gray-700 dark:text-gray-300">No Opey consents found.</p>
        </div>
    {/if}
</div>

<!-- Other Consents Section -->
<div>
    <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Other Consents</h2>
    {#if data.otherConsents && data.otherConsents.length > 0}
        <div class="space-y-4">
            {#each data.otherConsents as consent (consent.consent_id)}
                <ConsentCard {consent} showDeleteButton={true} />
            {/each}
        </div>
    {:else}
        <div class="rounded-lg bg-gray-100 p-6 text-center dark:bg-gray-800">
            <p class="text-gray-700 dark:text-gray-300">No other consents found.</p>
        </div>
    {/if}
</div>
