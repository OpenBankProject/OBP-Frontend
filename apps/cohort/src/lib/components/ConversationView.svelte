<script lang="ts">
	import { t, type Locale } from '$lib/i18n';
	import type { ConversationMessage } from '$lib/conversations';

	/** One recorded Opey conversation: its fields, then the messages as plain text (never HTML or markdown). */
	let {
		locale,
		conversation: c,
		messages,
		backHref,
		backLabel,
		showUser = false
	}: {
		locale: Locale;
		conversation: { title: string; user_id: string; page: string; thread_id: string; started_at: string; updated_at: string; consent_reference_ids: string[] };
		messages: ConversationMessage[];
		backHref: string;
		backLabel: string;
		showUser?: boolean;
	} = $props();
</script>

<p><a class="anchor" href={backHref}>{backLabel}</a></p>
<h1 class="h2">{c.title}</h1>

<dl class="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1" data-testid="conversation-fields">
	{#if showUser}<dt>{t(locale, 'conversation_user')}</dt><dd><code class="text-xs">{c.user_id}</code></dd>{/if}
	<dt>{t(locale, 'conversation_page')}</dt><dd>{c.page}</dd>
	<dt>{t(locale, 'conversation_started')}</dt><dd>{c.started_at}</dd>
	<dt>{t(locale, 'conversation_updated')}</dt><dd>{c.updated_at}</dd>
	<dt>{t(locale, 'conversation_thread')}</dt><dd><code class="text-xs">{c.thread_id}</code></dd>
	{#if c.consent_reference_ids.length}
		<dt>{t(locale, 'conversation_consents')}</dt>
		<dd>{#each c.consent_reference_ids as ref (ref)}<code class="me-2 text-xs">{ref}</code>{/each}</dd>
	{/if}
</dl>

<ol class="mt-6 flex flex-col gap-3" data-testid="conversation-messages">
	{#each messages as m (m.id)}
		<li
			class="card max-w-3xl p-3 {m.role === 'user' ? 'preset-tonal-tertiary self-end' : 'preset-outlined-surface-200-800 self-start'}"
		>
			<p class="text-xs text-surface-700-300">{m.role === 'user' ? t(locale, 'conversation_role_user') : t(locale, 'conversation_role_opey')} · {m.at}</p>
			<p class="mt-1 whitespace-pre-wrap break-words">{m.text}</p>
		</li>
	{/each}
</ol>
