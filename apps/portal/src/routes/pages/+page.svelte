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
	let { data } = $props();
</script>

<svelte:head>
	<title>Pages</title>
	<meta name="description" content="Pages and apps published on this Portal" />
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<h1 class="mb-2 text-3xl font-bold ui-text">Pages</h1>
	<p class="mb-6 ui-muted">Pages and apps published by this bank.</p>

	{#if data.unavailable}
		<p class="rounded-lg border p-4 text-sm ui-tone-warning" data-testid="pages-unavailable">
			{data.unavailable}
		</p>
	{:else if data.pages.length === 0}
		<p class="ui-muted" data-testid="pages-empty">Nothing has been published yet.</p>
	{:else}
		<ul class="space-y-3" data-testid="pages-list">
			{#each data.pages as page (page.slug)}
				<li class="rounded-lg border p-4 ui-card ui-border" data-testid="pages-item" data-kind={page.kind}>
					<a href="/pages/{page.slug}" class="text-lg font-semibold hover:underline ui-text">{page.title}</a>
					<span class="ml-2 rounded-full px-2 py-0.5 text-xs ui-panel ui-muted">{page.kind === 'app' ? 'App' : 'Page'}</span>
					{#if page.summary}<p class="mt-1 text-sm ui-muted">{page.summary}</p>{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
