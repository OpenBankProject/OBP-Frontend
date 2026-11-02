<script lang="ts">
	import { t, type Locale } from '$lib/i18n';

	/** A table of recorded Opey conversations, newest first. The User column is for the staff audit view only. */
	let {
		locale,
		conversations,
		hrefBase,
		showUser = false
	}: {
		locale: Locale;
		conversations: { id: string; title: string; user_id: string; page: string; message_count: number; updated_at: string }[];
		hrefBase: string;
		showUser?: boolean;
	} = $props();
</script>

<div class="table-wrap">
	<table class="table">
		<thead>
			<tr>
				<th>{t(locale, 'conversation_title')}</th>
				{#if showUser}<th>{t(locale, 'conversation_user')}</th>{/if}
				<th>{t(locale, 'conversation_page')}</th>
				<th>{t(locale, 'conversation_messages')}</th>
				<th>{t(locale, 'conversation_updated')}</th>
			</tr>
		</thead>
		<tbody>
			{#each conversations as c (c.id)}
				<tr>
					<td><a class="anchor" href="{hrefBase}/{c.id}">{c.title}</a></td>
					{#if showUser}<td><code class="text-xs">{c.user_id}</code></td>{/if}
					<td>{c.page}</td>
					<td>{c.message_count}</td>
					<td>{c.updated_at}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
