<script lang="ts">
    import { page } from '$app/state';
    import { getActiveDeveloperItem } from '$lib/config/navigation';
    import { setContext } from 'svelte';

    let { data, children } = $props();

    let activeItem = $derived(getActiveDeveloperItem(page.url.pathname));

    // Make API URLs available to all developer pages via context
    setContext('developerContext', {
        get apiHost() { return data.apiHost; },
        get apiBaseUrl() { return data.apiBaseUrl; },
        get apiExplorerUrl() { return data.apiExplorerUrl; },
        get mcpUrl() { return data.mcpUrl; }
    });
</script>

<div class="flex flex-col flex-1 min-h-0">
    <!-- Title Bar -->
    <header class="border-b border-surface-300-600 bg-surface-50-900 px-6 py-4 flex-shrink-0">
        <h1 class="text-2xl font-semibold text-surface-900-50">
            {activeItem.label}
        </h1>
        <p class="text-surface-600-400 text-sm mt-1">
            {activeItem.description || ''}
        </p>
    </header>

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto min-h-0">
        <div class="p-6">
            <div class="mx-auto max-w-4xl">
                {@render children()}
            </div>
        </div>
    </div>
</div>
