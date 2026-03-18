<script lang="ts">
    import ApiCollectionCard from "$lib/components/ApiCollectionCard.svelte";

    let { data, form } = $props();

    let showCreateForm = $state(false);
    let collectionName = $state('');
    let description = $state('');
    let isSharable = $state(false);

    // Reset form on success
    $effect(() => {
        if (form?.success) {
            collectionName = '';
            description = '';
            isSharable = false;
            showCreateForm = false;
        }
    });
</script>

<h1 class="text-gray-900 dark:text-gray-100">API Collections</h1>

<p class="mb-4 text-gray-700 dark:text-gray-300">
    Manage your API endpoint collections. Collections help you organize and group related API endpoints.
</p>

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

<!-- Create Collection Section -->
<div class="mb-8">
    <button
        class="btn preset-filled-primary-500"
        onclick={() => showCreateForm = !showCreateForm}
    >
        {showCreateForm ? 'Cancel' : 'Create New Collection'}
    </button>

    {#if showCreateForm}
        <div class="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Create New Collection</h2>

            <form method="POST" action="?/create" class="space-y-4">
                <label class="label">
                    <span class="label-text">Collection Name *</span>
                    <input
                        type="text"
                        class="input"
                        name="api_collection_name"
                        placeholder="e.g., Payment APIs, Account APIs"
                        bind:value={collectionName}
                        required
                    />
                </label>

                <label class="label">
                    <span class="label-text">Description</span>
                    <textarea
                        class="input"
                        name="description"
                        placeholder="Describe what this collection is for..."
                        bind:value={description}
                        rows="3"
                    ></textarea>
                </label>

                <label class="flex items-center gap-2">
                    <input
                        type="checkbox"
                        class="checkbox"
                        name="is_sharable"
                        value="true"
                        bind:checked={isSharable}
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">
                        Make this collection sharable (visible to other users)
                    </span>
                </label>

                <button type="submit" class="btn preset-filled-primary-500">
                    Create Collection
                </button>
            </form>
        </div>
    {/if}
</div>

<!-- Collections List -->
<div class="mb-4">
    <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Your Collections</h2>
</div>

{#if data.collections && data.collections.length > 0}
    <div class="space-y-4">
        {#each data.collections as collection (collection.api_collection_id)}
            <ApiCollectionCard {collection} showDeleteButton={true} showViewButton={true} apiExplorerUrl={data.apiExplorerUrl} />
        {/each}
    </div>
{:else}
    <div class="rounded-lg bg-gray-100 p-6 text-center dark:bg-gray-800">
        <p class="text-gray-700 dark:text-gray-300">
            No API collections found. Create your first collection to get started!
        </p>
    </div>
{/if}
