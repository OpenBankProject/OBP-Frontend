<script lang="ts">
	import { page } from '$app/state';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
	const programme = $derived(data.programme as Record<string, unknown>);
	const value = (key: string) => String(programme[key] ?? '');
	const status = (s: string) => (s ? t(locale, `status_${s}` as MessageKey) : '');
</script>

<p><a class="anchor" href="/staff">{t(locale, 'staff_heading')}</a></p>
<h1 class="h2">{value('name')}</h1>
<p class="mt-1"><a class="btn btn-sm preset-tonal" href="/staff/programmes/{page.params.id}/edit" data-testid="staff-edit">{t(locale, 'staff_edit')}</a></p>

<dl class="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2" data-testid="staff-programme-fields">
	<dt>{t(locale, 'staff_field_status')}</dt><dd>{status(value('status'))}</dd>
	<dt>{t(locale, 'staff_field_starts_on')}</dt><dd>{value('starts_on')}</dd>
	<dt>{t(locale, 'staff_field_ends_on')}</dt><dd>{value('ends_on')}</dd>
	<dt>{t(locale, 'staff_field_description')}</dt><dd class="whitespace-pre-line">{value('description')}</dd>
</dl>


<section class="mt-8" data-testid="staff-programme-calls">
	<h2 class="h4">{t(locale, 'staff_calls')}</h2>
	{#if data.calls.length === 0}<p>{t(locale, 'staff_none')}</p>{:else}
		<ul class="list-inside list-disc">
			{#each data.calls as c (c.id)}<li><a class="anchor" href="/staff/calls/{c.id}">{c.title}</a> ({status(c.status)})</li>{/each}
		</ul>
	{/if}
</section>
