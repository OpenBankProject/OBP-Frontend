<script lang="ts">
	import ConversationView from '$lib/components/ConversationView.svelte';
	import { t, type Locale } from '$lib/i18n';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<ConversationView {locale} conversation={data.conversation} messages={data.messages} backHref="/conversations" backLabel={t(locale, 'my_conversations_heading')} />
