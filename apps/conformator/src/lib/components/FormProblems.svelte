<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	/** The problems found in a form, listed above it. */
	let { problems }: { problems?: string[] } = $props();
</script>

{#if problems && problems.length > 0}
	<div class="mt-2 preset-tonal-error rounded p-3" role="alert" data-testid="form-problems">
		<p>Please fix these first:</p>
		<ul class="mt-1 list-inside list-disc">
			{#each problems as problem, i (i)}<li>{problem}</li>{/each}
		</ul>
	</div>
{/if}
