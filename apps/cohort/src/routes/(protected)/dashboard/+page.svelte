<script lang="ts">
	import { t, type Locale } from '$lib/i18n';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{t(locale, 'dashboard_heading')}</h1>

{#if data.user}
	<dl class="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1" data-testid="current-user">
		<dt>{t(locale, 'user_username')}</dt>
		<dd>{data.user.username}</dd>
		<dt>{t(locale, 'user_email')}</dt>
		<dd>{data.user.email}</dd>
		<dt>{t(locale, 'user_roles')}</dt>
		<dd>{data.user.roleCount}</dd>
	</dl>
{/if}
