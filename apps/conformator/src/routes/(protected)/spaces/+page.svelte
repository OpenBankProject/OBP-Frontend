<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	let { data } = $props();
</script>

<h1 class="h2">Your organisation</h1>
{#if data.spaces.length === 0}
	<p class="mt-4 max-w-3xl">You are not a member of any participant yet. The regulator gives your organisation's people access once it is admitted. Ask them to add you.</p>
{:else}
	<ul class="mt-4 flex flex-col gap-2" data-testid="my-spaces">
		{#each data.spaces as space (space.id)}
			<li><a class="anchor" href="/spaces/{space.id}">{space.name}</a> <code class="text-sm">{space.id}</code></li>
		{/each}
	</ul>
{/if}
