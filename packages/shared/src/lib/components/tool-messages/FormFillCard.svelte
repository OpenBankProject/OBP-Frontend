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
	/**
	 * Renders a client-executed set_form_fields call: which form fields Opey
	 * filled on the page, which keys the page ignored, or why it failed.
	 * The values themselves live in the form (where the user reviews them),
	 * so this card shows field NAMES only.
	 */
	import { CircleCheck, CircleAlert } from '@lucide/svelte';
	import type { ToolMessage } from '$shared/opey/types';

	let { message }: { message: ToolMessage } = $props();

	// Prefer the locally recorded outcome; fall back to parsing the tool output
	// (the JSON the resumed graph echoed) e.g. when history is re-rendered.
	let outcome = $derived.by(() => {
		if (message.clientResult) return message.clientResult;
		if (typeof message.toolOutput === 'string') {
			try {
				const parsed = JSON.parse(message.toolOutput);
				return { status: parsed.status ?? 'applied', ...(parsed.result ?? {}) };
			} catch {
				return undefined;
			}
		}
		return undefined;
	});

	let applied = $derived((outcome?.applied as string[] | undefined) ?? []);
	let ignored = $derived((outcome?.ignored as string[] | undefined) ?? []);
</script>

{#if outcome?.status === 'error'}
	<div class="flex items-start gap-2 text-sm" data-testid="form-fill-error">
		<CircleAlert size={16} class="mt-0.5 shrink-0 text-error-500" />
		<span>Could not fill the form: {outcome.error ?? 'unknown error'}</span>
	</div>
{:else if outcome}
	<div class="space-y-2 text-sm" data-testid="form-fill-result">
		<div class="flex items-center gap-2">
			<CircleCheck size={16} class="shrink-0 text-success-500" />
			<span>
				{applied.length === 1 ? 'Filled 1 field' : `Filled ${applied.length} fields`} in the form —
				review the highlighted values before submitting.
			</span>
		</div>
		{#if applied.length > 0}
			<div class="flex flex-wrap gap-1.5">
				{#each applied as field (field)}
					<code class="rounded bg-surface-200-800 px-1.5 py-0.5 text-xs" data-testid="form-fill-field">{field}</code>
				{/each}
			</div>
		{/if}
		{#if ignored.length > 0}
			<p class="text-xs text-surface-600-400">
				Ignored (unknown to this form): {ignored.join(', ')}
			</p>
		{/if}
	</div>
{/if}
