<script lang="ts">
	import { t, type Locale } from '$lib/i18n';

	interface Props {
		locale: Locale;
		space: string;
		role: { role_name: string; requested: boolean };
		/** The API Manager's Entitlement Requests page, where administrators accept requests. */
		entitlementRequestsUrl: string | null;
		/** The form action that requests a Role, e.g. ?/requestRole. */
		action?: string;
	}

	let { locale, space, role, entitlementRequestsUrl, action = '?/requestRole' }: Props = $props();
</script>

<div class="preset-tonal-warning rounded p-3" role="status" data-testid="missing-role-{role.role_name}">
	<p>{t(locale, 'missing_role_text')} <code>{role.role_name}</code> {t(locale, 'missing_role_at')} <code>{space}</code>.</p>
	<div class="mt-2 flex flex-wrap items-center gap-3">
		{#if role.requested}
			<span>{t(locale, 'access_requested')}</span>
		{:else}
			<form method="POST" {action}>
				<input type="hidden" name="role_name" value={role.role_name} />
				<button class="btn btn-sm preset-filled" data-testid="missing-role-request-{role.role_name}">{t(locale, 'access_request')}</button>
			</form>
		{/if}
		<a class="anchor text-sm" href="/staff/access">{t(locale, 'nav_access')}</a>
		{#if entitlementRequestsUrl}
			<a class="anchor text-sm" href={entitlementRequestsUrl}>{t(locale, 'access_admin_link')}</a>
		{/if}
	</div>
</div>
