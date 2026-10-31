<script lang="ts">
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{t(locale, 'login_heading')}</h1>

{#if data.loginError}
	<p class="mt-4 preset-tonal-error rounded p-3" role="alert" data-testid="login-error">
		{t(locale, `login_error_${data.loginError}` as MessageKey)}
	</p>
{/if}

{#if data.providers.length === 0}
	<p class="mt-4" data-testid="no-providers">{t(locale, 'login_no_providers')}</p>
{:else}
	<ul class="mt-4 flex flex-col gap-2">
		{#each data.providers as provider (provider)}
			<li>
				<a class="btn preset-filled" href="/login/{provider}" data-testid="login-provider-{provider}"
					>{t(locale, 'login_with')} {provider}</a
				>
			</li>
		{/each}
	</ul>
{/if}
