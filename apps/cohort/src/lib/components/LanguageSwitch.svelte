<script lang="ts">
	import { t, type Locale } from '$lib/i18n';

	/** Switches between English and Arabic, then returns to `path`. */
	let { locale, path }: { locale: Locale; path: string } = $props();
	const other = $derived<Locale>(locale === 'ar' ? 'en' : 'ar');
</script>

<form method="POST" action="/locale">
	<input type="hidden" name="locale" value={other} />
	<input type="hidden" name="redirect_to" value={path} />
	<button type="submit" class="btn btn-sm preset-tonal" lang={other} aria-label={t(locale, 'switch_language_label')} data-testid="switch-language"
		>{t(locale, 'switch_language')}</button
	>
</form>
