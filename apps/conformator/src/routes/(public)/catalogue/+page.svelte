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

<h1 class="h2">Test catalogue</h1>
{#if data.error}
	<p class="mt-4 preset-tonal-error rounded p-3" role="alert">The catalogue could not be read: {data.error}</p>
{:else if data.suites.length === 0}
	<p class="mt-4">There are no suites yet.</p>
{:else}
	<table class="table mt-4" data-testid="catalogue-suites">
		<thead>
			<tr><th>Suite</th><th>Version</th><th>Tests the</th><th>APIs</th><th>Status</th></tr>
		</thead>
		<tbody>
			{#each data.suites as suite (suite.conformator_suite_id)}
				<tr>
					<td><a class="anchor" href="/catalogue/{suite.conformator_suite_id}">{suite.name}</a> <code class="text-sm">{suite.code}</code></td>
					<td>{suite.version}</td>
					<td>{String(suite.system_role).replaceAll('_', ' ')}</td>
					<td>{String(suite.api_family).replaceAll('_', ' ')}</td>
					<td><Badge value={String(suite.status)} tone={suite.status === 'approved' ? 'success' : 'warning'} /></td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
