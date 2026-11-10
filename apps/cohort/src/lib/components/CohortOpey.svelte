<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { CalendarClock, FileText, ListChecks, Maximize2, MessageSquarePlus, Minus, X } from '@lucide/svelte';
	import { OpeyChat, type OpeyChatOptions, type SuggestedQuestion } from '@obp/shared/components';
	import { t, type Locale } from '$lib/i18n';

	/**
	 * Opey on every page of Cohort: a button in the bottom corner that opens a chat panel floating over the page. It
	 * lives in the root layout, so the conversation carries on from page to page.
	 */
	interface Props {
		locale: Locale;
		opey: { baseUrl: string; bankId: string };
		user: { username: string } | null;
		portalUrl: string | null;
	}
	let { locale, opey, user, portalUrl }: Props = $props();

	/**
	 * Opey floats over the page, opened from the button at the bottom corner. Minimised, only its title bar shows;
	 * closed, only the button. Either way the chat stays loaded, so the conversation is still there when it comes
	 * back, also after moving to another page of Cohort.
	 */
	let view = $state<'closed' | 'open' | 'minimised'>('closed');

	// The conversation is kept in this browser tab, per user, so it comes back after a page reload; so does whether the
	// panel was open or minimised. "New conversation" forgets it and starts the chat again.
	const VIEW_KEY = 'cohort-opey-view';
	const chatKey = $derived(`cohort-opey-chat:${user?.username ?? ''}`);
	let chatRun = $state(0);
	let mounted = $state(false);
	// Until the first message, the panel is only as tall as what it shows (the questions to start with and the message
	// box), so it has no empty space; with a conversation it takes its full size.
	let empty = $state(true);

	function newConversation() {
		try {
			sessionStorage.removeItem(chatKey);
		} catch {}
		chatRun += 1;
	}

	onMount(() => {
		let saved = null;
		try {
			saved = sessionStorage.getItem(VIEW_KEY);
		} catch {}
		if (saved === 'open' || saved === 'minimised') {
			openOpey();
			view = saved;
		}
		mounted = true;
	});

	$effect(() => {
		if (!mounted) return;
		try {
			sessionStorage.setItem(VIEW_KEY, view);
		} catch {}
	});

	// Where the Opey panel is and how big, in pixels. Visitors drag it by its header and resize it by its corner grip;
	// this browser remembers the result. Until then it sits above the button. The panel is placed by its bottom edge, so
	// when it is shorter than its size (an empty conversation, or minimised to its title bar) it sits at the bottom.
	const BOX_KEY = 'cohort-opey-box';
	const MIN_W = 300;
	const MIN_H = 320;
	const MARGIN = 8;
	let box = $state<{ x: number; y: number; w: number; h: number } | null>(null);
	const rtl = () => document.documentElement.dir === 'rtl';

	/** Keeps the panel inside the window, at least its minimum size. */
	function clamp(b: { x: number; y: number; w: number; h: number }) {
		const w = Math.max(MIN_W, Math.min(b.w, innerWidth - 2 * MARGIN));
		const h = Math.max(MIN_H, Math.min(b.h, innerHeight - 2 * MARGIN));
		return {
			w,
			h,
			x: Math.max(MARGIN, Math.min(b.x, innerWidth - w - MARGIN)),
			y: Math.max(MARGIN, Math.min(b.y, innerHeight - h - MARGIN))
		};
	}

	function defaultBox() {
		// Wide enough for the three starting questions on one row.
		const w = 544;
		const h = Math.min(Math.round(innerHeight * 0.7), innerHeight - 128);
		return { w, h, x: rtl() ? 16 : innerWidth - w - 16, y: innerHeight - h - 96 };
	}

	function saveBox() {
		try {
			localStorage.setItem(BOX_KEY, JSON.stringify(box));
		} catch {}
	}

	function openOpey() {
		if (!box) {
			let saved = null;
			try {
				saved = JSON.parse(localStorage.getItem(BOX_KEY) ?? 'null');
			} catch {}
			const ok = saved && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(saved[k]));
			box = clamp(ok ? saved : defaultBox());
		}
		view = 'open';
	}

	/** Follows the pointer from pointerdown to pointerup, calling move with how far it has gone. */
	function track(e: PointerEvent, move: (dx: number, dy: number) => void) {
		if (e.button !== 0) return;
		e.preventDefault();
		const el = e.currentTarget as HTMLElement;
		const startX = e.clientX;
		const startY = e.clientY;
		el.setPointerCapture(e.pointerId);
		const onMove = (ev: PointerEvent) => move(ev.clientX - startX, ev.clientY - startY);
		const onUp = () => {
			el.removeEventListener('pointermove', onMove);
			el.removeEventListener('pointerup', onUp);
			el.removeEventListener('pointercancel', onUp);
			saveBox();
		};
		el.addEventListener('pointermove', onMove);
		el.addEventListener('pointerup', onUp);
		el.addEventListener('pointercancel', onUp);
	}

	function startDrag(e: PointerEvent) {
		if (!box || (e.target as HTMLElement).closest('button')) return;
		const start = { ...box };
		track(e, (dx, dy) => (box = clamp({ ...start, x: start.x + dx, y: start.y + dy })));
	}

	function startResize(e: PointerEvent) {
		if (!box) return;
		const start = { ...box };
		// The grip is in the bottom corner on the reading side's end: right in English, left in Arabic.
		track(e, (dx, dy) =>
			(box = clamp(
				rtl()
					? { ...start, x: Math.min(start.x + dx, start.x + start.w - MIN_W), w: start.w - dx, h: start.h + dy }
					: { ...start, w: start.w + dx, h: start.h + dy }
			))
		);
	}

	/**
	 * Moves the panel and its button to the end of <body>, so they float over the whole window. Inside the layout
	 * they would be placed relative to the content column, beside the sidebar, not to the window.
	 */
	function toBody(node: HTMLElement) {
		document.body.appendChild(node);
		return { destroy: () => node.remove() };
	}

	/** Back to the place and size above the button. */
	function resetBox() {
		box = clamp(defaultBox());
		saveBox();
	}

	const suggestedQuestions: SuggestedQuestion[] = $derived([
		{ questionString: t(locale, 'opey_q_eligible'), pillTitle: t(locale, 'opey_pill_eligible'), icon: ListChecks },
		{ questionString: t(locale, 'opey_q_apply'), pillTitle: t(locale, 'opey_pill_apply'), icon: FileText },
		{ questionString: t(locale, 'opey_q_deadlines'), pillTitle: t(locale, 'opey_pill_deadlines'), icon: CalendarClock }
	]);

	const opeyChatOptions: Partial<OpeyChatOptions> = $derived({
		baseUrl: opey.baseUrl,
		displayHeader: false,
		currentlyActiveUserName: user?.username ?? '',
		suggestedQuestions,
		bodyClasses: 'bg-opacity-0',
		footerClasses: 'bg-opacity-0',
		displayConnectionPips: true,
		// Cohort's visitors see Opey's answers, not the API calls behind them; consent requests still show.
		showToolCalls: false,
		rememberAs: chatKey,
		inputPlaceholder: t(locale, 'opey_placeholder'),
		// Requests that name no bank are about Cohort's space.
		currentBankId: opey.bankId,
		// Cohort serves no generic OBP proxy, so the chat skips the new-entitlements notice, and its consent label is
		// a link to the Portal's consents page, where Users see and revoke what they gave Opey.
		entitlementsUrl: '',
		consentsUrl: '',
		...(portalUrl ? { consentsPageHref: `${portalUrl}/user/consents` } : {})
	});

	interface ContextCall {
		id: string;
		title: string;
		programme?: string;
		opens_at?: string;
		closes_at?: string;
		eligibility?: string;
		description?: string;
	}

	/** What the visitor sees, sent with each message: the page they are on, and on the start page the open calls. */
	function clientContext(): string {
		const lines = [`Cohort, a startup programme website. The visitor is on the page ${page.url.pathname}.`];
		const calls = (page.data as { calls?: ContextCall[] }).calls;
		if (Array.isArray(calls)) {
			if (calls.length === 0) lines.push('No calls for applications are open.');
			else {
				lines.push('The open calls for applications:');
				for (const c of calls)
					lines.push(
						`- "${c.title}"${c.programme ? ` (programme: ${c.programme})` : ''}, opens ${c.opens_at || 'now'}, ` +
							`closes ${c.closes_at || 'not set'}, page /calls/${c.id}, eligible: ${c.eligibility}${c.description ? `. ${c.description}` : ''}`
					);
			}
		}
		lines.push(
			'To apply, open a call and press Apply (logging in is needed); an application is saved as a draft until it is submitted.',
			"An application that does not meet its call's eligibility is not refused: a screener reviews it."
		);
		return lines.join('\n');
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && view === 'open') view = 'closed';
	}}
	onresize={() => {
		if (box) box = clamp(box);
	}}
