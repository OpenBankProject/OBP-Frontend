<script lang="ts">
	import ConversationList from '$lib/components/ConversationList.svelte';
	import { t, type Locale } from '$lib/i18n';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{t(locale, 'my_conversations_heading')}</h1>
<p class="mt-2">{t(locale, 'my_conversations_intro')}</p>

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="my-conversations">
	{#if data.error}
		<p class="preset-tonal-error rounded p-3" role="alert">{data.error}</p>
	{:else if data.conversations.length === 0}
		<p>{t(locale, 'my_conversations_none')}</p>
	{:else}
		<ConversationList {locale} conversations={data.conversations} hrefBase="/conversations" />
	{/if}
</section>
