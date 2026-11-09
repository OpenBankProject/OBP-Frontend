<script lang="ts">
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const kinds = ['call', 'application'] as const;
</script>

<h1 class="h2">{t(locale, 'saved_heading')}</h1>
<p class="mt-2">{t(locale, 'saved_intro')}</p>
{#if form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{t(locale, 'staff_error')} {String(form.error)}</p>{/if}

{#if data.bookmarks.length === 0}
	<p class="mt-6" data-testid="saved-none">{t(locale, 'saved_none')}</p>
{:else}
	{#each kinds as kind (kind)}
		{@const list = data.bookmarks.filter((b) => b.kind === kind)}
		{#if list.length}
			<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="saved-{kind}">
				<h2 class="h4">{t(locale, `saved_kind_${kind}` as MessageKey)}</h2>
				<ul class="mt-2 flex flex-col gap-2">
					{#each list as b (b.id)}
						<li class="flex flex-wrap items-center justify-between gap-2">
							<a class="anchor" href={b.path}>{b.label || b.target_id}</a>
							<form method="POST" action="?/remove">
								<input type="hidden" name="bookmark_id" value={b.id} />
								<button class="btn btn-sm preset-tonal" data-testid="saved-remove-{b.id}">{t(locale, 'saved_remove')}</button>
							</form>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/each}
{/if}
