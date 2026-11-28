<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import { PageRoleCheck } from '@obp/shared/components';

	let { data, form } = $props();
	const required = $derived(data.roles.map((r) => ({ role: r.role, bankId: data.space })));
</script>

<h1 class="h2">Example data</h1>
<p class="mt-2 max-w-3xl">
	Adds an example suite, <code>EXAMPLE-AIS</code>, with requirements from a made-up framework, four automated tests and two evidence tests. Its tests
	are written for the fake bank that comes with the runner (<code>apps/conformator-runner/dev</code>), so a first run has something to pass.
	It uses your own Roles at <code>{data.space}</code>. Adding again skips what is there.
</p>

<div class="mt-4">
	<PageRoleCheck userEntitlements={data.userEntitlements} {required} requirementType="AND">
		<form method="POST" action="?/add"><button class="btn preset-filled-primary-500" data-testid="example-add">Add the example suite</button></form>
	</PageRoleCheck>
</div>

{#if form?.steps}
	<ol class="mt-4 list-inside list-decimal" data-testid="example-steps">
		{#each form.steps as s, i (i)}<li class={s.ok ? '' : 'ui-text-error'}>{s.step}: {s.ok ? 'done' : 'failed'}{s.detail ? `. ${s.detail}` : ''}</li>{/each}
	</ol>
	{#if form.steps.every((s) => s.ok)}<p class="mt-2"><a class="anchor" href="/staff/suites">See it in Suites and tests</a></p>{/if}
{/if}
