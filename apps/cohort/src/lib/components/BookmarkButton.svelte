<script lang="ts">
	import { Bookmark, BookmarkCheck } from '@lucide/svelte';
	import { t, type Locale } from '$lib/i18n';

	/** Save this record to the User's Saved page, or remove it from there; the page reloads where it was. */
	let {
		locale,
		kind,
		targetId,
		label,
		path,
		bookmarkId
	}: { locale: Locale; kind: 'call' | 'application'; targetId: string; label: string; path: string; bookmarkId: string | null } = $props();
</script>

{#if bookmarkId}
	<form method="POST" action="/saved?/remove" class="inline">
		<input type="hidden" name="bookmark_id" value={bookmarkId} />
		<input type="hidden" name="return_to" value={path} />
		<button class="btn btn-sm preset-tonal-primary" data-testid="bookmark-remove"><BookmarkCheck class="size-4" aria-hidden="true" />{t(locale, 'saved_saved')}</button>
	</form>
{:else}
	<form method="POST" action="/saved?/save" class="inline">
		<input type="hidden" name="kind" value={kind} />
		<input type="hidden" name="target_id" value={targetId} />
		<input type="hidden" name="label" value={label} />
		<input type="hidden" name="path" value={path} />
		<button class="btn btn-sm preset-tonal" data-testid="bookmark-save"><Bookmark class="size-4" aria-hidden="true" />{t(locale, 'saved_save')}</button>
	</form>
{/if}
