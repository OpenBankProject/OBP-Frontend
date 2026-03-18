<script lang="ts">
    import type { OBPApiCollection } from "$lib/obp/types";
    import { toast } from "$lib/utils/toastService";

    interface Props {
        collection: OBPApiCollection;
        showDeleteButton?: boolean;
        showViewButton?: boolean;
        apiExplorerUrl?: string;
    }

    let { collection, showDeleteButton = false, showViewButton = true, apiExplorerUrl = '' }: Props = $props();

    async function copyToClipboard(text: string, label: string) {
        try {
            await navigator.clipboard.writeText(text);
            toast.info(`${label} copied to clipboard!`);
        } catch (err) {
            console.error('Failed to copy: ', err);
            toast.error('Failed to copy to clipboard.');
        }
    }
</script>

<div class="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
    <!-- Header -->
    <div class="mb-4 flex items-start justify-between">
        <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {collection.api_collection_name}
            </h3>
            <div class="mt-1 flex items-center gap-2">
                <span class={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                    collection.is_sharable
                        ? 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400'
                        : 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400'
                }`}>
                    {collection.is_sharable ? 'Sharable' : 'Private'}
                </span>
            </div>
        </div>

        <!-- Copy button for collection ID -->
        <button
            class="btn-icon btn-sm preset-filled-tertiary ml-2"
            onclick={() => copyToClipboard(collection.api_collection_id, 'Collection ID')}
            title="Copy collection ID"
            aria-label="Copy collection ID"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
        </button>
    </div>

    <!-- Description -->
    {#if collection.description}
        <p class="mb-4 text-sm text-gray-700 dark:text-gray-300">
            {collection.description}
        </p>
    {/if}

    <!-- Details Grid -->
    <div class="grid gap-3 text-sm">
        <div class="flex items-center justify-between">
            <span class="font-medium text-gray-700 dark:text-gray-300">Collection ID:</span>
            <span class="text-gray-900 dark:text-gray-100 text-xs font-mono">
                {collection.api_collection_id}
            </span>
        </div>
    </div>

    <!-- Actions -->
    <div class="mt-4 border-t pt-4 dark:border-gray-700 flex flex-wrap items-center gap-2">
        {#if showViewButton}
            <a
                href="/user/api-collections/{collection.api_collection_id}"
                class="btn preset-outlined-primary-500 text-sm"
            >
                View Endpoints
            </a>
        {/if}

        {#if showDeleteButton}
            <form method="post" action="?/delete">
                <input type="hidden" name="api_collection_id" value={collection.api_collection_id} />
                <button
                    type="submit"
                    class="btn preset-filled-error-500 text-sm hover:preset-filled-error-600"
                >
                    Delete
                </button>
            </form>
        {/if}

        <a
            href="/collections/{collection.api_collection_id}"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-secondary-500 dark:text-secondary-300 hover:underline"
        >
            View in Portal
        </a>
        {#if apiExplorerUrl}
            <a
                href="{apiExplorerUrl}/resource-docs?api-collection-id={collection.api_collection_id}"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-primary-500 dark:text-primary-200 hover:underline"
            >
                View in API Explorer
            </a>
        {/if}
    </div>
</div>
