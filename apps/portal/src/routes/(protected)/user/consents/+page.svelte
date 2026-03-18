<script lang="ts">
    import ConsentCard from "$lib/components/ConsentCard.svelte";

    let { data, form } = $props();

    // Get current time in user's timezone for debugging
    let currentLocalTime = $state('');

    // Update the current time every second
    function updateCurrentTime() {
        currentLocalTime = new Date().toLocaleString(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });
    }

    // Initialize and set up interval
    updateCurrentTime();
    if (typeof window !== 'undefined') {
        setInterval(updateCurrentTime, 1000);
    }
</script>

<h1 class="text-gray-900 dark:text-gray-100">Consents Management</h1>

<p class="mb-4 text-gray-700 dark:text-gray-300">Here you can manage your consents.</p>

<!-- Current Local Time for debugging -->
<div class="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
    <h3 class="mb-2 text-sm font-medium text-blue-900 dark:text-blue-100">Debug Information</h3>
    <p class="text-sm text-blue-800 dark:text-blue-200">
        <strong>Current Local Time:</strong>
        {currentLocalTime}
    </p>
    <p class="mt-1 text-xs text-blue-600 dark:text-blue-300">
        All times are displayed in your local timezone. Compare with consent expiration times.
    </p>
</div>

{#if form?.error}
    <div class="bg-error-500/10 border-error-500 mb-8 rounded-lg border p-4 text-center">
        <p class="text-error-500 font-semibold">{form.error}</p>
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
