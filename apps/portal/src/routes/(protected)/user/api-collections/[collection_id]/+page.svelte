<script lang="ts">
    let { data, form } = $props();

    let showAddEndpointForm = $state(false);
    let operationId = $state('');
    let showEditForm = $state(false);
    let searchQuery = $state('');
    let showDropdown = $state(false);
    let highlightedIndex = $state(-1);
    let showCopyFromForm = $state(false);
    let selectedSourceCollection = $state('');

    // Filter operations based on search query
    let filteredOperations = $derived(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        return (data.availableOperations || [])
            .filter((op: { operation_id: string; summary: string }) =>
                op.operation_id.toLowerCase().includes(query) ||
                op.summary.toLowerCase().includes(query)
            )
            .slice(0, 20); // Limit results for performance
    });

    function selectOperation(opId: string) {
        operationId = opId;
        searchQuery = opId;
        showDropdown = false;
        highlightedIndex = -1;
    }

    function handleKeydown(event: KeyboardEvent) {
        const ops = filteredOperations();
        if (!showDropdown || ops.length === 0) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            highlightedIndex = Math.min(highlightedIndex + 1, ops.length - 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            highlightedIndex = Math.max(highlightedIndex - 1, 0);
        } else if (event.key === 'Enter' && highlightedIndex >= 0) {
            event.preventDefault();
            selectOperation(ops[highlightedIndex].operation_id);
        } else if (event.key === 'Escape') {
            showDropdown = false;
            highlightedIndex = -1;
        }
    }

    function handleInput() {
        operationId = searchQuery;
        showDropdown = searchQuery.trim().length > 0;
        highlightedIndex = -1;
    }

    function handleBlur() {
        // Delay hiding to allow click on dropdown item
        setTimeout(() => {
            showDropdown = false;
        }, 200);
    }

    // Reset form on success
    $effect(() => {
        if (form?.success) {
            operationId = '';
            searchQuery = '';
            showAddEndpointForm = false;
            showCopyFromForm = false;
            selectedSourceCollection = '';
        }
    });
</script>

<div class="mb-4">
    <a href="/user/api-collections" class="text-primary-500 hover:underline text-sm">
        &larr; Back to Collections
    </a>
</div>

