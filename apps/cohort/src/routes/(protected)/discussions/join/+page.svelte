<script lang="ts">
	import { CHAT_LABELS, ChatJoin } from '@obp/shared/chat';
	import type { Locale } from '$lib/i18n';

	let { data, form } = $props();
</script>

<ChatJoin {data} {form} labels={CHAT_LABELS[data.locale as Locale]} basePath="/discussions" />
