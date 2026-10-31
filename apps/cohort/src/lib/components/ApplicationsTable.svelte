<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import { t, type Locale } from '$lib/i18n';

	/** Applications as staff see them, each linking to its staff page. */
	interface Row {
		id: string;
		call: string;
		startup_name: string;
		status: string;
		eligibility: string;
		submitted_at: string;
		decision: string;
	}

	let { locale, applications }: { locale: Locale; applications: Row[] } = $props();
</script>

<div class="table-wrap">
	<table class="table" data-testid="applications-table">
		<thead>
			<tr>
				<th>{t(locale, 'staff_applicant')}</th>
				<th>{t(locale, 'application_call')}</th>
				<th>{t(locale, 'application_status')}</th>
				<th>{t(locale, 'application_eligibility')}</th>
				<th>{t(locale, 'application_submitted_at')}</th>
				<th>{t(locale, 'screening_decision')}</th>
			</tr>
		</thead>
		<tbody>
			{#each applications as a (a.id)}
				<tr>
					<td><a class="anchor" href="/staff/applications/{a.id}">{a.startup_name || a.id}</a></td>
					<td>{a.call}</td>
					<td><Badge {locale} kind="status" value={a.status} /></td>
					<td><Badge {locale} kind="eligibility" value={a.eligibility} /></td>
					<td>{a.submitted_at}</td>
					<td><Badge {locale} kind="decision" value={a.decision} /></td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
