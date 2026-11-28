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
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const methodCount = $derived(data.services.reduce((n, s) => n + s.methods.length, 0));
</script>

<svelte:head>
	<title>gRPC services - API Explorer</title>
	<meta name="description" content="The gRPC services this OBP instance serves." />
</svelte:head>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
	<header class="flex flex-col gap-2">
		<h1 class="text-2xl font-semibold ui-text">gRPC</h1>
		<p class="text-sm ui-muted">
			{data.services.length}
			{data.services.length === 1 ? 'service' : 'services'}, {methodCount}
			{methodCount === 1 ? 'method' : 'methods'} on
			<span class="font-mono">{data.host}</span>
			{data.tls ? '(TLS)' : '(plaintext)'}, read by server reflection.
		</p>
	</header>

	{#if data.reflectionError}
		<div class="flex flex-col gap-2 rounded border p-4 text-sm ui-border" role="alert">
			<p class="ui-text">Could not reflect against <span class="font-mono">{data.host}</span>.</p>
			<p class="font-mono text-xs ui-muted">{data.reflectionError}</p>
			<p class="text-xs ui-muted">
				This OBP instance may not serve gRPC, or may not have server reflection enabled. The
				target comes from <span class="font-mono">OBP_GRPC_HOST</span>, falling back to the API
				host.
			</p>
		</div>
	{/if}

	{#each data.services as service (service.name)}
		<section class="flex flex-col gap-2 border-t pt-4 ui-border" id={service.name}>
			<h2 class="font-mono text-sm font-semibold ui-text">{service.name}</h2>

			{#if service.error}
				<p class="font-mono text-xs ui-muted">{service.error}</p>
			{/if}

			{#each service.methods as method (method.name)}
				<details class="border-t pt-2 ui-border">
					<summary class="cursor-pointer font-mono text-xs ui-text">
						{method.signature}
					</summary>
					<div class="mt-2 grid gap-4 sm:grid-cols-2">
						<div>
							<h3 class="text-xs font-semibold uppercase tracking-wide ui-muted">
								Request
							</h3>
							<dl class="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
								{#each method.requestFields as field (field.name)}
									<dt class="font-mono ui-text">{field.name}</dt>
									<dd class="ui-muted">
										{field.rule ? `${field.rule} ` : ''}{field.type}
									</dd>
								{:else}
									<dd class="col-span-2 ui-muted">No fields.</dd>
								{/each}
							</dl>
						</div>
						<div>
							<h3 class="text-xs font-semibold uppercase tracking-wide ui-muted">
								Response
							</h3>
							<dl class="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
								{#each method.responseFields as field (field.name)}
									<dt class="font-mono ui-text">{field.name}</dt>
									<dd class="ui-muted">
										{field.rule ? `${field.rule} ` : ''}{field.type}
									</dd>
								{:else}
									<dd class="col-span-2 ui-muted">No fields.</dd>
								{/each}
							</dl>
						</div>
					</div>
				</details>
			{:else}
				<p class="text-xs ui-muted">No methods resolved.</p>
			{/each}
		</section>
	{/each}
</div>