{#if data.collection}
<h1 class="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{data.collection.api_collection_name}</h1>

{#if data.collection.description}
    <p class="mb-4 text-gray-700 dark:text-gray-300">{data.collection.description}</p>
{/if}

<div class="mb-4 flex flex-wrap items-center gap-2">
    <span class={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
        data.collection.is_sharable
            ? 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400'
            : 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400'
    }`}>
        {data.collection.is_sharable ? 'Sharable' : 'Private'}
    </span>
    <span class="text-xs text-gray-500 font-mono">ID: {data.collection.api_collection_id}</span>
    <a
        href="/collections/{data.collection.api_collection_id}"
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs text-secondary-500 dark:text-secondary-300 hover:underline"
    >
        View in Portal
    </a>
    {#if data.apiExplorerUrl}
        <a
            href="{data.apiExplorerUrl}/resource-docs?api-collection-id={data.collection.api_collection_id}"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-primary-500 dark:text-primary-200 hover:underline"
        >
            View in API Explorer
        </a>
    {/if}
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

<!-- Edit Collection Toggle -->
<div class="mb-6">
    <button
        class="btn preset-outlined-tertiary-500 text-sm"
        onclick={() => showEditForm = !showEditForm}
    >
        {showEditForm ? 'Cancel Edit' : 'Edit Collection'}
    </button>

    {#if showEditForm}
        <div class="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Collection</h3>
            <form method="POST" action="?/update" class="space-y-4">
                <label class="label">
                    <span class="label-text">Collection Name *</span>
                    <input
                        type="text"
                        class="input"
                        name="api_collection_name"
                        value={data.collection.api_collection_name}
                        required
                    />
                </label>

                <label class="label">
                    <span class="label-text">Description</span>
                    <textarea
                        class="input"
                        name="description"
                        rows="3"
                    >{data.collection.description}</textarea>
                </label>

                <label class="flex items-center gap-2">
                    <input
                        type="checkbox"
                        class="checkbox"
                        name="is_sharable"
                        value="true"
                        checked={data.collection.is_sharable}
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-300">
                        Make this collection sharable
                    </span>
                </label>

                <button type="submit" class="btn preset-filled-primary-500">
                    Save Changes
                </button>
            </form>
        </div>
    {/if}
</div>

<!-- Add Endpoint Section -->
<div class="mb-8">
    <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Endpoints in Collection</h2>

    <div class="flex flex-wrap gap-2 mb-4">
        <button
            class="btn preset-filled-primary-500"
            onclick={() => { showAddEndpointForm = !showAddEndpointForm; showCopyFromForm = false; }}
        >
            {showAddEndpointForm ? 'Cancel' : 'Add Endpoint'}
        </button>

        {#if data.allCollections && data.allCollections.length > 0}
            <button
                class="btn preset-outlined-secondary-500"
                onclick={() => { showCopyFromForm = !showCopyFromForm; showAddEndpointForm = false; }}
            >
                {showCopyFromForm ? 'Cancel' : 'Copy From'}
            </button>
        {/if}
    </div>

    {#if showCopyFromForm}
        <div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Copy Endpoints from Another Collection</h3>

            <form method="POST" action="?/copyFrom" class="space-y-4">
                <label class="label">
                    <span class="label-text">Source Collection *</span>
                    <select
                        class="select w-full"
                        name="source_collection_id"
                        bind:value={selectedSourceCollection}
                        required
                    >
                        <option value="">Select a collection...</option>
                        {#each data.allCollections as coll (coll.api_collection_id)}
                            <option value={coll.api_collection_id}>{coll.api_collection_name}</option>
                        {/each}
                    </select>
                    <p class="text-xs text-gray-500 mt-1">
                        All endpoints from the selected collection will be copied. Existing endpoints will be skipped.
                    </p>
                </label>

                <button type="submit" class="btn preset-filled-primary-500" disabled={!selectedSourceCollection}>
                    Copy Endpoints
                </button>
            </form>
        </div>
    {/if}

    {#if showAddEndpointForm}
        <div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Add Endpoint to Collection</h3>

            <form method="POST" action="?/addEndpoint" class="space-y-4">
                <input type="hidden" name="operation_id" value={operationId} />
                <label class="label">
                    <span class="label-text">Operation ID *</span>
                    <div class="relative">
                        <input
                            type="text"
                            class="input w-full"
                            placeholder="Search for an operation ID..."
                            bind:value={searchQuery}
                            oninput={handleInput}
                            onkeydown={handleKeydown}
                            onfocus={() => { if (searchQuery.trim()) showDropdown = true; }}
                            onblur={handleBlur}
                            autocomplete="off"
                        />
                        {#if showDropdown && filteredOperations().length > 0}
                            <div class="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                                {#each filteredOperations() as op, index (op.operation_id)}
                                    <button
                                        type="button"
                                        class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 {index === highlightedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''}"
                                        onmousedown={() => selectOperation(op.operation_id)}
                                    >
                                        <div class="font-mono text-sm text-gray-900 dark:text-gray-100">
                                            {op.operation_id}
                                        </div>
                                        {#if op.summary}
                                            <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                {op.summary}
                                            </div>
                                        {/if}
                                    </button>
                                {/each}
                            </div>
                        {/if}
                        {#if showDropdown && searchQuery.trim() && filteredOperations().length === 0}
                            <div class="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                                <p class="text-sm text-gray-500 dark:text-gray-400">No matching operations found</p>
                            </div>
                        {/if}
                    </div>
                    <p class="text-xs text-gray-500 mt-1">
                        Type to search for an operation ID by name or description
                    </p>
                </label>

                <button type="submit" class="btn preset-filled-primary-500" disabled={!operationId.trim()}>
                    Add Endpoint
                </button>
            </form>
        </div>
    {/if}
</div>

<!-- Endpoints List -->
{#if data.endpoints && data.endpoints.length > 0}
    <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700">
                <tr>
                    <th class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Operation ID</th>
                    <th class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Endpoint ID</th>
                    <th class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-600">
                {#each data.endpoints as endpoint (endpoint.api_collection_endpoint_id)}
                    <tr class="bg-white dark:bg-gray-800">
                        <td class="px-4 py-3 font-mono text-sm text-gray-900 dark:text-gray-100">{endpoint.operation_id}</td>
                        <td class="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{endpoint.api_collection_endpoint_id}</td>
                        <td class="px-4 py-3">
                            <form method="POST" action="?/removeEndpoint" class="inline">
                                <input type="hidden" name="endpoint_id" value={endpoint.api_collection_endpoint_id} />
                                <button
                                    type="submit"
                                    class="btn btn-sm preset-filled-error-500"
                                >
                                    Remove
                                </button>
                            </form>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{:else}
    <div class="rounded-lg bg-gray-100 p-6 text-center dark:bg-gray-800">
        <p class="text-gray-700 dark:text-gray-300">
            No endpoints in this collection yet. Add your first endpoint above!
        </p>
    </div>
{/if}
{/if}
