<script lang="ts">
	import { t, type Locale } from '$lib/i18n';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{data.call.title}</h1>
{#if data.programme}<p class="mt-1">{t(locale, 'call_programme')}: {data.programme}</p>{/if}
{#if data.call.description}<p class="mt-4 whitespace-pre-line">{data.call.description}</p>{/if}
<p class="mt-4 text-sm">
	{#if data.call.opens_at}{t(locale, 'call_opens')}: {data.call.opens_at}{/if}
	{#if data.call.closes_at} · {t(locale, 'call_closes')}: {data.call.closes_at}{/if}
</p>

{#if data.myApplicationId}
	<a class="btn preset-filled mt-6" href="/applications/{data.myApplicationId}" data-testid="call-continue"
		>{t(locale, 'call_continue')}</a
	>
{:else if data.call.open}
	<form method="POST" action="?/apply" class="mt-6">
		<button type="submit" class="btn preset-filled" data-testid="call-apply">{t(locale, 'call_apply')}</button>
	</form>
{:else}
	<p class="mt-6" data-testid="call-closed">{t(locale, 'call_closed')}</p>
{/if}
