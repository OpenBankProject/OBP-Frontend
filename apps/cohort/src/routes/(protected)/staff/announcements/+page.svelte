<script lang="ts">
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { inReaderLocale } from '$lib/announcements';
	import { t, type Locale } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const missing = (key: keyof typeof data.lacking) => data.lacking[key];
	const programmeName = (id: string) => data.programmes.find((p) => p.id === id)?.name ?? id;
</script>

<h1 class="h2">{t(locale, 'announcements_heading')}</h1>
<p class="mt-2">{t(locale, 'announcements_intro')}</p>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}
	<p class="mt-4 preset-tonal-error rounded p-3" role="alert">
		{#if String(form.error) === 'announcement_title_missing'}{t(locale, 'announcement_title_missing')}{:else}{t(locale, 'staff_error')} {String(form.error)}{/if}
	</p>
{/if}
{#if form?.form === 'publish' && form?.published}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'announcement_published')}</p>{/if}
{#if form?.form === 'remove' && form?.removed}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'announcement_removed')}</p>{/if}

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="announcement-new">
	<h2 class="h4">{t(locale, 'announcement_new')}</h2>
	{#if missing('create')}
		<div class="mt-2"><MissingRole {locale} space={data.space} role={missing('create')!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>
	{:else}
		<form method="POST" action="?/publish" class="mt-2 grid gap-3 md:grid-cols-2">
			<label class="label"><span class="label-text">{t(locale, 'announcement_title')}</span><input class="input" name="title" maxlength="255" required /></label>
			<label class="label" dir="rtl"><span class="label-text">{t(locale, 'announcement_title_ar')}</span><input class="input" name="title_ar" maxlength="255" lang="ar" /></label>
			<label class="label"><span class="label-text">{t(locale, 'announcement_body')}</span><textarea class="textarea" name="body" rows="4" maxlength="4000"></textarea></label>
			<label class="label" dir="rtl"><span class="label-text">{t(locale, 'announcement_body_ar')}</span><textarea class="textarea" name="body_ar" rows="4" maxlength="4000" lang="ar"></textarea></label>
			<label class="label md:col-span-2">
				<span class="label-text">{t(locale, 'announcement_programme')}</span>
				<select class="select" name="programme_id">
					<option value="">{t(locale, 'announcement_everyone')}</option>
					{#each data.programmes as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
				</select>
			</label>
			<p class="text-sm md:col-span-2">{t(locale, 'announcement_public_note')}</p>
			<button class="btn preset-filled-primary-500 self-start" data-testid="announcement-publish">{t(locale, 'announcement_publish')}</button>
		</form>
	{/if}
</section>

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="announcements">
	<h2 class="h4">{t(locale, 'announcements_published')}</h2>
	{#if data.announcements.length === 0}
		<p class="mt-2">{t(locale, 'announcements_none')}</p>
	{:else}
		{#if missing('remove')}<div class="mt-2"><MissingRole {locale} space={data.space} role={missing('remove')!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>{/if}
		<ul class="mt-2 flex flex-col gap-3">
			{#each data.announcements as a (a.id)}
				{@const text = inReaderLocale(a, locale)}
				<li class="border-surface-200-800 border-b pb-3">
					<p dir="auto"><strong>{text.title}</strong></p>
					<p class="text-sm">
						{a.published_at.replace('T', ' ').slice(0, 16)} · {a.programme_id ? programmeName(a.programme_id) : t(locale, 'announcement_everyone')}{#if a.published_by_username}{' '}· {a.published_by_username}{/if}
					</p>
					{#if text.body}<p class="mt-1 whitespace-pre-line" dir="auto">{text.body}</p>{/if}
					{#if !missing('remove')}
						<form method="POST" action="?/remove" class="mt-1">
							<input type="hidden" name="announcement_id" value={a.id} />
							<button class="btn btn-sm preset-tonal-error" data-testid="announcement-remove-{a.id}">{t(locale, 'announcement_remove')}</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
