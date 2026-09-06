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
	import { Info } from '@lucide/svelte';

	let showDetails = $state(false);

	function toggleDetails() {
		showDetails = !showDetails;
	}

	function formatBuildTime(isoString: string): string {
		try {
			const date = new Date(isoString);
			return date.toLocaleString();
		} catch {
			return isoString;
		}
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={toggleDetails}
		class="flex items-center gap-1 text-xs text-surface-600-400 hover:text-surface-800-200 transition-colors"
		aria-label="Version information"
		title="Click for version details"
	>
		<Info class="h-3 w-3" />
		<span>v{__APP_VERSION__}</span>
	</button>

	{#if showDetails}
		<div
			class="absolute bottom-full left-0 mb-2 min-w-[280px] rounded-lg border border-surface-300-700 bg-surface-50-900 p-3 shadow-lg z-50"
		>
			<div class="space-y-2 text-xs">
				<div class="flex justify-between border-b border-surface-200-800 pb-2 mb-2">
					<span class="font-semibold text-surface-900-100">Version Info</span>
					<button
						type="button"
						onclick={toggleDetails}
						class="text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
						aria-label="Close"
					>
						✕
					</button>
				</div>

				<div class="flex justify-between">
					<span class="text-surface-600-400">Version:</span>
					<span class="font-mono text-surface-900-100">{__APP_VERSION__}</span>
				</div>

				<div class="flex justify-between">
					<span class="text-surface-600-400">Commit:</span>
					<span class="font-mono text-surface-900-100">{__GIT_COMMIT__}</span>
				</div>

				<div class="flex justify-between">
					<span class="text-surface-600-400">Branch:</span>
					<span class="font-mono text-surface-900-100">{__GIT_BRANCH__}</span>
				</div>

				<div class="flex justify-between">
					<span class="text-surface-600-400">Built:</span>
					<span class="font-mono text-xs text-surface-900-100">
						{formatBuildTime(__BUILD_TIME__)}
					</span>
				</div>
			</div>
		</div>
	{/if}
</div>