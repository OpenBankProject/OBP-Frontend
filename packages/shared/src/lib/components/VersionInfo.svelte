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
			return date.toLocaleString(undefined, { hourCycle: 'h23' });
		} catch {
			return isoString;
		}
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={toggleDetails}
		class="flex items-center gap-1 text-xs transition-colors ui-muted"
		aria-label="Version information"
		title="Click for version details"
	>
		<Info class="h-3 w-3" />
		<span>v{__APP_VERSION__}</span>
	</button>

	{#if showDetails}
		<div
			class="absolute bottom-full start-0 mb-2 min-w-[280px] rounded-lg border p-3 shadow-lg z-50 ui-card ui-border"
		>
			<div class="space-y-2 text-xs">
				<div class="flex justify-between border-b pb-2 mb-2 ui-border">
					<span class="font-semibold ui-text">Version Info</span>
					<button
						type="button"
						onclick={toggleDetails}
						class="ui-muted"
						aria-label="Close"
					>
						✕
					</button>
				</div>

				<div class="flex justify-between">
					<span class="ui-muted">Version:</span>
					<span class="font-mono ui-text">{__APP_VERSION__}</span>
				</div>

				<div class="flex justify-between">
					<span class="ui-muted">Commit:</span>
					<span class="font-mono ui-text">{__GIT_COMMIT__}</span>
				</div>

				<div class="flex justify-between">
					<span class="ui-muted">Branch:</span>
					<span class="font-mono ui-text">{__GIT_BRANCH__}</span>
				</div>

				<div class="flex justify-between">
					<span class="ui-muted">Built:</span>
					<span class="font-mono text-xs ui-text">
						{formatBuildTime(__BUILD_TIME__)}
					</span>
				</div>
			</div>
		</div>
	{/if}
</div>