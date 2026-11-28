<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import FormProblems from '$lib/components/FormProblems.svelte';
	import SystemFields from '$lib/components/SystemFields.svelte';

	let { data, form } = $props();
	const values = $derived((form as { values?: Record<string, string> } | null)?.values ?? data.system);
</script>

<p><a class="anchor" href="/spaces/{data.space}">{data.name}</a></p>
<h1 class="h2 mt-2">{data.system.name}</h1>
<p class="mt-1 text-sm">system id <code>{data.system.conformator_system_id}</code>: the runner's administrators file this system's secrets under it.</p>

{#if data.canEdit}
	{#if form?.saved}<p class="mt-4 ui-tone-success rounded p-3" role="status">Saved.</p>{/if}
	<FormProblems problems={form?.problems} />
	<form method="POST" action="?/save" class="mt-4 grid max-w-3xl gap-3">
		<SystemFields {values} systemRoles={data.systemRoles} roleFixed />
		<div><button class="btn preset-filled-primary-500" data-testid="system-save">Save</button></div>
	</form>
{:else}
	<dl class="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
		<dt>What it is</dt><dd>{String(data.system.system_role).replaceAll('_', ' ')}</dd>
		<dt>Base URL</dt><dd><code>{data.system.base_url}</code></dd>
		<dt>Discovery URL</dt><dd><code>{data.system.discovery_url || 'none'}</code></dd>
		<dt>Runner's client id</dt><dd><code>{data.system.runner_client_id || 'none'}</code></dd>
	</dl>
{/if}
