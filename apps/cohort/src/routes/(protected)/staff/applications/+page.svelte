<script lang="ts">
	import ApplicationsTable from '$lib/components/ApplicationsTable.svelte';
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { DECISIONS } from '$lib/screening';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{t(locale, 'staff_submitted_heading')}</h1>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{t(locale, 'staff_error')} {String(form.error)}</p>{/if}

{#if data.lacking}
	<div class="mt-6"><MissingRole {locale} space={data.space} role={data.lacking} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>
{:else}
	<form method="GET" class="mt-4 flex flex-wrap items-end gap-3" data-testid="applications-filter">
		<label class="label w-auto">
			<span class="label-text">{t(locale, 'application_call')}</span>
			<select class="select w-auto" name="call_id">
				<option value="">{t(locale, 'filter_any')}</option>
				{#each data.calls as c (c.id)}<option value={c.id} selected={c.id === data.filter.call_id}>{c.title}</option>{/each}
			</select>
		</label>
		<label class="label w-auto">
			<span class="label-text">{t(locale, 'screening_decision')}</span>
			<select class="select w-auto" name="decision">
				<option value="">{t(locale, 'filter_any')}</option>
				<option value="none" selected={data.filter.decision === 'none'}>{t(locale, 'filter_undecided')}</option>
				{#each DECISIONS as d (d)}<option value={d} selected={d === data.filter.decision}>{t(locale, `decision_${d}` as MessageKey)}</option>{/each}
			</select>
		</label>
		<button class="btn preset-tonal">{t(locale, 'filter_apply')}</button>
	</form>

	<section class="card preset-outlined-surface-200-800 mt-4 p-4">
		{#if data.error}
			<p class="preset-tonal-error rounded p-3" role="alert">{data.error}</p>
		{:else if data.applications.length === 0}
			<p>{t(locale, 'staff_submitted_none')}</p>
		{:else}
			<p class="mb-2 text-sm">{data.applications.length} {t(locale, 'staff_submitted_count')}</p>
			<ApplicationsTable {locale} applications={data.applications} />
		{/if}
	</section>
{/if}
