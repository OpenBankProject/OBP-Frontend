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
    <a href="/user/api-collections" class="hover:underline text-sm ui-text-brand">
        &larr; Back to Collections
    </a>
</div>

{#if data.collection}
<h1 class="mb-2 text-3xl font-bold ui-text">{data.collection.api_collection_name}</h1>

{#if data.collection.description}
    <p class="mb-4 ui-muted">{data.collection.description}</p>
{/if}

<div class="mb-4 flex flex-wrap items-center gap-2">
    <span class={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
        data.collection.is_sharable
            ? 'ui-tone-success'
            : 'ui-panel ui-muted'
    }`}>
        {data.collection.is_sharable ? 'Sharable' : 'Private'}
    </span>
    <span class="text-xs font-mono ui-muted">ID: {data.collection.api_collection_id}</span>
    <a
        href="/collections/{data.collection.api_collection_id}"
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs hover:underline ui-text-brand"
    >
        View in Portal
    </a>
    {#if data.apiExplorerUrl}
        <a
            href="{data.apiExplorerUrl}/resource-docs?api-collection-id={data.collection.api_collection_id}"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs hover:underline ui-text-brand"
        >
            View in API Explorer
        </a>
    {/if}
</div>

{#if form?.message}
    <div class="mb-8 rounded-lg border p-4 text-center ui-tone-error">
        <p class="font-semibold ui-text-error">{form.message}</p>
    </div>
{/if}

{#if form?.success}
    <div class="mb-8 rounded-lg border p-4 text-center ui-tone-success">
        <p class="font-semibold ui-text-success">{form.message}</p>
    </div>
{/if}

<!-- Edit Collection Toggle -->
<div class="mb-6">
    <button
        class="btn preset-outlined-surface-500 text-sm"
        onclick={() => showEditForm = !showEditForm}
    >
        {showEditForm ? 'Cancel Edit' : 'Edit Collection'}
    </button>

    {#if showEditForm}
        <div class="mt-4 rounded-lg border p-6 shadow-sm ui-card ui-border">
            <h3 class="mb-4 text-lg font-semibold ui-text">Edit Collection</h3>
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
                    <span class="text-sm ui-muted">
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
    <h2 class="mb-4 text-xl font-semibold ui-text">Endpoints in Collection</h2>

    <div class="flex flex-wrap gap-2 mb-4">
        <button
            class="btn preset-filled-primary-500"
            onclick={() => { showAddEndpointForm = !showAddEndpointForm; showCopyFromForm = false; }}
        >
            {showAddEndpointForm ? 'Cancel' : 'Add Endpoint'}
        </button>

        {#if data.allCollections && data.allCollections.length > 0}
            <button
                class="btn preset-outlined-surface-500"
                onclick={() => { showCopyFromForm = !showCopyFromForm; showAddEndpointForm = false; }}
            >
                {showCopyFromForm ? 'Cancel' : 'Copy From'}
            </button>
        {/if}
    </div>

    {#if showCopyFromForm}
        <div class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border">
            <h3 class="mb-4 text-lg font-semibold ui-text">Copy Endpoints from Another Collection</h3>

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
                    <p class="text-xs mt-1 ui-muted">
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
        <div class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border">
            <h3 class="mb-4 text-lg font-semibold ui-text">Add Endpoint to Collection</h3>

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
                            <div class="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border shadow-lg ui-card ui-border">
                                {#each filteredOperations() as op, index (op.operation_id)}
                                    <button
                                        type="button"
                                        class="w-full px-4 py-2 text-left ui-hover {index === highlightedIndex ? 'ui-panel' : ''}"
                                        onmousedown={() => selectOperation(op.operation_id)}
                                    >
                                        <div class="font-mono text-sm ui-text">
                                            {op.operation_id}
                                        </div>
                                        {#if op.summary}
                                            <div class="text-xs truncate ui-muted">
                                                {op.summary}
                                            </div>
                                        {/if}
                                    </button>
                                {/each}
                            </div>
                        {/if}
                        {#if showDropdown && searchQuery.trim() && filteredOperations().length === 0}
                            <div class="absolute z-50 mt-1 w-full rounded-lg border p-4 shadow-lg ui-card ui-border">
                                <p class="text-sm ui-muted">No matching operations found</p>
                            </div>
                        {/if}
                    </div>
                    <p class="text-xs mt-1 ui-muted">
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
            <thead class="ui-card">
                <tr>
                    <th class="px-4 py-3 font-medium ui-text">Operation ID</th>
                    <th class="px-4 py-3 font-medium ui-text">Endpoint ID</th>
                    <th class="px-4 py-3 font-medium ui-text">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y ui-border">
                {#each data.endpoints as endpoint (endpoint.api_collection_endpoint_id)}
                    <tr class="ui-card">
                        <td class="px-4 py-3 font-mono text-sm ui-text">{endpoint.operation_id}</td>
                        <td class="px-4 py-3 font-mono text-xs ui-muted">{endpoint.api_collection_endpoint_id}</td>
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
    <div class="rounded-lg p-6 text-center ui-panel">
        <p class="ui-muted">
            No endpoints in this collection yet. Add your first endpoint above!
        </p>
    </div>
{/if}
{/if}
