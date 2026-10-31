<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { t, type Locale } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{t(locale, 'example_heading')}</h1>
<p class="mt-2">{t(locale, 'example_intro')}</p>

<ul class="mt-4 flex flex-col gap-3" data-testid="example-list">
	{#each data.examples as p (p.name)}
		<li class="card preset-outlined-surface-200-800 p-4">
			<p class="font-semibold">{p.name} <Badge {locale} kind="status" value={p.status} /></p>
			<ul class="mt-1 list-inside list-disc text-sm">
				{#each p.calls as c (c.title)}
					<li>{c.title} <Badge {locale} kind="status" value={c.status} />{#if c.applications} · {c.applications} {t(locale, 'example_applications')}{/if}</li>
				{/each}
			</ul>
		</li>
	{/each}
</ul>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{t(locale, 'staff_error')} {String(form.error)}</p>{/if}
{#if form && 'added' in form && form.added}
	<p class="mt-4 preset-tonal-success rounded p-3" role="status" data-testid="example-added">
		{t(locale, 'example_added')}
		{form.added.programmes} {t(locale, 'staff_programmes')} · {form.added.calls} {t(locale, 'staff_calls')} · {form.added.applications} {t(locale, 'staff_applications')}
		{#if form.added.skipped} · {form.added.skipped} {t(locale, 'example_skipped')}{/if}
	</p>
{/if}

{#if data.lacking.length > 0}
	<div class="mt-6 flex flex-col gap-2">
		{#each data.lacking as role (role.role_name)}
			<MissingRole {locale} space={data.space} {role} entitlementRequestsUrl={data.entitlementRequestsUrl} />
		{/each}
	</div>
{:else}
	<form method="POST" action="?/add" class="mt-6">
		<button class="btn preset-filled" data-testid="example-add">{t(locale, 'example_add')}</button>
	</form>
{/if}
