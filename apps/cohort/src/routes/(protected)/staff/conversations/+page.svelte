<script lang="ts">
	import ConversationList from '$lib/components/ConversationList.svelte';
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { t, type Locale } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{t(locale, 'conversations_heading')}</h1>
<p class="mt-2">{t(locale, 'conversations_intro')}</p>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{t(locale, 'staff_error')} {String(form.error)}</p>{/if}

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="conversations">
	{#if data.lacking}
		<MissingRole {locale} space={data.space} role={data.lacking} entitlementRequestsUrl={data.entitlementRequestsUrl} />
	{:else if data.error}
		<p class="preset-tonal-error rounded p-3" role="alert">{data.error}</p>
	{:else if data.conversations.length === 0}
		<p>{t(locale, 'conversations_none')}</p>
	{:else}
		<ConversationList {locale} conversations={data.conversations} hrefBase="/staff/conversations" showUser />
	{/if}
</section>
