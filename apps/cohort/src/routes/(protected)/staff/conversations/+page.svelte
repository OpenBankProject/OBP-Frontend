<script lang="ts">
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
		<div class="table-wrap">
			<table class="table">
				<thead>
					<tr>
						<th>{t(locale, 'conversation_title')}</th>
						<th>{t(locale, 'conversation_user')}</th>
						<th>{t(locale, 'conversation_page')}</th>
						<th>{t(locale, 'conversation_messages')}</th>
						<th>{t(locale, 'conversation_updated')}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.conversations as c (c.id)}
						<tr>
							<td><a class="anchor" href="/staff/conversations/{c.id}">{c.title}</a></td>
							<td><code class="text-xs">{c.user_id}</code></td>
							<td>{c.page}</td>
							<td>{c.message_count}</td>
							<td>{c.updated_at}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
