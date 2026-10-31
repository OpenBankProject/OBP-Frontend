<script lang="ts">
	import { t, type Locale } from '$lib/i18n';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{t(locale, 'calls_open_heading')}</h1>

{#if data.error}
	<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{data.error}</p>
{:else if data.calls.length === 0}
	<p class="mt-4" data-testid="calls-none">{t(locale, 'calls_none')}</p>
{:else}
	<ul class="mt-4 flex flex-col gap-4" data-testid="calls">
		{#each data.calls as call (call.id)}
			<li class="card preset-outlined-surface-200-800 p-4">
				<h2 class="h4"><a class="anchor" href="/calls/{call.id}">{call.title}</a></h2>
				{#if call.programme}<p class="text-sm">{t(locale, 'call_programme')}: {call.programme}</p>{/if}
				{#if call.description}<p class="mt-2">{call.description}</p>{/if}
				<p class="mt-2 text-sm">
					{#if call.opens_at}{t(locale, 'call_opens')}: {call.opens_at}{/if}
					{#if call.closes_at} · {t(locale, 'call_closes')}: {call.closes_at}{/if}
				</p>
			</li>
		{/each}
	</ul>
{/if}
