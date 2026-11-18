<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';

	let { data } = $props();
</script>

<h1 class="h2">Reviews</h1>
{#if data.submissions.length === 0}
	<p class="mt-4">There are no submissions you can see.</p>
{:else}
	<table class="table mt-4" data-testid="reviews">
		<thead><tr><th>Participant</th><th>Submitted</th><th>Status</th><th></th></tr></thead>
		<tbody>
			{#each data.submissions as s (s.id)}
				<tr>
					<td>{s.space_name}</td>
					<td><a class="anchor" href="/spaces/{s.space}/submissions/{s.id}">{s.submitted_at || 'Not known'}</a></td>
					<td><Badge value={String(s.status)} tone={s.status === 'approved' ? 'success' : s.status === 'refused' ? 'error' : 'primary'} /></td>
					<td>{#if s.mine}You review it{/if}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
