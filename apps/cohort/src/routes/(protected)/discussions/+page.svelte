<script lang="ts">
	import { CHAT_LABELS, ChatRoomList } from '@obp/shared/chat';
	import { t, type Locale } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{t(locale, 'discussions_heading')}</h1>
<p class="mt-2 mb-6">{t(locale, 'discussions_intro')}</p>
<ChatRoomList {data} {form} labels={CHAT_LABELS[locale]} basePath="/discussions" />
