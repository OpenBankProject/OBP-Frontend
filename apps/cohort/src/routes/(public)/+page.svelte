<script lang="ts">
	import { CalendarClock, CircleHelp, FileText, ListChecks } from '@lucide/svelte';
	import { OpeyChat, type OpeyChatOptions, type SuggestedQuestion } from '@obp/shared/components';
	import { t, type Locale } from '$lib/i18n';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);

	const suggestedQuestions: SuggestedQuestion[] = $derived([
		{ questionString: t(locale, 'opey_q_eligible'), pillTitle: t(locale, 'opey_pill_eligible'), icon: ListChecks },
		{ questionString: t(locale, 'opey_q_apply'), pillTitle: t(locale, 'opey_pill_apply'), icon: FileText },
		{ questionString: t(locale, 'opey_q_deadlines'), pillTitle: t(locale, 'opey_pill_deadlines'), icon: CalendarClock },
		{ questionString: t(locale, 'opey_q_programmes'), pillTitle: t(locale, 'opey_pill_programmes'), icon: CircleHelp }
	]);

	const opeyChatOptions: Partial<OpeyChatOptions> = $derived({
		baseUrl: data.opey?.baseUrl,
		displayHeader: false,
		currentlyActiveUserName: data.user?.username ?? '',
		suggestedQuestions,
		bodyClasses: 'bg-opacity-0',
		footerClasses: 'bg-opacity-0',
		displayConnectionPips: true,
		// Cohort serves no generic OBP proxy, so the chat skips the new-entitlements notice and the consent lookup.
		entitlementsUrl: '',
		consentsUrl: ''
	});

	/** What the visitor sees, sent with each message so Opey answers about these calls. */
	function clientContext(): string {
		if (data.calls.length === 0) return 'Cohort, a startup programme website. No calls for applications are open.';
		const calls = data.calls.map(
			(c) =>
				`- "${c.title}"${c.programme ? ` (programme: ${c.programme})` : ''}, opens ${c.opens_at || 'now'}, ` +
				`closes ${c.closes_at || 'not set'}, page /calls/${c.id}${c.description ? `: ${c.description}` : ''}`
		);
		return [
			'Cohort, a startup programme website. The visitor is on the list of open calls for applications:',
			...calls,
			'To apply, open a call and press Apply (logging in is needed); an application is saved as a draft until it is submitted.',
			'Eligible: a local resident, or a business incorporated locally; anyone else is reviewed by a screener.'
		].join('\n');
	}
</script>

<div class="grid gap-8" class:lg:grid-cols-[minmax(0,1fr)_24rem]={data.opey}>
	<section>
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
						<h2 class="h4"><a href="/calls/{call.id}">{call.title}</a></h2>
						{#if call.description}<p>{call.description}</p>{/if}
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

	{#if data.opey}
		<section class="card preset-outlined-surface-200-800 flex h-[70vh] min-h-96 flex-col overflow-hidden" aria-labelledby="opey-heading" data-testid="opey-panel">
			<h2 id="opey-heading" class="h5 px-4 pt-3">{t(locale, 'opey_heading')}</h2>
			<p class="px-4 text-sm text-surface-700-300">{t(locale, 'opey_intro')}</p>
			<div class="min-h-0 flex-1">
				<OpeyChat {opeyChatOptions} userAuthenticated={!!data.user} {clientContext} />
			</div>
		</section>
	{/if}
</div>
