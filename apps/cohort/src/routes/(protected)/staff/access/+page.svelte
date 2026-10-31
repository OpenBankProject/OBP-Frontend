<script lang="ts">
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{t(locale, 'access_heading')}</h1>
<p class="mt-2">{t(locale, 'access_intro')} <code>{data.space}</code>.</p>

{#if form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{t(locale, 'staff_error')} {form.error}</p>{/if}
{#if form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}

<table class="table mt-4" data-testid="access-roles">
	<thead>
		<tr>
			<th>{t(locale, 'setup_role')}</th>
			<th>{t(locale, 'setup_needed_for')}</th>
			<th>{t(locale, 'setup_held')}</th>
		</tr>
	</thead>
	<tbody>
		{#each data.roles as role (role.role_name)}
			<tr data-testid="access-role-{role.role_name}">
				<td><code>{role.role_name}</code></td>
				<td>{t(locale, role.purpose as MessageKey)}</td>
				<td>
					{#if role.held}
						{t(locale, 'setup_yes')}
					{:else if role.requested}
						{t(locale, 'access_requested')}
					{:else}
						<form method="POST" action="?/request">
							<input type="hidden" name="role_name" value={role.role_name} />
							<button class="btn btn-sm preset-tonal" data-testid="access-request-{role.role_name}">{t(locale, 'access_request')}</button>
						</form>
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<p class="mt-4 text-sm">
	{t(locale, 'access_admin_note')}
	{#if data.entitlementRequestsUrl}
		<a class="anchor" href={data.entitlementRequestsUrl} data-testid="access-entitlement-requests-link">{t(locale, 'access_admin_link')}</a>
	{/if}
</p>
