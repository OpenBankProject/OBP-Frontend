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
	import type { ToolMessage } from '$shared/opey/types';
	import { XCircle, AlertTriangle } from '@lucide/svelte';

	let { message }: { message: ToolMessage } = $props();

	let errorOutput = $derived(
		message.toolOutput
			? typeof message.toolOutput === 'string'
				? message.toolOutput
				: JSON.stringify(message.toolOutput, null, 2)
			: 'Tool execution failed with no details provided.'
	);

	let showDetails = $state(false);

</script>

<div class="card rounded-lg border-2 p-4 text-start ui-tone-error">
	<!-- Header -->
	<div class="mb-3 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<XCircle class="ui-text-error" size={24} />
			<h4 class="text-base font-semibold ui-text-error">Tool Execution Failed</h4>
		</div>
	</div>

	<!-- Tool Name -->
	<div class="mb-3">
		<span class="text-xs font-medium ui-text-error">Tool:</span>
		<code class="ms-2 rounded px-2 py-1 text-xs ui-tone-error">
			{message.toolName}
		</code>
	</div>

	<!-- Error Summary -->
	<div class="mb-3 flex items-start gap-2 rounded-lg p-3 ui-tone-error">
		<AlertTriangle class="mt-0.5 flex-shrink-0 ui-text-error" size={18} />
		<div class="text-sm ui-text-error">
			{typeof message.toolOutput === 'string' && message.toolOutput.length < 150
				? message.toolOutput
				: 'An error occurred during tool execution. Click below to view details.'}
		</div>
	</div>

	<!-- Details Toggle -->
	<button
		type="button"
		class="btn preset-outlined-surface-500 btn-sm w-full"
		onclick={() => showDetails = !showDetails}
	>
		{showDetails ? 'Hide' : 'View'} Error Details
	</button>

	<!-- Error Details -->
	{#if showDetails}
		<pre class="text-xs text-start mt-3 p-3 rounded-lg max-h-96 overflow-auto font-mono whitespace-pre border ui-tone-error">{errorOutput}</pre>
	{/if}
</div>
