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
    let { data } = $props();

    function formatEntityName(name: string): string {
        return name
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\b\w/g, c => c.toUpperCase());
    }
</script>

{#if data.dynamicEntities && data.dynamicEntities.length > 0}
    <div class="space-y-6">
        {#each data.dynamicEntities as entity (entity.dynamicEntityId)}
            <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    {formatEntityName(entity.entityName)}
                </h2>

                <div class="space-y-3">
                    {#each entity.data ?? [] as item, index}
                        <div class="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                            <div class="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                                Record {index + 1}
                            </div>
                            <dl class="grid grid-cols-2 gap-2 text-sm">
                                {#each Object.entries(item as Record<string, unknown>) as [key, value]}
                                    <dt class="text-gray-500 dark:text-gray-400">{key}:</dt>
                                    <dd class="text-gray-900 dark:text-gray-100">{value}</dd>
                                {/each}
                            </dl>
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
{:else}
    <div class="rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-800">
        <p class="text-gray-700 dark:text-gray-300">No personal data entities are available.</p>
    </div>
{/if}
