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
	import { earlyAccessItems } from '$lib/config/navigation';
</script>

<div class="mx-auto max-w-2xl p-8">
	<h1 class="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Early Access</h1>
	<p class="mb-6 text-gray-700 dark:text-gray-300">
		These pages are in early access. Some require specific query parameters to function fully,
		but you can visit them to see their current state.
	</p>

	<div class="space-y-3">
		{#each earlyAccessItems as item}
			{@const Icon = item.iconComponent}
			<a
				href={item.href}
				class="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-600 dark:hover:bg-gray-700"
			>
				<Icon class="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
				<div>
					<span class="font-medium text-gray-900 dark:text-gray-100">{item.label}</span>
					{#if item.description}
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
					{/if}
				</div>
			</a>
		{/each}
	</div>
</div>
