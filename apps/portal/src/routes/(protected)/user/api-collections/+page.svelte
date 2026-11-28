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

<h1 class="ui-text">API Collections</h1>

<p class="mb-4 ui-muted">
    Manage your API endpoint collections. Collections help you organize and group related API endpoints.
</p>

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

<!-- Create Collection Section -->
<div class="mb-8">
    <button
        class="btn preset-filled-primary-500"
        onclick={() => showCreateForm = !showCreateForm}
    >
        {showCreateForm ? 'Cancel' : 'Create New Collection'}
    </button>

    {#if showCreateForm}
        <div class="mt-4 rounded-lg border p-6 shadow-sm ui-card ui-border">
            <h2 class="mb-4 text-xl font-semibold ui-text">Create New Collection</h2>

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
                    <span class="text-sm ui-muted">
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
    <h2 class="text-xl font-semibold ui-text">Your Collections</h2>
</div>

{#if data.collections && data.collections.length > 0}
    <div class="space-y-4">
        {#each data.collections as collection (collection.api_collection_id)}
            <ApiCollectionCard {collection} showDeleteButton={true} showViewButton={true} apiExplorerUrl={data.apiExplorerUrl} />
        {/each}
    </div>
{:else}
    <div class="rounded-lg p-6 text-center ui-panel">
        <p class="ui-muted">
            No API collections found. Create your first collection to get started!
        </p>
    </div>
{/if}
