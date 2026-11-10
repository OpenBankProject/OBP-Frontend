<script lang="ts">
	import AnnouncementList from '$lib/components/AnnouncementList.svelte';
	import PublishedPage from '$lib/components/PublishedPage.svelte';
	import { CalendarClock } from '@lucide/svelte';
	import { t, type Locale } from '$lib/i18n';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
</script>

{#snippet calls()}
	{#if data.home}
		{#if data.announcements.length}<div class="mb-6"><AnnouncementList {locale} announcements={data.announcements} /></div>{/if}
		<PublishedPage page={data.home} {locale} />
	{:else}
		{@render callList()}
	{/if}
{/snippet}

{#snippet callList()}
	<section>
		{#if data.announcements.length}<div class="mb-6"><AnnouncementList {locale} announcements={data.announcements} /></div>{/if}
		<h1 class="h2">{t(locale, 'calls_open_heading')}</h1>

		{#if data.error}
			<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{data.error}</p>
		{:else if data.calls.length === 0}
			<p class="mt-4" data-testid="calls-none">{t(locale, 'calls_none')}</p>
		{:else}
			<ul class="mt-4 flex flex-col gap-4" data-testid="calls">
				{#each data.calls as call (call.id)}
					<li class="card preset-filled-surface-50-950 flex flex-col gap-2 p-5 shadow-md">
						{#if call.programme}<span class="badge preset-tonal-tertiary self-start">{call.programme}</span>{/if}
						<h2 class="h4" dir="auto"><a href="/calls/{call.id}">{call.title}</a></h2>
						{#if call.description}<p dir="auto">{call.description}</p>{/if}
						<div class="mt-1 flex flex-wrap items-center justify-between gap-3">
							<p class="flex items-center gap-2 text-sm text-surface-700-300">
								<CalendarClock class="size-4" aria-hidden="true" />
								{#if call.opens_at}{t(locale, 'call_opens')}: {call.opens_at}{/if}
								{#if call.closes_at} · {t(locale, 'call_closes')}: {call.closes_at}{/if}
							</p>
							<a class="btn btn-sm preset-filled-primary-500" href="/calls/{call.id}" data-testid="call-view-{call.id}">{t(locale, 'call_view')}</a>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/snippet}

{@render calls()}
