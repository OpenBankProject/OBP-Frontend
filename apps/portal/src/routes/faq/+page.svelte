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
	import { CircleHelp, MessagesSquare, Bot, FileText } from '@lucide/svelte';

	let { data } = $props();

	// Answers are Markdown. The renderer needs browser globals, so it is loaded after mount;
	// until then the answer shows as plain text, which is what search engines index.
	let render = $state<((md: string) => string) | null>(null);
	onMount(async () => {
		try {
			const mod = await import('@obp/shared/markdown');
			render = mod.renderMarkdown;
		} catch (e) {
			console.error('Markdown renderer failed to load; answers stay plain text', e);
		}
	});

	const total = $derived(data.categories.reduce((n, c) => n + c.items.length, 0));
	// One flat list, in category order; the category rides on each card and the pills filter.
	const allItems = $derived(data.categories.flatMap((c) => c.items.map((i) => ({ ...i, category: c.name }))));
	let activeCategory = $state('');
	const visibleItems = $derived(activeCategory ? allItems.filter((i) => i.category === activeCategory) : allItems);
	/** The home page's Opey chat auto-sends ?ask=…; a question's own prompt wins over the question text. */
	const askHref = (item: { question: string; opey_prompt: string }) =>
		`/?ask=${encodeURIComponent(item.opey_prompt || item.question)}`;
	/** Every card posts to /faq/chat/ID: it joins the question's group chat, creating it on first use. */
	const chatAction = (item: { id: string }) => `/faq/chat/${encodeURIComponent(item.id)}`;
</script>

<svelte:head>
	<title>FAQ</title>
	<meta name="description" content="Frequently asked questions about this API portal, its products and getting started" />
</svelte:head>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<div class="mb-8 text-center">
		<h1 class="mb-2 flex items-center justify-center gap-2 text-3xl font-bold ui-text">
			<CircleHelp class="h-7 w-7" /> FAQ <span class="font-normal ui-muted">Frequently Asked Questions</span>
		</h1>
		<p class="ui-muted">Answers about the products, getting started and using the API. Ask Opey to go deeper, or join the group chat on a question.</p>
	</div>

	{#if data.unavailable}
		<p class="rounded-lg border p-4 text-sm ui-tone-warning" data-testid="faq-unavailable">{data.unavailable}</p>
	{:else if total === 0}
		<p class="text-center ui-muted" data-testid="faq-empty">No questions have been published yet.</p>
	{:else}
		{#if data.categories.length > 1}
			<nav class="mb-8 flex flex-wrap justify-center gap-2 text-sm" aria-label="Categories" data-testid="faq-categories">
				<button type="button" class="rounded-full border px-3 py-1 {activeCategory === '' ? 'preset-filled-primary-500' : 'ui-hover ui-muted ui-border'}" onclick={() => (activeCategory = '')} aria-pressed={activeCategory === ''}>All</button>
				{#each data.categories as c (c.name)}
					<button type="button" class="rounded-full border px-3 py-1 {activeCategory === c.name ? 'preset-filled-primary-500' : 'ui-hover ui-muted ui-border'}" onclick={() => (activeCategory = activeCategory === c.name ? '' : c.name)} aria-pressed={activeCategory === c.name}>{c.name}</button>
				{/each}
			</nav>
		{/if}
		<div class="grid gap-5 md:grid-cols-2 md:items-stretch" data-testid="faq-list">
			{#each visibleItems as item (item.id)}
				<article class="flex h-full flex-col rounded-xl border p-6 shadow-sm ui-card ui-border" data-testid="faq-item" data-category={item.category} data-chat={item.chat_room_id ? 'linked' : 'none'}>
					<div class="mb-3 flex items-start justify-between gap-3">
						<span class="rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ui-panel ui-muted" data-testid="faq-item-category">{item.category}</span>
					</div>
					<div class="grid flex-1 grid-cols-[2.5rem_1fr] content-start gap-x-3 gap-y-4">
						<span class="pt-1 text-3xl font-black leading-none ui-link" aria-hidden="true">Q</span>
						<h2 class="min-w-0 break-words text-xl font-semibold leading-snug ui-text"><a href="/faq/{item.id}" class="hover:underline">{item.question}</a></h2>
						<span class="pt-0.5 text-3xl font-black leading-none ui-text-success" aria-hidden="true">A</span>
						<div class="relative h-44 min-w-0 overflow-hidden" data-testid="faq-item-answer">
							<div class="prose prose-sm max-w-none break-words dark:prose-invert [overflow-wrap:anywhere] ui-muted">
								{#if render}
									{@html render(item.answer)}
								{:else}
									<p class="whitespace-pre-line">{item.answer}</p>
								{/if}
							</div>
							<div class="pointer-events-none absolute inset-x-0 bottom-0 h-10 ui-fade"></div>
						</div>
					</div>
					<div class="mt-5 flex flex-wrap gap-2 border-t pt-4 ui-border">
						<a href="/faq/{item.id}" class="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm ui-hover ui-muted ui-border" data-testid="faq-detail-link">
							<FileText class="h-4 w-4" /> More
						</a>
						<a href={askHref(item)} class="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium preset-filled-primary-500" data-testid="faq-ask-opey">
							<Bot class="h-4 w-4" /> Ask Opey
						</a>
						<form method="POST" action={chatAction(item)}>
							<button type="submit" class="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm ui-hover ui-muted ui-border" data-testid="faq-chat-button" data-state={item.chat_room_id ? 'join' : 'create'}>
								<MessagesSquare class="h-4 w-4" /> {item.chat_room_id ? 'Join the chat' : 'Start a chat'}
							</button>
						</form>
					</div>
				</article>
			{/each}
		</div>
	{/if}

	<p class="mt-8 text-center text-xs ui-muted">Something missing? <a href="/developers/getting-started" class="underline">Getting started</a> covers the first steps.</p>
</div>
