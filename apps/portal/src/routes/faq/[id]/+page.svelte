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
	import { onMount } from 'svelte';
	import { MessagesSquare, Bot, ArrowLeft } from '@lucide/svelte';

	let { data } = $props();
	const item = $derived(data.item);

	let render = $state<((md: string) => string) | null>(null);
	onMount(async () => {
		try {
			render = (await import('@obp/shared/markdown')).renderMarkdown;
		} catch (e) {
			console.error('Markdown renderer failed to load; the answer stays plain text', e);
		}
	});

	const askHref = $derived(`/?ask=${encodeURIComponent(item.opey_prompt || item.question)}`);
</script>

<svelte:head>
	<title>{item.question}</title>
	<meta name="description" content={item.answer.slice(0, 160)} />
</svelte:head>

<div class="container mx-auto max-w-3xl px-4 py-8" data-testid="faq-detail" data-id={item.id}>
	<a href="/faq" class="mb-6 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"><ArrowLeft class="h-4 w-4" /> All questions</a>
	<span class="mb-3 block"><span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">{item.category}</span></span>
	<article class="grid grid-cols-[2.5rem_1fr] gap-x-3 gap-y-5">
		<span class="pt-1 text-3xl font-black leading-none text-blue-600 dark:text-blue-400" aria-hidden="true">Q</span>
		<h1 class="min-w-0 break-words text-3xl font-semibold leading-snug text-gray-900 dark:text-gray-100">{item.question}</h1>
		<span class="pt-0.5 text-3xl font-black leading-none text-emerald-600 dark:text-emerald-400" aria-hidden="true">A</span>
		<div class="prose prose-base min-w-0 max-w-none break-words text-gray-700 dark:prose-invert dark:text-gray-300 [overflow-wrap:anywhere]" data-testid="faq-detail-answer">
			{#if render}
				{@html render(item.answer)}
			{:else}
				<p class="whitespace-pre-line">{item.answer}</p>
			{/if}
		</div>
	</article>
	<div class="mt-8 flex flex-wrap gap-2 border-t border-gray-200 pt-5 dark:border-gray-700">
		<a href={askHref} class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700" data-testid="faq-ask-opey"><Bot class="h-4 w-4" /> Ask Opey</a>
		<form method="POST" action="/faq/chat/{encodeURIComponent(item.id)}">
			<button type="submit" class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" data-testid="faq-chat-button" data-state={item.chat_room_id ? 'join' : 'create'}>
				<MessagesSquare class="h-4 w-4" /> {item.chat_room_id ? 'Join the chat' : 'Start a chat'}
			</button>
		</form>
	</div>
</div>
