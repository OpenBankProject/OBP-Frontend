<script lang="ts">
	import { page } from '$app/state';
	import MissingRole from '$lib/components/MissingRole.svelte';
	import CallFields from '$lib/components/CallFields.svelte';
	import { t, type Locale } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const record = $derived(data.call as Record<string, unknown>);
</script>

<p><a class="anchor" href="/staff/calls/{page.params.id}">{String(record.title ?? '')}</a></p>
<h1 class="h2">{t(locale, 'staff_edit')}</h1>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{t(locale, 'staff_error')} {String(form.error)}</p>{/if}

{#if data.lackingUpdate}
	<div class="mt-4"><MissingRole {locale} space={data.space} role={data.lackingUpdate} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>
{:else}
	<form method="POST" action="?/save" class="mt-4 flex max-w-xl flex-col gap-2">
		<CallFields {locale} programmes={data.programmes} values={record} />
		<button class="btn preset-filled self-start" data-testid="staff-save">{t(locale, 'staff_save')}</button>
	</form>
{/if}
