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
	const entry = $derived(data.entry);
</script>

<svelte:head>
	<title>{entry.title} - Glossary - API Explorer</title>
</svelte:head>

<article class="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
	<nav class="text-xs text-surface-600-400">
		<a class="anchor" href="/api-explorer/glossary">&larr; Glossary</a>
	</nav>

	<header class="flex flex-wrap items-baseline gap-3">
		<h1 class="text-2xl font-semibold text-surface-900-50">{entry.title}</h1>
		{#if entry.is_dynamic}
			<span class="rounded border border-surface-300-600 px-1.5 py-0.5 text-xs text-surface-600-400">
				dynamic
			</span>
		{/if}
		{#if entry.overrides_static_item}
			<span class="rounded border border-surface-300-600 px-1.5 py-0.5 text-xs text-surface-600-400">
				overrides a static item
			</span>
		{/if}
	</header>

	<section class="prose prose-sm max-w-prose dark:prose-invert">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- OBP's own glossary, rendered with html:false -->
		{@html entry.html}
	</section>
</article>
