<script lang="ts">
    import { page } from '$app/state';
    import { getActiveMenuItem } from '$lib/config/navigation';

    let { children } = $props();

    let activeMenuItem = $derived(getActiveMenuItem(page.url.pathname));
</script>

<div class="flex flex-col flex-1 min-h-0">
    <!-- Title Bar -->
    <header class="border-b border-surface-300-600 bg-surface-50-900 px-6 py-4 flex-shrink-0">
        <h1 class="text-2xl font-semibold text-surface-900-50">
            {activeMenuItem.label}
        </h1>
        <p class="text-surface-600-400 text-sm mt-1">
            {activeMenuItem.description || `Manage your ${activeMenuItem.label.toLowerCase()} settings`}
        </p>
    </header>

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto min-h-0">
        <div class="p-6">
            {@render children()}
        </div>
    </div>
</div>