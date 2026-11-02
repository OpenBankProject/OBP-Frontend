<script lang="ts">
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	/**
	 * A status, eligibility or decision as a coloured badge. The colour only repeats the word, so it is never the
	 * only way the meaning is shown.
	 */
	let { locale, kind, value }: { locale: Locale; kind: 'status' | 'eligibility' | 'decision'; value: string } = $props();

	const TONES: Record<string, string> = {
		'status:draft': 'preset-tonal-surface',
		'status:open': 'preset-tonal-success',
		'status:published': 'preset-tonal-success',
		'status:closed': 'preset-tonal-warning',
		'status:submitted': 'preset-tonal-tertiary',
		'eligibility:eligible': 'preset-tonal-success',
		'eligibility:needs_review': 'preset-tonal-warning',
		'decision:shortlisted': 'preset-tonal-success',
		'decision:rejected': 'preset-tonal-error',
		'decision:needs_info': 'preset-tonal-warning',
		'decision:accepted': 'preset-tonal-success',
		'decision:waitlisted': 'preset-tonal-warning'
	};
	const tone = $derived(TONES[`${kind}:${value}`] ?? 'preset-tonal-surface');
</script>

{#if value}
	<span class="badge {tone}" data-testid="badge-{kind}-{value}">{t(locale, `${kind}_${value}` as MessageKey)}</span>
{/if}
