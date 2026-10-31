<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import { t, type Locale } from '$lib/i18n';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{t(locale, 'my_applications_heading')}</h1>

{#if data.error}
	<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{data.error}</p>
{:else if data.applications.length === 0}
	<p class="mt-4" data-testid="my-applications-none">{t(locale, 'my_applications_none')}</p>
{:else}
	<div class="table-wrap mt-4">
	<table class="table" data-testid="my-applications">
		<thead>
			<tr>
				<th>{t(locale, 'application_call')}</th>
				<th>{t(locale, 'field_startup_name')}</th>
				<th>{t(locale, 'application_status')}</th>
				<th>{t(locale, 'screening_outcome')}</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each data.applications as application (application.id)}
				<tr>
					<td>{application.call}</td>
					<td>{application.startup_name}</td>
					<td><Badge {locale} kind="status" value={application.status} /></td>
					<td><Badge {locale} kind="decision" value={application.decision} /></td>
					<td><a class="btn btn-sm preset-tonal" href="/applications/{application.id}">{t(locale, 'application_open')}</a></td>
				</tr>
			{/each}
		</tbody>
	</table>
	</div>
{/if}