/>

<div use:toBody>
	<section
		id="opey-panel"
		class="card preset-outlined-surface-200-800 bg-surface-50-950 fixed z-40 flex flex-col overflow-hidden shadow-2xl"
		class:hidden={view === 'closed' || !box}
		style={box
			? view === 'minimised'
				? `left:${box.x}px;bottom:${innerHeight - box.y - box.h}px;width:${box.w}px`
				: `left:${box.x}px;bottom:${innerHeight - box.y - box.h}px;width:${box.w}px;${empty ? 'max-height' : 'height'}:${box.h}px`
			: undefined}
		aria-labelledby="opey-heading"
		data-testid="opey-panel"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="flex cursor-move touch-none items-start gap-2 px-4 pt-3 select-none"
			class:pb-3={view === 'minimised'}
			title={t(locale, 'opey_drag')}
			onpointerdown={startDrag}
			ondblclick={resetBox}
			data-testid="opey-drag"
		>
			<div class="min-w-0 flex-1">
				<h2 id="opey-heading" class="h5">{t(locale, 'opey_heading')}</h2>
				<p class="text-sm text-surface-700-300" class:hidden={view === 'minimised'}>{t(locale, 'opey_intro')}</p>
			</div>
			{#if view !== 'minimised'}
				<button type="button" class="btn-icon btn-icon-sm shrink-0" aria-label={t(locale, 'opey_new_chat')} title={t(locale, 'opey_new_chat')} onclick={newConversation} data-testid="opey-new-chat">
					<MessageSquarePlus class="size-5" aria-hidden="true" />
				</button>
			{/if}
			{#if view === 'minimised'}
				<button type="button" class="btn-icon btn-icon-sm shrink-0" aria-label={t(locale, 'opey_restore')} title={t(locale, 'opey_restore')} onclick={() => (view = 'open')} data-testid="opey-restore">
					<Maximize2 class="size-4" aria-hidden="true" />
				</button>
			{:else}
				<button type="button" class="btn-icon btn-icon-sm shrink-0" aria-label={t(locale, 'opey_minimise')} title={t(locale, 'opey_minimise')} onclick={() => (view = 'minimised')} data-testid="opey-minimise">
					<Minus class="size-5" aria-hidden="true" />
				</button>
			{/if}
			<button type="button" class="btn-icon btn-icon-sm shrink-0" aria-label={t(locale, 'opey_close')} title={t(locale, 'opey_close')} onclick={() => (view = 'closed')} data-testid="opey-close">
				<X class="size-5" aria-hidden="true" />
			</button>
		</div>
		<div class="min-h-0 flex-1" class:hidden={view === 'minimised'}>
			{#key `${chatKey}#${chatRun}`}
				<OpeyChat {opeyChatOptions} userAuthenticated={!!user} {clientContext} onMessageCount={(n) => (empty = n === 0)} />
			{/key}
		</div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute end-0 bottom-0 size-5 touch-none cursor-se-resize rtl:cursor-sw-resize"
			class:hidden={view === 'minimised'}
			title={t(locale, 'opey_resize')}
			onpointerdown={startResize}
			data-testid="opey-resize"
		>
			<svg viewBox="0 0 20 20" class="size-full text-surface-500 rtl:-scale-x-100" aria-hidden="true"><path d="M18 8 8 18M18 13l-5 5" stroke="currentColor" stroke-width="1.5" fill="none" /></svg>
		</div>
	</section>
	<button
		type="button"
		class="fixed end-6 bottom-6 z-40 size-16 overflow-hidden rounded-full shadow-xl ring-2 ring-primary-500 transition-transform hover:scale-105"
		aria-label={t(locale, view === 'open' ? 'opey_close' : 'opey_open')}
		aria-expanded={view === 'open'}
		aria-controls="opey-panel"
		onclick={() => (view === 'open' ? (view = 'closed') : openOpey())}
		data-testid="opey-launcher"
	>
		<img src="/images/opey_avatar.png" alt="" class="size-full object-cover" />
	</button>
</div>
