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
    <header class="border-b px-6 py-4 flex-shrink-0 ui-card ui-border">
        <h1 class="text-2xl font-semibold ui-text">
            {activeMenuItem.label}
        </h1>
        <p class="text-sm mt-1 ui-muted">
            Manage your {activeMenuItem.label.toLowerCase()} settings
        </p>
    </header>

    <!-- Page Content -->
    <div class="flex-1 overflow-y-auto min-h-0">
        <div class="p-6">
            {@render children()}
        </div>
    </div>
</div>