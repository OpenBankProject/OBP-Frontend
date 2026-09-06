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
    import { page } from '$app/state';
    import { getActiveMenuItem } from '$lib/config/navigation';

    let { children } = $props();

    let activeMenuItem = $derived(getActiveMenuItem(page.url.pathname));
</script>

<div class="flex flex-col flex-1 min-h-0">
    <!-- Title Bar -->
    <header class="border-b border-surface-300-600 bg-surface-50-900 px-6 py-4 flex-shrink-0">
        <div class="flex items-center justify-between flex-wrap gap-2">
            <h1 class="text-2xl font-semibold text-surface-900-50">
                {activeMenuItem.label}
            </h1>
            {#if page.url.pathname === '/user/consents'}
                {@const statuses = ['INITIATED', 'ACCEPTED', 'REJECTED', 'REVOKED']}
                {@const activeStatus = page.url.searchParams.get('status')}
                <div class="flex flex-wrap gap-2" data-testid="consent-status-filter">
                    <a
                        href="/user/consents"
                        class="rounded-full px-3 py-1 text-sm font-medium transition-colors {!activeStatus ? 'bg-surface-900-50 text-surface-50-900' : 'bg-surface-200-700 text-surface-700-300 hover:bg-surface-300-600'}"
                        data-testid="consent-status-filter-all"
                    >All</a>
                    {#each statuses as status}
                        <a
                            href="/user/consents?status={status}"
                            class="rounded-full px-3 py-1 text-sm font-medium transition-colors {activeStatus === status ? 'bg-surface-900-50 text-surface-50-900' : 'bg-surface-200-700 text-surface-700-300 hover:bg-surface-300-600'}"
                            data-testid="consent-status-filter-{status.toLowerCase()}"
                        >{status}</a>
                    {/each}
                </div>
            {/if}
        </div>
        {#if activeMenuItem.description}
            <p class="text-surface-600-400 text-sm mt-1">
                {activeMenuItem.description}
            </p>
        {/if}
    </header>

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto min-h-0">
        <div class="p-6">
            {@render children()}
        </div>
    </div>
</div>