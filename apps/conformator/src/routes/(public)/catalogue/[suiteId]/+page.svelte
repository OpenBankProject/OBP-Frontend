<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import TestList from '$lib/components/TestList.svelte';
	import Badge from '$lib/components/Badge.svelte';

	let { data } = $props();
</script>

<p><a class="anchor" href="/catalogue">Test catalogue</a></p>
<h1 class="h2 mt-2">{data.suite.name}</h1>
<p class="mt-2">
	<code>{data.suite.code}</code> version {data.suite.version}
	<Badge value={String(data.suite.status)} tone={data.suite.status === 'approved' ? 'success' : 'warning'} />
</p>
{#if data.suite.description}<p class="mt-4 max-w-3xl">{data.suite.description}</p>{/if}
{#if data.suite.openapi_url}<p class="mt-2 text-sm">Responses are checked against <a class="anchor" href={data.suite.openapi_url}>this OpenAPI document</a>.</p>{/if}

<TestList tests={data.tests} />
