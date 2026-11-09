<script lang="ts">
	import { CHAT_LABELS, ChatRoomView } from '@obp/shared/chat';
	import type { Locale } from '$lib/i18n';

	let { data } = $props();
</script>

<!--
  One of Cohort's rooms. Cohort has no gRPC stream (its image ships no chat.proto), so new messages are polled; direct
  messages are system rooms, so there are none here. The browser's calls go through Cohort's chat proxy.
-->
{#key data.chatRoom.chat_room_id}
	<ChatRoomView
		{data}
		labels={CHAT_LABELS[data.locale as Locale]}
		basePath="/discussions"
		apiPrefix="/discussions/api"
		scope={data.chatScope}
		streamBase={null}
		startDmUrl={null}
	/>
{/key}
