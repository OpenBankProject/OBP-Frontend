<script lang="ts">
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	/**
	 * A status, eligibility or decision as a coloured badge. The colour only repeats the word, so it is never the
	 * only way the meaning is shown.
	 */
	let { locale, kind, value }: { locale: Locale; kind: 'status' | 'eligibility' | 'decision'; value: string } = $props();

	const TONES: Record<string, string> = {
		'status:draft': 'ui-tone-neutral',
		'status:open': 'ui-tone-success',
		'status:published': 'ui-tone-success',
		'status:closed': 'ui-tone-warning',
		'status:submitted': 'ui-tone-info',
		'eligibility:eligible': 'ui-tone-success',
		'eligibility:needs_review': 'ui-tone-warning',
		'decision:shortlisted': 'ui-tone-success',
		'decision:rejected': 'ui-tone-error',
		'decision:needs_info': 'ui-tone-warning',
		'decision:accepted': 'ui-tone-success',
		'decision:waitlisted': 'ui-tone-warning'
	};
	const tone = $derived(TONES[`${kind}:${value}`] ?? 'ui-tone-neutral');
</script>

{#if value}
	<span class="badge {tone}" data-testid="badge-{kind}-{value}">{t(locale, `${kind}_${value}` as MessageKey)}</span>
{/if}
